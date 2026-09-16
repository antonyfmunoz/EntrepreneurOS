import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlCenter = readFileSync(
  new URL(
    "../../client/src/components/native-operating-control-center.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("native operating workflow evidence selection", () => {
  it("lets a role attach visible, verified EOS evidence without copying a record identifier", () => {
    expect(controlCenter).toContain('queryKey: [root, "evidence"]');
    expect(controlCenter).toContain('request("GET", `${root}/evidence`)');
    expect(controlCenter).toContain('item.verificationState === "verified"');
    expect(controlCenter).toContain('aria-label="Verified workflow evidence"');
    expect(controlCenter).toContain(
      "Only evidence visible to this role and already verified by EOS can be attached to the run.",
    );
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
});
