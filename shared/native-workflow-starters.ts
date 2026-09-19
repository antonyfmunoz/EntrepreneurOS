/**
 * Native operating patterns are deliberately kept outside of a particular
 * screen. The Workflow Composer, Company Mission compiler, and governed
 * runtime all start from this same small library of editable patterns.
 *
 * A starter is never an executable provider instruction. It describes native
 * EOS work, its authority boundary, and the evidence required before the
 * normal process release controls can permit a run.
 */
export type NativeWorkflowActionKind = "manual" | "native" | "approval" | "condition";
export type NativeWorkflowAuthority = "view" | "execute" | "decide";

export type NativeWorkflowStarterStep = {
  title: string;
  instructions: string;
  completionCriteria: string;
  actionKind: NativeWorkflowActionKind;
  authorityClass: NativeWorkflowAuthority;
  toolKey: string;
  onFailure: string;
};

export type NativeWorkflowStarter = {
  key: string;
  label: string;
  description: string;
  name: string;
  purpose: string;
  outcome: string;
  trigger: string;
  approvals: string[];
  branches: string[];
  steps: NativeWorkflowStarterStep[];
};

export type NativeWorkflowStarterVariables = {
  companyName?: string | null;
  offer?: string | null;
  targetCustomer?: string | null;
  goal?: string | null;
};

export const nativeWorkflowTools = [
  "operations", "tasks", "projects", "crm", "messages", "calendar",
  "docs", "sheets", "forms", "websites", "commerce", "finance",
  "analytics", "reputation", "conference_rooms",
] as const;

