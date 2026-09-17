import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords,
  eosAgentEventOutbox,
  eosEvidence,
  eosInstrumentCommands,
  eosInstrumentEvents,
  eosInstrumentLinks,
  eosInstrumentObjects,
  eosSeats,
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
import { dispatchAgentEventOutboxEvent } from "../agents/scheduler";
import {
  authorizeAction,
  companyAccess,
  EosRouteError,
  mayAccessClassification,
  visibleInstrumentKeysForAccess,
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
    // Instrument routes must enforce the same role-tool boundary used by the
    // Work Room. Without this, a seat could bypass a hidden surface by calling
    // its generic instrument endpoint directly.
    toolKey: key,
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Messages are a native company capability, but they must still follow the
 * reporting graph. This prevents a role from using generic instrument storage
 * to skip its manager, direct reports, or role assistant.
 */
async function assertNativeMessageCreate(
  access: Awaited<ReturnType<typeof companyAccess>>,
  input: {
    instrumentKey: string;
    objectType: string;
    data: Record<string, unknown>;
    parentObjectId?: string;
    visibility: string;
  },
) {
  if (input.instrumentKey !== "messages") return;
  const data = recordValue(input.data);
  if (input.objectType === "conversation") {
    const supplied = data.participantSeatIds;
    if (!Array.isArray(supplied) || supplied.length < 2 || supplied.some((seatId) => typeof seatId !== "string"))
      throw new EosRouteError(400, "message_participants_invalid", "A native conversation requires at least two named organizational seats.");
    const participantSeatIds = supplied as string[];
    const uniqueParticipantSeatIds = Array.from(new Set(participantSeatIds));
    if (uniqueParticipantSeatIds.length !== participantSeatIds.length)
      throw new EosRouteError(400, "message_participants_duplicate", "Conversation participants must be unique.");
    if (!uniqueParticipantSeatIds.includes(access.seat.id))
      throw new EosRouteError(403, "message_creator_not_participant", "The current organizational seat must participate in a conversation it creates.");
    if (input.visibility !== "team")
      throw new EosRouteError(400, "message_visibility_invalid", "Native conversations use team visibility; participant membership controls the reader set.");
    const seats = await db.select().from(eosSeats).where(and(
      eq(eosSeats.companyId, access.company.id),
      eq(eosSeats.status, "active"),
      inArray(eosSeats.id, uniqueParticipantSeatIds),
    ));
    if (seats.length !== uniqueParticipantSeatIds.length)
      throw new EosRouteError(409, "message_participant_scope_invalid", "Every conversation participant must be an active seat in this company.");
    const requester = seats.find((seat) => seat.id === access.seat.id) || access.seat;
    for (const participant of seats) {
      if (participant.id === requester.id) continue;
      const adjacent = participant.supervisorSeatId === requester.id || requester.supervisorSeatId === participant.id;
      if (!adjacent)
        throw new EosRouteError(403, "message_reporting_path_required", "Native conversations may include only the current seat's direct manager or direct reports. Use the role assistant to orchestrate a non-adjacent request.");
    }
    return;
  }

  if (!['message', 'thread'].includes(input.objectType)) return;
  const conversationObjectId = data.conversationObjectId;
  if (typeof conversationObjectId !== "string" || !conversationObjectId)
    throw new EosRouteError(400, "message_conversation_required", "Messages and threads must identify their native conversation.");
  if (input.parentObjectId !== conversationObjectId)
    throw new EosRouteError(400, "message_parent_required", "Messages and threads must be nested beneath their named native conversation.");
  const [conversation] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.id, conversationObjectId),
    eq(eosInstrumentObjects.instrumentKey, "messages"),
    eq(eosInstrumentObjects.objectType, "conversation"),
  )).limit(1);
  if (!conversation)
    throw new EosRouteError(409, "message_conversation_scope_invalid", "The named conversation must exist inside this company.");
  const participantSeatIds = recordValue(conversation.data).participantSeatIds;
  if (!Array.isArray(participantSeatIds) || !participantSeatIds.includes(access.seat.id))
    throw new EosRouteError(403, "message_conversation_membership_required", "Only a named participant may add messages or threads to this conversation.");
  if (input.objectType === "message") {
    if (typeof data.body !== "string" || !data.body.trim())
      throw new EosRouteError(400, "message_body_required", "A native message requires a non-empty body.");
    if (!['native_eos', 'email', 'slack', 'sms', 'social'].includes(String(data.channelType)))
      throw new EosRouteError(400, "message_channel_invalid", "Messages must use a declared native or external delivery channel.");
  }
}

