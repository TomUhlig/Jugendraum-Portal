import 'server-only';

/** Mindestzeit zwischen Laden des Formulars und Absenden. Menschen brauchen länger, Bots nicht. */
export const MIN_FILL_MS = 4000;

export const turnstileSiteKey = () => process.env.TURNSTILE_SITE_KEY?.trim() || '';
export const turnstileEnabled = () => !!(turnstileSiteKey() && process.env.TURNSTILE_SECRET_KEY?.trim());

/** Prüft Zeitfalle und (falls eingerichtet) Cloudflare Turnstile. Gibt eine Fehlermeldung oder null zurück. */
export async function checkHuman(opts: { elapsed?: number; turnstile?: string; ip: string; captcha?: boolean }): Promise<string | null> {
  if (!opts.elapsed || opts.elapsed < MIN_FILL_MS) return 'Das ging etwas zu schnell. Bitte versuch es in ein paar Sekunden noch einmal.';
  if (!turnstileEnabled() || opts.captcha === false) return null;
  if (!opts.turnstile) return 'Bitte bestätige kurz, dass du kein Roboter bist.';
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!.trim(), response: opts.turnstile, remoteip: opts.ip }),
    });
    const j = (await res.json()) as { success?: boolean };
    return j.success ? null : 'Die Sicherheitsprüfung ist abgelaufen. Bitte noch einmal bestätigen.';
  } catch {
    return null; // Cloudflare nicht erreichbar: Anfrage nicht blockieren, Zeitfalle und E-Mail-Bestätigung greifen weiter
  }
}
