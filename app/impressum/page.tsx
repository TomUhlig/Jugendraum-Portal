import Link from 'next/link';
import { getExtras, operatorComplete } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Impressum' };

export default async function Impressum() {
  const { operator: o } = await getExtras();
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <article className="card card-body prose" style={{ maxWidth: 'none' }}>
        <div><span className="eyebrow">Angaben gemäß § 5 DDG</span><h1 style={{ fontSize: '1.7rem' }}>Impressum</h1></div>
        {!operatorComplete(o) ? (
          <p className="muted">Die Angaben zum Betreiber werden gerade ergänzt.</p>
        ) : (
          <>
            <h2>Betreiber</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{o.name}{'\n'}{o.address}</p>
            <h2>Kontakt</h2>
            <p>E-Mail: <a href={`mailto:${o.email}`}>{o.email}</a>{o.phone && <><br />Telefon: {o.phone}</>}</p>
            {o.responsible && <><h2>Verantwortlich für den Inhalt</h2><p style={{ whiteSpace: 'pre-line' }}>{o.responsible}</p></>}
          </>
        )}
        <h2>Hinweis</h2>
        <p>Diese Seite dient ausschließlich der Organisation von Terminen im Jugendraum des SV Heepen. Informationen zum Verein findest du auf <a href="https://www.sv-heepen.de" rel="noopener">sv-heepen.de</a>.</p>
        <p><Link href="/raum#datenschutz">Zu den Datenschutzhinweisen</Link></p>
      </article>
    </main>
  );
}
