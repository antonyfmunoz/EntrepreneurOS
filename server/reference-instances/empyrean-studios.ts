import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  companies,
  eosApprovalRequests,
  eosAssignments,
  eosAuditRecords,
  eosCapabilityInstances,
  eosCommercialCases,
  eosIntegrationBindings,
  eosIntegrationBindingRevisions,
  eosManifestVersions,
  eosMemberships,
  eosMetricsOutcomes,
  eosObjectives,
  eosOfferPrograms,
  eosProcessDefinitions,
  eosRisksControls,
  eosSeats,
  eosStakeholderRelationships,
  eosStakeholders,
  eosSystems,
  eosWorkPackets,
} from "@shared/schema";
import { buildAdvisorCouncil, manifestInputSchema } from "@shared/eos-runtime";
import { companyPackageSchema } from "@shared/company-compilation";
import { ensureSeatOperatingKernel } from "../role-kernel";
import { integrationBindingConfigurationSnapshot } from "../integration-binding-configuration";

export const EMPYREAN_REFERENCE_PACKAGE = {
  key: "empyrean-studios-reference",
  version: "2026-08-22",
  organizationKey: "ORG-EMPYREAN-STUDIOS",
  canonicalName: "Empyrean Studios",
  sourceEffectiveAt: "2026-08-22",
  sources: {
    registry:
      "https://app.notion.com/p/3c3da8b96e4f81679d74fac5fc7ed788",
    runtime:
      "https://app.notion.com/p/32eda8b96e4f81c78872e5a768ea9faf",
    referenceImplementation:
      "https://app.notion.com/p/3b0da8b96e4f8194a768d374651f5cc9",
    preLiveAuthority:
      "https://app.notion.com/p/3b4da8b96e4f814d983ed939336eaa1b",
    commercialAuthority:
      "https://app.notion.com/p/3a9da8b96e4f8129ba8fefea055ee11b",
  },
  activationBlockers: [
    "Reconcile the current Recovery System authority into the operative agreement and complete qualified counsel review.",
    "Verify the exact GoHighLevel location and behavioral test path.",
    "Verify the exact Stripe account, legal holder, mode, payout and event behavior.",
    "Verify the exact DocuSign workspace, template, sender authority and event behavior.",
    "Verify the operational mailbox and kickoff calendar.",
    "Complete qualified legal, privacy, tax and accounting review where applicable.",
    "Pass a synthetic payment-to-closeout rehearsal with failure and rollback evidence.",
  ],
  seats: [
    {
      key: "company-ceo",
      title: "Founder / Chief Executive Officer",
      kind: "company_ceo",
      agentName: "Empyrean Studios CEO Agent",
      humanOccupied: true,
      mandate:
        "Own Empyrean Studios operating results while routing founder communication through the Executive Assistant and preserving explicit approval boundaries.",
    },
    {
      key: "sales-development-representative-i",
      title: "Sales Development Representative I",
      kind: "individual_contributor",
      agentName: "Sales Development Representative I Agent",
      humanOccupied: false,
      mandate:
        "Build a roofing-first qualified demand queue without sending external communication outside approved provider and message policy.",
    },
    {
      key: "account-executive-i",
      title: "Account Executive I",
      kind: "individual_contributor",
      agentName: "Account Executive I Agent",
      humanOccupied: true,
      mandate:
        "Qualify opportunities, preserve commercial truth, and obtain local approval before commitments, pricing, guarantees or signatures.",
    },
    {
      key: "solutions-architect-i",
      title: "Solutions Architect I",
      kind: "individual_contributor",
      agentName: "Solutions Architect I Agent",
      humanOccupied: false,
      mandate:
        "Translate verified client needs and access boundaries into a bounded Recovery System design subject to qualified technical review.",
    },
    {
      key: "automation-engineer-i",
      title: "Automation Engineer I",
      kind: "individual_contributor",
      agentName: "Automation Engineer I Agent",
      humanOccupied: false,
      mandate:
        "Implement and test governed automations without activating consequential external effects before approval and release review.",
    },
    {
      key: "operations-coordinator-i",
      title: "Operations Coordinator I",
      kind: "individual_contributor",
      agentName: "Operations Coordinator I Agent",
      humanOccupied: false,
      mandate:
        "Coordinate onboarding, delivery, evidence, exceptions and reporting so every material commitment has an owner and state.",
    },
    {
      key: "content-marketing-specialist-i",
      title: "Content Marketing Specialist I",
      kind: "individual_contributor",
      agentName: "Content Marketing Specialist I Agent",
      humanOccupied: false,
      mandate:
        "Prepare Empyrean and AFM content strategy and distribution work while keeping publication human-controlled.",
    },
    {
      key: "associate-content-producer",
      title: "Associate Content Producer",
      kind: "individual_contributor",
      agentName: "Associate Content Producer Agent",
      humanOccupied: false,
      mandate:
        "Produce evidence-bearing content artifacts inside the approved brand, rights, review and publication boundary.",
    },
  ],
} as const;

const EMPYREAN_SOURCE_EFFECTIVE_AT = "2026-08-21T00:00:00.000Z";

function empyreanArtifact<T>(
  stableId: string,
  artifactType: string,
  sourceRef: string,
  value: T,
) {
  return {
    metadata: {
      stableId,
      orgKey: EMPYREAN_REFERENCE_PACKAGE.organizationKey,
      artifactType,
      schemaVersion: "eos.company-compilation.v1",
      artifactVersion: EMPYREAN_REFERENCE_PACKAGE.version,
      status: "approved" as const,
      activationState: "blocked" as const,
      ownershipClass: "owned" as const,
      authorityClass: "reference" as const,
      privacyClass: "internal" as const,
      ownerRole: "Founder / Chief Executive Officer",
      sourceRef,
      sourceRevision: EMPYREAN_REFERENCE_PACKAGE.version,
      effectiveAt: EMPYREAN_SOURCE_EFFECTIVE_AT,
      expiresAt: null,
      supersedes: [],
      confidence: "supported" as const,
      evidenceRefs: [],
      dependencyRefs: [],
      approvalRefs: [],
    },
    value,
  };
}

const empyreanCapabilities = [
  "recruiting-candidate-portal",
  "lead-capture-marketing-qualification",
  "sales-opportunity-commercial-decision",
  "contracting-payment-activation",
  "client-onboarding-portal",
  "fulfillment-work-delivery",
  "customer-success-reporting-renewal",
  "executive-command-operating-cadence",
  "finance-control-commercial-events",
  "operations-administration-vendor-control",
  "product-offer-template-evolution",
  "technology-integrations-automation-control",
  "legal-obligations-rights-compliance",
  "brand-media-proof-distribution",
].map((key, index) => ({
  key,
  moduleIds: [index + 1],
  name: key
    .split("-")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" "),
  state: "required" as const,
  activationGateRefs: EMPYREAN_REFERENCE_PACKAGE.activationBlockers,
}));

const empyreanDormantCapabilities = [
  "capital-investor-relations",
  "mergers-acquisitions",
  "board-advisor-governance",
].map((key) => ({
  key,
  moduleIds: [],
  name: key
    .split("-")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" "),
  state: "dormant" as const,
  activationGateRefs: ["Explicit founder activation decision and qualified need."],
}));

