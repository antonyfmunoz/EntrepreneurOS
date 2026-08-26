import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import {
  companies, eosAuditRecords, eosEvidence, eosStakeholders, eosStakeholderPortalAccessGrants,
  eosStakeholderPortalPublications, eosStakeholderPortals,
} from "@shared/schema";
import {
  stakeholderAccessGrantSchema, stakeholderPortalCreateSchema, stakeholderPortalTransitionSchema,
  stakeholderPublicationCreateSchema, stakeholderPublicationTransitionSchema,
} from "@shared/stakeholder-portal";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import { EosRouteError, authorizeAction, companyAccess } from "./eos-runtime";

const tokenDigest = (value: string) => createHash("sha256").update(value).digest("hex");
const identityDigest = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
const publicPortalRateLimit = fixedWindowRateLimit({ limit: 90, windowMs: 60_000, namespace: "stakeholder-portal-public" });
function route(handler: (req: Request, res: Response) => Promise<void>) { return async (req: Request, res: Response, next: (error?: unknown) => void) => { try { await handler(req, res); } catch (error) { if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message }); if (error instanceof ZodError) return res.status(400).json({ code: "stakeholder_portal_input_invalid", message: error.issues[0]?.message || "Stakeholder portal input is invalid." }); next(error); } }; }

async function portalAccess(req: Request, actionKey: string, view = false) {
  const access = await companyAccess(req);
  const policy = await authorizeAction(req, access, { authorityClass: view ? "view" : "decide", resource: "stakeholder_portal", actionKey, purpose: view ? "inspect_stakeholder_portals" : "govern_external_disclosure", classification: "restricted", consequence: view ? "routine" : "material", targetSeatId: access.seat.id });
  return { access, policy };
}

async function evidenceFor(companyId: number, ids: string[], verified = false) {
  if (new Set(ids).size !== ids.length) throw new EosRouteError(409, "portal_evidence_duplicate", "Evidence references must be unique.");
  if (!ids.length) return [];
  const rows = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, companyId), inArray(eosEvidence.id, ids)));
  if (rows.length !== ids.length || (verified && rows.some((item) => item.verificationState !== "verified"))) throw new EosRouteError(409, "portal_evidence_invalid", verified ? "External disclosure requires verified Evidence from the same company." : "Evidence must resolve inside this company.");
  return rows;
}

export function registerPublicStakeholderPortalRoutes(app: Express): void {
  app.use("/api/public/stakeholder-portals", publicPortalRateLimit);
  app.get("/api/public/stakeholder-portals/:token", route(async (req, res) => {
    const tokenHash = tokenDigest(req.params.token || ""); const now = new Date();
    const [grant] = await db.select().from(eosStakeholderPortalAccessGrants).where(eq(eosStakeholderPortalAccessGrants.tokenHash, tokenHash)).limit(1);
    if (!grant || ["revoked", "expired"].includes(grant.state) || grant.expiresAt <= now) {
      if (grant && grant.expiresAt <= now && grant.state !== "expired") await db.update(eosStakeholderPortalAccessGrants).set({ state: "expired" }).where(eq(eosStakeholderPortalAccessGrants.id, grant.id));
      throw new EosRouteError(404, "stakeholder_portal_unavailable", "This stakeholder workspace is unavailable.");
    }
    const [portal] = await db.select().from(eosStakeholderPortals).where(and(eq(eosStakeholderPortals.id, grant.portalId), eq(eosStakeholderPortals.state, "active"))).limit(1);
    if (!portal) throw new EosRouteError(404, "stakeholder_portal_unavailable", "This stakeholder workspace is unavailable.");
    const [company, publications] = await Promise.all([
      db.select({ name: companies.name }).from(companies).where(eq(companies.id, portal.companyId)).limit(1).then((rows) => rows[0]),
      db.select().from(eosStakeholderPortalPublications).where(and(eq(eosStakeholderPortalPublications.portalId, portal.id), eq(eosStakeholderPortalPublications.state, "published"))).orderBy(desc(eosStakeholderPortalPublications.publishedAt)),
    ]);
    await db.update(eosStakeholderPortalAccessGrants).set({ state: "accessed", lastAccessedAt: now, accessCount: grant.accessCount + 1 }).where(eq(eosStakeholderPortalAccessGrants.id, grant.id));
    res.setHeader("Cache-Control", "no-store");
    res.json({ schemaVersion: "eos.stakeholder-portal-public.v1", companyName: company?.name || "Organization", portal: { name: portal.name, portalType: portal.portalType, visibleSections: portal.visibleSections }, recipientLabel: grant.recipientLabel, expiresAt: grant.expiresAt, publications: publications.map(({ recordedByUserId: _recordedByUserId, publishedByUserId: _publishedByUserId, companyId: _companyId, ...item }) => item) });
  }));
}

