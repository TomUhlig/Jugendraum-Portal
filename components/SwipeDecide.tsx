'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

/**
 * Offene Anfrage auf dem Handy wischen: nach rechts bestätigen, nach links ablehnen (öffnet die Begründung).
 * Mit Maus oder Tastatur bleiben die normalen Knöpfe; Wischen ist nur eine Abkürzung für Touch.
 */
export function SwipeDecide({ id, canDecide, children }: { id: string; canDecide: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const root = useRef<HTMLLIElement>(null);
  const start = useRef<{ x: number; y: number; locked: 'x' | 'y' | null } | null>(null);
  const [dx, setDx] = useState(0);
  const [done, setDone] = useState<'ok' | 'no' | null>(null);
  if (!canDecide) return <li className="req-item">{children}</li>;
  const width = () => root.current?.offsetWidth ?? 360;
  const limit = () => width() * 0.38;

  function onDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch' || done) return;
    start.current = { x: e.clientX, y: e.clientY, locked: null };
  }
  function onMove(e: React.PointerEvent) {
    const s = start.current; if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.locked) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; s.locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; }
    if (s.locked === 'x') setDx(mx);
  }
  function onUp() {
    const s = start.current; start.current = null;
    if (!s || s.locked !== 'x') { setDx(0); return; }
    if (dx > limit()) {
      setDone('ok'); setDx(width());
      navigator.vibrate?.(15);
      root.current?.querySelector<HTMLFormElement>('form[data-swipe-confirm]')?.requestSubmit();
    } else if (dx < -limit()) {
      setDone('no'); setDx(-width());
      router.push(`/admin/buchung/${id}?ablehnen=1#reason`);
    } else setDx(0);
  }
  const p = Math.min(1, Math.abs(dx) / limit());
  return (
    <li ref={root} className={`req-item swipe${dx > 0 ? ' to-ok' : dx < 0 ? ' to-no' : ''}${p >= 1 ? ' armed' : ''}`} style={{ '--p': p } as React.CSSProperties}>
      <span className="swipe-bg ok" aria-hidden="true"><Check className="icon" />Bestätigen</span>
      <span className="swipe-bg no" aria-hidden="true">Ablehnen<X className="icon" /></span>
      <div className="swipe-card" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: start.current ? 'none' : undefined }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {children}
      </div>
    </li>
  );
}
