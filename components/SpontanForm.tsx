'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Zap } from 'lucide-react';
import { checkBooking, type Blackout, type Category, type Settings, type Slot } from '@/lib/rules';
import { addDays, berlinHm, berlinToUtc, berlinYmd } from '@/lib/time';
import { Turnstile } from './Turnstile';

type Data = { categories: Category[]; settings: Settings; slots: Slot[]; blackouts: Blackout[]; roomId?: string };
const PEOPLE = ['Michael Grieswelle', 'Sigrid Brodig'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Kurzfristig buchen: freie Zeitfenster ab jetzt, Kontakt aus dem Gerät, ein Klick. Nur für Mitglieder. */
export function SpontanForm({ data, turnstileKey }: { data: Data; turnstileKey: string }) {
  const [loadedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const [cat, setCat] = useState<'meet' | 'team'>('meet');
  const [pick, setPick] = useState<{ start: number; end: number } | null>(null);
  const [f, setF] = useState({ title: '', guests: '8', name: '', team: '', email: '', phone: '', website: '' });
  const [who, setWho] = useState('');
  const [rules, setRules] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [state, setState] = useState<{ busy?: boolean; done?: string; error?: string }>({});
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('jr-kontakt') ?? 'null'); if (s) setF((x) => ({ ...x, name: s.name ?? '', team: s.team ?? '', email: s.email ?? '', phone: s.phone ?? '' })); } catch {}
  }, []);

  // Startzeiten ab der nächsten halben Stunde bis 22 Uhr, je 1, 2 und 3 Stunden
  const options = useMemo(() => {
    const today = berlinYmd(now), out: { start: number; end: number; label: string }[] = [];
    const first = Math.ceil((now + 15 * 60_000) / (30 * 60_000)) * 30 * 60_000;
    const limit = berlinToUtc(today, '22:00');
    for (let s = first; s <= limit && out.length < 12; s += 30 * 60_000) {
      for (const h of [1, 2, 3]) {
        const e = s + h * 3600_000; if (e > berlinToUtc(addDays(today, 1), '00:00')) continue;
        const r = checkBooking({ categoryId: cat, start: s, end: e, guests: +f.guests || 1 }, { ...data, now, asAdmin: false });
        if (r.level !== 'block' && !r.messages.some((m) => m.level === 'block')) { out.push({ start: s, end: e, label: `${berlinHm(s)}–${berlinHm(e)}` }); break; }
      }
    }
    return out.slice(0, 8);
  }, [now, cat, f.guests, data]);
  const busyNow = data.slots.some((s) => s.start <= now && s.end > now);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const ready = pick && f.name.trim().length > 1 && /@/.test(f.email) && f.phone.trim().length > 3 && f.team.trim() && who && rules;

  async function send() {
    if (!pick || !ready) return;
    setState({ busy: true });
    const date = berlinYmd(pick.start);
    const res = await fetch('/api/buchungen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      roomId: data.roomId, categoryId: cat, title: f.title.trim() || (cat === 'team' ? 'Spontaner Mannschaftsabend' : 'Spontanes Treffen'), note: 'Spontan über „Heute frei?“ angefragt',
      date, start: berlinHm(pick.start), end: berlinHm(pick.end), guests: +f.guests || 1, equipment: [], bookerType: 'member', team: f.team.trim(),
      name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), agreedWith: who, agreed: true, rulesAccepted: true, lang: 'de',
      website: f.website, elapsed: Date.now() - loadedAt, turnstile: captcha,
    }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) { try { localStorage.setItem('jr-kontakt', JSON.stringify({ name: f.name.trim(), team: f.team.trim(), email: f.email.trim(), phone: f.phone.trim(), bookerType: 'member' })); } catch {} setState({ done: j.number }); }
    else setState({ error: j.error ?? 'Das hat nicht geklappt. Bitte versuch es noch einmal.' });
  }

  if (state.done) return (
    <section className="card card-body stack spontan-done">
      <CheckCircle2 className="icon" /><h2>Fast geschafft: Mail bestätigen</h2>
      <p>Wir haben dir eine Mail an <b>{f.email}</b> geschickt. Ein Klick darauf, dann ist der Raum für dich eingetragen (Anfrage {state.done}).</p>
      <p className="muted small">Denk an den Schlüssel: kurz bei {who} melden.</p>
    </section>
  );
  return (
    <div className="stack">
      <section className={`card card-body spontan-status ${busyNow ? 'busy' : 'free'}`}>
        <Zap className="icon" /><div><b>{busyNow ? 'Gerade belegt' : 'Gerade frei'}</b><span className="muted small">{options.length ? `Heute noch ${options.length > 1 ? 'mehrere freie Zeiten' : 'eine freie Zeit'} für kurze Treffen` : 'Heute ist leider nichts mehr frei.'}</span></div>
      </section>
      {options.length > 0 && (<>
        <section className="card card-body stack-sm">
          <div className="segmented" role="group" style={{ justifySelf: 'start' }}>
            <button type="button" aria-pressed={cat === 'meet'} onClick={() => { setCat('meet'); setPick(null); }}>Besprechung</button>
            <button type="button" aria-pressed={cat === 'team'} onClick={() => { setCat('team'); setPick(null); }}>Mannschaftsabend</button>
          </div>
          <div className="spontan-slots">{options.map((o) => (
            <button type="button" key={o.start} aria-pressed={pick?.start === o.start} onClick={() => setPick(o)}><Clock className="icon-sm" />{o.label}</button>
          ))}</div>
          <span className="muted small">Kürzer oder länger? Die Zeiten lassen sich nachher mit dem Team abstimmen, oder <a href={`/?datum=${berlinYmd(now)}#anfrage`}>normal anfragen</a>.</span>
        </section>
        {pick && (
          <section className="card card-body stack-sm">
            <div className="row" style={{ gridTemplateColumns: '1fr 110px' }}>
              <div className="field"><label htmlFor="s-t">Anlass (optional)</label><input id="s-t" type="text" value={f.title} onChange={set('title')} placeholder={cat === 'team' ? 'Spontaner Mannschaftsabend' : 'Spontanes Treffen'} /></div>
              <div className="field"><label htmlFor="s-g">Personen</label><input id="s-g" type="number" min={1} max={data.settings.capacity} value={f.guests} onChange={set('guests')} /></div>
            </div>
            <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field"><label htmlFor="s-n" className="req">Name</label><input id="s-n" type="text" value={f.name} onChange={set('name')} autoComplete="name" /></div>
              <div className="field"><label htmlFor="s-m" className="req">Mannschaft / Abteilung</label><input id="s-m" type="text" value={f.team} onChange={set('team')} /></div>
              <div className="field"><label htmlFor="s-e" className="req">E-Mail</label><input id="s-e" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
              <div className="field"><label htmlFor="s-p" className="req">Telefon</label><input id="s-p" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
            </div>
            <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden />
            <span className="label small"><b>Mit wem hast du gesprochen?</b> (Pflicht, sonst ist die Buchung ungültig)</span>
            <div className="chips">{PEOPLE.map((p) => <button type="button" key={p} className="chip" aria-pressed={who === p} onClick={() => setWho(p)}>{p}</button>)}</div>
            <label className="choice"><input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} /><span className="small">Ich habe die <a href="/raum#hausordnung" target="_blank">Hausordnung</a> gelesen und akzeptiere sie.</span></label>
            {turnstileKey && <Turnstile siteKey={turnstileKey} onToken={setCaptcha} />}
            {state.error && <div className="alert alert-bad"><div>{state.error}</div></div>}
            <button type="button" className="btn btn-gelb" disabled={!ready || state.busy} onClick={send}><Zap className="icon-sm" />{berlinHm(pick.start)}–{berlinHm(pick.end)} anfragen</button>
          </section>
        )}
      </>)}
    </div>
  );
}
