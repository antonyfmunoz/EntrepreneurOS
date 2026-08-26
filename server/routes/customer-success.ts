import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords,
  eosCustomerHealthReviews,
  eosCustomerSuccessAccounts,
  eosCustomerSuccessEvents,
  eosCustomerSuccessIssues,
  eosCustomerSuccessOutcomes,
  eosCustomerSuccessReports,
  eosEsignEnvelopes,
  eosEvidence,
  eosSeats,
  eosStakeholderRelationships,
  eosStakeholders,
  eosWorkPackets,
} from "@shared/schema";
import {
  customerHealthReviewSchema,
  customerIssueDraftSchema,
  customerIssueResolutionSchema,
  customerOutcomeDraftSchema,
  customerOutcomeProgressSchema,
  customerRenewalDecisionSchema,
  customerReportApprovalSchema,
  customerReportDeliverySchema,
  customerReportPreparationSchema,
  customerSuccessAccountSchema,
  deriveCustomerHealth,
  lifecycleForRenewalIntent,
} from "@shared/customer-success";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification, visibleSeatIds } from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "customer_success_input_invalid", message: error.issues[0]?.message || "Customer-success input is invalid." });
      next(error);
    }
  };
}

async function customerSuccessAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("operations")) throw new EosRouteError(403, "customer_success_scope_denied", "Customer success is outside this role's compiled Operations workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass, resource: "customer_success_account", actionKey,
    purpose: authorityClass === "view" ? "inspect_customer_success_state" : "operate_customer_success_state",
    classification, consequence: authorityClass === "decide" ? "material" : "routine", targetSeatId: access.seat.id,
  });
  return { access, policy };
}

async function verifiedVisibleEvidence(companyId: number, ids: string[], access: Awaited<ReturnType<typeof companyAccess>>) {
  const unique = Array.from(new Set(ids));
  if (!unique.length || unique.length !== ids.length) throw new EosRouteError(409, "customer_success_evidence_invalid", "Evidence references must be unique and non-empty.");
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const rows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence)
    .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
    .where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, unique)));
  const allowed = rows.filter(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
  if (allowed.length !== unique.length) throw new EosRouteError(409, "customer_success_evidence_invalid", "Every Evidence item must be verified and visible in this company, hierarchy, and classification scope.");
  return allowed.map(({ evidence }) => evidence);
}

