import { describe, expect, it } from 'vitest';
import { t } from './i18n';
import { MAIL_TEXT } from './mail-i18n';

/** Alle Schlüssel eines Objekts (verschachtelt) mit Typ, damit fehlende Übersetzungen auffallen. */
function shape(o: unknown, prefix = ''): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`];
  if (o && typeof o === 'object') return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  return [`${prefix}:${typeof o}`];
}

describe('Übersetzungen', () => {
  it('Englisch und Türkisch haben alle Texte der Oberfläche', () => {
    const de = shape(t('de'));
    for (const l of ['en', 'tr', 'uk', 'ar'] as const) expect(shape(t(l)), l).toEqual(de);
  });
  it('alle Mail-Texte gibt es in jeder Sprache', () => {
    const de = shape(MAIL_TEXT.de);
    for (const l of ['en', 'tr', 'uk', 'ar'] as const) expect(shape(MAIL_TEXT[l]), l).toEqual(de);
  });
  it('keine leeren Texte', () => {
    for (const l of ['de', 'en', 'tr', 'uk', 'ar'] as const) {
      const walk = (o: unknown, path: string): void => {
        if (typeof o === 'string') { if (/\.(rules[ABC]|on)$/.test(path)) return; expect(o.trim().length, `${l}:${path}`).toBeGreaterThan(0); }
        else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
      };
      walk({ ...t(l), cats: undefined, oclock: undefined }, l); // „Uhr“ gibt es nur auf Deutsch; Satzbausteine (rulesA–C) dürfen leer sein
    }
  });
});
