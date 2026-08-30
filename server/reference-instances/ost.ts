import { buildPortfolioCompanyPackage } from "./portfolio-company-package";

export const OST_REFERENCE_PACKAGE = {
  key: "ost-company-package",
  version: "2026-08-30",
  organizationKey: "ORG-OST",
  canonicalName: "OST, Inc.",
} as const;

const runtime = "https://app.notion.com/p/3a8da8b96e4f819da6c0d4e7510fdb99";
const operatingMap = "https://app.notion.com/p/3c3da8b96e4f816291c5ed3a1858dceb";
const companyManifest = "https://app.notion.com/p/3c3da8b96e4f8181b6f8c82fe3d47aa0";
const softwareFactory = "https://app.notion.com/p/3c3da8b96e4f81088fd5f4619d5e2c21";
const organization = "https://app.notion.com/p/3c3da8b96e4f81719d05ddd3efe9b7f6";

const activationGates = [
  "Close UMH Wave 2 field qualification with owner acceptance and preserved EngineeringProof.",
  "Pass the real MetaIDE three-WorkPacket bootstrap trial without hidden reconstruction.",
  "Bind exact repositories, revisions, deployments, provider accounts, administrators and recovery owners.",
  "Verify IP assignment, open-source obligations, legal structure and licensing with qualified review.",
  "Qualify tenant isolation, privacy, security, incident response, rollback and continuity paths.",
  "Establish product-specific customer, support, economics and public-launch evidence before commercialization.",
];

