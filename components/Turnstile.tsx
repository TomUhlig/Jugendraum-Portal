'use client';
import { useEffect, useRef } from 'react';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void } } }

/** Cloudflare Turnstile (nur wenn ein Site-Key gesetzt ist). Meist unsichtbar, ohne Cookies. */
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let id: string | undefined;
    const render = () => { if (ref.current && window.turnstile) id = window.turnstile.render(ref.current, { sitekey: siteKey, language: 'de', callback: onToken, 'expired-callback': () => onToken(''), theme: 'auto' }); };
    if (window.turnstile) render();
    else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = render;
      document.head.appendChild(s);
    }
    return () => { if (id && window.turnstile) window.turnstile.remove(id); };
  }, [siteKey, onToken]);
  return siteKey ? <div ref={ref} /> : null;
}
