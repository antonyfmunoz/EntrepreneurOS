export type CompanyBlueprintRole = {
  key: string;
  title: string;
  department: string;
  kind: "company_ceo" | "functional_executive" | "manager" | "individual_contributor";
  supervisorKey?: string;
  agentName: string;
  mandate: string;
  tools: string[];
};

export type CompanyBlueprintStarter = {
  /** Stable template key, not a user-facing objective identifier. */
  key: string;
  title: string;
  statement: string;
  ownerRoleKey: string;
  priority: "critical" | "high" | "medium" | "low";
  tools: string[];
  workflowTemplateKey: string;
  successExitCriteria: string;
};

export type CompanyBlueprint = {
  key: string;
  title: string;
  description: string;
  appliesTo: string[];
  roles: readonly CompanyBlueprintRole[];
  starters: readonly CompanyBlueprintStarter[];
};

const commonExecutiveTools = ["Command", "Objectives", "Analytics", "Workflows", "Documents"];

/**
 * These departments are invariant to the particular business model. A company
 * may begin agent-operated and later place a human in either seat, but neither
 * finance nor legal/governance is treated as an optional afterthought.
 */
const universalCoreRoles: readonly CompanyBlueprintRole[] = [
  {
    key: "finance_capital",
    title: "Finance & Capital",
    department: "Finance",
    kind: "functional_executive",
    supervisorKey: "company_ceo",
    agentName: "Finance Agent",
    mandate: "Maintain governed financial sources, plans, obligations, and allocation evidence; escalate accounting, tax, money-movement, and capital decisions to the authorized human or qualified professional.",
    tools: ["Finance", "Sheets", "Analytics", "Documents", "Workflows"],
  },
  {
    key: "legal_governance",
    title: "Legal & Governance",
    department: "Legal & Governance",
    kind: "functional_executive",
    supervisorKey: "company_ceo",
    agentName: "Legal & Governance Agent",
    mandate: "Maintain company policy, contract, entity, risk, and decision records; prepare governed work while routing legal advice and sign-off to qualified counsel.",
    tools: ["Documents", "Workflows", "Conference Rooms", "Analytics"],
  },
  {
    key: "people_talent",
    title: "People, Talent & Culture",
    department: "People, Talent & Culture",
    kind: "functional_executive",
    supervisorKey: "company_ceo",
    agentName: "People & Talent Agent",
    mandate: "Maintain accountable capacity planning, recruiting, fair evidence-based assessment, onboarding, development, succession, and the human-to-agent assistant transition. Escalate employment, compensation, and other regulated people decisions to the authorized human or qualified professional.",
    tools: ["Forms", "Calendar", "Messages", "Documents", "Tables", "Workflows", "Analytics", "Learning", "Progression"],
  },
  {
    key: "operations_administration",
    title: "Operations, Administration & Vendor Control",
    department: "Operations, Administration & Vendor Control",
    kind: "functional_executive",
    supervisorKey: "company_ceo",
    agentName: "Operations & Vendor Agent",
    mandate: "Maintain governed operating requests, vendor relationships, access, assets, recurring work, and service continuity. Escalate spend, contracting, access grants, and irreversible vendor commitments to the authorized human.",
    tools: ["CRM", "Projects", "Tasks", "Tables", "Documents", "Workflows", "Finance", "Analytics", "Conference Rooms"],
  },
];

const commercialStarter = (ownerRoleKey: string, tools: string[]): CompanyBlueprintStarter => ({
  key: "commercial-foundation",
  title: "Establish the commercial foundation",
  statement: "Turn the declared offer and first buyer into a measurable, repeatable path from qualified demand to an approved commercial commitment.",
  ownerRoleKey,
  priority: "critical",
  tools,
  workflowTemplateKey: "lead-to-discovery",
  successExitCriteria: "A qualified buyer path, accountable commercial owner, and evidence-bearing next-step workflow are active.",
});

