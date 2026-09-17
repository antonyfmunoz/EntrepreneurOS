import { describe, expect, it } from "vitest";
import { compiledOperatingFormation, compileCompanyBlueprintStarters, companyBlueprintForBusinessModel, companyBlueprints } from "../../shared/company-blueprints";
import { materializeNativeWorkflowStarter } from "../../shared/native-workflow-starters";
import { materializeNativeBusinessStarters } from "../../shared/native-business-starters";
import { allowedSurfacesForRoleTools, canonicalToolEntitlements, reconcileLegacyToolEntitlements, seatCreateSchema } from "../../shared/eos-runtime";

describe("company operating blueprints", () => {
  it("maps business-model variables to one editable company formation", () => {
    expect(companyBlueprintForBusinessModel("services").key).toBe("service_studio");
    expect(companyBlueprintForBusinessModel("saas").key).toBe("software_company");
    expect(companyBlueprintForBusinessModel("unknown").key).toBe("hybrid_company");
  });

  it("compiles the same institutional graph into a governed agent-first or team transition", () => {
    expect(compiledOperatingFormation({ formation: "agent_first" })).toMatchObject({
      formation: "agent_first",
      agentSeatMode: "autonomous",
      teamReconciliation: "not_required",
      transitionState: "agent_operated",
    });
    expect(compiledOperatingFormation({
      formation: "existing_team",
      teamSnapshot: "Founder; account director; two delivery specialists",
    })).toMatchObject({
      formation: "existing_team",
      agentSeatMode: "assistant_after_human_assignment",
      teamReconciliation: "required",
      transitionState: "team_mapping_required",
      teamSnapshot: "Founder; account director; two delivery specialists",
    });
  });

  it("keeps every blueprint rooted in a Company CEO role with native tools", () => {
    for (const blueprint of companyBlueprints) {
      const ceo = blueprint.roles.find((role) => role.key === "company_ceo");
      expect(ceo).toMatchObject({ kind: "company_ceo", department: "Executive" });
      expect(ceo?.tools.length).toBeGreaterThan(0);
      expect(blueprint.roles.find((role) => role.key === "finance_capital")).toMatchObject({ kind: "functional_executive", department: "Finance", supervisorKey: "company_ceo" });
      expect(blueprint.roles.find((role) => role.key === "legal_governance")).toMatchObject({ kind: "functional_executive", department: "Legal & Governance", supervisorKey: "company_ceo" });
      expect(blueprint.roles.every((role) => role.department.trim().length > 0)).toBe(true);
    }
  });

  it("keeps department ownership explicit for both compiled and custom organizational roles", () => {
    const customSeat = seatCreateSchema.parse({
      title: "Client Delivery Lead",
      department: "  Operations & Delivery  ",
      kind: "functional_executive",
      agentName: "Delivery Role Agent",
      mandate: "Own reliable client delivery",
      authority: {},
      toolEntitlements: [],
    });
    expect(customSeat.department).toBe("Operations & Delivery");

    const defaultedSeat = seatCreateSchema.parse({
      title: "Founder",
      kind: "company_ceo",
      agentName: "Founder Role Agent",
      mandate: "Set company direction",
      authority: {},
      toolEntitlements: [],
    });
    expect(defaultedSeat.department).toBe("General Management");
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
    expect(starters).toHaveLength(4);
    expect(starters[0]).toMatchObject({
      key: "commercial-foundation",
      ownerRoleKey: "growth",
      workflowTemplateKey: "lead-to-discovery",
      variables: { offer: "Revenue recovery service", targetCustomer: "B2B service companies" },
    });
    expect(starters[0].statement).toContain("Revenue recovery service");
    expect(starters[0].statement).toContain("B2B service companies");
    expect(starters[1].statement).toContain("Validate the offer");
    expect(starters[2]).toMatchObject({
      key: "client-onboarding-foundation",
      ownerRoleKey: "client_success",
      workflowTemplateKey: "client-onboarding",
    });
    expect(starters[2].statement).toContain("Revenue recovery service");
    expect(starters[2].statement).toContain("without implying that commercial authorization already exists");
    expect(starters[3]).toMatchObject({
      key: "reputation-foundation",
      ownerRoleKey: "client_success",
      workflowTemplateKey: "reputation-follow-through",
    });
    expect(starters[3].statement).toContain("B2B service companies");
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
      "websites:page",
      "websites:funnel",
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
    expect(starters.find((starter) => starter.key === "commercial-page")?.data).toMatchObject({
      publicPage: true,
      siteObjectId: { starterAssetId: "company-site" },
      primaryCtaTarget: "capture_form",
      primaryCtaTargetId: { starterAssetId: "commercial-intake" },
      path: "/start",
    });
    expect(starters.find((starter) => starter.key === "commercial-funnel")?.data).toMatchObject({
      publicFunnel: true,
      captureFormObjectId: { starterAssetId: "commercial-intake" },
    });
  });

  it("assigns commercial native assets to the active blueprint's commercial role", () => {
    const productAssets = materializeNativeBusinessStarters({
      companyName: "Northstar Goods",
      offer: "Membership products",
      targetCustomer: "Independent creators",
      ownerRoleKey: "brand_growth",
    });
    expect(productAssets.every((starter) => starter.ownerRoleKey === "brand_growth")).toBe(true);
    expect(companyBlueprintForBusinessModel("product").roles.some((role) => role.key === productAssets[0].ownerRoleKey)).toBe(true);
  });

  it("maps role-designer labels to the canonical tool keys used by policy enforcement", () => {
    expect(canonicalToolEntitlements([
      "CRM", "Documents", "Content Calendar", "Campaigns", "Roadmap", "CRM",
    ])).toEqual(["crm", "docs", "calendar", "ads", "projects"]);
  });

  it("equips compiled growth roles to operate the native demand engine they own", () => {
    for (const blueprint of companyBlueprints) {
      const growth = blueprint.roles.find((role) => ["growth", "brand_growth"].includes(role.key));
      if (!growth) continue;
      const nativeTools = canonicalToolEntitlements(growth.tools);
      expect(nativeTools).toEqual(expect.arrayContaining(["crm", "forms", "websites"]));
      const commercialStarter = blueprint.starters.find((starter) => starter.ownerRoleKey === growth.key);
      expect(canonicalToolEntitlements(commercialStarter?.tools || [])).toEqual(
        expect.arrayContaining(["crm", "forms", "websites"]),
      );
    }
  });

  it("compiles the client lifecycle for every business model rather than leaving delivery and feedback outside the box", () => {
    for (const blueprint of companyBlueprints) {
      const onboarding = blueprint.starters.find((starter) => starter.key === "client-onboarding-foundation");
      const reputation = blueprint.starters.find((starter) => starter.key === "reputation-foundation");
      expect(onboarding).toBeDefined();
      expect(reputation).toBeDefined();
      expect(blueprint.roles.some((role) => role.key === onboarding?.ownerRoleKey)).toBe(true);
      expect(blueprint.roles.some((role) => role.key === reputation?.ownerRoleKey)).toBe(true);
      expect(canonicalToolEntitlements(onboarding?.tools || [])).toEqual(expect.arrayContaining(["crm", "projects", "calendar"]));
      expect(canonicalToolEntitlements(reputation?.tools || [])).toEqual(expect.arrayContaining(["crm", "reputation", "projects"]));
      const onboardingOwner = blueprint.roles.find((role) => role.key === onboarding?.ownerRoleKey);
      const reputationOwner = blueprint.roles.find((role) => role.key === reputation?.ownerRoleKey);
      expect(canonicalToolEntitlements(onboardingOwner?.tools || [])).toEqual(expect.arrayContaining(canonicalToolEntitlements(onboarding?.tools || [])));
      expect(canonicalToolEntitlements(reputationOwner?.tools || [])).toEqual(expect.arrayContaining(canonicalToolEntitlements(reputation?.tools || [])));
    }
  });

  it("repairs only recognized legacy labels while preserving custom role language for review", () => {
    expect(reconcileLegacyToolEntitlements([
      "CRM", "Content Calendar", "Client scorecard", "CRM",
    ])).toEqual(["crm", "calendar", "Client scorecard"]);
  });
});
