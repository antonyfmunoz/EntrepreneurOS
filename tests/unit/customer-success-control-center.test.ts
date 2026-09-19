import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  customerHealthReviewSchema,
  customerReportDeliverySchema,
  customerReportPreparationSchema,
  customerRenewalDecisionSchema,
  customerSuccessAccountSchema,
  deriveCustomerHealth,
  lifecycleForRenewalIntent,
} from "../../shared/customer-success";

const evidenceId = "3320d884-0c5b-4fb3-bfab-70d6b8897824";

describe("native customer-success control contracts", () => {
  it("derives health deterministically and keeps risk inverse", () => {
    expect(deriveCustomerHealth({ deliveryScore: 90, outcomeScore: 80, adoptionScore: 70, relationshipScore: 90, riskScore: 20 })).toEqual({ score: 82, state: "healthy" });
    expect(deriveCustomerHealth({ deliveryScore: 30, outcomeScore: 30, adoptionScore: 30, relationshipScore: 30, riskScore: 90 })).toEqual({ score: 26, state: "critical" });
  });

  it("requires verified Evidence-shaped inputs for a health review", () => {
    expect(customerHealthReviewSchema.parse({ expectedVersion: 2, deliveryScore: 80, outcomeScore: 75, adoptionScore: 60, relationshipScore: 90, riskScore: 25, evidenceIds: [evidenceId], summary: "Observed delivery, adoption, outcome, relationship, and risk facts were reviewed.", nextActions: "Resolve the adoption gap with the accountable customer owner.", nextReviewAt: "2026-10-01" }).riskScore).toBe(25);
    expect(() => customerHealthReviewSchema.parse({ expectedVersion: 2, deliveryScore: 101, outcomeScore: 75, adoptionScore: 60, relationshipScore: 90, riskScore: 25, evidenceIds: [evidenceId], summary: "Observed delivery, adoption, outcome, relationship, and risk facts were reviewed.", nextActions: "Resolve the adoption gap with the accountable customer owner.", nextReviewAt: "2026-10-01" })).toThrow();
  });

  it("fails closed when external proof has no separate consent Evidence", () => {
    const base = { expectedAccountVersion: 1, reportKey: "august-health", title: "August customer health", periodStart: "2026-08-01", periodEnd: "2026-08-31", executiveSummary: "Verified customer outcomes and unresolved issues are summarized with attribution limits.", evidenceIds: [evidenceId], classification: "confidential" as const };
    expect(() => customerReportPreparationSchema.parse({ ...base, proofConsent: "public_approved" })).toThrow();
    expect(customerReportPreparationSchema.parse({ ...base, proofConsent: "customer_approved", consentEvidenceId: evidenceId }).proofConsent).toBe("customer_approved");
  });

  it("treats delivery and renewal as receipt and decision records, not execution", () => {
    expect(customerReportDeliverySchema.parse({ expectedAccountVersion: 3, expectedVersion: 2, channel: "email", recipientScope: "Authorized customer sponsor", externalReference: "gmail-message-123", receiptEvidenceId: evidenceId, deliveredAt: "2026-08-25T12:00:00.000Z" }).deliveredAt).toBeInstanceOf(Date);
    expect(customerRenewalDecisionSchema.parse({ expectedVersion: 4, intent: "renew", evidenceIds: [evidenceId], rationale: "Verified health and outcome Evidence support a governed renewal preparation decision.", nextReviewAt: "2026-10-01" }).intent).toBe("renew");
    expect(lifecycleForRenewalIntent("renew")).toBe("renewing");
    expect(lifecycleForRenewalIntent("terminate")).toBe("nonrenewing");
    expect(lifecycleForRenewalIntent("defer")).toBe("renewal_review");
  });

  it("accepts exactly one governed customer source, including a visible native CRM customer", () => {
    const base = { ownerSeatId: evidenceId, reviewCadenceDays: 30, nextReviewAt: "2026-10-01", successDefinition: "The customer reaches the agreed operating result with evidence-backed delivery and outcome reviews.", classification: "confidential" as const };
    expect(customerSuccessAccountSchema.parse({ ...base, stakeholderId: evidenceId, relationshipId: "f4d6d664-b06c-49c7-8e0d-8483b773a443" }).relationshipId).toBe("f4d6d664-b06c-49c7-8e0d-8483b773a443");
    expect(customerSuccessAccountSchema.parse({ ...base, nativeRelationshipObjectId: "f4d6d664-b06c-49c7-8e0d-8483b773a443" }).nativeRelationshipObjectId).toBe("f4d6d664-b06c-49c7-8e0d-8483b773a443");
    expect(() => customerSuccessAccountSchema.parse({ ...base, stakeholderId: evidenceId })).toThrow();
    expect(() => customerSuccessAccountSchema.parse({ ...base, stakeholderId: evidenceId, relationshipId: "f4d6d664-b06c-49c7-8e0d-8483b773a443", nativeRelationshipObjectId: "d8bdb73e-cf3d-4878-865b-2f8dd5b7f3cd" })).toThrow();
  });

  it("keeps native CRM as the visible source while reconciling compatibility records only on account creation", () => {
    const control = readFileSync(resolve(process.cwd(), "client/src/components/customer-success-control-center.tsx"), "utf8");
    const routes = readFileSync(resolve(process.cwd(), "server/routes/customer-success.ts"), "utf8");
    expect(control).toContain("EOS-native CRM customers");
    expect(control).toContain("nativeRelationshipObjectId");
    expect(routes).toContain("projectNativeCrmCustomer");
    expect(routes).toContain("compatibility_projection_not_a_second_user_managed_contact");
    expect(routes).toContain("customer_success.native_crm_customer.read");
  });

  it("provisions one dormant, customer-bound workspace without treating setup as disclosure", () => {
    const control = readFileSync(resolve(process.cwd(), "client/src/components/customer-success-control-center.tsx"), "utf8");
    const portalRoutes = readFileSync(resolve(process.cwd(), "server/routes/stakeholder-portal.ts"), "utf8");
    expect(control).toContain("Client workspace");
    expect(control).toContain("portalKey: `client-${account.id}`");
    expect(control).toContain("stakeholderId: account.stakeholderId");
    expect(control).toContain("ownerSeatId: account.ownerSeatId");
    expect(control).toContain("portalKey === `client-${selected?.id}`");
    expect(control).toContain("owned by its accountable Customer Success role");
    expect(control).toContain("Provisioning creates no external access, message, or disclosure.");
    expect(control).toContain("draft native onboarding intake is ready");
    expect(control).toContain("formKey: \"client-onboarding\"");
    expect(portalRoutes).toContain('state: "dormant"');
    expect(portalRoutes).toContain("tokenDisclosedOnce: true");
  });

  it("adds database-enforced immutable receipts and governed projections", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0083_add_customer_success_control_center.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_customer_success_accounts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_customer_health_reviews");
    expect(migration).toContain("EOS customer-success receipts are append-only");
    expect(migration).toContain("projections require an exact event receipt");
    expect(migration).toContain("proof_consent = 'internal_only' OR consent_evidence_id IS NOT NULL");
    expect(migration).not.toMatch(/access_token|refresh_token|client_secret|provider_message_body/i);
  });
});
