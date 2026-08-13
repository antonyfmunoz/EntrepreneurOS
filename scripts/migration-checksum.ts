import { createHash } from "node:crypto";

export function canonicalMigrationContents(contents: string): string {
  return contents.replace(/\r\n/g, "\n");
}

export function migrationChecksum(contents: string): string {
  return createHash("sha256").update(canonicalMigrationContents(contents)).digest("hex");
}

export function compatibleMigrationChecksums(contents: string): Set<string> {
  const canonical = canonicalMigrationContents(contents);
  return new Set([
    createHash("sha256").update(canonical).digest("hex"),
    createHash("sha256").update(canonical.replace(/\n/g, "\r\n")).digest("hex"),
  ]);
}
