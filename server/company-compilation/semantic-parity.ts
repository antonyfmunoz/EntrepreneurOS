import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { CompanyPackage } from "@shared/company-compilation";
import type { CompanySourceBinding } from "@shared/company-source-adapter";
import { artifactClosureClasses, closureGroupState, type ArtifactClosureClass } from "@shared/artifact-closure";
import {
  companies,
  eosArtifactClosureEvents,
  eosArtifactClosureRecords,
  eosAuditRecords,
  eosCapabilityInstances,
  eosCompanyPackageInstallations,
  eosSeats,
} from "@shared/schema";
import { nativeContractContentSha256 } from "../esign/template-generation";

type Executor = any;

function stableUuid(packageKey: string, companyId: number, key: string): string {
  const chars = createHash("sha256").update(`eos:${packageKey}:${companyId}:${key}`).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function capabilityState(state: CompanyPackage["capabilityManifest"]["value"][number]["state"]): string {
  if (state === "available") return "active";
  if (state === "required" || state === "missing") return "blocked";
  if (state === "dormant") return "dormant";
  if (state === "prohibited") return "deprecated";
  return "planned";
}

type ClosureSeed = {
  applicability: "inherited" | "instantiated" | "missing" | "not_applicable" | "deferred_by_trigger";
  maturity: "doctrine" | "mapped" | "artifact_complete";
  blocker: string;
  nextAction: string;
  rationale: string;
  triggerCondition: string;
};

function closureSeed(
  artifactClass: ArtifactClosureClass,
  input: { dormant: boolean; activationTrigger: string; packageRef: string },
): ClosureSeed {
  if (input.dormant) return {
    applicability: "deferred_by_trigger",
    maturity: "doctrine",
    blocker: "",
    nextAction: "Retain the dormant boundary until the founder records the exact activation trigger and required evidence.",
    rationale: "The canonical package explicitly keeps this capability dormant; EOS records the full artifact inventory without activating it.",
    triggerCondition: input.activationTrigger || "Explicit evidence-linked founder activation decision.",
  };
  const artifactComplete = new Set<ArtifactClosureClass>([
    "capability_definition",
    "template_ancestry_overlays",
    "role_seat",
    "authority_permission_disclosure",
    "evidence_provenance_requirements",
    "exception_escalation_rollback",
  ]);
  if (artifactComplete.has(artifactClass)) return {
    applicability: artifactClass === "template_ancestry_overlays" ? "inherited" : "instantiated",
    maturity: "artifact_complete",
    blocker: "",
    nextAction: "Preserve this compiled artifact and attach qualification Evidence before advancing its maturity.",
    rationale: `The validated company package ${input.packageRef} supplies this structured artifact with exact source provenance and stop laws.`,
    triggerCondition: "",
  };
  const mapped = new Set<ArtifactClosureClass>([
    "workflow_state_machine",
    "work_packet_templates",
    "kpis_scorecard_thresholds",
    "tools_integrations_provider_bindings",
    "acceptance_tests_rehearsal_fixtures",
    "template_learning_versioning",
  ]);
  if (mapped.has(artifactClass)) return {
    applicability: artifactClass === "template_learning_versioning" ? "inherited" : "instantiated",
    maturity: "mapped",
    blocker: "Qualification Evidence and company-specific instance values are still required before this artifact can be called implemented.",
    nextAction: "Bind the exact company instance, accountable owner and verified Evidence, then advance through the normal artifact-closure decision.",
    rationale: `The package ${input.packageRef} supplies a bounded structured contract, but a compiled contract is not operating or field proof.`,
    triggerCondition: "",
  };
  return {
    applicability: "missing",
    maturity: "mapped",
    blocker: "No company-specific, evidence-bearing artifact has been reconciled for this canonical class.",
    nextAction: "Reconcile the current Notion canon and native EOS records, assign one accountable owner, and attach verified Evidence.",
    rationale: `The canonical 22-class parity contract requires an explicit state for this artifact; ${input.packageRef} does not manufacture unsupported completion.`,
    triggerCondition: "",
  };
}

export async function ensureCompanyPackageSemanticParity(executor: Executor, input: {
  companyId: number;
  actorUserId: string;
  packageDefinition: CompanyPackage;
}) {
  const { companyId, actorUserId, packageDefinition } = input;
  const company = await executor.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new Error("The company disappeared while materializing semantic parity.");
  const seats = await executor.select().from(eosSeats).where(eq(eosSeats.companyId, companyId));
  const accountableSeat = seats.find((seat: any) => seat.kind === "company_ceo" && seat.status === "active")
    || seats.find((seat: any) => seat.kind === "founder" && seat.status === "active");
  if (!accountableSeat) throw new Error("Semantic parity requires an active company CEO or founder seat.");

  const now = new Date();
  const existingCapabilities = await executor.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId));
  const existingCapabilityKeys = new Set(existingCapabilities.map((item: any) => item.capabilityInstanceKey));
  const missingCapabilities = packageDefinition.capabilityManifest.value.filter((capability) => !existingCapabilityKeys.has(capability.key));
  if (missingCapabilities.length) await executor.insert(eosCapabilityInstances).values(missingCapabilities.map((capability) => ({
    id: stableUuid(packageDefinition.packageKey, companyId, `canonical-capability:${capability.key}`),
    companyId,
    portfolioId: company.portfolioId,
    capabilityInstanceKey: capability.key,
    capabilityKey: capability.key,
    name: capability.name,
    state: capabilityState(capability.state),
    maturity: "defined",
    accountableSeatId: accountableSeat.id,
    activationTrigger: capability.activationGateRefs.join("; "),
    deactivationTrigger: "Founder decision, package supersession, authority revocation, or material control failure.",
    moduleIds: capability.moduleIds,
    agentKeys: [],
    humanOperatorKey: accountableSeat.occupantUserId || "",
    systemKeys: [],
    workflowKeys: packageDefinition.workflowArtifactMap.value.map((workflow) => workflow.key),
    metricKeys: packageDefinition.economicsMetricContracts.value.map((metric) => metric.key),
    riskControlKeys: packageDefinition.failureRecoveryMap.value.map((control) => control.key),
    evidenceKeys: [],
    sourceAuthority: "reconciled",
    classification: "internal",
    schemaVersion: "capability-instance-v1.0",
    recordedByUserId: actorUserId,
    validFrom: now,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoNothing();

  const canonicalCapabilities = await executor.select().from(eosCapabilityInstances)
    .where(and(eq(eosCapabilityInstances.companyId, companyId), inArray(eosCapabilityInstances.capabilityInstanceKey, packageDefinition.capabilityManifest.value.map((item) => item.key))));
  const canonicalByKey = new Map<string, any>(
    canonicalCapabilities.map((item: any) => [item.capabilityInstanceKey, item]),
  );
  const existingClosure = await executor.select({
    moduleId: eosArtifactClosureRecords.moduleId,
    capabilityKey: eosArtifactClosureRecords.capabilityKey,
    artifactClass: eosArtifactClosureRecords.artifactClass,
  }).from(eosArtifactClosureRecords).where(eq(eosArtifactClosureRecords.companyId, companyId));
  const present = new Set(existingClosure.map((record: any) => `${record.moduleId}:${record.capabilityKey}:${record.artifactClass}`));
  const packageRef = `${packageDefinition.packageKey}@${packageDefinition.packageVersion}`;
  const rows = packageDefinition.capabilityManifest.value.flatMap((capability) => capability.moduleIds.flatMap((moduleId) => artifactClosureClasses
    .filter((artifactClass) => !present.has(`${moduleId}:${capability.key}:${artifactClass}`))
    .map((artifactClass) => {
      const seed = closureSeed(artifactClass, {
        dormant: capability.state === "dormant",
        activationTrigger: capability.activationGateRefs.join("; "),
        packageRef,
      });
      return {
        id: stableUuid(packageDefinition.packageKey, companyId, `artifact-closure:${moduleId}:${capability.key}:${artifactClass}`),
        companyId,
        portfolioId: company.portfolioId,
        moduleId,
        capabilityKey: capability.key,
        capabilityInstanceId: canonicalByKey.get(capability.key)?.id || null,
        artifactClass,
        ...seed,
        ownerSeatId: canonicalByKey.get(capability.key)?.accountableSeatId || accountableSeat.id,
        templateStack: [packageDefinition.universalCompanyTemplateRef.value.key, packageRef, ...packageDefinition.domainPackRefs.map((item) => `${item.value.key}@${item.value.version}`)],
        evidenceIds: [],
        classification: "confidential",
        version: 1,
        recordedByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      };
    })));
  const created: Array<typeof eosArtifactClosureRecords.$inferSelect> = [];
  for (let offset = 0; offset < rows.length; offset += 200)
    created.push(...await executor.insert(eosArtifactClosureRecords).values(rows.slice(offset, offset + 200)).onConflictDoNothing().returning());
  if (created.length) {
    const events = created.map((record) => {
      const changeProjection = {
        schemaVersion: "eos-artifact-closure-event.v1",
        action: "initialized",
        initializationMode: "company_package_semantic_parity",
        recordId: record.id,
        companyId,
        moduleId: record.moduleId,
        capabilityKey: record.capabilityKey,
        artifactClass: record.artifactClass,
        applicability: record.applicability,
        maturity: record.maturity,
        packageKey: packageDefinition.packageKey,
        packageVersion: packageDefinition.packageVersion,
        recordedAt: now.toISOString(),
      };
      return {
        id: randomUUID(), companyId, recordId: record.id, sequence: 1, action: "initialized",
        fromMaturity: "doctrine", toMaturity: record.maturity, changeProjection,
        changeSha256: nativeContractContentSha256(changeProjection), evidenceIds: [], recordedByUserId: actorUserId, recordedAt: now,
      };
    });
    for (let offset = 0; offset < events.length; offset += 200)
      await executor.insert(eosArtifactClosureEvents).values(events.slice(offset, offset + 200));
    await executor.insert(eosAuditRecords).values({
      id: randomUUID(), companyId, actorUserId, action: "company_package.semantic_parity_initialized",
      targetType: "company_package", targetId: packageDefinition.packageKey, traceId: randomUUID(), correlationId: randomUUID(),
      result: "represented_with_truthful_gaps", details: { packageVersion: packageDefinition.packageVersion, canonicalCapabilitiesCreated: missingCapabilities.length, closureRowsCreated: created.length, externalEffectsExecuted: false }, createdAt: now,
    });
  }
  return {
    canonicalCapabilitiesCreated: missingCapabilities.length,
    closureRowsCreated: created.length,
    expectedCapabilityModuleGroups: packageDefinition.capabilityManifest.value.reduce((sum, capability) => sum + capability.moduleIds.length, 0),
    externalEffectsExecuted: false,
  };
}

export async function companyPackageParitySnapshot(executor: Executor, input: {
  companyId: number;
  packageDefinition: CompanyPackage;
  sourceBindings: CompanySourceBinding[];
}) {
  const { companyId, packageDefinition, sourceBindings } = input;
  const expectedCapabilities = packageDefinition.capabilityManifest.value;
  const expectedCapabilityKeys = expectedCapabilities.map((item) => item.key);
  const [company, seats, capabilities, closureRows, installations] = await Promise.all([
    executor.query.companies.findFirst({ where: eq(companies.id, companyId) }),
    executor.select().from(eosSeats).where(eq(eosSeats.companyId, companyId)),
    executor.select().from(eosCapabilityInstances).where(and(eq(eosCapabilityInstances.companyId, companyId), inArray(eosCapabilityInstances.capabilityInstanceKey, expectedCapabilityKeys))),
    executor.select().from(eosArtifactClosureRecords).where(and(eq(eosArtifactClosureRecords.companyId, companyId), inArray(eosArtifactClosureRecords.capabilityKey, expectedCapabilityKeys))),
    executor.select().from(eosCompanyPackageInstallations).where(and(eq(eosCompanyPackageInstallations.companyId, companyId), eq(eosCompanyPackageInstallations.packageKey, packageDefinition.packageKey))),
  ]);
  const expectedSources = packageDefinition.sourceAuthorityManifest.value.sources;
  const bindingByKey = new Map(sourceBindings.map((binding) => [binding.sourceKey, binding]));
  const missingSources = expectedSources
    .filter((source) => !bindingByKey.has(source.key))
    .map((source) => source.key);
  const sourceContractMismatches = expectedSources.flatMap((source) => {
    const binding = bindingByKey.get(source.key);
    if (!binding) return [];
    const mismatches: string[] = [];
    if (binding.orgKey !== packageDefinition.companyManifest.value.orgKey) mismatches.push("organization scope");
    if (binding.sourceRef !== source.sourceRef) mismatches.push("source reference");
    if (binding.expectedRevision !== source.sourceRevision) mismatches.push("reconciliation revision");
    if (binding.importAuthority !== "reference_only") mismatches.push("import authority");
    return mismatches.length ? [{ sourceKey: source.key, mismatches }] : [];
  });
  const sourceContractComplete = !missingSources.length
    && !sourceContractMismatches.length
    && sourceBindings.length === expectedSources.length;
  const capabilityKeys = new Set(capabilities.map((item: any) => item.capabilityInstanceKey));
  const missingCapabilities = expectedCapabilityKeys.filter((key) => !capabilityKeys.has(key));
  const seatTitles = new Set(seats.map((seat: any) => seat.title));
  const missingSeats = packageDefinition.orgRoleAgentGraph.value.filter((seat) => !seatTitles.has(seat.title)).map((seat) => seat.key);
  const groups = new Map<string, Array<typeof eosArtifactClosureRecords.$inferSelect>>();
  for (const row of closureRows) {
    const key = `${row.moduleId}:${row.capabilityKey}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const expectedGroups = expectedCapabilities.flatMap((capability) => capability.moduleIds.map((moduleId) => `${moduleId}:${capability.key}`));
  const completeGroups = expectedGroups.filter((key) => closureGroupState(groups.get(key) || []).completeCoverage);
  const installation = installations[0] || null;
  const identityComplete = Boolean(company
    && company.name === packageDefinition.companyManifest.value.operatingName
    && company.legalName === packageDefinition.companyManifest.value.legalName
    && JSON.stringify(company.assumedBusinessNames || []) === JSON.stringify(packageDefinition.companyManifest.value.assumedBusinessNames));
  const installedCurrentVersion = installation?.installedVersion === packageDefinition.packageVersion;
  const canonicalRepresentationComplete = Boolean(installedCurrentVersion && identityComplete && sourceContractComplete && !missingCapabilities.length && !missingSeats.length && completeGroups.length === expectedGroups.length);
  return {
    schemaVersion: "eos.company-package-parity.v1",
    packageKey: packageDefinition.packageKey,
    packageVersion: packageDefinition.packageVersion,
    organizationKey: packageDefinition.companyManifest.value.orgKey,
    identity: { complete: identityComplete, legalName: packageDefinition.companyManifest.value.legalName, operatingName: packageDefinition.companyManifest.value.operatingName, assumedBusinessNames: packageDefinition.companyManifest.value.assumedBusinessNames },
    installation: { current: installedCurrentVersion, installedVersion: installation?.installedVersion || null, state: installation?.state || "not_installed" },
    sources: {
      complete: sourceContractComplete,
      represented: expectedSources.length - missingSources.length,
      expected: expectedSources.length,
      missing: missingSources,
      contractMismatches: sourceContractMismatches,
      reconciliationRevision: packageDefinition.packageVersion,
      liveRevisionVerification: "requires_authenticated_provider_snapshot",
    },
    seats: { complete: !missingSeats.length, represented: packageDefinition.orgRoleAgentGraph.value.length - missingSeats.length, expected: packageDefinition.orgRoleAgentGraph.value.length, missing: missingSeats },
    capabilities: { complete: !missingCapabilities.length, represented: expectedCapabilityKeys.length - missingCapabilities.length, expected: expectedCapabilityKeys.length, missing: missingCapabilities },
    artifactClosure: { complete: completeGroups.length === expectedGroups.length, representedGroups: completeGroups.length, expectedGroups: expectedGroups.length, representedRows: closureRows.length, expectedRows: expectedGroups.length * artifactClosureClasses.length },
    canonicalRepresentationComplete,
    activationState: packageDefinition.lifecycleActivationMap.value.requestedState,
    activationBlockers: packageDefinition.lifecycleActivationMap.value.activationGates,
    externalEffectsExecuted: false,
    boundary: "Canonical representation completeness means every declared identity, source, seat, capability and artifact class has an explicit EOS record. It does not claim staffing, provider authorization, implementation, pre-live qualification, field proof or native qualification.",
  };
}
