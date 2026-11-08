import Link from 'next/link';
import { Flash } from '@/components/Flash';
import { STATUS_LABEL } from '@/components/TicketCard';
import { requireAdmin } from '@/lib/auth';
import { checkExisting, getCategories, listBookings } from '@/lib/data';
import { DAY, berlinHm, berlinToUtc, berlinYmd, addDays, fmtDay, fmtRange } from '@/lib/time';
import { decideAction } from '../actions';

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const now = Date.now();
  const [cats, open, upcoming] = await Promise.all([
    getCategories(),
    listBookings({ status: ['requested'] }),
    listBookings({ status: ['requested', 'confirmed'], from: now, limit: 12 }),
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const checks = await Promise.all(open.map((b) => checkExisting(b)));
  const week = upcoming.filter((b) => b.status === 'confirmed' && b.start < now + 7 * DAY);
  const nextParty = upcoming.find((b) => cat.get(b.categoryId)?.isParty);
  const m = berlinYmd(now).slice(0, 8) + '01';
  const [y, mo] = m.split('-').map(Number);
  const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}-01`;
  const monthBookings = await listBookings({ status: ['confirmed'], from: berlinToUtc(m, '00:00'), to: berlinToUtc(next, '00:00') });
  const hours = monthBookings.reduce((s, b) => s + (b.end - b.start) / 3.6e6, 0);
  const days = Math.round((berlinToUtc(next, '00:00') - berlinToUtc(m, '00:00')) / DAY);
  const canDecide = me.role !== 'viewer';

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="page-title"><div><span className="label">Verwaltung</span><h1>Jugendraum</h1></div><Link className="btn" href="/">Zur Buchungsseite</Link></div>
      <Flash sp={sp} />
      <div className="stats">
        <a href="#anfragen" className={`stat ${open.length ? 'hot' : ''}`}><div className="label">Offene Anfragen</div><div className="v">{open.length}</div><div className="s">{open.length ? 'warten auf Freigabe' : 'alles erledigt'}</div></a>
        <div className="stat"><div className="label">Nächste 7 Tage</div><div className="v">{week.length}</div><div className="s">bestätigte Termine</div></div>
        <div className="stat"><div className="label">Nächste Party</div><div className="v sm">{nextParty ? fmtDay(nextParty.start) : '–'}</div><div className="s">{nextParty ? nextParty.title : 'keine geplant'}</div></div>
        <div className="stat"><div className="label">Auslastung {new Date(m + 'T12:00:00Z').toLocaleDateString('de-DE', { month: 'long', timeZone: 'UTC' })}</div><div className="v">{Math.round((hours / (days * 14)) * 100)}%</div><div className="s">{Math.round(hours)} von {days * 14} Std. (8–22 Uhr)</div></div>
      </div>
      <div className="cols">
        <section className="panel" id="anfragen">
          <span className="ribbon">Offene Anfragen</span>
          {open.length === 0 && <div className="empty">Keine offenen Anfragen. Neue Anfragen erscheinen hier und kommen per Mail an alle mit aktivierter Benachrichtigung.</div>}
          {open.map((b, i) => {
            const c = cat.get(b.categoryId); const r = checks[i];
            return (
              <article className="req" key={b.id}>
                <div className="h"><Link href={`/admin/buchung/${b.id}`}>{b.title}</Link><span className="catchip" style={{ '--c': c?.color } as React.CSSProperties}><i />{c?.name}</span></div>
                <div className="meta"><span className="mono">{fmtRange(b.start, b.end)}</span><span>{b.name}{b.team ? ' · ' + b.team : ''}</span><span>{b.bookerType === 'external' ? 'Extern' : 'Mitglied'} · {b.guests} Pers.</span><span>Absprache: {b.agreedWith}</span></div>
                {b.note && <div className="note">{b.note}</div>}
                <div><span className={`flag st-${r.level}`}>{r.level === 'ok' ? '✓ Keine Konflikte' : (r.level === 'warn' ? '! ' : '✕ ') + r.messages[0].text}</span></div>
                <div className="acts">
                  {canDecide && <form action={decideAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value="confirm" /><input type="hidden" name="back" value="/admin" /><button className="btn ok" type="submit">Bestätigen</button></form>}
                  <Link className="btn" href={`/admin/buchung/${b.id}`}>{canDecide ? 'Ablehnen / Details' : 'Details'}</Link>
                </div>
              </article>
            );
          })}
        </section>
        <section className="panel">
          <span className="ribbon">Nächste Termine</span>
          {upcoming.length === 0 ? <div className="empty">Keine anstehenden Termine.</div> : (
            <div className="table-wrap"><table><thead><tr><th>Wann</th><th>Was</th><th>Status</th></tr></thead><tbody>
              {upcoming.map((b) => (
                <tr key={b.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDay(b.start)}<br />{berlinHm(b.start)}–{berlinHm(b.end)}</td>
                  <td><Link href={`/admin/buchung/${b.id}`} className="catchip" style={{ '--c': cat.get(b.categoryId)?.color, color: 'var(--ink)' } as React.CSSProperties}><i />{b.title}</Link><br /><small className="muted">{b.name}</small></td>
                  <td><span className={`stamp s-${b.status}`} style={{ fontSize: '.66rem' }}>{STATUS_LABEL[b.status]}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          )}
          <p style={{ margin: '14px 0 0' }}><Link href={`/admin/kalender?m=${berlinYmd(now).slice(0, 7)}`}>Ganzen Monat ansehen →</Link> <span className="muted">· Heute ist {fmtDay(berlinToUtc(addDays(berlinYmd(now), 0), '12:00'))}</span></p>
        </section>
      </div>
    </div>
  );
}
