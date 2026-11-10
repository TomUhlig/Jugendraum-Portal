import 'server-only';
import type { Booking, Part } from './data';
import { stripeForm } from './payment';
import { appUrl } from './url';

/** Stripe ist aktiv, sobald STRIPE_SECRET_KEY gesetzt ist. STRIPE_API_BASE nur für Tests. */
export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY?.trim();
const base = () => (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');

async function call<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base()}/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: body ? stripeForm(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json?.error?.message ?? 'unbekannter Fehler'}`);
  return json as T;
}

export type CheckoutSession = { id: string; url: string; payment_status: string; status: string; payment_intent: string | null; metadata?: Record<string, string> };

const PART_LABEL: Record<Part, string> = { rent: 'Nutzungsentgelt', deposit: 'Kaution' };

/** Bezahlseite bei Stripe anlegen. Zahlarten (Karte, PayPal, SEPA …) werden im Stripe-Dashboard eingeschaltet. */
export function createCheckout(b: Booking, items: { part: Part; amount: number }[]): Promise<CheckoutSession> {
  const line_items: Record<string, unknown> = {};
  items.forEach((it, i) => {
    line_items[i] = { quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(it.amount * 100), product_data: { name: `${PART_LABEL[it.part]} Jugendraum, ${b.number}` } } };
  });
  return call<CheckoutSession>('POST', '/checkout/sessions', {
    mode: 'payment', locale: 'de', line_items,
    customer_email: b.email.endsWith('@invalid') ? undefined : b.email,
    client_reference_id: b.id,
    metadata: { booking_id: b.id, parts: items.map((i) => i.part).join(',') },
    payment_intent_data: { description: `Jugendraum ${b.number}: ${b.title}`, metadata: { booking_id: b.id } },
    success_url: `${appUrl()}/buchung/${b.manageToken}/bezahlt?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/buchung/${b.manageToken}?abgebrochen=1#bezahlen`,
  });
}
export const getCheckout = (id: string) => call<CheckoutSession>('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
export const refund = (paymentIntent: string, amount: number) => call<{ id: string; status: string }>('POST', '/refunds', { payment_intent: paymentIntent, amount: Math.round(amount * 100) });
