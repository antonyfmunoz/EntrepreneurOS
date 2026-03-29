import { exec } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import { join } from "path";

export type ExecFn = (cmd: string) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: ExecFn = promisify(exec);

const BRANCH_NAME = "feature/ui-integration";

// Checks out the base branch then creates feature/ui-integration from it.
// baseBranch defaults to "main" but can be overridden (per D-16).
// execFn is injectable for testing — defaults to promisify(child_process.exec).
export async function createBranch(
  baseBranch: string = "main",
  execFn: ExecFn = defaultExec,
): Promise<void> {
  await execFn(`git checkout ${baseBranch}`);
  await execFn(`git checkout -b ${BRANCH_NAME}`);
}

// Stages the specified files, commits with the standard message format, and returns the short commit hash.
// execFn is injectable for testing.
export async function commitPage(
  pageName: string,
  files: string[],
  execFn: ExecFn = defaultExec,
): Promise<string> {
  for (const f of files) {
    await execFn(`git add "${f}"`);
  }
  const message = `feat(ui): integrate ${pageName} page`;
  await execFn(`git commit -m "${message}"`);
  const { stdout } = await execFn("git log -1 --format=%h");
  return stdout.trim();
}

// Pushes the integration branch to origin and creates a PR via gh CLI.
// Returns the PR URL from gh stdout.
// execFn is injectable for testing.
export async function pushAndCreatePR(
  pagesSummary: string[],
  execFn: ExecFn = defaultExec,
): Promise<string> {
  await execFn(`git push -u origin ${BRANCH_NAME}`);
  const body = `## Pages Integrated\\n\\n${pagesSummary.map((p) => `- ${p}`).join("\\n")}`;
  const title = "feat(ui): integrate generated pages";
  const { stdout } = await execFn(
    `gh pr create --title "${title}" --body "${body}"`,
  );
  return stdout.trim();
}

// D-16: Determine base branch based on CompanyGate dependency.
// Returns "main" when company-guard.tsx exists in projectRoot (files exist on current branch).
// Returns "feature/company-system" when absent and that branch exists.
// Falls back to "main" when both conditions are false.
// execFn is injectable for testing.
export async function detectBaseBranch(
  projectRoot: string,
  execFn: ExecFn = defaultExec,
): Promise<string> {
  try {
    await access(join(projectRoot, "client/src/lib/company-guard.tsx"));
    await access(join(projectRoot, "client/src/hooks/use-company.ts"));
    // Both files present — we are already on a branch that includes company-guard work
    return "main";
  } catch {
    // Files not found — check if feature/company-system branch exists
    try {
      const { stdout } = await execFn("git branch --list feature/company-system");
      if (stdout.trim()) {
        return "feature/company-system";
      }
      return "main";
    } catch {
      return "main";
    }
  }
}
