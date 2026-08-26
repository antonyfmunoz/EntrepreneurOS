import { describe, expect, it } from "vitest";
import { applyFieldTransformations, evaluatePolicyDecision, policyActionContextSchema, type PolicyGrantCandidate } from "../../shared/eos-policy";

const seatId = "11111111-1111-4111-8111-111111111111";
const approverSeatId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-08-14T20:00:00.000Z");

function grant(overrides: Partial<PolicyGrantCandidate> = {}): PolicyGrantCandidate {
  return {
    id: "grant-1",
    granteeType: "seat",
    granteeKey: seatId,
    seatId,
    effect: "allow",
    authorityClasses: ["execute"],
    actionResourceScope: { seatId, resource: "work_packet" },
    ceilingThreshold: { classification: "internal", consequence: "material" },
    conditionRules: [],
    approvalPolicy: {},
    separationOfDuties: [],
    toolEntitlements: [],
    state: "active",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    reviewAt: "2026-12-01T00:00:00.000Z",
    ...overrides,
  };
}

function action(overrides: Record<string, unknown> = {}) {
  return policyActionContextSchema.parse({
    authorityClass: "execute",
    resource: "work_packet",
    actionKey: "work_packet.create",
    purpose: "create_governed_work",
    classification: "internal",
    consequence: "routine",
    ...overrides,
  });
}

