'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BellRing, CalendarCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleCheck, Ellipsis,
  GraduationCap, Megaphone, PartyPopper, Shirt, Users, XCircle,
} from 'lucide-react';
import { Blackout, Category, CheckResult, Settings, Slot, blackoutWhen, checkBooking, partyWeekendOf } from '@/lib/rules';
import { MIN, addDays, berlinHm, berlinToUtc, berlinYmd, fmtDay, fmtLong, weekdayOf } from '@/lib/time';

type Fees = { rent: number; deposit: number };
export type Occupancy = {
  categories: Category[]; settings: Settings; slots: Slot[]; blackouts: Blackout[];
  equipment: string[]; feesExternal: Fees; feesMemberParty: Fees;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  meet: Users, team: Shirt, event: Megaphone, work: GraduationCap, party: PartyPopper, misc: Ellipsis,
};
const PEOPLE = ['Michael Grieswelle', 'Sigrid Brodig'];
const STEPS = ['Anlass', 'Termin', 'Kontakt', 'Prüfen'];
const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
const monthStart = (k: string) => k.slice(0, 8) + '01';
const shiftMonth = (k: string, n: number) => {
  const [y, m] = k.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
const monthLabel = (k: string) => new Date(k + 'T12:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (k: string) => new Date(k + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const toMin = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3);
const toHm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const START_OPTIONS = Array.from({ length: (23 - 7) * 4 + 4 }, (_, i) => toHm(7 * 60 + i * 15));
const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2);

type Done = { number: string; email: string };

export type Prefill = { date?: string; start?: string; end?: string; categoryId?: string };
const WAITABLE = new Set(['overlap', 'buffer', 'party-weekend', 'blackout']);

export default function BookingApp({ initial, initialMonth, contactNote, prefill = {} }: { initial: Occupancy; initialMonth: string; contactNote: string; prefill?: Prefill }) {
  const [data, setData] = useState(initial);
  const [month, setMonth] = useState(initialMonth);
  const [now, setNow] = useState(() => Date.now());
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [catId, setCatId] = useState<string | null>(prefill.categoryId ?? null);
  const [f, setF] = useState({ title: '', guests: '20', note: '', date: prefill.date ?? '', start: prefill.start ?? '18:00', end: prefill.end ?? '22:00', name: '', team: '', email: '', phone: '', website: '' });
  const [wait, setWait] = useState<{ open: boolean; state: 'idle' | 'busy' | 'done' | 'error'; msg: string }>({ open: false, state: 'idle', msg: '' });
  const [equipment, setEquipment] = useState<string[]>([]);
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
  const result: CheckResult | null = useMemo(() => (draft && catId ? checkBooking({ ...draft, categoryId: catId }, { ...data, now }) : null), [draft, catId, data, now]);

  const endOptions = useMemo(() => {
    const s = toMin(f.start), max = (cat?.maxDurationMin ?? 16 * 60);
    return Array.from({ length: Math.floor(Math.min(max, 18 * 60) / 15) }, (_, i) => s + (i + 1) * 15).map((m) => ({ v: toHm(m), next: m >= 24 * 60 }));
  }, [f.start, cat]);
  useEffect(() => { if (!endOptions.some((o) => o.v === f.end)) setF((s) => ({ ...s, end: endOptions[Math.min(7, endOptions.length - 1)].v })); }, [endOptions, f.end]);

  // ---------- Validierung pro Schritt ----------
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email.trim());
  const stepErrors: Record<string, string>[] = [
    { ...(!catId && { cat: 'Bitte wähle aus, was ihr vorhabt.' }), ...(f.title.trim().length < 2 && { title: 'Bitte gib einen Anlass an.' }), ...(!(+f.guests >= 1) && { guests: 'Bitte schätze die Personenzahl.' }) },
    { ...(!f.date && { date: 'Bitte wähle einen Tag im Kalender.' }), ...(result?.level === 'block' && { time: 'Der gewählte Zeitraum ist nicht frei.' }) },
    { ...(f.name.trim().length < 2 && { name: 'Bitte gib deinen Namen an.' }), ...(!emailOk && { email: 'Bitte gib eine gültige E-Mail-Adresse an.' }),
      ...(f.phone.trim().length < 4 && { phone: 'Bitte gib eine Telefonnummer für Rückfragen an.' }), ...(bookerType === 'member' && !f.team.trim() && { team: 'Bitte gib deine Mannschaft oder Abteilung an.' }) },
    { ...(!(agree && who) && { agree: 'Bitte bestätige die Absprache und wähle die Person aus.' }), ...(!rules && { rules: 'Bitte akzeptiere Hausordnung und Datenschutz.' }) },
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
          phone: f.phone.trim(), agreedWith: who, agreed: agree, rulesAccepted: rules, website: f.website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { setDone({ number: json.number, email: f.email.trim() }); topRef.current?.scrollIntoView({ block: 'start' }); load(month); }
      else if (res.status === 409) { await load(month); setStep(1); setServerError('Der Zeitraum wurde gerade vergeben: ' + (json.check?.messages?.[0]?.text ?? 'bitte wähle eine andere Zeit.')); }
      else setServerError(json.error ?? 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es gleich noch einmal.');
    } catch {
      setServerError('Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.');
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
  const availability = !result ? null : result.level;

  // ---------- Darstellung ----------
  const Summary = (
    <aside className="aside">
      <section className="card summary" aria-labelledby="sum-h">
        <div className="card-head"><h2 id="sum-h">Deine Anfrage</h2>
          {availability && <span className={`badge b-${availability === 'block' ? 'bad' : availability === 'warn' ? 'warn' : 'ok'}`}>{availability === 'block' ? 'nicht verfügbar' : availability === 'warn' ? 'mit Hinweisen' : 'verfügbar'}</span>}
        </div>
        <div className="card-body" style={{ paddingBlock: 6 }}>
          <dl>
            <div className="item"><dt>Anlass</dt><dd className={f.title ? '' : 'tbd'}>{f.title || 'noch offen'}</dd></div>
            <div className="item"><dt>Art</dt><dd className={cat ? '' : 'tbd'}>{cat ? <span className="catdot" style={{ '--c': cat.color } as React.CSSProperties}>{cat.name}</span> : 'noch offen'}</dd></div>
            <div className="item"><dt>Datum</dt><dd className={f.date ? '' : 'tbd'}>{f.date ? dayLabel(f.date) : 'noch offen'}</dd></div>
            <div className="item"><dt>Uhrzeit</dt><dd className={f.date ? 'num' : 'tbd'}>{f.date && draft ? `${f.start}–${f.end} Uhr${berlinYmd(draft.end) !== f.date ? ' (Folgetag)' : ''}` : 'noch offen'}</dd></div>
            {cat && draft && <div className="item"><dt>Reserviert</dt><dd className="num" style={{ fontWeight: 400 }}>{berlinHm(draft.start - cat.bufferBefore * MIN)}–{berlinHm(draft.end + cat.bufferAfter * MIN)} Uhr<br /><span className="muted small">inkl. Auf- und Abbau</span></dd></div>}
            <div className="item"><dt>Personen</dt><dd className="num">{f.guests || '–'}</dd></div>
            {equipment.length > 0 && <div className="item"><dt>Ausstattung</dt><dd style={{ fontWeight: 400 }}>{equipment.join(', ')}</dd></div>}
            {(fees.rent > 0 || fees.deposit > 0) && <div className="item"><dt>Kosten</dt><dd style={{ fontWeight: 400 }}>{fees.rent > 0 && <>Nutzungsentgelt {eur(fees.rent)}<br /></>}{fees.deposit > 0 && <>Kaution {eur(fees.deposit)} <span className="muted small">(zurück nach Abnahme)</span></>}</dd></div>}
          </dl>
        </div>
      </section>
      <section className="card card-body stack">
        <h2 className="section-title">Ansprechpartner</h2>
        {PEOPLE.map((p) => <div className="contact" key={p}><span className="avatar">{initials(p)}</span><div><b>{p}</b><br /><span className="muted small">Vorab-Absprache und Schlüssel</span></div></div>)}
        {contactNote && <p className="muted small">{contactNote}</p>}
      </section>
      <section className="card card-body stack">
        <h2 className="section-title">So geht es weiter</h2>
        <ol className="next-steps">
          <li>Du bestätigst deine E-Mail-Adresse über den Link in unserer Mail.</li>
          <li>Das Orga-Team prüft die Anfrage. Besprechungen von Mitgliedern werden direkt eingetragen.</li>
          <li>Du bekommst die Bestätigung mit Kalendereintrag und eine Erinnerung vor dem Termin.</li>
        </ol>
      </section>
    </aside>
  );

  if (done) {
    return (
      <div className="wrap booking-layout" ref={topRef}>
        <section className="card fade-in">
          <div className="done-view">
            <span className="seal"><CheckCircle2 className="icon" /></span>
            <div><span className="eyebrow">Anfrage <span className="refno">{done.number}</span></span><h2>Bitte bestätige noch deine E-Mail-Adresse</h2></div>
            <p>Wir haben eine Mail an <b>{done.email}</b> geschickt. Erst mit deiner Bestätigung geht die Anfrage an das Orga-Team. Ohne Bestätigung verfällt sie nach 24 Stunden.</p>
            <p className="muted small">Keine Mail bekommen? Schau bitte im Spam-Ordner nach.</p>
            <button className="btn" onClick={reset}>Weitere Anfrage stellen</button>
          </div>
        </section>
        {Summary}
      </div>
    );
  }

  return (
    <div className="wrap booking-layout" ref={topRef} style={{ scrollMarginTop: 90 }}>
      <section className="card" aria-label="Anfrage stellen">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" disabled={i > reached} onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>
                <span className="n">{i < step ? <Check className="icon-sm" /> : i + 1}</span>{s}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="step-body fade-in">
            <div><h2>Was habt ihr vor?</h2><p className="lead">Davon hängen Vorbereitungszeit und Freigabe ab.</p></div>
            <div className="options" role="group" aria-label="Art der Nutzung">
              {data.categories.map((c) => {
                const I = ICONS[c.id] ?? Ellipsis;
                return (
                  <button type="button" key={c.id} className="option" aria-pressed={c.id === catId} onClick={() => setCatId(c.id)} style={{ '--c': c.color } as React.CSSProperties}>
                    <span className="ico"><I className="icon" /></span><b>{c.name}</b><small>{c.hint}</small>
                  </button>
                );
              })}
            </div>
            {err('cat') && <p className="field-error">{err('cat')}</p>}
            <div className="row">
              <div className="field span-2"><label htmlFor="f-title" className="req">Anlass</label>
                <input type="text" id="f-title" maxLength={80} value={f.title} onChange={set('title')} className={err('title') ? 'invalid' : ''} placeholder={cat?.isParty ? 'z. B. 40. Geburtstag' : 'z. B. Mannschaftssitzung D2'} />
                {err('title') && <span className="field-error">{err('title')}</span>}</div>
              <div className="field"><label htmlFor="f-guests" className="req">Personen (ca.)</label>
                <input type="number" id="f-guests" min={1} max={200} value={f.guests} onChange={set('guests')} className={err('guests') ? 'invalid' : ''} />
                {+f.guests > data.settings.capacity && <span className="hint" style={{ color: 'var(--warn)' }}>Zugelassen sind höchstens {data.settings.capacity} Personen.</span>}</div>
            </div>
            {data.equipment.length > 0 && (
              <div className="field"><span className="label">Was braucht ihr? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
                <div className="chips">{data.equipment.map((e) => (
                  <button type="button" key={e} className="chip" aria-pressed={equipment.includes(e)} onClick={() => setEquipment((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]))}>{e}</button>
                ))}</div></div>
            )}
            <div className="field"><label htmlFor="f-note">Nachricht ans Orga-Team <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea id="f-note" maxLength={500} value={f.note} onChange={set('note')} placeholder="Was ist geplant? Gibt es etwas, das wir wissen sollten?" />
              <span className="hint">{f.note.length}/500</span></div>
          </div>
        )}

        {step === 1 && (
          <div className="step-body fade-in">
            <div><h2>Wann braucht ihr den Raum?</h2><p className="lead">Wähle einen Tag. Belegte Zeiten siehst du rechts, Puffer für Auf- und Abbau rechnen wir automatisch ein.</p></div>
            {serverError && <div className="alert alert-bad"><XCircle className="icon" /><div>{serverError}</div></div>}
            <div className="when">
              <div>
                <div className="cal-nav">
                  <button type="button" className="iconbtn" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= monthStart(todayKey)} aria-label="Vorheriger Monat"><ChevronLeft className="icon" /></button>
                  <h3>{monthLabel(month)}</h3>
                  <button type="button" className="iconbtn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Nächster Monat"><ChevronRight className="icon" /></button>
                </div>
                <div className="month" role="grid" aria-label={monthLabel(month)}>
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <div className="dow" key={d}>{d}</div>)}
                  {cells.map((k) => {
                    const list = daySlots(k);
                    const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
                    // ganztägig gesperrt (für alle, oder für Feiern, wenn eine Feier gewählt ist)
                    const blocked = data.blackouts.some((b) => b.start <= ds && b.end >= de && (b.scope !== 'party' || cat?.isParty));
                    const wd = weekdayOf(k), fri = wd === 5 ? k : wd === 6 ? addDays(k, -1) : wd === 0 ? addDays(k, -2) : null;
                    const cls = ['dcell', k.slice(0, 7) !== month.slice(0, 7) && 'out', k === todayKey && 'today', k === f.date && 'sel', blocked && 'blocked'].filter(Boolean).join(' ');
                    return (
                      <button type="button" key={k} className={cls} disabled={k < todayKey || blocked} onClick={() => { setF((s) => ({ ...s, date: k })); if (monthStart(k) !== month) setMonth(monthStart(k)); }}
                        aria-label={`${dayLabel(k)}: ${blocked ? 'gesperrt' : list.length ? `${list.length} Termin(e)` : 'frei'}`} aria-pressed={k === f.date}>
                        {fri && partyWeekends.has(fri) && <span className="pw-flag" title="Feier am Wochenende eingetragen" />}
                        <span className="d">{+k.slice(8)}</span>
                        <span className="dots">{list.slice(0, 3).map((s) => <i key={s.id} className={s.status !== 'confirmed' ? 'open' : ''} style={{ '--c': cats.get(s.categoryId)?.color } as React.CSSProperties} />)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <span><i style={{ '--c': 'var(--muted)' } as React.CSSProperties} />Termin eingetragen</span>
                  <span><i style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--muted)' }} />angefragt</span>
                  <span><i style={{ background: 'var(--gelb)' }} />Feier am Wochenende</span>
                  {data.blackouts.length > 0 && <span><i style={{ background: 'repeating-linear-gradient(135deg, transparent 0 2px, var(--bad) 2px 3px)' }} />gesperrt</span>}
                </div>
              </div>

              <div className="dayplan">
                {!f.date ? <p className="muted small" style={{ paddingTop: 6 }}>Wähle links einen Tag aus.</p> : (
                  <>
                    <h3>{dayLabel(f.date)}</h3>
                    {dayBlocks(f.date).map((b) => (
                      <div key={b.id} className="alert alert-bad" style={{ padding: '8px 10px' }}><div className="small"><strong>{b.scope === 'party' ? 'Keine Feiern' : 'Gesperrt'}</strong> {blackoutWhen(b)}: {b.reason}</div></div>
                    ))}
                    {daySlots(f.date).length ? (
                      <ul className="busy">{daySlots(f.date).map((s) => (
                        <li key={s.id} style={{ '--c': cats.get(s.categoryId)?.color } as React.CSSProperties}><span className="t">{berlinHm(s.start)}–{berlinHm(s.end)}</span><span>{s.status === 'confirmed' ? 'belegt' : 'angefragt'}</span></li>
                      ))}</ul>
                    ) : <p className="free-day"><CircleCheck className="icon-sm" />Noch keine Termine an diesem Tag</p>}
                    <div className="row" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
                      <div className="field"><label htmlFor="f-start">Von</label>
                        <select id="f-start" value={f.start} onChange={set('start')}>{START_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
                      <div className="field"><label htmlFor="f-end">Bis</label>
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
                  <strong>{result.level === 'ok' ? 'Der Raum ist frei.' : result.level === 'warn' ? 'Möglich, bitte beachte:' : 'Zu dieser Zeit leider nicht möglich.'}</strong>
                  {result.messages.length > 0 && <ul>{result.messages.map((m, i) => <li key={i}>{m.text}</li>)}</ul>}
                  {result.suggestion && <div><button type="button" className="btn btn-sm" onClick={() => {
                    const s = result.suggestion!; const d = berlinYmd(s.start);
                    setF((v) => ({ ...v, date: d, start: berlinHm(s.start), end: berlinHm(s.end) })); if (monthStart(d) !== month) setMonth(monthStart(d));
                  }}>{result.suggestion.label}</button></div>}
                </div>
              </div>
            )}
            {err('date') && <p className="field-error">{err('date')}</p>}
            {result?.level === 'block' && draft && catId && result.messages.some((m) => WAITABLE.has(m.code)) && !result.messages.some((m) => !WAITABLE.has(m.code) && m.level === 'block') && (
              <div className="card card-body stack-sm" style={{ boxShadow: 'none' }}>
                {wait.state === 'done' ? (
                  <p className="free-day"><CircleCheck className="icon-sm" />Du stehst auf der Warteliste. Wir schreiben dir, sobald der Termin frei wird.</p>
                ) : !wait.open ? (
                  <div className="between"><span className="small"><b>Genau dieser Termin soll es sein?</b> Wir benachrichtigen dich, wenn er frei wird.</span>
                    <button type="button" className="btn btn-sm" onClick={() => setWait((w) => ({ ...w, open: true }))}><BellRing className="icon-sm" />Auf die Warteliste</button></div>
                ) : (
                  <>
                    <span className="small"><b>Warteliste</b> für {dayLabel(f.date)}, {f.start}–{f.end} Uhr. Ein frei gewordener Termin ist nicht reserviert: Wer zuerst anfragt, bekommt ihn.</span>
                    <div className="row">
                      <div className="field"><label htmlFor="w-name">Name</label><input id="w-name" type="text" value={f.name} onChange={set('name')} autoComplete="name" /></div>
                      <div className="field"><label htmlFor="w-email">E-Mail</label><input id="w-email" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
                    </div>
                    {wait.state === 'error' && <span className="field-error">{wait.msg}</span>}
                    <div><button type="button" className="btn btn-primary btn-sm" disabled={wait.state === 'busy'} onClick={async () => {
                      setWait((w) => ({ ...w, state: 'busy' }));
                      const res = await fetch('/api/warteliste', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ categoryId: catId, date: f.date, start: f.start, end: f.end, name: f.name.trim(), email: f.email.trim(), website: f.website }) }).catch(() => null);
                      const j = res ? await res.json().catch(() => ({})) : {};
                      setWait(res?.ok ? { open: true, state: 'done', msg: '' } : { open: true, state: 'error', msg: j.error ?? 'Das hat nicht geklappt. Bitte versuch es noch einmal.' });
                    }}>{wait.state === 'busy' ? 'Wird eingetragen …' : 'Benachrichtigen, wenn frei'}</button></div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="step-body fade-in">
            <div><h2>Wer fragt an?</h2><p className="lead">Wir nutzen die Angaben nur für diese Buchung.</p></div>
            <div className="segmented" role="group" aria-label="Mitglied oder extern">
              <button type="button" aria-pressed={bookerType === 'member'} onClick={() => setBookerType('member')}>Vereinsmitglied</button>
              <button type="button" aria-pressed={bookerType === 'external'} onClick={() => setBookerType('external')}>Nicht im Verein</button>
            </div>
            <div className="row">
              <div className="field"><label htmlFor="f-name" className="req">Vor- und Nachname</label><input type="text" id="f-name" autoComplete="name" value={f.name} onChange={set('name')} className={err('name') ? 'invalid' : ''} />{err('name') && <span className="field-error">{err('name')}</span>}</div>
              {bookerType === 'member' && <div className="field"><label htmlFor="f-team" className="req">Mannschaft oder Abteilung</label><input type="text" id="f-team" value={f.team} onChange={set('team')} placeholder="z. B. D2-Jugend" className={err('team') ? 'invalid' : ''} />{err('team') && <span className="field-error">{err('team')}</span>}</div>}
            </div>
            <div className="row">
              <div className="field"><label htmlFor="f-email" className="req">E-Mail</label><input type="email" id="f-email" autoComplete="email" value={f.email} onChange={set('email')} className={err('email') ? 'invalid' : ''} />{err('email') && <span className="field-error">{err('email')}</span>}</div>
              <div className="field"><label htmlFor="f-phone" className="req">Telefon</label><input type="tel" id="f-phone" autoComplete="tel" value={f.phone} onChange={set('phone')} className={err('phone') ? 'invalid' : ''} />{err('phone') && <span className="field-error">{err('phone')}</span>}</div>
            </div>
            <div className="hp" aria-hidden="true"><label htmlFor="f-website">Website</label><input type="text" id="f-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
            {(fees.rent > 0 || fees.deposit > 0) && <div className="alert alert-info"><CalendarCheck className="icon" /><div>Für diese Nutzung fallen {fees.rent > 0 && <>ein Nutzungsentgelt von <b>{eur(fees.rent)}</b></>}{fees.rent > 0 && fees.deposit > 0 && ' und '}{fees.deposit > 0 && <>eine Kaution von <b>{eur(fees.deposit)}</b></>} an. Die Kaution bekommst du nach der Abnahme zurück.</div></div>}
          </div>
        )}

        {step === 3 && (
          <div className="step-body fade-in">
            <div><h2>Prüfen und absenden</h2><p className="lead">Kontrolliere deine Angaben in der Übersicht. Mit dem Absenden stellst du eine verbindliche Anfrage.</p></div>
            {cat && draft && (
              <dl className="kv">
                <dt>Anlass</dt><dd><b>{f.title}</b> · {cat.name}</dd>
                <dt>Termin</dt><dd>{fmtLong(draft.start)}, {f.start}–{f.end} Uhr{berlinYmd(draft.end) !== f.date ? ` (bis ${fmtDay(draft.end)})` : ''}</dd>
                <dt>Personen</dt><dd>{f.guests}</dd>
                <dt>Kontakt</dt><dd>{f.name}{bookerType === 'member' ? `, ${f.team}` : ' (nicht im Verein)'}<br />{f.email} · {f.phone}</dd>
                {f.note && <><dt>Nachricht</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{f.note}</dd></>}
              </dl>
            )}
            <div className="stack-sm">
              <div className={`choice important${err('agree') ? ' invalid' : ''}`}>
                <input type="checkbox" id="f-agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <div className="stack-sm">
                  <label htmlFor="f-agree"><b>Ich habe die Nutzung vorab mit Michael Grieswelle oder Sigrid Brodig abgesprochen.</b> Ohne vorherige Absprache ist die Buchung ungültig.</label>
                  <div className="chips" role="radiogroup" aria-label="Abgesprochen mit">
                    {PEOPLE.map((p) => <label key={p} className="chip"><input type="radio" name="who" checked={who === p} onChange={() => { setWho(p); setAgree(true); }} />{p}</label>)}
                  </div>
                </div>
              </div>
              {err('agree') && <span className="field-error">{err('agree')}</span>}
              <label className={`choice${err('rules') ? ' invalid' : ''}`} htmlFor="f-rules">
                <input type="checkbox" id="f-rules" checked={rules} onChange={(e) => setRules(e.target.checked)} />
                <span>Ich habe die <a href="/raum#hausordnung" target="_blank">Hausordnung</a> gelesen und akzeptiere sie. Die <a href="/raum#datenschutz" target="_blank">Datenschutzhinweise</a> habe ich zur Kenntnis genommen.</span>
              </label>
              {err('rules') && <span className="field-error">{err('rules')}</span>}
            </div>
            {serverError && <div className="alert alert-bad"><XCircle className="icon" /><div>{serverError}</div></div>}
          </div>
        )}

        <div className="step-actions">
          {step > 0 ? <button type="button" className="btn" onClick={() => go(step - 1)}><ArrowLeft className="icon-sm" />Zurück</button> : <span />}
          {step < 3
            ? <button type="button" className="btn btn-primary" onClick={() => go(step + 1)} disabled={step === 1 && result?.level === 'block'}>Weiter<ArrowRight className="icon-sm" /></button>
            : <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>{busy ? 'Wird gesendet …' : 'Anfrage verbindlich senden'}</button>}
        </div>
      </section>
      {Summary}
    </div>
  );
}
