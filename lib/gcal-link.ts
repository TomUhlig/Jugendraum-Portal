// „Zu Google Kalender hinzufügen“-Link (ohne Anmeldung, öffnet die Google-Kalender-Vorlage).
const z = (ts: number) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function googleCalendarLink(o: { title: string; start: number; end: number; details?: string; location?: string }): string {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: o.title, dates: `${z(o.start)}/${z(o.end)}`, ctz: 'Europe/Berlin' });
  if (o.details) p.set('details', o.details);
  if (o.location) p.set('location', o.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
