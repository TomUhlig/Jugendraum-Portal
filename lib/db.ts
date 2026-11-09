import 'server-only';
import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql };

/** Verschlüsselte Verbindung für alles außer lokale Datenbanken (Supabase & Co. erwarten SSL). */
export function connectOptions(url: string): postgres.Options<Record<string, postgres.PostgresType>> {
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url) || url.includes('sslmode=disable');
  return { max: 5, idle_timeout: 20, connect_timeout: 10, prepare: false, onnotice: () => {}, ssl: local ? false : 'require' };
}

/** Eine Verbindung pro Prozess (auch bei Hot Reload im Dev-Modus). */
export function db(): postgres.Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error('DATABASE_URL ist nicht gesetzt (siehe EINRICHTUNG.md, Schritt 4).');
    g.__sql = postgres(url, connectOptions(url));
  }
  return g.__sql;
}