export const EMPYREAN_COMPANY_PACKAGE = companyPackageSchema.parse({
  metadata: empyreanArtifact(
    EMPYREAN_REFERENCE_PACKAGE.key,
    "company_package",
    EMPYREAN_REFERENCE_PACKAGE.sources.registry,
    null,
  ).metadata,
  packageKey: EMPYREAN_REFERENCE_PACKAGE.key,
  packageVersion: EMPYREAN_REFERENCE_PACKAGE.version,
  materializerKey: "empyrean-studios-v1",
  targetCompanyAliases: [
    "Empyrean Studios",
    "Empyrean Creative",
    "Empyrean Creative LLC",
  ],
  universalCompanyTemplateRef: empyreanArtifact(
    "eos-universal-company-template-v1",
    "universal_company_template_ref",
    "https://app.notion.com/p/3b0da8b96e4f81e5bb28eee117838b5e",
    {
      key: "eos-universal-company-template",
      version: "1.0",
      sourceRef:
        "https://app.notion.com/p/3b0da8b96e4f81e5bb28eee117838b5e",
      sourceRevision: "2026-08-06",
    },
  ),
  domainPackRefs: [
    empyreanArtifact(
      "domain-pack-revenue-recovery-v1",
      "domain_pack_ref",
      EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
      {
        key: "revenue-recovery-professional-services",
        version: "1.0",
        sourceRef:
          EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
        sourceRevision: EMPYREAN_REFERENCE_PACKAGE.version,
      },
    ),
  ],
  companyManifest: empyreanArtifact(
    "empyrean-company-manifest",
    "company_manifest",
    EMPYREAN_REFERENCE_PACKAGE.sources.registry,
    {
      legalName: "Empyrean Creative LLC",
      operatingName: EMPYREAN_REFERENCE_PACKAGE.canonicalName,
      orgKey: EMPYREAN_REFERENCE_PACKAGE.organizationKey,
      ownershipClass: "owned",
      visibility: "public",
      mission:
        "Operate the public incubator and shared-services company while proving Revenue Recovery, partnerships, client delivery and the reusable EOS portfolio flywheel.",
      offerKeys: ["recovery-system"],
      idealCustomerProfile:
        "Roofing is the first controlled outbound wedge within eligible trades, construction and home services.",
      lifecycleStage: "validation",
      clientAuthorityReference: null,
    },
  ),
  capabilityManifest: empyreanArtifact(
    "empyrean-capability-manifest",
    "capability_manifest",
    EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
    [...empyreanCapabilities, ...empyreanDormantCapabilities],
  ),
  lifecycleActivationMap: empyreanArtifact(
    "empyrean-lifecycle-activation-map",
    "lifecycle_activation_map",
    EMPYREAN_REFERENCE_PACKAGE.sources.preLiveAuthority,
    {
      requestedState: "blocked",
      activationGates: EMPYREAN_REFERENCE_PACKAGE.activationBlockers,
      dependencies: [
        "Current commercial canon",
        "Exact provider-account authority",
        "Professional review",
        "Synthetic integrated rehearsal",
      ],
      rolloutSequence: [
        "Compile isolated dry-run instance",
        "Bind exact provider accounts and authority",
        "Pass controlled fixtures and recovery rehearsals",
        "Obtain founder release decision",
        "Run one evidence-bearing Recovery System lifecycle",
      ],
      stopLaws: [
        "Stop if company identity, ownership, tenant or authority is ambiguous.",
        "Stop if source revisions conflict without an explicit supersession rule.",
        "Stop if customer data or credentials would enter a shared package.",
        "Stop if economic, legal, privacy, operational or rollback evidence is missing.",
      ],
      rollbackConditions: [
        "Provider identity, scope or behavior differs from the approved binding.",
        "A cross-company disclosure or authority boundary is breached.",
        "A consequential effect lacks attributable evidence or reconciliation.",
      ],
    },
  ),
  orgRoleAgentGraph: empyreanArtifact(
    "empyrean-org-role-agent-graph",
    "org_role_agent_graph",
    EMPYREAN_REFERENCE_PACKAGE.sources.runtime,
    [
      {
        key: "founder",
        title: "Founder / Portfolio Principal",
        kind: "founder",
        reportsToSeatKey: null,
        agentName: "Executive Assistant",
        occupancyMode: "human_with_agent_assistant",
        mandate:
          "Set portfolio direction, retain owner authority and communicate with company leadership through the named Executive Assistant.",
        separationOfDutyRefs: ["Founder approval policy"],
      },
      ...EMPYREAN_REFERENCE_PACKAGE.seats.map((seat) => ({
        key: seat.key,
        title: seat.title,
        kind: seat.kind,
        reportsToSeatKey: seat.key === "company-ceo" ? "founder" : "company-ceo",
        agentName: seat.agentName,
        occupancyMode: seat.humanOccupied
          ? ("human_with_agent_assistant" as const)
          : ("agent" as const),
        mandate: seat.mandate,
        separationOfDutyRefs: [
          "Consequential external effects require explicit policy and approval.",
        ],
      })),
    ],
  ),
  authorityPolicySet: empyreanArtifact(
    "empyrean-authority-policy-set",
    "authority_policy_set",
    EMPYREAN_REFERENCE_PACKAGE.sources.preLiveAuthority,
    [
      {
        key: "founder-owner-authority",
        subjectSeatKey: "founder",
        authorityClasses: ["owner", "approve", "decide", "verify"],
        dataClasses: ["public", "internal", "confidential", "restricted"],
        transactionLimit: "No live financial authority until provider and commercial gates pass.",
        disclosureLimit: "Company and portfolio scope only; client-private truth remains isolated.",
      },
      {
        key: "company-ceo-operating-authority",
        subjectSeatKey: "company-ceo",
        authorityClasses: ["recommend", "decide", "execute", "verify"],
        dataClasses: ["public", "internal", "confidential"],
        transactionLimit: "No price, guarantee, signature or payment commitment without founder approval.",
        disclosureLimit: "Empyrean company scope and explicitly authorized shared-service packets only.",
      },
    ],
  ),
  workflowArtifactMap: empyreanArtifact(
    "empyrean-workflow-artifact-map",
    "workflow_artifact_map",
    EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
    [
      {
        key: "recovery-system-lifecycle",
        name: "Recovery System lifecycle",
        stateMachineRef: "eos.recovery-system.lifecycle.v1",
        workPacketKeys: [
          "owner-stamp-commercial-canon",
          "verify-provider-authority-map",
          "run-integrated-rehearsal",
          "run-first-field-cycle",
        ],
        artifactRequirements: [
          "Approved commercial canon",
          "Provider authority map",
          "Client onboarding and delivery record",
          "Closeout and outcome report",
        ],
        evidenceRequirements: [
          "Attributable approvals",
          "Provider receipts and reconciliation",
          "Observed delivery and economic outcome",
          "Failure and recovery evidence",
        ],
        exceptionPath:
          "Stop consequential execution, preserve state, escalate to the Company CEO Agent and founder, then use the documented manual fallback.",
      },
    ],
  ),
  providerBindingDeclarations: empyreanArtifact(
    "empyrean-provider-binding-declarations",
    "provider_binding_declarations",
    EMPYREAN_REFERENCE_PACKAGE.sources.preLiveAuthority,
    [
      ["gohighlevel", "GoHighLevel", "crm_oauth"],
      ["stripe", "Stripe", "payments_api"],
      ["docusign", "DocuSign", "esign_oauth"],
      ["google-workspace", "Google Workspace", "workspace_oauth"],
      ["notion", "Notion", "notion_public_oauth"],
    ].map(([key, provider, adapterClass]) => ({
      key,
      provider,
      adapterClass,
      accountScope: "Exact external account and resource scope is not yet bound.",
      credentialReference: null,
      authorityState: "selected",
      healthState: "unknown",
      substitutionRule:
        "EOS local Work Packets remain available; replace only after qualified parity and explicit cutover.",
      manualFallback:
        "Route the action to the accountable human with a source link and record the resulting evidence manually.",
    })),
  ),
  economicsMetricContracts: empyreanArtifact(
    "empyrean-economics-metric-contracts",
    "economics_metric_contracts",
    EMPYREAN_REFERENCE_PACKAGE.sources.registry,
    [
      {
        key: "recovery-lifecycle-proof",
        name: "Evidence-qualified Recovery System lifecycle",
        definition: "Count completed Recovery System cycles with verified provider, delivery and outcome evidence.",
        target: "One controlled complete cycle before field-qualification claims.",
        guardrail: "A pipeline entry, invoice draft or provider event alone is not a completed outcome.",
        attributionRule: "Attribute only evidence linked to the exact opportunity, Work Packets and provider receipts.",
        decisionGate: "No scaling decision until one complete cycle and one reviewed exception path exist.",
      },
      {
        key: "founder-dependence",
        name: "Founder intervention dependence",
        definition: "Material interventions by the founder per complete client-value cycle.",
        target: "Establish the first measured baseline, then reduce without expanding agent authority silently.",
        guardrail: "Do not infer independence from elapsed time or unreviewed agent activity.",
        attributionRule: "Count attributable approvals, remediations and direct execution events.",
        decisionGate: "Operatorization requires repeated cycles with bounded founder intervention.",
      },
    ],
  ),
  dataEvidenceContracts: empyreanArtifact(
    "empyrean-data-evidence-contracts",
    "data_evidence_contracts",
    EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
    [
      {
        key: "commercial-truth",
        dataClass: "confidential",
        authoritativeSource: "Owner-approved canon plus exact provider-authoritative commercial records.",
        retentionRule: "Retain decisions, versions and evidence under the active legal and records policy.",
        lineageRequirement: "Every term and outcome traces to its source revision, approval and external record when applicable.",
        qualificationRule: "Conflicting or owner-unstamped terms remain unresolved and non-executable.",
        promotionRule: "Promote reusable learning only after review and removal of client-private truth.",
      },
      {
        key: "provider-effect-evidence",
        dataClass: "restricted",
        authoritativeSource: "Exact provider account receipt reconciled to an approved EOS action.",
        retentionRule: "Retain the minimum evidence needed for audit, recovery and contractual obligations.",
        lineageRequirement: "Bind tenant, actor, policy, approval, adapter, external ID and observed result.",
        qualificationRule: "An EOS state change without provider confirmation is pending, failed or disputed—not complete.",
        promotionRule: "Aggregate operational learning without credentials, personal data or customer-private content.",
      },
    ],
  ),
  failureRecoveryMap: empyreanArtifact(
    "empyrean-failure-recovery-map",
    "failure_recovery_map",
    EMPYREAN_REFERENCE_PACKAGE.sources.preLiveAuthority,
    [
      {
        key: "provider-unavailable",
        failureClass: "Selected provider is unavailable or authorization is revoked.",
        incidentOwnerSeatKey: "automation-engineer-i",
        fallback: "Queue or hand off the bounded action without inventing provider success.",
        recovery: "Restore exact authorization, reconcile external state and replay only idempotent actions.",
        continuity: "Use the documented human fallback and keep EOS work/evidence state available.",
        learningPromotionRule: "Promote only reviewed, non-secret recovery improvements into the domain pack.",
      },
      {
        key: "commercial-authority-conflict",
        failureClass: "Pricing, guarantee, agreement or commitment authority is conflicting or absent.",
        incidentOwnerSeatKey: "account-executive-i",
        fallback: "Pause the commercial action and request a founder decision with conflicting sources attached.",
        recovery: "Record one superseding canon and invalidate stale executable projections.",
        continuity: "Continue non-consequential qualification and evidence collection only.",
        learningPromotionRule: "Update reusable decision grammar without publishing company-private commercial terms.",
      },
      {
        key: "cross-company-boundary-risk",
        failureClass: "A shared-service action may cross the Empyrean and AFM company boundary improperly.",
        incidentOwnerSeatKey: "company-ceo",
        fallback: "Stop the action and create an explicit relationship-scoped Work Packet.",
        recovery: "Verify both company scopes, authority, disclosure and evidence before resuming.",
        continuity: "Operate each company independently while the relationship is unresolved.",
        learningPromotionRule: "Promote only the reusable relationship pattern, never either company's private truth.",
      },
    ],
  ),
  sourceAuthorityManifest: empyreanArtifact(
    "empyrean-source-authority-manifest",
    "source_authority_manifest",
    EMPYREAN_REFERENCE_PACKAGE.sources.registry,
    {
      sources: [
        ["registry", EMPYREAN_REFERENCE_PACKAGE.sources.registry, 1, "canonical"],
        ["runtime", EMPYREAN_REFERENCE_PACKAGE.sources.runtime, 2, "canonical"],
        [
          "reference-implementation",
          EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
          3,
          "supporting",
        ],
        [
          "pre-live-authority",
          EMPYREAN_REFERENCE_PACKAGE.sources.preLiveAuthority,
          4,
          "supporting",
        ],
      ].map(([key, sourceRef, precedence, status]) => ({
        key,
        sourceRef,
        sourceRevision: EMPYREAN_REFERENCE_PACKAGE.version,
        precedence,
        status,
      })),
      unresolvedConflicts: [],
      freshnessRule:
        "The current registry and runtime revisions supersede older operating-name, pricing and role assumptions.",
      supersessionRule:
        "Current owner-stamped company registry wins; unresolved commercial conflicts remain blocked rather than silently selected.",
    },
  ),
});

