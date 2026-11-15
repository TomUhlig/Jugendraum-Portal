'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

type Item = { id: string; number: string; title: string; name: string; team: string; status: string; start: number; end: number };
const STATUS: Record<string, string> = { pending_email: 'unbestätigt', requested: 'angefragt', confirmed: 'bestätigt', rejected: 'abgelehnt', cancelled: 'storniert', expired: 'verfallen' };
const day = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Europe/Berlin' });
const hm = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

/** Suchfeld in der Seitenleiste, Tastenkürzel Strg/⌘+K oder „/“. */
export function QuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/suche?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (r.ok) { setItems((await r.json()).items); setSel(0); }
      } catch {}
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const go = (i: Item | undefined) => { if (!i) { if (q.trim()) router.push(`/admin/buchungen?q=${encodeURIComponent(q.trim())}`); } else router.push(`/admin/buchung/${i.id}`); setOpen(false); setQ(''); input.current?.blur(); };

  return (
    <div className="qs" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <label className="qs-box">
        <Search className="icon-sm" aria-hidden />
        <input ref={input} type="search" placeholder="Suchen …" aria-label="Buchungen suchen" value={q} autoComplete="off"
          role="combobox" aria-expanded={open && items.length > 0} aria-controls="qs-list"
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(items[sel]); }
            else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }} />
        <kbd>Strg K</kbd>
      </label>
      {open && q.trim().length >= 2 && (
        <ul className="qs-list" id="qs-list" role="listbox">
          {items.length === 0 && <li className="qs-empty">Nichts gefunden</li>}
          {items.map((i, n) => (
            <li key={i.id} role="option" aria-selected={n === sel}>
              <button type="button" className={n === sel ? 'on' : ''} onMouseEnter={() => setSel(n)} onClick={() => go(i)}>
                <b>{i.title}</b>
                <span>{day.format(i.start)} · {hm.format(i.start)}–{hm.format(i.end)}</span>
                <span>{i.name}{i.team ? `, ${i.team}` : ''} · <span className={`qs-st s-${i.status}`}>{STATUS[i.status] ?? i.status}</span> · {i.number}</span>
              </button>
            </li>
          ))}
          {items.length > 0 && <li><button type="button" className="qs-all" onClick={() => go(undefined)}>Alle Treffer in „Buchungen“ zeigen</button></li>}
        </ul>
      )}
    </div>
  );
}
