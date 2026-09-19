import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");

describe("approval decision acknowledgement", () => {
  it("acknowledges a completed approval command before its surrounding workspace refresh", () => {
    const start = overlay.indexOf("const approvalMutation = useMutation");
    const end = overlay.indexOf("const transitionMutation", start);
    const handler = overlay.slice(start, end);
    expect(handler).toContain('variables.decision === "approved" ? "Work approved" : "Work rejected"');
    expect(handler.indexOf("toast({")).toBeGreaterThanOrEqual(0);
    expect(handler.indexOf("await refresh();")).toBeGreaterThan(handler.indexOf("toast({"));
  });
});
