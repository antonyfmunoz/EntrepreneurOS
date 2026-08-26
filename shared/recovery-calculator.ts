import { z } from "zod";

export const RECOVERY_ASSUMPTION_VERSION = "empyrean-recovery-model.v1.0";
export const RECOVERY_REPORT_VERSION = "empyrean-recovery-report.v1.0";
export const RECOVERY_CONSENT_VERSION = "empyrean-recovery-contact.v1";

const finiteMoney = z.coerce.number().finite().min(0).max(10_000_000);
const finiteCount = z.coerce.number().int().min(0).max(1_000_000);
const percentage = z.coerce.number().finite().min(0).max(100);

export const recoveryCalculatorInputSchema = z.object({
  profile: z.object({
    industry: z.string().trim().min(2).max(80),
    teamSize: z.coerce.number().int().min(1).max(100_000),
    serviceArea: z.string().trim().min(2).max(120),
  }),
  demand: z.object({
    monthlyInboundLeads: finiteCount,
    missedOrUnansweredPercent: percentage,
    averageResponseMinutes: z.coerce.number().finite().min(0).max(43_200),
    leadToEstimatePercent: percentage,
  }),
  estimates: z.object({
    openEstimates: finiteCount,
    averageJobValue: finiteMoney,
    currentClosePercent: percentage,
    staleEstimatePercent: percentage,
  }),
  customers: z.object({
    pastCustomers: finiteCount,
    annualReactivationPercent: percentage,
  }),
  readiness: z.object({
    dataQuality: z.enum(["clean", "partial", "fragmented"]),
    followUpOwnership: z.enum(["clear", "shared", "unowned"]),
    deliveryCapacity: z.enum(["available", "limited", "constrained"]),
    intent: z.enum(["within_30_days", "this_quarter", "researching"]),
  }),
});

export const recoveryContactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  workEmail: z.string().trim().email().max(320),
  companyName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional().default(""),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to create and deliver the full report." }),
  }),
  communicationPreference: z.enum(["email", "phone", "either"]).default("email"),
});

export const recoverySourceSchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  source: z.string().trim().max(120).optional().default("direct"),
  utm: z.object({
    source: z.string().trim().max(120).optional().default(""),
    medium: z.string().trim().max(120).optional().default(""),
    campaign: z.string().trim().max(160).optional().default(""),
    content: z.string().trim().max(160).optional().default(""),
    term: z.string().trim().max(160).optional().default(""),
  }).optional().default({}),
});

export const recoverySessionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type RecoveryCalculatorInput = z.infer<typeof recoveryCalculatorInputSchema>;
export type RecoveryContact = z.infer<typeof recoveryContactSchema>;

export type RecoveryPool = {
  key: "open_estimates" | "missed_response" | "past_customers";
  label: string;
  low: number;
  base: number;
  high: number;
  explanation: string;
};

export type RecoveryResult = {
  assumptionVersion: typeof RECOVERY_ASSUMPTION_VERSION;
  score: number;
  fit: "high_fit" | "fit_not_ready" | "growth_constrained" | "early_or_insufficient";
  route: "recovery_diagnostic" | "diy_nurture" | "growth_education" | "guidance_recheck";
  range: { low: number; base: number; high: number; period: "monthly_modeled_opportunity" };
  dominantPool: RecoveryPool["key"];
  pools: RecoveryPool[];
  confidence: "directional" | "moderate";
  confidenceGaps: string[];
  assumptions: string[];
  disclaimer: string;
};

const dollars = (value: number) => Math.max(0, Math.round(value));
const scenario = (base: number, lowMultiplier: number, highMultiplier: number) => ({
  low: dollars(base * lowMultiplier),
  base: dollars(base),
  high: dollars(base * highMultiplier),
});

