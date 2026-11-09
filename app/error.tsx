'use client';
import { AlertTriangle } from 'lucide-react';

/** Statt „Application error“: verständlicher Hinweis mit Weg zur Diagnose. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wrap narrow" style={{ paddingBlock: 40 }}>
      <section className="card card-body stack">
        <div className="inline"><AlertTriangle className="icon" style={{ color: 'var(--warn)' }} /><h1 style={{ fontSize: '1.4rem' }}>Hier ist etwas schiefgelaufen</h1></div>
        <p>Die Seite konnte gerade nicht geladen werden. Bitte versuch es in einem Moment noch einmal.</p>
        <p className="muted small">Du richtest die Seite gerade ein? Unter <a href="/status">/status</a> siehst du, was noch fehlt.{error.digest && <> Fehlercode: {error.digest}</>}</p>
        <div className="inline"><button className="btn btn-primary" onClick={() => reset()}>Erneut versuchen</button><a className="btn" href="/status">Einrichtung prüfen</a></div>
      </section>
    </main>
  );
}
