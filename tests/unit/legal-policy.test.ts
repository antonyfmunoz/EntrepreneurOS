import { describe, expect, it } from "vitest";
import { legalEnforcementActive } from "../../server/legal/policy";

describe("legal enforcement policy", () => {
  it("does not dead-end internal operator mode before public documents exist", () => {
    expect(legalEnforcementActive({ requested: true, configurationReady: false, publicPaidSaaS: false })).toBe(false);
  });

  it("still fails closed for a public paid SaaS without published documents", () => {
    expect(legalEnforcementActive({ requested: true, configurationReady: false, publicPaidSaaS: true })).toBe(true);
  });

  it("enforces published documents in either operating mode", () => {
    expect(legalEnforcementActive({ requested: true, configurationReady: true, publicPaidSaaS: false })).toBe(true);
  });
});
