import { describe, expect, it } from 'vitest';
import { googleCalendarLink, rebookHref } from './gcal-link';

describe('Links', () => {
  it('Google-Kalender-Link mit UTC-Zeiten', () => {
    const u = new URL(googleCalendarLink({ title: 'Jugendraum: Feier', start: Date.UTC(2026, 10, 21, 17), end: Date.UTC(2026, 10, 22, 0), location: 'Jugendraum' }));
    expect(u.host).toBe('calendar.google.com');
    expect(u.searchParams.get('dates')).toBe('20261121T170000Z/20261122T000000Z');
    expect(u.searchParams.get('text')).toBe('Jugendraum: Feier');
  });
  it('Erneut buchen übernimmt Art, Anlass, Personen und Uhrzeit, aber kein Datum', () => {
    const href = rebookHref({ categoryId: 'team', title: 'Mannschaftsabend B1', guests: 18, start: 0, end: 1, equipment: ['Beamer', 'Küche'] }, (ts) => (ts ? '22:00' : '18:00'));
    const u = new URL(href, 'http://x');
    expect(Object.fromEntries(u.searchParams)).toEqual({ art: 'team', titel: 'Mannschaftsabend B1', personen: '18', von: '18:00', bis: '22:00', ausstattung: 'Beamer,Küche' });
    expect(u.hash).toBe('#anfrage');
  });
});
