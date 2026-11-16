import { getBookingByToken, getCategories, getExtras, getSettings } from '@/lib/data';
import { hausordnungPdf, pdfResponse } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const b = await getBookingByToken((await params).token);
  if (!b) return new Response('Nicht gefunden', { status: 404 });
  const [cats, s, x] = await Promise.all([getCategories(), getSettings(), getExtras()]);
  const pdf = await hausordnungPdf(b, cats.find((c) => c.id === b.categoryId), s.capacity, x.operator);
  return pdfResponse(pdf);
}
