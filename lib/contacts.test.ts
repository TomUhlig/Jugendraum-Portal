import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTACTS, fillWho, normalizeContacts, whoText } from './contacts';

describe('Ansprechpartner', () => {
  it('verbindet Namen sprachabhängig', () => {
    expect(whoText(['A'])).toBe('A');
    expect(whoText(['A', 'B'])).toBe('A oder B');
    expect(whoText(['A', 'B', 'C'], 'en')).toBe('A, B or C');
    expect(fillWho('mit {wer} abgesprochen', ['X', 'Y'])).toBe('mit X oder Y abgesprochen');
  });
  it('fällt bei leerer oder kaputter Liste auf die Standardbesetzung zurück', () => {
    expect(normalizeContacts(null)).toBe(DEFAULT_CONTACTS);
    expect(normalizeContacts([{ name: ' ' }])).toBe(DEFAULT_CONTACTS);
    const [c] = normalizeContacts([{ name: 'Eva Muster', phone: '0521 1', photo: 'javascript:alert(1)', showPhone: 1 }]);
    expect(c).toMatchObject({ name: 'Eva Muster', phone: '0521 1', photo: '', showPhone: true });
  });
});
