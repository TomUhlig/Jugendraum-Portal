import { currentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { emailFromBookerKey, personalDataExport } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Datenauskunft als JSON-Datei zum Weitergeben an die anfragende Person. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await currentAdmin();
  if (!admin || admin.role === 'viewer') return new Response('Nicht erlaubt', { status: 403 });
  const email = emailFromBookerKey((await params).key);
  if (!email) return new Response('Nicht gefunden', { status: 404 });
  const data = await personalDataExport(email);
  await db()`insert into audit_log (actor, action, detail) values (${admin.name}, 'data-export', ${db().json({ email })})`;
  return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="datenauskunft-${email.replace(/[^\w.-]/g, '_')}.json"`, 'Cache-Control': 'no-store' } });
}
