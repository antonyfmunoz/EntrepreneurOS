import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calendarStudio = readFileSync(new URL("../../client/src/components/native-calendar-studio.tsx", import.meta.url), "utf8");

describe("native availability controls", () => {
  it("keeps native availability configurable with optimistic concurrency", () => {
    expect(calendarStudio).toContain("Configure selected availability");
    expect(calendarStudio).toContain("native-select-availability");
    expect(calendarStudio).toContain("setSelectedAvailabilityId(event.target.value)");
    expect(calendarStudio).toContain("Save native availability");
    expect(calendarStudio).toContain("calendar-availability-configure");
    expect(calendarStudio).toContain("expectedVersion: selectedAvailability.version");
  });
});
