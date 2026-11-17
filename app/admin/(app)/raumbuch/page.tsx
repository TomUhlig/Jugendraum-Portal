import Link from 'next/link';
import { Check, ShoppingCart, Trash2, Wrench, ListTodo, RotateCcw } from 'lucide-react';
import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { getRooms, listAdmins, listNotes } from '@/lib/data';
import { fmtDay } from '@/lib/time';
import { addNoteAction, deleteNoteAction, toggleNoteAction } from '../../actions';

export const metadata = { title: 'Raumbuch' };

const KINDS = { defect: { label: 'Mängel', one: 'Mangel', icon: Wrench }, shopping: { label: 'Einkauf', one: 'Einkauf', icon: ShoppingCart }, todo: { label: 'Aufgaben', one: 'Aufgabe', icon: ListTodo } } as const;

/** Gemeinsames Mängel-, Einkaufs- und Aufgabenbuch für das Orga-Team. */
export default async function Raumbuch({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const showDone = sp.erledigt === '1';
  const [notes, rooms, team] = await Promise.all([listNotes(showDone), getRooms(), listAdmins()]);
  const can = me.role !== 'viewer';
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  return (
    <>
      <PageHead eyebrow="Was kaputt ist, was fehlt, was zu tun ist" title="Raumbuch">
        <Link className="btn" href={showDone ? '/admin/raumbuch' : '/admin/raumbuch?erledigt=1'}>{showDone ? 'Nur offene' : 'Auch erledigte'}</Link>
      </PageHead>
      <Flash sp={sp} />
      {can && (
        <form action={addNoteAction} className="card card-body note-add">
          <select name="kind" aria-label="Art" defaultValue={sp.art ?? 'defect'}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.one}</option>)}</select>
          <input name="text" required minLength={2} maxLength={300} placeholder="z. B. Glühbirne in der Küche kaputt · Spülmittel fehlt · Heizung entlüften" aria-label="Eintrag" />
          {rooms.length > 1 && <select name="roomId" aria-label="Raum"><option value="">alle Räume</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
          <select name="assignee" aria-label="Zuständig"><option value="">niemand zuständig</option>{team.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
          <button className="btn btn-primary" type="submit">Eintragen</button>
        </form>
      )}
      <div className="note-cols">
        {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => {
          const K = KINDS[k], I = K.icon, items = notes.filter((n) => n.kind === k);
          return (
            <section className="card" key={k}>
              <div className="card-head"><h2 className="inline"><I className="icon" />{K.label}</h2><span className="badge no-dot">{items.filter((n) => !n.doneAt).length}</span></div>
              {items.length === 0 ? <div className="empty">{showDone ? 'Nichts in den letzten 60 Tagen.' : 'Alles erledigt.'}</div> : (
                <ul className="list note-list">{items.map((n) => (
                  <li key={n.id} className={n.doneAt ? 'done' : ''}>
                    {can ? <form action={toggleNoteAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="done" value={n.doneAt ? '0' : '1'} />
                      <button className="note-check" type="submit" aria-label={n.doneAt ? 'Wieder öffnen' : 'Erledigt'}>{n.doneAt ? <RotateCcw className="icon-sm" /> : <Check className="icon-sm" />}</button></form> : <span />}
                    <div><span className="note-text">{n.text}</span>
                      <span className="muted small">{n.assignee && <b>{n.assignee} · </b>}{n.roomId && rooms.length > 1 ? `${roomName.get(n.roomId)} · ` : ''}{n.createdBy}, {fmtDay(n.createdAt)}{n.bookingId && <> · <Link href={`/admin/buchung/${n.bookingId}`}>Buchung</Link></>}{n.doneAt && ` · erledigt von ${n.doneBy}, ${fmtDay(n.doneAt)}`}</span></div>
                    {can && <form action={deleteNoteAction}><input type="hidden" name="id" value={n.id} /><button className="iconbtn" type="submit" aria-label="Löschen"><Trash2 className="icon-sm" /></button></form>}
                  </li>
                ))}</ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
