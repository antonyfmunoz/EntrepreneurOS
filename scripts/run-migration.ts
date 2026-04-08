/**
 * Idempotent SQL migration runner for Neon PostgreSQL.
 *
 * Reads every .sql file in scripts/migrations/ in lexicographic order and
 * executes its contents against $DATABASE_URL. Each .sql file is expected to
 * use IF NOT EXISTS / IF EXISTS guards so re-runs are safe.
 *
 * Usage: npm run db:migrate
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";

/**
 * Minimal .env loader — we don't depend on `dotenv` to keep the runner
 * deterministic. Only reads simple KEY=VALUE lines (no multiline values).
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const migrationsDir = resolve(process.cwd(), "scripts", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const sql = postgres(dbUrl, { max: 1 });

  try {
    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      const contents = readFileSync(fullPath, "utf8");
      console.log(`→ Running ${file}`);
      await sql.unsafe(contents);
      console.log(`  ✓ ${file}`);
    }
    console.log(`\nApplied ${files.length} migration file(s).`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
