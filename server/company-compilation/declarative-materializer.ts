import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { CompanyPackage } from "@shared/company-compilation";
import { buildAdvisorCouncil, manifestInputSchema } from "@shared/eos-runtime";
import {
  companies,
  eosAssignments,
  eosAuditRecords,
  eosCapabilityInstances,
  eosIntegrationBindings,
  eosManifestVersions,
  eosMetricsOutcomes,
  eosMemberships,
  eosProcessDefinitions,
  eosResourcesAssets,
  eosRisksControls,
  eosSeats,
  eosStakeholderRelationships,
  eosStakeholders,
  eosSystems,
  eosWorkPackets,
} from "@shared/schema";
import { ensureSeatOperatingKernel } from "../role-kernel";
import type { CompanyPackageCompileInput, CompanyPackageMaterializationResult } from "./catalog";

export class DeclarativeMaterializationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type DeclarativeProcessBinding = {
  processKey: string;
  name: string;
  capabilityKey: string;
  accountableSeatKey: string;
  workflowKey: string;
  purpose: string;
  intendedOutcome: string;
  triggerCondition: string;
  procedureSteps: string[];
  requiredInputs: string[];
  requiredOutputs: string[];
  approvalGates: string[];
  prohibitedActions: string[];
  evidenceRequirements: string[];
  qualityCriteria: string[];
  failurePaths: string[];
  terminalCriteria: string[];
  acceptanceTests: string[];
  sourceRef: string;
};

export type DeclarativeRuntimeBindings = {
  processes?: DeclarativeProcessBinding[];
  assets?: Array<{
    assetKey: string;
    name: string;
    assetType: "intellectual_property" | "brand_asset" | "content_asset" | "channel_account" | "system_tool" | "equipment" | "template" | "document" | "dataset" | "credential_reference" | "other";
    lifecycleState: "proposed" | "active" | "restricted" | "under_review" | "deprecated" | "archived";
    custodianSeatKey: string;
    ownerOrganizationKey: string;
    operatorOrganizationKey: string;
    dataClassification: "public" | "internal" | "confidential" | "restricted" | "highly_restricted";
    rightsUsageLicense: string;
    replacementPortabilityNotes: string;
    sourceRef: string;
  }>;
  stakeholders?: Array<{
    stakeholderKey: string;
    name: string;
    partyType: "person" | "organization" | "audience_segment" | "customer_segment" | "customer" | "prospect" | "partner" | "vendor_provider" | "employee" | "candidate" | "collaborator" | "community" | "investor" | "regulator" | "other";
    state: "proposed" | "active" | "dormant" | "restricted" | "closed";
    ownerSeatKey: string;
    identityReference: string;
    relationshipRole: string;
  }>;
  relationships?: Array<{
    relationshipKey: string;
    stakeholderKey: string;
    relationshipType: "prospect" | "customer" | "partner" | "vendor_provider" | "employee" | "candidate" | "collaborator" | "community" | "investor" | "regulator" | "beneficiary" | "donor" | "alumni" | "other";
    title: string;
    state: "proposed" | "active" | "dormant" | "restricted" | "closed";
    ownerSeatKey: string;
    needConstraint: string;
    fitHypothesis: string;
    nextBestAction: string;
  }>;
  additionalWorkPackets?: Array<{
    key: string;
    title: string;
    accountableSeatKey: string;
    capabilityKey: string;
    processKey: string;
    objective: string;
    evidenceRequirements: string[];
    expectedOutput: string;
    acceptanceCriteria: string;
    constraintsPolicies: string;
    failureEscalationCompensation: string;
    sourceLineage: string;
    outputArtifactKeys: string[];
  }>;
};

function stableUuid(packageKey: string, companyId: number, key: string): string {
  const chars = createHash("sha256").update(`eos:${packageKey}:${companyId}:${key}`).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function containsPackageSelection(manifest: unknown, packageDefinition: CompanyPackage): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const selections = (manifest as { packageSelections?: unknown }).packageSelections;
  return Array.isArray(selections) && selections.some((selection) =>
    selection && typeof selection === "object" &&
    (selection as any).id === packageDefinition.packageKey &&
    (selection as any).version === packageDefinition.packageVersion);
}

