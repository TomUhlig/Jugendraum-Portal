import { Download, KeyRound, MessageSquareText, Search, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Flash, PageHead } from '@/components/Flash';
import { StatusBadge } from '@/components/StatusBadge';
import { requireAdmin } from '@/lib/auth';
import { getCategories, listBookings, unreadMessages } from '@/lib/data';
import { parseFilter } from '@/lib/filters';
import { STATUS_LABEL } from '@/lib/labels';
import { berlinHm, fmtDay } from '@/lib/time';

export const metadata = { title: 'Buchungen' };

export default async function Buchungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseFilter(sp);
  // Alle Status laden, damit die Schnellfilter Zahlen zeigen können
  const [cats, all, unread] = await Promise.all([getCategories(), listBookings({ ...f, status: undefined }), unreadMessages()]);
  const unreadIds = new Set(unread.map((u) => u.booking_id as string));
  const list = f.status ? all.filter((b) => f.status!.includes(b.status)) : all;
  const rows = f.zeit === 'vergangen' ? [...list].reverse() : list;
  const count = (st: string) => all.filter((b) => b.status === st).length;
  const chip = (st: string) => { const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !['ok', 'fehler', 'status'].includes(k))); if (st) q.set('status', st); const s = q.toString(); return `/admin/buchungen${s ? '?' + s : ''}`; };
  const monthOf = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  const cat = new Map(cats.map((c) => [c.id, c]));
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !['ok', 'fehler'].includes(k))).toString();
  const year = new Date().getFullYear();
  return (
    <>
      <PageHead title="Buchungen"><a className="btn" href={`/admin/buchungen/export?${qs}`}><Download className="icon-sm" />CSV exportieren</a><Link className="btn btn-primary" href="/admin/neu">Termin eintragen</Link></PageHead>
      <Flash sp={sp} />
      <form className="card card-body filters" method="get" data-autosubmit>
        <div className="field grow"><label htmlFor="q">Suche</label><input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Name, Titel, Mannschaft, Nummer" /></div>
        <div className="field"><label htmlFor="zeit">Zeitraum</label><select id="zeit" name="zeit" defaultValue={f.zeit}>
          <option value="kommend">Ab heute</option><option value="vergangen">Vergangen</option><option value="alle">Alle</option>
          {[year + 1, year, year - 1].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <div className="field"><label htmlFor="art">Art</label><select id="art" name="art" defaultValue={sp.art ?? ''}><option value="">Alle</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="typ">Bucher</label><select id="typ" name="typ" defaultValue={sp.typ ?? ''}><option value="">Alle</option><option value="member">Mitglieder</option><option value="external">Nicht im Verein</option></select></div>
        <button className="btn no-js-only" type="submit"><Search className="icon-sm" />Filtern</button>
      </form>
      <nav className="status-chips" aria-label="Nach Status filtern">
        <Link href={chip('')} aria-current={!sp.status ? 'page' : undefined}>Alle <b>{all.length}</b></Link>
        {(['requested', 'confirmed', 'pending_email', 'cancelled', 'rejected', 'expired'] as const).map((st) => count(st) > 0 || sp.status === st ? (
          <Link key={st} href={chip(st)} aria-current={sp.status === st ? 'page' : undefined} className={`st-${st}`}>{STATUS_LABEL[st]} <b>{count(st)}</b></Link>
        ) : null)}
      </nav>
      <section className="card">
        <div className="card-head"><h2>{rows.length} {rows.length === 1 ? 'Buchung' : 'Buchungen'}</h2>{qs && <Link href="/admin/buchungen" className="small">Filter zurücksetzen</Link>}</div>
        {rows.length === 0 ? <div className="empty">Keine Buchungen für diese Auswahl.</div> : (
          <div className="table-wrap"><table className="blist">
            <thead><tr><th>Termin</th><th>Anlass</th><th>Bucher</th><th>Art</th><th>Status</th><th>Nr.</th></tr></thead>
            <tbody>{rows.map((b, i) => {
              const m = monthOf(b.start), newMonth = i === 0 || monthOf(rows[i - 1].start) !== m;
              const owes = b.status === 'confirmed' && ((b.rent > 0 && !b.rentPaid) || (b.deposit > 0 && !b.depositPaid));
              const keyOut = b.keyHandedOut && !b.returnAt;
              return [newMonth && <tr key={'m' + m} className="month-row"><th colSpan={6}>{m}</th></tr>,
              <tr key={b.id} className="link">
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDay(b.start)}<br /><span className="muted">{berlinHm(b.start)}–{berlinHm(b.end)}</span></td>
                <td><Link className="rowlink" href={`/admin/buchung/${b.id}`}>{b.title}</Link>{b.seriesId && <span className="muted small"> · Serie</span>}<div className="muted small">{b.guests} Pers.{b.equipment.length ? ` · ${b.equipment.join(', ')}` : ''}</div></td>
                <td>{b.name}<div className="muted small">{b.bookerType === 'member' ? b.team || 'Mitglied' : 'nicht im Verein'}</div></td>
                <td><span className="catdot small" style={{ '--c': cat.get(b.categoryId)?.color } as React.CSSProperties}>{cat.get(b.categoryId)?.name}</span></td>
                <td><StatusBadge status={b.status} />
                  {(owes || keyOut || unreadIds.has(b.id)) && <div className="flags">
                    {unreadIds.has(b.id) && <span title="Neue Nachricht" className="flag f-msg"><MessageSquareText className="icon-sm" /></span>}
                    {owes && <span title="Zahlung offen" className="flag f-pay"><Wallet className="icon-sm" /></span>}
                    {keyOut && <span title="Schlüssel ausgegeben" className="flag f-key"><KeyRound className="icon-sm" /></span>}
                  </div>}</td>
                <td className="num muted small">{b.number}</td>
              </tr>];
            })}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
