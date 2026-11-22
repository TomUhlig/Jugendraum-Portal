import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { BookingFacts } from '@/components/BookingFacts';
import { StatusBadge } from '@/components/StatusBadge';
import { parseDecisionToken } from '@/lib/auth';
import { getContacts, checkOptions, confirmOnAlternative, checkExisting, decide, decideSeries, getBooking, getCategories, getExtras, listSeries } from '@/lib/data';
import { TemplatePicker } from '@/components/TemplatePicker';
import { fillTemplate } from '@/lib/templates';
import { whoText } from '@/lib/contacts';
import { berlinHm, fmtDay } from '@/lib/time';
import { afterDecision, afterSeriesDecision } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anfrage entscheiden', robots: { index: false } };

async function decideFromMail(fd: FormData) {
  'use server';
  const token = String(fd.get('token') ?? '');
  const action = fd.get('action') === 'reject' ? 'reject' : 'confirm';
  const whole = fd.get('whole') === '1';
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 500);
  const ctx = await parseDecisionToken(token);
  if (!ctx) redirect(`/entscheiden/${token}`);
  if (action === 'reject' && reason.length < 3) redirect(`/entscheiden/${token}?fehler=grund`);
  const one = await getBooking(ctx!.bookingId);
  const altStart = Number(fd.get('altStart')), altEnd = Number(fd.get('altEnd'));
  if (action === 'confirm' && altStart && altEnd) {
    const b = await confirmOnAlternative(ctx!.bookingId, ctx!.admin.name, altStart, altEnd);
    if (b) await afterDecision(b);
    redirect(`/entscheiden/${token}?erledigt=${b ? 'confirm' : 'schon'}`);
  }
  if (whole && one?.seriesId) {
    const list = await decideSeries(one.seriesId, action, ctx!.admin.name, action === 'reject' ? reason : undefined);
    await afterSeriesDecision(list);
    redirect(`/entscheiden/${token}?erledigt=${list.length ? action : 'schon'}`);
  }
  const b = await decide(ctx!.bookingId, action, ctx!.admin.name, action === 'reject' ? reason : undefined);
  if (b) await afterDecision(b);
  redirect(`/entscheiden/${token}?erledigt=${b ? action : 'schon'}`);
}

