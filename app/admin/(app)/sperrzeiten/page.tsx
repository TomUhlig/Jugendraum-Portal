import { CalendarOff } from 'lucide-react';
import Link from 'next/link';
import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { bookingsDuring, getBlackouts } from '@/lib/data';
import { blackoutWhen } from '@/lib/rules';
import { addDays, berlinYmd, fmtDay, weekdayOf } from '@/lib/time';
import { addBlackoutAction, deleteBlackoutAction } from '../../actions';

/** Schnellauswahl für häufige Zeiträume (Wochenende = Freitag bis Sonntag). */
function presets(today: string) {
  const wd = weekdayOf(today);
  const mon = addDays(today, -((wd + 6) % 7));
  const fri = wd === 0 ? addDays(today, -2) : wd === 6 ? addDays(today, -1) : addDays(mon, 4);
  const [y, m] = today.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const clip = (d: string) => (d < today ? today : d);
  return [
    { label: 'Heute', von: today, bis: today },
    { label: 'Dieses Wochenende', von: clip(fri), bis: addDays(fri, 2) },
    { label: 'Nächstes Wochenende', von: addDays(fri, 7), bis: addDays(fri, 9) },
    { label: 'Diese Woche', von: today, bis: addDays(mon, 6) },
    { label: 'Nächste Woche', von: addDays(mon, 7), bis: addDays(mon, 13) },
    { label: 'Rest des Monats', von: today, bis: monthEnd },
  ];
}

export default async function Sperrzeiten({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const today = berlinYmd(Date.now());
  const list = await getBlackouts(undefined, Date.now() - 86400e3);
  const affected = await Promise.all(list.map((b) => bookingsDuring(b.start, b.end, b.scope ?? 'all')));
  const can = me.role !== 'viewer';
  const von = /^\d{4}-\d\d-\d\d$/.test(sp.von ?? '') ? sp.von : '';
  const bis = /^\d{4}-\d\d-\d\d$/.test(sp.bis ?? '') ? sp.bis : von;
  const span = (a: string, b: string) => (a === b ? fmtDay(Date.parse(a + 'T12:00:00Z')) : `${fmtDay(Date.parse(a + 'T12:00:00Z'))} – ${fmtDay(Date.parse(b + 'T12:00:00Z'))}`);

  return (
    <>
      <PageHead eyebrow="Ferien, Renovierung, Vereinsfeste: Zeiträume, in denen keine Anfragen möglich sind" title="Sperrzeiten" />
      <Flash sp={sp} />
      {can && (
        <form action={addBlackoutAction} className="card" id="neu">
          <div className="card-head"><div><h2>Zeitraum sperren</h2><p>Gilt sofort für die Buchungsseite. Bestehende Buchungen bleiben gültig.</p></div></div>
          <div className="card-body stack">
            <div className="stack-sm">
              <span className="eyebrow">Schnellauswahl</span>
              <div className="chips">{presets(today).map((p) => (
                <Link key={p.label} className="chip" aria-pressed={von === p.von && bis === p.bis} href={`/admin/sperrzeiten?von=${p.von}&bis=${p.bis}#neu`} style={{ textDecoration: 'none' }}>
                  {p.label}<span className="muted small num">{span(p.von, p.bis)}</span></Link>
              ))}</div>
            </div>
            <div className="row">
              <div className="field"><label htmlFor="b1" className="req">Von</label><input id="b1" type="date" name="from" min={today} required defaultValue={von} key={'f' + von} /></div>
              <div className="field"><label htmlFor="b2">Bis einschließlich</label><input id="b2" type="date" name="to" min={today} defaultValue={bis} key={'t' + bis} /><span className="hint">leer = nur ein Tag</span></div>
              <div className="field span-2"><label htmlFor="b3">Grund</label><input id="b3" type="text" name="reason" maxLength={120} placeholder="z. B. Herbstferien, Renovierung, Vereinsfest" /><span className="hint">Wird Buchenden angezeigt, wenn sie in diesen Zeitraum anfragen.</span></div>
            </div>
            <div className="grid-2b">
              <div className="stack-sm" role="radiogroup" aria-label="Was wird gesperrt?">
                <span className="eyebrow">Was wird gesperrt?</span>
                <label className="choice"><input type="radio" name="scope" value="all" defaultChecked /><span><b>Alle Anfragen</b><br /><span className="muted small">Der Raum ist komplett zu.</span></span></label>
                <label className="choice"><input type="radio" name="scope" value="party" /><span><b>Nur Feiern</b><br /><span className="muted small">Besprechungen und Mannschaftsabende bleiben möglich.</span></span></label>
              </div>
              <div className="stack-sm">
                <span className="eyebrow">Uhrzeit</span>
                <label className="choice"><input type="checkbox" name="hours" /><span><b>Nur bestimmte Uhrzeiten</b><br /><span className="muted small">Sonst sind die Tage ganztägig gesperrt.</span></span></label>
                <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field"><label htmlFor="b4">ab</label><input id="b4" type="time" name="fromTime" step={900} defaultValue="14:00" /></div>
                  <div className="field"><label htmlFor="b5">bis</label><input id="b5" type="time" name="toTime" step={900} defaultValue="18:00" /></div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-foot inline"><button className="btn btn-primary" type="submit"><CalendarOff className="icon-sm" />Sperren</button><span className="muted small">Du kannst als Admin trotzdem Termine in diesem Zeitraum eintragen (Option „Regeln bewusst übergehen“).</span></div>
        </form>
      )}

      <section className="card">
        <div className="card-head"><h2>Aktuelle und kommende Sperrzeiten</h2><span className="muted small">{list.length}</span></div>
        {list.length === 0 ? <div className="empty">Keine Sperrzeiten eingetragen. Über die Schnellauswahl oben sperrst du z. B. die nächste Woche mit zwei Klicks.</div> : (
          <ul className="list">{list.map((b, i) => (
            <li key={b.id} className="stack-sm">
              <div className="between">
                <div className="stack-sm" style={{ gap: 2 }}>
                  <div className="inline"><b>{b.reason}</b><span className={`badge ${b.scope === 'party' ? 'b-warn' : 'b-bad'}`}>{b.scope === 'party' ? 'nur Feiern' : 'alles gesperrt'}</span></div>
                  <span className="muted small num">{blackoutWhen(b)}</span>
                </div>
                {can && <form action={deleteBlackoutAction}><input type="hidden" name="id" value={b.id} /><button className="btn btn-sm btn-danger" type="submit">Aufheben</button></form>}
              </div>
              {affected[i].length > 0 && (
                <div className="alert alert-warn" style={{ padding: '8px 12px' }}>
                  <div className="small"><strong>{affected[i].length} bestehende {affected[i].length === 1 ? 'Buchung liegt' : 'Buchungen liegen'} in diesem Zeitraum</strong> und {affected[i].length === 1 ? 'bleibt' : 'bleiben'} gültig:{' '}
                    {affected[i].map((x, j) => <span key={x.id}>{j > 0 && ', '}<Link href={`/admin/buchung/${x.id}`}>{x.title}</Link> ({fmtDay(x.start)})</span>)}</div>
                </div>
              )}
            </li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
