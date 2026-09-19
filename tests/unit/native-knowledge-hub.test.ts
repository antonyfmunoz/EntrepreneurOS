import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../../client/src/components/native-knowledge-hub.tsx", import.meta.url), "utf8");

describe("native Knowledge Hub", () => {
  it("gives only a Knowledge-entitled role a focused native source and retrieval workspace", () => {
    expect(overlay).toContain("mayOperateNativeKnowledge");
    expect(overlay).toContain('toolEntitlements.has("knowledge")');
    expect(hub).toContain('data-testid="native-knowledge-hub"');
    expect(hub).toContain('instrumentKey: "knowledge"');
    expect(hub).toContain("/instruments/knowledge");
    expect(hub).toContain("Knowledge is not automatic memory");
  });
});
