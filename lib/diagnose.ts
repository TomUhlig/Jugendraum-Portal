import 'server-only';
import postgres from 'postgres';
import { connectOptions } from './db';
import { mailMode } from './mail';

export type Check = { label: string; ok: boolean | null; hint?: string };

/** Übersetzt typische Verbindungsfehler in verständliche Hinweise. */
function explain(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const code = err.code ?? '', msg = err.message ?? String(e);
  if (code === '28P01' || /password authentication failed/i.test(msg)) return 'Das Datenbank-Passwort in DATABASE_URL ist falsch. Steht dort noch „[YOUR-PASSWORD]“? Das Passwort ohne eckige Klammern einsetzen. Sonderzeichen im Passwort (z. B. @ # / ?) machen Probleme: in Supabase unter Database → Settings ein neues Passwort nur aus Buchstaben und Zahlen setzen.';
  if (/tenant or user not found/i.test(msg)) return 'Supabase kennt den Benutzer nicht. Beim Session Pooler muss der Benutzer „postgres.<Projekt-ID>“ heißen. Die Adresse am besten noch einmal komplett unter Connect → Session pooler kopieren.';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return 'Der Servername in DATABASE_URL wurde nicht gefunden. Tippfehler beim Kopieren?';
  if (['ENETUNREACH', 'EHOSTUNREACH'].includes(code) || /db\..*\.supabase\.co/.test(msg)) return 'Die Datenbank ist nicht erreichbar. Wahrscheinlich wurde die „Direct connection“ kopiert. Vercel braucht die Adresse unter Connect → „Session pooler“ (endet auf pooler.supabase.com:5432).';
  if (['CONNECT_TIMEOUT', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code)) return 'Zeitüberschreitung beim Verbinden. Ist das Supabase-Projekt pausiert? Im Supabase-Dashboard „Restore project“ klicken. Sonst die Adresse unter Connect → Session pooler prüfen.';
  if (code === '3D000') return 'Die Datenbank im Pfad der Adresse existiert nicht. Am Ende der Adresse muss /postgres stehen.';
  if (/Invalid URL|invalid url/i.test(msg)) return 'DATABASE_URL ist keine gültige Adresse. Sie muss mit postgresql:// beginnen.';
  return `Unbekannter Fehler: ${msg.slice(0, 200)}`;
}

export async function runChecks(): Promise<{ checks: Check[]; dbOk: boolean; hasAdmins: boolean }> {
  const env = (k: string) => (process.env[k] ?? '').trim();
  const checks: Check[] = [];
  const url = env('DATABASE_URL');
  checks.push({ label: 'DATABASE_URL eingetragen', ok: !!url, hint: url ? undefined : 'In Vercel unter Settings → Environment Variables eintragen, dann Redeploy.' });
  if (url.includes('[YOUR-PASSWORD]')) checks.push({ label: 'Passwort in DATABASE_URL eingesetzt', ok: false, hint: '„[YOUR-PASSWORD]“ durch dein Datenbank-Passwort ersetzen (ohne eckige Klammern).' });

  let dbOk = false, schemaOk = false, hasAdmins = false;
  if (url && !url.includes('[YOUR-PASSWORD]')) {
    const sql = postgres(url, { ...connectOptions(url), max: 1 });
    try {
      await sql`select 1`;
      dbOk = true;
      checks.push({ label: 'Verbindung zur Datenbank', ok: true });
      const [{ n }] = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'
        and table_name in ('bookings', 'categories', 'settings', 'admins', 'blackouts', 'recurring_blocks', 'feedback')`;
      schemaOk = n === 7;
      checks.push({ label: 'Tabellen angelegt (db/schema.sql)', ok: schemaOk, hint: schemaOk ? undefined : n === 0 ? 'Das Skript db/schema.sql wurde noch nicht ausgeführt: In Supabase → SQL Editor den kompletten Inhalt einfügen und auf Run klicken.' : 'Das Schema ist veraltet. db/schema.sql noch einmal komplett im SQL Editor ausführen (zerstört keine Daten).' });
      if (schemaOk) { const [{ a }] = await sql`select count(*)::int as a from admins`; hasAdmins = a > 0; }
    } catch (e) {
      checks.push({ label: 'Verbindung zur Datenbank', ok: false, hint: explain(e) });
    } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
  }

  const appUrl = env('APP_URL');
  checks.push({ label: 'APP_URL eingetragen', ok: /^https?:\/\/[^/]+/.test(appUrl) && !appUrl.endsWith('/'), hint: !appUrl ? 'Die Adresse der Seite eintragen, z. B. https://jugendraum-portal.vercel.app' : appUrl.endsWith('/') ? 'Ohne Schrägstrich am Ende eintragen.' : !/^https?:\/\//.test(appUrl) ? 'Mit https:// beginnen.' : undefined });
  checks.push({ label: 'SESSION_SECRET (mind. 32 Zeichen)', ok: env('SESSION_SECRET').length >= 32 && env('SESSION_SECRET') !== 'bitte-ersetzen', hint: 'Einen langen Zufallswert eintragen, z. B. zwei UUIDs hintereinander.' });
  checks.push({ label: 'CRON_SECRET eingetragen', ok: env('CRON_SECRET').length >= 16 && env('CRON_SECRET') !== 'bitte-ersetzen', hint: 'Einen weiteren, anderen Zufallswert eintragen (für die täglichen Erinnerungen).' });
  const mode = mailMode();
  checks.push({ label: 'Mailversand eingerichtet', ok: mode !== 'console', hint: mode === 'console' ? 'SMTP_HOST, SMTP_PORT, SMTP_USER und SMTP_PASS eintragen (Schritt 3 der Anleitung).' : undefined });
  if (env('STRIPE_SECRET_KEY')) {
    checks.push({ label: 'Stripe: Webhook-Secret eingetragen', ok: env('STRIPE_WEBHOOK_SECRET').startsWith('whsec_'), hint: 'Ohne STRIPE_WEBHOOK_SECRET werden Lastschriften erst verbucht, wenn jemand die Buchungsseite öffnet. Webhook in Stripe anlegen (siehe EINRICHTUNG.md, Bezahlung).' });
  }
  if (!hasAdmins) checks.push({ label: 'INITIAL_ADMIN_EMAIL für die erste Anmeldung', ok: !!env('INITIAL_ADMIN_EMAIL'), hint: 'Deine E-Mail-Adresse eintragen. Damit meldest du dich als erster Admin an.' });
  for (const c of checks) if (c.ok) delete c.hint;
  return { checks, dbOk: dbOk && schemaOk, hasAdmins };
}
