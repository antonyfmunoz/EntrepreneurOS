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
] as const;

export type NativeAgentEventType = (typeof nativeAgentEventCatalog)[number]["eventType"];

export function nativeAgentEventLabel(eventType: string) {
  return nativeAgentEventCatalog.find((event) => event.eventType === eventType)?.label || eventType;
}