export const nativeWorkflowStarters: readonly NativeWorkflowStarter[] = [
  {
    key: "lead-to-discovery",
    label: "Lead to discovery",
    description: "Qualify a consented lead and move it to the right next conversation.",
    name: "{{company_name}} lead qualification · {{offer}}",
    purpose: "Turn a consented inbound lead for {{offer}} into a verified, role-owned next action with {{target_customer}}.",
    outcome: "A qualified {{target_customer}} relationship, next meeting, or safe disqualification is recorded.",
    trigger: "A consented lead for {{offer}} enters the native CRM.",
    approvals: [],
    branches: ["If consent is absent, stop and request it before outreach."],
    steps: [
      { title: "Verify relationship and consent", instructions: "Review the native CRM relationship, source and consent record.", completionCriteria: "Consent and contact context are sufficient for the chosen channel.", actionKind: "condition", authorityClass: "view", toolKey: "crm", onFailure: "Stop outreach, preserve the record, and request the missing consent or context." },
      { title: "Qualify fit", instructions: "Assess need, timing, authority and fit against the approved offer.", completionCriteria: "The qualification outcome and next action are recorded in CRM.", actionKind: "native", authorityClass: "execute", toolKey: "crm", onFailure: "Mark the relationship as nurture or disqualified with a factual reason." },
      { title: "Offer the next conversation", instructions: "Prepare a role-appropriate meeting option using the native calendar and approved message language.", completionCriteria: "A meeting option or safe follow-up task is recorded.", actionKind: "native", authorityClass: "execute", toolKey: "calendar", onFailure: "Create a role-owned follow-up task; do not claim a message was sent externally." },
    ],
  },
  {
    key: "client-onboarding",
    label: "Client onboarding",
    description: "Move an authorized customer from commitment into a governed launch.",
    name: "{{company_name}} client onboarding",
    purpose: "Create a clear, role-owned {{offer}} client launch without assuming payment, signature, or provider effects.",
    outcome: "The approved onboarding milestone, owner, access needs and evidence are recorded.",
    trigger: "A separate agreement and payment rail has supplied its verified authorization evidence.",
    approvals: ["A commercial authority record is required before customer onboarding begins."],
    branches: ["If any commercial evidence is missing, return the case to the commercial activation boundary."],
    steps: [
      { title: "Confirm commercial authorization", instructions: "Inspect the governed agreement, payment and authority evidence before starting delivery work.", completionCriteria: "The onboarding record names the supporting authorization evidence.", actionKind: "approval", authorityClass: "decide", toolKey: "commerce", onFailure: "Do not start delivery; route the case back to the commercial owner." },
      { title: "Create onboarding project", instructions: "Create a native project with accountable owner, desired outcome and milestone tasks.", completionCriteria: "A project and role-owned tasks exist for the client launch.", actionKind: "native", authorityClass: "execute", toolKey: "projects", onFailure: "Preserve the case in a blocked state and escalate to the delivery manager." },
      { title: "Schedule launch and capture requirements", instructions: "Record the client launch event and required intake or access checklist.", completionCriteria: "The launch date and required inputs are visible to accountable roles.", actionKind: "native", authorityClass: "execute", toolKey: "calendar", onFailure: "Create a dated follow-up task and record the missing requirement." },
    ],
  },
  {
    key: "weekly-operating-review",
    label: "Weekly operating review",
    description: "Turn company signals into a decision, priorities and accountable work.",
    name: "{{company_name}} weekly operating review · {{goal}}",
    purpose: "Review {{company_name}}’s native operating signals and make the next accountable decisions explicit for {{goal}}.",
    outcome: "A reviewed metric report, decision record and prioritized work are retained.",
    trigger: "The scheduled weekly operating review begins.",
    approvals: ["Material budget, legal, people or commercial decisions require their assigned authority."],
    branches: ["If metrics are incomplete or externally sourced without a receipt, record the limitation instead of inferring a result."],
    steps: [
      { title: "Review governed metrics", instructions: "Inspect the selected native metrics, observations and provenance limits.", completionCriteria: "The decision context identifies which metrics are current, missing or pending reconciliation.", actionKind: "native", authorityClass: "view", toolKey: "analytics", onFailure: "Record a data-quality blocker and assign an accountable follow-up." },
      { title: "Hold decision review", instructions: "Use the EA and advisory path to frame options, trade-offs and authorities.", completionCriteria: "The operating decision and any approval need are captured.", actionKind: "approval", authorityClass: "decide", toolKey: "conference_rooms", onFailure: "Defer the decision with explicit uncertainty and an owner for the missing evidence." },
      { title: "Create priority work", instructions: "Translate approved choices into role-owned native projects or tasks.", completionCriteria: "Every approved priority has an owner and observable next step.", actionKind: "native", authorityClass: "execute", toolKey: "projects", onFailure: "Keep the decision open and do not imply execution has begun." },
    ],
  },
  {
    key: "reputation-follow-through",
    label: "Reputation follow-through",
    description: "Ask for feedback safely and use it to improve the operating system.",
    name: "{{company_name}} reputation follow-through",
    purpose: "Request and retain customer feedback for {{offer}} with consent, source provenance and accountable improvement work.",
    outcome: "A review request, received feedback or improvement priority is governed inside EOS.",
    trigger: "A client value milestone is completed and feedback consent is available.",
    approvals: ["Public testimonial use requires the recorded consent and supporting evidence."],
    branches: ["If feedback is negative or incomplete, create an improvement path instead of publishing a claim."],
    steps: [
      { title: "Confirm consent and relationship", instructions: "Inspect the customer relationship and feedback consent reference.", completionCriteria: "The request is authorized for the selected channel.", actionKind: "condition", authorityClass: "view", toolKey: "crm", onFailure: "Stop and request appropriate consent or context." },
      { title: "Create feedback request", instructions: "Create the native consent-aware request plan.", completionCriteria: "A governed request record exists without an unverified external send claim.", actionKind: "native", authorityClass: "execute", toolKey: "reputation", onFailure: "Leave the request in draft and escalate channel or consent uncertainty." },
      { title: "Turn signal into improvement", instructions: "Record the feedback evidence and create accountable work if an improvement is needed.", completionCriteria: "Feedback is linked to a metric, decision or project where appropriate.", actionKind: "native", authorityClass: "execute", toolKey: "projects", onFailure: "Retain the evidence and flag it for the operating review." },
    ],
  },
  {
    key: "editorial-cadence",
    label: "Editorial cadence",
    description: "Turn the company offer into a role-owned native content plan without implying external publication.",
    name: "{{company_name}} editorial cadence · {{offer}}",
    purpose: "Plan, review, and learn from an evidence-bearing native editorial cadence for {{offer}} and {{target_customer}} while keeping publishing-provider actions separate and explicit.",
    outcome: "A role-owned content plan, approved message boundary, schedule, and observed-publication evidence path are recorded.",
    trigger: "The company needs a repeatable owned-content cadence for {{offer}}.",
    approvals: ["An authorized human or assigned decision authority approves material brand claims, publishing commitments, paid distribution, or public representations before they are released externally."],
    branches: ["If message evidence, rights, consent, approval, or publishing authority is incomplete, keep the item in draft or review and do not represent it as published."],
    steps: [
      { title: "Frame the audience and message", instructions: "Use the native CRM, operating brief, and evidence sources to define the audience, point of view, call to action, proof boundary, and required assets for {{offer}}.", completionCriteria: "The content brief names {{target_customer}}, the intended outcome, evidence limits, owner, and the native source records it relies on.", actionKind: "manual", authorityClass: "execute", toolKey: "docs", onFailure: "Keep the concept as an unqualified idea and assign the missing customer, offer, consent, rights, or evidence question." },
      { title: "Create the native editorial item", instructions: "Create and schedule the content item in the EOS Content Calendar with its type, channel, brief, owner, and working state.", completionCriteria: "A native content item exists with a scheduled review point and is not represented as externally delivered.", actionKind: "native", authorityClass: "execute", toolKey: "calendar", onFailure: "Retain the brief in draft and create a role-owned follow-up instead of inventing a schedule or external post." },
      { title: "Review public representation boundary", instructions: "Review claims, audience fit, rights, consent, brand standards, and whether the item requires a material public-representation decision.", completionCriteria: "The item is approved, revised, paused, or kept in review with the authority and unresolved risk explicit.", actionKind: "approval", authorityClass: "decide", toolKey: "docs", onFailure: "Pause the item and preserve the reason; do not publish, schedule paid distribution, or imply approval." },
      { title: "Observe external outcome only when evidenced", instructions: "When an authorized publishing rail or manual operator provides an external post URL, platform ID, or retained evidence, record the observed result and related learning.", completionCriteria: "Any published state has attributable external evidence; otherwise the item remains a native plan, review, or scheduled intent.", actionKind: "native", authorityClass: "execute", toolKey: "analytics", onFailure: "Keep the delivery state as not dispatched or unresolved and create an evidence follow-up." },
    ],
  },
  {
    key: "capability-to-placement",
    label: "Capability to placement",
    description: "Turn a verified capability gap into a fair, governed candidate and onboarding path.",
    name: "{{company_name}} capability to placement · {{goal}}",
    purpose: "Prepare a role-owned talent path for {{company_name}} without assuming an employment decision, compensation, access grant, or external recruitment effect.",
    outcome: "A verified capability need, candidate evidence path, human decision gate, and onboarding boundary are recorded.",
    trigger: "A company capability gap is reviewed for {{goal}} and an authorized people owner opens a governed talent need.",
    approvals: ["A human authorized for the relevant people decision must approve any placement, access grant, compensation, or employment commitment."],
    branches: ["If candidate consent, evidence, scope, or decision authority is incomplete, preserve the record and stop before an adverse, employment, or access decision."],
    steps: [
      { title: "Define the capability need", instructions: "Record the missing outcome, target role, decision rights, requirements, and evidence standard in the native talent process.", completionCriteria: "The capability gap is specific enough to assess fairly and does not imply a candidate or employment outcome.", actionKind: "manual", authorityClass: "execute", toolKey: "docs", onFailure: "Keep the need in draft, identify the missing operating context, and return it to the accountable company owner." },
      { title: "Collect consented candidate context", instructions: "Use a governed intake to collect only the candidate context and consent required for the current assessment stage.", completionCriteria: "Candidate consent, source, role hypothesis, and evidence limitations are visible to the authorized reviewer.", actionKind: "native", authorityClass: "execute", toolKey: "forms", onFailure: "Do not infer fit or contact a candidate; request the missing consent or evidence through an authorized channel." },
      { title: "Schedule a bounded assessment", instructions: "Prepare an assessment or interview event with clear candidate burden, evaluator, success criteria, and privacy boundary.", completionCriteria: "The planned assessment has a named owner, bounded effort, and no unverified external calendar or message claim.", actionKind: "native", authorityClass: "execute", toolKey: "calendar", onFailure: "Record the scheduling constraint and retain the candidate in the current governed stage." },
      { title: "Review placement and onboarding boundary", instructions: "Review evidence, unresolved questions, required approval, initial onboarding outcome, and the role-agent assistant transition before any placement is actioned.", completionCriteria: "A human decision gate and accountable onboarding plan are recorded; no employment, compensation, access, or provider effect is assumed.", actionKind: "approval", authorityClass: "decide", toolKey: "docs", onFailure: "Keep the placement uncommitted, preserve the review record, and escalate the missing authority or evidence." },
    ],
  },
  {
    key: "finance-control-cycle",
    label: "Finance control cycle",
    description: "Prepare an evidence-bearing financial review without claiming ledger truth or autonomous money movement.",
    name: "{{company_name}} finance control cycle · {{goal}}",
    purpose: "Maintain a governed view of {{company_name}} cash, commitments, planned allocation, and reconciliation limits for {{goal}} while keeping accounting, bank, tax, payroll, and payment rails authoritative where applicable.",
    outcome: "A source-labeled financial review, bounded plan, approval requirement, and reconciliation follow-up are recorded.",
    trigger: "A scheduled control review, material commercial event, or allocation question requires financial context for {{goal}}.",
    approvals: ["An authorized human must approve money movement, a binding budget, tax or accounting conclusion, capital allocation, or an external financial-provider action."],
    branches: ["If a source is stale, incomplete, conflicting, or provider-owned without receipt evidence, preserve the uncertainty and stop before treating it as financial truth."],
    steps: [
      { title: "Record source authority and freshness", instructions: "Identify each native, provider, manual, derived, or unresolved finance source and its last verified state.", completionCriteria: "The review distinguishes a planning signal from settled accounting, bank, payment, payroll, or tax truth.", actionKind: "condition", authorityClass: "view", toolKey: "finance", onFailure: "Mark the source as unresolved, retain its limitation, and assign a reconciliation owner instead of inferring a balance or obligation." },
      { title: "Prepare the bounded control view", instructions: "Use native finance records and a supporting sheet to prepare the cash, obligation, allocation, and variance view required for the decision.", completionCriteria: "The plan names assumptions, evidence, owner, effective period, and the financial authority boundary.", actionKind: "native", authorityClass: "execute", toolKey: "sheets", onFailure: "Keep the plan in draft and route missing inputs to the accountable finance owner." },
      { title: "Review material decision boundary", instructions: "Present the control view, risk, alternatives, and required financial authority for a governed decision review.", completionCriteria: "Any money, accounting, tax, capital, or provider effect is either explicitly approved by the authorized human or remains uncommitted.", actionKind: "approval", authorityClass: "decide", toolKey: "conference_rooms", onFailure: "Record the deferred decision and do not create an external financial effect." },
      { title: "Reconcile observed outcome", instructions: "Attach the verified native or provider evidence when an approved event is observed, or retain the exception for the next control review.", completionCriteria: "The review has an evidence state, variance explanation, and named remediation or follow-up.", actionKind: "native", authorityClass: "execute", toolKey: "analytics", onFailure: "Open a reconciliation exception with source, owner, and manual fallback rather than closing the control cycle." },
    ],
  },
  {
    key: "policy-obligation-control",
    label: "Policy and obligation control",
    description: "Keep commitments, rights, policy, risk, and professional-review boundaries visible before a consequential decision.",
    name: "{{company_name}} policy and obligation control · {{goal}}",
    purpose: "Maintain a controlled native record of {{company_name}} policy, obligation, agreement, right, risk, and decision context for {{goal}} without presenting legal advice or an executed legal effect.",
    outcome: "A source-linked governance review, professional-review route where needed, and authorized decision boundary are recorded.",
    trigger: "A policy, contract, right, retention, privacy, regulatory, or material governance question affects {{goal}}.",
    approvals: ["Legal conclusions, executed agreements, filings, regulated determinations, rights waivers, and other consequential legal effects require the appropriate authorized human and qualified professional review where applicable."],
    branches: ["If jurisdiction, source authority, policy version, consent, or professional-review requirement is uncertain, preserve the question and stop before claiming compliance or a legal conclusion."],
    steps: [
      { title: "Locate the controlled source and scope", instructions: "Record the governing document, source owner, effective date, affected party, classification, and known limitation in the native document record.", completionCriteria: "The review distinguishes a source document or external authority from an EOS summary, draft, or recommendation.", actionKind: "condition", authorityClass: "view", toolKey: "docs", onFailure: "Keep the item unresolved and request the authoritative source or accountable owner." },
      { title: "Map obligation, right, risk, and control", instructions: "Capture the material obligation, right, decision dependency, evidence requirement, and operational control without converting the entry into advice.", completionCriteria: "A role-owned control or escalation is visible with its scope, evidence need, and review date.", actionKind: "native", authorityClass: "execute", toolKey: "docs", onFailure: "Open a governance exception and avoid an unsupported compliance or contract claim." },
      { title: "Hold the authorized review", instructions: "Use the native review room to identify the correct decision-maker, counsel or professional review requirement, options, and stop conditions.", completionCriteria: "The decision is approved, rejected, or deferred with the qualified authority and evidence limitation explicit.", actionKind: "approval", authorityClass: "decide", toolKey: "conference_rooms", onFailure: "Preserve the item in review and prevent any consequential commitment from proceeding." },
      { title: "Track follow-through and retention", instructions: "Create governed follow-up work for the approved control, required evidence, renewal, remediation, or review date.", completionCriteria: "The resulting work has an accountable owner and does not claim that an external filing, signature, or legal effect occurred without evidence.", actionKind: "native", authorityClass: "execute", toolKey: "workflows", onFailure: "Retain the unresolved control with its owner and manual professional-review fallback." },
    ],
  },
  {
    key: "vendor-to-approved-service",
    label: "Vendor to approved service",
    description: "Move a vendor or service need through relationship, risk, scope, approval, and continuity review without creating an external commitment.",
    name: "{{company_name}} vendor and service control · {{goal}}",
    purpose: "Turn a service or vendor need for {{company_name}} into a bounded, role-owned relationship and control path for {{goal}} without assuming a contract, purchase, access grant, payment, or provider effect.",
    outcome: "A vendor relationship, scope, authority boundary, risk and continuity review, and explicit approval or rejection are recorded.",
    trigger: "A company need requires a new, changed, or renewed vendor, contractor, shared service, or specialist provider relationship.",
    approvals: ["An authorized human must approve any vendor commitment, contract, spend, access grant, data disclosure, account connection, or irreversible external service effect."],
    branches: ["If identity, authority, scope, data handling, payee, continuity, or exit terms are incomplete, keep the relationship proposed and stop before any external commitment."],
    steps: [
      { title: "Record the service need and relationship", instructions: "Create or update the native stakeholder relationship with the need, service hypothesis, internal owner, classification, and no-assumption boundary.", completionCriteria: "The vendor or provider is represented as a proposed or current relationship, not as proof of authorization, contract, access, or payment.", actionKind: "native", authorityClass: "execute", toolKey: "crm", onFailure: "Keep the need in draft and escalate the missing internal owner or purpose." },
      { title: "Define scope, risk, and continuity controls", instructions: "Record the bounded scope, data/access implications, service dependency, evidence, fallback, and exit plan in the native operating record.", completionCriteria: "The review identifies what the provider may and may not do, how failure is handled, and which facts need professional or owner review.", actionKind: "native", authorityClass: "execute", toolKey: "docs", onFailure: "Do not progress to commitment; capture the unresolved risk and continuity gap." },
      { title: "Review commitment authority", instructions: "Present terms, spend or data exposure, alternatives, risk, and authority requirements to the appropriate internal reviewer.", completionCriteria: "The relationship is explicitly approved, rejected, or deferred; no purchase, contract, access, or provider connection is implied by the review.", actionKind: "approval", authorityClass: "decide", toolKey: "finance", onFailure: "Keep the relationship proposed and create a role-owned remediation task." },
      { title: "Track service verification", instructions: "Create the native review cadence, evidence checklist, owner, and exception route for an approved relationship or a replacement search.", completionCriteria: "A continuing service-control record exists with a visible next verification or fallback action.", actionKind: "native", authorityClass: "execute", toolKey: "projects", onFailure: "Record a vendor-control exception and retain manual continuity steps." },
    ],
  },
  {
    key: "offer-learning-loop",
    label: "Offer learning loop",
    description: "Convert customer and delivery evidence into a governed, versioned proposal to improve an offer or reusable operating template.",
    name: "{{company_name}} offer learning loop · {{offer}}",
    purpose: "Use observable {{target_customer}} and delivery evidence to propose a controlled evolution of {{offer}} for {{goal}}, without silently mutating a reusable EOS template or customer commitment.",
    outcome: "An evidence-linked improvement proposal, owner, version boundary, decision, and release or rollback path are recorded.",
    trigger: "Customer, delivery, commercial, quality, or operating evidence suggests that {{offer}} or its working method should change.",
    approvals: ["An authorized human owner must approve any offer, price, promise, reusable-template, or customer-facing change before it is released or represented externally."],
    branches: ["If evidence is weak, customer-specific, consent-limited, or conflicts with an active commitment, preserve the learning as a proposal and do not generalize it into a template change."],
    steps: [
      { title: "Gather attributable operating evidence", instructions: "Link the relevant relationship, outcome, delivery, metric, feedback, and known data-quality limitations to a native improvement record.", completionCriteria: "The proposal distinguishes observed evidence from a hypothesis and preserves source, consent, and customer-specific limits.", actionKind: "native", authorityClass: "view", toolKey: "analytics", onFailure: "Retain the question as unqualified learning and assign a data or evidence follow-up." },
      { title: "Draft the bounded change proposal", instructions: "Describe the proposed offer, SOP, template, or operating change; affected commitments; compatibility; success measure; and rollback condition in a controlled document.", completionCriteria: "The proposal has an accountable owner, explicit version boundary, intended outcome, and does not alter any shared template or live commitment by itself.", actionKind: "native", authorityClass: "execute", toolKey: "docs", onFailure: "Keep the proposal in draft and preserve the current approved operating version." },
      { title: "Decide release, experiment, or rejection", instructions: "Review evidence, scope, customer impact, authority, experiment boundary, and rollback condition before authorizing a change.", completionCriteria: "The proposal is approved, rejected, or narrowed to a governed experiment with the decision authority explicit.", actionKind: "approval", authorityClass: "decide", toolKey: "workflows", onFailure: "Do not release the change; keep current commitments and templates intact." },
      { title: "Observe and reconcile the result", instructions: "Record the measured outcome, exceptions, customer impact, and whether the proposal should be retained, rolled back, or revised.", completionCriteria: "The result is attributed to its version and evidence; a template-learning proposal never silently becomes shared truth.", actionKind: "native", authorityClass: "execute", toolKey: "projects", onFailure: "Open an outcome-review task and preserve the previous approved version as the fallback." },
    ],
  },
];

