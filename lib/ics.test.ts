import { describe, expect, it } from 'vitest';
import { icsFold, icsJoin, icsText } from './ics';

describe('iCal', () => {
  it('faltet lange Zeilen auf max. 75 Bytes, auch mit Umlauten', () => {
    const folded = icsFold('DESCRIPTION:' + 'Grüße aus Heepen, Übergabe am Vereinsheim. '.repeat(5));
    for (const l of folded.split('\r\n')) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true);
  });
  it('verträgt leere Zeilen und escaped Sonderzeichen', () => {
    expect(icsFold('')).toBe('');
    expect(icsJoin(['A', 'B'])).toBe('A\r\nB\r\n');
    expect(icsText('a,b;c\nd')).toBe('a\\,b\\;c\\nd');
  });
});
