import { describe, expect, it } from "vitest";
import { nativeAgentEventCatalog, nativeAgentEventLabel } from "../../shared/agent-event-catalog";

describe("native Role Agent event catalog", () => {
  it("exposes only events the native runtime currently emits durably", () => {
    expect(nativeAgentEventCatalog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "eos.workflow_run.transitioned.v1",
        label: "Workflow state changed",
        source: "Native workflow runtime",
      }),
      expect.objectContaining({
        eventType: "eos.approval.decided.v1",
        label: "Approval decided",
        source: "Native approval runtime",
      }),
      expect.objectContaining({
        eventType: "eos.instrument.object.transitioned.v1",
        label: "Native tool lifecycle changed",
        source: "Native instrument runtime",
      }),
      expect.objectContaining({
        eventType: "eos.crm.consented_lead_recorded.v1",
        label: "Consented lead recorded",
        source: "Native website and CRM runtime",
      }),
      expect.objectContaining({
        eventType: "eos.recovery.engagement.transitioned.v1",
        label: "Recovery engagement advanced",
        source: "Native Revenue Recovery operations",
        filterFields: expect.arrayContaining(["action", "toState"]),
      }),
      expect.objectContaining({
        eventType: "eos.recovery.campaign.transitioned.v1",
        label: "Recovery campaign decision recorded",
      }),
      expect.objectContaining({
        eventType: "eos.recovery.opportunity.transitioned.v1",
        label: "Recovery opportunity advanced",
      }),
    ]));
    expect(nativeAgentEventLabel("eos.workflow_run.transitioned.v1")).toBe("Workflow state changed");
    expect(nativeAgentEventLabel("eos.approval.decided.v1")).toBe("Approval decided");
    expect(nativeAgentEventLabel("eos.instrument.object.transitioned.v1")).toBe("Native tool lifecycle changed");
    expect(nativeAgentEventLabel("eos.crm.consented_lead_recorded.v1")).toBe("Consented lead recorded");
    expect(nativeAgentEventLabel("eos.recovery.engagement.transitioned.v1")).toBe("Recovery engagement advanced");
  });

  it("keeps adapter-specific event names visible instead of falsely relabeling them", () => {
    expect(nativeAgentEventLabel("provider.crm.contact.created.v1")).toBe("provider.crm.contact.created.v1");
  });
});
