import { createHash, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { db } from "../db";
import {
  companies,
  eosApprovalRequests,
  eosAuditRecords,
  eosCommercialCases,
  eosManifestVersions,
  eosMemberships,
  eosOfferPrograms,
  eosEvidence,
  eosIntegrationBindings,
  eosRecoveryActivationEvents,
  eosRecoveryAgreementAuthorities,
  eosRecoveryAgreementInstances,
  eosRecoveryBillingManifests,
  eosRecoveryProviderReceipts,
  eosEsignDocumentVersions,
  eosRecoveryCall2Events,
  eosRecoveryCall2Packets,
  eosRecoveryCalculatorEvents,
  eosRecoveryCalculatorSessions,
  eosSeats,
  eosStakeholderRelationships,
  eosStakeholders,
  eosWorkPackets,
} from "@shared/schema";
import {
  RECOVERY_ASSUMPTION_VERSION,
  RECOVERY_CONSENT_VERSION,
  RECOVERY_REPORT_VERSION,
  buildRecoverySalesBrief,
  calculateRecoveryOpportunity,
  recoveryCalculatorInputSchema,
  recoveryContactSchema,
  recoverySessionTokenSchema,
  recoverySourceSchema,
  type RecoveryResult,
} from "@shared/recovery-calculator";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import { createRecoverySessionSecret, recoverySessionDigest } from "../recovery-calculator-token";
import {
  RECOVERY_CALL_2_PACKET_VERSION,
  RECOVERY_CALL_2_TERMS_AUTHORITY,
  commercialStateForDisposition,
  recoveryCall2DecisionSchema,
  recoveryCall2ExceptionSchema,
  recoveryCall2Terms,
  recoveryCall2UpdateSchema,
} from "@shared/recovery-call2";
import {
  RECOVERY_AGREEMENT_AUTHORITY_VERSION,
  RECOVERY_AGREEMENT_PACKET_SOURCE,
  RECOVERY_AGREEMENT_TEMPLATE_SOURCE,
  RECOVERY_BILLING_MANIFEST_SOURCE,
  RECOVERY_BILLING_MANIFEST_VERSION,
  agreementProviderBlockers,
  assertConfigurationReference,
  billingProviderBlockers,
  counselDispositionSchema,
  recoveryAgreementConfigurationSchema,
  recoveryBillingConfigurationSchema,
} from "@shared/recovery-commercial-activation";
import { processRecoveryProviderWebhook } from "../recovery-provider-receipts";

const EMPYREAN_ORGANIZATION_KEY = "ORG-EMPYREAN-STUDIOS";
const publicRateLimit = fixedWindowRateLimit({ limit: 60, windowMs: 60_000, namespace: "recovery-calculator" });
const contactRateLimit = fixedWindowRateLimit({ limit: 8, windowMs: 60_000, namespace: "recovery-calculator-contact" });
const providerWebhookRateLimit = fixedWindowRateLimit({ limit: 180, windowMs: 60_000, namespace: "recovery-provider-webhooks" });
const inputEnvelopeSchema = z.object({
  inputs: recoveryCalculatorInputSchema,
  idempotencyKey: z.string().trim().min(12).max(120),
});
const contactEnvelopeSchema = z.object({
  contact: recoveryContactSchema,
  idempotencyKey: z.string().trim().min(12).max(120),
});

class RecoveryRouteError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function publicHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function publicRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    publicHeaders(res);
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof RecoveryRouteError)
        return void res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError)
        return void res.status(400).json({ code: "recovery_input_invalid", message: error.issues[0]?.message || "The submitted information is invalid." });
      console.error("Recovery calculator request failed", error);
      return void res.status(500).json({ code: "recovery_calculator_failed", message: "The calculator could not complete that action." });
    }
  };
}

function organizationKey(manifest: unknown): string | null {
  const compiledFrom = (manifest as { compiledFrom?: any } | null)?.compiledFrom;
  return typeof compiledFrom?.organizationKey === "string"
    ? compiledFrom.organizationKey
    : typeof compiledFrom?.companyPackage?.organizationKey === "string"
      ? compiledFrom.companyPackage.organizationKey
      : typeof compiledFrom?.referenceInstance?.organizationKey === "string"
        ? compiledFrom.referenceInstance.organizationKey
        : null;
}

async function resolveEmpyrean(companyId?: number) {
  const manifests = companyId
    ? await db.select().from(eosManifestVersions).where(eq(eosManifestVersions.companyId, companyId)).orderBy(desc(eosManifestVersions.version))
    : await db.select().from(eosManifestVersions).orderBy(desc(eosManifestVersions.version));
  const companyIds = Array.from(new Set(manifests.filter((item) => organizationKey(item.manifest) === EMPYREAN_ORGANIZATION_KEY).map((item) => item.companyId)));
  if (companyIds.length !== 1)
    throw new RecoveryRouteError(503, "recovery_context_unavailable", companyIds.length ? "The Empyrean operating context is ambiguous." : companyId ? "The requested Empyrean operating context has not been compiled." : "The Empyrean operating context has not been compiled.");
  const [company] = await db.select().from(companies).where(eq(companies.id, companyIds[0])).limit(1);
  if (!company) throw new RecoveryRouteError(503, "recovery_context_unavailable", "The Empyrean operating context is unavailable.");
  const seats = await db.select().from(eosSeats).where(and(eq(eosSeats.companyId, company.id), eq(eosSeats.status, "active")));
  const ownerSeat = seats.find((seat) => /sales development representative/i.test(seat.title))
    || seats.find((seat) => /account executive/i.test(seat.title))
    || seats.find((seat) => seat.kind === "company_ceo")
    || seats.find((seat) => seat.kind === "founder");
  if (!ownerSeat) throw new RecoveryRouteError(503, "recovery_owner_unavailable", "The Recovery follow-up owner has not been compiled.");
  return { company, ownerSeat };
}

async function resolveSession(token: string) {
  recoverySessionTokenSchema.parse(token);
  const [session] = await db.select().from(eosRecoveryCalculatorSessions)
    .where(eq(eosRecoveryCalculatorSessions.publicTokenHash, recoverySessionDigest(token))).limit(1);
  if (!session || session.expiresAt <= new Date())
    throw new RecoveryRouteError(404, "recovery_session_unavailable", "This calculator session is invalid or has expired.");
  return session;
}

