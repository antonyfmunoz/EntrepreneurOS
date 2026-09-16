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
