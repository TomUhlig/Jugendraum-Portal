'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BellRing, CalendarCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleCheck, Ellipsis,
  GraduationCap, Megaphone, PartyPopper, Shirt, Users, XCircle,
} from 'lucide-react';
import { Turnstile } from './Turnstile';
import { Blackout, Category, CheckResult, Settings, Slot, blackoutWhen, checkBooking, partyWeekendOf } from '@/lib/rules';
import { MIN, addDays, berlinHm, berlinToUtc, berlinYmd, fmtDay, fmtLong, weekdayOf } from '@/lib/time';
import { LOCALE, catLabel, t, type Lang } from '@/lib/i18n';

type Fees = { rent: number; deposit: number };
export type Occupancy = {
  categories: Category[]; settings: Settings; slots: Slot[]; blackouts: Blackout[];
  equipment: string[]; feesExternal: Fees; feesMemberParty: Fees;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  meet: Users, team: Shirt, event: Megaphone, work: GraduationCap, party: PartyPopper, misc: Ellipsis,
};
const PEOPLE = ['Michael Grieswelle', 'Sigrid Brodig'];
const eurL = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
const monthStart = (k: string) => k.slice(0, 8) + '01';
const shiftMonth = (k: string, n: number) => {
  const [y, m] = k.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
const monthLabelL = (k: string, lang: Lang) => new Date(k + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabelL = (k: string, lang: Lang) => new Date(k + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const toMin = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3);
const toHm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const START_OPTIONS = Array.from({ length: (23 - 7) * 4 + 4 }, (_, i) => toHm(7 * 60 + i * 15));
const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2);

type Done = { number: string; email: string; count?: number; skipped?: number };

/** Webmailer zur Adresse, damit man die Bestätigungsmail mit einem Tipp öffnet. */
function mailApp(email: string): { name: string; url: string } | null {
  const d = email.split('@')[1]?.toLowerCase() ?? '';
  if (/^(gmail|googlemail)\.com$/.test(d)) return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#search/from%3Ajugendraum+OR+Jugendraum' };
  if (/^(outlook|hotmail|live|msn)\.(com|de)$/.test(d)) return { name: 'Outlook', url: 'https://outlook.live.com/mail/' };
  if (/^gmx\.(de|net|at|ch)$/.test(d)) return { name: 'GMX', url: 'https://www.gmx.net/' };
  if (d === 'web.de') return { name: 'WEB.DE', url: 'https://web.de/' };
  if (/^(t-online)\.de$/.test(d)) return { name: 't-online', url: 'https://email.t-online.de/' };
  if (/^(icloud|me|mac)\.com$/.test(d)) return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  if (/^(yahoo)\.(com|de)$/.test(d)) return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  return null;
}

export type Prefill = { date?: string; start?: string; end?: string; categoryId?: string; title?: string; guests?: string; equipment?: string[] };
const WAITABLE = new Set(['overlap', 'buffer', 'party-weekend', 'blackout']);

export default function BookingApp({ initial, initialMonth, contactNote, prefill = {}, turnstileKey = '', lang = 'de' }: { initial: Occupancy; initialMonth: string; contactNote: string; prefill?: Prefill; turnstileKey?: string; lang?: Lang }) {
  const T = t(lang).app, D = t(lang);
  const eur = (n: number) => eurL(n, lang);
  const monthLabel = (k: string) => monthLabelL(k, lang);
  const dayLabel = (k: string) => dayLabelL(k, lang);
  const uhr = lang === 'de' ? ' Uhr' : '';
  const cl = (c: Category) => catLabel(lang, c);
  const [loadedAt] = useState(() => Date.now());
  const [captcha, setCaptcha] = useState('');
  const onCaptcha = useCallback((t: string) => setCaptcha(t), []);
  const [data, setData] = useState(initial);
  const [month, setMonth] = useState(initialMonth);
  const [now, setNow] = useState(() => Date.now());
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [catId, setCatId] = useState<string | null>(prefill.categoryId ?? null);
  const [f, setF] = useState({ title: prefill.title ?? '', guests: prefill.guests ?? '20', note: '', date: prefill.date ?? '', start: prefill.start ?? '18:00', end: prefill.end ?? '22:00', name: '', team: '', email: '', phone: '', website: '' });
  const [wait, setWait] = useState<{ open: boolean; state: 'idle' | 'busy' | 'done' | 'error'; msg: string }>({ open: false, state: 'idle', msg: '' });
  const [equipment, setEquipment] = useState<string[]>(prefill.equipment ?? []);
  // Kontaktdaten auf diesem Gerät merken (nur im Browser, nie auf dem Server)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('jr-kontakt') ?? 'null');
      if (saved && typeof saved === 'object') {
        setF((s) => ({ ...s, name: s.name || String(saved.name ?? ''), team: s.team || String(saved.team ?? ''), email: s.email || String(saved.email ?? ''), phone: s.phone || String(saved.phone ?? '') }));
        if (saved.bookerType === 'external' || saved.bookerType === 'member') setBookerType(saved.bookerType);
      }
    } catch {}
  }, []);
  const [bookerType, setBookerType] = useState<'member' | 'external'>('member');
  const [who, setWho] = useState('');
  const [agree, setAgree] = useState(false);
  const [rules, setRules] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (m: string) => {
    const from = berlinToUtc(addDays(m, -7), '00:00'), to = berlinToUtc(addDays(shiftMonth(m, 1), 7), '00:00');
    const res = await fetch(`/api/belegung?from=${from}&to=${to}`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { if (month !== initialMonth) load(month); }, [month, initialMonth, load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const cats = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const cat = catId ? cats.get(catId) : undefined;
  const fees: Fees = bookerType === 'external' ? data.feesExternal : cat?.isParty ? data.feesMemberParty : { rent: 0, deposit: 0 };

  const draft = useMemo(() => {
    if (!f.date) return null;
    const start = berlinToUtc(f.date, f.start);
    const end = toMin(f.end) > toMin(f.start) ? berlinToUtc(f.date, f.end) : berlinToUtc(addDays(f.date, 1), f.end);
    return { start, end, guests: +f.guests || 0 };
  }, [f.date, f.start, f.end, f.guests]);
  useEffect(() => { setWait({ open: false, state: 'idle', msg: '' }); }, [f.date, f.start, f.end, catId]);
  const [repeat, setRepeat] = useState<{ on: boolean; freq: 'weekly' | 'biweekly'; count: number }>({ on: false, freq: 'weekly', count: 6 });
  const seriesOn = repeat.on && !!cat && !cat.isParty;
  const seriesPreview = useMemo(() => {
    if (!seriesOn || !draft || !catId) return [];
    const step = repeat.freq === 'weekly' ? 7 : 14, len = draft.end - draft.start;
    const knownTo = berlinToUtc(addDays(shiftMonth(month, 1), 7), '00:00');
    return Array.from({ length: repeat.count }, (_, i) => {
      const d = addDays(f.date, i * step); const st = berlinToUtc(d, f.start);
      const r = st < knownTo ? checkBooking({ start: st, end: st + len, guests: draft.guests, categoryId: catId }, { ...data, now, lang }) : null;
      return { date: d, start: st, state: r ? (r.level === 'block' ? 'taken' : 'ok') : 'unknown' } as const;
    });
  }, [seriesOn, draft, catId, repeat.freq, repeat.count, f.date, f.start, month, data, now, lang]);
  const result: CheckResult | null = useMemo(() => (draft && catId ? checkBooking({ ...draft, categoryId: catId }, { ...data, now, lang }) : null), [draft, catId, data, now, lang]);

  const endOptions = useMemo(() => {
    const s = toMin(f.start), max = (cat?.maxDurationMin ?? 16 * 60);
    return Array.from({ length: Math.floor(Math.min(max, 18 * 60) / 15) }, (_, i) => s + (i + 1) * 15).map((m) => ({ v: toHm(m), next: m >= 24 * 60 }));
  }, [f.start, cat]);
  useEffect(() => { if (!endOptions.some((o) => o.v === f.end)) setF((s) => ({ ...s, end: endOptions[Math.min(7, endOptions.length - 1)].v })); }, [endOptions, f.end]);

  // ---------- Validierung pro Schritt ----------
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email.trim());
  const stepErrors: Record<string, string>[] = [
    { ...(!catId && { cat: T.errCat }), ...(f.title.trim().length < 2 && { title: T.errTitle }), ...(!(+f.guests >= 1) && { guests: T.errGuests }) },
    { ...(!f.date && { date: T.errDate }), ...(result?.level === 'block' && { time: T.errTime }) },
    { ...(f.name.trim().length < 2 && { name: T.errName }), ...(!emailOk && { email: T.errEmail }),
      ...(f.phone.trim().length < 4 && { phone: T.errPhone }), ...(bookerType === 'member' && !f.team.trim() && { team: T.errTeam }) },
    { ...(!(agree && who) && { agree: T.errAgree }), ...(!rules && { rules: T.errRules }) },
  ];
  const err = (k: string) => (touched ? stepErrors[step][k] : undefined);

  function go(to: number) {
    if (to > step && Object.keys(stepErrors[step]).length) { setTouched(true); return; }
    setTouched(false); setServerError('');
    setStep(to); setReached((r) => Math.max(r, to));
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit() {
    if (Object.keys(stepErrors[3]).length) { setTouched(true); return; }
    for (let i = 0; i < 3; i++) if (Object.keys(stepErrors[i]).length) { setStep(i); setTouched(true); return; }
    setBusy(true); setServerError('');
    try {
      const res = await fetch('/api/buchungen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: catId, title: f.title.trim(), note: f.note.trim(), date: f.date, start: f.start, end: f.end, guests: +f.guests,
          equipment, bookerType, team: bookerType === 'member' ? f.team.trim() : '', name: f.name.trim(), email: f.email.trim(),
          phone: f.phone.trim(), agreedWith: who, agreed: agree, rulesAccepted: rules, lang, website: f.website, elapsed: Date.now() - loadedAt, turnstile: captcha,
          ...(seriesOn ? { repeat: { freq: repeat.freq, count: repeat.count } } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { try { localStorage.setItem('jr-kontakt', JSON.stringify({ name: f.name.trim(), team: f.team.trim(), email: f.email.trim(), phone: f.phone.trim(), bookerType })); } catch {} setDone({ number: json.number, email: f.email.trim(), count: json.count, skipped: json.skipped?.length }); topRef.current?.scrollIntoView({ block: 'start' }); load(month); }
      else if (res.status === 409) { await load(month); setStep(1); setServerError(T.taken + (json.check?.messages?.[0]?.text ?? T.pickOther)); }
      else setServerError(json.error ?? T.sendFailed);
    } catch {
      setServerError(T.offline);
    } finally { setBusy(false); }
  }

  function reset() {
    setDone(null); setStep(0); setReached(0); setCatId(null); setEquipment([]); setAgree(false); setWho(''); setRules(false);
    setF((s) => ({ ...s, title: '', note: '', date: '' }));
  }

  // ---------- Kalender ----------
  const todayKey = berlinYmd(now);
  const partyWeekends = useMemo(() => new Set(data.slots.map((s) => partyWeekendOf(s.start, cats.get(s.categoryId), data.settings)).filter(Boolean)), [data, cats]);
  const cells = useMemo(() => {
    const first = addDays(month, -((weekdayOf(month) + 6) % 7)); const out: string[] = [];
    for (let i = 0; i < 42; i++) { const k = addDays(first, i); if (i >= 35 && k.slice(0, 7) !== month.slice(0, 7)) break; out.push(k); }
    return out;
  }, [month]);
  const daySlots = (k: string) => {
    const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
    return data.slots.filter((s) => s.start < de && s.end > ds).sort((a, b) => a.start - b.start);
  };
  const dayBlocks = (k: string) => {
    const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
    return data.blackouts.filter((b) => b.start < de && b.end > ds);
  };
  const lineDate = f.date || todayKey;
  const w0 = berlinToUtc(lineDate, '08:00'), span = berlinToUtc(addDays(lineDate, 1), '02:00') - w0;
  const x = (t: number) => Math.max(0, Math.min(100, ((t - w0) / span) * 100));
  const availability = !result || done ? null : result.level;

  // ---------- Darstellung ----------
  const Summary = (
    <aside className="aside">
      <section className="card summary" aria-labelledby="sum-h">
        <div className="card-head"><h2 id="sum-h">{T.yourRequest}</h2>
          {availability && <span className={`badge b-${availability === 'block' ? 'bad' : availability === 'warn' ? 'warn' : 'ok'}`}>{availability === 'block' ? T.notAvailable : availability === 'warn' ? T.withHints : T.available}</span>}
        </div>
        <div className="card-body" style={{ paddingBlock: 6 }}>
          <dl>
            <div className="item"><dt>{T.occasion}</dt><dd className={f.title ? '' : 'tbd'}>{f.title || T.open}</dd></div>
            <div className="item"><dt>{T.kind}</dt><dd className={cat ? '' : 'tbd'}>{cat ? <span className="catdot" style={{ '--c': cat.color } as React.CSSProperties}>{cl(cat).name}</span> : T.open}</dd></div>
            <div className="item"><dt>{T.date}</dt><dd className={f.date ? '' : 'tbd'}>{f.date ? dayLabel(f.date) : T.open}</dd></div>
            <div className="item"><dt>{T.time}</dt><dd className={f.date ? 'num' : 'tbd'}>{f.date && draft ? `${f.start}–${f.end}${uhr}${berlinYmd(draft.end) !== f.date ? ' ' + T.nextDay : ''}` : T.open}</dd></div>
            {cat && draft && <div className="item"><dt>{T.reserved}</dt><dd className="num" style={{ fontWeight: 400 }}>{berlinHm(draft.start - cat.bufferBefore * MIN)}–{berlinHm(draft.end + cat.bufferAfter * MIN)}{uhr}<br /><span className="muted small">{T.inclSetup}</span></dd></div>}
            <div className="item"><dt>{T.people}</dt><dd className="num">{f.guests || '–'}</dd></div>
            {equipment.length > 0 && <div className="item"><dt>{T.equipment}</dt><dd style={{ fontWeight: 400 }}>{equipment.join(', ')}</dd></div>}
            {(fees.rent > 0 || fees.deposit > 0) && <div className="item"><dt>{T.costs}</dt><dd style={{ fontWeight: 400 }}>{fees.rent > 0 && <>{T.rent} {eur(fees.rent)}<br /></>}{fees.deposit > 0 && <>{T.deposit} {eur(fees.deposit)} <span className="muted small">{T.depositBack}</span></>}</dd></div>}
          </dl>
        </div>
      </section>
      <section className="card card-body stack">
        <h2 className="section-title">{T.contacts}</h2>
        {PEOPLE.map((p) => <div className="contact" key={p}><span className="avatar">{initials(p)}</span><div><b>{p}</b><br /><span className="muted small">{T.contactRole}</span></div></div>)}
        {contactNote && lang === 'de' && <p className="muted small">{contactNote}</p>}
      </section>
      {!done && <section className="card card-body stack">
        <h2 className="section-title">{T.howItGoes}</h2>
        <ol className="next-steps">
          <li>{T.next1}</li>
          <li>{T.next2}</li>
          <li>{T.next3}</li>
        </ol>
      </section>}
    </aside>
  );

  if (done) {
    return (
      <div className="wrap booking-layout" ref={topRef}>
        <section className="card fade-in">
          <div className="done-view">
            <span className="seal"><CheckCircle2 className="icon" /></span>
            <div><span className="eyebrow">{T.requestNo} <span className="refno">{done.number}</span></span><h2>{T.confirmEmail}</h2></div>
            <p>{T.sentTo(done.email)}</p>
            {done.count && done.count > 1 ? <p className="badge b-info no-dot" style={{ whiteSpace: 'normal' }}>{T.doneSeries(done.count, done.skipped ?? 0)}</p> : null}
            {(() => { const m = mailApp(done.email); return m && <a className="btn btn-primary" href={m.url} target="_blank" rel="noopener">{T.openMail(m.name)}</a>; })()}
            <p className="muted small">{T.noMail}</p>
          </div>
          <div className="after-steps">
            <h3>{T.nextTitle}</h3>
            <ol>{T.afterSteps.map(([h, d], i) => <li key={h} className={i === 0 ? 'now' : ''}><b>{h}</b><span>{d}</span></li>)}</ol>
            <button className="btn" onClick={reset}>{T.another}</button>
          </div>
        </section>
        {Summary}
      </div>
    );
  }

  return (
    <div className="wrap booking-layout" ref={topRef} style={{ scrollMarginTop: 90 }}>
      <section className="card" aria-label={T.makeRequest}>
        <ol className="steps">
          {T.steps.map((s, i) => (
            <li key={s}>
              <button type="button" disabled={i > reached} onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>
                <span className="n">{i < step ? <Check className="icon-sm" /> : i + 1}</span><span className="lbl">{s}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="step-body fade-in">
            <div><h2>{T.whatTitle}</h2><p className="lead">{T.whatLead}</p></div>
            <div className="options" role="group" aria-label={T.kindOfUse}>
              {data.categories.map((c) => {
                const I = ICONS[c.id] ?? Ellipsis;
                return (
                  <button type="button" key={c.id} className="option" aria-pressed={c.id === catId} onClick={() => setCatId(c.id)} style={{ '--c': c.color } as React.CSSProperties}>
                    <span className="ico"><I className="icon" /></span><b>{cl(c).name}</b><small>{cl(c).hint}</small>
                  </button>
                );
              })}
            </div>
            {err('cat') && <p className="field-error">{err('cat')}</p>}
            <div className="row">
              <div className="field span-2"><label htmlFor="f-title" className="req">{T.occasion}</label>
                <input type="text" id="f-title" maxLength={80} value={f.title} onChange={set('title')} className={err('title') ? 'invalid' : ''} placeholder={cat?.isParty ? T.titlePhParty : T.titlePh} />
                {err('title') && <span className="field-error">{err('title')}</span>}</div>
              <div className="field"><label htmlFor="f-guests" className="req">{T.guests}</label>
                <input type="number" id="f-guests" min={1} max={200} value={f.guests} onChange={set('guests')} className={err('guests') ? 'invalid' : ''} />
                {+f.guests > data.settings.capacity && <span className="hint" style={{ color: 'var(--warn)' }}>{T.maxPeople(data.settings.capacity)}</span>}</div>
            </div>
            {data.equipment.length > 0 && (
              <div className="field"><span className="label">{T.needs} <span className="muted" style={{ fontWeight: 400 }}>{T.optional}</span></span>
                <div className="chips">{data.equipment.map((e) => (
                  <button type="button" key={e} className="chip" aria-pressed={equipment.includes(e)} onClick={() => setEquipment((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]))}>{e}</button>
                ))}</div></div>
            )}
            <div className="field"><label htmlFor="f-note">{T.noteLabel} <span className="muted" style={{ fontWeight: 400 }}>{T.optional}</span></label>
              <textarea id="f-note" maxLength={500} value={f.note} onChange={set('note')} placeholder={T.notePh} />
              <span className="hint">{f.note.length}/500</span></div>
          </div>
        )}

        {step === 1 && (
          <div className="step-body fade-in">
            <div><h2>{T.whenTitle}</h2><p className="lead">{T.whenLead}</p></div>
            {serverError && <div className="alert alert-bad"><XCircle className="icon" /><div>{serverError}</div></div>}
            <div className="when">
              <div>
                <div className="cal-nav">
                  <button type="button" className="iconbtn" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= monthStart(todayKey)} aria-label={T.prevMonth}><ChevronLeft className="icon" /></button>
                  <h3>{monthLabel(month)}</h3>
                  <button type="button" className="iconbtn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={T.nextMonth}><ChevronRight className="icon" /></button>
                </div>
                <div className="month" role="grid" aria-label={monthLabel(month)}>
                  {D.dow.map((d) => <div className="dow" key={d}>{d}</div>)}
                  {cells.map((k) => {
                    const list = daySlots(k);
                    const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
                    // ganztägig gesperrt (für alle, oder für Feiern, wenn eine Feier gewählt ist)
                    const blocked = data.blackouts.some((b) => b.start <= ds && b.end >= de && (b.scope !== 'party' || cat?.isParty));
                    const wd = weekdayOf(k), fri = wd === 5 ? k : wd === 6 ? addDays(k, -1) : wd === 0 ? addDays(k, -2) : null;
                    const cls = ['dcell', k.slice(0, 7) !== month.slice(0, 7) && 'out', k === todayKey && 'today', k === f.date && 'sel', blocked && 'blocked'].filter(Boolean).join(' ');
                    return (
                      <button type="button" key={k} className={cls} disabled={k < todayKey || blocked} onClick={() => { setF((s) => ({ ...s, date: k })); if (monthStart(k) !== month) setMonth(monthStart(k)); }}
                        aria-label={`${dayLabel(k)}: ${blocked ? T.blocked : list.length ? T.bookingsN(list.length) : T.free}`} aria-pressed={k === f.date}>
                        {fri && partyWeekends.has(fri) && <span className="pw-flag" title={T.partyFlag} />}
                        <span className="d">{+k.slice(8)}</span>
                        <span className="dots">{list.slice(0, 3).map((s) => <i key={s.id} className={s.status !== 'confirmed' ? 'open' : ''} style={{ '--c': cats.get(s.categoryId)?.color } as React.CSSProperties} />)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <span><i style={{ '--c': 'var(--muted)' } as React.CSSProperties} />{T.legendBooked}</span>
                  <span><i style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--muted)' }} />{T.legendRequested}</span>
                  <span><i style={{ background: 'var(--gelb)' }} />{T.legendParty}</span>
                  {data.blackouts.length > 0 && <span><i style={{ background: 'repeating-linear-gradient(135deg, transparent 0 2px, var(--bad) 2px 3px)' }} />{T.legendBlocked}</span>}
                </div>
              </div>

              <div className="dayplan">
                {!f.date ? <p className="muted small" style={{ paddingTop: 6 }}>{T.pickDay}</p> : (
                  <>
                    <h3>{dayLabel(f.date)}</h3>
                    {dayBlocks(f.date).map((b) => (
                      <div key={b.id} className="alert alert-bad" style={{ padding: '8px 10px' }}><div className="small"><strong>{b.scope === 'party' ? T.noParties : T.closed}</strong> {blackoutWhen(b, lang)}: {b.reason}</div></div>
                    ))}
                    {daySlots(f.date).length ? (
                      <ul className="busy">{daySlots(f.date).map((s) => (
                        <li key={s.id} style={{ '--c': cats.get(s.categoryId)?.color } as React.CSSProperties}><span className="t">{berlinHm(s.start)}–{berlinHm(s.end)}</span><span>{s.status === 'confirmed' ? T.booked : T.requested}</span></li>
                      ))}</ul>
                    ) : <p className="free-day"><CircleCheck className="icon-sm" />{T.noBookings}</p>}
                    <div className="row" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
                      <div className="field"><label htmlFor="f-start">{T.from}</label>
                        <select id="f-start" value={f.start} onChange={set('start')}>{START_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
                      <div className="field"><label htmlFor="f-end">{T.to}</label>
                        <select id="f-end" value={f.end} onChange={set('end')}>{endOptions.map((o) => <option key={o.v + o.next} value={o.v}>{o.v}{o.next ? ' (+1)' : ''}</option>)}</select></div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {f.date && (
              <div>
                <div className="track" aria-hidden="true">
                  {data.slots.filter((s) => s.end + 4 * 3.6e6 > w0 && s.start - 3 * 3.6e6 < w0 + span).map((s) => {
                    const c = cats.get(s.categoryId); if (!c) return null; const st = { '--c': c.color } as React.CSSProperties;
                    return (
                      <span key={s.id}>
                        <span className="buf" style={{ ...st, left: x(s.start - c.bufferBefore * MIN) + '%', width: x(s.start) - x(s.start - c.bufferBefore * MIN) + '%' }} />
                        <span className="buf" style={{ ...st, left: x(s.end) + '%', width: x(s.end + c.bufferAfter * MIN) - x(s.end) + '%' }} />
                        <span className={`blk ${s.status !== 'confirmed' ? 'open' : ''}`} style={{ ...st, left: x(s.start) + '%', width: x(s.end) - x(s.start) + '%' }} />
                      </span>
                    );
                  })}
                  {draft && result && <span className="mine" style={{ '--st': `var(--${result.level === 'block' ? 'bad' : result.level === 'warn' ? 'warn' : 'ok'})`, left: x(draft.start) + '%', width: x(draft.end) - x(draft.start) + '%' } as React.CSSProperties} />}
                </div>
                <div className="ticks"><span>08:00</span><span>11:00</span><span>14:00</span><span>17:00</span><span>20:00</span><span>23:00</span><span>02:00</span></div>
              </div>
            )}

            {result && (
              <div className={`alert alert-${result.level === 'block' ? 'bad' : result.level === 'warn' ? 'warn' : 'ok'}`} aria-live="polite">
                {result.level === 'ok' ? <CheckCircle2 className="icon" /> : result.level === 'warn' ? <AlertTriangle className="icon" /> : <XCircle className="icon" />}
                <div>
                  <strong>{result.level === 'ok' ? T.roomFree : result.level === 'warn' ? T.possible : T.notPossible}</strong>
                  {result.messages.length > 0 && <ul>{result.messages.map((m, i) => <li key={i}>{m.text}</li>)}</ul>}
                  {result.suggestion && <div><button type="button" className="btn btn-sm" onClick={() => {
                    const s = result.suggestion!; const d = berlinYmd(s.start);
                    setF((v) => ({ ...v, date: d, start: berlinHm(s.start), end: berlinHm(s.end) })); if (monthStart(d) !== month) setMonth(monthStart(d));
                  }}>{result.suggestion.label}</button></div>}
                </div>
              </div>
            )}
            {f.date && cat && !cat.isParty && result?.level !== 'block' && (
              <div className={`repeat-box${seriesOn ? ' on' : ''}`}>
                <label className="check-inline"><input type="checkbox" checked={repeat.on} onChange={(e) => setRepeat((r) => ({ ...r, on: e.target.checked }))} />
                  <span><b>{T.repeatLabel}</b> <span className="muted small">{T.repeatHint}</span></span></label>
                {seriesOn && (<>
                  <div className="inline" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div className="segmented" role="group">{(['weekly', 'biweekly'] as const).map((fq) => <button type="button" key={fq} aria-pressed={repeat.freq === fq} onClick={() => setRepeat((r) => ({ ...r, freq: fq }))}>{T[fq]}</button>)}</div>
                    <select aria-label={T.dates} value={repeat.count} onChange={(e) => setRepeat((r) => ({ ...r, count: +e.target.value }))} style={{ width: 'auto' }}>
                      {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} {T.dates}</option>)}</select>
                  </div>
                  <ul className="repeat-list">{seriesPreview.map((p) => (
                    <li key={p.date} className={p.state}><span>{fmtDay(p.start, lang)}</span><span className="small">{p.state === 'taken' ? T.repeatTaken : p.state === 'unknown' ? T.repeatCheck : berlinHm(p.start)}</span></li>
                  ))}</ul>
                  <p className="muted small">{T.repeatNote}</p>
                </>)}
              </div>
            )}
            {err('date') && <p className="field-error">{err('date')}</p>}
            {result?.level === 'block' && draft && catId && result.messages.some((m) => WAITABLE.has(m.code)) && !result.messages.some((m) => !WAITABLE.has(m.code) && m.level === 'block') && (
              <div className="card card-body stack-sm" style={{ boxShadow: 'none' }}>
                {wait.state === 'done' ? (
                  <p className="free-day"><CircleCheck className="icon-sm" />{T.waitDone}</p>
                ) : !wait.open ? (
                  <div className="between"><span className="small"><b>{T.waitAsk}</b> {T.waitAskText}</span>
                    <button type="button" className="btn btn-sm" onClick={() => setWait((w) => ({ ...w, open: true }))}><BellRing className="icon-sm" />{T.waitJoin}</button></div>
                ) : (
                  <>
                    <span className="small"><b>{T.waitlist}</b> {T.waitFor(dayLabel(f.date), `${f.start}–${f.end}${uhr}`)} {T.waitNote}</span>
                    <div className="row">
                      <div className="field"><label htmlFor="w-name">{T.name}</label><input id="w-name" type="text" value={f.name} onChange={set('name')} autoComplete="name" /></div>
                      <div className="field"><label htmlFor="w-email">{T.email}</label><input id="w-email" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
                    </div>
                    {wait.state === 'error' && <span className="field-error">{wait.msg}</span>}
                    <div><button type="button" className="btn btn-primary btn-sm" disabled={wait.state === 'busy'} onClick={async () => {
                      setWait((w) => ({ ...w, state: 'busy' }));
                      const res = await fetch('/api/warteliste', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ categoryId: catId, date: f.date, start: f.start, end: f.end, name: f.name.trim(), email: f.email.trim(), website: f.website, elapsed: Date.now() - loadedAt, turnstile: captcha, lang }) }).catch(() => null);
                      const j = res ? await res.json().catch(() => ({})) : {};
                      setWait(res?.ok ? { open: true, state: 'done', msg: '' } : { open: true, state: 'error', msg: j.error ?? T.waitFailed });
                    }}>{wait.state === 'busy' ? T.waitBusy : T.waitSubmit}</button></div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="step-body fade-in">
            <div><h2>{T.whoTitle}</h2><p className="lead">{T.whoLead}</p></div>
            <div className="segmented" role="group" aria-label={T.memberOrExt}>
              <button type="button" aria-pressed={bookerType === 'member'} onClick={() => setBookerType('member')}>{T.member}</button>
              <button type="button" aria-pressed={bookerType === 'external'} onClick={() => setBookerType('external')}>{T.external}</button>
            </div>
            <div className="row">
              <div className="field"><label htmlFor="f-name" className="req">{T.fullName}</label><input type="text" id="f-name" autoComplete="name" value={f.name} onChange={set('name')} className={err('name') ? 'invalid' : ''} />{err('name') && <span className="field-error">{err('name')}</span>}</div>
              {bookerType === 'member' && <div className="field"><label htmlFor="f-team" className="req">{T.team}</label><input type="text" id="f-team" value={f.team} onChange={set('team')} placeholder={T.teamPh} className={err('team') ? 'invalid' : ''} />{err('team') && <span className="field-error">{err('team')}</span>}</div>}
            </div>
            <div className="row">
              <div className="field"><label htmlFor="f-email" className="req">{T.email}</label><input type="email" id="f-email" autoComplete="email" value={f.email} onChange={set('email')} className={err('email') ? 'invalid' : ''} />{err('email') && <span className="field-error">{err('email')}</span>}</div>
              <div className="field"><label htmlFor="f-phone" className="req">{T.phone}</label><input type="tel" id="f-phone" autoComplete="tel" value={f.phone} onChange={set('phone')} className={err('phone') ? 'invalid' : ''} />{err('phone') && <span className="field-error">{err('phone')}</span>}</div>
            </div>
            <div className="hp" aria-hidden="true"><label htmlFor="f-website">Website</label><input type="text" id="f-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
            {(fees.rent > 0 || fees.deposit > 0) && <div className="alert alert-info"><CalendarCheck className="icon" /><div>{T.feeInfo(fees.rent > 0 ? eur(fees.rent) : '', fees.deposit > 0 ? eur(fees.deposit) : '')}</div></div>}
          </div>
        )}

        {step === 3 && (
          <div className="step-body fade-in">
            <div><h2>{T.checkTitle}</h2><p className="lead">{T.checkLead}</p></div>
            {cat && draft && (
              <dl className="kv">
                <dt>{T.occasion}</dt><dd><b>{f.title}</b> · {cl(cat).name}</dd>
                <dt>{T.appointment}</dt><dd>{fmtLong(draft.start, lang)}, {f.start}–{f.end}{uhr}{berlinYmd(draft.end) !== f.date ? ` (${T.until} ${fmtDay(draft.end, lang)})` : ''}</dd>
                <dt>{T.people}</dt><dd>{f.guests}</dd>
                <dt>{T.contact}</dt><dd>{f.name}{bookerType === 'member' ? `, ${f.team}` : ' ' + T.notMember}<br />{f.email} · {f.phone}</dd>
                {f.note && <><dt>{T.message}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{f.note}</dd></>}
              </dl>
            )}
            <div className="stack-sm">
              <div className={`choice important${err('agree') ? ' invalid' : ''}`}>
                <input type="checkbox" id="f-agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <div className="stack-sm">
                  <label htmlFor="f-agree"><b>{T.agree}</b> {T.agreeNote}</label>
                  <div className="chips" role="radiogroup" aria-label={T.agreedWith}>
                    {PEOPLE.map((p) => <label key={p} className="chip"><input type="radio" name="who" checked={who === p} onChange={() => { setWho(p); setAgree(true); }} />{p}</label>)}
                  </div>
                </div>
              </div>
              {err('agree') && <span className="field-error">{err('agree')}</span>}
              <label className={`choice${err('rules') ? ' invalid' : ''}`} htmlFor="f-rules">
                <input type="checkbox" id="f-rules" checked={rules} onChange={(e) => setRules(e.target.checked)} />
                <span>{T.rulesA}<a href="/raum#hausordnung" target="_blank">{T.rulesLink}</a>{T.rulesB}<a href="/raum#datenschutz" target="_blank">{T.privacyLink}</a>{T.rulesC}</span>
              </label>
              {err('rules') && <span className="field-error">{err('rules')}</span>}
            </div>
            <Turnstile siteKey={turnstileKey} onToken={onCaptcha} />
            {serverError && <div className="alert alert-bad"><XCircle className="icon" /><div>{serverError}</div></div>}
          </div>
        )}

        <div className="step-actions">
          {step > 0 ? <button type="button" className="btn" onClick={() => go(step - 1)}><ArrowLeft className="icon-sm" />{T.back}</button> : <span />}
          {step < 3
            ? <button type="button" className="btn btn-primary" onClick={() => go(step + 1)} disabled={step === 1 && result?.level === 'block'}>{T.next}<ArrowRight className="icon-sm" /></button>
            : <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>{busy ? T.sending : T.submit}</button>}
        </div>
      </section>
      {Summary}
    </div>
  );
}
