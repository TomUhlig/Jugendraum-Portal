import { MailCheck } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { bookerToken } from '@/lib/auth';
import { hasBookings } from '@/lib/data';
import { bookerMails } from '@/lib/mail';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { appUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meine Buchungen' };

async function request(fd: FormData) {
  'use server';
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const req = new Request('http://x', { headers: await headers() });
  if (/^\S+@\S+\.\S+$/.test(email) && !rateLimited('mine:' + clientIp(req), 6, 60 * 60_000) && await hasBookings(email)) {
    await bookerMails.myBookings(email, `${appUrl()}/meine-buchungen/${bookerToken(email)}`);
  }
  redirect('/meine-buchungen?gesendet=1'); // gleiche Antwort, egal ob es Buchungen gibt (Datenschutz)
}

export default async function MeineBuchungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 520 }}>
      <section className="card card-body stack">
        <div><span className="eyebrow">Jugendraum</span><h1 style={{ fontSize: '1.5rem' }}>Meine Buchungen</h1></div>
        {sp.gesendet ? (
          <div className="alert alert-ok"><MailCheck className="icon" /><div>Wenn es zu dieser Adresse Buchungen gibt, ist jetzt eine Mail mit dem Link zu deiner Übersicht unterwegs. Schau auch im Spam-Ordner nach.</div></div>
        ) : (
          <form action={request} className="stack">
            <p className="muted">Du findest den Link zu deiner Buchung nicht mehr? Gib die E-Mail-Adresse ein, mit der du angefragt hast. Wir schicken dir einen Link zu all deinen Buchungen.</p>
            <div className="field"><label htmlFor="email">E-Mail-Adresse</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
            <button className="btn btn-primary btn-lg" type="submit">Link zuschicken</button>
          </form>
        )}
      </section>
    </main>
  );
}
