/** Textbausteine für Ablehnungen, Stornos und Nachrichten. Platzhalter: {vorname} {name} {anlass} {datum} {uhrzeit} {ansprechperson} */
export type ReplyTemplate = { id: string; title: string; text: string; use: 'reject' | 'message' | 'both' };

export const DEFAULT_TEMPLATES: ReplyTemplate[] = [
  { id: 'wochenende', use: 'reject', title: 'Wochenende schon belegt', text: 'An diesem Wochenende findet bereits eine Feier im Jugendraum statt. Pro Wochenende ist nur eine Feier möglich. Schau gern nach einem anderen Termin.' },
  { id: 'absprache', use: 'reject', title: 'Keine Absprache', text: 'Leider gab es vorab keine Absprache mit Michael Grieswelle oder Sigrid Brodig. Bitte melde dich kurz bei einem der beiden und stell die Anfrage danach neu.' },
  { id: 'verein', use: 'reject', title: 'Vereinstermin', text: 'Zu diesem Zeitpunkt nutzt der Verein den Raum selbst. Wir bitten um Verständnis.' },
  { id: 'gross', use: 'reject', title: 'Zu viele Personen', text: 'Für {anlass} sind zu viele Personen angemeldet. Der Raum ist für höchstens 40 Personen zugelassen.' },
  { id: 'schluessel', use: 'message', title: 'Schlüsselübergabe', text: 'Hallo {vorname}, für {anlass} am {datum}: Den Schlüssel bekommst du bei {ansprechperson}. Meld dich bitte kurz, wann es dir passt.' },
  { id: 'kaution', use: 'message', title: 'Kaution erinnern', text: 'Hallo {vorname}, bitte denk an die Kaution für {anlass} am {datum}. Die Bankdaten und den QR-Code findest du auf deiner Buchungsseite.' },
  { id: 'danke', use: 'message', title: 'Danke nach Nutzung', text: 'Hallo {vorname}, danke, dass ihr den Raum so ordentlich hinterlassen habt. Gern wieder!' },
];

export function fillTemplate(text: string, v: { name: string; title: string; date: string; time: string; agreedWith: string }): string {
  return text.replace(/\{vorname\}/g, v.name.trim().split(/\s+/)[0] ?? v.name).replace(/\{name\}/g, v.name).replace(/\{anlass\}/g, `„${v.title}“`)
    .replace(/\{datum\}/g, v.date).replace(/\{uhrzeit\}/g, v.time).replace(/\{ansprechperson\}/g, v.agreedWith);
}
