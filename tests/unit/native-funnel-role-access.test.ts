import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(
  new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url),
  "utf8",
);
const funnelStudio = readFileSync(
  new URL("../../client/src/components/native-funnel-studio.tsx", import.meta.url),
  "utf8",
);

describe("native lead capture and funnel role access", () => {
  it("gives founder-equivalent native commercial controls to a role equipped with the required tools", () => {
    expect(overlay).toContain("mayOperateNativeLeadCapture");
    expect(overlay).toContain("mayOperateNativeFunnels");
    expect(overlay).toContain('toolEntitlements.has("forms")');
    expect(overlay).toContain('toolEntitlements.has("crm")');
    expect(overlay).toContain('toolEntitlements.has("websites")');
    expect(overlay).not.toContain("mayOperateFounderGrowthTools");
  });

  it("keeps the controls native and authority-gated rather than treating role access as provider dispatch", () => {
    expect(overlay).toContain("LeadCaptureStudio");
    expect(overlay).toContain("NativeFunnelStudio");
    expect(funnelStudio).toContain('instrumentKey: "websites"');
    expect(funnelStudio).toContain('"/instruments/forms"');
    expect(funnelStudio).toContain("No external website, funnel, or CRM");
  });
});
