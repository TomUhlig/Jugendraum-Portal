import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { currentAdmin } from '@/lib/auth';
import { addPhoto } from '@/lib/data';

const MAX_BYTES = 1_500_000;
const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isWebp = (b: Buffer) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
const isImage = (b: Buffer) => isJpeg(b) || isWebp(b);

/** Upload eines (im Browser bereits verkleinerten) Fotos: Großbild + Vorschau als WebP oder JPEG. */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin || admin.role === 'viewer') return NextResponse.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  const fd = await req.formData();
  const full = fd.get('full'), thumb = fd.get('thumb');
  if (!(full instanceof Blob) || !(thumb instanceof Blob)) return NextResponse.json({ error: 'Bild fehlt.' }, { status: 400 });
  const fb = Buffer.from(await full.arrayBuffer()), tb = Buffer.from(await thumb.arrayBuffer());
  if (!isImage(fb) || !isImage(tb) || fb.length > MAX_BYTES || tb.length > MAX_BYTES / 3) return NextResponse.json({ error: 'Das Bild ist zu groß oder kein gültiges Foto.' }, { status: 400 });
  const w = Math.round(Number(fd.get('width'))), h = Math.round(Number(fd.get('height')));
  try {
    await addPhoto(admin.name, fb, tb, w > 0 ? w : 1600, h > 0 ? h : 1200, String(fd.get('caption') ?? '').slice(0, 140));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  revalidatePath('/'); revalidatePath('/raum');
  return NextResponse.json({ ok: true }, { status: 201 });
}
