import { describe, expect, it } from "vitest";
import { primaryVerifiedEmail, verifiedEmailForLegacyClaim } from "../../server/security/legacy-principal-reconciliation";

describe("legacy principal reconciliation", () => {
  it("selects only a verified primary Clerk address", () => {
    expect(primaryVerifiedEmail("primary", [
      { id: "secondary", emailAddress: "verified-secondary@example.com", verification: { status: "verified" } },
      { id: "primary", emailAddress: " Primary@Example.com ", verification: { status: "verified" } },
    ])).toBe("primary@example.com");
    expect(primaryVerifiedEmail("primary", [
      { id: "primary", emailAddress: "unverified@example.com", verification: { status: "unverified" } },
    ])).toBeUndefined();
  });
  it("accepts only a verified Clerk address matching the local principal", () => {
    expect(
      verifiedEmailForLegacyClaim(" Owner@Example.com ", [
        { emailAddress: "other@example.com", verification: { status: "verified" } },
        { emailAddress: "owner@example.com", verification: { status: "verified" } },
      ]),
    ).toBe("owner@example.com");
  });

  it("rejects unverified or differently addressed identities", () => {
    expect(
      verifiedEmailForLegacyClaim("owner@example.com", [
        { emailAddress: "owner@example.com", verification: { status: "unverified" } },
        { emailAddress: "different@example.com", verification: { status: "verified" } },
      ]),
    ).toBeUndefined();
  });
});
