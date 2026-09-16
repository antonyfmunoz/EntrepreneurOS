import { describe, expect, it } from "vitest";
import { companyFounderProfileSchema } from "../../shared/company-founder-profile";
import { suggestedTeamRosterSeats } from "../../shared/team-roster-csv";

describe("Company Mission founder-profile roster boundary", () => {
  it("keeps a staged existing-team roster separate from access while validating its eventual Org Studio shape", () => {
    expect(companyFounderProfileSchema.parse({
      operatingFormation: "existing_team",
      teamRosterPlan: {
        version: "team-roster-plan-v1",
        entries: [{
          id: "00000000-0000-4000-8000-000000000101",
          name: "Morgan Rivera",
          email: "morgan@example.com",
          sourceTitle: "Account Director",
          reportsTo: "Founder",
          seatId: null,
        }],
      },
    }).teamRosterPlan).toMatchObject({ entries: [{ seatId: null }] });
  });

  it("rejects malformed pre-graph roster entries instead of letting a later Org Studio handoff fail", () => {
    expect(companyFounderProfileSchema.safeParse({
      teamRosterPlan: {
        entries: [{
          id: "00000000-0000-4000-8000-000000000102",
          name: "",
          email: "not-an-email",
          sourceTitle: "",
          reportsTo: "",
          seatId: null,
        }],
      },
    }).success).toBe(false);
  });

  it("suggests only one exact, available role at a time without mutating the staged plan", () => {
    const entries = [
      { id: "first", name: "Morgan", email: "", sourceTitle: "Account Director", reportsTo: "", seatId: null },
      { id: "second", name: "Alex", email: "", sourceTitle: "Account Director", reportsTo: "", seatId: null },
    ];
    const suggestions = suggestedTeamRosterSeats(entries, [
      { id: "seat-1", title: "Account Director", kind: "manager" },
      { id: "seat-2", title: "Account Director", kind: "manager" },
      { id: "founder", title: "Founder", kind: "founder" },
    ], []);
    expect(Object.values(entries).every((entry) => entry.seatId === null)).toBe(true);
    expect(Array.from(suggestions.entries())).toEqual([["first", "seat-1"], ["second", "seat-2"]]);
  });
});
