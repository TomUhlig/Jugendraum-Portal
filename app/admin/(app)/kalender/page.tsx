import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getBlackouts, getCategories, listBookings } from '@/lib/data';
import { addDays, berlinHm, berlinToUtc, berlinYmd, weekdayOf } from '@/lib/time';

export default async function Kalender({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const m = (/^\d{4}-\d\d$/.test(sp.m ?? '') ? sp.m : berlinYmd(Date.now()).slice(0, 7)) + '-01';
  const [y, mo] = m.split('-').map(Number);
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const first = addDays(m, -((weekdayOf(m) + 6) % 7));
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) { const k = addDays(first, i); if (i >= 35 && k.slice(0, 7) !== m.slice(0, 7)) break; cells.push(k); }
  const from = berlinToUtc(cells[0], '00:00'), to = berlinToUtc(addDays(cells[cells.length - 1], 1), '00:00');
  const showAll = sp.alle === '1';
  const [cats, bookings, blackouts] = await Promise.all([
    getCategories(),
    listBookings({ from, to, status: showAll ? undefined : ['pending_email', 'requested', 'confirmed'] }),
    getBlackouts(undefined, from, to),
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const today = berlinYmd(Date.now());
  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="page-title"><div><span className="label">Verwaltung</span><h1>Kalender</h1></div>
        <Link className="btn" href={`/admin/kalender?m=${m.slice(0, 7)}${showAll ? '' : '&alle=1'}`}>{showAll ? 'Nur aktive Buchungen' : 'Auch abgelehnte und stornierte zeigen'}</Link></div>
      <section className="panel">
        <div className="cal-head">
          <Link className="iconbtn" href={`/admin/kalender?m=${shift(-1)}${showAll ? '&alle=1' : ''}`} aria-label="Vorheriger Monat">‹</Link>
          <h3>{new Date(m + 'T12:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
          <Link className="iconbtn" href={`/admin/kalender?m=${shift(1)}${showAll ? '&alle=1' : ''}`} aria-label="Nächster Monat">›</Link>
        </div>
        <div className="table-wrap"><div className="cal adm" style={{ minWidth: 640 }}>
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <div className="dow" key={d}>{d}</div>)}
          {cells.map((k) => {
            const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
            const list = bookings.filter((b) => b.start >= ds && b.start < de);
            const bo = blackouts.filter((b) => b.start < de && b.end > ds);
            return (
              <div key={k} className={['day', k.slice(0, 7) !== m.slice(0, 7) && 'out', k === today && 'today', bo.length && 'bo'].filter(Boolean).join(' ')}>
                <span className="n">{+k.slice(8)}</span>
                {bo.map((x) => <span key={x.id} className="ev" style={{ '--c': 'var(--belegt)' } as React.CSSProperties}>Gesperrt: {x.reason}</span>)}
                {list.map((b) => (
                  <Link key={b.id} href={`/admin/buchung/${b.id}`} className={`ev ${b.status}`} title={`${b.title} · ${b.name}`} style={{ '--c': cat.get(b.categoryId)?.color } as React.CSSProperties}>
                    {berlinHm(b.start)} {b.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div></div>
        <div className="legend">
          {cats.map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}</span>)}
          <span><i style={{ border: '1.5px dashed var(--muted)' }} />gestrichelt = angefragt</span>
        </div>
      </section>
    </div>
  );
}
