import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { eosEsignStorageDrills, operationalControlEvidenceHistory, operationalControls, operationalReadinessActionEvents, operationalReadinessActions, serviceOwnership, users, vendorRegistry } from "@shared/schema";
import { db } from "../db";
import { productionReadiness } from "../operations/readiness";
import { platformAdminIds, requirePlatformAdmin } from "../security/platform-admin";
import { dispatchOperationalAlert, operationalAlertsConfigured } from "../observability/alerts";
import { CONTROL_DEFINITIONS, controlEvidenceIsCurrent } from "../operations/control-definitions";
import { serviceOwnershipIssues } from "../operations/ownership";
import { nativeEsignStorageDrillQualifiesForProduction } from "../esign/storage-drill";
import { readinessActionCandidates } from "../operations/readiness-actions";

const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
}, "Secret-free HTTPS URL required");

const vendorInput = z.object({
  name: z.string().min(2).max(120),
  serviceCategory: z.string().min(2).max(120),
  riskTier: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["proposed", "approved", "restricted", "retiring", "retired"]),
  dataClasses: z.array(z.string().max(80)).max(30),
  dpaStatus: z.enum(["not_required", "pending", "executed", "rejected"]),
  subprocessorStatus: z.enum(["not_applicable", "pending", "reviewed"]),
  reviewEvidenceUri: httpsUrl.optional(),
  exitPlan: z.string().min(10).max(5000),
  lastReviewedAt: z.coerce.date().optional(),
  nextReviewAt: z.coerce.date().optional(),
}).superRefine((value, context) => {
  if (value.status !== "approved") return;
  const now = new Date();
  if (!value.reviewEvidenceUri) context.addIssue({ code: "custom", path: ["reviewEvidenceUri"], message: "Approved vendors require review evidence." });
  if (!value.lastReviewedAt || value.lastReviewedAt > new Date(now.getTime() + 5 * 60_000) || value.lastReviewedAt < new Date(now.getTime() - 365 * 86_400_000)) context.addIssue({ code: "custom", path: ["lastReviewedAt"], message: "Approved vendors require a current review date." });
  if (!value.lastReviewedAt || !value.nextReviewAt || value.nextReviewAt <= now || value.nextReviewAt > new Date(value.lastReviewedAt.getTime() + 365 * 86_400_000)) context.addIssue({ code: "custom", path: ["nextReviewAt"], message: "Approved vendors require a bounded future review." });
  if (!["executed", "not_required"].includes(value.dpaStatus)) context.addIssue({ code: "custom", path: ["dpaStatus"], message: "Approved vendors require a resolved DPA decision." });
  if (!["reviewed", "not_applicable"].includes(value.subprocessorStatus)) context.addIssue({ code: "custom", path: ["subprocessorStatus"], message: "Approved vendors require a resolved subprocessor review." });
});

const readinessActionKey = z.string().regex(/^(control|configuration|vendor|ownership):[a-z0-9_-]{2,120}$/);
const readinessActionState = z.enum(["unassigned", "planned", "in_progress", "waiting_external"]);

async function readinessActionProjection() {
  const readiness = await productionReadiness();
  const candidates = readinessActionCandidates(readiness);
  const candidateMap = new Map(candidates.map((candidate) => [candidate.blockerKey, candidate]));
  const actions = await db.select().from(operationalReadinessActions).orderBy(asc(operationalReadinessActions.layer), asc(operationalReadinessActions.blockerKey));
  const projected = actions.map((action) => ({
    ...action,
    currentBlocker: candidateMap.has(action.blockerKey),
  }));
  return {
    standard: "eos.production-readiness-actions.v1",
    generatedAt: readiness.generatedAt,
    releaseSubject: readiness.releaseSubject,
    environmentSubject: readiness.environmentSubject,
    currentBlockerCount: candidates.length,
    initializedCurrentBlockerCount: projected.filter((action) => action.currentBlocker).length,
    uninitializedBlockerCount: candidates.filter((candidate) => !actions.some((action) => action.blockerKey === candidate.blockerKey)).length,
    actions: projected.sort((left, right) => Number(right.currentBlocker) - Number(left.currentBlocker) || left.layer - right.layer || left.blockerKey.localeCompare(right.blockerKey)),
  };
}

