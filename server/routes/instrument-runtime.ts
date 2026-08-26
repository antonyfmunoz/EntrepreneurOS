import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords,
  eosEvidence,
  eosInstrumentCommands,
  eosInstrumentEvents,
  eosInstrumentLinks,
  eosInstrumentObjects,
} from "@shared/schema";
import {
  eosInstrumentKeySchema,
  instrumentDomainFindings,
  instrumentLinkCreateSchema,
  instrumentImportSchema,
  instrumentManifestProjection,
  instrumentObjectCreateSchema,
  instrumentObjectUpdateSchema,
  instrumentSearchSchema,
  instrumentTransitionSchema,
  mayTransitionInstrumentObject,
} from "@shared/instrument-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { containsCredentialMaterial } from "../security/credential-material";
import {
  authorizeAction,
  companyAccess,
  EosRouteError,
  mayAccessClassification,
  visibleSeatIds,
} from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "instrument_input_invalid", message: error.issues[0]?.message || "Instrument input is invalid." });
      next(error);
    }
  };
}

async function instrumentAccess(req: Request, authorityClass: "view" | "execute" | "decide", instrumentKey: string, actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  const key = eosInstrumentKeySchema.parse(instrumentKey);
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: `instrument:${key}`,
    actionKey,
    purpose: authorityClass === "view" ? "inspect_instrument" : "operate_instrument",
    classification,
    consequence: authorityClass === "decide" ? "material" : "routine",
    targetSeatId: access.seat.id,
  });
  return { access, key, policy };
}

async function checkedEvidence(companyId: number, ids: string[], requireVerified = false) {
  const unique = Array.from(new Set(ids));
  if (unique.length !== ids.length) throw new EosRouteError(409, "instrument_evidence_duplicate", "Evidence references must be unique.");
  if (!unique.length) return [];
  const records = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, companyId), inArray(eosEvidence.id, unique)));
  if (records.length !== unique.length || (requireVerified && records.some((record) => record.verificationState !== "verified")))
    throw new EosRouteError(409, "instrument_evidence_invalid", requireVerified ? "This state change requires verified Evidence from the same company." : "Evidence must resolve inside the selected company.");
  return records;
}

function assertCredentialFree(value: unknown) {
  if (containsCredentialMaterial(value))
    throw new EosRouteError(400, "instrument_credential_material_forbidden", "Instrument records may contain managed-secret references, never credential values.");
}

async function visibleObjectSet(access: Awaited<ReturnType<typeof companyAccess>>, objects: typeof eosInstrumentObjects.$inferSelect[]) {
  const seatIds = await visibleSeatIds(access.company.id, access.seat.id, access.role);
  return objects.filter((object) => {
    if (!mayAccessClassification(access, object.classification)) return false;
    if (object.visibility === "seat") return object.ownerSeatId === access.seat.id;
    if (object.visibility === "team") return seatIds.has(object.ownerSeatId);
    if (object.visibility === "portfolio") return ["founder", "portfolio_executive"].includes(access.role);
    return true;
  });
}

async function existingCommand(companyId: number, idempotencyKey: string) {
  const [command] = await db.select().from(eosInstrumentCommands).where(and(eq(eosInstrumentCommands.companyId, companyId), eq(eosInstrumentCommands.idempotencyKey, idempotencyKey))).limit(1);
  return command;
}

async function replayCommand(companyId: number, idempotencyKey: string, instrumentKey: string, commandType: string) {
  const command = await existingCommand(companyId, idempotencyKey);
  if (!command) return null;
  if (command.instrumentKey !== instrumentKey || command.commandType !== commandType)
    throw new EosRouteError(409, "instrument_idempotency_conflict", "This idempotency key is already bound to a different instrument command.");
  const [object] = command.objectId ? await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, companyId), eq(eosInstrumentObjects.id, command.objectId))).limit(1) : [];
  return { command, object: object || null, replayed: true };
}

