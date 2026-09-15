export type CompanyBlueprintRole = {
  key: string;
  title: string;
  kind: "company_ceo" | "functional_executive" | "manager" | "individual_contributor";
  supervisorKey?: string;
  agentName: string;
  mandate: string;
  tools: string[];
};

export type CompanyBlueprint = {
  key: string;
  title: string;
  description: string;
  appliesTo: string[];
  roles: readonly CompanyBlueprintRole[];
};

const commonExecutiveTools = ["Command", "Objectives", "Analytics", "Workflows", "Documents"];

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
  },
];

export function companyBlueprintForBusinessModel(businessModel?: string | null) {
  return companyBlueprints.find((blueprint) => blueprint.appliesTo.includes(businessModel || ""))
    || companyBlueprints.find((blueprint) => blueprint.key === "hybrid_company")!;
}
