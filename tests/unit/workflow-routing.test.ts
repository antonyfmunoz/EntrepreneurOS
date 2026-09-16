import { describe, expect, it } from "vitest";
import { resolveWorkflowNextStep, WorkflowRoutingError } from "../../shared/workflow-routing";
import { workflowRunTransitionSchema } from "../../shared/workflow-runtime";

describe("native no-code workflow routing", () => {
  const steps = [
    { id: "intake", actionKind: "manual" },
    { id: "qualified", actionKind: "condition", onTrueStepId: "proposal", onFalseStepId: "nurture" },
    { id: "proposal", actionKind: "native" },
    { id: "nurture", actionKind: "manual" },
  ];

  it("selects an explicit forward edge and preserves the observed outcome", () => {
    expect(resolveWorkflowNextStep(steps, 1, true)).toBe(2);
    expect(resolveWorkflowNextStep(steps, 1, false)).toBe(3);
  });

  it("fails closed for a missing outcome, backward edge, or condition outcome on ordinary work", () => {
    expect(() => resolveWorkflowNextStep(steps, 1, undefined)).toThrow(WorkflowRoutingError);
    expect(() => resolveWorkflowNextStep([{ id: "a", actionKind: "condition", onTrueStepId: "a", onFalseStepId: "a" }], 0, true)).toThrow(/later step/);
    expect(() => resolveWorkflowNextStep(steps, 0, true)).toThrow(/Only a condition/);
  });

  it("keeps legacy condition versions linear and rejects an outcome on a non-advance transition", () => {
    expect(resolveWorkflowNextStep([{ id: "legacy", actionKind: "condition" }, { id: "next", actionKind: "manual" }], 0, undefined)).toBe(1);
    expect(() => workflowRunTransitionSchema.parse({ expectedVersion: 1, action: "start", note: "Start the controlled workflow fixture.", conditionOutcome: true })).toThrow(/advanc/i);
  });
});
