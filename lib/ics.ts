import type { Booking } from './data';
import type { Category } from './rules';
import { appUrl } from './url';

export const icsStamp = (ts: number) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);

/** Zeilen nach RFC 5545 auf höchstens 75 Bytes falten, ohne UTF-8-Zeichen zu zerschneiden. */
export function icsFold(line: string): string {
  const out: string[] = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
export const icsJoin = (lines: string[]) => lines.map(icsFold).join('\r\n') + '\r\n';

export function bookingIcs(b: Booking, c?: Category): string {
  return icsJoin([
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SV Heepen//Jugendraum//DE', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@jugendraum.sv-heepen.de`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(b.start)}`,
    `DTEND:${icsStamp(b.end)}`,
    `SUMMARY:${icsText(`Jugendraum: ${b.title}`)}`,
    `DESCRIPTION:${icsText(`${c?.name ?? ''} · Buchung ${b.number}\nVerwalten: ${appUrl()}/buchung/${b.manageToken}`)}`,
    `LOCATION:${icsText('Jugendraum SV Heepen')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT', 'END:VCALENDAR',
  ]);
}
