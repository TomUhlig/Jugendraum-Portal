import Link from 'next/link';
import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getCategories, getExtras, getSettings, operatorComplete } from '@/lib/data';
import { DEFAULT_TEXTS, TEXT_LABELS, mailFrom, mailMode } from '@/lib/mail';
import { formatIban } from '@/lib/payment';
import { stripeEnabled } from '@/lib/stripe';
import { appUrl } from '@/lib/url';
import type { MailTextKey } from '@/lib/data';
import { offerAction, operatorAction, paymentSettingsAction, settingsAction, testMailAction, textsAction } from '../../actions';

const de = (n: number) => n.toString().replace('.', ',');

export default async function Einstellungen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const [cats, s, x] = await Promise.all([getCategories(), getSettings(), getExtras()]);
  const ro = me.role !== 'admin';
  const mode = mailMode();
  return (
    <>
      <PageHead title="Einstellungen"><Link className="btn" href="/admin/sperrzeiten">Sperrzeiten</Link></PageHead>
      <Flash sp={sp} />
      {ro && <div className="alert alert-info"><div>Nur Admins können Einstellungen ändern. Du siehst sie hier zur Information.</div></div>}

      <section className="card" id="mail">
        <div className="card-head"><div><h2>Mailversand</h2><p>Wird über Umgebungsvariablen beim Hosting eingerichtet (siehe EINRICHTUNG.md)</p></div>
          <span className={`badge ${mode === 'console' ? 'b-bad' : 'b-ok'}`}>{mode === 'console' ? 'nicht eingerichtet' : 'aktiv'}</span></div>
        <div className="card-body stack-sm">
          <dl className="kv"><dt>Versandweg</dt><dd>{({ resend: 'Resend (eigene Domain)', smtp: `Eigenes Postfach über ${process.env.SMTP_HOST}`, console: 'nicht eingerichtet' } as const)[mode]}</dd>{mode !== 'console' && <><dt>Absender</dt><dd>{mailFrom()}</dd></>}</dl>
          {mode === 'console' && <p className="muted small">Ohne Mailversand bekommen weder Buchende noch das Team Nachrichten, und niemand kann sich in der Verwaltung anmelden.</p>}
        </div>
        <form action={testMailAction} className="card-foot inline"><button className="btn" type="submit" disabled={mode === 'console'}>Testmail an {me.email} senden</button></form>
      </section>

      <form action={operatorAction} className="card" id="betreiber">
        <div className="card-head"><div><h2>Betreiber und Impressum</h2><p>Pflichtangaben für eine eigenständige Website. Erscheinen im Impressum und in den Datenschutzhinweisen.</p></div>
          <span className={`badge ${operatorComplete(x.operator) ? 'b-ok' : 'b-warn'}`}>{operatorComplete(x.operator) ? 'vollständig' : 'unvollständig'}</span></div>
        <fieldset disabled={ro} className="card-body stack" style={{ border: 0, margin: 0 }}>
          <div className="row">
            <div className="field"><label htmlFor="op1" className="req">Name (Person oder Verein)</label><input id="op1" name="opName" type="text" defaultValue={x.operator.name} placeholder="z. B. SV Heepen e. V., vertreten durch …" /></div>
            <div className="field"><label htmlFor="op3" className="req">E-Mail</label><input id="op3" name="opEmail" type="email" defaultValue={x.operator.email} /></div>
            <div className="field"><label htmlFor="op4">Telefon</label><input id="op4" name="opPhone" type="tel" defaultValue={x.operator.phone} /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="op2" className="req">Anschrift</label><textarea id="op2" name="opAddress" defaultValue={x.operator.address} style={{ minHeight: 80 }} placeholder={'Straße Nr.\nPLZ Ort'} /></div>
            <div className="field"><label htmlFor="op5">Inhaltlich verantwortlich</label><input id="op5" name="opResponsible" type="text" defaultValue={x.operator.responsible} placeholder="Name, Anschrift (falls abweichend)" />
              <span className="hint">Bei einem Verein zusätzlich sinnvoll: Vereinsregister und Registernummer im Namensfeld oder hier.</span></div>
          </div>
          <span className="muted small">Hinweis: Das ist keine Rechtsberatung. Lass die Angaben im Zweifel vom Vorstand prüfen.</span>
        </fieldset>
        {!ro && <div className="card-foot"><button className="btn btn-primary" type="submit">Speichern</button></div>}
      </form>

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

      <form action={paymentSettingsAction} className="card" id="bezahlung">
        <div className="card-head"><div><h2>Bezahlung</h2><p>Wie Entgelt und Kaution bezahlt werden. Die Beträge legst du oben unter „Ausstattung und Kosten“ fest.</p></div></div>
        <fieldset disabled={ro} className="card-body stack" style={{ border: 0, margin: 0 }}>
          <label className="choice"><input type="checkbox" name="transfer" defaultChecked={x.payment.transfer} /><span><b>Überweisung mit GiroCode</b><br /><span className="muted small">Bankdaten und ein QR-Code, den man mit der Banking-App scannt. Keine Gebühren. Eingänge hakst du in der Buchung ab.</span></span></label>
          <div className="row">
            <div className="field"><label htmlFor="p1">Kontoinhaber</label><input id="p1" name="holder" type="text" maxLength={70} defaultValue={x.payment.holder} placeholder="SV Heepen e. V." /></div>
            <div className="field"><label htmlFor="p2">IBAN</label><input id="p2" name="iban" type="text" defaultValue={x.payment.iban ? formatIban(x.payment.iban) : ''} placeholder="DE00 0000 0000 0000 0000 00" /></div>
            <div className="field"><label htmlFor="p3">BIC <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><input id="p3" name="bic" type="text" maxLength={11} defaultValue={x.payment.bic} /></div>
          </div>
          <label className="choice"><input type="checkbox" name="paypal" defaultChecked={x.payment.paypal} /><span><b>PayPal.me-Link</b><br /><span className="muted small">Betrag wird vorausgefüllt. Eingänge hakst du in der Buchung ab.</span></span></label>
          <div className="field" style={{ maxWidth: 360 }}><label htmlFor="p4">PayPal.me-Name</label><input id="p4" name="paypalMe" type="text" defaultValue={x.payment.paypalMe} placeholder="z. B. svheepen" /><span className="hint">Der Teil hinter paypal.me/</span></div>
          <label className="choice"><input type="checkbox" name="stripe" defaultChecked={x.payment.stripe} /><span><b>Online bezahlen über Stripe</b> <span className={`badge ${stripeEnabled() ? 'b-ok' : 'no-dot'}`}>{stripeEnabled() ? 'verbunden' : 'nicht eingerichtet'}</span><br />
            <span className="muted small">Karte, PayPal, Apple/Google Pay, Lastschrift. Wird automatisch verbucht, Kaution per Knopfdruck erstattbar. Stripe nimmt pro Zahlung eine Gebühr. Einrichtung: STRIPE_SECRET_KEY und STRIPE_WEBHOOK_SECRET beim Hosting eintragen (siehe EINRICHTUNG.md).</span></span></label>
          {stripeEnabled() && <div className="field"><span className="label">Webhook-Adresse für Stripe</span><input type="text" readOnly value={`${appUrl()}/api/stripe/webhook`} aria-label="Webhook-Adresse" /><span className="hint">In Stripe unter Entwickler → Webhooks anlegen, Ereignisse: checkout.session.completed und checkout.session.async_payment_succeeded.</span></div>}
          <div className="row">
            <div className="field"><label htmlFor="p5">Zahlungsfrist (Tage vor dem Termin)</label><input id="p5" name="dueDays" type="number" min={0} max={60} defaultValue={x.payment.dueDays} /></div>
            <div className="field span-2"><label htmlFor="p6">Hinweis zur Bezahlung <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><input id="p6" name="note" type="text" maxLength={300} defaultValue={x.payment.note} placeholder="z. B. Barzahlung bei der Schlüsselübergabe ist auch möglich." /></div>
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
