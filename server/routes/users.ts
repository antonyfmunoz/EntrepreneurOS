import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  billingSubscriptions,
  companies,
  eosAuditRecords,
  eosCommunicationMessages,
  eosMemberships,
  oauthTokens,
  portfolios,
  supportTickets,
  users,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { cancelAccountDeletion, deletionRequestForUser, scheduleAccountDeletion } from "../lifecycle/account-deletion";
import { PRODUCT_ANALYTICS_POLICY_VERSION } from "@shared/product-analytics";

const profileUpdateSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[a-z0-9_]+$/).optional(),
  fullName: z.string().trim().min(1).max(120).optional(),
}).strict();

function publicUser(user: typeof users.$inferSelect) {
  const { password: _password, metadata: _metadata, ...safe } = user;
  let preferences: unknown = {};
  try { preferences = safe.preferences ? JSON.parse(safe.preferences) : {}; } catch {}
  return { ...safe, avatarUrl: safe.avatar, preferences };
}

export function registerUserRoutes(app: Express): void {
  app.get("/api/users/me", (req, res) => res.json(publicUser(req.user)));

  app.put("/api/users/me", async (req, res, next) => {
    try {
      const update = profileUpdateSchema.parse(req.body);
      const user = await storage.updateUser(req.user.id, update);
      return res.json(publicUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_profile", message: "Check the profile fields and try again.", issues: error.issues });
      return next(error);
    }
  });

  app.put("/api/users/me/notifications", (_req, res) => {
    return res.status(410).json({
      code: "notification_delivery_not_configurable",
      message: "Delivery preferences are unavailable until EOS has an enforced outbound notification service. In-app notifications remain available from the header.",
    });
  });

  app.get("/api/users/me/analytics-consent", async (req, res, next) => {
    try {
    const persisted = await storage.getUser(req.user.id);
    if (!persisted) return res.status(404).json({ code: "user_not_found", message: "Account not found." });
    let preferences: Record<string, any> = {};
    try { preferences = persisted.preferences ? JSON.parse(persisted.preferences) : {}; } catch {}
    const analytics = preferences.analytics || {};
    return res.json({ consent: analytics.policyVersion === PRODUCT_ANALYTICS_POLICY_VERSION ? analytics.consent ?? null : null, decidedAt: analytics.decidedAt || null, policyVersion: PRODUCT_ANALYTICS_POLICY_VERSION });
    } catch (error) { return next(error); }
  });

  app.put("/api/users/me/analytics-consent", async (req, res, next) => {
    try {
      const { consent } = z.object({ consent: z.boolean() }).parse(req.body);
      let existing: Record<string, unknown> = {};
      const persisted = await storage.getUser(req.user.id);
      try { existing = persisted?.preferences ? JSON.parse(persisted.preferences) : {}; } catch {}
      const analytics = { consent, decidedAt: new Date().toISOString(), policyVersion: PRODUCT_ANALYTICS_POLICY_VERSION };
      await storage.updateUser(req.user.id, { preferences: { ...existing, analytics } });
      return res.json(analytics);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_analytics_consent", message: "Choose whether optional product analytics are allowed." });
      return next(error);
    }
  });

  app.get("/api/users/me/export", async (req, res, next) => {
    try {
      const userId = req.user.id;
      const [ownedPortfolios, ownedCompanies, memberships, sentMessages, audit, tickets, subscription, providers] = await Promise.all([
        db.select().from(portfolios).where(eq(portfolios.ownerId, userId)),
        db.select().from(companies).where(eq(companies.ownerUserId, userId)),
        db.select().from(eosMemberships).where(eq(eosMemberships.userId, userId)),
        db.select().from(eosCommunicationMessages).where(eq(eosCommunicationMessages.senderUserId, userId)).orderBy(desc(eosCommunicationMessages.createdAt)),
        db.select().from(eosAuditRecords).where(eq(eosAuditRecords.actorUserId, userId)).orderBy(desc(eosAuditRecords.createdAt)),
        db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)),
        db.select({ planKey: billingSubscriptions.planKey, status: billingSubscriptions.status, entitlements: billingSubscriptions.entitlements, currentPeriodEnd: billingSubscriptions.currentPeriodEnd }).from(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)).limit(1),
        db.select({ provider: oauthTokens.provider, scope: oauthTokens.scope, expiresAt: oauthTokens.expiresAt, createdAt: oauthTokens.createdAt, updatedAt: oauthTokens.updatedAt }).from(oauthTokens).where(eq(oauthTokens.userId, userId)),
      ]);
      const exportedAt = new Date().toISOString();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="entrepreneuros-account-export-${exportedAt.slice(0, 10)}.json"`);
      return res.json({ format: "entrepreneuros.account-export.v1", exportedAt, account: publicUser(req.user), ownedPortfolios, ownedCompanies, memberships, sentMessages, auditRecords: audit, supportTickets: tickets, billing: subscription[0] || null, connectedProviders: providers });
    } catch (error) { return next(error); }
  });

  app.get("/api/users/me/deletion", async (req, res, next) => {
    try {
      const request = await deletionRequestForUser(req.user.id);
      return res.json(request ? { status: request.status, scheduledFor: request.scheduledFor, requestedAt: request.requestedAt, deleteOwnedOrganizations: request.deleteOwnedOrganizations, lastError: request.lastError } : null);
    } catch (error) { return next(error); }
  });

  app.post("/api/users/me/deletion", async (req, res, next) => {
    try {
      const input = z.object({ confirmation: z.literal("DELETE MY ENTREPRENEUROS ACCOUNT"), deleteOwnedOrganizations: z.literal(false) }).parse(req.body);
      const request = await scheduleAccountDeletion({ userId: req.user.id, clerkUserId: req.user.clerkUserId, deleteOwnedOrganizations: input.deleteOwnedOrganizations });
      return res.status(202).json({ status: request.status, scheduledFor: request.scheduledFor, deleteOwnedOrganizations: request.deleteOwnedOrganizations });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "deletion_confirmation_required", message: "Type the exact confirmation phrase. Owned organizations must be transferred before deletion can execute." });
      return next(error);
    }
  });

  app.delete("/api/users/me/deletion", async (req, res, next) => {
    try {
      const request = await cancelAccountDeletion(req.user.id);
      if (!request) return res.status(409).json({ code: "deletion_not_cancellable", message: "No scheduled deletion can be cancelled." });
      return res.json({ status: request.status, cancelledAt: request.cancelledAt });
    } catch (error) { return next(error); }
  });
}
