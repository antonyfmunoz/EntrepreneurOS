import { describe, expect, it } from "vitest";
import {
  docusignEnvelopeParameters,
  stripeCheckoutParameters,
} from "../../shared/recovery-provider-executions";
import { recoveryProviderIdempotencyKey } from "../../server/recovery-provider-idempotency";

describe("recovery provider execution contracts", () => {
  it("builds one Stripe subscription Checkout cart with setup and recurring prices", () => {
    const request = stripeCheckoutParameters({
      billingManifestId: "billing-1",
      agreementInstanceId: "agreement-1",
      packageKey: "founding",
      productReference: "prod_recovery",
      setupPriceReference: "price_setup",
      recurringPriceReference: "price_recurring",
      signerEmail: "client@example.com",
      successUrl: "https://entrepreneuros.net/recovery/success",
      cancelUrl: "https://entrepreneuros.net/recovery/cancel",
    });
    expect(request).toMatchObject({
      mode: "subscription",
      client_reference_id: "billing-1",
      customer_email: "client@example.com",
      line_items: [
        { price: "price_setup", quantity: 1 },
        { price: "price_recurring", quantity: 1 },
      ],
      metadata: {
        eos_recovery_billing_manifest_id: "billing-1",
        eos_agreement_instance_id: "agreement-1",
      },
      subscription_data: {
        metadata: { eos_recovery_billing_manifest_id: "billing-1" },
      },
    });
  });

  it("builds a DocuSign template envelope with a stable transaction and mapping fields", () => {
    const request = docusignEnvelopeParameters({
      executionId: "execution-1",
      agreementInstanceId: "agreement-1",
      agreementVersion: "legal-v3",
      templateReference: "template-1",
      signerName: "Client Signer",
      signerEmail: "client@example.com",
    });
    expect(request).toMatchObject({
      transactionId: "execution-1",
      templateId: "template-1",
      status: "sent",
      templateRoles: [{ roleName: "Client" }],
    });
    expect(request.customFields.textCustomFields).toContainEqual({
      name: "eos_agreement_instance_id",
      value: "agreement-1",
      show: "false",
    });
  });

  it("derives deterministic, version-sensitive idempotency keys", () => {
    const first = recoveryProviderIdempotencyKey({ companyId: 1, operation: "stripe.create", targetId: "x", targetVersion: 2 });
    expect(first).toBe(recoveryProviderIdempotencyKey({ companyId: 1, operation: "stripe.create", targetId: "x", targetVersion: 2 }));
    expect(first).not.toBe(recoveryProviderIdempotencyKey({ companyId: 1, operation: "stripe.create", targetId: "x", targetVersion: 3 }));
  });
});
