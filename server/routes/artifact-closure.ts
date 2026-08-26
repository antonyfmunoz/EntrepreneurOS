import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosArtifactClosureEvents,
  eosArtifactClosureRecords,
  eosAuditRecords,
  eosCapabilityInstances,
  eosEvidence,
  eosPreLiveQualificationEvents,
  eosPreLiveQualificationRuns,
  eosPreLiveQualificationScenarios,
  eosSeats,
  eosWorkPackets,
} from "@shared/schema";
import {
  artifactClosureClasses,
  artifactClosureInitializeCompanySchema,
  artifactClosureInitializeSchema,
  artifactClosureInitializeModuleSchema,
  artifactClosureInputIssues,
  artifactClosureMaturityRank,
  artifactClosureUpdateSchema,
  closureGroupState,
  preLiveQualificationReleaseSchema,
  preLiveQualificationRunCreateSchema,
  preLiveQualificationRunTransitionSchema,
  preLiveQualificationScenarioUpdateSchema,
  preLiveScenarioTypes,
} from "@shared/artifact-closure";
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

type Access = Awaited<ReturnType<typeof companyAccess>>;

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "artifact_closure_input_invalid", message: error.issues[0]?.message || "Artifact closure input is invalid." });
      next(error);
    }
  };
}

async function closureAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("operations") && !access.isOwner)
    throw new EosRouteError(403, "artifact_closure_scope_denied", "Artifact closure is outside this role's compiled operating scope.");
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: "artifact_closure_record",
    actionKey,
    purpose: authorityClass === "view" ? "inspect_artifact_closure" : "govern_artifact_closure",
    classification,
    consequence: authorityClass === "decide" ? "material" : "routine",
    targetSeatId: access.seat.id,
  });
  return { access, policy };
}

async function requireVisibleSeat(companyId: number, seatId: string, access: Access) {
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const [seat] = await db.select().from(eosSeats).where(and(eq(eosSeats.id, seatId), eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active"))).limit(1);
  if (!seat || (!access.isOwner && !visible.has(seat.id))) throw new EosRouteError(409, "artifact_closure_owner_invalid", "The accountable seat must be active and visible in this authority scope.");
  return seat;
}

async function requireVerifiedEvidence(companyId: number, evidenceIds: string[], access: Access) {
  const unique = Array.from(new Set(evidenceIds));
  if (unique.length !== evidenceIds.length) throw new EosRouteError(409, "artifact_closure_evidence_invalid", "Evidence references must be unique.");
  if (!unique.length) return [];
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const rows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence)
    .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
    .where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, unique)));
  const qualified = rows.filter(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
  if (qualified.length !== unique.length) throw new EosRouteError(409, "artifact_closure_evidence_invalid", "Every qualification reference must be verified Evidence visible in this tenant, hierarchy, and classification scope.");
  return qualified.map(({ evidence }) => evidence);
}

function groupRecords(records: Array<typeof eosArtifactClosureRecords.$inferSelect>) {
  const grouped = new Map<string, Array<typeof eosArtifactClosureRecords.$inferSelect>>();
  for (const record of records) {
    const key = `${record.moduleId}:${record.capabilityKey}`;
    grouped.set(key, [...(grouped.get(key) || []), record]);
  }
  return Array.from(grouped.entries()).map(([key, items]) => ({
    key,
    moduleId: items[0].moduleId,
    capabilityKey: items[0].capabilityKey,
    capabilityInstanceId: items[0].capabilityInstanceId,
    ownerSeatId: items[0].ownerSeatId,
    rowCount: items.length,
    ...closureGroupState(items),
  }));
}

const preLiveScenarioTitles: Record<(typeof preLiveScenarioTypes)[number], string> = {
  normal_flow: "End-to-end normal flow",
  authority_denial: "Unauthorized action denial",
  provider_unavailable: "Provider unavailable fallback",
  failure_recovery: "Injected failure and safe recovery",
  rollback: "Release rollback and state restoration",
  tenant_isolation: "Cross-tenant isolation",
  audit_replay: "Audit receipt replay and chain verification",
};

async function qualificationSnapshot(companyId: number, moduleIds: number[], capabilityKeys?: string[]) {
  const [capabilities, records] = await Promise.all([
    db.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)),
    db.select().from(eosArtifactClosureRecords).where(and(eq(eosArtifactClosureRecords.companyId, companyId), inArray(eosArtifactClosureRecords.moduleId, moduleIds))),
  ]);
  const allowedKeys = capabilityKeys ? new Set(capabilityKeys) : null;
  const activeCapabilities = capabilities.filter((item) => !["dormant", "deprecated"].includes(item.state) && (!allowedKeys || allowedKeys.has(item.capabilityInstanceKey)));
  const expected = activeCapabilities.flatMap((capability) => (Array.isArray(capability.moduleIds) ? capability.moduleIds : [])
    .filter((moduleId): moduleId is number => moduleIds.includes(Number(moduleId)))
    .map((moduleId) => ({ moduleId: Number(moduleId), capabilityKey: capability.capabilityInstanceKey })));
  const groups = groupRecords(records);
  const groupByKey = new Map(groups.map((group) => [`${group.moduleId}:${group.capabilityKey}`, group]));
  const expectedGroups = expected.map((item) => ({ ...item, state: groupByKey.get(`${item.moduleId}:${item.capabilityKey}`) || null }));
  return {
    schemaVersion: "eos-pre-live-closure-snapshot.v1",
    capturedAt: new Date().toISOString(),
    moduleIds,
    capabilityKeys: Array.from(new Set(expected.map((item) => item.capabilityKey))).sort(),
    expectedGroups: expectedGroups.length,
    initializedGroups: expectedGroups.filter((item) => item.state?.completeCoverage).length,
    implementedGroups: expectedGroups.filter((item) => item.state?.implemented).length,
    preLiveQualifiedGroups: expectedGroups.filter((item) => item.state?.preLiveQualified).length,
    openBlockers: expectedGroups.reduce((sum, item) => sum + (item.state?.openBlockers ?? 1), 0),
    missingGroups: expectedGroups.filter((item) => !item.state?.completeCoverage).map(({ moduleId, capabilityKey }) => ({ moduleId, capabilityKey })),
  };
}

