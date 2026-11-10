'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, CalendarOff, ClipboardList, History, Hourglass, LayoutDashboard, MessageSquareText, PlusCircle, Settings, Users } from 'lucide-react';

const GROUPS = [
  { name: 'Betrieb', items: [
    { href: '/admin', label: 'Übersicht', icon: LayoutDashboard, exact: true, count: true },
    { href: '/admin/kalender', label: 'Kalender', icon: CalendarDays },
    { href: '/admin/buchungen', label: 'Buchungen', icon: ClipboardList },
    { href: '/admin/neu', label: 'Termin eintragen', icon: PlusCircle },
    { href: '/admin/warteliste', label: 'Warteliste', icon: Hourglass },
  ] },
  { name: 'Auswertung', items: [
    { href: '/admin/statistik', label: 'Statistik', icon: BarChart3 },
    { href: '/admin/rueckmeldungen', label: 'Rückmeldungen', icon: MessageSquareText },
  ] },
  { name: 'Verwaltung', items: [
    { href: '/admin/sperrzeiten', label: 'Sperrzeiten', icon: CalendarOff },
    { href: '/admin/einstellungen', label: 'Einstellungen', icon: Settings },
    { href: '/admin/team', label: 'Team', icon: Users },
    { href: '/admin/protokoll', label: 'Protokoll', icon: History },
  ] },
];

export function AdminNav({ open, children }: { open: number; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <nav className="sidebar" aria-label="Verwaltung">
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
  );
}