const operatingStarter = (ownerRoleKey: string, tools: string[]): CompanyBlueprintStarter => ({
  key: "operating-foundation",
  title: "Establish the operating foundation",
  statement: "Make the company’s first delivery or product loop accountable, evidence-bearing, and safe to improve before it scales.",
  ownerRoleKey,
  priority: "high",
  tools,
  workflowTemplateKey: "weekly-operating-review",
  successExitCriteria: "The accountable role, delivery or product loop, review cadence, and escalation path are recorded and ready for governed execution.",
});

/**
 * A business-in-a-box cannot stop at demand generation.  Every commercial
 * blueprint needs the same governed handoff from an authorized commitment to
 * accountable delivery, whether the company is a studio, product company, or
 * software company.  This is a native EOS process draft; it never asserts a
 * payment, signature, or external provider effect.
 */
const clientOnboardingStarter = (ownerRoleKey: string, tools: string[]): CompanyBlueprintStarter => ({
  key: "client-onboarding-foundation",
  title: "Establish the client onboarding foundation",
  statement: "Turn an authorized commercial commitment into a role-owned client launch with a clear outcome, requirements, project, and communication cadence.",
  ownerRoleKey,
  priority: "high",
  tools,
  workflowTemplateKey: "client-onboarding",
  successExitCriteria: "A governed onboarding path names the commercial authorization, accountable owner, launch requirements, delivery project, and client-facing next step.",
});

/**
 * The customer learning loop is intentionally compiled with the commercial
 * and delivery loops.  It gives a new company a native improvement path from
 * delivered value to feedback and accountable follow-through, instead of
 * treating reputation as an optional external tool added much later.
 */
const reputationStarter = (ownerRoleKey: string, tools: string[]): CompanyBlueprintStarter => ({
  key: "reputation-foundation",
  title: "Establish the feedback and improvement foundation",
  statement: "Create a consent-aware path to request customer feedback, preserve the evidence, and turn material feedback into accountable improvement work.",
  ownerRoleKey,
  priority: "medium",
  tools,
  workflowTemplateKey: "reputation-follow-through",
  successExitCriteria: "A consent-aware feedback path, evidence record, and owner for any customer-driven improvement are ready for governed use.",
});

/**
 * A first company should not have to invent its people system only after a
 * hiring emergency. This starter remains native and reversible: it creates a
 * role-owned capacity and candidate path, not an employment decision, offer,
 * compensation change, or external recruitment claim.
 */
const talentStarter = (ownerRoleKey: string, tools: string[]): CompanyBlueprintStarter => ({
  key: "talent-foundation",
  title: "Establish the people and talent foundation",
  statement: "Turn a verified capability gap into a fair, evidence-bearing candidate and placement path while preserving human judgment, candidate privacy, and the role-agent assistant model.",
  ownerRoleKey,
  priority: "medium",
  tools,
  workflowTemplateKey: "capability-to-placement",
  successExitCriteria: "An accountable talent owner, capability-need record, candidate-assessment path, onboarding boundary, and human decision gate are ready for governed use.",
});

/**
 * These universal control loops make the non-commercial parts of a company
 * operational from the same compilation event.  They create editable native
 * work and review boundaries, never an accounting conclusion, legal advice,
 * spend, contract, access grant, or third-party commitment.
 */
const financeStarter = (): CompanyBlueprintStarter => ({
  key: "finance-control-foundation",
  title: "Establish the finance control foundation",
  statement: "Create a governed cash, obligation, budget, and reconciliation review loop so operational decisions retain source limits and human financial authority.",
  ownerRoleKey: "finance_capital",
  priority: "high",
  tools: ["Finance", "Sheets", "Analytics", "Documents", "Workflows"],
  workflowTemplateKey: "finance-control-cycle",
  successExitCriteria: "A finance owner, source-of-truth boundary, review cadence, approval threshold, and reconciliation path are ready for governed use.",
});

