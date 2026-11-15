import { describe, expect, it } from 'vitest';
import { findBookingNumber, plusAddress, stripReply } from './inbox-parse';

describe('Antworten per Mail', () => {
  it('findet die Buchungsnummer in Plus-Adresse oder Betreff', () => {
    expect(findBookingNumber(['jugendraum+JR-2026-0228@gmail.com'], 'Re: Bestätigt')).toBe('JR-2026-0228');
    expect(findBookingNumber(['jugendraum@gmx.de'], 'AW: Neue Nachricht zu JR-2026-0031')).toBe('JR-2026-0031');
    expect(findBookingNumber(['jugendraum@gmx.de'], 'Hallo')).toBeNull();
  });
  it('Plus-Adresse nur bei Gmail & Co.', () => {
    expect(plusAddress('Jugendraum.SVH@gmail.com', 'JR-2026-0001')).toBe('jugendraum.svh+JR-2026-0001@gmail.com');
    expect(plusAddress('jugendraum@gmx.de', 'JR-2026-0001')).toBeNull();
  });
  it('entfernt Zitat und Signatur', () => {
    const t = 'Super, danke!\nWir kommen um 18 Uhr.\n\nVon meinem iPhone gesendet\n\nAm 14.11.2026 um 10:00 schrieb Jugendraum SV Heepen <x@gmail.com>:\n> Hallo Eva,\n> alt';
    expect(stripReply(t)).toBe('Super, danke!\nWir kommen um 18 Uhr.');
    expect(stripReply('Passt.\n--\nEva Muster\nTel 123')).toBe('Passt.');
    expect(stripReply('Okay\n\nOn Sat, Nov 14, 2026 at 10:00 AM Jugendraum <x@gmail.com>\nwrote:\n> hi')).toBe('Okay');
    expect(stripReply('Ja gerne\n\n-----Ursprüngliche Nachricht-----\nVon: x')).toBe('Ja gerne');
  });
});
