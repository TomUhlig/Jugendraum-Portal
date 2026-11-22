'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { LANGS, LANG_LABEL, dirOf, type Lang } from '@/lib/i18n';

/** Sprachwahl als kleines Aufklappmenü (öffentliche Seiten; in der Verwaltung ausgeblendet). */
export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  const path = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  if (path.startsWith('/admin') || path === '/status') return null;
  const choose = (l: Lang) => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l; document.documentElement.dir = dirOf(l);
    if (ref.current) ref.current.open = false;
    router.refresh();
  };
  return (
    <details className="lang-switch" ref={ref}>
      <summary aria-label={`${label}: ${LANG_LABEL[lang]}`}><Languages className="icon-sm" aria-hidden /><span>{lang.toUpperCase()}</span><ChevronDown className="icon-sm" aria-hidden /></summary>
      <ul role="menu">
        {LANGS.map((l) => (
          <li key={l}><button type="button" role="menuitemradio" aria-checked={l === lang} lang={l} dir={dirOf(l)} onClick={() => choose(l)}>
            <span>{LANG_LABEL[l]}</span>{l === lang && <Check className="icon-sm" aria-hidden />}</button></li>
        ))}
      </ul>
    </details>
  );
}
