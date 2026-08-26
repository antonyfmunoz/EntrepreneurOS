import { z } from "zod";

export const RECOVERY_PROVIDER_RECEIPT_VERSION =
  "empyrean-recovery-provider-receipt.v1";

export const recoveryProviderKeySchema = z.enum(["docusign", "stripe"]);

export type RecoveryAgreementState =
  | "blocked_counsel"
  | "blocked_esign"
  | "blocked_payment"
  | "eligible_to_issue"
  | "issued"
  | "signed"
  | "declined"
  | "voided"
  | "expired";

export type RecoveryBillingState =
  | "configuration_required"
  | "blocked_agreement"
  | "blocked_stripe"
  | "checkout_eligible"
  | "issued"
  | "payment_failed"
  | "setup_paid_subscription_pending"
  | "active"
  | "recovery_required"
  | "cancelled"
  | "refunded"
  | "disputed";

const agreementEvents = {
  "envelope-sent": "issued",
  "envelope-completed": "signed",
  "envelope-declined": "declined",
  "envelope-voided": "voided",
  "envelope-expired": "expired",
} as const;

export function reconcileAgreementReceipt(
  current: RecoveryAgreementState,
  eventType: string,
): { state: RecoveryAgreementState; processingState: "applied" | "ignored" | "recovery_required"; failureCode: string } {
  const target = agreementEvents[eventType as keyof typeof agreementEvents];
  if (!target) return { state: current, processingState: "ignored", failureCode: "event_not_required" };
  if (current === target) return { state: current, processingState: "ignored", failureCode: "state_already_applied" };
  if (current === "signed") {
    return target === "issued"
      ? { state: current, processingState: "ignored", failureCode: "stale_event" }
      : { state: current, processingState: "recovery_required", failureCode: "agreement_terminal_conflict" };
  }
  if (["declined", "voided", "expired"].includes(current)) {
    return target === "issued"
      ? { state: current, processingState: "ignored", failureCode: "stale_event" }
      : { state: current, processingState: "recovery_required", failureCode: "agreement_terminal_conflict" };
  }
  if (!["eligible_to_issue", "issued"].includes(current))
    return { state: current, processingState: "recovery_required", failureCode: "agreement_not_receipt_eligible" };
  return { state: target, processingState: "applied", failureCode: "" };
}

export type RecoveryBillingSignals = {
  state: RecoveryBillingState;
  setupPaymentState: "pending" | "succeeded" | "failed" | "refunded" | "disputed";
  subscriptionState: "pending" | "incomplete" | "trialing" | "active" | "past_due" | "paused" | "cancelled";
  agreementSigned: boolean;
};

export type RecoveryStripeEventProjection = {
  eventType: string;
  checkoutPaymentStatus?: string;
  subscriptionStatus?: string;
  invoicePaid?: boolean;
};

export function reconcileStripeReceipt(
  current: RecoveryBillingSignals,
  event: RecoveryStripeEventProjection,
): RecoveryBillingSignals & { processingState: "applied" | "ignored" | "recovery_required"; failureCode: string } {
  let setupPaymentState = current.setupPaymentState;
  let subscriptionState = current.subscriptionState;
  let forcedState: RecoveryBillingState | null = null;
  let recognized = true;

  const successEvent = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(event.eventType);
  if (successEvent && ["refunded", "disputed"].includes(current.setupPaymentState))
    return { ...current, state: "recovery_required", processingState: "recovery_required", failureCode: "payment_terminal_conflict" };
  if (["customer.subscription.created", "customer.subscription.updated"].includes(event.eventType)
      && current.subscriptionState === "cancelled"
      && !["canceled", "cancelled"].includes(event.subscriptionStatus || ""))
    return { ...current, state: "recovery_required", processingState: "recovery_required", failureCode: "subscription_terminal_conflict" };

  switch (event.eventType) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "payment_intent.succeeded":
      if (event.eventType === "checkout.session.completed" && event.checkoutPaymentStatus !== "paid")
        return { ...current, processingState: "ignored", failureCode: "checkout_not_paid" };
      setupPaymentState = "succeeded";
      break;
    case "checkout.session.async_payment_failed":
    case "payment_intent.payment_failed":
    case "invoice.payment_failed":
      setupPaymentState = setupPaymentState === "succeeded" ? setupPaymentState : "failed";
      forcedState = "payment_failed";
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      subscriptionState = normalizeSubscriptionState(event.subscriptionStatus);
      break;
    case "customer.subscription.deleted":
      subscriptionState = "cancelled";
      forcedState = "cancelled";
      break;
    case "invoice.paid":
      if (event.invoicePaid === false)
        return { ...current, processingState: "recovery_required", failureCode: "invoice_paid_event_not_paid" };
      break;
    case "charge.refunded":
    case "refund.created":
      setupPaymentState = "refunded";
      forcedState = "refunded";
      break;
    case "charge.dispute.created":
      setupPaymentState = "disputed";
      forcedState = "disputed";
      break;
    default:
      recognized = false;
  }

  if (!recognized) return { ...current, processingState: "ignored", failureCode: "event_not_required" };
  const state = forcedState
    || (setupPaymentState === "succeeded" && ["active", "trialing"].includes(subscriptionState)
      ? current.agreementSigned ? "active" : "setup_paid_subscription_pending"
      : setupPaymentState === "succeeded"
        ? "setup_paid_subscription_pending"
        : current.state);
  return { ...current, setupPaymentState, subscriptionState, state, processingState: "applied", failureCode: "" };
}

function normalizeSubscriptionState(value?: string): RecoveryBillingSignals["subscriptionState"] {
  if (value === "active" || value === "trialing" || value === "past_due" || value === "paused") return value;
  if (value === "canceled" || value === "cancelled") return "cancelled";
  return "incomplete";
}
