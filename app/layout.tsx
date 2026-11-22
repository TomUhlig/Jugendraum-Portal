import type { Metadata, Viewport } from 'next';
import { FormBusy } from '@/components/FormBusy';
import { AppShell } from '@/components/AppShell';
import { Archivo, Noto_Sans_Arabic, Source_Sans_3 } from 'next/font/google';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Theme, ThemeSwitch } from '@/components/ThemeSwitch';
import { LangSwitch } from '@/components/LangSwitch';
import { getLang } from '@/lib/lang';
import { dirOf, t } from '@/lib/i18n';
import { NavLink } from '@/components/NavLinks';
import './globals.css';

const archivo = Archivo({ subsets: ['latin', 'latin-ext'], variable: '--font-archivo', display: 'swap' });
const source = Source_Sans_3({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--font-source', display: 'swap' });
const arabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap', preload: false, weight: ['400', '600', '700'] });

export const metadata: Metadata = {
  title: { default: 'Jugendraum anfragen · SV Heepen', template: '%s · Jugendraum SV Heepen' },
  description: 'Den Jugendraum des SV Heepen für Besprechungen, Mannschaftsabende und Feiern online anfragen.',
  icons: { icon: '/logo.png', apple: '/icon-192.png' },
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(process.env.APP_URL?.trim() || 'http://localhost:3000'),
  openGraph: { type: 'website', siteName: 'Jugendraum SV Heepen', locale: 'de_DE', images: [{ url: '/og', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FFFFFF' }, { media: '(prefers-color-scheme: dark)', color: '#151931' }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = (await cookies()).get('theme')?.value;
  const theme: Theme = c === 'light' || c === 'dark' ? c : 'system';
  const lang = await getLang();
  const n = t(lang).nav;
  return (
    <html lang={lang} dir={dirOf(lang)} className={`${archivo.variable} ${source.variable} ${arabic.variable}`} data-theme={theme === 'system' ? undefined : theme}>
      <body>
        <a href="#inhalt" className="hp">{n.skip}</a>
        <header className="site-header">
          <div className="wrap">
            <Link className="brand" href="/">
              <img src="/logo.png" alt="" width={40} height={40} />
              <div><strong>Jugendraum</strong><span>SV Heepen</span></div>
            </Link>
            <nav className="nav" aria-label="Navigation">
              <NavLink href="/" exact>{n.request}</NavLink>
              <NavLink href="/raum">{n.room}</NavLink>
              <NavLink href="/admin" className="nav-login">{n.admin}</NavLink>
              <LangSwitch lang={lang} label={n.language} />
              <ThemeSwitch initial={theme} />
            </nav>
          </div>
        </header>
        <div id="inhalt" style={{ display: 'contents' }}>{children}</div>
        <FormBusy />
        <AppShell offlineText={t(lang).error.offline} />
        <footer className="site-footer">
          <div className="wrap">
            <span className="grow"><img src="/logo.png" alt="" width={24} height={24} />{n.footer}</span>
            <Link href="/meine-buchungen">{n.mine}</Link>
            <Link href="/raum#hausordnung">{n.houseRules}</Link>
            <Link href="/impressum">{n.imprint}</Link>
            <Link href="/raum#datenschutz">{n.privacy}</Link>
            <a href="https://www.sv-heepen.de" rel="noopener">{n.club}</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
