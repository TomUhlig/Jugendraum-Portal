'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';

type Item = { id: string; label: string; when: 'before' | 'after' };
/** Abhakbare Checkliste auf der Buchungsseite; jeder Haken wird sofort gespeichert. */
export function Checklist({ token, items, initial, t }: { token: string; items: Item[]; initial: string[]; t: { title: string; hint: string; before: string; after: string; doneOf: string } }) {
  const [done, setDone] = useState<string[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (id: string) => {
    const on = !done.includes(id);
    setDone((d) => (on ? [...d, id] : d.filter((x) => x !== id))); setBusy(id);
    const res = await fetch('/api/checkliste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, item: id, done: on }) }).catch(() => null);
    if (res?.ok) setDone((await res.json()).checklist); else setDone((d) => (on ? d.filter((x) => x !== id) : [...d, id]));
    setBusy(null);
  };
  const n = items.filter((i) => done.includes(i.id)).length;
  const pct = Math.round((n / Math.max(1, items.length)) * 100);
  return (
    <section className="card checklist">
      <div className="card-head"><div><h2>{t.title}</h2><p>{t.hint}</p></div><span className="cl-count num">{t.doneOf.replace('{a}', String(n)).replace('{b}', String(items.length))}</span></div>
      <div className="cl-bar" aria-hidden><i style={{ width: `${pct}%` }} /></div>
      <div className="card-body cl-groups">
        {(['before', 'after'] as const).map((w) => (
          <div key={w}><span className="eyebrow">{w === 'before' ? t.before : t.after}</span>
            <ul>{items.filter((i) => i.when === w).map((i) => {
              const on = done.includes(i.id);
              return <li key={i.id}><button type="button" className={on ? 'on' : ''} aria-pressed={on} disabled={busy === i.id} onClick={() => toggle(i.id)}><span className="cl-box">{on && <Check className="icon-sm" />}</span>{i.label}</button></li>;
            })}</ul></div>
        ))}
      </div>
    </section>
  );
}
