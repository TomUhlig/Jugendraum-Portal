import { CalendarPlus, CheckCircle2, MessageSquareText } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { BookingFacts } from '@/components/BookingFacts';
import { StatusBadge } from '@/components/StatusBadge';
import { cancelByBooker, getBookingByToken, getCategories, getFeedback } from '@/lib/data';
import { afterBookerCancel } from '@/lib/notify';
import { PaySection } from '@/components/PaySection';
import { MessageThread } from '@/components/MessageThread';
import { addMessage, countRecentBookerMessages, listMessages, notifyRecipients } from '@/lib/data';
import { teamMails } from '@/lib/mail';
import { amountsDue, createPayment } from '@/lib/data';
import { createCheckout, stripeEnabled } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deine Buchung', robots: { index: false } };

async function cancel(formData: FormData) {
  'use server';
  const token = String(formData.get('token'));
  if (formData.get('sure') !== 'on') redirect(`/buchung/${token}?fehler=1#absagen`);
  const b = await cancelByBooker(token);
  if (b) await afterBookerCancel(b);
  redirect(`/buchung/${token}?storniert=1`);
}

async function sendMessage(fd: FormData) {
  'use server';
  const token = String(fd.get('token'));
  const body = String(fd.get('body') ?? '').trim().slice(0, 2000);
  const b = await getBookingByToken(token);
  if (!b) redirect('/');
  if (body.length < 2) redirect(`/buchung/${token}?nachricht=leer#nachrichten`);
  if (await countRecentBookerMessages(b!.id) >= 10) redirect(`/buchung/${token}?nachricht=viele#nachrichten`);
  await addMessage(b!.id, 'booker', b!.name, body);
  try { await teamMails.message(await notifyRecipients(), b!, body); } catch (e) { console.error(e); }
  redirect(`/buchung/${token}?nachricht=ok#nachrichten`);
}

