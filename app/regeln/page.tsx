import { getCategories, getSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Regeln & Hausordnung' };

export default async function Regeln() {
  const [cats, s] = await Promise.all([getCategories(), getSettings()]);
  return (
    <main className="wrap">
      <div className="page-title"><div><span className="label">Damit es für alle passt</span><h1>Regeln &amp; Hausordnung</h1></div></div>
      <div className="panel prose" style={{ marginBottom: 40 }}>
        <h2 style={{ marginTop: 0 }}>So läuft eine Buchung</h2>
        <ol>
          <li>Sprich die Nutzung vorher mit <b>Michael Grieswelle</b> oder <b>Sigrid Brodig</b> ab. Ohne diese Absprache ist eine Buchung ungültig.</li>
          <li>Frag den Raum hier online an und bestätige deine E-Mail-Adresse über den Link in der Mail.</li>
          <li>Das Orga-Team prüft die Anfrage. Besprechungen und Mannschaftssitzungen von Mitgliedern werden direkt eingetragen.</li>
          <li>Du bekommst eine Bestätigung mit Kalendereintrag und Erinnerungen 3 Tage und 24 Stunden vorher.</li>
        </ol>
        <h2>Eine Party pro Wochenende</h2>
        <p>Von Freitag {s.weekendFromHour}:00 bis Montag {String(s.weekendUntilHour).padStart(2, '0')}:00 Uhr gibt es höchstens eine Feier im Jugendraum, damit Nachbarn und Raum durchatmen können.
          {s.partyBlocksWholeWeekend ? ' An einem Party-Wochenende ist der Raum auch für andere Termine gesperrt.' : ' Andere Termine sind am Party-Wochenende weiterhin möglich.'}
          {' '}Feiern bitte mindestens {s.partyMinLeadDays} Tage vorher anfragen. Partys enden spätestens um {s.partyLatestEnd} Uhr.</p>
        <h2>Pufferzeiten</h2>
        <p>Vor und nach jedem Termin bleibt Zeit für Auf- und Abbau. Zwischen zwei Terminen gilt der jeweils größere Puffer.</p>
        <div className="table-wrap"><table><thead><tr><th>Kategorie</th><th>vorher</th><th>nachher</th></tr></thead>
          <tbody>{cats.map((c) => <tr key={c.id}><td><span className="catchip" style={{ '--c': c.color } as React.CSSProperties}><i />{c.name}</span></td><td>{c.bufferBefore} min</td><td>{c.bufferAfter} min</td></tr>)}</tbody></table></div>
        <h2>Hausordnung</h2>
        <ul>
          <li>Höchstens {s.capacity} Personen im Raum.</li>
          <li>Ab 22 Uhr draußen Ruhe, Musik nur bei geschlossenen Fenstern.</li>
          <li>Rauchen nur draußen. Keine Pyrotechnik, kein Konfetti.</li>
          <li>Raum besenrein verlassen, Müll mitnehmen, Küche sauber, Fenster zu, Licht aus.</li>
          <li>Schäden bitte sofort melden. Wer bucht, haftet für Schäden während der Nutzung.</li>
          <li>Schlüssel nach Absprache abholen und zurückgeben.</li>
        </ul>
        <h2 id="datenschutz">Datenschutz</h2>
        <p>Wir speichern deine Angaben (Name, Kontakt, Termin, Notiz) nur, um die Buchung abzuwickeln. Sehen können sie nur die Verantwortlichen des SV Heepen.
          Im öffentlichen Kalender steht nur „belegt“, nie dein Name. Daten werden 12 Monate nach dem Termin gelöscht. Verantwortlich ist der SV Heepen, Kontakt und weitere Hinweise unter <a href="https://www.sv-heepen.de">sv-heepen.de</a>.</p>
      </div>
    </main>
  );
}
