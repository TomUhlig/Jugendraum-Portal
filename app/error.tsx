'use client';
import { AlertTriangle } from 'lucide-react';
import { isLang, t } from '@/lib/i18n';

/** Statt „Application error“: verständlicher Hinweis mit Weg zur Diagnose. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const l = typeof document !== 'undefined' ? document.documentElement.lang : 'de';
  const E = t(isLang(l) ? l : 'de').error;
  return (
    <main className="wrap narrow" style={{ paddingBlock: 40 }}>
      <section className="card card-body stack">
        <div className="inline"><AlertTriangle className="icon" style={{ color: 'var(--warn)' }} /><h1 style={{ fontSize: '1.4rem' }}>{E.title}</h1></div>
        <p>{E.text}</p>
        <p className="muted small">Du richtest die Seite gerade ein? Unter <a href="/status">/status</a> siehst du, was noch fehlt.{error.digest && <> Fehlercode: {error.digest}</>}</p>
        <div className="inline"><button className="btn btn-primary" onClick={() => reset()}>{E.retry}</button><a className="btn" href="/status">Einrichtung prüfen</a></div>
      </section>
    </main>
  );
}
