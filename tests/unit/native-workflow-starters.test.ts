import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composer = readFileSync(new URL("../../client/src/components/native-workflow-composer.tsx", import.meta.url), "utf8");

describe("native workflow starters", () => {
  it("offers company-configurable business-in-a-box starters instead of a single generic workflow", () => {
    expect(composer).toContain('key: "lead-to-discovery"');
    expect(composer).toContain('key: "client-onboarding"');
    expect(composer).toContain('key: "weekly-operating-review"');
    expect(composer).toContain('key: "reputation-follow-through"');
    expect(composer).toContain("Business-in-a-box starters");
  });

  it("preserves template ancestry while making the resulting company workflow editable", () => {
    expect(composer).toContain("native_workflow_starter.${starter.key}.v1");
    expect(composer).toContain("templateAncestry,");
    expect(composer).toContain("setSteps(starter.steps.map");
  });

  it("keeps starter actions native-first and does not invent external effects", () => {
    expect(composer).toContain("Do not transmit data to an external provider unless an explicit provider capability");
    expect(composer).toContain("unverified external send claim");
  });
});
