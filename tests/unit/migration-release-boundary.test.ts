import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrationPlan } from "../../scripts/migration-plan";

describe("production migration release boundary", () => {
  it("builds one deterministic plan across both authored migration roots", () => {
    const plan = migrationPlan();
    expect(plan.length).toBeGreaterThan(100);
    expect(new Set(plan.map((entry) => entry.id)).size).toBe(plan.length);
    expect(plan.map((entry) => entry.id)).toEqual(
      [...plan.map((entry) => entry.id)].sort(),
    );
  });

  it("uses the runtime role only to verify the exact schema during Fly release", () => {
    const fly = readFileSync(new URL("../../fly.toml", import.meta.url), "utf8");
    const verifier = readFileSync(
      new URL("../../scripts/verify-migration-state.ts", import.meta.url),
      "utf8",
    );
    expect(fly).toContain('release_command = "node dist/verify-migration-state.js"');
    expect(fly).not.toContain("run-migration.js");
    expect(verifier).toContain("SELECT id, checksum");
    expect(verifier).toContain("compatibleMigrationChecksums");
  });

  it("holds the migration advisory lock on one reserved database connection", () => {
    const runner = readFileSync(
      new URL("../../scripts/run-migration.ts", import.meta.url),
      "utf8",
    );
    expect(runner).toContain("await pool.reserve()");
    expect(runner).toContain("pg_advisory_lock");
    expect(runner).toContain("pg_advisory_unlock");
    expect(runner).toContain('sql.unsafe("BEGIN")');
    expect(runner).toContain('sql.unsafe("COMMIT")');
    expect(runner).toContain('sql.unsafe("ROLLBACK")');
    expect(runner).not.toContain("sql.begin");
    expect(runner).toContain("sql?.release()");
  });

  it("keeps the runtime role non-DDL while granting current and future application DML", () => {
    const grants = readFileSync(
      new URL("../../scripts/configure-production-app-role.sql", import.meta.url),
      "utf8",
    );
    expect(grants).toContain("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    expect(grants).toContain("rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls");
    expect(grants).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eos_app");
    expect(grants).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner");
  });
});
