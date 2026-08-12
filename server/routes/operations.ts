import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import { operationalControls, serviceOwnership, vendorRegistry } from "@shared/schema";
import { db } from "../db";
import { productionReadiness } from "../operations/readiness";
import { requirePlatformAdmin } from "../security/platform-admin";

const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "HTTPS URL required");

export function registerOperationalRoutes(app: Express): void {
  app.get("/api/platform/readiness", async (req, res, next) => {
    try { requirePlatformAdmin(req.user.id); return res.json(await productionReadiness()); } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.put("/api/platform/controls/:controlKey", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const controlKey = z.string().regex(/^[a-z0-9_]{3,80}$/).parse(req.params.controlKey);
      const input = z.object({ status: z.enum(["pass", "fail", "not_applicable"]), evidenceUri: httpsUrl, evidenceHash: z.string().regex(/^[a-f0-9]{64}$/), notes: z.string().max(2000).optional(), reviewedAt: z.coerce.date(), expiresAt: z.coerce.date().optional() }).parse(req.body);
      const [control] = await db.insert(operationalControls).values({ controlKey, ...input, ownerUserId: req.user.id }).onConflictDoUpdate({ target: operationalControls.controlKey, set: { ...input, ownerUserId: req.user.id, updatedAt: new Date() } }).returning();
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
      const input = z.object({ displayName: z.string().min(2).max(120), onCallReference: httpsUrl, availabilityTarget: z.string().min(2).max(120), latencyTarget: z.string().min(2).max(120), errorBudgetPolicy: z.string().min(10).max(3000), incidentRunbookUri: httpsUrl }).parse(req.body);
      const [ownership] = await db.insert(serviceOwnership).values({ serviceKey, ...input, ownerUserId: req.user.id }).onConflictDoUpdate({ target: serviceOwnership.serviceKey, set: { ...input, ownerUserId: req.user.id, updatedAt: new Date() } }).returning();
      return res.json(ownership);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_service_ownership", message: "Service ownership data is incomplete or invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });
}
