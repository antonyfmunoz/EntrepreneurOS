import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), command: vi.fn(), migrations: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: mocks.read }));
vi.mock("node:child_process", () => ({ execFileSync: mocks.command }));
vi.mock("../../scripts/migration-plan", () => ({ migrationPlan: mocks.migrations }));

const candidate = "a".repeat(40), incumbent = "b".repeat(40), commit = "c".repeat(40), base = "d".repeat(40);
const image = `registry.fly.io/eos-app@sha256:${"e".repeat(64)}`;
const oldImage = `registry.fly.io/eos-app@sha256:${"f".repeat(64)}`;
const repo = "antonyfmunoz/EntrepreneurOS";
const proof = { result: "pass", receiptRef: "receipt:test-fixture/not-production" };
const fixture = () => ({ standard: "eos.compatibility-rollback.v1", app: "eos-app", environmentSubject: "environment:entrepreneuros-production", candidateReleaseSubject: `git:${candidate}`,
  incumbent: { image: oldImage, releaseSubject: `git:${incumbent}` },
  fallback: { image, releaseSubject: `git:${commit}`, sourceBaseCommit: base, qualificationRunId: 123, securityRunId: 124 },
  rehearsal: { image, releaseSubject: `git:${commit}`, targetMigrationCount: 115, databaseSubject: "database:local-isolated/test_fixture", completedAt: "2026-09-02T03:00:00Z",
    runtimeReadiness: proof, publicSmoke: proof, authenticatedSmoke: proof, migrationCompatibility: proof, paymentEffectsDisabled: proof, publicPaidSaasDisabled: proof, untrustedUploadsDisabled: proof },
  approval: { decision: "approved", approvedByUserId: "operator", approvedAt: "2026-09-02T03:30:00Z", evidenceRef: "evidence:test-fixture/not-approval" },
});
let runOverride: Record<string, unknown>, imageOverride: Record<string, unknown>;
let changed: string, workflowMismatch: boolean, ancestryFailure: boolean;
let originalArgv: string[], originalExit: typeof process.exitCode;
const runCli = async () => { await import("../../scripts/verify-compatibility-rollback"); };

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-02T04:00:00Z"));
  originalArgv = process.argv; originalExit = process.exitCode; process.exitCode = undefined;
  process.argv = ["node", "verify-compatibility-rollback.ts", "--file", "fixture.json", "--app", "eos-app", "--candidate-subject", `git:${candidate}`, "--incumbent-image", oldImage, "--incumbent-subject", `git:${incumbent}`];
  for (const key of ["EOS_PUBLIC_PAID_SAAS", "EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED", "EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED", "EOS_UNTRUSTED_UPLOADS_ENABLED"]) vi.stubEnv(key, "false");
  vi.stubEnv("EOS_GITHUB_REPOSITORY", repo); vi.stubEnv("EOS_PRODUCTION_ENVIRONMENT_SUBJECT", "environment:entrepreneuros-production"); vi.stubEnv("EOS_PLATFORM_ADMIN_USER_IDS", "operator");
  vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.read.mockReturnValue(JSON.stringify(fixture())); mocks.migrations.mockReturnValue(Array(115));
  runOverride = {}; imageOverride = {}; changed = "server/routes/eos-runtime.ts\ntests/integration/eos-runtime.integration.test.ts\ndocs/EOS-COMPATIBILITY-FALLBACK.md"; workflowMismatch = false; ancestryFailure = false;
  mocks.command.mockImplementation((program: string, args: string[]) => {
    if (program === "git" && args[0] === "merge-base") { if (ancestryFailure) throw new Error("private command detail"); return ""; }
    if (program === "git" && args[0] === "diff") return changed;
    if (program === "git" && args[0] === "rev-parse") return workflowMismatch && args[1].startsWith(commit) ? "different" : "same-workflow-blob";
    if (program === "gh") {
      const security = args[1].endsWith("124");
      return JSON.stringify({ head_sha: commit, name: security ? "CodeQL" : "Production qualification", status: "completed", conclusion: "success", event: "workflow_dispatch", path: security ? ".github/workflows/codeql.yml" : ".github/workflows/production-qualification.yml", head_repository: { full_name: repo }, ...runOverride });
    }
    if (program === "docker") return JSON.stringify([{ RepoDigests: [image], Config: { Labels: { "org.opencontainers.image.revision": commit } }, Os: "linux", Architecture: "amd64", ...imageOverride }]);
    throw new Error("Unexpected command");
  });
});
afterEach(() => { process.argv = originalArgv; process.exitCode = originalExit; vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("compatibility fallback CLI external evidence checks", () => {
  it("checks both exact-source workflows and immutable image before returning a manifest digest", async () => {
    await runCli();
    expect(process.exitCode).toBeUndefined();
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({ valid: true, image, releaseSubject: `git:${commit}`, manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(mocks.command.mock.calls.filter(([program]) => program === "gh")).toHaveLength(2);
    expect(mocks.command).toHaveBeenCalledWith("docker", ["image", "inspect", image], expect.objectContaining({ timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] }));
  });
  it.each(["EOS_PUBLIC_PAID_SAAS", "EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED", "EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED", "EOS_UNTRUSTED_UPLOADS_ENABLED"])("requires explicit disabled %s before provider calls", async key => {
    vi.stubEnv(key, "true"); await runCli(); expect(process.exitCode).toBe(1); expect(mocks.command).not.toHaveBeenCalled();
  });
  it.each([{ head_sha: candidate }, { conclusion: "failure" }, { status: "in_progress" }, { event: "pull_request" }, { path: ".github/workflows/untrusted.yml" }, { head_repository: { full_name: "someone/fork" } }, { name: "Some other workflow" }])("rejects unqualified or mismatched CI run %j", async override => {
    runOverride = override; await runCli(); expect(process.exitCode).toBe(1);
    expect(mocks.command.mock.calls.some(([program]) => program === "docker")).toBe(false);
  });
  it.each([{ RepoDigests: [] }, { Config: { Labels: { "org.opencontainers.image.revision": candidate } } }, { Os: "windows" }, { Architecture: "arm64" }])("rejects unbound or incompatible image %j", async override => {
    imageOverride = override; await runCli(); expect(process.exitCode).toBe(1); expect(console.log).not.toHaveBeenCalled();
  });
  it.each(["", "server/security/auth.ts", ".github/workflows/production-qualification.yml"])("rejects absent or out-of-scope source changes %s", async value => {
    changed = value; await runCli(); expect(process.exitCode).toBe(1);
    expect(mocks.command.mock.calls.some(([program]) => program === "gh")).toBe(false);
  });
  it("rejects modified qualification workflow blobs", async () => {
    workflowMismatch = true; await runCli(); expect(process.exitCode).toBe(1); expect(console.log).not.toHaveBeenCalled();
  });
  it("does not leak child-process errors when source ancestry cannot be established", async () => {
    ancestryFailure = true; await runCli(); expect(process.exitCode).toBe(1); expect(console.error).toHaveBeenCalledWith("Compatibility fallback verification failed.");
  });
  it("fails closed on malformed manifest without echoing its contents", async () => {
    mocks.read.mockReturnValue("private-invalid-json"); await runCli(); expect(process.exitCode).toBe(1); expect(mocks.command).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("Compatibility fallback verification failed.");
  });
});
