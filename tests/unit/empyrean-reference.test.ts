import { describe, expect, it } from "vitest";
import {
  EMPYREAN_COMPANY_PACKAGE,
  EMPYREAN_REFERENCE_PACKAGE,
} from "../../server/reference-instances/empyrean-studios";

describe("Empyrean Studios reference package", () => {
  it("uses the current canonical company identity and complete founding chart", () => {
    expect(EMPYREAN_REFERENCE_PACKAGE).toMatchObject({
      organizationKey: "ORG-EMPYREAN-STUDIOS",
      canonicalName: "Empyrean Studios",
      version: "2026-08-22",
    });
    expect(EMPYREAN_REFERENCE_PACKAGE.seats).toHaveLength(8);
    expect(new Set(EMPYREAN_REFERENCE_PACKAGE.seats.map((seat) => seat.key)).size).toBe(8);
    expect(EMPYREAN_REFERENCE_PACKAGE.seats.filter((seat) => seat.humanOccupied).map((seat) => seat.key)).toEqual([
      "company-ceo",
      "account-executive-i",
    ]);
    expect(EMPYREAN_REFERENCE_PACKAGE.seats.some((seat) => /jarvis/i.test(seat.agentName))).toBe(false);
    expect(EMPYREAN_COMPANY_PACKAGE.companyManifest.value).toMatchObject({
      legalName: "Empyrean Creative LLC",
      operatingName: "Empyrean Studios",
      lifecycleStage: "validation",
    });
  });

  it("fails closed on activation and binds every assertion to current Notion sources", () => {
    expect(EMPYREAN_REFERENCE_PACKAGE.activationBlockers).toHaveLength(7);
    expect(EMPYREAN_REFERENCE_PACKAGE.activationBlockers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/operative agreement/i),
        expect.stringMatching(/GoHighLevel/i),
        expect.stringMatching(/Stripe/i),
        expect.stringMatching(/DocuSign/i),
        expect.stringMatching(/rehearsal/i),
      ]),
    );
    expect(Object.values(EMPYREAN_REFERENCE_PACKAGE.sources)).toHaveLength(5);
    expect(Object.values(EMPYREAN_REFERENCE_PACKAGE.sources).every((source) => source.startsWith("https://app.notion.com/"))).toBe(true);
  });
});
