import { describe, expect, it } from "vitest";
import {
  RECOVERY_ASSUMPTION_VERSION,
  buildRecoverySalesBrief,
  calculateRecoveryOpportunity,
  recoveryCalculatorInputSchema,
  recoveryContactSchema,
  recoverySourceSchema,
  type RecoveryCalculatorInput,
} from "../../shared/recovery-calculator";
import {
  createRecoverySessionSecret,
  recoverySessionDigest,
} from "../../server/recovery-calculator-token";

const highFit: RecoveryCalculatorInput = {
  profile: { industry: "Roofing", teamSize: 14, serviceArea: "Phoenix metro" },
  demand: { monthlyInboundLeads: 140, missedOrUnansweredPercent: 32, averageResponseMinutes: 45, leadToEstimatePercent: 60 },
  estimates: { openEstimates: 55, averageJobValue: 14_000, currentClosePercent: 25, staleEstimatePercent: 55 },
  customers: { pastCustomers: 1_500, annualReactivationPercent: 5 },
  readiness: { dataQuality: "clean", followUpOwnership: "unowned", deliveryCapacity: "available", intent: "within_30_days" },
};

describe("Booked Job Recovery Calculator", () => {
  it("routes a complete high-fit operator to a record-level Recovery diagnostic", () => {
    const result = calculateRecoveryOpportunity(highFit);
    expect(result).toMatchObject({ assumptionVersion: RECOVERY_ASSUMPTION_VERSION, fit: "high_fit", route: "recovery_diagnostic" });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.range.low).toBeLessThan(result.range.base);
    expect(result.range.base).toBeLessThan(result.range.high);
    expect(result.pools).toHaveLength(3);
    expect(result.disclaimer).toMatch(/not claimed lost revenue/i);
  });

  it("keeps a partial-data result deterministic, versioned, and directional", () => {
    const input: RecoveryCalculatorInput = {
      ...highFit,
      demand: { ...highFit.demand, monthlyInboundLeads: 35, missedOrUnansweredPercent: 12, averageResponseMinutes: 10 },
      estimates: { ...highFit.estimates, openEstimates: 9, averageJobValue: 6_500, staleEstimatePercent: 20 },
      customers: { pastCustomers: 120, annualReactivationPercent: 2 },
      readiness: { dataQuality: "partial", followUpOwnership: "shared", deliveryCapacity: "limited", intent: "this_quarter" },
    };
    const first = calculateRecoveryOpportunity(input);
    expect(calculateRecoveryOpportunity(input)).toEqual(first);
    expect(first.confidence).toBe("directional");
    expect(first.confidenceGaps.length).toBeGreaterThan(0);
  });

  it("routes a demand-rich but capacity-constrained operator to growth education", () => {
    const result = calculateRecoveryOpportunity({ ...highFit, readiness: { ...highFit.readiness, deliveryCapacity: "constrained" } });
    expect(result.fit).toBe("growth_constrained");
    expect(result.route).toBe("growth_education");
  });

  it("rejects malformed economics and protects a session with a high-entropy digest", () => {
    expect(() => recoveryCalculatorInputSchema.parse({ ...highFit, estimates: { ...highFit.estimates, averageJobValue: -1 } })).toThrow();
    const secret = createRecoverySessionSecret();
    expect(secret).toHaveLength(43);
    expect(recoverySessionDigest(secret)).toMatch(/^[a-f0-9]{64}$/);
    expect(recoverySessionDigest(secret)).not.toContain(secret);
  });

  it("requires explicit contact consent and produces a bounded Sales Brief without contact PII", () => {
    expect(() => recoveryContactSchema.parse({ firstName: "Alex", workEmail: "alex@example.test", companyName: "Example Roofing", consent: false })).toThrow(/Consent is required/i);
    const result = calculateRecoveryOpportunity(highFit);
    const brief = buildRecoverySalesBrief(highFit, result);
    expect(brief.validationQuestions).toHaveLength(5);
    expect(brief.commercialGuardrail).toMatch(/Do not improvise price/i);
    expect(JSON.stringify(brief)).not.toContain("alex@example.test");
    expect(JSON.stringify(brief)).not.toContain("phone");
  });

  it("accepts an explicit positive company context for multi-tenant public routing", () => {
    expect(recoverySourceSchema.parse({ companyId: "42", source: "company-link" }).companyId).toBe(42);
    expect(() => recoverySourceSchema.parse({ companyId: 0, source: "company-link" })).toThrow();
  });
});
