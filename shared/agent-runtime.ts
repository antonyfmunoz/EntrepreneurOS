import { z } from "zod";
import { workflowExecutionModes } from "./workflow-runtime";

export const agentScheduleCreateSchema = z.object({
  scheduleKey: z.string().trim().min(3).max(160),
  name: z.string().trim().min(3).max(240),
  seatId: z.string().trim().min(1).max(200),
  authoritySubjectId: z.string().trim().min(1).max(200),
  processDefinitionId: z.string().trim().min(1).max(200),
  triggerKind: z.enum(["schedule", "event", "manual"]),
  cadence: z.enum(["once", "hourly", "daily", "weekly", "monthly", "event", "manual"]),
  eventTypes: z.array(z.string().trim().min(3).max(200)).max(100).default([]),
  executionMode: z.enum(workflowExecutionModes),
  inputTemplate: z.record(z.unknown()).default({}),
  nextRunAt: z.string().datetime().optional(),
  maxRunsPerDay: z.number().int().min(1).max(1440).default(24),
  evaluationRequired: z.boolean().default(true),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
}).superRefine((value, context) => {
  if (value.executionMode === "delegated")
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["executionMode"], message: "Scheduled Role Agents own their seat's run; use the workflow runtime for explicit hierarchy-bound delegation." });
  if (value.triggerKind === "event" && (!value.eventTypes.length || value.cadence !== "event"))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eventTypes"], message: "Event schedules require at least one event type and the event cadence." });
  if (value.triggerKind === "schedule" && (["event", "manual"].includes(value.cadence) || !value.nextRunAt))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextRunAt"], message: "Time schedules require a future run time and a time cadence." });
  if (value.triggerKind === "manual" && value.cadence !== "manual")
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["cadence"], message: "Manual schedules require the manual cadence." });
});

export const agentScheduleTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  state: z.enum(["active", "paused", "retired"]),
  rationale: z.string().trim().min(20).max(4000),
});

export const agentEvaluationSchema = z.object({
  expectedRunVersion: z.number().int().positive(),
  outcome: z.enum(["passed", "needs_review", "failed"]),
  scores: z.object({
    correctness: z.number().min(0).max(1),
    authorityCompliance: z.number().min(0).max(1),
    evidenceQuality: z.number().min(0).max(1),
    usefulness: z.number().min(0).max(1),
    efficiency: z.number().min(0).max(1),
  }),
  rationale: z.string().trim().min(30).max(6000),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  learningProposal: z.string().trim().max(4000).default(""),
});

export function nextAgentScheduleAt(cadence: string, from: Date): Date | null {
  const next = new Date(from);
  if (cadence === "hourly") next.setUTCHours(next.getUTCHours() + 1);
  else if (cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (cadence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else return null;
  return next;
}
