import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { compatibilityRollbackIssues } from "../server/security/compatibility-rollback";
import { migrationPlan } from "./migration-plan";

const argument = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? "" : process.argv[index + 1] || ""; };
class RollbackVerificationError extends Error {}
const command = (program: string, args: string[]) => execFileSync(program, args, { encoding: "utf8", timeout: 60_000, maxBuffer: 2_000_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
try {
  if (process.env.EOS_PUBLIC_PAID_SAAS !== "false" || process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED !== "false" || process.env.EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED !== "false" || process.env.EOS_UNTRUSTED_UPLOADS_ENABLED !== "false") throw new RollbackVerificationError("Compatibility fallback requires explicit internal, provider-effects-off, trusted-source configuration.");
  const repo = process.env.EOS_GITHUB_REPOSITORY || "";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new RollbackVerificationError("Repository identity missing.");
  const raw = readFileSync(argument("--file"), "utf8");
  const manifest = JSON.parse(raw);
  const candidateReleaseSubject = argument("--candidate-subject");
  const issues = compatibilityRollbackIssues(manifest, {
    app: argument("--app"), environmentSubject: process.env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT || "", candidateReleaseSubject,
    incumbentImage: argument("--incumbent-image"), incumbentReleaseSubject: argument("--incumbent-subject"),
    targetMigrationCount: migrationPlan().length,
    platformAdministratorIds: (process.env.EOS_PLATFORM_ADMIN_USER_IDS || "").split(",").map(value => value.trim()).filter(Boolean),
  });
  if (issues.length) throw new RollbackVerificationError(`Incomplete compatibility rollback evidence: ${issues.join(", ")}`);
  const fallback = manifest.fallback;
  const commit = fallback.releaseSubject.slice(4);
  const candidate = candidateReleaseSubject.slice(4);
  command("git", ["merge-base", "--is-ancestor", fallback.sourceBaseCommit, commit]);
  command("git", ["merge-base", "--is-ancestor", fallback.sourceBaseCommit, candidate]);
  const allowedChanges = new Set(["server/routes/eos-runtime.ts", "tests/integration/eos-runtime.integration.test.ts", "docs/EOS-COMPATIBILITY-FALLBACK.md"]);
  const changed = command("git", ["diff", "--name-only", fallback.sourceBaseCommit, commit]).split(/\r?\n/).filter(Boolean);
  if (!changed.length || changed.some(path => !allowedChanges.has(path))) throw new RollbackVerificationError("Fallback source changes exceed the reviewed compatibility scope.");
  for (const [id, name, workflow] of [
    [fallback.qualificationRunId, "Production qualification", ".github/workflows/production-qualification.yml"],
    [fallback.securityRunId, "CodeQL", ".github/workflows/codeql.yml"],
  ] as const) {
    const run = JSON.parse(command("gh", ["api", `repos/${repo}/actions/runs/${id}`]));
    if (run.head_sha !== commit || run.name !== name || run.status !== "completed" || run.conclusion !== "success"
      || !["push", "workflow_dispatch"].includes(run.event) || run.path !== workflow || run.head_repository?.full_name !== repo)
      throw new RollbackVerificationError("Exact-source fallback qualification did not pass.");
    if (command("git", ["rev-parse", `${commit}:${workflow}`]) !== command("git", ["rev-parse", `${candidate}:${workflow}`]))
      throw new RollbackVerificationError("Fallback qualification workflow differs from canonical checks.");
  }
  // Inspect the immutable digest, never a mutable tag. Pulling/building is a separate preparation step.
  const image = JSON.parse(command("docker", ["image", "inspect", fallback.image]))[0];
  if (!image.RepoDigests?.includes(fallback.image) || image.Config?.Labels?.["org.opencontainers.image.revision"] !== commit
    || image.Os !== "linux" || image.Architecture !== "amd64") throw new RollbackVerificationError("Fallback image provenance or architecture mismatch.");
  console.log(JSON.stringify({ valid: true, image: fallback.image, releaseSubject: fallback.releaseSubject, manifestSha256: createHash("sha256").update(raw).digest("hex") }));
} catch (error) {
  // Child-process errors can include provider details. Only our own fixed validation errors are exposed.
  console.error(error instanceof RollbackVerificationError ? error.message : "Compatibility fallback verification failed.");
  process.exitCode = 1;
}
