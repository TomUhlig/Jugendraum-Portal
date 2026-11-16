import { beforeAll, describe, expect, it, vi } from 'vitest';

// Server-Module für den Test ersetzen: Datenbank liefert ein festes Team
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect'); } }));
const team: Record<string, { id: string; email: string; name: string; role: string; notify: boolean }> = {
  'tom@example.de': { id: '11111111-1111-1111-1111-111111111111', email: 'tom@example.de', name: 'Tom', role: 'admin', notify: true },
  'gast@example.de': { id: '22222222-2222-2222-2222-222222222222', email: 'gast@example.de', name: 'Gast', role: 'viewer', notify: false },
};
vi.mock('./db', () => ({ db: () => (strings: TemplateStringsArray, ...vals: unknown[]) => { const v = team[String(vals[0])]; return Promise.resolve(v ? [v] : []); } }));

let A: typeof import('./auth');
beforeAll(async () => { process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret'; A = await import('./auth'); });
const BOOKING = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Signierte Links', () => {
  it('Entscheidungslink aus der Team-Mail funktioniert und ist fälschungssicher', async () => {
    const tok = A.decisionToken('Tom@Example.de', BOOKING);
    const ok = await A.parseDecisionToken(tok);
    expect(ok?.admin.name).toBe('Tom');
    expect(ok?.bookingId).toBe(BOOKING);
    // andere Buchung eingesetzt, Signatur passt nicht mehr
    const [payload, sig] = tok.split('.');
    const forged = Buffer.from(Buffer.from(payload, 'base64url').toString().replace(BOOKING, '00000000-0000-0000-0000-000000000000')).toString('base64url');
    expect(await A.parseDecisionToken(`${forged}.${sig}`)).toBeNull();
    expect(await A.parseDecisionToken('kaputt')).toBeNull();
  });
  it('Lesezugriff darf nicht per Mail entscheiden', async () => {
    expect(await A.parseDecisionToken(A.decisionToken('gast@example.de', BOOKING))).toBeNull();
  });
  it('abgelaufene Links gelten nicht', async () => {
    vi.useFakeTimers(); const tok = A.decisionToken('tom@example.de', BOOKING);
    vi.setSystemTime(Date.now() + 15 * 864e5); expect(await A.parseDecisionToken(tok)).toBeNull(); vi.useRealTimers();
  });
  it('„Meine Buchungen“-Link enthält die Adresse und läuft nach 7 Tagen ab', () => {
    vi.useFakeTimers(); const tok = A.bookerToken(' Eva@Example.org ');
    expect(A.emailFromBookerToken(tok)).toBe('eva@example.org');
    vi.setSystemTime(Date.now() + 8 * 864e5); expect(A.emailFromBookerToken(tok)).toBeNull(); vi.useRealTimers();
  });
  it('Abo-Links zum Weitergeben lassen sich nicht umschreiben', () => {
    const tok = A.shareFeedToken({ k: 'team', v: 'C1-Jugend' });
    expect(A.parseShareFeed(tok)).toEqual({ k: 'team', v: 'C1-Jugend' });
    const [, sig] = tok.split('.');
    const other = Buffer.from(JSON.stringify({ k: 'all' })).toString('base64url');
    expect(A.parseShareFeed(`${other}.${sig}`)).toBeNull();
  });
  it('persönlicher Kalender-Link gehört genau einer Person', async () => {
    const tok = A.feedToken(team['tom@example.de'].id);
    expect(tok.startsWith(team['tom@example.de'].id + '.')).toBe(true);
    expect(A.feedToken(team['gast@example.de'].id).split('.')[1]).not.toBe(tok.split('.')[1]);
  });
});
