import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import { companies, eosAgentEventOutbox, eosAuditRecords, eosInstrumentCommands, eosInstrumentEvents, eosInstrumentLinks, eosInstrumentObjects } from "@shared/schema";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { dispatchAgentEventOutboxEvent } from "../agents/scheduler";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import { writeLog } from "../observability/logger";

const publicCaptureRateLimit = fixedWindowRateLimit({ limit: 30, windowMs: 60_000, namespace: "eos-public-lead-capture" });
const publicIdSchema = z.string().uuid();
const questionSchema = z.object({
  id: z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_:-]*$/i),
  label: z.string().trim().min(2).max(240),
  type: z.enum(["short_text", "long_text", "email", "phone", "select"]).default("short_text"),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
});
const publicFormDataSchema = z.object({
  publicCapture: z.literal(true),
  questions: z.array(questionSchema).min(1).max(30),
  consentVersion: z.string().trim().min(1).max(120),
  consentLabel: z.string().trim().min(2).max(1_000),
  confirmationMessage: z.string().trim().min(2).max(1_000),
  commercialPipelineObjectId: z.string().uuid().optional(),
  commercialInitialStage: z.string().trim().min(1).max(160).optional(),
}).passthrough().superRefine((value, context) => {
  if (Boolean(value.commercialPipelineObjectId) !== Boolean(value.commercialInitialStage)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["commercialPipelineObjectId"], message: "Choose both a native pipeline and its first stage, or leave automatic opportunity routing off." });
  }
});
const publicSubmissionSchema = z.object({
  answers: z.record(z.string(), z.string().trim().max(4_000)),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(""),
}).superRefine((value, context) => {
  if (Object.keys(value.answers).length > 30) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["answers"], message: "A lead form accepts at most 30 answers." });
  }
});

class PublicLeadCaptureError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof PublicLeadCaptureError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "lead_capture_input_invalid", message: error.issues[0]?.message || "The form submission is invalid." });
      next(error);
    }
  };
}

function safeFormDefinition(form: typeof eosInstrumentObjects.$inferSelect) {
  const data = publicFormDataSchema.safeParse(form.data);
  if (!data.success || form.instrumentKey !== "forms" || form.objectType !== "form" || form.state !== "active") {
    throw new PublicLeadCaptureError(404, "lead_capture_form_unavailable", "This EOS form is unavailable.");
  }
  return data.data;
}

function publicHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function eventHash(input: Record<string, unknown>) {
  return nativeContractContentSha256({ schemaVersion: "eos.public-lead-capture-event.v1", ...input });
}

function answerFor(answers: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = answers[name]?.trim();
    if (value) return value;
  }
  return "";
}

async function commercialRoutingFor(companyId: number, pipelineObjectId?: string, initialStage?: string) {
  if (!pipelineObjectId && !initialStage) return null;
  if (!pipelineObjectId || !initialStage) throw new PublicLeadCaptureError(409, "lead_capture_opportunity_routing_invalid", "This intake point has incomplete commercial routing. Configure both its native pipeline and initial stage before accepting submissions.");
  const [pipeline] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, pipelineObjectId), eq(eosInstrumentObjects.companyId, companyId),
    eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "pipeline"), eq(eosInstrumentObjects.state, "active"),
  )).limit(1);
  const pipelineData = pipeline?.data as Record<string, unknown> | undefined;
  const rawStages = pipelineData?.stages;
  const stages = Array.isArray(rawStages) ? rawStages.filter((stage): stage is string => typeof stage === "string") : [];
  if (!pipeline || !stages.includes(initialStage)) throw new PublicLeadCaptureError(409, "lead_capture_opportunity_routing_unavailable", "This intake point's native pipeline or first stage is no longer available. Pause it and choose an active commercial destination before accepting submissions.");
  return { pipeline, initialStage };
}

