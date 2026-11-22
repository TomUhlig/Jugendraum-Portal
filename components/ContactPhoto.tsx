'use client';
import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

/** Kleines Profilfoto: wird im Browser quadratisch auf 160 px verkleinert und als WebP mitgeschickt. */
export function ContactPhoto({ name, initial, fallback, disabled }: { name: string; initial: string; fallback: string; disabled?: boolean }) {
  const [src, setSrc] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  async function pick(file: File) {
    const img = await createImageBitmap(file).catch(() => null); if (!img) return;
    const size = 160, c = document.createElement('canvas'); c.width = c.height = size;
    const s = Math.min(img.width, img.height);
    c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    let url = c.toDataURL('image/webp', 0.82);
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.82);
    setSrc(url);
  }
  return (
    <div className="cphoto">
      <button type="button" className="cphoto-btn" onClick={() => input.current?.click()} disabled={disabled} aria-label="Foto wählen">
        {src ? <img src={src} alt="" /> : <span>{fallback || <Camera className="icon-sm" />}</span>}
      </button>
      {src && !disabled && <button type="button" className="cphoto-x" onClick={() => setSrc('')} aria-label="Foto entfernen"><X className="icon-sm" /></button>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
      <input type="hidden" name={name} value={src} />
    </div>
  );
}
