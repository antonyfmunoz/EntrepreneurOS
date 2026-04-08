/**
 * Stitch MCP smoke test.
 *
 * Exercises the real, wired MCP tools (list_projects, list_screens) against
 * a live Stitch project. Skips delete_screen / export_design_system because
 * those tools do not exist in @google/stitch-sdk@0.0.3 — see
 * .planning/stitch-mcp-research.md.
 *
 * Usage:
 *     STITCH_API_KEY=... STITCH_PROJECT_ID=... npx tsx scripts/test-stitch-workflow.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultStitchMcpInvoke,
  getStitchToolClient,
} from "../lib/stitch/mcp-invoker.js";
import { STITCH_MCP_TOOLS } from "../lib/stitch/types.js";
import { listScreens } from "../lib/stitch/screen-management.js";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), ".env"));

  const projectId = process.env.STITCH_PROJECT_ID;
  if (!process.env.STITCH_API_KEY) {
    console.error("STITCH_API_KEY is not set");
    process.exit(1);
  }

  console.log("Stitch MCP smoke test\n");

  // 1. list_projects
  console.log("1. list_projects");
  try {
    const projects: any = await defaultStitchMcpInvoke(
      STITCH_MCP_TOOLS.LIST_PROJECTS,
      { filter: "view=owned" }
    );
    const list = projects?.projects ?? projects ?? [];
    console.log(`   ✓ ${Array.isArray(list) ? list.length : 0} owned project(s)`);
    if (Array.isArray(list)) {
      for (const p of list.slice(0, 5)) {
        console.log(`     - ${p.name ?? "(unnamed)"} ${p.title ? `"${p.title}"` : ""}`);
      }
    }
  } catch (err) {
    console.error(`   ✗ ${(err as Error).message}`);
  }

  // 2. list_screens (only if projectId provided)
  if (projectId) {
    console.log(`\n2. list_screens for project ${projectId}`);
    const screens = await listScreens(projectId);
    console.log(`   ✓ ${screens.length} screen(s)`);
    for (const s of screens.slice(0, 10)) {
      console.log(`     - ${s.id} (${s.createdAt || "no createTime"})`);
    }
  } else {
    console.log("\n2. list_screens — SKIPPED (set STITCH_PROJECT_ID to enable)");
  }

  // 3. tools that don't exist — confirm we know they don't
  console.log("\n3. delete_screen / export_design_system — N/A");
  console.log("   These tools are not exposed by SDK 0.0.3.");
  console.log("   See .planning/stitch-mcp-research.md");

  // Cleanup
  try {
    getStitchToolClient(); // ensure singleton was used (no-op)
  } catch {
    // ignore
  }

  console.log("\n✓ Smoke test complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
