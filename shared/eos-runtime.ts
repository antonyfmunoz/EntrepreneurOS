import { z } from "zod";

export const manifestInputSchema = z.object({
  purpose: z.string().min(3).max(500),
  stage: z.string().min(1).max(100),
  offer: z.string().min(1).max(500),
  targetCustomer: z.string().min(1).max(500),
  goals: z.array(z.string().min(1).max(300)).min(1).max(12),
  enabledModules: z.array(z.number().int().min(1).max(17)).min(1),
  ownerSeat: z.object({
    title: z.string().min(1).max(120),
    authority: z.enum(["owner", "executive", "operator"]),
  }),
  operatingCadence: z.enum(["weekly", "biweekly", "monthly"]),
  founderProfile: z.object({
    vision: z.string().max(2000).default(""),
    values: z.string().max(1200).default(""),
    decisionStyle: z.string().max(1200).default(""),
    workingStyle: z.string().max(1200).default(""),
  }).default({ vision: "", values: "", decisionStyle: "", workingStyle: "" }),
  sourceAssertions: z.array(z.object({
    label: z.string().min(1).max(200),
    value: z.string().min(1).max(2000),
    sourceType: z.enum(["source_fact", "source_claim", "eos_inference", "user_assertion"]),
    sourceUri: z.string().url().max(2000).optional(),
  })).max(100).default([]),
  assumptions: z.array(z.string().min(1).max(1000)).max(50).default([]),
  unknowns: z.array(z.string().min(1).max(1000)).max(50).default([]),
  packageSelections: z.array(z.object({ id: z.string().min(1).max(100), version: z.string().min(1).max(50), rationale: z.string().max(1000).default("") })).max(50).default([]),
  provisioningChecklist: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(300), required: z.boolean().default(true), complete: z.boolean().default(false) })).max(100).default([]),
  verificationChecks: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(300), status: z.enum(["pending", "passed", "failed"]), evidence: z.string().max(2000).optional() })).max(100).default([]),
});

export type ManifestInput = z.infer<typeof manifestInputSchema>;

export const workPacketCreateSchema = z.object({
  title: z.string().min(3).max(200),
  objective: z.string().min(3).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime().optional(),
  requiresApproval: z.boolean().default(false),
  toolPack: z.array(z.string().min(1).max(100)).max(20).default([]),
  evidenceRequirements: z.array(z.string().min(1).max(300)).max(20).default([]),
  source: z.enum(["manual", "compiler", "integration", "umh"]).default("manual"),
  accountableSeatId: z.string().uuid().optional(),
  visibility: z.enum(["company", "reporting_tree", "seat"]).default("company"),
  classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
});

export const membershipInvitationCreateSchema = z.object({
  email: z.string().trim().email().max(320),
  seatId: z.string().uuid(),
  purpose: z.string().min(1).max(100).default("operate"),
  classificationCeiling: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
});

export const membershipInvitationTokenSchema = z.object({
  token: z.string().min(32).max(512),
});

export const seatCreateSchema = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(["portfolio_executive", "company_ceo", "functional_executive", "manager", "individual_contributor", "external"]),
  supervisorSeatId: z.string().uuid().optional(),
  occupantUserId: z.string().min(1).optional(),
  agentName: z.string().min(1).max(80),
  mandate: z.string().max(2000).default(""),
  authority: z.record(z.unknown()).default({}),
  toolEntitlements: z.array(z.string().min(1).max(120)).max(100).default([]),
});

export const providerExecutionCreateSchema = z.object({
  provider: z.literal("gmail"),
  operation: z.literal("gmail.send_with_local_approval"),
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).max(50_000),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
});

export const manifestStatuses = ["draft", "diagnostic", "proposed", "review", "approved", "provisioning", "verifying", "active", "blocked", "rejected", "failed", "quarantined", "rolled_back", "superseded"] as const;
export type ManifestStatus = typeof manifestStatuses[number];

