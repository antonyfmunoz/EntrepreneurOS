import { z } from "zod";

export const workflowExecutionModes = ["manual", "assisted", "delegated", "autonomous"] as const;
export const workflowRunStates = ["queued", "running", "waiting_input", "waiting_approval", "blocked", "completed", "failed", "cancelled"] as const;
export const workflowRunActions = ["start", "request_input", "request_approval", "block", "resume", "complete", "fail", "cancel"] as const;

export const workflowRunCreateSchema = z.object({
  processDefinitionId: z.string().trim().min(1).max(200),
  workPacketId: z.string().trim().min(1).max(200).optional(),
  executionMode: z.enum(workflowExecutionModes),
  delegatedSeatId: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
  input: z.record(z.unknown()).default({}),
  scheduledFor: z.string().datetime().optional(),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
}).superRefine((value, context) => {
  if (value.executionMode === "delegated" && !value.delegatedSeatId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["delegatedSeatId"], message: "Delegated execution requires a target seat." });
  if (value.executionMode !== "delegated" && value.delegatedSeatId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["delegatedSeatId"], message: "A target seat is valid only for delegated execution." });
});

export const workflowRunTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  action: z.enum(workflowRunActions),
  note: z.string().trim().min(10).max(4000),
  output: z.record(z.unknown()).default({}),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  approvalId: z.string().trim().min(1).max(200).optional(),
  blocker: z.string().trim().max(2000).default(""),
}).superRefine((value, context) => {
  if (["block", "fail"].includes(value.action) && !value.blocker)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "Blocked or failed execution requires a named cause." });
  if (value.action === "request_approval" && !value.approvalId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["approvalId"], message: "Approval wait requires an approval request." });
});

export const skillDefinitionCreateSchema = z.object({
  skillKey: z.string().trim().min(3).max(160),
  name: z.string().trim().min(3).max(240),
  description: z.string().trim().min(10).max(2000),
  handlerKind: z.enum(["manual", "native", "provider", "projection"]),
  handlerReference: z.string().trim().min(3).max(1000),
  providerBindingId: z.string().trim().min(1).max(200).optional(),
  inputSchema: z.record(z.unknown()).default({}),
  outputSchema: z.record(z.unknown()).default({}),
  allowedModes: z.array(z.enum(workflowExecutionModes)).min(1).max(4),
  requiredAuthority: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
  toolEntitlements: z.array(z.string().trim().min(2).max(240)).max(100).default([]),
  timeoutMs: z.number().int().min(100).max(3_600_000).default(60_000),
  maxAttempts: z.number().int().min(1).max(20).default(3),
  evidenceRequirements: z.array(z.string().trim().min(3).max(1000)).max(100).default([]),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
}).superRefine((value, context) => {
  if (value.handlerKind === "provider" && !value.providerBindingId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["providerBindingId"], message: "Provider skills require a governed provider binding." });
  if (value.handlerKind !== "provider" && value.providerBindingId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["providerBindingId"], message: "Only provider skills may bind a provider." });
});

export const skillInvocationCreateSchema = z.object({
  skillDefinitionId: z.string().trim().min(1).max(200),
  stepIndex: z.number().int().min(0).max(10_000),
  idempotencyKey: z.string().trim().min(8).max(240),
  input: z.record(z.unknown()).default({}),
});

export function nextWorkflowRunState(state: string, action: (typeof workflowRunActions)[number]) {
  const transitions: Record<string, Partial<Record<(typeof workflowRunActions)[number], string>>> = {
    queued: { start: "running", cancel: "cancelled", block: "blocked" },
    running: { request_input: "waiting_input", request_approval: "waiting_approval", block: "blocked", complete: "completed", fail: "failed", cancel: "cancelled" },
    waiting_input: { resume: "running", block: "blocked", cancel: "cancelled" },
    waiting_approval: { resume: "running", block: "blocked", cancel: "cancelled" },
    blocked: { resume: "running", cancel: "cancelled" },
    failed: { resume: "running", cancel: "cancelled" },
  };
  return transitions[state]?.[action] || null;
}
