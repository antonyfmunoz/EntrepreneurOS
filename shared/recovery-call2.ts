import { z } from "zod";

export const RECOVERY_CALL_2_PACKET_VERSION = "empyrean-recovery-call2.v1";
export const RECOVERY_CALL_2_TERMS_AUTHORITY =
  "https://www.notion.so/3bcda8b96e4f81bf96e1c98c2c366cc3";

export const recoveryCall2Packages = {
  founding_proof_cohort: {
    key: "founding_proof_cohort",
    label: "Founding proof cohort",
    setupAmount: 3_000,
    monthlyAmount: 1_500,
    currency: "USD",
    qualification:
      "Limited to the first 3–5 named customers providing explicitly agreed proof consideration.",
  },
  standard: {
    key: "standard",
    label: "Standard Recovery System",
    setupAmount: 5_000,
    monthlyAmount: 2_500,
    currency: "USD",
    qualification: "Current standard commercial authority.",
  },
} as const;

export const recoveryCall2PackageSchema = z.enum([
  "founding_proof_cohort",
  "standard",
]);

const boundedText = (minimum = 1, maximum = 4_000) =>
  z.string().trim().min(minimum).max(maximum);

export const recoveryCall2UpdateSchema = z.object({
  version: z.coerce.number().int().positive(),
  buyerDecisionMakers: z.array(boundedText(1, 160)).min(1).max(12),
  observedFacts: boundedText(),
  measuredSignals: boundedText(),
  unavailableData: boundedText(),
  changesSinceCall1: boundedText(),
  recoveryThesis: boundedText(),
  scopeDiscussion: boundedText(),
  measurementAttribution: boundedText(),
  clientResponsibilities: boundedText(),
  objections: boundedText(),
  recommendedPackage: recoveryCall2PackageSchema,
  foundingProofConsideration: z.string().trim().max(1_000).default(""),
});

export const recoveryCall2ExceptionSchema = z.object({
  version: z.coerce.number().int().positive(),
  summary: boundedText(8, 2_000),
});

export const recoveryCall2DispositionSchema = z.enum([
  "closed_won_pending_agreement_payment",
  "conditional_named_dependency",
  "nurture_not_now",
  "closed_lost_reason",
]);

export const recoveryCall2DecisionSchema = z
  .object({
    version: z.coerce.number().int().positive(),
    disposition: recoveryCall2DispositionSchema,
    decisionMaker: boundedText(1, 240),
    dependencyOrLostReason: z.string().trim().max(2_000).default(""),
    nextAction: boundedText(1, 1_000),
    nextActionAt: z.coerce.date().optional(),
    agreementVersion: z.string().trim().max(240).default(""),
    paymentPath: z.string().trim().max(1_000).default(""),
    onboardingTrigger: z.string().trim().max(1_000).default(""),
  })
  .superRefine((value, context) => {
    if (
      value.disposition !== "closed_lost_reason" &&
      !value.nextActionAt
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextActionAt"],
        message: "A dated next action is required for this disposition.",
      });
    if (
      ["conditional_named_dependency", "nurture_not_now", "closed_lost_reason"].includes(
        value.disposition,
      ) &&
      value.dependencyOrLostReason.length < 3
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dependencyOrLostReason"],
        message: "Record the named dependency or decision reason.",
      });
    if (value.disposition === "closed_won_pending_agreement_payment") {
      for (const field of [
        "agreementVersion",
        "paymentPath",
        "onboardingTrigger",
      ] as const)
        if (value[field].length < 2)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for the pending handoff.`,
          });
    }
  });

export type RecoveryCall2Package = z.infer<typeof recoveryCall2PackageSchema>;
export type RecoveryCall2Disposition = z.infer<
  typeof recoveryCall2DispositionSchema
>;

export function recoveryCall2Terms(packageKey: RecoveryCall2Package) {
  return {
    ...recoveryCall2Packages[packageKey],
    termsAuthority: RECOVERY_CALL_2_TERMS_AUTHORITY,
    packetVersion: RECOVERY_CALL_2_PACKET_VERSION,
    scope:
      "Roofing-first qualification, recovery workflow preparation, governed execution, attribution, reporting, and closeout.",
    exclusions:
      "No conflicting price, guarantee, proof claim, broad multi-niche outbound, or unapproved external communication.",
    guaranteeBoundary:
      "The first 30 days are a measurement window, not the product term. No outcome is guaranteed by this packet.",
    externalExecution:
      "Agreement, payment, onboarding, CRM, and provider actions require their own authorized rails and receipts.",
  };
}

export function commercialStateForDisposition(
  disposition: RecoveryCall2Disposition,
) {
  if (disposition === "closed_won_pending_agreement_payment") return "won";
  if (disposition === "closed_lost_reason") return "lost";
  return "on_hold";
}
