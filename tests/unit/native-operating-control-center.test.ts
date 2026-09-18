import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlCenter = readFileSync(new URL("../../client/src/components/native-operating-control-center.tsx", import.meta.url), "utf8");

describe("native operating control center role-mode guard", () => {
  it("lets a role attach visible, verified EOS evidence without copying a record identifier", () => {
    expect(controlCenter).toContain('queryKey: [root, "evidence"]');
    expect(controlCenter).toContain('request("GET", `${root}/evidence`)');
    expect(controlCenter).toContain('item.verificationState === "verified"');
    expect(controlCenter).toContain('aria-label="Verified workflow evidence"');
    expect(controlCenter).toContain("Only evidence visible to this role and already verified by EOS can be attached to the run.");
    expect(controlCenter).not.toContain("Verified Evidence ID when required");
  });

  it("binds a Role Agent schedule to a process selected for that exact seat", () => {
    expect(controlCenter).toContain('const [scheduleProcessId, setScheduleProcessId] = useState("")');
    expect(controlCenter).toContain('process.accountableSeatId === scheduleSeat?.id');
    expect(controlCenter).toContain('aria-label="Scheduled released process"');
    expect(controlCenter).toContain('processDefinitionId: scheduleProcessId');
    expect(controlCenter).toContain("Choose the exact verified Role Agent first.");
    expect(controlCenter).toContain("Scope preview:");
    expect(controlCenter).not.toContain('!scheduleSubject || !selectedProcessId || createSchedule.isPending');
  });

  it("lets a founder configure and safely exercise an EOS event-triggered Role Agent schedule", () => {
    expect(controlCenter).toContain('const [scheduleEventTypes, setScheduleEventTypes] = useState("")');
    expect(controlCenter).toContain('triggerKind = scheduleCadence === "manual" ? "manual" : scheduleCadence === "event" ? "event" : "schedule"');
    expect(controlCenter).toContain('aria-label="Role Agent event types"');
    expect(controlCenter).toContain('aria-label="Native Role Agent event"');
    expect(controlCenter).toContain("nativeAgentEventCatalog");
    expect(controlCenter).toContain("Choose a native event rather than memorizing an internal name.");
    expect(controlCenter).toContain('`${root}/agent-events`');
    expect(controlCenter).toContain('externalEffectsPermitted: false');
    expect(controlCenter).toContain('Testing emits a bounded EOS event only; it does not call a provider.');
    expect(controlCenter).toContain("Only run when these facts match");
    expect(controlCenter).toContain('aria-label="Role Agent event rule value"');
    expect(controlCenter).toContain("eventFilter: { all:");
    expect(controlCenter).toContain("setNestedEventFact(payload, rule.path, rule.equals)");
  });

  it("lets an authorized operator run an active manual schedule without leaving the native workspace", () => {
    expect(controlCenter).toContain('`${root}/agent-schedules/${schedule.id}/run`');
    expect(controlCenter).toContain('ui:manual-agent-schedule:${schedule.id}:${crypto.randomUUID()}');
    expect(controlCenter).toContain('setOperatingTab("runs")');
    expect(controlCenter).toContain("Manual run: creates a governed EOS workflow run now.");
    expect(controlCenter).toContain("Run now");
  });

  it("only offers execution modes that the accountable role can actually run", () => {
    expect(controlCenter).toContain("selectedProcessHasHumanOwner");
    expect(controlCenter).toContain("selectedProcessAllowsAutonomous");
    expect(controlCenter).toContain('disabled={!selectedProcessHasHumanOwner}');
    expect(controlCenter).toContain('disabled={!selectedProcessAllowsAutonomous}');
  });

  it("returns a no-longer-valid selected mode to manual instead of sending a rejected run request", () => {
    expect(controlCenter).toContain('executionMode === "assisted" && !selectedProcessHasHumanOwner');
    expect(controlCenter).toContain('executionMode === "autonomous" && !selectedProcessAllowsAutonomous');
    expect(controlCenter).toContain('setExecutionMode("manual")');
  });

  it("explains the human-led assistant and vacant-role autonomous boundaries in the operating surface", () => {
    expect(controlCenter).toContain("Execution boundary:");
    expect(controlCenter).toContain("human-led role's assistant");
    expect(controlCenter).toContain("vacant role");
  });
});
