import { describe, expect, it } from "vitest";
import { companyMissionStatus, nextCompanyMission, parseAssumedBusinessNames } from "../../shared/company-mission";

describe("Company Mission Journey", () => {
  it("uses one adaptive journey and keeps integrations optional", () => {
    const input = {
      portfolioId: "1", companyName: "Empyrean Creative", stage: "revenue", businessModel: "services",
      offer: "Revenue recovery", targetCustomer: "Professional services firms", assistantName: "Henna",
      founderVision: "Build enduring creative institutions", goals: "Close three retained clients", formation: "agent_first" as const,
    };
    const status = companyMissionStatus(input);
    expect(status).toHaveLength(7);
    expect(status.every((mission) => mission.complete)).toBe(true);
    expect(nextCompanyMission(input)).toBeNull();
  });

  it("requires operating reality before it unlocks downstream work", () => {
    expect(nextCompanyMission({ portfolioId: "1" })?.key).toBe("company_identity");
  });

  it("normalizes assumed business names without duplicates", () => {
    expect(parseAssumedBusinessNames("Empyrean Studios, Empyrean Studios,  Empyrean Creative "))
      .toEqual(["Empyrean Studios", "Empyrean Creative"]);
  });
});
