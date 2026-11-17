import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarCheck, Clock, Hourglass, PartyPopper } from 'lucide-react';
import { db } from '@/lib/db';
import { getCategories, getRooms, getYearReport, listBookings } from '@/lib/data';
import { addDays, berlinHm, berlinToUtc, berlinYmd, fmtDay } from '@/lib/time';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Übersicht für den Vorstand', robots: { index: false } };

/** Lesezugriff ohne Anmeldung über einen geheimen Link (in der Verwaltung unter Team erneuerbar). Ohne Kontaktdaten. */
export default async function Vorstand({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [row] = await db()`select value from settings where key = 'boardLink'`;
  const cfg = row?.value as { key?: string } | undefined;
  if (!cfg?.key || key.length < 20 || key !== cfg.key) notFound();
  const now = Date.now(), today = berlinYmd(now), year = +today.slice(0, 4);
  const [cats, rooms, upcoming, open, report] = await Promise.all([
    getCategories(), getRooms(),
    listBookings({ from: now, to: berlinToUtc(addDays(today, 31), '00:00'), status: ['confirmed', 'requested'] }),
    listBookings({ status: ['requested'] }), getYearReport(year),
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const thisMonth = (report.byMonth.find((m) => m.m === +today.slice(5, 7))?.n as number) ?? 0;
  return (
    <main className="wrap" style={{ paddingBlock: 28 }}>
      <div className="page-head" style={{ paddingInline: 0 }}><div><span className="eyebrow">Nur lesen · Stand {fmtDay(now)}, {berlinHm(now)} Uhr</span><h1>Jugendraum für den Vorstand</h1></div>
        <Link className="btn" href={`/rueckblick/${year}`}>Jahresrückblick {year}</Link></div>
      <div className="kpis">
        <div className="card kpi"><span className="k"><CalendarCheck className="icon-sm" /> Termine {year}</span><span className="v">{report.totals.n}</span><span className="s">{report.totals.hours} Stunden</span></div>
        <div className="card kpi"><span className="k"><Clock className="icon-sm" /> Dieser Monat</span><span className="v">{thisMonth}</span><span className="s">bestätigte Termine</span></div>
        <div className="card kpi"><span className="k"><PartyPopper className="icon-sm" /> Feiern {year}</span><span className="v">{report.totals.parties}</span><span className="s">{report.totals.external} von Nicht-Mitgliedern</span></div>
        <div className="card kpi"><span className="k"><Hourglass className="icon-sm" /> Offene Anfragen</span><span className="v">{open.length}</span><span className="s">warten auf das Orga-Team</span></div>
      </div>
      <section className="card">
        <div className="card-head"><h2>Die nächsten 30 Tage</h2><span className="muted small">{upcoming.length} Termine</span></div>
        {upcoming.length === 0 ? <div className="empty">Keine Termine.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Termin</th><th>Anlass</th><th>Wer</th><th>Art</th><th>Status</th></tr></thead>
            <tbody>{upcoming.map((b) => (
              <tr key={b.id}><td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDay(b.start)}<br /><span className="muted">{berlinHm(b.start)}–{berlinHm(b.end)}</span></td>
                <td>{b.title}{rooms.length > 1 && <div className="muted small">{roomName.get(b.roomId)}</div>}</td>
                <td>{b.team || (b.bookerType === 'external' ? 'nicht im Verein' : 'Mitglied')}</td>
                <td><span className="catdot small" style={{ '--c': cat.get(b.categoryId)?.color } as React.CSSProperties}>{cat.get(b.categoryId)?.name}</span></td>
                <td><StatusBadge status={b.status} /></td></tr>
            ))}</tbody></table></div>
        )}
      </section>
      <p className="muted small" style={{ marginTop: 12 }}>Diese Seite zeigt keine Namen und Kontaktdaten von Buchenden. Den Link bitte nur im Vorstand weitergeben.</p>
    </main>
  );
}
