/** Überlappende Einträge eines Tages nebeneinander anordnen (Spalten wie in Kalender-Apps). */
export function lanesFor(items: { id: string; start: number; end: number }[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [], laneEnds: number[] = [], clusterEnd = -Infinity;
  const flush = () => { for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length }); cluster = []; laneEnds = []; };
  for (const it of sorted) {
    if (it.start >= clusterEnd) { flush(); clusterEnd = -Infinity; }
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.end); } else laneEnds[lane] = it.end;
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}
