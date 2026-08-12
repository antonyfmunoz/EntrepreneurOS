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

export const membershipCreateSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  seatId: z.string().uuid(),
  purpose: z.string().min(1).max(100).default("operate"),
  classificationCeiling: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
}).refine((input) => Boolean(input.userId || input.email), { message: "A user id or verified account email is required." });

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
  founder: ["home", "command", "organization", "my-role", "commercial", "operations", "work-room", "review", "academy", "portfolio-map", "capital", "intelligence", "systems"],
  portfolio_executive: ["home", "command", "organization", "my-role", "operations", "work-room", "review", "academy", "portfolio-map", "capital", "intelligence", "systems"],
  company_ceo: ["home", "command", "organization", "my-role", "commercial", "operations", "work-room", "review", "academy", "capital", "intelligence", "systems"],
  functional_executive: ["home", "command", "organization", "my-role", "operations", "work-room", "review", "academy", "intelligence", "systems"],
  manager: ["home", "my-role", "operations", "work-room", "review", "academy", "intelligence"],
  individual_contributor: ["home", "my-role", "work-room", "academy", "intelligence"],
  external: ["home", "my-role", "work-room"],
};

export function allowedSurfacesFor(role: EosSeatKind): readonly string[] {
  return surfacePolicies[role];
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
