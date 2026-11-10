import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/payment';
import { confirmStripeSession } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Stripe meldet abgeschlossene Zahlungen (auch verzögerte wie SEPA-Lastschrift). */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET ?? '')) {
    return new NextResponse('Ungültige Signatur', { status: 400 });
  }
  const event = JSON.parse(raw) as { type: string; data: { object: { id: string; payment_status?: string; client_reference_id?: string } } };
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const s = event.data.object;
    if (s.payment_status === 'paid') await confirmStripeSession(s.id, s.client_reference_id ?? null);
  }
  return NextResponse.json({ received: true });
}