function safeCalendarUrl(): string | null {
  const raw = process.env.EOS_RECOVERY_DIAGNOSTIC_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function partialResult(result: RecoveryResult) {
  const dominant = result.pools.find((pool) => pool.key === result.dominantPool)!;
  return {
    assumptionVersion: result.assumptionVersion,
    score: result.score,
    fit: result.fit,
    route: result.route,
    range: result.range,
    dominantOpportunity: { key: dominant.key, label: dominant.label, base: dominant.base },
    confidence: result.confidence,
    disclaimer: result.disclaimer,
  };
}

function projection(session: typeof eosRecoveryCalculatorSessions.$inferSelect) {
  const hasResult = session.inputRevision > 0 && session.result && Object.keys(session.result as object).length > 0;
  const unlocked = session.consentGranted && Boolean(session.contactCapturedAt);
  const result = hasResult ? session.result as RecoveryResult : null;
  const calendarUrl = unlocked && session.route === "recovery_diagnostic" ? safeCalendarUrl() : null;
  return {
    session: { status: session.status, inputRevision: session.inputRevision, expiresAt: session.expiresAt },
    partialResult: result ? partialResult(result) : null,
    fullReport: unlocked ? result : null,
    contactCaptured: unlocked,
    route: unlocked ? {
      key: session.route,
      calendarUrl,
      calendarState: session.route === "recovery_diagnostic" ? (calendarUrl ? "available" : "not_configured") : "not_applicable",
      message: session.route === "recovery_diagnostic"
        ? "Your inputs support a record-level Recovery diagnostic. The modeled range still needs source validation."
        : session.route === "diy_nurture"
          ? "Start with the recommended follow-up controls, then reassess when ownership and data are stronger."
          : session.route === "growth_education"
            ? "Resolve delivery capacity before activating more demand."
            : "Strengthen the source data and return when the operating inputs are decision-useful.",
    } : null,
    model: { assumptionVersion: RECOVERY_ASSUMPTION_VERSION, reportVersion: RECOVERY_REPORT_VERSION },
  };
}

async function appendEvent(executor: any, session: typeof eosRecoveryCalculatorSessions.$inferSelect, eventType: typeof eosRecoveryCalculatorEvents.$inferInsert["eventType"], details: Record<string, unknown> = {}, traceId = randomUUID()) {
  await executor.insert(eosRecoveryCalculatorEvents).values({ id: randomUUID(), companyId: session.companyId, sessionId: session.id, eventType, traceId, correlationId: session.id, details });
}

async function recoveryCommercialAccess(req: Request, companyId: number) {
  if (!Number.isInteger(companyId) || companyId <= 0)
    throw new RecoveryRouteError(400, "invalid_company", "Company id must be a positive integer.");
  const [owned, membership] = await Promise.all([
    db.query.companies.findFirst({ where: and(eq(companies.id, companyId), eq(companies.ownerUserId, req.user.id)) }),
    db.query.eosMemberships.findFirst({ where: and(eq(eosMemberships.companyId, companyId), eq(eosMemberships.userId, req.user.id), eq(eosMemberships.status, "active")) }),
  ]);
  const company = owned || (membership ? await db.query.companies.findFirst({ where: eq(companies.id, companyId) }) : undefined);
  const canOperate = Boolean(owned) || Boolean(membership && (["founder", "admin", "manager"].includes(membership.role) || ["confidential", "restricted"].includes(membership.classificationCeiling)));
  if (!company || !canOperate)
    throw new RecoveryRouteError(404, "company_not_found", "Company not found in the active principal scope.");
  const seat = membership?.seatId
    ? await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, membership.seatId), eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")) })
    : (await db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")))).find((item) => item.occupantUserId === req.user.id || (owned && item.kind === "founder"));
  if (!seat)
    throw new RecoveryRouteError(409, "recovery_operator_seat_required", "An active company seat is required to operate the Call-2 packet.");
  return { company, membership, seat, isFounder: Boolean(owned) || membership?.role === "founder" };
}

async function appendCall2Event(
  executor: any,
  packet: typeof eosRecoveryCall2Packets.$inferSelect | typeof eosRecoveryCall2Packets.$inferInsert,
  actor: { userId: string; seatId: string },
  eventType: typeof eosRecoveryCall2Events.$inferInsert["eventType"],
  fromState: string,
  toState: string,
  details: Record<string, unknown> = {},
  traceId = randomUUID(),
) {
  const [latest] = await executor.select({ sequence: eosRecoveryCall2Events.sequence })
    .from(eosRecoveryCall2Events)
    .where(eq(eosRecoveryCall2Events.packetId, packet.id))
    .orderBy(desc(eosRecoveryCall2Events.sequence)).limit(1);
  await executor.insert(eosRecoveryCall2Events).values({
    id: randomUUID(), packetId: packet.id, companyId: packet.companyId,
    actorUserId: actor.userId, actorSeatId: actor.seatId,
    sequence: (latest?.sequence || 0) + 1, eventType, fromState, toState,
    details, traceId, correlationId: packet.id,
  });
}

function initialCall2Fields(session: typeof eosRecoveryCalculatorSessions.$inferSelect, offer: typeof eosOfferPrograms.$inferSelect) {
  const brief = session.salesBrief as any;
  const result = session.result as RecoveryResult;
  return {
    salesBriefSnapshot: session.salesBrief,
    observedFacts: `Visitor-supplied operating snapshot: ${JSON.stringify(brief.operatingSnapshot || {})}`,
    measuredSignals: `Calculator score ${session.recoveryScore}; modeled monthly opportunity ${JSON.stringify(brief.modeledRange || {})}. These are calculated signals, not realized revenue.`,
    unavailableData: (brief.confidenceGaps || []).join(" ") || "Record-level source validation and realized attribution remain unavailable.",
    changesSinceCall1: "No post-diagnostic changes recorded yet.",
    recoveryThesis: `${brief.dominantOpportunity?.label || result.dominantPool} is the leading modeled recovery pool; validate it against source records before commitment.`,
    scopeDiscussion: `${offer.scopeInclusions} Exclusions: ${offer.exclusionsConstraints}`,
    measurementAttribution: `${result.disclaimer} Attribution must avoid overlap and double counting.`,
    clientResponsibilities: "Provide authorized source access, name follow-up ownership, validate capacity, and confirm attributable outcomes.",
    objections: (brief.likelyObjections || []).join(" "),
  };
}

function respondRecoveryError(res: Response, error: unknown): boolean {
  if (error instanceof RecoveryRouteError) {
    res.status(error.status).json({ code: error.code, message: error.message });
    return true;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ code: "recovery_call_2_input_invalid", message: error.issues[0]?.message || "The submitted Call-2 information is invalid." });
    return true;
  }
  return false;
}

async function call2Packet(companyId: number, packetId: string) {
  const packet = await db.query.eosRecoveryCall2Packets.findFirst({ where: and(eq(eosRecoveryCall2Packets.id, packetId), eq(eosRecoveryCall2Packets.companyId, companyId)) });
  if (!packet) throw new RecoveryRouteError(404, "recovery_call_2_not_found", "Call-2 packet not found in this company.");
  return packet;
}

async function appendActivationEvent(
  executor: any,
  activationId: string,
  object: { id: string; companyId: number },
  objectType: "authority" | "agreement" | "billing",
  actor: { userId: string; seatId: string },
  eventType: string,
  fromState: string,
  toState: string,
  details: Record<string, unknown> = {},
  traceId = randomUUID(),
) {
  const [latest] = await executor.select({ sequence: eosRecoveryActivationEvents.sequence })
    .from(eosRecoveryActivationEvents)
    .where(eq(eosRecoveryActivationEvents.activationId, activationId))
    .orderBy(desc(eosRecoveryActivationEvents.sequence)).limit(1);
  await executor.insert(eosRecoveryActivationEvents).values({
    id: randomUUID(), companyId: object.companyId, activationId,
    objectType, objectId: object.id, actorUserId: actor.userId,
    actorSeatId: actor.seatId, sequence: (latest?.sequence || 0) + 1,
    eventType, fromState, toState, details, traceId,
    correlationId: activationId,
  });
}

async function recoveryActivation(companyId: number, packetId: string) {
  const agreement = await db.query.eosRecoveryAgreementInstances.findFirst({
    where: and(eq(eosRecoveryAgreementInstances.companyId, companyId), eq(eosRecoveryAgreementInstances.call2PacketId, packetId)),
  });
  if (!agreement) throw new RecoveryRouteError(404, "recovery_activation_not_found", "Prepare agreement and billing controls first.");
  const [authority, billing] = await Promise.all([
    db.query.eosRecoveryAgreementAuthorities.findFirst({ where: and(eq(eosRecoveryAgreementAuthorities.id, agreement.authorityId), eq(eosRecoveryAgreementAuthorities.companyId, companyId)) }),
    db.query.eosRecoveryBillingManifests.findFirst({ where: and(eq(eosRecoveryBillingManifests.agreementInstanceId, agreement.id), eq(eosRecoveryBillingManifests.companyId, companyId)) }),
  ]);
  if (!authority || !billing) throw new RecoveryRouteError(409, "recovery_activation_incomplete", "The commercial activation record is incomplete.");
  return { agreement, authority, billing };
}

