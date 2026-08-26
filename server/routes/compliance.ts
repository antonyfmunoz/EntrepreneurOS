import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords,
  eosComplianceRequirementReviews,
  eosComplianceRequirements,
  eosComplianceSourceVersions,
  eosEvidence,
  eosSeats,
  eosWorkPackets,
} from "@shared/schema";
import {
  complianceRequirementSchema,
  complianceReviewSchema,
  complianceSourceDraftSchema,
  complianceSourceSupersessionSchema,
  complianceSourceVerificationSchema,
  complianceStateForOutcome,
} from "@shared/compliance";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import {
  EosRouteError,
  authorizeAction,
  companyAccess,
  mayAccessClassification,
  visibleSeatIds,
} from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof EosRouteError)
        return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError)
        return res.status(400).json({ code: "compliance_input_invalid", message: error.issues[0]?.message || "Compliance input is invalid." });
      next(error);
    }
  };
}

async function complianceAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("operations"))
    throw new EosRouteError(403, "compliance_scope_denied", "Compliance control is outside this role's compiled Operations workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: "compliance_requirement",
    actionKey,
    purpose: authorityClass === "view" ? "inspect_compliance_control_state" : "operate_compliance_control_state",
    classification,
    consequence: authorityClass === "decide" ? "material" : "routine",
    targetSeatId: access.seat.id,
  });
  return { access, policy };
}

async function visibleVerifiedEvidence(companyId: number, evidenceId: string, access: Awaited<ReturnType<typeof companyAccess>>) {
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const [row] = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence)
    .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
    .where(and(eq(eosEvidence.id, evidenceId), eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId))).limit(1);
  if (!row || row.evidence.verificationState !== "verified" || !mayAccessClassification(access, row.evidence.dataClassification) || !mayAccessClassification(access, row.packet.classification) || (!access.isOwner && (!row.packet.accountableSeatId || !visible.has(row.packet.accountableSeatId))))
    throw new EosRouteError(409, "compliance_review_evidence_invalid", "Professional review Evidence must be verified and visible in this company, hierarchy, and classification scope.");
  return row.evidence;
}

const evidenceTypesByAuthority = {
  qualified_counsel: new Set(["counsel_review", "legal_review", "legal_opinion"]),
  privacy_professional: new Set(["privacy_review", "data_protection_review", "legal_review"]),
  internal_compliance: new Set(["compliance_review", "control_test", "internal_audit", "legal_review"]),
  business_owner: new Set(["business_review", "operational_review", "control_test"]),
} as const;

function requireEvidenceAuthority(evidence: typeof eosEvidence.$inferSelect, authority: keyof typeof evidenceTypesByAuthority) {
  if (!evidenceTypesByAuthority[authority].has(evidence.evidenceType as never))
    throw new EosRouteError(409, "compliance_review_authority_evidence_required", `The selected Evidence type does not support the claimed ${authority.replaceAll("_", " ")} review authority.`);
}

function requireCurrentSource(source: typeof eosComplianceSourceVersions.$inferSelect, allowTerminalReview = false) {
  const today = new Date().toISOString().slice(0, 10);
  if (source.state === "superseded" && allowTerminalReview) return;
  if (source.state !== "verified" || source.effectiveFrom > today || Boolean(source.effectiveUntil && source.effectiveUntil <= today) || source.nextReviewAt <= today)
    throw new EosRouteError(409, "compliance_source_review_required", "The exact source version is not verified, currently effective, or inside its professional-review window.");
}

function auditRecord(companyId: number, userId: string, action: string, targetType: string, targetId: string, result: string, details: Record<string, unknown>) {
  return {
    id: randomUUID(), companyId, actorUserId: userId, action, targetType, targetId,
    traceId: randomUUID(), correlationId: randomUUID(), result, details,
  };
}

