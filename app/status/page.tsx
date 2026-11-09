import { CheckCircle2, XCircle } from 'lucide-react';
import { currentAdmin } from '@/lib/auth';
import { runChecks } from '@/lib/diagnose';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Status', robots: { index: false } };

/**
 * Einrichtungs-Check. Zeigt nur, OB etwas eingetragen ist und funktioniert, nie die Werte selbst.
 * Sobald jemand im Team ist, sehen nur angemeldete Team-Mitglieder die Einzelheiten.
 */
export default async function Status() {
  const { checks, hasAdmins } = await runChecks();
  const allOk = checks.every((c) => c.ok);
  let admin = null;
  try { admin = await currentAdmin(); } catch { /* Datenbank oder Secret fehlen */ }
  const details = !hasAdmins || !!admin;
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Jugendraum-Portal</span><h1 style={{ fontSize: '1.5rem' }}>Einrichtung prüfen</h1></div>
          <span className={`badge ${allOk ? 'b-ok' : 'b-bad'}`}>{allOk ? 'alles in Ordnung' : 'es fehlt noch etwas'}</span></div>
        {details ? (
          <ul className="list">{checks.map((c) => (
            <li key={c.label} className="todo">
              {c.ok ? <CheckCircle2 className="icon" style={{ color: 'var(--ok)' }} /> : <XCircle className="icon" style={{ color: 'var(--bad)' }} />}
              <div><b>{c.label}</b>{c.hint && <div className="muted small" style={{ marginTop: 2 }}>{c.hint}</div>}</div>
            </li>
          ))}</ul>
        ) : <div className="card-body muted">{allOk ? 'Alle Prüfungen bestanden.' : 'Einzelheiten sehen angemeldete Team-Mitglieder.'}</div>}
        <div className="card-foot small muted">Nach Änderungen an den Umgebungsvariablen in Vercel: Deployments → ⋯ → Redeploy, dann diese Seite neu laden.{allOk && <> Weiter zur <a href="/admin">Verwaltung</a>.</>}</div>
      </section>
    </main>
  );
}