export class EmpyreanCompilationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function stableUuid(companyId: number, key: string): string {
  const chars = createHash("sha256")
    .update(`eos:empyrean-reference:${companyId}:${key}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function identityHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hasPackageSelection(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const selections = (manifest as { packageSelections?: unknown }).packageSelections;
  return (
    Array.isArray(selections) &&
    selections.some(
      (selection) =>
        selection &&
        typeof selection === "object" &&
        (selection as { id?: unknown }).id === EMPYREAN_REFERENCE_PACKAGE.key &&
        (selection as { version?: unknown }).version ===
          EMPYREAN_REFERENCE_PACKAGE.version,
    )
  );
}

type CompileInput = {
  companyId: number;
  actorUserId: string;
  actorName: string;
};

export async function compileEmpyreanReferenceInstance(
  executor: any,
  input: CompileInput,
) {
  await executor.execute(
    sql`select pg_advisory_xact_lock(1162890832, ${input.companyId})`,
  );
  const company = await executor.query.companies.findFirst({
    where: eq(companies.id, input.companyId),
  });
  if (!company)
    throw new EmpyreanCompilationError(
      "company_not_found",
      "The selected company no longer exists.",
    );
  if (!/empyrean/i.test(company.name))
    throw new EmpyreanCompilationError(
      "wrong_reference_company",
      "The Empyrean reference package can only compile into an explicitly selected Empyrean company.",
    );

  const existingManifests = await executor
    .select()
    .from(eosManifestVersions)
    .where(eq(eosManifestVersions.companyId, company.id))
    .orderBy(desc(eosManifestVersions.version));
  const existingManifest = existingManifests.find((record: any) =>
    hasPackageSelection(record.manifest),
  );
  if (existingManifest) {
    return {
      created: false,
      company,
      manifest: existingManifest,
      report: (existingManifest.manifest as any)?.compiledFrom
        ?.referenceInstance,
    };
  }

  const founderSeat = await executor.query.eosSeats.findFirst({
    where: and(
      eq(eosSeats.companyId, company.id),
      eq(eosSeats.kind, "founder"),
      eq(eosSeats.status, "active"),
    ),
  });
  if (!founderSeat)
    throw new EmpyreanCompilationError(
      "founder_seat_required",
      "Compile the founder context before installing the Empyrean reference package.",
    );
  const membership = await executor.query.eosMemberships.findFirst({
    where: and(
      eq(eosMemberships.companyId, company.id),
      eq(eosMemberships.userId, input.actorUserId),
      eq(eosMemberships.status, "active"),
    ),
  });
  if (!membership && company.ownerUserId !== input.actorUserId)
    throw new EmpyreanCompilationError(
      "founder_membership_required",
      "An active founder membership is required to compile the reference package.",
    );

  const [updatedCompany] = await executor
    .update(companies)
    .set({
      name: EMPYREAN_REFERENCE_PACKAGE.canonicalName,
      type: "Venture-studio holdco and value-creation studio",
      stage: "Stage 1 — Validation / Reference Candidate",
      offer:
        "Recovery System ongoing managed engagement — $5,000 setup plus $2,500 per month standard; first 3–5 founding partners may qualify for $3,000 setup plus $1,500 per month for named proof consideration",
      targetCustomer:
        "Roofing is the first controlled outbound wedge within eligible trades, construction and home services.",
      goals:
        "Reconcile the current offer authority into the operative agreement; complete one governed Recovery System lifecycle; operate AFM shared services without collapsing company boundaries; convert field evidence into governed EOS improvements.",
    })
    .where(eq(companies.id, company.id))
    .returning();

  const activeSeats = await executor
    .select()
    .from(eosSeats)
    .where(
      and(eq(eosSeats.companyId, company.id), eq(eosSeats.status, "active")),
    );
  const seatsByTitle = new Map<string, any>(
    activeSeats.map(
      (seat: any) => [seat.title.toLowerCase(), seat] as [string, any],
    ),
  );
  const compiledSeats = new Map<string, any>();
  let companyCeoSeat: any;
  for (const definition of EMPYREAN_REFERENCE_PACKAGE.seats) {
    const existing = seatsByTitle.get(definition.title.toLowerCase());
    if (existing && existing.kind !== definition.kind)
      throw new EmpyreanCompilationError(
        "seat_contract_conflict",
        `${definition.title} already exists with an incompatible role kind.`,
      );
    const supervisorSeatId =
      definition.key === "company-ceo"
        ? founderSeat.id
        : companyCeoSeat?.id;
    if (!supervisorSeatId)
      throw new EmpyreanCompilationError(
        "ceo_seat_required",
        "The Company CEO seat must compile before subordinate seats.",
      );
    if (
      existing?.occupantUserId &&
      definition.humanOccupied &&
      existing.occupantUserId !== input.actorUserId
    )
      throw new EmpyreanCompilationError(
        "seat_occupancy_conflict",
        `${definition.title} is already occupied by another principal.`,
      );
    let seat = existing;
    if (!seat) {
      [seat] = await executor
        .insert(eosSeats)
        .values({
          id: stableUuid(company.id, `seat:${definition.key}`),
          companyId: company.id,
          title: definition.title,
          kind: definition.kind,
          supervisorSeatId,
          occupantUserId: definition.humanOccupied
            ? input.actorUserId
            : null,
          agentName: definition.agentName,
          agentMode: definition.humanOccupied ? "assistant" : "autonomous",
          mandate: definition.mandate,
          authority: {
            sourcePackage: EMPYREAN_REFERENCE_PACKAGE.key,
            commercialEffectsRequireApproval: true,
          },
          toolEntitlements: [],
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
    }
    compiledSeats.set(definition.key, seat);
    if (definition.key === "company-ceo") companyCeoSeat = seat;
  }

  for (const seat of Array.from(compiledSeats.values()))
    await ensureSeatOperatingKernel(
      executor,
      updatedCompany,
      seat,
      input.actorUserId,
    );

  for (const key of ["company-ceo", "account-executive-i"]) {
    const seat = compiledSeats.get(key);
    await executor
      .insert(eosAssignments)
      .values({
        id: stableUuid(company.id, `assignment:${key}`),
        companyId: company.id,
        membershipId: membership?.id || null,
        principalUserId: input.actorUserId,
        seatId: seat.id,
        assignmentType: "occupant",
        operatingGrant: "operate",
        purpose:
          key === "company-ceo"
            ? "Operate Empyrean as current human CEO with the CEO Agent as assistant."
            : "Carry the founding-stage Account Executive compression without merging the seat contract.",
        classificationCeiling:
          key === "company-ceo" ? "restricted" : "confidential",
        status: "active",
        effectiveFrom: new Date(),
        createdByUserId: input.actorUserId,
        metadata: {
          sourcePackage: EMPYREAN_REFERENCE_PACKAGE.key,
          occupancyCompression: true,
        },
      })
      .onConflictDoNothing();
  }

  const ceoSeat = compiledSeats.get("company-ceo");
  const solutionsSeat = compiledSeats.get("solutions-architect-i");
  const operationsSeat = compiledSeats.get("operations-coordinator-i");
  const contentSeat = compiledSeats.get("content-marketing-specialist-i");
  const packageId = (key: string) => stableUuid(company.id, key);
  const now = new Date();

  const stakeholders = [
    {
      key: "audience-roofing-first-wedge",
      name: "Roofing-first Recovery System audience",
      partyType: "audience_segment",
      state: "active",
      ownerSeatId: compiledSeats.get("sales-development-representative-i").id,
      identityReference: "audience:roofing-first-recovery-wedge",
      relationshipRole:
        "First controlled outbound wedge; not a real prospect or customer.",
      classification: "internal",
    },
    {
      key: "organization-context-afm",
      name: "Antony F. Munoz operating-company context",
      partyType: "organization",
      state: "active",
      ownerSeatId: contentSeat.id,
      identityReference: "organization-context:ORG-AFM",
      relationshipRole:
        "Distinct founder-led operating context served by Empyrean; this record does not assert separate legal-entity status.",
      classification: "confidential",
    },
    ...["GoHighLevel", "Stripe", "DocuSign", "Google Workspace", "Notion"].map(
      (name) => ({
        key: `vendor-${name.toLowerCase().replaceAll(" ", "-")}`,
        name,
        partyType: "vendor_provider",
        state: "proposed",
        ownerSeatId: solutionsSeat.id,
        identityReference: `provider:${name.toLowerCase().replaceAll(" ", "-")}`,
        relationshipRole:
          "Selected or intended provider; exact account, authority, recovery and test evidence remain unverified.",
        classification: "restricted",
      }),
    ),
  ];
  for (const stakeholder of stakeholders)
    await executor
      .insert(eosStakeholders)
      .values({
        id: packageId(`stakeholder:${stakeholder.key}`),
        companyId: company.id,
        portfolioId: company.portfolioId,
        stakeholderKey: stakeholder.key,
        name: stakeholder.name,
        partyType: stakeholder.partyType,
        state: stakeholder.state,
        ownerSeatId: stakeholder.ownerSeatId,
        identityReference: stakeholder.identityReference,
        identityReferenceHash: identityHash(stakeholder.identityReference),
        consentLegalBasis: "",
        relationshipRole: stakeholder.relationshipRole,
        evidenceKeys: [],
        sourceAuthority: "reconciled",
        classification: stakeholder.classification,
        recordedByUserId: input.actorUserId,
        validFrom: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

  const audienceId = packageId("stakeholder:audience-roofing-first-wedge");
  const afmId = packageId("stakeholder:organization-context-afm");
  const offerId = packageId("offer:recovery-system");
  await executor
    .insert(eosOfferPrograms)
    .values({
      id: offerId,
      companyId: company.id,
      portfolioId: company.portfolioId,
      offerKey: "OFFER-EMPYREAN-RECOVERY-SYSTEM",
      name: "Recovery System",
      offerType: "engagement",
      state: "validation",
      ownerSeatId: ceoSeat.id,
      problemNeed:
        "Recover qualified demand and booked-job opportunity from existing records and operating follow-up gaps.",
      promiseOutcome:
        "A governed opportunity-activation system with attributable execution, reporting and evidence.",
      audienceStakeholderIds: [audienceId],
      scopeInclusions:
        "Roofing-first qualification, recovery workflow preparation, governed execution, attribution, reporting and closeout.",
      exclusionsConstraints:
        "No conflicting price, guarantee or proof claim; no broad multi-niche outbound; no unapproved external communication.",
      deliveryModel:
        "Ongoing managed engagement. The first 30 days are the guarantee measurement window, not the product term.",
      pricingEconomicModel:
        "Standard: $5,000 setup plus $2,500 per month. Founding cohort: first 3–5 at $3,000 setup plus $1,500 per month for named proof consideration. Agreement, payment and provider activation remain controlled release gates.",
      commercialTermsAuthority:
        EMPYREAN_REFERENCE_PACKAGE.sources.registry,
      metricKeys: [
        "METRIC-EMPYREAN-RECOVERY-LIFECYCLES",
        "METRIC-EMPYREAN-UNOWNED-QUALIFIED-REPLIES",
      ],
      workflowKeys: ["PROCESS-EMPYREAN-RECOVERY-FOUNDING-LIFECYCLE"],
      evidenceKeys: [],
      sourceAuthority: "reconciled",
      classification: "confidential",
      recordedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const recoveryObjectiveId = packageId("objective:recovery-proof");
  const afmObjectiveId = packageId("objective:afm-shared-services");
  const guardrailObjectiveId = packageId("objective:truth-guardrail");
  const objectives = [
    {
      id: recoveryObjectiveId,
      key: "OBJ-EMPYREAN-RECOVERY-PROOF",
      type: "objective",
      title: "Prove one Recovery System lifecycle",
      statement:
        "Complete one real, governed recovery/client lifecycle with attributable economics, exceptions, evidence and verified outcome.",
      state: "active",
      priority: "critical",
      ownerSeatId: ceoSeat.id,
      boundary:
        "Architecture, configuration and synthetic rehearsal are not commercial proof.",
      success:
        "One owner-authorized field lifecycle is reconciled from demand through closeout with verified evidence.",
    },
    {
      id: afmObjectiveId,
      key: "OBJ-EMPYREAN-AFM-SHARED-SERVICES",
      type: "objective",
      title: "Operate AFM shared services without boundary collapse",
      statement:
        "Provide strategy, media, content, systems and distribution support through explicit cross-company work.",
      state: "active",
      priority: "high",
      ownerSeatId: contentSeat.id,
      boundary:
        "AFM retains separate hierarchy, authority, accounts, economics and evidence.",
      success:
        "Every Empyrean-to-AFM commitment is represented by an explicit relationship and governed Work Packet.",
    },
    {
      id: guardrailObjectiveId,
      key: "GUARDRAIL-EMPYREAN-COMMERCIAL-TRUTH",
      type: "guardrail",
      title: "Do not publish conflicting commercial or proof claims",
      statement:
        "Prepared architecture, historical pricing and unverified outcomes must never be represented as current commercial authority or proof.",
      state: "active",
      priority: "critical",
      ownerSeatId: founderSeat.id,
      boundary:
        "Only an explicit owner decision plus required professional/provider evidence may resolve a blocked claim.",
      success:
        "Every external claim resolves to current authority and evidence.",
    },
  ];
  for (const objective of objectives)
    await executor
      .insert(eosObjectives)
      .values({
        id: objective.id,
        companyId: company.id,
        portfolioId: company.portfolioId,
        objectiveKey: objective.key,
        recordType: objective.type,
        title: objective.title,
        statement: objective.statement,
        state: objective.state,
        priority: objective.priority,
        ownerSeatId: objective.ownerSeatId,
        scopeBoundary: objective.boundary,
        rationaleTheory:
          "Empyrean is the first EOS reference instance; operating value and reusable product validity must both hold.",
        successExitCriteria: objective.success,
        timeHorizon: "Current reference-instance activation",
        workPacketIds: [],
        metricIds: [],
        evidenceIds: [],
        decisionPolicyKeys: [],
        sourceAuthority: "reconciled",
        classification: "confidential",
        recordedByUserId: input.actorUserId,
        validFrom: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

  const metrics = [
    {
      key: "METRIC-EMPYREAN-RECOVERY-LIFECYCLES",
      title: "Verified Recovery System lifecycles",
      objectiveId: recoveryObjectiveId,
      ownerSeatId: operationsSeat.id,
      definition:
        "Count of genuine client lifecycles reconciled through closeout with required provider and outcome evidence.",
      unit: "count",
      direction: "at_least",
      target: "1",
      limitation:
        "Synthetic rehearsals and prepared architecture do not count.",
    },
    {
      key: "METRIC-EMPYREAN-UNOWNED-QUALIFIED-REPLIES",
      title: "Qualified replies without an owner",
      objectiveId: recoveryObjectiveId,
      ownerSeatId: compiledSeats.get("sales-development-representative-i").id,
      definition:
        "Count of qualified inbound or recovery replies lacking an accountable seat.",
      unit: "count",
      direction: "at_most",
      target: "0",
      limitation:
        "Cannot be measured until an exact CRM source and reconciliation path are verified.",
    },
  ];
  for (const metric of metrics)
    await executor
      .insert(eosMetricsOutcomes)
      .values({
        id: packageId(`metric:${metric.key}`),
        companyId: company.id,
        portfolioId: company.portfolioId,
        metricKey: metric.key,
        recordType: "metric_definition",
        title: metric.title,
        state: "defined",
        ownerSeatId: metric.ownerSeatId,
        objectiveId: metric.objectiveId,
        subjectType: "organization",
        subjectKey: EMPYREAN_REFERENCE_PACKAGE.organizationKey,
        definitionFormula: metric.definition,
        unitCurrency: metric.unit,
        thresholdDirection: metric.direction,
        targetValue: metric.target,
        timeGrainPeriod: "lifecycle",
        verifierConfidence: "definition_only",
        attributionLimitations: metric.limitation,
        evidenceIds: [],
        notes: "No observed value has been inferred.",
        sourceAuthority: "reconciled",
        classification: "confidential",
        recordedByUserId: input.actorUserId,
        validFrom: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

  const risks = [
    {
      key: "RISK-EMPYREAN-COMMERCIAL-CANON-CONFLICT",
      title: "Commercial canon is unresolved",
      ownerSeatId: founderSeat.id,
      description:
        "Conflicting historical pricing and sequence records could create an unauthorized quote, guarantee, refund or contract claim.",
      treatment:
        "Block quoting and payment configuration until the owner stamps one canon and required professional review is recorded.",
    },
    {
      key: "RISK-EMPYREAN-PROVIDER-AUTHORITY-UNVERIFIED",
      title: "Provider account and execution authority are unverified",
      ownerSeatId: solutionsSeat.id,
      description:
        "Selected tools exist without exact account, administrator, recovery, scope, event and failure-path evidence.",
      treatment:
        "Keep bindings unconfigured and record only safe provider identity metadata until controlled tests pass.",
    },
    {
      key: "CONTROL-EMPYREAN-AFM-BOUNDARY",
      title: "AFM remains a distinct operating context",
      ownerSeatId: ceoSeat.id,
      description:
        "Shared teams and capabilities could incorrectly collapse AFM records, authority or economics into Empyrean.",
      treatment:
        "Require explicit cross-company relationships and Work Packets; never model AFM as an internal Empyrean reporting line.",
    },
  ];
  for (const risk of risks)
    await executor
      .insert(eosRisksControls)
      .values({
        id: packageId(`risk:${risk.key}`),
        companyId: company.id,
        portfolioId: company.portfolioId,
        riskControlKey: risk.key,
        recordType: risk.key.startsWith("CONTROL-") ? "control" : "risk",
        title: risk.title,
        state: "under_assessment",
        ownerSeatId: risk.ownerSeatId,
        descriptionCauseEventImpact: risk.description,
        inherentAssessment: "Material reference-instance activation risk.",
        residualAssessment: "Open until evidence-backed treatment passes.",
        appetiteToleranceMateriality: "No unapproved external effect or claim.",
        treatmentControl: risk.treatment,
        sourceRequirement:
          "Current Notion canon plus provider/professional evidence where required.",
        evidenceIds: [],
        policyDecisionWorkKeys: [],
        exceptionIncidentKeys: [],
        sourceAuthority: "reconciled",
        classification: "restricted",
        recordedByUserId: input.actorUserId,
        validFrom: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

  const recoveryCapabilityId = packageId("capability:recovery-system");
  const providerCapabilityId = packageId("capability:provider-operations");
  const afmCapabilityId = packageId("capability:afm-shared-services");
  const capabilities = [
    {
      id: recoveryCapabilityId,
      key: "CAP-EMPYREAN-RECOVERY-SYSTEM",
      name: "Recovery System delivery",
      state: "activating",
      maturity: "defined",
      moduleIds: [2, 3, 4, 5, 6, 7],
      owner: operationsSeat.id,
      trigger: "Commercial canon, provider fixtures and integrated rehearsal pass.",
      workflows: ["PROCESS-EMPYREAN-RECOVERY-FOUNDING-LIFECYCLE"],
      metrics: ["METRIC-EMPYREAN-RECOVERY-LIFECYCLES"],
    },
    {
      id: providerCapabilityId,
      key: "CAP-EMPYREAN-PROVIDER-OPERATIONS",
      name: "Provider and integration operations",
      state: "blocked",
      maturity: "ad_hoc",
      moduleIds: [12],
      owner: solutionsSeat.id,
      trigger: "Exact account, authority, credential reference and test evidence exist.",
      workflows: [],
      metrics: [],
    },
    {
      id: afmCapabilityId,
      key: "CAP-EMPYREAN-AFM-SHARED-SERVICES",
      name: "AFM shared media and operating services",
      state: "activating",
      maturity: "defined",
      moduleIds: [6, 10, 14],
      owner: contentSeat.id,
      trigger: "An explicit AFM request and governed cross-company Work Packet exist.",
      workflows: [],
      metrics: [],
    },
  ];
  for (const capability of capabilities)
    await executor
      .insert(eosCapabilityInstances)
      .values({
        id: capability.id,
        companyId: company.id,
        portfolioId: company.portfolioId,
        capabilityInstanceKey: capability.key,
        capabilityKey: capability.key,
        name: capability.name,
        state: capability.state,
        maturity: capability.maturity,
        moduleIds: capability.moduleIds,
        accountableSeatId: capability.owner,
        activationTrigger: capability.trigger,
        deactivationTrigger: "Owner suspension, authority revocation or material control failure.",
        agentKeys: [],
        humanOperatorKey: input.actorUserId,
        systemKeys: [],
        workflowKeys: capability.workflows,
        metricKeys: capability.metrics,
        riskControlKeys: risks.map((risk) => risk.key),
        evidenceKeys: [],
        sourceAuthority: "reconciled",
        classification: "confidential",
        recordedByUserId: input.actorUserId,
        validFrom: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

  const processId = packageId("process:recovery-founding-lifecycle");
  await executor
    .insert(eosProcessDefinitions)
    .values({
      id: processId,
      companyId: company.id,
      portfolioId: company.portfolioId,
      processKey: "PROCESS-EMPYREAN-RECOVERY-FOUNDING-LIFECYCLE",
      name: "Recovery System founding lifecycle",
      version: 1,
      qualificationState: "mapped",
      releaseState: "draft",
      capabilityInstanceId: recoveryCapabilityId,
      workflowKey: "WORKFLOW-EMPYREAN-RECOVERY-FOUNDING-LIFECYCLE",
      purpose:
        "Govern the first roofing-oriented Recovery System engagement from qualified demand through closeout.",
      intendedOutcome:
        "A reconciled customer-value lifecycle with attributable economics, exceptions, evidence and verified outcome.",
      templateAncestry:
        "Empyrean Recovery System canon; EOS customer-value spine",
      applicableOverlays: ["recovery-system", "roofing-first-wedge"],
      triggerCondition:
        "Owner-approved release after agreement reconciliation, qualified review and pre-live rehearsal.",
      accountableSeatId: operationsSeat.id,
      supportingActorKeys: EMPYREAN_REFERENCE_PACKAGE.seats.map(
        (seat) => seat.key,
      ),
      requiredAuthority: ["execute", "approve"],
      disclosureScope: "confidential",
      prerequisites: EMPYREAN_REFERENCE_PACKAGE.activationBlockers,
      requiredInputs: [
        "Qualified demand record",
        "Verified provider and account scope",
        "Approved commercial terms",
        "Client consent and access boundary",
      ],
      toolSystemBoundaries: [
        "Provider systems remain authoritative for provider events.",
        "No credentials are stored in this process definition.",
      ],
      procedureSteps: [
        "Qualify demand and capacity.",
        "Approve current commercial terms.",
        "Reconcile successful payment or authorized commercial commitment.",
        "Dispatch and reconcile the approved agreement.",
        "Complete onboarding, access and launch guard.",
        "Execute recovery work with owned replies and evidence.",
        "Report weekly attribution and exceptions.",
        "Close out, retain, expand or stop with verified outcome.",
      ],
      branchConditions: [
        "Payment failure, agreement decline, withheld access, capacity failure and client withdrawal block launch.",
      ],
      approvalGates: [
        "External communication",
        "Commercial commitment",
        "Agreement",
        "Payment/refund exception",
        "Launch",
        "External proof claim",
      ],
      prohibitedActions: [
        "Quote unresolved pricing.",
        "Represent synthetic evidence as customer proof.",
        "Launch without verified access and approval.",
      ],
      requiredOutputs: [
        "Governed engagement record",
        "Provider reconciliation",
        "Weekly client report",
        "Closeout and learning proposal",
      ],
      evidenceRequirements: [
        "Provider event receipts",
        "Approval receipts",
        "Delivery artifacts",
        "Outcome and economics evidence",
      ],
      qualityCriteria: [
        "No qualified reply is unowned.",
        "No material claim lacks current authority and evidence.",
      ],
      emittedEvents: [
        "opportunity.qualified",
        "engagement.authorized",
        "onboarding.ready",
        "delivery.reconciled",
        "engagement.closed",
      ],
      failurePaths: [
        "Pause, preserve partial provider truth, compensate where authorized, and escalate to the founder.",
      ],
      terminalCriteria: [
        "Verified closeout, explicit cancellation or owner-authorized stop.",
      ],
      trainingPrerequisites: [],
      acceptanceTests: [
        "Synthetic success, decline, duplicate, delay, revocation, rollback and recovery paths pass.",
      ],
      reviewerKeys: ["founder", "company-ceo"],
      sourceAuthority: "reconciled",
      classification: "confidential",
      recordedByUserId: input.actorUserId,
      effectiveFrom: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const workPackets = [
    {
      key: "reconcile-commercial-agreement",
      title: "Reconcile the Recovery System agreement",
      objective:
        "Reconcile the current offer, price, guarantee measurement window, refund/cancellation, contracting entity, signatory and sequence into one operative agreement and obtain qualified counsel review.",
      status: "awaiting_approval",
      priority: "urgent",
      seatId: founderSeat.id,
      approval: true,
      capabilityId: recoveryCapabilityId,
      processId: null,
      evidence: [
        "Explicit owner decision",
        "Required professional review references",
      ],
    },
    {
      key: "verify-provider-authority-map",
      title: "Verify Empyrean provider and authority map",
      objective:
        "Record safe exact account/resource identities, administrators, recovery owners, intended scopes, credential references and controlled test paths without storing secrets.",
      status: "ready",
      priority: "urgent",
      seatId: solutionsSeat.id,
      approval: false,
      capabilityId: providerCapabilityId,
      processId: null,
      evidence: [
        "Safe provider/resource IDs or URLs",
        "Administrator and recovery owner",
        "Controlled test evidence",
      ],
    },
    {
      key: "synthetic-recovery-rehearsal",
      title: "Run the integrated synthetic Recovery System rehearsal",
      objective:
        "Exercise a synthetic roofing client from commercial authorization through agreement, onboarding, delivery, reporting, exceptions and closeout.",
      status: "draft",
      priority: "high",
      seatId: operationsSeat.id,
      approval: false,
      capabilityId: recoveryCapabilityId,
      processId,
      evidence: [
        "Lifecycle transition receipts",
        "Failure and rollback evidence",
        "Provider reconciliation",
      ],
    },
    {
      key: "afm-shared-service-boundary",
      title: "Compile the Empyrean-to-AFM shared-service boundary",
      objective:
        "Define the explicit request, accountable Empyrean seat, AFM authority, deliverable, review and evidence path for media and distribution support.",
      status: "ready",
      priority: "high",
      seatId: contentSeat.id,
      approval: false,
      capabilityId: afmCapabilityId,
      processId: null,
      evidence: [
        "AFM-authorized request",
        "Reviewed deliverable",
        "Publication approval when applicable",
      ],
    },
  ];
  for (const packet of workPackets)
    await executor
      .insert(eosWorkPackets)
      .values({
        id: packageId(`work:${packet.key}`),
        companyId: company.id,
        createdByUserId: input.actorUserId,
        accountableUserId: input.actorUserId,
        accountableSeatId: packet.seatId,
        title: packet.title,
        objective: packet.objective,
        status: packet.status,
        priority: packet.priority,
        source: "compiler",
        visibility: "company",
        classification: "confidential",
        requiresApproval: packet.approval,
        toolPack: [],
        evidenceRequirements: packet.evidence,
        capabilityInstanceId: packet.capabilityId,
        processDefinitionId: packet.processId,
        resourceIds: [],
        expectedOutput:
          "A versioned, reviewable artifact plus explicit remaining blockers.",
        acceptanceCriteria:
          "Every claimed completion is supported by the listed evidence and preserves external source authority.",
        constraintsPolicies:
          "No raw secrets; no invented provider state; no external effect without current authority and approval.",
        failureEscalationCompensation:
          "Keep dependent work blocked, preserve partial truth, isolate the missing decision or evidence, and escalate through the CEO Agent to the founder Executive Assistant.",
        humanFallback:
          "Antony remains the current accountable human authority until an explicit delegation is active.",
        sourceLineage: Object.values(EMPYREAN_REFERENCE_PACKAGE.sources).join(
          "\n",
        ),
        outputArtifactKeys: [],
        traceId: packageId(`trace:work:${packet.key}`),
        correlationId: packageId(`correlation:work:${packet.key}`),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

  const commercialPacketId = packageId("work:reconcile-commercial-agreement");
  await executor
    .insert(eosApprovalRequests)
    .values({
      id: packageId("approval:reconcile-commercial-agreement"),
      companyId: company.id,
      workPacketId: commercialPacketId,
      requestedByUserId: input.actorUserId,
      assignedToUserId: input.actorUserId,
      assignedToSeatId: founderSeat.id,
      summary: "Approve the reconciled Recovery System agreement after qualified review",
      status: "pending",
      createdAt: now,
    })
    .onConflictDoNothing();

  const afmRelationshipId = packageId("relationship:empyrean-afm-shared-services");
  await executor
    .insert(eosStakeholderRelationships)
    .values({
      id: afmRelationshipId,
      companyId: company.id,
      portfolioId: company.portfolioId,
      relationshipKey: "REL-EMPYREAN-AFM-SHARED-SERVICES",
      stakeholderId: afmId,
      relationshipType: "partner",
      title: "Empyrean-to-AFM incubation and shared services",
      state: "active",
      ownerSeatId: ceoSeat.id,
      needConstraint:
        "AFM requests bounded shared strategy, media, content, systems, analytics, talent or commercial support.",
      fitHypothesis:
        "Shared Empyrean capabilities can support AFM without merging company hierarchy, authority, accounts, economics or evidence.",
      nextBestAction:
        "Approve the first explicit AFM shared-service Work Packet.",
      evidenceKeys: [],
      sourceAuthority: "reconciled",
      classification: "confidential",
      recordedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await executor
    .insert(eosCommercialCases)
    .values({
      id: packageId("case:recovery-founding-proof"),
      companyId: company.id,
      portfolioId: company.portfolioId,
      caseKey: "CASE-EMPYREAN-RECOVERY-FOUNDING-PROOF",
      title: "Recovery System founding proof cohort preparation",
      objectClass: "internal_initiative",
      state: "identified",
      ownerSeatId: ceoSeat.id,
      stakeholderIds: [audienceId],
      offerId,
      currency: "USD",
      nextAction:
        "Resolve commercial authority and pass the integrated synthetic rehearsal before creating a real prospect or customer instance.",
      resultOutcome:
        "No field outcome exists; this is an internal preparation case.",
      riskExceptionKeys: risks.map((risk) => risk.key),
      evidenceKeys: [],
      sourceAuthority: "reconciled",
      classification: "confidential",
      recordedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const eosSystemId = packageId("system:eos");
  const providerDefinitions = [
    {
      key: "gohighlevel",
      name: "GoHighLevel",
      type: "application",
      capabilities: ["crm", "forms", "calendar", "workflow"],
      domains: ["stakeholders", "opportunities", "communications"],
      fields: ["provider contacts", "provider pipeline", "provider events"],
      intent: "integrate",
    },
    {
      key: "stripe",
      name: "Stripe",
      type: "provider",
      capabilities: ["payment events", "refund events"],
      domains: ["commercial", "finance"],
      fields: ["payment and refund facts"],
      intent: "integrate",
    },
    {
      key: "docusign",
      name: "DocuSign",
      type: "provider",
      capabilities: ["agreement dispatch", "signature events"],
      domains: ["commercial", "legal"],
      fields: ["signature and certificate facts"],
      intent: "integrate",
    },
    {
      key: "google-workspace",
      name: "Google Workspace",
      type: "application",
      capabilities: ["mail", "calendar", "drive"],
      domains: ["communications", "scheduling", "artifacts"],
      fields: ["provider message, event and file facts"],
      intent: "integrate",
    },
    {
      key: "notion",
      name: "Notion",
      type: "application",
      capabilities: ["reference context", "client hub scaffolding"],
      domains: ["knowledge", "artifacts"],
      fields: ["external reference pages"],
      intent: "migrate",
    },
  ] as const;
  await executor
    .insert(eosSystems)
    .values({
      id: eosSystemId,
      companyId: company.id,
      portfolioId: company.portfolioId,
      systemKey: "SYSTEM-EOS",
      name: "EntrepreneurOS",
      systemType: "system",
      lifecycleState: "active",
      ownerSeatId: solutionsSeat.id,
      capabilities: ["institutional state", "policy", "work", "evidence"],
      dataDomains: ["organization", "work", "authority", "evidence"],
      authoritativeFields: ["native EOS institutional state"],
      riskNotes:
        "Provider facts remain authoritative in their provider systems until reconciled.",
      replacementIntent: "keep",
      sourceAuthority: "native_eos",
      classification: "restricted",
      recordedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  for (const provider of providerDefinitions) {
    const systemId = packageId(`system:${provider.key}`);
    const vendorId = packageId(
      `stakeholder:vendor-${provider.name.toLowerCase().replaceAll(" ", "-")}`,
    );
    await executor
      .insert(eosSystems)
      .values({
        id: systemId,
        companyId: company.id,
        portfolioId: company.portfolioId,
        systemKey: `SYSTEM-${provider.key.toUpperCase()}`,
        name: provider.name,
        systemType: provider.type,
        lifecycleState: "selected",
        ownerSeatId: solutionsSeat.id,
        vendorStakeholderId: vendorId,
        capabilities: provider.capabilities,
        dataDomains: provider.domains,
        authoritativeFields: provider.fields,
        riskNotes:
          "Exact account, administrator, recovery owner, permission scope and behavioral test remain unverified.",
        replacementIntent: provider.intent,
        sourceAuthority: "reconciled",
        classification: "restricted",
        recordedByUserId: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    const adapterKind =
      provider.key === "google-workspace" || provider.key === "notion"
        ? "oauth"
        : "webhook";
    const integrationBindingId = packageId(`integration:${provider.key}`);
    await executor
      .insert(eosIntegrationBindings)
      .values({
        id: integrationBindingId,
        companyId: company.id,
        portfolioId: company.portfolioId,
        integrationKey: `INTEGRATION-EMPYREAN-${provider.key.toUpperCase()}`,
        name: `${provider.name} → EOS reference binding`,
        fromSystemId: systemId,
        toSystemId: eosSystemId,
        providerKey: provider.key,
        providerAccountReference: "",
        adapterKind,
        adapterReference: `planned:${provider.key}:eos`,
        adapterVersion: "",
        transport: "",
        lifecycleState: "selected",
        connectionState: "unconfigured",
        healthState: "unknown",
        ownerSeatId: solutionsSeat.id,
        recoveryOwnerSeatId: ceoSeat.id,
        administratorReference: "",
        accountScope: "Unverified; no execution authority.",
        nativePermissions: [],
        credentialReference: null,
        executionAuthority:
          "No provider effect is authorized until exact scope, grant, approval and live evidence exist.",
        operations: [],
        expectedEvents: [],
        inputSchema: {},
        outputSchema: {},
        eventSchema: {},
        costModel: "",
        latencyBudgetMs: null,
        rateLimitPolicy: "",
        idempotencyStrategy: "",
        retryPolicy: "",
        timeoutMs: null,
        cancellationBehavior: "",
        redactionPolicy: "",
        evidenceRequirements: [],
        testCapability: "",
        revocationProcedure: "",
        manualFallback:
          "Operate the governed EOS work and approval queue without representing a provider effect.",
        failureRecovery:
          "Keep dependent work blocked, preserve provider truth, and escalate the missing account or authority evidence.",
        replacementStatus: provider.intent,
        parityState: "not_tested",
        workPacketId: packageId("work:verify-provider-authority-map"),
        evidenceIds: [],
        configurationVersion: 1,
        sourceAuthority: "reconciled",
        classification: "restricted",
        schemaVersion: "integration-binding-v2.0",
        recordedByUserId: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    const [integrationBinding] = await executor
      .select()
      .from(eosIntegrationBindings)
      .where(
        and(
          eq(eosIntegrationBindings.companyId, company.id),
          eq(eosIntegrationBindings.id, integrationBindingId),
        ),
      )
      .limit(1);
    if (integrationBinding) {
      const traceId = randomUUID();
      await executor
        .insert(eosIntegrationBindingRevisions)
        .values({
          id: randomUUID(),
          companyId: company.id,
          integrationBindingId,
          configurationVersion: integrationBinding.configurationVersion,
          snapshot:
            integrationBindingConfigurationSnapshot(integrationBinding),
          changeSummary: "Compiled Empyrean reference binding",
          recordedByUserId: input.actorUserId,
          recordedBySeatId: solutionsSeat.id,
          traceId,
          correlationId: traceId,
          createdAt: now,
        })
        .onConflictDoNothing();
    }
  }

  const latestVersion = existingManifests[0]?.version || 0;
  const manifestId = packageId(
    `manifest:${EMPYREAN_REFERENCE_PACKAGE.version}`,
  );
  const report = {
    packageKey: EMPYREAN_REFERENCE_PACKAGE.key,
    packageVersion: EMPYREAN_REFERENCE_PACKAGE.version,
    organizationKey: EMPYREAN_REFERENCE_PACKAGE.organizationKey,
    sourceEffectiveAt: EMPYREAN_REFERENCE_PACKAGE.sourceEffectiveAt,
    sourceUris: Object.values(EMPYREAN_REFERENCE_PACKAGE.sources),
    activationState: "blocked",
    activationBlockers: EMPYREAN_REFERENCE_PACKAGE.activationBlockers,
    records: {
      seats: [founderSeat.id, ...Array.from(compiledSeats.values()).map((seat) => seat.id)],
      objectives: objectives.map((objective) => objective.id),
      offer: offerId,
      capabilities: capabilities.map((capability) => capability.id),
      process: processId,
      workPackets: workPackets.map((packet) =>
        packageId(`work:${packet.key}`),
      ),
      systems: [
        eosSystemId,
        ...providerDefinitions.map((provider) =>
          packageId(`system:${provider.key}`),
        ),
      ],
      integrations: providerDefinitions.map((provider) =>
        packageId(`integration:${provider.key}`),
      ),
      afmRelationship: afmRelationshipId,
    },
  };
  const manifest = manifestInputSchema.parse({
    purpose:
      "Operate Empyrean Studios as the first EOS reference instance while preserving truth, authority, evidence and reusable product semantics.",
    stage: "Stage 1 — Validation / Reference Candidate",
    offer:
      "Recovery System ongoing managed engagement; $5,000 setup plus $2,500 per month standard, with a bounded first 3–5 founding-partner cohort at $3,000 setup plus $1,500 per month for named proof consideration",
    targetCustomer:
      "Roofing is the first controlled outbound wedge within eligible trades, construction and home services.",
    goals: [
      "Reconcile the current Recovery System authority into the operative agreement and complete qualified review.",
      "Complete one governed Recovery System lifecycle with verified economics and outcome.",
      "Operate AFM shared services without collapsing company boundaries.",
      "Promote only validated, anonymized reusable learning into EOS.",
    ],
    enabledModules: Array.from({ length: 14 }, (_, index) => index + 1),
    ownerSeat: { title: founderSeat.title, authority: "owner" },
    operatingCadence: "weekly",
    founderProfile:
      updatedCompany.founderProfile &&
      typeof updatedCompany.founderProfile === "object"
        ? updatedCompany.founderProfile
        : {},
    sourceAssertions: [
      {
        label: "Current company registry",
        value:
          "Empyrean Studios is partially active, reference-candidate, and proof-in-progress.",
        sourceType: "source_fact",
        sourceUri: EMPYREAN_REFERENCE_PACKAGE.sources.registry,
      },
      {
        label: "Founding accountability chart",
        value:
          "Antony currently compresses the human CEO and Account Executive seats; the remaining founding seats are agent-operated under the Company CEO Agent.",
        sourceType: "source_fact",
        sourceUri: EMPYREAN_REFERENCE_PACKAGE.sources.runtime,
      },
      {
        label: "Reference-instance doctrine",
        value:
          "Every component must improve Empyrean and preserve reusable EOS semantics.",
        sourceType: "source_fact",
        sourceUri:
          EMPYREAN_REFERENCE_PACKAGE.sources.referenceImplementation,
      },
      {
        label: "Commercial and provider authority",
        value:
          "Real charging, contracting, onboarding and delivery remain blocked pending current authority, provider and rehearsal evidence.",
        sourceType: "source_fact",
        sourceUri: EMPYREAN_REFERENCE_PACKAGE.sources.preLiveAuthority,
      },
    ],
    assumptions: [],
    unknowns: EMPYREAN_REFERENCE_PACKAGE.activationBlockers,
    packageSelections: [
      {
        id: EMPYREAN_REFERENCE_PACKAGE.key,
        version: EMPYREAN_REFERENCE_PACKAGE.version,
        rationale:
          "Compile the current Empyrean Studios canon into EOS as the first reusable reference instance.",
      },
    ],
    provisioningChecklist: EMPYREAN_REFERENCE_PACKAGE.activationBlockers.map(
      (label, index) => ({
        id: `empyrean-blocker-${index + 1}`,
        label,
        required: true,
        complete: false,
      }),
    ),
    verificationChecks: [
      {
        id: "empyrean-integrated-rehearsal",
        label:
          "Synthetic customer, provider, failure, rollback and recovery rehearsal passes.",
        status: "pending",
      },
      {
        id: "empyrean-owner-release",
        label: "Founder records the explicit reference-instance release decision.",
        status: "pending",
      },
    ],
  });
  const advisorCouncil = buildAdvisorCouncil({
    founderName: input.actorName,
    companyName: updatedCompany.name,
    founderProfile: manifest.founderProfile,
    companyGoals: manifest.goals.join("\n"),
  });
  await executor.insert(eosManifestVersions).values({
    id: manifestId,
    companyId: company.id,
    version: latestVersion + 1,
    status: "draft",
    manifest: {
      ...manifest,
      advisorCouncil,
      compiledFrom: {
        companyId: company.id,
        companyName: updatedCompany.name,
        referenceInstance: report,
      },
      schemaVersion: "eos.organization-manifest.v1",
    },
    createdByUserId: input.actorUserId,
    createdAt: now,
  });

  await executor
    .insert(eosAuditRecords)
    .values({
      id: packageId(
        `audit:compiled:${EMPYREAN_REFERENCE_PACKAGE.version}`,
      ),
      companyId: company.id,
      actorUserId: input.actorUserId,
      action: "reference_instance.compiled",
      targetType: "organization_manifest",
      targetId: manifestId,
      traceId: randomUUID(),
      correlationId: packageId(
        `correlation:compiled:${EMPYREAN_REFERENCE_PACKAGE.version}`,
      ),
      result: "activation_blocked",
      details: {
        packageKey: EMPYREAN_REFERENCE_PACKAGE.key,
        packageVersion: EMPYREAN_REFERENCE_PACKAGE.version,
        activationBlockers: EMPYREAN_REFERENCE_PACKAGE.activationBlockers,
        noExternalEffect: true,
        noCustomerCreated: true,
        noPriceSelected: true,
      },
      createdAt: now,
    })
    .onConflictDoNothing();

  const createdManifest = await executor.query.eosManifestVersions.findFirst({
    where: eq(eosManifestVersions.id, manifestId),
  });
  return {
    created: true,
    company: updatedCompany,
    manifest: createdManifest,
    report,
  };
}
