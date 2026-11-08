import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createLoginLink, currentAdmin } from '@/lib/auth';
import { teamMails } from '@/lib/mail';
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
    // Entwicklung ohne Mailversand: Link direkt anzeigen
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') redirect('/admin/anmelden?gesendet=1&dev=' + encodeURIComponent(res.link));
  }
  redirect('/admin/anmelden?gesendet=1');
}

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (await currentAdmin()) redirect('/admin');
  const sp = await searchParams;
  return (
    <main className="wrap narrow" style={{ paddingBlock: 40 }}>
      <div className="panel stack">
        <span className="ribbon" style={{ justifySelf: 'start' }}>Verwaltung</span>
        <h1 style={{ fontSize: '1.8rem' }}>Anmelden</h1>
        {sp.gesendet ? (
          <>
            <p className="notice">Wenn die Adresse zum Orga-Team gehört, ist jetzt ein Login-Link unterwegs. Er ist 15 Minuten gültig.</p>
            {sp.dev && <p className="muted">Entwicklungsmodus (kein Mailversand eingerichtet): <a href={sp.dev}>Direkt anmelden</a></p>}
          </>
        ) : (
          <form action={requestLink} className="stack">
            <p className="muted" style={{ margin: 0 }}>Kein Passwort nötig. Wir schicken dir einen Link per Mail.</p>
            <div className="field"><label htmlFor="email">E-Mail-Adresse</label><input type="email" id="email" name="email" required autoComplete="email" /></div>
            <button className="cta" type="submit">Login-Link senden</button>
          </form>
        )}
      </div>
    </main>
  );
}
