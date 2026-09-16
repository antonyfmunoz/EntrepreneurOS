import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const conferenceRooms = readFileSync(new URL("../../client/src/components/conference-room-control-center.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");
const instrumentRuntime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");

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

  it("turns a decision into attendee-bound accountable work instead of leaving it as a static note", () => {
    expect(conferenceRooms).toContain("Decision → accountable work");
    expect(conferenceRooms).toContain("Create linked Work Packet");
    expect(conferenceRooms).toContain("conference-rooms/decisions/${followOnDecision.id}/work-packet");
    expect(conferenceRooms).toContain("Decision-maker");
    expect(runtime).toContain('conference-rooms/decisions/:decisionId/work-packet');
    expect(runtime).toContain("conference_meeting_participant_required");
    expect(runtime).toContain("conference_work_owner_invalid");
    expect(runtime).toContain("conference_room.decision.work_packet_created");
    expect(instrumentRuntime).toContain("assertNativeConferenceRoomCreate");
    expect(instrumentRuntime).toContain("conference_decision_maker_invalid");
  });
});
