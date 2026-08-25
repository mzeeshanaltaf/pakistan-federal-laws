/**
 * Generic SQL-file runner against the shared pool — reusable for any future
 * schema addition, replacing one-off ad hoc scripts.
 *
 * Usage: npx tsx --env-file=.env.local scripts/apply-sql.ts <path-to-sql-file>
 */
import { readFileSync } from "node:fs";
import { pool } from "../src/lib/db";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/apply-sql.ts <path-to-sql-file>");
    process.exit(1);
  }

  const sql = readFileSync(filePath, "utf-8");
  await pool.query(sql);
  console.log(`Applied ${filePath}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
