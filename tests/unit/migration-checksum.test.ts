import { describe, expect, it } from "vitest";
import { canonicalMigrationContents, compatibleMigrationChecksums, migrationChecksum } from "../../scripts/migration-checksum";

describe("migration checksum", () => {
  it("is stable across LF and CRLF checkouts", () => {
    const lf = "CREATE TABLE example (id text);\nALTER TABLE example ADD COLUMN active boolean;\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(canonicalMigrationContents(crlf)).toBe(lf);
    expect(migrationChecksum(crlf)).toBe(migrationChecksum(lf));
    expect(compatibleMigrationChecksums(crlf)).toContain(migrationChecksum(lf));
    expect([...compatibleMigrationChecksums(lf)]).toEqual([...compatibleMigrationChecksums(crlf)]);
  });

  it("still detects substantive migration changes", () => {
    expect(migrationChecksum("SELECT 1;\n")).not.toBe(migrationChecksum("SELECT 2;\n"));
  });
});
