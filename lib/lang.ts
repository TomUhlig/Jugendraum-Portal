import 'server-only';
import { cookies, headers } from 'next/headers';
import { type Lang, pickLang } from './i18n';

/** Sprache der aktuellen Anfrage: Cookie „lang“, sonst Browsersprache, sonst Deutsch. */
export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get('lang')?.value, h.get('accept-language'));
}
