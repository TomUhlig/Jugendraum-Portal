'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LANGS, LANG_LABEL, type Lang } from '@/lib/i18n';

/** Sprachwahl für die öffentlichen Seiten (in der Verwaltung ausgeblendet). */
export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  const path = usePathname();
  if (path.startsWith('/admin') || path === '/status') return null;
  return (
    <div className="lang-switch" role="group" aria-label={label}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} title={LANG_LABEL[l]} aria-pressed={l === lang}
          onClick={() => { document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`; document.documentElement.lang = l; router.refresh(); }}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}
