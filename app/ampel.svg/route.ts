import { getAllBlocks, getRooms, listBookings } from '@/lib/data';
import { addDays, berlinHm, berlinToUtc, berlinYmd } from '@/lib/time';
import { esc } from '@/lib/util/html';

export const dynamic = 'force-dynamic';

/**
 * Belegungsampel als Bild zum Einbinden: <img src="https://…/ampel.svg">.
 * Grün = heute frei, Gelb = heute später belegt, Rot = jetzt belegt / gesperrt. ?raum=<id>, ?theme=dark
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const rooms = await getRooms();
  const room = rooms.find((r) => r.id === u.searchParams.get('raum')) ?? rooms[0];
  const now = Date.now(), today = berlinYmd(now);
  const from = berlinToUtc(today, '00:00'), to = berlinToUtc(addDays(today, 1), '04:00');
  const [list, blocks] = await Promise.all([listBookings({ from, to, status: ['confirmed'], roomId: room.id }), getAllBlocks(undefined, from, to, room.id)]);
  const cur = list.find((b) => b.start <= now && b.end > now), blk = blocks.find((b) => b.scope !== 'party' && b.start <= now && b.end > now);
  const later = list.filter((b) => b.start > now && b.start < berlinToUtc(addDays(today, 1), '00:00'));
  let color = '#1BAF7A', text = 'heute frei';
  if (cur) { color = '#E5484D'; text = `jetzt belegt bis ${berlinHm(cur.end)} Uhr`; }
  else if (blk) { color = '#E5484D'; text = 'heute gesperrt'; }
  else if (later.length) { color = '#EDA100'; text = `frei bis ${berlinHm(later[0].start)} Uhr`; }
  const dark = u.searchParams.get('theme') === 'dark';
  const name = rooms.length > 1 ? room.name : 'Jugendraum';
  const w = 14 + 22 + 8 + Math.ceil((name.length + text.length) * 7.2) + 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="36" viewBox="0 0 ${w} 36" role="img" aria-label="${esc(name)}: ${esc(text)}">
<rect width="${w}" height="36" rx="18" fill="${dark ? '#1C2040' : '#FFFFFF'}" stroke="${dark ? '#2A2F4D' : '#E1E4EC'}"/>
<circle cx="22" cy="18" r="7" fill="${color}"/><circle cx="22" cy="18" r="11" fill="${color}" opacity=".2"/>
<text x="40" y="23" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="13" fill="${dark ? '#EEF0F8' : '#161A33'}"><tspan font-weight="700">${esc(name)}</tspan> ${esc(text)}</text>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
}
