'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Blackout, Category, CheckResult, Settings, Slot, checkBooking, partyWeekendOf } from '@/lib/rules';
import { MIN, addDays, berlinHm, berlinToUtc, berlinYmd, fmtDay, weekdayOf } from '@/lib/time';

export type Occupancy = { categories: Category[]; settings: Settings; slots: Slot[]; blackouts: Blackout[] };

const ICON: Record<string, string> = {
  meet: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  team: '<circle cx="12" cy="12" r="10"/><path d="m12 7 4 3-1.5 5h-5L8 10z"/>',
  event: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  work: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  party: '<path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.2.8a3 3 0 0 0-2 3.4l.1.4M11 13c1.9 1.9 2.6 4.4 1.8 5.2-.8.8-3.4.1-5.3-1.8C5.6 14.5 5 12 5.8 11.2 6.6 10.4 9.1 11.1 11 13z"/>',
  misc: '<circle cx="12" cy="12" r="10"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
};
const PEOPLE = ['Michael Grieswelle', 'Sigrid Brodig'];
const monthStart = (key: string) => key.slice(0, 8) + '01';
const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
const monthLabel = (key: string) => new Date(key + 'T12:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

type Ticket = { number: string; email: string; title: string; start: number; end: number; category: string; agreedWith: string };

export default function BookingApp({ initial, initialMonth }: { initial: Occupancy; initialMonth: string }) {
  const [data, setData] = useState<Occupancy>(initial);
  const [month, setMonth] = useState(initialMonth);
  const [now, setNow] = useState(() => Date.now());
  const [f, setF] = useState({ date: '', start: '18:00', end: '22:00', title: '', guests: '20', note: '', name: '', team: '', email: '', phone: '', website: '' });
  const [catId, setCatId] = useState<string | null>(null);
  const [bookerType, setBookerType] = useState<'member' | 'external'>('member');
  const [agree, setAgree] = useState(false);
  const [who, setWho] = useState('');
  const [rules, setRules] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (m: string) => {
    const from = berlinToUtc(addDays(m, -7), '00:00'), to = berlinToUtc(addDays(shiftMonth(m, 1), 7), '00:00');
    const res = await fetch(`/api/belegung?from=${from}&to=${to}`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { if (month !== initialMonth) load(month); }, [month, initialMonth, load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (ticket) closeRef.current?.focus(); }, [ticket]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const cats = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const cat = catId ? cats.get(catId) : undefined;

  const draft = useMemo(() => {
    if (!f.date || !/^\d\d:\d\d$/.test(f.start) || !/^\d\d:\d\d$/.test(f.end)) return null;
    const start = berlinToUtc(f.date, f.start);
    let end = berlinToUtc(f.date, f.end);
    if (end <= start) end = berlinToUtc(addDays(f.date, 1), f.end);
    return { start, end, guests: +f.guests || 0 };
  }, [f.date, f.start, f.end, f.guests]);

  const result: CheckResult | null = useMemo(() => {
    if (!draft || !catId) return null;
    return checkBooking({ ...draft, categoryId: catId }, { ...data, now });
  }, [draft, catId, data, now]);

  function moveTo(start: number, end: number) {
    const date = berlinYmd(start);
    setF((s) => ({ ...s, date, start: berlinHm(start), end: berlinHm(end) }));
    if (monthStart(date) !== month) setMonth(monthStart(date));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, boolean> = {};
    const missing: string[] = [];
    const need: [keyof typeof f, string][] = [['title', 'Anlass'], ['name', 'Name'], ['email', 'E-Mail'], ['phone', 'Telefon']];
    if (bookerType === 'member') need.push(['team', 'Mannschaft/Abteilung']);
    for (const [k, l] of need) if (!f[k].trim()) { errs[k] = true; missing.push(l); }
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) { errs.email = true; missing.push('gültige E-Mail'); }
    if (!catId) missing.push('Kategorie');
    if (!agree || !who) { errs.agree = true; missing.push('Absprache mit Michael Grieswelle oder Sigrid Brodig (Haken und Person)'); }
    if (!rules) { errs.rules = true; missing.push('Hausordnung'); }
    if (!draft || result?.level === 'block') missing.push('einen freien Zeitraum');
    setErrors(errs);
    if (missing.length) { setFormError('Bitte noch ergänzen: ' + missing.join(', ') + '.'); return; }
    setFormError(''); setBusy(true);
    try {
      const res = await fetch('/api/buchungen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: catId, title: f.title.trim(), note: f.note.trim(), date: f.date, start: f.start, end: f.end,
          guests: +f.guests || 1, bookerType, team: bookerType === 'member' ? f.team.trim() : '', name: f.name.trim(),
          email: f.email.trim(), phone: f.phone.trim(), agreedWith: who, agreed: agree, rulesAccepted: rules, website: f.website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTicket({ number: json.number, email: f.email.trim(), title: f.title.trim(), start: draft!.start, end: draft!.end, category: cat!.name, agreedWith: who });
        setF((s) => ({ ...s, title: '', note: '' })); setAgree(false); setWho(''); setRules(false);
        load(month);
      } else if (res.status === 409) {
        setFormError('Der Termin ist inzwischen nicht mehr frei: ' + (json.check?.messages?.[0]?.text ?? 'bitte eine andere Zeit wählen.'));
        load(month);
      } else setFormError(json.error ?? 'Das hat nicht geklappt. Bitte versuch es gleich noch einmal.');
    } catch {
      setFormError('Keine Verbindung. Bitte prüfe dein Internet und versuch es noch einmal.');
    } finally { setBusy(false); }
  }

  // ---------- Kalender ----------
  const todayKey = berlinYmd(now);
  const partyWeekends = useMemo(() => new Set(data.slots.map((s) => partyWeekendOf(s.start, cats.get(s.categoryId), data.settings)).filter(Boolean)), [data, cats]);
  const cells = useMemo(() => {
    const lead = (weekdayOf(month) + 6) % 7;
    const first = addDays(month, -lead);
    const out: string[] = [];
    for (let i = 0; i < 42; i++) {
      const k = addDays(first, i);
      if (i >= 35 && k.slice(0, 7) !== month.slice(0, 7)) break;
      out.push(k);
    }
    return out;
  }, [month]);

  const status = !draft ? { cls: 'st-idle', head: 'Wähle Datum und Uhrzeit, dann prüfen wir sofort, ob der Raum frei ist.' }
    : !catId ? { cls: 'st-idle', head: 'Wähle noch aus, was ihr vorhabt. Davon hängen die Pufferzeiten ab.' }
    : { cls: 'st-' + result!.level, head: { ok: 'Frei! Der Raum ist zu dieser Zeit verfügbar.', warn: 'Möglich, aber bitte beachten:', block: 'So leider nicht möglich:' }[result!.level] };

  // Tagesleiste 08:00 bis 02:00
  const lineDate = f.date || todayKey;
  const w0 = berlinToUtc(lineDate, '08:00'), span = berlinToUtc(addDays(lineDate, 1), '02:00') - w0;
  const x = (t: number) => Math.max(0, Math.min(100, ((t - w0) / span) * 100));

  return (
    <div className="wrap grid">
      <section className="panel" aria-labelledby="cal-title">
        <span className="ribbon" id="cal-title">Belegung</span>
        <div className="cal-head">
          <button type="button" className="iconbtn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Vorheriger Monat">‹</button>
          <h3>{monthLabel(month)}</h3>
          <button type="button" className="iconbtn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Nächster Monat">›</button>
        </div>
        <div className="cal">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <div className="dow" key={d}>{d}</div>)}
          {cells.map((k) => {
            const ds = berlinToUtc(k, '00:00'), de = berlinToUtc(addDays(k, 1), '00:00');
            const list = data.slots.filter((s) => s.start >= ds && s.start < de).sort((a, b) => a.start - b.start);
            const wd = weekdayOf(k);
            const fri = wd === 5 ? k : wd === 6 ? addDays(k, -1) : wd === 0 ? addDays(k, -2) : null;
            const past = k < todayKey;
            const blackout = data.blackouts.some((b) => b.start < de && b.end > ds);
            const cls = ['day', k.slice(0, 7) !== month.slice(0, 7) && 'out', past && 'past', k === todayKey && 'today', k === f.date && 'sel',
              fri && partyWeekends.has(fri) && 'pw', blackout && 'bo'].filter(Boolean).join(' ');
            return (
              <button type="button" key={k} className={cls} disabled={past}
                onClick={() => { setF((s) => ({ ...s, date: k })); if (monthStart(k) !== month) setMonth(monthStart(k)); }}
                aria-label={`${new Date(k + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}: ${list.length ? list.length + ' Termin(e)' : blackout ? 'gesperrt' : 'frei'}`}>
                <span className="n">{+k.slice(8)}</span>
                {list.some((s) => cats.get(s.categoryId)?.isParty) && <span className="tag-party">Party</span>}
                {list.filter((s) => !cats.get(s.categoryId)?.isParty).map((s) => (
                  <span key={s.id} className={`pip ${s.status !== 'confirmed' ? 'pending' : ''}`} style={{ '--c': cats.get(s.categoryId)?.color } as React.CSSProperties} />
                ))}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span><i style={{ background: '#5B67C9' }} />Belegt</span>
          <span><i style={{ border: '1.5px dashed #5B67C9' }} />Angefragt</span>
          <span><i style={{ background: 'var(--gelb)' }} />Party</span>
          <span><i style={{ background: 'repeating-linear-gradient(135deg,var(--surface) 0 3px,var(--muted) 3px 4px)' }} />Party-Wochenende vergeben</span>
          <span><i style={{ background: 'repeating-linear-gradient(45deg,var(--surface) 0 3px,var(--belegt) 3px 4px)' }} />Gesperrt</span>
        </div>
        <div className="dayline">
          <h4>Tagesansicht {new Date(lineDate + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h4>
          <div className="track">
            {data.slots.filter((s) => s.end + 4 * 3600e3 > w0 && s.start - 3 * 3600e3 < w0 + span).map((s) => {
              const c = cats.get(s.categoryId); if (!c) return null;
              const st = { '--c': c.color } as React.CSSProperties;
              return (
                <span key={s.id}>
                  <div className="buf" style={{ ...st, left: x(s.start - c.bufferBefore * MIN) + '%', width: x(s.start) - x(s.start - c.bufferBefore * MIN) + '%' }} />
                  <div className="buf" style={{ ...st, left: x(s.end) + '%', width: x(s.end + c.bufferAfter * MIN) - x(s.end) + '%' }} />
                  <div className={`blk ${c.isParty ? 'party' : ''}`} style={{ ...st, left: x(s.start) + '%', width: x(s.end) - x(s.start) + '%', opacity: s.status === 'confirmed' ? 1 : 0.6 }}>
                    Belegt {berlinHm(s.start)}–{berlinHm(s.end)}
                  </div>
                </span>
              );
            })}
            {draft && result && <div className="draft" style={{ '--st': `var(--${{ ok: 'frei', warn: 'hinweis', block: 'belegt' }[result.level]})`, left: x(draft.start) + '%', width: x(draft.end) - x(draft.start) + '%' } as React.CSSProperties} />}
          </div>
          <div className="ticks"><span>08</span><span>11</span><span>14</span><span>17</span><span>20</span><span>23</span><span>02 Uhr</span></div>
          <div className="legend">
            <span><i style={{ background: 'repeating-linear-gradient(135deg,var(--muted) 0 2px,transparent 2px 4px)' }} />Puffer (Auf- und Abbau)</span>
            <span><i style={{ border: '2px solid var(--frei)' }} />Deine Anfrage</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <form className="booking" onSubmit={submit} noValidate>
          <fieldset>
            <legend><span className="step">1</span>Wann brauchst du den Raum?</legend>
            <div className="row">
              <div className="field"><label htmlFor="f-date">Datum</label><input type="date" id="f-date" min={todayKey} value={f.date} onChange={(e) => { set('date')(e); if (e.target.value) setMonth(monthStart(e.target.value)); }} required /></div>
              <div className="field"><label htmlFor="f-start">Von</label><input type="time" id="f-start" step={900} value={f.start} onChange={set('start')} required /></div>
              <div className="field"><label htmlFor="f-end">Bis</label><input type="time" id="f-end" step={900} value={f.end} onChange={set('end')} required />
                {draft && berlinYmd(draft.end) !== berlinYmd(draft.start) && <small>endet am {fmtDay(draft.end)}</small>}</div>
            </div>
          </fieldset>

          <fieldset>
            <legend><span className="step">2</span>Was habt ihr vor?</legend>
            <div className="cats" role="group" aria-label="Kategorie">
              {data.categories.map((c) => (
                <button type="button" key={c.id} className="cat" aria-pressed={c.id === catId} onClick={() => setCatId(c.id)}
                  style={{ '--cc': c.isParty ? 'var(--hinweis)' : c.color } as React.CSSProperties}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[c.id] ?? ICON.misc }} />
                  <b>{c.name}</b><small>{c.hint} · Puffer {c.bufferBefore}/{c.bufferAfter} min</small>
                </button>
              ))}
            </div>
            <div className="row">
              <div className="field span2"><label htmlFor="f-title">Anlass</label><input type="text" id="f-title" maxLength={80} className={errors.title ? 'invalid' : ''} value={f.title} onChange={set('title')} placeholder="z. B. 40. Geburtstag, Mannschaftssitzung D2" /></div>
              <div className="field"><label htmlFor="f-guests">Personen (ca.)</label><input type="number" id="f-guests" min={1} max={200} value={f.guests} onChange={set('guests')} /></div>
            </div>
            <div className="field"><label htmlFor="f-note">Notiz <small>(optional)</small></label><textarea id="f-note" maxLength={500} value={f.note} onChange={set('note')} placeholder="Was passiert genau? Brauchst du Beamer oder Musikanlage?" /></div>
          </fieldset>

          <div className={'status ' + status.cls} aria-live="polite">
            <div className="head"><span className="dot" />{status.head}</div>
            {result && result.messages.length > 0 && <ul>{result.messages.map((m, i) => <li key={i}>{m.text}</li>)}</ul>}
            {result && cat && draft && result.level !== 'block' && (
              <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
                Inklusive Puffer ist der Raum {berlinHm(draft.start - cat.bufferBefore * MIN)}–{berlinHm(draft.end + cat.bufferAfter * MIN)} Uhr für dich reserviert.{' '}
                {cat.requiresApproval || bookerType === 'external' ? 'Das Orga-Team bestätigt deine Anfrage.' : 'Für Mitglieder wird sie nach der E-Mail-Bestätigung direkt eingetragen.'}
              </div>
            )}
            {result?.suggestion && <button type="button" className="fix" onClick={() => moveTo(result.suggestion!.start, result.suggestion!.end)}>{result.suggestion.label}</button>}
          </div>

          <fieldset>
            <legend><span className="step">3</span>Wer bucht?</legend>
            <div className="seg" role="group" aria-label="Mitglied oder extern">
              <button type="button" aria-pressed={bookerType === 'member'} onClick={() => setBookerType('member')}>Vereinsmitglied</button>
              <button type="button" aria-pressed={bookerType === 'external'} onClick={() => setBookerType('external')}>Extern</button>
            </div>
            <div className="row">
              <div className="field"><label htmlFor="f-name">Name</label><input type="text" id="f-name" autoComplete="name" className={errors.name ? 'invalid' : ''} value={f.name} onChange={set('name')} placeholder="Vor- und Nachname" /></div>
              {bookerType === 'member' && <div className="field"><label htmlFor="f-team">Mannschaft / Abteilung</label><input type="text" id="f-team" className={errors.team ? 'invalid' : ''} value={f.team} onChange={set('team')} placeholder="z. B. D2-Jugend" /></div>}
            </div>
            <div className="row">
              <div className="field"><label htmlFor="f-email">E-Mail</label><input type="email" id="f-email" autoComplete="email" className={errors.email ? 'invalid' : ''} value={f.email} onChange={set('email')} placeholder="du@beispiel.de" /></div>
              <div className="field"><label htmlFor="f-phone">Telefon</label><input type="tel" id="f-phone" autoComplete="tel" className={errors.phone ? 'invalid' : ''} value={f.phone} onChange={set('phone')} placeholder="0521 …" /></div>
            </div>
            <div className="hp" aria-hidden="true"><label htmlFor="f-website">Website</label><input type="text" id="f-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
          </fieldset>

          <fieldset>
            <legend><span className="step">4</span>Bestätigen</legend>
            <div className={'check must' + (errors.agree ? ' invalid' : '')}>
              <input type="checkbox" id="f-agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <div>
                <label htmlFor="f-agree"><strong>Ich habe die Nutzung vorab mit Michael Grieswelle oder Sigrid Brodig abgesprochen.</strong> Ohne vorherige Absprache ist die Buchung ungültig.</label>
                <div className="who" role="radiogroup" aria-label="Abgesprochen mit">
                  {PEOPLE.map((p) => <label key={p}><input type="radio" name="who" value={p} checked={who === p} onChange={() => { setWho(p); setAgree(true); }} /> {p}</label>)}
                </div>
              </div>
            </div>
            <div className={'check' + (errors.rules ? ' invalid' : '')}>
              <input type="checkbox" id="f-rules" checked={rules} onChange={(e) => setRules(e.target.checked)} />
              <label htmlFor="f-rules">Ich akzeptiere die <a href="/regeln" target="_blank">Hausordnung</a> und die <a href="/regeln#datenschutz" target="_blank">Datenschutzhinweise</a>.</label>
            </div>
            {formError && <div className="err" role="alert">{formError}</div>}
          </fieldset>

          <button className="cta" type="submit" disabled={busy || result?.level === 'block'}>{busy ? 'Wird gesendet …' : 'Anfrage senden'}</button>
        </form>
      </section>

      {ticket && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setTicket(null); }} onKeyDown={(e) => e.key === 'Escape' && setTicket(null)}>
          <div className="ticket" role="dialog" aria-modal="true" aria-labelledby="t-h">
            <div className="top"><img src="/logo.png" alt="" /><div><b id="t-h">Fast geschafft!</b><span className="mono" style={{ opacity: .85 }}>{ticket.number}</span></div></div>
            <div className="body">
              <span className="stamp tilt s-requested">E-Mail bestätigen</span>
              <dl className="kv">
                <dt>Anlass</dt><dd>{ticket.title}</dd>
                <dt>Wann</dt><dd>{fmtDay(ticket.start)}<br /><span className="mono">{berlinHm(ticket.start)}–{berlinHm(ticket.end)} Uhr</span></dd>
                <dt>Kategorie</dt><dd>{ticket.category}</dd>
                <dt>Abgesprochen</dt><dd>{ticket.agreedWith}</dd>
              </dl>
            </div>
            <div className="perf" />
            <div className="body">
              <ol>
                <li>Wir haben dir eine Mail an <b>{ticket.email}</b> geschickt. Bestätige darin deine Anfrage. Ohne Bestätigung verfällt sie nach 24 Stunden.</li>
                <li>Danach prüft das Orga-Team deine Anfrage und meldet sich per Mail.</li>
                <li>3 Tage und 24 Stunden vorher erinnern wir dich an Termin und Schlüssel.</li>
              </ol>
              <div className="acts"><button className="btn primary" ref={closeRef} onClick={() => setTicket(null)}>Fertig</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
