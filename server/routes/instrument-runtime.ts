import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z, ZodError } from "zod";
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
  commerceOrderFromCrmSchema,
  commerceOrderDeliveryProjectSchema,
  eosInstrumentKeySchema,
  crmOpportunityFollowUpActionSchema,
  instrumentDomainFindings,
  instrumentLinkCreateSchema,
  instrumentLinkDeleteSchema,
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
import {
  nativeFileObjectKey,
  nativeFileSha256,
  nativeFileStorageConfigured,
  nativeFileStorageKey,
  readNativeFile,
  removeNativeFile,
  safeNativeFileAttachmentHeader,
  scanNativeFile,
  storeNativeFile,
  validateNativeFile,
  NATIVE_FILE_MAX_BYTES,
} from "../artifacts/native-files";
import { containsCredentialMaterial } from "../security/credential-material";
import { requireScannerBackedArtifactIngress } from "../middleware/untrusted-artifact-ingress";
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

// Internal operating forms intentionally use the same question grammar as
// public lead capture, but never cross the public route boundary.  This lets a
// company build meeting check-ins, project intakes, hiring reviews, and other
// native workflows without turning an internal record into a public endpoint.
const nativeInternalFormQuestionSchema = z.object({
  id: z.string().trim().min(2).max(100).regex(/^[a-z][a-z0-9_:-]*$/i),
  label: z.string().trim().min(2).max(500),
  type: z.enum(["short_text", "long_text", "email", "phone", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(250)).max(100).default([]),
});
const nativeInternalFormDefinitionSchema = z.object({
  internalCapture: z.literal(true),
  questions: z.array(nativeInternalFormQuestionSchema).min(1).max(100),
  consentVersion: z.string().trim().min(2).max(200),
  confirmationMessage: z.string().trim().min(2).max(2_000),
});
const nativeInternalFormSubmissionSchema = z.object({
  answers: z.record(z.string().max(10_000)).default({}),
  idempotencyKey: z.string().trim().min(2).max(200).regex(/^[a-z0-9][a-z0-9._:-]*$/i),
});

function internalFormDefinition(value: unknown) {
  const parsed = nativeInternalFormDefinitionSchema.safeParse(recordValue(value));
  if (!parsed.success)
    throw new EosRouteError(409, "native_form_definition_invalid", "This form must be configured in Native Forms Studio before it can accept internal submissions.");
  const ids = parsed.data.questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length)
    throw new EosRouteError(409, "native_form_question_duplicate", "A native form cannot contain duplicate question identifiers.");
  for (const question of parsed.data.questions) {
    if (question.type === "select" && !question.options.length)
      throw new EosRouteError(409, "native_form_select_options_missing", "Every select question needs at least one permitted option.");
  }
  return parsed.data;
}

function validateInternalFormAnswers(
  definition: z.infer<typeof nativeInternalFormDefinitionSchema>,
  answers: Record<string, string>,
) {
  const allowed = new Set(definition.questions.map((question) => question.id));
  for (const key of Object.keys(answers)) {
    if (!allowed.has(key))
      throw new EosRouteError(400, "native_form_answer_unknown", "An answer does not correspond to a question in this native form.");
  }
  const normalized: Record<string, string> = {};
  for (const question of definition.questions) {
    const value = String(answers[question.id] || "").trim();
    if (question.required && !value)
      throw new EosRouteError(400, "native_form_answer_required", `${question.label} is required.`);
    if (question.type === "email" && value && !z.string().email().safeParse(value).success)
      throw new EosRouteError(400, "native_form_email_invalid", "Enter a valid email address.");
    if (question.type === "select" && value && !question.options.includes(value))
      throw new EosRouteError(400, "native_form_selection_invalid", "Choose one of the listed options.");
    normalized[question.id] = value;
  }
  return normalized;
}

function assertNativeInternalFormDefinition(
  current: typeof eosInstrumentObjects.$inferSelect,
  nextData: Record<string, unknown>,
) {
  if (current.instrumentKey !== "forms" || current.objectType !== "form") return;
  const currentData = recordValue(current.data);
  if (currentData.publicCapture === true || currentData.internalCapture !== true) return;
  const next = internalFormDefinition(nextData);
  // Once active, an answer means exactly what the published question set said
  // at the time it was accepted. Retire or pause the form before changing that
  // semantic contract; a silent active-edit would corrupt review history.
  if (current.state === "active") {
    const currentDefinition = internalFormDefinition(current.data);
    if (JSON.stringify(currentDefinition.questions) !== JSON.stringify(next.questions) || currentDefinition.consentVersion !== next.consentVersion)
      throw new EosRouteError(409, "native_form_active_definition_immutable", "Pause this active native form before changing its questions or consent version.");
  }
}

/**
 * A public form or booking calendar can optionally compile an accepted,
 * consented intake signal into an EOS-native CRM opportunity. That is a
 * cross-instrument commercial operation, so a role that can edit Forms or
 * Calendar alone must not be able to target an unseen CRM pipeline by
 * guessing its identifier. The routing remains optional; when absent, the
 * public intake still follows its ordinary native lead/booking handoff.
 */
async function assertPublicCommercialRouting(
  req: Request,
  access: Awaited<ReturnType<typeof companyAccess>>,
  input: { instrumentKey: string; objectType: string; data: Record<string, unknown>; classification: string },
) {
  const isPublicForm = input.instrumentKey === "forms" && input.objectType === "form" && input.data.publicCapture === true;
  const isPublicCalendar = input.instrumentKey === "calendar" && input.objectType === "calendar" && input.data.publicBooking === true;
  if (!isPublicForm && !isPublicCalendar) return;
  const pipelineObjectId = input.data.commercialPipelineObjectId;
  const initialStage = input.data.commercialInitialStage;
  if (pipelineObjectId === undefined && initialStage === undefined) return;
  if (typeof pipelineObjectId !== "string" || !pipelineObjectId || typeof initialStage !== "string" || !initialStage.trim())
    throw new EosRouteError(400, "public_intake_commercial_routing_invalid", "Choose both a native commercial pipeline and its first stage, or leave automatic opportunity routing off.");
  await authorizeAction(req, access, {
    authorityClass: "execute",
    resource: "instrument:crm",
    actionKey: "instrument.public_intake.route_opportunity",
    purpose: "operate_instrument",
    classification: input.classification,
    consequence: "routine",
    targetSeatId: access.seat.id,
    toolKey: "crm",
  });
  const [pipeline] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, pipelineObjectId), eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "pipeline"), eq(eosInstrumentObjects.state, "active"),
  )).limit(1);
  const stages = recordValue(pipeline?.data).stages;
  if (!pipeline || !Array.isArray(stages) || !stages.includes(initialStage))
    throw new EosRouteError(409, "public_intake_commercial_routing_unavailable", "The selected native commercial pipeline or first stage is unavailable in this company.");
}

/**
 * A CRM-linked order is not just a UI convenience: it creates a company
 * commitment that may later drive an approved collection and delivery.  Keep
 * the commercial source truthful by requiring that the caller can actually
 * read the named buyer and, when present, that the opportunity belongs to
 * that buyer through its canonical CRM relationship.
 */
async function assertNativeCommerceOrderSource(
  req: Request,
  access: Awaited<ReturnType<typeof companyAccess>>,
  input: { instrumentKey: string; objectType: string; data: Record<string, unknown>; classification: string },
) {
  if (input.instrumentKey !== "commerce" || input.objectType !== "order") return null;
  const buyerObjectId = input.data.buyerReference;
  const opportunityObjectId = input.data.sourceOpportunityObjectId;
  if (typeof buyerObjectId !== "string" || !buyerObjectId)
    throw new EosRouteError(400, "commerce_order_buyer_required", "A native order must name a governed CRM buyer.");
  if (opportunityObjectId !== undefined && (typeof opportunityObjectId !== "string" || !opportunityObjectId))
    throw new EosRouteError(400, "commerce_order_opportunity_invalid", "The CRM opportunity reference must be a valid native object identifier when supplied.");
  await authorizeAction(req, access, {
    authorityClass: "view",
    resource: "instrument:crm",
    actionKey: "commerce.order.crm_source.read",
    purpose: "inspect_instrument",
    classification: input.classification,
    consequence: "routine",
    targetSeatId: access.seat.id,
    toolKey: "crm",
  });
  const [buyer] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, buyerObjectId), eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "person"),
  )).limit(1);
  if (!buyer || !(await visibleObjectSet(access, [buyer])).length)
    throw new EosRouteError(409, "commerce_order_buyer_unavailable", "The selected CRM buyer is unavailable for this role.");
  if (!opportunityObjectId) return { buyer, opportunity: null, relationship: null };
  const [opportunity] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, opportunityObjectId), eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "opportunity"),
  )).limit(1);
  if (!opportunity || !(await visibleObjectSet(access, [opportunity])).length)
    throw new EosRouteError(409, "commerce_order_opportunity_unavailable", "The selected CRM opportunity is unavailable for this role.");
  const relationshipObjectId = recordValue(opportunity.data).relationshipObjectId;
  const [relationship] = typeof relationshipObjectId === "string" ? await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, relationshipObjectId), eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "relationship"),
  )).limit(1) : [];
  if (!relationship || !(await visibleObjectSet(access, [relationship])).length || recordValue(relationship.data).personObjectId !== buyer.id)
    throw new EosRouteError(409, "commerce_order_opportunity_buyer_mismatch", "The selected opportunity does not belong to the selected CRM buyer.");
  return { buyer, opportunity, relationship };
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
  if (input.objectType === "thread") {
    if (input.parentObjectId !== conversationObjectId)
      throw new EosRouteError(400, "message_parent_required", "Native threads must be nested beneath their named conversation.");
    return;
  }

  const threadObjectId = data.threadObjectId;
  if (threadObjectId !== undefined && (typeof threadObjectId !== "string" || !threadObjectId))
    throw new EosRouteError(400, "message_thread_invalid", "A message thread reference must be a non-empty native thread identifier.");
  if (typeof threadObjectId === "string") {
    const [thread] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.companyId, access.company.id),
      eq(eosInstrumentObjects.id, threadObjectId),
      eq(eosInstrumentObjects.instrumentKey, "messages"),
      eq(eosInstrumentObjects.objectType, "thread"),
    )).limit(1);
    if (!thread || recordValue(thread.data).conversationObjectId !== conversationObjectId)
      throw new EosRouteError(409, "message_thread_scope_invalid", "The selected thread must belong to this native conversation.");
    if (input.parentObjectId !== threadObjectId)
      throw new EosRouteError(400, "message_thread_parent_required", "A threaded message must be nested beneath its named native thread.");
  } else if (input.parentObjectId !== conversationObjectId) {
    throw new EosRouteError(400, "message_parent_required", "An unthreaded message must be nested beneath its named native conversation.");
  }
  if (input.objectType === "message") {
    if (typeof data.body !== "string" || !data.body.trim())
      throw new EosRouteError(400, "message_body_required", "A native message requires a non-empty body.");
    if (!['native_eos', 'email', 'slack', 'sms', 'imessage', 'instagram', 'social'].includes(String(data.channelType)))
      throw new EosRouteError(400, "message_channel_invalid", "Messages must use a declared native or external delivery channel.");
  }
}

