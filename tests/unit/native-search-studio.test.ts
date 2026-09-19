import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-search-studio.tsx", import.meta.url), "utf8");

describe("native Search Studio", () => {
  it("uses only the role-filtered native instrument endpoint and allows governed saved searches", () => {
    expect(overlay).toContain("mayOperateNativeSearch");
    expect(overlay).toContain('toolEntitlements.has("search")');
    expect(studio).toContain('data-testid="native-search-studio"');
    expect(studio).toContain('`${root}/instruments`');
    expect(studio).toContain('instrumentKey: "search"');
    expect(studio).toContain("permittedInstrumentKeys");
    expect(studio).toContain("never sends company data to an external provider");
  });
});
