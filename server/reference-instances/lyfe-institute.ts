import { buildPortfolioCompanyPackage } from "./portfolio-company-package";

export const LYFE_INSTITUTE_REFERENCE_PACKAGE = {
  key: "lyfe-institute-company-package",
  version: "2026-08-30",
  organizationKey: "ORG-LYFE-INSTITUTE",
  canonicalName: "Lyfe Institute",
} as const;

const runtime = "https://app.notion.com/p/32eda8b96e4f817fa314fc66aa831cc3";
const operatingMap = "https://app.notion.com/p/3c3da8b96e4f81c786b8e22e5382e77f";
const companyManifest = "https://app.notion.com/p/3c3da8b96e4f81e3bd55d322babfa97f";
const offerDossier = "https://app.notion.com/p/3c3da8b96e4f81158a19d14c19610f8e";
const safetySystem = "https://app.notion.com/p/3c3da8b96e4f81efaf92e53e28c084d2";
const activationProgram = "https://app.notion.com/p/3c3da8b96e4f814ab1f5e754b33089ed";
const organization = "https://app.notion.com/p/3c3da8b96e4f8103b1c0c6d23aa38d80";

const activationGates = [
  "Name and qualify the Curriculum Approver, Lead Facilitator, Safeguarding Owner, Privacy Owner and Evidence Owner.",
  "Approve seller identity, participant terms, refunds, complaints, accessibility and consumer-law posture with qualified review.",
  "Approve privacy, consent, minimization, retention, deletion, export and private-life data firewall controls.",
  "Approve safeguarding, facilitator supervision, escalation, referral, incident and emergency-limitation procedures.",
  "Approve the claims and language register and prohibit clinical, income and permanent-transformation claims.",
  "Approve twelve session plans, participant missions, facilitator checklists and evidence instruments.",
  "Complete the cohort capacity, COGS, refund reserve and sustainable economics model.",
  "Pass the complete enrollment, consent, payment, delivery, support, early-exit, refund and incident rehearsal.",
  "Record an evidence-linked founder go or no-go decision before enrollment opens.",
];

