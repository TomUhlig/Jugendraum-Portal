import { CheckCircle2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getWaitByToken, removeWait } from '@/lib/data';
import { berlinHm, fmtLong } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Warteliste', robots: { index: false } };

async function leave(fd: FormData) {
  'use server';
  await removeWait(String(fd.get('token')));
  redirect('/warteliste/abgemeldet');
}

import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';

export default async function Warteliste({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const w = token === 'abgemeldet' ? null : await getWaitByToken(token);
  const lang = await getLang();
  const W = t(lang).wait;
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 520 }}>
      <section className="card card-body stack">
        <div><span className="eyebrow">Jugendraum</span><h1 style={{ fontSize: '1.5rem' }}>{W.title}</h1></div>
        {!w ? (
          <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>{W.gone}</div></div>
        ) : (
          <form action={leave} className="stack">
            <p>{W.onList(`${fmtLong(w.start, lang)}, ${berlinHm(w.start)}–${berlinHm(w.end)}${lang === 'de' ? ' Uhr' : ''}`)}{w.notifiedAt && W.notified}</p>
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-danger" type="submit" style={{ justifySelf: 'start' }}>{W.leave}</button>
          </form>
        )}
        <a href="/" className="small">{W.toBooking}</a>
      </section>
    </main>
  );
}
