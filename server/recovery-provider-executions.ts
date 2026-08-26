import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  eosAuditRecords,
  eosEvidence,
  eosIntegrationBindings,
  eosProviderExecutions,
  eosRecoveryAgreementInstances,
  eosRecoveryActivationEvents,
  eosRecoveryBillingManifests,
} from "@shared/schema";
import {
  agreementProviderBlockers,
  billingProviderBlockers,
} from "@shared/recovery-commercial-activation";
import {
  executeRecoveryCommercialEffect,
  type RecoveryCommercialEffect,
} from "./integrations/recovery-commercial";
import { db } from "./db";

type Execution = typeof eosProviderExecutions.$inferSelect;

type StoredRequest = {
  billingManifestId?: string;
  agreementInstanceId?: string;
  bindingId?: string;
  targetVersion?: number;
  timing?: "immediate" | "period_end";
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  rationale?: string;
};

function bindingIsUsable(binding: typeof eosIntegrationBindings.$inferSelect) {
  const blockers = binding.providerKey === "stripe"
    ? billingProviderBlockers(binding)
    : agreementProviderBlockers("docusign", binding);
  if (blockers.length)
    throw new Error("The exact provider binding is no longer execution-ready.");
}

export async function executeApprovedRecoveryProviderExecution(input: {
  execution: Execution;
  companyId: number;
  actorUserId: string;
}) {
  const request = input.execution.request as StoredRequest;
  if (!request.bindingId || !Number.isInteger(request.targetVersion))
    throw new Error("Recovery execution target metadata is incomplete.");
  const binding = await db.query.eosIntegrationBindings.findFirst({
    where: and(
      eq(eosIntegrationBindings.id, request.bindingId),
      eq(eosIntegrationBindings.companyId, input.companyId),
      eq(eosIntegrationBindings.providerKey, input.execution.provider),
    ),
  });
  if (!binding) throw new Error("Recovery execution binding is unavailable.");
  bindingIsUsable(binding);

  let effect: RecoveryCommercialEffect;
  let targetType: "recovery_billing_manifest" | "recovery_agreement_instance";
  let targetId: string;
  let targetVersion: number;
  let activationId: string;
  let fromState: string;
  let toState: string;

  if (request.billingManifestId) {
    const [billing] = await db
      .select()
      .from(eosRecoveryBillingManifests)
      .where(and(
        eq(eosRecoveryBillingManifests.id, request.billingManifestId),
        eq(eosRecoveryBillingManifests.companyId, input.companyId),
        eq(eosRecoveryBillingManifests.workPacketId, input.execution.workPacketId),
      ));
    if (!billing || billing.version !== request.targetVersion)
      throw new Error("The Recovery billing manifest changed after approval was requested.");
    const [agreement] = await db
      .select()
      .from(eosRecoveryAgreementInstances)
      .where(and(
        eq(eosRecoveryAgreementInstances.id, billing.agreementInstanceId),
        eq(eosRecoveryAgreementInstances.companyId, input.companyId),
      ));
    if (!agreement) throw new Error("The Recovery agreement package is unavailable.");
    targetType = "recovery_billing_manifest";
    targetId = billing.id;
    targetVersion = billing.version;
    activationId = agreement.id;
    fromState = billing.state;
    toState = billing.state;
    if (input.execution.operation === "stripe.create_recovery_checkout_with_local_approval") {
      if (billing.state !== "checkout_eligible" || billing.providerCheckoutReference)
        throw new Error("The billing manifest is no longer eligible for Checkout issuance.");
      effect = {
        kind: "stripe_checkout",
        billingManifestId: billing.id,
        agreementInstanceId: agreement.id,
        packageKey: billing.packageKey,
        productReference: billing.providerProductReference,
        setupPriceReference: billing.setupPriceReference,
        recurringPriceReference: billing.recurringPriceReference,
        signerEmail: agreement.clientSignerEmail,
      };
      toState = "issued";
    } else if (input.execution.operation === "stripe.cancel_recovery_subscription_with_local_approval") {
      if (!billing.providerSubscriptionReference || !request.timing || ["cancelled", "refunded"].includes(billing.state))
        throw new Error("The subscription is no longer eligible for cancellation.");
      effect = {
        kind: "stripe_cancel",
        subscriptionReference: billing.providerSubscriptionReference,
        timing: request.timing,
      };
    } else if (input.execution.operation === "stripe.refund_recovery_setup_with_local_approval") {
      if (billing.setupPaymentState !== "succeeded" || !billing.providerPaymentIntentReference || !request.reason)
        throw new Error("The setup payment is no longer eligible for refund.");
      effect = {
        kind: "stripe_refund",
        paymentIntentReference: billing.providerPaymentIntentReference,
        setupAmountMinor: billing.setupAmountMinor,
        reason: request.reason,
      };
    } else {
      throw new Error("Stripe recovery operation is unsupported.");
    }
  } else if (request.agreementInstanceId) {
    const [agreement] = await db
      .select()
      .from(eosRecoveryAgreementInstances)
      .where(and(
        eq(eosRecoveryAgreementInstances.id, request.agreementInstanceId),
        eq(eosRecoveryAgreementInstances.companyId, input.companyId),
        eq(eosRecoveryAgreementInstances.workPacketId, input.execution.workPacketId),
      ));
    if (!agreement || agreement.version !== request.targetVersion)
      throw new Error("The Recovery agreement package changed after approval was requested.");
    targetType = "recovery_agreement_instance";
    targetId = agreement.id;
    targetVersion = agreement.version;
    activationId = agreement.id;
    fromState = agreement.state;
    toState = agreement.state;
    if (input.execution.operation === "docusign.send_recovery_agreement_with_local_approval") {
      if (agreement.state !== "eligible_to_issue" || agreement.providerEnvelopeReference)
        throw new Error("The agreement is no longer eligible for issuance.");
      const [billing] = await db
        .select()
        .from(eosRecoveryBillingManifests)
        .where(and(
          eq(eosRecoveryBillingManifests.agreementInstanceId, agreement.id),
          eq(eosRecoveryBillingManifests.companyId, input.companyId),
        ));
      if (!billing || billing.setupPaymentState !== "succeeded" || !["active", "trialing"].includes(billing.subscriptionState))
        throw new Error("Authoritative payment and subscription receipts are no longer ready for agreement issuance.");
      effect = {
        kind: "docusign_send",
        agreementInstanceId: agreement.id,
        agreementVersion: agreement.agreementVersion,
        templateReference: agreement.eSignTemplateReference,
        signerName: agreement.clientSignerName,
        signerEmail: agreement.clientSignerEmail,
      };
      toState = "issued";
    } else if (input.execution.operation === "docusign.void_recovery_agreement_with_local_approval") {
      if (agreement.state !== "issued" || !agreement.providerEnvelopeReference || !request.rationale)
        throw new Error("The agreement is no longer eligible to be voided.");
      effect = {
        kind: "docusign_void",
        envelopeReference: agreement.providerEnvelopeReference,
        rationale: request.rationale,
      };
    } else {
      throw new Error("DocuSign recovery operation is unsupported.");
    }
  } else {
    throw new Error("Recovery execution target is missing.");
  }

  const [claimed] = await db
    .update(eosProviderExecutions)
    .set({ status: "executing", updatedAt: new Date() })
    .where(and(
      eq(eosProviderExecutions.id, input.execution.id),
      inArray(eosProviderExecutions.status, ["awaiting_approval", "failed"]),
    ))
    .returning();
  if (!claimed) throw new Error("Recovery execution was already claimed.");

  const providerReceipt = await executeRecoveryCommercialEffect({
    binding,
    execution: input.execution,
    effect,
  });
  if (!providerReceipt.id?.trim())
    throw new Error("The provider accepted the request without returning an object reference.");
  const completedAt = new Date();
  const evidenceId = randomUUID();

  return db.transaction(async (tx) => {
    let updatedTarget: Array<{ id: string }>;
    if (effect.kind === "stripe_checkout") {
      updatedTarget = await tx.update(eosRecoveryBillingManifests).set({
        state: "issued",
        providerCheckoutReference: providerReceipt.id,
        checkoutExecutionId: input.execution.id,
        externalEffectsExecuted: true,
        blockers: ["Waiting for signature-verified Stripe payment and subscription receipts."],
        version: targetVersion + 1,
        updatedAt: completedAt,
      }).where(and(eq(eosRecoveryBillingManifests.id, targetId), eq(eosRecoveryBillingManifests.version, targetVersion)))
        .returning({ id: eosRecoveryBillingManifests.id });
    } else if (effect.kind === "docusign_send") {
      updatedTarget = await tx.update(eosRecoveryAgreementInstances).set({
        state: "issued",
        providerEnvelopeReference: providerReceipt.id,
        issuanceExecutionId: input.execution.id,
        externalEffectsExecuted: true,
        blockers: ["Waiting for a signature-verified DocuSign completion receipt."],
        version: targetVersion + 1,
        updatedAt: completedAt,
      }).where(and(eq(eosRecoveryAgreementInstances.id, targetId), eq(eosRecoveryAgreementInstances.version, targetVersion)))
        .returning({ id: eosRecoveryAgreementInstances.id });
    } else if (effect.kind === "docusign_void") {
      updatedTarget = await tx.update(eosRecoveryAgreementInstances).set({
        externalEffectsExecuted: true,
        blockers: ["Void requested; waiting for a signature-verified DocuSign receipt."],
        version: targetVersion + 1,
        updatedAt: completedAt,
      }).where(and(eq(eosRecoveryAgreementInstances.id, targetId), eq(eosRecoveryAgreementInstances.version, targetVersion)))
        .returning({ id: eosRecoveryAgreementInstances.id });
    } else {
      updatedTarget = await tx.update(eosRecoveryBillingManifests).set({
        lastCompensationExecutionId: input.execution.id,
        externalEffectsExecuted: true,
        blockers: [effect.kind === "stripe_refund"
          ? "Setup refund requested; waiting for a signature-verified Stripe receipt."
          : "Subscription cancellation requested; waiting for a signature-verified Stripe receipt."],
        version: targetVersion + 1,
        updatedAt: completedAt,
      }).where(and(eq(eosRecoveryBillingManifests.id, targetId), eq(eosRecoveryBillingManifests.version, targetVersion)))
        .returning({ id: eosRecoveryBillingManifests.id });
    }
    if (!updatedTarget.length)
      throw new Error("The Recovery target changed while the provider request was in flight; the stable idempotency key is retained for reconciliation.");

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${activationId}))`);
    const [latest] = await tx.select({ sequence: eosRecoveryActivationEvents.sequence })
      .from(eosRecoveryActivationEvents)
      .where(eq(eosRecoveryActivationEvents.activationId, activationId))
      .orderBy(desc(eosRecoveryActivationEvents.sequence))
      .limit(1);
    await tx.insert(eosRecoveryActivationEvents).values({
      id: randomUUID(),
      companyId: input.companyId,
      activationId,
      objectType: targetType === "recovery_billing_manifest" ? "billing" : "agreement",
      objectId: targetId,
      actorUserId: input.actorUserId,
      actorSeatId: binding.ownerSeatId,
      sequence: (latest?.sequence || 0) + 1,
      eventType: `provider_execution_${effect.kind}`,
      fromState,
      toState,
      details: {
        providerEffect: true,
        provider: input.execution.provider,
        operation: input.execution.operation,
        providerExecutionId: input.execution.id,
        evidenceId,
        lifecycleReceiptPending: true,
      },
      traceId: input.execution.traceId,
      correlationId: input.execution.correlationId,
      createdAt: completedAt,
    });

    const [execution] = await tx.update(eosProviderExecutions).set({
      status: "succeeded",
      receipt: providerReceipt,
      reconciliationStatus: "pending_receipt",
      failureCode: null,
      executedAt: completedAt,
      updatedAt: completedAt,
    }).where(eq(eosProviderExecutions.id, input.execution.id)).returning();
    await tx.insert(eosEvidence).values({
      id: evidenceId,
      evidenceKey: `provider-issuance:${input.execution.provider}:${input.execution.id}`,
      companyId: input.companyId,
      workPacketId: input.execution.workPacketId,
      recordedByUserId: input.actorUserId,
      evidenceType: "provider_receipt",
      title: `${input.execution.provider === "stripe" ? "Stripe" : "DocuSign"} approved operation receipt`,
      sourceSystem: input.execution.provider,
      verificationState: "observed",
      confidenceQuality: "authoritative",
      supportedClaimSummary: "The provider accepted the approved operation. Payment, subscription, signature, cancellation, and refund lifecycle claims still require authoritative webhook receipts.",
      details: {
        provider: input.execution.provider,
        operation: input.execution.operation,
        executionId: input.execution.id,
        providerObjectType: providerReceipt.objectType,
        providerObjectReference: providerReceipt.id,
        lifecycleReceiptPending: true,
      },
      createdAt: completedAt,
    });
    await tx.insert(eosAuditRecords).values({
      id: randomUUID(),
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: "recovery_provider_execution.accepted",
      targetType,
      targetId,
      traceId: input.execution.traceId,
      correlationId: input.execution.correlationId,
      result: "pending_authoritative_receipt",
      details: {
        provider: input.execution.provider,
        operation: input.execution.operation,
        providerExecutionId: input.execution.id,
        evidenceId,
      },
      createdAt: completedAt,
    });
    return execution;
  });
}
