'use client';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export type GalleryPhoto = { id: string; width: number; height: number; caption: string };

/** Fotostreifen bzw. Raster mit Großansicht (Pfeiltasten, Escape). */
export function Gallery({ photos, variant = 'grid' }: { photos: GalleryPhoto[]; variant?: 'strip' | 'grid' }) {
  const [open, setOpen] = useState<number | null>(null);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length)), [photos.length]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);
  if (!photos.length) return null;
  const p = open !== null ? photos[open] : null;
  return (
    <>
      <div className={variant === 'strip' ? 'gallery-strip' : 'gallery-grid'}>
        {photos.map((ph, i) => (
          <button key={ph.id} type="button" className="gallery-item" onClick={() => setOpen(i)} aria-label={`Foto vergrößern${ph.caption ? ': ' + ph.caption : ''}`}>
            <img src={`/fotos/${ph.id}?g=klein`} alt={ph.caption || 'Foto vom Jugendraum'} loading="lazy" width={640} height={Math.round((640 * ph.height) / ph.width)} />
            {ph.caption && variant === 'grid' && <span>{ph.caption}</span>}
          </button>
        ))}
      </div>
      {p && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Fotoansicht" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <figure>
            <img src={`/fotos/${p.id}`} alt={p.caption || 'Foto vom Jugendraum'} />
            <figcaption>{p.caption}<span className="muted"> {open! + 1} / {photos.length}</span></figcaption>
          </figure>
          <button type="button" className="lb-btn lb-close" onClick={() => setOpen(null)} aria-label="Schließen"><X className="icon" /></button>
          {photos.length > 1 && <>
            <button type="button" className="lb-btn lb-prev" onClick={() => go(-1)} aria-label="Vorheriges Foto"><ChevronLeft className="icon" /></button>
            <button type="button" className="lb-btn lb-next" onClick={() => go(1)} aria-label="Nächstes Foto"><ChevronRight className="icon" /></button>
          </>}
        </div>
      )}
    </>
  );
}
