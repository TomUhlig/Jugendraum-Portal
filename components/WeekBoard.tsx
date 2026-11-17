'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Move } from 'lucide-react';
import { moveAction } from '@/app/admin/actions';
import { lanesFor } from '@/lib/util/lanes';
import { DAY, MIN, berlinHm, berlinToUtc, fmtDay } from '@/lib/time';

export type WeekEvent = { id: string; title: string; name: string; start: number; end: number; status: string; color: string; before: number; after: number; silent: boolean };
export type WeekBlock = { id: string; start: number; end: number; scope?: 'all' | 'party'; reason: string };

const H0 = 8, SPAN = 18, PX_PER_HOUR = 42, HEIGHT = SPAN * PX_PER_HOUR; // 08:00 bis 02:00
const MOVABLE = new Set(['requested', 'confirmed', 'pending_email']);

const laneStyle = (l?: { lane: number; lanes: number }): React.CSSProperties => (l && l.lanes > 1 ? { left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`, right: 'auto', width: `calc(${100 / l.lanes}% - 4px)` } : {});
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Wochenraster mit Drag & Drop: Termine in 15-Minuten-Schritten auf andere Tage oder Uhrzeiten ziehen. */
export function WeekBoard({ days, today, events, blocks, canEdit, infos = {} }: { days: string[]; today: string; events: WeekEvent[]; blocks: WeekBlock[]; canEdit: boolean; infos?: Record<string, { name: string; kind: 'holiday' | 'school' }[]> }) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x0: number; y0: number; dx: number; dy: number } | null>(null);
  const [pending, setPending] = useState<{ ev: WeekEvent; start: number; end: number; dx: number; dy: number } | null>(null);
  const [notify, setNotify] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const lanes = useMemo(() => {
    const m = new Map<string, Map<string, { lane: number; lanes: number }>>();
    for (const d of days) {
      const ds = berlinToUtc(d, '08:00'), de = ds + SPAN * 3600e3;
      const items = [...blocks.map((b) => ({ id: 'b' + b.id, start: b.start, end: b.end })), ...events.map((e) => ({ id: e.id, start: e.start, end: e.end }))]
        .filter((x) => x.end > ds && x.start < de).map((x) => ({ ...x, start: Math.max(x.start, ds), end: Math.min(x.end, de) }));
      m.set(d, lanesFor(items));
    }
    return m;
  }, [days, blocks, events]);

  const pos = (d: string, a: number, b: number) => {
    const w0 = berlinToUtc(d, '08:00'), w1 = w0 + SPAN * 3600e3;
    const s = Math.max(a, w0), e = Math.min(b, w1);
    return e <= s ? null : { top: ((s - w0) / (w1 - w0)) * 100, height: ((e - s) / (w1 - w0)) * 100 };
  };
  const colWidth = () => { const r = gridRef.current?.getBoundingClientRect(); return r ? (r.width - 52) / 7 : 100; };
  const shiftOf = (d: { dx: number; dy: number }) => ({
    days: Math.round(d.dx / colWidth()),
    minutes: Math.round((d.dy / PX_PER_HOUR) * 60 / 15) * 15,
  });
  const moved = (ev: WeekEvent, d: { dx: number; dy: number }) => {
    const s = shiftOf(d); const delta = s.days * DAY + s.minutes * MIN;
    return { start: ev.start + delta, end: ev.end + delta };
  };

  function onDown(e: React.PointerEvent, ev: WeekEvent) {
    if (!canEdit || !MOVABLE.has(ev.status) || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: ev.id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
    setMsg(null);
  }
  function onMove(e: React.PointerEvent) {
    if (drag) setDrag({ ...drag, dx: e.clientX - drag.x0, dy: e.clientY - drag.y0 });
  }
  function onUp(ev: WeekEvent) {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (Math.abs(d.dx) < 5 && Math.abs(d.dy) < 5) { router.push(`/admin/buchung/${ev.id}`); return; }
    const s = shiftOf(d);
    if (!s.days && !s.minutes) return;
    setNotify(!ev.silent);
    const snapX = s.days * colWidth(), snapY = (s.minutes / 60) * PX_PER_HOUR;
    setPending({ ev, ...moved(ev, d), dx: snapX, dy: snapY });
  }
  function save() {
    if (!pending) return;
    const p = pending;
    startTransition(async () => {
      const r = await moveAction(p.ev.id, p.start, p.end, notify);
      setMsg({ ok: r.ok, text: r.message });
      setPending(null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="table-wrap">
        <div className="wgrid" ref={gridRef}>
          <div />
          {days.map((d) => { const wd = new Date(d + 'T12:00:00Z').getUTCDay(); return <div key={d} className={`wh${d === today ? ' today' : ''}${wd === 0 || wd === 6 ? ' we' : ''}${d < today ? ' past' : ''}`}><small>{WD[wd]}</small><b>{+d.slice(8)}</b>{(infos[d] ?? []).slice(0, 1).map((x) => <span key={x.name} className={x.kind === 'holiday' ? 'hol-name' : 'school-name'} title={x.name}>{x.name}</span>)}</div>; })}
          <div className="hours" style={{ height: HEIGHT }}>{Array.from({ length: SPAN }, (_, i) => <span key={i} style={{ top: `${(i / SPAN) * 100}%` }}>{i ? String((H0 + i) % 24).padStart(2, '0') + ':00' : ''}</span>)}</div>
          {days.map((d) => (
            <div key={d} className={`wcol${canEdit && d >= today ? ' addable' : ''}${[0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay()) ? ' we' : ''}${d < today ? ' past' : ''}`} style={{ height: HEIGHT }}
              title={canEdit && d >= today ? 'Klicken, um hier einen Termin einzutragen' : undefined}
              onClick={(e) => {
                if (!canEdit || d < today || e.target !== e.currentTarget) return;
                const r = e.currentTarget.getBoundingClientRect();
                const mins = Math.max(0, Math.floor((((e.clientY - r.top) / r.height) * SPAN * 60) / 30) * 30);
                const h = (H0 * 60 + mins) / 60, hh = (x: number) => `${String(Math.floor(x) % 24).padStart(2, '0')}:${x % 1 ? '30' : '00'}`;
                router.push(`/admin/neu?datum=${d}&von=${hh(h)}&bis=${hh(Math.min(h + 2, 23.5))}`);
              }}>
              {d === today && now && (() => { const p = pos(d, now, now + 60_000); return p && <div className="now-line" style={{ top: `${p.top}%` }} aria-hidden><span>{berlinHm(now)}</span></div>; })()}
              {blocks.map((x) => { const p = pos(d, x.start, x.end); return p && <Link href="/admin/sperrzeiten" key={x.id} className={`wev sys${x.scope === 'party' ? ' party' : ''}`} title={`${x.scope === 'party' ? 'Keine Feiern' : 'Gesperrt'}: ${x.reason}`} style={{ '--c': 'var(--bad)', top: `${p.top}%`, height: `${p.height}%`, ...laneStyle(lanes.get(d)?.get('b' + x.id)) } as unknown as React.CSSProperties}><b>{x.scope === 'party' ? 'Keine Feiern' : 'Gesperrt'}</b><span>{x.reason}</span></Link>; })}
              {events.map((ev) => {
                const p = pos(d, ev.start, ev.end); if (!p) return null;
                const pb = pos(d, ev.start - ev.before * MIN, ev.start), pa = pos(d, ev.end, ev.end + ev.after * MIN);
                const st = { '--c': ev.color } as React.CSSProperties;
                const dragging = drag?.id === ev.id;
                const parked = !dragging && pending?.ev.id === ev.id ? pending : null;
                const movable = canEdit && MOVABLE.has(ev.status);
                const preview = dragging ? moved(ev, drag) : null;
                return (
                  <span key={ev.id}>
                    {pb && !dragging && <div className="wbuf" style={{ ...st, top: `${pb.top}%`, height: `${pb.height}%`, ...laneStyle(lanes.get(d)?.get(ev.id)) }} />}
                    {pa && !dragging && <div className="wbuf" style={{ ...st, top: `${pa.top}%`, height: `${pa.height}%`, ...laneStyle(lanes.get(d)?.get(ev.id)) }} />}
                    <div role="link" tabIndex={0} aria-label={`${ev.title}, ${berlinHm(ev.start)} bis ${berlinHm(ev.end)}${movable ? ', verschiebbar' : ''}`}
                      className={`wev ${ev.status}${movable ? ' movable' : ''}${dragging ? ' dragging' : ''}`} title={`${ev.title} · ${ev.name}${movable ? ' · ziehen zum Verschieben' : ''}`}
                      style={{ ...st, top: `${p.top}%`, height: `${p.height}%`, ...(dragging || parked ? {} : laneStyle(lanes.get(d)?.get(ev.id))), transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px)` : parked ? `translate(${parked.dx}px, ${parked.dy}px)` : undefined, outline: parked ? '2px solid var(--brand-ink)' : undefined, zIndex: parked ? 4 : undefined }}
                      onPointerDown={(e) => onDown(e, ev)} onPointerMove={onMove} onPointerUp={() => onUp(ev)} onPointerCancel={() => setDrag(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/admin/buchung/${ev.id}`); }}>
                      <b>{ev.title}</b>{ev.end - ev.start >= 90 * MIN && <span className="who">{ev.name}</span>}<span className="num">{parked ? `${berlinHm(parked.start)}–${berlinHm(parked.end)}` : preview ? `${fmtDay(preview.start)} ${berlinHm(preview.start)}–${berlinHm(preview.end)}` : `${berlinHm(ev.start)}–${berlinHm(ev.end)}`}</span>
                    </div>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {msg && <div className={`alert alert-${msg.ok ? 'ok' : 'bad'}`} style={{ margin: '12px 16px' }}><div>{msg.text}</div></div>}
      {pending && (
        <div className="move-bar card" role="dialog" aria-label="Verschieben bestätigen">
          <div className="inline"><Move className="icon" style={{ color: 'var(--brand-ink)' }} />
            <span><b>„{pending.ev.title}“</b> verschieben auf <b>{fmtDay(pending.start)}, {berlinHm(pending.start)}–{berlinHm(pending.end)} Uhr</b>?</span></div>
          <div className="inline">
            {pending.ev.silent ? <span className="muted small">ohne E-Mails</span> : <label className="check-inline small"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Bucher informieren</label>}
            <button className="btn" onClick={() => setPending(null)} disabled={busy}>Abbrechen</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Speichere …' : 'Verschieben'}</button>
          </div>
        </div>
      )}
    </>
  );
}
