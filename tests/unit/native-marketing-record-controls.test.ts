import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const marketingStudio = readFileSync(new URL("../../client/src/components/native-marketing-studio.tsx", import.meta.url), "utf8");

describe("native marketing record controls", () => {
  it("keeps audiences, creatives, placements, and budget guardrails configurable", () => {
    expect(marketingStudio).toContain("Configure selected audience");
    expect(marketingStudio).toContain("native-audience-configure");
    expect(marketingStudio).toContain("expectedVersion: selectedAudience.version");
    expect(marketingStudio).toContain("Configure selected creative");
    expect(marketingStudio).toContain("native-creative-configure");
    expect(marketingStudio).toContain("Configure selected placement");
    expect(marketingStudio).toContain("native-placement-configure");
    expect(marketingStudio).toContain("Configure budget guardrail");
    expect(marketingStudio).toContain("native-budget-configure");
  });
});
