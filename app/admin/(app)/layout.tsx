import { NavLink } from '@/components/NavLinks';
import { requireAdmin } from '@/lib/auth';
import { logoutAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verwaltung', robots: { index: false } };
const ROLE = { admin: 'Admin', manager: 'Verwalter', viewer: 'Lesezugriff' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <>
      <nav className="subnav" aria-label="Verwaltung">
        <div className="wrap">
          <NavLink href="/admin" exact>Übersicht</NavLink>
          <NavLink href="/admin/kalender">Kalender</NavLink>
          <NavLink href="/admin/einstellungen">Regeln &amp; Sperrzeiten</NavLink>
          <NavLink href="/admin/team">Team</NavLink>
          <NavLink href="/admin/protokoll">Protokoll</NavLink>
          <span className="me">{me.name} · {ROLE[me.role]}
            <form action={logoutAction}><button className="btn small" type="submit">Abmelden</button></form></span>
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}
