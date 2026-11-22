import { esc } from '@/lib/util/html';
import { getPublicOccupancy, getRooms } from '@/lib/data';
import { appUrl } from '@/lib/url';
import { addDays, berlinParts, berlinToUtc, berlinYmd } from '@/lib/time';
import { LOCALE, isLang, t, type Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const TX = {
  de: { title: 'Belegung Jugendraum', free: 'Abend frei', busy: 'Abend belegt', part: 'teilweise belegt', cta: 'Jetzt anfragen', legend: ['bestätigt', 'angefragt', 'gesperrt'], blocked: 'gesperrt' },
  en: { title: 'Youth room availability', free: 'evening free', busy: 'evening booked', part: 'partly booked', cta: 'Request now', legend: ['confirmed', 'requested', 'blocked'], blocked: 'blocked' },
  tr: { title: 'Gençlik salonu doluluk', free: 'akşam boş', busy: 'akşam dolu', part: 'kısmen dolu', cta: 'Hemen talep et', legend: ['onaylandı', 'talep edildi', 'kapalı'], blocked: 'kapalı' },
};

/** Belegungs-Widget zum Einbinden per <iframe> auf der Vereinsseite. Parameter: tage (7–28), theme (light|dark), lang. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const days = Math.min(28, Math.max(7, Number(u.searchParams.get('tage')) || 14));
  const dark = u.searchParams.get('theme') === 'dark';
  const l = u.searchParams.get('lang');
  const lang: Lang = isLang(l) ? l : 'de';
  const T = TX[lang as keyof typeof TX] ?? TX.en, D = t(lang);
  const today = berlinYmd(Date.now());
  const from = berlinToUtc(today, '00:00'), to = berlinToUtc(addDays(today, days), '00:00');
  const rooms = await getRooms();
  const room = rooms.find((r) => r.id === u.searchParams.get('raum')) ?? rooms[0];
  const occ = await getPublicOccupancy(from, to, room.id);
  const base = appUrl();
  const W0 = 8, W1 = 24; // sichtbarer Bereich 8–24 Uhr
  const LOC = LOCALE[lang];
  const wd = new Intl.DateTimeFormat(LOC, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
  const rows: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const s = berlinToUtc(date, `${String(W0).padStart(2, '0')}:00`), e = berlinToUtc(addDays(date, 1), '00:00');
    const pct = (ts: number) => Math.max(0, Math.min(100, ((ts - s) / (e - s)) * 100));
    const segs: string[] = [];
    for (const b of occ.slots) if (b.end > s && b.start < e) segs.push(`<i class="${b.status === 'confirmed' ? 'c' : 'r'}" style="left:${pct(b.start).toFixed(2)}%;width:${(pct(b.end) - pct(b.start)).toFixed(2)}%"></i>`);
    for (const b of occ.blackouts) if (b.end > s && b.start < e) segs.push(`<i class="x" title="${esc(b.reason || T.blocked)}" style="left:${pct(b.start).toFixed(2)}%;width:${(pct(b.end) - pct(b.start)).toFixed(2)}%"></i>`);
    const ev0 = berlinToUtc(date, '18:00'), ev1 = berlinToUtc(date, '22:00');
    const evBusy = [...occ.slots, ...occ.blackouts].some((b) => b.end > ev0 && b.start < ev1);
    const anyBusy = segs.length > 0;
    const we = [0, 6].includes(berlinParts(s).weekday);
    rows.push(`<li class="${we ? 'we' : ''}"><span class="d">${esc(wd.format(s).replace(/\.(?=,|\s|$)/g, ''))}</span><span class="bar">${segs.join('')}</span>` +
      `<a class="st ${evBusy ? 'busy' : 'free'}" href="${base}/?raum=${room.id}&amp;datum=${date}&amp;von=18:00&amp;bis=22:00#anfrage" target="_blank" rel="noopener">${evBusy ? T.busy : anyBusy ? T.free : T.free}</a></li>`);
  }
  const ticks = [8, 12, 16, 20, 24].map((h) => `<span style="left:${(((h - W0) / (W1 - W0)) * 100).toFixed(2)}%">${h}</span>`).join('');
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${T.title}</title><meta name="robots" content="noindex">
<style>
:root{--bg:#fff;--ink:#161A33;--muted:#646A85;--line:#E1E4EC;--track:#F1F2F7;--c:#2E367A;--r:#EDA100;--free:#127A52;--free-bg:#E3F4EC;--busy:#9A3412;--busy-bg:#FCEBE3;--y:#FFD800}
${dark ? ':root{--bg:#12152B;--ink:#EEF0F8;--muted:#A3A8C3;--line:#2A2F4D;--track:#1C2040;--c:#8E97E8;--free:#5FD3A2;--free-bg:#123328;--busy:#F7A585;--busy-bg:#3A2018}' : ''}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
.w{padding:14px 16px;border-top:4px solid var(--y)}
h1{font-size:15px;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
h1 a{font-size:13px;font-weight:600;background:var(--y);color:#1b1f4b;text-decoration:none;padding:6px 12px;border-radius:7px;white-space:nowrap}
ul{list-style:none;margin:0;padding:0}
li{display:grid;grid-template-columns:96px 1fr 118px;gap:10px;align-items:center;padding:5px 0;border-top:1px solid var(--line)}
li.we .d{font-weight:700}
.d{font-size:13px;white-space:nowrap}
.bar{position:relative;height:14px;background:var(--track);border-radius:4px;overflow:hidden}
.bar i{position:absolute;top:0;bottom:0}.bar i.c{background:var(--c)}.bar i.r{background:var(--r)}
.bar i.x{background:repeating-linear-gradient(135deg,var(--muted) 0 3px,transparent 3px 6px);opacity:.6}
.st{font-size:12px;font-weight:600;text-align:center;border-radius:6px;padding:3px 6px;text-decoration:none;white-space:nowrap}
.st.free{background:var(--free-bg);color:var(--free)}.st.busy{background:var(--busy-bg);color:var(--busy)}
.st.free:hover{outline:2px solid var(--free)}
.ticks{position:relative;height:14px;margin-left:106px;margin-right:128px;font-size:10px;color:var(--muted)}
.ticks span{position:absolute;transform:translateX(-50%)}
.lg{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--muted)}
.lg b{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
@media(max-width:420px){li{grid-template-columns:78px 1fr 92px;gap:8px}.ticks{margin-left:86px;margin-right:100px}.d{font-size:12px}}
</style></head><body><div class="w">
<h1><span>${T.title}${rooms.length > 1 ? ` · ${esc(room.name)}` : ''}</span><a href="${base}/?raum=${room.id}" target="_blank" rel="noopener">${T.cta} →</a></h1>
<div class="ticks">${ticks}</div>
<ul>${rows.join('')}</ul>
<div class="lg"><span><b style="background:var(--c)"></b>${T.legend[0]}</span><span><b style="background:var(--r)"></b>${T.legend[1]}</span><span><b style="background:repeating-linear-gradient(135deg,var(--muted) 0 2px,transparent 2px 4px)"></b>${T.legend[2]}</span><span>${esc(D.intro.capacity(occ.settings.capacity))}</span></div>
</div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120, s-maxage=120' } });
}
