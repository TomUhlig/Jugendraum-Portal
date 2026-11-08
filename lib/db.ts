import 'server-only';
import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql };

/** Eine Verbindung pro Prozess (auch bei Hot Reload im Dev-Modus). */
export function db(): postgres.Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL ist nicht gesetzt (siehe .env.example).');
    g.__sql = postgres(url, { max: 5, idle_timeout: 20, prepare: false, onnotice: () => {} });
  }
  return g.__sql;
}
