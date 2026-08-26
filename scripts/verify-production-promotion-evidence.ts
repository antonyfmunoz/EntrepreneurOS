import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { productionPromotionEvidenceIssues } from "../server/security/production-promotion-evidence";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] || "").trim() : "";
}
function targetMigrationCount(): number {
  const sources = [
    { directory: resolve(process.cwd(), "scripts", "migrations"), include: (_file: string) => true },
    { directory: resolve(process.cwd(), "migrations"), include: (file: string) => !file.startsWith("0000_") },
  ];
  return sources.reduce((total, source) => {
    if (!existsSync(source.directory)) return total;
    return total + readdirSync(source.directory).filter((file) => file.endsWith(".sql") && source.include(file)).length;
  }, 0);
}

const file = argument("--file");
const releaseSubject = argument("--release-subject");
const environmentSubject = argument("--environment-subject");
const rollbackSubject = argument("--rollback-subject");
const platformAdministratorIds = argument("--platform-administrators").split(",").map((item) => item.trim()).filter(Boolean);

if (!file || !releaseSubject || !environmentSubject || !rollbackSubject || platformAdministratorIds.length === 0) {
  console.error("Promotion evidence verification requires --file, --release-subject, --environment-subject, --rollback-subject, and --platform-administrators.");
  process.exitCode = 1;
} else {
  try {
    const evidence = JSON.parse(readFileSync(resolve(file), "utf8"));
    const migrationCount = targetMigrationCount();
    const issues = productionPromotionEvidenceIssues(evidence, {
      releaseSubject,
      environmentSubject,
      rollbackSubject,
      targetMigrationCount: migrationCount,
      platformAdministratorIds,
    });
    if (issues.length) {
      console.error(`Production promotion evidence is incomplete or stale: ${issues.join(", ")}`);
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ valid: true, releaseSubject, environmentSubject, rollbackSubject, targetMigrationCount: migrationCount }));
    }
  } catch (error) {
    console.error(`Production promotion evidence could not be verified: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
