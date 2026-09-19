import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { materializeNativeWorkflowStarter } from "../../shared/native-workflow-starters";

const composer = readFileSync(new URL("../../client/src/components/native-workflow-composer.tsx", import.meta.url), "utf8");
const starterLibrary = readFileSync(new URL("../../shared/native-workflow-starters.ts", import.meta.url), "utf8");

describe("native workflow starters", () => {
  it("offers company-configurable business-in-a-box starters instead of a single generic workflow", () => {
    expect(starterLibrary).toContain('key: "lead-to-discovery"');
    expect(starterLibrary).toContain('key: "client-onboarding"');
    expect(starterLibrary).toContain('key: "weekly-operating-review"');
    expect(starterLibrary).toContain('key: "reputation-follow-through"');
    expect(starterLibrary).toContain('key: "editorial-cadence"');
    expect(starterLibrary).toContain('key: "capability-to-placement"');
    expect(starterLibrary).toContain('key: "finance-control-cycle"');
    expect(starterLibrary).toContain('key: "policy-obligation-control"');
    expect(starterLibrary).toContain('key: "vendor-to-approved-service"');
    expect(starterLibrary).toContain('key: "offer-learning-loop"');
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
    expect(starterLibrary).toContain("without claiming ledger truth");
    expect(starterLibrary).toContain("without presenting legal advice");
    expect(starterLibrary).toContain("without creating an external commitment");
    expect(starterLibrary).toContain("without silently mutating a reusable EOS template");
    expect(starterLibrary).toContain("without implying external publication");
    expect(starterLibrary).toContain("observed-publication evidence");
  });

  it("materializes all universal control loops with company context and explicit human decision boundaries", () => {
    for (const key of [
      "finance-control-cycle",
      "policy-obligation-control",
      "vendor-to-approved-service",
      "offer-learning-loop",
    ]) {
      const workflow = materializeNativeWorkflowStarter(key, {
        companyName: "Empyrean Studios",
        offer: "Revenue recovery service",
        targetCustomer: "B2B service companies",
        goal: "Validate the first operating loop",
      });
      expect(workflow.name).toContain("Empyrean Studios");
      expect(workflow.steps.length).toBeGreaterThanOrEqual(4);
      expect(workflow.steps.some((step) => step.actionKind === "approval")).toBe(true);
      expect(workflow.approvals.join(" ")).toMatch(/authorized human/i);
      expect(workflow.branches.join(" ")).toMatch(/stop|preserve/i);
    }
  });

  it("keeps the compiled editorial cadence native-first until external publication is actually evidenced", () => {
    const workflow = materializeNativeWorkflowStarter("editorial-cadence", {
      companyName: "Empyrean Studios",
      offer: "Revenue recovery service",
      targetCustomer: "B2B service companies",
      goal: "Validate the offer",
    });
    expect(workflow.name).toContain("Empyrean Studios");
    expect(workflow.purpose).toContain("Revenue recovery service");
    expect(workflow.purpose).toContain("B2B service companies");
    expect(workflow.steps.map((step) => step.toolKey)).toEqual(["docs", "calendar", "docs", "analytics"]);
    expect(workflow.steps.some((step) => step.actionKind === "approval")).toBe(true);
    expect(workflow.steps.map((step) => `${step.title} ${step.instructions} ${step.completionCriteria} ${step.onFailure}`).join(" ")).toContain("external post URL");
    expect(workflow.branches.join(" ")).toMatch(/do not represent it as published/i);
  });
});
