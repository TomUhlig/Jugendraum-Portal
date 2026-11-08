import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getBlackouts } from '@/lib/data';
import { berlinYmd, fmtDay } from '@/lib/time';
import { addBlackoutAction, deleteBlackoutAction } from '../../actions';

export default async function Sperrzeiten({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const list = await getBlackouts(undefined, Date.now() - 86400e3);
  const today = berlinYmd(Date.now());
  const can = me.role !== 'viewer';
  return (
    <>
      <PageHead eyebrow="Ferien, Renovierung, Vereinsfeste" title="Sperrzeiten" />
      <Flash sp={sp} />
      {can && (
        <form action={addBlackoutAction} className="card">
          <div className="card-head"><div><h2>Neue Sperrzeit</h2><p>In diesem Zeitraum kann niemand anfragen. Bestehende Buchungen bleiben bestehen.</p></div></div>
          <div className="card-body filters">
            <div className="field"><label htmlFor="b1">Von</label><input id="b1" type="date" name="from" min={today} required /></div>
            <div className="field"><label htmlFor="b2">Bis einschließlich</label><input id="b2" type="date" name="to" min={today} required /></div>
            <div className="field grow"><label htmlFor="b3">Grund</label><input id="b3" type="text" name="reason" required maxLength={120} placeholder="z. B. Renovierung" /></div>
            <button className="btn btn-primary" type="submit">Eintragen</button>
          </div>
        </form>
      )}
      <section className="card">
        <div className="card-head"><h2>Aktuelle und kommende Sperrzeiten</h2></div>
        {list.length === 0 ? <div className="empty">Keine Sperrzeiten eingetragen.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Zeitraum</th><th>Grund</th><th /></tr></thead><tbody>
            {list.map((b) => (
              <tr key={b.id}><td className="num">{fmtDay(b.start)} – {fmtDay(b.end - 1)}</td><td>{b.reason}</td>
                <td style={{ textAlign: 'right' }}>{can && <form action={deleteBlackoutAction}><input type="hidden" name="id" value={b.id} /><button className="btn btn-sm btn-danger" type="submit">Löschen</button></form>}</td></tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
