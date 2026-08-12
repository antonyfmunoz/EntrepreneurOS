import { createHash, randomBytes, randomUUID } from "node:crypto";
import Stripe from "stripe";
import { and, desc, eq } from "drizzle-orm";
import { billingSubscriptions, billingWebhookEvents } from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";

type PlanConfig = Record<string, { priceId: string; entitlements: string[] }>;

function planConfig(): PlanConfig {
  try {
    const parsed = JSON.parse(process.env.EOS_STRIPE_PLANS || "{}") as PlanConfig;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value?.priceId?.startsWith("price_") && Array.isArray(value.entitlements)));
  } catch {
    return {};
  }
}

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_RESTRICTED_KEY?.startsWith("rk_") && process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") && Object.keys(planConfig()).length);
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_RESTRICTED_KEY;
  if (!key?.startsWith("rk_")) throw new Error("Stripe billing requires a restricted server key.");
  return new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
}

function publicOrigin(): string {
  const value = process.env.EOS_PUBLIC_ORIGIN || "";
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("EOS_PUBLIC_ORIGIN must use HTTPS in production.");
  return url.origin;
}

export async function subscriptionForUser(userId: string) {
  return (await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)).orderBy(desc(billingSubscriptions.updatedAt)).limit(1))[0] || null;
}

export async function hasEntitlement(userId: string, entitlement: string): Promise<boolean> {
  if (process.env.EOS_BILLING_ENFORCEMENT !== "true") return true;
  const subscription = await subscriptionForUser(userId);
  if (!subscription || !["active", "trialing"].includes(subscription.status)) return false;
  return Array.isArray(subscription.entitlements) && subscription.entitlements.includes(entitlement);
}

export async function createCheckout(user: { id: string; email: string }, planKey: string): Promise<string> {
  const plan = planConfig()[planKey];
  if (!plan) throw new Error("Unknown or unavailable billing plan.");
  const stripe = stripeClient();
  const existing = await subscriptionForUser(user.id);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existing?.providerCustomerId || undefined,
    customer_email: existing ? undefined : user.email,
    client_reference_id: user.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    metadata: { eosUserId: user.id, planKey },
    subscription_data: { metadata: { eosUserId: user.id, planKey } },
    success_url: `${publicOrigin()}/settings?billing=success`,
    cancel_url: `${publicOrigin()}/settings?billing=cancelled`,
    integration_identifier: `eos_${randomBytes(4).toString("hex")}`,
  });
  if (!session.url) throw new Error("Billing provider did not return a checkout URL.");
  return session.url;
}

export async function createPortal(userId: string): Promise<string> {
  const subscription = await subscriptionForUser(userId);
  if (!subscription) throw new Error("No billing account is available for this user.");
  const session = await stripeClient().billingPortal.sessions.create({ customer: subscription.providerCustomerId, return_url: `${publicOrigin()}/settings` });
  return session.url;
}

async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.eosUserId;
  const planKey = subscription.metadata.planKey;
  const plan = planConfig()[planKey];
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (!userId || !planKey || !plan) throw new Error("Subscription metadata does not map to an EOS user and configured plan.");
  const periodEnd = subscription.items.data.reduce((latest, item) => Math.max(latest, item.current_period_end || 0), 0);
  await db.insert(billingSubscriptions).values({
    id: `billing_${randomUUID()}`,
    userId,
    providerCustomerId: customerId,
    providerSubscriptionId: subscription.id,
    planKey,
    status: subscription.status,
    entitlements: plan.entitlements,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  }).onConflictDoUpdate({
    target: billingSubscriptions.providerSubscriptionId,
    set: { status: subscription.status, planKey, entitlements: plan.entitlements, cancelAtPeriodEnd: subscription.cancel_at_period_end, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, updatedAt: new Date() },
  });
}

export async function processStripeWebhook(rawBody: Buffer, signature: string): Promise<{ duplicate: boolean; eventType: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_")) throw new Error("Stripe webhook verification is not configured.");
  const event = stripeClient().webhooks.constructEvent(rawBody, signature, secret);
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const claimed = await db.insert(billingWebhookEvents).values({ id: event.id, eventType: event.type, payloadHash }).onConflictDoNothing().returning({ id: billingWebhookEvents.id });
  if (!claimed.length) return { duplicate: true, eventType: event.type };
  try {
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await applySubscription(event.data.object as Stripe.Subscription);
    }
    writeLog("info", "billing_webhook_processed", { eventId: event.id, eventType: event.type });
    return { duplicate: false, eventType: event.type };
  } catch (error) {
    await db.delete(billingWebhookEvents).where(and(eq(billingWebhookEvents.id, event.id), eq(billingWebhookEvents.payloadHash, payloadHash)));
    throw error;
  }
}