const manifestTransitions: Record<ManifestStatus, readonly ManifestStatus[]> = {
  draft: ["diagnostic", "rejected"], diagnostic: ["proposed", "blocked", "rejected"],
  proposed: ["review", "draft", "rejected"], review: ["approved", "draft", "rejected"],
  approved: ["provisioning", "rejected"], provisioning: ["verifying", "blocked", "failed"],
  verifying: ["active", "blocked", "failed"], active: ["superseded", "rolled_back"],
  blocked: ["diagnostic", "provisioning", "verifying", "rejected"], rejected: ["draft"],
  failed: ["provisioning", "rolled_back"], quarantined: ["draft", "rejected"], rolled_back: [], superseded: [],
};

export function canTransitionManifest(from: string, to: string): to is ManifestStatus {
  return manifestStatuses.includes(from as ManifestStatus) && manifestStatuses.includes(to as ManifestStatus)
    && manifestTransitions[from as ManifestStatus].includes(to as ManifestStatus);
}

export const evidenceCreateSchema = z.object({
  workPacketId: z.string().uuid(),
  evidenceType: z.enum(["artifact", "provider_receipt", "observation", "review", "metric"]),
  title: z.string().min(1).max(200),
  uri: z.string().url().max(2000).optional(),
  details: z.record(z.unknown()).default({}),
});

export const workPacketStatuses = [
  "draft",
  "awaiting_approval",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "completed",
  "cancelled",
] as const;

export type WorkPacketStatus = typeof workPacketStatuses[number];