type ResolvedNativeWorkflowStarterVariables = {
  companyName: string;
  offer: string;
  targetCustomer: string;
  goal: string;
};

function substitute(value: string, variables: ResolvedNativeWorkflowStarterVariables) {
  return value
    .replaceAll("{{company_name}}", variables.companyName)
    .replaceAll("{{offer}}", variables.offer)
    .replaceAll("{{target_customer}}", variables.targetCustomer)
    .replaceAll("{{goal}}", variables.goal);
}

/** Materialize one reusable pattern into this company’s editable draft. */
export function materializeNativeWorkflowStarter(
  starterKey: string,
  input: NativeWorkflowStarterVariables = {},
): NativeWorkflowStarter {
  const starter = nativeWorkflowStarters.find((item) => item.key === starterKey);
  if (!starter) throw new Error(`Unknown native workflow starter: ${starterKey}`);
  const variables: ResolvedNativeWorkflowStarterVariables = {
    companyName: input.companyName?.trim() || "This company",
    offer: input.offer?.trim() || "the declared offer",
    targetCustomer: input.targetCustomer?.trim() || "the declared customer",
    goal: input.goal?.trim() || "the declared near-term outcome",
  };
  return {
    ...starter,
    name: substitute(starter.name, variables),
    purpose: substitute(starter.purpose, variables),
    outcome: substitute(starter.outcome, variables),
    trigger: substitute(starter.trigger, variables),
    approvals: starter.approvals.map((value) => substitute(value, variables)),
    branches: starter.branches.map((value) => substitute(value, variables)),
    steps: starter.steps.map((step) => ({
      ...step,
      title: substitute(step.title, variables),
      instructions: substitute(step.instructions, variables),
      completionCriteria: substitute(step.completionCriteria, variables),
      onFailure: substitute(step.onFailure, variables),
    })),
  };
}
