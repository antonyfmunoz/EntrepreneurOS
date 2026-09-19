/**
 * Human-readable contracts for native events that Role Agents can subscribe
 * to today.  Provider adapters may publish their own names later, so the
 * schedule editor deliberately still permits a documented custom event.
 */
export const nativeAgentEventCatalog = [
  {
    eventType: "eos.workflow_run.transitioned.v1",
    label: "Workflow state changed",
    source: "Native workflow runtime",
    description: "Runs after EOS commits a workflow start, step advance, approval wait, resume, block, failure, cancellation, or completion.",
    payloadSummary: "Workflow, process, action, prior and next state, current step, approval, evidence, and classification.",
    filterFields: ["action", "fromState", "toState", "currentStep", "classification"],
  },
  {
    eventType: "eos.approval.decided.v1",
    label: "Approval decided",
    source: "Native approval runtime",
    description: "Runs after EOS commits an authorized approval or rejection and updates its linked work packet.",
    payloadSummary: "Approval, linked work packet, decision, prior status, next work-packet status, classification, and no provider-effect claim.",
    filterFields: ["decision", "previousStatus", "workPacketStatus", "classification"],
  },
  {
    eventType: "eos.instrument.object.transitioned.v1",
    label: "Native tool lifecycle changed",
    source: "Native instrument runtime",
    description: "Runs after EOS commits a lifecycle transition for a native tool object, including CRM, documents, sheets, calendar, websites, finance, and other instrument records.",
    payloadSummary: "Tool, object, object type, command, prior and next state, version, classification, and no provider-effect claim.",
    filterFields: ["instrumentKey", "objectType", "fromState", "toState", "classification"],
  },
  {
    eventType: "eos.crm.consented_lead_recorded.v1",
    label: "Consented lead recorded",
    source: "Native website and CRM runtime",
    description: "Runs after EOS accepts a consented submission or booking from an EOS-owned public intake point and commits the linked native CRM records.",
    payloadSummary: "Form or calendar, intake record identifiers, linked CRM record identifiers, recorded consent version, classification, and no visitor answers or provider-effect claim.",
    filterFields: ["consentRecorded", "consentVersion", "classification"],
  },
  {
    eventType: "eos.recovery.engagement.transitioned.v1",
    label: "Recovery engagement advanced",
    source: "Native Revenue Recovery operations",
    description: "Runs after EOS commits a governed Revenue Recovery engagement milestone, such as scope approval, intake, audit, bounded launch, reporting, recovery, or closeout.",
    payloadSummary: "Engagement identifier, action, Client Zero or paid-client mode, prior and next state, version, evidence count, classification, and no provider-effect claim.",
    filterFields: ["action", "mode", "fromState", "toState", "classification"],
  },
  {
    eventType: "eos.recovery.campaign.transitioned.v1",
    label: "Recovery campaign decision recorded",
    source: "Native Revenue Recovery operations",
    description: "Runs after EOS commits a governed Recovery campaign submission, approval, test verification, activation, pause, rejection, or completion.",
    payloadSummary: "Engagement and campaign identifiers, decision, pool, channel, prior and next state, version, evidence count, classification, and no provider-effect claim.",
    filterFields: ["decision", "poolKey", "channel", "fromState", "toState", "classification"],
  },
  {
    eventType: "eos.recovery.opportunity.transitioned.v1",
    label: "Recovery opportunity advanced",
    source: "Native Revenue Recovery operations",
    description: "Runs after EOS commits a verified state transition for a Recovery opportunity; EOS never infers contact, booking, revenue, or attribution without Evidence.",
    payloadSummary: "Engagement and opportunity identifiers, pool, prior and next state, version, attributable value, evidence count, classification, and no provider-effect claim.",
    filterFields: ["poolKey", "fromState", "toState", "attributionModel", "classification"],
  },
] as const;

export type NativeAgentEventType = (typeof nativeAgentEventCatalog)[number]["eventType"];

export function nativeAgentEventLabel(eventType: string) {
  return nativeAgentEventCatalog.find((event) => event.eventType === eventType)?.label || eventType;
}
