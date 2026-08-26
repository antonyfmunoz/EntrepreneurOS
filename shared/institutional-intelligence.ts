import { z } from "zod";

const classification = z.enum(["confidential", "restricted"]);
const evidenceIds = z.array(z.string().trim().min(1).max(200)).max(100).default([]);
const boundedRecord = z.record(z.unknown());

export const realityObservationCreateSchema = z.object({
  observationKey: z.string().trim().min(3).max(200), subject: z.string().trim().min(3).max(300),
  statement: z.string().trim().min(10).max(10_000), sourceKind: z.enum(["human", "integration", "document", "workflow", "metric", "external"]),
  sourceReference: z.string().trim().max(1000).default(""), observedAt: z.string().datetime(), freshnessExpiresAt: z.string().datetime().optional(),
  confidence: z.number().int().min(0).max(100), state: z.enum(["asserted", "verified", "disputed"]).default("asserted"),
  evidenceIds, supersedesObservationId: z.string().trim().min(1).max(200).optional(), classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
}).superRefine((value, context) => {
  if (value.state === "verified" && !value.evidenceIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Verified reality requires company-scoped Evidence." });
  if (value.freshnessExpiresAt && new Date(value.freshnessExpiresAt) <= new Date(value.observedAt)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["freshnessExpiresAt"], message: "Freshness must expire after the observation time." });
});

export const scenarioCreateSchema = z.object({
  scenarioKey: z.string().trim().min(3).max(200), name: z.string().trim().min(3).max(300), decisionQuestion: z.string().trim().min(10).max(4000),
  assumptions: z.array(boundedRecord).min(1).max(100), variables: z.array(boundedRecord).max(100).default([]), branches: z.array(boundedRecord).min(2).max(30),
  evidenceIds, classification: classification.default("restricted"),
});

export const scenarioTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(), state: z.enum(["analyzed", "selected", "rejected", "archived"]),
  result: boundedRecord.default({}), evidenceIds, rationale: z.string().trim().min(20).max(6000),
}).superRefine((value, context) => {
  if (["selected", "rejected"].includes(value.state) && !value.evidenceIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "A scenario decision requires Evidence." });
});

export const postmortemCreateSchema = z.object({
  title: z.string().trim().min(3).max(300), eventType: z.enum(["incident", "failed_workflow", "missed_outcome", "provider_failure", "security", "customer", "other"]),
  eventReference: z.string().trim().max(1000).default(""), summary: z.string().trim().min(30).max(12_000), impact: z.string().trim().min(20).max(8000),
  timeline: z.array(boundedRecord).min(1).max(500), contributingFactors: z.array(z.string().trim().min(3).max(1000)).max(100).default([]),
  rootCauses: z.array(z.string().trim().min(3).max(1000)).max(100).default([]), correctiveActions: z.array(boundedRecord).max(100).default([]),
  evidenceIds, classification: classification.default("confidential"),
});

export const postmortemTransitionSchema = z.object({
  state: z.enum(["review", "accepted", "rejected"]), rationale: z.string().trim().min(20).max(6000),
  learningProposal: z.object({ title: z.string().trim().min(3).max(300), proposal: z.string().trim().min(20).max(8000), targetType: z.enum(["memory", "process", "skill", "policy", "template", "model_route"]), targetReference: z.string().trim().max(1000).default("") }).optional(),
});

export const learningDecisionSchema = z.object({
  state: z.enum(["accepted", "rejected", "implemented"]), rationale: z.string().trim().min(20).max(6000),
  memory: z.object({ memoryKey: z.string().trim().min(3).max(200), kind: z.enum(["fact", "decision", "lesson", "pattern", "policy"]), title: z.string().trim().min(3).max(300), content: z.string().trim().min(20).max(12_000), validFrom: z.string().datetime(), validUntil: z.string().datetime().optional(), supersedesMemoryId: z.string().trim().min(1).max(200).optional() }).optional(),
}).superRefine((value, context) => {
  if (value.state === "implemented" && !value.memory) context.addIssue({ code: z.ZodIssueCode.custom, path: ["memory"], message: "Implementation must publish an explicit reviewed memory record." });
});
