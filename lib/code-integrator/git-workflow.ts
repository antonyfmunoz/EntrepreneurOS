import { exec } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import { join } from "path";

export type ExecFn = (cmd: string) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: ExecFn = promisify(exec);

// Checks out the base branch then creates the feature integration branch from it.
// Both branch names are required — no project-specific defaults.
// execFn is injectable for testing.
export async function createBranch(
  baseBranch: string,
  featureBranch: string,
  execFn: ExecFn = defaultExec,
): Promise<void> {
  await execFn(`git checkout ${baseBranch}`);
  await execFn(`git checkout -b ${featureBranch}`);
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
// featureBranch is required — no hardcoded branch name.
// Returns the PR URL from gh stdout.
// execFn is injectable for testing.
export async function pushAndCreatePR(
  featureBranch: string,
  pagesSummary: string[],
  execFn: ExecFn = defaultExec,
): Promise<string> {
  await execFn(`git push -u origin ${featureBranch}`);
  const body = `## Pages Integrated\\n\\n${pagesSummary.map((p) => `- ${p}`).join("\\n")}`;
  const title = "feat(ui): integrate generated pages";
  const { stdout } = await execFn(
    `gh pr create --title "${title}" --body "${body}"`,
  );
  return stdout.trim();
}

/**
 * Selects a base branch by checking for marker files in the project root, with
 * a fallback feature branch when the markers are absent. No project-specific
 * defaults — every branch name and marker is supplied by the caller from
 * project config. (D-16, generalized.)
 *
 * Logic:
 *   1. If `markerFiles` is non-empty AND every marker exists → return `defaultBranch`
 *   2. Else if `fallbackBranch` is set AND `git branch --list <fallback>` is non-empty → return `fallbackBranch`
 *   3. Else → return `defaultBranch`
 *
 * @param projectRoot     Absolute path to the project root
 * @param options         Marker files, fallback feature branch, and the default branch name
 * @param execFn          Injectable exec for testing
 */
export async function detectBaseBranch(
  projectRoot: string,
  options: {
    markerFiles?: string[];
    fallbackBranch?: string;
    defaultBranch: string;
  },
  execFn: ExecFn = defaultExec,
): Promise<string> {
  const markerFiles = options.markerFiles ?? [];
  const fallbackBranch = options.fallbackBranch;
  const defaultBranch = options.defaultBranch;

  if (markerFiles.length > 0) {
    try {
      for (const f of markerFiles) {
        await access(join(projectRoot, f));
      }
      return defaultBranch;
    } catch {
      // fall through to fallback check
    }
  }

  if (fallbackBranch) {
    try {
      const { stdout } = await execFn(`git branch --list ${fallbackBranch}`);
      if (stdout.trim()) return fallbackBranch;
    } catch {
      // fall through to default
    }
  }

  return defaultBranch;
}
