import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { PrintButton } from '@/components/PrintButton';
import { requireAdmin } from '@/lib/auth';
import { getAllBlocks, getCategories, getExtras, listBookings } from '@/lib/data';
import { addDays, berlinHm, berlinToUtc, berlinYmd, fmtLong, weekdayOf } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wochenplan', robots: { index: false } };

const mondayOf = (d: string) => addDays(d, -((weekdayOf(d) + 6) % 7));

/** Wochenplan zum Aushängen bzw. für Platzwart und Hausmeister (A4 quer). */
export default async function Wochenplan({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const mon = mondayOf(/^\d{4}-\d\d-\d\d$/.test(sp.woche ?? '') ? sp.woche : berlinYmd(Date.now()));
  const from = berlinToUtc(mon, '00:00'), to = berlinToUtc(addDays(mon, 7), '00:00');
  const [list, cats, blocks, x] = await Promise.all([listBookings({ from, to, status: ['confirmed', 'requested'] }), getCategories(), getAllBlocks(undefined, from, to), getExtras()]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const kw = (() => { const d = new Date(`${addDays(mon, 3)}T12:00:00Z`); const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((+d - +y0) / 86400e3 - 3 + ((y0.getUTCDay() + 6) % 7)) / 7); })();
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return (
    <main className="wrap" style={{ paddingBlock: 24, maxWidth: 1100 }}>
      <div className="no-print between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <Link href="/admin/kalender" className="inline small" style={{ textDecoration: 'none' }}><ArrowLeft className="icon-sm" />Zum Kalender</Link>
        <div className="inline">
          <Link className="btn" href={`/admin/wochenplan?woche=${addDays(mon, -7)}`} aria-label="Vorige Woche"><ChevronLeft className="icon-sm" /></Link>
          <Link className="btn" href="/admin/wochenplan">Diese Woche</Link>
          <Link className="btn" href={`/admin/wochenplan?woche=${addDays(mon, 7)}`} aria-label="Nächste Woche"><ChevronRight className="icon-sm" /></Link>
          <PrintButton />
        </div>
      </div>
      <article className="print-doc landscape">
        <header className="pd-head">
          <img src="/logo.png" alt="" width={56} height={56} />
          <div><div className="pd-kicker">Jugendraum des SV Heepen</div><h1>Wochenplan KW {kw}</h1></div>
          <div className="pd-ref">{fmtLong(from).replace(/^\w+, /, '')}<br />bis {fmtLong(to - 1).replace(/^\w+, /, '')}</div>
        </header>
        <table className="pd-grid week-plan" style={{ marginTop: 14 }}>
          <thead><tr><th style={{ width: '16%' }}>Tag</th><th style={{ width: '13%' }}>Zeit</th><th>Termin</th><th style={{ width: '22%' }}>Verantwortlich</th><th style={{ width: '20%' }}>Schlüssel / Hinweise</th></tr></thead>
          <tbody>
            {days.map((d) => {
              const ds = berlinToUtc(d, '00:00'), de = berlinToUtc(addDays(d, 1), '00:00');
              const items = list.filter((b) => b.start < de && b.end > ds && berlinYmd(b.start) === d);
              const bl = blocks.filter((b) => b.start < de && b.end > ds);
              const label = fmtLong(ds).replace(/ \d{4}$/, '');
              if (!items.length && !bl.length) return <tr key={d} className="empty-day"><td><b>{label}</b></td><td colSpan={4} className="muted">frei</td></tr>;
              const rows = [
                ...bl.map((b) => ({ key: 'b' + b.id, blocked: true as const, b })),
                ...items.map((b) => ({ key: b.id, blocked: false as const, b })),
              ];
              return rows.map((r, i) => r.blocked ? (
                <tr key={d + r.key} className="blocked"><td>{i === 0 ? <b>{label}</b> : null}</td><td className="num">{r.b.start <= ds && r.b.end >= de ? 'ganztägig' : `${berlinHm(Math.max(r.b.start, ds))}–${berlinHm(Math.min(r.b.end, de))}`}</td><td colSpan={3}><b>gesperrt</b>{r.b.reason ? `: ${r.b.reason}` : ''}</td></tr>
              ) : (
                <tr key={r.key}>
                  <td>{i === 0 ? <b>{label}</b> : null}</td>
                  <td className="num">{berlinHm(r.b.start)}–{berlinHm(r.b.end)}</td>
                  <td><b>{r.b.title}</b>{r.b.status === 'requested' && <em> (noch nicht bestätigt)</em>}<br /><small>{cat.get(r.b.categoryId)?.name} · {r.b.guests} Pers.{r.b.equipment.length ? ' · ' + r.b.equipment.join(', ') : ''}</small></td>
                  <td>{r.b.name}{r.b.team ? <><br /><small>{r.b.team}</small></> : null}{r.b.phone ? <><br /><small>{r.b.phone}</small></> : null}</td>
                  <td><small>{r.b.keyHandedOut ? 'Schlüssel ausgegeben' : 'Schlüssel: ☐ ausgegeben'}{r.b.agreedWith ? <><br />abgesprochen mit {r.b.agreedWith}</> : null}</small></td>
                </tr>
              ));
            })}
          </tbody>
        </table>
        <p className="pd-note">Fragen zur Belegung: {x.operator.phone || x.operator.email || 'Orga-Team Jugendraum'} · Stand {fmtLong(Date.now())}, {berlinHm(Date.now())} Uhr</p>
      </article>
    </main>
  );
}