/**
 * Conference Rooms are native decision environments. Their records must form
 * one auditable chain (room → meeting → decision) and a named decision-maker
 * must actually have attended the meeting they are recorded against.
 */
async function assertNativeConferenceRoomCreate(
  access: Awaited<ReturnType<typeof companyAccess>>,
  input: {
    instrumentKey: string;
    objectType: string;
    data: Record<string, unknown>;
    parentObjectId?: string;
  },
) {
  if (input.instrumentKey !== "conference_rooms" || !["meeting", "decision"].includes(input.objectType)) return;
  const data = recordValue(input.data);
  if (input.objectType === "meeting") {
    const roomObjectId = typeof data.roomObjectId === "string" ? data.roomObjectId : "";
    if (!roomObjectId || input.parentObjectId !== roomObjectId)
      throw new EosRouteError(400, "conference_meeting_room_required", "A native meeting must be nested beneath its named Conference Room.");
    const [room] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, roomObjectId),
      eq(eosInstrumentObjects.companyId, access.company.id),
      eq(eosInstrumentObjects.instrumentKey, "conference_rooms"),
      eq(eosInstrumentObjects.objectType, "room"),
    )).limit(1);
    if (!room) throw new EosRouteError(409, "conference_meeting_room_invalid", "The selected Conference Room must exist inside this company.");
    const supplied = data.participantSeatIds;
    if (!Array.isArray(supplied) || !supplied.length || supplied.some((seatId) => typeof seatId !== "string"))
      throw new EosRouteError(400, "conference_meeting_participants_required", "A native meeting needs at least one named active company participant.");
    const participantSeatIds = supplied as string[];
    if (new Set(participantSeatIds).size !== participantSeatIds.length)
      throw new EosRouteError(400, "conference_meeting_participants_duplicate", "Meeting participants must be unique.");
    const activeSeats = await db.select({ id: eosSeats.id }).from(eosSeats).where(and(
      eq(eosSeats.companyId, access.company.id),
      eq(eosSeats.status, "active"),
      inArray(eosSeats.id, participantSeatIds),
    ));
    if (activeSeats.length !== participantSeatIds.length)
      throw new EosRouteError(409, "conference_meeting_participant_scope_invalid", "Every meeting participant must be an active seat in this company.");
    return;
  }

  const meetingObjectId = typeof data.meetingObjectId === "string" ? data.meetingObjectId : "";
  const decidedBySeatId = typeof data.decidedBySeatId === "string" ? data.decidedBySeatId : "";
  if (!meetingObjectId || input.parentObjectId !== meetingObjectId || !decidedBySeatId)
    throw new EosRouteError(400, "conference_decision_context_required", "A decision must be nested beneath its meeting and name the participant who made it.");
  const [meeting] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, meetingObjectId),
    eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.instrumentKey, "conference_rooms"),
    eq(eosInstrumentObjects.objectType, "meeting"),
  )).limit(1);
  if (!meeting) throw new EosRouteError(409, "conference_decision_meeting_invalid", "The selected governing meeting must exist inside this company.");
  const participants = recordValue(meeting.data).participantSeatIds;
  if (!Array.isArray(participants) || !participants.includes(decidedBySeatId))
    throw new EosRouteError(409, "conference_decision_maker_invalid", "The recorded decision-maker must be a named participant in the governing meeting.");
}

async function visibleObjectSet(access: Awaited<ReturnType<typeof companyAccess>>, objects: typeof eosInstrumentObjects.$inferSelect[]) {
  const seatIds = await visibleSeatIds(access.company.id, access.seat.id, access.role);
  const messageConversationParticipants = new Map<string, Set<string>>(
    objects
      .filter((object) => object.instrumentKey === "messages" && object.objectType === "conversation")
      .map((object) => [
        object.id,
        new Set(
          Array.isArray((object.data as Record<string, unknown>).participantSeatIds)
            ? ((object.data as Record<string, unknown>).participantSeatIds as unknown[])
              .filter((seatId): seatId is string => typeof seatId === "string")
            : [],
        ),
      ]),
  );
  return objects.filter((object) => {
    if (!mayAccessClassification(access, object.classification)) return false;
    // A reporting-line relationship does not silently grant access to every
    // private thread. A manager receives an escalation by being named in it.
    if (object.instrumentKey === "messages") {
      const data = object.data as Record<string, unknown>;
      const conversationId = object.objectType === "conversation"
        ? object.id
        : typeof data.conversationObjectId === "string"
          ? data.conversationObjectId
          : object.parentObjectId;
      if (!conversationId || !messageConversationParticipants.get(conversationId)?.has(access.seat.id)) return false;
    }
    if (object.visibility === "seat") return object.ownerSeatId === access.seat.id;
    if (object.visibility === "team") return seatIds.has(object.ownerSeatId);
    if (object.visibility === "portfolio") return ["founder", "portfolio_executive"].includes(access.role);
    return true;
  });
}

