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
  return (
    <div className="theme-switch" role="group" aria-label="Darstellung">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" title={label} aria-label={label} aria-pressed={theme === value} onClick={() => choose(value)}><Icon className="icon-sm" /></button>
      ))}
    </div>
  );
}
