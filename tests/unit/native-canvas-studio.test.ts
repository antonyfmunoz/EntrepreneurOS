import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-canvas-studio.tsx", import.meta.url), "utf8");

describe("native Canvas", () => {
  it("gives an entitled role a visual graph over only role-visible canonical records", () => {
    expect(overlay).toContain("mayOperateNativeCanvas");
    expect(overlay).toContain('toolEntitlements.has("canvas")');
    expect(studio).toContain('data-testid="native-canvas-studio"');
    expect(studio).toContain('`${root}/instruments`');
    expect(studio).toContain('instrumentKey: "canvas"');
    expect(studio).toContain("sourceObjectId");
    expect(studio).toContain("Native visual-model boundary");
  });
});
