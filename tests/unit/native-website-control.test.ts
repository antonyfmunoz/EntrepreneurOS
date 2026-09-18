import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const funnelStudio = readFileSync(new URL("../../client/src/components/native-funnel-studio.tsx", import.meta.url), "utf8");

describe("native website controls", () => {
  it("lets an authorized operator configure a selected native website in place", () => {
    expect(funnelStudio).toContain("Configure selected website");
    expect(funnelStudio).toContain("Save native website");
    expect(funnelStudio).toContain("native-site-configure");
    expect(funnelStudio).toContain("expectedVersion: selectedSiteConfig.version");
    expect(funnelStudio).toContain('operatingMode: "native_eos"');
  });
});