export function registerComplianceRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/compliance", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const { access } = await complianceAccess(req, "view", "compliance.state.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const [sources, requirements, reviews, evidenceRows, seats] = await Promise.all([
      db.select().from(eosComplianceSourceVersions).where(eq(eosComplianceSourceVersions.companyId, companyId)).orderBy(desc(eosComplianceSourceVersions.preparedAt)),
      db.select().from(eosComplianceRequirements).where(eq(eosComplianceRequirements.companyId, companyId)).orderBy(desc(eosComplianceRequirements.updatedAt)),
      db.select().from(eosComplianceRequirementReviews).where(eq(eosComplianceRequirementReviews.companyId, companyId)).orderBy(desc(eosComplianceRequirementReviews.reviewedAt)),
      db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified"))),
      db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active"))).orderBy(eosSeats.title),
    ]);
    const visibleSources = sources.filter((item) => mayAccessClassification(access, item.classification));
    const sourceIds = new Set(visibleSources.map((item) => item.id));
    const visibleRequirements = requirements.filter((item) => visible.has(item.ownerSeatId) && sourceIds.has(item.sourceVersionId) && mayAccessClassification(access, item.classification));
    const requirementIds = new Set(visibleRequirements.map((item) => item.id));
    const visibleEvidence = evidenceRows.filter(({ evidence, packet }) => mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      generatedAt: new Date().toISOString(),
      sources: visibleSources.map((item) => ({ ...item, current: item.state === "verified" && item.effectiveFrom <= today && (!item.effectiveUntil || item.effectiveUntil > today) && item.nextReviewAt > today })),
      requirements: visibleRequirements.map((item) => ({ ...item, overdue: !["satisfied_closed", "superseded"].includes(item.state) && item.dueReviewAt <= today, sourceState: visibleSources.find((source) => source.id === item.sourceVersionId)?.state || "unavailable" })),
      reviews: reviews.filter((item) => requirementIds.has(item.requirementId)),
      evidence: visibleEvidence.map(({ evidence }) => ({ id: evidence.id, title: evidence.title, evidenceType: evidence.evidenceType, dataClassification: evidence.dataClassification })),
      seats: seats.filter((seat) => visible.has(seat.id)).map((seat) => ({ id: seat.id, title: seat.title, kind: seat.kind })),
      counts: {
        verifiedSources: visibleSources.filter((item) => item.state === "verified").length,
        activeRequirements: visibleRequirements.filter((item) => ["applicable_active", "monitoring", "remediating"].includes(item.state)).length,
        overdue: visibleRequirements.filter((item) => !["satisfied_closed", "superseded"].includes(item.state) && item.dueReviewAt <= today).length,
        failedControls: reviews.filter((item) => requirementIds.has(item.requirementId) && item.reviewKind === "control_test" && item.outcome === "ineffective").length,
      },
      boundary: "EOS records attributable source and professional-review claims. It does not verify licenses, determine legal applicability, or replace qualified counsel or privacy professionals.",
    });
  }));

  app.post("/api/eos/companies/:companyId/compliance/sources", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = complianceSourceDraftSchema.parse(req.body);
    const { access, policy } = await complianceAccess(req, "execute", "compliance.source.prepare", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "The source classification exceeds this seat's disclosure ceiling.");
    const id = randomUUID();
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`compliance-source:${companyId}:${input.sourceKey}`}))`);
      const [latest] = await tx.select({ value: sql<number>`COALESCE(MAX(${eosComplianceSourceVersions.sourceVersion}), 0)` }).from(eosComplianceSourceVersions).where(and(eq(eosComplianceSourceVersions.companyId, companyId), eq(eosComplianceSourceVersions.sourceKey, input.sourceKey)));
      const sourceVersion = Number(latest?.value || 0) + 1;
      const contentSha256 = nativeContractContentSha256({ schemaVersion: "eos-compliance-source.v1", companyId, sourceVersion, ...input, effectiveUntil: input.effectiveUntil || null });
      const [source] = await tx.insert(eosComplianceSourceVersions).values({ id, companyId, sourceKey: input.sourceKey, sourceVersion, versionLabel: input.versionLabel, title: input.title, sourceType: input.sourceType, authoritySystem: input.authoritySystem, authoritativeReference: input.authoritativeReference, jurisdictionRegime: input.jurisdictionRegime, summary: input.summary, effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil || null, reviewedThrough: input.reviewedThrough, nextReviewAt: input.nextReviewAt, contentSha256, classification: input.classification, preparedByUserId: req.user.id }).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "compliance.source.prepared", "compliance_source", source.id, "draft", { sourceKey: source.sourceKey, sourceVersion, contentSha256, policyDecisionId: policy.decisionId }));
      return source;
    });
    res.status(201).json(created);
  }));

  app.post("/api/eos/companies/:companyId/compliance/sources/:sourceId/verify", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = complianceSourceVerificationSchema.parse(req.body);
    const accessResult = await companyAccess(req);
    if (accessResult.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const source = await db.query.eosComplianceSourceVersions.findFirst({ where: and(eq(eosComplianceSourceVersions.id, req.params.sourceId), eq(eosComplianceSourceVersions.companyId, companyId), eq(eosComplianceSourceVersions.state, "draft")) });
    if (!source || !mayAccessClassification(accessResult, source.classification)) throw new EosRouteError(404, "compliance_source_not_found", "The draft source is unavailable in this authority scope.");
    if (source.contentSha256 !== input.expectedContentSha256) throw new EosRouteError(409, "compliance_source_changed", "The source snapshot changed before verification. Refresh and review it again.");
    if (source.nextReviewAt <= new Date().toISOString().slice(0, 10)) throw new EosRouteError(409, "compliance_source_review_required", "The next professional-review date must remain in the future at verification.");
    if (["statute", "regulation", "contract", "professional_guidance", "consent_notice"].includes(source.sourceType) && input.reviewAuthority === "business_owner") throw new EosRouteError(409, "compliance_professional_review_required", "This source class cannot be verified by business-owner review alone.");
    const evidence = await visibleVerifiedEvidence(companyId, input.reviewEvidenceId, accessResult);
    requireEvidenceAuthority(evidence, input.reviewAuthority);
    const { policy } = await complianceAccess(req, "decide", "compliance.source.verify", source.classification);
    const verifiedAt = new Date();
    const verified = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`compliance-source:${companyId}:${source.sourceKey}`}))`);
      const previous = await tx.select().from(eosComplianceSourceVersions).where(and(eq(eosComplianceSourceVersions.companyId, companyId), eq(eosComplianceSourceVersions.sourceKey, source.sourceKey), eq(eosComplianceSourceVersions.state, "verified")));
      for (const prior of previous) {
        await tx.update(eosComplianceSourceVersions).set({ state: "superseded", supersededByUserId: req.user.id, supersededAt: verifiedAt, supersessionReason: `Replaced by verified source version ${source.sourceVersion} (${source.versionLabel}).` }).where(and(eq(eosComplianceSourceVersions.id, prior.id), eq(eosComplianceSourceVersions.state, "verified")));
        await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "compliance.source.superseded", "compliance_source", prior.id, "superseded", { contentSha256: prior.contentSha256, reason: `Replaced by verified source version ${source.sourceVersion} (${source.versionLabel}).`, replacementSourceId: source.id, policyDecisionId: policy.decisionId }));
      }
      const [updated] = await tx.update(eosComplianceSourceVersions).set({ state: "verified", reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, limitations: input.limitations, verificationPolicyDecisionId: policy.decisionId, verifiedByUserId: req.user.id, verifiedAt }).where(and(eq(eosComplianceSourceVersions.id, source.id), eq(eosComplianceSourceVersions.state, "draft"), eq(eosComplianceSourceVersions.contentSha256, input.expectedContentSha256))).returning();
      if (!updated) throw new EosRouteError(409, "compliance_source_changed", "The source changed before verification. Refresh and retry.");
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "compliance.source.verified", "compliance_source", updated.id, "verified", { contentSha256: updated.contentSha256, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, policyDecisionId: policy.decisionId, supersededSourceIds: previous.map((item) => item.id), credentialVerification: "external_claim_not_verified_by_eos" }));
      return updated;
    });
    res.json(verified);
  }));

  app.post("/api/eos/companies/:companyId/compliance/sources/:sourceId/supersede", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = complianceSourceSupersessionSchema.parse(req.body);
    const accessResult = await companyAccess(req);
    if (accessResult.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const source = await db.query.eosComplianceSourceVersions.findFirst({ where: and(eq(eosComplianceSourceVersions.id, req.params.sourceId), eq(eosComplianceSourceVersions.companyId, companyId), eq(eosComplianceSourceVersions.state, "verified")) });
    if (!source || !mayAccessClassification(accessResult, source.classification)) throw new EosRouteError(404, "compliance_source_not_found", "The verified source is unavailable in this authority scope.");
    if (source.contentSha256 !== input.expectedContentSha256) throw new EosRouteError(409, "compliance_source_changed", "The source snapshot changed before supersession.");
    const { policy } = await complianceAccess(req, "decide", "compliance.source.supersede", source.classification);
    const supersededAt = new Date();
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosComplianceSourceVersions).set({ state: "superseded", supersededByUserId: req.user.id, supersededAt, supersessionReason: input.reason }).where(and(eq(eosComplianceSourceVersions.id, source.id), eq(eosComplianceSourceVersions.state, "verified"), eq(eosComplianceSourceVersions.contentSha256, input.expectedContentSha256))).returning();
      if (!updated) throw new EosRouteError(409, "compliance_source_changed", "The source changed before supersession.");
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "compliance.source.superseded", "compliance_source", updated.id, "superseded", { contentSha256: updated.contentSha256, reason: input.reason, policyDecisionId: policy.decisionId }));
      return updated;
    });
    res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/compliance/requirements", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = complianceRequirementSchema.parse(req.body);
    const { access, policy } = await complianceAccess(req, "execute", "compliance.requirement.create", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "The requirement classification exceeds this seat's disclosure ceiling.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!visible.has(input.ownerSeatId)) throw new EosRouteError(403, "compliance_owner_scope_denied", "The accountable seat is outside this operator's visible hierarchy.");
    const source = await db.query.eosComplianceSourceVersions.findFirst({ where: and(eq(eosComplianceSourceVersions.id, input.sourceVersionId), eq(eosComplianceSourceVersions.companyId, companyId)) });
    if (!source || !mayAccessClassification(access, source.classification)) throw new EosRouteError(404, "compliance_source_not_found", "The exact source version is unavailable.");
    if (source.contentSha256 !== input.expectedSourceSha256) throw new EosRouteError(409, "compliance_source_changed", "The source snapshot changed before requirement creation.");
    requireCurrentSource(source);
    const id = randomUUID();
    const requirement = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`compliance-requirement:${companyId}:${input.requirementKey}`}))`);
      const previous = await tx.select().from(eosComplianceRequirements).where(and(eq(eosComplianceRequirements.companyId, companyId), eq(eosComplianceRequirements.requirementKey, input.requirementKey))).orderBy(desc(eosComplianceRequirements.requirementVersion)).limit(1);
      if (previous[0] && !["superseded", "satisfied_closed"].includes(previous[0].state)) throw new EosRouteError(409, "compliance_requirement_current_version_exists", "Close or supersede the current requirement through an Evidence-backed review before creating another version.");
      const requirementVersion = (previous[0]?.requirementVersion || 0) + 1;
      const definitionSha256 = nativeContractContentSha256({ schemaVersion: "eos-compliance-requirement.v1", companyId, requirementVersion, sourceSha256: source.contentSha256, ...input });
      const [created] = await tx.insert(eosComplianceRequirements).values({ id, companyId, requirementKey: input.requirementKey, requirementVersion, requirementType: input.requirementType, sourceVersionId: source.id, sourceSha256: source.contentSha256, title: input.title, description: input.description, ownerSeatId: input.ownerSeatId, subjectScope: input.subjectScope, sourceRequirement: input.sourceRequirement, jurisdictionRegime: input.jurisdictionRegime, processingPurpose: input.processingPurpose, legalBasisClaim: input.legalBasisClaim, retentionTrigger: input.retentionTrigger, retentionPeriod: input.retentionPeriod, dispositionMethod: input.dispositionMethod, dueReviewAt: input.dueReviewAt, classification: input.classification, definitionSha256, recordedByUserId: req.user.id }).returning();
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "compliance.requirement.created", "compliance_requirement", created.id, "identified", { requirementKey: created.requirementKey, requirementVersion, requirementType: created.requirementType, sourceVersionId: source.id, sourceSha256: source.contentSha256, definitionSha256, policyDecisionId: policy.decisionId }));
      return created;
    });
    res.status(201).json(requirement);
  }));

  app.post("/api/eos/companies/:companyId/compliance/requirements/:requirementId/reviews", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = complianceReviewSchema.parse(req.body);
    const accessResult = await companyAccess(req);
    if (accessResult.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const requirement = await db.query.eosComplianceRequirements.findFirst({ where: and(eq(eosComplianceRequirements.id, req.params.requirementId), eq(eosComplianceRequirements.companyId, companyId)) });
    if (!requirement || !mayAccessClassification(accessResult, requirement.classification)) throw new EosRouteError(404, "compliance_requirement_not_found", "The compliance requirement is unavailable in this authority scope.");
    const visible = await visibleSeatIds(companyId, accessResult.seat.id, accessResult.role);
    if (!visible.has(requirement.ownerSeatId)) throw new EosRouteError(404, "compliance_requirement_not_found", "The compliance requirement is unavailable in this hierarchy.");
    if (requirement.version !== input.expectedVersion) throw new EosRouteError(409, "compliance_requirement_changed", "The requirement changed before review. Refresh and retry.");
    if (["satisfied_closed", "superseded"].includes(requirement.state)) throw new EosRouteError(409, "compliance_requirement_terminal", "Terminal compliance requirements cannot receive another review.");
    const source = await db.query.eosComplianceSourceVersions.findFirst({ where: and(eq(eosComplianceSourceVersions.id, requirement.sourceVersionId), eq(eosComplianceSourceVersions.companyId, companyId)) });
    if (!source || source.contentSha256 !== requirement.sourceSha256 || source.contentSha256 !== input.expectedSourceSha256) throw new EosRouteError(409, "compliance_source_changed", "The exact source snapshot no longer matches this requirement.");
    const terminalOnSuperseded = source.state === "superseded" && ["not_applicable", "needs_revision", "satisfied"].includes(input.outcome);
    requireCurrentSource(source, terminalOnSuperseded);
    if (input.nextReviewAt && input.nextReviewAt <= new Date().toISOString().slice(0, 10)) throw new EosRouteError(409, "compliance_next_review_invalid", "The next review must be in the future.");
    if (["not_applicable", "satisfied", "breached"].includes(input.outcome) && input.reviewAuthority === "business_owner") throw new EosRouteError(409, "compliance_professional_review_required", "This consequential outcome requires professional or internal-compliance review, not business-owner review alone.");
    const evidence = await visibleVerifiedEvidence(companyId, input.reviewEvidenceId, accessResult);
    requireEvidenceAuthority(evidence, input.reviewAuthority);
    const authorityClass = ["not_applicable", "satisfied", "breached"].includes(input.outcome) ? "decide" : "execute";
    const { policy } = await complianceAccess(req, authorityClass, `compliance.requirement.review.${input.reviewKind}`, requirement.classification);
    const stateAfter = complianceStateForOutcome(input.outcome);
    const reviewedAt = new Date();
    const reviewId = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`compliance-requirement:${requirement.id}`}))`);
      const reviewSha256 = nativeContractContentSha256({ schemaVersion: "eos-compliance-review.v1", id: reviewId, companyId, requirementId: requirement.id, requirementVersion: requirement.version, sourceVersionId: source.id, sourceSha256: source.contentSha256, stateBefore: requirement.state, stateAfter, ...input, policyDecisionId: policy.decisionId, reviewedByUserId: req.user.id, reviewedAt: reviewedAt.toISOString() });
      const [review] = await tx.insert(eosComplianceRequirementReviews).values({ id: reviewId, companyId, requirementId: requirement.id, requirementVersion: requirement.version, sourceVersionId: source.id, sourceSha256: source.contentSha256, reviewKind: input.reviewKind, outcome: input.outcome, stateBefore: requirement.state, stateAfter, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, factsConsidered: input.factsConsidered, rationale: input.rationale, nextReviewAt: input.nextReviewAt || null, policyDecisionId: policy.decisionId, reviewSha256, reviewedByUserId: req.user.id, reviewedAt }).returning();
      const [updated] = await tx.update(eosComplianceRequirements).set({ state: stateAfter, version: requirement.version + 1, dueReviewAt: input.nextReviewAt || requirement.dueReviewAt, lastReviewId: review.id, lastReviewedAt: reviewedAt, updatedAt: reviewedAt }).where(and(eq(eosComplianceRequirements.id, requirement.id), eq(eosComplianceRequirements.version, input.expectedVersion), eq(eosComplianceRequirements.sourceSha256, input.expectedSourceSha256))).returning();
      if (!updated) throw new EosRouteError(409, "compliance_requirement_changed", "The requirement changed before review. Refresh and retry.");
      await tx.insert(eosAuditRecords).values(auditRecord(companyId, req.user.id, "compliance.requirement.reviewed", "compliance_requirement", updated.id, input.outcome, { reviewId: review.id, reviewSha256, reviewKind: input.reviewKind, stateBefore: requirement.state, stateAfter, sourceVersionId: source.id, sourceSha256: source.contentSha256, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, policyDecisionId: policy.decisionId, credentialVerification: "external_claim_not_verified_by_eos" }));
      return { requirement: updated, review };
    });
    res.status(201).json(result);
  }));
}
