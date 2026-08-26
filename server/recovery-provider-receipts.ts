import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import Stripe from "stripe";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  eosAuditRecords,
  eosEvidence,
  eosIntegrationBindings,
  eosRecoveryActivationEvents,
  eosRecoveryAgreementInstances,
  eosRecoveryBillingManifests,
  eosRecoveryProviderReceipts,
} from "@shared/schema";
import {
  RECOVERY_PROVIDER_RECEIPT_VERSION,
  reconcileAgreementReceipt,
  reconcileStripeReceipt,
  recoveryProviderKeySchema,
  type RecoveryAgreementState,
  type RecoveryBillingSignals,
} from "@shared/recovery-provider-receipts";
import { billingProviderBlockers } from "@shared/recovery-commercial-activation";
import { db } from "./db";

type ProviderKey = "docusign" | "stripe";
type Binding = typeof eosIntegrationBindings.$inferSelect;
type ReceiptResult = { duplicate: boolean; processingState: string; providerEventId: string };

const stripeVerifier = new Stripe("sk_test_eos_webhook_verification_only", {
  apiVersion: "2026-07-29.dahlia",
});

function configuredSecrets(bindingId: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(process.env.EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS || "{}");
  } catch {
    throw new Error("Recovery provider webhook secret mapping is invalid.");
  }
  const value = (parsed as Record<string, unknown> | null)?.[bindingId];
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  const secrets = values.filter((item): item is string => typeof item === "string" && item.length >= 16);
  if (!secrets.length) throw new Error("Recovery provider webhook verification is not configured for this binding.");
  return secrets;
}

function headerValues(headers: IncomingHttpHeaders, name: string): string[] {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
}

function verifyDocusign(rawBody: Buffer, headers: IncomingHttpHeaders, secrets: string[]): any {
  const signatures = Object.entries(headers)
    .filter(([key]) => /^x-docusign-signature-\d+$/i.test(key))
    .flatMap(([, value]) => Array.isArray(value) ? value : typeof value === "string" ? [value] : []);
  if (!signatures.length) throw new Error("DocuSign HMAC signature is missing.");
  const verified = secrets.some((secret) => signatures.some((signature) => {
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    let provided: Buffer;
    try { provided = Buffer.from(signature, "base64"); } catch { return false; }
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }));
  if (!verified) throw new Error("DocuSign HMAC signature is invalid.");
  return JSON.parse(rawBody.toString("utf8"));
}

