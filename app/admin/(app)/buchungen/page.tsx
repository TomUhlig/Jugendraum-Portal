import { Download, Search } from 'lucide-react';
import Link from 'next/link';
import { Flash, PageHead } from '@/components/Flash';
import { StatusBadge } from '@/components/StatusBadge';
import { requireAdmin } from '@/lib/auth';
import { getCategories, listBookings } from '@/lib/data';
import { parseFilter } from '@/lib/filters';
import { STATUS_LABEL } from '@/lib/labels';
import { berlinHm, fmtDay } from '@/lib/time';

export default async function Buchungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseFilter(sp);
  const [cats, list] = await Promise.all([getCategories(), listBookings(f)]);
  const rows = f.zeit === 'vergangen' ? [...list].reverse() : list;
  const cat = new Map(cats.map((c) => [c.id, c]));
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !['ok', 'fehler'].includes(k))).toString();
  const year = new Date().getFullYear();
  return (
    <>
      <PageHead title="Buchungen"><a className="btn" href={`/admin/buchungen/export?${qs}`}><Download className="icon-sm" />CSV exportieren</a><Link className="btn btn-primary" href="/admin/neu">Termin eintragen</Link></PageHead>
      <Flash sp={sp} />
      <form className="card card-body filters" method="get">
        <div className="field grow"><label htmlFor="q">Suche</label><input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Name, Titel, Mannschaft, Nummer" /></div>
        <div className="field"><label htmlFor="zeit">Zeitraum</label><select id="zeit" name="zeit" defaultValue={f.zeit}>
          <option value="kommend">Ab heute</option><option value="vergangen">Vergangen</option><option value="alle">Alle</option>
          {[year + 1, year, year - 1].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ''}><option value="">Alle</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="art">Art</label><select id="art" name="art" defaultValue={sp.art ?? ''}><option value="">Alle</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="typ">Bucher</label><select id="typ" name="typ" defaultValue={sp.typ ?? ''}><option value="">Alle</option><option value="member">Mitglieder</option><option value="external">Nicht im Verein</option></select></div>
        <button className="btn" type="submit"><Search className="icon-sm" />Filtern</button>
      </form>
      <section className="card">
        <div className="card-head"><h2>{rows.length} {rows.length === 1 ? 'Buchung' : 'Buchungen'}</h2>{qs && <Link href="/admin/buchungen" className="small">Filter zurücksetzen</Link>}</div>
        {rows.length === 0 ? <div className="empty">Keine Buchungen für diese Auswahl.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Termin</th><th>Anlass</th><th>Bucher</th><th>Art</th><th>Status</th><th>Nr.</th></tr></thead>
            <tbody>{rows.map((b) => (
              <tr key={b.id} className="link">
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDay(b.start)}<br /><span className="muted">{berlinHm(b.start)}–{berlinHm(b.end)}</span></td>
                <td><Link className="rowlink" href={`/admin/buchung/${b.id}`}>{b.title}</Link>{b.seriesId && <span className="muted small"> · Serie</span>}<div className="muted small">{b.guests} Pers.{b.equipment.length ? ` · ${b.equipment.join(', ')}` : ''}</div></td>
                <td>{b.name}<div className="muted small">{b.bookerType === 'member' ? b.team || 'Mitglied' : 'nicht im Verein'}</div></td>
                <td><span className="catdot small" style={{ '--c': cat.get(b.categoryId)?.color } as React.CSSProperties}>{cat.get(b.categoryId)?.name}</span></td>
                <td><StatusBadge status={b.status} /></td>
                <td className="num muted small">{b.number}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
