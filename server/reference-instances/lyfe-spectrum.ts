import { buildPortfolioCompanyPackage } from "./portfolio-company-package";

export const LYFE_SPECTRUM_REFERENCE_PACKAGE = {
  key: "lyfe-spectrum-company-package",
  version: "2026-08-30",
  organizationKey: "ORG-LYFE-SPECTRUM",
  canonicalName: "Lyfe Spectrum",
} as const;

const runtime = "https://app.notion.com/p/3a8da8b96e4f81f592c0c5c67c083870";
const companyManifest = "https://app.notion.com/p/3c3da8b96e4f81a3873aea125b9be55f";
const organization = "https://app.notion.com/p/3c3da8b96e4f8107a4edcaa2694b637a";
const sampleControl = "https://app.notion.com/p/3c3da8b96e4f810ca12eecc6d5b6012f";
const qualitySystem = "https://app.notion.com/p/3c3da8b96e4f81bc82c4c5734ab6c894";
const institutionalHandoff = "https://app.notion.com/p/3c3da8b96e4f81d38200c76b38b2e788";

const activationGates = [
  "Bind current CLO3D sources, founder measurements, design-intent versions and three active garment briefs.",
  "Complete independent technical review of each tech pack, POM method, tolerance, construction, BOM and quality plan.",
  "Qualify the exact atelier, legal identity, facility, references, subcontractors, payee, source-file ownership and no-substitution terms.",
  "Qualify physical materials, trims, construction methods, shrinkage, recovery, opacity, wash, aging and wear-test requirements.",
  "Complete first-article inspection, fitting, corrective action and immutable sample-seal evidence for jacket, pant and cropped tee.",
  "Close all critical and major defects or record an explicit founder risk acceptance supported by independent technical authority.",
  "Establish approved cost, purchasing, chain-of-custody and milestone-payment controls before further external spend.",
  "Keep bulk, checkout, paid media, fulfillment and public launch dormant until a separate evidence-linked founder activation decision.",
];

const requiredCapability = (key: string, name: string, moduleIds: number[]) => ({
  key,
  name,
  moduleIds,
  state: "required" as const,
  activationGateRefs: activationGates,
});
const dormantCapability = (key: string, name: string, moduleIds: number[], gate: string) => ({
  key,
  name,
  moduleIds,
  state: "dormant" as const,
  activationGateRefs: [gate],
});