async function payOnline(fd: FormData) {
  'use server';
  const token = String(fd.get('token'));
  const b = await getBookingByToken(token);
  if (!b || b.status !== 'confirmed' || !stripeEnabled()) redirect(`/buchung/${token}#bezahlen`);
  const due = amountsDue(b!);
  if (due.total <= 0) redirect(`/buchung/${token}#bezahlen`);
  let url: string;
  try {
    const items = [...(due.rent > 0 ? [{ part: 'rent' as const, amount: due.rent }] : []), ...(due.deposit > 0 ? [{ part: 'deposit' as const, amount: due.deposit }] : [])];
    const session = await createCheckout(b!, items);
    await createPayment(b!.id, 'stripe', due.total, due.parts, session.id);
    url = session.url;
  } catch (e) {
    console.error(e);
    redirect(`/buchung/${token}?zahlung=fehler#bezahlen`);
  }
  redirect(url!);
}

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const [cats, fb, messages] = await Promise.all([getCategories(), getFeedback(b.id), listMessages(b.id)]);
  const cat = cats.find((c) => c.id === b.categoryId);
  const active = ['pending_email', 'requested', 'confirmed'].includes(b.status);
  const future = b.start > Date.now();
  const past = b.end < Date.now();

  const steps: { label: string; state: 'done' | 'current' | 'failed' | ''; note?: string }[] = [
    { label: 'Anfrage gestellt', state: 'done' },
    { label: 'E-Mail bestätigt', state: b.status === 'pending_email' ? 'current' : b.status === 'expired' ? 'failed' : 'done', note: b.status === 'pending_email' ? 'Bitte klicke auf den Link in unserer Mail.' : b.status === 'expired' ? 'Nicht rechtzeitig bestätigt, die Anfrage ist verfallen.' : undefined },
    { label: b.status === 'rejected' ? 'Abgelehnt' : b.status === 'cancelled' ? 'Storniert' : 'Vom Orga-Team bestätigt',
      state: b.status === 'confirmed' ? 'done' : b.status === 'requested' ? 'current' : ['rejected', 'cancelled'].includes(b.status) ? 'failed' : '',
      note: b.status === 'requested' ? 'Das Orga-Team prüft deine Anfrage.' : b.rejectReason ?? undefined },
    { label: 'Termin', state: b.status === 'confirmed' ? (past ? 'done' : 'current') : '' },
  ];

  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <div className="stack">
        {sp.bestaetigt && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div><strong>Danke, deine E-Mail-Adresse ist bestätigt.</strong> {b.status === 'confirmed' ? 'Der Termin ist eingetragen, die Bestätigung liegt in deinem Postfach.' : 'Das Orga-Team meldet sich bei dir.'}</div></div>}
        {sp.storniert && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>Die Buchung ist storniert. Der Termin ist wieder frei.</div></div>}
        {sp.danke && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>Danke für deine Rückmeldung!</div></div>}

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Buchung <span className="refno">{b.number}</span></span><h1 style={{ fontSize: '1.4rem' }}>{b.title}</h1></div><StatusBadge status={b.status} /></div>
          <div className="card-body grid-2b">
            <BookingFacts b={b} cat={cat} />
            <ol className="timeline" aria-label="Status">
              {steps.map((s) => <li key={s.label} className={s.state}><div><b>{s.label}</b>{s.note && <div className="when">{s.note}</div>}</div></li>)}
            </ol>
          </div>
          {b.status === 'confirmed' && future && (
            <div className="card-foot inline"><a className="btn" href={`/buchung/${token}/kalender`}><CalendarPlus className="icon-sm" />In den Kalender übernehmen</a></div>
          )}
        </section>

        {sp.zahlung === 'bezahlt' && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div><strong>Danke, deine Zahlung ist eingegangen.</strong> Eine Bestätigung kommt per Mail.</div></div>}
        <PaySection b={b} token={token} payOnline={payOnline}
          notice={sp.zahlung === 'offen' ? 'Die Zahlung ist noch nicht abgeschlossen. Bei Lastschrift kann die Bestätigung ein paar Tage dauern.' : sp.zahlung === 'fehler' ? 'Die Online-Zahlung konnte gerade nicht gestartet werden. Bitte versuch es später noch einmal oder nutze die Überweisung.' : sp.abgebrochen ? 'Zahlung abgebrochen. Du kannst es jederzeit erneut versuchen.' : undefined} />
        {b.status === 'confirmed' && past && (
          <section className="card card-body stack">
            <div className="inline"><MessageSquareText className="icon" style={{ color: 'var(--brand-ink)' }} /><h2 className="section-title">Wie war es?</h2></div>
            {fb ? <p className="muted">Du hast uns {fb.rating} von 5 Punkten gegeben. Danke!</p> : <p className="muted">Hilf uns mit einer kurzen Rückmeldung, auch wenn etwas kaputtgegangen ist.</p>}
            <a className="btn" href={`/buchung/${token}/feedback`} style={{ justifySelf: 'start' }}>{fb ? 'Rückmeldung ändern' : 'Rückmeldung geben'}</a>
          </section>
        )}

        {!['expired', 'pending_email'].includes(b.status) && (
          <section className="card" id="nachrichten">
            <div className="card-head"><div><h2>Nachrichten</h2><p>Fragen zur Buchung? Schreib dem Orga-Team direkt hier.</p></div></div>
            <div className="card-body stack">
              <MessageThread messages={messages} mine="booker" empty="Noch keine Nachrichten." />
              {sp.nachricht === 'ok' && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>Nachricht gesendet. Die Antwort bekommst du per Mail.</div></div>}
              {sp.nachricht === 'viele' && <div className="alert alert-warn"><div>Du hast in der letzten Stunde schon viele Nachrichten geschickt. Bitte warte kurz.</div></div>}
              <form action={sendMessage} className="stack-sm">
                <input type="hidden" name="token" value={token} />
                <label htmlFor="msg" className="hp">Nachricht</label>
                <textarea id="msg" name="body" required minLength={2} maxLength={2000} placeholder="Deine Nachricht an das Orga-Team" style={{ minHeight: 80 }} />
                {sp.nachricht === 'leer' && <span className="field-error">Bitte schreib eine Nachricht.</span>}
                <button className="btn btn-primary" type="submit" style={{ justifySelf: 'start' }}>Senden</button>
              </form>
            </div>
          </section>
        )}

        {active && future && (
          <section className="card card-body stack" id="absagen">
            <h2 className="section-title">Termin absagen</h2>
            <p className="muted small">Wenn du den Raum nicht mehr brauchst, sag bitte ab, damit andere ihn nutzen können. Das Orga-Team wird automatisch informiert.</p>
            <form action={cancel} className="stack-sm">
              <input type="hidden" name="token" value={token} />
              <label className="check-inline"><input type="checkbox" name="sure" /> Ja, ich möchte diese Buchung absagen.</label>
              {sp.fehler && <span className="field-error">Bitte setze zuerst den Haken.</span>}
              <button className="btn btn-danger" type="submit" style={{ justifySelf: 'start' }}>Buchung absagen</button>
            </form>
          </section>
        )}
        <p className="muted small" style={{ textAlign: 'center' }}>Diese Seite ist nur über deinen persönlichen Link erreichbar. Bitte gib ihn nicht weiter. Alle deine Buchungen findest du unter <a href="/meine-buchungen">Meine Buchungen</a>.</p>
      </div>
    </main>
  );
}
