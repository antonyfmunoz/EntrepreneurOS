import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const marketingStudio = readFileSync(new URL("../../client/src/components/native-marketing-studio.tsx", import.meta.url), "utf8");

describe("native marketing studio", () => {
  it("gives the growth control surface to the founder or a role explicitly equipped with the ads tool", () => {
    expect(overlay).toContain("NativeMarketingStudio");
    expect(overlay).toContain('toolEntitlements.has("ads")');
    expect(overlay).toContain("mayOperateNativeMarketing");
    expect(marketingStudio).toContain('data-testid="native-marketing-studio"');
  });

  it("keeps campaign, audience, creative, placement, and budget records native and governed", () => {
    expect(marketingStudio).toContain('objectType: "campaign"');
    expect(marketingStudio).toContain('objectType: "audience"');
    expect(marketingStudio).toContain('objectType: "creative"');
    expect(marketingStudio).toContain('objectType: "placement"');
    expect(marketingStudio).toContain('objectType: "budget"');
    expect(marketingStudio).toContain("expectedVersion: object.version");
    expect(marketingStudio).toContain("expectedVersion: selectedMeasurementCampaign.version");
  });

  it("does not represent a plan as provider delivery or a provider receipt", () => {
    expect(marketingStudio).toContain('delivery: "not_dispatched"');
    expect(marketingStudio).toContain("does not dispatch to an external provider");
    expect(marketingStudio).toContain("does not pretend a plan has already spent money");
  });
});
