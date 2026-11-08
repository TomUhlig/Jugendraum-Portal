import { describe, expect, it } from 'vitest';
import { describeSeries, seriesDates } from './series';

describe('Serientermine', () => {
  it('wöchentlich mit Anzahl', () => {
    expect(seriesDates('2026-11-10', 'weekly', { count: 3 })).toEqual(['2026-11-10', '2026-11-17', '2026-11-24']);
  });
  it('alle zwei Wochen bis Datum', () => {
    expect(seriesDates('2026-11-10', 'biweekly', { until: '2026-12-08' })).toEqual(['2026-11-10', '2026-11-24', '2026-12-08']);
  });
  it('monatlich am gleichen n-ten Wochentag über den Jahreswechsel', () => {
    // 1. Dienstag im Monat
    expect(seriesDates('2026-11-03', 'monthly', { count: 4 })).toEqual(['2026-11-03', '2026-12-01', '2027-01-05', '2027-02-02']);
  });
  it('überspringt Monate ohne 5. Wochentag', () => {
    const d = seriesDates('2026-12-29', 'monthly', { count: 3 }); // 5. Dienstag
    expect(d[0]).toBe('2026-12-29');
    expect(d.every((x) => +x.slice(8) >= 29)).toBe(true);
  });
  it('beschreibt die Serie lesbar', () => {
    expect(describeSeries('2026-11-03', 'monthly', '19:00', '21:00', 6)).toBe('jeden 1. Dienstag im Monat, 19:00–21:00 Uhr (6 Termine)');
  });
});
