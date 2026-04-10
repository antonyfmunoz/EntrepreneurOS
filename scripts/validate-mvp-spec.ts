import fs from "node:fs";
import { SpecOutputSchema } from "../shared/spec-schema.js";
import { analyzeGaps, hasBlockingGaps } from "../lib/spec-parser/gap-analyzer.js";
import { formatGapReport } from "../lib/spec-parser/spec-approval.js";

async function main() {
  const spec = JSON.parse(
    fs.readFileSync(".planning/specs/eos-mvp-spec.json", "utf-8"),
  );

  // 1. Schema validation
  const result = SpecOutputSchema.safeParse(spec);
  if (result.success) {
    console.log("Schema validation: PASSED");
    console.log("  Pages:", result.data.pages.length);
    console.log("  Shared components:", result.data.sharedComponents.length);
    console.log("  Backend endpoints:", result.data.backendSpec?.endpoints.length ?? 0);
  } else {
    console.log("Schema validation: FAILED");
    result.error.errors.forEach((e) =>
      console.log("  " + e.path.join(".") + ": " + e.message),
    );
    process.exit(1);
  }

  // 2. Gap analysis
  console.log("\n--- Gap Analysis ---\n");
  const gaps = await analyzeGaps(result.data, { skipLlm: true });
  const report = formatGapReport(result.data, gaps);
  console.log(report);
  console.log("hasBlockingGaps:", hasBlockingGaps(gaps));
}

main().catch(console.error);
