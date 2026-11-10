// Bezahlung: IBAN-Prüfung, GiroCode (EPC-QR), PayPal.me-Link, Stripe-Signatur. Ohne Server-Abhängigkeiten, daher testbar.
import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentSettings = {
  holder: string; iban: string; bic: string; paypalMe: string; dueDays: number; note: string;
  transfer: boolean; paypal: boolean; stripe: boolean;
};
export const DEFAULT_PAYMENT: PaymentSettings = { holder: '', iban: '', bic: '', paypalMe: '', dueDays: 7, note: '', transfer: true, paypal: false, stripe: true };

export const normalizeIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase();
export const formatIban = (iban: string) => normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();

/** Prüfziffer nach ISO 13616 (mod 97). */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith('DE') && iban.length !== 22) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Inhalt eines GiroCodes (EPC069-12, Version 002, UTF-8). Banking-Apps füllen damit die Überweisung aus. */
export function epcPayload(o: { holder: string; iban: string; bic?: string; amount: number; text: string }): string {
  return [
    'BCD', '002', '1', 'SCT', (o.bic ?? '').replace(/\s+/g, '').toUpperCase(),
    o.holder.slice(0, 70), normalizeIban(o.iban), `EUR${o.amount.toFixed(2)}`, '', '', o.text.slice(0, 140), '',
  ].join('\n');
}

/** paypal.me-Link mit Betrag, z. B. https://paypal.me/svheepen/50EUR */
export function paypalLink(handle: string, amount: number): string {
  const h = handle.trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, '').replace(/\/.*$/, '');
  return `https://paypal.me/${encodeURIComponent(h)}/${amount.toFixed(2).replace(/\.00$/, '')}EUR`;
}

/** Prüft die Stripe-Signatur eines Webhooks (Header „Stripe-Signature: t=…,v1=…“), Toleranz 5 Minuten. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter((p) => p.length === 2 && p[0] === 't'));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

/** Form-Kodierung für die Stripe-API inkl. verschachtelter Felder (a[b][c]=…). */
export function stripeForm(obj: Record<string, unknown>, prefix = ''): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') out.push(stripeForm(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.filter(Boolean).join('&');
}

/** Zahlungsfrist: dueDays Tage vor dem Termin (frühestens heute). */
export function dueDate(start: number, dueDays: number, now = Date.now()): number {
  return Math.max(now, start - dueDays * 86_400_000);
}
