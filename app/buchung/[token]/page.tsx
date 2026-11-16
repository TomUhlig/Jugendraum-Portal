import { CalendarPlus, CheckCircle2, FileText, MessageSquareText, Receipt, RotateCcw } from 'lucide-react';
import { rebookHref } from '@/lib/gcal-link';
import { berlinHm as hmOf, berlinHm, fmtDay } from '@/lib/time';
import { notFound, redirect } from 'next/navigation';
import { BookingFacts } from '@/components/BookingFacts';
import { StatusBadge } from '@/components/StatusBadge';
import { cancelByBooker, getBookingByToken, getCategories, getFeedback, listSeries } from '@/lib/data';
import { afterBookerCancel } from '@/lib/notify';
import { PaySection } from '@/components/PaySection';
import { MessageThread } from '@/components/MessageThread';
import { addMessage, countRecentBookerMessages, listMessages, notifyRecipients } from '@/lib/data';
import { teamMails } from '@/lib/mail';
import { pushTeam } from '@/lib/push';
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
  await pushTeam({ title: `Nachricht von ${b!.name}`, body: body.slice(0, 140), url: `/admin/buchung/${b!.id}#nachrichten`, tag: 'msg-' + b!.id });
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

import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { googleCalendarLink } from '@/lib/gcal-link';
import { appUrl } from '@/lib/url';

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const [cats, fb, messages, series] = await Promise.all([getCategories(), getFeedback(b.id), listMessages(b.id), b.seriesId ? listSeries(b.seriesId) : Promise.resolve([])]);
  const cat = cats.find((c) => c.id === b.categoryId);
  const lang = await getLang();
  const B = t(lang).booker, P = t(lang).pay;
  const active = ['pending_email', 'requested', 'confirmed'].includes(b.status);
  const future = b.start > Date.now();
  const past = b.end < Date.now();

  const steps: { label: string; state: 'done' | 'current' | 'failed' | ''; note?: string }[] = [
    { label: B.tl.requested, state: 'done' },
    { label: B.tl.email, state: b.status === 'pending_email' ? 'current' : b.status === 'expired' ? 'failed' : 'done', note: b.status === 'pending_email' ? B.tl.emailWait : b.status === 'expired' ? B.tl.emailExpired : undefined },
    { label: b.status === 'rejected' ? B.tl.rejected : b.status === 'cancelled' ? B.tl.cancelled : B.tl.decided,
      state: b.status === 'confirmed' ? 'done' : b.status === 'requested' ? 'current' : ['rejected', 'cancelled'].includes(b.status) ? 'failed' : '',
      note: b.status === 'requested' ? B.tl.reviewing : b.rejectReason ?? undefined },
    { label: B.tl.event, state: b.status === 'confirmed' ? (past ? 'done' : 'current') : '' },
  ];

  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <div className="stack">
        {sp.bestaetigt && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>{B.confirmed(b.status === 'confirmed')}</div></div>}
        {sp.storniert && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>{B.cancelledMsg}</div></div>}
        {sp.danke && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>{B.thanksFeedback}</div></div>}

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">{B.booking} <span className="refno">{b.number}</span></span><h1 style={{ fontSize: '1.4rem' }}>{b.title}</h1></div><StatusBadge status={b.status} lang={lang} /></div>
          <div className="card-body grid-2b">
            <BookingFacts b={b} cat={cat} lang={lang} />
            <ol className="timeline" aria-label="Status">
              {steps.map((s) => <li key={s.label} className={s.state}><div><b>{s.label}</b>{s.note && <div className="when">{s.note}</div>}</div></li>)}
            </ol>
          </div>
          {b.status === 'confirmed' && future && (
            <div className="card-foot inline"><a className="btn" href={`/buchung/${token}/kalender`}><CalendarPlus className="icon-sm" />{B.toCalendar}</a>
              <a className="btn" target="_blank" rel="noopener" href={googleCalendarLink({ title: `Jugendraum: ${b.title}`, start: b.start, end: b.end, details: `${b.number} · ${appUrl()}/buchung/${token}`, location: 'Jugendraum SV Heepen' })}><CalendarPlus className="icon-sm" />{B.toGoogle}</a>
              <a className="btn" href={`/buchung/${token}/hausordnung`} target="_blank" rel="noopener"><FileText className="icon-sm" />{B.rulesPdf}</a>
              {b.keyHandedOut && <a className="btn" href={`/buchung/${token}/protokoll`} target="_blank" rel="noopener"><FileText className="icon-sm" />{B.protocol}</a>}
              {(b.rentPaid || b.depositPaid) && <a className="btn" href={`/buchung/${token}/quittung`}><Receipt className="icon-sm" />{B.receipt}</a>}</div>
          )}
          {!(b.status === 'confirmed' && future) && (b.status !== 'pending_email' && b.status !== 'requested') && (
            <div className="card-foot inline">
              <a className="btn btn-primary" href={rebookHref(b, hmOf)}><RotateCcw className="icon-sm" />{B.rebook}</a>
              {b.keyHandedOut && <a className="btn" href={`/buchung/${token}/protokoll`} target="_blank" rel="noopener"><FileText className="icon-sm" />{B.protocol}</a>}
              {(b.rentPaid || b.depositPaid) && <a className="btn" href={`/buchung/${token}/quittung`}><Receipt className="icon-sm" />{B.receipt}</a>}
            </div>
          )}
        </section>

        {series.length > 1 && (
          <section className="card">
            <div className="card-head"><h2>{({ de: 'Alle Termine dieser Serie', en: 'All dates in this series', tr: 'Bu serinin tüm tarihleri' } as const)[lang]}</h2><span className="muted small">{series.length}</span></div>
            <ul className="list">{series.map((x) => (
              <li key={x.id} className="between" style={{ paddingBlock: 8 }}>
                <a href={`/buchung/${x.manageToken}`} className="num" style={{ fontWeight: x.id === b.id ? 700 : 400 }}>{fmtDay(x.start, lang)}, {berlinHm(x.start)}–{berlinHm(x.end)}</a>
                <StatusBadge status={x.status} lang={lang} />
              </li>
            ))}</ul>
          </section>
        )}
        {sp.zahlung === 'bezahlt' && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>{B.paidMsg}</div></div>}
        <PaySection b={b} token={token} payOnline={payOnline} lang={lang}
          notice={sp.zahlung === 'offen' ? P.notDone : sp.zahlung === 'fehler' ? P.failed : sp.abgebrochen ? P.aborted : undefined} />
        {b.status === 'confirmed' && past && (
          <section className="card card-body stack">
            <div className="inline"><MessageSquareText className="icon" style={{ color: 'var(--brand-ink)' }} /><h2 className="section-title">{B.howWasIt}</h2></div>
            {fb ? <p className="muted">{B.youRated(fb.rating)}</p> : <p className="muted">{B.rateAsk}</p>}
            <a className="btn" href={`/buchung/${token}/feedback`} style={{ justifySelf: 'start' }}>{fb ? B.rateChange : B.rateGive}</a>
          </section>
        )}

        {!['expired', 'pending_email'].includes(b.status) && (
          <section className="card" id="nachrichten">
            <div className="card-head"><div><h2>{B.messages}</h2><p>{B.messagesLead}</p></div></div>
            <div className="card-body stack">
              <MessageThread messages={messages} mine="booker" empty={B.noMessages} lang={lang} />
              {sp.nachricht === 'ok' && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>{B.msgSent}</div></div>}
              {sp.nachricht === 'viele' && <div className="alert alert-warn"><div>{B.msgMany}</div></div>}
              <form action={sendMessage} className="stack-sm">
                <input type="hidden" name="token" value={token} />
                <label htmlFor="msg" className="hp">{B.messages}</label>
                <textarea id="msg" name="body" required minLength={2} maxLength={2000} placeholder={B.msgPh} style={{ minHeight: 80 }} />
                {sp.nachricht === 'leer' && <span className="field-error">{B.msgEmpty}</span>}
                <button className="btn btn-primary" type="submit" style={{ justifySelf: 'start' }}>{B.send}</button>
              </form>
            </div>
          </section>
        )}

        {active && future && (
          <section className="card card-body stack" id="absagen">
            <h2 className="section-title">{B.cancelTitle}</h2>
            <p className="muted small">{B.cancelText}</p>
            <form action={cancel} className="stack-sm">
              <input type="hidden" name="token" value={token} />
              <label className="check-inline"><input type="checkbox" name="sure" /> {B.cancelSure}</label>
              {sp.fehler && <span className="field-error">{B.cancelTick}</span>}
              <button className="btn btn-danger" type="submit" style={{ justifySelf: 'start' }}>{B.cancelBtn}</button>
            </form>
          </section>
        )}
        <p className="muted small" style={{ textAlign: 'center' }}>{B.privateLink} <a href="/meine-buchungen">{t(lang).nav.mine}</a>.</p>
      </div>
    </main>
  );
}