async function visibleAccount(companyId: number, accountId: string, access: Awaited<ReturnType<typeof companyAccess>>) {
  const account = await db.query.eosCustomerSuccessAccounts.findFirst({ where: and(eq(eosCustomerSuccessAccounts.id, accountId), eq(eosCustomerSuccessAccounts.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!account || !visible.has(account.ownerSeatId) || !mayAccessClassification(access, account.classification)) throw new EosRouteError(404, "customer_success_account_not_found", "Customer-success account not found in this authority scope.");
  return account;
}

function auditRecord(companyId: number, userId: string, action: string, targetType: string, targetId: string, result: string, details: Record<string, unknown>) {
  return { id: randomUUID(), companyId, actorUserId: userId, action, targetType, targetId, traceId: randomUUID(), correlationId: randomUUID(), result, details };
}

async function appendEvent(tx: any, values: {
  companyId: number; accountId: string; eventType: string; subjectType: "account" | "outcome" | "issue" | "report"; subjectId: string;
  accountVersionBefore: number; accountVersionAfter: number; subjectVersionBefore: number; subjectVersionAfter: number;
  evidenceIds: string[]; payload: Record<string, unknown>; policyDecisionId: string; recordedByUserId: string; recordedAt: Date;
}) {
  const [previous] = await tx.select().from(eosCustomerSuccessEvents).where(eq(eosCustomerSuccessEvents.accountId, values.accountId)).orderBy(desc(eosCustomerSuccessEvents.recordedAt)).limit(1);
  const id = randomUUID();
  const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = nativeContractContentSha256({ schemaVersion: "eos-customer-success-event.v1", id, previousEventSha256, ...values, recordedAt: values.recordedAt.toISOString() });
  const [event] = await tx.insert(eosCustomerSuccessEvents).values({ id, previousEventSha256, eventSha256, ...values }).returning();
  return event;
}

function requireFutureDate(value: string, field: string) {
  if (value <= new Date().toISOString().slice(0, 10)) throw new EosRouteError(409, "customer_success_review_date_invalid", `${field} must be after today.`);
}

export function registerCustomerSuccessRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/customer-success", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const { access } = await customerSuccessAccess(req, "view", "customer_success.state.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const [accounts, stakeholders, relationships, outcomes, issues, reports, events, healthReviews, evidenceRows, seats] = await Promise.all([
      db.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.companyId, companyId)).orderBy(desc(eosCustomerSuccessAccounts.updatedAt)),
      db.select().from(eosStakeholders).where(eq(eosStakeholders.companyId, companyId)).orderBy(eosStakeholders.name),
      db.select().from(eosStakeholderRelationships).where(eq(eosStakeholderRelationships.companyId, companyId)).orderBy(eosStakeholderRelationships.title),
      db.select().from(eosCustomerSuccessOutcomes).where(eq(eosCustomerSuccessOutcomes.companyId, companyId)).orderBy(desc(eosCustomerSuccessOutcomes.updatedAt)),
      db.select().from(eosCustomerSuccessIssues).where(eq(eosCustomerSuccessIssues.companyId, companyId)).orderBy(desc(eosCustomerSuccessIssues.updatedAt)),
      db.select().from(eosCustomerSuccessReports).where(eq(eosCustomerSuccessReports.companyId, companyId)).orderBy(desc(eosCustomerSuccessReports.preparedAt)),
      db.select().from(eosCustomerSuccessEvents).where(eq(eosCustomerSuccessEvents.companyId, companyId)).orderBy(desc(eosCustomerSuccessEvents.recordedAt)),
      db.select().from(eosCustomerHealthReviews).where(eq(eosCustomerHealthReviews.companyId, companyId)).orderBy(desc(eosCustomerHealthReviews.reviewedAt)),
      db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified"))),
      db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active"))).orderBy(eosSeats.title),
    ]);
    const visibleStakeholders = stakeholders.filter((item) => visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification));
    const stakeholderIds = new Set(visibleStakeholders.map((item) => item.id));
    const visibleRelationships = relationships.filter((item) => stakeholderIds.has(item.stakeholderId) && visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification));
    const relationshipIds = new Set(visibleRelationships.map((item) => item.id));
    const visibleAccounts = accounts.filter((item) => visible.has(item.ownerSeatId) && stakeholderIds.has(item.stakeholderId) && relationshipIds.has(item.relationshipId) && mayAccessClassification(access, item.classification));
    const accountIds = new Set(visibleAccounts.map((item) => item.id));
    const visibleEvidence = evidenceRows.filter(({ evidence, packet }) => mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    const existingStakeholders = new Set(accounts.map((item) => item.stakeholderId));
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      generatedAt: new Date().toISOString(), accounts: visibleAccounts.map((item) => ({ ...item, customerName: visibleStakeholders.find((stakeholder) => stakeholder.id === item.stakeholderId)?.name || "Customer", relationshipTitle: visibleRelationships.find((relationship) => relationship.id === item.relationshipId)?.title || "Customer relationship", reviewOverdue: item.nextReviewAt <= today })),
      outcomes: outcomes.filter((item) => accountIds.has(item.accountId) && visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)),
      issues: issues.filter((item) => accountIds.has(item.accountId) && visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)),
      reports: reports.filter((item) => accountIds.has(item.accountId) && mayAccessClassification(access, item.classification)),
      events: events.filter((item) => accountIds.has(item.accountId)), healthReviews: healthReviews.filter((item) => accountIds.has(item.accountId)),
      evidence: visibleEvidence.map(({ evidence }) => ({ id: evidence.id, title: evidence.title, evidenceType: evidence.evidenceType, dataClassification: evidence.dataClassification })),
      seats: seats.filter((seat) => visible.has(seat.id)).map((seat) => ({ id: seat.id, title: seat.title, kind: seat.kind })),
      eligibleCustomers: visibleRelationships.filter((item) => item.relationshipType === "customer" && item.state === "active" && !existingStakeholders.has(item.stakeholderId)).map((relationship) => ({ relationship, stakeholder: visibleStakeholders.find((item) => item.id === relationship.stakeholderId) })).filter((item) => item.stakeholder),
      counts: { accounts: visibleAccounts.length, healthy: visibleAccounts.filter((item) => item.healthState === "healthy").length, atRisk: visibleAccounts.filter((item) => ["at_risk", "critical"].includes(item.healthState)).length, overdueReviews: visibleAccounts.filter((item) => item.nextReviewAt <= today).length, openIssues: issues.filter((item) => accountIds.has(item.accountId) && item.state === "open").length, renewalReviews: visibleAccounts.filter((item) => item.lifecycleState === "renewal_review").length },
      boundary: "EOS preserves evidence-backed customer-success and provider-receipt state. It does not infer customer consent, independently prove attribution, deliver a report, or renew a contract without separate authority and external evidence.",
    });
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerSuccessAccountSchema.parse(req.body); requireFutureDate(input.nextReviewAt, "Next review");
    const { access, policy } = await customerSuccessAccess(req, "execute", "customer_success.account.create", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "The account classification exceeds this seat's disclosure ceiling.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!visible.has(input.ownerSeatId)) throw new EosRouteError(403, "customer_success_owner_scope_denied", "The account owner is outside this operator's visible hierarchy.");
    const [stakeholder, relationship] = await Promise.all([
      db.query.eosStakeholders.findFirst({ where: and(eq(eosStakeholders.id, input.stakeholderId), eq(eosStakeholders.companyId, companyId)) }),
      db.query.eosStakeholderRelationships.findFirst({ where: and(eq(eosStakeholderRelationships.id, input.relationshipId), eq(eosStakeholderRelationships.companyId, companyId)) }),
    ]);
    if (!stakeholder || !relationship || relationship.stakeholderId !== stakeholder.id || relationship.relationshipType !== "customer" || relationship.state !== "active" || !visible.has(stakeholder.ownerSeatId) || !visible.has(relationship.ownerSeatId)) throw new EosRouteError(409, "customer_success_customer_invalid", "Select one visible active canonical customer relationship.");
    let contractEnvelopeId: string | null = null;
    if (input.contractEnvelopeId) {
      const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, input.contractEnvelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
      if (!envelope || envelope.state !== "completed") throw new EosRouteError(409, "customer_success_contract_invalid", "An optional contract link must reference a completed company-local envelope.");
      contractEnvelopeId = envelope.id;
    }
    const now = new Date(); const id = randomUUID();
    const account = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success:${companyId}:${stakeholder.id}`}))`);
      const [existing] = await tx.select().from(eosCustomerSuccessAccounts).where(and(eq(eosCustomerSuccessAccounts.companyId, companyId), eq(eosCustomerSuccessAccounts.stakeholderId, stakeholder.id))).limit(1);
      if (existing) throw new EosRouteError(409, "customer_success_account_exists", "This canonical customer already has a customer-success account.");
      const [created] = await tx.insert(eosCustomerSuccessAccounts).values({ id, companyId, stakeholderId: stakeholder.id, relationshipId: relationship.id, contractEnvelopeId, ownerSeatId: input.ownerSeatId, reviewCadenceDays: input.reviewCadenceDays, nextReviewAt: input.nextReviewAt, renewalAt: input.renewalAt || null, successDefinition: input.successDefinition, classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, accountId: id, eventType: "account_created", subjectType: "account", subjectId: id, accountVersionBefore: 0, accountVersionAfter: 1, subjectVersionBefore: 0, subjectVersionAfter: 1, evidenceIds: [], payload: { stakeholderId: stakeholder.id, relationshipId: relationship.id, contractEnvelopeId, successDefinition: input.successDefinition }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.account.created", "customer_success_account", id, "active", { stakeholderId: stakeholder.id, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId }));
      return created;
    });
    res.status(201).json(account);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/health-reviews", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerHealthReviewSchema.parse(req.body); requireFutureDate(input.nextReviewAt, "Next review");
    const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = await verifiedVisibleEvidence(companyId, input.evidenceIds, accessResult);
    const { policy } = await customerSuccessAccess(req, "execute", "customer_success.health.review", account.classification); const health = deriveCustomerHealth(input); const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`);
      const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1);
      if (!current || current.version !== input.expectedVersion) throw new EosRouteError(409, "customer_success_version_conflict", "The account changed before this health review. Refresh and review again.");
      const reviewId = randomUUID(); const nextVersion = current.version + 1;
      const reviewSha256 = nativeContractContentSha256({ schemaVersion: "eos-customer-health-review.v1", reviewId, companyId, accountId: current.id, accountVersion: current.version, health, input, evidenceIds: evidence.map((item) => item.id), reviewedAt: now.toISOString() });
      const [review] = await tx.insert(eosCustomerHealthReviews).values({ id: reviewId, companyId, accountId: current.id, accountVersion: current.version, deliveryScore: input.deliveryScore, outcomeScore: input.outcomeScore, adoptionScore: input.adoptionScore, relationshipScore: input.relationshipScore, riskScore: input.riskScore, healthScore: health.score, healthState: health.state, evidenceIds: evidence.map((item) => item.id), summary: input.summary, nextActions: input.nextActions, nextReviewAt: input.nextReviewAt, policyDecisionId: policy.decisionId, reviewSha256, reviewedByUserId: req.user.id, reviewedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "health_review_recorded", subjectType: "account", subjectId: current.id, accountVersionBefore: current.version, accountVersionAfter: nextVersion, subjectVersionBefore: current.version, subjectVersionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { reviewId, healthScore: health.score, healthState: health.state, dimensions: { delivery: input.deliveryScore, outcome: input.outcomeScore, adoption: input.adoptionScore, relationship: input.relationshipScore, risk: input.riskScore }, summary: input.summary, nextActions: input.nextActions, nextReviewAt: input.nextReviewAt }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosCustomerSuccessAccounts).set({ healthScore: health.score, healthState: health.state, nextReviewAt: input.nextReviewAt, version: nextVersion, lastEventId: event.id, lastHealthReviewId: review.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.health.reviewed", "customer_success_account", current.id, health.state, { reviewId, reviewSha256, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updated, review, event };
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/outcomes", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerOutcomeDraftSchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult);
    const visible = await visibleSeatIds(companyId, accessResult.seat.id, accessResult.role); if (!visible.has(input.ownerSeatId) || !mayAccessClassification(accessResult, input.classification)) throw new EosRouteError(403, "customer_success_owner_scope_denied", "The outcome owner or classification is outside this authority scope.");
    const { policy } = await customerSuccessAccess(req, "execute", "customer_success.outcome.create", input.classification); const now = new Date(); const id = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1);
      if (!current || current.version !== input.expectedAccountVersion) throw new EosRouteError(409, "customer_success_version_conflict", "The account changed before outcome creation.");
      const definitionSha256 = nativeContractContentSha256({ schemaVersion: "eos-customer-outcome.v1", companyId, accountId: current.id, ...input, expectedAccountVersion: undefined });
      const [outcome] = await tx.insert(eosCustomerSuccessOutcomes).values({ id, companyId, accountId: current.id, outcomeKey: input.outcomeKey, title: input.title, definition: input.definition, baselineValue: input.baselineValue, targetValue: input.targetValue, unit: input.unit, dueAt: input.dueAt, attributionModel: input.attributionModel, attributionRationale: input.attributionRationale, ownerSeatId: input.ownerSeatId, classification: input.classification, definitionSha256, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "outcome_created", subjectType: "outcome", subjectId: id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: 0, subjectVersionAfter: 1, evidenceIds: [], payload: { definitionSha256, outcomeKey: input.outcomeKey, attributionModel: input.attributionModel }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.outcome.created", "customer_outcome", id, "tracking", { accountId: current.id, definitionSha256, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updated, outcome, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/outcomes/:outcomeId/progress", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerOutcomeProgressSchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = await verifiedVisibleEvidence(companyId, input.evidenceIds, accessResult);
    const outcome = await db.query.eosCustomerSuccessOutcomes.findFirst({ where: and(eq(eosCustomerSuccessOutcomes.id, req.params.outcomeId), eq(eosCustomerSuccessOutcomes.accountId, account.id), eq(eosCustomerSuccessOutcomes.companyId, companyId)) }); if (!outcome || !mayAccessClassification(accessResult, outcome.classification)) throw new EosRouteError(404, "customer_success_outcome_not_found", "Outcome unavailable in this authority scope.");
    const authority = ["achieved", "not_achieved", "abandoned"].includes(input.state) ? "decide" : "execute"; const { policy } = await customerSuccessAccess(req, authority, "customer_success.outcome.progress", outcome.classification); const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); const [currentOutcome] = await tx.select().from(eosCustomerSuccessOutcomes).where(eq(eosCustomerSuccessOutcomes.id, outcome.id)).limit(1);
      if (!current || !currentOutcome || current.version !== input.expectedAccountVersion || currentOutcome.version !== input.expectedVersion) throw new EosRouteError(409, "customer_success_version_conflict", "The account or outcome changed before progress was recorded.");
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "outcome_progress_recorded", subjectType: "outcome", subjectId: currentOutcome.id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: currentOutcome.version, subjectVersionAfter: currentOutcome.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { stateBefore: currentOutcome.state, stateAfter: input.state, actualValue: input.actualValue, note: input.note }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updatedOutcome] = await tx.update(eosCustomerSuccessOutcomes).set({ state: input.state, actualValue: input.actualValue, evidenceIds: evidence.map((item) => item.id), version: currentOutcome.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessOutcomes.id, currentOutcome.id), eq(eosCustomerSuccessOutcomes.version, currentOutcome.version))).returning();
      const [updatedAccount] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.outcome.progressed", "customer_outcome", currentOutcome.id, input.state, { eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updatedAccount, outcome: updatedOutcome, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/issues", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerIssueDraftSchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = input.evidenceIds.length ? await verifiedVisibleEvidence(companyId, input.evidenceIds, accessResult) : [];
    const visible = await visibleSeatIds(companyId, accessResult.seat.id, accessResult.role); if (!visible.has(input.ownerSeatId) || !mayAccessClassification(accessResult, input.classification)) throw new EosRouteError(403, "customer_success_owner_scope_denied", "The issue owner or classification is outside this authority scope.");
    const { policy } = await customerSuccessAccess(req, "execute", "customer_success.issue.open", input.classification); const now = new Date(); const id = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); if (!current || current.version !== input.expectedAccountVersion) throw new EosRouteError(409, "customer_success_version_conflict", "The account changed before issue creation.");
      const definitionSha256 = nativeContractContentSha256({ schemaVersion: "eos-customer-issue.v1", companyId, accountId: current.id, ...input, expectedAccountVersion: undefined, evidenceIds: evidence.map((item) => item.id) });
      const [issue] = await tx.insert(eosCustomerSuccessIssues).values({ id, companyId, accountId: current.id, issueKey: input.issueKey, title: input.title, severity: input.severity, summary: input.summary, ownerSeatId: input.ownerSeatId, dueAt: input.dueAt, evidenceIds: evidence.map((item) => item.id), classification: input.classification, definitionSha256, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "issue_opened", subjectType: "issue", subjectId: id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: 0, subjectVersionAfter: 1, evidenceIds: evidence.map((item) => item.id), payload: { definitionSha256, issueKey: input.issueKey, severity: input.severity }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.issue.opened", "customer_issue", id, "open", { severity: input.severity, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updated, issue, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/issues/:issueId/resolve", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerIssueResolutionSchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = await verifiedVisibleEvidence(companyId, input.evidenceIds, accessResult);
    const issue = await db.query.eosCustomerSuccessIssues.findFirst({ where: and(eq(eosCustomerSuccessIssues.id, req.params.issueId), eq(eosCustomerSuccessIssues.accountId, account.id), eq(eosCustomerSuccessIssues.companyId, companyId)) }); if (!issue || issue.state !== "open" || !mayAccessClassification(accessResult, issue.classification)) throw new EosRouteError(404, "customer_success_issue_not_found", "Open issue unavailable in this authority scope.");
    const { policy } = await customerSuccessAccess(req, "execute", "customer_success.issue.resolve", issue.classification); const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); const [currentIssue] = await tx.select().from(eosCustomerSuccessIssues).where(eq(eosCustomerSuccessIssues.id, issue.id)).limit(1);
      if (!current || !currentIssue || current.version !== input.expectedAccountVersion || currentIssue.version !== input.expectedVersion || currentIssue.state !== "open") throw new EosRouteError(409, "customer_success_version_conflict", "The account or issue changed before resolution.");
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "issue_resolved", subjectType: "issue", subjectId: currentIssue.id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: currentIssue.version, subjectVersionAfter: currentIssue.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { severity: currentIssue.severity, resolution: input.resolution }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updatedIssue] = await tx.update(eosCustomerSuccessIssues).set({ state: "resolved", resolution: input.resolution, evidenceIds: evidence.map((item) => item.id), version: currentIssue.version + 1, lastEventId: event.id, resolvedAt: now, updatedAt: now }).where(and(eq(eosCustomerSuccessIssues.id, currentIssue.id), eq(eosCustomerSuccessIssues.version, currentIssue.version))).returning(); const [updatedAccount] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.issue.resolved", "customer_issue", currentIssue.id, "resolved", { eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updatedAccount, issue: updatedIssue, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/reports", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerReportPreparationSchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = await verifiedVisibleEvidence(companyId, input.evidenceIds, accessResult);
    let consentEvidence = null; if (input.consentEvidenceId) { consentEvidence = (await verifiedVisibleEvidence(companyId, [input.consentEvidenceId], accessResult))[0]; if (!new Set(["customer_consent", "proof_release", "publication_consent"]).has(consentEvidence.evidenceType)) throw new EosRouteError(409, "customer_success_consent_evidence_invalid", "Customer or public proof requires verified consent or proof-release Evidence."); }
    const { policy } = await customerSuccessAccess(req, "execute", "customer_success.report.prepare", input.classification); const now = new Date(); const id = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); if (!current || current.version !== input.expectedAccountVersion) throw new EosRouteError(409, "customer_success_version_conflict", "The account changed before report preparation.");
      const [latestHealth, outcomes, issues] = await Promise.all([tx.select().from(eosCustomerHealthReviews).where(eq(eosCustomerHealthReviews.accountId, current.id)).orderBy(desc(eosCustomerHealthReviews.reviewedAt)).limit(1), tx.select().from(eosCustomerSuccessOutcomes).where(eq(eosCustomerSuccessOutcomes.accountId, current.id)).orderBy(eosCustomerSuccessOutcomes.dueAt), tx.select().from(eosCustomerSuccessIssues).where(eq(eosCustomerSuccessIssues.accountId, current.id)).orderBy(eosCustomerSuccessIssues.dueAt)]);
      const snapshot = { schemaVersion: "eos-customer-report-snapshot.v1", account: { id: current.id, stakeholderId: current.stakeholderId, healthState: current.healthState, healthScore: current.healthScore, renewalIntent: current.renewalIntent, nextReviewAt: current.nextReviewAt }, latestHealthReview: latestHealth[0] ? { id: latestHealth[0].id, healthScore: latestHealth[0].healthScore, healthState: latestHealth[0].healthState, reviewSha256: latestHealth[0].reviewSha256, reviewedAt: latestHealth[0].reviewedAt } : null, outcomes: outcomes.map((item: any) => ({ id: item.id, title: item.title, state: item.state, baselineValue: item.baselineValue, targetValue: item.targetValue, actualValue: item.actualValue, unit: item.unit, attributionModel: item.attributionModel, evidenceIds: item.evidenceIds })), issues: issues.map((item: any) => ({ id: item.id, title: item.title, severity: item.severity, state: item.state, dueAt: item.dueAt, evidenceIds: item.evidenceIds })), evidence: evidence.map((item) => ({ id: item.id, evidenceType: item.evidenceType, evidenceKey: item.evidenceKey, supportedClaimSummary: item.supportedClaimSummary })) };
      const reportSha256 = nativeContractContentSha256({ id, companyId, accountId: current.id, reportKey: input.reportKey, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, executiveSummary: input.executiveSummary, snapshot, evidenceIds: evidence.map((item) => item.id), proofConsent: input.proofConsent, consentEvidenceId: consentEvidence?.id || null, classification: input.classification });
      const [report] = await tx.insert(eosCustomerSuccessReports).values({ id, companyId, accountId: current.id, reportKey: input.reportKey, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, executiveSummary: input.executiveSummary, snapshot, evidenceIds: evidence.map((item) => item.id), proofConsent: input.proofConsent, consentEvidenceId: consentEvidence?.id || null, reportSha256, classification: input.classification, preparedByUserId: req.user.id, preparedAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "report_prepared", subjectType: "report", subjectId: id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: 0, subjectVersionAfter: 1, evidenceIds: evidence.map((item) => item.id), payload: { reportSha256, proofConsent: input.proofConsent, consentEvidenceId: consentEvidence?.id || null }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [updated] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.report.prepared", "customer_report", id, "prepared", { reportSha256, proofConsent: input.proofConsent, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updated, report, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/reports/:reportId/approve", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerReportApprovalSchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = await verifiedVisibleEvidence(companyId, input.approvalEvidenceIds, accessResult); const report = await db.query.eosCustomerSuccessReports.findFirst({ where: and(eq(eosCustomerSuccessReports.id, req.params.reportId), eq(eosCustomerSuccessReports.accountId, account.id), eq(eosCustomerSuccessReports.companyId, companyId)) }); if (!report || report.state !== "prepared" || !mayAccessClassification(accessResult, report.classification)) throw new EosRouteError(404, "customer_success_report_not_found", "Prepared report unavailable in this authority scope.");
    const { policy } = await customerSuccessAccess(req, "decide", "customer_success.report.approve", report.classification); const now = new Date();
    const result = await db.transaction(async (tx) => { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); const [currentReport] = await tx.select().from(eosCustomerSuccessReports).where(eq(eosCustomerSuccessReports.id, report.id)).limit(1); if (!current || !currentReport || current.version !== input.expectedAccountVersion || currentReport.version !== input.expectedVersion || currentReport.state !== "prepared") throw new EosRouteError(409, "customer_success_version_conflict", "The account or report changed before approval.");
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "report_approved", subjectType: "report", subjectId: currentReport.id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: currentReport.version, subjectVersionAfter: currentReport.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { reportSha256: currentReport.reportSha256, approvalNote: input.approvalNote }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [updatedReport] = await tx.update(eosCustomerSuccessReports).set({ state: "approved", approvalEvidenceIds: evidence.map((item) => item.id), approvalNote: input.approvalNote, approvedByUserId: req.user.id, approvedAt: now, version: currentReport.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessReports.id, currentReport.id), eq(eosCustomerSuccessReports.version, currentReport.version))).returning(); const [updatedAccount] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning(); await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.report.approved", "customer_report", currentReport.id, "approved", { reportSha256: currentReport.reportSha256, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId })); return { account: updatedAccount, report: updatedReport, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/reports/:reportId/delivery-receipts", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerReportDeliverySchema.parse(req.body); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const receipt = (await verifiedVisibleEvidence(companyId, [input.receiptEvidenceId], accessResult))[0]; if (!new Set(["provider_receipt", "delivery_receipt", "communication_receipt"]).has(receipt.evidenceType)) throw new EosRouteError(409, "customer_success_delivery_receipt_invalid", "Delivery reconciliation requires verified provider, delivery, or communication receipt Evidence."); const report = await db.query.eosCustomerSuccessReports.findFirst({ where: and(eq(eosCustomerSuccessReports.id, req.params.reportId), eq(eosCustomerSuccessReports.accountId, account.id), eq(eosCustomerSuccessReports.companyId, companyId)) }); if (!report || report.state !== "approved" || !mayAccessClassification(accessResult, report.classification)) throw new EosRouteError(404, "customer_success_report_not_found", "Approved report unavailable in this authority scope.");
    const { policy } = await customerSuccessAccess(req, "execute", "customer_success.report.reconcile_delivery", report.classification); const now = new Date(); if (input.deliveredAt > now) throw new EosRouteError(409, "customer_success_delivery_time_invalid", "A delivery receipt cannot be recorded from the future.");
    const result = await db.transaction(async (tx) => { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); const [currentReport] = await tx.select().from(eosCustomerSuccessReports).where(eq(eosCustomerSuccessReports.id, report.id)).limit(1); if (!current || !currentReport || current.version !== input.expectedAccountVersion || currentReport.version !== input.expectedVersion || currentReport.state !== "approved") throw new EosRouteError(409, "customer_success_version_conflict", "The account or report changed before delivery reconciliation.");
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "report_delivery_recorded", subjectType: "report", subjectId: currentReport.id, accountVersionBefore: current.version, accountVersionAfter: current.version + 1, subjectVersionBefore: currentReport.version, subjectVersionAfter: currentReport.version + 1, evidenceIds: [receipt.id], payload: { reportSha256: currentReport.reportSha256, channel: input.channel, recipientScope: input.recipientScope, externalReference: input.externalReference, deliveredAt: input.deliveredAt.toISOString(), externalEffect: "receipt_reconciled_not_executed_by_eos" }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [updatedReport] = await tx.update(eosCustomerSuccessReports).set({ state: "delivery_recorded", deliveryChannel: input.channel, recipientScope: input.recipientScope, externalReference: input.externalReference, receiptEvidenceId: receipt.id, deliveredAt: input.deliveredAt, version: currentReport.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessReports.id, currentReport.id), eq(eosCustomerSuccessReports.version, currentReport.version))).returning(); const [updatedAccount] = await tx.update(eosCustomerSuccessAccounts).set({ version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning(); await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.report.delivery_reconciled", "customer_report", currentReport.id, "delivery_recorded", { receiptEvidenceId: receipt.id, externalReference: input.externalReference, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId, externalEffectExecutedByEos: false })); return { account: updatedAccount, report: updatedReport, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/customer-success/accounts/:accountId/renewal-decisions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = customerRenewalDecisionSchema.parse(req.body); requireFutureDate(input.nextReviewAt, "Next review"); const accessResult = await companyAccess(req); const account = await visibleAccount(companyId, req.params.accountId, accessResult); const evidence = await verifiedVisibleEvidence(companyId, input.evidenceIds, accessResult); const { policy } = await customerSuccessAccess(req, "decide", "customer_success.renewal.decide", account.classification); const now = new Date(); const today = now.toISOString().slice(0, 10);
    if (!account.lastHealthReviewId || account.nextReviewAt <= today) throw new EosRouteError(409, "customer_success_health_review_required", "A current Evidence-backed health review is required before renewal readiness can be decided.");
    if (["renew", "renegotiate"].includes(input.intent)) { const outcomes = await db.select().from(eosCustomerSuccessOutcomes).where(eq(eosCustomerSuccessOutcomes.accountId, account.id)); if (!outcomes.some((item) => ["tracking", "achieved"].includes(item.state) && Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0)) throw new EosRouteError(409, "customer_success_outcome_evidence_required", "Renew or renegotiate requires at least one evidence-backed tracked or achieved outcome."); }
    const result = await db.transaction(async (tx) => { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-success-account:${account.id}`}))`); const [current] = await tx.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.id, account.id)).limit(1); if (!current || current.version !== input.expectedVersion) throw new EosRouteError(409, "customer_success_version_conflict", "The account changed before the renewal decision."); const nextVersion = current.version + 1; const lifecycleState = lifecycleForRenewalIntent(input.intent);
      const event = await appendEvent(tx, { companyId, accountId: current.id, eventType: "renewal_decided", subjectType: "account", subjectId: current.id, accountVersionBefore: current.version, accountVersionAfter: nextVersion, subjectVersionBefore: current.version, subjectVersionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { intentBefore: current.renewalIntent, intentAfter: input.intent, lifecycleBefore: current.lifecycleState, lifecycleAfter: lifecycleState, rationale: input.rationale, nextReviewAt: input.nextReviewAt, contractEnvelopeId: current.contractEnvelopeId, externalEffect: "decision_only_no_contract_or_provider_execution" }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [updated] = await tx.update(eosCustomerSuccessAccounts).set({ renewalIntent: input.intent, lifecycleState, nextReviewAt: input.nextReviewAt, version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosCustomerSuccessAccounts.id, current.id), eq(eosCustomerSuccessAccounts.version, current.version))).returning(); await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "customer_success.renewal.decided", "customer_success_account", current.id, lifecycleState, { intent: input.intent, contractEnvelopeId: current.contractEnvelopeId, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId, contractRenewalExecuted: false })); return { account: updated, event, boundary: "This is an EOS customer-success decision. It does not amend, renew, terminate, invoice, or notify under a contract." };
    }); res.json(result);
  }));
}