function verifyStripe(rawBody: Buffer, headers: IncomingHttpHeaders, secrets: string[]): Stripe.Event {
  const signature = headerValues(headers, "stripe-signature")[0];
  if (!signature) throw new Error("Stripe signature is missing.");
  let lastError: unknown;
  for (const secret of secrets) {
    try { return stripeVerifier.webhooks.constructEvent(rawBody, signature, secret); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error("Stripe signature is invalid.");
}

function safeDate(value: unknown, fallback = new Date()): Date {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function docusignField(payload: any, name: string): string {
  const fields = payload?.data?.envelopeSummary?.customFields?.textCustomFields;
  if (!Array.isArray(fields)) return "";
  const match = fields.find((item: any) => [item?.name, item?.fieldName].includes(name));
  return typeof match?.value === "string" ? match.value : "";
}

function docusignSignerEmails(payload: any): string[] {
  const signers = payload?.data?.envelopeSummary?.recipients?.signers;
  if (!Array.isArray(signers)) return [];
  return signers.map((item: any) => typeof item?.email === "string" ? item.email.trim().toLowerCase() : "").filter(Boolean);
}

function stringRef(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as any).id === "string") return (value as any).id;
  return "";
}

function stripeObject(event: Stripe.Event): any { return event.data.object as any; }

function stripeMetadata(object: any): Record<string, string> {
  const value = object?.metadata;
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function stripePriceIds(object: any): string[] {
  const lines = Array.isArray(object?.items?.data) ? object.items.data : Array.isArray(object?.lines?.data) ? object.lines.data : [];
  return Array.from(new Set<string>(lines.map((item: any) =>
    stringRef(item?.price) || stringRef(item?.pricing?.price_details?.price),
  ).filter((item: string): item is string => Boolean(item)))).sort();
}

function stripeProjection(event: Stripe.Event) {
  const object = stripeObject(event);
  const metadata = stripeMetadata(object);
  const providerObjectReference = stringRef(object?.id);
  const customer = stringRef(object?.customer);
  const subscription = stringRef(object?.subscription) || (event.type.startsWith("customer.subscription.") ? providerObjectReference : "");
  const paymentIntent = stringRef(object?.payment_intent) || (event.type.startsWith("payment_intent.") ? providerObjectReference : "");
  const invoice = event.type.startsWith("invoice.") ? providerObjectReference : stringRef(object?.invoice);
  return {
    object,
    metadata,
    providerObjectReference,
    customer,
    subscription,
    paymentIntent,
    invoice,
    priceIds: stripePriceIds(object),
    occurredAt: safeDate(event.created),
    payloadProjection: {
      eventType: event.type,
      liveMode: event.livemode,
      objectReference: providerObjectReference,
      customerReference: customer,
      subscriptionReference: subscription,
      paymentIntentReference: paymentIntent,
      invoiceReference: invoice,
      packageKey: metadata.eos_package_key || "",
      productReference: metadata.eos_product_reference || "",
      priceReferences: stripePriceIds(object),
      currency: typeof object?.currency === "string" ? object.currency.toUpperCase() : "",
      amountSubtotal: Number.isInteger(object?.amount_subtotal) ? object.amount_subtotal : null,
      paymentStatus: typeof object?.payment_status === "string" ? object.payment_status : "",
      subscriptionStatus: typeof object?.status === "string" && event.type.startsWith("customer.subscription.") ? object.status : "",
    },
  };
}

function bindingUsable(binding: Binding, provider: ProviderKey): boolean {
  return binding.providerKey === provider
    && binding.lifecycleState === "active"
    && binding.connectionState === "connected"
    && Boolean(binding.providerAccountReference)
    && Boolean(binding.credentialReference);
}

async function appendProviderActivationEvent(
  tx: any,
  activationId: string,
  object: { id: string; companyId: number },
  objectType: "agreement" | "billing",
  binding: Binding,
  eventType: string,
  fromState: string,
  toState: string,
  details: Record<string, unknown>,
  traceId: string,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${activationId}))`);
  const [latest] = await tx.select({ sequence: eosRecoveryActivationEvents.sequence })
    .from(eosRecoveryActivationEvents).where(eq(eosRecoveryActivationEvents.activationId, activationId))
    .orderBy(desc(eosRecoveryActivationEvents.sequence)).limit(1);
  await tx.insert(eosRecoveryActivationEvents).values({
    id: randomUUID(), companyId: object.companyId, activationId, objectType,
    objectId: object.id, actorUserId: binding.recordedByUserId, actorSeatId: binding.ownerSeatId,
    sequence: (latest?.sequence || 0) + 1, eventType, fromState, toState,
    details, traceId, correlationId: activationId,
  });
}

async function providerEvidence(
  tx: any,
  binding: Binding,
  target: { id: string; workPacketId: string },
  provider: ProviderKey,
  providerEventId: string,
  eventType: string,
  objectReference: string,
  payloadSha256: string,
  occurredAt: Date,
  verifierMethod: string,
  processingState: string,
) {
  const id = randomUUID();
  await tx.insert(eosEvidence).values({
    id, companyId: binding.companyId, workPacketId: target.workPacketId,
    recordedByUserId: binding.recordedByUserId, evidenceType: "provider_receipt",
    title: `${provider === "docusign" ? "DocuSign" : "Stripe"} ${eventType} receipt`,
    details: { providerEventId, providerObjectReference: objectReference, payloadSha256, signatureState: "verified", processingState },
    evidenceKey: `provider-receipt:${provider}:${providerEventId}`,
    claimSubjectType: provider === "docusign" ? "recovery_agreement_instance" : "recovery_billing_manifest",
    claimSubjectKey: target.id, verificationState: "verified", confidenceQuality: "authoritative",
    dataClassification: "restricted", sourceSystem: provider, producerProviderKey: provider,
    supportedClaimSummary: `A signature-verified ${provider} event was received and reconciled as ${processingState}.`,
    verifierMethod, templateLearningEligibility: "not_eligible", relatedEventKeys: [providerEventId],
    schemaVersion: "evidence-v1.0", capturedAt: occurredAt, validFrom: occurredAt,
  });
  return id;
}

function receiptBase(binding: Binding, input: {
  provider: ProviderKey; providerEventId: string; eventType: string; providerObjectReference: string;
  verifierMethod: string; payloadSha256: string; payloadProjection: Record<string, unknown>; occurredAt: Date;
}) {
  return {
    id: randomUUID(), companyId: binding.companyId, providerKey: input.provider,
    integrationBindingId: binding.id, providerEventId: input.providerEventId,
    providerObjectReference: input.providerObjectReference, eventType: input.eventType,
    signatureState: "verified", verifierMethod: input.verifierMethod, payloadSha256: input.payloadSha256,
    payloadProjection: input.payloadProjection, externalEffectsObserved: true,
    schemaVersion: RECOVERY_PROVIDER_RECEIPT_VERSION, recordedByUserId: binding.recordedByUserId,
    occurredAt: input.occurredAt, receivedAt: new Date(),
  };
}

async function reconcileDocusign(
  tx: any, binding: Binding, payload: any, rawBody: Buffer,
): Promise<ReceiptResult> {
  const eventType = typeof payload?.event === "string" ? payload.event.toLowerCase() : "";
  const envelopeId = stringRef(payload?.data?.envelopeId || payload?.data?.envelopeSummary?.envelopeId);
  const occurredAt = safeDate(payload?.generatedDateTime || payload?.data?.envelopeSummary?.statusChangedDateTime);
  const payloadSha256 = createHash("sha256").update(rawBody).digest("hex");
  const providerEventId = stringRef(payload?.eventId || payload?.id) || `${eventType}:${envelopeId}:${occurredAt.toISOString()}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`docusign:${binding.id}:${providerEventId}`}))`);
  const existing = await tx.query.eosRecoveryProviderReceipts.findFirst({ where: and(eq(eosRecoveryProviderReceipts.integrationBindingId, binding.id), eq(eosRecoveryProviderReceipts.providerEventId, providerEventId), eq(eosRecoveryProviderReceipts.providerKey, "docusign")) });
  if (existing) return { duplicate: true, processingState: existing.processingState, providerEventId };

  const accountId = stringRef(payload?.data?.accountId || payload?.data?.envelopeSummary?.accountId);
  const agreementId = docusignField(payload, "eos_agreement_instance_id");
  const [agreement] = agreementId
    ? await tx.select().from(eosRecoveryAgreementInstances).where(and(eq(eosRecoveryAgreementInstances.id, agreementId), eq(eosRecoveryAgreementInstances.companyId, binding.companyId), eq(eosRecoveryAgreementInstances.eSignBindingId, binding.id))).limit(1)
    : envelopeId
      ? await tx.select().from(eosRecoveryAgreementInstances).where(and(eq(eosRecoveryAgreementInstances.companyId, binding.companyId), eq(eosRecoveryAgreementInstances.eSignBindingId, binding.id), eq(eosRecoveryAgreementInstances.providerEnvelopeReference, envelopeId))).limit(1)
      : [];
  const base = receiptBase(binding, { provider: "docusign", providerEventId, eventType, providerObjectReference: envelopeId, verifierMethod: "docusign_connect_hmac_sha256", payloadSha256, occurredAt, payloadProjection: { eventType, envelopeReference: envelopeId, accountReference: accountId } });
  let failureCode = "";
  if (!eventType || !envelopeId) failureCode = "docusign_event_invalid";
  else if (accountId && accountId !== binding.providerAccountReference) failureCode = "provider_account_mismatch";
  else if (!agreement) failureCode = "agreement_mapping_unavailable";
  else if (!agreement.providerEnvelopeReference && (
    docusignField(payload, "eos_agreement_version") !== agreement.agreementVersion
    || docusignField(payload, "eos_template_reference") !== agreement.eSignTemplateReference
  )) failureCode = "agreement_metadata_mismatch";
  else if (eventType === "envelope-completed" && !docusignSignerEmails(payload).includes(agreement.clientSignerEmail.toLowerCase())) failureCode = "agreement_signer_mismatch";
  else if (agreement.providerEnvelopeReference && agreement.providerEnvelopeReference !== envelopeId) failureCode = "agreement_envelope_mismatch";
  if (failureCode || !agreement) {
    await tx.insert(eosRecoveryProviderReceipts).values({ ...base, objectType: "unmatched", processingState: "rejected", failureCode, failureSummary: "The verified DocuSign event could not be mapped to the exact authorized agreement." });
    return { duplicate: false, processingState: "rejected", providerEventId };
  }

  const transition = reconcileAgreementReceipt(agreement.state as RecoveryAgreementState, eventType);
  const evidenceId = await providerEvidence(tx, binding, agreement, "docusign", providerEventId, eventType, envelopeId, payloadSha256, occurredAt, "docusign_connect_hmac_sha256", transition.processingState);
  const blockers = transition.processingState === "recovery_required"
    ? Array.from(new Set([...(agreement.blockers as string[]), `Provider receipt conflict: ${transition.failureCode}.`]))
    : transition.state === "signed" ? [] : agreement.blockers;
  await tx.update(eosRecoveryAgreementInstances).set({
    state: transition.state, providerEnvelopeReference: envelopeId,
    providerReceiptEvidenceId: evidenceId, blockers, version: agreement.version + 1, updatedAt: new Date(),
  }).where(and(eq(eosRecoveryAgreementInstances.id, agreement.id), eq(eosRecoveryAgreementInstances.version, agreement.version)));
  await appendProviderActivationEvent(tx, agreement.id, agreement, "agreement", binding, `provider_${eventType}`, agreement.state, transition.state, { providerEventId, evidenceId, processingState: transition.processingState, failureCode: transition.failureCode, externalEffectObserved: true, externalEffectExecutedByEos: false }, randomUUID());

  const [billing] = await tx.select().from(eosRecoveryBillingManifests).where(eq(eosRecoveryBillingManifests.agreementInstanceId, agreement.id)).limit(1);
  if (billing && ["signed", "declined", "voided", "expired"].includes(transition.state)) {
    if (transition.state === "signed") {
      const paymentReady = billing.setupPaymentState === "succeeded"
        && ["active", "trialing"].includes(billing.subscriptionState);
      const nextBlockers = paymentReady
        ? []
        : ["Authoritative setup-payment and active-subscription receipts are still required."];
      const nextState = paymentReady ? "active" : "setup_paid_subscription_pending";
      await tx.update(eosRecoveryBillingManifests).set({ state: nextState, blockers: nextBlockers, version: billing.version + 1, updatedAt: new Date() }).where(eq(eosRecoveryBillingManifests.id, billing.id));
      await appendProviderActivationEvent(tx, agreement.id, billing, "billing", binding, "agreement_receipt_reconciled", billing.state, nextState, { agreementEvidenceId: evidenceId, providerEffectExecutedByEos: false }, randomUUID());
    } else {
      const paymentObserved = billing.setupPaymentState === "succeeded"
        || ["active", "trialing"].includes(billing.subscriptionState);
      const nextState = paymentObserved ? "recovery_required" : "blocked_agreement";
      await tx.update(eosRecoveryBillingManifests).set({ state: nextState, blockers: [`Agreement is ${transition.state}; cancellation/refund authority must be resolved before onboarding.`], version: billing.version + 1, updatedAt: new Date() }).where(eq(eosRecoveryBillingManifests.id, billing.id));
    }
  }
  await tx.insert(eosRecoveryProviderReceipts).values({ ...base, objectType: "agreement", agreementInstanceId: agreement.id, processingState: transition.processingState, failureCode: transition.failureCode, failureSummary: transition.failureCode ? "The event conflicts with the recorded agreement lifecycle and requires review." : "", evidenceId });
  await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: binding.companyId, actorUserId: binding.recordedByUserId, action: "recovery_provider_receipt.reconciled", targetType: "recovery_agreement_instance", targetId: agreement.id, traceId: randomUUID(), correlationId: agreement.id, result: transition.processingState, details: { provider: "docusign", providerEventId, eventType, signatureVerified: true, externalEffectObserved: true, externalEffectExecutedByEos: false }, createdAt: new Date() });
  return { duplicate: false, processingState: transition.processingState, providerEventId };
}

async function findBilling(tx: any, binding: Binding, projection: ReturnType<typeof stripeProjection>) {
  const id = projection.metadata.eos_recovery_billing_manifest_id || projection.object?.client_reference_id || "";
  if (id) return (await tx.select().from(eosRecoveryBillingManifests).where(and(eq(eosRecoveryBillingManifests.id, id), eq(eosRecoveryBillingManifests.companyId, binding.companyId), eq(eosRecoveryBillingManifests.stripeBindingId, binding.id))).limit(1))[0];
  const matches = [
    projection.subscription ? eq(eosRecoveryBillingManifests.providerSubscriptionReference, projection.subscription) : undefined,
    projection.customer ? eq(eosRecoveryBillingManifests.providerCustomerReference, projection.customer) : undefined,
    projection.paymentIntent ? eq(eosRecoveryBillingManifests.providerPaymentIntentReference, projection.paymentIntent) : undefined,
    projection.invoice ? eq(eosRecoveryBillingManifests.providerLatestInvoiceReference, projection.invoice) : undefined,
  ].filter(Boolean) as any[];
  if (!matches.length) return undefined;
  return (await tx.select().from(eosRecoveryBillingManifests).where(and(eq(eosRecoveryBillingManifests.companyId, binding.companyId), eq(eosRecoveryBillingManifests.stripeBindingId, binding.id), or(...matches))).limit(1))[0];
}

function validateStripeCommercialMatch(billing: typeof eosRecoveryBillingManifests.$inferSelect, projection: ReturnType<typeof stripeProjection>, eventType: string): string {
  const metadata = projection.metadata;
  const initialEvent = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(eventType);
  if (metadata.eos_package_key && metadata.eos_package_key !== billing.packageKey) return "package_mismatch";
  if (initialEvent && metadata.eos_package_key !== billing.packageKey) return "package_metadata_required";
  if (initialEvent && metadata.eos_product_reference !== billing.providerProductReference) return "product_metadata_mismatch";
  if (initialEvent && (metadata.eos_setup_price_reference !== billing.setupPriceReference || metadata.eos_recurring_price_reference !== billing.recurringPriceReference)) return "price_metadata_mismatch";
  const currency = typeof projection.object?.currency === "string" ? projection.object.currency.toUpperCase() : "";
  if (currency && currency !== billing.currency) return "currency_mismatch";
  if (eventType.startsWith("checkout.session.") && Number.isInteger(projection.object?.amount_subtotal) && projection.object.amount_subtotal !== billing.setupAmountMinor + billing.recurringAmountMinor) return "checkout_subtotal_mismatch";
  if (eventType === "payment_intent.succeeded" && Number.isInteger(projection.object?.amount) && projection.object.amount !== billing.setupAmountMinor + billing.recurringAmountMinor) return "payment_amount_mismatch";
  if (eventType.startsWith("customer.subscription.") && (projection.priceIds.length !== 1 || projection.priceIds[0] !== billing.recurringPriceReference)) return "subscription_price_mismatch";
  if (eventType.startsWith("invoice.") && projection.priceIds.some((price) => ![billing.setupPriceReference, billing.recurringPriceReference].includes(price))) return "invoice_price_mismatch";
  return "";
}

async function reconcileStripe(tx: any, binding: Binding, event: Stripe.Event, rawBody: Buffer): Promise<ReceiptResult> {
  const projection = stripeProjection(event);
  const providerEventId = event.id;
  const payloadSha256 = createHash("sha256").update(rawBody).digest("hex");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stripe:${binding.id}:${providerEventId}`}))`);
  const existing = await tx.query.eosRecoveryProviderReceipts.findFirst({ where: and(eq(eosRecoveryProviderReceipts.integrationBindingId, binding.id), eq(eosRecoveryProviderReceipts.providerEventId, providerEventId), eq(eosRecoveryProviderReceipts.providerKey, "stripe")) });
  if (existing) return { duplicate: true, processingState: existing.processingState, providerEventId };
  const billing = await findBilling(tx, binding, projection);
  const base = receiptBase(binding, { provider: "stripe", providerEventId, eventType: event.type, providerObjectReference: projection.providerObjectReference, verifierMethod: "stripe_sdk_webhook_signature_v1", payloadSha256, occurredAt: projection.occurredAt, payloadProjection: projection.payloadProjection });
  const account = typeof event.account === "string" ? event.account : "";
  let failureCode = event.livemode !== true ? "provider_mode_mismatch" : account && account !== binding.providerAccountReference ? "provider_account_mismatch" : !billing ? "billing_mapping_unavailable" : "";
  if (failureCode || !billing) {
    await tx.insert(eosRecoveryProviderReceipts).values({ ...base, objectType: "unmatched", processingState: "rejected", failureCode, failureSummary: "The verified Stripe event could not be mapped to the exact authorized billing manifest." });
    return { duplicate: false, processingState: "rejected", providerEventId };
  }
  const [agreement] = await tx.select().from(eosRecoveryAgreementInstances).where(and(eq(eosRecoveryAgreementInstances.id, billing.agreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, billing.companyId))).limit(1);
  failureCode = validateStripeCommercialMatch(billing, projection, event.type);
  let transition = reconcileStripeReceipt({ state: billing.state as RecoveryBillingSignals["state"], setupPaymentState: billing.setupPaymentState as RecoveryBillingSignals["setupPaymentState"], subscriptionState: billing.subscriptionState as RecoveryBillingSignals["subscriptionState"], agreementSigned: agreement?.state === "signed" }, { eventType: event.type, checkoutPaymentStatus: projection.object?.payment_status, subscriptionStatus: event.type.startsWith("customer.subscription.") ? projection.object?.status : undefined, invoicePaid: event.type === "invoice.paid" ? projection.object?.paid !== false : undefined });
  if (failureCode) transition = { ...transition, state: "recovery_required", processingState: "recovery_required", failureCode };
  const evidenceId = await providerEvidence(tx, binding, billing, "stripe", providerEventId, event.type, projection.providerObjectReference, payloadSha256, projection.occurredAt, "stripe_sdk_webhook_signature_v1", transition.processingState);
  const blockers = transition.processingState === "recovery_required" ? [`Provider receipt mismatch: ${transition.failureCode}.`] : transition.state === "active" ? [] : billing.blockers;
  await tx.update(eosRecoveryBillingManifests).set({
    state: transition.state, setupPaymentState: transition.setupPaymentState, subscriptionState: transition.subscriptionState,
    providerCheckoutReference: event.type.startsWith("checkout.session.") ? projection.providerObjectReference : billing.providerCheckoutReference,
    providerCustomerReference: projection.customer || billing.providerCustomerReference,
    providerSubscriptionReference: projection.subscription || billing.providerSubscriptionReference,
    providerPaymentIntentReference: projection.paymentIntent || billing.providerPaymentIntentReference,
    providerLatestInvoiceReference: projection.invoice || billing.providerLatestInvoiceReference,
    providerReceiptEvidenceId: evidenceId, lastProviderEventAt: projection.occurredAt,
    blockers, version: billing.version + 1, updatedAt: new Date(),
  }).where(and(eq(eosRecoveryBillingManifests.id, billing.id), eq(eosRecoveryBillingManifests.version, billing.version)));
  await appendProviderActivationEvent(tx, billing.agreementInstanceId, billing, "billing", binding, `provider_${event.type}`, billing.state, transition.state, { providerEventId, evidenceId, processingState: transition.processingState, failureCode: transition.failureCode, externalEffectObserved: true, externalEffectExecutedByEos: false }, randomUUID());
  const paymentReady = transition.setupPaymentState === "succeeded"
    && ["active", "trialing"].includes(transition.subscriptionState);
  if (agreement && paymentReady && agreement.state === "blocked_payment") {
    const agreementVersion = agreement.version + 1;
    await tx.update(eosRecoveryAgreementInstances).set({
      state: "eligible_to_issue",
      blockers: [],
      version: agreementVersion,
      updatedAt: new Date(),
    }).where(and(
      eq(eosRecoveryAgreementInstances.id, agreement.id),
      eq(eosRecoveryAgreementInstances.version, agreement.version),
    ));
    await appendProviderActivationEvent(tx, agreement.id, { ...agreement, version: agreementVersion }, "agreement", binding, "payment_receipts_reconciled", agreement.state, "eligible_to_issue", { providerEventId, billingEvidenceId: evidenceId, externalEffectExecutedByEos: false }, randomUUID());
  }
  await tx.insert(eosRecoveryProviderReceipts).values({ ...base, objectType: "billing", billingManifestId: billing.id, processingState: transition.processingState, failureCode: transition.failureCode, failureSummary: transition.failureCode ? "The event conflicts with the authorized billing manifest or lifecycle and requires review." : "", evidenceId });
  await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: binding.companyId, actorUserId: binding.recordedByUserId, action: "recovery_provider_receipt.reconciled", targetType: "recovery_billing_manifest", targetId: billing.id, traceId: randomUUID(), correlationId: billing.agreementInstanceId, result: transition.processingState, details: { provider: "stripe", providerEventId, eventType: event.type, signatureVerified: true, externalEffectObserved: true, externalEffectExecutedByEos: false }, createdAt: new Date() });
  return { duplicate: false, processingState: transition.processingState, providerEventId };
}

export async function processRecoveryProviderWebhook(input: {
  provider: string; bindingId: string; rawBody: Buffer; headers: IncomingHttpHeaders;
}): Promise<ReceiptResult> {
  const provider = recoveryProviderKeySchema.parse(input.provider);
  const binding = await db.query.eosIntegrationBindings.findFirst({ where: eq(eosIntegrationBindings.id, input.bindingId) });
  if (!binding || !bindingUsable(binding, provider)) throw new Error("Recovery provider binding is not active and connected.");
  const secrets = configuredSecrets(binding.id);
  const verified = provider === "stripe"
    ? verifyStripe(input.rawBody, input.headers, secrets)
    : verifyDocusign(input.rawBody, input.headers, secrets);
  return db.transaction((tx) => provider === "stripe"
    ? reconcileStripe(tx, binding, verified as Stripe.Event, input.rawBody)
    : reconcileDocusign(tx, binding, verified, input.rawBody));
}
