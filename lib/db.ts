import "server-only";
import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";

// Postgres numeric/int8 come back as strings by default; the app needs them as
// JS numbers (money, SOC, power, etc.), so register parsers once at module load.
types.setTypeParser(types.builtins.NUMERIC, (v: string) => parseFloat(v));
types.setTypeParser(types.builtins.INT8, (v: string) => parseInt(v, 10));

let sql: NeonQueryFunction<false, false> | null = null;

function client(): NeonQueryFunction<false, false> {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  sql = neon(url);
  return sql;
}

// Runs a parameterized query and returns all rows.
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const rows = await client()(text, params, { types });
  return rows as T[];
}

// Runs a parameterized query and returns the first row (or null).
export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Builds a parameterized SET clause from a column->value map. Column names come
// from in-code whitelists (never raw user input), so identifier interpolation
// is safe. Returns the clause and the ordered values starting at $1.
export function buildSet(fields: Record<string, unknown>): {
  clause: string;
  values: unknown[];
} {
  const keys = Object.keys(fields);
  const clause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  return { clause, values: keys.map((k) => fields[k]) };
}
