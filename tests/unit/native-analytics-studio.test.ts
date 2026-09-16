import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-analytics-studio.tsx", import.meta.url), "utf8");

describe("native analytics studio", () => {
  it("gives the founder the decision surface by default and requires an analytics tool grant for other roles", () => {
    expect(overlay).toContain("NativeAnalyticsStudio");
    expect(overlay).toContain('toolEntitlements.has("analytics")');
    expect(overlay).toContain("mayOperateNativeAnalytics");
  });

  it("retains metric contracts, observations, dashboards, and reports as governed EOS records", () => {
    expect(studio).toContain('objectType: "metric"');
    expect(studio).toContain('objectType: "observation"');
    expect(studio).toContain('objectType: "dashboard"');
    expect(studio).toContain('objectType: "report"');
    expect(studio).toContain("sourceObjectIds");
    expect(studio).toContain("expectedVersion: object.version");
  });

  it("does not claim an unverified provider refresh or reconciliation", () => {
    expect(studio).toContain('reconciliation: observationSource === "native_eos" ? "not_required" : "pending_receipt"');
    expect(studio).toContain("never invents an external value");
    expect(studio).toContain("externalData: \"not_asserted\"");
  });
});
