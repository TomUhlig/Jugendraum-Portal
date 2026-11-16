'use client';
import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** „Als App speichern“: auf Android/Chrome per Knopf, auf dem iPhone mit kurzer Anleitung. Lässt sich wegklicken. */
export function InstallHint({ text }: { text: { title: string; body: string; button: string; ios: string; close: string } }) {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem('jr-install-hint') === 'aus') return; } catch {}
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos) { setIos(true); setHidden(false); }
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setHidden(false); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const close = () => { setHidden(true); try { localStorage.setItem('jr-install-hint', 'aus'); } catch {} };
  if (hidden) return null;
  return (
    <aside className="install-hint card">
      <Smartphone className="icon" />
      <div><b>{text.title}</b><p>{ios ? text.ios : text.body}</p>
        {evt && <button className="btn btn-sm btn-primary" onClick={async () => { await evt.prompt(); await evt.userChoice.catch(() => null); close(); }}>{text.button}</button>}</div>
      <button className="iconbtn" aria-label={text.close} onClick={close}><X className="icon-sm" /></button>
    </aside>
  );
}
