import { getBookingByToken, getCategories } from '@/lib/data';
import { bookingIcs } from '@/lib/ics';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const b = await getBookingByToken((await params).token);
  if (!b || b.status !== 'confirmed') return new Response('Nicht gefunden', { status: 404 });
  const cat = (await getCategories()).find((c) => c.id === b.categoryId);
  return new Response(bookingIcs(b, cat), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="jugendraum-${b.number}.ics"` },
  });
}
