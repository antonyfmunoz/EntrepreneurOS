import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const conferenceRooms = readFileSync(new URL("../../client/src/components/conference-room-control-center.tsx", import.meta.url), "utf8");

describe("native Conference Rooms workspace", () => {
  it("makes the existing governed room control available from the Work Room", () => {
    expect(overlay).toContain("ConferenceRoomControlCenter");
    expect(overlay).toContain("mayOperateConferenceRooms");
    expect(overlay).toContain('canUseInstrument("conference_rooms")');
    expect(overlay).toContain('toolEntitlements.has("conference_rooms")');
  });

  it("keeps the room native and bound to meeting, decision, and authority records", () => {
    expect(conferenceRooms).toContain('instrumentKey: "conference_rooms"');
    expect(conferenceRooms).toContain('objectType: "meeting"');
    expect(conferenceRooms).toContain('objectType: "decision"');
    expect(conferenceRooms).toContain("Hierarchy and authority remain intact");
  });
});