export default async function Entscheiden({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const ctx = await parseDecisionToken(token);
  const b = ctx ? await getBooking(ctx.bookingId) : null;
  const who = whoText((await getContacts()).map((c) => c.name));
  if (!ctx || !b) {
    return (
      <main className="wrap narrow" style={{ paddingBlock: 48 }}>
        <section className="card card-body stack">
          <h1 style={{ fontSize: '1.4rem' }}>Link ungültig oder abgelaufen</h1>
          <p className="muted">Entscheidungslinks gelten 14 Tage und nur für Team-Mitglieder mit Bearbeitungsrecht. Du kannst die Anfrage in der Verwaltung entscheiden.</p>
          <Link className="btn btn-primary" href="/admin" style={{ justifySelf: 'start' }}>Zur Verwaltung</Link>
        </section>
      </main>
    );
  }
  const cat = (await getCategories()).find((c) => c.id === b.categoryId);
  const open = b.status === 'requested';
  const series = b.seriesId ? (await listSeries(b.seriesId)).filter((x) => x.status === 'requested') : [];
  const whole = series.length > 1 ? '1' : '';
  const options = open && b.alternatives.length ? await checkOptions(b) : [];
  const check = open ? await checkExisting(b) : null;
  const done = sp.erledigt;
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <div className="stack">
        {done === 'confirm' && <div className="alert alert-ok"><Check className="icon" /><div><b>Bestätigt.</b> {b.silent ? 'Es wurde keine Mail verschickt.' : `${b.name} bekommt die Bestätigung per Mail.`}</div></div>}
        {done === 'reject' && <div className="alert alert-info"><div><b>Abgelehnt.</b> {b.silent ? '' : `${b.name} wird per Mail informiert.`}</div></div>}
        {done === 'schon' && <div className="alert alert-info"><div>Diese Anfrage wurde inzwischen schon bearbeitet.</div></div>}
        {sp.fehler === 'grund' && <div className="alert alert-bad"><div>Bitte gib zum Ablehnen eine kurze Begründung an. Sie steht in der Mail an den Bucher.</div></div>}
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Hallo {ctx.admin.name} · <span className="refno">{b.number}</span></span><h1 style={{ fontSize: '1.4rem' }}>{b.title}</h1></div><StatusBadge status={b.status} /></div>
          <div className="card-body stack">
            <BookingFacts b={b} cat={cat} lang="de" />
            <dl className="kv">
              <dt>Von</dt><dd>{b.name}{b.team ? ` (${b.team})` : ''} · {b.bookerType === 'external' ? 'nicht im Verein' : 'Mitglied'}</dd>
              <dt>Kontakt</dt><dd><a href={`mailto:${b.email}`}>{b.email}</a>{b.phone ? <> · <a href={`tel:${b.phone}`}>{b.phone}</a></> : null}</dd>
            </dl>
            {b.note && <div className="note">„{b.note}“</div>}
            {series.length > 1 && <div className="stack-sm"><b className="small">Serienanfrage: {series.length} Termine</b><ul className="repeat-list">{series.map((x) => <li key={x.id} className="ok"><span>{fmtDay(x.start)}</span><span className="small">{berlinHm(x.start)}</span></li>)}</ul></div>}
            {check && <span className={`badge b-${check.level === 'ok' ? 'ok' : check.level === 'warn' ? 'warn' : 'bad'}`} style={{ justifySelf: 'start', whiteSpace: 'normal' }}>{check.level === 'ok' ? 'Keine Konflikte' : check.messages.map((m) => m.text).join(' ')}</span>}
          </div>
          {open && (
            <div className="card-foot decide-foot">
              {options.length > 1 ? (
                <ul className="opt-list" style={{ width: '100%' }}>{options.map((o) => (
                  <li key={o.start}><span><b className="num">{fmtDay(o.start)}, {berlinHm(o.start)}–{berlinHm(o.end)}</b> <span className="muted small">{o.main ? 'Wunschtermin' : 'Ausweichtermin'}</span><br />
                    <span className={`badge b-${o.check.level === 'ok' ? 'ok' : o.check.level === 'warn' ? 'warn' : 'bad'}`} style={{ whiteSpace: 'normal' }}>{o.check.level === 'ok' ? 'frei' : o.check.messages[0]?.text}</span></span>
                    <form action={decideFromMail}><input type="hidden" name="token" value={token} /><input type="hidden" name="action" value="confirm" />
                      {!o.main && <><input type="hidden" name="altStart" value={o.start} /><input type="hidden" name="altEnd" value={o.end} /></>}
                      <button className="btn btn-ok" type="submit" disabled={o.check.level === 'block'}><Check className="icon-sm" />Bestätigen</button></form>
                  </li>))}</ul>
              ) : (
              <form action={decideFromMail}>
                <input type="hidden" name="token" value={token} /><input type="hidden" name="action" value="confirm" /><input type="hidden" name="whole" value={whole} />
                <button className="btn btn-ok btn-lg" type="submit"><Check className="icon-sm" />{whole ? `Alle ${series.length} bestätigen` : 'Bestätigen'}</button>
              </form>)}
              <details className="reject-box">
                <summary className="btn btn-danger"><X className="icon-sm" />Ablehnen …</summary>
                <form action={decideFromMail} className="stack-sm" style={{ marginTop: 12 }}>
                  <input type="hidden" name="token" value={token} /><input type="hidden" name="action" value="reject" /><input type="hidden" name="whole" value={whole} />
                  <label className="field"><span className="label">Begründung für {b.name}</span><textarea id="m-reason" name="reason" rows={3} required minLength={3} placeholder="z. B. An dem Abend ist schon eine Vereinsveranstaltung geplant." /></label>
                  <TemplatePicker target="m-reason" items={(await getExtras()).templates.filter((t) => t.use !== 'message').map((t) => ({ title: t.title, text: fillTemplate(t.text, { name: b.name, title: b.title, date: fmtDay(b.start), time: berlinHm(b.start), agreedWith: b.agreedWith, who }) }))} />
                  <button className="btn btn-danger" type="submit">Ablehnen und Mail senden</button>
                </form>
              </details>
            </div>
          )}
        </section>
        <Link href={`/admin/buchung/${b.id}`} className="small">In der Verwaltung öffnen (Anmeldung nötig)</Link>
      </div>
    </main>
  );
}