function eventHash(input: Record<string, unknown>) {
  return nativeContractContentSha256({ schemaVersion: "eos.instrument-event.v1", ...input });
}

export function registerInstrumentRuntimeRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/instruments", route(async (req, res) => {
    const access = await companyAccess(req);
    await authorizeAction(req, access, { authorityClass: "view", resource: "instrument:*", actionKey: "instrument.manifest.read", purpose: "inspect_instrument_manifest", classification: "internal", consequence: "routine", targetSeatId: access.seat.id });
    const objects = await db.select().from(eosInstrumentObjects).where(eq(eosInstrumentObjects.companyId, access.company.id)).orderBy(desc(eosInstrumentObjects.updatedAt));
    const visible = await visibleObjectSet(access, objects);
    const visibleIds = visible.map((object) => object.id);
    const [links, events] = visibleIds.length ? await Promise.all([
      db.select().from(eosInstrumentLinks).where(and(eq(eosInstrumentLinks.companyId, access.company.id), inArray(eosInstrumentLinks.sourceObjectId, visibleIds), inArray(eosInstrumentLinks.targetObjectId, visibleIds))),
      db.select().from(eosInstrumentEvents).where(and(eq(eosInstrumentEvents.companyId, access.company.id), inArray(eosInstrumentEvents.objectId, visibleIds))).orderBy(desc(eosInstrumentEvents.createdAt)),
    ]) : [[], []];
    const counts = Object.fromEntries(instrumentManifestProjection().map((instrument) => [instrument.key, visible.filter((object) => object.instrumentKey === instrument.key).length]));
    res.json({ schemaVersion: "eos.instrument-runtime.v1", manifest: instrumentManifestProjection(), objects: visible, links, events: events.slice(0, 250), counts });
  }));

  app.get("/api/eos/companies/:companyId/instruments/:instrumentKey", route(async (req, res) => {
    const { access, key } = await instrumentAccess(req, "view", req.params.instrumentKey, "instrument.read", "internal");
    const objects = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.instrumentKey, key))).orderBy(desc(eosInstrumentObjects.updatedAt));
    res.json({ schemaVersion: "eos.instrument-runtime.v1", instrument: instrumentManifestProjection().find((item) => item.key === key), objects: await visibleObjectSet(access, objects) });
  }));

  app.get("/api/eos/companies/:companyId/instrument-search", route(async (req, res) => {
    const input = instrumentSearchSchema.parse(req.query);
    const access = await companyAccess(req);
    await authorizeAction(req, access, { authorityClass: "view", resource: "instrument:search", actionKey: "instrument.search", purpose: "search_authorized_instrument_state", classification: "internal", consequence: "routine", targetSeatId: access.seat.id });
    const conditions = [eq(eosInstrumentObjects.companyId, access.company.id)];
    if (input.instrumentKey) conditions.push(eq(eosInstrumentObjects.instrumentKey, input.instrumentKey));
    if (input.state) conditions.push(eq(eosInstrumentObjects.state, input.state));
    if (input.query) conditions.push(or(ilike(eosInstrumentObjects.title, `%${input.query}%`), ilike(eosInstrumentObjects.summary, `%${input.query}%`), ilike(eosInstrumentObjects.objectKey, `%${input.query}%`))!);
    const objects = await db.select().from(eosInstrumentObjects).where(and(...conditions)).orderBy(desc(eosInstrumentObjects.updatedAt)).limit(input.limit);
    res.json({ schemaVersion: "eos.instrument-search.v1", query: input.query, results: await visibleObjectSet(access, objects) });
  }));

  app.get("/api/eos/companies/:companyId/instrument-export", route(async (req, res) => {
    const access = await companyAccess(req);
    await authorizeAction(req, access, { authorityClass: "view", resource: "instrument:*", actionKey: "instrument.bundle.export", purpose: "export_authorized_instrument_state", classification: "internal", consequence: "routine", targetSeatId: access.seat.id });
    const instrumentKey = req.query.instrumentKey ? eosInstrumentKeySchema.parse(req.query.instrumentKey) : undefined;
    const rows = await db.select().from(eosInstrumentObjects).where(instrumentKey ? and(eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.instrumentKey, instrumentKey)) : eq(eosInstrumentObjects.companyId, access.company.id)).orderBy(desc(eosInstrumentObjects.updatedAt));
    const objects = await visibleObjectSet(access, rows);
    const ids = objects.map((object) => object.id);
    const links = ids.length ? await db.select().from(eosInstrumentLinks).where(and(eq(eosInstrumentLinks.companyId, access.company.id), inArray(eosInstrumentLinks.sourceObjectId, ids), inArray(eosInstrumentLinks.targetObjectId, ids))) : [];
    const byId = new Map(objects.map((object) => [object.id, object]));
    res.setHeader("content-disposition", `attachment; filename=\"eos-instruments-${instrumentKey || "company"}.json\"`);
    res.json({
      schemaVersion: "eos.instrument-bundle.v1",
      exportedAt: new Date().toISOString(),
      objects: objects.map(({ instrumentKey, objectType, objectKey, title, summary, classification, visibility, data, sourceReference }) => ({ instrumentKey, objectType, objectKey, title, summary, classification, visibility, data, sourceReference })),
      links: links.map((link) => ({ source: { instrumentKey: byId.get(link.sourceObjectId)!.instrumentKey, objectKey: byId.get(link.sourceObjectId)!.objectKey }, target: { instrumentKey: byId.get(link.targetObjectId)!.instrumentKey, objectKey: byId.get(link.targetObjectId)!.objectKey }, relationshipType: link.relationshipType, metadata: link.metadata })),
    });
  }));

  app.post("/api/eos/companies/:companyId/instrument-imports", route(async (req, res) => {
    const input = instrumentImportSchema.parse(req.body); assertCredentialFree(input.bundle);
    const access = await companyAccess(req);
    const policy = await authorizeAction(req, access, { authorityClass: "execute", resource: "instrument:*", actionKey: "instrument.bundle.import", purpose: "import_instrument_drafts", classification: "confidential", consequence: "routine", targetSeatId: access.seat.id });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`instrument-import:${access.company.id}:${input.idempotencyKey}`}))`);
      const [prior] = await tx.select().from(eosInstrumentCommands).where(and(eq(eosInstrumentCommands.companyId, access.company.id), eq(eosInstrumentCommands.idempotencyKey, input.idempotencyKey))).limit(1);
      if (prior) {
        if (prior.commandType !== "bundle.import") throw new EosRouteError(409, "instrument_idempotency_conflict", "This idempotency key is already bound to a different instrument command.");
        return { ...(prior.result as Record<string, unknown>), replayed: true };
      }
      const objectKeys = input.bundle.objects.map((object) => object.objectKey);
      const existing = objectKeys.length ? await tx.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, access.company.id), inArray(eosInstrumentObjects.objectKey, objectKeys))) : [];
      const existingByKey = new Map(existing.map((object) => [`${object.instrumentKey}:${object.objectKey}`, object]));
      const importedByKey = new Map<string, typeof eosInstrumentObjects.$inferSelect>();
      const created: Array<typeof eosInstrumentObjects.$inferSelect> = [];
      const skipped: Array<{ instrumentKey: string; objectKey: string }> = [];
      const bundleSha256 = nativeContractContentSha256(input.bundle);
      const now = new Date();
      for (let index = 0; index < input.bundle.objects.length; index += 1) {
        const portable = input.bundle.objects[index];
        const sourceKey = `${portable.instrumentKey}:${portable.objectKey}`;
        const priorObject = existingByKey.get(sourceKey);
        if (priorObject && input.conflictStrategy === "skip_existing") { importedByKey.set(sourceKey, priorObject); skipped.push({ instrumentKey: portable.instrumentKey, objectKey: portable.objectKey }); continue; }
        const suffix = randomUUID().slice(0, 8);
        const objectKey = priorObject ? `${portable.objectKey.slice(0, 180)}:copy:${suffix}` : portable.objectKey;
        const objectId = randomUUID(); const commandId = randomUUID(); const idempotencyKey = `${input.idempotencyKey}:object:${index}`;
        const sourceReference = { ...portable.sourceReference, importedFrom: { schemaVersion: input.bundle.schemaVersion, bundleSha256, sourceObjectKey: portable.objectKey } };
        const projection = { schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: portable.instrumentKey, objectType: portable.objectType, objectKey, title: portable.title, summary: portable.summary, state: "draft", classification: portable.classification, visibility: portable.visibility, ownerSeatId: access.seat.id, data: portable.data, sourceReference, evidenceIds: [], version: 1 };
        const object = { id: objectId, companyId: access.company.id, instrumentKey: portable.instrumentKey, objectType: portable.objectType, objectKey, title: portable.title, summary: portable.summary, state: "draft", classification: portable.classification, visibility: portable.visibility, ownerSeatId: access.seat.id, parentObjectId: null, data: portable.data, sourceReference, evidenceIds: [], contentSha256: nativeContractContentSha256(projection), version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now, archivedAt: null };
        await tx.insert(eosInstrumentObjects).values(object);
        await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: portable.instrumentKey, objectId, commandType: "object.import", idempotencyKey, expectedVersion: null, payload: { bundleSha256, sourceObjectKey: portable.objectKey }, state: "completed", result: { objectId, version: 1 }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
        await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: portable.instrumentKey, objectId, commandId, eventType: "object.imported", fromState: null, toState: "draft", objectVersion: 1, payload: { bundleSha256, sourceObjectKey: portable.objectKey }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId, commandId, eventType: "object.imported", toState: "draft", objectVersion: 1 }), recordedByUserId: req.user.id, createdAt: now });
        created.push(object); importedByKey.set(sourceKey, object);
      }
      let linked = 0;
      for (let index = 0; index < input.bundle.links.length; index += 1) {
        const portableLink = input.bundle.links[index];
        const source = importedByKey.get(`${portableLink.source.instrumentKey}:${portableLink.source.objectKey}`);
        const target = importedByKey.get(`${portableLink.target.instrumentKey}:${portableLink.target.objectKey}`);
        if (!source || !target || source.id === target.id) continue;
        const linkId = randomUUID(); const commandId = randomUUID();
        const inserted = await tx.insert(eosInstrumentLinks).values({ id: linkId, companyId: access.company.id, sourceObjectId: source.id, targetObjectId: target.id, relationshipType: portableLink.relationshipType, metadata: portableLink.metadata, createdByUserId: req.user.id, createdAt: now }).onConflictDoNothing().returning();
        if (!inserted[0]) continue;
        await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandType: "link.import", idempotencyKey: `${input.idempotencyKey}:link:${index}`, expectedVersion: source.version, payload: { linkId, targetObjectId: target.id, relationshipType: portableLink.relationshipType, bundleSha256 }, state: "completed", result: { linkId }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
        await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandId, eventType: "relationship.imported", fromState: source.state, toState: source.state, objectVersion: source.version, payload: { linkId, targetObjectId: target.id, relationshipType: portableLink.relationshipType, bundleSha256 }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: source.id, commandId, eventType: "relationship.imported", linkId }), recordedByUserId: req.user.id, createdAt: now });
        linked += 1;
      }
      const summary = { imported: created.length, skipped: skipped.length, linked, objectIds: created.map((object) => object.id), bundleSha256 };
      await tx.insert(eosInstrumentCommands).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: input.bundle.objects[0].instrumentKey, objectId: null, commandType: "bundle.import", idempotencyKey: input.idempotencyKey, expectedVersion: null, payload: { conflictStrategy: input.conflictStrategy, objectCount: input.bundle.objects.length, linkCount: input.bundle.links.length, bundleSha256 }, state: "completed", result: summary, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.bundle.imported", targetType: "instrument_bundle", targetId: bundleSha256, traceId: policy.traceId, correlationId: policy.correlationId, result: "drafts_created", details: { ...summary, policyDecisionId: policy.decisionId }, createdAt: now });
      return { ...summary, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json({ schemaVersion: "eos.instrument-import-result.v1", ...result });
  }));

  app.post("/api/eos/companies/:companyId/instrument-objects", route(async (req, res) => {
    const input = instrumentObjectCreateSchema.parse(req.body);
    assertCredentialFree(input);
    const { access, policy } = await instrumentAccess(req, "execute", input.instrumentKey, "instrument.object.create", input.classification);
    const replay = await replayCommand(access.company.id, input.idempotencyKey, input.instrumentKey, "object.create");
    if (replay) { res.status(200).json(replay); return; }
    await checkedEvidence(access.company.id, input.evidenceIds);
    if (input.parentObjectId) {
      const [parent] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, input.parentObjectId), eq(eosInstrumentObjects.instrumentKey, input.instrumentKey))).limit(1);
      if (!parent) throw new EosRouteError(409, "instrument_parent_invalid", "Parent objects must exist inside the same company and instrument.");
    }
    const now = new Date(); const objectId = randomUUID(); const commandId = randomUUID();
    const projection = { companyId: access.company.id, ownerSeatId: access.seat.id, state: "draft", version: 1, ...input };
    const object = { id: objectId, companyId: access.company.id, instrumentKey: input.instrumentKey, objectType: input.objectType, objectKey: input.objectKey, title: input.title, summary: input.summary, state: "draft", classification: input.classification, visibility: input.visibility, ownerSeatId: access.seat.id, parentObjectId: input.parentObjectId || null, data: input.data, sourceReference: input.sourceReference, evidenceIds: input.evidenceIds, contentSha256: nativeContractContentSha256(projection), version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now, archivedAt: null };
    const event = { id: randomUUID(), companyId: access.company.id, instrumentKey: input.instrumentKey, objectId, commandId, eventType: "object.created", fromState: null, toState: "draft", objectVersion: 1, payload: { objectType: input.objectType, objectKey: input.objectKey }, evidenceIds: input.evidenceIds, contentSha256: eventHash({ companyId: access.company.id, objectId, commandId, eventType: "object.created", toState: "draft", objectVersion: 1 }), recordedByUserId: req.user.id, createdAt: now };
    await db.transaction(async (tx) => {
      await tx.insert(eosInstrumentObjects).values(object);
      await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: input.instrumentKey, objectId, commandType: "object.create", idempotencyKey: input.idempotencyKey, expectedVersion: null, payload: { objectType: input.objectType, objectKey: input.objectKey }, state: "completed", result: { objectId, version: 1 }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosInstrumentEvents).values(event);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.object.created", targetType: input.instrumentKey, targetId: objectId, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { objectType: input.objectType, commandId, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json({ command: { id: commandId, state: "completed" }, object, replayed: false });
  }));

  app.patch("/api/eos/companies/:companyId/instrument-objects/:objectId", route(async (req, res) => {
    const input = instrumentObjectUpdateSchema.parse(req.body); assertCredentialFree(input);
    const [current] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, req.params.objectId), eq(eosInstrumentObjects.companyId, Number(req.params.companyId)))).limit(1);
    if (!current) throw new EosRouteError(404, "instrument_object_not_found", "Instrument object not found.");
    const { access, policy } = await instrumentAccess(req, "execute", current.instrumentKey, "instrument.object.update", input.classification || current.classification);
    const replay = await replayCommand(access.company.id, input.idempotencyKey, current.instrumentKey, "object.update"); if (replay) { res.json(replay); return; }
    if (current.version !== input.expectedVersion) throw new EosRouteError(409, "instrument_version_conflict", "The instrument object changed before this update.");
    if (current.state === "archived") throw new EosRouteError(409, "instrument_object_archived", "Archived instrument objects are immutable through the normal lifecycle.");
    const evidence = input.evidenceIds ?? current.evidenceIds as string[]; await checkedEvidence(access.company.id, evidence);
    const next = { title: input.title ?? current.title, summary: input.summary ?? current.summary, classification: input.classification ?? current.classification, visibility: input.visibility ?? current.visibility, data: input.data ?? current.data as Record<string, unknown>, sourceReference: input.sourceReference ?? current.sourceReference as Record<string, unknown>, evidenceIds: evidence, version: current.version + 1, updatedAt: new Date() };
    if (["active", "completed"].includes(current.state)) {
      const findings = instrumentDomainFindings(eosInstrumentKeySchema.parse(current.instrumentKey), current.objectType, next.data);
      if (findings.length) throw new EosRouteError(409, findings[0].code, findings[0].message);
    }
    const commandId = randomUUID(); const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(eosInstrumentObjects).set({ ...next, contentSha256: nativeContractContentSha256({ schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: current.instrumentKey, objectType: current.objectType, objectKey: current.objectKey, state: current.state, ...next }) }).where(and(eq(eosInstrumentObjects.id, current.id), eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.version, current.version))).returning();
      if (!rows[0]) throw new EosRouteError(409, "instrument_concurrent_change", "The instrument object changed before this update completed.");
      await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: current.instrumentKey, objectId: current.id, commandType: "object.update", idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, payload: { changedFields: Object.keys(input).filter((key) => !["idempotencyKey", "expectedVersion"].includes(key)) }, state: "completed", result: { objectId: current.id, version: next.version }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: current.instrumentKey, objectId: current.id, commandId, eventType: "object.updated", fromState: current.state, toState: current.state, objectVersion: next.version, payload: { changedFields: Object.keys(input).filter((key) => !["idempotencyKey", "expectedVersion"].includes(key)) }, evidenceIds: evidence, contentSha256: eventHash({ companyId: access.company.id, objectId: current.id, commandId, eventType: "object.updated", toState: current.state, objectVersion: next.version }), recordedByUserId: req.user.id, createdAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.object.updated", targetType: current.instrumentKey, targetId: current.id, traceId: policy.traceId, correlationId: policy.correlationId, result: current.state, details: { commandId, fromVersion: current.version, toVersion: next.version, policyDecisionId: policy.decisionId }, createdAt: now });
      return rows;
    });
    res.json({ command: { id: commandId, state: "completed" }, object: updated, replayed: false });
  }));

  app.post("/api/eos/companies/:companyId/instrument-objects/:objectId/transitions", route(async (req, res) => {
    const input = instrumentTransitionSchema.parse(req.body); assertCredentialFree(input);
    const [current] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, req.params.objectId), eq(eosInstrumentObjects.companyId, Number(req.params.companyId)))).limit(1);
    if (!current) throw new EosRouteError(404, "instrument_object_not_found", "Instrument object not found.");
    const consequential = ["active", "completed", "cancelled", "archived"].includes(input.state);
    const { access, policy } = await instrumentAccess(req, consequential ? "decide" : "execute", current.instrumentKey, "instrument.object.transition", current.classification);
    const replay = await replayCommand(access.company.id, input.idempotencyKey, current.instrumentKey, "object.transition"); if (replay) { res.json(replay); return; }
    if (current.version !== input.expectedVersion) throw new EosRouteError(409, "instrument_version_conflict", "The instrument object changed before this transition.");
    if (!mayTransitionInstrumentObject(current.state, input.state)) throw new EosRouteError(409, "instrument_transition_invalid", `Instrument objects cannot move from ${current.state} to ${input.state}.`);
    if (["active", "completed"].includes(input.state)) {
      const findings = instrumentDomainFindings(eosInstrumentKeySchema.parse(current.instrumentKey), current.objectType, current.data);
      if (findings.length) throw new EosRouteError(409, findings[0].code, findings[0].message);
    }
    await checkedEvidence(access.company.id, input.evidenceIds, input.state === "completed");
    const commandId = randomUUID(); const now = new Date(); const nextVersion = current.version + 1;
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(eosInstrumentObjects).set({ state: input.state, evidenceIds: input.evidenceIds, version: nextVersion, updatedAt: now, archivedAt: input.state === "archived" ? now : null, contentSha256: nativeContractContentSha256({ schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: current.instrumentKey, objectType: current.objectType, objectKey: current.objectKey, title: current.title, summary: current.summary, state: input.state, classification: current.classification, visibility: current.visibility, ownerSeatId: current.ownerSeatId, data: current.data, sourceReference: current.sourceReference, evidenceIds: input.evidenceIds, version: nextVersion }) }).where(and(eq(eosInstrumentObjects.id, current.id), eq(eosInstrumentObjects.version, current.version))).returning();
      if (!rows[0]) throw new EosRouteError(409, "instrument_concurrent_change", "The instrument object changed before this transition completed.");
      await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: current.instrumentKey, objectId: current.id, commandType: "object.transition", idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, payload: { state: input.state, rationale: input.rationale }, state: "completed", result: { objectId: current.id, version: nextVersion, state: input.state }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: current.instrumentKey, objectId: current.id, commandId, eventType: "object.transitioned", fromState: current.state, toState: input.state, objectVersion: nextVersion, payload: { rationale: input.rationale }, evidenceIds: input.evidenceIds, contentSha256: eventHash({ companyId: access.company.id, objectId: current.id, commandId, eventType: "object.transitioned", fromState: current.state, toState: input.state, objectVersion: nextVersion }), recordedByUserId: req.user.id, createdAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.object.transitioned", targetType: current.instrumentKey, targetId: current.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { commandId, from: current.state, to: input.state, rationale: input.rationale, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
      return rows;
    });
    res.json({ command: { id: commandId, state: "completed" }, object: updated, replayed: false });
  }));

  app.post("/api/eos/companies/:companyId/instrument-links", route(async (req, res) => {
    const input = instrumentLinkCreateSchema.parse(req.body); assertCredentialFree(input);
    const objects = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, Number(req.params.companyId)), inArray(eosInstrumentObjects.id, [input.sourceObjectId, input.targetObjectId])));
    if (objects.length !== 2) throw new EosRouteError(409, "instrument_link_scope_invalid", "Both linked objects must resolve inside the selected company.");
    const source = objects.find((item) => item.id === input.sourceObjectId)!;
    const { access, policy } = await instrumentAccess(req, "execute", source.instrumentKey, "instrument.link.create", source.classification);
    const replay = await replayCommand(access.company.id, input.idempotencyKey, source.instrumentKey, "link.create"); if (replay) { res.json(replay); return; }
    const now = new Date(); const linkId = randomUUID(); const commandId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(eosInstrumentLinks).values({ id: linkId, companyId: access.company.id, sourceObjectId: input.sourceObjectId, targetObjectId: input.targetObjectId, relationshipType: input.relationshipType, metadata: input.metadata, createdByUserId: req.user.id, createdAt: now });
      await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandType: "link.create", idempotencyKey: input.idempotencyKey, expectedVersion: source.version, payload: { linkId, targetObjectId: input.targetObjectId, relationshipType: input.relationshipType }, state: "completed", result: { linkId }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandId, eventType: "relationship.created", fromState: source.state, toState: source.state, objectVersion: source.version, payload: { linkId, targetObjectId: input.targetObjectId, relationshipType: input.relationshipType }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: source.id, commandId, eventType: "relationship.created", linkId }), recordedByUserId: req.user.id, createdAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.relationship.created", targetType: source.instrumentKey, targetId: linkId, traceId: policy.traceId, correlationId: policy.correlationId, result: "created", details: { sourceObjectId: source.id, targetObjectId: input.targetObjectId, relationshipType: input.relationshipType, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json({ command: { id: commandId, state: "completed" }, link: { id: linkId, companyId: access.company.id, ...input, idempotencyKey: undefined, createdByUserId: req.user.id, createdAt: now }, replayed: false });
  }));
}
