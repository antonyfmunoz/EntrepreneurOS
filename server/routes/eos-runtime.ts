import { randomUUID } from "crypto";
import type { Express, Request } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { callAI } from "../ai/gateway";
import * as gmail from "../integrations/gmail";
import * as notion from "../integrations/notion";
import { federationConfigured } from "../umh/config";
import {
  companies,
  eosApprovalRequests,
  eosAdvisorConsultations,
  eosAuditRecords,
  eosCommunicationMessages,
  eosConversations,
  eosEvidence,
  eosManifestVersions,
  eosMemberships,
  eosProviderExecutions,
  eosSeats,
  eosWorkPackets,
  portfolios,
  users,
  aiBudgets,
  aiUsageLedger,
} from "@shared/schema";
import {
  approvalDecisionSchema,
  allowedSurfacesFor,
  buildAdvisorCouncil,
  canTransitionManifest,
  canTransitionWorkPacket,
  evidenceCreateSchema,
  manifestInputSchema,
  membershipCreateSchema,
  providerExecutionCreateSchema,
  selectAdvisorSeats,
  seatCreateSchema,
  type EosSeatKind,
  visibilityPolicyFor,
  workPacketCreateSchema,
  workPacketTransitionSchema,
} from "@shared/eos-runtime";

function companyIdFrom(req: Request): number {
  const value = Number(req.params.companyId);
  if (!Number.isInteger(value) || value <= 0) throw new EosRouteError(400, "invalid_company", "Company id must be a positive integer.");
  return value;
}

class EosRouteError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function companyAccess(req: Request) {
  const companyId = companyIdFrom(req);
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
  if (company.ownerUserId === req.user.id) {
    let seat = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")), orderBy: [eosSeats.createdAt] });
    if (!seat) {
      await db.insert(eosSeats).values({
        id: randomUUID(), companyId: company.id, title: "Founder / Portfolio Principal", kind: "founder",
        occupantUserId: req.user.id, agentName: company.assistantName || "Assistant", agentMode: "assistant",
        mandate: "Own portfolio direction and final local authority.", authority: { level: "owner" }, toolEntitlements: [],
      }).onConflictDoNothing();
      seat = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")), orderBy: [eosSeats.createdAt] });
    }
    if (!seat) throw new EosRouteError(500, "founder_seat_unavailable", "The founder operating seat could not be resolved.");
    return { company, seat, role: "founder" as EosSeatKind, isOwner: true, membership: null };
  }
  const membership = await db.query.eosMemberships.findFirst({
    where: and(eq(eosMemberships.companyId, company.id), eq(eosMemberships.userId, req.user.id), eq(eosMemberships.status, "active")),
  });
  if (!membership) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
  const seat = membership.seatId ? await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, membership.seatId), eq(eosSeats.companyId, company.id), eq(eosSeats.status, "active")) }) : undefined;
  if (!seat) throw new EosRouteError(403, "active_seat_required", "This membership has no active organizational seat.");
  return { company, seat, role: membership.role as EosSeatKind, isOwner: false, membership };
}

async function ownedCompany(req: Request) {
  return (await companyAccess(req)).company;
}

async function visibleSeatIds(companyId: number, seatId: string, role: EosSeatKind): Promise<Set<string>> {
  const seats = await db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")));
  if (["founder", "portfolio_executive", "company_ceo"].includes(role)) return new Set(seats.map((seat) => seat.id));
  const visible = new Set<string>([seatId]);
  if (["functional_executive", "manager"].includes(role)) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const seat of seats) if (seat.supervisorSeatId && visible.has(seat.supervisorSeatId) && !visible.has(seat.id)) { visible.add(seat.id); changed = true; }
    }
  }
  return visible;
}

function mayManageOrganization(role: EosSeatKind): boolean {
  return ["founder", "company_ceo"].includes(role);
}

function mayReview(role: EosSeatKind): boolean {
  return ["founder", "portfolio_executive", "company_ceo", "functional_executive", "manager"].includes(role);
}

function companyProjection(company: typeof companies.$inferSelect, role: EosSeatKind) {
  if (["founder", "portfolio_executive", "company_ceo"].includes(role)) return company;
  const shared = {
    id: company.id,
    portfolioId: company.portfolioId,
    name: company.name,
    type: company.type,
    stage: company.stage,
    offer: company.offer,
    targetCustomer: company.targetCustomer,
    goals: company.goals,
    createdAt: company.createdAt,
  };
  if (role === "functional_executive" || role === "manager") return shared;
  return { id: shared.id, name: shared.name, type: shared.type, stage: shared.stage };
}

function manifestProjection(record: typeof eosManifestVersions.$inferSelect | undefined, role: EosSeatKind) {
  if (!record) return null;
  if (["founder", "portfolio_executive", "company_ceo"].includes(role)) return record;
  const manifest = record.manifest as Record<string, unknown>;
  const shared = { id: record.id, companyId: record.companyId, version: record.version, status: record.status, activatedAt: record.activatedAt };
  if (role === "functional_executive") return { ...shared, manifest: { purpose: manifest.purpose, stage: manifest.stage, goals: manifest.goals, enabledModules: manifest.enabledModules } };
  if (role === "manager") return { ...shared, manifest: { purpose: manifest.purpose, goals: manifest.goals } };
  return shared;
}

async function approverFor(company: typeof companies.$inferSelect, seat: typeof eosSeats.$inferSelect) {
  if (seat.kind === "founder") return { userId: company.ownerUserId, seatId: seat.id };
  if (seat.supervisorSeatId) {
    const supervisor = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, seat.supervisorSeatId), eq(eosSeats.companyId, company.id), eq(eosSeats.status, "active")) });
    if (supervisor?.occupantUserId) return { userId: supervisor.occupantUserId, seatId: supervisor.id };
  }
  const founder = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder")) });
  return { userId: company.ownerUserId, seatId: founder?.id || null };
}

function tracePair() {
  return { traceId: randomUUID(), correlationId: randomUUID() };
}

function route(handler: (req: Request) => Promise<{ status?: number; body?: unknown }>) {
  return async (req: Request, res: any) => {
    try {
      const result = await handler(req);
      if (result.status === 204) return res.status(204).end();
      return res.status(result.status || 200).json(result.body);
    } catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_request", message: "Request did not match the EOS contract.", issues: error.issues });
      console.error("EOS runtime request failed", error);
      return res.status(500).json({ code: "eos_runtime_failed", message: "The EOS runtime request could not be completed." });
    }
  };
}

