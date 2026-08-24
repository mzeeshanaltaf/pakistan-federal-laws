import { Pool } from "pg";

// Cached on globalThis so Next.js dev-mode hot reload reuses the pool instead
// of opening a fresh one (and leaking connections) on every module reload.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // pgvector's `vector` type lives in `public` (CREATE EXTENSION wasn't
    // schema-qualified in db/schema.sql) — search_path needs both, or any
    // ::vector cast fails with "type vector does not exist".
    options: "-c search_path=pak_laws,public",
    // Kept small deliberately: static generation runs many parallel worker
    // processes, each with its own Pool (globalThis caching only helps
    // within one process) — a large per-process max exhausted the shared
    // VPS Postgres's connection limit generating the 525 /law pages.
    max: 4,
    idleTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
