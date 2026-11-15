// Zeit-Helfer, die unabhängig von der Zeitzone des Servers immer in Europe/Berlin rechnen.
export const TZ = 'Europe/Berlin';
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  weekday: 'short', hourCycle: 'h23',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** Kalenderteile eines Zeitpunkts in Berlin. */
export function berlinParts(ts: number): Parts {
  const p: Record<string, string> = {};
  for (const x of partsFmt.formatToParts(new Date(ts))) p[x.type] = x.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, weekday: WD[p.weekday] };
}

function offsetAt(ts: number): number {
  const p = berlinParts(ts);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(ts / MIN) * MIN;
}

/** "2026-11-14" + "18:30" (Berliner Ortszeit) → UTC-Zeitstempel. */
export function berlinToUtc(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts); // Korrektur an Sommer-/Winterzeit-Grenzen
  return ts;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (p: Pick<Parts, 'year' | 'month' | 'day'>) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
export const berlinYmd = (ts: number) => ymd(berlinParts(ts));
export const berlinHm = (ts: number) => { const p = berlinParts(ts); return `${pad(p.hour)}:${pad(p.minute)}`; };

/** Kalendertag + n Tage (reine Datumsrechnung, ohne Zeitzone). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Party-Wochenende: Freitag 12:00 bis Montag 06:00 (Berlin).
 * Liefert das Datum des Freitags oder null, wenn der Zeitpunkt nicht in einem Wochenende liegt.
 */
export function weekendKey(ts: number, fromHour = 12, untilHour = 6): string | null {
  const p = berlinParts(ts);
  let back: number | null = null;
  if (p.weekday === 5 && p.hour >= fromHour) back = 0;
  else if (p.weekday === 6) back = 1;
  else if (p.weekday === 0) back = 2;
  else if (p.weekday === 1 && p.hour < untilHour) back = 3;
  return back === null ? null : addDays(ymd(p), -back);
}

type Lng = 'de' | 'en' | 'tr';
const LOC: Record<Lng, string> = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' };
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(lang: Lng, kind: 'day' | 'long' | 'short'): Intl.DateTimeFormat {
  const k = lang + kind;
  let f = fmtCache.get(k);
  if (!f) {
    const o: Intl.DateTimeFormatOptions = kind === 'day' ? { weekday: 'short', day: 'numeric', month: 'short' }
      : kind === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' };
    f = new Intl.DateTimeFormat(LOC[lang], { timeZone: TZ, ...o });
    fmtCache.set(k, f);
  }
  return f;
}
/** „Sa., 14. Nov.“ (bzw. „Sat 14 Nov“, „14 Kas Cmt“). */
export const fmtDay = (ts: number, lang: Lng = 'de') => fmt(lang, 'day').format(new Date(ts));
/** „Samstag, 14. November 2026“. */
export const fmtLong = (ts: number, lang: Lng = 'de') => fmt(lang, 'long').format(new Date(ts));
export const fmtRange = (s: number, e: number) => `${fmtDay(s)} · ${berlinHm(s)}–${berlinHm(e)} Uhr`;
/** Uhrzeit-Spanne mit „Uhr“ nur auf Deutsch. */
export const hmRange = (s: number, e: number, lang: Lng = 'de') => `${berlinHm(s)}–${berlinHm(e)}${lang === 'de' ? ' Uhr' : ''}`;

export function weekendLabel(key: string, lang: Lng = 'de'): string {
  const [y, m, d] = addDays(key, 2).split('-').map(Number);
  const sun = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(LOC[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return lang === 'de' ? `${+key.slice(8)}.–${sun}` : `${+key.slice(8)}–${sun}`;
}