describe("EOS native policy decision point", () => {
  it("permits only an active, addressed, class-and-resource-scoped grant", () => {
    expect(evaluatePolicyDecision({ grants: [grant()], principalKey: "user-1", seatId, action: action(), now })).toMatchObject({ outcome: "permit", satisfiedGrantId: "grant-1" });
    expect(evaluatePolicyDecision({ grants: [grant()], principalKey: "user-1", seatId: approverSeatId, action: action(), now })).toMatchObject({ outcome: "deny", reasonCodes: ["no_explicit_grant"] });
    expect(evaluatePolicyDecision({ grants: [grant()], principalKey: "user-1", seatId, action: action({ resource: "evidence" }), now }).outcome).toBe("deny");
  });

  it("addresses a non-human grant only through its canonical subject binding", () => {
    const providerGrant = grant({ granteeType: "provider", granteeKey: "provider:legal", granteeSubjectId: "subject-provider-1", seatId: null, actionResourceScope: { resource: "work_packet" } });
    expect(evaluatePolicyDecision({ grants: [providerGrant], principalKey: "service-runtime", seatId, subjectId: "subject-provider-1", action: action(), now }).outcome).toBe("permit");
    expect(evaluatePolicyDecision({ grants: [providerGrant], principalKey: "service-runtime", seatId, subjectId: "subject-provider-2", action: action(), now })).toMatchObject({ outcome: "deny", reasonCodes: ["no_explicit_grant"] });
    expect(evaluatePolicyDecision({ grants: [providerGrant], principalKey: "service-runtime", seatId, action: action(), now })).toMatchObject({ outcome: "deny", reasonCodes: ["no_explicit_grant"] });
  });

  it("fails closed for expired authority and escalates overdue review", () => {
    expect(evaluatePolicyDecision({ grants: [grant({ effectiveUntil: "2026-08-01T00:00:00.000Z" })], principalKey: "user-1", seatId, action: action(), now })).toMatchObject({ outcome: "deny", reasonCodes: ["grant_inactive_or_expired"] });
    expect(evaluatePolicyDecision({ grants: [grant({ reviewAt: "2026-08-01T00:00:00.000Z" })], principalKey: "user-1", seatId, action: action(), now })).toMatchObject({ outcome: "escalate", reasonCodes: ["grant_review_overdue"] });
  });

  it("enforces classification, financial, record, consequence, and data ceilings", () => {
    const bounded = grant({ ceilingThreshold: { classification: "confidential", maxAmount: 500, currency: "USD", maxRecords: 10, consequence: "material", allowedDataClasses: ["customer_contact"] } });
    expect(evaluatePolicyDecision({ grants: [bounded], principalKey: "user-1", seatId, action: action({ classification: "restricted", amount: 100, currency: "USD", recordCount: 1, dataClasses: ["customer_contact"] }), now }).reasonCodes).toContain("classification_ceiling_exceeded");
    expect(evaluatePolicyDecision({ grants: [bounded], principalKey: "user-1", seatId, action: action({ amount: 501, currency: "USD", recordCount: 1, dataClasses: ["customer_contact"] }), now }).reasonCodes).toContain("financial_ceiling_exceeded");
    expect(evaluatePolicyDecision({ grants: [bounded], principalKey: "user-1", seatId, action: action({ amount: 100, currency: "USD", recordCount: 11, dataClasses: ["customer_contact"] }), now }).reasonCodes).toContain("record_ceiling_exceeded");
    expect(evaluatePolicyDecision({ grants: [bounded], principalKey: "user-1", seatId, action: action({ amount: 100, currency: "USD", recordCount: 1, consequence: "irreversible", dataClasses: ["customer_contact"] }), now }).reasonCodes).toContain("consequence_ceiling_exceeded");
    expect(evaluatePolicyDecision({ grants: [bounded], principalKey: "user-1", seatId, action: action({ amount: 100, currency: "USD", recordCount: 1, dataClasses: ["payroll"] }), now }).reasonCodes).toContain("data_class_ceiling_exceeded");
  });

  it("returns an executable, purpose-bound minimization plan for field-level reads", () => {
    const minimizedGrant = grant({ authorityClasses: ["view"], ceilingThreshold: {
      classification: "internal", allowedDataClasses: ["customer_contact"],
      fieldTransformRules: [
        { path: "/email", action: "redact", purposes: ["support_summary"], outputClassification: "internal" },
        { path: "/bankAccount", action: "mask_last4", purposes: ["support_summary"], outputClassification: "internal" },
        { path: "/privateNote", action: "omit", purposes: ["support_summary"], outputClassification: "internal" },
      ],
    } });
    const decision = evaluatePolicyDecision({ grants: [minimizedGrant], principalKey: "user-1", seatId, now, action: action({
      authorityClass: "view", purpose: "support_summary", classification: "highly_restricted",
      dataClasses: ["customer_contact", "banking", "private_note"], fieldInventoryComplete: true,
      fields: [
        { path: "/name", classification: "internal", dataClasses: ["customer_contact"] },
        { path: "/email", classification: "confidential", dataClasses: ["customer_contact"] },
        { path: "/bankAccount", classification: "highly_restricted", dataClasses: ["banking"] },
        { path: "/privateNote", classification: "restricted", dataClasses: ["private_note"] },
      ],
    }), });
    expect(decision).toMatchObject({ outcome: "transform_minimize", reasonCodes: ["field_minimization_required"], satisfiedGrantId: "grant-1" });
    expect(applyFieldTransformations({ name: "Ada", email: "ada@example.test", bankAccount: "123456789", privateNote: "privileged", nested: { safe: true } }, decision.requirements.transforms)).toEqual({
      name: "Ada", email: "[REDACTED]", bankAccount: "••••6789", nested: { safe: true },
    });
  });

  it("fails closed when a sensitive read lacks a complete, purpose-matched field policy", () => {
    const minimizedGrant = grant({ authorityClasses: ["view", "execute"], ceilingThreshold: { classification: "internal", fieldTransformRules: [{ path: "/email", action: "redact", purposes: ["support_summary"], outputClassification: "internal" }] } });
    const sensitive = { authorityClass: "view", classification: "confidential", fields: [{ path: "/email", classification: "confidential" }] };
    expect(evaluatePolicyDecision({ grants: [minimizedGrant], principalKey: "user-1", seatId, now, action: action(sensitive) }).reasonCodes).toContain("complete_field_inventory_required");
    expect(evaluatePolicyDecision({ grants: [minimizedGrant], principalKey: "user-1", seatId, now, action: action({ ...sensitive, fieldInventoryComplete: true, purpose: "sales_export" }) }).reasonCodes).toContain("field_transform_policy_missing");
    expect(evaluatePolicyDecision({ grants: [minimizedGrant], principalKey: "user-1", seatId, now, action: action({ ...sensitive, authorityClass: "execute", fieldInventoryComplete: true }) }).reasonCodes).toContain("classification_ceiling_exceeded");
    expect(evaluatePolicyDecision({ grants: [minimizedGrant], principalKey: "user-1", seatId, now, action: action({ ...sensitive, fieldInventoryComplete: true, dataClasses: ["unlisted_sensitive_class"] }) }).reasonCodes).toContain("field_inventory_classification_mismatch");
  });

  it("applies wildcard transforms across collection read models without mutating source truth", () => {
    const source = { authoritySubjects: [{ identityAttributes: { credentialReference: "op://vault/a/password", safe: "A" } }, { identityAttributes: { credentialReference: "op://vault/b/password", safe: "B" } }] };
    const projected = applyFieldTransformations(source, [{ path: "/authoritySubjects/*/identityAttributes/credentialReference", action: "omit", outputClassification: "internal" }]);
    expect(projected).toEqual({ authoritySubjects: [{ identityAttributes: { safe: "A" } }, { identityAttributes: { safe: "B" } }] });
    expect(source.authoritySubjects[0].identityAttributes.credentialReference).toBe("op://vault/a/password");
  });

  it("turns structured conditions into evidence or denial outcomes", () => {
    const conditioned = grant({ conditionRules: [{ type: "purpose_in", values: ["create_governed_work"] }, { type: "provider_in", values: ["gmail"] }, { type: "evidence_minimum", count: 2 }] });
    expect(evaluatePolicyDecision({ grants: [conditioned], principalKey: "user-1", seatId, action: action({ providerKey: "gmail", evidenceReferences: ["evidence:1"] }), now })).toMatchObject({ outcome: "require_evidence", requirements: { evidence: 1 } });
    expect(evaluatePolicyDecision({ grants: [conditioned], principalKey: "user-1", seatId, action: action({ providerKey: "slack", evidenceReferences: ["evidence:1", "evidence:2"] }), now }).reasonCodes).toContain("provider_not_allowed");
    expect(evaluatePolicyDecision({ grants: [conditioned], principalKey: "user-1", seatId, action: action({ providerKey: "gmail", evidenceReferences: ["evidence:1", "evidence:2"] }), now }).outcome).toBe("permit");
  });

  it("requires distinct authorized approvals and then permits", () => {
    const governed = grant({ approvalPolicy: { minimumApprovals: 1, approverSeatIds: [approverSeatId], approverAuthorityClasses: ["approve"], disallowRequester: true, requireDistinctPrincipals: true, requireDistinctSeats: true } });
    expect(evaluatePolicyDecision({ grants: [governed], principalKey: "requester", seatId, action: action(), now })).toMatchObject({ outcome: "require_approval", requirements: { approvals: 1 } });
    const approved = action({ approvals: [{ approvalId: "approval-1", decision: "approved", approverPrincipalKey: "approver", approverSeatId, authorityClasses: ["approve"], decidedAt: now.toISOString() }] });
    expect(evaluatePolicyDecision({ grants: [governed], principalKey: "requester", seatId, action: approved, now }).outcome).toBe("permit");
    const selfApproved = action({ approvals: [{ approvalId: "approval-1", decision: "approved", approverPrincipalKey: "requester", approverSeatId, authorityClasses: ["approve"], decidedAt: now.toISOString() }] });
    expect(evaluatePolicyDecision({ grants: [governed], principalKey: "requester", seatId, action: selfApproved, now }).outcome).toBe("require_approval");
  });

  it("enforces segregation of duties against the action participants", () => {
    const separated = grant({ separationOfDuties: [{ authorityClass: "execute", distinctFrom: ["initiator", "approver"], requireDistinctSeat: false }] });
    const selfInitiated = action({ participants: { initiator: { principalKey: "user-1", seatId }, approver: { principalKey: "approver", seatId: approverSeatId } } });
    expect(evaluatePolicyDecision({ grants: [separated], principalKey: "user-1", seatId, action: selfInitiated, now }).reasonCodes).toContain("separation_of_duties_initiator");
  });

  it("lets an explicit deny override a matching allow", () => {
    const denied = grant({ id: "deny-1", effect: "deny" });
    expect(evaluatePolicyDecision({ grants: [grant(), denied], principalKey: "user-1", seatId, action: action(), now })).toMatchObject({ outcome: "deny", reasonCodes: ["explicit_deny"] });
  });

  it("does not let a broad wildcard grant bypass a narrower active grant", () => {
    const broad = grant({ id: "broad", actionResourceScope: { resource: "*" } });
    const narrow = grant({
      id: "narrow",
      granteeType: "principal",
      granteeKey: "user-1",
      actionResourceScope: { resource: "work_packet", action: "work_packet.create" },
      conditionRules: [{ type: "evidence_minimum", count: 1 }],
    });
    expect(evaluatePolicyDecision({ grants: [broad, narrow], principalKey: "user-1", seatId, action: action(), now })).toMatchObject({
      outcome: "require_evidence",
      requirements: { evidence: 1 },
    });
    expect(evaluatePolicyDecision({ grants: [broad, narrow], principalKey: "user-1", seatId, action: action({ evidenceReferences: ["evidence:1"] }), now })).toMatchObject({
      outcome: "permit",
      satisfiedGrantId: "narrow",
    });
  });

  it("escalates unresolved contextual classification", () => {
    expect(evaluatePolicyDecision({ grants: [grant()], principalKey: "user-1", seatId, action: action({ classification: "contextual" }), now })).toMatchObject({ outcome: "escalate", reasonCodes: ["classification_unresolved"] });
  });
});
