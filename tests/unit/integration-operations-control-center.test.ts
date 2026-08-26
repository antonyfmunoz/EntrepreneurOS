import { describe, expect, it } from "vitest";
import {
  adapterManifestCreateSchema, integrationCutoverSchema, integrationFallbackSchema,
  integrationQualificationSchema, integrationRetrySchema, integrationRunCreateSchema,
  integrationRunExecuteSchema, integrationRunReceiptSchema, integrationWebhookEndpointCreateSchema,
  integrationWebhookEndpointStateSchema, integrationWebhookSecretRotateSchema, terminalRunState,
  providerIngressAlertReplaySchema, providerIngressPolicyUpdateSchema, providerIngressReplaySchema,
} from "../../shared/integration-operations";

const id = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

describe("integration operations contracts", () => {
  it("accepts a bounded manifest freeze and rejects duplicate evidence", () => {
    expect(adapterManifestCreateSchema.parse({ integrationBindingId: id, contractVersion: "1.2.0", evidenceIds: [second] }).contractVersion).toBe("1.2.0");
    expect(() => adapterManifestCreateSchema.parse({ integrationBindingId: id, contractVersion: "1.2.0", evidenceIds: [second, second] })).toThrow(/unique/i);
  });

  it("keeps run planning idempotent and credential-free", () => {
    const parsed = integrationRunCreateSchema.parse({ integrationBindingId: id, operation: "contacts.upsert", idempotencyKey: "customer-42-v1", requestReference: "work-packet:42", requestShape: { customerId: 42 }, ownerSeatId: second });
    expect(parsed.maxAttempts).toBe(3);
    expect(() => integrationRunCreateSchema.parse({ integrationBindingId: id, operation: "contacts.upsert", idempotencyKey: "customer-42-v1", requestReference: "work-packet:42", requestShape: { client_secret: "top-secret-value-should-never-be-here" }, ownerSeatId: second })).toThrow(/secret material/i);
  });

  it("distinguishes provider, reconciliation, manual, and fixture receipts", () => {
    for (const authority of ["provider_receipt", "provider_observation", "reconciled", "manual_attestation", "fixture"] as const) {
      expect(integrationRunReceiptSchema.parse({ expectedVersion: 1, outcome: "succeeded", authority, externalReference: "receipt:123", summary: "The declared operation completed with a durable reference.", evidenceIds: [id] }).authority).toBe(authority);
    }
    expect(() => integrationRunReceiptSchema.parse({ expectedVersion: 1, outcome: "succeeded", authority: "claimed", externalReference: "receipt:123", summary: "The operation completed.", evidenceIds: [id] })).toThrow();
  });

  it("requires explicit external-effect confirmation before dispatch", () => {
    expect(integrationRunExecuteSchema.parse({ expectedVersion: 1, confirmExternalEffect: true, evidenceIds: [id] }).confirmExternalEffect).toBe(true);
    expect(() => integrationRunExecuteSchema.parse({ expectedVersion: 1, confirmExternalEffect: false, evidenceIds: [id] })).toThrow();
  });

  it("requires governed evidence and optimistic versions for signed endpoint controls", () => {
    expect(integrationWebhookEndpointCreateSchema.parse({ acceptedEventTypes: ["provider.execution.completed"], evidenceIds: [id] }).acceptedEventTypes).toEqual(["provider.execution.completed"]);
    expect(() => integrationWebhookEndpointCreateSchema.parse({ acceptedEventTypes: ["completed", "completed"], evidenceIds: [id] })).toThrow(/unique/i);
    expect(integrationWebhookSecretRotateSchema.parse({ expectedVersion: 2, gracePeriodMinutes: 30, evidenceIds: [id] }).gracePeriodMinutes).toBe(30);
    expect(integrationWebhookEndpointStateSchema.parse({ expectedVersion: 3, state: "revoked", evidenceIds: [id] }).state).toBe("revoked");
  });

  it("requires evidence and substantive rationale for retry and fallback", () => {
    expect(integrationRetrySchema.parse({ expectedVersion: 2, rationale: "The timeout was transient and the idempotency key remains valid.", evidenceIds: [id] }).expectedVersion).toBe(2);
    expect(integrationFallbackSchema.parse({ expectedVersion: 4, trafficMode: "manual_fallback", rationale: "Route work through the documented local recovery queue until health returns.", evidenceIds: [id] }).trafficMode).toBe("manual_fallback");
  });

  it("requires evidence and a substantive secret-free rationale for provider-ingress replay", () => {
    expect(providerIngressReplaySchema.parse({ rationale: "The provider authorization was repaired and bounded replay is safe.", evidenceIds: [id] }).evidenceIds).toEqual([id]);
    expect(() => providerIngressReplaySchema.parse({ rationale: "retry", evidenceIds: [id] })).toThrow();
    expect(() => providerIngressReplaySchema.parse({ rationale: "Use bearer fixture-token-value-that-must-not-be-stored in replay.", evidenceIds: [id] })).toThrow(/secret material/i);
  });

  it("bounds provider service objectives and external escalation policy", () => {
    const parsed = providerIngressPolicyUpdateSchema.parse({ expectedVersion: 2, watchRenewBeforeMinutes: 120, reconciliationOverdueMinutes: 20, pendingVerificationMinutes: 30, externalEscalationEnabled: true, minimumEscalationSeverity: "material", maxDeliveryAttempts: 5, rationale: "The organization requires bounded material escalation to its approved receiver.", evidenceIds: [id] });
    expect(parsed).toMatchObject({ watchRenewBeforeMinutes: 120, externalEscalationEnabled: true, minimumEscalationSeverity: "material" });
    expect(() => providerIngressPolicyUpdateSchema.parse({ ...parsed, watchRenewBeforeMinutes: 1 })).toThrow();
    expect(() => providerIngressPolicyUpdateSchema.parse({ ...parsed, rationale: "bearer fixture-token-value-that-must-not-be-stored" })).toThrow(/secret material/i);
    expect(providerIngressAlertReplaySchema.parse({ rationale: "The approved alert receiver is healthy and this current alert still requires action.", evidenceIds: [id] }).evidenceIds).toEqual([id]);
  });

  it("models complete qualification and founder cutover inputs", () => {
    const qualification = integrationQualificationSchema.parse({ integrationBindingId: id, manifestId: second, qualificationKey: "crm-parity-1", environment: "sandbox", outcome: "passing", testedOperations: ["contacts.upsert"], missingCapabilities: [], testSummary: "Provider-backed receipts prove operation parity and the rollback drill completed.", rollbackValidated: true, evidenceIds: [id] });
    expect(qualification.rollbackValidated).toBe(true);
    expect(integrationCutoverSchema.parse({ expectedOperationalVersion: 3, qualificationId: second, decision: "approve_native", rationale: "The current manifest is fully covered and rollback ownership is assigned.", evidenceIds: [id] }).decision).toBe("approve_native");
  });

  it("treats only succeeded and dead-letter runs as terminal", () => {
    expect(terminalRunState("succeeded")).toBe(true);
    expect(terminalRunState("dead_letter")).toBe(true);
    expect(terminalRunState("uncertain")).toBe(false);
    expect(terminalRunState("retry_ready")).toBe(false);
  });
});
