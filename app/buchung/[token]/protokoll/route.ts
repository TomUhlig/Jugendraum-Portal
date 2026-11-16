import { getBookingByToken, getCategories, getExtras, getSignatures } from '@/lib/data';
import { protocolPdf, pdfResponse } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const b = await getBookingByToken((await params).token);
  if (!b) return new Response('Nicht gefunden', { status: 404 });
  const [cats, sigs, x] = await Promise.all([getCategories(), getSignatures(b.id), getExtras()]);
  if (!sigs.length) return new Response('Noch kein Protokoll', { status: 404 });
  const pdf = await protocolPdf(b, cats.find((c) => c.id === b.categoryId), sigs, x.operator);
  return pdfResponse(pdf);
}
