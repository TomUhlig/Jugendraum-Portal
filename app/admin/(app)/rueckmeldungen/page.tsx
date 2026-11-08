import Link from 'next/link';
import { PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getCategories, listFeedback } from '@/lib/data';
import { fmtDay } from '@/lib/time';

export default async function Rueckmeldungen() {
  await requireAdmin();
  const [cats, list] = await Promise.all([getCategories(), listFeedback()]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const avg = list.length ? list.reduce((s, f) => s + (f.rating as number), 0) / list.length : 0;
  return (
    <>
      <PageHead eyebrow={list.length ? `Ø ${avg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} von 5 aus ${list.length} Rückmeldungen` : undefined} title="Rückmeldungen" />
      <section className="card">
        {list.length === 0 ? <div className="empty">Noch keine Rückmeldungen. Nach jedem Termin bekommt der Bucher eine Mail mit der Bitte um Rückmeldung.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Bewertung</th><th>Termin</th><th>Kommentar</th><th /></tr></thead>
            <tbody>{list.map((f) => (
              <tr key={f.booking_id}>
                <td className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{f.rating} / 5</td>
                <td><Link className="rowlink" href={`/admin/buchung/${f.booking_id}`}>{f.title}</Link><div className="muted small">{fmtDay(+f.starts_at)} · {f.name} · <span className="catdot" style={{ '--c': cat.get(f.category_id)?.color } as React.CSSProperties}>{cat.get(f.category_id)?.name}</span></div></td>
                <td style={{ maxWidth: 420 }}>{f.comment || <span className="muted">–</span>}</td>
                <td>{f.damage && <span className="badge b-bad">Schaden</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
