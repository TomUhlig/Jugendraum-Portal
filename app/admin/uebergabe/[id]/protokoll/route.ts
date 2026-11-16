import { requireAdmin } from '@/lib/auth';
import { getBooking, getCategories, getExtras, getSignatures } from '@/lib/data';
import { protocolPdf, pdfResponse } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const b = await getBooking((await params).id);
  if (!b) return new Response('Nicht gefunden', { status: 404 });
  const [cats, sigs, x] = await Promise.all([getCategories(), getSignatures(b.id), getExtras()]);
  const pdf = await protocolPdf(b, cats.find((c) => c.id === b.categoryId), sigs, x.operator);
  return pdfResponse(pdf);
}
