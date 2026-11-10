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

export default async function Warteliste({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const w = token === 'abgemeldet' ? null : await getWaitByToken(token);
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 520 }}>
      <section className="card card-body stack">
        <div><span className="eyebrow">Jugendraum</span><h1 style={{ fontSize: '1.5rem' }}>Warteliste</h1></div>
        {!w ? (
          <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>Du stehst nicht (mehr) auf der Warteliste. Du bekommst keine weiteren Mails zu diesem Termin.</div></div>
        ) : (
          <form action={leave} className="stack">
            <p>Du stehst auf der Warteliste für <b>{fmtLong(w.start)}, {berlinHm(w.start)}–{berlinHm(w.end)} Uhr</b>.{w.notifiedAt && ' Wir haben dir bereits geschrieben, dass der Termin frei geworden ist.'}</p>
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-danger" type="submit" style={{ justifySelf: 'start' }}>Von der Warteliste abmelden</button>
          </form>
        )}
        <a href="/" className="small">Zur Buchungsseite</a>
      </section>
    </main>
  );
}
