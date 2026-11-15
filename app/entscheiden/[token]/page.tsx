import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { BookingFacts } from '@/components/BookingFacts';
import { StatusBadge } from '@/components/StatusBadge';
import { parseDecisionToken } from '@/lib/auth';
import { checkExisting, decide, getBooking, getCategories } from '@/lib/data';
import { afterDecision } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anfrage entscheiden', robots: { index: false } };

async function decideFromMail(fd: FormData) {
  'use server';
  const token = String(fd.get('token') ?? '');
  const action = fd.get('action') === 'reject' ? 'reject' : 'confirm';
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 500);
  const ctx = await parseDecisionToken(token);
  if (!ctx) redirect(`/entscheiden/${token}`);
  if (action === 'reject' && reason.length < 3) redirect(`/entscheiden/${token}?fehler=grund`);
  const b = await decide(ctx!.bookingId, action, ctx!.admin.name, action === 'reject' ? reason : undefined);
  if (b) await afterDecision(b);
  redirect(`/entscheiden/${token}?erledigt=${b ? action : 'schon'}`);
}

export default async function Entscheiden({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const ctx = await parseDecisionToken(token);
  const b = ctx ? await getBooking(ctx.bookingId) : null;
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
            {check && <span className={`badge b-${check.level === 'ok' ? 'ok' : check.level === 'warn' ? 'warn' : 'bad'}`} style={{ justifySelf: 'start', whiteSpace: 'normal' }}>{check.level === 'ok' ? 'Keine Konflikte' : check.messages.map((m) => m.text).join(' ')}</span>}
          </div>
          {open && (
            <div className="card-foot decide-foot">
              <form action={decideFromMail}>
                <input type="hidden" name="token" value={token} /><input type="hidden" name="action" value="confirm" />
                <button className="btn btn-ok btn-lg" type="submit"><Check className="icon-sm" />Bestätigen</button>
              </form>
              <details className="reject-box">
                <summary className="btn btn-danger"><X className="icon-sm" />Ablehnen …</summary>
                <form action={decideFromMail} className="stack-sm" style={{ marginTop: 12 }}>
                  <input type="hidden" name="token" value={token} /><input type="hidden" name="action" value="reject" />
                  <label className="field"><span className="label">Begründung für {b.name}</span><textarea name="reason" rows={3} required minLength={3} placeholder="z. B. An dem Abend ist schon eine Vereinsveranstaltung geplant." /></label>
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
