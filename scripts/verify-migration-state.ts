import { readFileSync } from "node:fs";
import postgres from "postgres";
import { compatibleMigrationChecksums } from "./migration-checksum";
import { migrationPlan } from "./migration-plan";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const expected = migrationPlan();
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
  try {
    const applied = await sql<{ id: string; checksum: string }[]>`
      SELECT id, checksum
      FROM eos_schema_migrations
      ORDER BY id
    `;
    const appliedById = new Map(applied.map((entry) => [entry.id, entry.checksum]));
    const missing: string[] = [];
    const changed: string[] = [];

    for (const migration of expected) {
      const checksum = appliedById.get(migration.id);
      if (!checksum) {
        missing.push(migration.id);
        continue;
      }
      const contents = readFileSync(migration.fullPath, "utf8");
      if (!compatibleMigrationChecksums(contents).has(checksum)) changed.push(migration.id);
    }

    const expectedIds = new Set(expected.map((migration) => migration.id));
    const unknown = applied.filter((entry) => !expectedIds.has(entry.id)).map((entry) => entry.id);
    const report = {
      database: "connected",
      expected: expected.length,
      applied: applied.length,
      missing,
      changed,
      unknown,
      verified: missing.length === 0 && changed.length === 0 && unknown.length === 0,
    };
    console.log(JSON.stringify(report));
    if (!report.verified) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error) => {
  console.error("Migration-state verification failed:", error instanceof Error ? error.message : "unknown_error");
  process.exitCode = 1;
});
