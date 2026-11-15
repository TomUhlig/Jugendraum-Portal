'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Wie im System', Icon: Monitor },
  { value: 'light', label: 'Hell', Icon: Sun },
  { value: 'dark', label: 'Dunkel', Icon: Moon },
];

/** Umschalter Hell / Dunkel / System. Speichert die Wahl ein Jahr lang in einem Cookie. */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  function choose(t: Theme) {
    setTheme(t);
    const root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
  }
  const cur = OPTIONS.find((o) => o.value === theme)!;
  const next = OPTIONS[(OPTIONS.indexOf(cur) + 1) % OPTIONS.length];
  return (
    <>
      <div className="theme-switch" role="group" aria-label="Darstellung">
        {OPTIONS.map(({ value, label, Icon }) => (
          <button key={value} type="button" title={label} aria-label={label} aria-pressed={theme === value} onClick={() => choose(value)}><Icon className="icon-sm" /></button>
        ))}
      </div>
      {/* Handy: ein Knopf, der durchschaltet */}
      <button type="button" className="theme-cycle" title={`Darstellung: ${cur.label} (weiter: ${next.label})`} aria-label={`Darstellung: ${cur.label}. Wechseln zu ${next.label}`} onClick={() => choose(next.value)}><cur.Icon className="icon-sm" /></button>
    </>
  );
}
