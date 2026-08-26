import { describe, expect, it } from "vitest";
import {
  approvalDecisionSchema,
  authoritySubjectCreateSchema,
  authoritySubjectIsEffective,
  authorityGrantCoversResource,
  authorityGrantCreateSchema,
  buildAdvisorCouncil,
  allowedSurfacesFor,
  canTransitionManifest,
  canTransitionMetricOutcome,
  canTransitionObjective,
  canTransitionRiskControl,
  canTransitionSharedService,
  canTransitionCommercialCase,
  canTransitionCapability,
  canTransitionOffer,
  canTransitionStakeholder,
  canTransitionValueFlow,
  canTransitionProcessQualification,
  canTransitionProcessRelease,
  canTransitionResource,
  canTransitionFinancialSource,
  canTransitionFinancialPlan,
  canTransitionCapitalAllocation,
  canSeeSeat,
  canTransitionWorkPacket,
  evidenceCreateSchema,
  effectiveAuthorityFor,
  eosActiveModules,
  eosModulesForRole,
  manifestInputSchema,
  metricOutcomeCreateSchema,
  commercialCaseCreateSchema,
  capabilityCreateSchema,
  nextUsableSurfaceFor,
  objectiveCreateSchema,
  offerProgramCreateSchema,
  processCreateSchema,
  positionAgreementContractSchema,
  roleAssignmentCreateSchema,
  roleOperatingPackContractSchema,
  rolePracticeActionFor,
  riskControlCreateSchema,
  resourceCreateSchema,
  financialSourceCreateSchema,
  financialPlanCreateSchema,
  capitalAllocationCreateSchema,
  systemRegistryCreateSchema,
  integrationBindingCreateSchema,
  toolEntitlementCreateSchema,
  automationCreateSchema,
  integrationHealthObservationCreateSchema,
  canTransitionSystemLifecycle,
  canTransitionEntitlement,
  canTransitionAutomation,
  integrationActivationIssues,
  entitlementActivationIssues,
  workforceReviewCreateSchema,
  workforceReviewUpdateSchema,
  workforceReviewDialogueCreateSchema,
  developmentPlanCreateSchema,
  roleSupportPlanCreateSchema,
  careerPathCreateSchema,
  successionHypothesisCreateSchema,
  canTransitionWorkforceReview,
  canTransitionDevelopmentPlan,
  canTransitionRoleSupportPlan,
  canTransitionCareerPath,
  canTransitionSuccession,
  workforceReviewAdvancementIssues,
  developmentPlanAdvancementIssues,
  roleSupportPlanAdvancementIssues,
  careerPathAdvancementIssues,
  successionAdvancementIssues,
  talentNeedCreateSchema,
  talentApplicationCreateSchema,
  talentApplicationUpdateSchema,
  talentAssessmentCreateSchema,
  talentReviewPacketCreateSchema,
  talentTrialCreateSchema,
  talentCandidateEvidencePromotionSchema,
  talentPlacementCreateSchema,
  canTransitionTalentNeed,
  canTransitionTalentApplication,
  canTransitionTalentAssessment,
  canTransitionTalentReviewPacket,
  canTransitionTalentTrial,
  canTransitionTalentPlacement,
  talentApplicationAdvancementIssues,
  talentAssessmentAdvancementIssues,
  talentReviewPacketReadinessIssues,
  talentTrialAdvancementIssues,
  talentPlacementAdvancementIssues,
  membershipInvitationCreateSchema,
  stakeholderCreateSchema,
  valueFlowCreateSchema,
  sharedServiceRequestCreateSchema,
  sharedServiceDispositionSchema,
  selectAdvisorSeats,
  selectOperatingAssignment,
  workPacketCreateSchema,
  visibilityPolicyFor,
} from "../../shared/eos-runtime";
import { defaultAuthorityClassesForRole } from "../../server/role-kernel";

const manifest = {
  purpose: "Build a repeatable organization",
  stage: "MVP",
  offer: "Business operating system",
  targetCustomer: "Founder-led companies",
  goals: ["Complete the first governed value loop"],
  enabledModules: Array.from({ length: 14 }, (_, index) => index + 1),
  ownerSeat: { title: "Founder / Owner", authority: "owner" as const },
  operatingCadence: "weekly" as const,
};

