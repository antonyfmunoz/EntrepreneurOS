import { describe, expect, it } from "vitest";
import { compileCompanyBlueprintStarters, companyBlueprintForBusinessModel, companyBlueprints } from "../../shared/company-blueprints";

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

  it("turns founder-entered variables into company-specific native starter artifacts", () => {
    const blueprint = companyBlueprintForBusinessModel("services");
    const starters = compileCompanyBlueprintStarters(blueprint, {
      offer: "Revenue recovery service",
      targetCustomer: "B2B service companies",
      goals: "Validate the offer\nClose the first three clients",
    });
    expect(starters).toHaveLength(2);
    expect(starters[0]).toMatchObject({
      key: "commercial-foundation",
      ownerRoleKey: "growth",
      workflowTemplateKey: "lead-to-discovery",
      variables: { offer: "Revenue recovery service", targetCustomer: "B2B service companies" },
    });
    expect(starters[0].statement).toContain("Revenue recovery service");
    expect(starters[0].statement).toContain("B2B service companies");
    expect(starters[1].statement).toContain("Validate the offer");
  });
});