const built = buildPortfolioCompanyPackage({
  packageKey: LYFE_INSTITUTE_REFERENCE_PACKAGE.key,
  packageVersion: LYFE_INSTITUTE_REFERENCE_PACKAGE.version,
  organizationKey: LYFE_INSTITUTE_REFERENCE_PACKAGE.organizationKey,
  aliases: ["Lyfe Institute", "The Lyfe Institute", "Lyfe Institute — Operating Company OS"],
  legalName: "Lyfe Institute",
  operatingName: "Lyfe Institute",
  ownerRole: "Founder / Venture Owner",
  effectiveAt: "2026-08-21T00:00:00.000Z",
  visibility: "private",
  mission: "Design and deliver ethical, evidence-disciplined education that helps participants build direction, routines, practical capability, agency and durable self-directed progress.",
  offerKeys: ["initiate-arena-reboot-founding-cohort"],
  idealCustomerProfile: "A controlled pilot hypothesis of ambitious but drifting men approximately 18–25 seeking direction, routines, disciplined execution and practical momentum, subject to fit, consent and safeguarding gates.",
  lifecycleStage: "validation",
  requestedState: "blocked",
  sources: [
    { key: "registry", sourceRef: "https://app.notion.com/p/3c3da8b96e4f8134bf9ec081b1f951ee", pageClass: "registry" },
    { key: "runtime", sourceRef: runtime, pageClass: "runtime" },
    { key: "operating-map", sourceRef: operatingMap, pageClass: "supporting" },
    { key: "manifest", sourceRef: companyManifest, pageClass: "authority" },
    { key: "offer", sourceRef: offerDossier, pageClass: "supporting" },
    { key: "organization", sourceRef: organization, pageClass: "accountability_chart" },
    { key: "workflow", sourceRef: activationProgram, pageClass: "workflow" },
    { key: "safety", sourceRef: safetySystem, pageClass: "authority" },
    { key: "scorecard", sourceRef: operatingMap, pageClass: "scorecard", status: "supporting" },
  ],
  domainPacks: [
    { key: "education-community", sourceKey: "operating-map" },
    { key: "cohort-program-delivery", sourceKey: "offer" },
    { key: "safeguarding-participant-evidence", sourceKey: "safety" },
  ],
  capabilities: [
    ["company-program-governance", "Company and Program Governance", [1, 4]],
    ["offer-canon-claims", "Offer Canon and Claims Control", [2, 13]],
    ["ethical-sales-qualification", "Ethical Sales and Participant Qualification", [2, 3]],
    ["curriculum-architecture", "Curriculum Architecture and Revision", [6, 11]],
    ["cohort-delivery-facilitation", "Cohort Delivery and Facilitation", [6, 10]],
    ["safeguarding-incident-referral", "Safeguarding, Incident and Referral", [8, 13]],
    ["privacy-consent-data-firewall", "Privacy, Consent and Private-life Data Firewall", [8, 12]],
    ["participant-journey-enrollment", "Participant Journey and Enrollment", [3, 10]],
    ["community-support-moderation", "Community, Support and Moderation", [7, 10]],
    ["evidence-outcomes-alumni", "Evidence, Outcomes and Alumni Follow-up", [7, 11]],
    ["economics-capacity-refunds", "Economics, Capacity and Refund Control", [9]],
    ["provider-program-operations", "Provider and Program Operations", [5, 12]],
    ["spinout-replication", "Incubation, Spinout and Replication", [1, 11]],
  ].map(([key, name, moduleIds]) => ({ key: key as string, name: name as string, moduleIds: moduleIds as number[], state: "required" as const, activationGateRefs: activationGates })),
  activationGates,
  dependencies: ["Named qualified human owners", "Approved offer and policy pack", "Twelve-week curriculum", "Minimum necessary provider configuration", "Participant-journey rehearsal", "Founder release decision"],
  rolloutSequence: ["Compile the dormant pre-pilot company", "Establish truth and source authority", "Close governance, safety and economics gates", "Productize curriculum and evidence", "Rehearse the full participant journey", "Qualify a bounded 8–12 person cohort", "Operate and decide repeat, revise, pause or stop"],
  stopLaws: [
    "Enrollment remains closed until every critical activation gate has an attributable approval and evidence.",
    "No agent may impersonate an occupied human seat or make clinical, legal, safeguarding or risk-acceptance judgments.",
    "Do not collect invasive private-life data merely because it could be useful.",
    "Do not move LYFEOS private-life data into EOS employment, performance, compensation or opportunity decisions.",
    "Do not make diagnosis, treatment, guaranteed-income, permanent-transformation or human-worth claims.",
    "Do not exceed qualified cohort capacity or infer participant outcomes from activity or completion alone.",
  ],
  rollbackConditions: ["Safeguarding, privacy, consent or claims control fails", "Participant identity, eligibility or authority is ambiguous", "Facilitation or support capacity falls below the approved bound", "Provider behavior differs from the rehearsed participant journey", "Adverse evidence invalidates the pilot hypothesis"],
  seats: [
    { key: "founder", title: "Founder / Portfolio Principal", kind: "founder", reportsToSeatKey: null, agentName: "Executive Assistant", occupancyMode: "human_with_agent_assistant", mandate: "Retain portfolio authority and communicate with the Institute through its company CEO layer.", separationOfDutyRefs: ["Private-life and employment contexts remain separated"] },
    { key: "company-ceo", title: "Founder / Venture Owner", kind: "company_ceo", reportsToSeatKey: "founder", agentName: "Lyfe Institute CEO Agent", occupancyMode: "human_with_agent_assistant", mandate: "Own the Institute mandate, activation, capital and final participant-program decisions without representing planned seats as staffed.", separationOfDutyRefs: ["Enrollment and participant-risk decisions remain human-controlled"] },
    { key: "program-owner", title: "Program Owner", kind: "manager", reportsToSeatKey: "company-ceo", agentName: "Lyfe Institute Program Owner Agent", occupancyMode: "human_with_agent_assistant", mandate: "Integrate offer, participant journey, delivery readiness, providers and evidence; currently compressed into the founder.", separationOfDutyRefs: ["Cannot waive safeguarding or privacy gates"] },
    { key: "curriculum-approver", title: "Curriculum Approver", kind: "external", reportsToSeatKey: "company-ceo", agentName: "Curriculum Review Assistant", occupancyMode: "vacant", mandate: "Approve module truth, sources, sequence and revisions before pilot use.", separationOfDutyRefs: ["Must be named and qualified before pilot"] },
    { key: "lead-facilitator", title: "Lead Facilitator", kind: "manager", reportsToSeatKey: "program-owner", agentName: "Facilitation Preparation Assistant", occupancyMode: "vacant", mandate: "Own delivery, participant support, supervision and facilitation quality within the approved educational scope.", separationOfDutyRefs: ["Must be named, qualified and supervised before pilot"] },
    { key: "safeguarding-owner", title: "Safeguarding / Escalation Owner", kind: "external", reportsToSeatKey: "company-ceo", agentName: "Safeguarding Evidence Assistant", occupancyMode: "vacant", mandate: "Own incidents, referrals, stop authority, complaints and safeguarding review.", separationOfDutyRefs: ["Launch-blocking human vacancy", "Agent cannot exercise safeguarding authority"] },
    { key: "privacy-owner", title: "Privacy / Data Owner", kind: "external", reportsToSeatKey: "company-ceo", agentName: "Privacy Evidence Assistant", occupancyMode: "vacant", mandate: "Own consent, access, minimization, retention, deletion and private-life data separation.", separationOfDutyRefs: ["Launch-blocking human vacancy"] },
    { key: "evidence-owner", title: "Evidence / Outcomes Owner", kind: "external", reportsToSeatKey: "program-owner", agentName: "Outcomes Evidence Assistant", occupancyMode: "vacant", mandate: "Own definitions, instruments, verification, denominators and alumni follow-up.", separationOfDutyRefs: ["Activity alone cannot verify an outcome"] },
    { key: "community-operator", title: "Community / Support Operator", kind: "individual_contributor", reportsToSeatKey: "program-owner", agentName: "Community Support Assistant", occupancyMode: "vacant", mandate: "Operate moderation, response windows, complaints and bounded participant support only when a cohort is authorized.", separationOfDutyRefs: ["Activate only with an approved cohort"] },
  ],
  authorityPolicies: [
    { key: "institute-founder-owner", subjectSeatKey: "founder", authorityClasses: ["owner", "decide", "approve", "verify"], dataClasses: ["public", "internal", "confidential", "restricted"], transactionLimit: "No enrollment, participant effect or capital commitment before the founder release gate.", disclosureLimit: "Portfolio visibility never includes unnecessary participant private-life data." },
    { key: "institute-venture-owner", subjectSeatKey: "company-ceo", authorityClasses: ["recommend", "decide", "approve", "execute", "verify"], dataClasses: ["public", "internal", "confidential", "restricted"], transactionLimit: "Professional, safeguarding, facilitator and privacy authority cannot be substituted by the founder or an agent where qualification is required.", disclosureLimit: "Institute participant, curriculum and outcome scope only; LYFEOS private-life data remains firewalled." },
  ],
  workflows: [
    { key: "institute-pilot-activation", name: "Lyfe Institute 90-day pilot activation", stateMachineRef: "eos.lyfe-institute.activation.v1", workPacketKeys: ["establish-company-truth", "close-policy-safety-gates", "approve-curriculum-and-evidence", "rehearse-participant-journey", "qualify-cohort", "founder-go-no-go"], artifactRequirements: ["Canonical offer", "Policy and safety pack", "Named owner qualifications", "Approved curriculum", "Economics model", "Journey rehearsal", "Founder decision"], evidenceRequirements: ["Attributable approval", "Professional review where required", "Expected and actual rehearsal results", "Capacity and economics", "Restored safe state"], exceptionPath: "Keep enrollment closed, preserve the failed gate and evidence, assign one qualified owner and require a new founder decision after remediation." },
    { key: "initiate-arena-participant-lifecycle", name: "Initiate Arena participant lifecycle", stateMachineRef: "eos.lyfe-institute.participant-lifecycle.v1", workPacketKeys: ["qualify-and-consent", "onboard-and-baseline", "deliver-weekly-cycle", "review-safety-and-support", "complete-endline-and-exit", "conduct-alumni-follow-up"], artifactRequirements: ["Eligibility and consent", "Minimum necessary intake", "Baseline", "Attendance and mission evidence", "Incident and support record", "Endline", "Exit plan", "Alumni follow-up"], evidenceRequirements: ["Participant authority", "Consent revision", "Facilitator attribution", "Defined evidence instrument", "Complaints and adverse signals", "Outcome denominator"], exceptionPath: "Pause or end participation safely, preserve the minimum required record, escalate to the qualified human owner and follow the approved referral, refund, complaint or incident path." },
  ],
  providers: [
    ["notion", "Notion", "notion_public_oauth", "Canonical Institute operating specification and reference registries"],
    ["google-drive", "Google Drive", "google_workspace_oauth", "Governed curriculum, Brand and historical source artifacts"],
    ["lyfeos", "LYFEOS", "signed_https", "Optional participant-owned private-life projection with explicit consent and firewall"],
    ["crm", "CRM", "provider_oauth", "Minimum necessary prospect and participant relationship state"],
    ["payments", "Payments", "provider_oauth", "Exact seller, payment, refund and dispute resources pending authorization"],
    ["calendar", "Calendar", "google_workspace_oauth", "Exact cohort session and facilitator calendar"],
    ["community", "Community Platform", "provider_oauth", "Bounded moderated cohort space pending approval"],
  ].map(([key, provider, adapterClass, accountScope]) => ({ key, provider, adapterClass, accountScope, credentialReference: null, authorityState: "selected" as const, healthState: "unknown" as const, substitutionRule: "No provider state, consent, payment, enrollment or participant outcome is inferred; exact authoritative evidence must reconcile into EOS.", manualFallback: "Keep the participant effect blocked and route bounded preparation or evidence capture through the accountable human." })),
  metrics: [
    { key: "critical-gate-closure", name: "Critical Activation Gate Closure", definition: "Critical pilot gates closed with current attributable evidence divided by all critical gates.", target: "100% before enrollment", guardrail: "Draft documents and assigned tasks do not count as closed gates.", attributionRule: "Require exact artifact version, owner, review, decision and evidence.", decisionGate: "Any open critical gate keeps enrollment closed." },
    { key: "participant-evidence-completeness", name: "Participant Evidence Completeness", definition: "Eligible participants with consent, baseline, delivery, endline, exit and required follow-up evidence divided by eligible participants.", target: "100% minimum required record", guardrail: "Collect no unnecessary sensitive data and do not infer outcomes from attendance.", attributionRule: "Bind evidence to the exact participant relationship, instrument version and accountable actor.", decisionGate: "Incomplete evidence blocks outcome claims and next-offer activation." },
    { key: "adverse-signal-rate", name: "Complaint, Incident and Adverse Signal Rate", definition: "Defined complaints, incidents, early exits, refunds and adverse signals per enrolled participant and delivery week.", target: "Zero unresolved critical incidents; establish pilot baseline.", guardrail: "Low reporting may indicate inaccessible reporting rather than safety.", attributionRule: "Use the authoritative incident, complaint, refund and support records.", decisionGate: "Material adverse signal triggers pause, review or stop." },
    { key: "cohort-capacity-economics", name: "Cohort Capacity and Economics", definition: "Attributable revenue less delivery, support, provider, refund-reserve and evidence costs at the approved capacity.", target: "Approved sustainable bounded pilot before enrollment.", guardrail: "Founder labor and shared services must not disappear from economics.", attributionRule: "Use provider-authoritative receipts and explicit allocation assumptions.", decisionGate: "Unsustainable or unsupported economics block repeat or scale." },
  ],
  evidenceContracts: [
    { key: "participant-private-life-firewall", dataClass: "restricted", authoritativeSource: "Institute consent and participant records; participant-owned LYFEOS truth remains separate.", retentionRule: "Collect and retain only the minimum necessary educational, consent, safety and outcome record for the approved purpose.", lineageRequirement: "Every disclosure identifies participant, purpose, consent, recipient, data class and revocation state.", qualificationRule: "Prediction, convenience or shared ownership never creates disclosure permission.", promotionRule: "Promote only anonymized aggregate learning that cannot reconstruct a participant." },
    { key: "claims-inherit-evidence", dataClass: "internal", authoritativeSource: "Approved claims register, curriculum objective and defined participant evidence with denominator.", retentionRule: "Preserve claim version, approval, source evidence, denominator and supersession history.", lineageRequirement: "Claims remain classified from descriptive through supported; prohibited claims cannot be promoted.", qualificationRule: "Activity, completion or anecdote alone cannot support an outcome claim.", promotionRule: "Promote only claims supported at the approved evidence level and review scope." },
    { key: "curriculum-outcome-lineage", dataClass: "confidential", authoritativeSource: "Approved curriculum, facilitator record, evidence instruments and participant outcome registry.", retentionRule: "Preserve module, source, delivery, revision and outcome lineage without silent historical edits.", lineageRequirement: "Every result resolves to the exact curriculum and instrument versions actually used.", qualificationRule: "A module or cohort passes only its explicit educational, safety and evidence criteria.", promotionRule: "Reusable curriculum learning must remain versioned and stripped of participant-private truth." },
  ],
  failureRecovery: [
    { key: "safeguarding-incident", failureClass: "Participant safety, safeguarding, facilitator-scope or referral concern occurs.", incidentOwnerSeatKey: "company-ceo", fallback: "Stop the affected activity and escalate to the qualified safeguarding authority.", recovery: "Follow the approved incident, referral, complaint and communication path and record the minimum necessary evidence.", continuity: "Continue only unaffected preparation or delivery explicitly judged safe by qualified authority.", learningPromotionRule: "Update controls only after qualified review and de-identification." },
    { key: "privacy-consent-breach", failureClass: "Consent, minimization, access, disclosure, retention or deletion control fails.", incidentOwnerSeatKey: "company-ceo", fallback: "Block access and further processing immediately.", recovery: "Contain, revoke, correct, delete or export as required and complete qualified review and notification.", continuity: "Operate only data scopes with verified lawful authority.", learningPromotionRule: "Promote a verified privacy control without participant data." },
    { key: "unsupported-claim", failureClass: "A public or participant-facing claim exceeds its approved evidence level or educational scope.", incidentOwnerSeatKey: "program-owner", fallback: "Stop or correct the claim and preserve the affected artifact and audience.", recovery: "Issue the approved correction, review downstream materials and update claim controls.", continuity: "Use only descriptive or approved learning-objective language.", learningPromotionRule: "Add a tested claim-review rule after root-cause analysis." },
    { key: "capacity-or-readiness-failure", failureClass: "Enrollment, facilitation, support, economics or provider capacity exceeds the qualified bound.", incidentOwnerSeatKey: "program-owner", fallback: "Keep or return enrollment to closed and stop new commitments.", recovery: "Reduce scope, restore support capacity, rehearse again and require a new founder decision.", continuity: "Preserve participant commitments already accepted through the safest approved path.", learningPromotionRule: "Update capacity and admission rules from attributable pilot evidence." },
  ],
  freshnessRule: "Latest explicit owner decision wins, followed by the reconciled Institute Notion system, compatible Drive curriculum and Brand artifacts, pilot evidence and labeled inference.",
  supersessionRule: "The $750 controlled 90-day founding cohort supersedes conflicting live, monthly, annual and unbounded transformation variants; new evidence creates a version rather than rewriting history.",
  runtimeBindings: {
    processes: [
      { processKey: "institute-pilot-activation", name: "Lyfe Institute 90-day pilot activation", capabilityKey: "company-program-governance", accountableSeatKey: "program-owner", workflowKey: "institute-pilot-activation", purpose: "Close the institutional, safety, curriculum, economics and journey gates required for a bounded pilot.", intendedOutcome: "An evidence-linked founder go, revise, pause or stop decision with enrollment still closed until approval.", triggerCondition: "The canonical company and Initiate Arena offer records are bound without unresolved source conflict.", procedureSteps: ["Establish company and offer truth", "Close policy, safety and human-owner gates", "Approve curriculum and evidence instruments", "Build economics and provider configuration", "Rehearse the full participant journey", "Record founder go or no-go decision"], requiredInputs: ["Canonical offer", "Source authority", "Named owner qualifications", "Policy pack", "Curriculum", "Economics"], requiredOutputs: ["Gate ledger", "Rehearsal evidence", "Founder decision"], approvalGates: ["Qualified policy and safety review", "Curriculum and facilitator approval", "Founder release decision"], prohibitedActions: ["Open enrollment early", "Represent vacancy as staffed", "Use invasive intake", "Infer readiness from documents"], evidenceRequirements: ["Artifact versions", "Attributable reviews", "Expected and actual rehearsal results", "Restored safe state"], qualityCriteria: ["Ethical", "Bounded", "Participant-safe", "Evidence-disciplined", "Recoverable"], failurePaths: ["Keep enrollment closed", "Assign one qualified owner", "Rehearse again"], terminalCriteria: ["Founder decision recorded", "Every critical gate explicitly passed or remains blocking"], acceptanceTests: ["Any open critical gate blocks enrollment", "Vacant authority cannot approve", "Failed rehearsal restores safe state"], sourceRef: activationProgram },
      { processKey: "initiate-arena-participant-lifecycle", name: "Initiate Arena participant lifecycle", capabilityKey: "participant-journey-enrollment", accountableSeatKey: "program-owner", workflowKey: "initiate-arena-participant-lifecycle", purpose: "Operate one authorized participant relationship from fit and consent through exit and alumni follow-up.", intendedOutcome: "A safe educational journey with minimum necessary evidence and a self-directed exit plan.", triggerCondition: "The pilot is explicitly authorized and a participant is eligible, qualified and consented.", procedureSteps: ["Qualify fit and consent", "Onboard and capture minimum baseline", "Run the weekly educational cycle", "Monitor support, complaints and safety", "Complete endline and exit plan", "Conduct bounded alumni follow-up"], requiredInputs: ["Eligibility", "Consent", "Approved curriculum", "Qualified facilitator", "Support and incident paths"], requiredOutputs: ["Participant journey record", "Delivery evidence", "Endline and exit", "Alumni follow-up"], approvalGates: ["Participant consent", "Facilitator readiness", "Escalation or exception approval"], prohibitedActions: ["Clinical treatment", "Coercive disclosure", "Guaranteed outcomes", "Over-capacity enrollment"], evidenceRequirements: ["Consent", "Instrument version", "Facilitator attribution", "Complaints/adverse signals", "Outcome denominator"], qualityCriteria: ["Agency-preserving", "Minimum necessary", "Scope-correct", "Safe exit"], failurePaths: ["Pause or exit safely", "Escalate to qualified human", "Use approved refund, complaint or referral path"], terminalCriteria: ["Exit disposition and required evidence recorded", "No unresolved critical incident"], acceptanceTests: ["Revoked consent stops optional processing", "Missing facilitator blocks delivery", "Attendance alone cannot verify outcome"], sourceRef: offerDossier },
    ],
    assets: [
      { assetKey: "INITIATE-ARENA", name: "Initiate Arena / REBOOT Founding Cohort", assetType: "intellectual_property", lifecycleState: "under_review", custodianSeatKey: "company-ceo", ownerOrganizationKey: "ORG-LYFE-INSTITUTE", operatorOrganizationKey: "ORG-LYFE-INSTITUTE", dataClassification: "confidential", rightsUsageLicense: "Institute-owned program, curriculum and delivery system subject to source, claims and participant-protection controls.", replacementPortabilityNotes: "The educational offer remains distinct from LYFEOS software and any provider platform.", sourceRef: offerDossier },
    ],
    stakeholders: [
      { stakeholderKey: "ORG-LYFE-INSTITUTE", name: "Lyfe Institute", partyType: "organization", state: "dormant", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-LYFE-INSTITUTE", relationshipRole: "education company and participant-relationship owner" },
      { stakeholderKey: "SEGMENT-INITIATE-ARENA-PILOT", name: "Initiate Arena Pilot Participants", partyType: "customer_segment", state: "proposed", ownerSeatKey: "program-owner", identityReference: "eos-segment:initiate-arena-pilot", relationshipRole: "qualified and consented pilot participants only" },
      { stakeholderKey: "ORG-EMPYREAN-STUDIOS", name: "Empyrean Creative LLC d/b/a Empyrean Studios", partyType: "vendor_provider", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-EMPYREAN-STUDIOS", relationshipRole: "incubator and governed shared-service provider" },
      { stakeholderKey: "ORG-OST", name: "OST, Inc.", partyType: "vendor_provider", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-OST", relationshipRole: "LYFEOS software owner and technology provider" },
      { stakeholderKey: "ORG-AFM", name: "AFM", partyType: "collaborator", state: "active", ownerSeatKey: "company-ceo", identityReference: "eos-org:ORG-AFM", relationshipRole: "authorized trust and distribution collaborator" },
    ],
    relationships: [
      { relationshipKey: "institute-pilot-participant-segment", stakeholderKey: "SEGMENT-INITIATE-ARENA-PILOT", relationshipType: "beneficiary", title: "Initiate Arena controlled pilot relationship", state: "proposed", ownerSeatKey: "program-owner", needConstraint: "Only qualified, eligible and consented participants after every critical gate passes.", fitHypothesis: "A bounded 90-day educational cohort may help participants produce defined behavior-based artifacts without creating dependency.", nextBestAction: "Complete activation gates before any enrollment." },
      { relationshipKey: "institute-empyrean-incubation", stakeholderKey: "ORG-EMPYREAN-STUDIOS", relationshipType: "vendor_provider", title: "Institute incubation and shared services", state: "active", ownerSeatKey: "company-ceo", needConstraint: "Empyrean services remain explicit and do not transfer Institute participant or program authority.", fitHypothesis: "Empyrean can support activation until proof and spinout gates pass.", nextBestAction: "Bind exact shared-service Work Packets only after Institute approval." },
      { relationshipKey: "institute-ost-lyfeos", stakeholderKey: "ORG-OST", relationshipType: "vendor_provider", title: "LYFEOS technology relationship", state: "proposed", ownerSeatKey: "company-ceo", needConstraint: "OST owns software; Institute owns curriculum, participant relationships and outcomes; private-life data remains participant-controlled.", fitHypothesis: "LYFEOS may support an authorized educational experience without entering EOS employment state.", nextBestAction: "Qualify the privacy-preserving interface before any pilot use." },
    ],
  },
});

export const LYFE_INSTITUTE_COMPANY_PACKAGE = built.package;
export const LYFE_INSTITUTE_SOURCE_BINDINGS = built.sourceBindings;
export const compileLyfeInstituteReferenceInstance = built.materialize;
