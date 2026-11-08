import { describe, expect, it } from 'vitest';
import { Category, Context, DEFAULT_SETTINGS, Slot, checkBooking, requiredGap } from './rules';
import { berlinHm, berlinToUtc, weekendKey } from './time';

const cat = (id: string, before: number, after: number, isParty = false): Category => ({
  id, name: id, hint: '', color: '#000', bufferBefore: before, bufferAfter: after,
  requiresApproval: isParty, isParty, maxDurationMin: isParty ? 16 * 60 : 6 * 60, sort: 0,
});
const CATS = [cat('meet', 15, 15), cat('team', 15, 30), cat('event', 60, 60), cat('party', 120, 180, true)];
const t = (date: string, time: string) => berlinToUtc(date, time);
const NOW = t('2026-11-01', '10:00');

function ctx(slots: Slot[], extra: Partial<Context> = {}): Context {
  return { categories: CATS, settings: DEFAULT_SETTINGS, slots, blackouts: [], now: NOW, ...extra };
}
const slot = (id: string, categoryId: string, date: string, from: string, toDate: string, to: string): Slot =>
  ({ id, categoryId, start: t(date, from), end: t(toDate, to), status: 'confirmed' });

describe('Zeit', () => {
  it('rechnet Berliner Ortszeit in UTC um (Winter- und Sommerzeit)', () => {
    expect(new Date(t('2026-11-14', '18:00')).toISOString()).toBe('2026-11-14T17:00:00.000Z');
    expect(new Date(t('2026-07-04', '18:00')).toISOString()).toBe('2026-07-04T16:00:00.000Z');
    expect(berlinHm(t('2026-03-29', '03:30'))).toBe('03:30');
  });
  it('erkennt das Party-Wochenende Fr 12:00 bis Mo 06:00', () => {
    expect(weekendKey(t('2026-11-13', '11:59'))).toBeNull();
    expect(weekendKey(t('2026-11-13', '12:00'))).toBe('2026-11-13');
    expect(weekendKey(t('2026-11-15', '23:00'))).toBe('2026-11-13');
    expect(weekendKey(t('2026-11-16', '05:59'))).toBe('2026-11-13');
    expect(weekendKey(t('2026-11-16', '06:00'))).toBeNull();
  });
});

describe('Puffer', () => {
  it('nimmt den größeren Puffer, nicht die Summe', () => {
    expect(requiredGap(CATS[1], CATS[0]) / 60_000).toBe(30);
  });
  it('blockiert zu knappe Anschlusstermine und schlägt die frühestmögliche Zeit vor', () => {
    const r = checkBooking({ categoryId: 'meet', start: t('2026-11-10', '19:45'), end: t('2026-11-10', '21:00'), guests: 8 },
      ctx([slot('a', 'team', '2026-11-10', '18:00', '2026-11-10', '19:30')]));
    expect(r.level).toBe('block');
    expect(r.messages[0].code).toBe('buffer');
    expect(berlinHm(r.suggestion!.start)).toBe('20:00');
  });
  it('erlaubt Termine mit genau dem nötigen Abstand', () => {
    const r = checkBooking({ categoryId: 'meet', start: t('2026-11-10', '20:00'), end: t('2026-11-10', '21:00'), guests: 8 },
      ctx([slot('a', 'team', '2026-11-10', '18:00', '2026-11-10', '19:30')]));
    expect(r.level).toBe('ok');
  });
  it('meldet echte Überschneidungen als belegt', () => {
    const r = checkBooking({ categoryId: 'meet', start: t('2026-11-10', '19:00'), end: t('2026-11-10', '20:00'), guests: 8 },
      ctx([slot('a', 'team', '2026-11-10', '18:00', '2026-11-10', '19:30')]));
    expect(r.messages.map((m) => m.code)).toContain('overlap');
  });
});

describe('Eine Party pro Wochenende', () => {
  const party = slot('p', 'party', '2026-11-28', '18:00', '2026-11-29', '01:00');
  it('sperrt eine zweite Party am selben Wochenende, auch ohne Zeitüberschneidung', () => {
    const r = checkBooking({ categoryId: 'party', start: t('2026-11-27', '13:00'), end: t('2026-11-27', '15:00'), guests: 20 }, ctx([party]));
    expect(r.messages.map((m) => m.code)).toContain('party-weekend');
    expect(r.suggestion?.label).toContain('4.–6. Dez.');
  });
  it('lässt normale Termine am Party-Wochenende zu', () => {
    const r = checkBooking({ categoryId: 'meet', start: t('2026-11-29', '11:00'), end: t('2026-11-29', '12:00'), guests: 8 }, ctx([party]));
    expect(r.level).toBe('ok');
  });
  it('sperrt alles, wenn „Party sperrt das ganze Wochenende“ aktiv ist', () => {
    const r = checkBooking({ categoryId: 'meet', start: t('2026-11-29', '11:00'), end: t('2026-11-29', '12:00'), guests: 8 },
      ctx([party], { settings: { ...DEFAULT_SETTINGS, partyBlocksWholeWeekend: true } }));
    expect(r.level).toBe('block');
  });
  it('ignoriert die eigene Buchung (Admin-Prüfung)', () => {
    const r = checkBooking({ categoryId: 'party', start: party.start, end: party.end, guests: 30 }, ctx([party], { ignoreId: 'p' }));
    expect(r.level).toBe('ok');
  });
});

describe('Hinweise', () => {
  it('warnt bei kurzfristiger Party, zu vielen Gästen und spätem Ende', () => {
    const r = checkBooking({ categoryId: 'party', start: t('2026-11-07', '19:00'), end: t('2026-11-08', '02:00'), guests: 55 }, ctx([]));
    expect(r.level).toBe('warn');
    expect(r.messages.map((m) => m.code).sort()).toEqual(['capacity', 'late', 'lead']);
  });
  it('blockiert Vergangenheit, Überlänge und Sperrzeiten', () => {
    expect(checkBooking({ categoryId: 'meet', start: t('2026-10-01', '10:00'), end: t('2026-10-01', '11:00'), guests: 1 }, ctx([])).level).toBe('block');
    expect(checkBooking({ categoryId: 'meet', start: t('2026-12-01', '08:00'), end: t('2026-12-01', '15:00'), guests: 1 }, ctx([])).messages[0].code).toBe('duration');
    const r = checkBooking({ categoryId: 'meet', start: t('2026-12-22', '10:00'), end: t('2026-12-22', '11:00'), guests: 1 },
      ctx([], { blackouts: [{ id: 'x', start: t('2026-12-21', '00:00'), end: t('2027-01-04', '00:00'), reason: 'Weihnachtspause' }] }));
    expect(r.messages[0].code).toBe('blackout');
  });
});
