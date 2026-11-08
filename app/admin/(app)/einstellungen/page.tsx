import Link from 'next/link';
import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getCategories, getExtras, getSettings } from '@/lib/data';
import { DEFAULT_TEXTS, TEXT_LABELS } from '@/lib/mail';
import type { MailTextKey } from '@/lib/data';
import { offerAction, settingsAction, textsAction } from '../../actions';

const de = (n: number) => n.toString().replace('.', ',');

export default async function Einstellungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const [cats, s, x] = await Promise.all([getCategories(), getSettings(), getExtras()]);
  const ro = me.role !== 'admin';
  return (
    <>
      <PageHead title="Einstellungen"><Link className="btn" href="/admin/sperrzeiten">Sperrzeiten</Link></PageHead>
      <Flash sp={sp} />
      {ro && <div className="alert alert-info"><div>Nur Admins können Einstellungen ändern. Du siehst sie hier zur Information.</div></div>}

      <form action={settingsAction} className="card" id="regeln">
        <div className="card-head"><div><h2>Regeln</h2><p>Gelten sofort für neue Anfragen, auch in der Live-Prüfung auf der Buchungsseite</p></div></div>
        <fieldset disabled={ro} className="card-body stack" style={{ border: 0, margin: 0 }}>
          <label className="choice"><input type="checkbox" name="partyBlocksWholeWeekend" defaultChecked={s.partyBlocksWholeWeekend} />
            <span><b>Eine Feier sperrt das ganze Wochenende</b><br /><span className="muted small">Ausgeschaltet ist nur eine zweite Feier gesperrt. Besprechungen am selben Wochenende bleiben möglich.</span></span></label>
          <div className="row">
            <div className="field"><label htmlFor="s1">Vorlauf für Feiern (Tage)</label><input id="s1" type="number" name="partyMinLeadDays" defaultValue={s.partyMinLeadDays} min={0} /></div>
            <div className="field"><label htmlFor="s2">Vorlauf sonst (Stunden)</label><input id="s2" type="number" name="minLeadHours" defaultValue={s.minLeadHours} min={0} /></div>
            <div className="field"><label htmlFor="s3">Buchbar im Voraus (Tage)</label><input id="s3" type="number" name="horizonDays" defaultValue={s.horizonDays} min={14} /></div>
            <div className="field"><label htmlFor="s4">Höchstzahl Personen</label><input id="s4" type="number" name="capacity" defaultValue={s.capacity} min={1} /></div>
            <div className="field"><label htmlFor="s5">Feiern enden spätestens</label><input id="s5" type="time" name="partyLatestEnd" defaultValue={s.partyLatestEnd} /></div>
          </div>
          <p className="muted small">Vorlauf, Personenzahl und spätes Ende erzeugen Hinweise. Überschneidungen, Puffer, Sperrzeiten und die Feier-Regel verhindern eine Anfrage.</p>
          <div className="table-wrap"><table>
            <thead><tr><th>Art</th><th>Puffer vorher (Min.)</th><th>Puffer nachher (Min.)</th><th>Freigabe auch für Mitglieder</th></tr></thead>
            <tbody>{cats.map((c) => (
              <tr key={c.id}>
                <td><span className="catdot" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span>{c.isParty && <span className="muted small"> · zählt als Feier</span>}</td>
                <td><input type="number" name={`before_${c.id}`} defaultValue={c.bufferBefore} min={0} step={15} aria-label={`Puffer vorher, ${c.name}`} /></td>
                <td><input type="number" name={`after_${c.id}`} defaultValue={c.bufferAfter} min={0} step={15} aria-label={`Puffer nachher, ${c.name}`} /></td>
                <td><input type="checkbox" name={`approval_${c.id}`} defaultChecked={c.requiresApproval} aria-label={`Freigabe nötig, ${c.name}`} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} /></td>
              </tr>))}</tbody>
          </table></div>
          <p className="muted small">Anfragen von Personen außerhalb des Vereins brauchen immer eine Freigabe. Ohne Haken werden Mitglieder nach der E-Mail-Bestätigung direkt eingetragen.</p>
        </fieldset>
        {!ro && <div className="card-foot"><button className="btn btn-primary" type="submit">Regeln speichern</button></div>}
      </form>

      <form action={offerAction} className="card" id="angebot">
        <div className="card-head"><div><h2>Ausstattung und Kosten</h2><p>Erscheint im Anfrageformular und auf der Seite „Raum &amp; Regeln“</p></div></div>
        <fieldset disabled={ro} className="card-body grid-2b" style={{ border: 0, margin: 0 }}>
          <div className="field"><label htmlFor="eq">Ausstattung (eine pro Zeile)</label><textarea id="eq" name="equipment" defaultValue={x.equipment.join('\n')} style={{ minHeight: 160 }} /></div>
          <div className="stack">
            <div className="table-wrap"><table>
              <thead><tr><th /><th>Entgelt (€)</th><th>Kaution (€)</th></tr></thead>
              <tbody>
                <tr><td>Nicht im Verein</td><td><input name="extRent" type="text" inputMode="decimal" defaultValue={de(x.feesExternal.rent)} aria-label="Entgelt extern" /></td><td><input name="extDeposit" type="text" inputMode="decimal" defaultValue={de(x.feesExternal.deposit)} aria-label="Kaution extern" /></td></tr>
                <tr><td>Mitglieder, Feier</td><td><input name="memRent" type="text" inputMode="decimal" defaultValue={de(x.feesMemberParty.rent)} aria-label="Entgelt Mitglieder Feier" /></td><td><input name="memDeposit" type="text" inputMode="decimal" defaultValue={de(x.feesMemberParty.deposit)} aria-label="Kaution Mitglieder Feier" /></td></tr>
              </tbody></table></div>
            <span className="muted small">0 bedeutet: wird nicht angezeigt. Vereinstermine sind immer kostenfrei. Übliche Kautionen bei Vereinsheimen liegen zwischen 50 und 300 €.</span>
            <div className="field"><label htmlFor="cn">Hinweis bei den Ansprechpartnern</label><input id="cn" name="contactNote" type="text" maxLength={300} defaultValue={x.contactNote} /></div>
          </div>
        </fieldset>
        {!ro && <div className="card-foot"><button className="btn btn-primary" type="submit">Speichern</button></div>}
      </form>

      <form action={textsAction} className="card" id="texte">
        <div className="card-head"><div><h2>E-Mail-Texte</h2><p>Einleitung der automatischen Mails. Anrede, Termindaten und Buttons ergänzt das System. Leer lassen für den Standardtext.</p></div></div>
        <fieldset disabled={ro} className="card-body stack" style={{ border: 0, margin: 0 }}>
          {(Object.keys(TEXT_LABELS) as MailTextKey[]).map((k) => (
            <div className="field" key={k}><label htmlFor={`t-${k}`}>{TEXT_LABELS[k]}</label>
              <textarea id={`t-${k}`} name={`text_${k}`} defaultValue={x.mailTexts[k] ?? ''} placeholder={DEFAULT_TEXTS[k]} style={{ minHeight: 80 }} />
              <span className="hint">Beginnt nach „Hallo Vorname,“. Leerzeile = neuer Absatz.</span></div>
          ))}
        </fieldset>
        {!ro && <div className="card-foot"><button className="btn btn-primary" type="submit">Texte speichern</button></div>}
      </form>
    </>
  );
}