export function registerPublicRecoveryCalculatorRoutes(app: Express): void {
  app.post("/api/eos/recovery-provider-webhooks/:provider/:bindingId", providerWebhookRateLimit, async (req, res) => {
    const provider = req.params.provider;
    if (!req.rawBody) return res.status(400).json({ code: "provider_receipt_invalid", message: "A signed raw provider payload is required." });
    try {
      const result = await processRecoveryProviderWebhook({ provider, bindingId: req.params.bindingId, rawBody: req.rawBody, headers: req.headers });
      return res.status(200).json({ received: true, duplicate: result.duplicate, processingState: result.processingState });
    } catch {
      return res.status(400).json({ code: "provider_receipt_invalid", message: "The provider receipt could not be verified or reconciled." });
    }
  });

  app.use("/api/eos/recovery-calculator", publicRateLimit);

  app.post("/api/eos/recovery-calculator/sessions", publicRoute(async (req, res) => {
    const source = recoverySourceSchema.parse(req.body || {});
    const { company } = await resolveEmpyrean(source.companyId);
    const secret = createRecoverySessionSecret();
    const now = new Date();
    const session = {
      id: randomUUID(), companyId: company.id, portfolioId: company.portfolioId,
      publicTokenHash: recoverySessionDigest(secret), status: "started",
      assumptionVersion: RECOVERY_ASSUMPTION_VERSION, reportVersion: RECOVERY_REPORT_VERSION,
      source: source.source, utm: source.utm, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), createdAt: now, updatedAt: now,
    } satisfies typeof eosRecoveryCalculatorSessions.$inferInsert;
    await db.transaction(async (tx) => {
      await tx.insert(eosRecoveryCalculatorSessions).values(session);
      await appendEvent(tx, session as typeof eosRecoveryCalculatorSessions.$inferSelect, "session_started", { source: source.source });
    });
    res.status(201).json({ token: secret, ...projection({ ...session, inputRevision: 0, rawInputs: {}, result: {}, salesBrief: {}, recoveryScore: null, dominantPool: null, fitClassification: null, route: null, intent: null, firstName: null, workEmail: null, companyName: null, phone: null, communicationPreference: null, consentGranted: false, consentVersion: null, consentGrantedAt: null, contactCapturedAt: null, stakeholderId: null, relationshipId: null, externalWritebackState: "not_configured", externalWritebackAttempts: 0, externalWritebackError: "", calendarBooked: false, calendarReference: "", lastIdempotencyKey: null } as typeof eosRecoveryCalculatorSessions.$inferSelect) });
  }));

  app.get("/api/eos/recovery-calculator/:token", publicRoute(async (req, res) => {
    res.json(projection(await resolveSession(req.params.token)));
  }));

  app.put("/api/eos/recovery-calculator/:token/inputs", publicRoute(async (req, res) => {
    const envelope = inputEnvelopeSchema.parse(req.body);
    const session = await resolveSession(req.params.token);
    if (session.lastIdempotencyKey === envelope.idempotencyKey && session.inputRevision > 0) return void res.json(projection(session));
    if (session.consentGranted) throw new RecoveryRouteError(409, "recovery_inputs_locked", "Start a new calculator session to change inputs after report delivery.");
    const result = calculateRecoveryOpportunity(envelope.inputs);
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(eosRecoveryCalculatorSessions).set({
        status: "partial_result", inputRevision: session.inputRevision + 1, rawInputs: envelope.inputs,
        result, recoveryScore: result.score, dominantPool: result.dominantPool,
        fitClassification: result.fit, route: result.route, intent: envelope.inputs.readiness.intent,
        lastIdempotencyKey: envelope.idempotencyKey, updatedAt: now,
      }).where(and(eq(eosRecoveryCalculatorSessions.id, session.id), eq(eosRecoveryCalculatorSessions.inputRevision, session.inputRevision)));
      await appendEvent(tx, session, "inputs_submitted", { revision: session.inputRevision + 1, assumptionVersion: result.assumptionVersion });
      await appendEvent(tx, session, "partial_result_viewed", { fit: result.fit, route: result.route, scoreBand: Math.floor(result.score / 10) * 10 });
    });
    res.json(projection({ ...session, status: "partial_result", inputRevision: session.inputRevision + 1, rawInputs: envelope.inputs, result, recoveryScore: result.score, dominantPool: result.dominantPool, fitClassification: result.fit, route: result.route, intent: envelope.inputs.readiness.intent, lastIdempotencyKey: envelope.idempotencyKey, updatedAt: now }));
  }));

  app.post("/api/eos/recovery-calculator/:token/contact", contactRateLimit, publicRoute(async (req, res) => {
    const envelope = contactEnvelopeSchema.parse(req.body);
    const session = await resolveSession(req.params.token);
    if (session.lastIdempotencyKey === envelope.idempotencyKey && session.consentGranted) return void res.json(projection(session));
    if (!session.inputRevision || !session.result || !Object.keys(session.result as object).length)
      throw new RecoveryRouteError(409, "recovery_inputs_required", "Complete the diagnostic before requesting the full report.");
    const input = recoveryCalculatorInputSchema.parse(session.rawInputs);
    const result = session.result as RecoveryResult;
    const contact = envelope.contact;
    const normalizedEmail = contact.workEmail.toLowerCase();
    const identityReference = `email:${normalizedEmail}`;
    const identityHash = createHash("sha256").update(identityReference).digest("hex");
    const { ownerSeat } = await resolveEmpyrean(session.companyId);
    const now = new Date();
    const brief = buildRecoverySalesBrief(input, result);
    let stakeholderId = session.stakeholderId;
    let relationshipId = session.relationshipId;
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(eosStakeholders).where(and(eq(eosStakeholders.companyId, session.companyId), eq(eosStakeholders.identityReferenceHash, identityHash))).limit(1);
      stakeholderId = existing?.id || randomUUID();
      if (!existing) await tx.insert(eosStakeholders).values({
        id: stakeholderId, companyId: session.companyId, portfolioId: session.portfolioId,
        stakeholderKey: `recovery-prospect-${identityHash.slice(0, 20)}`, name: `${contact.firstName} — ${contact.companyName}`,
        partyType: "prospect", state: "active", ownerSeatId: ownerSeat.id, identityReference, identityReferenceHash: identityHash,
        sourceSystem: "eos_recovery_calculator", externalId: session.id, consentLegalBasis: RECOVERY_CONSENT_VERSION,
        relationshipRole: "Recovery System diagnostic prospect", evidenceKeys: [], sourceAuthority: "native_eos",
        classification: "confidential", schemaVersion: "stakeholder-party-v1.0", validFrom: now,
        recordedByUserId: (await tx.select({ ownerUserId: companies.ownerUserId }).from(companies).where(eq(companies.id, session.companyId)).limit(1))[0].ownerUserId,
        createdAt: now, updatedAt: now,
      });
      const [existingRelationship] = await tx.select().from(eosStakeholderRelationships).where(and(eq(eosStakeholderRelationships.companyId, session.companyId), eq(eosStakeholderRelationships.stakeholderId, stakeholderId), eq(eosStakeholderRelationships.relationshipType, "prospect"))).limit(1);
      relationshipId = existingRelationship?.id || randomUUID();
      if (!existingRelationship) await tx.insert(eosStakeholderRelationships).values({
        id: relationshipId, companyId: session.companyId, portfolioId: session.portfolioId,
        relationshipKey: `recovery-prospect-${identityHash.slice(0, 20)}`, stakeholderId, relationshipType: "prospect",
        title: "Recovery System diagnostic", state: "active", ownerSeatId: ownerSeat.id,
        needConstraint: result.dominantPool, fitHypothesis: result.fit, nextBestAction: result.route,
        evidenceKeys: [], sourceAuthority: "native_eos", classification: "confidential",
        recordedByUserId: (await tx.select({ ownerUserId: companies.ownerUserId }).from(companies).where(eq(companies.id, session.companyId)).limit(1))[0].ownerUserId,
        createdAt: now, updatedAt: now,
      });
      await tx.update(eosRecoveryCalculatorSessions).set({
        status: "routed", firstName: contact.firstName, workEmail: normalizedEmail, companyName: contact.companyName,
        phone: contact.phone || "", communicationPreference: contact.communicationPreference,
        consentGranted: true, consentVersion: RECOVERY_CONSENT_VERSION, consentGrantedAt: now, contactCapturedAt: now,
        stakeholderId, relationshipId, salesBrief: brief, lastIdempotencyKey: envelope.idempotencyKey, updatedAt: now,
      }).where(eq(eosRecoveryCalculatorSessions.id, session.id));
      await appendEvent(tx, session, "contact_captured", { consentVersion: RECOVERY_CONSENT_VERSION, communicationPreference: contact.communicationPreference });
      await appendEvent(tx, session, "report_unlocked", { reportVersion: RECOVERY_REPORT_VERSION });
      await appendEvent(tx, session, "route_assigned", { route: result.route, fit: result.fit });
    });
    res.json(projection({ ...session, status: "routed", firstName: contact.firstName, workEmail: normalizedEmail, companyName: contact.companyName, phone: contact.phone || "", communicationPreference: contact.communicationPreference, consentGranted: true, consentVersion: RECOVERY_CONSENT_VERSION, consentGrantedAt: now, contactCapturedAt: now, stakeholderId, relationshipId, salesBrief: brief, lastIdempotencyKey: envelope.idempotencyKey, updatedAt: now }));
  }));

  app.post("/api/eos/recovery-calculator/:token/calendar-opened", publicRoute(async (req, res) => {
    const session = await resolveSession(req.params.token);
    if (!session.consentGranted || session.route !== "recovery_diagnostic" || !safeCalendarUrl())
      throw new RecoveryRouteError(409, "recovery_calendar_unavailable", "A live diagnostic calendar is not available for this route.");
    await appendEvent(db, session, "calendar_opened", { route: session.route });
    res.status(204).end();
  }));
}

export function registerRecoveryCalculatorRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/recovery-calculator", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const [sessions, packets, authorities, agreements, billingManifests, activationBindings, providerReceipts] = await Promise.all([
        db.select().from(eosRecoveryCalculatorSessions).where(eq(eosRecoveryCalculatorSessions.companyId, companyId)).orderBy(desc(eosRecoveryCalculatorSessions.updatedAt)).limit(100),
        db.select().from(eosRecoveryCall2Packets).where(eq(eosRecoveryCall2Packets.companyId, companyId)).orderBy(desc(eosRecoveryCall2Packets.updatedAt)).limit(100),
        db.select().from(eosRecoveryAgreementAuthorities).where(eq(eosRecoveryAgreementAuthorities.companyId, companyId)).orderBy(desc(eosRecoveryAgreementAuthorities.updatedAt)),
        db.select().from(eosRecoveryAgreementInstances).where(eq(eosRecoveryAgreementInstances.companyId, companyId)).orderBy(desc(eosRecoveryAgreementInstances.updatedAt)),
        db.select().from(eosRecoveryBillingManifests).where(eq(eosRecoveryBillingManifests.companyId, companyId)).orderBy(desc(eosRecoveryBillingManifests.updatedAt)),
        db.select().from(eosIntegrationBindings).where(eq(eosIntegrationBindings.companyId, companyId)),
        db.select().from(eosRecoveryProviderReceipts).where(eq(eosRecoveryProviderReceipts.companyId, companyId)).orderBy(desc(eosRecoveryProviderReceipts.occurredAt)).limit(200),
      ]);
      const approvalIds = packets.map((packet) => packet.exceptionApprovalId).filter(Boolean) as string[];
      const approvals = approvalIds.length
        ? await db.select().from(eosApprovalRequests).where(eq(eosApprovalRequests.companyId, companyId))
        : [];
      const approvalById = new Map(approvals.filter((approval) => approvalIds.includes(approval.id)).map((approval) => [approval.id, approval]));
      const authorityById = new Map(authorities.map((item) => [item.id, item]));
      const billingByAgreement = new Map(billingManifests.map((item) => [item.agreementInstanceId, item]));
      const receiptsByAgreement = new Map<string, typeof providerReceipts>();
      const receiptsByBilling = new Map<string, typeof providerReceipts>();
      for (const receipt of providerReceipts) {
        if (receipt.agreementInstanceId) receiptsByAgreement.set(receipt.agreementInstanceId, [...(receiptsByAgreement.get(receipt.agreementInstanceId) || []), receipt]);
        if (receipt.billingManifestId) receiptsByBilling.set(receipt.billingManifestId, [...(receiptsByBilling.get(receipt.billingManifestId) || []), receipt]);
      }
      const agreementByPacket = new Map(agreements.map((item) => [item.call2PacketId, {
        ...item,
        authority: authorityById.get(item.authorityId) || null,
        providerReceipts: receiptsByAgreement.get(item.id) || [],
        billingManifest: billingByAgreement.get(item.id) ? {
          ...billingByAgreement.get(item.id)!,
          providerReceipts: receiptsByBilling.get(billingByAgreement.get(item.id)!.id) || [],
        } : null,
      }]));
      const packetBySession = new Map(packets.map((packet) => [packet.sessionId, {
        ...packet,
        exceptionApprovalStatus: packet.exceptionApprovalId ? approvalById.get(packet.exceptionApprovalId)?.status || "unavailable" : null,
        activation: agreementByPacket.get(packet.id) || null,
      }]));
      res.json({
        capabilities: { recordCounselDisposition: access.isFounder },
        providerReceiptExceptions: providerReceipts.filter((item) => item.objectType === "unmatched" || item.processingState === "recovery_required"),
        activationBindings: activationBindings.filter((item) => ["docusign", "stripe"].includes(item.providerKey)).map((item) => ({
          id: item.id, name: item.name, providerKey: item.providerKey, lifecycleState: item.lifecycleState,
          connectionState: item.connectionState, healthState: item.healthState, parityState: item.parityState,
        })),
        sessions: sessions.map((session) => ({
          id: session.id, status: session.status, score: session.recoveryScore, fit: session.fitClassification,
          route: session.route, dominantPool: session.dominantPool, intent: session.intent,
          firstName: session.firstName, workEmail: session.workEmail, companyName: session.companyName, phone: session.phone,
          communicationPreference: session.communicationPreference, contactCapturedAt: session.contactCapturedAt,
          externalWritebackState: session.externalWritebackState, calendarBooked: session.calendarBooked,
          result: session.consentGranted ? session.result : null, salesBrief: session.consentGranted ? session.salesBrief : null,
          call2Packet: packetBySession.get(session.id) || null,
          source: session.source, utm: session.utm, createdAt: session.createdAt, updatedAt: session.updatedAt,
        })),
      });
    } catch (error) {
      if (error instanceof RecoveryRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      next(error);
    }
  });

  app.post("/api/eos/companies/:companyId/recovery-calculator/:sessionId/call-2", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const session = await db.query.eosRecoveryCalculatorSessions.findFirst({ where: and(eq(eosRecoveryCalculatorSessions.id, req.params.sessionId), eq(eosRecoveryCalculatorSessions.companyId, companyId)) });
      if (!session) throw new RecoveryRouteError(404, "recovery_session_not_found", "Recovery session not found in this company.");
      const existing = await db.query.eosRecoveryCall2Packets.findFirst({ where: eq(eosRecoveryCall2Packets.sessionId, session.id) });
      if (existing) return res.json(existing);
      if (!session.consentGranted || !session.stakeholderId || !session.relationshipId || session.fitClassification !== "high_fit" || session.route !== "recovery_diagnostic")
        throw new RecoveryRouteError(409, "recovery_call_2_not_qualified", "Call 2 requires a consented high-fit Recovery diagnostic with a canonical prospect relationship.");
      const offer = await db.query.eosOfferPrograms.findFirst({ where: and(eq(eosOfferPrograms.companyId, companyId), eq(eosOfferPrograms.offerKey, "OFFER-EMPYREAN-RECOVERY-SYSTEM")) });
      if (!offer) throw new RecoveryRouteError(409, "recovery_offer_unavailable", "The canonical Recovery System offer has not been compiled.");
      const { ownerSeat } = await resolveEmpyrean(companyId);
      const now = new Date();
      const traceId = randomUUID();
      const caseId = randomUUID();
      const workPacketId = randomUUID();
      const packetId = randomUUID();
      const initial = initialCall2Fields(session, offer);
      const termsPresented = recoveryCall2Terms("standard");
      let packet!: typeof eosRecoveryCall2Packets.$inferSelect;
      await db.transaction(async (tx) => {
        await tx.insert(eosCommercialCases).values({
          id: caseId, companyId, portfolioId: access.company.portfolioId,
          caseKey: `RECOVERY-CALL2-${session.id}`, title: `${session.companyName || "Recovery prospect"} — Call 2 close decision`,
          objectClass: "commercial_opportunity", state: "proposal", ownerSeatId: ownerSeat.id,
          stakeholderIds: [session.stakeholderId], offerId: offer.id,
          valueEstimate: String((session.salesBrief as any)?.modeledRange?.base || 0), currency: "USD",
          probabilityConfidence: String(session.recoveryScore || 0),
          nextAction: "Prepare and conduct the governed Call-2 close decision.",
          resultOutcome: "No decision exists yet; modeled opportunity is not realized revenue.",
          externalId: session.id, sourceSystem: "eos_recovery_calculator", sourceAuthority: "native_eos",
          classification: "confidential", recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
        });
        await tx.insert(eosWorkPackets).values({
          id: workPacketId, companyId, createdByUserId: req.user.id, accountableUserId: access.company.ownerUserId,
          accountableSeatId: ownerSeat.id, title: `Call 2 close packet — ${session.companyName || "Recovery prospect"}`,
          objective: "Reach one explicit commercial disposition using current terms, named exceptions, and a controlled handoff.",
          status: "draft", priority: "high", source: "recovery_call_2", visibility: "company", classification: "confidential",
          requiresApproval: false, toolPack: [], evidenceRequirements: ["Sales Brief snapshot", "Terms presented", "Decision maker", "Disposition", "Dated next action or closed-lost reason"],
          resourceIds: [session.id, caseId], expectedOutput: "One canonical commercial disposition without improvised terms or external execution.",
          acceptanceCriteria: "Current price and scope are explicit; model and realized outcome remain distinct; exception requests use approval; agreement/payment/onboarding remain pending external rails.",
          constraintsPolicies: "Do not improvise price, guarantee, proof claim, scope, agreement state, payment state, onboarding state, or provider outcome.",
          failureEscalationCompensation: "Keep the packet ready or on hold and escalate a named exception; do not create a shadow agreement or payment fact.",
          humanFallback: "Return the unresolved decision to the accountable commercial principal.", sourceLineage: RECOVERY_CALL_2_TERMS_AUTHORITY,
          outputArtifactKeys: [], traceId, correlationId: packetId, createdAt: now, updatedAt: now,
        });
        [packet] = await tx.insert(eosRecoveryCall2Packets).values({
          id: packetId, companyId, portfolioId: access.company.portfolioId, sessionId: session.id,
          commercialCaseId: caseId, workPacketId, ownerSeatId: ownerSeat.id,
          state: "draft", version: 1, packetVersion: RECOVERY_CALL_2_PACKET_VERSION,
          termsAuthority: RECOVERY_CALL_2_TERMS_AUTHORITY, ...initial,
          recommendedPackage: "standard", termsPresented, externalEffectsExecuted: false,
          sourceAuthority: "native_eos", classification: "confidential", createdByUserId: req.user.id,
          createdAt: now, updatedAt: now,
        }).returning();
        await appendCall2Event(tx, packet, { userId: req.user.id, seatId: access.seat.id }, "packet_created", "none", "draft", { sessionId: session.id, commercialCaseId: caseId }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_call_2.created", targetType: "recovery_call_2_packet", targetId: packetId, traceId, correlationId: packetId, result: "draft", details: { sessionId: session.id, externalEffectsExecuted: false }, createdAt: now });
      });
      res.status(201).json(packet);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.put("/api/eos/companies/:companyId/recovery-call-2/:packetId", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const input = recoveryCall2UpdateSchema.parse(req.body);
      const packet = await call2Packet(companyId, req.params.packetId);
      if (packet.state !== "draft") throw new RecoveryRouteError(409, "recovery_call_2_locked", "Only a draft Call-2 packet can be edited.");
      if (packet.version !== input.version) throw new RecoveryRouteError(409, "recovery_call_2_version_conflict", "The Call-2 packet changed before this edit was applied.");
      if (input.recommendedPackage === "founding_proof_cohort" && input.foundingProofConsideration.length < 8)
        throw new RecoveryRouteError(400, "recovery_call_2_proof_consideration_required", "Name the proof consideration before selecting founding-cohort terms.");
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof packet;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosRecoveryCall2Packets).set({
          buyerDecisionMakers: input.buyerDecisionMakers,
          observedFacts: input.observedFacts, measuredSignals: input.measuredSignals,
          unavailableData: input.unavailableData, changesSinceCall1: input.changesSinceCall1,
          recoveryThesis: input.recoveryThesis, scopeDiscussion: input.scopeDiscussion,
          measurementAttribution: input.measurementAttribution, clientResponsibilities: input.clientResponsibilities,
          objections: input.objections, recommendedPackage: input.recommendedPackage,
          foundingProofConsideration: input.foundingProofConsideration,
          termsPresented: recoveryCall2Terms(input.recommendedPackage),
          version: packet.version + 1, updatedAt: now,
        }).where(and(eq(eosRecoveryCall2Packets.id, packet.id), eq(eosRecoveryCall2Packets.version, packet.version), eq(eosRecoveryCall2Packets.state, "draft"))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_call_2_version_conflict", "The Call-2 packet changed before this edit was applied.");
        await appendCall2Event(tx, updated, { userId: req.user.id, seatId: access.seat.id }, "packet_updated", "draft", "draft", { package: input.recommendedPackage }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_call_2.updated", targetType: "recovery_call_2_packet", targetId: packet.id, traceId, correlationId: packet.id, result: "draft", details: { version: updated.version, termsAuthority: updated.termsAuthority }, createdAt: now });
      });
      res.json(updated);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.post("/api/eos/companies/:companyId/recovery-call-2/:packetId/ready", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const { version } = z.object({ version: z.coerce.number().int().positive() }).parse(req.body);
      const packet = await call2Packet(companyId, req.params.packetId);
      if (packet.state !== "draft" || packet.version !== version) throw new RecoveryRouteError(409, "recovery_call_2_version_conflict", "The draft changed or is no longer editable.");
      const required = [packet.observedFacts, packet.measuredSignals, packet.unavailableData, packet.changesSinceCall1, packet.recoveryThesis, packet.scopeDiscussion, packet.measurementAttribution, packet.clientResponsibilities, packet.objections];
      if (!(packet.buyerDecisionMakers as unknown[]).length || required.some((value) => !value.trim()))
        throw new RecoveryRouteError(409, "recovery_call_2_incomplete", "Complete the buyer, evidence, uncertainty, scope, responsibility, and objection fields before the call.");
      if (packet.recommendedPackage === "founding_proof_cohort" && packet.foundingProofConsideration.trim().length < 8)
        throw new RecoveryRouteError(409, "recovery_call_2_proof_consideration_required", "Founding-cohort terms require named proof consideration.");
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof packet;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosRecoveryCall2Packets).set({ state: "ready", version: packet.version + 1, updatedAt: now }).where(and(eq(eosRecoveryCall2Packets.id, packet.id), eq(eosRecoveryCall2Packets.state, "draft"), eq(eosRecoveryCall2Packets.version, packet.version))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_call_2_version_conflict", "The draft changed before readiness was recorded.");
        await tx.update(eosWorkPackets).set({ status: "ready", updatedAt: now }).where(eq(eosWorkPackets.id, packet.workPacketId));
        await appendCall2Event(tx, updated, { userId: req.user.id, seatId: access.seat.id }, "packet_ready", "draft", "ready", { termsPresented: updated.termsPresented }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_call_2.ready", targetType: "recovery_call_2_packet", targetId: packet.id, traceId, correlationId: packet.id, result: "ready", details: { termsAuthority: packet.termsAuthority, externalEffectsExecuted: false }, createdAt: now });
      });
      res.json(updated);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.post("/api/eos/companies/:companyId/recovery-call-2/:packetId/exception", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const input = recoveryCall2ExceptionSchema.parse(req.body);
      const packet = await call2Packet(companyId, req.params.packetId);
      if (packet.state !== "ready" || packet.version !== input.version) throw new RecoveryRouteError(409, "recovery_call_2_not_ready", "The ready packet changed before exception escalation.");
      if (packet.exceptionApprovalId) throw new RecoveryRouteError(409, "recovery_call_2_exception_exists", "This packet already has a named exception decision path.");
      const founderSeat = (await db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")))).find((seat) => seat.kind === "founder") || access.seat;
      const approvalId = randomUUID();
      const exceptionWorkPacketId = randomUUID();
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof packet;
      await db.transaction(async (tx) => {
        await tx.insert(eosWorkPackets).values({
          id: exceptionWorkPacketId, companyId, createdByUserId: req.user.id, accountableUserId: access.company.ownerUserId,
          accountableSeatId: founderSeat.id, title: `Recovery commercial exception — ${(packet.salesBriefSnapshot as any)?.headline || packet.id}`,
          objective: "Approve or reject one named deviation from current Recovery commercial authority.", status: "awaiting_approval",
          priority: "high", source: "recovery_call_2", visibility: "company", classification: "confidential", requiresApproval: true,
          toolPack: [], evidenceRequirements: ["Named exception", "Current terms snapshot", "Approval rationale"], resourceIds: [packet.id, packet.commercialCaseId],
          expectedOutput: "One explicit approved or rejected exception; no implicit price, scope, or guarantee change.",
          acceptanceCriteria: "The approver decides the named deviation and records a reason.", constraintsPolicies: "No effect occurs from approval alone; agreement and payment remain separate.",
          failureEscalationCompensation: "Keep current terms authoritative and do not record a closed-won exception.", humanFallback: "Founder or accountable commercial principal decides.",
          sourceLineage: packet.termsAuthority, outputArtifactKeys: [], traceId, correlationId: packet.id, createdAt: now, updatedAt: now,
        });
        await tx.insert(eosApprovalRequests).values({ id: approvalId, companyId, workPacketId: exceptionWorkPacketId, requestedByUserId: req.user.id, assignedToUserId: access.company.ownerUserId, assignedToSeatId: founderSeat.id, summary: `Decide Recovery commercial exception: ${input.summary}`, status: "pending", createdAt: now });
        [updated] = await tx.update(eosRecoveryCall2Packets).set({ exceptionSummary: input.summary, exceptionApprovalId: approvalId, version: packet.version + 1, updatedAt: now }).where(and(eq(eosRecoveryCall2Packets.id, packet.id), eq(eosRecoveryCall2Packets.version, packet.version), eq(eosRecoveryCall2Packets.state, "ready"))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_call_2_version_conflict", "The packet changed before exception escalation.");
        await appendCall2Event(tx, updated, { userId: req.user.id, seatId: access.seat.id }, "exception_requested", "ready", "ready", { approvalId, summary: input.summary }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_call_2.exception_requested", targetType: "recovery_call_2_packet", targetId: packet.id, traceId, correlationId: packet.id, result: "pending", details: { approvalId, termsUnchanged: true, externalEffectsExecuted: false }, createdAt: now });
      });
      res.status(201).json({ ...updated, exceptionApprovalStatus: "pending" });
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.post("/api/eos/companies/:companyId/recovery-call-2/:packetId/decision", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const input = recoveryCall2DecisionSchema.parse(req.body);
      const packet = await call2Packet(companyId, req.params.packetId);
      if (packet.state !== "ready" || packet.version !== input.version) throw new RecoveryRouteError(409, "recovery_call_2_not_ready", "The ready packet changed before this decision.");
      const approval = packet.exceptionApprovalId ? await db.query.eosApprovalRequests.findFirst({ where: and(eq(eosApprovalRequests.id, packet.exceptionApprovalId), eq(eosApprovalRequests.companyId, companyId)) }) : null;
      if (input.disposition === "closed_won_pending_agreement_payment" && approval && approval.status !== "approved")
        throw new RecoveryRouteError(409, "recovery_call_2_exception_unresolved", "A closed-won handoff cannot use an unresolved or rejected commercial exception.");
      const commercialState = commercialStateForDisposition(input.disposition);
      const packetState = input.disposition === "closed_won_pending_agreement_payment" ? "handoff_ready" : "closed";
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof packet;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosRecoveryCall2Packets).set({
          state: packetState, disposition: input.disposition,
          dependencyOrLostReason: input.dependencyOrLostReason, decisionMaker: input.decisionMaker,
          nextAction: input.nextAction, nextActionAt: input.nextActionAt || null,
          agreementVersion: input.agreementVersion, paymentPath: input.paymentPath,
          onboardingTrigger: input.onboardingTrigger, version: packet.version + 1, updatedAt: now,
        }).where(and(eq(eosRecoveryCall2Packets.id, packet.id), eq(eosRecoveryCall2Packets.version, packet.version), eq(eosRecoveryCall2Packets.state, "ready"))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_call_2_version_conflict", "The packet changed before the decision was recorded.");
        await tx.update(eosCommercialCases).set({
          state: commercialState, nextAction: input.nextAction, targetDate: input.nextActionAt || null,
          resultOutcome: input.disposition === "closed_won_pending_agreement_payment"
            ? "Closed won pending separately verified agreement and payment; no signature, settlement, onboarding, or provider effect is asserted."
            : input.dependencyOrLostReason,
          riskExceptionKeys: packet.exceptionApprovalId ? [`approval:${packet.exceptionApprovalId}`] : [], updatedAt: now,
        }).where(and(eq(eosCommercialCases.id, packet.commercialCaseId), eq(eosCommercialCases.companyId, companyId)));
        await tx.update(eosWorkPackets).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(eosWorkPackets.id, packet.workPacketId));
        await appendCall2Event(tx, updated, { userId: req.user.id, seatId: access.seat.id }, "decision_recorded", "ready", packetState, { disposition: input.disposition, decisionMaker: input.decisionMaker, exceptionApprovalStatus: approval?.status || null }, traceId);
        await appendCall2Event(tx, updated, { userId: req.user.id, seatId: access.seat.id }, input.disposition === "closed_won_pending_agreement_payment" ? "handoff_prepared" : "closed", packetState, packetState, { agreementVersion: input.agreementVersion || null, paymentPath: input.paymentPath || null, onboardingTrigger: input.onboardingTrigger || null }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_call_2.decision_recorded", targetType: "recovery_call_2_packet", targetId: packet.id, traceId, correlationId: packet.id, result: input.disposition, details: { commercialCaseState: commercialState, agreementExecuted: false, paymentSettled: false, onboardingStarted: false, externalEffectsExecuted: false }, createdAt: now });
      });
      res.json(updated);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.post("/api/eos/companies/:companyId/recovery-call-2/:packetId/activation", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const packet = await call2Packet(companyId, req.params.packetId);
      if (packet.state !== "handoff_ready" || packet.disposition !== "closed_won_pending_agreement_payment")
        throw new RecoveryRouteError(409, "recovery_activation_not_eligible", "Agreement controls require a closed-won Call-2 handoff.");
      const existing = await db.query.eosRecoveryAgreementInstances.findFirst({ where: eq(eosRecoveryAgreementInstances.call2PacketId, packet.id) });
      if (existing) return res.json(await recoveryActivation(companyId, packet.id));
      const now = new Date();
      const traceId = randomUUID();
      const authorityWorkPacketId = randomUUID();
      const agreementWorkPacketId = randomUUID();
      const billingWorkPacketId = randomUUID();
      const agreementId = randomUUID();
      const billingId = randomUUID();
      const actor = { userId: req.user.id, seatId: access.seat.id };
      const terms = recoveryCall2Terms(packet.recommendedPackage as "founding_proof_cohort" | "standard");
      let authority = await db.query.eosRecoveryAgreementAuthorities.findFirst({ where: and(eq(eosRecoveryAgreementAuthorities.companyId, companyId), eq(eosRecoveryAgreementAuthorities.agreementKey, "RECOVERY-MANAGED-SERVICE")) });
      await db.transaction(async (tx) => {
        if (!authority) {
          const authorityId = randomUUID();
          await tx.insert(eosWorkPackets).values({
            id: authorityWorkPacketId, companyId, createdByUserId: req.user.id, accountableUserId: access.company.ownerUserId,
            accountableSeatId: access.seat.id, title: "Counsel review — Recovery managed-service agreement",
            objective: "Record qualified counsel's exact disposition for every required agreement issue before any client agreement becomes eligible to issue.",
            status: "draft", priority: "urgent", source: "recovery_commercial_activation", visibility: "company", classification: "restricted",
            requiresApproval: false, toolPack: [], evidenceRequirements: ["Verified counsel disposition", "Exact revised-language reference", "All 15 issue dispositions", "Effective agreement version and date"],
            resourceIds: [authorityId], expectedOutput: "One reviewed and versioned agreement authority record; no legal advice or provider effect is created by EOS.",
            acceptanceCriteria: "All required issues are decided, evidence is verified, exact language is referenced, jurisdiction and dependencies are named, and the effective version is explicit.",
            constraintsPolicies: "Counsel-ready is not counsel-approved. Do not issue, sign, charge, onboard, or infer provider outcomes from this Work Packet.",
            failureEscalationCompensation: "Keep every agreement instance blocked and return unresolved issues to qualified counsel.",
            humanFallback: "Founder obtains and records qualified counsel's disposition.", sourceLineage: RECOVERY_AGREEMENT_PACKET_SOURCE,
            outputArtifactKeys: [], traceId, correlationId: authorityId, createdAt: now, updatedAt: now,
          });
          [authority] = await tx.insert(eosRecoveryAgreementAuthorities).values({
            id: authorityId, companyId, agreementKey: "RECOVERY-MANAGED-SERVICE", workPacketId: authorityWorkPacketId,
            state: "counsel_blocked", version: 1, authorityVersion: RECOVERY_AGREEMENT_AUTHORITY_VERSION,
            counselPacketSource: RECOVERY_AGREEMENT_PACKET_SOURCE, agreementTemplateSource: RECOVERY_AGREEMENT_TEMPLATE_SOURCE,
            externalEffectsExecuted: false, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
          }).returning();
          await appendActivationEvent(tx, authority.id, authority, "authority", actor, "authority_created", "none", "counsel_blocked", { counselApproved: false, externalEffectsExecuted: false }, traceId);
        }
        await tx.insert(eosWorkPackets).values([
          {
            id: agreementWorkPacketId, companyId, createdByUserId: req.user.id, accountableUserId: access.company.ownerUserId,
            accountableSeatId: access.seat.id, title: `Agreement package — ${(packet.salesBriefSnapshot as any)?.companyName || packet.id}`,
            objective: "Prepare one client-specific agreement package against the effective counsel-reviewed authority.", status: "draft", priority: "high",
            source: "recovery_commercial_activation", visibility: "company", classification: "confidential", requiresApproval: false, toolPack: [],
            evidenceRequirements: ["Effective counsel-reviewed agreement authority", "Exact client legal identity", "Qualified EOS-native document version or healthy external signing binding"], resourceIds: [packet.id, agreementId, authority.id],
            expectedOutput: "An agreement package eligible for authorized native or provider issuance; no envelope or signature is asserted.", acceptanceCriteria: "Authority version, client identity, immutable document/template, and selected signing engine all pass.",
            constraintsPolicies: "No manual signature claim and no provider action from this record.", failureEscalationCompensation: "Remain blocked and expose exact blockers.", humanFallback: "Authorized operator resolves the named blocker.",
            sourceLineage: RECOVERY_AGREEMENT_TEMPLATE_SOURCE, outputArtifactKeys: [], traceId, correlationId: agreementId, createdAt: now, updatedAt: now,
          },
          {
            id: billingWorkPacketId, companyId, createdByUserId: req.user.id, accountableUserId: access.company.ownerUserId,
            accountableSeatId: access.seat.id, title: `Billing manifest — ${(packet.salesBriefSnapshot as any)?.companyName || packet.id}`,
            objective: "Bind server-owned Recovery terms to exact Stripe product and price references without initiating payment.", status: "draft", priority: "high",
            source: "recovery_commercial_activation", visibility: "company", classification: "confidential", requiresApproval: false, toolPack: [],
            evidenceRequirements: ["Exact Stripe object references", "Healthy Stripe Integration Binding", "Authoritative payment receipts"], resourceIds: [agreementId, billingId],
            expectedOutput: "A fixed-price billing manifest eligible for a separately authorized provider checkout before agreement issuance.", acceptanceCriteria: "Server-owned terms and all Stripe configuration and health checks pass; payment receipts gate agreement issuance.",
            constraintsPolicies: "Prices are server-owned. Do not infer payment from CRM, create checkout, charge, subscribe, refund, or cancel from this record.", failureEscalationCompensation: "Remain blocked and route failed provider lifecycle events to recovery.", humanFallback: "Authorized finance operator resolves exact provider or agreement blockers.",
            sourceLineage: RECOVERY_BILLING_MANIFEST_SOURCE, outputArtifactKeys: [], traceId, correlationId: agreementId, createdAt: now, updatedAt: now,
          },
        ]);
        const [agreement] = await tx.insert(eosRecoveryAgreementInstances).values({
          id: agreementId, companyId, call2PacketId: packet.id, authorityId: authority.id, workPacketId: agreementWorkPacketId,
          state: "blocked_counsel", version: 1, clientLegalName: "", clientSignerName: "", clientSignerEmail: "", providerLegalName: "",
          packageKey: packet.recommendedPackage, termsSnapshot: terms, agreementVersion: packet.agreementVersion,
          blockers: ["Qualified counsel has not approved the effective agreement authority."], externalEffectsExecuted: false,
          recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
        }).returning();
        const [billing] = await tx.insert(eosRecoveryBillingManifests).values({
          id: billingId, companyId, agreementInstanceId: agreement.id, workPacketId: billingWorkPacketId,
          state: "configuration_required", version: 1, manifestVersion: RECOVERY_BILLING_MANIFEST_VERSION,
          manifestSource: RECOVERY_BILLING_MANIFEST_SOURCE, packageKey: packet.recommendedPackage,
          setupAmountMinor: terms.setupAmount * 100, recurringAmountMinor: terms.monthlyAmount * 100,
          currency: "USD", blockers: ["Stripe object references are not configured."],
          externalEffectsExecuted: false, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
        }).returning();
        await appendActivationEvent(tx, agreement.id, agreement, "agreement", actor, "agreement_prepared", "none", agreement.state, { authorityId: authority.id, externalEffectsExecuted: false }, traceId);
        await appendActivationEvent(tx, agreement.id, billing, "billing", actor, "billing_manifest_prepared", "none", billing.state, { setupAmountMinor: billing.setupAmountMinor, recurringAmountMinor: billing.recurringAmountMinor, currency: billing.currency, externalEffectsExecuted: false }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_activation.prepared", targetType: "recovery_agreement_instance", targetId: agreement.id, traceId, correlationId: agreement.id, result: "blocked", details: { authorityId: authority.id, billingManifestId: billing.id, signatureAsserted: false, paymentAsserted: false, externalEffectsExecuted: false }, createdAt: now });
      });
      res.status(201).json(await recoveryActivation(companyId, packet.id));
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.put("/api/eos/companies/:companyId/recovery-call-2/:packetId/activation/counsel", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      if (!access.isFounder) throw new RecoveryRouteError(403, "recovery_counsel_founder_required", "Only the founder authority can record counsel's agreement disposition.");
      const input = counselDispositionSchema.parse(req.body);
      const { agreement, authority } = await recoveryActivation(companyId, req.params.packetId);
      if (authority.version !== input.version) throw new RecoveryRouteError(409, "recovery_authority_version_conflict", "The agreement authority changed before this disposition was recorded.");
      const evidence = await db.query.eosEvidence.findFirst({ where: and(eq(eosEvidence.id, input.evidenceId), eq(eosEvidence.companyId, companyId), eq(eosEvidence.workPacketId, authority.workPacketId)) });
      if (!evidence || evidence.verificationState !== "verified")
        throw new RecoveryRouteError(409, "recovery_counsel_evidence_required", "Use verified counsel evidence linked to the agreement-authority Work Packet.");
      [input.reviewerCredentialReference, input.exactLanguageReference].forEach(assertConfigurationReference);
      const state = input.disposition === "approved" ? "counsel_approved" : input.disposition === "approved_with_changes" ? "counsel_approved_with_changes" : "counsel_rejected";
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof authority;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosRecoveryAgreementAuthorities).set({
          state, version: authority.version + 1, issueDispositions: input.issueDispositions,
          reviewerName: input.reviewerName, reviewerCredentialReference: input.reviewerCredentialReference,
          jurisdiction: input.jurisdiction, exactLanguageReference: input.exactLanguageReference,
          unresolvedBusinessChoices: input.unresolvedBusinessChoices, complianceDependencies: input.complianceDependencies,
          effectiveVersion: input.effectiveVersion, effectiveAt: input.effectiveAt, counselEvidenceId: input.evidenceId,
          updatedAt: now,
        }).where(and(eq(eosRecoveryAgreementAuthorities.id, authority.id), eq(eosRecoveryAgreementAuthorities.version, authority.version))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_authority_version_conflict", "The agreement authority changed before this disposition was recorded.");
        await tx.update(eosWorkPackets).set({ status: state === "counsel_rejected" ? "blocked" : "completed", completedAt: state === "counsel_rejected" ? null : now, updatedAt: now }).where(eq(eosWorkPackets.id, authority.workPacketId));
        await appendActivationEvent(tx, authority.id, updated, "authority", { userId: req.user.id, seatId: access.seat.id }, "counsel_disposition_recorded", authority.state, state, { evidenceId: input.evidenceId, effectiveVersion: input.effectiveVersion, operatorRecordedCounselOutput: true, legalAdviceGeneratedByEos: false }, traceId);
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "recovery_agreement_authority.counsel_disposition_recorded", targetType: "recovery_agreement_authority", targetId: authority.id, traceId, correlationId: agreement.id, result: state, details: { evidenceId: input.evidenceId, issueCount: input.issueDispositions.length, externalEffectsExecuted: false }, createdAt: now });
      });
      res.json(updated);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.put("/api/eos/companies/:companyId/recovery-call-2/:packetId/activation/agreement", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const input = recoveryAgreementConfigurationSchema.parse(req.body);
      const { agreement } = await recoveryActivation(companyId, req.params.packetId);
      if (agreement.version !== input.version) throw new RecoveryRouteError(409, "recovery_agreement_version_conflict", "The agreement package changed before this configuration was saved.");
      [input.eSignTemplateReference, input.agreementVersion].forEach(assertConfigurationReference);
      const binding = input.eSignBindingId ? await db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, input.eSignBindingId), eq(eosIntegrationBindings.companyId, companyId)) }) : null;
      if (input.eSignProvider === "docusign" && (!binding || binding.providerKey !== "docusign"))
        throw new RecoveryRouteError(400, "recovery_docusign_binding_required", "Select this company's DocuSign Integration Binding.");
      const nativeDocument = input.eSignProvider === "eos_native"
        ? await db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, input.eSignTemplateReference), eq(eosEsignDocumentVersions.companyId, companyId)) })
        : null;
      if (input.eSignProvider === "eos_native" && (!nativeDocument || nativeDocument.documentVersion !== input.agreementVersion || nativeDocument.counselEvidenceId == null))
        throw new RecoveryRouteError(409, "recovery_native_document_invalid", "Select a tenant-scoped EOS document version matching the effective agreement version and linked to verified counsel evidence.");
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof agreement;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosRecoveryAgreementInstances).set({
          clientLegalName: input.clientLegalName, clientSignerName: input.clientSignerName,
          clientSignerEmail: input.clientSignerEmail.toLowerCase(), providerLegalName: input.providerLegalName,
          agreementVersion: input.agreementVersion, eSignProvider: input.eSignProvider,
          eSignTemplateReference: input.eSignTemplateReference,
          eSignBindingId: input.eSignProvider === "docusign" ? input.eSignBindingId : null,
          version: agreement.version + 1, updatedAt: now,
        }).where(and(eq(eosRecoveryAgreementInstances.id, agreement.id), eq(eosRecoveryAgreementInstances.version, agreement.version))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_agreement_version_conflict", "The agreement package changed before this configuration was saved.");
        await appendActivationEvent(tx, agreement.id, updated, "agreement", { userId: req.user.id, seatId: access.seat.id }, "agreement_configured", agreement.state, agreement.state, { eSignProvider: input.eSignProvider, bindingId: input.eSignBindingId || null, documentVersionId: input.eSignProvider === "eos_native" ? input.eSignTemplateReference : null, agreementVersion: input.agreementVersion, providerEffect: false }, traceId);
      });
      res.json(updated);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.put("/api/eos/companies/:companyId/recovery-call-2/:packetId/activation/billing", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const input = recoveryBillingConfigurationSchema.parse(req.body);
      const { agreement, billing } = await recoveryActivation(companyId, req.params.packetId);
      if (billing.version !== input.version) throw new RecoveryRouteError(409, "recovery_billing_version_conflict", "The billing manifest changed before this configuration was saved.");
      [input.providerProductReference, input.setupPriceReference, input.recurringPriceReference].forEach(assertConfigurationReference);
      const binding = await db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, input.stripeBindingId), eq(eosIntegrationBindings.companyId, companyId)) });
      if (!binding || binding.providerKey !== "stripe") throw new RecoveryRouteError(400, "recovery_stripe_binding_required", "Select this company's Stripe Integration Binding.");
      const now = new Date();
      const traceId = randomUUID();
      let updated!: typeof billing;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosRecoveryBillingManifests).set({
          stripeBindingId: input.stripeBindingId, providerProductReference: input.providerProductReference,
          setupPriceReference: input.setupPriceReference, recurringPriceReference: input.recurringPriceReference,
          currency: input.currency, taxTreatment: input.taxTreatment, statementDescriptor: input.statementDescriptor.toUpperCase(),
          paymentMethodPolicy: input.paymentMethodPolicy, subscriptionStartRule: input.subscriptionStartRule,
          receiptBehavior: input.receiptBehavior, cancellationRefundAuthority: input.cancellationRefundAuthority,
          state: "configuration_required", blockers: ["Evaluate the payment-first commercial gates before issuing Checkout."],
          version: billing.version + 1, updatedAt: now,
        }).where(and(eq(eosRecoveryBillingManifests.id, billing.id), eq(eosRecoveryBillingManifests.version, billing.version))).returning();
        if (!updated) throw new RecoveryRouteError(409, "recovery_billing_version_conflict", "The billing manifest changed before this configuration was saved.");
        await appendActivationEvent(tx, agreement.id, updated, "billing", { userId: req.user.id, seatId: access.seat.id }, "billing_configured", billing.state, updated.state, { bindingId: input.stripeBindingId, pricesChanged: false, providerEffect: false }, traceId);
      });
      res.json(updated);
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });

  app.post("/api/eos/companies/:companyId/recovery-call-2/:packetId/activation/evaluate", async (req, res, next) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await recoveryCommercialAccess(req, companyId);
      const { agreement, authority, billing } = await recoveryActivation(companyId, req.params.packetId);
      const [eSignBinding, nativeDocument, stripeBinding] = await Promise.all([
        agreement.eSignBindingId ? db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, agreement.eSignBindingId), eq(eosIntegrationBindings.companyId, companyId)) }) : null,
        agreement.eSignProvider === "eos_native" && agreement.eSignTemplateReference ? db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, agreement.eSignTemplateReference), eq(eosEsignDocumentVersions.companyId, companyId)) }) : null,
        billing.stripeBindingId ? db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, billing.stripeBindingId), eq(eosIntegrationBindings.companyId, companyId)) }) : null,
      ]);
      const counselApproved = ["counsel_approved", "counsel_approved_with_changes"].includes(authority.state);
      const agreementBlockers = [
        ...(!counselApproved ? ["Qualified counsel has not approved the effective agreement authority."] : []),
        ...(counselApproved && authority.effectiveVersion !== agreement.agreementVersion ? ["Agreement version does not match the effective counsel-reviewed version."] : []),
        ...(!agreement.clientLegalName || !agreement.clientSignerName || !agreement.clientSignerEmail || !agreement.providerLegalName || !agreement.eSignTemplateReference ? ["Client identity, provider legal name, agreement version, and signing document/template must be configured."] : []),
        ...(agreement.eSignProvider === "eos_native" && (!nativeDocument || nativeDocument.documentVersion !== agreement.agreementVersion || !nativeDocument.counselEvidenceId) ? ["The EOS native document version must be tenant-scoped, match the effective agreement version, and retain counsel evidence lineage."] : []),
        ...agreementProviderBlockers(agreement.eSignProvider as "eos_native" | "docusign", eSignBinding || null),
      ];
      const paymentReady = billing.setupPaymentState === "succeeded"
        && ["active", "trialing"].includes(billing.subscriptionState);
      const agreementState = ["issued", "signed", "declined", "voided", "expired"].includes(agreement.state)
        ? agreement.state
        : agreementBlockers.length
          ? (counselApproved ? "blocked_esign" : "blocked_counsel")
          : paymentReady
            ? "eligible_to_issue"
            : "blocked_payment";
      const billingBlockers = [
        ...(!counselApproved ? ["Qualified counsel has not approved the effective agreement authority."] : []),
        ...(counselApproved && authority.effectiveVersion !== agreement.agreementVersion ? ["Agreement version does not match the effective counsel-reviewed version."] : []),
        ...(!billing.providerProductReference || !billing.setupPriceReference || !billing.recurringPriceReference ? ["Stripe product and both price references must be configured."] : []),
        ...billingProviderBlockers(stripeBinding || null),
      ];
      const billingState = ["issued", "payment_failed", "setup_paid_subscription_pending", "active", "recovery_required", "cancelled", "refunded", "disputed"].includes(billing.state)
        ? billing.state
        : billingBlockers.some((item) => item.startsWith("Qualified counsel") || item.startsWith("Agreement version"))
          ? "blocked_agreement"
          : billingBlockers.length
            ? "blocked_stripe"
            : "checkout_eligible";
      const now = new Date();
      const traceId = randomUUID();
      let nextAgreement!: typeof agreement;
      let nextBilling!: typeof billing;
      await db.transaction(async (tx) => {
        [nextAgreement] = await tx.update(eosRecoveryAgreementInstances).set({ state: agreementState, blockers: agreementBlockers, version: agreement.version + 1, updatedAt: now }).where(and(eq(eosRecoveryAgreementInstances.id, agreement.id), eq(eosRecoveryAgreementInstances.version, agreement.version))).returning();
        [nextBilling] = await tx.update(eosRecoveryBillingManifests).set({ state: billingState, blockers: billingBlockers, version: billing.version + 1, updatedAt: now }).where(and(eq(eosRecoveryBillingManifests.id, billing.id), eq(eosRecoveryBillingManifests.version, billing.version))).returning();
        if (!nextAgreement || !nextBilling) throw new RecoveryRouteError(409, "recovery_activation_version_conflict", "The activation changed before evaluation completed.");
        await appendActivationEvent(tx, agreement.id, nextAgreement, "agreement", { userId: req.user.id, seatId: access.seat.id }, "agreement_evaluated", agreement.state, agreementState, { blockerCount: agreementBlockers.length, providerEffect: false }, traceId);
        await appendActivationEvent(tx, agreement.id, nextBilling, "billing", { userId: req.user.id, seatId: access.seat.id }, "billing_evaluated", billing.state, billingState, { blockerCount: billingBlockers.length, providerEffect: false }, traceId);
      });
      res.json({ agreement: nextAgreement, authority, billing: nextBilling });
    } catch (error) {
      if (respondRecoveryError(res, error)) return;
      next(error);
    }
  });
}
