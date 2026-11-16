'use client';
import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

/** Unterschriftenfeld für Finger oder Stift. Schreibt das Bild als PNG (data-URL) in ein verstecktes Feld. */
export function SignaturePad({ name, label = 'Hier unterschreiben' }: { name: string; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState('');
  const drawing = useRef(false);
  const dataRef = useRef('');
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    let w = 0;
    const fit = () => {
      const r = c.getBoundingClientRect();
      // Handy: Adressleiste ein-/ausblenden ändert nur die Höhe des Fensters, nicht das Feld. Nur bei echter Größenänderung neu aufbauen, Unterschrift behalten.
      if (Math.round(r.width) === w) return;
      w = Math.round(r.width);
      const prev = c.width ? c.toDataURL('image/png') : '';
      const hadInk = !!dataRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = r.width * dpr; c.height = r.height * dpr;
      const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#161A33'; ctx.lineWidth = 2.4;
      if (hadInk && prev) { const img = new Image(); img.onload = () => { ctx.drawImage(img, 0, 0, r.width, r.height); setData(c.toDataURL('image/png')); }; img.src = prev; }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => { dataRef.current = data; }, [data]);

  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { e.preventDefault(); canvas.current!.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvas.current!.getContext('2d')!, p = pos(e);
    ctx.lineWidth = e.pressure && e.pointerType === 'pen' ? 1.4 + e.pressure * 2.4 : 2.4;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; last.current = null; setData(canvas.current!.toDataURL('image/png')); canvas.current!.parentElement?.querySelector<HTMLInputElement>('.sig-value')?.setCustomValidity(''); };
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setData(''); };

  return (
    <div className="sigpad">
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={label} role="img" />
      {!data && <span className="sig-hint" aria-hidden>{label}</span>}
      <div className="sig-line" aria-hidden />
      <button type="button" className="btn btn-sm sig-clear" onClick={clear} disabled={!data}><Eraser className="icon-sm" />Löschen</button>
      {/* Unsichtbares Pflichtfeld: der Browser verhindert das Absenden ohne Unterschrift, eingegebene Daten bleiben erhalten */}
      <input className="sig-value" name={name} value={data} required onChange={() => {}} tabIndex={-1} aria-hidden
        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Bitte hier unterschreiben.')} onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')} />
    </div>
  );
}
