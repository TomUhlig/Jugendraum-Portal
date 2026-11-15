import 'server-only';
import { t, type Lang } from './i18n';

/** Mindestzeit zwischen Laden des Formulars und Absenden. Menschen brauchen länger, Bots nicht. */
export const MIN_FILL_MS = 4000;

export const turnstileSiteKey = () => process.env.TURNSTILE_SITE_KEY?.trim() || '';
export const turnstileEnabled = () => !!(turnstileSiteKey() && process.env.TURNSTILE_SECRET_KEY?.trim());

/** Prüft Zeitfalle und (falls eingerichtet) Cloudflare Turnstile. Gibt eine Fehlermeldung oder null zurück. */
export async function checkHuman(opts: { elapsed?: number; turnstile?: string; ip: string; captcha?: boolean; lang?: Lang }): Promise<string | null> {
  const A = t(opts.lang).api;
  if (!opts.elapsed || opts.elapsed < MIN_FILL_MS) return A.tooFast;
  if (!turnstileEnabled() || opts.captcha === false) return null;
  if (!opts.turnstile) return A.captcha;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!.trim(), response: opts.turnstile, remoteip: opts.ip }),
    });
    const j = (await res.json()) as { success?: boolean };
    return j.success ? null : A.captchaExpired;
  } catch {
    return null; // Cloudflare nicht erreichbar: Anfrage nicht blockieren, Zeitfalle und E-Mail-Bestätigung greifen weiter
  }
}
