import 'server-only';
import { createSign } from 'node:crypto';
import { db } from './db';
import type { Booking } from './data';
import type { Blackout, Category } from './rules';
import { after } from 'next/server';
import { appUrl } from './url';
import { berlinToUtc } from './time';

/**
 * Google-Kalender über ein Dienstkonto (ohne Anmeldefenster):
 *  GOOGLE_SERVICE_ACCOUNT = komplette JSON-Schlüsseldatei des Dienstkontos
 *  GOOGLE_CALENDAR_ID     = Kalender-ID, der Kalender ist für die Dienstkonto-Adresse freigegeben („Änderungen an Terminen vornehmen“)
 * GOOGLE_API_BASE / GOOGLE_TOKEN_URL nur für Tests.
 */
type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
export type GoogleSettings = { export: boolean; import: boolean; publicTitles: boolean };
const DEFAULTS: GoogleSettings = { export: true, import: true, publicTitles: false };

function account(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const a = JSON.parse(json) as ServiceAccount;
    return a.client_email && a.private_key ? { ...a, private_key: a.private_key.replace(/\\n/g, '\n') } : null;
  } catch { return null; }
}
export const calendarId = () => process.env.GOOGLE_CALENDAR_ID?.trim() || '';
export const googleConfigured = () => !!(account() && calendarId());
export const serviceEmail = () => account()?.client_email ?? '';
const apiBase = () => (process.env.GOOGLE_API_BASE || 'https://www.googleapis.com/calendar/v3').replace(/\/$/, '');

export async function googleSettings(): Promise<GoogleSettings> {
  try { const [r] = await db()`select value from settings where key = 'google'`; return { ...DEFAULTS, ...(r?.value ?? {}) }; } catch { return DEFAULTS; }
}