export function registerEosRuntimeRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/context", route(async (req) => {
    const access = await companyAccess(req);
    const { company, seat, role } = access;
    const seatIds = await visibleSeatIds(company.id, seat.id, role);
    const [portfolio, manifest, allWorkPackets, allApprovals, allEvidence] = await Promise.all([
      company.portfolioId ? db.query.portfolios.findFirst({ where: eq(portfolios.id, company.portfolioId) }) : undefined,
      db.query.eosManifestVersions.findFirst({ where: eq(eosManifestVersions.companyId, company.id), orderBy: [desc(eosManifestVersions.version)] }),
      db.select().from(eosWorkPackets).where(eq(eosWorkPackets.companyId, company.id)),
      db.select().from(eosApprovalRequests).where(eq(eosApprovalRequests.companyId, company.id)),
      db.select().from(eosEvidence).where(eq(eosEvidence.companyId, company.id)),
    ]);
    const workPackets = allWorkPackets.filter((packet) => access.isOwner || (packet.accountableSeatId && seatIds.has(packet.accountableSeatId)));
    const packetIds = new Set(workPackets.map((packet) => packet.id));
    const approvals = allApprovals.filter((approval) => approval.assignedToUserId === req.user.id || packetIds.has(approval.workPacketId));
    const evidence = allEvidence.filter((item) => packetIds.has(item.workPacketId));
    const principalContext = {
      principalId: req.user.id,
      role,
      seatId: seat.id,
      seat: seat.title,
      communicationAgent: role === "founder" ? company.assistantName || "Assistant" : seat.agentName,
      communicationMode: role === "founder" ? "executive_assistant" : "role_agent_assistant",
      visibility: visibilityPolicyFor(role),
      allowedSurfaces: allowedSurfacesFor(role),
      authority: seat.authority,
      toolEntitlements: seat.toolEntitlements,
    };
    return { body: {
      company: companyProjection(company, role),
      portfolio: portfolio || null,
      manifest: manifestProjection(manifest, role),
      principalContext,
      counts: {
        openWorkPackets: workPackets.filter((item) => !["completed", "cancelled"].includes(item.status)).length,
        pendingApprovals: approvals.filter((item) => item.status === "pending").length,
        evidence: evidence.length,
        blocked: workPackets.filter((item) => item.status === "blocked").length,
      },
    } };
  }));

  app.get("/api/eos/companies/:companyId/advisor-council", route(async (req) => {
    const { company, role } = await companyAccess(req);
    if (!["founder", "portfolio_executive", "company_ceo"].includes(role)) throw new EosRouteError(403, "advisor_scope_denied", "The portfolio advisory council is outside this seat's visibility scope.");
    const portfolio = company.portfolioId
      ? await db.query.portfolios.findFirst({ where: eq(portfolios.id, company.portfolioId) })
      : undefined;
    return {
      body: buildAdvisorCouncil({
        founderName: req.user.fullName || req.user.username,
        portfolioName: portfolio?.name,
        companyName: company.name,
        founderProfile: company.founderProfile as Record<string, unknown>,
        companyGoals: company.goals,
      }),
    };
  }));

  app.get("/api/eos/companies/:companyId/advisor-council/consultations", route(async (req) => {
    const access = await companyAccess(req);
    if (access.role !== "founder") throw new EosRouteError(403, "advisor_scope_denied", "Founder advisory deliberations are private to the founder's Executive Assistant channel.");
    return { body: await db.select().from(eosAdvisorConsultations).where(eq(eosAdvisorConsultations.companyId, access.company.id)).orderBy(desc(eosAdvisorConsultations.createdAt)).limit(100) };
  }));

  app.get("/api/eos/companies/:companyId/organization-runtime", route(async (req) => {
    const access = await companyAccess(req);
    const seats = await db.select().from(eosSeats).where(and(eq(eosSeats.companyId, access.company.id), eq(eosSeats.status, "active"))).orderBy(eosSeats.createdAt);
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    const memberships = mayManageOrganization(access.role)
      ? await db.select().from(eosMemberships).where(and(eq(eosMemberships.companyId, access.company.id), eq(eosMemberships.status, "active")))
      : [];
    return { body: { seats: seats.filter((seat) => visible.has(seat.id)), memberships, activeSeatId: access.seat.id } };
  }));

  app.post("/api/eos/companies/:companyId/seats", route(async (req) => {
    const access = await companyAccess(req);
    if (!mayManageOrganization(access.role)) throw new EosRouteError(403, "organization_manage_denied", "Only the founder or Company CEO may create seats.");
    const input = seatCreateSchema.parse(req.body);
    if (input.supervisorSeatId) {
      const supervisor = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, input.supervisorSeatId), eq(eosSeats.companyId, access.company.id)) });
      if (!supervisor) throw new EosRouteError(400, "invalid_supervisor", "Supervisor must be an active seat in this company.");
    }
    const [seat] = await db.insert(eosSeats).values({
      id: randomUUID(), companyId: access.company.id, title: input.title, kind: input.kind,
      supervisorSeatId: input.supervisorSeatId || access.seat.id, occupantUserId: input.occupantUserId || null,
      agentName: input.agentName, agentMode: input.occupantUserId ? "assistant" : "autonomous", mandate: input.mandate,
      authority: input.authority, toolEntitlements: input.toolEntitlements,
    }).returning();
    return { status: 201, body: seat };
  }));

  app.post("/api/eos/companies/:companyId/memberships", route(async (req) => {
    const access = await companyAccess(req);
    if (!mayManageOrganization(access.role)) throw new EosRouteError(403, "membership_manage_denied", "Only the founder or Company CEO may assign people to seats.");
    const input = membershipCreateSchema.parse(req.body);
    const user = input.userId
      ? await db.query.users.findFirst({ where: eq(users.id, input.userId) })
      : await db.query.users.findFirst({ where: eq(users.email, input.email!.trim().toLowerCase()) });
    if (!user) throw new EosRouteError(404, "user_not_found", "The person must create and verify an EOS account before assignment to a seat.");
    const seat = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, input.seatId), eq(eosSeats.companyId, access.company.id), eq(eosSeats.status, "active")) });
    if (!seat) throw new EosRouteError(400, "invalid_seat", "Membership must reference an active seat in this company.");
    const existing = await db.query.eosMemberships.findFirst({ where: and(eq(eosMemberships.companyId, access.company.id), eq(eosMemberships.userId, user.id)) });
    const [membership] = existing
      ? await db.update(eosMemberships).set({ seatId: seat.id, role: seat.kind, status: "active", purpose: input.purpose, classificationCeiling: input.classificationCeiling, updatedAt: new Date() }).where(eq(eosMemberships.id, existing.id)).returning()
      : await db.insert(eosMemberships).values({ id: randomUUID(), companyId: access.company.id, userId: user.id, seatId: seat.id, role: seat.kind, purpose: input.purpose, classificationCeiling: input.classificationCeiling }).returning();
    await db.update(eosSeats).set({ occupantUserId: user.id, agentMode: "assistant", updatedAt: new Date() }).where(eq(eosSeats.id, seat.id));
    return { status: existing ? 200 : 201, body: membership };
  }));

  async function communicationContext(req: Request) {
    const access = await companyAccess(req);
    const channelType = access.role === "founder" ? "executive_assistant" : "role_agent";
    let conversation = await db.query.eosConversations.findFirst({ where: and(eq(eosConversations.companyId, access.company.id), eq(eosConversations.seatId, access.seat.id), eq(eosConversations.channelType, channelType)) });
    if (!conversation) {
      [conversation] = await db.insert(eosConversations).values({ id: randomUUID(), companyId: access.company.id, seatId: access.seat.id, channelType, title: channelType === "executive_assistant" ? "Executive Office" : `${access.seat.title} assistant` }).returning();
    }
    return { ...access, conversation, agentName: access.role === "founder" ? access.company.assistantName || "Assistant" : access.seat.agentName };
  }

  app.get("/api/eos/companies/:companyId/executive-assistant/messages", route(async (req) => {
    const context = await communicationContext(req);
    const messages = await db.select().from(eosCommunicationMessages).where(eq(eosCommunicationMessages.conversationId, context.conversation.id)).orderBy(eosCommunicationMessages.createdAt);
    return { body: { messages, assistantName: context.agentName, mode: context.role === "founder" ? "executive_assistant" : "role_agent_assistant" } };
  }));

  app.post("/api/eos/companies/:companyId/executive-assistant/messages", route(async (req) => {
    const context = await communicationContext(req);
    const { company, role, seat, conversation, agentName } = context;
    const input = z.object({ content: z.string().trim().min(1).max(4000) }).parse(req.body);
    const portfolio = company.portfolioId
      ? await db.query.portfolios.findFirst({ where: eq(portfolios.id, company.portfolioId) })
      : undefined;
    const council = buildAdvisorCouncil({
      founderName: req.user.fullName || req.user.username,
      portfolioName: portfolio?.name,
      companyName: company.name,
      founderProfile: company.founderProfile as Record<string, unknown>,
      companyGoals: company.goals,
    });
    const history = await db.select().from(eosCommunicationMessages).where(eq(eosCommunicationMessages.conversationId, conversation.id)).orderBy(desc(eosCommunicationMessages.createdAt)).limit(20);
    await db.insert(eosCommunicationMessages).values({ id: randomUUID(), conversationId: conversation.id, companyId: company.id, senderType: "human", senderUserId: req.user.id, senderSeatId: seat.id, content: input.content, provenance: { role, purpose: context.membership?.purpose || "owner" } });
    const selectedAdvisors = role === "founder" ? selectAdvisorSeats(council.advisors, input.content, 3) : [];
    const advisorOutputs = role === "founder" ? await Promise.all(selectedAdvisors.map(async (advisor) => {
      try {
        const output = await callAI({ messages: [{ role: "user", content: input.content }], system: `You are the ${advisor.name} advisor. Mandate: ${advisor.mandate}. Founder vision: ${council.personalization.founderVision || "not captured"}. Values: ${council.personalization.founderValues || "not captured"}. Company: ${company.name}. Give a concise evidence-aware advisory view, name assumptions and material disagreement, and do not approve or execute anything.`, tier: "fast", maxTokens: 600, context: `eos-advisor:${company.id}:${advisor.id}`, companyId: company.id, userId: req.user.id });
        await db.insert(eosAdvisorConsultations).values({ id: randomUUID(), companyId: company.id, conversationId: conversation.id, advisorId: advisor.id, advisorName: advisor.name, request: input.content, response: output.content, model: output.model, status: "completed", provenance: { mandate: advisor.mandate, timeHorizon: advisor.timeHorizon, founderProfileVersion: "company.current" } });
        return { advisor, content: output.content, status: "completed" };
      } catch (error: any) {
        const response = `Consultation unavailable: ${String(error?.message || "provider failure")}`;
        await db.insert(eosAdvisorConsultations).values({ id: randomUUID(), companyId: company.id, conversationId: conversation.id, advisorId: advisor.id, advisorName: advisor.name, request: input.content, response, status: "failed", provenance: { mandate: advisor.mandate, failure: "reasoning_provider_unavailable" } });
        return { advisor, content: response, status: "failed" };
      }
    })) : [];
    const portfolioCompanies = role === "founder"
      ? (await db.select().from(companies).where(eq(companies.ownerUserId, req.user.id))).filter((candidate) => company.portfolioId ? candidate.portfolioId === company.portfolioId : candidate.id === company.id)
      : [];
    const companyCeoAgents = role === "founder" ? (await Promise.all(portfolioCompanies.map(async (candidate) => {
      const ceoSeat = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.companyId, candidate.id), eq(eosSeats.kind, "company_ceo"), eq(eosSeats.status, "active")) });
      return ceoSeat ? { company: candidate, seat: ceoSeat } : null;
    }))).filter((candidate): candidate is { company: typeof companies.$inferSelect; seat: typeof eosSeats.$inferSelect } => Boolean(candidate))
      .filter((candidate) => candidate.company.id === company.id || input.content.toLowerCase().includes(candidate.company.name.toLowerCase()))
      .slice(0, 3) : [];
    const ceoOutputs = role === "founder" ? await Promise.all(companyCeoAgents.map(async ({ company: targetCompany, seat: ceoSeat }) => {
      const delegate = { id: `company-ceo:${targetCompany.id}`, name: `${ceoSeat.agentName} — ${targetCompany.name} CEO Agent` };
      try {
        const output = await callAI({ messages: [{ role: "user", content: input.content }], system: `You are ${ceoSeat.agentName}, the Company CEO Agent for ${targetCompany.name}. Mandate: ${ceoSeat.mandate || "Own company execution and report material state upward."}. Company goals: ${targetCompany.goals || "not captured"}. Report the company-operating perspective to the founder's Executive Assistant. Identify facts, assumptions, risks, dependencies, and decisions needed. Do not address the founder directly and do not execute or approve anything.`, tier: "fast", maxTokens: 600, context: `eos-company-ceo:${targetCompany.id}:${ceoSeat.id}`, companyId: targetCompany.id, userId: req.user.id });
        await db.insert(eosAdvisorConsultations).values({ id: randomUUID(), companyId: company.id, conversationId: conversation.id, advisorId: delegate.id, advisorName: delegate.name, request: input.content, response: output.content, model: output.model, status: "completed", provenance: { kind: "company_ceo_agent", targetCompanyId: targetCompany.id, targetSeatId: ceoSeat.id } });
        return { advisor: delegate, content: output.content, status: "completed" };
      } catch (error: any) {
        const response = `CEO Agent consultation unavailable: ${String(error?.message || "provider failure")}`;
        await db.insert(eosAdvisorConsultations).values({ id: randomUUID(), companyId: company.id, conversationId: conversation.id, advisorId: delegate.id, advisorName: delegate.name, request: input.content, response, status: "failed", provenance: { kind: "company_ceo_agent", targetCompanyId: targetCompany.id, targetSeatId: ceoSeat.id, failure: "reasoning_provider_unavailable" } });
        return { advisor: delegate, content: response, status: "failed" };
      }
    })) : [];
    const orchestratedOutputs = [...advisorOutputs, ...ceoOutputs];
    const consultationContext = orchestratedOutputs.length ? `\nOrchestrated advisor and Company CEO Agent artifacts (retain material dissent and identify each source):\n${orchestratedOutputs.map((item) => `[${item.advisor.name}; ${item.status}] ${item.content}`).join("\n")}` : "";
    const founderSystem = `You are ${agentName}, the user-named Executive Assistant for ${company.name}. You are the sole founder-facing communication channel. Coordinate the relevant perspectives from the fifteen-seat portfolio advisor council and Company CEO Agents. Preserve dissent and provenance. Never claim a consultation or external action occurred unless evidence proves it. Never grant authority, approve work, or execute consequential effects.${consultationContext}`;
    const roleSystem = `You are ${agentName}, the persistent Role Agent for the ${seat.title} seat at ${company.name}. A human occupies this seat, so you operate as that human's assistant. Respect the reporting chain: communicate upward through the direct supervisor and downward only through authorized direct reports or shared Work Packets. Never expose records outside this seat's visibility or grant authority.`;
    const founderContext = ` Founder vision: ${council.personalization.founderVision || "not yet captured"}. Founder values: ${council.personalization.founderValues || "not yet captured"}. Decision style: ${council.personalization.decisionStyle || "not yet captured"}.`;
    const roleContext = ` Company goals authorized for this seat: ${company.goals || "not yet captured"}. Do not reveal founder-private profile fields, executive deliberations, lateral-team context, or records outside the active reporting scope.`;
    const system = `${role === "founder" ? founderSystem + founderContext : roleSystem + roleContext}`;
    try {
      const response = await callAI({
        messages: [...history.reverse().map((message) => ({ role: message.senderType === "human" ? "user" as const : "assistant" as const, content: message.content })), { role: "user", content: input.content }],
        system,
        tier: "standard",
        maxTokens: 1400,
        context: `eos-executive-assistant:${company.id}`,
        companyId: company.id,
        userId: req.user.id,
      });
      const [saved] = await db.insert(eosCommunicationMessages).values({ id: randomUUID(), conversationId: conversation.id, companyId: company.id, senderType: "agent", senderSeatId: seat.id, content: response.content, provenance: { mode: "connected_reasoning", agentName, consultedAdvisors: orchestratedOutputs.map((item) => ({ id: item.advisor.id, name: item.advisor.name, status: item.status })) } }).returning();
      return { body: { response: response.content, message: saved, mode: "connected_reasoning", assistantName: agentName } };
    } catch (error) {
      console.warn("EOS Executive Assistant provider unavailable; using explicit local fallback", error);
      const fallback = `I received your message in the ${company.name} ${seat.title} context. The reasoning provider is unavailable, so no consultation or action is represented as complete. Capture the outcome as a bounded Work Packet and route consequential effects through the authorized reporting and approval chain.`;
      await db.insert(eosCommunicationMessages).values({ id: randomUUID(), conversationId: conversation.id, companyId: company.id, senderType: "agent", senderSeatId: seat.id, content: fallback, provenance: { mode: "local_fallback", agentName } });
      return { body: {
        response: fallback,
        mode: "local_fallback",
        assistantName: agentName,
      } };
    }
  }));

  app.get("/api/eos/companies/:companyId/brief", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    const visible = await visibleSeatIds(company.id, access.seat.id, access.role);
    const [allPackets, allApprovals, manifest] = await Promise.all([
      db.select().from(eosWorkPackets).where(eq(eosWorkPackets.companyId, company.id)).orderBy(desc(eosWorkPackets.createdAt)).limit(20),
      db.select().from(eosApprovalRequests).where(and(eq(eosApprovalRequests.companyId, company.id), eq(eosApprovalRequests.status, "pending"))).orderBy(desc(eosApprovalRequests.createdAt)).limit(20),
      db.query.eosManifestVersions.findFirst({ where: and(eq(eosManifestVersions.companyId, company.id), eq(eosManifestVersions.status, "active")), orderBy: [desc(eosManifestVersions.version)] }),
    ]);
    const packets = allPackets.filter((packet) => access.isOwner || (packet.accountableSeatId && visible.has(packet.accountableSeatId)));
    const packetIds = new Set(packets.map((packet) => packet.id));
    const approvals = allApprovals.filter((approval) => approval.assignedToUserId === req.user.id || packetIds.has(approval.workPacketId));
    const now = Date.now();
    return { body: {
      generatedAt: new Date(now).toISOString(),
      companyId: company.id,
      headline: manifest ? `${company.name} is operating on manifest v${manifest.version}.` : `${company.name} still needs an activated organization manifest.`,
      priorities: packets.filter((item) => !["completed", "cancelled"].includes(item.status)).slice(0, 5),
      pendingApprovals: approvals,
      exceptions: packets.filter((item) => item.status === "blocked" || (item.dueAt && item.dueAt.getTime() < now && item.status !== "completed")),
      setupComplete: Boolean(manifest),
    } };
  }));

  app.get("/api/eos/companies/:companyId/manifests", route(async (req) => {
    const access = await companyAccess(req);
    if (!allowedSurfacesFor(access.role).includes("organization")) throw new EosRouteError(403, "manifest_scope_denied", "Organization manifests are outside this seat's visibility scope.");
    const records = await db.select().from(eosManifestVersions).where(eq(eosManifestVersions.companyId, access.company.id)).orderBy(desc(eosManifestVersions.version));
    return { body: records.map((record) => manifestProjection(record, access.role)) };
  }));

  app.post("/api/eos/companies/:companyId/compiler/drafts", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    if (!mayManageOrganization(access.role)) throw new EosRouteError(403, "compiler_denied", "Only the founder or Company CEO may compile the organization.");
    const manifest = manifestInputSchema.parse(req.body);
    const latest = await db.query.eosManifestVersions.findFirst({ where: eq(eosManifestVersions.companyId, company.id), orderBy: [desc(eosManifestVersions.version)] });
    const record = {
      id: randomUUID(),
      companyId: company.id,
      version: (latest?.version || 0) + 1,
      status: "draft",
      manifest: {
        ...manifest,
        advisorCouncil: buildAdvisorCouncil({
          founderName: req.user.fullName || req.user.username,
          companyName: company.name,
          founderProfile: manifest.founderProfile,
          companyGoals: manifest.goals.join("\n"),
        }),
        compiledFrom: { companyId: company.id, companyName: company.name },
        schemaVersion: "eos.organization-manifest.v1",
      },
      createdByUserId: req.user.id,
      createdAt: new Date(),
    };
    const { traceId, correlationId } = tracePair();
    await db.transaction(async (tx) => {
      await tx.insert(eosManifestVersions).values(record);
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
        action: "manifest.compiled", targetType: "organization_manifest", targetId: record.id,
        traceId, correlationId, result: "draft_created", details: { version: record.version }, createdAt: new Date(),
      });
    });
    return { status: 201, body: record };
  }));

  app.post("/api/eos/companies/:companyId/manifests/:manifestId/activate", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    if (!mayManageOrganization(access.role)) throw new EosRouteError(403, "manifest_activation_denied", "This seat cannot activate an organization manifest.");
    const target = await db.query.eosManifestVersions.findFirst({ where: and(eq(eosManifestVersions.id, req.params.manifestId), eq(eosManifestVersions.companyId, company.id)) });
    if (!target) throw new EosRouteError(404, "manifest_not_found", "Manifest not found in this company.");
    if (target.status === "active") return { body: target };
    if (target.status !== "verifying") throw new EosRouteError(409, "manifest_not_activatable", "A manifest must complete review, provisioning, and verification before activation.");
    manifestInputSchema.parse(target.manifest);
    const manifest = target.manifest as any;
    if ((manifest.provisioningChecklist || []).some((item: any) => item.required && !item.complete)) throw new EosRouteError(409, "provisioning_incomplete", "Every required provisioning item must be complete.");
    if (!(manifest.verificationChecks || []).length || (manifest.verificationChecks || []).some((item: any) => item.status !== "passed")) throw new EosRouteError(409, "verification_incomplete", "Every verification check must pass before activation.");
    const now = new Date();
    const { traceId, correlationId } = tracePair();
    let activated: typeof target | undefined;
    await db.transaction(async (tx) => {
      await tx.update(eosManifestVersions).set({ status: "superseded" }).where(and(eq(eosManifestVersions.companyId, company.id), eq(eosManifestVersions.status, "active")));
      [activated] = await tx.update(eosManifestVersions).set({ status: "active", approvedByUserId: req.user.id, activatedAt: now }).where(and(eq(eosManifestVersions.id, target.id), eq(eosManifestVersions.status, "verifying"))).returning();
      if (!activated) throw new EosRouteError(409, "manifest_activation_conflict", "Manifest changed before it could be activated.");
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
        action: "manifest.activated", targetType: "organization_manifest", targetId: target.id,
        traceId, correlationId, result: "activated", details: { version: target.version }, createdAt: now,
      });
    });
    return { body: activated };
  }));

  app.post("/api/eos/companies/:companyId/manifests/:manifestId/transition", route(async (req) => {
    const access = await companyAccess(req);
    if (!mayManageOrganization(access.role)) throw new EosRouteError(403, "manifest_transition_denied", "This seat cannot advance the organization compiler.");
    const input = z.object({ status: z.string(), manifest: manifestInputSchema.optional(), reason: z.string().max(2000).optional() }).parse(req.body);
    const target = await db.query.eosManifestVersions.findFirst({ where: and(eq(eosManifestVersions.id, req.params.manifestId), eq(eosManifestVersions.companyId, access.company.id)) });
    if (!target) throw new EosRouteError(404, "manifest_not_found", "Manifest not found in this company.");
    if (!canTransitionManifest(target.status, input.status)) throw new EosRouteError(409, "invalid_manifest_transition", `Manifest cannot transition from ${target.status} to ${input.status}.`);
    const nextManifest = input.manifest || manifestInputSchema.parse(target.manifest);
    if (input.status === "proposed" && !nextManifest.sourceAssertions.length) throw new EosRouteError(409, "source_assertions_required", "At least one sourced fact, claim, inference, or user assertion is required before proposal.");
    if (input.status === "verifying" && nextManifest.provisioningChecklist.some((item) => item.required && !item.complete)) throw new EosRouteError(409, "provisioning_incomplete", "Complete required provisioning before verification.");
    const { traceId, correlationId } = tracePair();
    const [updated] = await db.update(eosManifestVersions).set({ status: input.status, manifest: nextManifest }).where(and(eq(eosManifestVersions.id, target.id), eq(eosManifestVersions.status, target.status))).returning();
    if (!updated) throw new EosRouteError(409, "manifest_transition_conflict", "Manifest changed before the transition was applied.");
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "manifest.transitioned", targetType: "organization_manifest", targetId: target.id, traceId, correlationId, result: input.status, details: { from: target.status, to: input.status, reason: input.reason || null } });
    return { body: updated };
  }));

  app.get("/api/eos/companies/:companyId/work-packets", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const where = status ? and(eq(eosWorkPackets.companyId, company.id), eq(eosWorkPackets.status, status)) : eq(eosWorkPackets.companyId, company.id);
    const records = await db.select().from(eosWorkPackets).where(where).orderBy(desc(eosWorkPackets.createdAt));
    const visible = await visibleSeatIds(company.id, access.seat.id, access.role);
    return { body: records.filter((packet) => access.isOwner || (packet.accountableSeatId && visible.has(packet.accountableSeatId))) };
  }));

  app.post("/api/eos/companies/:companyId/work-packets", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    const input = workPacketCreateSchema.parse(req.body);
    const accountableSeatId = input.accountableSeatId || access.seat.id;
    const visible = await visibleSeatIds(company.id, access.seat.id, access.role);
    if (!visible.has(accountableSeatId)) throw new EosRouteError(403, "accountable_seat_denied", "This seat cannot assign work outside its authorized reporting scope.");
    const accountableSeat = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, accountableSeatId), eq(eosSeats.companyId, company.id)) });
    if (!accountableSeat) throw new EosRouteError(400, "invalid_accountable_seat", "Work must be assigned to an active company seat.");
    const now = new Date();
    const id = randomUUID();
    const { traceId, correlationId } = tracePair();
    const status = input.requiresApproval ? "awaiting_approval" : "ready";
    let approvalId: string | undefined;
    const approver = await approverFor(company, access.seat);
    await db.transaction(async (tx) => {
      await tx.insert(eosWorkPackets).values({
        id, companyId: company.id, createdByUserId: req.user.id, accountableUserId: req.user.id,
        accountableSeatId,
        title: input.title, objective: input.objective, status, priority: input.priority, source: input.source,
        visibility: input.visibility, classification: input.classification,
        requiresApproval: input.requiresApproval, toolPack: input.toolPack, evidenceRequirements: input.evidenceRequirements,
        traceId, correlationId, dueAt: input.dueAt ? new Date(input.dueAt) : null, createdAt: now, updatedAt: now,
      });
      if (input.requiresApproval) {
        approvalId = randomUUID();
        await tx.insert(eosApprovalRequests).values({
          id: approvalId, companyId: company.id, workPacketId: id, requestedByUserId: req.user.id,
          assignedToUserId: approver.userId, assignedToSeatId: approver.seatId, summary: `Authorize work packet: ${input.title}`, status: "pending", createdAt: now,
        });
      }
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
        action: "work_packet.created", targetType: "work_packet", targetId: id,
        traceId, correlationId, result: status, details: { approvalId: approvalId || null }, createdAt: now,
      });
    });
    const created = await db.query.eosWorkPackets.findFirst({ where: eq(eosWorkPackets.id, id) });
    return { status: 201, body: { ...created, approvalId: approvalId || null } };
  }));

  app.post("/api/eos/companies/:companyId/work-packets/:workPacketId/transition", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    const input = workPacketTransitionSchema.parse(req.body);
    const packet = await db.query.eosWorkPackets.findFirst({ where: and(eq(eosWorkPackets.id, req.params.workPacketId), eq(eosWorkPackets.companyId, company.id)) });
    if (!packet) throw new EosRouteError(404, "work_packet_not_found", "Work packet not found in this company.");
    const visible = await visibleSeatIds(company.id, access.seat.id, access.role);
    if (!access.isOwner && (!packet.accountableSeatId || !visible.has(packet.accountableSeatId))) throw new EosRouteError(404, "work_packet_not_found", "Work packet not found in this seat's authority scope.");
    if (!canTransitionWorkPacket(packet.status, input.status)) throw new EosRouteError(409, "invalid_transition", `Work packet cannot transition from ${packet.status} to ${input.status}.`);
    if (input.status === "completed") {
      const evidence = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, company.id), eq(eosEvidence.workPacketId, packet.id)));
      const required = Array.isArray(packet.evidenceRequirements) ? packet.evidenceRequirements as string[] : [];
      if (!evidence.length || required.some((requirement) => !evidence.some((item) => item.title.trim().toLowerCase() === requirement.trim().toLowerCase()))) throw new EosRouteError(409, "evidence_required", "Every named evidence requirement must be recorded before completion.");
    }
    const now = new Date();
    const updates: Record<string, unknown> = { status: input.status, updatedAt: now };
    if (input.status === "in_progress" && !packet.startedAt) updates.startedAt = now;
    if (input.status === "completed") updates.completedAt = now;
    const { traceId, correlationId } = tracePair();
    let updated: typeof packet | undefined;
    await db.transaction(async (tx) => {
      [updated] = await tx.update(eosWorkPackets).set(updates).where(and(eq(eosWorkPackets.id, packet.id), eq(eosWorkPackets.status, packet.status))).returning();
      if (!updated) throw new EosRouteError(409, "transition_conflict", "Work packet changed before the transition was applied.");
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
        action: "work_packet.transitioned", targetType: "work_packet", targetId: packet.id,
        traceId, correlationId, result: input.status, details: { from: packet.status, to: input.status, reason: input.reason || null }, createdAt: now,
      });
    });
    return { body: updated };
  }));

  app.get("/api/eos/companies/:companyId/approvals", route(async (req) => {
    const access = await companyAccess(req);
    const records = await db.select().from(eosApprovalRequests).where(eq(eosApprovalRequests.companyId, access.company.id)).orderBy(desc(eosApprovalRequests.createdAt));
    return { body: records.filter((approval) => approval.assignedToUserId === req.user.id || (access.isOwner && approval.status !== "pending")) };
  }));

  app.get("/api/eos/companies/:companyId/provider-executions", route(async (req) => {
    const access = await companyAccess(req);
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    const [records, packets] = await Promise.all([
      db.select().from(eosProviderExecutions).where(eq(eosProviderExecutions.companyId, access.company.id)).orderBy(desc(eosProviderExecutions.createdAt)),
      db.select().from(eosWorkPackets).where(eq(eosWorkPackets.companyId, access.company.id)),
    ]);
    const visiblePackets = new Set(packets.filter((packet) => access.isOwner || (packet.accountableSeatId && visible.has(packet.accountableSeatId))).map((packet) => packet.id));
    return { body: records.filter((record) => visiblePackets.has(record.workPacketId)) };
  }));

  app.post("/api/eos/companies/:companyId/work-packets/:workPacketId/provider-executions", route(async (req) => {
    const access = await companyAccess(req);
    const input = providerExecutionCreateSchema.parse(req.body);
    const packet = await db.query.eosWorkPackets.findFirst({ where: and(eq(eosWorkPackets.id, req.params.workPacketId), eq(eosWorkPackets.companyId, access.company.id)) });
    if (!packet) throw new EosRouteError(404, "work_packet_not_found", "Provider execution must reference a visible Work Packet.");
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    if (!access.isOwner && (!packet.accountableSeatId || !visible.has(packet.accountableSeatId))) throw new EosRouteError(404, "work_packet_not_found", "Provider execution must reference a visible Work Packet.");
    if (!gmail.isConfigured()) throw new EosRouteError(409, "gmail_not_configured", "The Gmail adapter is not configured in this deployment.");
    if (!(await gmail.isConnected(req.user.id))) throw new EosRouteError(409, "gmail_not_connected", "Connect Google Workspace before requesting an email effect.");
    const approver = await approverFor(access.company, access.seat);
    const approvalId = randomUUID();
    const executionId = randomUUID();
    const { traceId, correlationId } = tracePair();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(eosApprovalRequests).values({ id: approvalId, companyId: access.company.id, workPacketId: packet.id, requestedByUserId: req.user.id, assignedToUserId: approver.userId, assignedToSeatId: approver.seatId, summary: `Authorize Gmail delivery: ${input.subject}`, status: "pending", createdAt: now });
      await tx.insert(eosProviderExecutions).values({ id: executionId, companyId: access.company.id, workPacketId: packet.id, approvalId, requestedByUserId: req.user.id, provider: input.provider, operation: input.operation, request: { to: input.to, subject: input.subject, body: input.body, cc: input.cc, bcc: input.bcc }, traceId, correlationId, createdAt: now, updatedAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "provider_execution.requested", targetType: "provider_execution", targetId: executionId, traceId, correlationId, result: "awaiting_approval", details: { provider: input.provider, operation: input.operation, approvalId, workPacketId: packet.id }, createdAt: now });
    });
    return { status: 201, body: { id: executionId, approvalId, status: "awaiting_approval", traceId, correlationId } };
  }));

  app.post("/api/eos/companies/:companyId/approvals/:approvalId/decide", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    const input = approvalDecisionSchema.parse(req.body);
    const approval = await db.query.eosApprovalRequests.findFirst({ where: and(eq(eosApprovalRequests.id, req.params.approvalId), eq(eosApprovalRequests.companyId, company.id), eq(eosApprovalRequests.assignedToUserId, req.user.id)) });
    if (!approval) throw new EosRouteError(404, "approval_not_found", "Approval not found in this authority scope.");
    if (approval.status !== "pending") throw new EosRouteError(409, "approval_already_decided", "Approval has already been decided.");
    const now = new Date();
    const nextStatus = input.decision === "approved" ? "ready" : "cancelled";
    const { traceId, correlationId } = tracePair();
    let decided: typeof approval | undefined;
    await db.transaction(async (tx) => {
      [decided] = await tx.update(eosApprovalRequests).set({
        status: input.decision, decisionReason: input.reason || null, decidedByUserId: req.user.id, decidedAt: now,
      }).where(and(eq(eosApprovalRequests.id, approval.id), eq(eosApprovalRequests.status, "pending"))).returning();
      if (!decided) throw new EosRouteError(409, "approval_conflict", "Approval changed before the decision was applied.");
      await tx.update(eosWorkPackets).set({ status: nextStatus, updatedAt: now }).where(and(eq(eosWorkPackets.id, approval.workPacketId), eq(eosWorkPackets.status, "awaiting_approval")));
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
        action: "approval.decided", targetType: "approval", targetId: approval.id,
        traceId, correlationId, result: input.decision, details: { workPacketId: approval.workPacketId, reason: input.reason || null }, createdAt: now,
      });
    });
    const providerExecution = await db.query.eosProviderExecutions.findFirst({ where: and(eq(eosProviderExecutions.companyId, company.id), eq(eosProviderExecutions.approvalId, approval.id)) });
    if (!providerExecution) return { body: decided };
    if (input.decision === "rejected") {
      const [updated] = await db.update(eosProviderExecutions).set({ status: "rejected", reconciliationStatus: "not_executed", updatedAt: now }).where(and(eq(eosProviderExecutions.id, providerExecution.id), eq(eosProviderExecutions.status, "awaiting_approval"))).returning();
      return { body: { approval: decided, providerExecution: updated } };
    }
    const request = providerExecution.request as { to: string; subject: string; body: string; cc?: string; bcc?: string };
    try {
      const receipt = await gmail.sendEmail(providerExecution.requestedByUserId, request);
      const completedAt = new Date();
      const [updated] = await db.update(eosProviderExecutions).set({ status: "succeeded", receipt, reconciliationStatus: "reconciled", executedAt: completedAt, reconciledAt: completedAt, updatedAt: completedAt }).where(eq(eosProviderExecutions.id, providerExecution.id)).returning();
      await db.transaction(async (tx) => {
        await tx.insert(eosEvidence).values({ id: randomUUID(), companyId: company.id, workPacketId: approval.workPacketId, recordedByUserId: req.user.id, evidenceType: "provider_receipt", title: "Gmail provider receipt", details: { provider: "gmail", messageId: receipt.messageId, executionId: providerExecution.id }, createdAt: completedAt });
        await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: company.id, actorUserId: req.user.id, action: "provider_execution.reconciled", targetType: "provider_execution", targetId: providerExecution.id, traceId: providerExecution.traceId, correlationId: providerExecution.correlationId, result: "succeeded", details: { provider: "gmail", messageId: receipt.messageId, workPacketId: approval.workPacketId }, createdAt: completedAt });
      });
      return { body: { approval: decided, providerExecution: updated } };
    } catch (error: any) {
      const [updated] = await db.update(eosProviderExecutions).set({ status: "failed", reconciliationStatus: "failed", failureCode: "provider_delivery_failed", receipt: { message: String(error?.message || "Provider delivery failed") }, executedAt: new Date(), updatedAt: new Date() }).where(eq(eosProviderExecutions.id, providerExecution.id)).returning();
      await db.update(eosWorkPackets).set({ status: "blocked", updatedAt: new Date() }).where(eq(eosWorkPackets.id, approval.workPacketId));
      return { status: 502, body: { code: "provider_delivery_failed", message: "Gmail delivery failed after approval; the Work Packet is blocked for recovery.", approval: decided, providerExecution: updated } };
    }
  }));

  app.get("/api/eos/companies/:companyId/evidence", route(async (req) => {
    const access = await companyAccess(req);
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    const [records, packets] = await Promise.all([db.select().from(eosEvidence).where(eq(eosEvidence.companyId, access.company.id)).orderBy(desc(eosEvidence.createdAt)), db.select().from(eosWorkPackets).where(eq(eosWorkPackets.companyId, access.company.id))]);
    const packetIds = new Set(packets.filter((packet) => access.isOwner || (packet.accountableSeatId && visible.has(packet.accountableSeatId))).map((packet) => packet.id));
    return { body: records.filter((record) => packetIds.has(record.workPacketId)) };
  }));

  app.post("/api/eos/companies/:companyId/evidence", route(async (req) => {
    const access = await companyAccess(req);
    const { company } = access;
    const input = evidenceCreateSchema.parse(req.body);
    const packet = await db.query.eosWorkPackets.findFirst({ where: and(eq(eosWorkPackets.id, input.workPacketId), eq(eosWorkPackets.companyId, company.id)) });
    if (!packet) throw new EosRouteError(404, "work_packet_not_found", "Evidence must reference a work packet in this company.");
    const visible = await visibleSeatIds(company.id, access.seat.id, access.role);
    if (!access.isOwner && (!packet.accountableSeatId || !visible.has(packet.accountableSeatId))) throw new EosRouteError(404, "work_packet_not_found", "Evidence must reference a Work Packet visible to this seat.");
    const record = { id: randomUUID(), companyId: company.id, workPacketId: packet.id, recordedByUserId: req.user.id, evidenceType: input.evidenceType, title: input.title, uri: input.uri || null, details: input.details, createdAt: new Date() };
    const { traceId, correlationId } = tracePair();
    await db.transaction(async (tx) => {
      await tx.insert(eosEvidence).values(record);
      await tx.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
        action: "evidence.recorded", targetType: "evidence", targetId: record.id,
        traceId, correlationId, result: "recorded", details: { workPacketId: packet.id, evidenceType: input.evidenceType }, createdAt: record.createdAt,
      });
    });
    return { status: 201, body: record };
  }));

  app.get("/api/eos/companies/:companyId/integrations", route(async (req) => {
    await ownedCompany(req);
    const [googleWorkspace, notionConnection] = await Promise.all([
      gmail.verifyConnection(req.user.id),
      notion.verifyConnection(),
    ]);
    const umhConfigured = federationConfigured();
    return { body: [
      {
        id: "google_workspace",
        name: "Google Workspace",
        description: "Gmail, Calendar, and Drive through user-authorized Google OAuth.",
        state: googleWorkspace.connected ? "connected" : googleWorkspace.configured ? "available" : "not_configured",
        health: googleWorkspace.healthy ? "healthy" : googleWorkspace.connected ? "degraded" : "not_connected",
        configured: googleWorkspace.configured,
        connected: googleWorkspace.connected,
        providerType: "oauth",
        authority: "provider_execution_after_local_approval",
        risk: "consequential_write",
        services: gmail.GOOGLE_WORKSPACE_SERVICES,
        serviceHealth: googleWorkspace.services,
        operations: gmail.GOOGLE_WORKSPACE_TOOLS,
        requiredScopes: gmail.requestedScopes(),
        grantedScopes: googleWorkspace.grantedScopes,
        executionAdapter: "EOS-owned Google Workspace OAuth adapter",
        manualFallback: "Copy an approved draft or event into the authorized Google Workspace client.",
        actions: googleWorkspace.connected ? ["verify", "reconnect", "disconnect"] : googleWorkspace.configured ? ["connect"] : [],
      },
      {
        id: "notion",
        name: "Notion",
        description: "Current product intent and canonical operating context.",
        state: notionConnection.connected ? "connected" : notionConnection.configured ? "degraded" : "not_configured",
        health: notionConnection.healthy ? "healthy" : notionConnection.configured ? "unhealthy" : "not_configured",
        configured: notionConnection.configured,
        connected: notionConnection.connected,
        providerType: "server_managed_api",
        authority: "external_reference_provider",
        risk: "read_only",
        services: ["Workspace context"],
        operations: notion.NOTION_TOOLS,
        requiredScopes: ["Read content shared with the EntrepreneurOS integration"],
        executionAdapter: "EOS-owned Notion API adapter",
        manualFallback: "Open the canonical Notion workspace directly.",
        actions: notionConnection.configured ? ["verify"] : [],
      },
      {
        id: "umh",
        name: "Universal Meta Harness",
        description: "Optional signed federation control plane; EOS remains authoritative for local work and approvals.",
        state: umhConfigured ? "connected" : "disabled",
        health: umhConfigured ? "configured" : "not_configured",
        configured: umhConfigured,
        connected: umhConfigured,
        providerType: "deployment_managed_federation",
        authority: "optional_control_plane",
        risk: "governed_federation",
        services: ["Signed command ingress", "Transactional event outbox"],
        operations: ["eos.action.propose.v1", "eos.command.outcome.read"],
        requiredScopes: ["Installation-bound issuer", "Ed25519 signing keys", "Replay-protected command scope"],
        executionAdapter: "EOS-owned signed HTTPS projection adapter",
        capabilityManifest: "/.well-known/umh/capability-manifest",
        manualFallback: "Operate EOS work, approvals, audit, and evidence directly.",
        actions: ["view_manifest"],
      },
    ] };
  }));

  app.get("/api/eos/companies/:companyId/integrations/google/context", route(async (req) => {
    await companyAccess(req);
    if (!(await gmail.isConnected(req.user.id))) throw new EosRouteError(409, "google_not_connected", "Connect Google Workspace before loading Calendar and Drive context.");
    return { body: await gmail.operatingContext(req.user.id) };
  }));

  app.get("/api/eos/companies/:companyId/integrations/notion/context", route(async (req) => {
    const access = await companyAccess(req);
    if (!allowedSurfacesFor(access.role).includes("systems")) throw new EosRouteError(403, "notion_scope_denied", "Direct canonical workspace search is outside this seat's visibility scope.");
    const query = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
    try {
      return { body: { generatedAt: new Date().toISOString(), results: await notion.searchWorkspace(query, 20) } };
    } catch (error: any) {
      throw new EosRouteError(502, "notion_context_unavailable", String(error?.message || "Notion context could not be loaded."));
    }
  }));

  app.get("/api/eos/companies/:companyId/audit", route(async (req) => {
    const access = await companyAccess(req);
    if (!["founder", "portfolio_executive", "company_ceo"].includes(access.role)) throw new EosRouteError(403, "audit_scope_denied", "The company-wide audit trail is outside this seat's visibility scope.");
    return { body: await db.select().from(eosAuditRecords).where(eq(eosAuditRecords.companyId, access.company.id)).orderBy(desc(eosAuditRecords.createdAt)).limit(200) };
  }));

  app.get("/api/eos/companies/:companyId/ai-budget", route(async (req) => {
    const access = await companyAccess(req);
    if (!access.isOwner) throw new EosRouteError(403, "ai_budget_scope_denied", "Only the company owner can view AI spend controls.");
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [budget] = await db.select().from(aiBudgets).where(eq(aiBudgets.companyId, access.company.id)).limit(1);
    const [usage] = await db.select({ spentMicros: sql<number>`coalesce(sum(case when ${aiUsageLedger.status} = 'completed' then ${aiUsageLedger.actualCostMicros} else ${aiUsageLedger.reservedCostMicros} end), 0)` }).from(aiUsageLedger).where(and(eq(aiUsageLedger.companyId, access.company.id), gte(aiUsageLedger.createdAt, monthStart)));
    return { body: { configured: Boolean(budget), enabled: budget?.enabled || false, monthlyLimitMicros: budget?.monthlyLimitMicros || null, perRequestLimitMicros: budget?.perRequestLimitMicros || null, spentMicros: Number(usage?.spentMicros || 0), monthStart } };
  }));

  app.put("/api/eos/companies/:companyId/ai-budget", route(async (req) => {
    const access = await companyAccess(req);
    if (!access.isOwner) throw new EosRouteError(403, "ai_budget_scope_denied", "Only the company owner can change AI spend controls.");
    const input = z.object({ monthlyLimitDollars: z.number().positive().max(10_000), perRequestLimitDollars: z.number().positive().max(1_000), enabled: z.boolean() }).refine((value) => value.perRequestLimitDollars <= value.monthlyLimitDollars, "Per-request limit must not exceed the monthly limit.").parse(req.body);
    const monthlyLimitMicros = Math.round(input.monthlyLimitDollars * 1_000_000);
    const perRequestLimitMicros = Math.round(input.perRequestLimitDollars * 1_000_000);
    const [budget] = await db.insert(aiBudgets).values({ companyId: access.company.id, monthlyLimitMicros, perRequestLimitMicros, enabled: input.enabled, updatedByUserId: req.user.id }).onConflictDoUpdate({ target: aiBudgets.companyId, set: { monthlyLimitMicros, perRequestLimitMicros, enabled: input.enabled, updatedByUserId: req.user.id, updatedAt: new Date() } }).returning();
    const trace = tracePair();
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "ai_budget.updated", targetType: "ai_budget", targetId: String(access.company.id), traceId: trace.traceId, correlationId: trace.correlationId, result: "configured", details: { monthlyLimitMicros, perRequestLimitMicros, enabled: input.enabled } });
    return { body: budget };
  }));
}
