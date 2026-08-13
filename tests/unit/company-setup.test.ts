import { describe, expect, it } from "vitest";
import { normalizeOptionalGoals } from "../../client/src/lib/company-setup";

describe("company setup", () => {
  it("omits goals when the user chooses to skip them", () => {
    expect(normalizeOptionalGoals("")).toBeUndefined();
    expect(normalizeOptionalGoals("   ")).toBeUndefined();
  });

  it("preserves a goal the user submits", () => {
    expect(normalizeOptionalGoals("  Reach ten design partners  ")).toBe("Reach ten design partners");
  });
});