const legalStarter = (): CompanyBlueprintStarter => ({
  key: "legal-governance-foundation",
  title: "Establish the legal and governance foundation",
  statement: "Make the company’s policy, obligation, contract, rights, and decision record reviewable before it makes commitments that require qualified counsel or authorized sign-off.",
  ownerRoleKey: "legal_governance",
  priority: "high",
  tools: ["Documents", "Workflows", "Conference Rooms", "Analytics"],
  workflowTemplateKey: "policy-obligation-control",
  successExitCriteria: "A governance owner, controlled source record, obligation review queue, escalation route, and authorized decision gate are ready for governed use.",
});

const vendorStarter = (): CompanyBlueprintStarter => ({
  key: "vendor-control-foundation",
  title: "Establish the vendor and service-control foundation",
  statement: "Create a traceable path from a vendor or service need to a bounded, reviewable relationship without assuming a purchase, contract, access grant, or provider effect.",
  ownerRoleKey: "operations_administration",
  priority: "medium",
  tools: ["CRM", "Projects", "Documents", "Workflows", "Finance", "Analytics"],
  workflowTemplateKey: "vendor-to-approved-service",
  successExitCriteria: "A vendor owner, relationship record, scope and risk review, approval boundary, continuity plan, and evidence requirements are ready for governed use.",
});

const offerEvolutionStarter = (ownerRoleKey: string, tools: string[]): CompanyBlueprintStarter => ({
  key: "offer-evolution-foundation",
  title: "Establish the offer learning foundation",
  statement: "Turn customer, delivery, and operating evidence into a governed proposal to evolve the offer or template—without silently changing the company’s reusable operating model.",
  ownerRoleKey,
  priority: "medium",
  tools,
  workflowTemplateKey: "offer-learning-loop",
  successExitCriteria: "An accountable owner, evidence-linked improvement proposal, version boundary, and authorized release path are ready for governed use.",
});