export function calculateRecoveryOpportunity(raw: RecoveryCalculatorInput): RecoveryResult {
  const input = recoveryCalculatorInputSchema.parse(raw);
  const responseGap = Math.min(1, input.demand.missedOrUnansweredPercent / 100 + Math.max(0, input.demand.averageResponseMinutes - 5) / 600);
  const staleShare = input.estimates.staleEstimatePercent / 100;
  const closeGap = Math.max(0.08, Math.min(0.4, (55 - input.estimates.currentClosePercent) / 100));

  const openBase = input.estimates.openEstimates * staleShare * input.estimates.averageJobValue * closeGap;
  const missedBase = input.demand.monthlyInboundLeads * responseGap * (input.demand.leadToEstimatePercent / 100) * input.estimates.averageJobValue * 0.22;
  const pastBase = (input.customers.pastCustomers * (input.customers.annualReactivationPercent / 100) * input.estimates.averageJobValue) / 12;

  const pools: RecoveryPool[] = [
    { key: "open_estimates", label: "Open estimates", ...scenario(openBase, 0.55, 1.35), explanation: "Models a bounded recovery share of stale open estimates; it does not assume every estimate can be won." },
    { key: "missed_response", label: "Missed and slow response", ...scenario(missedBase, 0.5, 1.4), explanation: "Models a recoverable share of inbound demand affected by missed contact or response delay." },
    { key: "past_customers", label: "Past customers", ...scenario(pastBase, 0.45, 1.3), explanation: "Models a monthly equivalent of the reactivation rate you supplied; it is not a revenue forecast." },
  ];
  const range = pools.reduce((total, pool) => ({
    low: total.low + pool.low,
    base: total.base + pool.base,
    high: total.high + pool.high,
    period: "monthly_modeled_opportunity" as const,
  }), { low: 0, base: 0, high: 0, period: "monthly_modeled_opportunity" as const });
  const dominantPool = [...pools].sort((a, b) => b.base - a.base)[0]?.key || "open_estimates";

  const economic = Math.min(30, range.base / 2_000);
  const depth = Math.min(20, (input.estimates.openEstimates / 5) + (input.demand.monthlyInboundLeads / 25) + (input.customers.pastCustomers / 250));
  const processGap = Math.min(20, responseGap * 12 + staleShare * 8 + (input.readiness.followUpOwnership === "unowned" ? 6 : input.readiness.followUpOwnership === "shared" ? 3 : 0));
  const readiness = input.readiness.dataQuality === "clean" ? 15 : input.readiness.dataQuality === "partial" ? 9 : 3;
  const intent = input.readiness.intent === "within_30_days" ? 15 : input.readiness.intent === "this_quarter" ? 9 : 3;
  const score = Math.max(0, Math.min(100, Math.round(economic + depth + processGap + readiness + intent)));

  const hasSufficientData = input.estimates.averageJobValue > 0 && (input.estimates.openEstimates > 0 || input.demand.monthlyInboundLeads > 0 || input.customers.pastCustomers > 0);
  const fit = !hasSufficientData
    ? "early_or_insufficient"
    : input.readiness.deliveryCapacity === "constrained"
      ? "growth_constrained"
      : score >= 70 && input.readiness.dataQuality !== "fragmented"
        ? "high_fit"
        : score >= 40
          ? "fit_not_ready"
          : "early_or_insufficient";
  const route = fit === "high_fit" ? "recovery_diagnostic" : fit === "fit_not_ready" ? "diy_nurture" : fit === "growth_constrained" ? "growth_education" : "guidance_recheck";

  const confidenceGaps = [
    ...(input.readiness.dataQuality !== "clean" ? ["CRM and estimate data needs validation before treating this range as decision-grade."] : []),
    ...(input.readiness.followUpOwnership !== "clear" ? ["Follow-up ownership is not consistently assigned."] : []),
    ...(input.readiness.deliveryCapacity !== "available" ? ["Delivery capacity may constrain how much recovered demand can be accepted."] : []),
    ...(input.estimates.averageJobValue === 0 ? ["Average job value is missing."] : []),
  ];

  return {
    assumptionVersion: RECOVERY_ASSUMPTION_VERSION,
    score,
    fit,
    route,
    range,
    dominantPool,
    pools,
    confidence: confidenceGaps.length === 0 ? "moderate" : "directional",
    confidenceGaps,
    assumptions: [
      "All values are modeled from the information supplied by the visitor.",
      "Low and high cases use fixed conservative scenario multipliers, not machine-learned predictions.",
      "The three pools can overlap in real operations and require record-level validation before action.",
    ],
    disclaimer: "This is a modeled opportunity range, not claimed lost revenue, a guarantee, or a forecast. Validate it against source records before making a commercial decision.",
  };
}

export function buildRecoverySalesBrief(input: RecoveryCalculatorInput, result: RecoveryResult) {
  const dominant = result.pools.find((pool) => pool.key === result.dominantPool)!;
  return {
    version: RECOVERY_REPORT_VERSION,
    headline: `${input.profile.industry} operator in ${input.profile.serviceArea}: ${result.fit.replaceAll("_", " ")}`,
    modeledRange: result.range,
    recoveryScore: result.score,
    dominantOpportunity: { key: dominant.key, label: dominant.label, modeledBase: dominant.base },
    operatingSnapshot: {
      monthlyInboundLeads: input.demand.monthlyInboundLeads,
      openEstimates: input.estimates.openEstimates,
      averageJobValue: input.estimates.averageJobValue,
      pastCustomers: input.customers.pastCustomers,
      responseMinutes: input.demand.averageResponseMinutes,
      dataQuality: input.readiness.dataQuality,
      followUpOwnership: input.readiness.followUpOwnership,
      deliveryCapacity: input.readiness.deliveryCapacity,
      intent: input.readiness.intent,
    },
    confidenceGaps: result.confidenceGaps,
    validationQuestions: [
      "Which source system contains the open-estimate list, and when was it last reconciled?",
      "How are missed calls, web leads, and response times currently measured?",
      "Who owns each follow-up state, and what happens when that owner is unavailable?",
      "What delivery capacity can the business safely absorb during the next 30 days?",
      "Which recovered-job outcomes can be attributed without double counting?",
    ],
    likelyObjections: [
      input.readiness.dataQuality === "clean" ? "The existing system should already be enough." : "Our records are too messy to use.",
      input.readiness.deliveryCapacity === "constrained" ? "We cannot take more work right now." : "The modeled opportunity may not convert in practice.",
      "We need record-level proof before committing to an ongoing managed engagement.",
    ],
    fitConcerns: [
      ...(result.fit !== "high_fit" ? [`Current route is ${result.route.replaceAll("_", " ")}, not an immediate Recovery diagnostic.`] : []),
      ...result.confidenceGaps,
    ],
    recommendedRoute: result.route,
    commercialGuardrail: "Use the current Recovery System authority only. Do not improvise price, guarantees, contract term, or proof claims from this modeled result.",
  };
}