/**
 * Generic instrument updates must not become a backdoor around the reporting
 * chain that is enforced when a conversation is first created.  Conversation
 * identity may evolve, but only a named participant can edit it; changing the
 * participant set must pass the same direct-manager/direct-report validation
 * as a new conversation.  Messages and threads also remain in their original
 * conversation so a caller cannot use PATCH to move a private record.
 */
async function assertNativeMessageUpdate(
  access: Awaited<ReturnType<typeof companyAccess>>,
  current: typeof eosInstrumentObjects.$inferSelect,
  next: { data: Record<string, unknown>; visibility: string },
) {
  if (current.instrumentKey !== "messages") return;
  const currentData = recordValue(current.data);

  if (current.objectType === "conversation") {
    const existingParticipants = currentData.participantSeatIds;
    if (!Array.isArray(existingParticipants) || !existingParticipants.includes(access.seat.id))
      throw new EosRouteError(403, "message_conversation_membership_required", "Only a named participant may update this native conversation.");
    const nextParticipants = recordValue(next.data).participantSeatIds;
    const normalizedExisting = Array.isArray(existingParticipants) ? [...existingParticipants].filter((seatId): seatId is string => typeof seatId === "string").sort() : [];
    const normalizedNext = Array.isArray(nextParticipants) ? [...nextParticipants].filter((seatId): seatId is string => typeof seatId === "string").sort() : [];
    if (normalizedExisting.join("|") === normalizedNext.join("|")) return;
    await assertNativeMessageCreate(access, {
      instrumentKey: current.instrumentKey,
      objectType: current.objectType,
      data: next.data,
      parentObjectId: current.parentObjectId || undefined,
      visibility: next.visibility,
    });
    return;
  }

  if (!["message", "thread"].includes(current.objectType)) return;
  const conversationObjectId = currentData.conversationObjectId;
  if (typeof conversationObjectId !== "string" || !conversationObjectId)
    throw new EosRouteError(409, "message_conversation_scope_invalid", "This message record no longer has a valid native conversation.");
  const [conversation] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.id, conversationObjectId),
    eq(eosInstrumentObjects.instrumentKey, "messages"),
    eq(eosInstrumentObjects.objectType, "conversation"),
  )).limit(1);
  const conversationParticipants = conversation
    ? recordValue(conversation.data).participantSeatIds
    : null;
  if (!Array.isArray(conversationParticipants) || !conversationParticipants.includes(access.seat.id))
    throw new EosRouteError(403, "message_conversation_membership_required", "Only a named participant may update records in this native conversation.");
  if (recordValue(next.data).conversationObjectId !== conversationObjectId)
    throw new EosRouteError(409, "message_conversation_immutable", "Messages and threads cannot be moved between native conversations.");

  if (current.objectType !== "message") return;
  const nextData = recordValue(next.data);
  const currentDeliveryState = String(currentData.deliveryState || "native_recorded");
  const nextDeliveryState = String(nextData.deliveryState || "native_recorded");
  if (currentDeliveryState === "manual_external_observed" && nextDeliveryState !== "manual_external_observed")
    throw new EosRouteError(409, "message_external_observation_immutable", "A recorded manual external observation cannot be downgraded or replaced through the normal message editor.");
  if (nextDeliveryState !== "manual_external_observed") return;
  if (!["manual_external_intent", "manual_external_observed"].includes(currentDeliveryState))
    throw new EosRouteError(409, "message_external_observation_invalid", "Only an existing manual external intent may receive an observed external outcome.");
  if (!["email", "slack", "sms", "imessage", "instagram", "social"].includes(String(currentData.channelType)))
    throw new EosRouteError(409, "message_external_channel_invalid", "Only a declared external channel may receive an observed external outcome.");
  const observation = recordValue(nextData.manualExternalObservation);
  if (!["sent", "delivered", "failed", "unknown"].includes(String(observation.outcome)))
    throw new EosRouteError(400, "message_external_outcome_invalid", "Choose a bounded observed external outcome before recording it.");
  if (typeof observation.note !== "string" || observation.note.trim().length < 10)
    throw new EosRouteError(400, "message_external_observation_note_required", "Record a meaningful operator observation before closing a manual external intent.");
  if (typeof observation.reference !== "string" || observation.reference.trim().length < 3)
    throw new EosRouteError(400, "message_external_observation_reference_required", "Record an external message, conversation, or evidence reference before closing a manual external intent.");
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

/**
 * Canvas is intentionally a visual layer over canonical records, not an
 * alternate graph that can smuggle hidden or cross-company references into a
 * role's workspace.  The UI only offers role-visible records, but the API
 * must enforce the same boundary for a direct caller as well.
 */
async function assertNativeCanvasCreate(
  access: Awaited<ReturnType<typeof companyAccess>>,
  input: {
    instrumentKey: string;
    objectType: string;
    data: Record<string, unknown>;
    parentObjectId?: string;
  },
) {
  if (input.instrumentKey !== "canvas" || !["node", "edge"].includes(input.objectType)) return;
  const data = recordValue(input.data);
  const parentObjectId = input.parentObjectId || "";
  if (!parentObjectId)
    throw new EosRouteError(400, "canvas_parent_required", "A Canvas node or edge must be nested beneath its named visual map.");
  const [canvas] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, parentObjectId), eq(eosInstrumentObjects.companyId, access.company.id),
    eq(eosInstrumentObjects.instrumentKey, "canvas"), eq(eosInstrumentObjects.objectType, "canvas"),
  )).limit(1);
  if (!canvas || !(await visibleObjectSet(access, [canvas])).length)
    throw new EosRouteError(409, "canvas_parent_unavailable", "The selected visual map is unavailable in this authority scope.");

  if (input.objectType === "node") {
    const sourceObjectId = typeof data.sourceObjectId === "string" ? data.sourceObjectId : "";
    if (!sourceObjectId) throw new EosRouteError(400, "canvas_node_source_required", "A Canvas node must name a visible canonical source record.");
    const [source] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, sourceObjectId), eq(eosInstrumentObjects.companyId, access.company.id),
    )).limit(1);
    if (!source || source.instrumentKey === "canvas" || !(await visibleObjectSet(access, [source])).length)
      throw new EosRouteError(409, "canvas_node_source_unavailable", "The selected source record is unavailable in this authority scope.");
    const position = recordValue(data.position);
    const positionX = typeof position.x === "number" ? position.x : Number.NaN;
    const positionY = typeof position.y === "number" ? position.y : Number.NaN;
    if (!Number.isFinite(positionX) || !Number.isFinite(positionY) || positionX < 0 || positionY < 0)
      throw new EosRouteError(400, "canvas_node_position_invalid", "A Canvas node needs a finite non-negative x and y position.");
    return;
  }

  const sourceNodeId = typeof data.sourceNodeId === "string" ? data.sourceNodeId : "";
  const targetNodeId = typeof data.targetNodeId === "string" ? data.targetNodeId : "";
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId)
    throw new EosRouteError(400, "canvas_edge_nodes_invalid", "A Canvas edge must connect two different nodes.");
  const edgeNodes = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.companyId, access.company.id), inArray(eosInstrumentObjects.id, [sourceNodeId, targetNodeId]),
    eq(eosInstrumentObjects.instrumentKey, "canvas"), eq(eosInstrumentObjects.objectType, "node"), eq(eosInstrumentObjects.parentObjectId, parentObjectId),
  ));
  if (edgeNodes.length !== 2 || (await visibleObjectSet(access, edgeNodes)).length !== 2)
    throw new EosRouteError(409, "canvas_edge_nodes_unavailable", "Both Canvas nodes must be visible members of the selected visual map.");
}

/** Keep generic PATCH from changing a visual map into a hidden-reference
 * channel. Nodes and edges retain their identities, and a canvas list can
 * only contain visible children of that canvas. */
