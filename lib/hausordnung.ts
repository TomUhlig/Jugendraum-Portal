/** Hausordnung, an einer Stelle gepflegt: Seite „Raum & Regeln“ und Nutzungsvereinbarung zum Ausdrucken. */
export function hausordnung(capacity: number): string[] {
  return [
    `Höchstens ${capacity} Personen im Raum.`,
    'Ab 22 Uhr draußen Ruhe, Musik nur bei geschlossenen Fenstern und Türen.',
    'Rauchen nur draußen. Keine Pyrotechnik, kein Konfetti, keine offenen Flammen außer am Grill.',
    'Raum besenrein verlassen: Tische abwischen, Boden fegen, Küche und Geschirr sauber, Müll mitnehmen.',
    'Beim Gehen: Fenster schließen, Licht aus, Heizung runter, abschließen.',
    'Schäden bitte sofort melden. Wer bucht, haftet für Schäden während der Nutzung und ist verantwortlich für alle Gäste.',
    'Bei Veranstaltungen mit Minderjährigen gilt das Jugendschutzgesetz.',
  ];
}
export const SCHLUESSELREGELN = [
  'Der Schlüssel wird nach Absprache übergeben und darf nicht an Dritte weitergegeben werden.',
  'Bei Übergabe und Rückgabe werden Zustand des Raums und Stromzähler festgehalten.',
  'Ein verlorener Schlüssel muss sofort gemeldet werden. Die Kosten für den Ersatz trägt, wer gebucht hat.',
];
