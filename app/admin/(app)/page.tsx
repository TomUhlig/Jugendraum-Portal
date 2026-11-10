import { AlertTriangle, ArrowRight, Check, KeyRound, Lock, MailWarning, Plus, Settings2, Wallet, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Flash, PageHead } from '@/components/Flash';
import { StatusBadge } from '@/components/StatusBadge';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkExisting, getCategories, getExtras, listBookings, operatorComplete } from '@/lib/data';
import { mailMode } from '@/lib/mail';
import { eur } from '@/lib/labels';
import { DAY, addDays, berlinHm, berlinToUtc, berlinYmd, fmtDay, fmtLong, fmtRange } from '@/lib/time';
import { decideAction } from '../actions';

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const now = Date.now(), today = berlinYmd(now);
  const tStart = berlinToUtc(today, '00:00'), tEnd = berlinToUtc(addDays(today, 1), '00:00');
  const m = today.slice(0, 8) + '01';
  const [y, mo] = m.split('-').map(Number);
  const mNext = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}-01`;
  const q = db();
  const [cats, open, upcoming, monthB, keysOut, deposits, damages, failed, keysDue, unpaid] = await Promise.all([
    getCategories(),
    listBookings({ status: ['requested'] }),
    listBookings({ status: ['requested', 'confirmed'], from: now, limit: 8 }),
    listBookings({ status: ['confirmed'], from: berlinToUtc(m, '00:00'), to: berlinToUtc(mNext, '00:00') }),
    q`select id, number, title, name, ends_at from bookings where status = 'confirmed' and key_handed_out and return_at is null and ends_at < now() order by ends_at`,
    q`select id, number, title, name, deposit_eur from bookings where status = 'confirmed' and deposit_eur > 0 and not deposit_returned and return_at is not null order by ends_at`,
    q`select b.id, b.number, b.title, f.comment from feedback f join bookings b on b.id = f.booking_id where f.damage and (b.damage_note = '' or b.condition_ok is null) order by f.created_at desc limit 5`,
    q`select count(*)::int as n from mail_log where not ok and created_at > now() - interval '7 days'`,
    q`select id, number, title, name, starts_at from bookings where status = 'confirmed' and not key_handed_out and starts_at between now() and now() + interval '3 days' order by starts_at`,
    q`select id, title, name, starts_at, (case when rent_paid then 0 else rent_eur end + case when deposit_paid then 0 else deposit_eur end)::float as open from bookings where status = 'confirmed' and starts_at between now() and now() + interval '14 days' and ((not rent_paid and rent_eur > 0) or (not deposit_paid and deposit_eur > 0)) order by starts_at`,
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const setup = [...(mailMode() === 'console' ? ['Mailversand einrichten'] : []), ...(operatorComplete((await getExtras()).operator) ? [] : ['Impressum ausfüllen'])];
  const checks = await Promise.all(open.map((b) => checkExisting(b)));
  const todays = upcoming.filter((b) => b.start < tEnd && b.end > tStart && b.status === 'confirmed');
  const week = upcoming.filter((b) => b.status === 'confirmed' && b.start < now + 7 * DAY).length;
  const hours = monthB.reduce((s, b) => s + (b.end - b.start) / 3.6e6, 0);
  const days = Math.round((berlinToUtc(mNext, '00:00') - berlinToUtc(m, '00:00')) / DAY);
  const canDecide = me.role !== 'viewer';
  const todo = setup.length + unpaid.length + keysOut.length + deposits.length + damages.length + keysDue.length + (failed[0].n ? 1 : 0);

  return (
    <>
      <PageHead eyebrow={fmtLong(now)} title="Übersicht"><Link className="btn" href="/admin/sperrzeiten#neu"><Lock className="icon-sm" />Zeitraum sperren</Link><Link className="btn btn-primary" href="/admin/neu"><Plus className="icon-sm" />Termin eintragen</Link></PageHead>
      <Flash sp={sp} />
      <div className="kpis">
        <a href="#anfragen" className={`card kpi ${open.length ? 'attention' : ''}`}><span className="k">Offene Anfragen</span><span className="v">{open.length}</span><span className="s">{open.length ? 'warten auf Entscheidung' : 'alles erledigt'}</span></a>
        <div className="card kpi"><span className="k">Heute</span><span className="v">{todays.length}</span><span className="s">{todays[0] ? `${berlinHm(todays[0].start)} ${todays[0].title}` : 'keine Termine'}</span></div>
        <div className="card kpi"><span className="k">Nächste 7 Tage</span><span className="v">{week}</span><span className="s">bestätigte Termine</span></div>
        <Link href="/admin/statistik" className="card kpi"><span className="k">Auslastung {new Date(m + 'T12:00:00Z').toLocaleDateString('de-DE', { month: 'long', timeZone: 'UTC' })}</span><span className="v">{Math.round((hours / (days * 14)) * 100)} %</span><span className="s">{Math.round(hours)} von {days * 14} Std. (8–22 Uhr)</span></Link>
      </div>

      <div className="grid-2">
        <section className="card" id="anfragen">
          <div className="card-head"><h2>Offene Anfragen</h2><Link href="/admin/buchungen?status=requested" className="small">Alle anzeigen</Link></div>
          {open.length === 0 ? <div className="empty">Keine offenen Anfragen. Neue Anfragen erscheinen hier und kommen per Mail an alle mit aktivierter Benachrichtigung.</div> : (
            <ul className="list">{open.map((b, i) => {
              const c = cat.get(b.categoryId); const r = checks[i];
              return (
                <li key={b.id} className="req-item">
                  <div className="between"><Link className="t" href={`/admin/buchung/${b.id}`}>{b.title}</Link><span className="catdot small" style={{ '--c': c?.color } as React.CSSProperties}>{c?.name}</span></div>
                  <div className="meta"><span className="num">{fmtRange(b.start, b.end)}</span><span>{b.name}{b.team ? `, ${b.team}` : ''}</span><span>{b.bookerType === 'external' ? 'nicht im Verein' : 'Mitglied'} · {b.guests} Pers.</span><span>abgesprochen mit {b.agreedWith}</span></div>
                  {b.note && <div className="note">{b.note}</div>}
                  <div className="between">
                    <span className={`badge b-${r.level === 'ok' ? 'ok' : r.level === 'warn' ? 'warn' : 'bad'}`}>{r.level === 'ok' ? 'Keine Konflikte' : r.messages[0].text}</span>
                    <div className="inline">
                      <Link className="btn btn-sm" href={`/admin/buchung/${b.id}`}>Details</Link>
                      {canDecide && <form action={decideAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value="confirm" /><input type="hidden" name="back" value="/admin" /><button className="btn btn-sm btn-ok" type="submit"><Check className="icon-sm" />Bestätigen</button></form>}
                    </div>
                  </div>
                </li>
              );
            })}</ul>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Zu erledigen</h2>{todo > 0 && <span className="badge b-warn">{todo}</span>}</div>
            {todo === 0 ? <div className="empty">Nichts offen. Schlüssel, Kautionen und Schadensmeldungen sind erledigt.</div> : (
              <ul className="list">
                {setup.map((t) => <li key={t} className="todo"><Settings2 className="icon" style={{ color: 'var(--bad)' }} /><span><Link href={t.startsWith('Mail') ? '/admin/einstellungen#mail' : '/admin/einstellungen#betreiber'}>{t}</Link> <span className="muted">(Einrichtung)</span></span></li>)}
                {unpaid.map((b) => <li key={'u' + b.id} className="todo"><Wallet className="icon" style={{ color: 'var(--warn)' }} /><span>Zahlung offen ({eur(+b.open)}): <Link href={`/admin/buchung/${b.id}`}>{b.title}</Link> <span className="muted">({fmtDay(+b.starts_at)}, {b.name})</span></span></li>)}
                {keysDue.map((b) => <li key={'d' + b.id} className="todo"><KeyRound className="icon" style={{ color: 'var(--info)' }} /><span>Schlüssel übergeben für <Link href={`/admin/buchung/${b.id}`}>{b.title}</Link> <span className="muted">({fmtDay(+b.starts_at)})</span></span></li>)}
                {keysOut.map((b) => <li key={'k' + b.id} className="todo"><KeyRound className="icon" style={{ color: 'var(--warn)' }} /><span>Schlüssel noch nicht zurück: <Link href={`/admin/buchung/${b.id}`}>{b.title}</Link> <span className="muted">({b.name})</span></span></li>)}
                {deposits.map((b) => <li key={'p' + b.id} className="todo"><Wallet className="icon" style={{ color: 'var(--warn)' }} /><span>Kaution {eur(+b.deposit_eur)} abrechnen: <Link href={`/admin/buchung/${b.id}`}>{b.title}</Link></span></li>)}
                {damages.map((b) => <li key={'s' + b.id} className="todo"><Wrench className="icon" style={{ color: 'var(--bad)' }} /><span>Schaden gemeldet: <Link href={`/admin/buchung/${b.id}`}>{b.title}</Link>{b.comment && <span className="muted"> „{String(b.comment).slice(0, 60)}“</span>}</span></li>)}
                {failed[0].n > 0 && <li className="todo"><MailWarning className="icon" style={{ color: 'var(--bad)' }} /><span>{failed[0].n} Mail(s) konnten nicht zugestellt werden. <Link href="/admin/protokoll">Protokoll ansehen</Link></span></li>}
              </ul>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h2>Demnächst</h2><Link href="/admin/kalender?ansicht=woche" className="small">Wochenansicht</Link></div>
            {upcoming.length === 0 ? <div className="empty">Keine anstehenden Termine.</div> : (
              <ul className="list">{upcoming.map((b) => (
                <li key={b.id} className="between">
                  <div style={{ minWidth: 0 }}><Link href={`/admin/buchung/${b.id}`} className="catdot" style={{ '--c': cat.get(b.categoryId)?.color, color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' } as React.CSSProperties}>{b.title}</Link>
                    <div className="muted small num">{fmtDay(b.start)}, {berlinHm(b.start)}–{berlinHm(b.end)} · {b.name}</div></div>
                  <StatusBadge status={b.status} />
                </li>
              ))}</ul>
            )}
            <div className="card-foot"><Link href="/admin/kalender" className="inline small">Zum Kalender <ArrowRight className="icon-sm" /></Link></div>
          </section>
          {me.role === 'viewer' && <div className="alert alert-info"><AlertTriangle className="icon" /><div>Du hast Lesezugriff. Entscheidungen treffen Verwalter und Admins.</div></div>}
        </div>
      </div>
    </>
  );
}
