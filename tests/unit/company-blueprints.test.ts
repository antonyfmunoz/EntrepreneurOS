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
      expect(blueprint.roles.find((role) => role.key === "people_talent")).toMatchObject({ kind: "functional_executive", department: "People, Talent & Culture", supervisorKey: "company_ceo" });
      expect(blueprint.roles.find((role) => role.key === "operations_administration")).toMatchObject({ kind: "functional_executive", department: "Operations, Administration & Vendor Control", supervisorKey: "company_ceo" });
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
    expect(starters).toHaveLength(9);
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
    expect(starters[4]).toMatchObject({
      key: "talent-foundation",
      ownerRoleKey: "people_talent",
      workflowTemplateKey: "capability-to-placement",
    });
    expect(starters[4].statement).toContain("Validate the offer");
    expect(starters[4].statement).toContain("does not imply an employment, compensation, or access decision");
    expect(starters[5]).toMatchObject({ key: "finance-control-foundation", ownerRoleKey: "finance_capital", workflowTemplateKey: "finance-control-cycle" });
    expect(starters[6]).toMatchObject({ key: "legal-governance-foundation", ownerRoleKey: "legal_governance", workflowTemplateKey: "policy-obligation-control" });
    expect(starters[7]).toMatchObject({ key: "vendor-control-foundation", ownerRoleKey: "operations_administration", workflowTemplateKey: "vendor-to-approved-service" });
    expect(starters[8]).toMatchObject({ key: "offer-evolution-foundation", ownerRoleKey: "growth", workflowTemplateKey: "offer-learning-loop" });
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
      "commerce:offer",
      "finance:plan",
      "finance:reconciliation",
      "docs:document",
      "crm:pipeline",
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
    expect(starters.find((starter) => starter.key === "native-offer-catalog")).toMatchObject({
      ownerRoleKey: "growth",
      data: { operatingMode: "native_eos", priceState: "unconfigured" },
    });
    expect(starters.find((starter) => starter.key === "finance-control-plan")).toMatchObject({
      ownerRoleKey: "finance_capital",
      data: { compilerStarter: true, sourceAuthority: "native_eos" },
    });
    expect(starters.find((starter) => starter.key === "finance-reconciliation-register")).toMatchObject({
      ownerRoleKey: "finance_capital",
      data: { providerReceipts: "not_asserted" },
    });
    expect(starters.find((starter) => starter.key === "governance-obligation-register")).toMatchObject({
      ownerRoleKey: "legal_governance",
      data: { reviewState: "draft" },
    });
    expect(starters.find((starter) => starter.key === "vendor-service-pipeline")).toMatchObject({
      ownerRoleKey: "operations_administration",
      data: { stages: expect.arrayContaining(["Awaiting approval"]) },
    });
  });

  it("assigns commercial native assets to the active blueprint's commercial role", () => {
    const productAssets = materializeNativeBusinessStarters({
      companyName: "Northstar Goods",
      offer: "Membership products",
      targetCustomer: "Independent creators",
      ownerRoleKey: "brand_growth",
    });
    const commercialAssets = productAssets.filter((starter) => ["commercial-pipeline", "commercial-intake", "company-site", "commercial-page", "commercial-funnel", "native-offer-catalog"].includes(starter.key));
    expect(commercialAssets.every((starter) => starter.ownerRoleKey === "brand_growth")).toBe(true);
    expect(productAssets.find((starter) => starter.key === "finance-control-plan")?.ownerRoleKey).toBe("finance_capital");
    expect(productAssets.find((starter) => starter.key === "governance-obligation-register")?.ownerRoleKey).toBe("legal_governance");
    expect(productAssets.find((starter) => starter.key === "vendor-service-pipeline")?.ownerRoleKey).toBe("operations_administration");
  });

  it("maps role-designer labels to the canonical tool keys used by policy enforcement", () => {
    expect(canonicalToolEntitlements([
      "CRM", "Documents", "Content Calendar", "Campaigns", "Roadmap", "Learning", "Development / Progression", "CRM",
    ])).toEqual(["crm", "docs", "calendar", "ads", "projects", "learning", "progression"]);
  });

  it("gives every company an accountable talent function with native tools for an agent-first or hybrid team", () => {
    for (const blueprint of companyBlueprints) {
      const people = blueprint.roles.find((role) => role.key === "people_talent");
      expect(people?.agentName).toBe("People & Talent Agent");
      expect(canonicalToolEntitlements(people?.tools || [])).toEqual(expect.arrayContaining([
        "forms", "calendar", "messages", "docs", "tables", "workflows", "analytics", "learning", "progression",
      ]));
    }
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
      const talent = blueprint.starters.find((starter) => starter.key === "talent-foundation");
      expect(onboarding).toBeDefined();
      expect(reputation).toBeDefined();
      expect(talent).toBeDefined();
      expect(blueprint.roles.some((role) => role.key === onboarding?.ownerRoleKey)).toBe(true);
      expect(blueprint.roles.some((role) => role.key === reputation?.ownerRoleKey)).toBe(true);
      expect(blueprint.roles.some((role) => role.key === talent?.ownerRoleKey)).toBe(true);
      expect(canonicalToolEntitlements(onboarding?.tools || [])).toEqual(expect.arrayContaining(["crm", "projects", "calendar"]));
      expect(canonicalToolEntitlements(reputation?.tools || [])).toEqual(expect.arrayContaining(["crm", "reputation", "projects"]));
      expect(canonicalToolEntitlements(talent?.tools || [])).toEqual(expect.arrayContaining(["forms", "calendar", "learning", "progression"]));
      const onboardingOwner = blueprint.roles.find((role) => role.key === onboarding?.ownerRoleKey);
      const reputationOwner = blueprint.roles.find((role) => role.key === reputation?.ownerRoleKey);
      const talentOwner = blueprint.roles.find((role) => role.key === talent?.ownerRoleKey);
      expect(canonicalToolEntitlements(onboardingOwner?.tools || [])).toEqual(expect.arrayContaining(canonicalToolEntitlements(onboarding?.tools || [])));
      expect(canonicalToolEntitlements(reputationOwner?.tools || [])).toEqual(expect.arrayContaining(canonicalToolEntitlements(reputation?.tools || [])));
      expect(canonicalToolEntitlements(talentOwner?.tools || [])).toEqual(expect.arrayContaining(canonicalToolEntitlements(talent?.tools || [])));
    }
  });

  it("compiles finance, governance, vendor, and offer-evolution controls into every company rather than leaving the control plane as role descriptions", () => {
    for (const blueprint of companyBlueprints) {
      const finance = blueprint.starters.find((starter) => starter.key === "finance-control-foundation");
      const legal = blueprint.starters.find((starter) => starter.key === "legal-governance-foundation");
      const vendor = blueprint.starters.find((starter) => starter.key === "vendor-control-foundation");
      const offerEvolution = blueprint.starters.find((starter) => starter.key === "offer-evolution-foundation");
      expect(finance).toMatchObject({ ownerRoleKey: "finance_capital", workflowTemplateKey: "finance-control-cycle" });
      expect(legal).toMatchObject({ ownerRoleKey: "legal_governance", workflowTemplateKey: "policy-obligation-control" });
      expect(vendor).toMatchObject({ ownerRoleKey: "operations_administration", workflowTemplateKey: "vendor-to-approved-service" });
      expect(offerEvolution?.workflowTemplateKey).toBe("offer-learning-loop");
      for (const starter of [finance, legal, vendor, offerEvolution]) {
        const owner = blueprint.roles.find((role) => role.key === starter?.ownerRoleKey);
        expect(owner).toBeDefined();
        expect(canonicalToolEntitlements(owner?.tools || [])).toEqual(
          expect.arrayContaining(canonicalToolEntitlements(starter?.tools || [])),
        );
      }
    }
  });

  it("repairs only recognized legacy labels while preserving custom role language for review", () => {
    expect(reconcileLegacyToolEntitlements([
      "CRM", "Content Calendar", "Client scorecard", "CRM",
    ])).toEqual(["crm", "calendar", "Client scorecard"]);
  });
});
