import { describe, expect, it } from "vitest";
import {
  nextWorkflowRunState,
  skillDefinitionCreateSchema,
  workflowRunCreateSchema,
  workflowRunTransitionSchema,
} from "../../shared/workflow-runtime";

describe("durable workflow runtime contracts", () => {
  it("enforces the complete guarded run state machine", () => {
    expect(nextWorkflowRunState("queued", "start")).toBe("running");
    expect(nextWorkflowRunState("running", "request_approval")).toBe("waiting_approval");
    expect(nextWorkflowRunState("waiting_approval", "resume")).toBe("running");
    expect(nextWorkflowRunState("running", "complete")).toBe("completed");
    expect(nextWorkflowRunState("completed", "resume")).toBeNull();
    expect(nextWorkflowRunState("queued", "complete")).toBeNull();
  });

  it("requires explicit hierarchy for delegation and human approval custody", () => {
    expect(workflowRunCreateSchema.safeParse({
      processDefinitionId: "process-1", executionMode: "delegated", idempotencyKey: "run-key-123", input: {},
    }).success).toBe(false);
    expect(workflowRunCreateSchema.safeParse({
      processDefinitionId: "process-1", executionMode: "delegated", delegatedSeatId: "seat-2", idempotencyKey: "run-key-123", input: {},
    }).success).toBe(true);
    expect(workflowRunTransitionSchema.safeParse({
      expectedVersion: 1, action: "request_approval", note: "Material consequence requires founder approval.", output: {}, evidenceIds: [], blocker: "",
    }).success).toBe(false);
  });

  it("keeps provider execution behind an explicit governed binding", () => {
    const base = {
      skillKey: "send-customer-message", name: "Send customer message", description: "Send a governed customer message through the selected provider.",
      handlerKind: "provider" as const, handlerReference: "provider:mail.send", inputSchema: {}, outputSchema: {}, allowedModes: ["assisted" as const],
      requiredAuthority: ["execute"], toolEntitlements: ["mail.send"], timeoutMs: 30_000, maxAttempts: 2, evidenceRequirements: ["provider receipt"], classification: "restricted" as const,
    };
    expect(skillDefinitionCreateSchema.safeParse(base).success).toBe(false);
    expect(skillDefinitionCreateSchema.safeParse({ ...base, providerBindingId: "binding-1" }).success).toBe(true);
  });
});
