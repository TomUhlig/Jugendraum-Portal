import { esc } from '@/lib/util/html';
import QRCode from 'qrcode';
import { getAllBlocks, getCategories, getSettings, listBookings } from '@/lib/data';
import { appUrl } from '@/lib/url';
import { addDays, berlinHm, berlinParts, berlinToUtc, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';

const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Tür-Display für ein Tablet am Raum (Vollbild, aktualisiert sich jede Minute, hält den Bildschirm wach).
 * Ohne Namen: angezeigt werden Mannschaft/Abteilung oder die Art des Termins.
 */
export async function GET() {
  const now = Date.now(), today = berlinYmd(now);
  const from = berlinToUtc(today, '00:00'), to = berlinToUtc(addDays(today, 7), '06:00');
  const [list, cats, blocks, s] = await Promise.all([listBookings({ from: from - 12 * 3600e3, to, status: ['confirmed'] }), getCategories(), getAllBlocks(undefined, from, to), getSettings()]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const label = (b: (typeof list)[number]) => (b.bookerType === 'member' && b.team ? b.team : cat.get(b.categoryId)?.name ?? 'Belegt');
  const current = list.find((b) => b.start <= now && b.end > now);
  const block = blocks.find((b) => b.scope === 'all' && b.start <= now && b.end > now);
  const next = list.find((b) => b.start > now);
  const todays = list.filter((b) => b.end > from && b.start < berlinToUtc(addDays(today, 1), '06:00') && b.end > now - 3600e3);
  const qr = await QRCode.toString(appUrl() + '/', { type: 'svg', margin: 0, color: { dark: '#ffffffff', light: '#00000000' } });

  let state: 'free' | 'busy' | 'blocked' = 'free', head = 'Jetzt frei', sub = next ? `Nächster Termin ${berlinYmd(next.start) === today ? 'heute' : WD[berlinParts(next.start).weekday]} um ${berlinHm(next.start)} Uhr` : 'Heute keine weiteren Termine';
  if (current) { state = 'busy'; head = `Belegt bis ${berlinHm(current.end)} Uhr`; sub = esc(label(current)); }
  else if (block) { state = 'blocked'; head = 'Heute gesperrt'; sub = esc(block.reason || 'Der Raum ist nicht verfügbar'); }

  const days: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = addDays(today, i), ds = berlinToUtc(d, '00:00'), de = berlinToUtc(addDays(d, 1), '00:00');
    const items = list.filter((b) => b.start >= ds && b.start < de);
    const bl = blocks.some((b) => b.scope === 'all' && b.start <= ds && b.end >= de);
    const p = berlinParts(ds);
    days.push(`<li><span class="dd"><b>${p.day}.</b>${WDS[p.weekday]}</span><span class="di">${bl ? '<em>gesperrt</em>' : items.length ? items.map((b) => `<span><b>${berlinHm(b.start)}</b> ${esc(label(b))}</span>`).join('') : '<em class="f">frei</em>'}</span></li>`);
  }
  const p = berlinParts(now);
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60"><meta name="robots" content="noindex">
<title>Jugendraum · Anzeige</title><link rel="icon" href="/logo.png">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:#12152B;color:#EEF0F8;font:16px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;grid-template-rows:auto 1fr;overflow:hidden}
header{display:flex;align-items:center;gap:16px;padding:2.2vh 3vw;border-top:6px solid #FFD800}
header img{width:6vh;height:6vh}header .t{font-weight:800;font-size:3vh;line-height:1.1}header .t small{display:block;font-weight:500;font-size:1.9vh;color:#A3A8C3}
#clock{margin-left:auto;text-align:right;font-variant-numeric:tabular-nums}#clock b{display:block;font-size:6vh;line-height:1;font-weight:800;letter-spacing:-.02em}#clock span{font-size:2vh;color:#A3A8C3}
main{display:grid;grid-template-columns:1.25fr 1fr;gap:2.5vw;padding:0 3vw 3vh;min-height:0}
.status{border-radius:3vh;padding:5vh 4vw;display:flex;flex-direction:column;justify-content:center;gap:2vh;position:relative;overflow:hidden}
.status.free{background:linear-gradient(135deg,#127A52,#0d5c3e)}.status.busy{background:linear-gradient(135deg,#2E367A,#1d2252)}.status.blocked{background:repeating-linear-gradient(135deg,#5b2330 0 22px,#4a1c27 22px 44px)}
.status .k{text-transform:uppercase;letter-spacing:.14em;font-weight:700;font-size:2vh;opacity:.8}
.status h1{margin:0;font-size:8vh;line-height:1.02;letter-spacing:-.02em}.status p{margin:0;font-size:3.4vh;opacity:.92}
.status .dot{width:2.2vh;height:2.2vh;border-radius:50%;background:#FFD800;display:inline-block;margin-right:1.2vh;box-shadow:0 0 0 0 rgba(255,216,0,.6);animation:p 2s infinite}
@keyframes p{70%{box-shadow:0 0 0 2vh rgba(255,216,0,0)}100%{box-shadow:0 0 0 0 rgba(255,216,0,0)}}
.side{display:grid;grid-template-rows:auto 1fr auto;gap:2vh;min-height:0}
.card{background:#1C2040;border-radius:2.4vh;padding:2.4vh 2vw}.card h2{margin:0 0 1.4vh;font-size:2.2vh;text-transform:uppercase;letter-spacing:.1em;color:#A3A8C3}
.today li,.week li{list-style:none}.today ul,.week ul{margin:0;padding:0;display:grid;gap:1vh}
.today li{display:flex;gap:1.4vw;font-size:2.8vh;align-items:baseline}.today li b{font-variant-numeric:tabular-nums;min-width:11ch}.today li.now{color:#FFD800}.today li.done{opacity:.45}
.week li{display:grid;grid-template-columns:8ch 1fr;gap:1vw;font-size:2.2vh;padding:.6vh 0;border-top:1px solid #2A2F4D}.week li:first-child{border-top:0}
.dd b{font-size:2.6vh;margin-right:.6ch}.dd{color:#A3A8C3}.di{display:flex;flex-wrap:wrap;gap:.4vh 1.4vw}.di em{font-style:normal;color:#F7A585}.di em.f{color:#5FD3A2}
.qr{display:flex;align-items:center;gap:2vw}.qr svg{width:13vh;height:13vh;flex:none}.qr b{font-size:2.6vh;display:block}.qr span{font-size:2vh;color:#A3A8C3}
.empty{font-size:2.4vh;color:#A3A8C3}
.week{overflow:hidden;min-height:0}
@media (orientation:portrait){main{grid-template-columns:1fr;grid-template-rows:auto 1fr}.status{padding:3.5vh 6vw;gap:1.2vh}.status h1{font-size:5.6vh}.status p{font-size:2.4vh}.today li{font-size:2.2vh}.week li{font-size:1.8vh}.dd b{font-size:2vh}.qr svg{width:10vh;height:10vh}header #clock b{font-size:4.6vh}}
</style></head><body>
<header><img src="/logo.png" alt=""><div class="t">Jugendraum<small>SV Heepen</small></div><div id="clock"><b>${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}</b><span>${WD[p.weekday]}, ${p.day}.${p.month}.${p.year}</span></div></header>
<main>
  <section class="status ${state}"><span class="k">${state === 'free' ? '<span class="dot"></span>Verfügbar' : state === 'busy' ? 'Gerade im Raum' : 'Nicht verfügbar'}</span><h1>${head}</h1><p>${sub}</p></section>
  <div class="side">
    <section class="card today"><h2>Heute</h2>${todays.length ? `<ul>${todays.map((b) => `<li class="${b.start <= now && b.end > now ? 'now' : b.end <= now ? 'done' : ''}"><b>${berlinHm(b.start)}–${berlinHm(b.end)}</b>${esc(label(b))}</li>`).join('')}</ul>` : '<div class="empty">Heute keine Termine</div>'}</section>
    <section class="card week"><h2>Die nächsten Tage</h2><ul>${days.join('')}</ul></section>
    <section class="card qr">${qr}<div><b>Raum anfragen</b><span>${esc(appUrl().replace(/^https?:\/\//, ''))} · bis ${s.capacity} Personen</span></div></section>
  </div>
</main>
<script>
(function(){var W=${JSON.stringify(WD)};function t(){var d=new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Berlin'}));var c=document.querySelector('#clock b');if(c)c.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}setInterval(t,5000);
try{if('wakeLock' in navigator){var l=function(){navigator.wakeLock.request('screen').catch(function(){})};l();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')l()})}}catch(e){}
document.addEventListener('click',function(){if(document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(function(){})});})();
</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
