import { Flash } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getBlackouts, getCategories, getSettings } from '@/lib/data';
import { berlinYmd, fmtDay } from '@/lib/time';
import { addBlackoutAction, deleteBlackoutAction, settingsAction } from '../../actions';

export default async function Einstellungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const [cats, s, blackouts] = await Promise.all([getCategories(), getSettings(), getBlackouts(undefined, Date.now())]);
  const ro = me.role !== 'admin';
  const today = berlinYmd(Date.now());
  return (
    <div className="wrap stack" style={{ paddingBottom: 40 }}>
      <div className="page-title"><div><span className="label">Verwaltung</span><h1>Regeln &amp; Sperrzeiten</h1></div></div>
      <Flash sp={sp} />
      <section className="panel">
        <span className="ribbon">Regeln &amp; Puffer</span>
        {ro && <p className="muted">Nur Admins können die Regeln ändern.</p>}
        <form action={settingsAction} className="stack">
          <fieldset disabled={ro} className="stack">
            <label className="toggle"><input type="checkbox" name="partyBlocksWholeWeekend" defaultChecked={s.partyBlocksWholeWeekend} />
              <span><b>Party sperrt das ganze Wochenende</b><br /><small className="muted">Aus: Nur eine zweite Party ist gesperrt, andere Termine am Wochenende bleiben möglich.</small></span></label>
            <div className="row">
              <div className="field"><label htmlFor="partyMinLeadDays">Party-Vorlauf (Tage)</label><input type="number" id="partyMinLeadDays" name="partyMinLeadDays" defaultValue={s.partyMinLeadDays} min={0} /></div>
              <div className="field"><label htmlFor="minLeadHours">Sonst-Vorlauf (Std.)</label><input type="number" id="minLeadHours" name="minLeadHours" defaultValue={s.minLeadHours} min={0} /></div>
              <div className="field"><label htmlFor="horizonDays">Buchbar bis (Tage voraus)</label><input type="number" id="horizonDays" name="horizonDays" defaultValue={s.horizonDays} min={14} /></div>
              <div className="field"><label htmlFor="capacity">Max. Personen</label><input type="number" id="capacity" name="capacity" defaultValue={s.capacity} min={1} /></div>
              <div className="field"><label htmlFor="partyLatestEnd">Party-Ende spätestens</label><input type="time" id="partyLatestEnd" name="partyLatestEnd" defaultValue={s.partyLatestEnd} /></div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>Vorlauf und Gästezahl erzeugen Hinweise, blockieren aber nicht. Zeitüberschneidungen, Puffer, Sperrzeiten und die Party-Regel blockieren.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Kategorie</th><th>Puffer vorher (min)</th><th>Puffer nachher (min)</th><th>Freigabe auch für Mitglieder</th><th>Party</th></tr></thead>
              <tbody>{cats.map((c) => (
                <tr key={c.id}>
                  <td><span className="catchip" style={{ '--c': c.color } as React.CSSProperties}><i />{c.name}</span></td>
                  <td><input type="number" name={`before_${c.id}`} defaultValue={c.bufferBefore} min={0} step={15} aria-label={`Puffer vorher ${c.name}`} /></td>
                  <td><input type="number" name={`after_${c.id}`} defaultValue={c.bufferAfter} min={0} step={15} aria-label={`Puffer nachher ${c.name}`} /></td>
                  <td><input type="checkbox" name={`approval_${c.id}`} defaultChecked={c.requiresApproval} aria-label={`Freigabe nötig ${c.name}`} style={{ width: 20, height: 20, accentColor: 'var(--brand)' }} /></td>
                  <td>{c.isParty ? 'ja' : '–'}</td>
                </tr>))}</tbody>
            </table></div>
            <small className="muted">Externe brauchen immer eine Freigabe. Ohne Haken werden Mitglieder nach der E-Mail-Bestätigung direkt eingetragen.</small>
            {!ro && <button className="btn primary" type="submit" style={{ justifySelf: 'start' }}>Regeln speichern</button>}
          </fieldset>
        </form>
      </section>

      <section className="panel stack">
        <span className="ribbon" style={{ justifySelf: 'start' }}>Sperrzeiten</span>
        <p className="muted" style={{ margin: 0 }}>Zum Beispiel Renovierung, Ferien oder Vereinsfeste. In dieser Zeit kann niemand buchen.</p>
        {blackouts.length === 0 ? <div className="empty">Keine Sperrzeiten eingetragen.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Zeitraum</th><th>Grund</th><th /></tr></thead><tbody>
            {blackouts.map((b) => (
              <tr key={b.id}><td className="mono">{fmtDay(b.start)} – {fmtDay(b.end - 60_000)}</td><td>{b.reason}</td>
                <td>{me.role !== 'viewer' && <form action={deleteBlackoutAction}><input type="hidden" name="id" value={b.id} /><button className="btn small no" type="submit">Löschen</button></form>}</td></tr>
            ))}
          </tbody></table></div>
        )}
        {me.role !== 'viewer' && (
          <form action={addBlackoutAction} className="row" style={{ alignItems: 'end' }}>
            <div className="field"><label htmlFor="bo-from">Von</label><input type="date" id="bo-from" name="from" min={today} required /></div>
            <div className="field"><label htmlFor="bo-to">Bis (einschließlich)</label><input type="date" id="bo-to" name="to" min={today} required /></div>
            <div className="field"><label htmlFor="bo-reason">Grund</label><input type="text" id="bo-reason" name="reason" required placeholder="z. B. Renovierung" /></div>
            <button className="btn primary" type="submit">Sperrzeit eintragen</button>
          </form>
        )}
      </section>
    </div>
  );
}
