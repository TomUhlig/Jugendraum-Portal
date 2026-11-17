/** Raumauswahl für Formulare der Verwaltung; erscheint nur, wenn es mehr als einen Raum gibt. */
export function RoomSelect({ rooms, value, id = 'room', allLabel }: { rooms: { id: string; name: string }[]; value?: string | null; id?: string; allLabel?: string }) {
  if (rooms.length < 2) return null;
  return (
    <div className="field"><label htmlFor={id}>Raum</label>
      <select id={id} name="roomId" defaultValue={value ?? (allLabel ? '' : rooms[0].id)}>
        {allLabel && <option value="">{allLabel}</option>}
        {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select></div>
  );
}
