import { getPhotoData } from '@/lib/data';

/** Foto ausliefern (?g=klein für die Vorschau). IDs ändern sich nie, daher lange cachebar. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const small = new URL(req.url).searchParams.get('g') === 'klein';
  const data = await getPhotoData((await params).id, small ? 'thumb' : 'full');
  if (!data) return new Response('Nicht gefunden', { status: 404 });
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
