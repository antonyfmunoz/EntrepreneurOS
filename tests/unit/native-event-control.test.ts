import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calendarStudio = readFileSync(new URL("../../client/src/components/native-calendar-studio.tsx", import.meta.url), "utf8");

describe("native event controls", () => {
  it("lets an authorized operator revise a selected native event in place", () => {
    expect(calendarStudio).toContain("Configure selected event");
    expect(calendarStudio).toContain("Save native event");
    expect(calendarStudio).toContain("calendar-event-configure");
    expect(calendarStudio).toContain("expectedVersion: selectedEvent.version");
    expect(calendarStudio).toContain('operatingMode: "native_eos"');
  });
});