export const companyBlueprints: readonly CompanyBlueprint[] = [
  {
    key: "service_studio",
    title: "Service studio / agency",
    description: "A lean client-acquisition and delivery company that can begin agent-first and grow into a hybrid team.",
    appliesTo: ["services"],
    roles: [
      { key: "company_ceo", title: "Company CEO", department: "Executive", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Turn founder direction into an accountable company operating plan and escalate consequential decisions.", tools: commonExecutiveTools },
      { key: "growth", title: "Growth & Revenue", department: "Growth & Revenue", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Growth Agent", mandate: "Create qualified demand and move prospects through a measured commercial pipeline.", tools: ["CRM", "Dialer", "Calendar", "Messages", "Documents", "Forms", "Websites", "Projects", "Workflows", "Analytics"] },
      { key: "client_delivery", title: "Client Delivery", department: "Operations & Delivery", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Delivery Agent", mandate: "Deliver the promised client outcome with evidence, quality controls, and clear handoffs.", tools: ["Projects", "Tasks", "Documents", "Messages", "Calendar"] },
      { key: "client_success", title: "Client Success", department: "Client Success", kind: "manager", supervisorKey: "client_delivery", agentName: "Client Success Agent", mandate: "Protect client communication, onboarding, retention, and outcome visibility.", tools: ["CRM", "Messages", "Documents", "Calendar", "Projects", "Tasks", "Reputation"] },
      ...universalCoreRoles,
    ],
    starters: [
      commercialStarter("growth", ["CRM", "Dialer", "Calendar", "Messages", "Documents", "Forms", "Websites", "Analytics"]),
      operatingStarter("client_delivery", ["Projects", "Tasks", "Documents", "Workflows"]),
      clientOnboardingStarter("client_success", ["CRM", "Projects", "Tasks", "Calendar", "Messages", "Documents"]),
      reputationStarter("client_success", ["CRM", "Messages", "Reputation", "Projects", "Documents"]),
      talentStarter("people_talent", ["Forms", "Calendar", "Messages", "Documents", "Tables", "Workflows", "Analytics", "Learning", "Progression"]),
      financeStarter(),
      legalStarter(),
      vendorStarter(),
      offerEvolutionStarter("growth", ["CRM", "Projects", "Documents", "Analytics", "Workflows"]),
    ],
  },
  {
    key: "software_company",
    title: "Software company",
    description: "A product-led company with accountable product, growth, customer, and operating roles.",
    appliesTo: ["saas"],
    roles: [
      { key: "company_ceo", title: "Company CEO", department: "Executive", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Translate founder direction into company priorities, capital-aware tradeoffs, and operating accountability.", tools: commonExecutiveTools },
      { key: "product", title: "Product & Engineering", department: "Product & Engineering", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Product Agent", mandate: "Own product learning, roadmap evidence, delivery quality, and technical operating choices.", tools: ["Projects", "Roadmap", "Documents", "Analytics", "Workflows"] },
      { key: "growth", title: "Growth & Revenue", department: "Growth & Revenue", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Growth Agent", mandate: "Create demand, operate the commercial funnel, and report repeatable revenue evidence.", tools: ["CRM", "Dialer", "Calendar", "Messages", "Forms", "Websites", "Analytics", "Campaigns"] },
      { key: "customer", title: "Customer Success", department: "Client Success", kind: "manager", supervisorKey: "company_ceo", agentName: "Customer Success Agent", mandate: "Protect onboarding, adoption, retention, and customer outcome feedback.", tools: ["CRM", "Messages", "Documents", "Analytics", "Projects", "Calendar", "Reputation"] },
      ...universalCoreRoles,
    ],
    starters: [
      commercialStarter("growth", ["CRM", "Dialer", "Messages", "Calendar", "Forms", "Websites", "Analytics"]),
      operatingStarter("product", ["Projects", "Documents", "Analytics", "Workflows"]),
      clientOnboardingStarter("customer", ["CRM", "Projects", "Calendar", "Messages", "Documents"]),
      reputationStarter("customer", ["CRM", "Messages", "Reputation", "Projects", "Documents"]),
      talentStarter("people_talent", ["Forms", "Calendar", "Messages", "Documents", "Tables", "Workflows", "Analytics", "Learning", "Progression"]),
      financeStarter(),
      legalStarter(),
      vendorStarter(),
      offerEvolutionStarter("product", ["Projects", "Documents", "Analytics", "Workflows"]),
    ],
  },
  {
    key: "product_company",
    title: "Product / commerce company",
    description: "A company with product, demand, customer, and operating loops that can later connect specialist commerce rails.",
    appliesTo: ["product"],
    roles: [
      { key: "company_ceo", title: "Company CEO", department: "Executive", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Own company-level priorities, resource allocation, and exception decisions.", tools: commonExecutiveTools },
      { key: "brand_growth", title: "Brand & Growth", department: "Growth & Revenue", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Brand Growth Agent", mandate: "Create qualified demand and learn which customer messages and offers work.", tools: ["CRM", "Dialer", "Content Calendar", "Campaigns", "Forms", "Websites", "Analytics", "Documents"] },
      { key: "product_operations", title: "Product Operations", department: "Operations", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Product Operations Agent", mandate: "Coordinate product availability, delivery quality, and operating readiness.", tools: ["Projects", "Tables", "Documents", "Workflows", "Analytics"] },
      { key: "customer", title: "Customer Care", department: "Client Success", kind: "manager", supervisorKey: "company_ceo", agentName: "Customer Care Agent", mandate: "Own customer communication, service recovery, and feedback visibility.", tools: ["CRM", "Messages", "Documents", "Forms", "Projects", "Calendar", "Reputation"] },
      ...universalCoreRoles,
    ],
    starters: [
      commercialStarter("brand_growth", ["CRM", "Dialer", "Content Calendar", "Campaigns", "Forms", "Websites", "Analytics"]),
      operatingStarter("product_operations", ["Projects", "Tables", "Documents", "Workflows"]),
      clientOnboardingStarter("customer", ["CRM", "Projects", "Calendar", "Messages", "Documents"]),
      reputationStarter("customer", ["CRM", "Messages", "Reputation", "Projects", "Documents"]),
      talentStarter("people_talent", ["Forms", "Calendar", "Messages", "Documents", "Tables", "Workflows", "Analytics", "Learning", "Progression"]),
      financeStarter(),
      legalStarter(),
      vendorStarter(),
      offerEvolutionStarter("product_operations", ["Projects", "Tables", "Documents", "Analytics", "Workflows"]),
    ],
  },
  {
    key: "hybrid_company",
    title: "Hybrid company",
    description: "A flexible starting graph for a company that combines multiple business models or is still finding its primary motion.",
    appliesTo: ["hybrid", "other"],
    roles: [
      { key: "company_ceo", title: "Company CEO", department: "Executive", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Translate founder direction into a coherent company operating plan.", tools: commonExecutiveTools },
      { key: "growth", title: "Growth & Commercial", department: "Growth & Revenue", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Commercial Agent", mandate: "Build qualified pipeline and learn the repeatable value proposition.", tools: ["CRM", "Dialer", "Calendar", "Messages", "Forms", "Websites", "Projects", "Documents", "Workflows", "Analytics"] },
      { key: "operations", title: "Operations & Delivery", department: "Operations & Delivery", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Operations Agent", mandate: "Produce reliable delivery, workflow execution, and quality evidence.", tools: ["Projects", "Tasks", "Documents", "Workflows", "CRM", "Calendar", "Messages", "Reputation"] },
      ...universalCoreRoles,
    ],
    starters: [
      commercialStarter("growth", ["CRM", "Dialer", "Calendar", "Messages", "Forms", "Websites", "Analytics"]),
      operatingStarter("operations", ["Projects", "Tasks", "Documents", "Workflows"]),
      clientOnboardingStarter("operations", ["CRM", "Projects", "Tasks", "Calendar", "Messages", "Documents"]),
      reputationStarter("operations", ["CRM", "Messages", "Reputation", "Projects", "Documents"]),
      talentStarter("people_talent", ["Forms", "Calendar", "Messages", "Documents", "Tables", "Workflows", "Analytics", "Learning", "Progression"]),
      financeStarter(),
      legalStarter(),
      vendorStarter(),
      offerEvolutionStarter("growth", ["CRM", "Projects", "Documents", "Analytics", "Workflows"]),
    ],
  },
];

export function companyBlueprintForBusinessModel(businessModel?: string | null) {
  return companyBlueprints.find((blueprint) => blueprint.appliesTo.includes(businessModel || ""))
    || companyBlueprints.find((blueprint) => blueprint.key === "hybrid_company")!;
}

export type CompanyBlueprintVariables = {
  offer?: string | null;
  targetCustomer?: string | null;
  goals?: string | null;
};

/**
 * A company's starting formation changes the operating transition, not the
 * underlying institutional roles.  The same Finance, Legal, CEO, commercial,
 * and delivery seats exist whether a founder begins alone or imports an
 * established team.  What changes is who initially operates those seats and
 * what EOS must reconcile before anyone is invited or given authority.
 */
export type CompanyOperatingFormation = "agent_first" | "hybrid" | "existing_team";

export type CompiledOperatingFormation = {
  version: "company-operating-formation-v1";
  formation: CompanyOperatingFormation;
  title: string;
  summary: string;
  agentSeatMode: "autonomous" | "assistant_after_human_assignment";
  teamReconciliation: "not_required" | "required";
  transitionState: "agent_operated" | "team_mapping_required";
  nextAction: string;
  humanAssignmentRule: string;
  teamSnapshot: string;
};

export function compiledOperatingFormation(input: {
  formation?: string | null;
  teamSnapshot?: string | null;
}): CompiledOperatingFormation {
  const formation: CompanyOperatingFormation = input.formation === "hybrid"
    || input.formation === "existing_team"
    ? input.formation
    : "agent_first";
  const teamSnapshot = input.teamSnapshot?.trim() || "";
  if (formation === "agent_first") {
    return {
      version: "company-operating-formation-v1",
      formation,
      title: "Agent-first operating formation",
      summary: "EOS starts each accountable role as an autonomous role agent while the founder retains authority and review control.",
      agentSeatMode: "autonomous",
      teamReconciliation: "not_required",
      transitionState: "agent_operated",
      nextAction: "Use the compiled role graph and native tools to run the first operating loop. Add a person only when that seat needs human judgment or capacity.",
      humanAssignmentRule: "When a person is assigned to an existing seat, the role agent remains in that seat and changes to their assistant. The institutional role, authority boundary, queue, and evidence remain intact.",
      teamSnapshot,
    };
  }
  const existingTeam = formation === "existing_team";
  return {
    version: "company-operating-formation-v1",
    formation,
    title: existingTeam ? "Established-team operating formation" : "Hybrid operating formation",
    summary: existingTeam
      ? "EOS keeps the company’s existing people and reporting reality as a governed transition plan, then maps people into the stable native role graph."
      : "EOS begins with people and role agents sharing the work, while each human assignment preserves the role agent as that person’s assistant.",
    agentSeatMode: "assistant_after_human_assignment",
    teamReconciliation: "required",
    transitionState: "team_mapping_required",
    nextAction: "Review the declared team in Org Studio, map each real person to one unoccupied EOS seat, then explicitly invite only the people who should receive access.",
    humanAssignmentRule: "A roster entry is planning data only. EOS never grants access from an imported team list; after an explicit seat assignment, the role agent changes to assistant mode for that human occupant.",
    teamSnapshot,
  };
}

export type CompiledCompanyBlueprintStarter = CompanyBlueprintStarter & {
  statement: string;
  title: string;
  variables: Record<"offer" | "targetCustomer" | "goal", string>;
};

function firstGoal(value?: string | null) {
  return (value || "")
    .split(/\r?\n|[•;]/)
    .map((item) => item.replace(/^[\s\-–—\d.)]+/, "").trim())
    .find(Boolean) || "the declared near-term outcome";
}

/**
 * Variables are the founder's fill-in-the-blank context.  This is the point
 * at which a reusable business template becomes that company's editable
 * starter artifacts; it is intentionally not a second onboarding path.
 */
export function compileCompanyBlueprintStarters(
  blueprint: CompanyBlueprint,
  variables: CompanyBlueprintVariables,
): readonly CompiledCompanyBlueprintStarter[] {
  const offer = variables.offer?.trim() || "the declared offer";
  const targetCustomer = variables.targetCustomer?.trim() || "the declared first buyer";
  const goal = firstGoal(variables.goals);
  return blueprint.starters.map((starter) => ({
    ...starter,
    title: starter.key === "commercial-foundation"
      ? `Commercial foundation · ${offer}`
      : starter.key === "operating-foundation"
        ? `Operating foundation · ${goal}`
        : starter.key === "client-onboarding-foundation"
          ? `Client onboarding foundation · ${offer}`
          : starter.key === "talent-foundation"
            ? `People and talent foundation · ${goal}`
          : `Feedback and improvement foundation · ${offer}`,
    statement: starter.key === "commercial-foundation"
      ? `Validate and operate a measurable path for ${offer} with ${targetCustomer}. ${starter.statement}`
      : starter.key === "operating-foundation"
        ? `${starter.statement} The first declared outcome is: ${goal}.`
        : starter.key === "client-onboarding-foundation"
          ? `${starter.statement} This applies ${offer} to ${targetCustomer} without implying that commercial authorization already exists.`
          : starter.key === "talent-foundation"
            ? `${starter.statement} This prepares the people system for ${goal}; it does not imply an employment, compensation, or access decision.`
          : `${starter.statement} This applies to ${targetCustomer} receiving ${offer}; feedback consent and evidence remain required.`,
    variables: { offer, targetCustomer, goal },
  }));
}
