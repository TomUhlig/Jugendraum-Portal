import { addDays } from './time';

/** Feiertage werden lokal berechnet (Ostern nach Gauß), Schulferien kommen von openholidaysapi.org und werden gespeichert. */
export type DayInfo = { date: string; name: string; kind: 'holiday' | 'school'; /** kein gesetzlicher Feiertag (Heiligabend, Silvester) */ info?: boolean };

function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Bundesweite Feiertage plus regionale je Bundesland (Kürzel wie DE-NW). */
const REGIONAL: Record<string, string[]> = {
  'DE-NW': ['fronleichnam', 'allerheiligen'], 'DE-BY': ['dreikoenige', 'fronleichnam', 'allerheiligen'], 'DE-BW': ['dreikoenige', 'fronleichnam', 'allerheiligen'],
  'DE-RP': ['fronleichnam', 'allerheiligen'], 'DE-SL': ['fronleichnam', 'allerheiligen', 'mariae'], 'DE-HE': ['fronleichnam'], 'DE-NI': ['reformation'], 'DE-HB': ['reformation'],
  'DE-HH': ['reformation'], 'DE-SH': ['reformation'], 'DE-BB': ['reformation'], 'DE-MV': ['reformation', 'frauentag'], 'DE-SN': ['reformation', 'busstag'],
  'DE-ST': ['dreikoenige', 'reformation'], 'DE-TH': ['reformation', 'kindertag'], 'DE-BE': ['frauentag'],
};
export function publicHolidays(year: number, region = 'DE-NW'): DayInfo[] {
  const e = easter(year), r = REGIONAL[region] ?? [];
  const nov23 = `${year}-11-23`; const bussDay = addDays(nov23, -((new Date(`${nov23}T12:00:00Z`).getUTCDay() + 4) % 7)); // Mittwoch vor dem 23.11.
  const list: [string, string, string?][] = [
    [`${year}-01-01`, 'Neujahr'], [addDays(e, -2), 'Karfreitag'], [e, 'Ostersonntag'], [addDays(e, 1), 'Ostermontag'], [`${year}-05-01`, 'Tag der Arbeit'],
    [addDays(e, 39), 'Christi Himmelfahrt'], [addDays(e, 49), 'Pfingstsonntag'], [addDays(e, 50), 'Pfingstmontag'], [`${year}-10-03`, 'Tag der Deutschen Einheit'],
    [`${year}-12-24`, 'Heiligabend'], [`${year}-12-25`, '1. Weihnachtstag'], [`${year}-12-26`, '2. Weihnachtstag'], [`${year}-12-31`, 'Silvester'],
    [`${year}-01-06`, 'Heilige Drei Könige', 'dreikoenige'], [addDays(e, 60), 'Fronleichnam', 'fronleichnam'], [`${year}-11-01`, 'Allerheiligen', 'allerheiligen'],
    [`${year}-08-15`, 'Mariä Himmelfahrt', 'mariae'], [`${year}-10-31`, 'Reformationstag', 'reformation'], [`${year}-03-08`, 'Frauentag', 'frauentag'],
    [bussDay, 'Buß- und Bettag', 'busstag'], [`${year}-09-20`, 'Weltkindertag', 'kindertag'],
  ];
  return list.filter(([, , k]) => !k || r.includes(k)).map(([date, name]) => ({ date, name, kind: 'holiday' as const, ...(['Heiligabend', 'Silvester'].includes(name) ? { info: true } : {}) })).sort((a, b) => a.date.localeCompare(b.date));
}

export type SchoolPeriod = { from: string; to: string; name: string };
/** Schulferien von openholidaysapi.org (kostenlos, ohne Schlüssel). */
export async function fetchSchoolHolidays(region: string, fromYear: number, years = 2): Promise<SchoolPeriod[]> {
  const q = new URLSearchParams({ countryIsoCode: 'DE', subdivisionCode: region, languageIsoCode: 'DE', validFrom: `${fromYear}-01-01`, validTo: `${fromYear + years - 1}-12-31` });
  const res = await fetch(`https://openholidaysapi.org/SchoolHolidays?${q}`, { headers: { accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Ferien-Abruf fehlgeschlagen (${res.status})`);
  const j = (await res.json()) as { startDate: string; endDate: string; name: { language: string; text: string }[] }[];
  return j.map((x) => ({ from: x.startDate, to: x.endDate, name: x.name.find((n) => n.language === 'DE')?.text ?? x.name[0]?.text ?? 'Ferien' }));
}

/** Kalenderhinweise für einen Zeitraum (Feiertage und Ferientage). */
export function dayInfos(fromDate: string, toDate: string, region: string, school: SchoolPeriod[]): Map<string, DayInfo[]> {
  const out = new Map<string, DayInfo[]>();
  const push = (d: string, i: DayInfo) => out.set(d, [...(out.get(d) ?? []), i]);
  for (let y = +fromDate.slice(0, 4); y <= +toDate.slice(0, 4); y++) for (const h of publicHolidays(y, region)) if (h.date >= fromDate && h.date <= toDate) push(h.date, h);
  for (const p of school) for (let d = p.from > fromDate ? p.from : fromDate; d <= p.to && d <= toDate; d = addDays(d, 1)) push(d, { date: d, name: p.name, kind: 'school' });
  return out;
}
