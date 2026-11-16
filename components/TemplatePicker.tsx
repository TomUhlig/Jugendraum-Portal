'use client';
import { useState } from 'react';
import { MessageSquareQuote } from 'lucide-react';

/** Kleine Leiste mit Textbausteinen; ein Klick setzt den Text (mit eingesetzten Platzhaltern) ins Feld. */
export function TemplatePicker({ target, items }: { target: string; items: { title: string; text: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const insert = (text: string) => {
    const el = document.getElementById(target) as HTMLTextAreaElement | HTMLInputElement | null;
    if (!el) return;
    const proto = Object.getPrototypeOf(el); const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const next = el.value.trim() ? `${el.value.trim()}\n\n${text}` : text;
    setter?.call(el, next); el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus(); setOpen(false);
  };
  return (
    <div className="tpl">
      <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MessageSquareQuote className="icon-sm" />Textbaustein</button>
      {open && <div className="tpl-list" role="menu">{items.map((t) => (
        <button key={t.title} type="button" role="menuitem" onClick={() => insert(t.text)}><b>{t.title}</b><span>{t.text}</span></button>
      ))}</div>}
    </div>
  );
}
