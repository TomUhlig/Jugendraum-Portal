import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { MailCheck } from 'lucide-react';
import { createLoginLink, currentAdmin } from '@/lib/auth';
import { mailMode, teamMails } from '@/lib/mail';
import { appUrl } from '@/lib/url';
import { rateLimited } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anmelden', robots: { index: false } };

async function requestLink(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim();
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local';
  if (!email || rateLimited('login:' + ip, 10, 15 * 60_000)) redirect('/admin/anmelden?gesendet=1');
  const res = await createLoginLink(email, appUrl());
  if (res) {
    await teamMails.login(res.to, res.link);
    if (mailMode() === 'console' && process.env.NODE_ENV !== 'production') redirect('/admin/anmelden?gesendet=1&dev=' + encodeURIComponent(res.link));
  }
  redirect('/admin/anmelden?gesendet=1');
}

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (await currentAdmin()) redirect('/admin');
  const sp = await searchParams;
  return (
    <main className="wrap" style={{ paddingBlock: 56, maxWidth: 460 }}>
      <section className="card">
        <div className="card-body stack">
          <div><span className="eyebrow">Jugendraum · Verwaltung</span><h1 style={{ fontSize: '1.5rem' }}>Anmelden</h1></div>
          {mailMode() === 'console' && process.env.NODE_ENV === 'production' && (
            <div className="alert alert-warn"><div><strong>Mailversand ist noch nicht eingerichtet.</strong> Ohne Mailversand kann kein Anmeldelink verschickt werden. Trage beim Hosting die SMTP- oder Resend-Daten ein (Anleitung: EINRICHTUNG.md, Schritt 4) und starte die Seite neu.</div></div>
          )}
          {sp.gesendet ? (
            <>
              <div className="alert alert-ok"><MailCheck className="icon" /><div>Wenn die Adresse zum Orga-Team gehört, ist jetzt ein Anmeldelink unterwegs. Er ist 15 Minuten gültig.</div></div>
              {sp.dev && <p className="muted small">Entwicklungsmodus ohne Mailversand: <a href={sp.dev}>direkt anmelden</a></p>}
              <a href="/admin/anmelden" className="small">Andere Adresse verwenden</a>
            </>
          ) : (
            <form action={requestLink} className="stack">
              <p className="muted">Kein Passwort nötig. Wir schicken dir einen Anmeldelink per E-Mail.</p>
              <div className="field"><label htmlFor="email">E-Mail-Adresse</label><input type="email" id="email" name="email" required autoComplete="email" autoFocus /></div>
              <button className="btn btn-primary btn-lg" type="submit">Anmeldelink senden</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
