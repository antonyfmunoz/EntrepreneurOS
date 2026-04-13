#!/usr/bin/env npx tsx
// scripts/reset-react-gen.ts
// Deletes all pipeline_pages rows where phase='react-gen' for projectId 'entrepreneur-os'.
// Also resets any incomplete pipeline_runs back to react-gen phase.

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const PROJECT_ID = "entrepreneur-os";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const sql = neon(url);

  // Count existing rows
  const countResult = await sql(
    "SELECT COUNT(*) as cnt FROM pipeline_pages WHERE project_id = $1 AND phase = $2",
    [PROJECT_ID, "react-gen"],
  );
  const count = Number(countResult[0]?.cnt ?? 0);
  console.log(`Found ${count} react-gen rows for project '${PROJECT_ID}'`);

  if (count > 0) {
    // Delete react-gen rows
    await sql(
      "DELETE FROM pipeline_pages WHERE project_id = $1 AND phase = $2",
      [PROJECT_ID, "react-gen"],
    );
    console.log(`Deleted ${count} react-gen rows`);
  }

  // Also delete integration/backend/deploy rows so the pipeline doesn't skip react-gen
  for (const phase of ["integration", "backend", "deploy"]) {
    const phaseCount = await sql(
      "SELECT COUNT(*) as cnt FROM pipeline_pages WHERE project_id = $1 AND phase = $2",
      [PROJECT_ID, phase],
    );
    const n = Number(phaseCount[0]?.cnt ?? 0);
    if (n > 0) {
      await sql(
        "DELETE FROM pipeline_pages WHERE project_id = $1 AND phase = $2",
        [PROJECT_ID, phase],
      );
      console.log(`Deleted ${n} ${phase} rows`);
    }
  }

  // Reset any incomplete runs to react-gen
  const runResult = await sql(
    "UPDATE pipeline_runs SET phase = 'react-gen', status = 'running', updated_at = NOW() WHERE project_id = $1 AND status != 'complete' RETURNING id",
    [PROJECT_ID],
  );
  if (runResult.length > 0) {
    console.log(`Reset ${runResult.length} incomplete run(s) to react-gen`);
  }

  // Check what spec/copy rows remain (should be untouched)
  const specCount = await sql(
    "SELECT COUNT(*) as cnt FROM pipeline_pages WHERE project_id = $1 AND phase = 'spec' AND status = 'complete'",
    [PROJECT_ID],
  );
  const copyCount = await sql(
    "SELECT COUNT(*) as cnt FROM pipeline_pages WHERE project_id = $1 AND phase = 'copy' AND status = 'complete'",
    [PROJECT_ID],
  );
  console.log(`Remaining: ${specCount[0]?.cnt} spec rows, ${copyCount[0]?.cnt} copy rows`);
  console.log("Done. Ready to re-run react-gen.");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
