import QRCode from 'qrcode';
import { amountsDue, getBookingByToken, getExtras } from '@/lib/data';
import { epcPayload, isValidIban } from '@/lib/payment';

export const dynamic = 'force-dynamic';

/** GiroCode (EPC-QR) für die Überweisung des offenen Betrags. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const b = await getBookingByToken((await params).token);
  const { payment: pay } = await getExtras();
  const due = b ? amountsDue(b) : null;
  if (!b || b.status !== 'confirmed' || !due || due.total <= 0 || !isValidIban(pay.iban) || !pay.holder) return new Response('Nicht verfügbar', { status: 404 });
  const svg = await QRCode.toString(epcPayload({ holder: pay.holder, iban: pay.iban, bic: pay.bic, amount: due.total, text: `${b.number} ${b.name}` }),
    { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' } });
}