export function registerStakeholderPortalRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/stakeholder-portals", route(async (req, res) => {
    const { access } = await portalAccess(req, "stakeholder_portal.read", true);
    const portals = await db.select().from(eosStakeholderPortals).where(eq(eosStakeholderPortals.companyId, access.company.id)).orderBy(desc(eosStakeholderPortals.updatedAt));
    const ids = portals.map((item) => item.id);
    const [publications, grants] = ids.length ? await Promise.all([
      db.select().from(eosStakeholderPortalPublications).where(and(eq(eosStakeholderPortalPublications.companyId, access.company.id), inArray(eosStakeholderPortalPublications.portalId, ids))).orderBy(desc(eosStakeholderPortalPublications.updatedAt)),
      db.select({ id: eosStakeholderPortalAccessGrants.id, portalId: eosStakeholderPortalAccessGrants.portalId, recipientLabel: eosStakeholderPortalAccessGrants.recipientLabel, state: eosStakeholderPortalAccessGrants.state, expiresAt: eosStakeholderPortalAccessGrants.expiresAt, lastAccessedAt: eosStakeholderPortalAccessGrants.lastAccessedAt, accessCount: eosStakeholderPortalAccessGrants.accessCount, createdAt: eosStakeholderPortalAccessGrants.createdAt }).from(eosStakeholderPortalAccessGrants).where(and(eq(eosStakeholderPortalAccessGrants.companyId, access.company.id), inArray(eosStakeholderPortalAccessGrants.portalId, ids))).orderBy(desc(eosStakeholderPortalAccessGrants.createdAt)),
    ]) : [[], []];
    res.json({ schemaVersion: "eos.stakeholder-portal-registry.v1", portals: portals.map((portal) => ({ ...portal, publications: publications.filter((item) => item.portalId === portal.id), accessGrants: grants.filter((item) => item.portalId === portal.id) })), counts: { dormant: portals.filter((item) => item.state === "dormant").length, active: portals.filter((item) => item.state === "active").length, paused: portals.filter((item) => item.state === "paused").length } });
  }));

  app.post("/api/eos/companies/:companyId/stakeholder-portals", route(async (req, res) => {
    const input = stakeholderPortalCreateSchema.parse(req.body); const { access, policy } = await portalAccess(req, "stakeholder_portal.create");
    if (input.stakeholderId) { const [stakeholder] = await db.select().from(eosStakeholders).where(and(eq(eosStakeholders.id, input.stakeholderId), eq(eosStakeholders.companyId, access.company.id))).limit(1); if (!stakeholder) throw new EosRouteError(409, "portal_stakeholder_invalid", "Stakeholder must belong to this company."); }
    const now = new Date(); const record = { id: randomUUID(), companyId: access.company.id, ...input, stakeholderId: input.stakeholderId || null, state: "dormant", activationEvidenceIds: [], ownerSeatId: access.seat.id, activatedByUserId: null, activatedAt: null, version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => { await tx.insert(eosStakeholderPortals).values(record); await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "stakeholder_portal.created", targetType: "stakeholder_portal", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "dormant", details: { portalType: input.portalType, externallyAccessible: false, policyDecisionId: policy.decisionId }, createdAt: now }); });
    res.status(201).json(record);
  }));

  app.patch("/api/eos/companies/:companyId/stakeholder-portals/:portalId", route(async (req, res) => {
    const input = stakeholderPortalTransitionSchema.parse(req.body); const { access, policy } = await portalAccess(req, "stakeholder_portal.transition");
    const [portal] = await db.select().from(eosStakeholderPortals).where(and(eq(eosStakeholderPortals.id, req.params.portalId), eq(eosStakeholderPortals.companyId, access.company.id))).limit(1);
    if (!portal) throw new EosRouteError(404, "stakeholder_portal_not_found", "Stakeholder portal not found."); if (portal.version !== input.expectedVersion) throw new EosRouteError(409, "stakeholder_portal_version_conflict", "The portal changed before this decision.");
    const transitions: Record<string, string[]> = { dormant: ["configuring", "retired"], configuring: ["active", "retired"], active: ["paused", "retired"], paused: ["active", "retired"] };
    if (!transitions[portal.state]?.includes(input.state)) throw new EosRouteError(409, "stakeholder_portal_transition_invalid", `Portal cannot move from ${portal.state} to ${input.state}.`);
    const activating = input.state === "active"; await evidenceFor(access.company.id, input.evidenceIds, activating);
    if (activating && input.evidenceIds.length < (Array.isArray(portal.activationRequirements) ? portal.activationRequirements.length : 1)) throw new EosRouteError(409, "stakeholder_portal_activation_incomplete", "Activation requires verified Evidence for every named activation requirement.");
    const now = new Date(); const [updated] = await db.update(eosStakeholderPortals).set({ state: input.state, activationEvidenceIds: activating ? input.evidenceIds : portal.activationEvidenceIds, activatedByUserId: activating ? req.user.id : portal.activatedByUserId, activatedAt: activating ? now : portal.activatedAt, version: portal.version + 1, updatedAt: now }).where(and(eq(eosStakeholderPortals.id, portal.id), eq(eosStakeholderPortals.version, portal.version))).returning();
    if (!updated) throw new EosRouteError(409, "stakeholder_portal_concurrent_change", "The portal changed before this decision.");
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "stakeholder_portal.transitioned", targetType: "stakeholder_portal", targetId: portal.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { from: portal.state, rationale: input.rationale, evidenceIds: input.evidenceIds, externallyAccessible: activating, policyDecisionId: policy.decisionId }, createdAt: now });
    res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/stakeholder-portals/:portalId/publications", route(async (req, res) => {
    const input = stakeholderPublicationCreateSchema.parse(req.body); const { access, policy } = await portalAccess(req, "stakeholder_publication.create");
    const [portal] = await db.select().from(eosStakeholderPortals).where(and(eq(eosStakeholderPortals.id, req.params.portalId), eq(eosStakeholderPortals.companyId, access.company.id))).limit(1);
    if (!portal || !Array.isArray(portal.visibleSections) || !portal.visibleSections.includes(input.section)) throw new EosRouteError(409, "stakeholder_publication_section_invalid", "Publication must use a configured portal section.");
    await evidenceFor(access.company.id, input.evidenceIds); const now = new Date(); const record = { id: randomUUID(), portalId: portal.id, companyId: access.company.id, ...input, state: "draft", version: 1, publishedByUserId: null, publishedAt: null, recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => { await tx.insert(eosStakeholderPortalPublications).values(record); await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "stakeholder_publication.created", targetType: "stakeholder_publication", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { portalId: portal.id, section: input.section, externallyVisible: false, policyDecisionId: policy.decisionId }, createdAt: now }); }); res.status(201).json(record);
  }));

  app.patch("/api/eos/companies/:companyId/stakeholder-portals/:portalId/publications/:publicationId", route(async (req, res) => {
    const input = stakeholderPublicationTransitionSchema.parse(req.body); const { access, policy } = await portalAccess(req, "stakeholder_publication.transition");
    const [publication] = await db.select().from(eosStakeholderPortalPublications).where(and(eq(eosStakeholderPortalPublications.id, req.params.publicationId), eq(eosStakeholderPortalPublications.portalId, req.params.portalId), eq(eosStakeholderPortalPublications.companyId, access.company.id))).limit(1);
    if (!publication) throw new EosRouteError(404, "stakeholder_publication_not_found", "Publication not found."); if (publication.version !== input.expectedVersion) throw new EosRouteError(409, "stakeholder_publication_version_conflict", "The publication changed before this decision.");
    if ((publication.state === "draft" && input.state !== "published") || (publication.state === "published" && input.state !== "withdrawn") || publication.state === "withdrawn") throw new EosRouteError(409, "stakeholder_publication_transition_invalid", `Publication cannot move from ${publication.state} to ${input.state}.`);
    await evidenceFor(access.company.id, publication.evidenceIds as string[], input.state === "published"); const now = new Date(); const [updated] = await db.update(eosStakeholderPortalPublications).set({ state: input.state, version: publication.version + 1, publishedByUserId: input.state === "published" ? req.user.id : publication.publishedByUserId, publishedAt: input.state === "published" ? now : publication.publishedAt, updatedAt: now }).where(and(eq(eosStakeholderPortalPublications.id, publication.id), eq(eosStakeholderPortalPublications.version, publication.version))).returning();
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "stakeholder_publication.transitioned", targetType: "stakeholder_publication", targetId: publication.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { portalId: publication.portalId, from: publication.state, rationale: input.rationale, externallyVisible: input.state === "published", policyDecisionId: policy.decisionId }, createdAt: now }); res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/stakeholder-portals/:portalId/access-grants", route(async (req, res) => {
    const input = stakeholderAccessGrantSchema.parse(req.body); const { access, policy } = await portalAccess(req, "stakeholder_portal.issue_access");
    const [portal] = await db.select().from(eosStakeholderPortals).where(and(eq(eosStakeholderPortals.id, req.params.portalId), eq(eosStakeholderPortals.companyId, access.company.id))).limit(1);
    if (!portal || portal.state !== "active") throw new EosRouteError(409, "stakeholder_portal_not_active", "Access can be issued only while the portal is active.");
    const published = await db.select({ id: eosStakeholderPortalPublications.id }).from(eosStakeholderPortalPublications).where(and(eq(eosStakeholderPortalPublications.portalId, portal.id), eq(eosStakeholderPortalPublications.state, "published"))).limit(1);
    if (!published.length) throw new EosRouteError(409, "stakeholder_portal_empty", "Issue access only after at least one Evidence-backed publication is available.");
    const token = randomBytes(32).toString("base64url"); const now = new Date(); const record = { id: randomUUID(), portalId: portal.id, companyId: access.company.id, recipientLabel: input.recipientLabel, recipientIdentityHash: identityDigest(input.recipientIdentity), tokenHash: tokenDigest(token), state: "issued", expiresAt: new Date(input.expiresAt), lastAccessedAt: null, accessCount: 0, revokedAt: null, issuedByUserId: req.user.id, createdAt: now };
    await db.transaction(async (tx) => { await tx.insert(eosStakeholderPortalAccessGrants).values(record); await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "stakeholder_portal.access_issued", targetType: "stakeholder_portal_access", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "issued", details: { portalId: portal.id, expiresAt: record.expiresAt.toISOString(), recipientIdentityHash: record.recipientIdentityHash, rationale: input.rationale, tokenDisclosedOnce: true, policyDecisionId: policy.decisionId }, createdAt: now }); });
    res.status(201).json({ grant: { ...record, tokenHash: undefined, recipientIdentityHash: undefined }, token, portalUrl: `/stakeholder/${token}` });
  }));

  app.post("/api/eos/companies/:companyId/stakeholder-portals/:portalId/access-grants/:grantId/revoke", route(async (req, res) => {
    const { access, policy } = await portalAccess(req, "stakeholder_portal.revoke_access"); const rationale = typeof req.body?.rationale === "string" ? req.body.rationale.trim() : ""; if (rationale.length < 20) throw new EosRouteError(400, "stakeholder_portal_rationale_required", "Revocation requires a rationale.");
    const [grant] = await db.select().from(eosStakeholderPortalAccessGrants).where(and(eq(eosStakeholderPortalAccessGrants.id, req.params.grantId), eq(eosStakeholderPortalAccessGrants.portalId, req.params.portalId), eq(eosStakeholderPortalAccessGrants.companyId, access.company.id))).limit(1); if (!grant) throw new EosRouteError(404, "stakeholder_access_not_found", "Access grant not found.");
    const now = new Date(); const [updated] = await db.update(eosStakeholderPortalAccessGrants).set({ state: "revoked", revokedAt: now }).where(eq(eosStakeholderPortalAccessGrants.id, grant.id)).returning(); await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "stakeholder_portal.access_revoked", targetType: "stakeholder_portal_access", targetId: grant.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "revoked", details: { portalId: grant.portalId, rationale, policyDecisionId: policy.decisionId }, createdAt: now }); res.json(updated);
  }));
}