export function registerPublicLeadCaptureRoutes(app: Express): void {
  app.use("/api/public/lead-forms", publicCaptureRateLimit);

  app.get("/api/public/lead-forms/:formId", route(async (req, res) => {
    const formId = publicIdSchema.parse(req.params.formId);
    const [form] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, formId), eq(eosInstrumentObjects.instrumentKey, "forms"),
      eq(eosInstrumentObjects.objectType, "form"), eq(eosInstrumentObjects.state, "active"),
    )).limit(1);
    if (!form) throw new PublicLeadCaptureError(404, "lead_capture_form_unavailable", "This EOS form is unavailable.");
    const definition = safeFormDefinition(form);
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, form.companyId)).limit(1);
    publicHeaders(res);
    res.json({ schemaVersion: "eos.public-lead-form.v1", form: {
      id: form.id, title: form.title, summary: form.summary, questions: definition.questions,
      consentLabel: definition.consentLabel, companyName: company?.name || "Organization",
    } });
  }));

  app.post("/api/public/lead-forms/:formId/submissions", route(async (req, res) => {
    const formId = publicIdSchema.parse(req.params.formId);
    const input = publicSubmissionSchema.parse(req.body);
    // An invisible honeypot catches basic unsophisticated spam. Do not return a
    // different acknowledgement or write any company state for it.
    if (input.website.trim()) {
      publicHeaders(res);
      res.status(202).json({ schemaVersion: "eos.public-lead-submission.v1", accepted: true });
      return;
    }
    const [form] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, formId), eq(eosInstrumentObjects.instrumentKey, "forms"),
      eq(eosInstrumentObjects.objectType, "form"), eq(eosInstrumentObjects.state, "active"),
    )).limit(1);
    if (!form) throw new PublicLeadCaptureError(404, "lead_capture_form_unavailable", "This EOS form is unavailable.");
    const definition = safeFormDefinition(form);
    const commercialRouting = await commercialRoutingFor(form.companyId, definition.commercialPipelineObjectId, definition.commercialInitialStage);
    const allowed = new Set(definition.questions.map((question) => question.id));
    for (const key of Object.keys(input.answers)) {
      if (!allowed.has(key)) throw new PublicLeadCaptureError(400, "lead_capture_answer_unknown", "The submission includes a field that is not part of this form.");
    }
    for (const question of definition.questions) {
      const value = input.answers[question.id]?.trim() || "";
      if (question.required && !value) throw new PublicLeadCaptureError(400, "lead_capture_answer_required", question.label + " is required.");
      if (question.type === "email" && value && !z.string().email().safeParse(value).success) throw new PublicLeadCaptureError(400, "lead_capture_email_invalid", "Enter a valid email address.");
      if (question.type === "select" && value && !question.options.includes(value)) throw new PublicLeadCaptureError(400, "lead_capture_selection_invalid", "Choose a listed value for " + question.label + ".");
    }
    // A public submission is permitted only because an authorized operator
    // activated the form. Reuse that recorded decision instead of inventing a
    // public actor or an approval that never happened.
    const [activation] = await db.select().from(eosInstrumentCommands).where(and(
      eq(eosInstrumentCommands.companyId, form.companyId), eq(eosInstrumentCommands.objectId, form.id),
      eq(eosInstrumentCommands.commandType, "object.transition"),
    )).orderBy(desc(eosInstrumentCommands.completedAt)).limit(1);
    if (!activation?.policyDecisionId) throw new PublicLeadCaptureError(409, "lead_capture_activation_evidence_missing", "This form is active but has no publish authorization record. Pause it and republish through EOS.");

    const now = new Date(); const submissionId = randomUUID(); const agentEventId = randomUUID();
    const submissionCommandId = randomUUID();
    const leadName = answerFor(input.answers, ["name", "full_name", "fullName", "first_name", "firstName"]) || "New lead";
    const email = answerFor(input.answers, ["email", "email_address", "emailAddress"]);
    const companyName = answerFor(input.answers, ["company", "company_name", "organization"]);
    const sourceReference = { authority: "public_eos_lead_capture", formObjectId: form.id, consentVersion: definition.consentVersion, capturedAt: now.toISOString(), externalActor: "unverified_public_submitter" };
    const common = { companyId: form.companyId, classification: "confidential", visibility: "organization", ownerSeatId: form.ownerSeatId, parentObjectId: null, evidenceIds: [], version: 1, recordedByUserId: form.recordedByUserId, createdAt: now, updatedAt: now, archivedAt: null, state: "active" } as const;
    const submissionProjection = { ...common, id: submissionId, instrumentKey: "forms", objectType: "submission", objectKey: "submission:" + form.id + ":" + submissionId, title: "Lead capture · " + leadName, summary: "Public submission for " + form.title + ".", data: { formObjectId: form.id, responses: input.answers, submittedAt: now.toISOString(), consent: true, consentVersion: definition.consentVersion }, sourceReference };
    const normalizedEmail = email.trim().toLowerCase();
    await db.transaction(async (tx) => {
      // E-mail is the only public identity attribute safe enough to use for an
      // automatic reconciliation. Lock on it to prevent two concurrent form
      // posts from creating parallel CRM people for the same known contact.
      if (normalizedEmail) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`public-lead:${form.companyId}:${normalizedEmail}`}))`);
      const [existingPerson] = normalizedEmail ? await tx.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, form.companyId), eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "person"), eq(eosInstrumentObjects.state, "active"),
        sql`lower(${eosInstrumentObjects.data}->>'email') = ${normalizedEmail}`,
      )).limit(1) : [];
      const personProjection = existingPerson || { ...common, id: randomUUID(), instrumentKey: "crm", objectType: "person", objectKey: "lead:" + form.id + ":" + randomUUID(), title: leadName, summary: email || companyName || "Lead captured by " + form.title + ".", data: { displayName: leadName, email, companyName, sourceFormObjectId: form.id, submissionObjectId: submissionId }, sourceReference };
      const [existingRelationship] = existingPerson ? await tx.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, form.companyId), eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "relationship"), eq(eosInstrumentObjects.state, "active"),
        sql`${eosInstrumentObjects.data}->>'personObjectId' = ${personProjection.id}`,
        sql`${eosInstrumentObjects.data}->>'relationshipType' = 'lead'`,
      )).limit(1) : [];
      const relationshipProjection = existingRelationship || { ...common, id: randomUUID(), instrumentKey: "crm", objectType: "relationship", objectKey: "lead-relationship:" + form.id + ":" + randomUUID(), title: "Lead · " + leadName, summary: "Commercial lead relationship created from " + form.title + ".", data: { personObjectId: personProjection.id, relationshipType: "lead", sourceFormObjectId: form.id, submissionObjectId: submissionId }, sourceReference };
      // A native public form may be deliberately routed into a native
      // commercial pipeline. Repeated submissions from the same relationship
      // join the existing live opportunity rather than quietly creating a
      // duplicate deal. A later submission after a won/lost opportunity is a
      // new commercial signal and therefore creates a fresh opportunity.
      const [existingOpportunity] = commercialRouting ? await tx.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, form.companyId), eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "opportunity"), eq(eosInstrumentObjects.state, "active"),
        sql`${eosInstrumentObjects.data}->>'relationshipObjectId' = ${relationshipProjection.id}`,
        sql`${eosInstrumentObjects.data}->>'pipelineObjectId' = ${commercialRouting.pipeline.id}`,
      )).limit(1) : [];
      const opportunityProjection = commercialRouting && !existingOpportunity ? {
        ...common, id: randomUUID(), instrumentKey: "crm", objectType: "opportunity", objectKey: "public-lead-opportunity:" + form.id + ":" + submissionId,
        title: form.title + " · " + leadName, summary: "Native commercial opportunity created from a consented public form submission.",
        data: { relationshipObjectId: relationshipProjection.id, pipelineObjectId: commercialRouting.pipeline.id, stage: commercialRouting.initialStage, amountMinor: 0, currency: "USD", sourceFormObjectId: form.id, submissionObjectId: submissionId },
        sourceReference,
      } : existingOpportunity || null;
      const objects = [submissionProjection, ...(existingPerson ? [] : [personProjection]), ...(existingRelationship ? [] : [relationshipProjection]), ...(opportunityProjection && !existingOpportunity ? [opportunityProjection] : [])].map((projection) => ({ ...projection, contentSha256: nativeContractContentSha256(projection) }));
      await tx.insert(eosInstrumentObjects).values(objects);
      const commands = [
        { id: submissionCommandId, instrumentKey: "forms", objectId: submissionId, commandType: "public_submission.recorded", result: { objectId: submissionId, state: "active" } },
        ...(!existingPerson ? [{ id: randomUUID(), instrumentKey: "crm", objectId: personProjection.id, commandType: "public_lead.person_created", result: { objectId: personProjection.id, state: "active" } }] : []),
        ...(!existingRelationship ? [{ id: randomUUID(), instrumentKey: "crm", objectId: relationshipProjection.id, commandType: "public_lead.relationship_created", result: { objectId: relationshipProjection.id, state: "active" } }] : []),
        ...(opportunityProjection && !existingOpportunity ? [{ id: randomUUID(), instrumentKey: "crm", objectId: opportunityProjection.id, commandType: "public_lead.opportunity_created", result: { objectId: opportunityProjection.id, state: "active" } }] : []),
      ].map((command) => ({ ...command, companyId: form.companyId, idempotencyKey: command.commandType + ":" + command.objectId, expectedVersion: null, payload: { formObjectId: form.id, source: "unverified_public_submitter" }, state: "completed", policyDecisionId: activation.policyDecisionId, requestedByUserId: form.recordedByUserId, createdAt: now, completedAt: now }));
      await tx.insert(eosInstrumentCommands).values(commands);
      const events = [
        { object: submissionProjection, commandId: submissionCommandId, eventType: "public_submission.recorded" },
        ...(!existingPerson ? [{ object: personProjection, commandId: commands.find((command) => command.objectId === personProjection.id)!.id, eventType: "public_lead.person_created" }] : []),
        ...(!existingRelationship ? [{ object: relationshipProjection, commandId: commands.find((command) => command.objectId === relationshipProjection.id)!.id, eventType: "public_lead.relationship_created" }] : []),
        ...(opportunityProjection && !existingOpportunity ? [{ object: opportunityProjection, commandId: commands.find((command) => command.objectId === opportunityProjection.id)!.id, eventType: "public_lead.opportunity_created" }] : []),
      ].map(({ object, commandId, eventType }) => ({ id: randomUUID(), companyId: form.companyId, instrumentKey: object.instrumentKey, objectId: object.id, commandId, eventType, fromState: null, toState: "active", objectVersion: 1, payload: { formObjectId: form.id, source: "unverified_public_submitter" }, evidenceIds: [], contentSha256: eventHash({ companyId: form.companyId, objectId: object.id, commandId, eventType, formObjectId: form.id }), recordedByUserId: form.recordedByUserId, createdAt: now }));
      await tx.insert(eosInstrumentEvents).values(events);
      // This is an internal, consent-gated handoff from an EOS-owned public
      // funnel into the company operating system. Do not put the visitor's
      // identity, free-form answers, or reconciliation result in the trigger.
      // The assigned Role Agent reads the native CRM records only through its
      // normal role, tenant, and classification scope.
      await tx.insert(eosAgentEventOutbox).values({
        id: agentEventId,
        companyId: form.companyId,
        eventType: "eos.crm.consented_lead_recorded.v1",
        aggregateType: "lead_submission",
        aggregateId: submissionId,
        payload: {
          schemaVersion: "eos.crm.consented_lead_recorded.v1",
          formObjectId: form.id,
          submissionObjectId: submissionId,
          crmPersonObjectId: personProjection.id,
          crmRelationshipObjectId: relationshipProjection.id,
          crmOpportunityObjectId: opportunityProjection?.id || null,
          consentRecorded: true,
          consentVersion: definition.consentVersion,
          classification: "confidential",
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
      await tx.insert(eosInstrumentLinks).values([
        { id: randomUUID(), companyId: form.companyId, sourceObjectId: form.id, targetObjectId: submissionId, relationshipType: "received", metadata: { source: "public_eos_capture" }, createdByUserId: form.recordedByUserId, createdAt: now },
        { id: randomUUID(), companyId: form.companyId, sourceObjectId: submissionId, targetObjectId: personProjection.id, relationshipType: "identified", metadata: { source: "public_eos_capture", reconciled: Boolean(existingPerson) }, createdByUserId: form.recordedByUserId, createdAt: now },
        // The person-to-relationship edge is durable topology, not an event
        // log. A repeated capture gets its own submission edges above but must
        // not attempt to duplicate this already-established relationship.
        ...(!existingRelationship ? [{ id: randomUUID(), companyId: form.companyId, sourceObjectId: personProjection.id, targetObjectId: relationshipProjection.id, relationshipType: "has_relationship", metadata: { source: "public_eos_capture", reconciled: false }, createdByUserId: form.recordedByUserId, createdAt: now }] : []),
        ...(opportunityProjection ? [{ id: randomUUID(), companyId: form.companyId, sourceObjectId: submissionId, targetObjectId: opportunityProjection.id, relationshipType: "routed_to_opportunity", metadata: { source: "public_eos_capture", reconciled: Boolean(existingOpportunity) }, createdByUserId: form.recordedByUserId, createdAt: now }] : []),
        ...(opportunityProjection && !existingOpportunity ? [
          { id: randomUUID(), companyId: form.companyId, sourceObjectId: relationshipProjection.id, targetObjectId: opportunityProjection.id, relationshipType: "has_opportunity", metadata: { source: "public_eos_capture" }, createdByUserId: form.recordedByUserId, createdAt: now },
          { id: randomUUID(), companyId: form.companyId, sourceObjectId: commercialRouting!.pipeline.id, targetObjectId: opportunityProjection.id, relationshipType: "contains_opportunity", metadata: { source: "public_eos_capture" }, createdByUserId: form.recordedByUserId, createdAt: now },
        ] : []),
      ]);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: form.companyId, actorUserId: form.recordedByUserId, action: "lead_capture.public_submission_recorded", targetType: "lead_capture_form", targetId: form.id, traceId: "public:" + submissionId, correlationId: submissionId, result: "captured_unverified", details: { actorType: "unverified_public_submitter", formObjectId: form.id, submissionObjectId: submissionId, crmPersonObjectId: personProjection.id, crmRelationshipObjectId: relationshipProjection.id, crmOpportunityObjectId: opportunityProjection?.id || null, commercialPipelineObjectId: commercialRouting?.pipeline.id || null, commercialInitialStage: commercialRouting?.initialStage || null, reconciledExistingPerson: Boolean(existingPerson), reconciledExistingRelationship: Boolean(existingRelationship), reconciledExistingOpportunity: Boolean(existingOpportunity), consentVersion: definition.consentVersion, activationPolicyDecisionId: activation.policyDecisionId }, createdAt: now });
    });
    // Dispatch only after commit. Public acceptance must not fail merely
    // because the immediate scheduler attempt is temporarily unavailable: the
    // durable outbox is retried by EOS, and neither path exposes or replays
    // the visitor's data.
    try {
      await dispatchAgentEventOutboxEvent(agentEventId);
    } catch (error) {
      writeLog("error", "public_lead_agent_event_dispatch_deferred", { agentEventId, companyId: form.companyId, error });
    }
    publicHeaders(res);
    // Never disclose reconciliation to an untrusted public submitter: that
    // would turn the form into an account-enumeration oracle. The result is
    // retained in the internal audit record instead.
    res.status(201).json({ schemaVersion: "eos.public-lead-submission.v1", accepted: true, confirmationMessage: definition.confirmationMessage });
  }));
}