async function assertNativeCanvasUpdate(
  access: Awaited<ReturnType<typeof companyAccess>>,
  current: typeof eosInstrumentObjects.$inferSelect,
  next: { data: Record<string, unknown> },
) {
  if (current.instrumentKey !== "canvas") return;
  const currentData = recordValue(current.data);
  const nextData = recordValue(next.data);
  if (["node", "edge"].includes(current.objectType)) {
    await assertNativeCanvasCreate(access, {
      instrumentKey: current.instrumentKey, objectType: current.objectType, data: nextData, parentObjectId: current.parentObjectId || undefined,
    });
    if (current.objectType === "node" && nextData.sourceObjectId !== currentData.sourceObjectId)
      throw new EosRouteError(409, "canvas_node_source_immutable", "A Canvas node keeps its canonical source; create a new node for a different record.");
    if (current.objectType === "edge" && (nextData.sourceNodeId !== currentData.sourceNodeId || nextData.targetNodeId !== currentData.targetNodeId))
      throw new EosRouteError(409, "canvas_edge_nodes_immutable", "A Canvas edge keeps its endpoints; create a new edge for a different relationship.");
    return;
  }
  if (current.objectType !== "canvas") return;
  const nodeIds = nextData.nodes;
  const edgeIds = nextData.edges;
  if (!Array.isArray(nodeIds) || !Array.isArray(edgeIds) || [...nodeIds, ...edgeIds].some((id) => typeof id !== "string"))
    throw new EosRouteError(400, "canvas_members_invalid", "A Canvas map must list only native node and edge identifiers.");
  const memberIds = Array.from(new Set([...nodeIds, ...edgeIds] as string[]));
  if (memberIds.length !== nodeIds.length + edgeIds.length)
    throw new EosRouteError(400, "canvas_members_duplicate", "A Canvas map cannot list the same node or edge more than once.");
  if (!memberIds.length) return;
  const members = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.companyId, access.company.id), inArray(eosInstrumentObjects.id, memberIds), eq(eosInstrumentObjects.instrumentKey, "canvas"), eq(eosInstrumentObjects.parentObjectId, current.id),
  ));
  const memberTypes = new Map(members.map((member) => [member.id, member.objectType]));
  if (members.length !== memberIds.length || nodeIds.some((id) => memberTypes.get(id) !== "node") || edgeIds.some((id) => memberTypes.get(id) !== "edge") || (await visibleObjectSet(access, members)).length !== members.length)
    throw new EosRouteError(409, "canvas_members_unavailable", "Canvas nodes and edges must be visible children of this same visual map.");
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

const nativeFileUploadHeadersSchema = z.object({
  fileName: z.string().trim().min(1).max(500),
  title: z.string().trim().min(2).max(300).optional(),
  summary: z.string().trim().max(5_000).default(""),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
  visibility: z.enum(["seat", "team", "organization", "portfolio"]).default("team"),
  idempotencyKey: z.string().trim().min(2).max(200).regex(/^[a-z0-9][a-z0-9._:-]*$/i),
});

function requestHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function nativeFileUploadHeaders(req: Request) {
  return nativeFileUploadHeadersSchema.parse({
    fileName: requestHeader(req, "x-eos-file-name"),
    title: requestHeader(req, "x-eos-file-title"),
    summary: requestHeader(req, "x-eos-file-summary"),
    classification: requestHeader(req, "x-eos-file-classification"),
    visibility: requestHeader(req, "x-eos-file-visibility"),
    idempotencyKey: requestHeader(req, "idempotency-key"),
  });
}

