import { NextResponse } from 'next/server';
import { getPublicOccupancy, getRooms } from '@/lib/data';
import { DAY } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** Anonyme Belegung für den öffentlichen Kalender. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = Number(u.searchParams.get('from')), to = Number(u.searchParams.get('to'));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 120 * DAY) {
    return NextResponse.json({ error: 'Ungültiger Zeitraum.' }, { status: 400 });
  }
  const room = u.searchParams.get('raum');
  const rooms = await getRooms();
  return NextResponse.json(await getPublicOccupancy(from, to, rooms.find((r) => r.id === room)?.id ?? rooms[0].id));
}
