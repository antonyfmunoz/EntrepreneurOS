/**
 * Checksum-verified PostgreSQL migration runner.
 *
 * Incremental EOS migrations live in /migrations. The generated 0000 baseline
 * snapshots remain owned by drizzle-kit/db:push and are intentionally skipped
 * here. Historical hand-authored migrations in /scripts/migrations remain in
 * the plan. Each applied file is recorded exactly once by checksum.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function migrationPlan() {
  const sources = [
    { label: "scripts/migrations", directory: resolve(process.cwd(), "scripts", "migrations"), include: (_file: string) => true },
    { label: "migrations", directory: resolve(process.cwd(), "migrations"), include: (file: string) => !file.startsWith("0000_") },
  ];
  return sources.flatMap(({ label, directory, include }) => {
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .filter((file) => file.endsWith(".sql") && include(file))
      .sort()
      .map((file) => ({ id: `${label}/${file}`, fullPath: join(directory, file) }));
  }).sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  const migrations = migrationPlan();
  if (process.env.MIGRATION_DRY_RUN === "true") {
    console.log(JSON.stringify({ migrations: migrations.map((item) => item.id) }, null, 2));
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set");
    process.exitCode = 1;
    return;
  }
  if (!migrations.length) {
    console.log("No incremental migration files found.");
    return;
  }

  const sql = postgres(dbUrl, { max: 1 });
  let locked = false;
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS eos_schema_migrations (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql`SELECT pg_advisory_lock(hashtext('entrepreneuros-schema-migrations'))`;
    locked = true;
    for (const migration of migrations) {
      const contents = readFileSync(migration.fullPath, "utf8");
      const checksum = createHash("sha256").update(contents).digest("hex");
      const existing = await sql<{ checksum: string }[]>`SELECT checksum FROM eos_schema_migrations WHERE id = ${migration.id}`;
      if (existing.length) {
        if (existing[0].checksum !== checksum) throw new Error(`Previously applied migration changed: ${migration.id}`);
        console.log(`- Skipping ${migration.id} (already applied)`);
        continue;
      }
      console.log(`-> Running ${migration.id}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO eos_schema_migrations (id, checksum) VALUES (${migration.id}, ${checksum})`;
      });
      console.log(`  OK ${migration.id}`);
    }
    console.log(`Migration plan complete (${migrations.length} known migration file(s)).`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    if (locked) {
      try { await sql`SELECT pg_advisory_unlock(hashtext('entrepreneuros-schema-migrations'))`; } catch {}
    }
    await sql.end({ timeout: 5 });
  }
}

void main();
