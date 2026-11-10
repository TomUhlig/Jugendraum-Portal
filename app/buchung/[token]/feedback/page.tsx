import { notFound, redirect } from 'next/navigation';
import { getBookingByToken, getFeedback, notifyRecipients, saveFeedback } from '@/lib/data';
import { teamMails } from '@/lib/mail';
import { pushTeam } from '@/lib/push';
import { fmtLong } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rückmeldung', robots: { index: false } };

async function send(fd: FormData) {
  'use server';
  const token = String(fd.get('token'));
  const rating = Number(fd.get('rating'));
  if (!(rating >= 1 && rating <= 5)) redirect(`/buchung/${token}/feedback?fehler=1`);
  const damage = fd.get('damage') === 'on';
  const comment = String(fd.get('comment') ?? '').slice(0, 1000).trim();
  const b = await saveFeedback(token, rating, comment, damage);
  if (b && damage) {
    try { await teamMails.damage(await notifyRecipients(), b, comment); } catch (e) { console.error(e); }
    await pushTeam({ title: `Schaden gemeldet: ${b.title}`, body: comment.slice(0, 140) || 'Ohne Beschreibung', url: `/admin/buchung/${b.id}` });
  }
  redirect(`/buchung/${token}?danke=1`);
}

export default async function Feedback({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b || b.status !== 'confirmed' || b.start > Date.now()) notFound();
  const fb = await getFeedback(b.id);
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <form action={send} className="card">
        <div className="card-head"><div><span className="eyebrow">{b.title} · {fmtLong(b.start)}</span><h1 style={{ fontSize: '1.4rem' }}>Wie war es im Jugendraum?</h1></div></div>
        <div className="card-body stack">
          <input type="hidden" name="token" value={token} />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack-sm">
            <legend className="field" style={{ fontWeight: 600, marginBottom: 8 }}>Gesamteindruck (1 = schlecht, 5 = sehr gut)</legend>
            <div className="rating">{[1, 2, 3, 4, 5].map((n) => <label key={n}><input type="radio" name="rating" value={n} defaultChecked={fb?.rating === n} required />{n}</label>)}</div>
            {sp.fehler && <span className="field-error">Bitte wähle eine Bewertung.</span>}
          </fieldset>
          <label className="choice"><input type="checkbox" name="damage" defaultChecked={fb?.damage} /><span><b>Es ist etwas kaputtgegangen oder fehlt.</b><br /><span className="muted small">Das Orga-Team wird sofort informiert. Beschreib bitte kurz, was passiert ist.</span></span></label>
          <div className="field"><label htmlFor="comment">Was sollen wir wissen? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><textarea id="comment" name="comment" maxLength={1000} defaultValue={fb?.comment} placeholder="Lob, Kritik, Verbesserungsvorschläge …" /></div>
        </div>
        <div className="card-foot inline"><button className="btn btn-primary" type="submit">Rückmeldung senden</button><a className="btn btn-ghost" href={`/buchung/${token}`}>Abbrechen</a></div>
      </form>
    </main>
  );
}
