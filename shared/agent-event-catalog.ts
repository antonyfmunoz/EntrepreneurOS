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
  },
  {
    eventType: "eos.approval.decided.v1",
    label: "Approval decided",
    source: "Native approval runtime",
    description: "Runs after EOS commits an authorized approval or rejection and updates its linked work packet.",
    payloadSummary: "Approval, linked work packet, decision, prior status, next work-packet status, classification, and no provider-effect claim.",
  },
  {
    eventType: "eos.instrument.object.transitioned.v1",
    label: "Native tool lifecycle changed",
    source: "Native instrument runtime",
    description: "Runs after EOS commits a lifecycle transition for a native tool object, including CRM, documents, sheets, calendar, websites, finance, and other instrument records.",
    payloadSummary: "Tool, object, object type, command, prior and next state, version, classification, and no provider-effect claim.",
  },
  {
    eventType: "eos.crm.consented_lead_recorded.v1",
    label: "Consented lead recorded",
    source: "Native website and CRM runtime",
    description: "Runs after EOS accepts a consented submission from an EOS-owned public form and commits the linked native CRM records.",
    payloadSummary: "Form, submission, linked CRM record identifiers, recorded consent version, classification, and no visitor answers or provider-effect claim.",
  },
] as const;

export type NativeAgentEventType = (typeof nativeAgentEventCatalog)[number]["eventType"];

export function nativeAgentEventLabel(eventType: string) {
  return nativeAgentEventCatalog.find((event) => event.eventType === eventType)?.label || eventType;
}
