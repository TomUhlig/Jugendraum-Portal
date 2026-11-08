import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getCategories, getExtras } from '@/lib/data';
import { addDays, berlinYmd } from '@/lib/time';
import { createAction } from '../../actions';

export default async function Neu({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin('manager');
  const sp = await searchParams;
  const [cats, extras] = await Promise.all([getCategories(), getExtras()]);
  const tomorrow = addDays(berlinYmd(Date.now()), 1);
  return (
    <>
      <PageHead eyebrow="Für dich oder für andere, direkt bestätigt und ohne Anfrage" title="Termin eintragen" />
      <Flash sp={sp} />
      <form action={createAction} className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Termin</h2></div>
            <div className="card-body stack">
              <div className="row">
                <div className="field"><label htmlFor="n-cat" className="req">Art</label><select id="n-cat" name="categoryId" defaultValue={sp.art ?? 'meet'}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="field span-2"><label htmlFor="n-title" className="req">Titel</label><input id="n-title" name="title" type="text" required maxLength={80} placeholder="z. B. Vorstandssitzung" /></div>
              </div>
              <div className="row">
                <div className="field"><label htmlFor="n-date" className="req">Datum</label><input id="n-date" name="date" type="date" required defaultValue={sp.datum ?? tomorrow} /></div>
                <div className="field"><label htmlFor="n-start" className="req">Von</label><input id="n-start" name="start" type="time" step={900} required defaultValue="19:00" /></div>
                <div className="field"><label htmlFor="n-end" className="req">Bis</label><input id="n-end" name="end" type="time" step={900} required defaultValue="21:00" /><span className="hint">früher als Beginn = Folgetag</span></div>
                <div className="field"><label htmlFor="n-guests">Personen</label><input id="n-guests" name="guests" type="number" min={1} defaultValue={10} /></div>
              </div>
              {extras.equipment.length > 0 && <div className="field"><span className="label">Ausstattung</span><div className="chips">{extras.equipment.map((e) => <label key={e} className="chip"><input type="checkbox" name="equipment" value={e} />{e}</label>)}</div></div>}
              <div className="field"><label htmlFor="n-note">Notiz</label><textarea id="n-note" name="note" maxLength={500} style={{ minHeight: 70 }} /></div>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Wiederholen</h2><p>Für regelmäßige Termine wie Vorstandssitzungen oder Trainerrunden</p></div></div>
            <div className="card-body row">
              <div className="field"><label htmlFor="n-rep">Rhythmus</label><select id="n-rep" name="repeat" defaultValue="none">
                <option value="none">einmalig</option><option value="weekly">jede Woche</option><option value="biweekly">alle 2 Wochen</option><option value="monthly">jeden Monat (gleicher Wochentag, z. B. 1. Dienstag)</option></select></div>
              <div className="field"><label htmlFor="n-until">bis einschließlich</label><input id="n-until" name="until" type="date" /></div>
              <div className="field"><label htmlFor="n-count">oder Anzahl</label><input id="n-count" name="count" type="number" min={2} max={60} placeholder="z. B. 10" /></div>
            </div>
            <div className="card-foot small muted">Termine, die mit bestehenden Buchungen kollidieren, werden übersprungen und danach aufgelistet. Höchstens 60 Termine pro Serie.</div>
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <div className="card-head"><div><h2>Für wen?</h2><p>Leer lassen, wenn du selbst verantwortlich bist. Alle Angaben sind optional.</p></div></div>
            <div className="card-body stack">
              <div className="segmented" role="radiogroup" aria-label="Bucher">
                <label className="chip" style={{ border: 0 }}><input type="radio" name="bookerType" value="member" defaultChecked />Mitglied</label>
                <label className="chip" style={{ border: 0 }}><input type="radio" name="bookerType" value="external" />nicht im Verein</label>
              </div>
              <div className="field"><label htmlFor="n-name">Name</label><input id="n-name" name="name" type="text" placeholder={me.name} /></div>
              <div className="field"><label htmlFor="n-team">Mannschaft / Abteilung</label><input id="n-team" name="team" type="text" /></div>
              <div className="field"><label htmlFor="n-email">E-Mail</label><input id="n-email" name="email" type="email" placeholder={me.email} /></div>
              <div className="field"><label htmlFor="n-phone">Telefon</label><input id="n-phone" name="phone" type="tel" /></div>
              <div className="field"><label htmlFor="n-ag">Abgesprochen mit</label><select id="n-ag" name="agreedWith" defaultValue=""><option value="">{me.name}</option><option>Michael Grieswelle</option><option>Sigrid Brodig</option></select></div>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>E-Mails an diese Person</h2><p>Das Orga-Team bekommt bei eingetragenen Terminen keine Mails.</p></div></div>
            <div className="card-body stack-sm" role="radiogroup" aria-label="E-Mails">
              <label className="choice"><input type="radio" name="mails" value="none" defaultChecked /><span><b>Keine E-Mails</b><br /><span className="muted small">Keine Bestätigung, keine Erinnerungen, keine Nachfrage. Für Termine, die du selbst absprichst.</span></span></label>
              <label className="choice"><input type="radio" name="mails" value="reminders" /><span><b>Nur Erinnerungen</b><br /><span className="muted small">Erinnerung vor dem Termin, Info bei Änderungen, Nachfrage danach.</span></span></label>
              <label className="choice"><input type="radio" name="mails" value="confirm" /><span><b>Bestätigung und Erinnerungen</b><br /><span className="muted small">Wie eine normale Buchung, mit Kalenderdatei.</span></span></label>
              <span className="muted small">Ohne E-Mail-Adresse werden nie Mails verschickt. Lässt sich später in der Buchung ändern.</span>
            </div>
          </section>
          <section className="card card-body stack-sm">
            <label className="check-inline"><input type="checkbox" name="override" /> Puffer, Sperrzeiten und Party-Regel bewusst übergehen</label>
            <span className="muted small">Echte Überschneidungen mit anderen Terminen bleiben immer gesperrt. Jede Ausnahme wird im Verlauf festgehalten.</span>
            <button className="btn btn-primary btn-lg" type="submit" style={{ marginTop: 8 }}>Eintragen</button>
          </section>
        </div>
      </form>
    </>
  );
}