function nativeFileInputFailure(error: unknown): EosRouteError {
  const code = error instanceof Error ? error.message : "native_file_invalid";
  const messages: Record<string, string> = {
    native_file_type_unsupported:
      "Upload a PDF, PNG, JPEG, UTF-8 text, Markdown, CSV, WebM audio, or MP4 audio file.",
    native_file_size_invalid: "Files must be between 1 byte and 10 MB.",
    native_file_content_mismatch:
      "The file contents do not match its declared file type.",
    native_file_body_invalid: "Choose a supported file to upload.",
  };
  return new EosRouteError(400, code, messages[code] || "The native file upload is invalid.");
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

  /**
   * A generic File object can describe a storage reference, but this is the
   * native custody path that creates that reference and its immutable bytes
   * together. Direct upload remains unavailable without a qualified malware
   * scanner, so the convenience of native files never lowers EOS safety.
   */
  app.post(
    "/api/eos/companies/:companyId/instruments/files/upload",
    requireScannerBackedArtifactIngress,
    express.raw({
      type: ["application/pdf", "image/png", "image/jpeg", "text/plain", "text/markdown", "text/csv", "audio/webm", "audio/mp4"],
      limit: NATIVE_FILE_MAX_BYTES,
    }),
    route(async (req, res) => {
      const input = nativeFileUploadHeaders(req);
      const { access, policy } = await instrumentAccess(req, "execute", "files", "native_file.upload", input.classification);
      const replay = await replayCommand(access.company.id, input.idempotencyKey, "files", "file.upload");
      if (replay) { res.status(200).json(replay); return; }
      if (!Buffer.isBuffer(req.body)) throw nativeFileInputFailure(new Error("native_file_body_invalid"));
      if (!nativeFileStorageConfigured()) throw new EosRouteError(503, "native_file_storage_unavailable", "EOS file custody is temporarily unavailable. No file was stored; retry after the storage control is healthy.");
      let metadata;
      try {
        metadata = validateNativeFile(req.body, requestHeader(req, "content-type") || "", input.fileName);
      } catch (error) {
        throw nativeFileInputFailure(error);
      }
      const scan = await scanNativeFile(req.body, metadata);
      if (scan.state === "infected") throw new EosRouteError(422, "native_file_upload_infected", "EOS rejected the upload because the malware scanner detected unsafe content.");
      if (scan.state !== "clean") throw new EosRouteError(503, "native_file_upload_scan_unavailable", "EOS could not complete the required malware scan. Nothing was stored; retry later.");

      const now = new Date();
      const objectId = randomUUID();
      const commandId = randomUUID();
      const storageKey = nativeFileStorageKey(access.company.id, objectId);
      const title = input.title || metadata.fileName;
      const data = {
        storageReference: `eos://native-files/${access.company.id}/${objectId}`,
        storageKey,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        sha256: metadata.sha256,
        scanState: scan.state,
        scanEngine: scan.engine,
        scanCompletedAt: scan.completedAt?.toISOString() || null,
      };
      const sourceReference = { authority: "native_eos", capability: "native_file_custody", storageProvider: "eos_artifact_plane" };
      const projection = {
        companyId: access.company.id, instrumentKey: "files", objectType: "file", objectKey: nativeFileObjectKey(), title,
        summary: input.summary, state: "draft", classification: input.classification, visibility: input.visibility,
        ownerSeatId: access.seat.id, data, sourceReference, evidenceIds: [], version: 1,
      };
      const object = {
        id: objectId, companyId: access.company.id, instrumentKey: "files", objectType: "file", objectKey: projection.objectKey,
        title, summary: input.summary, state: "draft", classification: input.classification, visibility: input.visibility,
        ownerSeatId: access.seat.id, parentObjectId: null, data, sourceReference, evidenceIds: [],
        contentSha256: nativeContractContentSha256(projection), version: 1, recordedByUserId: req.user.id,
        createdAt: now, updatedAt: now, archivedAt: null,
      };
      const event = {
        id: randomUUID(), companyId: access.company.id, instrumentKey: "files", objectId, commandId, eventType: "file.uploaded",
        fromState: null, toState: "draft", objectVersion: 1,
        payload: { fileName: metadata.fileName, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, sha256: metadata.sha256, scanEngine: scan.engine },
        evidenceIds: [],
        contentSha256: eventHash({ companyId: access.company.id, objectId, commandId, eventType: "file.uploaded", toState: "draft", objectVersion: 1, sha256: metadata.sha256 }),
        recordedByUserId: req.user.id, createdAt: now,
      };
      try {
        await storeNativeFile(storageKey, req.body);
        await db.transaction(async (tx) => {
          await tx.insert(eosInstrumentObjects).values(object);
          await tx.insert(eosInstrumentCommands).values({
            id: commandId, companyId: access.company.id, instrumentKey: "files", objectId, commandType: "file.upload", idempotencyKey: input.idempotencyKey,
            expectedVersion: null, payload: { fileName: metadata.fileName, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, sha256: metadata.sha256 },
            state: "completed", result: { objectId, version: 1, storageReference: data.storageReference }, policyDecisionId: policy.decisionId,
            requestedByUserId: req.user.id, createdAt: now, completedAt: now,
          });
          await tx.insert(eosInstrumentEvents).values(event);
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.file.uploaded", targetType: "files", targetId: objectId,
            traceId: policy.traceId, correlationId: policy.correlationId, result: "draft",
            details: { commandId, fileName: metadata.fileName, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, sha256: metadata.sha256, policyDecisionId: policy.decisionId }, createdAt: now,
          });
        });
      } catch (error) {
        await removeNativeFile(storageKey).catch(() => undefined);
        throw error;
      }
      res.status(201).json({ command: { id: commandId, state: "completed" }, object, replayed: false });
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/instruments/files/:objectId/download",
    route(async (req, res) => {
      const { access } = await instrumentAccess(req, "view", "files", "native_file.download", "internal");
      const [object] = await db.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, req.params.objectId),
        eq(eosInstrumentObjects.instrumentKey, "files"), eq(eosInstrumentObjects.objectType, "file"),
      )).limit(1);
      const [visible] = object ? await visibleObjectSet(access, [object]) : [];
      if (!visible) throw new EosRouteError(404, "native_file_not_found", "The requested native file is unavailable in this authority scope.");
      const data = recordValue(visible.data);
      const storageKey = typeof data.storageKey === "string" ? data.storageKey : "";
      const fileName = typeof data.fileName === "string" ? data.fileName : "eos-file";
      const mimeType = typeof data.mimeType === "string" ? data.mimeType : "application/octet-stream";
      const expectedSha256 = typeof data.sha256 === "string" ? data.sha256 : "";
      if (!storageKey || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new EosRouteError(409, "native_file_custody_invalid", "The native file custody record is incomplete. Do not rely on this file until it is reconciled.");
      let bytes: Buffer;
      try { bytes = await readNativeFile(storageKey); }
      catch { throw new EosRouteError(503, "native_file_custody_unavailable", "EOS file custody is temporarily unavailable. No file content was returned."); }
      if (nativeFileSha256(bytes) !== expectedSha256) throw new EosRouteError(503, "native_file_custody_integrity_failed", "EOS detected a file-integrity mismatch. No file content was returned.");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", String(bytes.length));
      res.setHeader("Content-Disposition", safeNativeFileAttachmentHeader(fileName));
      res.setHeader("Cache-Control", "no-store, private, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      res.send(bytes);
    }),
  );

  app.get("/api/eos/companies/:companyId/instruments/crm/relationships/:relationshipObjectId/operating-context", route(async (req, res) => {
    const { access } = await instrumentAccess(req, "view", "crm", "instrument.read", "internal");
    const [relationship] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.companyId, access.company.id),
      eq(eosInstrumentObjects.id, req.params.relationshipObjectId),
      eq(eosInstrumentObjects.instrumentKey, "crm"),
      eq(eosInstrumentObjects.objectType, "relationship"),
    )).limit(1);
    if (!relationship) throw new EosRouteError(404, "crm_relationship_not_found", "The requested native CRM relationship does not exist in this company.");
    const visibleRelationship = await visibleObjectSet(access, [relationship]);
    if (!visibleRelationship.length) throw new EosRouteError(404, "crm_relationship_not_visible", "The requested native CRM relationship is not visible in this role scope.");

    const permittedKeys = permittedInstrumentKeySet(access, req.user.id);
    const allObjects = await db.select().from(eosInstrumentObjects).where(eq(eosInstrumentObjects.companyId, access.company.id)).orderBy(desc(eosInstrumentObjects.updatedAt));
    const visibleObjects = await visibleObjectSet(access, objectsForPermittedInstruments(allObjects, permittedKeys));
    const visibleById = new Map(visibleObjects.map((object) => [object.id, object]));
    const directLinks = await db.select().from(eosInstrumentLinks).where(and(
      eq(eosInstrumentLinks.companyId, access.company.id),
      or(eq(eosInstrumentLinks.sourceObjectId, relationship.id), eq(eosInstrumentLinks.targetObjectId, relationship.id)),
    ));
    const directObjectIds = new Set(directLinks.map((link) => link.sourceObjectId === relationship.id ? link.targetObjectId : link.sourceObjectId));
    const directObjects = Array.from(directObjectIds).map((id) => visibleById.get(id)).filter((object): object is typeof eosInstrumentObjects.$inferSelect => Boolean(object));
    const meetingIds = new Set(directObjects.filter((object) => object.instrumentKey === "conference_rooms" && object.objectType === "meeting").map((object) => object.id));
    const decisionObjects = visibleObjects.filter((object) => object.instrumentKey === "conference_rooms" && object.objectType === "decision" && meetingIds.has(object.parentObjectId || ""));
    // A relationship reaches its commercial fulfillment through an explicit,
    // bounded chain: relationship -> opportunity -> order -> delivery project.
    // The visible-object map ensures CRM access alone never discloses Commerce
    // or Projects records, and this route deliberately does not traverse
    // arbitrary graph edges beyond the governed conversion path.
    const opportunityIds = directObjects
      .filter((object) => object.instrumentKey === "crm" && object.objectType === "opportunity")
      .map((object) => object.id);
    const opportunityOrderLinks = opportunityIds.length
      ? await db.select().from(eosInstrumentLinks).where(and(
        eq(eosInstrumentLinks.companyId, access.company.id),
        inArray(eosInstrumentLinks.sourceObjectId, opportunityIds),
        eq(eosInstrumentLinks.relationshipType, "converts_to_order"),
      ))
      : [];
    const orderObjects = opportunityOrderLinks
      .map((link) => visibleById.get(link.targetObjectId))
      .filter((object): object is typeof eosInstrumentObjects.$inferSelect => Boolean(object && object.instrumentKey === "commerce" && object.objectType === "order"));
    const orderIds = orderObjects.map((object) => object.id);
    const orderDeliveryLinks = orderIds.length
      ? await db.select().from(eosInstrumentLinks).where(and(
        eq(eosInstrumentLinks.companyId, access.company.id),
        inArray(eosInstrumentLinks.sourceObjectId, orderIds),
        eq(eosInstrumentLinks.relationshipType, "fulfills_order"),
      ))
      : [];
    const deliveryProjectObjects = orderDeliveryLinks
      .map((link) => visibleById.get(link.targetObjectId))
      .filter((object): object is typeof eosInstrumentObjects.$inferSelect => Boolean(object && object.instrumentKey === "projects" && object.objectType === "project"));
    const returnedIds = new Set([...directObjects.map((object) => object.id), ...decisionObjects.map((object) => object.id), ...orderObjects.map((object) => object.id), ...deliveryProjectObjects.map((object) => object.id)]);
    res.json({
      schemaVersion: "eos.crm.relationship-operating-context.v1",
      relationship: visibleRelationship[0],
      objects: [...directObjects, ...decisionObjects, ...orderObjects, ...deliveryProjectObjects],
      links: [
        ...directLinks.filter((link) => returnedIds.has(link.sourceObjectId) || returnedIds.has(link.targetObjectId)),
        ...opportunityOrderLinks.filter((link) => returnedIds.has(link.sourceObjectId) && returnedIds.has(link.targetObjectId)),
        ...orderDeliveryLinks.filter((link) => returnedIds.has(link.sourceObjectId) && returnedIds.has(link.targetObjectId)),
      ],
    });
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
      // A CSV contact migration can express a relationship by the stable
      // source object key before EOS has generated its canonical object ID.
      // Resolve that one native-first migration reference inside this same
      // transaction. This is not a provider sync and is deliberately narrow:
      // arbitrary imports never get an unvalidated way to rewrite references.
      for (const [sourceKey, imported] of Array.from(importedByKey.entries())) {
        if (imported.instrumentKey !== "crm" || imported.objectType !== "relationship") continue;
        const data = recordValue(imported.data);
        const referenceKey = typeof data.personObjectKey === "string" ? data.personObjectKey : "";
        const source = recordValue(imported.sourceReference);
        if (!referenceKey || source.authority !== "legacy_company_csv") continue;
        const person = importedByKey.get(`crm:${referenceKey}`);
        if (!person || person.instrumentKey !== "crm" || person.objectType !== "person")
          throw new EosRouteError(409, "crm_csv_person_reference_missing", "A historical CRM relationship could not resolve its imported person record.");
        const nextData: Record<string, unknown> = { ...data, personObjectId: person.id };
        delete nextData.personObjectKey;
        const updated = {
          ...imported,
          data: nextData,
          contentSha256: nativeContractContentSha256({
            schemaVersion: "eos.instrument-object.v1", companyId: imported.companyId,
            instrumentKey: imported.instrumentKey, objectType: imported.objectType,
            objectKey: imported.objectKey, title: imported.title, summary: imported.summary,
            state: imported.state, classification: imported.classification, visibility: imported.visibility,
            ownerSeatId: imported.ownerSeatId, data: nextData, sourceReference: imported.sourceReference,
            evidenceIds: imported.evidenceIds, version: imported.version,
          }),
          updatedAt: now,
        };
        await tx.update(eosInstrumentObjects).set({ data: nextData, contentSha256: updated.contentSha256, updatedAt: now }).where(and(eq(eosInstrumentObjects.id, imported.id), eq(eosInstrumentObjects.companyId, access.company.id)));
        importedByKey.set(sourceKey, updated);
        const createdIndex = created.findIndex((object) => object.id === imported.id);
        if (createdIndex >= 0) created[createdIndex] = updated;
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
    await assertNativeCanvasCreate(access, input);
    await assertPublicCommercialRouting(req, access, input);
    await assertNativeCommerceOrderSource(req, access, input);
    await checkedEvidence(access.company.id, input.evidenceIds);
    if (input.parentObjectId) {
      const [parent] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, input.parentObjectId), eq(eosInstrumentObjects.instrumentKey, input.instrumentKey))).limit(1);
      if (!parent) throw new EosRouteError(409, "instrument_parent_invalid", "Parent objects must exist inside the same company and instrument.");
      if (!(await visibleObjectSet(access, [parent])).length)
        throw new EosRouteError(404, "instrument_parent_unavailable", "The selected parent object is unavailable in your current role scope.");
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

  /**
   * Record a response to an EOS-owned internal form.  This is deliberately a
   * specialized command rather than a generic Form object write: the server
   * validates the exact published definition, scopes the parent form to the
   * caller's role visibility, preserves the form owner as accountable for the
   * response queue, and records a receipt without echoing answer content into
   * audit/event payloads.
   */
  app.post("/api/eos/companies/:companyId/forms/:formId/submissions", route(async (req, res) => {
    const input = nativeInternalFormSubmissionSchema.parse(req.body);
    const { access, policy } = await instrumentAccess(req, "execute", "forms", "native_form.submit", "confidential");
    const replay = await replayCommand(access.company.id, input.idempotencyKey, "forms", "form.submit");
    if (replay) { res.status(200).json(replay); return; }

    const [form] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, req.params.formId),
      eq(eosInstrumentObjects.companyId, access.company.id),
      eq(eosInstrumentObjects.instrumentKey, "forms"),
      eq(eosInstrumentObjects.objectType, "form"),
      eq(eosInstrumentObjects.state, "active"),
    )).limit(1);
    if (!form || !(await visibleObjectSet(access, [form])).length)
      throw new EosRouteError(404, "native_form_unavailable", "This active native form is unavailable in your current role scope.");
    if (recordValue(form.data).publicCapture === true)
      throw new EosRouteError(409, "native_form_public_boundary", "Public lead forms accept submissions only through their public, consent-protected route.");
    const definition = internalFormDefinition(form.data);
    const answers = validateInternalFormAnswers(definition, input.answers);
    const now = new Date();
    const objectId = randomUUID();
    const commandId = randomUUID();
    const objectKey = `submission:${form.id}:${objectId}`;
    const sourceReference = {
      authority: "native_eos",
      capability: "internal_forms",
      formObjectId: form.id,
      submittedBySeatId: access.seat.id,
    };
    const data = {
      formObjectId: form.id,
      responses: answers,
      submittedAt: now.toISOString(),
      consentVersion: definition.consentVersion,
      submissionChannel: "internal_eos",
    };
    const projection = {
      schemaVersion: "eos.instrument-object.v1",
      companyId: access.company.id,
      instrumentKey: "forms",
      objectType: "submission",
      objectKey,
      title: `Response · ${form.title}`,
      summary: "Internal native-form response awaiting the form owner's governed review.",
      state: "active",
      classification: form.classification,
      visibility: "team",
      ownerSeatId: form.ownerSeatId,
      parentObjectId: form.id,
      data,
      sourceReference,
      evidenceIds: [],
      version: 1,
    };
    const submission = {
      id: objectId,
      companyId: access.company.id,
      instrumentKey: "forms",
      objectType: "submission",
      objectKey,
      title: projection.title,
      summary: projection.summary,
      state: "active",
      classification: form.classification,
      visibility: "team",
      ownerSeatId: form.ownerSeatId,
      parentObjectId: form.id,
      data,
      sourceReference,
      evidenceIds: [],
      contentSha256: nativeContractContentSha256(projection),
      version: 1,
      recordedByUserId: req.user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await db.transaction(async (tx) => {
      await tx.insert(eosInstrumentObjects).values(submission);
      await tx.insert(eosInstrumentCommands).values({
        id: commandId, companyId: access.company.id, instrumentKey: "forms", objectId,
        commandType: "form.submit", idempotencyKey: input.idempotencyKey, expectedVersion: form.version,
        payload: { formObjectId: form.id, questionIds: definition.questions.map((question) => question.id), submissionChannel: "internal_eos" },
        state: "completed", result: { submissionObjectId: objectId, version: 1 }, policyDecisionId: policy.decisionId,
        requestedByUserId: req.user.id, createdAt: now, completedAt: now,
      });
      await tx.insert(eosInstrumentEvents).values({
        id: randomUUID(), companyId: access.company.id, instrumentKey: "forms", objectId, commandId,
        eventType: "form.submission_recorded", fromState: null, toState: "active", objectVersion: 1,
        payload: { formObjectId: form.id, questionIds: definition.questions.map((question) => question.id), submissionChannel: "internal_eos" },
        evidenceIds: [],
        contentSha256: eventHash({ companyId: access.company.id, objectId, commandId, eventType: "form.submission_recorded", toState: "active", objectVersion: 1, formObjectId: form.id }),
        recordedByUserId: req.user.id, createdAt: now,
      });
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
        action: "native_form.submission_recorded", targetType: "form", targetId: form.id,
        traceId: policy.traceId, correlationId: policy.correlationId, result: "active",
        details: { submissionObjectId: objectId, questionIds: definition.questions.map((question) => question.id), policyDecisionId: policy.decisionId, submissionChannel: "internal_eos" },
        createdAt: now,
      });
    });
    res.status(201).json({ command: { id: commandId, state: "completed" }, object: submission, confirmationMessage: definition.confirmationMessage, replayed: false });
  }));

  /**
   * Convert an EOS-owned commercial opportunity into an EOS-owned order in a
   * single transaction.  A generic object create is deliberately insufficient
   * here: it could leave an order detached from the buyer/opportunity that
   * justified it, or create an apparent sale before payment has been
   * authorized and verified.
   */
  app.post("/api/eos/companies/:companyId/commerce/orders", route(async (req, res) => {
    const input = commerceOrderFromCrmSchema.parse(req.body);
    assertCredentialFree(input);
    const { access, policy } = await instrumentAccess(req, "execute", "commerce", "commerce.order.create_from_crm", "confidential");
    const [offer] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, input.offerObjectId),
      eq(eosInstrumentObjects.companyId, access.company.id),
      eq(eosInstrumentObjects.instrumentKey, "commerce"),
      eq(eosInstrumentObjects.objectType, "offer"),
    )).limit(1);
    if (!offer || offer.state === "archived" || !(await visibleObjectSet(access, [offer])).length)
      throw new EosRouteError(409, "commerce_order_offer_unavailable", "The selected native offer is unavailable for this role.");
    const source = await assertNativeCommerceOrderSource(req, access, {
      instrumentKey: "commerce",
      objectType: "order",
      classification: offer.classification,
      data: {
        offerObjectId: offer.id,
        buyerReference: input.buyerObjectId,
        ...(input.opportunityObjectId ? { sourceOpportunityObjectId: input.opportunityObjectId } : {}),
      },
    });
    if (!source) throw new EosRouteError(409, "commerce_order_source_invalid", "A native order needs a governed CRM buyer.");
    const offerData = recordValue(offer.data);
    const amountMinor = typeof offerData.priceMinor === "number" && Number.isFinite(offerData.priceMinor) && offerData.priceMinor >= 0
      ? Math.round(offerData.priceMinor)
      : 0;
    const currency = typeof offerData.currency === "string" && /^[A-Z]{3}$/.test(offerData.currency)
      ? offerData.currency
      : "USD";
    const now = new Date();
    const orderId = randomUUID();
    const commandId = randomUUID();
    // Instrument events are one-to-one with their command receipt. The source
    // opportunity therefore gets its own immutable receipt instead of reusing
    // the order command ID (which would violate the append-only ledger's
    // unique command-to-event boundary).
    const opportunityCommandId = source.opportunity ? randomUUID() : null;
    const linkId = source.opportunity ? randomUUID() : null;
    const buyerData = recordValue(source.buyer.data);
    const orderData = {
      offerObjectId: offer.id,
      buyerReference: source.buyer.id,
      buyerDisplayName: buyerData.displayName || source.buyer.title,
      amountMinor,
      currency,
      paymentState: "pending_authorized_collection",
      operatingMode: "native_eos",
      ...(source.opportunity ? {
        sourceOpportunityObjectId: source.opportunity.id,
        sourceRelationshipObjectId: source.relationship!.id,
      } : {}),
    };
    const sourceReference = {
      authority: "native_eos",
      capability: "order_management",
      paymentExecution: "not_dispatched",
    };
    const objectKey = `order:crm-handoff:${offer.id}:${orderId}`;
    const projection = {
      schemaVersion: "eos.instrument-object.v1",
      companyId: access.company.id,
      instrumentKey: "commerce",
      objectType: "order",
      objectKey,
      title: input.title,
      summary: "Native EOS commercial commitment pending the authorized payment path.",
      state: "draft",
      classification: offer.classification,
      visibility: "team",
      ownerSeatId: access.seat.id,
      parentObjectId: offer.id,
      data: orderData,
      sourceReference,
      evidenceIds: [],
      version: 1,
    };
    const order = {
      id: orderId,
      companyId: access.company.id,
      instrumentKey: "commerce",
      objectType: "order",
      objectKey,
      title: input.title,
      summary: "Native EOS commercial commitment pending the authorized payment path.",
      state: "draft",
      classification: offer.classification,
      visibility: "team",
      ownerSeatId: access.seat.id,
      parentObjectId: offer.id,
      data: orderData,
      sourceReference,
      evidenceIds: [],
      contentSha256: nativeContractContentSha256(projection),
      version: 1,
      recordedByUserId: req.user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`commerce-order-from-crm:${access.company.id}:${input.idempotencyKey}`}))`);
      const [prior] = await tx.select().from(eosInstrumentCommands).where(and(
        eq(eosInstrumentCommands.companyId, access.company.id),
        eq(eosInstrumentCommands.idempotencyKey, input.idempotencyKey),
      )).limit(1);
      if (prior) {
        if (prior.instrumentKey !== "commerce" || prior.commandType !== "order.create_from_crm")
          throw new EosRouteError(409, "instrument_idempotency_conflict", "This idempotency key is already bound to a different instrument command.");
        const [priorOrder] = prior.objectId ? await tx.select().from(eosInstrumentObjects).where(and(
          eq(eosInstrumentObjects.id, prior.objectId), eq(eosInstrumentObjects.companyId, access.company.id),
        )).limit(1) : [];
        if (!priorOrder) throw new EosRouteError(409, "commerce_order_replay_missing", "The prior native order no longer resolves in this company.");
        const priorResult = recordValue(prior.result);
        const priorLinkId = typeof priorResult.linkId === "string" ? priorResult.linkId : null;
        return { command: prior, order: priorOrder, linkId: priorLinkId, replayed: true };
      }
      await tx.insert(eosInstrumentObjects).values(order);
      if (source.opportunity && linkId) {
        await tx.insert(eosInstrumentLinks).values({
          id: linkId,
          companyId: access.company.id,
          sourceObjectId: source.opportunity.id,
          targetObjectId: orderId,
          relationshipType: "converts_to_order",
          metadata: { offerObjectId: offer.id, buyerObjectId: source.buyer.id },
          createdByUserId: req.user.id,
          createdAt: now,
        });
      }
      const resultPayload = { orderObjectId: orderId, linkId };
      await tx.insert(eosInstrumentCommands).values({
        id: commandId,
        companyId: access.company.id,
        instrumentKey: "commerce",
        objectId: orderId,
        commandType: "order.create_from_crm",
        idempotencyKey: input.idempotencyKey,
        expectedVersion: null,
        payload: { offerObjectId: offer.id, buyerObjectId: source.buyer.id, opportunityObjectId: source.opportunity?.id || null },
        state: "completed",
        result: resultPayload,
        policyDecisionId: policy.decisionId,
        requestedByUserId: req.user.id,
        createdAt: now,
        completedAt: now,
      });
      await tx.insert(eosInstrumentEvents).values({
        id: randomUUID(),
        companyId: access.company.id,
        instrumentKey: "commerce",
        objectId: orderId,
        commandId,
        eventType: "order.created_from_crm",
        fromState: null,
        toState: "draft",
        objectVersion: 1,
        payload: { offerObjectId: offer.id, buyerObjectId: source.buyer.id, opportunityObjectId: source.opportunity?.id || null, linkId },
        evidenceIds: [],
        contentSha256: eventHash({ companyId: access.company.id, objectId: orderId, commandId, eventType: "order.created_from_crm", toState: "draft", objectVersion: 1, linkId }),
        recordedByUserId: req.user.id,
        createdAt: now,
      });
      if (source.opportunity && linkId) {
        await tx.insert(eosInstrumentCommands).values({
          id: opportunityCommandId!,
          companyId: access.company.id,
          instrumentKey: "crm",
          objectId: source.opportunity.id,
          commandType: "opportunity.order_recorded",
          idempotencyKey: `${input.idempotencyKey.slice(0, 180)}:opportunity-event`,
          expectedVersion: source.opportunity.version,
          payload: { orderObjectId: orderId, linkId },
          state: "completed",
          result: { orderObjectId: orderId, linkId },
          policyDecisionId: policy.decisionId,
          requestedByUserId: req.user.id,
          createdAt: now,
          completedAt: now,
        });
        await tx.insert(eosInstrumentEvents).values({
          id: randomUUID(),
          companyId: access.company.id,
          instrumentKey: "crm",
          objectId: source.opportunity.id,
          commandId: opportunityCommandId!,
          eventType: "opportunity.order_created",
          fromState: source.opportunity.state,
          toState: source.opportunity.state,
          objectVersion: source.opportunity.version,
          payload: { orderObjectId: orderId, linkId },
          evidenceIds: [],
          contentSha256: eventHash({ companyId: access.company.id, objectId: source.opportunity.id, commandId: opportunityCommandId!, eventType: "opportunity.order_created", orderObjectId: orderId, linkId }),
          recordedByUserId: req.user.id,
          createdAt: now,
        });
      }
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "commerce.order.created_from_crm",
        targetType: "commerce_order",
        targetId: orderId,
        traceId: policy.traceId,
        correlationId: policy.correlationId,
        result: "draft_pending_collection",
        details: { offerObjectId: offer.id, buyerObjectId: source.buyer.id, opportunityObjectId: source.opportunity?.id || null, linkId, policyDecisionId: policy.decisionId },
        createdAt: now,
      });
      return { command: { id: commandId, state: "completed" }, order, linkId, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  /**
   * Compile an authorized native order into its first accountable delivery
   * project. Creating the project is deliberately distinct from activating
   * it: an order does not prove payment, agreement execution, or readiness to
   * start delivery. The atomic link preserves the commercial origin while the
   * project remains a normal governed work object from that point onward.
   */
  app.post("/api/eos/companies/:companyId/commerce/orders/:objectId/delivery-projects", route(async (req, res) => {
    const input = commerceOrderDeliveryProjectSchema.parse(req.body);
    assertCredentialFree(input);
    const { access, policy: commercePolicy } = await instrumentAccess(req, "execute", "commerce", "commerce.order.delivery_project.create", "confidential");
    const { policy: projectsPolicy } = await instrumentAccess(req, "execute", "projects", "commerce.order.delivery_project.create", "confidential");
    const replay = await replayCommand(access.company.id, input.idempotencyKey, "commerce", "order.delivery_project.create");
    if (replay) {
      const result = recordValue(replay.command.result);
      const projectId = typeof result.projectObjectId === "string" ? result.projectObjectId : "";
      const [project] = projectId ? await db.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, projectId),
        eq(eosInstrumentObjects.instrumentKey, "projects"), eq(eosInstrumentObjects.objectType, "project"),
      )).limit(1) : [];
      res.json({ command: replay.command, order: replay.object, project: project || null, replayed: true });
      return;
    }

    const [order] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, req.params.objectId),
      eq(eosInstrumentObjects.instrumentKey, "commerce"), eq(eosInstrumentObjects.objectType, "order"),
    )).limit(1);
    if (!order || !(await visibleObjectSet(access, [order])).length)
      throw new EosRouteError(404, "commerce_order_not_found", "The selected native order is unavailable for this role.");
    if (order.state === "archived") throw new EosRouteError(409, "commerce_order_archived", "An archived order cannot receive a delivery project.");
    if (order.version !== input.expectedOrderVersion)
      throw new EosRouteError(409, "commerce_order_version_conflict", "The order changed before its delivery project could be recorded.");
    const orderData = recordValue(order.data);
    if (typeof orderData.deliveryProjectObjectId === "string" && orderData.deliveryProjectObjectId)
      throw new EosRouteError(409, "commerce_order_delivery_project_exists", "This order already has a governed delivery project. Configure that project or create additional work within it.");

    // The project owner must remain within the requester's governed operating
    // hierarchy. That works identically whether the destination seat is held
    // by an agent or by a human supported by that role's assistant.
    const visibleSeatIdSet = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    if (!visibleSeatIdSet.has(input.ownerSeatId))
      throw new EosRouteError(403, "commerce_delivery_owner_scope_denied", "Choose an active role that is visible within your operating hierarchy.");
    const [ownerSeat] = await db.select().from(eosSeats).where(and(
      eq(eosSeats.companyId, access.company.id), eq(eosSeats.id, input.ownerSeatId), eq(eosSeats.status, "active"),
    )).limit(1);
    if (!ownerSeat) throw new EosRouteError(409, "commerce_delivery_owner_unavailable", "The selected delivery owner is no longer active in this company.");

    const now = new Date();
    const projectId = randomUUID();
    const projectCommandId = randomUUID();
    const orderCommandId = randomUUID();
    const linkId = randomUUID();
    const projectData = {
      objective: input.objective,
      ownerSeatId: ownerSeat.id,
      orderObjectId: order.id,
      buyerReference: typeof orderData.buyerReference === "string" ? orderData.buyerReference : null,
      sourceOpportunityObjectId: typeof orderData.sourceOpportunityObjectId === "string" ? orderData.sourceOpportunityObjectId : null,
      operatingMode: "native_eos",
    };
    const projectSource = { authority: "native_eos", capability: "commerce_delivery_project", orderObjectId: order.id };
    const project = {
      id: projectId, companyId: access.company.id, instrumentKey: "projects", objectType: "project",
      objectKey: `project:order-delivery:${order.id}:${projectId}`, title: input.title, summary: input.objective,
      state: "draft", classification: order.classification, visibility: "team", ownerSeatId: ownerSeat.id,
      parentObjectId: null, data: projectData, sourceReference: projectSource, evidenceIds: [],
      contentSha256: nativeContractContentSha256({ schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: "projects", objectType: "project", objectKey: `project:order-delivery:${order.id}:${projectId}`, title: input.title, summary: input.objective, state: "draft", classification: order.classification, visibility: "team", ownerSeatId: ownerSeat.id, data: projectData, sourceReference: projectSource, evidenceIds: [], version: 1 }),
      version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now, archivedAt: null,
    };
    const nextOrderData = { ...orderData, deliveryProjectObjectId: projectId, deliveryProjectOwnerSeatId: ownerSeat.id, operatingMode: "native_eos" };
    const nextOrder = { ...order, data: nextOrderData, version: order.version + 1, updatedAt: now };

    await db.transaction(async (tx) => {
      await tx.insert(eosInstrumentObjects).values(project);
      const [updatedOrder] = await tx.update(eosInstrumentObjects).set({
        data: nextOrderData, version: nextOrder.version, updatedAt: now,
        contentSha256: nativeContractContentSha256({ schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: order.instrumentKey, objectType: order.objectType, objectKey: order.objectKey, title: order.title, summary: order.summary, state: order.state, classification: order.classification, visibility: order.visibility, ownerSeatId: order.ownerSeatId, data: nextOrderData, sourceReference: order.sourceReference, evidenceIds: order.evidenceIds, version: nextOrder.version }),
      }).where(and(eq(eosInstrumentObjects.id, order.id), eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.version, order.version))).returning();
      if (!updatedOrder) throw new EosRouteError(409, "commerce_order_concurrent_change", "The order changed before its delivery project could be recorded.");
      await tx.insert(eosInstrumentLinks).values({ id: linkId, companyId: access.company.id, sourceObjectId: order.id, targetObjectId: projectId, relationshipType: "fulfills_order", metadata: { ownerSeatId: ownerSeat.id }, createdByUserId: req.user.id, createdAt: now });
      await tx.insert(eosInstrumentCommands).values([
        { id: orderCommandId, companyId: access.company.id, instrumentKey: "commerce", objectId: order.id, commandType: "order.delivery_project.create", idempotencyKey: input.idempotencyKey, expectedVersion: order.version, payload: { projectObjectId: projectId, ownerSeatId: ownerSeat.id }, state: "completed", result: { projectObjectId: projectId, linkId, orderVersion: nextOrder.version }, policyDecisionId: commercePolicy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now },
        { id: projectCommandId, companyId: access.company.id, instrumentKey: "projects", objectId: projectId, commandType: "project.create_from_order", idempotencyKey: `${input.idempotencyKey}:project`, expectedVersion: null, payload: { orderObjectId: order.id, ownerSeatId: ownerSeat.id }, state: "completed", result: { projectObjectId: projectId, linkId }, policyDecisionId: projectsPolicy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now },
      ]);
      await tx.insert(eosInstrumentEvents).values([
        { id: randomUUID(), companyId: access.company.id, instrumentKey: "projects", objectId: projectId, commandId: projectCommandId, eventType: "object.created", fromState: null, toState: "draft", objectVersion: 1, payload: { objectType: "project", orderObjectId: order.id, ownerSeatId: ownerSeat.id }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: projectId, commandId: projectCommandId, eventType: "object.created", toState: "draft", objectVersion: 1 }), recordedByUserId: req.user.id, createdAt: now },
        { id: randomUUID(), companyId: access.company.id, instrumentKey: "commerce", objectId: order.id, commandId: orderCommandId, eventType: "order.delivery_project.created", fromState: order.state, toState: order.state, objectVersion: nextOrder.version, payload: { projectObjectId: projectId, linkId, ownerSeatId: ownerSeat.id }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: order.id, commandId: orderCommandId, eventType: "order.delivery_project.created", projectId, linkId, objectVersion: nextOrder.version }), recordedByUserId: req.user.id, createdAt: now },
      ]);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "commerce.order.delivery_project.created", targetType: "commerce_order", targetId: order.id, traceId: commercePolicy.traceId, correlationId: commercePolicy.correlationId, result: "draft_project_created", details: { projectObjectId: projectId, linkId, ownerSeatId: ownerSeat.id, commercePolicyDecisionId: commercePolicy.decisionId, projectsPolicyDecisionId: projectsPolicy.decisionId }, createdAt: now });
    });
    res.status(201).json({ command: { id: orderCommandId, state: "completed" }, order: nextOrder, project, link: { id: linkId, relationshipType: "fulfills_order" }, replayed: false });
  }));

  app.patch("/api/eos/companies/:companyId/instrument-objects/:objectId", route(async (req, res) => {
    const input = instrumentObjectUpdateSchema.parse(req.body); assertCredentialFree(input);
    const [current] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, req.params.objectId), eq(eosInstrumentObjects.companyId, Number(req.params.companyId)))).limit(1);
    if (!current) throw new EosRouteError(404, "instrument_object_not_found", "Instrument object not found.");
    const { access, policy } = await instrumentAccess(req, "execute", current.instrumentKey, "instrument.object.update", input.classification || current.classification);
    if (!(await visibleObjectSet(access, [current])).length)
      throw new EosRouteError(404, "instrument_object_unavailable", "This object is unavailable in your current role scope.");
    const replay = await replayCommand(access.company.id, input.idempotencyKey, current.instrumentKey, "object.update"); if (replay) { res.json(replay); return; }
    if (current.version !== input.expectedVersion) throw new EosRouteError(409, "instrument_version_conflict", "The instrument object changed before this update.");
    if (current.state === "archived") throw new EosRouteError(409, "instrument_object_archived", "Archived instrument objects are immutable through the normal lifecycle.");
    const evidence = input.evidenceIds ?? current.evidenceIds as string[]; await checkedEvidence(access.company.id, evidence);
    const next = { title: input.title ?? current.title, summary: input.summary ?? current.summary, classification: input.classification ?? current.classification, visibility: input.visibility ?? current.visibility, data: input.data ?? current.data as Record<string, unknown>, sourceReference: input.sourceReference ?? current.sourceReference as Record<string, unknown>, evidenceIds: evidence, version: current.version + 1, updatedAt: new Date() };
    await assertNativeMessageUpdate(access, current, next);
    await assertNativeCanvasUpdate(access, current, next);
    await assertNativeInternalFormDefinition(current, next.data);
    if (input.data !== undefined) await assertPublicCommercialRouting(req, access, { instrumentKey: current.instrumentKey, objectType: current.objectType, data: next.data, classification: next.classification });
    if (input.data !== undefined) await assertNativeCommerceOrderSource(req, access, { instrumentKey: current.instrumentKey, objectType: current.objectType, data: next.data, classification: next.classification });
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

  app.post("/api/eos/companies/:companyId/crm/opportunities/:objectId/follow-up-actions", route(async (req, res) => {
    const input = crmOpportunityFollowUpActionSchema.parse(req.body);
    assertCredentialFree(input);

    // Both tools are independently authorized.  CRM permission alone cannot
    // silently create company work, and Tasks permission alone cannot infer a
    // hidden commercial record by guessing its identifier.
    const { access, policy: crmPolicy } = await instrumentAccess(req, "execute", "crm", "crm.opportunity.follow_up.create", "confidential");
    const { policy: tasksPolicy } = await instrumentAccess(req, "execute", "tasks", "crm.opportunity.follow_up.create", "confidential");
    const replay = await replayCommand(access.company.id, input.idempotencyKey, "crm", "opportunity.follow_up.create");
    if (replay) {
      const result = recordValue(replay.command.result);
      const taskId = typeof result.taskObjectId === "string" ? result.taskObjectId : "";
      const [task] = taskId ? await db.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, taskId), eq(eosInstrumentObjects.instrumentKey, "tasks"),
      )).limit(1) : [];
      res.json({ command: replay.command, opportunity: replay.object, task: task || null, replayed: true });
      return;
    }

    const [opportunity] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.id, req.params.objectId),
      eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "opportunity"),
    )).limit(1);
    if (!opportunity) throw new EosRouteError(404, "crm_opportunity_not_found", "The selected native CRM opportunity is unavailable in this company.");
    if (!(await visibleObjectSet(access, [opportunity])).length)
      throw new EosRouteError(404, "crm_opportunity_not_found", "The selected native CRM opportunity is unavailable for this role.");
    if (opportunity.state === "archived") throw new EosRouteError(409, "crm_opportunity_archived", "An archived opportunity cannot receive new follow-up work.");
    if (opportunity.version !== input.expectedOpportunityVersion)
      throw new EosRouteError(409, "crm_opportunity_version_conflict", "The opportunity changed before its follow-up action could be recorded.");

    // A role can only delegate down its visible operating graph (or to itself).
    // This keeps the task hierarchy consistent whether the assignee is an
    // autonomous agent seat or a human occupying that same role.
    const visibleSeatIdSet = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    if (!visibleSeatIdSet.has(input.ownerSeatId))
      throw new EosRouteError(403, "crm_follow_up_owner_scope_denied", "Choose an active role that is visible within your operating hierarchy.");
    const [ownerSeat] = await db.select().from(eosSeats).where(and(
      eq(eosSeats.companyId, access.company.id), eq(eosSeats.id, input.ownerSeatId), eq(eosSeats.status, "active"),
    )).limit(1);
    if (!ownerSeat)
      throw new EosRouteError(409, "crm_follow_up_owner_unavailable", "The selected role is no longer active in this company.");

    const now = new Date();
    const taskId = randomUUID();
    const taskCommandId = randomUUID();
    const opportunityCommandId = randomUUID();
    const linkId = randomUUID();
    const nextOpportunityData = {
      ...recordValue(opportunity.data),
      nextAction: input.objective,
      nextActionOwnerSeatId: ownerSeat.id,
      nextActionTaskObjectId: taskId,
      operatingMode: "native_eos",
    };
    const nextOpportunity = {
      ...opportunity,
      data: nextOpportunityData,
      version: opportunity.version + 1,
      updatedAt: now,
    };
    const taskData = {
      objective: input.objective,
      ownerSeatId: ownerSeat.id,
      opportunityObjectId: opportunity.id,
      relationshipObjectId: recordValue(opportunity.data).relationshipObjectId || null,
      operatingMode: "native_eos",
    };
    const task = {
      id: taskId,
      companyId: access.company.id,
      instrumentKey: "tasks",
      objectType: "task",
      objectKey: `task:opportunity-follow-up:${opportunity.id}:${taskId}`,
      title: input.title,
      summary: input.objective,
      state: "draft",
      classification: opportunity.classification,
      visibility: "team",
      // The canonical object owner is the accountable role, not merely the
      // user who made the assignment.  That lets the task appear in that
      // role's governed work surface when an agent is replaced by a human.
      ownerSeatId: ownerSeat.id,
      parentObjectId: null,
      data: taskData,
      sourceReference: { authority: "native_eos", capability: "crm_follow_up" },
      evidenceIds: [],
      contentSha256: nativeContractContentSha256({
        schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: "tasks", objectType: "task",
        objectKey: `task:opportunity-follow-up:${opportunity.id}:${taskId}`, title: input.title, summary: input.objective, state: "draft",
        classification: opportunity.classification, visibility: "team", ownerSeatId: ownerSeat.id, data: taskData,
        sourceReference: { authority: "native_eos", capability: "crm_follow_up" }, evidenceIds: [], version: 1,
      }),
      version: 1,
      recordedByUserId: req.user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    await db.transaction(async (tx) => {
      await tx.insert(eosInstrumentObjects).values(task);
      const [updated] = await tx.update(eosInstrumentObjects).set({
        data: nextOpportunityData,
        version: nextOpportunity.version,
        updatedAt: now,
        contentSha256: nativeContractContentSha256({
          schemaVersion: "eos.instrument-object.v1", companyId: access.company.id, instrumentKey: opportunity.instrumentKey,
          objectType: opportunity.objectType, objectKey: opportunity.objectKey, title: opportunity.title, summary: opportunity.summary,
          state: opportunity.state, classification: opportunity.classification, visibility: opportunity.visibility, ownerSeatId: opportunity.ownerSeatId,
          data: nextOpportunityData, sourceReference: opportunity.sourceReference, evidenceIds: opportunity.evidenceIds, version: nextOpportunity.version,
        }),
      }).where(and(eq(eosInstrumentObjects.id, opportunity.id), eq(eosInstrumentObjects.companyId, access.company.id), eq(eosInstrumentObjects.version, opportunity.version))).returning();
      if (!updated) throw new EosRouteError(409, "crm_opportunity_concurrent_change", "The opportunity changed before its follow-up action could be recorded.");
      await tx.insert(eosInstrumentLinks).values({ id: linkId, companyId: access.company.id, sourceObjectId: opportunity.id, targetObjectId: taskId, relationshipType: "has_follow_up", metadata: { ownerSeatId: ownerSeat.id }, createdByUserId: req.user.id, createdAt: now });
      await tx.insert(eosInstrumentCommands).values([
        { id: opportunityCommandId, companyId: access.company.id, instrumentKey: "crm", objectId: opportunity.id, commandType: "opportunity.follow_up.create", idempotencyKey: input.idempotencyKey, expectedVersion: opportunity.version, payload: { taskObjectId: taskId, ownerSeatId: ownerSeat.id }, state: "completed", result: { taskObjectId: taskId, linkId, opportunityVersion: nextOpportunity.version }, policyDecisionId: crmPolicy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now },
        { id: taskCommandId, companyId: access.company.id, instrumentKey: "tasks", objectId: taskId, commandType: "task.create_from_opportunity", idempotencyKey: `${input.idempotencyKey}:task`, expectedVersion: null, payload: { opportunityObjectId: opportunity.id, ownerSeatId: ownerSeat.id }, state: "completed", result: { taskObjectId: taskId, linkId }, policyDecisionId: tasksPolicy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now },
      ]);
      await tx.insert(eosInstrumentEvents).values([
        { id: randomUUID(), companyId: access.company.id, instrumentKey: "tasks", objectId: taskId, commandId: taskCommandId, eventType: "object.created", fromState: null, toState: "draft", objectVersion: 1, payload: { objectType: "task", opportunityObjectId: opportunity.id, ownerSeatId: ownerSeat.id }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: taskId, commandId: taskCommandId, eventType: "object.created", toState: "draft", objectVersion: 1 }), recordedByUserId: req.user.id, createdAt: now },
        { id: randomUUID(), companyId: access.company.id, instrumentKey: "crm", objectId: opportunity.id, commandId: opportunityCommandId, eventType: "opportunity.follow_up.created", fromState: opportunity.state, toState: opportunity.state, objectVersion: nextOpportunity.version, payload: { taskObjectId: taskId, linkId, ownerSeatId: ownerSeat.id }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: opportunity.id, commandId: opportunityCommandId, eventType: "opportunity.follow_up.created", taskId, linkId, objectVersion: nextOpportunity.version }), recordedByUserId: req.user.id, createdAt: now },
      ]);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "crm.opportunity.follow_up.created", targetType: "crm_opportunity", targetId: opportunity.id, traceId: crmPolicy.traceId, correlationId: crmPolicy.correlationId, result: "draft_task_created", details: { taskObjectId: taskId, linkId, ownerSeatId: ownerSeat.id, crmPolicyDecisionId: crmPolicy.decisionId, tasksPolicyDecisionId: tasksPolicy.decisionId }, createdAt: now });
    });
    res.status(201).json({ command: { id: opportunityCommandId, state: "completed" }, opportunity: nextOpportunity, task, link: { id: linkId, relationshipType: "has_follow_up" }, replayed: false });
  }));

  app.post("/api/eos/companies/:companyId/instrument-objects/:objectId/transitions", route(async (req, res) => {
    const input = instrumentTransitionSchema.parse(req.body); assertCredentialFree(input);
    const [current] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, req.params.objectId), eq(eosInstrumentObjects.companyId, Number(req.params.companyId)))).limit(1);
    if (!current) throw new EosRouteError(404, "instrument_object_not_found", "Instrument object not found.");
    const consequential = ["active", "completed", "cancelled", "archived"].includes(input.state);
    const { access, policy } = await instrumentAccess(req, consequential ? "decide" : "execute", current.instrumentKey, "instrument.object.transition", current.classification);
    if (!(await visibleObjectSet(access, [current])).length)
      throw new EosRouteError(404, "instrument_object_unavailable", "This object is unavailable in your current role scope.");
    const replay = await replayCommand(access.company.id, input.idempotencyKey, current.instrumentKey, "object.transition"); if (replay) { res.json(replay); return; }
    if (current.version !== input.expectedVersion) throw new EosRouteError(409, "instrument_version_conflict", "The instrument object changed before this transition.");
    if (!mayTransitionInstrumentObject(current.state, input.state)) throw new EosRouteError(409, "instrument_transition_invalid", `Instrument objects cannot move from ${current.state} to ${input.state}.`);
    if (["active", "completed"].includes(input.state)) {
      await assertPublicCommercialRouting(req, access, { instrumentKey: current.instrumentKey, objectType: current.objectType, data: recordValue(current.data), classification: current.classification });
      await assertNativeCommerceOrderSource(req, access, { instrumentKey: current.instrumentKey, objectType: current.objectType, data: recordValue(current.data), classification: current.classification });
    }
    if (["active", "completed"].includes(input.state)) {
      const findings = instrumentDomainFindings(eosInstrumentKeySchema.parse(current.instrumentKey), current.objectType, current.data);
      if (findings.length) throw new EosRouteError(409, findings[0].code, findings[0].message);
      if (current.instrumentKey === "forms" && current.objectType === "form" && recordValue(current.data).internalCapture === true && recordValue(current.data).publicCapture !== true)
        internalFormDefinition(current.data);
    }
    await assertNativeCanvasUpdate(access, current, { data: recordValue(current.data) });
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
    if (!(await visibleObjectSet(access, [source])).length)
      throw new EosRouteError(404, "instrument_link_source_unavailable", "The source object is unavailable in your current role scope.");
    // Relationships can reveal the existence and purpose of their target.
    // Require the same focused read permission on that target before linking;
    // a source-tool grant is never a back door into another role's tool data.
    const targetAccess = await instrumentAccess(req, "view", target.instrumentKey, "instrument.read", target.classification);
    if (!(await visibleObjectSet(targetAccess.access, [target])).length)
      throw new EosRouteError(404, "instrument_link_target_unavailable", "The target object is unavailable in your current role scope.");
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

  app.delete("/api/eos/companies/:companyId/instrument-links/:linkId", route(async (req, res) => {
    const input = instrumentLinkDeleteSchema.parse(req.body); assertCredentialFree(input);
    const linkId = z.string().uuid().parse(req.params.linkId);
    const companyId = Number(req.params.companyId);
    const links = await db.select().from(eosInstrumentLinks).where(and(eq(eosInstrumentLinks.id, linkId), eq(eosInstrumentLinks.companyId, companyId)));
    const link = links[0];
    if (!link) throw new EosRouteError(404, "instrument_link_not_found", "The relationship is unavailable in this company.");
    const objects = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, companyId), inArray(eosInstrumentObjects.id, [link.sourceObjectId, link.targetObjectId])));
    if (objects.length !== 2) throw new EosRouteError(409, "instrument_link_scope_invalid", "Both relationship records must resolve inside the selected company.");
    const source = objects.find((item) => item.id === link.sourceObjectId)!;
    const target = objects.find((item) => item.id === link.targetObjectId)!;
    const { access, policy } = await instrumentAccess(req, "execute", source.instrumentKey, "instrument.link.remove", source.classification);
    if (!(await visibleObjectSet(access, [source])).length)
      throw new EosRouteError(404, "instrument_link_source_unavailable", "The relationship source is unavailable in your current role scope.");
    const targetAccess = await instrumentAccess(req, "view", target.instrumentKey, "instrument.read", target.classification);
    if (!(await visibleObjectSet(targetAccess.access, [target])).length)
      throw new EosRouteError(404, "instrument_link_target_unavailable", "The relationship target is unavailable in your current role scope.");
    const replay = await replayCommand(access.company.id, input.idempotencyKey, source.instrumentKey, "link.remove"); if (replay) { res.json(replay); return; }
    const now = new Date(); const commandId = randomUUID();
    await db.transaction(async (tx) => {
      const removed = await tx.delete(eosInstrumentLinks).where(and(eq(eosInstrumentLinks.id, link.id), eq(eosInstrumentLinks.companyId, access.company.id))).returning({ id: eosInstrumentLinks.id });
      if (!removed[0]) throw new EosRouteError(409, "instrument_link_concurrent_change", "The relationship changed before it could be removed.");
      await tx.insert(eosInstrumentCommands).values({ id: commandId, companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandType: "link.remove", idempotencyKey: input.idempotencyKey, expectedVersion: source.version, payload: { linkId: link.id, targetObjectId: target.id, relationshipType: link.relationshipType, rationale: input.rationale }, state: "completed", result: { linkId: link.id, removed: true }, policyDecisionId: policy.decisionId, requestedByUserId: req.user.id, createdAt: now, completedAt: now });
      await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: access.company.id, instrumentKey: source.instrumentKey, objectId: source.id, commandId, eventType: "relationship.removed", fromState: source.state, toState: source.state, objectVersion: source.version, payload: { linkId: link.id, targetObjectId: target.id, relationshipType: link.relationshipType, rationale: input.rationale }, evidenceIds: [], contentSha256: eventHash({ companyId: access.company.id, objectId: source.id, commandId, eventType: "relationship.removed", linkId: link.id }), recordedByUserId: req.user.id, createdAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "instrument.relationship.removed", targetType: source.instrumentKey, targetId: link.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "removed", details: { sourceObjectId: source.id, targetObjectId: target.id, relationshipType: link.relationshipType, rationale: input.rationale, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.json({ command: { id: commandId, state: "completed" }, removedLink: { id: link.id, sourceObjectId: source.id, targetObjectId: target.id, relationshipType: link.relationshipType }, replayed: false });
  }));
}