describe("EOS overlay runtime contracts", () => {
  it("accepts the fourteen-module overlay manifest", () => {
    expect(manifestInputSchema.parse(manifest).enabledModules).toHaveLength(14);
  });

  it("rejects a manifest without a goal or enabled module", () => {
    expect(
      manifestInputSchema.safeParse({
        ...manifest,
        goals: [],
        enabledModules: [],
      }).success,
    ).toBe(false);
  });

  it("defaults a manual Work Packet to a safe local lifecycle", () => {
    const packet = workPacketCreateSchema.parse({
      title: "Review offer",
      objective: "Approve the initial offer before outreach",
    });
    expect(packet.requiresApproval).toBe(false);
    expect(packet.source).toBe("manual");
    expect(packet.evidenceRequirements).toEqual([]);
  });

  it("enforces the Work Packet transition graph", () => {
    expect(canTransitionWorkPacket("ready", "in_progress")).toBe(true);
    expect(canTransitionWorkPacket("in_progress", "in_review")).toBe(true);
    expect(canTransitionWorkPacket("in_review", "completed")).toBe(true);
    expect(canTransitionWorkPacket("ready", "completed")).toBe(false);
    expect(canTransitionWorkPacket("completed", "in_progress")).toBe(false);
  });

  it("enforces the dual-company shared-service lifecycle", () => {
    expect(
      canTransitionSharedService(
        "awaiting_beneficiary_approval",
        "provider_review",
      ),
    ).toBe(true);
    expect(
      canTransitionSharedService("provider_review", "provider_accepted"),
    ).toBe(true);
    expect(
      canTransitionSharedService("provider_accepted", "in_progress"),
    ).toBe(true);
    expect(canTransitionSharedService("in_progress", "delivered")).toBe(true);
    expect(
      canTransitionSharedService("delivered", "rework_requested"),
    ).toBe(true);
    expect(
      canTransitionSharedService("rework_requested", "delivered"),
    ).toBe(true);
    expect(canTransitionSharedService("delivered", "accepted")).toBe(true);
    expect(canTransitionSharedService("accepted", "in_progress")).toBe(false);
    expect(
      canTransitionSharedService(
        "awaiting_beneficiary_approval",
        "provider_accepted",
      ),
    ).toBe(false);
  });

  it("requires explicit shared-service scope and final cost attribution", () => {
    expect(
      sharedServiceRequestCreateSchema.safeParse({
        providerCompanyId: 2,
        beneficiaryRelationshipId: "00000000-0000-4000-8000-000000000001",
        title: "Produce campaign assets",
        scope: "Create the approved bounded campaign asset package.",
        beneficiary: "AFM campaign launch",
        inputs: ["Approved brief"],
        acceptanceCriteria: "All named assets pass the approved review checklist.",
        dueAt: "2026-09-01T12:00:00.000Z",
        costCapacityTreatment: "Reserve two production days at internal cost.",
      }).success,
    ).toBe(true);
    expect(
      sharedServiceDispositionSchema.safeParse({
        decision: "accept",
        disposition: "All acceptance criteria passed.",
        evidenceIds: ["00000000-0000-4000-8000-000000000002"],
      }).success,
    ).toBe(false);
    expect(
      sharedServiceDispositionSchema.safeParse({
        decision: "request_rework",
        disposition: "Correct the named audio defect.",
        evidenceIds: ["00000000-0000-4000-8000-000000000002"],
      }).success,
    ).toBe(true);
  });

  it("accepts explicit approval decisions and typed evidence", () => {
    expect(
      approvalDecisionSchema.parse({ decision: "approved" }).decision,
    ).toBe("approved");
    expect(
      evidenceCreateSchema.safeParse({
        workPacketId: "d61f2233-992e-4da7-a072-3d19afc5ff71",
        evidenceType: "provider_receipt",
        title: "Gmail draft created",
      }).success,
    ).toBe(true);
  });

  it("compiles exactly fifteen founder-profiled advisory seats behind the Executive Assistant", () => {
    const council = buildAdvisorCouncil({
      founderName: "Test Founder",
      portfolioName: "Test Portfolio",
      companyName: "Test Company",
      founderProfile: {
        vision: "Build durable institutions",
        values: "Proof and sovereignty",
        decisionStyle: "Facts, options, risks, recommendation",
      },
      companyGoals: "Complete the first governed value loop",
    });
    expect(council.count).toBe(15);
    expect(council.advisors).toHaveLength(15);
    expect(new Set(council.advisors.map((advisor) => advisor.id)).size).toBe(
      15,
    );
    expect(council.founderFacingAgent).toBe("executive_assistant");
    expect(council.personalization.founderVision).toBe(
      "Build durable institutions",
    );
  });

  it("defines a descending organizational visibility ceiling without bypassing restricted grants", () => {
    expect(canSeeSeat("founder", "manager")).toBe(true);
    expect(canSeeSeat("manager", "individual_contributor")).toBe(true);
    expect(canSeeSeat("individual_contributor", "manager")).toBe(false);
    expect(visibilityPolicyFor("founder").cannotSee.join(" ")).toContain(
      "explicit grant",
    );
  });

  it("requires manifests to pass the full compiler lifecycle before activation", () => {
    expect(canTransitionManifest("draft", "diagnostic")).toBe(true);
    expect(canTransitionManifest("draft", "active")).toBe(false);
    expect(canTransitionManifest("verifying", "active")).toBe(true);
    expect(canTransitionManifest("active", "rolled_back")).toBe(true);
  });

  it("compiles product surfaces by seat instead of rendering one universal dashboard", () => {
    expect(allowedSurfacesFor("founder")).toContain("portfolio-map");
    expect(allowedSurfacesFor("founder")).toContain("modules");
    expect(allowedSurfacesFor("manager")).toContain("review");
    expect(allowedSurfacesFor("manager")).toContain("talent");
    expect(allowedSurfacesFor("manager")).not.toContain("capital");
    expect(allowedSurfacesFor("individual_contributor")).toEqual(
      expect.arrayContaining(["my-role", "work-room", "academy"]),
    );
    expect(allowedSurfacesFor("individual_contributor")).not.toContain(
      "talent",
    );
  });

  it("routes all fourteen active modules into usable governed overlay surfaces", () => {
    expect(eosActiveModules).toHaveLength(14);
    expect(eosActiveModules.map((module) => module.id)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    expect(
      eosActiveModules.every(
        (module) =>
          module.missionTitle &&
          module.missionObjective &&
          module.evidenceRequirement &&
          module.fallback,
      ),
    ).toBe(true);
    expect(
      eosActiveModules.every((module) =>
        allowedSurfacesFor("founder").includes(module.operatingSurface),
      ),
    ).toBe(true);
    expect(eosModulesForRole("external").map((module) => module.id)).toEqual([
      6,
    ]);
    expect(
      eosModulesForRole("manager").every((module) =>
        ["operations", "work-room"].includes(module.operatingSurface),
      ),
    ).toBe(true);
  });

  it("never offers a role a next-action surface outside its compiled authority", () => {
    expect(nextUsableSurfaceFor("founder", "organization_setup")).toBe(
      "organization",
    );
    expect(nextUsableSurfaceFor("manager", "organization_setup")).toBe(
      "intelligence",
    );
    expect(nextUsableSurfaceFor("individual_contributor", "new_work")).toBe(
      "intelligence",
    );
    expect(nextUsableSurfaceFor("external", "new_work")).toBe("my-role");
    for (const role of [
      "founder",
      "portfolio_executive",
      "company_ceo",
      "functional_executive",
      "manager",
      "individual_contributor",
      "external",
    ] as const) {
      for (const reason of [
        "organization_setup",
        "approval",
        "active_work",
        "new_work",
      ] as const) {
        expect(allowedSurfacesFor(role)).toContain(
          nextUsableSurfaceFor(role, reason),
        );
      }
    }
  });

  it("keeps Academy practice inside the seat's work-creation authority", () => {
    expect(rolePracticeActionFor("founder", false)).toBe("prepare_work");
    expect(rolePracticeActionFor("manager", true)).toBe("prepare_work");
    expect(rolePracticeActionFor("individual_contributor", true)).toBe(
      "open_assigned_work",
    );
    expect(rolePracticeActionFor("individual_contributor", false)).toBe(
      "request_supervisor_approval",
    );
  });

  it("validates canonical command records and their irreversible lifecycle boundaries", () => {
    expect(
      objectiveCreateSchema.parse({
        title: "Reach repeatable delivery",
        statement: "Three consecutive cohorts meet acceptance",
        recordType: "objective",
      }),
    ).toMatchObject({ priority: "medium", classification: "internal" });
    expect(
      metricOutcomeCreateSchema.safeParse({
        title: "Accepted outcomes",
        recordType: "target",
        targetValue: 95,
        unitCurrency: "%",
      }).success,
    ).toBe(true);
    expect(
      riskControlCreateSchema.safeParse({
        title: "Capacity concentration",
        recordType: "risk",
        descriptionCauseEventImpact:
          "One seat owns every critical delivery dependency",
      }).success,
    ).toBe(true);
    expect(canTransitionObjective("proposed", "active")).toBe(true);
    expect(canTransitionObjective("achieved", "active")).toBe(false);
    expect(canTransitionMetricOutcome("proposed", "defined")).toBe(true);
    expect(canTransitionMetricOutcome("verified", "active")).toBe(false);
    expect(canTransitionRiskControl("identified", "under_assessment")).toBe(
      true,
    );
    expect(
      canTransitionRiskControl("satisfied_closed", "treating_in_progress"),
    ).toBe(false);
  });

  it("validates the canonical stakeholder and commercial graph", () => {
    const party = stakeholderCreateSchema.parse({
      name: "Acme",
      partyType: "organization",
      identityReference: "crm:acme-1",
    });
    expect(party).toMatchObject({
      classification: "internal",
      sourceAuthority: "native_eos",
    });
    expect(
      stakeholderCreateSchema.safeParse({
        name: "Acme",
        partyType: "organization",
        identityReference: "crm:acme-1",
        externalId: "acme-1",
      }).success,
    ).toBe(false);
    expect(
      offerProgramCreateSchema.safeParse({
        name: "Outcome Sprint",
        offerType: "service",
        problemNeed: "Slow validation",
        promiseOutcome: "Evidence-backed decision",
      }).success,
    ).toBe(true);
    expect(
      commercialCaseCreateSchema.safeParse({
        title: "Acme validation",
        stakeholderIds: ["11111111-1111-4111-8111-111111111111"],
        valueEstimate: 12000,
        probabilityConfidence: 60,
      }).success,
    ).toBe(true);
    expect(
      valueFlowCreateSchema.safeParse({
        title: "Approved proposal",
        flowType: "proposal",
        toStakeholderId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
    expect(
      valueFlowCreateSchema.safeParse({
        title: "Unverified payment",
        flowType: "payment",
        toStakeholderId: "11111111-1111-4111-8111-111111111111",
        amount: 100,
      }).success,
    ).toBe(false);
    expect(
      valueFlowCreateSchema.safeParse({
        title: "Provider payment",
        flowType: "payment",
        toStakeholderId: "11111111-1111-4111-8111-111111111111",
        amount: 100,
        sourceAuthority: "external_authoritative",
        sourceSystem: "stripe",
        externalId: "pi_123",
      }).success,
    ).toBe(true);
    expect(canTransitionStakeholder("proposed", "active")).toBe(true);
    expect(canTransitionStakeholder("closed", "active")).toBe(false);
    expect(canTransitionOffer("thesis", "validation")).toBe(true);
    expect(canTransitionCommercialCase("qualified", "proposal")).toBe(true);
    expect(canTransitionCommercialCase("lost", "qualified")).toBe(false);
    expect(canTransitionValueFlow("proposed", "committed")).toBe(true);
    expect(canTransitionValueFlow("reconciled", "committed")).toBe(false);
  });

  it("validates the canonical Operations graph and qualification boundaries", () => {
    const capabilityId = "11111111-1111-4111-8111-111111111111";
    expect(
      capabilityCreateSchema.parse({
        name: "Client delivery",
        capabilityKey: "capability:client-delivery",
      }),
    ).toMatchObject({ maturity: "ad_hoc", sourceAuthority: "native_eos" });
    expect(
      processCreateSchema.safeParse({
        capabilityInstanceId: capabilityId,
        name: "Deliver outcome",
        workflowKey: "workflow:deliver-outcome",
        purpose: "Produce the accepted client result",
        intendedOutcome: "Client accepts the result",
        triggerCondition: "Approved work enters delivery",
        procedureSteps: [
          {
            id: "step-1",
            title: "Execute",
            instructions: "Complete the approved delivery scope",
            completionCriteria: "The result meets acceptance criteria",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      processCreateSchema.safeParse({
        capabilityInstanceId: capabilityId,
        name: "Narrative only",
        workflowKey: "workflow:narrative",
        purpose: "Describe work",
        intendedOutcome: "No executable procedure",
        triggerCondition: "Someone reads it",
        procedureSteps: [],
      }).success,
    ).toBe(false);
    expect(
      resourceCreateSchema.safeParse({
        name: "Delivery workspace",
        assetType: "system_tool",
        ownerOrganizationKey: "company:1",
      }).success,
    ).toBe(true);
    expect(
      resourceCreateSchema.safeParse({
        name: "Provider dataset",
        assetType: "dataset",
        ownerOrganizationKey: "company:1",
        externalIdUrl: "https://provider.example/data",
      }).success,
    ).toBe(false);
    expect(canTransitionCapability("planned", "activating")).toBe(true);
    expect(canTransitionCapability("deprecated", "active")).toBe(false);
    expect(
      canTransitionProcessQualification("mapped", "artifact_complete"),
    ).toBe(true);
    expect(canTransitionProcessQualification("mapped", "field_qualified")).toBe(
      false,
    );
    expect(canTransitionProcessRelease("draft", "review")).toBe(true);
    expect(canTransitionProcessRelease("draft", "released")).toBe(false);
    expect(canTransitionResource("proposed", "active")).toBe(true);
    expect(canTransitionResource("archived", "active")).toBe(false);
  });

  it("separates membership from multiple effective role assignments", () => {
    const now = new Date("2026-08-14T20:00:00.000Z");
    const assignments = [
      {
        id: "founder-assignment",
        seatId: "11111111-1111-4111-8111-111111111111",
        operatingGrant: "operate",
        classificationCeiling: "restricted",
        status: "active",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "sales-assignment",
        seatId: "22222222-2222-4222-8222-222222222222",
        operatingGrant: "operate",
        classificationCeiling: "confidential",
        status: "active",
        effectiveFrom: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "observer-assignment",
        seatId: "33333333-3333-4333-8333-333333333333",
        operatingGrant: "observe",
        classificationCeiling: "internal",
        status: "active",
        effectiveFrom: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "expired-assignment",
        seatId: "44444444-4444-4444-8444-444444444444",
        operatingGrant: "operate",
        classificationCeiling: "internal",
        status: "active",
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        effectiveUntil: "2026-08-01T00:00:00.000Z",
      },
    ];
    expect(
      selectOperatingAssignment(assignments, null, assignments[0].seatId, now)
        ?.id,
    ).toBe("founder-assignment");
    expect(
      selectOperatingAssignment(
        assignments,
        assignments[1].seatId,
        assignments[0].seatId,
        now,
      )?.id,
    ).toBe("sales-assignment");
    expect(
      selectOperatingAssignment(
        assignments,
        assignments[2].seatId,
        assignments[0].seatId,
        now,
      ),
    ).toBeUndefined();
    expect(
      selectOperatingAssignment(
        assignments,
        assignments[3].seatId,
        assignments[0].seatId,
        now,
      ),
    ).toBeUndefined();
  });

  it("validates bounded assignment types and operating grants", () => {
    expect(
      roleAssignmentCreateSchema.parse({
        principalUserId: "user-1",
        seatId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toMatchObject({
      assignmentType: "occupant",
      operatingGrant: "operate",
      purpose: "operate",
      classificationCeiling: "internal",
    });
    expect(
      roleAssignmentCreateSchema.safeParse({
        principalUserId: "user-1",
        seatId: "not-a-seat",
        operatingGrant: "admin",
      }).success,
    ).toBe(false);
  });

  it("keeps position agreements and role operating packs complete and separate from grants", () => {
    const agreement = positionAgreementContractSchema.parse({
      resultStatement: "Deliver accepted client outcomes",
      responsibilities: ["Own delivery"],
      acceptanceStandards: ["Evidence is reviewed"],
      scorecard: [
        { metric: "Accepted outcomes", target: "100%", cadence: "weekly" },
      ],
      managerRelationship: "Reports to Delivery Manager",
      schedule: "Weekly operating cadence",
      evidenceRequirements: ["Accepted deliverable"],
    });
    expect(agreement.decisionRights).toEqual([]);
    const pack = roleOperatingPackContractSchema.parse({
      mission: agreement.resultStatement,
      responsibilities: agreement.responsibilities,
      outputs: ["Accepted deliverable"],
      acceptanceStandards: agreement.acceptanceStandards,
      scorecard: agreement.scorecard,
      reviewCadence: "weekly",
      authorityRequirements: ["execute"],
      escalationPaths: ["Escalate to Delivery Manager"],
      evidenceRequirements: agreement.evidenceRequirements,
      occupancyModes: ["agent_operated", "human_led", "hybrid"],
      entryRules: ["Active assignment required"],
      exitRules: ["Preserve queue and evidence"],
      transferRules: ["Preserve Role Agent continuity"],
      qualificationTests: ["Explain mission and next governed action"],
    });
    expect(pack.authorityRequirements).toEqual(["execute"]);
    expect(
      roleOperatingPackContractSchema.safeParse({ ...pack, outputs: [] })
        .success,
    ).toBe(false);
  });

  it("enforces the Finance & Capital planning boundary and governed lifecycles", () => {
    expect(
      financialSourceCreateSchema.safeParse({
        name: "Operating cash",
        legalEntityName: "Empyrean Studios LLC",
        accountType: "bank",
        lifecycleState: "connected",
      }).success,
    ).toBe(false);
    expect(
      financialSourceCreateSchema.safeParse({
        name: "Operating cash",
        legalEntityName: "Empyrean Studios LLC",
        accountType: "bank",
        lifecycleState: "connected",
        sourceSystem: "provider",
        externalId: "acct-1",
        sourceAuthority: "external_authoritative",
      }).success,
    ).toBe(true);
    expect(
      financialPlanCreateSchema.safeParse({
        name: "Q4 operating budget",
        planType: "budget",
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-09-30T00:00:00.000Z",
        plannedAmount: 100000,
      }).success,
    ).toBe(false);
    expect(
      financialPlanCreateSchema.safeParse({
        name: "Q4 operating budget",
        planType: "budget",
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2027-01-01T00:00:00.000Z",
        plannedAmount: 100000,
        assumptions: ["Revenue plan remains a scenario until reconciled"],
      }).success,
    ).toBe(true);
    expect(
      capitalAllocationCreateSchema.safeParse({
        name: "Launch reserve",
        allocationType: "reserve",
        financialPlanId: "11111111-1111-4111-8111-111111111111",
        targetType: "capability",
        targetKey: "launch",
        amount: 25000,
        rationale: "Protect delivery capacity",
        expectedOutcome: "Six months of operating resilience",
        downsideRisk: "Lower near-term growth investment",
      }).success,
    ).toBe(true);
    expect(canTransitionFinancialSource("draft", "connected")).toBe(true);
    expect(canTransitionFinancialSource("archived", "connected")).toBe(false);
    expect(canTransitionFinancialPlan("review", "approved")).toBe(true);
    expect(canTransitionFinancialPlan("draft", "active")).toBe(false);
    expect(canTransitionCapitalAllocation("under_review", "approved")).toBe(
      true,
    );
    expect(canTransitionCapitalAllocation("proposed", "deployed")).toBe(false);
  });

  it("enforces the Systems, Integration, Entitlement, and Automation qualification boundary", () => {
    const systemId = "11111111-1111-4111-8111-111111111111";
    const bindingId = "22222222-2222-4222-8222-222222222222";
    const seatId = "33333333-3333-4333-8333-333333333333";
    expect(
      systemRegistryCreateSchema.safeParse({
        name: "Customer CRM",
        systemType: "application",
        sourceSystem: "crm",
      }).success,
    ).toBe(false);
    expect(
      systemRegistryCreateSchema.safeParse({
        name: "Customer CRM",
        systemType: "application",
        capabilities: ["relationship management"],
        dataDomains: ["customer"],
        authoritativeFields: ["provider contact id"],
      }).success,
    ).toBe(true);
    expect(
      integrationBindingCreateSchema.safeParse({
        name: "CRM adapter",
        providerKey: "crm",
        adapterKind: "oauth",
        adapterReference: "adapter://crm",
        manualFallback: "Use the CRM directly",
        failureRecovery: "Pause writes and reconcile later",
      }).success,
    ).toBe(false);
    expect(
      integrationBindingCreateSchema.safeParse({
        name: "CRM adapter",
        toSystemId: systemId,
        providerKey: "crm",
        adapterKind: "oauth",
        adapterReference: "adapter://crm",
        manualFallback: "Use the CRM directly",
        failureRecovery: "Pause writes and reconcile later",
        credentialReference: "plain-secret",
      }).success,
    ).toBe(false);
    expect(
      toolEntitlementCreateSchema.safeParse({
        systemId,
        granteeSeatId: seatId,
        providerResourceReference: "crm-account",
        nativePermissions: ["contacts.read"],
        credentialReference: "op://EOS/crm/token",
      }).success,
    ).toBe(true);
    expect(
      toolEntitlementCreateSchema.safeParse({
        systemId,
        granteeSeatId: seatId,
        granteeSubjectId: bindingId,
        providerResourceReference: "crm-account",
        nativePermissions: ["contacts.read"],
      }).success,
    ).toBe(false);
    expect(
      automationCreateSchema.safeParse({
        name: "Lead intake",
        integrationBindingId: bindingId,
        triggerContract: "When a consented lead arrives",
        actionContract: "Create a qualification packet",
        failureBehavior: "Queue and alert",
        manualFallback: "Create the packet manually",
      }).success,
    ).toBe(true);
    expect(
      integrationHealthObservationCreateSchema.safeParse({
        integrationBindingId: bindingId,
        healthState: "healthy",
        checkType: "live_provider",
        summary: "Provider returned an authorized response",
        evidenceIds: [],
      }).success,
    ).toBe(false);
    expect(canTransitionSystemLifecycle("implementing", "active")).toBe(true);
    expect(canTransitionSystemLifecycle("proposed", "active")).toBe(false);
    expect(canTransitionEntitlement("pending", "active")).toBe(true);
    expect(canTransitionAutomation("review", "enabled")).toBe(true);
    expect(
      integrationActivationIssues({
        connectionState: "unconfigured",
        healthState: "unknown",
      }),
    ).toContain("connected provider state");
    expect(
      entitlementActivationIssues({
        masteryState: "qualified",
        nativePermissions: ["contacts.read"],
        evidenceIds: ["evidence"],
        providerResourceReference: "crm-account",
      }),
    ).toEqual(
      expect.arrayContaining(["Authority Grant", "secret-manager reference"]),
    );
  });

  it("governs workforce review, development, and succession as evidence-backed seat records", () => {
    const subjectSeatId = "11111111-1111-4111-8111-111111111111";
    const candidateSeatId = "22222222-2222-4222-8222-222222222222";
    const metricId = "33333333-3333-4333-8333-333333333333";
    const evidenceId = "44444444-4444-4444-8444-444444444444";
    const review = workforceReviewCreateSchema.parse({
      subjectSeatId,
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-08-01T00:00:00.000Z",
      outcomeSummary: "Role outcomes and operating constraints reviewed",
      performanceAttribution: "mixed",
      metricIds: [metricId],
      evidenceIds: [evidenceId],
    });
    expect(review.classification).toBe("internal");
    expect(
      workforceReviewUpdateSchema.safeParse({
        employeeResponse: "Overwrite the employee statement",
      }).success,
    ).toBe(false);
    expect(
      workforceReviewDialogueCreateSchema.safeParse({
        responseType: "correction_request",
        body: "The cited outcome omits the approved capacity constraint.",
      }).success,
    ).toBe(true);
    expect(
      workforceReviewDialogueCreateSchema.safeParse({
        responseType: "correction_resolution",
        body: "Reviewed against the source evidence.",
      }).success,
    ).toBe(false);
    expect(
      workforceReviewCreateSchema.safeParse({
        ...review,
        periodEnd: review.periodStart,
      }).success,
    ).toBe(false);
    expect(
      developmentPlanCreateSchema.safeParse({
        subjectSeatId,
        targetRole: "Senior operator",
      }).success,
    ).toBe(false);
    expect(
      developmentPlanCreateSchema.safeParse({
        subjectSeatId,
        targetRole: "Senior operator",
        capabilityGaps: ["Delegation evidence"],
      }).success,
    ).toBe(true);
    expect(
      successionHypothesisCreateSchema.safeParse({
        criticalSeatId: subjectSeatId,
        candidateSeatId: subjectSeatId,
        rationale: "Same seat",
      }).success,
    ).toBe(false);
    expect(
      successionHypothesisCreateSchema.safeParse({
        criticalSeatId: subjectSeatId,
        candidateSeatId,
        rationale: "Candidate has adjacent operating proof",
      }).success,
    ).toBe(true);
    expect(canTransitionWorkforceReview("manager_review", "calibrated")).toBe(
      true,
    );
    expect(canTransitionWorkforceReview("draft", "closed")).toBe(false);
    expect(canTransitionDevelopmentPlan("active", "completed")).toBe(true);
    expect(canTransitionSuccession("ready", "selected")).toBe(true);
    expect(
      workforceReviewAdvancementIssues(
        { state: "manager_review", metricIds: [], evidenceIds: [] },
        "calibrated",
      ),
    ).toEqual(["role scorecard metric", "verified work evidence"]);
    expect(
      developmentPlanAdvancementIssues({ evidenceIds: [] }, "completed"),
    ).toEqual(["verified development evidence"]);
    expect(
      successionAdvancementIssues(
        { readinessWindow: "unassessed", evidenceIds: [] },
        "ready",
      ),
    ).toEqual(["positive readiness window", "verified readiness evidence"]);
  });

  it("keeps Assist, Teach, Guard, and Transfer explicit, proven, and separate from authority", () => {
    const subjectSeatId = "11111111-1111-4111-8111-111111111111";
    const base = {
      subjectSeatId,
      responsibility: "Publish the weekly operating forecast",
      objective: "Produce an accurate forecast before the review cadence",
      humanOwnership: "The seat owner validates assumptions and submits the forecast",
      supportInstructions: "The Role Agent prepares the source-linked draft and flags exceptions",
    };
    expect(
      roleSupportPlanCreateSchema.safeParse({
        ...base,
        supportMode: "assist",
      }).success,
    ).toBe(true);
    expect(
      roleSupportPlanCreateSchema.safeParse({
        ...base,
        supportMode: "teach",
      }).success,
    ).toBe(false);
    expect(
      roleSupportPlanCreateSchema.safeParse({
        ...base,
        supportMode: "guard",
      }).success,
    ).toBe(false);
    expect(
      roleSupportPlanCreateSchema.safeParse({
        ...base,
        supportMode: "transfer",
        guardrails: ["Stop when source reconciliation fails"],
        proofRequirements: ["Three accepted forecasts under review"],
      }).success,
    ).toBe(false);
    expect(
      roleSupportPlanCreateSchema.safeParse({
        ...base,
        supportMode: "transfer",
        guardrails: ["Stop when source reconciliation fails"],
        proofRequirements: ["Three accepted forecasts under review"],
        transferTarget: "The persistent seat Role Agent",
      }).success,
    ).toBe(true);
    expect(canTransitionRoleSupportPlan("draft", "active")).toBe(true);
    expect(canTransitionRoleSupportPlan("active", "completed")).toBe(false);
    expect(canTransitionRoleSupportPlan("ready_for_review", "completed")).toBe(
      true,
    );
    expect(
      roleSupportPlanAdvancementIssues({ evidenceIds: [] }, "completed"),
    ).toEqual(["verified support evidence"]);
  });

  it("governs career mobility as an evidence-backed hypothesis rather than a promotion", () => {
    const subjectSeatId = "11111111-1111-4111-8111-111111111111";
    const evidenceId = "44444444-4444-4444-8444-444444444444";
    const base = {
      subjectSeatId,
      targetRole: "Senior delivery operator",
      transitionType: "senior_ic_path",
      careerTrack: "individual_contributor",
      aspirationStatement: "Own larger delivery outcomes without entering management",
      transitionCriteria: ["Repeated proof at the next complexity level"],
      proofRequirements: ["Three accepted cross-team delivery outcomes"],
    };
    expect(careerPathCreateSchema.safeParse(base).success).toBe(true);
    expect(
      careerPathCreateSchema.safeParse({ ...base, proofRequirements: [] })
        .success,
    ).toBe(false);
    expect(
      careerPathCreateSchema.safeParse({ ...base, transitionCriteria: [] })
        .success,
    ).toBe(false);
    expect(canTransitionCareerPath("proposed", "under_review")).toBe(true);
    expect(canTransitionCareerPath("proposed", "endorsed")).toBe(false);
    expect(canTransitionCareerPath("evidence_ready", "endorsed")).toBe(true);
    expect(
      careerPathAdvancementIssues(
        {
          businessNeed: "",
          seatAvailability: "unknown",
          evidenceIds: [],
        },
        "endorsed",
      ),
    ).toEqual([
      "verified transition evidence",
      "real business need",
      "available seat or explicit no-seat requirement",
    ]);
    expect(
      careerPathAdvancementIssues(
        {
          businessNeed: "Delivery volume requires a senior operator",
          seatAvailability: "available",
          evidenceIds: [evidenceId],
        },
        "endorsed",
      ),
    ).toEqual([]);
  });

  it("governs one candidate identity from institutional need through evidence-backed placement", () => {
    const seatId = "00000000-0000-4000-8000-000000000101";
    const needId = "00000000-0000-4000-8000-000000000102";
    const applicationId = "00000000-0000-4000-8000-000000000103";
    const evidenceId = "00000000-0000-4000-8000-000000000104";
    const need = talentNeedCreateSchema.parse({
      title: "Founding revenue capability",
      targetSeatId: seatId,
      rationale: "The company lacks repeatable pipeline ownership",
      requiredOutcomes: ["Qualified pipeline created every week"],
    });
    expect(need.classification).toBe("confidential");
    expect(canTransitionTalentNeed("identified", "validated")).toBe(true);
    expect(canTransitionTalentNeed("identified", "open")).toBe(false);
    expect(
      talentApplicationCreateSchema.safeParse({
        candidateName: "Synthetic Candidate",
        identityReference: "candidate@example.test",
        consentLegalBasis: "Candidate consented to this process",
        talentNeedId: needId,
        targetSeatId: seatId,
      }).success,
    ).toBe(true);
    expect(
      talentApplicationUpdateSchema.safeParse({
        candidateUserId: "arbitrary-principal",
      }).success,
    ).toBe(false);
    expect(
      membershipInvitationCreateSchema.safeParse({
        email: "candidate@example.test",
        seatId,
        talentApplicationId: applicationId,
        purpose: "talent_onboarding",
      }).success,
    ).toBe(true);
    expect(canTransitionTalentApplication("invited", "intake_started")).toBe(
      true,
    );
    expect(canTransitionTalentApplication("intake_submitted", "decision")).toBe(
      false,
    );
    expect(
      talentApplicationAdvancementIssues(
        { consentState: "pending", evidenceIds: [] },
        "decision",
        0,
        0,
      ),
    ).toEqual([
      "candidate consent",
      "reviewed assessment",
      "signed human review packet",
      "verified decision evidence",
    ]);
    expect(
      talentApplicationAdvancementIssues(
        { consentState: "granted", evidenceIds: [evidenceId] },
        "decision",
        1,
        1,
      ),
    ).toEqual([]);
    expect(
      talentAssessmentCreateSchema.safeParse({
        applicationId,
        assessmentType: "work_sample",
        title: "Role simulation",
        decisionQuestion:
          "Can the candidate produce the required weekly operating output?",
        evidenceExpected:
          "A bounded work sample reviewed against the role scorecard",
      }).success,
    ).toBe(true);
    expect(canTransitionTalentAssessment("planned", "candidate_action")).toBe(
      true,
    );
    expect(
      talentAssessmentAdvancementIssues(
        { consentRequired: true, consentCaptured: false, evidenceIds: [] },
        "reviewed",
      ),
    ).toEqual(["captured assessment consent", "assessment evidence"]);
    expect(
      talentPlacementCreateSchema.safeParse({
        applicationId,
        targetSeatId: seatId,
        rationale:
          "Verified work sample and structured interview support placement",
      }).success,
    ).toBe(true);
    expect(canTransitionTalentPlacement("pending", "offer_approved")).toBe(
      true,
    );
    expect(canTransitionTalentPlacement("pending", "activated")).toBe(false);
    expect(
      talentPlacementAdvancementIssues(
        {
          assignmentId: null,
          evidenceIds: [],
          onboardingChecklist: [],
          accessPlan: [],
        },
        "activated",
      ),
    ).toEqual([
      "verified placement evidence",
      "onboarding checklist",
      "least-privilege access plan",
      "explicit seat assignment",
    ]);
  });

  it("requires a complete evidence-bound packet before attributable human recruiting sign-off", () => {
    const applicationId = "00000000-0000-4000-8000-000000000103";
    const evidenceId = "00000000-0000-4000-8000-000000000104";
    const packet = talentReviewPacketCreateSchema.parse({
      applicationId,
      packetSummary:
        "Verified operating evidence remains bounded to one role hypothesis.",
      roleAssessments: [
        {
          roleHypothesis: "Operations lead",
          confidence: "supported",
          evidenceForIds: [evidenceId],
          unresolvedQuestions: ["Judgment under ambiguity"],
        },
      ],
      outcomeCoverage: [
        { outcome: "Reliable weekly delivery", evidenceIds: [evidenceId] },
      ],
      proofGaps: ["Judgment under ambiguity"],
      interviewFocus: ["Trust and disagreement"],
      teamFitQuestions: ["How would this person complement the current team?"],
      nextAssessment: {
        assessmentType: "structured_interview",
        title: "Ambiguity interview",
        decisionQuestion:
          "How does the candidate exercise judgment under ambiguity?",
        evidenceExpected:
          "A concrete example with decision context and outcome.",
        rationale: "Resolve the highest-value remaining proof gap.",
      },
    });
    const reviewState = {
      ...packet,
      roleHypothesesSnapshot: ["Operations lead"],
      requiredOutcomesSnapshot: ["Reliable weekly delivery"],
      verifiedEvidenceIds: [evidenceId],
    };
    expect(talentReviewPacketReadinessIssues(reviewState)).toEqual([]);
    expect(
      talentReviewPacketReadinessIssues(
        { ...reviewState, nextAssessment: null },
        "ready_for_review",
      ),
    ).toContain("the smallest next assessment for unresolved proof gaps");
    expect(
      talentReviewPacketReadinessIssues(reviewState, "signed_off"),
    ).toEqual(["human reviewer recommendation", "human reviewer rationale"]);
    expect(
      talentReviewPacketReadinessIssues(
        {
          ...reviewState,
          reviewerDecision: "interview_ready",
          reviewerRationale: "Human reviewer accepts the evidence boundary.",
        },
        "signed_off",
      ),
    ).toEqual([]);
    expect(canTransitionTalentReviewPacket("draft", "ready_for_review")).toBe(
      true,
    );
    expect(canTransitionTalentReviewPacket("draft", "signed_off")).toBe(false);
  });

  it("governs a paid trial from approved offer through evidence-backed human outcome", () => {
    const applicationId = "00000000-0000-4000-8000-000000000103";
    const seatId = "00000000-0000-4000-8000-000000000101";
    const evidenceId = "00000000-0000-4000-8000-000000000104";
    const trial = talentTrialCreateSchema.parse({
      applicationId,
      targetSeatId: seatId,
      title: "Bounded operating trial",
      question: "Can the candidate run the weekly decision cadence?",
      durationDays: 5,
      compensationAmountMinor: 125000,
      compensationCurrency: "usd",
      compensationTerms: "Payable under the executed trial agreement.",
      legalAgreementReference: "trial-agreement-2026-001",
      jurisdiction: "California, United States",
      inputsSupport: ["Operating brief and one accountable reviewer"],
      requiredOutputs: ["Decision log and weekly review artifact"],
      scorecard: [
        {
          dimension: "Decision quality",
          successAnchor: "Makes reversible decisions with explicit evidence",
          weight: 100,
        },
      ],
      constraintsDecisionRights: ["No customer contact or production access"],
      observationPoints: ["Midpoint review and final evidence review"],
      reviewAt: "2026-09-10T17:00:00.000Z",
      outcomeCriteria: {
        pass: "Meets the scorecard and produces the required outputs.",
        redirect: "Shows stronger evidence for a different bounded seat.",
        extend: "One material question remains answerable within five days.",
        fail: "Does not produce the required evidence within the constraints.",
      },
      predictedOutcome: "Likely meets with one uncertainty around escalation.",
      candidateInstructions: "Use the supplied brief and record every decision.",
    });
    expect(trial.compensationCurrency).toBe("USD");
    expect(canTransitionTalentTrial("draft", "approved")).toBe(true);
    expect(canTransitionTalentTrial("offered", "active")).toBe(false);
    expect(
      talentTrialAdvancementIssues(
        { approvalStatus: "pending" },
        "offered",
      ),
    ).toEqual(["approved trial Work Packet"]);
    expect(
      talentTrialAdvancementIssues(
        {
          scorecard: trial.scorecard,
          scorecardObservations: [
            {
              dimension: "Decision quality",
              rating: "meets",
              evidenceIds: [evidenceId],
              notes: "Observed against the published success anchor.",
            },
          ],
          outcomeEvidenceIds: [evidenceId],
          actualOutcomeSummary: "The candidate met the bounded scorecard.",
          reviewerRationale: "Verified evidence supports the human outcome.",
          candidateFeedback: "The scorecard was met; no authority is granted.",
          learningProposal: "Retain the question and clarify escalation evidence.",
        },
        "passed",
        1,
      ),
    ).toEqual([]);
    expect(
      talentCandidateEvidencePromotionSchema.parse({
        supportedClaimSummary:
          "The candidate produced the bounded decision-log artifact.",
        verifierMethod:
          "A human reviewer opened the artifact and checked it against the published Trial scorecard.",
      }),
    ).toMatchObject({ confidenceQuality: "high" });
    expect(
      talentCandidateEvidencePromotionSchema.safeParse({
        supportedClaimSummary: "",
        verifierMethod: "",
      }).success,
    ).toBe(false);
    expect(
      talentApplicationAdvancementIssues(
        { consentState: "granted", evidenceIds: [evidenceId] },
        "trial_active",
        1,
        1,
        0,
        0,
        "trial_recommended",
      ),
    ).toContain("accepted approved trial");
    expect(
      talentApplicationAdvancementIssues(
        { consentState: "granted", evidenceIds: [evidenceId] },
        "decision",
        1,
        1,
        1,
        0,
        "trial_active",
      ),
    ).toContain("human-reviewed trial outcome");
  });

  it("evaluates only effective seat and principal authority grants", () => {
    const now = new Date("2026-08-14T20:00:00.000Z");
    const grants = [
      {
        id: "seat",
        granteeType: "seat",
        granteeKey: "seat-1",
        authorityClasses: ["view", "execute", "not-a-class"],
        toolEntitlements: ["gmail"],
        state: "active",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "principal",
        granteeType: "principal",
        granteeKey: "user-1",
        authorityClasses: ["recommend"],
        toolEntitlements: ["notion", "gmail"],
        state: "active",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "principal-other-seat",
        granteeType: "principal",
        granteeKey: "user-1",
        seatId: "seat-2",
        authorityClasses: ["approve"],
        toolEntitlements: ["stripe"],
        state: "active",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "wrong-principal",
        granteeType: "principal",
        granteeKey: "user-2",
        authorityClasses: ["approve"],
        toolEntitlements: [],
        state: "active",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "expired",
        granteeType: "seat",
        granteeKey: "seat-1",
        authorityClasses: ["sign"],
        toolEntitlements: [],
        state: "active",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveUntil: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "suspended",
        granteeType: "seat",
        granteeKey: "seat-1",
        authorityClasses: ["approve"],
        toolEntitlements: [],
        state: "suspended",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    ];
    const effective = effectiveAuthorityFor(grants, "user-1", "seat-1", now);
    expect(effective.grants.map((grant) => grant.id)).toEqual([
      "seat",
      "principal",
    ]);
    expect(new Set(effective.classes)).toEqual(
      new Set(["view", "execute", "recommend"]),
    );
    expect(new Set(effective.toolEntitlements)).toEqual(
      new Set(["gmail", "notion"]),
    );
  });

  it("validates grant boundaries and conservative default role powers", () => {
    expect(
      authorityGrantCreateSchema.safeParse({
        authorityKey: "seat:delivery:bounded",
        granteeType: "seat",
        granteeKey: "seat-1",
        authorityClasses: ["execute"],
        actionResourceScope: { resource: "work_packet" },
        policyDecisionSource: "Founder-approved role contract",
      }).success,
    ).toBe(true);
    expect(
      authorityGrantCreateSchema.safeParse({
        authorityKey: "seat:delivery:unscoped",
        granteeType: "seat",
        granteeKey: "seat-1",
        authorityClasses: ["execute"],
        actionResourceScope: {},
        policyDecisionSource: "Founder-approved role contract",
      }).success,
    ).toBe(false);
    expect(
      authorityGrantCreateSchema.safeParse({
        authorityKey: "bad key",
        granteeType: "seat",
        granteeKey: "seat-1",
        authorityClasses: ["own_everything"],
        policyDecisionSource: "title",
      }).success,
    ).toBe(false);
    expect(defaultAuthorityClassesForRole("individual_contributor")).toEqual([
      "view",
      "recommend",
      "execute",
    ]);
    expect(
      defaultAuthorityClassesForRole("individual_contributor"),
    ).not.toContain("approve");
    expect(defaultAuthorityClassesForRole("founder")).toContain(
      "override_emergency",
    );
  });

  it("validates canonical authority-subject identity contracts and effective state", () => {
    const provider = {
      subjectType: "provider",
      subjectKey: "provider:legal",
      displayName: "Legal Partner",
      sourceAuthority: "agreement:2026",
      identityAttributes: {
        providerKind: "professional_service",
        legalName: "Legal Partner LLP",
        agreementReference: "evidence:agreement",
        providerSystemKeys: [],
      },
    };
    expect(authoritySubjectCreateSchema.safeParse(provider).success).toBe(true);
    expect(
      authoritySubjectCreateSchema.safeParse({
        subjectType: "agent",
        subjectKey: "agent:specialist",
        displayName: "Research Sub-Agent",
        sourceAuthority: "pattern:v1",
        agentClass: "sub_agent",
        identityAttributes: {
          operatingMode: "approval_gated",
          workforceRoleMode: "nested_specialist",
          memoryScope: "company:1/seat:1/work",
          modelRuntime: "gateway",
          humanFallbackUserId: "user-1",
          permittedTools: [],
        },
      }).success,
    ).toBe(false);
    expect(
      authoritySubjectCreateSchema.safeParse({
        subjectType: "agent",
        subjectKey: "agent:advisor",
        displayName: "Strategy Advisor",
        sourceAuthority: "advisor-pattern:v1",
        agentClass: "advisor_agent",
        identityAttributes: {
          operatingMode: "advisory",
          workforceRoleMode: "primary_role_operator",
          memoryScope: "portfolio:1",
          modelRuntime: "gateway",
          humanFallbackUserId: "user-1",
          permittedTools: [],
        },
      }).success,
    ).toBe(true);
    expect(
      authoritySubjectCreateSchema.safeParse({
        subjectType: "service_account",
        subjectKey: "service:gmail",
        displayName: "Gmail Worker",
        sourceAuthority: "provider-binding",
        externalIdentityKey: "gmail:acct",
        identityAttributes: {
          providerKey: "gmail",
          externalAccountReference: "acct",
          environment: "production",
          credentialReference: "secret-value",
          rotationOwnerUserId: "user-1",
        },
      }).success,
    ).toBe(false);
    expect(
      authoritySubjectCreateSchema.safeParse({
        subjectType: "service_account",
        subjectKey: "service:gmail",
        displayName: "Gmail Worker",
        sourceAuthority: "provider-binding",
        externalIdentityKey: "gmail:acct",
        identityAttributes: {
          providerKey: "gmail",
          externalAccountReference: "acct",
          environment: "production",
          credentialReference: "op://EOS/Gmail/password",
          rotationOwnerUserId: "user-1",
        },
      }).success,
    ).toBe(true);
    expect(
      authoritySubjectIsEffective(
        {
          status: "active",
          verificationStatus: "verified",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          reviewAt: "2026-12-01T00:00:00.000Z",
        },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      authoritySubjectIsEffective(
        {
          status: "active",
          verificationStatus: "verified",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          reviewAt: "2026-08-01T00:00:00.000Z",
        },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("enforces resource and seat scope independently of the authority class", () => {
    const bounded = {
      actionResourceScope: { resource: "provider_execution", seatId: "seat-1" },
    };
    expect(
      authorityGrantCoversResource(bounded, "provider_execution", "seat-1"),
    ).toBe(true);
    expect(authorityGrantCoversResource(bounded, "work_packet", "seat-1")).toBe(
      false,
    );
    expect(
      authorityGrantCoversResource(bounded, "provider_execution", "seat-2"),
    ).toBe(false);
    expect(authorityGrantCoversResource(bounded, "provider_execution")).toBe(
      false,
    );
    expect(
      authorityGrantCoversResource(
        { actionResourceScope: { resources: ["approval", "evidence"] } },
        "evidence",
      ),
    ).toBe(true);
    expect(
      authorityGrantCoversResource(
        { actionResourceScope: { resource: "*" } },
        "organization_manifest",
      ),
    ).toBe(true);
    expect(
      authorityGrantCoversResource({ actionResourceScope: {} }, "work_packet"),
    ).toBe(false);
  });

  it("selects relevant advisor agents while preserving the EA as the only founder-facing channel", () => {
    const council = buildAdvisorCouncil({
      founderName: "Founder",
      companyName: "Company",
    });
    expect(
      new Set(
        selectAdvisorSeats(
          council.advisors,
          "Review revenue, customer retention, and governance risk",
        ).map((advisor) => advisor.id),
      ),
    ).toEqual(new Set(["revenue", "customer", "governance"]));
    expect(
      selectAdvisorSeats(
        council.advisors,
        "Give me a general portfolio synthesis",
      ).map((advisor) => advisor.id),
    ).toEqual(["chief_portfolio_advisor", "strategy", "governance"]);
  });
});
