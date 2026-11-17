import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Star } from 'lucide-react';
import { Flash } from '@/components/Flash';
import { StatusBadge } from '@/components/StatusBadge';
import { requireAdmin } from '@/lib/auth';
import { PROFILE_TAGS, emailFromBookerKey, getCategories, getProfile } from '@/lib/data';
import { eur, initials } from '@/lib/labels';
import { berlinHm, fmtDay } from '@/lib/time';
import { telHref } from '@/lib/util/phone';
import { eraseAction, profileAction } from '../../../actions';

export const metadata = { title: 'Bucher' };

export default async function BucherProfil({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const { key } = await params;
  const sp = await searchParams;
  const email = emailFromBookerKey(key);
  if (!email) notFound();
  const [p, cats] = await Promise.all([getProfile(email!), getCategories()]);
  if (!p.bookings.length && !p.note) notFound();
  const cat = new Map(cats.map((c) => [c.id, c]));
  const latest = p.bookings[0];
  const done = p.bookings.filter((b) => b.status === 'confirmed' && b.end < Date.now());
  const withheld = p.bookings.reduce((s, b) => s + (b.depositWithheld || 0), 0);
  const issues = p.bookings.filter((b) => b.conditionOk === false).length;
  const cancelled = p.bookings.filter((b) => ['cancelled', 'rejected'].includes(b.status)).length;
  return (
    <>
      <div className="page-head" style={{ paddingInline: 0 }}>
        <div><Link href="/admin/bucher" className="inline small muted" style={{ textDecoration: 'none', marginBottom: 6 }}><ArrowLeft className="icon-sm" />Bucher</Link>
          <div className="inline"><span className="avatar lg">{initials(latest?.name ?? email!)}</span><div><h1>{latest?.name ?? email}</h1><span className="muted">{latest?.team || (latest?.bookerType === 'external' ? 'nicht im Verein' : '')}</span></div></div></div>
        <div className="inline">
          <a className="btn" href={`mailto:${email}`}><Mail className="icon-sm" />Mail</a>
          {latest?.phone && <a className="btn" href={telHref(latest.phone)}><Phone className="icon-sm" />Anrufen</a>}
        </div>
      </div>
      <Flash sp={sp} />
      <div className="kpis">
        <div className="card kpi"><span className="k">Termine</span><span className="v">{done.length}</span><span className="s">genutzt in 12 Monaten</span></div>
        <div className="card kpi"><span className="k">Abgesagt / abgelehnt</span><span className="v">{cancelled}</span><span className="s">von {p.bookings.length} Anfragen</span></div>
        <div className="card kpi"><span className="k">Bewertung</span><span className="v">{p.feedback.avg ? p.feedback.avg.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '–'}</span><span className="s">{p.feedback.n ? `${p.feedback.n} Rückmeldung(en)` : 'keine Rückmeldung'}{p.feedback.damage ? ' · Schaden gemeldet' : ''}</span></div>
        <div className={`card kpi${withheld || issues ? ' attention' : ''}`}><span className="k">Zustand</span><span className="v">{issues ? `${issues}×` : 'ok'}</span><span className="s">{issues ? 'Mängel bei Rückgabe' : 'keine Mängel'}{withheld ? ` · ${eur(withheld)} einbehalten` : ''}</span></div>
      </div>
      <div className="grid-2b">
        <section className="card">
          <div className="card-head"><h2>Buchungen</h2><span className="muted small">{p.bookings.length}</span></div>
          <ul className="list">{p.bookings.map((b) => (
            <li key={b.id} className="between"><div style={{ minWidth: 0 }}>
              <Link href={`/admin/buchung/${b.id}`} className="catdot" style={{ '--c': cat.get(b.categoryId)?.color, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' } as React.CSSProperties}>{b.title}</Link>
              <div className="muted small num">{fmtDay(b.start)}, {berlinHm(b.start)}–{berlinHm(b.end)} · {b.number}{b.conditionOk === false ? ' · Mängel' : ''}</div></div>
              <StatusBadge status={b.status} /></li>
          ))}</ul>
        </section>
        <form action={profileAction} className="card">
          <input type="hidden" name="key" value={key} />
          <div className="card-head"><div><h2>Notizen des Teams</h2><p>Nur in der Verwaltung sichtbar. Bitte sachlich bleiben, Bucher können Auskunft verlangen.</p></div></div>
          <div className="card-body stack-sm">
            <div className="chips">{PROFILE_TAGS.map((t) => <label key={t} className="chip-check"><input type="checkbox" name="tags" value={t} defaultChecked={p.tags.includes(t)} disabled={me.role === 'viewer'} /><span>{t === 'zuverlässig' && <Star className="icon-sm" />}{t}</span></label>)}</div>
            <textarea name="note" defaultValue={p.note} rows={5} maxLength={2000} placeholder="z. B. Ansprechpartner der C1-Jugend, bucht jeden Dienstag. Schlüssel immer pünktlich zurück." disabled={me.role === 'viewer'} />
            {p.updatedAt && <span className="muted small">Zuletzt geändert von {p.updatedBy}, {fmtDay(p.updatedAt)}</span>}
          </div>
          {me.role !== 'viewer' && <div className="card-foot"><button className="btn btn-primary" type="submit">Speichern</button></div>}
        </form>
      </div>
      <section className="card" id="datenschutz" style={{ marginTop: 16 }}>
        <div className="card-head"><div><h2>Datenschutz</h2><p>Für Anfragen nach Art. 15 (Auskunft) und Art. 17 DSGVO (Löschung). Beides wird im Protokoll vermerkt.</p></div></div>
        <div className="card-body grid-2b">
          <div className="stack-sm"><b className="small">Auskunft</b><span className="muted small">Alle gespeicherten Daten als Datei (Buchungen, Nachrichten, Rückmeldungen, Zahlungen, Mails, Notizen). Diese Datei der Person schicken.</span>
            <a className="btn" href={`/admin/bucher-auskunft/${key}`} style={{ justifySelf: 'start' }}>Datenauskunft herunterladen</a></div>
          {me.role === 'admin' && <form action={eraseAction} className="stack-sm"><input type="hidden" name="key" value={key} />
            <b className="small">Löschen</b><span className="muted small">Name, Kontakt, Notizen, Nachrichten und Unterschriften werden entfernt, Buchungen bleiben anonym für die Statistik. Geht nicht, solange noch Termine anstehen.</span>
            <input name="confirm" placeholder={`Zur Bestätigung: ${email}`} aria-label="E-Mail-Adresse zur Bestätigung" autoComplete="off" />
            <button className="btn btn-danger" type="submit" style={{ justifySelf: 'start' }}>Endgültig löschen</button></form>}
        </div>
      </section>
    </>
  );
}
