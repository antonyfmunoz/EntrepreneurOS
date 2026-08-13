import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { operationalControlEvidenceHistory, operationalControls, serviceOwnership, users, vendorRegistry } from "@shared/schema";
import { db } from "../db";
import { productionReadiness } from "../operations/readiness";
import { platformAdminIds, requirePlatformAdmin } from "../security/platform-admin";
import { dispatchOperationalAlert, operationalAlertsConfigured } from "../observability/alerts";
import { CONTROL_DEFINITIONS, controlEvidenceIsCurrent } from "../operations/control-definitions";
import { serviceOwnershipIssues } from "../operations/ownership";

const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
}, "Secret-free HTTPS URL required");

export function registerOperationalRoutes(app: Express): void {
  app.post("/api/platform/alerts/test", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      if (!operationalAlertsConfigured()) return res.status(503).json({ code: "operational_alerts_unconfigured", message: "The operational alert receiver is not configured." });
      const result = await dispatchOperationalAlert({ event: "operational_alert_test", deduplicationKey: `manual:${randomUUID()}`, severity: "TEST", actorUserId: req.user.id, requestId: req.requestId });
      return res.json({ delivered: result === "sent", result });
    } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.get("/api/platform/readiness", async (req, res, next) => {
    try { requirePlatformAdmin(req.user.id); return res.json(await productionReadiness()); } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.get("/api/platform/controls/:controlKey/evidence", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const controlKey = z.string().regex(/^[a-z0-9_]{3,80}$/).parse(req.params.controlKey);
      if (!CONTROL_DEFINITIONS.has(controlKey)) return res.status(400).json({ code: "unknown_operational_control", message: "The control key is not part of the current production standard." });
      const history = await db.select().from(operationalControlEvidenceHistory).where(eq(operationalControlEvidenceHistory.controlKey, controlKey)).orderBy(desc(operationalControlEvidenceHistory.recordedAt)).limit(100);
      return res.json(history);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_operational_control", message: "The control key is invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.put("/api/platform/controls/:controlKey", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const controlKey = z.string().regex(/^[a-z0-9_]{3,80}$/).parse(req.params.controlKey);
      const definition = CONTROL_DEFINITIONS.get(controlKey);
      if (!definition) return res.status(400).json({ code: "unknown_operational_control", message: "The control key is not part of the current production standard." });
      const input = z.object({ status: z.enum(["pass", "fail"]), evidenceUri: httpsUrl, evidenceHash: z.string().regex(/^[a-f0-9]{64}$/), evidenceScope: z.enum(["repository", "staging", "production", "professional"]), subject: z.string().min(3).max(300), notes: z.string().max(2000).optional(), reviewedAt: z.coerce.date(), expiresAt: z.coerce.date() }).parse(req.body);
      if (!controlEvidenceIsCurrent({ definition, evidenceScope: input.evidenceScope, subject: input.subject, reviewedAt: input.reviewedAt, expiresAt: input.expiresAt, expectedReleaseSubject: process.env.EOS_RELEASE_SUBJECT, expectedEnvironmentSubject: process.env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT })) return res.status(400).json({ code: "invalid_operational_evidence_scope_subject_or_age", message: "Evidence scope, subject, review time, or expiry does not satisfy this control definition." });
      const control = await db.transaction(async (tx) => {
        const [current] = await tx.insert(operationalControls).values({ controlKey, ...input, ownerUserId: req.user.id }).onConflictDoUpdate({ target: operationalControls.controlKey, set: { ...input, ownerUserId: req.user.id, updatedAt: new Date() } }).returning();
        await tx.insert(operationalControlEvidenceHistory).values({ id: randomUUID(), controlKey, ...input, ownerUserId: req.user.id });
        return current;
      });
      return res.json(control);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_operational_control", message: "Control evidence is incomplete or invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.put("/api/platform/vendors/:vendorId", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const id = z.string().regex(/^[a-z0-9_-]{3,80}$/).parse(req.params.vendorId);
      const input = z.object({ name: z.string().min(2).max(120), serviceCategory: z.string().min(2).max(120), riskTier: z.enum(["low", "medium", "high", "critical"]), status: z.enum(["proposed", "approved", "restricted", "retiring", "retired"]), dataClasses: z.array(z.string().max(80)).max(30), dpaStatus: z.enum(["not_required", "pending", "executed", "rejected"]), subprocessorStatus: z.enum(["not_applicable", "pending", "reviewed"]), reviewEvidenceUri: httpsUrl.optional(), exitPlan: z.string().min(10).max(5000), lastReviewedAt: z.coerce.date().optional(), nextReviewAt: z.coerce.date().optional() }).parse(req.body);
      const [vendor] = await db.insert(vendorRegistry).values({ id, ...input, ownerUserId: req.user.id }).onConflictDoUpdate({ target: vendorRegistry.id, set: { ...input, ownerUserId: req.user.id, updatedAt: new Date() } }).returning();
      return res.json(vendor);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_vendor_record", message: "Vendor review data is incomplete or invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.put("/api/platform/services/:serviceKey/ownership", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const serviceKey = z.string().regex(/^[a-z0-9_-]{3,80}$/).parse(req.params.serviceKey);
      const input = z.object({ displayName: z.string().min(2).max(120), backupOwnerUserId: z.string().min(3).max(300), onCallReference: httpsUrl, escalationReference: httpsUrl, availabilityTarget: z.string().min(2).max(120), latencyTarget: z.string().min(2).max(120), errorBudgetPolicy: z.string().min(10).max(3000), incidentRunbookUri: httpsUrl, accessReviewEvidenceUri: httpsUrl, accessReviewedAt: z.coerce.date(), nextAccessReviewAt: z.coerce.date() }).parse(req.body);
      const ownershipIssues = serviceOwnershipIssues({ ownerUserId: req.user.id, ...input }, new Date(), platformAdminIds());
      if (ownershipIssues.length) return res.status(400).json({ code: "invalid_service_ownership_evidence", message: "Service ownership requires a distinct backup owner, current access review, bounded next review, and HTTPS on-call, escalation, runbook, and evidence references.", issues: ownershipIssues });
      const backupOwner = await db.query.users.findFirst({ where: eq(users.id, input.backupOwnerUserId) });
      if (!backupOwner) return res.status(400).json({ code: "backup_service_owner_not_found", message: "The backup service owner must be an existing EntrepreneurOS platform administrator." });
      const [ownership] = await db.insert(serviceOwnership).values({ serviceKey, ...input, ownerUserId: req.user.id }).onConflictDoUpdate({ target: serviceOwnership.serviceKey, set: { ...input, ownerUserId: req.user.id, updatedAt: new Date() } }).returning();
      return res.json(ownership);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_service_ownership", message: "Service ownership data is incomplete or invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });
}
