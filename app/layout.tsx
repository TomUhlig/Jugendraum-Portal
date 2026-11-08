import type { Metadata, Viewport } from 'next';
import { Archivo, JetBrains_Mono, Source_Sans_3 } from 'next/font/google';
import Link from 'next/link';
import { NavLink } from '@/components/NavLinks';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const source = Source_Sans_3({ subsets: ['latin'], variable: '--font-source', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: '500', variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Jugendraum SV Heepen', template: '%s · Jugendraum SV Heepen' },
  description: 'Den Jugendraum des SV Heepen online anfragen: Besprechungen, Mannschaftsabende, Feiern.',
  icons: { icon: '/logo.png' },
};
export const viewport: Viewport = { themeColor: '#2E367A' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${archivo.variable} ${source.variable} ${mono.variable}`}>
      <body>
        <header className="band">
          <div className="wrap">
            <Link className="brand" href="/">
              <img src="/logo.png" alt="SV Heepen Logo" width={44} height={44} />
              <div><b>JUGENDRAUM</b><span>SV Heepen</span></div>
            </Link>
            <nav className="nav" aria-label="Hauptnavigation">
              <NavLink href="/" exact>Raum anfragen</NavLink>
              <NavLink href="/regeln">Regeln</NavLink>
              <NavLink href="/admin">Verwaltung</NavLink>
            </nav>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="wrap">
            <span>© SV Heepen</span>
            <Link href="/regeln">Hausordnung &amp; Regeln</Link>
            <Link href="/regeln#datenschutz">Datenschutz</Link>
            <a href="https://www.sv-heepen.de" rel="noopener">sv-heepen.de</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
