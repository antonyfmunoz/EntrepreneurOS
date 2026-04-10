import fs from "node:fs";
import { analyzeGaps, hasBlockingGaps } from "../lib/spec-parser/gap-analyzer.js";
import { formatGapReport } from "../lib/spec-parser/spec-approval.js";
import type { SpecOutput } from "../shared/spec-schema.js";

async function main() {
  const spec: SpecOutput = JSON.parse(
    fs.readFileSync(".planning/specs/eos-full-spec.json", "utf-8"),
  );
  const gaps = await analyzeGaps(spec, { skipLlm: true });
  const report = formatGapReport(spec, gaps);
  console.log(report);
  console.log("---");
  console.log("hasBlockingGaps:", hasBlockingGaps(gaps));
}

main().catch(console.error);
