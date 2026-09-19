import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-slides-studio.tsx", import.meta.url), "utf8");

describe("native Slides", () => {
  it("gives a Slides-entitled role a governed deck, slide, and theme workspace", () => {
    expect(overlay).toContain("mayOperateNativeSlides");
    expect(overlay).toContain('toolEntitlements.has("slides")');
    expect(studio).toContain('data-testid="native-slides-studio"');
    expect(studio).toContain('instrumentKey: "slides"');
    expect(studio).toContain("parentObjectId");
    expect(studio).toContain("Native-first presentation boundary");
  });
});
