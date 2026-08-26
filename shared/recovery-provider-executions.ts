import { z } from "zod";

export const RECOVERY_PROVIDER_EXECUTION_VERSION =
  "empyrean-recovery-provider-execution.v1";

const rationale = z.string().trim().min(8).max(2_000);

export const recoveryProviderExecutionSchemas = [
  z.object({
    provider: z.literal("stripe"),
    operation: z.literal("stripe.create_recovery_checkout_with_local_approval"),
    billingManifestId: z.string().uuid(),
  }),
  z.object({
    provider: z.literal("docusign"),
    operation: z.literal("docusign.send_recovery_agreement_with_local_approval"),
    agreementInstanceId: z.string().uuid(),
  }),
  z.object({
    provider: z.literal("stripe"),
    operation: z.literal("stripe.cancel_recovery_subscription_with_local_approval"),
    billingManifestId: z.string().uuid(),
    timing: z.enum(["immediate", "period_end"]),
    rationale,
  }),
  z.object({
    provider: z.literal("stripe"),
    operation: z.literal("stripe.refund_recovery_setup_with_local_approval"),
    billingManifestId: z.string().uuid(),
    reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]),
    rationale,
  }),
  z.object({
    provider: z.literal("docusign"),
    operation: z.literal("docusign.void_recovery_agreement_with_local_approval"),
    agreementInstanceId: z.string().uuid(),
    rationale,
  }),
] as const;

export const recoveryProviderExecutionSchema = z.discriminatedUnion(
  "operation",
  recoveryProviderExecutionSchemas,
);

export type RecoveryProviderExecutionInput = z.infer<
  typeof recoveryProviderExecutionSchema
>;

export function isRecoveryProviderOperation(operation: string): boolean {
  return operation.startsWith("stripe.") || operation.startsWith("docusign.");
}

export function stripeCheckoutParameters(input: {
  billingManifestId: string;
  agreementInstanceId: string;
  packageKey: string;
  productReference: string;
  setupPriceReference: string;
  recurringPriceReference: string;
  signerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const metadata = {
    eos_recovery_billing_manifest_id: input.billingManifestId,
    eos_agreement_instance_id: input.agreementInstanceId,
    eos_package_key: input.packageKey,
    eos_product_reference: input.productReference,
    eos_setup_price_reference: input.setupPriceReference,
    eos_recurring_price_reference: input.recurringPriceReference,
    eos_contract_version: RECOVERY_PROVIDER_EXECUTION_VERSION,
  };
  return {
    mode: "subscription" as const,
    client_reference_id: input.billingManifestId,
    customer_email: input.signerEmail,
    line_items: [
      { price: input.setupPriceReference, quantity: 1 },
      { price: input.recurringPriceReference, quantity: 1 },
    ],
    metadata,
    subscription_data: { metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}

export function docusignEnvelopeParameters(input: {
  executionId: string;
  agreementInstanceId: string;
  agreementVersion: string;
  templateReference: string;
  signerName: string;
  signerEmail: string;
}) {
  return {
    transactionId: input.executionId,
    templateId: input.templateReference,
    status: "sent",
    templateRoles: [
      {
        email: input.signerEmail,
        name: input.signerName,
        roleName: "Client",
      },
    ],
    customFields: {
      textCustomFields: [
        { name: "eos_agreement_instance_id", value: input.agreementInstanceId, show: "false" },
        { name: "eos_agreement_version", value: input.agreementVersion, show: "false" },
        { name: "eos_template_reference", value: input.templateReference, show: "false" },
        { name: "eos_contract_version", value: RECOVERY_PROVIDER_EXECUTION_VERSION, show: "false" },
      ],
    },
  };
}
