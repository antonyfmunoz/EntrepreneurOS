import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  nextRolloutStage, offerPatchSchema, productCompatibilityReviewSchema,
  productObservationSchema, productReleaseDecisionSchema,
} from "../../shared/product-evolution";

const evidenceId = "3320d884-0c5b-4fb3-bfab-70d6b8897824";

describe("native product-evolution control contracts", () => {
  it("allows only explicit canonical offer fields", () => {
    expect(offerPatchSchema.parse({ promiseOutcome: "A measurable, bounded customer outcome." })).toEqual({ promiseOutcome: "A measurable, bounded customer outcome." });
    expect(() => offerPatchSchema.parse({ state: "active" })).toThrow();
    expect(() => offerPatchSchema.parse({})).toThrow();
  });

  it("requires migration planning for breaking compatibility", () => {
    const base = { expectedVersion: 1, outcome: "breaking" as const, rationale: "The workflow contract changes for current delivery and reporting consumers.", affectedWorkflows: ["delivery.v1"], affectedSegments: [], affectedContracts: [], evidenceIds: [evidenceId] };
    expect(() => productCompatibilityReviewSchema.parse({ ...base, migrationPlan: "" })).toThrow();
    expect(productCompatibilityReviewSchema.parse({ ...base, migrationPlan: "Dual-run v1 and v2, verify parity, migrate consumers, then retain the rollback path." }).outcome).toBe("breaking");
  });

  it("separates provider-backed observation authority from a bare assertion", () => {
    const base = { expectedProposalVersion: 3, expectedExperimentVersion: 2, metricKey: "conversion_rate", value: "18.2", unit: "percent", windowStart: "2026-08-01", windowEnd: "2026-08-14", sourceAuthority: "provider_receipt" as const, evidenceIds: [evidenceId] };
    expect(() => productObservationSchema.parse({ ...base, externalReference: "" })).toThrow();
    expect(productObservationSchema.parse({ ...base, externalReference: "analytics-report-456" }).externalReference).toBe("analytics-report-456");
  });

  it("models rollout as an ordered staged progression", () => {
    expect(nextRolloutStage("internal")).toBe("pilot");
    expect(nextRolloutStage("pilot")).toBe("limited");
    expect(nextRolloutStage("limited")).toBe("general");
    expect(nextRolloutStage("general")).toBeNull();
    expect(productReleaseDecisionSchema.parse({ expectedVersion: 4, decision: "ship", rationale: "Compatibility, success, and guardrail evidence support a controlled rollout.", evidenceIds: [evidenceId] }).decision).toBe("ship");
  });

  it("adds append-only learning ledgers and event-linked projections", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0084_add_product_evolution_control_center.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_product_feedback_signals");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_product_change_proposals");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_product_experiment_observations");
    expect(migration).toContain("EOS product-evolution ledger records are append-only");
    expect(migration).toContain("projection changes require an exact immutable event");
    expect(migration).not.toMatch(/access_token|refresh_token|client_secret|provider_message_body/i);
  });
});
