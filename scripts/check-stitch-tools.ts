/**
 * Stitch MCP tool drift watcher.
 *
 * Reads the installed @google/stitch-sdk tool manifest and diffs it against
 * the STITCH_MCP_TOOLS constant in lib/stitch/types.ts. Prints additions and
 * removals. Exits non-zero on any drift so this can be wired into CI.
 *
 * Run after SDK upgrades:
 *     npx tsx scripts/check-stitch-tools.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STITCH_MCP_TOOLS } from "../lib/stitch/types.js";

const SDK_MANIFEST = resolve(
  process.cwd(),
  "node_modules/@google/stitch-sdk/dist/generated/src/tool-definitions.js"
);

function loadSdkToolNames(): Set<string> {
  const text = readFileSync(SDK_MANIFEST, "utf8");
  const matches = text.matchAll(/"name"\s*:\s*"([a-z_]+)"/g);
  const names = new Set<string>();
  for (const m of matches) names.add(m[1]);
  return names;
}

function main(): void {
  const sdkTools = loadSdkToolNames();
  const ourTools = new Set<string>(Object.values(STITCH_MCP_TOOLS));

  const added: string[] = [];
  const removed: string[] = [];
  for (const t of sdkTools) if (!ourTools.has(t)) added.push(t);
  for (const t of ourTools) if (!sdkTools.has(t)) removed.push(t);

  console.log(`SDK tools (${sdkTools.size}): ${[...sdkTools].sort().join(", ")}`);
  console.log(`Our constant (${ourTools.size}): ${[...ourTools].sort().join(", ")}`);

  if (added.length === 0 && removed.length === 0) {
    console.log("\n✓ STITCH_MCP_TOOLS matches the SDK manifest exactly.");
    return;
  }

  if (added.length > 0) {
    console.log(`\n+ ADDED in SDK, missing from STITCH_MCP_TOOLS:`);
    for (const t of added) console.log(`    + ${t}`);
    console.log(
      `  → Update lib/stitch/types.ts and consider wiring these in screen-management.ts / design-md.ts.`
    );
  }
  if (removed.length > 0) {
    console.log(`\n- REMOVED from SDK, still in STITCH_MCP_TOOLS:`);
    for (const t of removed) console.log(`    - ${t}`);
    console.log(`  → Remove from lib/stitch/types.ts and audit callers.`);
  }

  process.exitCode = 1;
}

main();
