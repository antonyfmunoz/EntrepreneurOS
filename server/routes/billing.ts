import type { Express } from "express";
import { z } from "zod";
import { availableBillingPlans, billingConfigured, createCheckout, createPortal, processStripeWebhook, subscriptionForUser } from "../billing/stripe";
import { teamSeatSummaryForOwner } from "../billing/team-seats";
import { legalStatusForUser } from "../legal/service";

export function registerBillingWebhook(app: Express): void {
  app.post("/api/billing/webhook", async (req, res) => {
    const signature = req.get("stripe-signature");
    if (!signature || !req.rawBody) return res.status(400).json({ code: "invalid_webhook", message: "Signed billing payload required." });
    try {
      const result = await processStripeWebhook(req.rawBody, signature);
      return res.json({ received: true, duplicate: result.duplicate });
    } catch {
      return res.status(400).json({ code: "invalid_webhook", message: "Billing webhook could not be verified or processed." });
    }
  });
}

export function registerBillingRoutes(app: Express): void {
  app.get("/api/billing/status", async (req, res, next) => {
    try {
      const [subscription, teamSeats] = await Promise.all([subscriptionForUser(req.user.id), teamSeatSummaryForOwner(req.user.id)]);
      const configured = billingConfigured();
      return res.json({ configured, availablePlans: configured ? availableBillingPlans() : [], teamSeats, subscription: subscription ? { planKey: subscription.planKey, status: subscription.status, entitlements: subscription.entitlements, seatLimit: subscription.seatLimit, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, currentPeriodEnd: subscription.currentPeriodEnd } : null });
    } catch (error) { return next(error); }
  });
  app.post("/api/billing/checkout", async (req, res, next) => {
    try {
      const { planKey } = z.object({ planKey: z.string().min(1).max(80) }).parse(req.body);
      if (!billingConfigured()) return res.status(503).json({ code: "billing_not_configured", message: "Billing is not available in this environment." });
      const legal = await legalStatusForUser(req.user.id);
      if (legal.enforcement && (!legal.configurationReady || legal.missing.length)) return res.status(409).json({ code: "legal_acceptance_required", message: "Current required legal documents must be published and accepted before starting a paid plan." });
      return res.json({ url: await createCheckout({ id: req.user.id, email: req.user.email }, planKey) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_plan", message: "A valid plan is required." });
      return next(error);
    }
  });
  app.post("/api/billing/portal", async (req, res, next) => {
    try {
      if (!billingConfigured()) return res.status(503).json({ code: "billing_not_configured", message: "Billing is not available in this environment." });
      return res.json({ url: await createPortal(req.user.id) });
    } catch (error) { return next(error); }
  });
}
