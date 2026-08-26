import { describe, expect, it } from "vitest";
import {
  agreementProviderBlockers,
  assertConfigurationReference,
  billingProviderBlockers,
  counselDispositionSchema,
  recoveryAgreementIssues,
  recoveryBillingConfigurationSchema,
} from "../../shared/recovery-commercial-activation";

const healthy = {
  providerKey: "docusign",
  lifecycleState: "active",
  connectionState: "connected",
  healthState: "healthy",
  parityState: "passing",
  providerAccountReference: "account-ref",
  credentialReference: "managed-secret-ref",
};

describe("Recovery commercial activation authority", () => {
  it("requires an exact attributable disposition for all 15 counsel issues", () => {
    const base = {
      version: 1,
      disposition: "approved_with_changes",
      reviewerName: "Qualified Counsel",
      reviewerCredentialReference: "bar-record-reference",
      jurisdiction: "Arizona",
      exactLanguageReference: "agreement-v2-reviewed-redline",
      unresolvedBusinessChoices: "",
      complianceDependencies: "Confirm client-specific messaging consent and data instructions.",
      effectiveVersion: "recovery-agreement-v2",
      effectiveAt: new Date(),
      evidenceId: "00000000-0000-4000-8000-000000000001",
      issueDispositions: recoveryAgreementIssues.map((issue) => ({ issue, state: "resolved", note: "Resolved in the reviewed redline." })),
    };
    expect(recoveryAgreementIssues).toHaveLength(15);
    expect(counselDispositionSchema.safeParse(base).success).toBe(true);
    expect(counselDispositionSchema.safeParse({ ...base, issueDispositions: base.issueDispositions.slice(1) }).success).toBe(false);
    expect(counselDispositionSchema.safeParse({ ...base, issueDispositions: base.issueDispositions.map((item, index) => index ? item : { ...item, state: "unresolved" }) }).success).toBe(false);
  });

  it("fails closed unless provider identity, connection, health, parity, account, and managed secret all pass", () => {
    expect(agreementProviderBlockers("eos_native", null)).toEqual([]);
    expect(agreementProviderBlockers("docusign", healthy)).toEqual([]);
    expect(agreementProviderBlockers("docusign", { ...healthy, connectionState: "configured", parityState: "not_tested", credentialReference: null })).toEqual(expect.arrayContaining([
      "DocuSign binding is not connected.",
      "DocuSign contract parity is not passing.",
      "DocuSign managed-secret reference is missing.",
    ]));
    expect(billingProviderBlockers({ ...healthy, providerKey: "stripe" })).toEqual([]);
  });

  it("rejects credential-shaped input and browser-authored prices", () => {
    expect(() => assertConfigurationReference(["sk", "live", "example"].join("_"))).toThrow(/Credential-shaped/);
    expect(() => assertConfigurationReference("price_123")).not.toThrow();
    const parsed = recoveryBillingConfigurationSchema.parse({
      version: 1,
      stripeBindingId: "00000000-0000-4000-8000-000000000001",
      providerProductReference: "prod_123",
      setupPriceReference: "price_setup",
      recurringPriceReference: "price_recurring",
      currency: "USD",
      taxTreatment: "Provider tax configuration",
      statementDescriptor: "EMPYREAN",
      paymentMethodPolicy: "Authorized methods only",
      subscriptionStartRule: "After signed agreement",
      receiptBehavior: "Provider receipt",
      cancellationRefundAuthority: "Effective agreement and finance approval",
      setupAmountMinor: 1,
      recurringAmountMinor: 1,
    });
    expect(parsed).not.toHaveProperty("setupAmountMinor");
    expect(parsed).not.toHaveProperty("recurringAmountMinor");
  });
});
