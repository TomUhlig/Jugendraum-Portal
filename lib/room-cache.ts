/** Zuletzt geladene Räume (wird von getRooms gefüllt), damit Mails und Ansichten ohne extra Abfrage den Raumnamen zeigen. */
const g = globalThis as unknown as { __rooms?: { id: string; name: string; active: boolean }[] };
export const rememberRooms = (r: { id: string; name: string; active: boolean }[]) => { g.__rooms = r; };
/** Raumname, aber nur wenn es mehr als einen aktiven Raum gibt (sonst null: keine unnötige Angabe). */
export function roomLabel(id: string | undefined): string | null {
  const r = g.__rooms ?? [];
  if (r.filter((x) => x.active).length < 2) return null;
  return r.find((x) => x.id === id)?.name ?? null;
}
