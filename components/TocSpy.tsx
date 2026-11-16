'use client';
import { useEffect } from 'react';

/** Markiert im Inhaltsverzeichnis den Abschnitt, der gerade gelesen wird. */
export function TocSpy() {
  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]'));
    const heads = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean) as HTMLElement[];
    const update = () => {
      let cur = heads[0]?.id;
      for (const h of heads) if (h.getBoundingClientRect().top < 140) cur = h.id;
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) cur = heads[heads.length - 1]?.id;
      for (const a of links) { const on = a.hash.slice(1) === cur; if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }
      const on = links.find((a) => a.hasAttribute('aria-current'));
      if (on && window.matchMedia('(max-width: 860px)').matches) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return null;
}
