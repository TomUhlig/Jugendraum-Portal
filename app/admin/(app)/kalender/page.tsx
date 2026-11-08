import { ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getAllBlocks, getCategories, listBookings } from '@/lib/data';
import { blackoutWhen } from '@/lib/rules';
import { MIN, addDays, berlinHm, berlinToUtc, berlinYmd, weekdayOf } from '@/lib/time';

const ACTIVE = ['pending_email', 'requested', 'confirmed'] as const;
const monday = (d: string) => addDays(d, -((weekdayOf(d) + 6) % 7));
const dLabel = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('de-DE', { ...o, timeZone: 'UTC' });

export default async function Kalender({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = berlinYmd(Date.now());
  const week = sp.ansicht === 'woche';
  const all = sp.alle === '1';
  const cats = await getCategories();
  const cat = new Map(cats.map((c) => [c.id, c]));
  const keep = (extra: Record<string, string>) => '?' + new URLSearchParams({ ...(week ? { ansicht: 'woche' } : {}), ...(all ? { alle: '1' } : {}), ...extra }).toString();

  if (week) {
    const w = monday(/^\d{4}-\d\d-\d\d$/.test(sp.w ?? '') ? sp.w : today);
    const days = Array.from({ length: 7 }, (_, i) => addDays(w, i));
    const from = berlinToUtc(w, '00:00'), to = berlinToUtc(addDays(w, 8), '06:00');
    const [list, blackouts] = await Promise.all([listBookings({ from, to, status: all ? undefined : [...ACTIVE] }), getAllBlocks(undefined, from, to)]);
    const H0 = 8, SPAN = 18; // 08:00 bis 02:00
    const pos = (d: string, a: number, b: number) => {
      const w0 = berlinToUtc(d, '08:00'), w1 = w0 + SPAN * 3600e3;
      const s = Math.max(a, w0), e = Math.min(b, w1);
      return e <= s ? null : { top: ((s - w0) / (w1 - w0)) * 100, height: ((e - s) / (w1 - w0)) * 100 };
    };
    return (
      <>
        <PageHead title="Kalender">
          <div className="segmented"><Link href={`?m=${w.slice(0, 7)}${all ? '&alle=1' : ''}`}>Monat</Link><Link href="#" aria-current="page">Woche</Link></div>
          <Link className="btn" href="/admin/sperrzeiten#neu"><Lock className="icon-sm" />Sperren</Link><Link className="btn btn-primary" href="/admin/neu"><Plus className="icon-sm" />Termin</Link>
        </PageHead>
        <section className="card">
          <div className="card-head">
            <div className="inline"><Link className="iconbtn" href={keep({ w: addDays(w, -7) })} aria-label="Vorherige Woche"><ChevronLeft className="icon" /></Link>
              <Link className="iconbtn" href={keep({ w: addDays(w, 7) })} aria-label="Nächste Woche"><ChevronRight className="icon" /></Link>
              <h2>{dLabel(w, { day: 'numeric', month: 'long' })} – {dLabel(addDays(w, 6), { day: 'numeric', month: 'long', year: 'numeric' })}</h2></div>
            <div className="inline"><Link className="btn btn-sm" href={`/admin/sperrzeiten?von=${w < today ? today : w}&bis=${addDays(w, 6)}#neu`}><Lock className="icon-sm" />Woche sperren</Link><Link className="btn btn-sm" href={keep({ w: monday(today) })}>Heute</Link><Link className="small" href={`?ansicht=woche&w=${w}${all ? '' : '&alle=1'}`}>{all ? 'Nur aktive' : 'Auch stornierte'}</Link></div>
          </div>
          <div className="table-wrap">
            <div className="wgrid">
              <div />
              {days.map((d) => <div key={d} className={`wh ${d === today ? 'today' : ''}`}>{dLabel(d, { weekday: 'short' })} {+d.slice(8)}.</div>)}
              <div className="hours" style={{ height: SPAN * 42 }}>{Array.from({ length: SPAN }, (_, i) => <span key={i} style={{ top: `${(i / SPAN) * 100}%` }}>{i ? String((H0 + i) % 24).padStart(2, '0') + ':00' : ''}</span>)}</div>
              {days.map((d) => (
                <div key={d} className="wcol" style={{ height: SPAN * 42 }}>
                  {blackouts.map((x) => { const p = pos(d, x.start, x.end); return p && <Link href="/admin/sperrzeiten" key={x.id} className="wev sys" style={{ '--c': 'var(--bad)', top: `${p.top}%`, height: `${p.height}%`, background: 'var(--bad-bg)' } as React.CSSProperties}><b>{x.scope === 'party' ? 'Keine Feiern' : 'Gesperrt'}</b>{x.reason}</Link>; })}
                  {list.map((b) => {
                    const c = cat.get(b.categoryId); const p = pos(d, b.start, b.end); if (!p || !c) return null;
                    const pb = pos(d, b.start - c.bufferBefore * MIN, b.start), pa = pos(d, b.end, b.end + c.bufferAfter * MIN);
                    const st = { '--c': c.color } as React.CSSProperties;
                    return (
                      <span key={b.id}>
                        {pb && <div className="wbuf" style={{ ...st, top: `${pb.top}%`, height: `${pb.height}%` }} />}
                        {pa && <div className="wbuf" style={{ ...st, top: `${pa.top}%`, height: `${pa.height}%` }} />}
                        <Link href={`/admin/buchung/${b.id}`} className={`wev ${b.status}`} style={{ ...st, top: `${p.top}%`, height: `${p.height}%` }} title={`${b.title} · ${b.name}`}>
                          <b>{b.title}</b><span className="num">{berlinHm(b.start)}–{berlinHm(b.end)}</span>
                        </Link>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="card-foot legend" style={{ marginTop: 0 }}>{cats.map((c) => <span key={c.id}><i style={{ '--c': c.color } as React.CSSProperties} />{c.name}</span>)}<span>schraffiert: Auf- und Abbau</span><span>gestrichelt: angefragt</span></div>
        </section>
      </>
    );
  }

  const m = (/^\d{4}-\d\d$/.test(sp.m ?? '') ? sp.m : today.slice(0, 7)) + '-01';
  const [y, mo] = m.split('-').map(Number);
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const first = monday(m);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) { const k = addDays(first, i); if (i >= 35 && k.slice(0, 7) !== m.slice(0, 7)) break; cells.push(k); }
  const from = berlinToUtc(cells[0], '00:00'), to = berlinToUtc(addDays(cells[cells.length - 1], 1), '00:00');
  const [list, blackouts] = await Promise.all([listBookings({ from, to, status: all ? undefined : [...ACTIVE] }), getAllBlocks(undefined, from, to)]);
  return (
    <>
      <PageHead title="Kalender">
        <div className="segmented"><Link href="#" aria-current="page">Monat</Link><Link href={`?ansicht=woche&w=${monday(m.slice(0, 7) === today.slice(0, 7) ? today : m)}${all ? '&alle=1' : ''}`}>Woche</Link></div>
        <Link className="btn" href="/admin/sperrzeiten#neu"><Lock className="icon-sm" />Sperren</Link><Link className="btn btn-primary" href="/admin/neu"><Plus className="icon-sm" />Termin</Link>
      </PageHead>
      <section className="card">
        <div className="card-head">
          <div className="inline"><Link className="iconbtn" href={keep({ m: shift(-1) })} aria-label="Vorheriger Monat"><ChevronLeft className="icon" /></Link>
            <Link className="iconbtn" href={keep({ m: shift(1) })} aria-label="Nächster Monat"><ChevronRight className="icon" /></Link>
            <h2>{dLabel(m, { month: 'long', year: 'numeric' })}</h2></div>
          <div className="inline"><Link className="btn btn-sm" href={keep({ m: today.slice(0, 7) })}>Heute</Link><Link className="small" href={`?m=${m.slice(0, 7)}${all ? '' : '&alle=1'}`}>{all ? 'Nur aktive' : 'Auch stornierte'}</Link></div>
        </div>
        <div className="table-wrap">
          <div className="mgrid">
            {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map((d) => <div className="dow" key={d}>{d}</div>)}
            {cells.map((k) => {
              const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
              const items = list.filter((b) => b.start >= ds && b.start < de);
              const bo = blackouts.filter((b) => b.start < de && b.end > ds);
              const fullBlock = k >= today && bo.some((b) => b.scope !== 'party' && b.start <= ds && b.end >= de);
              return (
                <div key={k} className={['mday', k.slice(0, 7) !== m.slice(0, 7) && 'out', k === today && 'today', fullBlock && 'blocked'].filter(Boolean).join(' ')}>
                  <span className="d"><span>{+k.slice(8)}</span>{k >= today && <span className="day-tools">
                    <Link href={`/admin/neu?datum=${k}`} aria-label={`Termin am ${k} eintragen`} title="Termin eintragen"><Plus className="icon-sm" /></Link>
                    <Link href={`/admin/sperrzeiten?von=${k}&bis=${k}#neu`} aria-label={`${k} sperren`} title="Tag sperren"><Lock className="icon-sm" /></Link></span>}</span>
                  {k >= today && bo.filter((x) => !fullBlock || (x.start <= ds && x.end >= de)).map((x) => {
                    const whole = x.start <= ds && x.end >= de;
                    const label = x.scope === 'party' ? 'keine Feiern' : whole ? 'gesperrt' : `gesperrt ${x.start > ds ? 'ab ' + berlinHm(x.start) : 'bis ' + berlinHm(x.end)}${x.start > ds && x.end < de ? '–' + berlinHm(x.end) : ''}`;
                    return <Link key={x.id} href="/admin/sperrzeiten" className={whole && x.scope !== 'party' ? 'ev sys' : 'ev-note'} title={`${blackoutWhen(x)}: ${x.reason}`}><Lock className="icon-sm" />{label}{whole ? `: ${x.reason}` : ''}</Link>;
                  })}
                  {items.map((b) => (
                    <Link key={b.id} href={`/admin/buchung/${b.id}`} className={`ev ${b.status}`} title={`${b.title} · ${b.name}`} style={{ '--c': cat.get(b.categoryId)?.color } as React.CSSProperties}>
                      <span className="num">{berlinHm(b.start)}</span> {b.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card-foot legend" style={{ marginTop: 0 }}>{cats.map((c) => <span key={c.id}><i style={{ '--c': c.color } as React.CSSProperties} />{c.name}</span>)}<span>gestrichelt: angefragt</span></div>
      </section>
    </>
  );
}
