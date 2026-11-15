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
    await bookerMails.myBookings(email, `${appUrl()}/meine-buchungen/${bookerToken(email)}`, await getLang());
  }
  redirect('/meine-buchungen?gesendet=1'); // gleiche Antwort, egal ob es Buchungen gibt (Datenschutz)
}

import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';

export default async function MeineBuchungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const M = t(await getLang()).mine;
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 520 }}>
      <section className="card card-body stack">
        <div><span className="eyebrow">Jugendraum</span><h1 style={{ fontSize: '1.5rem' }}>{M.title}</h1></div>
        {sp.gesendet ? (
          <div className="alert alert-ok"><MailCheck className="icon" /><div>{M.sent}</div></div>
        ) : (
          <form action={request} className="stack">
            <p className="muted">{M.lead}</p>
            <div className="field"><label htmlFor="email">{M.email}</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
            <button className="btn btn-primary btn-lg" type="submit">{M.submit}</button>
          </form>
        )}
      </section>
    </main>
  );
}
