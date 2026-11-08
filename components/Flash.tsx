export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.ok) return <p className="notice" role="status">{sp.ok}</p>;
  if (sp.fehler) return <p className="notice bad" role="alert">{sp.fehler}</p>;
  return null;
}
