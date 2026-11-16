'use client';
import { useEffect } from 'react';

/**
 * Rückmeldung beim Absenden für alle Formulare: der gedrückte Knopf zeigt einen Ladekreis und
 * ist kurz gesperrt (kein doppeltes Absenden). Wird nach dem Seitenwechsel oder spätestens nach 10 s zurückgesetzt.
 */
export function FormBusy() {
  useEffect(() => {
    const reset = (b: HTMLElement) => { b.classList.remove('is-busy'); b.removeAttribute('aria-busy'); (b as HTMLButtonElement).disabled = false; };
    const onSubmit = (e: SubmitEvent) => {
      const b = e.submitter as HTMLButtonElement | null;
      if (!b || b.classList.contains('is-busy') || b.closest('[data-nobusy]')) return;
      const href = location.href;
      b.classList.add('is-busy'); b.setAttribute('aria-busy', 'true');
      setTimeout(() => { if (b.classList.contains('is-busy')) b.disabled = true; }, 0); // erst nach dem Lesen des Formulars sperren
      const started = Date.now();
      const t = setInterval(() => {
        if (!b.isConnected || location.href !== href || Date.now() - started > 10_000) { clearInterval(t); if (b.isConnected) reset(b); }
      }, 250);
    };
    document.addEventListener('submit', onSubmit);
    const onShow = () => document.querySelectorAll<HTMLElement>('.is-busy').forEach(reset);
    window.addEventListener('pageshow', onShow);
    return () => { document.removeEventListener('submit', onSubmit); window.removeEventListener('pageshow', onShow); };
  }, []);
  return null;
}
