'use client';
import { DoorArt } from '@/components/DoorArt';
import { isLang, t } from '@/lib/i18n';

/** Statt „Application error“: verständlicher Hinweis mit Weg zur Diagnose. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const l = typeof document !== 'undefined' ? document.documentElement.lang : 'de';
  const E = t(isLang(l) ? l : 'de').error;
  return (
    <main className="wrap narrow error-page">
      <DoorArt variant="tools" />
      <h1>{E.title}</h1>
      <p>{E.text}</p>
      <div className="inline" style={{ justifyContent: 'center', flexWrap: 'wrap' }}><button className="btn btn-primary" onClick={() => reset()}>{E.retry}</button><a className="btn" href="/">{E.home}</a></div>
      <p className="muted small">Du richtest die Seite gerade ein? Unter <a href="/status">/status</a> siehst du, was noch fehlt.{error.digest && <> Fehlercode: {error.digest}</>}</p>
    </main>
  );
}
