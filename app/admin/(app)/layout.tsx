import { LogOut } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ROLE_LABEL } from '@/lib/labels';
import { logoutAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verwaltung', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const [{ n }] = await db()`select count(*)::int as n from bookings where status = 'requested'`;
  return (
    <div className="admin">
      <AdminNav open={n}>
        <div className="me">
          <div><b>{me.name}</b><br /><span className="muted">{ROLE_LABEL[me.role]}</span></div>
          <form action={logoutAction}><button className="btn btn-sm btn-ghost" type="submit"><LogOut className="icon-sm" />Abmelden</button></form>
        </div>
      </AdminNav>
      <main className="admin-main"><div className="inner">{children}</div></main>
    </div>
  );
}
