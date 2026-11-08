import { CalendarClock, Clock, KeyRound, PartyPopper, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { getCategories, getExtras, getRecurring, getSettings } from '@/lib/data';
import { describeRecurring } from '@/lib/rules';
import { eur } from '@/lib/labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Raum & Regeln' };

const SECTIONS = [['raum', 'Der Raum'], ['ablauf', 'So läuft eine Buchung'], ['feiern', 'Feiern'], ['puffer', 'Vorbereitungszeiten'], ['kosten', 'Kosten'],
  ['uebergabe', 'Schlüssel, Übergabe, Rückgabe'], ['hausordnung', 'Hausordnung'], ['storno', 'Absagen und Änderungen'], ['datenschutz', 'Datenschutz']];

export default async function Raum() {
  const [cats, s, x, rec] = await Promise.all([getCategories(), getSettings(), getExtras(), getRecurring()]);
  const today = new Date().toISOString().slice(0, 10);
  const fixed = rec.filter((r) => !r.validUntil || r.validUntil >= today);
  const hasFees = x.feesExternal.rent + x.feesExternal.deposit + x.feesMemberParty.rent + x.feesMemberParty.deposit > 0;
  return (
    <main className="wrap">
      <div className="doc">
        <nav className="toc" aria-label="Inhalt">{SECTIONS.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}</nav>
        <article className="prose">
          <div><span className="eyebrow">Jugendraum des SV Heepen</span><h1 style={{ fontSize: '1.9rem' }}>Raum &amp; Regeln</h1></div>
          <p>Damit der Jugendraum für alle gut nutzbar bleibt, gelten ein paar Regeln. Mit deiner Anfrage erkennst du sie an.</p>

          <h2 id="raum">Der Raum</h2>
          <div className="facts-grid">
            <div className="card fact"><Users className="icon" /><b>bis {s.capacity} Personen</b><span>zugelassene Höchstzahl</span></div>
            <div className="card fact"><PartyPopper className="icon" /><b>1 Feier pro Wochenende</b><span>Fr {s.weekendFromHour}:00 bis Mo {String(s.weekendUntilHour).padStart(2, '0')}:00</span></div>
            <div className="card fact"><Clock className="icon" /><b>Feiern bis {s.partyLatestEnd} Uhr</b><span>danach Aufräumen</span></div>
            <div className="card fact"><CalendarClock className="icon" /><b>{s.partyMinLeadDays} Tage Vorlauf</b><span>für Feiern</span></div>
          </div>
          {fixed.length > 0 && (
            <div className="card card-body stack-sm"><b>Feste Zeiten, in denen nicht gebucht werden kann</b>
              <ul style={{ margin: 0 }}>{fixed.map((r) => <li key={r.id}>{describeRecurring(r)}{r.scope === 'party' ? ' (nur Feiern)' : ''}: {r.reason}</li>)}</ul></div>
          )}
          {x.equipment.length > 0 && <p><b>Ausstattung:</b> {x.equipment.join(', ')}. Was du brauchst, kannst du bei der Anfrage angeben.</p>}

          <h2 id="ablauf">So läuft eine Buchung</h2>
          <ol>
            <li>Sprich die Nutzung vorher mit <b>Michael Grieswelle</b> oder <b>Sigrid Brodig</b> ab. Ohne diese Absprache ist eine Buchung ungültig.</li>
            <li>Stell die Anfrage <Link href="/">online</Link> und bestätige deine E-Mail-Adresse über den Link in unserer Mail. Unbestätigte Anfragen verfallen nach 24 Stunden.</li>
            <li>Das Orga-Team prüft die Anfrage und meldet sich per Mail. Besprechungen und Mannschaftssitzungen von Mitgliedern werden direkt eingetragen.</li>
            <li>Du bekommst eine Bestätigung mit Kalendereintrag sowie Erinnerungen drei Tage und einen Tag vorher.</li>
          </ol>

          <h2 id="feiern">Feiern</h2>
          <p>Pro Wochenende findet höchstens eine Feier im Jugendraum statt. Das schont Raum und Nachbarschaft.
            {s.partyBlocksWholeWeekend ? ' An einem Wochenende mit Feier ist der Raum auch für andere Termine gesperrt.' : ' Andere Termine sind am selben Wochenende weiterhin möglich.'}
            {' '}Feiern bitte mindestens {s.partyMinLeadDays} Tage vorher anfragen. Sie enden spätestens um {s.partyLatestEnd} Uhr, ab 22 Uhr gilt draußen Nachtruhe.</p>

          <h2 id="puffer">Vorbereitungszeiten</h2>
          <p>Vor und nach jedem Termin bleibt Zeit für Auf- und Abbau. Liegen zwei Termine hintereinander, gilt die längere der beiden Zeiten.</p>
          <div className="card table-wrap"><table><thead><tr><th>Art</th><th>vorher</th><th>nachher</th></tr></thead>
            <tbody>{cats.map((c) => <tr key={c.id}><td><span className="catdot" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span></td><td className="num">{c.bufferBefore} Min.</td><td className="num">{c.bufferAfter} Min.</td></tr>)}</tbody></table></div>

          <h2 id="kosten">Kosten</h2>
          {hasFees ? (
            <div className="card table-wrap"><table><thead><tr><th /><th>Nutzungsentgelt</th><th>Kaution</th></tr></thead><tbody>
              <tr><td>Nicht im Verein</td><td className="num">{eur(x.feesExternal.rent)}</td><td className="num">{eur(x.feesExternal.deposit)}</td></tr>
              <tr><td>Mitglieder, private Feier</td><td className="num">{eur(x.feesMemberParty.rent)}</td><td className="num">{eur(x.feesMemberParty.deposit)}</td></tr>
              <tr><td>Vereinstermine</td><td>kostenfrei</td><td>–</td></tr>
            </tbody></table></div>
          ) : <p>Vereinstermine sind kostenfrei. Ob für private Feiern ein Nutzungsentgelt oder eine Kaution anfällt, klärst du bei der Absprache.</p>}
          {hasFees && <p>Die Kaution wird bei der Schlüsselübergabe fällig und nach der Abnahme erstattet. Für Schäden oder fehlende Reinigung kann sie ganz oder teilweise einbehalten werden.</p>}

          <h2 id="uebergabe">Schlüssel, Übergabe, Rückgabe</h2>
          <ul>
            <li>Den Schlüssel bekommst du nach Absprache von deiner Ansprechperson. Er darf nicht an Dritte weitergegeben werden.</li>
            <li>Bei Übergabe und Rückgabe wird der Zustand des Raums und der Stromzähler kurz festgehalten.</li>
            <li>Ein verlorener Schlüssel muss sofort gemeldet werden. Die Kosten für den Ersatz trägt, wer gebucht hat.</li>
          </ul>

          <h2 id="hausordnung">Hausordnung</h2>
          <ul>
            <li>Höchstens {s.capacity} Personen im Raum.</li>
            <li>Ab 22 Uhr draußen Ruhe, Musik nur bei geschlossenen Fenstern und Türen.</li>
            <li>Rauchen nur draußen. Keine Pyrotechnik, kein Konfetti, keine offenen Flammen außer am Grill.</li>
            <li>Raum besenrein verlassen: Tische abwischen, Boden fegen, Küche und Geschirr sauber, Müll mitnehmen.</li>
            <li>Beim Gehen: Fenster schließen, Licht aus, Heizung runter, abschließen.</li>
            <li>Schäden bitte sofort melden. Wer bucht, haftet für Schäden während der Nutzung und ist verantwortlich für alle Gäste.</li>
            <li>Bei Veranstaltungen mit Minderjährigen gilt das Jugendschutzgesetz.</li>
          </ul>

          <h2 id="storno">Absagen und Änderungen</h2>
          <p>Absagen kannst du jederzeit selbst über den Link in deiner Bestätigungsmail. Bitte sag so früh wie möglich ab, damit andere den Termin nutzen können.
            Für Änderungen an Datum oder Uhrzeit melde dich bei deiner Ansprechperson. Das Orga-Team kann Termine verschieben, du wirst dann per Mail informiert.</p>

          <h2 id="datenschutz">Datenschutz</h2>
          <p>Wir verarbeiten deine Angaben (Name, Kontaktdaten, Termin, Nachricht) nur, um die Buchung abzuwickeln. Zugriff haben ausschließlich die zuständigen Personen im SV Heepen.
            Im öffentlichen Kalender steht nur, dass ein Termin belegt ist, nie dein Name. Personenbezogene Daten werden 12 Monate nach dem Termin automatisch gelöscht.
            Es werden keine Tracking- oder Werbe-Cookies gesetzt. Verantwortlich ist der SV Heepen, die vollständigen Datenschutzhinweise und das Impressum findest du auf <a href="https://www.sv-heepen.de">sv-heepen.de</a>.</p>
          <p className="inline" style={{ marginTop: 8 }}><ShieldCheck className="icon" style={{ color: 'var(--ok)' }} /><span className="muted small">Gehostet in Rechenzentren in Frankfurt am Main.</span></p>
          <p className="inline"><KeyRound className="icon" style={{ color: 'var(--muted)' }} /><span className="muted small">Fragen zu deinen Daten oder zur Löschung: an deine Ansprechperson oder den Vorstand.</span></p>
        </article>
      </div>
    </main>
  );
}
