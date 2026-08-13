import { describe, expect, it } from "vitest";
import { safeInternalReturnPath } from "../../client/src/lib/safe-return";

describe("safe internal return paths", () => {
  it("keeps an internal invitation route with query and fragment", () => {
    expect(safeInternalReturnPath("/invitations/accept?token=opaque#review")).toBe("/invitations/accept?token=opaque#review");
  });

  it.each(["https://attacker.test", "//attacker.test/path", "/\\attacker.test", "javascript:alert(1)", "\u0000/portfolios"])("rejects unsafe redirect %s", (value) => {
    expect(safeInternalReturnPath(value)).toBe("/portfolios");
  });
});
