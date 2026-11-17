import { describe, expect, it } from 'vitest';
import { dayInfos, publicHolidays } from './holidays';

describe('Feiertage', () => {
  it('berechnet Ostern und bewegliche Feiertage richtig', () => {
    const h = Object.fromEntries(publicHolidays(2026).map((x) => [x.name, x.date]));
    expect(h['Ostersonntag']).toBe('2026-04-05');
    expect(h['Karfreitag']).toBe('2026-04-03');
    expect(h['Christi Himmelfahrt']).toBe('2026-05-14');
    expect(h['Pfingstmontag']).toBe('2026-05-25');
    expect(h['Fronleichnam']).toBe('2026-06-04');
    expect(publicHolidays(2027).find((x) => x.name === 'Ostersonntag')?.date).toBe('2027-03-28');
  });
  it('regionale Feiertage nur im passenden Bundesland', () => {
    expect(publicHolidays(2026, 'DE-NW').some((x) => x.name === 'Allerheiligen')).toBe(true);
    expect(publicHolidays(2026, 'DE-NI').some((x) => x.name === 'Allerheiligen')).toBe(false);
    expect(publicHolidays(2026, 'DE-SN').find((x) => x.name === 'Buß- und Bettag')?.date).toBe('2026-11-18');
  });
  it('Ferientage werden pro Tag aufgelöst', () => {
    const m = dayInfos('2026-12-20', '2026-12-28', 'DE-NW', [{ from: '2026-12-23', to: '2027-01-06', name: 'Weihnachtsferien' }]);
    expect(m.get('2026-12-22')).toBeUndefined();
    expect(m.get('2026-12-25')?.map((x) => x.name)).toEqual(['1. Weihnachtstag', 'Weihnachtsferien']);
  });
});
