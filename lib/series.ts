// Serientermine: liefert die Kalendertage (YYYY-MM-DD) einer Wiederholung.
import { addDays, weekdayOf } from './time';

export type Freq = 'weekly' | 'biweekly' | 'monthly';
export const FREQ_LABEL: Record<Freq, string> = { weekly: 'jede Woche', biweekly: 'alle 2 Wochen', monthly: 'jeden Monat (gleicher Wochentag)' };
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** n-ter Wochentag im Monat des Datums (1–5). */
export const nthOfMonth = (date: string) => Math.ceil(+date.slice(8) / 7);

function nthWeekday(year: number, month: number, weekday: number, nth: number): string | null {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const offset = (weekday - weekdayOf(first) + 7) % 7;
  const d = addDays(first, offset + (nth - 1) * 7);
  return +d.slice(5, 7) === month ? d : null; // 5. Wochentag gibt es nicht in jedem Monat
}

export function seriesDates(start: string, freq: Freq, opts: { until?: string; count?: number }, max = 60): string[] {
  const limit = Math.min(opts.count ?? max, max);
  const out: string[] = [];
  if (freq === 'monthly') {
    const wd = weekdayOf(start), nth = nthOfMonth(start);
    let [y, m] = start.split('-').map(Number);
    for (let i = 0; out.length < limit && i < max * 2; i++) {
      const d = nthWeekday(y, m, wd, nth);
      if (d && d >= start) { if (opts.until && d > opts.until) break; out.push(d); }
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  const step = freq === 'weekly' ? 7 : 14;
  for (let d = start; out.length < limit; d = addDays(d, step)) {
    if (opts.until && d > opts.until) break;
    out.push(d);
  }
  return out;
}

export function describeSeries(start: string, freq: Freq, from: string, to: string, n: number): string {
  const wd = WD[weekdayOf(start)];
  const when = freq === 'monthly' ? `jeden ${nthOfMonth(start)}. ${wd} im Monat` : freq === 'weekly' ? `jeden ${wd}` : `jeden zweiten ${wd}`;
  return `${when}, ${from}–${to} Uhr (${n} Termine)`;
}
