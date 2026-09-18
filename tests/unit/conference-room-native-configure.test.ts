import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const conferenceRooms = readFileSync(new URL("../../client/src/components/conference-room-control-center.tsx", import.meta.url), "utf8");

describe("native Conference Room configuration", () => {
  it("keeps selected rooms and governed meetings editable with concurrency protection", () => {
    expect(conferenceRooms).toContain("Configure selected room");
    expect(conferenceRooms).toContain("Save native room");
    expect(conferenceRooms).toContain("conference-room-configure");
    expect(conferenceRooms).toContain("expectedVersion: selectedRoom.version");
    expect(conferenceRooms).toContain("Configure selected meeting");
    expect(conferenceRooms).toContain("Save native meeting");
    expect(conferenceRooms).toContain("conference-meeting-configure");
    expect(conferenceRooms).toContain("expectedVersion: selectedMeeting.version");
  });
});