function permittedInstrumentKeySet(
  access: Awaited<ReturnType<typeof companyAccess>>,
  principalKey: string,
) {
  return new Set(visibleInstrumentKeysForAccess(access, principalKey));
}

function objectsForPermittedInstruments(
  objects: typeof eosInstrumentObjects.$inferSelect[],
  permittedKeys: Set<string>,
) {
  return objects.filter((object) => permittedKeys.has(object.instrumentKey));
}

function requirePermittedInstrumentKeys(permittedKeys: Set<string>) {
  if (!permittedKeys.size)
    throw new EosRouteError(
      403,
      "instrument_scope_denied",
      "This seat has no native tools assigned in its current organization contract.",
    );
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
    const permittedKeys = permittedInstrumentKeySet(access, req.user.id);
    requirePermittedInstrumentKeys(permittedKeys);
    const objects = await db.select().from(eosInstrumentObjects).where(eq(eosInstrumentObjects.companyId, access.company.id)).orderBy(desc(eosInstrumentObjects.updatedAt));
    const visible = await visibleObjectSet(
      access,
      objectsForPermittedInstruments(objects, permittedKeys),
    );
    const visibleIds = visible.map((object) => object.id);
    const [links, events] = visibleIds.length ? await Promise.all([
      db.select().from(eosInstrumentLinks).where(and(eq(eosInstrumentLinks.companyId, access.company.id), inArray(eosInstrumentLinks.sourceObjectId, visibleIds), inArray(eosInstrumentLinks.targetObjectId, visibleIds))),
      db.select().from(eosInstrumentEvents).where(and(eq(eosInstrumentEvents.companyId, access.company.id), inArray(eosInstrumentEvents.objectId, visibleIds))).orderBy(desc(eosInstrumentEvents.createdAt)),
    ]) : [[], []];
    const counts = Object.fromEntries(instrumentManifestProjection().map((instrument) => [instrument.key, visible.filter((object) => object.instrumentKey === instrument.key).length]));
    res.json({ schemaVersion: "eos.instrument-runtime.v1", manifest: instrumentManifestProjection().filter((instrument) => permittedKeys.has(instrument.key)), permittedInstrumentKeys: Array.from(permittedKeys), objects: visible, links, events: events.slice(0, 250), counts });
  }));

  app.get("/api/eos/companies/:companyId/instruments/:instrumentKey", route(async (req, res) => {
    const { access, key } = await instrumentAccess(req, "view", req.params.instrumentKey, "instrument.read", "internal");
    const objects = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.instrumentKey, key))).orderBy(desc(eosInstrumentObjects.updatedAt));
    const visible = await visibleObjectSet(access, objects);
    // A focused native tool must be able to explain how its own governed
    // records changed without requiring access to the whole company-wide
    // instrument manifest.  This is particularly important for Documents:
    // a role can review its authorized version history while still being
    // unable to browse unrelated Finance, CRM, or People records.
    const visibleIds = visible.map((object) => object.id);
    const events = visibleIds.length
      ? await db.select().from(eosInstrumentEvents)
        .where(and(eq(eosInstrumentEvents.companyId, access.company.id), inArray(eosInstrumentEvents.objectId, visibleIds)))
        .orderBy(desc(eosInstrumentEvents.createdAt))
      : [];
    res.json({ schemaVersion: "eos.instrument-runtime.v1", instrument: instrumentManifestProjection().find((item) => item.key === key), objects: visible, events: events.slice(0, 250) });
  }));

  app.get("/api/eos/companies/:companyId/instrument-search", route(async (req, res) => {
    const input = instrumentSearchSchema.parse(req.query);
    const access = await companyAccess(req);
    const permittedKeys = permittedInstrumentKeySet(access, req.user.id);
    requirePermittedInstrumentKeys(permittedKeys);
    if (input.instrumentKey)
      await instrumentAccess(req, "view", input.instrumentKey, "instrument.read", "internal");
    const conditions = [eq(eosInstrumentObjects.companyId, access.company.id)];
    if (input.instrumentKey) conditions.push(eq(eosInstrumentObjects.instrumentKey, input.instrumentKey));
    if (input.state) conditions.push(eq(eosInstrumentObjects.state, input.state));
    if (input.query) conditions.push(or(ilike(eosInstrumentObjects.title, `%${input.query}%`), ilike(eosInstrumentObjects.summary, `%${input.query}%`), ilike(eosInstrumentObjects.objectKey, `%${input.query}%`))!);
    const objects = await db.select().from(eosInstrumentObjects).where(and(...conditions)).orderBy(desc(eosInstrumentObjects.updatedAt)).limit(input.limit);
    res.json({ schemaVersion: "eos.instrument-search.v1", query: input.query, results: await visibleObjectSet(access, objectsForPermittedInstruments(objects, permittedKeys)) });
  }));

  app.get("/api/eos/companies/:companyId/instrument-export", route(async (req, res) => {
    const access = await companyAccess(req);
    const instrumentKey = req.query.instrumentKey ? eosInstrumentKeySchema.parse(req.query.instrumentKey) : undefined;
    const permittedKeys = permittedInstrumentKeySet(access, req.user.id);
    requirePermittedInstrumentKeys(permittedKeys);
    if (instrumentKey) await instrumentAccess(req, "view", instrumentKey, "instrument.bundle.export", "internal");
    const rows = await db.select().from(eosInstrumentObjects).where(instrumentKey ? and(eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.instrumentKey, instrumentKey)) : eq(eosInstrumentObjects.companyId, access.company.id)).orderBy(desc(eosInstrumentObjects.updatedAt));
    const objects = await visibleObjectSet(access, objectsForPermittedInstruments(rows, permittedKeys));
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
    // A portable bundle may span several tools.  Treating it as one broad
    // instrument:* command would let a role with Docs import Finance or CRM
    // records.  Every imported source tool must independently authorize the
    // same execute action that a normal native create would require.
    const importPolicies = new Map<string, Awaited<ReturnType<typeof authorizeAction>>>();
    for (const instrumentKey of Array.from(new Set(input.bundle.objects.map((object) => object.instrumentKey)))) {
      importPolicies.set(instrumentKey, await authorizeAction(req, access, {
        authorityClass: "execute", resource: `instrument:${instrumentKey}`, actionKey: "instrument.bundle.import", purpose: "import_instrument_drafts", classification: "confidential", consequence: "routine", targetSeatId: access.seat.id, toolKey: instrumentKey,
      }));
    }
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
        await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: portable.instrumentKey, objectId, commandType: "object.import", idempotencyKey, expectedVersion: null, payload: { bundleSha256, sourceObjectKey: portable.objectKey }, state: "completed", result: { objectId, version: 1 }, policyDecisionId: importPolicies.get(portable.instrumentKey)!.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
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
        await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandType: "link.import", idempotencyKey: `${input.idempotencyKey}:link:${index}`, expectedVersion: source.version, payload: { linkId, targetObjectId: target.id, relationshipType: portableLink.relationshipType, bundleSha256 }, state: "completed", result: { linkId }, policyDecisionId: importPolicies.get(source.instrumentKey)!.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
        await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandId, eventType: "relationship.imported", fromState: source.state, toState: source.state, objectVersion: source.version, payload: { linkId, targetObjectId: target.id, relationshipType: portableLink.relationshipType, bundleSha256 }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: source.id, commandId, eventType: "relationship.imported", linkId }), recordedByUserId: req.user.id, createdAt: now });
        linked += 1;
      }
      const summary = { imported: created.length, skipped: skipped.length, linked, objectIds: created.map((object) => object.id), bundleSha256 };
      const primaryPolicy = importPolicies.get(input.bundle.objects[0].instrumentKey)!;
      await tx.insert(eosInstrumentCommands).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: input.bundle.objects[0].instrumentKey, objectId: null, commandType: "bundle.import", idempotencyKey: input.idempotencyKey, expectedVersion: null, payload: { conflictStrategy: input.conflictStrategy, objectCount: input.bundle.objects.length, linkCount: input.bundle.links.length, bundleSha256 }, state: "completed", result: summary, policyDecisionId: primaryPolicy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.bundle.imported", targetType: "instrument_bundle", targetId: bundleSha256, traceId: primaryPolicy.traceId, correlationId: primaryPolicy.correlationId, result: "drafts_created", details: { ...summary, policyDecisionIds: Object.fromEntries(Array.from(importPolicies.entries()).map(([key, decision]) => [key, decision.decisionId])) }, createdAt: now });
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
    await assertNativeMessageCreate(access, input);
    await assertNativeConferenceRoomCreate(access, input);
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
    const commandId = randomUUID(); const instrumentEventId = randomUUID(); const agentEventId = randomUUID(); const now = new Date(); const nextVersion = current.version + 1;
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(eosInstrumentObjects).set({ state: input.state, evidenceIds: input.evidenceIds, version: nextVersion, updatedAt: now, archivedAt: input.state === "archived" ? now : null, contentSha256: nativeContractContentSha256({ schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: current.instrumentKey, objectType: current.objectType, objectKey: current.objectKey, title: current.title, summary: current.summary, state: input.state, classification: current.classification, visibility: current.visibility, ownerSeatId: current.ownerSeatId, data: current.data, sourceReference: current.sourceReference, evidenceIds: input.evidenceIds, version: nextVersion }) }).where(and(eq(eosInstrumentObjects.id, current.id), eq(eosInstrumentObjects.version, current.version))).returning();
      if (!rows[0]) throw new EosRouteError(409, "instrument_concurrent_change", "The instrument object changed before this transition completed.");
      await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: current.instrumentKey, objectId: current.id, commandType: "object.transition", idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, payload: { state: input.state, rationale: input.rationale }, state: "completed", result: { objectId: current.id, version: nextVersion, state: input.state }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosInstrumentEvents).values({ id: instrumentEventId, companyId: access.company.id, instrumentKey: current.instrumentKey, objectId: current.id, commandId, eventType: "object.transitioned", fromState: current.state, toState: input.state, objectVersion: nextVersion, payload: { rationale: input.rationale }, evidenceIds: input.evidenceIds, contentSha256: eventHash({ companyId: access.company.id, objectId: current.id, commandId, eventType: "object.transitioned", fromState: current.state, toState: input.state, objectVersion: nextVersion }), recordedByUserId: req.user.id, createdAt: now });
      // The instrument event and its automation trigger share one transaction:
      // a committed native lifecycle change cannot lose its downstream Role
      // Agent handoff, and a failed handoff remains retryable in EOS.
      await tx.insert(eosAgentEventOutbox).values({
        id: agentEventId,
        companyId: access.company.id,
        eventType: "eos.instrument.object.transitioned.v1",
        aggregateType: "instrument_object",
        aggregateId: current.id,
        // Exclude free-form rationale and object data. A Role Agent receives
        // bounded lifecycle metadata, then reads the object only through its
        // own existing tenant, role, and classification authority.
        payload: {
          schemaVersion: "eos.instrument.object.transitioned.v1",
          instrumentEventId,
          instrumentKey: current.instrumentKey,
          objectId: current.id,
          objectType: current.objectType,
          commandId,
          fromState: current.state,
          toState: input.state,
          objectVersion: nextVersion,
          classification: current.classification,
          externalEffectsExecuted: false,
        },
        state: "pending",
        attempts: 0,
        dispatchedRunIds: [],
        lastError: "",
        occurredAt: now,
        dispatchedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.object.transitioned", targetType: current.instrumentKey, targetId: current.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { commandId, from: current.state, to: input.state, rationale: input.rationale, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
      return rows;
    });
    const agentEvent = await dispatchAgentEventOutboxEvent(agentEventId);
    res.json({ command: { id: commandId, state: "completed" }, object: updated, replayed: false, agentEvent: agentEvent ? { id: agentEventId, state: agentEvent.event.state, matchingSchedules: agentEvent.runIds.length, runIds: agentEvent.runIds } : null });
  }));

  app.post("/api/eos/companies/:companyId/instrument-links", route(async (req, res) => {
    const input = instrumentLinkCreateSchema.parse(req.body); assertCredentialFree(input);
    const objects = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, Number(req.params.companyId)), inArray(eosInstrumentObjects.id, [input.sourceObjectId, input.targetObjectId])));
    if (objects.length !== 2) throw new EosRouteError(409, "instrument_link_scope_invalid", "Both linked objects must resolve inside the selected company.");
    const source = objects.find((item) => item.id === input.sourceObjectId)!;
    const target = objects.find((item) => item.id === input.targetObjectId)!;
    const { access, policy } = await instrumentAccess(req, "execute", source.instrumentKey, "instrument.link.create", source.classification);
    // Relationships can reveal the existence and purpose of their target.
    // Require the same focused read permission on that target before linking;
    // a source-tool grant is never a back door into another role's tool data.
    await instrumentAccess(req, "view", target.instrumentKey, "instrument.read", target.classification);
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
