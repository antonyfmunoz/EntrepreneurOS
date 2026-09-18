import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composer = readFileSync(new URL("../../client/src/components/native-workflow-composer.tsx", import.meta.url), "utf8");
const starterLibrary = readFileSync(new URL("../../shared/native-workflow-starters.ts", import.meta.url), "utf8");

describe("native workflow starters", () => {
  it("offers company-configurable business-in-a-box starters instead of a single generic workflow", () => {
    expect(starterLibrary).toContain('key: "lead-to-discovery"');
    expect(starterLibrary).toContain('key: "client-onboarding"');
    expect(starterLibrary).toContain('key: "weekly-operating-review"');
    expect(starterLibrary).toContain('key: "reputation-follow-through"');
    expect(starterLibrary).toContain('key: "capability-to-placement"');
    expect(composer).toContain("Business-in-a-box starters");
    expect(composer).toContain("nativeWorkflowStarters");
  });

  it("preserves template ancestry while making the resulting company workflow editable", () => {
    expect(composer).toContain("native_workflow_starter.${starter.key}.v1");
    expect(composer).toContain("templateAncestry,");
    expect(composer).toContain("materializeNativeWorkflowStarter(starter.key, companyContext)");
    expect(composer).toContain("setSteps(materialized.steps.map");
    expect(composer).toContain("company&apos;s mission variables");
  });

  it("keeps starter actions native-first and does not invent external effects", () => {
    expect(composer).toContain("Do not transmit data to an external provider unless an explicit provider capability");
    expect(starterLibrary).toContain("unverified external send claim");
    expect(starterLibrary).toContain("without assuming an employment decision");
  });
});