const g = globalThis as unknown as { __gtoken?: { token: string; exp: number }; __gbusy?: { at: number; from: number; to: number; list: Blackout[] } };
const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Zugriffstoken per signiertem JWT (RS256), 1 Stunde gültig, wird zwischengespeichert. */
async function token(): Promise<string> {
  if (g.__gtoken && g.__gtoken.exp > Date.now() + 60_000) return g.__gtoken.token;
  const a = account();
  if (!a) throw new Error('Google-Dienstkonto fehlt oder ist ungültig (GOOGLE_SERVICE_ACCOUNT).');
  const aud = process.env.GOOGLE_TOKEN_URL || a.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/calendar', aud, iat: now, exp: now + 3600 }))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(a.private_key);
  const res = await fetch(aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Google-Anmeldung fehlgeschlagen: ${j.error_description ?? j.error ?? res.status}`);
  g.__gtoken = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${apiBase()}/calendars/${encodeURIComponent(calendarId())}${path}`, {
    method, headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store',
  });
  const data = res.status === 204 ? ({} as T) : ((await res.json().catch(() => ({}))) as T);
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google ${res.status}: ${(data as { error?: { message?: string } })?.error?.message ?? 'Fehler'}`);
  return { status: res.status, data };
}

/** Verbindung prüfen: liefert den Kalendernamen. */
export async function testConnection(): Promise<string> {
  const { status, data } = await api<{ summary?: string }>('GET', '');
  if (status === 404) throw new Error('Kalender nicht gefunden. Ist die Kalender-ID richtig und der Kalender für das Dienstkonto freigegeben?');
  return data.summary ?? calendarId();
}

const STATUS_PREFIX: Record<string, string> = { requested: '[Anfrage] ', pending_email: '[unbestätigt] ' };
function eventBody(b: Booking, c?: Category) {
  return {
    summary: `${STATUS_PREFIX[b.status] ?? ''}${b.title}`,
    description: [`${c?.name ?? ''} · ${b.guests} Personen`, `${b.name}${b.team ? ' (' + b.team + ')' : ''}${b.phone ? ' · ' + b.phone : ''}`, `Abgesprochen mit ${b.agreedWith}`, `${b.number} · ${appUrl()}/admin/buchung/${b.id}`].join('\n'),
    location: 'Jugendraum SV Heepen',
    start: { dateTime: new Date(b.start).toISOString(), timeZone: 'Europe/Berlin' },
    end: { dateTime: new Date(b.end).toISOString(), timeZone: 'Europe/Berlin' },
    status: b.status === 'confirmed' ? 'confirmed' : 'tentative',
    transparency: 'opaque',
    extendedProperties: { private: { jugendraumId: b.id } },
  };
}

/** Eine Buchung nach Google übertragen bzw. dort entfernen. Fehler werden protokolliert, nicht geworfen. */
export async function syncToGoogle(b: Booking, c?: Category): Promise<void> {
  if (!googleConfigured() || !(await googleSettings()).export) return;
  try {
    if (!c) { const [r] = await db()`select name from categories where id = ${b.categoryId}`; c = r ? ({ name: r.name } as Category) : undefined; }
    const active = b.status === 'confirmed' || b.status === 'requested';
    const [row] = await db()`select google_event_id from bookings where id = ${b.id}`;
    const eventId = row?.google_event_id as string | null;
    if (!active) {
      if (eventId) { await api('DELETE', `/events/${encodeURIComponent(eventId)}`); await db()`update bookings set google_event_id = null where id = ${b.id}`; }
      return;
    }
    if (eventId) {
      const { status } = await api('PATCH', `/events/${encodeURIComponent(eventId)}`, eventBody(b, c));
      if (status !== 404 && status !== 410) return;
    }
    const { data } = await api<{ id: string }>('POST', '/events', eventBody(b, c));
    if (data.id) await db()`update bookings set google_event_id = ${data.id} where id = ${b.id}`;
  } catch (e) {
    console.error('Google-Kalender:', e);
    await db()`insert into audit_log (actor, booking_id, action, detail) values ('Google', ${b.id}, 'google-error', ${db().json({ message: String((e as Error).message).slice(0, 300) })})`.catch(() => {});
  }
}

type GEvent = { id: string; summary?: string; status?: string; transparency?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; extendedProperties?: { private?: { jugendraumId?: string } } };

/** Termine aus dem Google-Kalender als Sperren (eigene Buchungen und „frei“-Termine ausgenommen). 5 Minuten zwischengespeichert. */
export async function googleBusy(from: number, to: number): Promise<Blackout[]> {
  if (!googleConfigured()) return [];
  const s = await googleSettings();
  if (!s.import) return [];
  const c = g.__gbusy;
  if (c && Date.now() - c.at < 5 * 60_000 && c.from <= from && c.to >= to) return c.list.filter((b) => b.end > from && b.start < to);
  const wideFrom = Math.min(from, Date.now() - 86400e3), wideTo = Math.max(to, Date.now() + 120 * 86400e3);
  try {
    const out: Blackout[] = [];
    let pageToken = '';
    for (let i = 0; i < 5; i++) {
      const q = new URLSearchParams({ timeMin: new Date(wideFrom).toISOString(), timeMax: new Date(wideTo).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(pageToken ? { pageToken } : {}) });
      const { data } = await api<{ items?: GEvent[]; nextPageToken?: string }>('GET', `/events?${q}`);
      for (const e of data.items ?? []) {
        if (e.status === 'cancelled' || e.transparency === 'transparent' || e.extendedProperties?.private?.jugendraumId) continue;
        const start = e.start?.dateTime ? Date.parse(e.start.dateTime) : e.start?.date ? berlinToUtc(e.start.date, '00:00') : NaN;
        const end = e.end?.dateTime ? Date.parse(e.end.dateTime) : e.end?.date ? berlinToUtc(e.end.date, '00:00') : NaN;
        if (!isFinite(start) || !isFinite(end) || end <= start) continue;
        out.push({ id: `g:${e.id}`, start, end, scope: 'all', reason: s.publicTitles && e.summary ? e.summary : 'Vereinstermin' });
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    g.__gbusy = { at: Date.now(), from: wideFrom, to: wideTo, list: out };
    return out.filter((b) => b.end > from && b.start < to);
  } catch (e) {
    console.error('Google-Kalender (Import):', e);
    return c ? c.list.filter((b) => b.end > from && b.start < to) : [];
  }
}
export const clearGoogleCache = () => { g.__gbusy = undefined; };

/** Änderungen nach Google übertragen, ohne die Antwort an den Nutzer aufzuhalten. */
export function queueGoogle(list: (Booking | null | undefined)[]) {
  const items = list.filter((b): b is Booking => !!b);
  if (!items.length || !googleConfigured()) return;
  const run = async () => { for (const b of items) await syncToGoogle(b); };
  try { after(run); } catch { void run(); }
}
