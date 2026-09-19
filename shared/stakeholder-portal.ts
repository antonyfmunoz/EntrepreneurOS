import { z } from "zod";

export const stakeholderPortalCreateSchema = z.object({
  portalKey: z.string().trim().min(3).max(160), name: z.string().trim().min(3).max(240),
  portalType: z.enum(["client", "board", "advisor", "investor", "capital", "partner"]),
  stakeholderId: z.string().trim().min(1).max(200).optional(),
  ownerSeatId: z.string().trim().uuid().optional(),
  visibleSections: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
  activationRequirements: z.array(z.string().trim().min(5).max(1000)).min(1).max(30),
});

export const stakeholderPortalTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(), state: z.enum(["configuring", "active", "paused", "retired"]),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]), rationale: z.string().trim().min(20).max(6000),
});

export const stakeholderPublicationCreateSchema = z.object({
  section: z.string().trim().min(2).max(120), title: z.string().trim().min(3).max(300), body: z.string().trim().min(10).max(30_000),
  dataProjection: z.record(z.unknown()).default({}), evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
});

export const stakeholderPublicationTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(), state: z.enum(["published", "withdrawn"]), rationale: z.string().trim().min(20).max(6000),
});

export const stakeholderAccessGrantSchema = z.object({
  recipientLabel: z.string().trim().min(2).max(240), recipientIdentity: z.string().trim().min(3).max(500),
  expiresAt: z.string().datetime(), rationale: z.string().trim().min(20).max(4000),
}).refine((value) => new Date(value.expiresAt) > new Date(), { path: ["expiresAt"], message: "Access must expire in the future." });

export const stakeholderPortalIntakeQuestionSchema = z.object({
  id: z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_:-]*$/i),
  label: z.string().trim().min(2).max(240),
  type: z.enum(["short_text", "long_text", "email", "phone", "select"]).default("short_text"),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
}).superRefine((question, context) => {
  if (question.type === "select" && question.options.length < 2)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "A selection question needs at least two options." });
  if (question.type !== "select" && question.options.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Only selection questions may define options." });
});

export const stakeholderPortalIntakeFormCreateSchema = z.object({
  formKey: z.string().trim().min(3).max(160).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  title: z.string().trim().min(3).max(300),
  summary: z.string().trim().min(10).max(4_000),
  questions: z.array(stakeholderPortalIntakeQuestionSchema).min(1).max(30)
    .superRefine((questions, context) => { if (new Set(questions.map((question) => question.id)).size !== questions.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Intake question identifiers must be unique." }); }),
  confirmationMessage: z.string().trim().min(5).max(1_000),
});

export const stakeholderPortalIntakeFormTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  state: z.enum(["active", "archived"]),
  rationale: z.string().trim().min(20).max(6_000),
});

export const stakeholderPortalIntakeSubmissionSchema = z.object({
  answers: z.record(z.string(), z.string().trim().max(4_000)),
  acknowledgement: z.literal(true),
  website: z.string().max(200).optional().default(""),
}).superRefine((value, context) => {
  if (Object.keys(value.answers).length > 30) context.addIssue({ code: z.ZodIssueCode.custom, path: ["answers"], message: "An onboarding intake accepts at most 30 answers." });
});

export const stakeholderPortalIntakeReviewSchema = z.object({
  disposition: z.enum(["acknowledged", "clarification_required", "action_required"]),
  reviewerSummary: z.string().trim().min(20).max(6_000),
  nextAction: z.string().trim().min(10).max(2_000),
});

export const stakeholderPortalIntakeReviewHandoffSchema = z.object({
  title: z.string().trim().min(3).max(200),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("high"),
  dueAt: z.string().datetime().optional(),
  processDefinitionId: z.string().trim().uuid().optional(),
});
