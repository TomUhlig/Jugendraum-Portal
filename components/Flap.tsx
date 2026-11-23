'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Ziffern wie auf einer Fallblattanzeige: beim ersten Sichtbarwerden blättern sie kurz durch und bleiben dann stehen.
 * Server und erster Render zeigen sofort den echten Wert; ohne JavaScript oder bei reduzierter Bewegung bleibt es dabei.
 */
export function Flap({ value, delay = 0, className }: { value: string; delay?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    setShown(value);
    if (!ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const steps = 7;
    const run = () => {
      let n = 0;
      const tick = () => {
        n++;
        if (n > steps) { setShown(value); return; }
        setShown(value.replace(/\d/g, () => String(Math.floor(Math.random() * 10))));
        timer = setTimeout(tick, 60);
      };
      timer = setTimeout(tick, delay);
    };
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { io.disconnect(); run(); } }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [value, delay]);
  return (
    <span ref={ref} className={`flap${className ? ' ' + className : ''}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{[...shown].map((ch, i) => <span key={`${i}-${ch}`} className="flap-ch">{ch}</span>)}</span>
    </span>
  );
}