const built = buildPortfolioCompanyPackage({
  packageKey: LYFE_SPECTRUM_REFERENCE_PACKAGE.key,
  packageVersion: LYFE_SPECTRUM_REFERENCE_PACKAGE.version,
  organizationKey: LYFE_SPECTRUM_REFERENCE_PACKAGE.organizationKey,
  aliases: ["Lyfe Spectrum", "LYFE Spectrum", "LyfeSpectrum"],
  legalName: "Lyfe Spectrum",
  operatingName: "Lyfe Spectrum",
  ownerRole: "Maison Lead",
  effectiveAt: "2026-08-21T00:00:00.000Z",
  visibility: "private",
  mission: "Build a tactical-luxury maison whose product truth, craft, service and institutional controls make disciplined self-authored living materially visible.",
  offerKeys: ["field-uniform-001-jacket", "field-uniform-001-pant", "field-uniform-001-cropped-tee"],
  idealCustomerProfile: "Builders, protectors, creators and operators seeking refined objects that move between work, travel, training, public life and ritual without costume.",
  lifecycleStage: "sampling",
  requestedState: "dry_run",
  sources: [
    { key: "registry", sourceRef: "https://app.notion.com/p/3c3da8b96e4f819ba369c56b904ecfbd", pageClass: "registry" },
    { key: "runtime", sourceRef: runtime, pageClass: "runtime" },
    { key: "manifest", sourceRef: companyManifest, pageClass: "authority" },
    { key: "organization", sourceRef: organization, pageClass: "accountability_chart" },
    { key: "workflow", sourceRef: sampleControl, pageClass: "workflow" },
    { key: "quality", sourceRef: qualitySystem, pageClass: "authority" },
    { key: "handoff", sourceRef: institutionalHandoff, pageClass: "supporting" },
    { key: "scorecard", sourceRef: institutionalHandoff, pageClass: "scorecard", status: "supporting" },
  ],
  domainPacks: [
    { key: "fashion-apparel", sourceKey: "runtime" },
    { key: "craft-sampling-quality", sourceKey: "quality" },
    { key: "commerce-supply-chain", sourceKey: "handoff" },
  ],
  capabilities: [
    requiredCapability("company-creative-direction", "Company and Creative Direction", [1, 11]),
    requiredCapability("collection-product-architecture", "Collection and Product Architecture", [6, 11]),
    requiredCapability("clo3d-design-source-control", "CLO3D Design and Source Control", [6, 12]),
    requiredCapability("tech-pack-release-control", "Tech Pack Release and Acknowledgment", [6, 12]),
    requiredCapability("material-component-qualification", "Material, Trim and Component Qualification", [6, 12]),
    requiredCapability("atelier-vendor-qualification", "Atelier and Vendor Qualification", [5, 12]),
    requiredCapability("sample-build-intake-revision", "Sample Build, Intake, Fit and Revision", [6, 10]),
    requiredCapability("independent-technical-review", "Independent Technical Review", [8, 12]),
    requiredCapability("house-quality-sample-seal", "House Quality, Corrective Action and Sample Seal", [8, 12]),
    requiredCapability("purchasing-cash-control", "Purchasing, Cash and Milestone Control", [9]),
    requiredCapability("founder-wear-test-content", "Founder Wear-test and Build Documentation", [7, 14]),
    requiredCapability("organization-role-agents", "Organization, Role Agents and External Specialists", [4, 10]),
    requiredCapability("qualification-handoff-learning", "Qualification, Handoff and Versioned Learning", [11, 12]),
    dormantCapability("bulk-production", "Bulk Production and Change Control", [5, 6], "Three sealed samples, approved unit economics, qualified production capacity and explicit founder bulk authorization."),
    dormantCapability("shopify-commerce", "Shopify Commerce and Retention", [2, 3], "Separate commerce activation after sealed samples, seller/terms, store QA, service, analytics and cash controls."),
    dormantCapability("paid-growth-creator-fleet", "Paid Growth and Creator Fleet", [2, 7, 14], "Proven product, fulfillment capacity, approved claims and explicit campaign budget authority."),
    dormantCapability("inventory-fulfillment-service", "Inventory, Fulfillment, Returns and Service", [5, 10], "Approved bulk plan, inventory controls, support policy, repair/return path and qualified providers."),
    dormantCapability("international-market-compliance", "International Market and Product Compliance", [8, 13], "Country-specific labeling, safety, tax, privacy and consumer-law qualification."),
  ],
  activationGates,
  dependencies: ["Three controlled garment briefs", "Independent technical authority", "Qualified atelier", "Material and component evidence", "Approved spend and chain of custody", "Physical sample evidence"],
  rolloutSequence: ["Compile sampling-only company", "Bind active garment sources and briefs", "Issue controlled tech-pack Work Packets", "Qualify technical authority, atelier and materials", "Build, inspect, fit, wear-test and revise samples", "Seal or reject each sample", "Version house standards", "Consider later commerce activation separately"],
  stopLaws: [
    "Only the jacket, pant and short-sleeve cropped tee may advance through the active sampling lane.",
    "Do not authorize bulk, checkout, paid media, fulfillment or public launch from a mapped future capability.",
    "Agents may not invent measurements, accept deviations, release a tech pack, bind a vendor, approve spend or claim qualification.",
    "The maker may not be the sole technical approver and the founder may not substitute taste for missing conformance evidence.",
    "No false scarcity, unverified performance claim or hidden substitution is permitted.",
    "No customer or portfolio data moves between companies without explicit purpose, authority, consent and disclosure.",
  ],
  rollbackConditions: ["Source, tech-pack or material identity differs from the released package", "Atelier identity, subcontractor, payee or chain of custody is ambiguous", "A critical or major defect remains unresolved", "Independent technical conformance or founder design-intent approval fails", "External spend or production exceeds the authorized milestone"],
  seats: [
    { key: "founder", title: "Founder / Portfolio Principal", kind: "founder", reportsToSeatKey: null, agentName: "Executive Assistant", occupancyMode: "human_with_agent_assistant", mandate: "Retain portfolio authority and communicate with Lyfe Spectrum through its Maison leadership layer.", separationOfDutyRefs: ["Company and portfolio authority remain distinct"] },
    { key: "company-ceo", title: "Maison Lead", kind: "company_ceo", reportsToSeatKey: "founder", agentName: "Lyfe Spectrum CEO Agent", occupancyMode: "human_with_agent_assistant", mandate: "Own company coherence, priorities, capital, gate decisions and the company-agent hierarchy.", separationOfDutyRefs: ["Founder retains final sample, bulk, launch and capital authority"] },
    { key: "creative-director", title: "Creative Director", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Creative Director Agent", occupancyMode: "human_with_agent_assistant", mandate: "Own house world, collection integrity, design intent, silhouette and campaign direction; currently compressed into Antony.", separationOfDutyRefs: ["Cannot approve technical conformance alone"] },
    { key: "product-lead", title: "Product Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Product Lead Agent", occupancyMode: "human_with_agent_assistant", mandate: "Own fit, quality, vendor, cost, calendar, tech packs, BOMs and sample-control state; currently compressed into Antony with independent review required.", separationOfDutyRefs: ["Maker cannot self-approve", "Independent technical review required"] },
    { key: "commerce-growth", title: "Commerce / Growth Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Commerce and Growth Assistant", occupancyMode: "vacant", mandate: "Own Shopify, capture, launch, paid growth and analytics only after commerce activation.", separationOfDutyRefs: ["Dormant until separate activation"] },
    { key: "community-content", title: "Community / Content Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Community and Content Assistant", occupancyMode: "vacant", mandate: "Own editorial cadence, listening, seeding and rights when authorized.", separationOfDutyRefs: ["Publication remains human-controlled"] },
    { key: "operations-service", title: "Operations / Service Lead", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Operations and Service Assistant", occupancyMode: "vacant", mandate: "Own inventory, fulfillment, support, repairs and returns after production activation.", separationOfDutyRefs: ["Dormant before approved bulk and service readiness"] },
    { key: "finance-controls", title: "Finance / Controls", kind: "functional_executive", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Finance and Controls Agent", occupancyMode: "agent", mandate: "Prepare cash, settlement, margin, purchase and milestone evidence without autonomous spend authority.", separationOfDutyRefs: ["No autonomous spend or capital release"] },
    { key: "data-compliance", title: "Data / Compliance Steward", kind: "external", reportsToSeatKey: "company-ceo", agentName: "Lyfe Spectrum Data and Compliance Assistant", occupancyMode: "vacant", mandate: "Own consent, access, claims, privacy, labeling and evidence-integrity review when required.", separationOfDutyRefs: ["Qualified human review required for regulated decisions"] },
    { key: "technical-authority", title: "Independent Technical Authority", kind: "external", reportsToSeatKey: "product-lead", agentName: "Technical Review Evidence Assistant", occupancyMode: "vacant", mandate: "Independently approve pattern, fit, construction, materials, tolerances, test methods and sample conformance.", separationOfDutyRefs: ["Must be independent of the maker", "Required before sample seal"] },
  ],
  authorityPolicies: [
    { key: "spectrum-founder-owner", subjectSeatKey: "founder", authorityClasses: ["owner", "decide", "approve", "verify"], dataClasses: ["public", "internal", "confidential", "restricted"], transactionLimit: "Final sample seal, material substitution, vendor commitment, bulk, launch, publication and capital remain founder-controlled.", disclosureLimit: "Portfolio visibility does not transfer product, vendor, customer or design-file authority." },
    { key: "spectrum-maison-lead", subjectSeatKey: "company-ceo", authorityClasses: ["recommend", "decide", "approve", "execute", "verify"], dataClasses: ["public", "internal", "confidential", "restricted"], transactionLimit: "No bulk, commerce or scale effect before separate activation; technical conformance requires independent approval.", disclosureLimit: "Lyfe Spectrum company scope only; intercompany placement and services require explicit records." },
  ],
  workflows: [
    { key: "field-uniform-development", name: "Field Uniform 001 controlled development", stateMachineRef: "eos.lyfe-spectrum.garment-development.v1", workPacketKeys: ["bind-design-source-and-brief", "draft-tech-pack", "independent-tech-audit", "release-to-atelier", "build-and-intake-sample", "fit-wear-test-and-revise"], artifactRequirements: ["Immutable design source", "Garment brief", "Technical flats", "POM/spec/tolerance", "Construction and BOM", "Material requirements", "Audit record", "Atelier acknowledgment", "Sample evidence", "Revision decision"], evidenceRequirements: ["Exact garment and version", "Founder design-intent approval", "Independent technical review", "Material and maker identity", "Measurements and images", "Deviation and corrective-action record"], exceptionPath: "Stop release or sampling, preserve the exact package and physical evidence, issue a defect or clarification record and require a new controlled revision." },
    { key: "atelier-material-qualification", name: "Atelier and material qualification", stateMachineRef: "eos.lyfe-spectrum.atelier-material.v1", workPacketKeys: ["verify-atelier-identity", "qualify-facility-and-subcontractors", "qualify-materials-and-trims", "approve-quote-and-milestones", "verify-chain-of-custody"], artifactRequirements: ["Legal and facility identity", "References", "Subcontractor disclosure", "Payee verification", "Material/trim proofs", "Quote", "Milestone plan", "No-substitution terms", "Chain-of-custody record"], evidenceRequirements: ["Authoritative identity", "Physical proof", "Acknowledgment", "Payment authority", "Substitution and custody controls"], exceptionPath: "Do not pay or release controlled files; preserve the candidate record, discrepancy and decision, then qualify an alternative or resolve through explicit review." },
    { key: "sample-seal-qualification", name: "Maison sample seal qualification", stateMachineRef: "eos.lyfe-spectrum.sample-seal.v1", workPacketKeys: ["first-article-inspection", "fit-and-measurement-review", "construction-material-tests", "wash-aging-wear-test", "close-corrective-actions", "seal-or-reject-sample"], artifactRequirements: ["First-article inspection", "Measurement report", "Fit record", "Material and construction tests", "Wear-test", "Defect/deviation ledger", "Corrective-action closure", "Seal decision"], evidenceRequirements: ["Independent conformance approval", "Founder design-intent approval", "Zero unresolved critical defects", "Risk acceptance for any permitted major deviation", "Immutable physical and digital identity"], exceptionPath: "Reject or hold the sample, preserve every defect and revision, prohibit bulk or promotion and issue a bounded corrective-action packet." },
    { key: "future-commerce-activation", name: "Future commerce and scale activation", stateMachineRef: "eos.lyfe-spectrum.commerce-activation.v1", workPacketKeys: ["prove-sealed-sample-prerequisite", "qualify-commerce-service-and-cash-controls", "founder-commerce-go-no-go"], artifactRequirements: ["Three sealed samples", "Approved unit economics", "Seller and policy pack", "Store and analytics QA", "Fulfillment and service readiness", "Founder decision"], evidenceRequirements: ["Product truth", "Capacity", "Provider identity", "Customer remedy", "Cash controls", "Rollback rehearsal"], exceptionPath: "Keep commerce, bulk, paid media and fulfillment dormant and preserve the failed gate for later reconsideration." },
  ],
  providers: [
    ["notion", "Notion", "notion_public_oauth", "Canonical Lyfe Spectrum company, product, control and evidence architecture"],
    ["google-drive", "Google Drive", "google_workspace_oauth", "Governed brand, design, tech-pack and historical artifacts"],
    ["clo3d", "CLO3D", "file_exchange", "Founder workstation design sources and controlled exports"],
    ["adobe", "Adobe Creative Cloud", "file_exchange", "Illustration, image and technical-document source files"],
    ["atelier", "Development Atelier", "manual", "Exact qualified pattern, sample and manufacturing partner pending binding"],
    ["testing", "Independent Technical Testing", "manual", "Exact qualified technical authority and test resources pending binding"],
    ["shopify", "Shopify", "provider_oauth", "Dormant commerce store and lifecycle resources"],
    ["payments", "Payments", "provider_oauth", "Dormant exact seller, payment, refund and dispute resources"],
    ["fulfillment", "Fulfillment Provider", "provider_oauth", "Dormant inventory, shipping, repair and returns resources"],
  ].map(([key, provider, adapterClass, accountScope]) => ({ key, provider, adapterClass, accountScope, credentialReference: null, authorityState: "selected" as const, healthState: "unknown" as const, substitutionRule: "No provider, file, sample, material, payment, fulfillment or commerce state is inferred; physical and provider-authoritative evidence governs.", manualFallback: "Keep the action blocked, preserve the controlled packet locally and attach exact physical or provider evidence through the accountable human." })),
  metrics: [
    { key: "tech-pack-completeness", name: "Tech Pack Completeness", definition: "Required design, measurement, construction, BOM, material, quality and release fields complete and independently reviewed per active garment.", target: "100% before atelier release", guardrail: "A rendered garment or draft pack is not production-ready.", attributionRule: "Bind to exact garment, source version, reviewer, release and atelier acknowledgment.", decisionGate: "Any required gap blocks release." },
    { key: "sample-first-pass-yield", name: "Sample First-pass Yield", definition: "First samples meeting all critical and major acceptance criteria without corrective revision divided by first samples received.", target: "Establish baseline; zero unresolved critical defects.", guardrail: "Risk-accepted deviations remain visible and cannot be counted as clean passes.", attributionRule: "Use the exact first-article, defect and corrective-action records.", decisionGate: "Unresolved critical or unapproved major defects block seal." },
    { key: "sample-seal-cycle-time", name: "Sample Seal Cycle Time", definition: "Elapsed time and paid iterations from controlled tech-pack release to sealed or rejected sample.", target: "Measure by garment and failure class before setting target.", guardrail: "Speed cannot bypass material, fit, construction or wear evidence.", attributionRule: "Bind to package releases, physical receipts, fittings, revisions and decisions.", decisionGate: "Repeated delay or iteration failure triggers atelier or process review." },
    { key: "garment-unit-economics", name: "Garment Unit Economics", definition: "Expected net sales less product, freight, duties, payment, fulfillment, returns, service and allocated operating cost per garment.", target: "Approved before bulk or commerce activation.", guardrail: "Sampling cost, founder labor and returns assumptions remain explicit.", attributionRule: "Use exact quotes, invoices and labeled assumptions until observed economics exist.", decisionGate: "Unsupported or unsustainable economics block bulk." },
    { key: "supplier-conformance", name: "Supplier Conformance", definition: "Acknowledged packages and delivered samples conforming to identity, material, construction, timing, custody and evidence requirements.", target: "100% on critical identity and no-substitution controls.", guardrail: "A visually acceptable sample cannot cure an identity or custody failure.", attributionRule: "Use exact supplier, facility, package and receipt evidence.", decisionGate: "Identity, substitution or custody breach stops work and payment." },
  ],
  evidenceContracts: [
    { key: "garment-source-to-sample-lineage", dataClass: "restricted", authoritativeSource: "Controlled design source, tech-pack release, atelier acknowledgment and exact physical sample record.", retentionRule: "Preserve source, export, POM, BOM, material, release, acknowledgment, receipt, fit, defect, revision and seal history.", lineageRequirement: "Every physical sample resolves to one immutable garment package and identified maker/material chain.", qualificationRule: "Visual similarity or a file name alone cannot establish conformance.", promotionRule: "Promote versioned house standards without exposing restricted design or supplier information." },
    { key: "physical-product-truth", dataClass: "confidential", authoritativeSource: "Physical sample, independent measurements/tests, founder fit/wear review and corrective-action record.", retentionRule: "Preserve the minimum photos, measurements, tests, deviations and decisions needed to reproduce and audit the result.", lineageRequirement: "Claims about fit, material, construction, safety or quality trace to actual tested articles.", qualificationRule: "Digital render, supplier assertion or founder preference alone cannot seal a sample.", promotionRule: "Only verified product facts cleared for the target audience may enter content or commerce." },
    { key: "commercial-product-claim", dataClass: "internal", authoritativeSource: "Sealed product record, approved claims, exact production truth and provider-authoritative commerce evidence.", retentionRule: "Preserve product version, claim approval, inventory, order, service and remedy lineage.", lineageRequirement: "Every scarcity, material, performance, delivery and availability claim traces to actual constraints and state.", qualificationRule: "Sampling does not authorize sale, bulk, availability or performance claims.", promotionRule: "Promote only current claims supported by sealed and produced product truth." },
  ],
  failureRecovery: [
    { key: "package-sample-mismatch", failureClass: "The physical sample, material or construction does not match the acknowledged controlled package.", incidentOwnerSeatKey: "product-lead", fallback: "Quarantine the sample and stop payment, approval and downstream use where permitted.", recovery: "Document deviations, determine cause and custody, issue corrective action and require a controlled new sample or explicit rejection.", continuity: "Continue unaffected design and qualification work without representing the sample as approved.", learningPromotionRule: "Update release, acknowledgment, custody or inspection controls after verified root cause." },
    { key: "critical-quality-defect", failureClass: "A critical or unapproved major fit, material, construction, safety or durability defect is found.", incidentOwnerSeatKey: "product-lead", fallback: "Reject or hold the sample and prohibit seal or bulk.", recovery: "Record defect, owner, containment, correction, re-test and closure evidence.", continuity: "Keep other garment lanes isolated and explicitly state their status.", learningPromotionRule: "Promote a verified house standard or test after corrective-action closure." },
    { key: "vendor-identity-custody-failure", failureClass: "Atelier, facility, subcontractor, payee, material substitution or file/sample custody is ambiguous or unauthorized.", incidentOwnerSeatKey: "company-ceo", fallback: "Stop file release, payment and work immediately.", recovery: "Verify identity and custody, revoke access where needed, recover assets and qualify a replacement or renewed contract.", continuity: "Preserve local source files, packets and evidence independently of the vendor.", learningPromotionRule: "Strengthen vendor admission, no-substitution and custody requirements from verified evidence." },
    { key: "premature-commerce-effect", failureClass: "Bulk, checkout, paid media, fulfillment or public availability is activated before its evidence gate.", incidentOwnerSeatKey: "company-ceo", fallback: "Disable the external effect and stop new commitments.", recovery: "Reconcile affected customers/providers, preserve receipts, restore dormant state and complete founder review.", continuity: "Continue only authorized sampling and internal preparation.", learningPromotionRule: "Add a tested activation interlock after incident closure." },
  ],
  freshnessRule: "Latest explicit owner decision wins, followed by the Lyfe Spectrum root, canonical house doctrine, current craft operating system, readiness registries, execution evidence and labeled inference.",
  supersessionRule: "The three-piece Field Uniform 001 sampling scope supersedes broader active-capsule or launch language; historical and dormant designs remain visible but cannot authorize spend or external effect.",
  runtimeBindings: {
    processes: [
      { processKey: "field-uniform-development", name: "Field Uniform 001 controlled development", capabilityKey: "tech-pack-release-control", accountableSeatKey: "product-lead", workflowKey: "field-uniform-development", purpose: "Move each active garment from controlled source through an independently reviewed package and physical revision loop.", intendedOutcome: "A reproducible garment package and accepted or rejected physical sample with complete lineage.", triggerCondition: "An active garment source and founder-approved design brief are bound.", procedureSteps: ["Bind source and garment brief", "Draft complete tech pack", "Run independent technical audit", "Release immutable package to qualified atelier", "Intake and inspect sample", "Fit, wear-test, correct and decide next revision"], requiredInputs: ["CLO3D/design source", "Founder measurements", "Design brief", "House standards"], requiredOutputs: ["Controlled tech pack", "Audit", "Acknowledgment", "Sample and inspection", "Revision decision"], approvalGates: ["Founder design-intent lock", "Independent technical approval", "Atelier acknowledgment", "Founder revision decision"], prohibitedActions: ["Invent measurements", "Release draft pack", "Accept hidden substitution", "Self-approve conformance"], evidenceRequirements: ["Exact versions", "Independent review", "Material and maker identity", "Physical measurements/images", "Deviation record"], qualityCriteria: ["Reproducible", "Attributable", "House-correct", "Technically testable"], failurePaths: ["Stop release", "Quarantine sample", "Issue defect or clarification", "Create controlled revision"], terminalCriteria: ["Sample enters seal qualification, is rejected, or remains held with an explicit owner"], acceptanceTests: ["Wrong package identity is rejected", "Missing technical review blocks release", "Deviation remains visible across revision"], sourceRef: sampleControl },
      { processKey: "atelier-material-qualification", name: "Atelier and material qualification", capabilityKey: "atelier-vendor-qualification", accountableSeatKey: "product-lead", workflowKey: "atelier-material-qualification", purpose: "Qualify the exact development partner, material system, commercial terms and custody before controlled release or payment.", intendedOutcome: "An approved or rejected provider/material binding with no hidden identity or substitution.", triggerCondition: "A candidate atelier, technical specialist or material source is identified.", procedureSteps: ["Verify legal, facility and payee identity", "Review references, capabilities and subcontractors", "Test materials and components", "Approve bounded quote and milestones", "Bind no-substitution and custody controls"], requiredInputs: ["Candidate identity", "References", "Material proofs", "Quote", "Source-file terms"], requiredOutputs: ["Qualification record", "Material approval", "Milestone plan", "Custody terms"], approvalGates: ["Identity verification", "Technical fit", "Founder spend approval"], prohibitedActions: ["Pay ambiguous payee", "Release files before terms", "Accept unapproved subcontractor or material"], evidenceRequirements: ["Authoritative identity", "Physical proof", "Terms and acknowledgment", "Payment approval"], qualityCriteria: ["Transparent", "Bounded", "No-substitution", "Recoverable"], failurePaths: ["Stop release/payment", "Reject or clarify", "Qualify replacement"], terminalCriteria: ["Provider/material approved for bounded use or rejected"], acceptanceTests: ["Payee mismatch blocks payment", "Unapproved substitution fails"], sourceRef: runtime },
      { processKey: "sample-seal-qualification", name: "Maison sample seal qualification", capabilityKey: "house-quality-sample-seal", accountableSeatKey: "product-lead", workflowKey: "sample-seal-qualification", purpose: "Decide whether an exact physical sample meets design intent and independent technical conformance.", intendedOutcome: "A sealed or rejected sample with closed corrective actions and immutable evidence.", triggerCondition: "A controlled physical sample is received and its package identity is verified.", procedureSteps: ["Inspect first article", "Measure and fit", "Run material/construction/wash/wear tests", "Record defects and deviations", "Close corrective actions", "Obtain technical and founder approvals", "Seal or reject"], requiredInputs: ["Controlled sample", "Acknowledged tech pack", "House standards", "Test methods"], requiredOutputs: ["Inspection", "Test evidence", "Corrective actions", "Seal decision"], approvalGates: ["Independent technical conformance", "Founder design intent", "Risk acceptance if applicable"], prohibitedActions: ["Seal with unresolved critical defect", "Let maker self-approve", "Claim production readiness from appearance"], evidenceRequirements: ["Measurements", "Tests", "Images", "Defect ledger", "CAPA closure", "Dual approval"], qualityCriteria: ["Zero unresolved critical defect", "Traceable", "Reproducible", "Wear-tested"], failurePaths: ["Reject or hold", "Issue corrective action", "Re-sample under new version"], terminalCriteria: ["Sample sealed, rejected or explicitly held"], acceptanceTests: ["Critical defect blocks seal", "Missing independent approval blocks seal", "Physical identity mismatch fails"], sourceRef: qualitySystem },
    ],
    assets: [
      ["FIELD-UNIFORM-001-JACKET", "Field Uniform 001 Carpenter Jacket", "under_review"],
      ["FIELD-UNIFORM-001-PANT", "Field Uniform 001 Carpenter Pant", "under_review"],
      ["FIELD-UNIFORM-001-CROPPED-TEE", "Field Uniform 001 Short-sleeve Cropped Tee", "under_review"],
      ["FIELD-UNIFORM-FUTURE-TANK", "Deferred Tank Design", "proposed"],
      ["FIELD-UNIFORM-FUTURE-LONG-SLEEVE", "Deferred Waffle-knit Long-sleeve Design", "proposed"],
    ].map(([assetKey, name, lifecycleState]) => ({ assetKey, name, assetType: "intellectual_property" as const, lifecycleState: lifecycleState as "under_review" | "proposed", custodianSeatKey: "creative-director", ownerOrganizationKey: "ORG-LYFE-SPECTRUM", operatorOrganizationKey: "ORG-LYFE-SPECTRUM", dataClassification: "restricted" as const, rightsUsageLicense: "Lyfe Spectrum-controlled design, technical and product IP; release and external use require exact founder authority and package lineage.", replacementPortabilityNotes: "Source, package and physical-sample identity persist independently of any design, manufacturer or commerce provider.", sourceRef: runtime })),
    stakeholders: [
      { stakeholderKey: "ORG-LYFE-SPECTRUM", name: "Lyfe Spectrum", partyType: "organization", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-LYFE-SPECTRUM", relationshipRole: "maison and product owner" },
      { stakeholderKey: "ATELIER-CANDIDATE", name: "Qualified Development Atelier", partyType: "vendor_provider", state: "proposed", ownerSeatKey: "product-lead", identityReference: "eos-provider:lyfe-spectrum-atelier-pending", relationshipRole: "pattern, sample and future manufacturing candidate" },
      { stakeholderKey: "TECHNICAL-AUTHORITY-CANDIDATE", name: "Independent Technical Authority", partyType: "vendor_provider", state: "proposed", ownerSeatKey: "product-lead", identityReference: "eos-provider:lyfe-spectrum-technical-authority-pending", relationshipRole: "independent garment conformance reviewer" },
      { stakeholderKey: "ORG-EMPYREAN-STUDIOS", name: "Empyrean Creative LLC d/b/a Empyrean Studios", partyType: "vendor_provider", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-EMPYREAN-STUDIOS", relationshipRole: "incubator and shared-services provider" },
      { stakeholderKey: "ORG-AFM", name: "AFM", partyType: "collaborator", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-AFM", relationshipRole: "authorized founder wear-test and product-placement collaborator" },
    ],
    relationships: [
      { relationshipKey: "spectrum-atelier-qualification", stakeholderKey: "ATELIER-CANDIDATE", relationshipType: "vendor_provider", title: "Development atelier qualification", state: "proposed", ownerSeatKey: "product-lead", needConstraint: "Exact identity, facility, subcontractors, payee, capability, source-file rights, no-substitution and custody must pass before release or payment.", fitHypothesis: "A qualified intimate development partner can translate digital intent into reproducible physical product.", nextBestAction: "Complete bounded identity, reference, material and sample-capability qualification." },
      { relationshipKey: "spectrum-technical-review", stakeholderKey: "TECHNICAL-AUTHORITY-CANDIDATE", relationshipType: "vendor_provider", title: "Independent technical authority qualification", state: "proposed", ownerSeatKey: "product-lead", needConstraint: "Reviewer must be qualified and independent from the maker for conformance decisions.", fitHypothesis: "Independent review can prevent founder or maker bias from substituting for technical evidence.", nextBestAction: "Qualify and appoint the technical authority before pack release and sample seal." },
      { relationshipKey: "spectrum-empyrean-incubation", stakeholderKey: "ORG-EMPYREAN-STUDIOS", relationshipType: "vendor_provider", title: "Lyfe Spectrum incubation and shared services", state: "active", ownerSeatKey: "company-ceo", needConstraint: "Services and subsidization remain explicit and cannot transfer product, vendor or customer authority.", fitHypothesis: "Empyrean can support company formation and controlled operating capacity until spinout gates pass.", nextBestAction: "Use governed Work Packets for any shared service." },
      { relationshipKey: "spectrum-afm-placement", stakeholderKey: "ORG-AFM", relationshipType: "collaborator", title: "Founder wear-test and authentic product placement", state: "active", ownerSeatKey: "creative-director", needConstraint: "Only actual approved samples may appear; sampling does not imply public launch or availability.", fitHypothesis: "Authentic founder use can generate fit, wear and narrative evidence without premature selling.", nextBestAction: "Bind each placement to the exact sample, rights and truth label." },
    ],
  },
});

export const LYFE_SPECTRUM_COMPANY_PACKAGE = built.package;
export const LYFE_SPECTRUM_SOURCE_BINDINGS = built.sourceBindings;
export const compileLyfeSpectrumReferenceInstance = built.materialize;