export function registerOperationalRoutes(app: Express): void {
  app.get("/api/platform/capabilities", (req, res) => {
    return res.json({ operationalReadiness: platformAdminIds().has(req.user.id) });
  });

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

  app.get("/api/platform/operators", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const ids = Array.from(platformAdminIds());
      const operators = ids.length ? await db.select({ id: users.id, email: users.email, fullName: users.fullName }).from(users).where(inArray(users.id, ids)).orderBy(asc(users.email)) : [];
      return res.json(operators.map((operator) => ({ ...operator, current: operator.id === req.user.id })));
    } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.get("/api/platform/readiness/actions", async (req, res, next) => {
    try { requirePlatformAdmin(req.user.id); return res.json(await readinessActionProjection()); } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.post("/api/platform/readiness/actions/refresh", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const readiness = await productionReadiness();
      const candidates = readinessActionCandidates(readiness);
      await db.transaction(async (tx) => {
        for (const candidate of candidates) {
          const [inserted] = await tx.insert(operationalReadinessActions).values(candidate).onConflictDoNothing().returning();
          if (inserted) await tx.insert(operationalReadinessActionEvents).values({
            id: randomUUID(),
            blockerKey: candidate.blockerKey,
            eventType: "initialized",
            fromState: null,
            toState: "unassigned",
            ownerUserId: null,
            dueAt: null,
            notes: "Initialized from a currently failing production-readiness predicate; no readiness claim was made.",
            actionVersion: 1,
            actorUserId: req.user.id,
          });
        }
      });
      return res.json(await readinessActionProjection());
    } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.get("/api/platform/readiness/actions/:blockerKey/events", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const blockerKey = readinessActionKey.parse(req.params.blockerKey);
      return res.json(await db.select().from(operationalReadinessActionEvents).where(eq(operationalReadinessActionEvents.blockerKey, blockerKey)).orderBy(desc(operationalReadinessActionEvents.createdAt)).limit(100));
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_readiness_action", message: "The readiness action key is invalid." }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.put("/api/platform/readiness/actions/:blockerKey", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const blockerKey = readinessActionKey.parse(req.params.blockerKey);
      const input = z.object({
        expectedVersion: z.number().int().positive(),
        operatorState: readinessActionState,
        ownerUserId: z.string().min(3).max(300).nullable(),
        dueAt: z.coerce.date().nullable(),
        notes: z.string().max(2000),
      }).parse(req.body);
      const [current] = await db.select().from(operationalReadinessActions).where(eq(operationalReadinessActions.blockerKey, blockerKey)).limit(1);
      if (!current) return res.status(404).json({ code: "readiness_action_not_found", message: "Refresh the readiness queue before assigning this blocker." });
      if (input.operatorState === "unassigned") {
        if (input.ownerUserId || input.dueAt) return res.status(400).json({ code: "invalid_unassigned_readiness_action", message: "An unassigned action cannot retain an owner or due date." });
      } else {
        const now = new Date();
        if (!input.ownerUserId || !input.dueAt || input.dueAt <= now || input.dueAt > new Date(now.getTime() + 366 * 86_400_000)) return res.status(400).json({ code: "incomplete_readiness_action_plan", message: "Planned work requires a configured platform administrator and a future due date within one year." });
        if (!platformAdminIds().has(input.ownerUserId)) return res.status(400).json({ code: "readiness_action_owner_not_platform_admin", message: "The readiness owner must be a configured platform administrator." });
        if (!(await db.query.users.findFirst({ where: eq(users.id, input.ownerUserId) }))) return res.status(400).json({ code: "readiness_action_owner_not_found", message: "The readiness owner must be an existing user." });
        if (input.operatorState === "waiting_external" && input.notes.trim().length < 10) return res.status(400).json({ code: "readiness_external_dependency_missing", message: "Waiting-external work requires a specific dependency note." });
      }
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx.update(operationalReadinessActions).set({ operatorState: input.operatorState, ownerUserId: input.ownerUserId, dueAt: input.dueAt, notes: input.notes.trim(), version: current.version + 1, updatedAt: new Date() }).where(and(eq(operationalReadinessActions.blockerKey, blockerKey), eq(operationalReadinessActions.version, input.expectedVersion))).returning();
        if (!changed[0]) return [];
        await tx.insert(operationalReadinessActionEvents).values({ id: randomUUID(), blockerKey, eventType: "updated", fromState: current.operatorState, toState: input.operatorState, ownerUserId: input.ownerUserId, dueAt: input.dueAt, notes: input.notes.trim(), actionVersion: changed[0].version, actorUserId: req.user.id });
        return changed;
      });
      if (!updated) return res.status(409).json({ code: "readiness_action_version_conflict", message: "The readiness action changed before this plan was saved." });
      return res.json(updated);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_readiness_action", message: "The readiness action plan is incomplete or invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
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
      if (controlKey === "native_esign_storage_recovery_drill" && input.status === "pass") {
        const [drill] = await db.select().from(eosEsignStorageDrills)
          .where(eq(eosEsignStorageDrills.receiptSha256, input.evidenceHash)).limit(1);
        if (!nativeEsignStorageDrillQualifiesForProduction(drill, input.reviewedAt))
          return res.status(400).json({
            code: "native_esign_storage_drill_not_production_qualified",
            message: "A passing production control requires a current immutable receipt from distinct reachable S3 planes with KMS, default encryption, versioning, default object retention, lifecycle policy, verified loss simulation, restore, and cleanup.",
          });
      }
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
      const input = vendorInput.parse(req.body);
      const [vendor] = await db.insert(vendorRegistry).values({ id, ...input, ownerUserId: req.user.id }).onConflictDoUpdate({ target: vendorRegistry.id, set: { ...input, ownerUserId: req.user.id, updatedAt: new Date() } }).returning();
      return res.json(vendor);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_vendor_record", message: "Vendor review data is incomplete or invalid.", issues: error.issues }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.get("/api/platform/vendors", async (req, res, next) => {
    try { requirePlatformAdmin(req.user.id); return res.json(await db.select().from(vendorRegistry).orderBy(asc(vendorRegistry.name))); } catch (error) { const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
  });

  app.get("/api/platform/services/:serviceKey/ownership", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const serviceKey = z.string().regex(/^[a-z0-9_-]{3,80}$/).parse(req.params.serviceKey);
      return res.json((await db.select().from(serviceOwnership).where(eq(serviceOwnership.serviceKey, serviceKey)).limit(1))[0] || null);
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_service_ownership", message: "The service key is invalid." }); const status = (error as any).status; if (status) return res.status(status).json({ code: (error as any).code, message: (error as Error).message }); return next(error); }
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
