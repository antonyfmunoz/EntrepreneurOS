import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calendarStudio = readFileSync(new URL("../../client/src/components/native-calendar-studio.tsx", import.meta.url), "utf8");

describe("native calendar controls", () => {
  it("lets an authorized operator configure a selected native calendar in place", () => {
    expect(calendarStudio).toContain("Configure selected calendar");
    expect(calendarStudio).toContain("Save native calendar");
    expect(calendarStudio).toContain("calendar-configure");
    expect(calendarStudio).toContain("expectedVersion: selectedCalendar.version");
    expect(calendarStudio).toContain('operatingMode: "native_eos"');
  });
});
