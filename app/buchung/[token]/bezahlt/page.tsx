import { redirect } from 'next/navigation';
import { getBookingByToken } from '@/lib/data';
import { confirmStripeSession } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Rückkehr von Stripe: Zahlung direkt prüfen (funktioniert auch ohne eingerichteten Webhook). */
export default async function Bezahlt({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) redirect('/');
  let state = 'offen';
  if (sp.session_id) {
    try { state = (await confirmStripeSession(sp.session_id, b.id)) ? 'bezahlt' : 'offen'; } catch (e) { console.error(e); }
  }
  redirect(`/buchung/${token}?zahlung=${state}#bezahlen`);
}
