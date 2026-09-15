import { describe, expect, it } from "vitest";
import { companyBlueprintForBusinessModel, companyBlueprints } from "../../shared/company-blueprints";

describe("company operating blueprints", () => {
  it("maps business-model variables to one editable company formation", () => {
    expect(companyBlueprintForBusinessModel("services").key).toBe("service_studio");
    expect(companyBlueprintForBusinessModel("saas").key).toBe("software_company");
    expect(companyBlueprintForBusinessModel("unknown").key).toBe("hybrid_company");
  });

  it("keeps every blueprint rooted in a Company CEO role with native tools", () => {
    for (const blueprint of companyBlueprints) {
      const ceo = blueprint.roles.find((role) => role.key === "company_ceo");
      expect(ceo?.kind).toBe("company_ceo");
      expect(ceo?.tools.length).toBeGreaterThan(0);
    }
  });
});
