'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { QuickSearch } from './QuickSearch';
import { Contact, BarChart3, FileSpreadsheet, CalendarDays, CalendarOff, ClipboardList, History, Hourglass, Image as ImageIcon, LayoutDashboard, MessageSquareText, PlusCircle, Search, Settings, Users } from 'lucide-react';

const GROUPS = [
  { name: 'Betrieb', items: [
    { href: '/admin', label: 'Übersicht', icon: LayoutDashboard, exact: true, count: true },
    { href: '/admin/kalender', label: 'Kalender', icon: CalendarDays },
    { href: '/admin/buchungen', label: 'Buchungen', icon: ClipboardList },
    { href: '/admin/neu', label: 'Termin eintragen', icon: PlusCircle },
    { href: '/admin/warteliste', label: 'Warteliste', icon: Hourglass },
    { href: '/admin/bucher', label: 'Bucher', icon: Contact },
  ] },
  { name: 'Auswertung', items: [
    { href: '/admin/statistik', label: 'Statistik', icon: BarChart3 },
    { href: '/admin/bericht', label: 'Jahresübersicht', icon: FileSpreadsheet },
    { href: '/admin/rueckmeldungen', label: 'Rückmeldungen', icon: MessageSquareText },
  ] },
  { name: 'Verwaltung', items: [
    { href: '/admin/sperrzeiten', label: 'Sperrzeiten', icon: CalendarOff },
    { href: '/admin/fotos', label: 'Fotos', icon: ImageIcon },
    { href: '/admin/einstellungen', label: 'Einstellungen', icon: Settings },
    { href: '/admin/team', label: 'Team', icon: Users },
    { href: '/admin/protokoll', label: 'Protokoll', icon: History },
  ] },
];

export function AdminNav({ open, children }: { open: number; children: React.ReactNode }) {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  // Handy: aktiven Menüpunkt in der Wischleiste sichtbar machen
  useEffect(() => { ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [path]);
  const isActive = (href: string, exact?: boolean) => exact ? path === href : path === href || path.startsWith(href + '/') || (href === '/admin/buchungen' && path.startsWith('/admin/buchung/'));
  const TABS = [
    { href: '/admin', label: 'Übersicht', icon: LayoutDashboard, exact: true },
    { href: '/admin/kalender', label: 'Kalender', icon: CalendarDays },
    { href: '/admin/neu', label: 'Eintragen', icon: PlusCircle },
    { href: '/admin/buchungen', label: 'Buchungen', icon: ClipboardList },
  ];
  return (
    <>
    <nav className="tabbar" aria-label="Schnellzugriff">
      {TABS.map((tb) => { const I = tb.icon; return <Link key={tb.href} href={tb.href} aria-current={isActive(tb.href, tb.exact) ? 'page' : undefined}><I className="icon" /><span>{tb.label}</span>{tb.exact && open > 0 && <span className="count">{open}</span>}</Link>; })}
      <button type="button" onClick={() => { const i = document.querySelector<HTMLInputElement>('.qs input'); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => i?.focus(), 250); }}><Search className="icon" /><span>Suche</span></button>
    </nav>
    <nav className="sidebar" aria-label="Verwaltung" ref={ref}>
      <QuickSearch />
      {GROUPS.map((g) => (
        <div key={g.name} style={{ display: 'contents' }}>
          <span className="group">{g.name}</span>
          {g.items.map((i) => {
            const active = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + '/') || (i.href === '/admin/buchungen' && path.startsWith('/admin/buchung/'));
            const I = i.icon;
            return <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}><I className="icon" />{i.label}{i.count && open > 0 && <span className="count">{open}</span>}</Link>;
          })}
        </div>
      ))}
      {children}
    </nav>
    </>
  );
}
