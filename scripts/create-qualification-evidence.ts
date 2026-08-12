import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputPath = process.env.EOS_QUALIFICATION_EVIDENCE_PATH || ".tmp/eos-qualification-evidence.json";

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function migrationInventory() {
  const files = (await readdir("migrations")).filter((file) => file.endsWith(".sql")).sort();
  return Promise.all(files.map(async (file) => ({ file, sha256: await sha256File(join("migrations", file)) })));
}

const loadResult = await readFile(".tmp/eos-local-load-result.json", "utf8").then(JSON.parse).catch(() => null);
const repository = process.env.GITHUB_REPOSITORY || "local/EntrepreneurOS";
const runId = process.env.GITHUB_RUN_ID || null;
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const evidence = {
  standard: "eos.qualification-evidence.v1",
  generatedAt: new Date().toISOString(),
  scope: "repository_and_disposable_environment",
  productionEvidence: false,
  source: {
    repository,
    commit: process.env.GITHUB_SHA || process.env.EOS_QUALIFICATION_COMMIT || "local-uncommitted",
    workflowRun: runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    githubActions: process.env.GITHUB_ACTIONS === "true",
  },
  qualification: {
    predecessorStepsRequired: [
      "dependency_vulnerability_gate",
      "checksum_migrations",
      "type_safety",
      "unit_and_integration",
      "browser_mobile_accessibility_performance",
      "logical_backup_restore",
      "production_build",
      "container_build",
    ],
    controlsSupported: [
      "frontend_acceptance",
      "api_contract_qualification",
      "ci_qualification",
      "distributed_rate_limit_test",
      "accessibility_performance_release",
    ],
    controlsExplicitlyNotSatisfied: [
      "deployment_smoke",
      "database_isolation_review",
      "load_and_scaling_test",
      "observability_alert_test",
      "production_restore_drill",
      "release_owner_approval",
    ],
    localLoad: loadResult,
  },
  inputs: {
    packageLockSha256: await sha256File("package-lock.json"),
    productionWorkflowSha256: await sha256File(".github/workflows/production-qualification.yml"),
    dockerfileSha256: await sha256File("Dockerfile"),
    flyConfigurationSha256: await sha256File("fly.toml"),
    migrations: await migrationInventory(),
  },
};

await mkdir(join(outputPath, "..").replace(/\\/g, "/"), { recursive: true });
const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
await writeFile(outputPath, serialized, "utf8");
const digest = createHash("sha256").update(serialized).digest("hex");
await writeFile(`${outputPath}.sha256`, `${digest}  ${outputPath}\n`, "utf8");
console.log(JSON.stringify({ evidenceCreated: true, outputPath, sha256: digest, productionEvidence: false }));
