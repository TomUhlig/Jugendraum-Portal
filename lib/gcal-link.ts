// „Zu Google Kalender hinzufügen“-Link (ohne Anmeldung, öffnet die Google-Kalender-Vorlage).
const z = (ts: number) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function googleCalendarLink(o: { title: string; start: number; end: number; details?: string; location?: string }): string {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: o.title, dates: `${z(o.start)}/${z(o.end)}`, ctz: 'Europe/Berlin' });
  if (o.details) p.set('details', o.details);
  if (o.location) p.set('location', o.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Link auf die Startseite mit den Angaben einer früheren Buchung (ohne Datum und ohne persönliche Daten). */
export function rebookHref(b: { categoryId: string; title: string; guests: number; start: number; end: number; equipment?: string[] }, hm: (ts: number) => string): string {
  const p = new URLSearchParams({ art: b.categoryId, titel: b.title, personen: String(b.guests), von: hm(b.start), bis: hm(b.end) });
  if (b.equipment?.length) p.set('ausstattung', b.equipment.join(','));
  return `/?${p.toString()}#anfrage`;
}
