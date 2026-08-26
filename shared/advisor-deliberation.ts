import { z } from "zod";

export const advisorDeliberationStates = [
  "draft",
  "independent_complete",
  "rebuttal_complete",
  "revision_complete",
  "synthesis_ready",
  "decided",
  "calibrated",
  "failed",
] as const;

export const advisorDeliberationCreateSchema = z.object({
  question: z.string().trim().min(20).max(8000),
  decisionContext: z.string().trim().min(20).max(12000),
  panelMode: z.enum(["relevant", "full_council"]).default("relevant"),
  requestedAdvisorIds: z.array(z.string().trim().min(2).max(160)).max(15).default([]),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  decisionDueAt: z.string().datetime().optional(),
  classification: z.literal("restricted").default("restricted"),
});

export const advisorDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.string().trim().min(10).max(6000),
  rationale: z.string().trim().min(30).max(8000),
  acceptedClaims: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
  rejectedClaims: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
});

export const advisorCalibrationSchema = z.object({
  expectedVersion: z.number().int().positive(),
  outcomeSummary: z.string().trim().min(30).max(8000),
  outcome: z.enum(["better_than_expected", "as_expected", "worse_than_expected", "inconclusive"]),
  outcomeEvidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  claimOutcomes: z.array(z.object({
    contributionId: z.string().trim().min(1).max(200),
    claimKey: z.string().trim().min(1).max(240),
    result: z.enum(["supported", "mixed", "refuted", "unobservable"]),
    note: z.string().trim().min(3).max(2000),
  })).max(500).default([]),
  learningProposal: z.string().trim().max(6000).default(""),
});

export function advisorDeliberationAdvance(state: string) {
  const next: Record<string, string> = {
    draft: "independent_complete",
    independent_complete: "rebuttal_complete",
    rebuttal_complete: "revision_complete",
    revision_complete: "synthesis_ready",
  };
  return next[state] || null;
}
