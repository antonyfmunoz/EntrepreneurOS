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
    ]));
    expect(nativeAgentEventLabel("eos.workflow_run.transitioned.v1")).toBe("Workflow state changed");
    expect(nativeAgentEventLabel("eos.approval.decided.v1")).toBe("Approval decided");
    expect(nativeAgentEventLabel("eos.instrument.object.transitioned.v1")).toBe("Native tool lifecycle changed");
  });

  it("keeps adapter-specific event names visible instead of falsely relabeling them", () => {
    expect(nativeAgentEventLabel("provider.crm.contact.created.v1")).toBe("provider.crm.contact.created.v1");
  });
});
