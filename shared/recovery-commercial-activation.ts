import { z } from "zod";

export const RECOVERY_AGREEMENT_AUTHORITY_VERSION =
  "empyrean-recovery-agreement-authority.v1";
export const RECOVERY_BILLING_MANIFEST_VERSION =
  "empyrean-recovery-billing-manifest.v1";
export const RECOVERY_AGREEMENT_PACKET_SOURCE =
  "https://www.notion.so/3bcda8b96e4f81448fadc64c0f0c4b29";
export const RECOVERY_AGREEMENT_TEMPLATE_SOURCE =
  "https://www.notion.so/3adda8b96e4f81cb8851edfaada2bdfa";
export const RECOVERY_BILLING_MANIFEST_SOURCE =
  "https://www.notion.so/3bcda8b96e4f81ff9dfafac91a98cefa";

export const recoveryAgreementIssues = [
  "Contracting entity and legal name",
  "Service description and incorporated SOW/order form",
  "Fees, billing cadence, authorization and taxes",
  "Term, cancellation, renewal and post-termination obligations",
  "Guarantee eligibility, measurement, exclusions and remedy",
  "Client data rights, instructions, access and security duties",
  "SMS/email/phone/marketing compliance responsibility allocation",
  "Confidentiality and permitted use of information",
  "AI/automation use disclosure where required",
  "Third-party providers and service interruptions",
  "IP ownership/license for configurations, templates and deliverables",
  "Proof/testimonial/case-study permission as a separate affirmative right",
  "Disclaimers, limitation of liability, indemnity and dispute terms",
  "Suspension for compliance/security/approval failures",
  "E-signature, notice and governing-law mechanics",
] as const;

const text = (min = 1, max = 4_000) => z.string().trim().min(min).max(max);
const reference = z.string().trim().min(2).max(1_000);

export const counselDispositionSchema = z.object({
  version: z.coerce.number().int().positive(),
  disposition: z.enum(["approved", "approved_with_changes", "rejected"]),
  reviewerName: text(2, 240),
  reviewerCredentialReference: text(2, 500),
  jurisdiction: text(2, 240),
  exactLanguageReference: reference,
  unresolvedBusinessChoices: z.string().trim().max(4_000).default(""),
  complianceDependencies: text(2, 4_000),
  effectiveVersion: text(2, 240),
  effectiveAt: z.coerce.date(),
  evidenceId: z.string().uuid(),
  issueDispositions: z.array(z.object({
    issue: z.enum(recoveryAgreementIssues),
    state: z.enum(["resolved", "accepted_dependency", "unresolved"]),
    note: text(2, 1_000),
  })).length(recoveryAgreementIssues.length),
}).superRefine((value, context) => {
  const exact = new Set(value.issueDispositions.map((item) => item.issue));
  if (exact.size !== recoveryAgreementIssues.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["issueDispositions"], message: "Every legal-review issue must appear exactly once." });
  if (value.disposition !== "rejected" && value.issueDispositions.some((item) => item.state === "unresolved"))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["issueDispositions"], message: "Approved authority cannot retain an unresolved legal issue." });
});

export const recoveryAgreementConfigurationSchema = z.object({
  version: z.coerce.number().int().positive(),
  clientLegalName: text(2, 240),
  clientSignerName: text(2, 240),
  clientSignerEmail: z.string().trim().email().max(320),
  providerLegalName: text(2, 240),
  agreementVersion: text(2, 240),
  eSignProvider: z.enum(["eos_native", "docusign"]).optional(),
  eSignTemplateReference: reference,
  eSignBindingId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  const provider = value.eSignProvider || (value.eSignBindingId ? "docusign" : "eos_native");
  if (provider === "eos_native" && !z.string().uuid().safeParse(value.eSignTemplateReference).success)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eSignTemplateReference"], message: "Select an EOS native document version." });
  if (provider === "docusign" && !value.eSignBindingId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eSignBindingId"], message: "Select a DocuSign Integration Binding." });
}).transform((value) => ({
  ...value,
  eSignProvider: value.eSignProvider || (value.eSignBindingId ? "docusign" as const : "eos_native" as const),
}));

export const recoveryBillingConfigurationSchema = z.object({
  version: z.coerce.number().int().positive(),
  stripeBindingId: z.string().uuid(),
  providerProductReference: reference,
  setupPriceReference: reference,
  recurringPriceReference: reference,
  currency: z.literal("USD"),
  taxTreatment: text(2, 500),
  statementDescriptor: text(2, 22),
  paymentMethodPolicy: text(2, 1_000),
  subscriptionStartRule: text(2, 1_000),
  receiptBehavior: text(2, 1_000),
  cancellationRefundAuthority: text(2, 2_000),
});

export function assertConfigurationReference(value: string) {
  if (/(?:^|[^a-z0-9])(sk_live|sk_test|rk_live|rk_test|whsec|secret|password|bearer)(?:_|\b)/i.test(value))
    throw new Error("Credential-shaped material is prohibited; store only provider object references.");
  return value;
}

export function agreementProviderBlockers(provider: "eos_native" | "docusign", binding: null | {
  providerKey: string;
  lifecycleState: string;
  connectionState: string;
  healthState: string;
  parityState: string;
  providerAccountReference: string;
  credentialReference: string | null;
}) {
  if (provider === "eos_native") return [];
  if (!binding) return ["DocuSign Integration Binding is not selected."];
  return [
    ...(binding.providerKey !== "docusign" ? ["Selected binding is not DocuSign."] : []),
    ...(binding.lifecycleState !== "active" ? ["DocuSign binding is not active."] : []),
    ...(binding.connectionState !== "connected" ? ["DocuSign binding is not connected."] : []),
    ...(binding.healthState !== "healthy" ? ["DocuSign health is not verified healthy."] : []),
    ...(binding.parityState !== "passing" ? ["DocuSign contract parity is not passing."] : []),
    ...(!binding.providerAccountReference ? ["DocuSign account reference is missing."] : []),
    ...(!binding.credentialReference ? ["DocuSign managed-secret reference is missing."] : []),
  ];
}

export function billingProviderBlockers(binding: Parameters<typeof agreementProviderBlockers>[1]) {
  if (!binding) return ["Stripe Integration Binding is not selected."];
  return [
    ...(binding.providerKey !== "stripe" ? ["Selected binding is not Stripe."] : []),
    ...(binding.lifecycleState !== "active" ? ["Stripe binding is not active."] : []),
    ...(binding.connectionState !== "connected" ? ["Stripe binding is not connected."] : []),
    ...(binding.healthState !== "healthy" ? ["Stripe health is not verified healthy."] : []),
    ...(binding.parityState !== "passing" ? ["Stripe contract parity is not passing."] : []),
    ...(!binding.providerAccountReference ? ["Stripe account reference is missing."] : []),
    ...(!binding.credentialReference ? ["Stripe managed-secret reference is missing."] : []),
  ];
}