export function registerArtifactClosureRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/artifact-closure", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const moduleId = req.query.moduleId ? Number(req.query.moduleId) : undefined;
    if (!Number.isInteger(companyId) || (moduleId !== undefined && (!Number.isInteger(moduleId) || moduleId < 1 || moduleId > 14))) throw new EosRouteError(400, "artifact_closure_scope_invalid", "Company and optional module scope must be valid.");
    const { access } = await closureAccess(req, "view", "artifact_closure.state.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const where = moduleId ? and(eq(eosArtifactClosureRecords.companyId, companyId), eq(eosArtifactClosureRecords.moduleId, moduleId)) : eq(eosArtifactClosureRecords.companyId, companyId);
    const [records, seats, evidenceRows, capabilities] = await Promise.all([
      db.select().from(eosArtifactClosureRecords).where(where).orderBy(asc(eosArtifactClosureRecords.moduleId), asc(eosArtifactClosureRecords.capabilityKey), asc(eosArtifactClosureRecords.artifactClass)),
      db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active"))).orderBy(asc(eosSeats.title)),
      db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified"))).orderBy(desc(eosEvidence.createdAt)),
      db.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)).orderBy(asc(eosCapabilityInstances.name)),
    ]);
    const visibleRecords = records.filter((item) => mayAccessClassification(access, item.classification) && (access.isOwner || visible.has(item.ownerSeatId)));
    const groups = groupRecords(visibleRecords);
    res.json({
      generatedAt: new Date().toISOString(),
      artifactClasses: artifactClosureClasses,
      records: visibleRecords,
      groups,
      seats: seats.filter((seat) => access.isOwner || visible.has(seat.id)).map((seat) => ({ id: seat.id, title: seat.title, kind: seat.kind })),
      evidence: evidenceRows.filter(({ evidence, packet }) => mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId)))).slice(0, 200).map(({ evidence }) => ({ id: evidence.id, title: evidence.title, evidenceType: evidence.evidenceType, dataClassification: evidence.dataClassification })),
      capabilities: capabilities.filter((item) => access.isOwner || visible.has(item.accountableSeatId)).map((item) => ({ id: item.id, key: item.capabilityInstanceKey, name: item.name, state: item.state, ownerSeatId: item.accountableSeatId, moduleIds: item.moduleIds })),
      counts: {
        capabilityGroups: groups.length,
        rows: visibleRecords.length,
        blockers: groups.reduce((sum, group) => sum + group.openBlockers, 0),
        artifactComplete: groups.filter((group) => group.artifactComplete).length,
        implemented: groups.filter((group) => group.implemented).length,
        preLiveQualified: groups.filter((group) => group.preLiveQualified).length,
        fieldQualified: groups.filter((group) => group.fieldQualified).length,
        nativeQualified: groups.filter((group) => group.nativeQualified).length,
      },
      boundary: "This instrument records attributable artifact closure and qualification evidence. It does not turn a page, fixture, provider projection, or operator assertion into live, field, professional, or native proof.",
    });
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/initialize-company", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = artifactClosureInitializeCompanySchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "execute", "artifact_closure.initialize_company", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "Artifact closure classification exceeds this seat's disclosure ceiling.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const capabilities = (await db.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)))
      .filter((item) => !["dormant", "deprecated"].includes(item.state) && Array.isArray(item.moduleIds) && item.moduleIds.length && (access.isOwner || visible.has(item.accountableSeatId)) && mayAccessClassification(access, item.classification));
    const pairs = capabilities.flatMap((capability) => (capability.moduleIds as number[]).map((moduleId) => ({ capability, moduleId: Number(moduleId) })))
      .filter((item) => Number.isInteger(item.moduleId) && item.moduleId >= 1 && item.moduleId <= 14);
    if (!pairs.length) throw new EosRouteError(409, "artifact_closure_company_unmapped", "No visible non-dormant capability has a canonical module assignment. Assign capability modules before initializing company coverage.");
    if (pairs.length > 300) throw new EosRouteError(409, "artifact_closure_company_scope_too_large", "Company-wide initialization is limited to 300 capability-module matrices per governed operation. Initialize individual modules or retire obsolete mappings first.");
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`artifact-closure-initialize:${companyId}`}))`);
      const existing = await tx.select({ moduleId: eosArtifactClosureRecords.moduleId, capabilityKey: eosArtifactClosureRecords.capabilityKey, artifactClass: eosArtifactClosureRecords.artifactClass }).from(eosArtifactClosureRecords).where(eq(eosArtifactClosureRecords.companyId, companyId));
      const present = new Set(existing.map((item) => `${item.moduleId}:${item.capabilityKey}:${item.artifactClass}`));
      const records = pairs.flatMap(({ capability, moduleId }) => artifactClosureClasses.filter((artifactClass) => !present.has(`${moduleId}:${capability.capabilityInstanceKey}:${artifactClass}`)).map((artifactClass) => ({
        id: randomUUID(), companyId, portfolioId: access.company.portfolioId, moduleId, capabilityKey: capability.capabilityInstanceKey, capabilityInstanceId: capability.id, artifactClass, ownerSeatId: capability.accountableSeatId, templateStack: [capability.sourceAuthority, capability.schemaVersion], classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
      })));
      const created: Array<typeof eosArtifactClosureRecords.$inferSelect> = [];
      for (let offset = 0; offset < records.length; offset += 200) created.push(...await tx.insert(eosArtifactClosureRecords).values(records.slice(offset, offset + 200)).returning());
      const events = created.map((record) => {
        const changeProjection = { schemaVersion: "eos-artifact-closure-event.v1", action: "initialized", initializationMode: "company_capability_coverage", recordId: record.id, companyId, moduleId: record.moduleId, capabilityKey: record.capabilityKey, artifactClass: record.artifactClass, applicability: record.applicability, maturity: record.maturity, ownerSeatId: record.ownerSeatId, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
        return { id: randomUUID(), companyId, recordId: record.id, sequence: 1, action: "initialized", fromMaturity: "doctrine", toMaturity: "doctrine", changeProjection, changeSha256: nativeContractContentSha256(changeProjection), evidenceIds: [], recordedByUserId: req.user.id, recordedAt: now };
      });
      for (let offset = 0; offset < events.length; offset += 200) await tx.insert(eosArtifactClosureEvents).values(events.slice(offset, offset + 200));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "artifact_closure.company_initialized", targetType: "company", targetId: String(companyId), traceId: policy.traceId, correlationId: policy.correlationId, result: "initialized", details: { moduleIds: Array.from(new Set(pairs.map((item) => item.moduleId))).sort((a, b) => a - b), capabilityGroups: pairs.length, insertedRows: created.length, policyDecisionId: policy.decisionId }, createdAt: now });
      return { inserted: created.length, capabilityGroups: pairs.length, moduleIds: Array.from(new Set(pairs.map((item) => item.moduleId))).sort((a, b) => a - b) };
    });
    res.status(result.inserted ? 201 : 200).json({ ...result, totalRequiredPerCapability: artifactClosureClasses.length });
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/initialize-module", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = artifactClosureInitializeModuleSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "execute", "artifact_closure.initialize_module", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "Artifact closure classification exceeds this seat's disclosure ceiling.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const capabilities = (await db.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)))
      .filter((item) => !["dormant", "deprecated"].includes(item.state) && Array.isArray(item.moduleIds) && item.moduleIds.includes(input.moduleId) && (access.isOwner || visible.has(item.accountableSeatId)) && mayAccessClassification(access, item.classification));
    if (!capabilities.length) throw new EosRouteError(409, "artifact_closure_module_unmapped", "No visible non-dormant capability is assigned to this module. Assign the canonical capability before initializing its closure matrix.");
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`artifact-closure-initialize:${companyId}`}))`);
      const existing = await tx.select({ capabilityKey: eosArtifactClosureRecords.capabilityKey, artifactClass: eosArtifactClosureRecords.artifactClass }).from(eosArtifactClosureRecords).where(and(eq(eosArtifactClosureRecords.companyId, companyId), eq(eosArtifactClosureRecords.moduleId, input.moduleId)));
      const present = new Set(existing.map((item) => `${item.capabilityKey}:${item.artifactClass}`));
      const records = capabilities.flatMap((capability) => artifactClosureClasses.filter((artifactClass) => !present.has(`${capability.capabilityInstanceKey}:${artifactClass}`)).map((artifactClass) => ({
        id: randomUUID(), companyId, portfolioId: access.company.portfolioId, moduleId: input.moduleId, capabilityKey: capability.capabilityInstanceKey, capabilityInstanceId: capability.id, artifactClass, ownerSeatId: capability.accountableSeatId, templateStack: [capability.sourceAuthority, capability.schemaVersion], classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
      })));
      if (!records.length) return { inserted: 0, capabilityGroups: capabilities.length };
      const created = await tx.insert(eosArtifactClosureRecords).values(records).returning();
      await tx.insert(eosArtifactClosureEvents).values(created.map((record) => {
        const changeProjection = { schemaVersion: "eos-artifact-closure-event.v1", action: "initialized", initializationMode: "module_capability_coverage", recordId: record.id, companyId, moduleId: record.moduleId, capabilityKey: record.capabilityKey, artifactClass: record.artifactClass, applicability: record.applicability, maturity: record.maturity, ownerSeatId: record.ownerSeatId, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
        return { id: randomUUID(), companyId, recordId: record.id, sequence: 1, action: "initialized", fromMaturity: "doctrine", toMaturity: "doctrine", changeProjection, changeSha256: nativeContractContentSha256(changeProjection), evidenceIds: [], recordedByUserId: req.user.id, recordedAt: now };
      }));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "artifact_closure.module_initialized", targetType: "eos_module", targetId: String(input.moduleId), traceId: policy.traceId, correlationId: policy.correlationId, result: "initialized", details: { moduleId: input.moduleId, capabilityGroups: capabilities.length, insertedRows: created.length, policyDecisionId: policy.decisionId }, createdAt: now });
      return { inserted: created.length, capabilityGroups: capabilities.length };
    });
    res.status(result.inserted ? 201 : 200).json({ ...result, totalRequiredPerCapability: artifactClosureClasses.length });
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/initialize", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = artifactClosureInitializeSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "execute", "artifact_closure.initialize", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const owner = await requireVisibleSeat(companyId, input.ownerSeatId, access);
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "Artifact closure classification exceeds this seat's disclosure ceiling.");
    if (input.capabilityInstanceId) {
      const [capability] = await db.select().from(eosCapabilityInstances).where(and(eq(eosCapabilityInstances.id, input.capabilityInstanceId), eq(eosCapabilityInstances.companyId, companyId))).limit(1);
      if (!capability || capability.capabilityInstanceKey !== input.capabilityKey) throw new EosRouteError(409, "artifact_closure_capability_invalid", "Capability identity must resolve inside this company and match the canonical capability key.");
    }
    const now = new Date();
    const inserted = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`artifact-closure-initialize:${companyId}`}))`);
      const existing = await tx.select({ artifactClass: eosArtifactClosureRecords.artifactClass }).from(eosArtifactClosureRecords).where(and(eq(eosArtifactClosureRecords.companyId, companyId), eq(eosArtifactClosureRecords.moduleId, input.moduleId), eq(eosArtifactClosureRecords.capabilityKey, input.capabilityKey)));
      const present = new Set(existing.map((item) => item.artifactClass));
      const records = artifactClosureClasses.filter((artifactClass) => !present.has(artifactClass)).map((artifactClass) => ({
        id: randomUUID(), companyId, portfolioId: access.company.portfolioId, moduleId: input.moduleId, capabilityKey: input.capabilityKey, capabilityInstanceId: input.capabilityInstanceId || null, artifactClass, ownerSeatId: owner.id, templateStack: input.templateStack, classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
      }));
      if (!records.length) return [];
      const created = await tx.insert(eosArtifactClosureRecords).values(records).returning();
      await tx.insert(eosArtifactClosureEvents).values(created.map((record) => {
        const changeProjection = { schemaVersion: "eos-artifact-closure-event.v1", action: "initialized", recordId: record.id, companyId, moduleId: record.moduleId, capabilityKey: record.capabilityKey, artifactClass: record.artifactClass, applicability: record.applicability, maturity: record.maturity, ownerSeatId: record.ownerSeatId, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
        return { id: randomUUID(), companyId, recordId: record.id, sequence: 1, action: "initialized", fromMaturity: "doctrine", toMaturity: "doctrine", changeProjection, changeSha256: nativeContractContentSha256(changeProjection), evidenceIds: [], recordedByUserId: req.user.id, recordedAt: now };
      }));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "artifact_closure.initialized", targetType: "artifact_closure_group", targetId: `${input.moduleId}:${input.capabilityKey}`, traceId: policy.traceId, correlationId: policy.correlationId, result: "initialized", details: { moduleId: input.moduleId, capabilityKey: input.capabilityKey, insertedRows: created.length, ownerSeatId: owner.id, policyDecisionId: policy.decisionId }, createdAt: now });
      return created;
    });
    res.status(inserted.length ? 201 : 200).json({ inserted: inserted.length, totalRequired: artifactClosureClasses.length });
  }));

  app.get("/api/eos/companies/:companyId/artifact-closure/qualification-runs", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const { access } = await closureAccess(req, "view", "artifact_closure.qualification.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const runs = (await db.select().from(eosPreLiveQualificationRuns).where(eq(eosPreLiveQualificationRuns.companyId, companyId)).orderBy(desc(eosPreLiveQualificationRuns.updatedAt)))
      .filter((run) => mayAccessClassification(access, run.classification) && (access.isOwner || visible.has(run.ownerSeatId)));
    const runIds = runs.map((run) => run.id);
    const [scenarios, events] = runIds.length ? await Promise.all([
      db.select().from(eosPreLiveQualificationScenarios).where(and(eq(eosPreLiveQualificationScenarios.companyId, companyId), inArray(eosPreLiveQualificationScenarios.runId, runIds))).orderBy(asc(eosPreLiveQualificationScenarios.scenarioType)),
      db.select().from(eosPreLiveQualificationEvents).where(and(eq(eosPreLiveQualificationEvents.companyId, companyId), inArray(eosPreLiveQualificationEvents.runId, runIds))).orderBy(asc(eosPreLiveQualificationEvents.sequence)),
    ]) : [[], []];
    res.json({
      runs: runs.map((run) => ({ ...run, scenarios: scenarios.filter((scenario) => scenario.runId === run.id), events: events.filter((event) => event.runId === run.id) })),
      requiredScenarioTypes: preLiveScenarioTypes,
      boundary: "A qualified run proves only the declared synthetic pre-live scope. Founder release additionally requires every scoped artifact group to be pre-live qualified; neither state is field or native proof.",
    });
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/qualification-runs", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = preLiveQualificationRunCreateSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "execute", "artifact_closure.qualification.create", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const owner = await requireVisibleSeat(companyId, input.ownerSeatId, access);
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "Qualification classification exceeds this seat's disclosure ceiling.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const capabilityKeys = (await db.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)))
      .filter((item) => !["dormant", "deprecated"].includes(item.state) && Array.isArray(item.moduleIds) && item.moduleIds.some((moduleId) => input.moduleIds.includes(Number(moduleId))) && (access.isOwner || visible.has(item.accountableSeatId)) && mayAccessClassification(access, item.classification))
      .map((item) => item.capabilityInstanceKey);
    if (!capabilityKeys.length) throw new EosRouteError(409, "pre_live_scope_unmapped", "The selected module scope has no visible non-dormant canonical capability assignment.");
    const snapshot = await qualificationSnapshot(companyId, input.moduleIds, capabilityKeys);
    const now = new Date(); const id = randomUUID(); const runKey = `prelive-${now.toISOString().slice(0, 10)}-${id.slice(0, 8)}`;
    const run = await db.transaction(async (tx) => {
      const [created] = await tx.insert(eosPreLiveQualificationRuns).values({ id, companyId, portfolioId: access.company.portfolioId, runKey, title: input.title, objective: input.objective, moduleIds: input.moduleIds, capabilityKeys: snapshot.capabilityKeys, ownerSeatId: owner.id, closureSnapshot: snapshot, classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const eventProjection = { schemaVersion: "eos-pre-live-qualification-event.v1", action: "created", runId: id, companyId, moduleIds: input.moduleIds, capabilityKeys: snapshot.capabilityKeys, closureSnapshot: snapshot, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
      await tx.insert(eosPreLiveQualificationEvents).values({ id: randomUUID(), companyId, runId: id, sequence: 1, action: "created", fromStatus: "none", toStatus: "draft", eventProjection, eventSha256: nativeContractContentSha256(eventProjection), evidenceIds: [], recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "artifact_closure.qualification_created", targetType: "pre_live_qualification_run", targetId: id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { runKey, moduleIds: input.moduleIds, expectedGroups: snapshot.expectedGroups, policyDecisionId: policy.decisionId }, createdAt: now });
      return created;
    });
    res.status(201).json(run);
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/qualification-runs/:runId/start", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = preLiveQualificationRunTransitionSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "execute", "artifact_closure.qualification.start");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const [observed] = await db.select().from(eosPreLiveQualificationRuns).where(and(eq(eosPreLiveQualificationRuns.id, req.params.runId), eq(eosPreLiveQualificationRuns.companyId, companyId))).limit(1);
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!observed || !mayAccessClassification(access, observed.classification) || (!access.isOwner && !visible.has(observed.ownerSeatId))) throw new EosRouteError(404, "pre_live_run_not_found", "Qualification run not found in this authority scope.");
    if (!["draft", "blocked"].includes(observed.status)) throw new EosRouteError(409, "pre_live_start_state_invalid", "Only a draft or blocked qualification run can be started or reopened.");
    const snapshot = await qualificationSnapshot(companyId, observed.moduleIds as number[], observed.capabilityKeys as string[]);
    if (!snapshot.expectedGroups || snapshot.initializedGroups !== snapshot.expectedGroups || snapshot.implementedGroups !== snapshot.expectedGroups || snapshot.openBlockers)
      throw new EosRouteError(409, "pre_live_implementation_gate_unsatisfied", `Start requires every scoped capability-module matrix to be initialized and implemented with no blockers. Expected ${snapshot.expectedGroups}; initialized ${snapshot.initializedGroups}; implemented ${snapshot.implementedGroups}; blockers ${snapshot.openBlockers}.`);
    const now = new Date();
    const run = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`pre-live-run:${observed.id}`}))`);
      const [current] = await tx.select().from(eosPreLiveQualificationRuns).where(eq(eosPreLiveQualificationRuns.id, observed.id)).limit(1);
      if (!current || current.version !== input.expectedVersion || !["draft", "blocked"].includes(current.status)) throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before start was recorded.");
      const existing = await tx.select({ scenarioType: eosPreLiveQualificationScenarios.scenarioType }).from(eosPreLiveQualificationScenarios).where(eq(eosPreLiveQualificationScenarios.runId, current.id));
      const present = new Set(existing.map((item) => item.scenarioType));
      const scenarios = preLiveScenarioTypes.filter((scenarioType) => !present.has(scenarioType)).map((scenarioType) => ({ id: randomUUID(), companyId, runId: current.id, scenarioKey: `${current.runKey}:${scenarioType}`, scenarioType, title: preLiveScenarioTitles[scenarioType], ownerSeatId: current.ownerSeatId, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }));
      if (scenarios.length) await tx.insert(eosPreLiveQualificationScenarios).values(scenarios);
      const version = current.version + 1;
      const [updated] = await tx.update(eosPreLiveQualificationRuns).set({ status: "in_progress", closureSnapshot: snapshot, blockerSummary: "", version, startedAt: current.startedAt || now, updatedAt: now }).where(and(eq(eosPreLiveQualificationRuns.id, current.id), eq(eosPreLiveQualificationRuns.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before start was recorded.");
      const action = current.status === "blocked" ? "reopened" : "started"; const eventProjection = { schemaVersion: "eos-pre-live-qualification-event.v1", action, runId: current.id, companyId, closureSnapshot: snapshot, rationale: input.rationale, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
      await tx.insert(eosPreLiveQualificationEvents).values({ id: randomUUID(), companyId, runId: current.id, sequence: version, action, fromStatus: current.status, toStatus: "in_progress", eventProjection, eventSha256: nativeContractContentSha256(eventProjection), evidenceIds: [], recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: `artifact_closure.qualification_${action}`, targetType: "pre_live_qualification_run", targetId: current.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "in_progress", details: { closureSnapshot: snapshot, policyDecisionId: policy.decisionId }, createdAt: now });
      return updated;
    });
    res.json(run);
  }));

  app.patch("/api/eos/companies/:companyId/artifact-closure/qualification-runs/:runId/scenarios/:scenarioId", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = preLiveQualificationScenarioUpdateSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "decide", "artifact_closure.qualification.scenario");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const [observedRun] = await db.select().from(eosPreLiveQualificationRuns).where(and(eq(eosPreLiveQualificationRuns.id, req.params.runId), eq(eosPreLiveQualificationRuns.companyId, companyId))).limit(1);
    const [observedScenario] = await db.select().from(eosPreLiveQualificationScenarios).where(and(eq(eosPreLiveQualificationScenarios.id, req.params.scenarioId), eq(eosPreLiveQualificationScenarios.runId, req.params.runId), eq(eosPreLiveQualificationScenarios.companyId, companyId))).limit(1);
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!observedRun || !observedScenario || !mayAccessClassification(access, observedRun.classification) || (!access.isOwner && !visible.has(observedRun.ownerSeatId))) throw new EosRouteError(404, "pre_live_scenario_not_found", "Qualification scenario not found in this authority scope.");
    if (!["in_progress", "blocked"].includes(observedRun.status)) throw new EosRouteError(409, "pre_live_scenario_state_invalid", "Scenario results can only be recorded while the run is in progress or blocked.");
    await requireVisibleSeat(companyId, input.ownerSeatId, access); await requireVerifiedEvidence(companyId, input.evidenceIds, access);
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`pre-live-run:${observedRun.id}`}))`);
      const [currentRun] = await tx.select().from(eosPreLiveQualificationRuns).where(eq(eosPreLiveQualificationRuns.id, observedRun.id)).limit(1);
      const [currentScenario] = await tx.select().from(eosPreLiveQualificationScenarios).where(eq(eosPreLiveQualificationScenarios.id, observedScenario.id)).limit(1);
      if (!currentRun || !currentScenario || currentScenario.version !== input.expectedVersion || !["in_progress", "blocked"].includes(currentRun.status)) throw new EosRouteError(409, "pre_live_scenario_concurrent_change", "The qualification scenario changed before its result was recorded.");
      const [scenario] = await tx.update(eosPreLiveQualificationScenarios).set({ status: input.status, ownerSeatId: input.ownerSeatId, evidenceIds: input.evidenceIds, resultSummary: input.resultSummary, blocker: input.blocker, version: currentScenario.version + 1, recordedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosPreLiveQualificationScenarios.id, currentScenario.id), eq(eosPreLiveQualificationScenarios.version, currentScenario.version))).returning();
      if (!scenario) throw new EosRouteError(409, "pre_live_scenario_concurrent_change", "The qualification scenario changed before its result was recorded.");
      const statuses = (await tx.select({ id: eosPreLiveQualificationScenarios.id, status: eosPreLiveQualificationScenarios.status, blocker: eosPreLiveQualificationScenarios.blocker }).from(eosPreLiveQualificationScenarios).where(eq(eosPreLiveQualificationScenarios.runId, currentRun.id))).map((item) => item.id === scenario.id ? { ...item, status: scenario.status, blocker: scenario.blocker } : item);
      const blocked = statuses.filter((item) => ["failed", "blocked"].includes(item.status)); const nextStatus = blocked.length ? "blocked" : "in_progress"; const version = currentRun.version + 1;
      const [run] = await tx.update(eosPreLiveQualificationRuns).set({ status: nextStatus, blockerSummary: blocked.map((item) => item.blocker).filter(Boolean).join("; "), version, updatedAt: now }).where(and(eq(eosPreLiveQualificationRuns.id, currentRun.id), eq(eosPreLiveQualificationRuns.version, currentRun.version))).returning();
      if (!run) throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before its scenario result was recorded.");
      const eventProjection = { schemaVersion: "eos-pre-live-qualification-event.v1", action: "scenario_recorded", runId: run.id, scenarioId: scenario.id, scenarioType: scenario.scenarioType, fromScenarioStatus: currentScenario.status, toScenarioStatus: scenario.status, resultSummary: scenario.resultSummary, blocker: scenario.blocker, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
      await tx.insert(eosPreLiveQualificationEvents).values({ id: randomUUID(), companyId, runId: run.id, sequence: version, action: "scenario_recorded", fromStatus: currentRun.status, toStatus: nextStatus, eventProjection, eventSha256: nativeContractContentSha256(eventProjection), evidenceIds: input.evidenceIds, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "artifact_closure.qualification_scenario_recorded", targetType: "pre_live_qualification_scenario", targetId: scenario.id, traceId: policy.traceId, correlationId: policy.correlationId, result: scenario.status, details: { runId: run.id, scenarioType: scenario.scenarioType, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
      return { run, scenario };
    });
    res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/qualification-runs/:runId/qualify", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = preLiveQualificationRunTransitionSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "decide", "artifact_closure.qualification.qualify");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const [observed] = await db.select().from(eosPreLiveQualificationRuns).where(and(eq(eosPreLiveQualificationRuns.id, req.params.runId), eq(eosPreLiveQualificationRuns.companyId, companyId))).limit(1);
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!observed || !mayAccessClassification(access, observed.classification) || (!access.isOwner && !visible.has(observed.ownerSeatId))) throw new EosRouteError(404, "pre_live_run_not_found", "Qualification run not found in this authority scope.");
    if (!["in_progress", "blocked"].includes(observed.status)) throw new EosRouteError(409, "pre_live_qualify_state_invalid", "Only an active qualification run can be qualified.");
    const scenarios = await db.select().from(eosPreLiveQualificationScenarios).where(eq(eosPreLiveQualificationScenarios.runId, observed.id));
    if (scenarios.length !== preLiveScenarioTypes.length || !preLiveScenarioTypes.every((type) => scenarios.some((scenario) => scenario.scenarioType === type && scenario.status === "passed"))) throw new EosRouteError(409, "pre_live_scenarios_incomplete", "All seven mandatory scenarios must have evidence-backed passing results before qualification.");
    const snapshot = await qualificationSnapshot(companyId, observed.moduleIds as number[], observed.capabilityKeys as string[]);
    if (!snapshot.expectedGroups || snapshot.implementedGroups !== snapshot.expectedGroups || snapshot.openBlockers) throw new EosRouteError(409, "pre_live_implementation_gate_unsatisfied", "Every scoped artifact group must remain implemented and blocker-free at qualification time.");
    const evidenceIds = Array.from(new Set(scenarios.flatMap((scenario) => scenario.evidenceIds as string[]))); const now = new Date();
    const run = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`pre-live-run:${observed.id}`}))`);
      const [current] = await tx.select().from(eosPreLiveQualificationRuns).where(eq(eosPreLiveQualificationRuns.id, observed.id)).limit(1);
      if (!current || current.version !== input.expectedVersion || !["in_progress", "blocked"].includes(current.status)) throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before qualification was recorded.");
      const version = current.version + 1; const [updated] = await tx.update(eosPreLiveQualificationRuns).set({ status: "qualified", closureSnapshot: snapshot, blockerSummary: "", version, qualifiedAt: now, updatedAt: now }).where(and(eq(eosPreLiveQualificationRuns.id, current.id), eq(eosPreLiveQualificationRuns.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before qualification was recorded.");
      const eventProjection = { schemaVersion: "eos-pre-live-qualification-event.v1", action: "qualified", runId: current.id, closureSnapshot: snapshot, scenarioTypes: preLiveScenarioTypes, evidenceIds, rationale: input.rationale, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
      await tx.insert(eosPreLiveQualificationEvents).values({ id: randomUUID(), companyId, runId: current.id, sequence: version, action: "qualified", fromStatus: current.status, toStatus: "qualified", eventProjection, eventSha256: nativeContractContentSha256(eventProjection), evidenceIds, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "artifact_closure.qualification_qualified", targetType: "pre_live_qualification_run", targetId: current.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "qualified", details: { closureSnapshot: snapshot, scenarioCount: scenarios.length, evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
      return updated;
    });
    res.json(run);
  }));

  app.post("/api/eos/companies/:companyId/artifact-closure/qualification-runs/:runId/release", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = preLiveQualificationReleaseSchema.parse(req.body);
    const { access, policy } = await closureAccess(req, "decide", "artifact_closure.qualification.release");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!access.isOwner) throw new EosRouteError(403, "pre_live_release_founder_required", "Only the company founder/owner may record the reference-instance release decision.");
    const [observed] = await db.select().from(eosPreLiveQualificationRuns).where(and(eq(eosPreLiveQualificationRuns.id, req.params.runId), eq(eosPreLiveQualificationRuns.companyId, companyId))).limit(1);
    if (!observed || !mayAccessClassification(access, observed.classification)) throw new EosRouteError(404, "pre_live_run_not_found", "Qualification run not found in this authority scope.");
    if (observed.status !== "qualified") throw new EosRouteError(409, "pre_live_release_state_invalid", "Only a qualified run may receive a founder release decision.");
    await requireVerifiedEvidence(companyId, input.evidenceIds, access);
    const snapshot = await qualificationSnapshot(companyId, observed.moduleIds as number[], observed.capabilityKeys as string[]);
    if (input.decision === "released" && (!snapshot.expectedGroups || snapshot.preLiveQualifiedGroups !== snapshot.expectedGroups || snapshot.openBlockers)) throw new EosRouteError(409, "pre_live_release_gate_unsatisfied", `Release requires every scoped artifact group to be independently pre-live qualified and blocker-free. Expected ${snapshot.expectedGroups}; qualified ${snapshot.preLiveQualifiedGroups}; blockers ${snapshot.openBlockers}.`);
    const now = new Date();
    const run = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`pre-live-run:${observed.id}`}))`);
      const [current] = await tx.select().from(eosPreLiveQualificationRuns).where(eq(eosPreLiveQualificationRuns.id, observed.id)).limit(1);
      if (!current || current.version !== input.expectedVersion || current.status !== "qualified") throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before the founder decision was recorded.");
      const version = current.version + 1; const [updated] = await tx.update(eosPreLiveQualificationRuns).set({ status: input.decision, closureSnapshot: snapshot, decisionRationale: input.rationale, decisionEvidenceIds: input.evidenceIds, version, decidedAt: now, updatedAt: now }).where(and(eq(eosPreLiveQualificationRuns.id, current.id), eq(eosPreLiveQualificationRuns.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "pre_live_run_concurrent_change", "The qualification run changed before the founder decision was recorded.");
      const eventProjection = { schemaVersion: "eos-pre-live-qualification-event.v1", action: input.decision, runId: current.id, closureSnapshot: snapshot, evidenceIds: input.evidenceIds, rationale: input.rationale, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
      await tx.insert(eosPreLiveQualificationEvents).values({ id: randomUUID(), companyId, runId: current.id, sequence: version, action: input.decision, fromStatus: "qualified", toStatus: input.decision, eventProjection, eventSha256: nativeContractContentSha256(eventProjection), evidenceIds: input.evidenceIds, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: `artifact_closure.qualification_${input.decision}`, targetType: "pre_live_qualification_run", targetId: current.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.decision, details: { closureSnapshot: snapshot, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
      return updated;
    });
    res.json(run);
  }));

  app.patch("/api/eos/companies/:companyId/artifact-closure/:recordId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const input = artifactClosureUpdateSchema.parse(req.body);
    const issues = artifactClosureInputIssues(input);
    if (issues.length) throw new EosRouteError(409, "artifact_closure_gate_unsatisfied", `Artifact closure update still requires ${issues.join(", ")}.`);
    const { access, policy } = await closureAccess(req, "decide", "artifact_closure.update", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const [observed] = await db.select().from(eosArtifactClosureRecords).where(and(eq(eosArtifactClosureRecords.id, req.params.recordId), eq(eosArtifactClosureRecords.companyId, companyId))).limit(1);
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!observed || !mayAccessClassification(access, observed.classification) || (!access.isOwner && !visible.has(observed.ownerSeatId))) throw new EosRouteError(404, "artifact_closure_record_not_found", "Artifact closure record not found in this authority scope.");
    await requireVisibleSeat(companyId, input.ownerSeatId, access);
    await requireVerifiedEvidence(companyId, input.evidenceIds, access);
    if (!mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "classification_ceiling_exceeded", "Artifact closure classification exceeds this seat's disclosure ceiling.");
    const fromRank = artifactClosureMaturityRank[observed.maturity as keyof typeof artifactClosureMaturityRank];
    const toRank = artifactClosureMaturityRank[input.maturity];
    if (toRank < fromRank && !input.evidenceIds.length) throw new EosRouteError(409, "artifact_closure_regression_evidence_required", "Regressing or reopening a maturity claim requires verified Evidence for the discovered defect or changed condition.");
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`artifact-closure-record:${observed.id}`}))`);
      const [current] = await tx.select().from(eosArtifactClosureRecords).where(eq(eosArtifactClosureRecords.id, observed.id)).limit(1);
      if (!current || current.version !== input.expectedVersion) throw new EosRouteError(409, "artifact_closure_concurrent_change", "This artifact closure record changed before your decision was recorded.");
      const currentRank = artifactClosureMaturityRank[current.maturity as keyof typeof artifactClosureMaturityRank];
      const action = toRank > currentRank ? "advanced" : toRank < currentRank ? (toRank < artifactClosureMaturityRank.artifact_complete ? "reopened" : "regressed") : "updated";
      const [record] = await tx.update(eosArtifactClosureRecords).set({ applicability: input.applicability, maturity: input.maturity, ownerSeatId: input.ownerSeatId, templateStack: input.templateStack, evidenceIds: input.evidenceIds, blocker: input.blocker, nextAction: input.nextAction, rationale: input.rationale, triggerCondition: input.triggerCondition, classification: input.classification, version: current.version + 1, updatedAt: now }).where(and(eq(eosArtifactClosureRecords.id, current.id), eq(eosArtifactClosureRecords.version, current.version))).returning();
      if (!record) throw new EosRouteError(409, "artifact_closure_concurrent_change", "This artifact closure record changed before your decision was recorded.");
      const changeProjection = { schemaVersion: "eos-artifact-closure-event.v1", action, recordId: record.id, companyId, moduleId: record.moduleId, capabilityKey: record.capabilityKey, artifactClass: record.artifactClass, from: { applicability: current.applicability, maturity: current.maturity, blocker: current.blocker, ownerSeatId: current.ownerSeatId, version: current.version }, to: { applicability: record.applicability, maturity: record.maturity, blocker: record.blocker, ownerSeatId: record.ownerSeatId, version: record.version }, rationale: input.rationale, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId, recordedAt: now.toISOString() };
      await tx.insert(eosArtifactClosureEvents).values({ id: randomUUID(), companyId, recordId: record.id, sequence: record.version, action, fromMaturity: current.maturity, toMaturity: record.maturity, changeProjection, changeSha256: nativeContractContentSha256(changeProjection), evidenceIds: input.evidenceIds, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: `artifact_closure.${action}`, targetType: "artifact_closure_record", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: record.maturity, details: { moduleId: record.moduleId, capabilityKey: record.capabilityKey, artifactClass: record.artifactClass, fromMaturity: current.maturity, toMaturity: record.maturity, policyDecisionId: policy.decisionId }, createdAt: now });
      return record;
    });
    res.json(updated);
  }));

  app.get("/api/eos/companies/:companyId/artifact-closure/:recordId/events", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const { access } = await closureAccess(req, "view", "artifact_closure.history.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const [record] = await db.select().from(eosArtifactClosureRecords).where(and(eq(eosArtifactClosureRecords.id, req.params.recordId), eq(eosArtifactClosureRecords.companyId, companyId))).limit(1);
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    if (!record || !mayAccessClassification(access, record.classification) || (!access.isOwner && !visible.has(record.ownerSeatId))) throw new EosRouteError(404, "artifact_closure_record_not_found", "Artifact closure record not found in this authority scope.");
    const events = await db.select().from(eosArtifactClosureEvents).where(and(eq(eosArtifactClosureEvents.companyId, companyId), eq(eosArtifactClosureEvents.recordId, record.id))).orderBy(asc(eosArtifactClosureEvents.sequence));
    res.json({ recordId: record.id, events });
  }));
}
