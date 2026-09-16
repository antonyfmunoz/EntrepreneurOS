import { describe, expect, it } from "vitest";
import { compileCompanyBlueprintStarters, companyBlueprintForBusinessModel, companyBlueprints } from "../../shared/company-blueprints";
import { materializeNativeWorkflowStarter } from "../../shared/native-workflow-starters";
import { materializeNativeBusinessStarters } from "../../shared/native-business-starters";
import { allowedSurfacesForRoleTools, canonicalToolEntitlements, reconcileLegacyToolEntitlements } from "../../shared/eos-runtime";

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
      expect(blueprint.roles.find((role) => role.key === "finance_capital")).toMatchObject({ kind: "functional_executive", supervisorKey: "company_ceo" });
      expect(blueprint.roles.find((role) => role.key === "legal_governance")).toMatchObject({ kind: "functional_executive", supervisorKey: "company_ceo" });
    }
  });

  it("gives a finance-equipped role the capital surface without opening it to unrelated roles", () => {
    expect(allowedSurfacesForRoleTools("functional_executive", ["Finance"])).toContain("capital");
    expect(allowedSurfacesForRoleTools("functional_executive", ["Documents"])).not.toContain("capital");
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

  it("turns the matching shared workflow pattern into an editable company-specific native draft", () => {
    const workflow = materializeNativeWorkflowStarter("lead-to-discovery", {
      companyName: "Empyrean Studios",
      offer: "Revenue recovery service",
      targetCustomer: "B2B service companies",
      goal: "Validate the offer",
    });
    expect(workflow.name).toContain("Empyrean Studios");
    expect(workflow.name).toContain("Revenue recovery service");
    expect(workflow.purpose).toContain("B2B service companies");
    expect(workflow.steps.map((step) => step.toolKey)).toEqual(["crm", "crm", "calendar"]);
    expect(workflow.steps.some((step) => step.actionKind === "approval")).toBe(false);
  });

  it("materializes native operating tool drafts from the same company variables", () => {
    const starters = materializeNativeBusinessStarters({
      companyName: "Empyrean Studios",
      offer: "Revenue recovery service",
      targetCustomer: "B2B service companies",
    });
    expect(starters.map((starter) => `${starter.instrumentKey}:${starter.objectType}`)).toEqual([
      "crm:pipeline",
      "forms:form",
      "websites:site",
    ]);
    expect(starters.find((starter) => starter.key === "commercial-pipeline")).toMatchObject({
      title: "Revenue recovery service pipeline",
      ownerRoleKey: "growth",
      data: { compilerStarter: true, stages: ["Qualified", "Discovery", "Proposal", "Won", "Lost"] },
    });
    expect(starters.find((starter) => starter.key === "commercial-intake")?.data).toMatchObject({
      publicCapture: true,
      consentVersion: "native-eos-lead-capture-v1",
    });
  });

  it("maps role-designer labels to the canonical tool keys used by policy enforcement", () => {
    expect(canonicalToolEntitlements([
      "CRM", "Documents", "Content Calendar", "Campaigns", "Roadmap", "CRM",
    ])).toEqual(["crm", "docs", "calendar", "ads", "projects"]);
  });

  it("repairs only recognized legacy labels while preserving custom role language for review", () => {
    expect(reconcileLegacyToolEntitlements([
      "CRM", "Content Calendar", "Client scorecard", "CRM",
    ])).toEqual(["crm", "calendar", "Client scorecard"]);
  });
});