function adapterKind(value: string): "oauth" | "api_key" | "webhook" | "signed_https" | "service_account" | "database" | "file_exchange" | "manual" | "native" {
  const normalized = value.toLowerCase();
  if (normalized.includes("oauth")) return "oauth";
  if (normalized.includes("api_key") || normalized.includes("api-key")) return "api_key";
  if (normalized.includes("webhook")) return "webhook";
  if (normalized.includes("signed_https")) return "signed_https";
  if (normalized.includes("service_account")) return "service_account";
  if (normalized.includes("database")) return "database";
  if (normalized.includes("file")) return "file_exchange";
  if (normalized.includes("native")) return "native";
  return "manual";
}

function capabilityState(state: CompanyPackage["capabilityManifest"]["value"][number]["state"]): string {
  if (state === "available") return "active";
  if (state === "required" || state === "missing") return "blocked";
  if (state === "dormant") return "dormant";
  if (state === "prohibited") return "deprecated";
  return "planned";
}

export function declarativeCompanyPackageMaterializer(
  packageDefinition: CompanyPackage,
  runtimeBindings: DeclarativeRuntimeBindings = {},
) {
  return async function materialize(
    executor: any,
    input: CompanyPackageCompileInput,
  ): Promise<CompanyPackageMaterializationResult> {
    await executor.execute(sql`select pg_advisory_xact_lock(1162890833, ${input.companyId})`);
    const company = await executor.query.companies.findFirst({ where: eq(companies.id, input.companyId) });
    if (!company) throw new DeclarativeMaterializationError("company_not_found", "The selected company no longer exists.");

    const manifests = await executor.select().from(eosManifestVersions)
      .where(eq(eosManifestVersions.companyId, company.id)).orderBy(desc(eosManifestVersions.version));
    const existing = manifests.find((record: any) => containsPackageSelection(record.manifest, packageDefinition));
    if (existing) return {
      created: false,
      company,
      manifest: existing,
      report: (existing.manifest as any)?.compiledFrom?.companyPackage || {},
    };

    const founderSeat = await executor.query.eosSeats.findFirst({
      where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")),
    });
    if (!founderSeat)
      throw new DeclarativeMaterializationError("founder_seat_required", "Compile the founder context before installing a company package.");
    const membership = await executor.query.eosMemberships.findFirst({
      where: and(eq(eosMemberships.companyId, company.id), eq(eosMemberships.userId, input.actorUserId), eq(eosMemberships.status, "active")),
    });
    if (!membership && company.ownerUserId !== input.actorUserId)
      throw new DeclarativeMaterializationError("founder_membership_required", "An active founder membership is required to compile this package.");

    const definition = packageDefinition.companyManifest.value;
    const [updatedCompany] = await executor.update(companies).set({
      name: definition.operatingName,
      type: packageDefinition.domainPackRefs.map((item) => item.value.key).join(", "),
      stage: definition.lifecycleStage,
      offer: definition.offerKeys.join(", ") || "No current offer",
      targetCustomer: definition.idealCustomerProfile,
      goals: definition.mission,
    }).where(eq(companies.id, company.id)).returning();

    const activeSeats = await executor.select().from(eosSeats)
      .where(and(eq(eosSeats.companyId, company.id), eq(eosSeats.status, "active")));
    const seatsByTitle = new Map(activeSeats.map((seat: any) => [seat.title.toLowerCase(), seat]));
    const seats = new Map<string, any>([["founder", founderSeat]]);
    const pending = packageDefinition.orgRoleAgentGraph.value.filter((seat) => seat.kind !== "founder");
    while (pending.length) {
      const index = pending.findIndex((seat) => !seat.reportsToSeatKey || seats.has(seat.reportsToSeatKey));
      if (index < 0) throw new DeclarativeMaterializationError("reporting_graph_unresolvable", "The package reporting graph cannot be materialized in parent-first order.");
      const seatDefinition = pending.splice(index, 1)[0];
      const prior = seatsByTitle.get(seatDefinition.title.toLowerCase()) as any;
      if (prior && prior.kind !== seatDefinition.kind)
        throw new DeclarativeMaterializationError("seat_contract_conflict", `${seatDefinition.title} exists with an incompatible role kind.`);
      const occupantUserId = seatDefinition.occupancyMode === "human_with_agent_assistant" ? input.actorUserId : null;
      if (prior?.occupantUserId && occupantUserId && prior.occupantUserId !== occupantUserId)
        throw new DeclarativeMaterializationError("seat_occupancy_conflict", `${seatDefinition.title} is occupied by another principal.`);
      let seat = prior;
      if (!seat) {
        [seat] = await executor.insert(eosSeats).values({
          id: stableUuid(packageDefinition.packageKey, company.id, `seat:${seatDefinition.key}`),
          companyId: company.id,
          title: seatDefinition.title,
          kind: seatDefinition.kind,
          supervisorSeatId: seatDefinition.reportsToSeatKey ? seats.get(seatDefinition.reportsToSeatKey)?.id : founderSeat.id,
          occupantUserId,
          agentName: seatDefinition.agentName,
          agentMode: occupantUserId ? "assistant" : "autonomous",
          mandate: seatDefinition.mandate,
          authority: { sourcePackage: packageDefinition.packageKey, explicitGrantRequired: true },
          toolEntitlements: [],
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
      }
      seats.set(seatDefinition.key, seat);
    }

    for (const seat of Array.from(seats.values())) await ensureSeatOperatingKernel(executor, updatedCompany, seat, input.actorUserId);
    for (const seatDefinition of packageDefinition.orgRoleAgentGraph.value.filter((seat) => seat.occupancyMode === "human_with_agent_assistant" && seat.kind !== "founder")) {
      const seat = seats.get(seatDefinition.key);
      await executor.insert(eosAssignments).values({
        id: stableUuid(packageDefinition.packageKey, company.id, `assignment:${seatDefinition.key}`),
        companyId: company.id,
        membershipId: membership?.id || null,
        principalUserId: input.actorUserId,
        seatId: seat.id,
        assignmentType: "occupant",
        operatingGrant: "operate",
        purpose: `Carry ${seatDefinition.title} with the persistent Role Agent acting as assistant.`,
        classificationCeiling: "restricted",
        status: "active",
        effectiveFrom: new Date(),
        createdByUserId: input.actorUserId,
        metadata: { sourcePackage: packageDefinition.packageKey, occupancyMode: seatDefinition.occupancyMode },
      }).onConflictDoNothing();
    }

    const accountableSeat = seats.get("company-ceo") || Array.from(seats.values()).find((seat: any) => seat.kind === "company_ceo") || founderSeat;
    const ids = (key: string) => stableUuid(packageDefinition.packageKey, company.id, key);
    const now = new Date();
    const capabilityIds: string[] = [];
    const capabilityIdsByKey = new Map<string, string>();
    for (const capability of packageDefinition.capabilityManifest.value) {
      const id = ids(`capability:${capability.key}`);
      capabilityIds.push(id);
      capabilityIdsByKey.set(capability.key, id);
      await executor.insert(eosCapabilityInstances).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        capabilityInstanceKey: capability.key, capabilityKey: capability.key, name: capability.name,
        state: capabilityState(capability.state), maturity: "defined", accountableSeatId: accountableSeat.id, moduleIds: capability.moduleIds,
        activationTrigger: capability.activationGateRefs.join("; "), deactivationTrigger: "Founder decision or package supersession.",
        agentKeys: [], humanOperatorKey: accountableSeat.occupantUserId || "", systemKeys: [], workflowKeys: [], metricKeys: [], riskControlKeys: [], evidenceKeys: [],
        sourceAuthority: "reconciled", classification: "internal", recordedByUserId: input.actorUserId, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const requireSeat = (seatKey: string) => {
      const seat = seats.get(seatKey);
      if (!seat) throw new DeclarativeMaterializationError("runtime_seat_unresolvable", `Runtime binding references missing seat ${seatKey}.`);
      return seat;
    };
    const requireCapability = (capabilityKey: string) => {
      const id = capabilityIdsByKey.get(capabilityKey);
      if (!id) throw new DeclarativeMaterializationError("runtime_capability_unresolvable", `Runtime binding references missing capability ${capabilityKey}.`);
      return id;
    };

    const processIds: string[] = [];
    const processIdsByKey = new Map<string, string>();
    for (const process of runtimeBindings.processes || []) {
      const id = ids(`process:${process.processKey}:1`);
      processIds.push(id);
      processIdsByKey.set(process.processKey, id);
      await executor.insert(eosProcessDefinitions).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        processKey: process.processKey, name: process.name, version: 1,
        qualificationState: "artifact_complete", releaseState: "review",
        capabilityInstanceId: requireCapability(process.capabilityKey), workflowKey: process.workflowKey,
        purpose: process.purpose, intendedOutcome: process.intendedOutcome,
        templateAncestry: `${packageDefinition.packageKey}@${packageDefinition.packageVersion}`,
        applicableOverlays: [{ sourceRef: process.sourceRef, sourcePackage: packageDefinition.packageKey }], triggerCondition: process.triggerCondition,
        accountableSeatId: requireSeat(process.accountableSeatKey).id,
        supportingActorKeys: [], requiredAuthority: ["Explicit company authority", "Applicable approval gate"], disclosureScope: "internal",
        prerequisites: packageDefinition.lifecycleActivationMap.value.activationGates,
        requiredInputs: process.requiredInputs, toolSystemBoundaries: packageDefinition.providerBindingDeclarations.value.map((provider) => provider.key),
        procedureSteps: process.procedureSteps, branchConditions: [], approvalGates: process.approvalGates,
        prohibitedActions: process.prohibitedActions, requiredOutputs: process.requiredOutputs,
        evidenceRequirements: process.evidenceRequirements, qualityCriteria: process.qualityCriteria,
        sla: "No SLA is claimed until a controlled dry run establishes one.", emittedEvents: [],
        failurePaths: process.failurePaths, terminalCriteria: process.terminalCriteria,
        trainingPrerequisites: [], acceptanceTests: process.acceptanceTests, reviewerKeys: ["founder", process.accountableSeatKey],
        sourceAuthority: "reconciled", classification: "internal", recordedByUserId: input.actorUserId,
        effectiveFrom: now, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const assetIds: string[] = [];
    for (const asset of runtimeBindings.assets || []) {
      const id = ids(`asset:${asset.assetKey}`);
      assetIds.push(id);
      await executor.insert(eosResourcesAssets).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        assetKey: asset.assetKey, name: asset.name, assetType: asset.assetType,
        lifecycleState: asset.lifecycleState, custodianSeatId: requireSeat(asset.custodianSeatKey).id,
        ownerOrganizationKey: asset.ownerOrganizationKey, operatorOrganizationKey: asset.operatorOrganizationKey,
        dataClassification: asset.dataClassification, rightsUsageLicense: asset.rightsUsageLicense,
        replacementPortabilityNotes: asset.replacementPortabilityNotes,
        evidenceKeys: [asset.sourceRef], sourceAuthority: "reconciled", classification: "internal",
        recordedByUserId: input.actorUserId, validFrom: now, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const metricIds: string[] = [];
    for (const metric of packageDefinition.economicsMetricContracts.value) {
      const id = ids(`metric:${metric.key}`);
      metricIds.push(id);
      await executor.insert(eosMetricsOutcomes).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        metricKey: metric.key, recordType: "metric_definition", title: metric.name,
        state: "defined", ownerSeatId: accountableSeat.id, subjectType: "organization", subjectKey: definition.orgKey,
        definitionFormula: metric.definition, thresholdDirection: "contract_defined",
        attributionLimitations: metric.attributionRule,
        notes: `Target: ${metric.target}\nGuardrail: ${metric.guardrail}\nDecision gate: ${metric.decisionGate}`,
        sourceAuthority: "reconciled", classification: "internal", recordedByUserId: input.actorUserId,
        validFrom: now, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const riskControlIds: string[] = [];
    for (const control of packageDefinition.failureRecoveryMap.value) {
      const id = ids(`risk-control:${control.key}`);
      riskControlIds.push(id);
      await executor.insert(eosRisksControls).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        riskControlKey: control.key, recordType: "control", title: control.key.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "),
        state: "assigned", ownerSeatId: requireSeat(control.incidentOwnerSeatKey).id,
        descriptionCauseEventImpact: control.failureClass, treatmentControl: `${control.fallback} ${control.recovery}`,
        sourceRequirement: "Authoritative incident, provider and recovery evidence; no inferred success.",
        notes: `Continuity: ${control.continuity}\nLearning promotion: ${control.learningPromotionRule}`,
        sourceAuthority: "reconciled", classification: "internal", recordedByUserId: input.actorUserId,
        validFrom: now, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const stakeholderIds: string[] = [];
    const stakeholderIdsByKey = new Map<string, string>();
    for (const stakeholder of runtimeBindings.stakeholders || []) {
      const id = ids(`stakeholder:${stakeholder.stakeholderKey}`);
      stakeholderIds.push(id);
      stakeholderIdsByKey.set(stakeholder.stakeholderKey, id);
      await executor.insert(eosStakeholders).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        stakeholderKey: stakeholder.stakeholderKey, name: stakeholder.name, partyType: stakeholder.partyType,
        state: stakeholder.state, ownerSeatId: requireSeat(stakeholder.ownerSeatKey).id,
        identityReference: stakeholder.identityReference,
        identityReferenceHash: createHash("sha256").update(stakeholder.identityReference).digest("hex"),
        relationshipRole: stakeholder.relationshipRole, evidenceKeys: [],
        sourceAuthority: "reconciled", classification: "internal", recordedByUserId: input.actorUserId,
        validFrom: now, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const relationshipIds: string[] = [];
    for (const relationship of runtimeBindings.relationships || []) {
      const stakeholderId = stakeholderIdsByKey.get(relationship.stakeholderKey);
      if (!stakeholderId) throw new DeclarativeMaterializationError("runtime_stakeholder_unresolvable", `Runtime binding references missing stakeholder ${relationship.stakeholderKey}.`);
      const id = ids(`relationship:${relationship.relationshipKey}`);
      relationshipIds.push(id);
      await executor.insert(eosStakeholderRelationships).values({
        id, companyId: company.id, portfolioId: company.portfolioId,
        relationshipKey: relationship.relationshipKey, stakeholderId,
        relationshipType: relationship.relationshipType, title: relationship.title, state: relationship.state,
        ownerSeatId: requireSeat(relationship.ownerSeatKey).id, needConstraint: relationship.needConstraint,
        fitHypothesis: relationship.fitHypothesis, nextBestAction: relationship.nextBestAction,
        evidenceKeys: [], sourceAuthority: "reconciled", classification: "internal",
        recordedByUserId: input.actorUserId, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const workPacketIds: string[] = [];
    for (const workflow of packageDefinition.workflowArtifactMap.value) {
      const processBinding = (runtimeBindings.processes || []).find((process) => process.workflowKey === workflow.key);
      for (const key of workflow.workPacketKeys) {
        const id = ids(`work:${workflow.key}:${key}`);
        workPacketIds.push(id);
        await executor.insert(eosWorkPackets).values({
          id, companyId: company.id, createdByUserId: input.actorUserId, accountableUserId: input.actorUserId,
          accountableSeatId: accountableSeat.id, title: key.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "),
          objective: `${workflow.name}: advance ${key} while preserving the declared authority, artifact, evidence and exception contracts.`,
          status: "draft", priority: "high", source: "compiler", visibility: "company", classification: "internal", requiresApproval: true,
          toolPack: [], evidenceRequirements: workflow.evidenceRequirements, expectedOutput: workflow.artifactRequirements.join("; "),
          capabilityInstanceId: processBinding ? requireCapability(processBinding.capabilityKey) : null,
          processDefinitionId: processBinding ? processIdsByKey.get(processBinding.processKey) : null,
          acceptanceCriteria: workflow.evidenceRequirements.join("; "), constraintsPolicies: packageDefinition.lifecycleActivationMap.value.stopLaws.join("; "),
          failureEscalationCompensation: workflow.exceptionPath, humanFallback: "Escalate to the accountable human and record the decision and evidence in EOS.",
          sourceLineage: workflow.stateMachineRef, outputArtifactKeys: workflow.artifactRequirements,
          traceId: randomUUID(), correlationId: ids(`correlation:work:${workflow.key}:${key}`), createdAt: now, updatedAt: now,
        }).onConflictDoNothing();
      }
    }
    for (const packet of runtimeBindings.additionalWorkPackets || []) {
      const id = ids(`work:${packet.key}`);
      workPacketIds.push(id);
      const processId = processIdsByKey.get(packet.processKey);
      if (!processId) throw new DeclarativeMaterializationError("runtime_process_unresolvable", `Runtime binding references missing process ${packet.processKey}.`);
      await executor.insert(eosWorkPackets).values({
        id, companyId: company.id, createdByUserId: input.actorUserId, accountableUserId: input.actorUserId,
        accountableSeatId: requireSeat(packet.accountableSeatKey).id,
        capabilityInstanceId: requireCapability(packet.capabilityKey), processDefinitionId: processId,
        title: packet.title, objective: packet.objective, status: "draft", priority: "high", source: "compiler",
        visibility: "company", classification: "internal", requiresApproval: true, toolPack: [],
        evidenceRequirements: packet.evidenceRequirements, expectedOutput: packet.expectedOutput,
        acceptanceCriteria: packet.acceptanceCriteria, constraintsPolicies: packet.constraintsPolicies,
        failureEscalationCompensation: packet.failureEscalationCompensation,
        humanFallback: "Return the request to the AFM CEO/founder; do not command an external-company agent or reconstruct acceptance.",
        sourceLineage: packet.sourceLineage, outputArtifactKeys: packet.outputArtifactKeys,
        traceId: randomUUID(), correlationId: ids(`correlation:work:${packet.key}`), createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const systemIds: string[] = [];
    const integrationIds: string[] = [];
    for (const provider of packageDefinition.providerBindingDeclarations.value) {
      const systemId = ids(`system:${provider.key}`);
      const integrationId = ids(`integration:${provider.key}`);
      systemIds.push(systemId); integrationIds.push(integrationId);
      await executor.insert(eosSystems).values({
        id: systemId, companyId: company.id, portfolioId: company.portfolioId, systemKey: provider.key, name: provider.provider,
        systemType: "provider", lifecycleState: provider.authorityState === "verified" ? "active" : "selected", ownerSeatId: accountableSeat.id,
        capabilities: [], dataDomains: [], authoritativeFields: [], riskNotes: provider.substitutionRule, replacementIntent: "integrate",
        sourceAuthority: "reconciled", evidenceIds: [], classification: "restricted", recordedByUserId: input.actorUserId, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
      await executor.insert(eosIntegrationBindings).values({
        id: integrationId, companyId: company.id, portfolioId: company.portfolioId, integrationKey: provider.key, name: `${provider.provider} binding`,
        toSystemId: systemId, providerKey: provider.key, providerAccountReference: provider.accountScope,
        adapterKind: adapterKind(provider.adapterClass), adapterReference: provider.adapterClass, lifecycleState: "selected",
        connectionState: provider.authorityState === "verified" ? "connected" : provider.authorityState === "configured" ? "configured" : "unconfigured",
        healthState: provider.healthState === "failed" ? "unavailable" : provider.healthState, ownerSeatId: accountableSeat.id, recoveryOwnerSeatId: accountableSeat.id,
        accountScope: provider.accountScope, nativePermissions: [], credentialReference: provider.credentialReference,
        executionAuthority: "No consequential external effect without an explicit effective authority grant and approval policy.", operations: [], expectedEvents: [],
        manualFallback: provider.manualFallback, failureRecovery: provider.substitutionRule, replacementStatus: "integrate", parityState: "not_tested",
        evidenceIds: [], sourceAuthority: "reconciled", classification: "restricted", recordedByUserId: input.actorUserId, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    const activation = packageDefinition.lifecycleActivationMap.value;
    const manifestId = ids(`manifest:${packageDefinition.packageVersion}`);
    const report = {
      packageKey: packageDefinition.packageKey,
      packageVersion: packageDefinition.packageVersion,
      organizationKey: definition.orgKey,
      activationState: activation.requestedState,
      activationBlockers: activation.activationGates,
      externalEffectsExecuted: false,
      records: {
        seats: Array.from(seats.values()).map((seat: any) => seat.id), capabilities: capabilityIds,
        processes: processIds, assets: assetIds, metrics: metricIds, riskControls: riskControlIds,
        stakeholders: stakeholderIds, relationships: relationshipIds,
        workPackets: workPacketIds, systems: systemIds, integrations: integrationIds,
      },
    };
    const manifestInput = manifestInputSchema.parse({
      purpose: definition.mission,
      stage: definition.lifecycleStage,
      offer: definition.offerKeys.join(", ") || "No current offer",
      targetCustomer: definition.idealCustomerProfile,
      goals: [definition.mission, ...packageDefinition.workflowArtifactMap.value.map((workflow) => workflow.name)].slice(0, 12),
      enabledModules: Array.from({ length: 17 }, (_, index) => index + 1),
      ownerSeat: { title: founderSeat.title, authority: "owner" },
      operatingCadence: "weekly",
      founderProfile: updatedCompany.founderProfile && typeof updatedCompany.founderProfile === "object" ? updatedCompany.founderProfile : {},
      sourceAssertions: packageDefinition.sourceAuthorityManifest.value.sources.slice(0, 100).map((source) => ({
        label: source.key, value: `Reference-only company compilation source at revision ${source.sourceRevision}.`, sourceType: "source_fact", sourceUri: source.sourceRef,
      })),
      assumptions: [], unknowns: activation.activationGates,
      packageSelections: [{ id: packageDefinition.packageKey, version: packageDefinition.packageVersion, rationale: `Compile the isolated ${definition.operatingName} company package.` }],
      provisioningChecklist: activation.activationGates.map((label, index) => ({ id: `gate-${index + 1}`, label, required: true, complete: false })),
      verificationChecks: [{ id: "field-cycle", label: "Complete one real evidence-bearing field cycle without hidden reconstruction.", status: "pending" }],
    });
    const advisorCouncil = buildAdvisorCouncil({ founderName: input.actorName, companyName: updatedCompany.name, founderProfile: manifestInput.founderProfile, companyGoals: manifestInput.goals.join("\n") });
    await executor.insert(eosManifestVersions).values({
      id: manifestId, companyId: company.id, version: (manifests[0]?.version || 0) + 1, status: "draft",
      manifest: { ...manifestInput, advisorCouncil, compiledFrom: { companyId: company.id, companyName: updatedCompany.name, companyPackage: report }, schemaVersion: "eos.organization-manifest.v1" },
      createdByUserId: input.actorUserId, createdAt: now,
    });
    await executor.insert(eosAuditRecords).values({
      id: ids(`audit:compiled:${packageDefinition.packageVersion}`), companyId: company.id, actorUserId: input.actorUserId,
      action: "company_package.compiled", targetType: "organization_manifest", targetId: manifestId, traceId: randomUUID(),
      correlationId: ids(`correlation:compiled:${packageDefinition.packageVersion}`), result: `activation_${activation.requestedState}`,
      details: { packageKey: packageDefinition.packageKey, packageVersion: packageDefinition.packageVersion, activationBlockers: activation.activationGates, noExternalEffect: true }, createdAt: now,
    }).onConflictDoNothing();
    const createdManifest = await executor.query.eosManifestVersions.findFirst({ where: eq(eosManifestVersions.id, manifestId) });
    return { created: true, company: updatedCompany, manifest: createdManifest, report };
  };
}