const transitions: Record<WorkPacketStatus, readonly WorkPacketStatus[]> = {
  draft: ["awaiting_approval", "ready", "cancelled"],
  awaiting_approval: ["ready", "cancelled"],
  ready: ["in_progress", "cancelled"],
  in_progress: ["blocked", "in_review", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  in_review: ["in_progress", "completed"],
  completed: [],
  cancelled: [],
};

export function canTransitionWorkPacket(from: string, to: string): to is WorkPacketStatus {
  if (!workPacketStatuses.includes(from as WorkPacketStatus) || !workPacketStatuses.includes(to as WorkPacketStatus)) return false;
  return transitions[from as WorkPacketStatus].includes(to as WorkPacketStatus);
}

export const eosSeatKinds = [
  "founder",
  "portfolio_executive",
  "company_ceo",
  "functional_executive",
  "manager",
  "individual_contributor",
  "external",
] as const;

export type EosSeatKind = typeof eosSeatKinds[number];

export interface SeatVisibilityPolicy {
  role: EosSeatKind;
  label: string;
  visibilityRank: number;
  scope: "portfolio" | "company" | "function" | "team" | "self" | "relationship";
  sees: readonly string[];
  cannotSee: readonly string[];
  communicationPath: string;
}

const seatVisibilityPolicies: Record<EosSeatKind, SeatVisibilityPolicy> = {
  founder: {
    role: "founder",
    label: "Founder / Portfolio Principal",
    visibilityRank: 100,
    scope: "portfolio",
    sees: ["all authorized portfolio and company operating state", "all decision and approval queues", "all organizational rollups and evidence"],
    cannotSee: ["legally privileged, conflict-walled, or highly restricted fields without the required explicit grant"],
    communicationPath: "Founder ↔ Executive Assistant",
  },
  portfolio_executive: {
    role: "portfolio_executive",
    label: "Portfolio Executive",
    visibilityRank: 90,
    scope: "portfolio",
    sees: ["authorized portfolio rollups", "entity health and dependencies", "portfolio mandates, risks, and allocations"],
    cannotSee: ["entity-private or person-private detail outside consolidation rights"],
    communicationPath: "Portfolio Executive ↔ Executive Assistant ↔ Company CEO Agents",
  },
  company_ceo: {
    role: "company_ceo",
    label: "Company CEO",
    visibilityRank: 80,
    scope: "company",
    sees: ["all authorized company state", "all functions and direct/indirect reports", "company decisions, risks, and evidence"],
    cannotSee: ["other portfolio companies without an explicit cross-entity grant"],
    communicationPath: "Company CEO ↔ Executive Assistant or Portfolio Executive; Company CEO ↔ direct reports",
  },
  functional_executive: {
    role: "functional_executive",
    label: "Functional Executive",
    visibilityRank: 70,
    scope: "function",
    sees: ["owned function", "downline teams", "authorized cross-functional dependencies and rollups"],
    cannotSee: ["peer-function private records or portfolio-wide detail"],
    communicationPath: "Functional Executive ↔ Company CEO; Functional Executive ↔ function managers",
  },
  manager: {
    role: "manager",
    label: "Manager",
    visibilityRank: 60,
    scope: "team",
    sees: ["own work and scorecard", "direct and indirect reports", "team work, risks, approvals, and evidence needed for supervision"],
    cannotSee: ["upward private state, lateral teams, or restricted people data without a specific grant"],
    communicationPath: "Manager ↔ direct supervisor; Manager ↔ direct reports",
  },
  individual_contributor: {
    role: "individual_contributor",
    label: "Individual Contributor",
    visibilityRank: 50,
    scope: "self",
    sees: ["own seat", "assigned work", "needed collaboration context", "own metrics, evidence, and policies"],
    cannotSee: ["manager-only, peer-private, executive, or portfolio state"],
    communicationPath: "Employee ↔ direct manager; peer communication only inside shared authorized work",
  },
  external: {
    role: "external",
    label: "External Collaborator",
    visibilityRank: 20,
    scope: "relationship",
    sees: ["explicitly shared relationship, case, work packet, or portal records"],
    cannotSee: ["internal deliberation, scoring, risk notes, or unrelated organizational state"],
    communicationPath: "External collaborator ↔ named internal relationship owner",
  },
};

export function visibilityPolicyFor(role: EosSeatKind): SeatVisibilityPolicy {
  return seatVisibilityPolicies[role];
}

const surfacePolicies: Record<EosSeatKind, readonly string[]> = {
  founder: ["home", "command", "organization", "my-role", "modules", "commercial", "operations", "work-room", "review", "academy", "portfolio-map", "capital", "intelligence", "systems"],
  portfolio_executive: ["home", "command", "organization", "my-role", "modules", "operations", "work-room", "review", "academy", "portfolio-map", "capital", "intelligence", "systems"],
  company_ceo: ["home", "command", "organization", "my-role", "modules", "commercial", "operations", "work-room", "review", "academy", "capital", "intelligence", "systems"],
  functional_executive: ["home", "command", "organization", "my-role", "modules", "operations", "work-room", "review", "academy", "intelligence", "systems"],
  manager: ["home", "my-role", "modules", "operations", "work-room", "review", "academy", "intelligence"],
  individual_contributor: ["home", "my-role", "modules", "work-room", "academy", "intelligence"],
  external: ["home", "my-role", "modules", "work-room"],
};

export function allowedSurfacesFor(role: EosSeatKind): readonly string[] {
  return surfacePolicies[role];
}

export type EosNextActionReason = "organization_setup" | "approval" | "active_work" | "new_work";

export function nextUsableSurfaceFor(role: EosSeatKind, reason: EosNextActionReason): string {
  const allowed = new Set(allowedSurfacesFor(role));
  const candidates: Record<EosNextActionReason, readonly string[]> = {
    organization_setup: ["organization", "intelligence", "my-role"],
    approval: ["review", "work-room", "my-role"],
    active_work: ["work-room", "my-role"],
    new_work: ["operations", "intelligence", "my-role"],
  };
  return candidates[reason].find((surface) => allowed.has(surface)) || "home";
}

export type RolePracticeAction = "prepare_work" | "open_assigned_work" | "request_supervisor_approval";

export function rolePracticeActionFor(role: EosSeatKind, hasActiveWork: boolean): RolePracticeAction {
  const allowed = new Set(allowedSurfacesFor(role));
  if (allowed.has("operations")) return "prepare_work";
  if (hasActiveWork && allowed.has("work-room")) return "open_assigned_work";
  return "request_supervisor_approval";
}

export interface EosActiveModule {
  id: number;
  name: string;
  activation: "active" | "partial";
  operatingSurface: "command" | "commercial" | "operations" | "work-room" | "systems";
  overlayBoundary: string;
  missionTitle: string;
  missionObjective: string;
  evidenceRequirement: string;
  fallback: string;
}

/**
 * The fourteen non-dormant EOS modules from the MVP-to-native blueprint.
 * These definitions intentionally route overlay work through the canonical
 * Work Packet, approval, evidence, and provider-control runtime. They do not
 * claim that the future native systems already exist.
 */
export const eosActiveModules: readonly EosActiveModule[] = [
  { id: 1, name: "Recruiting & Candidate Portal", activation: "active", operatingSurface: "operations", overlayBoundary: "Coordinate provider or form intake, assessment, review, decision, and onboarding handoff without exposing internal candidate deliberation.", missionTitle: "Advance a recruiting decision", missionObjective: "Move one candidate or open role through intake, assessment, accountable review, decision, and evidence-backed handoff.", evidenceRequirement: "Candidate decision record or reviewed assessment", fallback: "Create a local recruiting Work Packet and attach provider links or reviewed notes as evidence." },
  { id: 2, name: "Lead Capture & Marketing Qualification", activation: "active", operatingSurface: "commercial", overlayBoundary: "Ingest consented lead and attribution context from connected providers; EOS governs qualification and routing.", missionTitle: "Qualify and route a lead cohort", missionObjective: "Review consent, attribution, fit, and routing for a defined lead or cohort and return an accountable next commercial action.", evidenceRequirement: "Qualification rationale and source reference", fallback: "Record the source and qualification in a local Work Packet when the CRM or form provider is unavailable." },
  { id: 3, name: "Sales Opportunity & Commercial Decision", activation: "active", operatingSurface: "commercial", overlayBoundary: "Unify opportunity context while the CRM, communications, proposals, and offers remain authoritative provider records.", missionTitle: "Advance a commercial opportunity", missionObjective: "Evaluate one opportunity, its customer need, offer, risks, forecast, and required commercial decision with source-backed evidence.", evidenceRequirement: "Opportunity decision and supporting customer evidence", fallback: "Use a local commercial Work Packet and reconcile the decision to the authoritative CRM later." },
  { id: 4, name: "Contracting & Payment Activation", activation: "active", operatingSurface: "commercial", overlayBoundary: "Coordinate agreement and payment activation through approved provider links and events; EOS does not claim ledger or legal authority.", missionTitle: "Prepare a contract and payment decision", missionObjective: "Assemble the commercial terms, professional review needs, payment activation steps, authority gate, and provider references for one agreement.", evidenceRequirement: "Approved terms and provider activation receipt", fallback: "Prepare a governed local packet; a qualified human must execute legal or payment actions in the authoritative provider." },
  { id: 5, name: "Client Onboarding Portal", activation: "active", operatingSurface: "operations", overlayBoundary: "Coordinate scoped intake, access, checklist, approvals, and handoff while external identity and provider records retain authority.", missionTitle: "Complete a client onboarding milestone", missionObjective: "Move one client through the next onboarding milestone with named inputs, access requirements, owner, approval, and completion evidence.", evidenceRequirement: "Completed onboarding milestone and client-visible confirmation", fallback: "Run the checklist as a local Work Packet and share only explicitly authorized artifacts." },
  { id: 6, name: "Fulfillment & Work Delivery", activation: "active", operatingSurface: "work-room", overlayBoundary: "Coordinate deliverables, issues, change requests, review, and proof around connected project, document, and file systems.", missionTitle: "Deliver a client outcome", missionObjective: "Advance one deliverable from scoped work through review, change control, acceptance, and evidence-backed handoff.", evidenceRequirement: "Reviewed deliverable or observed outcome", fallback: "Operate the delivery packet locally and attach authoritative document or project links when available." },
  { id: 7, name: "Customer Success, Reporting & Renewal", activation: "partial", operatingSurface: "operations", overlayBoundary: "Summarize health, outcomes, issues, reports, and renewal reminders from evidence without inventing unsupported attribution.", missionTitle: "Review customer health and renewal readiness", missionObjective: "Assess one customer relationship using current outcomes, risks, open issues, evidence, and the next renewal or retention decision.", evidenceRequirement: "Customer health review with outcome evidence", fallback: "Create a local review packet and reconcile communications to the customer system when restored." },
  { id: 8, name: "Executive Command & Operating Cadence", activation: "active", operatingSurface: "command", overlayBoundary: "Direct objectives, constraints, decisions, commitments, approvals, and cadence from canonical EOS state.", missionTitle: "Run the next operating review", missionObjective: "Review current objectives, constraints, decisions, commitments, approvals, and accountable next actions for the organization.", evidenceRequirement: "Recorded decisions, owners, and commitments", fallback: "Use the EOS command state and local approval queue even when external providers are offline." },
  { id: 9, name: "Finance Control & Commercial Events", activation: "partial", operatingSurface: "operations", overlayBoundary: "Coordinate provider-backed invoice, payment, accounting, budget, approval, and reconciliation events without claiming ledger truth.", missionTitle: "Review a financial control event", missionObjective: "Review one budget, invoice, payment, or reconciliation event, identify the authority gate, and record the accountable decision.", evidenceRequirement: "Provider receipt or reviewed reconciliation record", fallback: "Record the control decision locally; the accounting, banking, payroll, or payment provider remains authoritative." },
  { id: 10, name: "Operations, Administration & Vendor Control", activation: "active", operatingSurface: "operations", overlayBoundary: "Govern recurring work, vendors, assets, access, obligations, and administrative requests through accountable packets.", missionTitle: "Resolve an operating control", missionObjective: "Advance one vendor, asset, access, obligation, or recurring-work request through ownership, approval, and verified completion.", evidenceRequirement: "Completed control checklist or provider receipt", fallback: "Operate the request locally and reconcile provider state after recovery." },
  { id: 11, name: "Product, Offer & Template Evolution", activation: "partial", operatingSurface: "operations", overlayBoundary: "Coordinate feedback, experiments, version proposals, and release decisions without presenting drafts as released product truth.", missionTitle: "Evaluate a product or offer change", missionObjective: "Turn feedback or an experiment into a versioned proposal, compatibility assessment, release decision, and measurable verification plan.", evidenceRequirement: "Versioned proposal and reviewed experiment evidence", fallback: "Run the proposal and approval locally; publish only through the authoritative product or content system." },
  { id: 12, name: "Technology, Integrations & Automation Control", activation: "partial", operatingSurface: "systems", overlayBoundary: "Expose provider binding, health, entitlement, retries, fallback, reconciliation, and replacement status before external effects.", missionTitle: "Qualify an integration or automation", missionObjective: "Verify one integration's identity, authority, health, failure behavior, fallback, evidence, and recovery path before enabling consequential use.", evidenceRequirement: "Health check, authority proof, and recovery result", fallback: "Keep EOS standalone-safe and route work through local packets until the provider is healthy and authorized." },
  { id: 13, name: "Legal Obligations, Rights & Compliance", activation: "partial", operatingSurface: "operations", overlayBoundary: "Index obligations, rights, consent, risks, controls, and professional-review needs while authoritative documents remain external.", missionTitle: "Review an obligation or rights decision", missionObjective: "Identify one obligation, consent, rights, retention, or compliance decision, its source, owner, deadline, professional boundary, and required evidence.", evidenceRequirement: "Authoritative source link and qualified review record", fallback: "Track the obligation locally and stop at the professional-review boundary; EOS does not provide legal approval." },
  { id: 14, name: "Brand, Media & Proof Distribution", activation: "active", operatingSurface: "commercial", overlayBoundary: "Coordinate creator or provider assets, claims, rights, approvals, distribution, attribution, and outcomes with source identity preserved.", missionTitle: "Approve a proof-backed distribution action", missionObjective: "Prepare one brand or media asset for distribution by verifying its claim, evidence, rights, audience, approval, channel, and outcome measure.", evidenceRequirement: "Approved asset, rights record, and distribution receipt", fallback: "Prepare the governed packet locally and distribute only through an authorized provider or CreatorOS/UMH path." },
] as const;

export function eosModulesForRole(role: EosSeatKind): readonly EosActiveModule[] {
  const allowed = new Set(allowedSurfacesFor(role));
  return eosActiveModules.filter((module) => allowed.has(module.operatingSurface));
}

export function canSeeSeat(actor: EosSeatKind, target: EosSeatKind): boolean {
  const actorPolicy = visibilityPolicyFor(actor);
  const targetPolicy = visibilityPolicyFor(target);
  if (actor === "external") return target === "external";
  return actorPolicy.visibilityRank >= targetPolicy.visibilityRank;
}

export interface AdvisorSeat {
  id: string;
  name: string;
  mandate: string;
  timeHorizon: string;
  professionalBoundary?: string;
}

export interface AdvisorCouncilManifest {
  version: "eos.advisor-council.v1";
  count: 15;
  founderFacingAgent: "executive_assistant";
  councilMode: "advisory_only";
  personalization: {
    founderName: string;
    portfolioName: string;
    companyName: string;
    founderVision: string;
    founderValues: string;
    decisionStyle: string;
    companyGoals: string;
  };
  advisors: AdvisorSeat[];
}

const advisorKeywords: Record<string, readonly string[]> = {
  capital: ["capital", "cash", "budget", "invest", "finance"], operations: ["operate", "delivery", "process", "execution", "workflow"],
  revenue: ["revenue", "sales", "pricing", "pipeline", "offer"], customer: ["customer", "client", "retention", "service"],
  brand: ["brand", "media", "content", "distribution", "reputation"], product: ["product", "technology", "software", "integration", "security"],
  people: ["people", "hire", "team", "culture", "role", "manager"], governance: ["risk", "authority", "approval", "governance", "control"],
  legal: ["legal", "contract", "entity", "compliance", "rights"], data: ["data", "metric", "evidence", "analytics", "measurement"],
  deals: ["deal", "partner", "acquisition", "merger", "negotiate"], resilience: ["failure", "resilience", "continuity", "incident", "recovery"],
};

export function selectAdvisorSeats(advisors: readonly AdvisorSeat[], request: string, limit = 3): AdvisorSeat[] {
  const normalized = request.toLowerCase();
  const scored = advisors.map((advisor, index) => ({ advisor, index, score: (advisorKeywords[advisor.id] || []).filter((keyword) => normalized.includes(keyword)).length }));
  const defaults = ["chief_portfolio_advisor", "strategy", "governance"];
  const defaultRank = (id: string) => { const rank = defaults.indexOf(id); return rank === -1 ? defaults.length + 1 : rank; };
  return scored.sort((a, b) => b.score - a.score || defaultRank(a.advisor.id) - defaultRank(b.advisor.id) || a.index - b.index).slice(0, Math.max(1, Math.min(limit, advisors.length))).map((item) => item.advisor);
}

const advisorSeatTemplates: AdvisorSeat[] = [
  { id: "chief_portfolio_advisor", name: "Chief Portfolio Advisor", mandate: "Synthesize the council, retain dissent, and connect recommendations to portfolio coherence.", timeHorizon: "quarters to decades" },
  { id: "strategy", name: "Strategy & Portfolio Architecture", mandate: "Test direction, sequencing, strategic fit, and the relationship among companies.", timeHorizon: "years" },
  { id: "capital", name: "Capital Allocation", mandate: "Compare uses of cash, attention, people, and risk capacity across the portfolio.", timeHorizon: "quarters to years" },
  { id: "operations", name: "Operating Systems", mandate: "Turn strategy into accountable operating loops, owners, cadence, and proof.", timeHorizon: "weeks to quarters" },
  { id: "revenue", name: "Revenue & Commercial", mandate: "Challenge offer, positioning, sales motion, pricing, pipeline, and unit economics.", timeHorizon: "days to quarters" },
  { id: "customer", name: "Customer & Stakeholder", mandate: "Represent customer truth, service quality, trust, retention, and stakeholder outcomes.", timeHorizon: "days to years" },
  { id: "brand", name: "Brand, Media & Distribution", mandate: "Align narrative, reputation, channels, owned audience, and distribution leverage.", timeHorizon: "weeks to years" },
  { id: "product", name: "Product & Technology", mandate: "Evaluate product architecture, technical leverage, integrations, security, and native replacement.", timeHorizon: "weeks to years" },
  { id: "people", name: "People, Talent & Culture", mandate: "Evaluate seats, hiring, development, incentives, succession, culture, and founder dependence.", timeHorizon: "months to years" },
  { id: "governance", name: "Governance, Risk & Controls", mandate: "Test authority, evidence, reversibility, separation of duties, and institutional risk.", timeHorizon: "immediate to permanent" },
  { id: "legal", name: "Legal & Entity Structure", mandate: "Surface entity, contract, regulatory, fiduciary, and rights questions for qualified counsel.", timeHorizon: "transaction to permanent", professionalBoundary: "Advisory preparation only; qualified counsel owns legal advice and sign-off." },
  { id: "finance", name: "Finance, Tax & Treasury", mandate: "Evaluate reporting, liquidity, tax questions, controls, capital structure, and downside resilience.", timeHorizon: "monthly to decades", professionalBoundary: "Advisory preparation only; qualified accounting, tax, and finance professionals own sign-off." },
  { id: "deals", name: "Deals, Partnerships & M&A", mandate: "Assess partnerships, acquisitions, integrations, negotiation posture, and strategic optionality.", timeHorizon: "quarters to years" },
  { id: "founder", name: "Founder Performance & Continuity", mandate: "Protect founder attention, decision quality, sustainability, learning, and continuity beyond one person.", timeHorizon: "daily to lifelong" },
  { id: "red_team", name: "Contrarian & Red Team", mandate: "Attack assumptions, expose blind spots, model failure, and preserve material dissent.", timeHorizon: "immediate to long-term" },
];

export function buildAdvisorCouncil(input: {
  founderName?: string | null;
  portfolioName?: string | null;
  companyName: string;
  founderProfile?: Record<string, unknown> | null;
  companyGoals?: string | null;
}): AdvisorCouncilManifest {
  const profile = input.founderProfile || {};
  return {
    version: "eos.advisor-council.v1",
    count: 15,
    founderFacingAgent: "executive_assistant",
    councilMode: "advisory_only",
    personalization: {
      founderName: input.founderName || "Founder",
      portfolioName: input.portfolioName || "Independent portfolio",
      companyName: input.companyName,
      founderVision: typeof profile.vision === "string" ? profile.vision : "",
      founderValues: typeof profile.values === "string" ? profile.values : "",
      decisionStyle: typeof profile.decisionStyle === "string" ? profile.decisionStyle : "",
      companyGoals: input.companyGoals || "",
    },
    advisors: advisorSeatTemplates.map((advisor) => ({ ...advisor })),
  };
}

export const workPacketTransitionSchema = z.object({
  status: z.enum(workPacketStatuses),
  reason: z.string().max(1000).optional(),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional(),
});
