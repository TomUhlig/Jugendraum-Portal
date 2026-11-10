import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getCategories, listWaitlist } from '@/lib/data';
import { berlinHm, fmtDay } from '@/lib/time';
import { removeWaitAction } from '../../actions';

const fmtTs = (t: number) => new Date(t).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });

export default async function Warteliste({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const [list, cats] = await Promise.all([listWaitlist(), getCategories()]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  return (
    <>
      <PageHead eyebrow="Wer auf einen belegten Termin wartet. Wird er frei, geht automatisch eine Mail raus." title="Warteliste" />
      <Flash sp={sp} />
      <section className="card">
        {list.length === 0 ? <div className="empty">Niemand auf der Warteliste. Ist ein Termin belegt, können sich Interessierte auf der Buchungsseite eintragen.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Wunschtermin</th><th>Art</th><th>Person</th><th>Eingetragen</th><th>Status</th><th /></tr></thead>
            <tbody>{list.map((w) => (
              <tr key={w.id}>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDay(w.start)}<br /><span className="muted">{berlinHm(w.start)}–{berlinHm(w.end)}</span></td>
                <td><span className="catdot small" style={{ '--c': cat.get(w.categoryId)?.color } as React.CSSProperties}>{cat.get(w.categoryId)?.name}</span></td>
                <td>{w.name}<div className="muted small">{w.email}</div></td>
                <td className="muted small num">{fmtTs(w.createdAt)}</td>
                <td>{w.notifiedAt ? <span className="badge b-ok">informiert {fmtDay(w.notifiedAt)}</span> : <span className="badge b-warn">wartet</span>}</td>
                <td style={{ textAlign: 'right' }}>{me.role !== 'viewer' && <form action={removeWaitAction}><input type="hidden" name="id" value={w.id} /><button className="btn btn-sm btn-ghost" type="submit">Entfernen</button></form>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
