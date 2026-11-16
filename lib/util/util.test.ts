import { describe, expect, it } from 'vitest';
import { esc } from './html';
import { imageType } from './image';
import { lanesFor } from './lanes';
import { telHref, waNumber } from './phone';

describe('Hilfsfunktionen', () => {
  it('maskiert HTML', () => {
    expect(esc(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
  });
  it('erkennt Bildformate', () => {
    expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(imageType(webp)).toBe('image/webp');
    expect(imageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });
  it('WhatsApp nur für deutsche Handynummern', () => {
    expect(waNumber('0171 2345678')).toBe('491712345678');
    expect(waNumber('+49 (160) 123 4567')).toBe('491601234567');
    expect(waNumber('0049 152 12345678')).toBe('4915212345678');
    expect(waNumber('0521 123456')).toBeNull(); // Festnetz Bielefeld
    expect(waNumber('+43 664 1234567')).toBeNull();
    expect(telHref('0521 / 12 34-5')).toBe('tel:052112345');
  });
  it('legt überlappende Termine nebeneinander', () => {
    const m = lanesFor([
      { id: 'a', start: 14, end: 22 }, { id: 'b', start: 18, end: 25 }, // überlappen
      { id: 'c', start: 9, end: 12 }, // allein
      { id: 'd', start: 22, end: 23 }, // überlappt nur b
    ]);
    expect(m.get('c')).toEqual({ lane: 0, lanes: 1 });
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(m.get('d')).toEqual({ lane: 0, lanes: 2 }); // nutzt die frei gewordene Spalte von a
  });
});
