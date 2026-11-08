import type { Metadata, Viewport } from 'next';
import { Archivo, Source_Sans_3 } from 'next/font/google';
import Link from 'next/link';
import { NavLink } from '@/components/NavLinks';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' });
const source = Source_Sans_3({ subsets: ['latin'], variable: '--font-source', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Jugendraum anfragen · SV Heepen', template: '%s · Jugendraum SV Heepen' },
  description: 'Den Jugendraum des SV Heepen für Besprechungen, Mannschaftsabende und Feiern online anfragen.',
  icons: { icon: '/logo.png', apple: '/icon-192.png' },
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { themeColor: '#2E367A' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${archivo.variable} ${source.variable}`}>
      <body>
        <a href="#inhalt" className="hp">Zum Inhalt springen</a>
        <header className="site-header">
          <div className="wrap">
            <Link className="brand" href="/">
              <img src="/logo.png" alt="" width={40} height={40} />
              <div><strong>Jugendraum</strong><span>SV Heepen</span></div>
            </Link>
            <nav className="nav" aria-label="Hauptnavigation">
              <NavLink href="/" exact>Anfragen</NavLink>
              <NavLink href="/raum">Raum &amp; Regeln</NavLink>
              <NavLink href="/admin" className="nav-login">Verwaltung</NavLink>
            </nav>
          </div>
        </header>
        <div id="inhalt" style={{ display: 'contents' }}>{children}</div>
        <footer className="site-footer">
          <div className="wrap">
            <span className="grow"><img src="/logo.png" alt="" width={24} height={24} />Jugendraum des SV Heepen</span>
            <Link href="/raum#hausordnung">Hausordnung</Link>
            <Link href="/raum#datenschutz">Datenschutz</Link>
            <a href="https://www.sv-heepen.de" rel="noopener">sv-heepen.de</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
