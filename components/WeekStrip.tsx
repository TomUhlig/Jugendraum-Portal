import Link from 'next/link';
import type { Blackout, Category, Slot } from '@/lib/rules';
import { addDays, berlinToUtc } from '@/lib/time';
import { CatIcon } from './ClubIcons';

type T = { weekTitle: string; weekHint: string; eveningFree: string; eveningBusy: string; dayClosed: string; today: string };
const FROM = 8, TO = 24; // sichtbarer Bereich in Stunden

/** Sieben Tage nebeneinander wie eine Tabelle im Sportteil: Balken je Termin, darunter „Abend frei“ oder „belegt“. */
export function WeekStrip({ today, slots, blackouts, categories, days, T, locale, roomParam }: {
  today: string; slots: Slot[]; blackouts: Blackout[]; categories: Category[]; T: T; locale: string; roomParam?: string;
  days?: Record<string, { name: string; kind: 'holiday' | 'school' }[]>;
}) {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const wd = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'Europe/Berlin' });
  const list = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(today, i);
    const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
    const w0 = berlinToUtc(k, `${String(FROM).padStart(2, '0')}:00`), span = (TO - FROM) * 3600_000;
    const pct = (t: number) => Math.max(0, Math.min(100, ((t - w0) / span) * 100));
    const items = slots.filter((s) => s.start < de && s.end > ds).map((s) => ({ id: s.id, top: pct(s.start), h: pct(s.end) - pct(s.start), c: cats.get(s.categoryId), open: s.status !== 'confirmed' }))
      .filter((x) => x.h > 0);
    const eve0 = berlinToUtc(k, '18:00'), eve1 = berlinToUtc(k, '22:00');
    const closed = blackouts.some((b) => b.scope !== 'party' && b.start <= ds && b.end >= de);
    const busyEve = closed || slots.some((s) => s.start < eve1 && s.end > eve0) || blackouts.some((b) => b.scope !== 'party' && b.start < eve1 && b.end > eve0);
    const hol = (days?.[k] ?? []).find((x) => x.kind === 'holiday');
    return { k, d: +k.slice(8), wd: wd.format(ds + 12 * 3600_000).replace('.', ''), items, closed, busyEve, hol };
  });
  const q = roomParam ? `raum=${roomParam}&` : '';
  return (
    <section className="wrap weekstrip" aria-labelledby="ws-h">
      <div className="ws-head"><h2 id="ws-h">{T.weekTitle}</h2><p>{T.weekHint}</p></div>
      <ol className="ws-days">
        {list.map((x, i) => (
          <li key={x.k} className={[i === 0 && 'is-today', x.closed && 'is-closed', x.hol && 'is-hol'].filter(Boolean).join(' ')}>
            <Link href={`/?${q}datum=${x.k}&von=18:00&bis=22:00#anfrage`} aria-label={`${x.wd} ${x.d}.: ${x.closed ? T.dayClosed : x.busyEve ? T.eveningBusy : T.eveningFree}`}>
              <span className="ws-date"><small>{i === 0 ? T.today : x.wd}</small><b>{String(x.d).padStart(2, '0')}</b></span>
              <span className="ws-track" aria-hidden="true">
                {[12, 16, 20].map((h) => <i key={h} className="ws-tick" style={{ top: `${((h - FROM) / (TO - FROM)) * 100}%` }}><em>{h}</em></i>)}
                <span className="ws-eve" style={{ top: `${((18 - FROM) / (TO - FROM)) * 100}%`, height: `${(4 / (TO - FROM)) * 100}%` }} />
                {x.items.map((s) => (
                  <span key={s.id} className={`ws-blk${s.open ? ' open' : ''}`} style={{ top: `${s.top}%`, height: `${Math.max(s.h, 4)}%`, '--c': s.c?.color ?? 'var(--muted)' } as React.CSSProperties}>
                    {s.h > 14 && s.c && <CatIcon id={s.c.id} className="icon-xs" />}
                  </span>
                ))}
              </span>
              <span className={`ws-state ${x.busyEve ? 'busy' : 'free'}`}>{x.closed ? T.dayClosed : x.busyEve ? T.eveningBusy : T.eveningFree}</span>
              {x.hol && <span className="ws-hol" title={x.hol.name}>{x.hol.name}</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
