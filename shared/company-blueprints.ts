export type CompanyBlueprintRole = {
  key: string;
  title: string;
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

export const companyBlueprints: readonly CompanyBlueprint[] = [
  {
    key: "service_studio",
    title: "Service studio / agency",
    description: "A lean client-acquisition and delivery company that can begin agent-first and grow into a hybrid team.",
    appliesTo: ["services"],
    roles: [
      { key: "company_ceo", title: "Company CEO", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Turn founder direction into an accountable company operating plan and escalate consequential decisions.", tools: commonExecutiveTools },
      { key: "growth", title: "Growth & Revenue", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Growth Agent", mandate: "Create qualified demand and move prospects through a measured commercial pipeline.", tools: ["CRM", "Calendar", "Messages", "Documents", "Analytics"] },
      { key: "client_delivery", title: "Client Delivery", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Delivery Agent", mandate: "Deliver the promised client outcome with evidence, quality controls, and clear handoffs.", tools: ["Projects", "Tasks", "Documents", "Messages", "Calendar"] },
      { key: "client_success", title: "Client Success", kind: "manager", supervisorKey: "client_delivery", agentName: "Client Success Agent", mandate: "Protect client communication, onboarding, retention, and outcome visibility.", tools: ["CRM", "Messages", "Documents", "Calendar"] },
    ],
    starters: [
      commercialStarter("growth", ["CRM", "Calendar", "Messages", "Documents", "Analytics"]),
      operatingStarter("client_delivery", ["Projects", "Tasks", "Documents", "Workflows"]),
    ],
  },
  {
    key: "software_company",
    title: "Software company",
    description: "A product-led company with accountable product, growth, customer, and operating roles.",
    appliesTo: ["saas"],
    roles: [
      { key: "company_ceo", title: "Company CEO", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Translate founder direction into company priorities, capital-aware tradeoffs, and operating accountability.", tools: commonExecutiveTools },
      { key: "product", title: "Product & Engineering", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Product Agent", mandate: "Own product learning, roadmap evidence, delivery quality, and technical operating choices.", tools: ["Projects", "Roadmap", "Documents", "Analytics", "Workflows"] },
      { key: "growth", title: "Growth & Revenue", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Growth Agent", mandate: "Create demand, operate the commercial funnel, and report repeatable revenue evidence.", tools: ["CRM", "Calendar", "Messages", "Analytics", "Campaigns"] },
      { key: "customer", title: "Customer Success", kind: "manager", supervisorKey: "company_ceo", agentName: "Customer Success Agent", mandate: "Protect onboarding, adoption, retention, and customer outcome feedback.", tools: ["CRM", "Messages", "Documents", "Analytics"] },
    ],
    starters: [
      commercialStarter("growth", ["CRM", "Messages", "Calendar", "Analytics"]),
      operatingStarter("product", ["Projects", "Documents", "Analytics", "Workflows"]),
    ],
  },
  {
    key: "product_company",
    title: "Product / commerce company",
    description: "A company with product, demand, customer, and operating loops that can later connect specialist commerce rails.",
    appliesTo: ["product"],
    roles: [
      { key: "company_ceo", title: "Company CEO", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Own company-level priorities, resource allocation, and exception decisions.", tools: commonExecutiveTools },
      { key: "brand_growth", title: "Brand & Growth", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Brand Growth Agent", mandate: "Create qualified demand and learn which customer messages and offers work.", tools: ["CRM", "Content Calendar", "Campaigns", "Analytics", "Documents"] },
      { key: "product_operations", title: "Product Operations", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Product Operations Agent", mandate: "Coordinate product availability, delivery quality, and operating readiness.", tools: ["Projects", "Tables", "Documents", "Workflows", "Analytics"] },
      { key: "customer", title: "Customer Care", kind: "manager", supervisorKey: "company_ceo", agentName: "Customer Care Agent", mandate: "Own customer communication, service recovery, and feedback visibility.", tools: ["CRM", "Messages", "Documents", "Forms"] },
    ],
    starters: [
      commercialStarter("brand_growth", ["CRM", "Content Calendar", "Campaigns", "Analytics"]),
      operatingStarter("product_operations", ["Projects", "Tables", "Documents", "Workflows"]),
    ],
  },
  {
    key: "hybrid_company",
    title: "Hybrid company",
    description: "A flexible starting graph for a company that combines multiple business models or is still finding its primary motion.",
    appliesTo: ["hybrid", "other"],
    roles: [
      { key: "company_ceo", title: "Company CEO", kind: "company_ceo", agentName: "Company CEO Agent", mandate: "Translate founder direction into a coherent company operating plan.", tools: commonExecutiveTools },
      { key: "growth", title: "Growth & Commercial", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Commercial Agent", mandate: "Build qualified pipeline and learn the repeatable value proposition.", tools: ["CRM", "Calendar", "Messages", "Analytics"] },
      { key: "operations", title: "Operations & Delivery", kind: "functional_executive", supervisorKey: "company_ceo", agentName: "Operations Agent", mandate: "Produce reliable delivery, workflow execution, and quality evidence.", tools: ["Projects", "Tasks", "Documents", "Workflows"] },
    ],
    starters: [
      commercialStarter("growth", ["CRM", "Calendar", "Messages", "Analytics"]),
      operatingStarter("operations", ["Projects", "Tasks", "Documents", "Workflows"]),
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

export type CompiledCompanyBlueprintStarter = CompanyBlueprintStarter & {
  statement: string;
  title: string;
  variables: Record<"offer" | "targetCustomer", string>;
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
      : `Operating foundation · ${goal}`,
    statement: starter.key === "commercial-foundation"
      ? `Validate and operate a measurable path for ${offer} with ${targetCustomer}. ${starter.statement}`
      : `${starter.statement} The first declared outcome is: ${goal}.`,
    variables: { offer, targetCustomer },
  }));
}
