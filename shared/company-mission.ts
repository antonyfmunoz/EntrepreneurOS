/**
 * The Company Mission Journey is the common first-run and reconciliation path
 * for every organization.  It deliberately does not branch into "new" versus
 * "existing" company wizards: both establish the same operating reality first.
 * Existing companies may reconcile provider data after this baseline exists.
 */
export const companyMissionKeys = [
  "portfolio_context",
  "company_identity",
  "business_model",
  "founder_charter",
  "strategic_outcomes",
  "operating_formation",
  "current_operating_reality",
  "systems_reconciliation",
] as const;

export type CompanyMissionKey = (typeof companyMissionKeys)[number];

export type CompanyMissionInput = {
  portfolioId?: string;
  companyName?: string;
  legalName?: string;
  assumedBusinessNames?: string[];
  stage?: string;
  industry?: string;
  businessModel?: string;
  offer?: string;
  targetCustomer?: string;
  assistantName?: string;
  founderVision?: string;
  founderValues?: string;
  decisionStyle?: string;
  workingStyle?: string;
  goals?: string;
  formation?: "agent_first" | "hybrid" | "existing_team";
  /**
   * A founder-entered description of the current operating team. It gives an
   * established company the same compiler input as a new company without
   * pretending that a provider import is its organization chart.
   */
  teamSnapshot?: string;
  /**
   * Optional names of systems that already hold company records. This is
   * inventory only, never a provider connection or a claim that EOS has
   * imported, reconciled, or activated anything from those systems.
   */
  existingSystems?: string[];
  /**
   * A deliberately bounded description of what is true today. This is shared
   * by a first-time founder and an established organization: empty fields are
   * useful signals for a governed discovery mission, not an invitation for the
   * compiler to invent operating facts.
   */
  currentRealityProvided?: boolean;
};

export type CompanyMissionDefinition = {
  key: CompanyMissionKey;
  title: string;
  purpose: string;
  prerequisite?: CompanyMissionKey;
  unlocks: string;
  isComplete: (input: CompanyMissionInput) => boolean;
};

const present = (value?: string) => Boolean(value?.trim());

export const companyMissionJourney: readonly CompanyMissionDefinition[] = [
  {
    key: "portfolio_context",
    title: "Place the company",
    purpose: "Choose the portfolio that holds this operating company.",
    unlocks: "Company identity and portfolio-level visibility.",
    isComplete: (input) => present(input.portfolioId),
  },
  {
    key: "company_identity",
    title: "Establish company identity",
    purpose: "Record the operating name and, where useful, the legal or assumed business names.",
    prerequisite: "portfolio_context",
    unlocks: "A named company context, public-facing surfaces, and governed records.",
    isComplete: (input) => present(input.companyName),
  },
  {
    key: "business_model",
    title: "Define the business model",
    purpose: "Describe how this company creates value before any system tries to automate it.",
    prerequisite: "company_identity",
    unlocks: "Relevant operating templates, tools, and initial workflows.",
    isComplete: (input) => present(input.stage) && present(input.businessModel) && present(input.offer) && present(input.targetCustomer),
  },
  {
    key: "founder_charter",
    title: "Set the founder charter",
    purpose: "Name the Executive Assistant and give it the vision and standards it must protect.",
    prerequisite: "business_model",
    unlocks: "Founder-to-EA coordination, advisor context, and decision framing.",
    isComplete: (input) => present(input.assistantName) && present(input.founderVision),
  },
  {
    key: "strategic_outcomes",
    title: "Name the near-term outcomes",
    purpose: "State what must become true next so EOS can create work, measures, and decisions around it.",
    prerequisite: "founder_charter",
    unlocks: "Objectives, scorecards, missions, and approval priorities.",
    isComplete: (input) => present(input.goals),
  },
  {
    key: "operating_formation",
    title: "Choose the operating formation",
    purpose: "Start agent-first, describe a hybrid team, or map the existing team. Human hires later occupy the same seats and direct their role agents.",
    prerequisite: "strategic_outcomes",
    unlocks: "Org Studio, role seats, role agents, and role-aware workspaces.",
    isComplete: (input) => Boolean(input.formation)
      && (input.formation === "agent_first" || present(input.teamSnapshot)),
  },
  {
    key: "current_operating_reality",
    title: "Map the current operating reality",
    purpose: "Record the assets, obligations, market, economics, constraints, and confidence EOS should use as its starting point. Unknowns remain visible and become governed discovery work.",
    prerequisite: "operating_formation",
    unlocks: "A source-bounded current-reality baseline, explicit assumptions, and discovery missions where evidence is incomplete.",
    isComplete: (input) => Boolean(input.currentRealityProvided),
  },
  {
    key: "systems_reconciliation",
    title: "Reconcile systems when useful",
    purpose: "Optionally name systems that already hold records, then connect and reconcile them only after the company model is established. Native EOS instruments remain available without them.",
    prerequisite: "current_operating_reality",
    unlocks: "Provider overlays, import plans, and controlled native cutover.",
    isComplete: () => true,
  },
];

export function companyMissionStatus(input: CompanyMissionInput) {
  return companyMissionJourney.map((mission) => ({
    ...mission,
    complete: mission.isComplete(input),
  }));
}

export function nextCompanyMission(input: CompanyMissionInput) {
  return companyMissionStatus(input).find((mission) => !mission.complete) ?? null;
}

export function parseAssumedBusinessNames(value: string) {
  return Array.from(new Set(value.split(",").map((name) => name.trim()).filter(Boolean)));
}
