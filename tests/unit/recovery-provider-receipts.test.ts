import { describe, expect, it } from "vitest";
import { reconcileAgreementReceipt, reconcileStripeReceipt } from "../../shared/recovery-provider-receipts";

describe("recovery provider receipt reconciliation", () => {
  it("accepts an authoritative completed envelope even when sent arrives later", () => {
    expect(reconcileAgreementReceipt("eligible_to_issue", "envelope-completed")).toMatchObject({ state: "signed", processingState: "applied" });
    expect(reconcileAgreementReceipt("signed", "envelope-sent")).toMatchObject({ state: "signed", processingState: "ignored", failureCode: "stale_event" });
  });

  it("requires recovery for conflicting terminal agreement events", () => {
    expect(reconcileAgreementReceipt("declined", "envelope-completed")).toMatchObject({ state: "declined", processingState: "recovery_required" });
  });

  it("does not activate until setup payment, subscription, and signature are all authoritative", () => {
    const start = { state: "checkout_eligible" as const, setupPaymentState: "pending" as const, subscriptionState: "pending" as const, agreementSigned: false };
    const paid = reconcileStripeReceipt(start, { eventType: "checkout.session.completed", checkoutPaymentStatus: "paid" });
    expect(paid).toMatchObject({ state: "setup_paid_subscription_pending", setupPaymentState: "succeeded" });
    expect(reconcileStripeReceipt(paid, { eventType: "customer.subscription.created", subscriptionStatus: "active" })).toMatchObject({ state: "setup_paid_subscription_pending", subscriptionState: "active" });
  });

  it("accepts authoritative payment before signature without opening onboarding", () => {
    expect(reconcileStripeReceipt({ state: "issued", setupPaymentState: "pending", subscriptionState: "pending", agreementSigned: false }, { eventType: "payment_intent.succeeded" })).toMatchObject({ state: "setup_paid_subscription_pending", setupPaymentState: "succeeded", failureCode: "" });
  });

  it("preserves terminal refund and cancellation state against late success events", () => {
    expect(reconcileStripeReceipt({ state: "refunded", setupPaymentState: "refunded", subscriptionState: "active", agreementSigned: true }, { eventType: "payment_intent.succeeded" })).toMatchObject({ state: "recovery_required", setupPaymentState: "refunded", failureCode: "payment_terminal_conflict" });
    expect(reconcileStripeReceipt({ state: "cancelled", setupPaymentState: "succeeded", subscriptionState: "cancelled", agreementSigned: true }, { eventType: "customer.subscription.updated", subscriptionStatus: "active" })).toMatchObject({ state: "recovery_required", subscriptionState: "cancelled", failureCode: "subscription_terminal_conflict" });
  });

  it("routes refund and dispute receipts to explicit terminal recovery states", () => {
    const current = { state: "active" as const, setupPaymentState: "succeeded" as const, subscriptionState: "active" as const, agreementSigned: true };
    expect(reconcileStripeReceipt(current, { eventType: "charge.refunded" })).toMatchObject({ state: "refunded", setupPaymentState: "refunded" });
    expect(reconcileStripeReceipt(current, { eventType: "charge.dispute.created" })).toMatchObject({ state: "disputed", setupPaymentState: "disputed" });
  });
});
