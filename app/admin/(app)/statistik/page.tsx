import Link from 'next/link';
import { PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getCategories, getStats } from '@/lib/data';
import { eur } from '@/lib/labels';
import { addDays, berlinParts, berlinToUtc, berlinYmd } from '@/lib/time';

export const metadata = { title: 'Statistik' };

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
const mLabel = (k: string, long = false) => new Date(k + '-15T12:00:00Z').toLocaleDateString('de-DE', { month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace('.', '');

/** Säulendiagramm (eine Reihe), Achse und Raster zurückhaltend, nur der Höchstwert direkt beschriftet. */
function MonthChart({ data }: { data: { key: string; n: number; hours: number; prev: number }[] }) {
  const W = 720, H = 230, L = 34, B = 26, T = 18, plotW = W - L - 8, plotH = H - B - T;
  const max = Math.max(4, ...data.map((d) => Math.max(d.n, d.prev)));
  const step = Math.ceil(max / 4); const top = step * 4;
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const slot = plotW / data.length, bw = Math.min(28, slot * 0.56);
  const peak = data.reduce((a, d) => (d.n > a.n ? d : a), data[0]);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bestätigte Buchungen pro Monat">
      <g className="grid">{[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={L} x2={W - 8} y1={y(i * step)} y2={y(i * step)} /><text x={L - 8} y={y(i * step) + 4} textAnchor="end">{i * step}</text></g>)}</g>
      {data.map((d, i) => {
        const cx = L + slot * i + slot / 2, h = y(0) - y(d.n), x0 = cx - bw / 2, r = Math.min(4, h);
        return (
          <g key={d.key} className="col">
            <title>{`${mLabel(d.key, true)}: ${d.n} Buchungen, ${d.hours} Stunden · Vorjahr ${d.prev}`}</title>
            <rect x={L + slot * i} y={T} width={slot} height={plotH} fill="transparent" />
            {d.n > 0 && <path className="bar" d={`M${x0},${y(0)} V${y(d.n) + r} Q${x0},${y(d.n)} ${x0 + r},${y(d.n)} H${x0 + bw - r} Q${x0 + bw},${y(d.n)} ${x0 + bw},${y(d.n) + r} V${y(0)} Z`} />}
            {d.prev > 0 && <line className="prev" x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={y(d.prev)} y2={y(d.prev)} />}
            {d === peak && d.n > 0 && <text className="val" x={cx} y={y(d.n) - 6} textAnchor="middle">{d.n}</text>}
            <text x={cx} y={H - 8} textAnchor="middle">{mLabel(d.key)}</text>
          </g>
        );
      })}
    </svg>
  );
}

const BANDS = [{ l: '8–12', a: 8, b: 12 }, { l: '12–16', a: 12, b: 16 }, { l: '16–18', a: 16, b: 18 }, { l: '18–22', a: 18, b: 22 }, { l: '22–2', a: 22, b: 26 }];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
/** Belegte Stunden je Wochentag und Tageszeit (Berlin). */
function heat(spans: { start: number; end: number }[]) {
  const m = WD.map(() => BANDS.map(() => 0));
  for (const sp of spans) {
    for (let t = Math.floor(sp.start / 9e5) * 9e5; t < sp.end; t += 9e5) { // Viertelstunden
      const p = berlinParts(t); let h = p.hour + p.minute / 60, wd = (p.weekday + 6) % 7;
      if (h < 2) { h += 24; wd = (wd + 6) % 7; }
      const bi = BANDS.findIndex((x) => h >= x.a && h < x.b);
      if (bi >= 0) m[wd][bi] += 0.25;
    }
  }
  return m;
}
function Heatmap({ m }: { m: number[][] }) {
  const max = Math.max(1, ...m.flat());
  const steps = [8, 24, 42, 62, 84];
  const lvl = (v: number) => (v <= 0 ? -1 : Math.min(4, Math.floor((v / max) * 5 - 1e-9)));
  return (
    <div className="heat" role="table" aria-label="Belegte Stunden nach Wochentag und Tageszeit">
      <div role="row" className="heat-row head"><span role="columnheader"><span className="sr-only">Wochentag</span></span>{BANDS.map((b) => <span role="columnheader" key={b.l}>{b.l}</span>)}</div>
      {m.map((row, i) => (
        <div role="row" className="heat-row" key={WD[i]}>
          <span role="rowheader">{WD[i]}</span>
          {row.map((v, j) => { const L = lvl(v); return (
            <span role="cell" key={j} className={`cell${L >= 3 ? ' dark' : ''}`} title={`${WD[i]}, ${BANDS[j].l} Uhr: ${Math.round(v)} Std.`}
              style={{ background: L < 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--brand-ink) ${steps[L]}%, var(--surface))` }}>{v >= 1 ? Math.round(v) : ''}</span>
          ); })}
        </div>
      ))}
      <div className="heat-legend"><span>wenig</span>{steps.map((p) => <i key={p} style={{ background: `color-mix(in srgb, var(--brand-ink) ${p}%, var(--surface))` }} />)}<span>viel</span><span className="muted">· Zahlen = Stunden</span></div>
    </div>
  );
}

function HBars({ rows }: { rows: { label: React.ReactNode; n: number; title: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return <div className="hbars">{rows.map((r, i) => (
    <div className="hbar" key={i} title={r.title}><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
      <div className="track2"><div className="fill" style={{ width: `${(r.n / max) * 100}%` }} /></div><span className="n">{r.n}</span></div>
  ))}</div>;
}

export default async function Statistik({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = berlinYmd(Date.now());
  const year = /^\d{4}$/.test(sp.jahr ?? '') ? +sp.jahr : null;
  let months: string[];
  if (year) months = Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
  else { const [cy, cm] = today.split('-').map(Number); months = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(cy, cm - 12 + i, 1)); return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1); }); }
  const from = berlinToUtc(months[0] + '-01', '00:00');
  const [ly, lm] = months[11].split('-').map(Number);
  const to = berlinToUtc(lm === 12 ? `${ly + 1}-01-01` : monthKey(ly, lm + 1) + '-01', '00:00');
  const yearBack = (ts: number) => { const d = berlinYmd(ts); return berlinToUtc(`${+d.slice(0, 4) - 1}${d.slice(4)}`, '00:00'); };
  const [cats, s, prev] = await Promise.all([getCategories(), getStats(from, to), getStats(yearBack(from), yearBack(to))]);
  const prevBy = new Map(prev.months.map((r) => [r.month as string, r.n as number]));
  const byMonth = new Map(s.months.map((r) => [r.month as string, r]));
  const series = months.map((k) => ({ key: k, n: (byMonth.get(k)?.n as number) ?? 0, hours: (byMonth.get(k)?.hours as number) ?? 0, prev: prevBy.get(`${+k.slice(0, 4) - 1}${k.slice(4)}`) ?? 0 }));
  const prevTotal = prev.totals.n as number;
  const hm = heat(s.spans);
  const catCount = new Map(s.cats.map((r) => [r.category_id as string, r.n as number]));
  const members = (s.types.find((t) => t.booker_type === 'member')?.n as number) ?? 0;
  const externals = (s.types.find((t) => t.booker_type === 'external')?.n as number) ?? 0;
  const total = s.totals.n as number;
  const rejRate = s.rejected.decided ? Math.round(((s.rejected.rejected as number) / (s.rejected.decided as number)) * 100) : 0;
  const thisYear = +today.slice(0, 4);

  return (
    <>
      <PageHead eyebrow={`${mLabel(months[0], true)} bis ${mLabel(months[11], true)}`} title="Statistik">
        <div className="segmented">
          <Link href="/admin/statistik" aria-current={!year ? 'page' : undefined}>Letzte 12 Monate</Link>
          {[thisYear, thisYear - 1].map((y) => <Link key={y} href={`/admin/statistik?jahr=${y}`} aria-current={year === y ? 'page' : undefined}>{y}</Link>)}
        </div>
      </PageHead>
      <div className="kpis">
        <div className="card kpi"><span className="k">Bestätigte Buchungen</span><span className="v">{total}</span><span className="s">{s.totals.hours} Stunden{prevTotal > 0 ? ` · Vorjahr ${prevTotal} (${total >= prevTotal ? '+' : '−'}${Math.abs(Math.round(((total - prevTotal) / prevTotal) * 100))} %)` : ''}</span></div>
        <div className="card kpi"><span className="k">Feiern</span><span className="v">{s.totals.parties}</span><span className="s">an Wochenenden</span></div>
        <div className="card kpi"><span className="k">Ablehnungsquote</span><span className="v">{rejRate} %</span><span className="s">{s.rejected.rejected} von {s.rejected.decided} entschiedenen</span></div>
        <div className="card kpi"><span className="k">Rückmeldungen</span><span className="v">{s.feedback.n ? (s.feedback.avg as number).toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '–'}</span><span className="s">{s.feedback.n ? `Ø von 5 · ${s.feedback.n} ${s.feedback.n === 1 ? 'Bewertung' : 'Bewertungen'}` : 'noch keine'}{(s.totals.rent as number) > 0 ? ` · Entgelte ${eur(s.totals.rent as number)}` : ''}</span></div>
      </div>
      <section className="card">
        <div className="card-head"><div><h2>Buchungen pro Monat</h2><p>bestätigte Termine, Stunden im Tooltip</p></div>
          <div className="chart-legend"><span><i className="sw-bar" />dieser Zeitraum</span><span><i className="sw-prev" />Vorjahr</span></div></div>
        <div className="card-body">
          <MonthChart data={series} />
          <details style={{ marginTop: 12 }}><summary className="small muted" style={{ cursor: 'pointer' }}>Als Tabelle anzeigen</summary>
            <div className="table-wrap" style={{ marginTop: 8 }}><table><thead><tr><th>Monat</th><th>Buchungen</th><th>Stunden</th><th>Vorjahr</th></tr></thead>
              <tbody>{series.map((d) => <tr key={d.key}><td>{mLabel(d.key, true)}</td><td className="num">{d.n}</td><td className="num">{d.hours}</td><td className="num">{d.prev}</td></tr>)}</tbody></table></div></details>
        </div>
      </section>
      <section className="card">
        <div className="card-head"><div><h2>Wann ist der Raum gefragt?</h2><p>Belegte Stunden nach Wochentag und Tageszeit. Hilft bei Sperrzeiten, Reinigung und Heizplan.</p></div></div>
        <div className="card-body">{total === 0 ? <div className="empty">Noch keine Daten.</div> : <Heatmap m={hm} />}</div>
      </section>
      <div className="grid-2b">
        <section className="card">
          <div className="card-head"><h2>Nach Art</h2></div>
          <div className="card-body">{total === 0 ? <div className="empty">Noch keine Daten.</div> :
            <HBars rows={cats.map((c) => ({ label: c.name, n: catCount.get(c.id) ?? 0, title: `${c.name}: ${catCount.get(c.id) ?? 0}` })).sort((a, b) => b.n - a.n)} />}</div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Wer bucht?</h2></div>
          <div className="card-body stack">
            {total === 0 ? <div className="empty">Noch keine Daten.</div> : <>
              <div className="stack-sm">
                <div className="split" role="img" aria-label={`${members} Mitglieder, ${externals} nicht im Verein`}><div style={{ flex: members }} title={`Mitglieder: ${members}`} /><div style={{ flex: externals }} title={`Nicht im Verein: ${externals}`} /></div>
                <div className="between small"><span><b className="num">{members}</b> Mitglieder ({Math.round((members / total) * 100)} %)</span><span><b className="num">{externals}</b> nicht im Verein</span></div>
              </div>
              {s.teams.length > 0 && <><span className="eyebrow">Häufigste Mannschaften und Abteilungen</span><HBars rows={s.teams.map((t) => ({ label: t.team as string, n: t.n as number, title: `${t.team}: ${t.n}` }))} /></>}
            </>}
          </div>
        </section>
      </div>
      <p className="muted small">Zeitraum: {mLabel(months[0], true)} bis {mLabel(months[11], true)} · gezählt werden bestätigte Buchungen nach Beginn. Stand {new Date(addDays(today, 0) + 'T12:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC' })}.</p>
    </>
  );
}
