// Ansprechpartner für die Vorab-Absprache. Werden in den Einstellungen gepflegt, nicht im Code.
import type { Lang } from './i18n';

export type Contact = { name: string; role: string; phone: string; email: string; photo: string; showPhone: boolean };

export const DEFAULT_CONTACTS: Contact[] = [
  { name: 'Michael Grieswelle', role: 'Vorab-Absprache und Schlüssel', phone: '', email: '', photo: '', showPhone: false },
  { name: 'Sigrid Brodig', role: 'Vorab-Absprache und Schlüssel', phone: '', email: '', photo: '', showPhone: false },
];

const OR: Record<Lang, string> = { de: 'oder', en: 'or', tr: 'veya', uk: 'або', ar: 'أو' };

/** „Michael Grieswelle oder Sigrid Brodig“, bei mehr Personen „A, B oder C“. */
export function whoText(names: string[], lang: Lang = 'de'): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${OR[lang] ?? OR.de} ${names[names.length - 1]}`;
}
/** Ersetzt den Platzhalter {wer} in Texten durch die aktuellen Ansprechpartner. */
export const fillWho = (s: string, names: string[], lang: Lang = 'de') => s.replace(/\{wer\}/g, whoText(names, lang));

export const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

/** Bereinigt gespeicherte Einträge; leere Liste fällt auf die Standardbesetzung zurück. */
export function normalizeContacts(v: unknown): Contact[] {
  if (!Array.isArray(v)) return DEFAULT_CONTACTS;
  const s = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  const list = v.map((c: Record<string, unknown>) => ({
    name: s(c?.name, 80), role: s(c?.role, 80), phone: s(c?.phone, 40), email: s(c?.email, 120),
    photo: typeof c?.photo === 'string' && /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(c.photo) && c.photo.length < 60_000 ? c.photo : '',
    showPhone: !!c?.showPhone,
  })).filter((c) => c.name.length >= 2).slice(0, 8);
  return list.length ? list : DEFAULT_CONTACTS;
}