const built = buildPortfolioCompanyPackage({
  packageKey: OST_REFERENCE_PACKAGE.key,
  packageVersion: OST_REFERENCE_PACKAGE.version,
  organizationKey: OST_REFERENCE_PACKAGE.organizationKey,
  aliases: ["OST", "OST, Inc.", "OST Inc", "Open Source Technology"],
  legalName: "OST, Inc.",
  operatingName: "OST, Inc.",
  ownerRole: "Founder / Chief Executive Officer",
  effectiveAt: "2026-08-21T00:00:00.000Z",
  visibility: "private",
  mission: "Build, own and operate reusable governed software that preserves reality, authority, work, evidence, outcomes and continuity without dependence on one model provider.",
  offerKeys: ["umh", "entrepreneuros", "creatoros", "lyfeos", "metaide"],
  idealCustomerProfile: "Portfolio companies first, followed only by explicitly qualified institutions and individuals that need governed operating software.",
  lifecycleStage: "private",
  requestedState: "dry_run",
  sources: [
    { key: "registry", sourceRef: "https://app.notion.com/p/3c3da8b96e4f81098a00e96925b9f88a", pageClass: "registry" },
    { key: "runtime", sourceRef: runtime, pageClass: "runtime" },
    { key: "operating-map", sourceRef: operatingMap, pageClass: "supporting" },
    { key: "manifest", sourceRef: companyManifest, pageClass: "authority" },
    { key: "organization", sourceRef: organization, pageClass: "accountability_chart" },
    { key: "workflow", sourceRef: softwareFactory, pageClass: "workflow" },
    { key: "scorecard", sourceRef: operatingMap, pageClass: "scorecard", status: "supporting" },
  ],
  domainPacks: [
    { key: "software-ai", sourceKey: "operating-map" },
    { key: "software-product-factory", sourceKey: "workflow" },
  ],
  capabilities: [
    ["product-portfolio-governance", "Product Portfolio Governance", [1, 11]],
    ["product-strategy-commercialization", "Product Strategy and Commercialization", [2, 3]],
    ["software-factory-sdlc", "Software Factory and SDLC", [6, 12]],
    ["release-engineering-proof", "Release, Deployment and EngineeringProof", [6, 12]],
    ["projection-manufacturing", "Projection Manufacturing", [6, 12]],
    ["customer-tenant-implementation", "Customer, Tenant and Implementation Lifecycle", [3, 10]],
    ["support-success-evidence", "Support, Success and Customer Evidence", [7, 10]],
    ["security-privacy-ai-governance", "Security, Privacy, Data and AI Governance", [8, 12]],
    ["runtime-reliability-continuity", "Runtime Reliability, Incident and Continuity", [5, 12]],
    ["provider-adapter-infrastructure", "Provider, Adapter and Infrastructure Control", [5, 6, 12]],
    ["finance-cost-capital-control", "Finance, Cost and Capital Control", [1, 9]],
    ["legal-ip-open-source", "Legal, IP, Licensing and Open-source Governance", [8, 13]],
    ["organization-agent-teams", "Organization and Company-scoped Agent Teams", [4, 10]],
    ["incubation-spinout-replication", "Incubation, Spinout and Replication", [1, 11]],
  ].map(([key, name, moduleIds]) => ({
    key: key as string,
    name: name as string,
    moduleIds: moduleIds as number[],
    state: "required" as const,
    activationGateRefs: activationGates,
  })),
  activationGates,
  dependencies: ["Exact Git and deployment identity", "Provider and administrator authority", "Security and privacy qualification", "IP and licensing evidence", "Field-trial evidence"],
  rolloutSequence: ["Compile isolated OST company", "Bind exact product and provider identities", "Close Wave 2 qualification", "Run MetaIDE bootstrap trial", "Qualify each product independently", "Authorize public or commercial state only by explicit founder decision"],
  stopLaws: [
    "Do not represent OST or any product as publicly launched without explicit release authority.",
    "Do not merge UMH, EOS, CreatorOS, LYFEOS or MetaIDE kernels, authority, data or release evidence.",
    "Do not treat documentation, a passing test, liveness or a deployment URL as complete EngineeringProof.",
    "Do not let Empyrean shared services create OST agent-parent edges or transfer OST IP authority.",
    "Do not mutate a product from a projection packet until exact sources, authority and acceptance criteria are qualified.",
  ],
  rollbackConditions: ["Release identity or runtime differs from the approved revision", "Tenant, data or authority isolation fails", "Provider scope or recovery ownership is ambiguous", "A product change cannot restore its prior qualified state"],
  seats: [
    { key: "founder", title: "Founder / Portfolio Principal", kind: "founder", reportsToSeatKey: null, agentName: "Executive Assistant", occupancyMode: "human_with_agent_assistant", mandate: "Retain portfolio authority and communicate with OST through its CEO layer.", separationOfDutyRefs: ["Company decisions remain company-scoped"] },
    { key: "company-ceo", title: "Founder / Chief Executive Officer", kind: "company_ceo", reportsToSeatKey: "founder", agentName: "OST CEO Agent", occupancyMode: "human_with_agent_assistant", mandate: "Own OST strategy, product portfolio, IP, releases, economics and company-agent hierarchy.", separationOfDutyRefs: ["Founder-reserved release, IP, capital and public-launch decisions"] },
    { key: "product-portfolio", title: "Product / Portfolio Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Product and Portfolio Agent", occupancyMode: "agent", mandate: "Maintain product boundaries, roadmaps, customer evidence and commercialization gates.", separationOfDutyRefs: ["Cannot authorize public launch"] },
    { key: "architecture-contracts", title: "Architecture & Contracts Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Architecture and Contracts Agent", occupancyMode: "agent", mandate: "Preserve kernel, protocol, projection, API and compatibility contracts across products.", separationOfDutyRefs: ["Consequential architecture requires founder review"] },
    { key: "engineering-metaide", title: "Engineering / MetaIDE Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Engineering and MetaIDE Agent", occupancyMode: "agent", mandate: "Run bounded engineering work through typed Work Packets, isolated sessions and exact source control.", separationOfDutyRefs: ["Cannot self-approve consequential releases"] },
    { key: "quality-release", title: "Quality, Evaluation & Release Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Quality Evaluation and Release Agent", occupancyMode: "agent", mandate: "Independently evaluate changes, release evidence, runtime observations and residue before qualification.", separationOfDutyRefs: ["Independent review remains distinct from implementation"] },
    { key: "security-governance", title: "Security, Privacy & Governance Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Security Privacy and Governance Agent", occupancyMode: "agent", mandate: "Own security, privacy, tenancy, authority, data and AI-governance controls.", separationOfDutyRefs: ["Risk acceptance remains founder-controlled"] },
    { key: "runtime-sre", title: "Runtime / SRE Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Runtime and SRE Agent", occupancyMode: "agent", mandate: "Operate availability, observability, incidents, recovery and continuity without confusing liveness with correctness.", separationOfDutyRefs: ["Production changes require release authority"] },
    { key: "product-operations", title: "Product Operations & Customer Evidence Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Product Operations and Customer Evidence Agent", occupancyMode: "agent", mandate: "Coordinate tenant implementation, support, feedback, evidence and product-learning disposition.", separationOfDutyRefs: ["Customer truth remains tenant-owned"] },
    { key: "finance-cost", title: "Finance / Cost Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "OST Finance and Cost Agent", occupancyMode: "agent", mandate: "Maintain provider cost, unit economics, budgets and capital decision evidence.", separationOfDutyRefs: ["No autonomous capital commitment"] },
    { key: "legal-ip", title: "Legal, IP & Open-source Diligence Lead", kind: "external", reportsToSeatKey: "company-ceo", agentName: "OST Legal IP and Open-source Diligence Agent", occupancyMode: "agent", mandate: "Prepare IP, license, dependency and formation diligence for qualified human or legal review.", separationOfDutyRefs: ["Agent output is not legal advice or legal approval"] },
  ],
  authorityPolicies: [
    { key: "ost-founder-owner", subjectSeatKey: "founder", authorityClasses: ["owner", "decide", "approve", "verify"], dataClasses: ["public", "internal", "confidential", "restricted"], transactionLimit: "No live provider, release, capital, IP or public commitment without exact authority and evidence.", disclosureLimit: "Portfolio visibility does not override product, tenant or customer boundaries." },
    { key: "ost-company-ceo", subjectSeatKey: "company-ceo", authorityClasses: ["recommend", "decide", "approve", "execute", "verify"], dataClasses: ["public", "internal", "confidential", "restricted"], transactionLimit: "Founder retains production release, capital, IP, security-risk and public-launch authority.", disclosureLimit: "OST company scope only; client and projection disclosures require explicit grants." },
  ],
  workflows: [
    { key: "ost-engineering-proof-chain", name: "OST EngineeringProof release chain", stateMachineRef: "eos.ost.engineering-proof.v1", workPacketKeys: ["define-engineering-objective", "authorize-change-packet", "execute-isolated-change", "independent-review", "release-and-deploy", "observe-and-seal-proof"], artifactRequirements: ["Engineering objective", "Typed Work Packet", "Exact source and revision", "ChangeSet", "Test and review receipts", "Release and deployment identity", "Runtime observation", "EngineeringProof"], evidenceRequirements: ["Clean mutation boundary", "Attributable command and test output", "Independent review", "Immutable release binding", "Runtime observation", "Recovery or residue result"], exceptionPath: "Stop release, preserve exact state and evidence, restore the last qualified revision where authorized, and create a reusable failure-class record." },
    { key: "ost-product-field-qualification", name: "OST product field qualification", stateMachineRef: "eos.ost.product-qualification.v1", workPacketKeys: ["bind-product-instance", "run-controlled-fixtures", "run-failure-recovery", "verify-tenant-boundary", "decide-product-state"], artifactRequirements: ["Product manifest", "Qualification plan", "Fixture results", "Failure and recovery evidence", "Tenant boundary proof", "Founder decision"], evidenceRequirements: ["Exact product revision", "Expected and actual results", "Restored state", "Provider and tenant identity", "Decision rationale"], exceptionPath: "Keep the product private and blocked, record the failed gate, restore safe state and assign one accountable remediation owner." },
  ],
  providers: [
    ["github", "GitHub", "provider_oauth", "Exact OST repositories and protected release workflows"],
    ["fly", "Fly.io", "api_key", "Exact OST application and deployment identities"],
    ["cloudflare", "Cloudflare", "api_key", "Exact edge, DNS, storage and security resources"],
    ["sentry", "Sentry", "api_key", "Exact projects, releases and runtime error evidence"],
    ["notion", "Notion", "notion_public_oauth", "Canonical OST operating specification"],
    ["google-drive", "Google Drive", "google_workspace_oauth", "Governed OST source and historical artifacts"],
    ["umh", "Universal Meta Harness", "signed_https", "Versioned command, event and projection federation"],
  ].map(([key, provider, adapterClass, accountScope]) => ({ key, provider, adapterClass, accountScope, credentialReference: null, authorityState: "selected" as const, healthState: "unknown" as const, substitutionRule: "No provider state or success is inferred; exact resource, grant, health, recovery and evidence must be reconciled.", manualFallback: "Keep product truth and Work Packets in EOS, block the external effect and attach provider evidence manually when available." })),
  metrics: [
    { key: "engineering-proof-completeness", name: "EngineeringProof Completeness", definition: "Qualified changes with exact source, tests, review, release, deployment and runtime evidence divided by qualified changes.", target: "100%", guardrail: "A passing test or live endpoint alone is not complete proof.", attributionRule: "Bind every result to exact immutable identities and attributable actors.", decisionGate: "Missing proof blocks qualification and promotion." },
    { key: "field-qualification-pass-rate", name: "Field Qualification Pass Rate", definition: "Controlled qualification scenarios passing expected behavior and restored-state checks divided by scenarios executed.", target: "100% for release-blocking scenarios", guardrail: "Skipped or unrun scenarios are not passes.", attributionRule: "Count only scenarios with expected result, actual result, evidence and restored state.", decisionGate: "Any release-blocking failure keeps the product private or blocked." },
    { key: "change-failure-recovery", name: "Change Failure and Recovery", definition: "Production changes causing incident plus time to verified restoration.", target: "Establish product-specific baseline; zero unresolved critical failures.", guardrail: "Recovery requires verified restored behavior, not process completion.", attributionRule: "Attribute to the exact release, deployment and incident chain.", decisionGate: "Repeated failure class requires a new admission or regression control." },
    { key: "product-cost-to-serve", name: "Product Cost to Serve", definition: "Attributable provider, support and operating cost per qualified tenant or active product instance.", target: "Measured before commercialization.", guardrail: "Shared costs and unavailable attribution remain labeled.", attributionRule: "Use provider-authoritative invoices and company allocation policy.", decisionGate: "No commercialization without sustainable bounded economics." },
  ],
  evidenceContracts: [
    { key: "software-truth", dataClass: "restricted", authoritativeSource: "Exact Git revisions, protected CI, immutable releases, deployments and runtime observations.", retentionRule: "Retain source, plan, change, review, release, deployment, incident and recovery lineage required for audit and rollback.", lineageRequirement: "Every qualified claim resolves to exact product, tenant, revision, actor and evidence.", qualificationRule: "Documentation, fixtures, tests, liveness and screenshots are individually insufficient for field qualification.", promotionRule: "Promote only anonymized reusable controls and failure learning without product secrets or tenant data." },
    { key: "tenant-product-separation", dataClass: "restricted", authoritativeSource: "Product-scoped and tenant-scoped canonical registries plus provider-authoritative identity.", retentionRule: "Preserve minimum tenant isolation, authority, disclosure and deletion evidence.", lineageRequirement: "A person, provider or shared capability never implies cross-tenant disclosure authority.", qualificationRule: "Any ambiguous tenant or product identity fails closed.", promotionRule: "Promote semantics and tests, never customer or company-private records." },
    { key: "ip-license-provenance", dataClass: "confidential", authoritativeSource: "Exact source repository, dependency inventory, license record, contributor authority and qualified legal review.", retentionRule: "Preserve license, attribution, assignment, provenance and supersession history.", lineageRequirement: "Every shipped dependency and copied implementation remains attributable to its allowed source and terms.", qualificationRule: "Unresolved ownership or license conflict blocks release or distribution.", promotionRule: "Only code and patterns cleared for the target license and disclosure class may move." },
  ],
  failureRecovery: [
    { key: "release-runtime-mismatch", failureClass: "Released revision, deployed identity or observed runtime differs from the approved EngineeringProof chain.", incidentOwnerSeatKey: "runtime-sre", fallback: "Freeze promotion and preserve the conflicting identities.", recovery: "Restore the last qualified release or complete a governed forward repair, then verify runtime behavior.", continuity: "Keep unaffected products and local operating records available.", learningPromotionRule: "Create a regression fixture and strengthen release identity checks." },
    { key: "tenant-authority-breach", failureClass: "Tenant, product, authority or disclosure isolation is breached or ambiguous.", incidentOwnerSeatKey: "security-governance", fallback: "Deny access and external effects immediately.", recovery: "Contain, investigate, revoke, restore boundaries and complete required notification and review.", continuity: "Operate only isolated unaffected scopes.", learningPromotionRule: "Promote a verified non-sensitive boundary control after incident closure." },
    { key: "provider-control-loss", failureClass: "A critical provider is unavailable, mis-scoped or lacks an accountable recovery owner.", incidentOwnerSeatKey: "runtime-sre", fallback: "Use the documented standalone-safe path and represent provider state as unavailable.", recovery: "Reauthorize or replace through a tested migration and parity plan.", continuity: "Preserve EOS work, approvals and evidence without claiming provider success.", learningPromotionRule: "Update provider admission, portability and recovery tests from verified evidence." },
  ],
  freshnessRule: "Latest explicit owner decision wins, followed by current OST Notion canon, exact Git and deployment evidence, provider observations and labeled inference.",
  supersessionRule: "A newer product or company decision must explicitly supersede the prior artifact; prose never overrides exact runtime or release evidence.",
  runtimeBindings: {
    processes: [
      { processKey: "ost-engineering-proof-chain", name: "OST EngineeringProof release chain", capabilityKey: "release-engineering-proof", accountableSeatKey: "quality-release", workflowKey: "ost-engineering-proof-chain", purpose: "Move an authorized software change from objective through verified runtime truth.", intendedOutcome: "A qualified or explicitly rejected change with complete immutable EngineeringProof.", triggerCondition: "An approved engineering objective and typed Work Packet identify exact product and source.", procedureSteps: ["Bind objective, authority and exact source", "Execute in an isolated session and worktree", "Run bounded tests and independent review", "Bind release and deployment identities", "Observe runtime and scan residue", "Seal EngineeringProof or record failure and recovery"], requiredInputs: ["Approved objective", "Typed Work Packet", "Exact source revision", "Acceptance and recovery criteria"], requiredOutputs: ["ChangeSet", "Test and review evidence", "Release/deployment binding", "Runtime observation", "EngineeringProof"], approvalGates: ["Change authority", "Independent review", "Production release approval"], prohibitedActions: ["Mutate an ambiguous source", "Self-approve consequential change", "Claim proof from liveness alone"], evidenceRequirements: ["Exact identities", "Command/test receipts", "Review", "Runtime observation", "Recovery state"], qualityCriteria: ["Deterministic", "Tenant-safe", "Recoverable", "Attributable"], failurePaths: ["Stop promotion", "Restore qualified state", "Record failure class"], terminalCriteria: ["Proof sealed or rejection recorded", "No unowned residue"], acceptanceTests: ["Wrong revision fails closed", "Missing review blocks release", "Rollback restores observed behavior"], sourceRef: softwareFactory },
      { processKey: "ost-product-field-qualification", name: "OST product field qualification", capabilityKey: "product-portfolio-governance", accountableSeatKey: "product-portfolio", workflowKey: "ost-product-field-qualification", purpose: "Qualify each OST product without merging its kernel or evidence with another product.", intendedOutcome: "An explicit private, blocked, qualified or release-ready product decision.", triggerCondition: "A versioned product instance and qualification plan are bound.", procedureSteps: ["Bind product and tenant identity", "Run controlled happy-path fixtures", "Run denial and failure scenarios", "Verify recovery and restored state", "Review evidence and decide product state"], requiredInputs: ["Product manifest", "Qualification plan", "Exact provider identities"], requiredOutputs: ["Scenario evidence", "Recovery evidence", "Decision record"], approvalGates: ["Qualification-plan approval", "Founder product-state decision"], prohibitedActions: ["Infer qualification from another product", "Use synthetic evidence as field proof"], evidenceRequirements: ["Expected and actual results", "Exact revision", "Restored state", "Decision rationale"], qualityCriteria: ["Product-isolated", "Tenant-isolated", "Repeatable", "Evidence-bearing"], failurePaths: ["Keep product private", "Assign remediation", "Restore safe state"], terminalCriteria: ["Product state decided with evidence"], acceptanceTests: ["Cross-product evidence is rejected", "Unrestored scenario cannot pass"], sourceRef: operatingMap },
    ],
    assets: [
      ["UMH", "Universal Meta Harness", "restricted"],
      ["EOS", "EntrepreneurOS", "internal"],
      ["CREATOROS", "CreatorOS", "internal"],
      ["LYFEOS", "LYFEOS", "restricted"],
      ["METAIDE", "MetaIDE", "restricted"],
    ].map(([assetKey, name, dataClassification]) => ({ assetKey, name, assetType: "intellectual_property" as const, lifecycleState: "active" as const, custodianSeatKey: "company-ceo", ownerOrganizationKey: "ORG-OST", operatorOrganizationKey: "ORG-OST", dataClassification: dataClassification as "internal" | "restricted", rightsUsageLicense: "OST-owned or controlled proprietary product IP; exact repository, contributor, dependency and license evidence governs use.", replacementPortabilityNotes: "Product identity and institutional truth persist independently of any one model, host or provider.", sourceRef: companyManifest })),
    stakeholders: [
      { stakeholderKey: "ORG-OST", name: "OST, Inc.", partyType: "organization", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-OST", relationshipRole: "software product owner and operator" },
      { stakeholderKey: "ORG-EMPYREAN-STUDIOS", name: "Empyrean Creative LLC d/b/a Empyrean Studios", partyType: "vendor_provider", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-EMPYREAN-STUDIOS", relationshipRole: "incubator and governed shared-service provider" },
    ],
    relationships: [{ relationshipKey: "ost-empyrean-incubation", stakeholderKey: "ORG-EMPYREAN-STUDIOS", relationshipType: "vendor_provider", title: "OST incubation and shared services", state: "active", ownerSeatKey: "company-ceo", needConstraint: "Services remain explicit and cannot transfer OST IP, tenant data or authority by implication.", fitHypothesis: "Empyrean can support OST until proof, economics, leadership and spinout gates pass.", nextBestAction: "Bind one governed service packet with provider and beneficiary attribution." }],
  },
});

export const OST_COMPANY_PACKAGE = built.package;
export const OST_SOURCE_BINDINGS = built.sourceBindings;
export const compileOstReferenceInstance = built.materialize;
