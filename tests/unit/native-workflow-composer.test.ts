import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { processCreateSchema } from "../../shared/eos-runtime";

const composer = readFileSync(new URL("../../client/src/components/native-workflow-composer.tsx", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");

describe("native no-code workflow composition", () => {
  const process = {
    capabilityInstanceId: "11111111-1111-4111-8111-111111111111",
    name: "Qualified lead follow-up",
    workflowKey: "workflow:qualified-lead-follow-up",
    purpose: "Move a qualified native CRM relationship into its next governed action.",
    intendedOutcome: "The next action and its evidence are recorded.",
    triggerCondition: "A relationship reaches the qualified stage.",
    procedureSteps: [{ id: "step-1", title: "Review relationship", instructions: "Review the governed native CRM context before advancing.", completionCriteria: "The accountable operator records the next action." }],
  };

  it("preserves action, authority, tool, and safe-failure metadata inside the process version", () => {
    const parsed = processCreateSchema.parse(process);
    expect(parsed.procedureSteps[0]).toMatchObject({
      actionKind: "manual",
      authorityClass: "execute",
      toolKey: "operations",
    });
    expect(processCreateSchema.parse({ ...process, procedureSteps: [{ ...process.procedureSteps[0], actionKind: "native", authorityClass: "decide", toolKey: "crm", onFailure: "Stop and send the decision to the accountable role." }] }).procedureSteps[0]).toMatchObject({ actionKind: "native", authorityClass: "decide", toolKey: "crm" });
    expect(processCreateSchema.parse({ ...process, procedureSteps: [
      { ...process.procedureSteps[0], id: "condition", actionKind: "condition", conditionKey: "lead-qualified", onTrueStepId: "proposal", onFalseStepId: "nurture" },
      { ...process.procedureSteps[0], id: "proposal" },
      { ...process.procedureSteps[0], id: "nurture" },
    ] }).procedureSteps[0]).toMatchObject({ conditionKey: "lead-qualified", onTrueStepId: "proposal", onFalseStepId: "nurture" });
  });

  it("provides a role-gated native multi-step composer instead of a provider-dependent automation card", () => {
    expect(composer).toContain('data-testid="native-workflow-composer"');
    expect(composer).toContain("Add step");
    expect(composer).toContain("New version");
    expect(composer).toContain("approval");
    expect(composer).toContain("condition");
    expect(composer).toContain("If yes, go to…");
    expect(composer).toContain("If no, go to…");
    expect(composer).toContain("Routes may only move forward");
    expect(composer).toContain("Workflow step ${index + 1} type");
    expect(composer).toContain("Do not transmit data to an external provider");
    expect(overlay).toContain("mayOperateNativeWorkflows");
    expect(overlay).toContain('toolEntitlements.has("workflows")');
    expect(runtime).toContain('toolKey: "workflows"');
  });
});
