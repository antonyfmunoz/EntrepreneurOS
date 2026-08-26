import { z } from "zod";

export const companyLifecycleStages = [
  "private",
  "dormant",
  "sampling",
  "validation",
  "pilot",
  "operating",
  "scaling",
] as const;

export const compilationActivationStates = [
  "blocked",
  "dry_run",
  "pre_live_qualified",
  "active",
] as const;

export const companyOwnershipClasses = [
  "owned",
  "external_client",
  "partner",
] as const;

const privacyClassSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);

const authorityClassSchema = z.enum([
  "reference",
  "recommend",
  "decide",
  "approve",
  "execute",
  "verify",
  "owner",
]);

export const compilationArtifactMetadataSchema = z
  .object({
    stableId: z.string().trim().min(3).max(160),
    orgKey: z.string().trim().min(3).max(160),
    artifactType: z.string().trim().min(3).max(120),
    schemaVersion: z.string().trim().min(1).max(80),
    artifactVersion: z.string().trim().min(1).max(80),
    status: z.enum(["draft", "review", "approved", "superseded", "retired"]),
    activationState: z.enum(compilationActivationStates),
    ownershipClass: z.enum(companyOwnershipClasses),
    authorityClass: authorityClassSchema,
    privacyClass: privacyClassSchema,
    ownerRole: z.string().trim().min(2).max(160),
    sourceRef: z.string().url().max(2000),
    sourceRevision: z.string().trim().min(1).max(160),
    effectiveAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    supersedes: z.array(z.string().trim().min(1).max(160)).max(50),
    confidence: z.enum(["insufficient", "emerging", "supported", "verified"]),
    evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(100),
    dependencyRefs: z.array(z.string().trim().min(1).max(500)).max(100),
    approvalRefs: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict();

const artifactEnvelope = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      metadata: compilationArtifactMetadataSchema,
      value,
    })
    .strict();

const referenceSchema = z
  .object({
    key: z.string().trim().min(2).max(160),
    version: z.string().trim().min(1).max(80),
    sourceRef: z.string().url().max(2000),
    sourceRevision: z.string().trim().min(1).max(160),
  })
  .strict();

const capabilitySchema = z
  .object({
    key: z.string().trim().min(2).max(160),
    name: z.string().trim().min(2).max(200),
    moduleIds: z.array(z.number().int().min(1).max(14)).max(14),
    state: z.enum([
      "required",
      "available",
      "missing",
      "dormant",
      "prohibited",
      "planned",
    ]),
    activationGateRefs: z.array(z.string().trim().min(1).max(200)).max(30),
  })
  .strict();

const seatSchema = z
  .object({
    key: z.string().trim().min(2).max(160),
    title: z.string().trim().min(2).max(200),
    kind: z.enum([
      "founder",
      "portfolio_executive",
      "company_ceo",
      "functional_executive",
      "manager",
      "individual_contributor",
      "external",
    ]),
    reportsToSeatKey: z.string().trim().min(2).max(160).nullable(),
    agentName: z.string().trim().min(2).max(200),
    occupancyMode: z.enum(["agent", "human_with_agent_assistant", "vacant"]),
    mandate: z.string().trim().min(10).max(2000),
    separationOfDutyRefs: z.array(z.string().trim().min(1).max(200)).max(30),
  })
  .strict();

const providerBindingSchema = z
  .object({
    key: z.string().trim().min(2).max(160),
    provider: z.string().trim().min(2).max(160),
    adapterClass: z.string().trim().min(2).max(160),
    accountScope: z.string().trim().min(2).max(300),
    credentialReference: z
      .string()
      .trim()
      .regex(/^(op|vault|secret|aws-sm|gcp-sm):\/\//)
      .nullable(),
    authorityState: z.enum(["unbound", "selected", "configured", "verified"]),
    healthState: z.enum(["unknown", "healthy", "degraded", "failed"]),
    substitutionRule: z.string().trim().min(3).max(1000),
    manualFallback: z.string().trim().min(3).max(1000),
  })
  .strict();

const sourceRecordSchema = z
  .object({
    key: z.string().trim().min(2).max(160),
    sourceRef: z.string().url().max(2000),
    sourceRevision: z.string().trim().min(1).max(160),
    precedence: z.number().int().min(1).max(1000),
    status: z.enum(["canonical", "supporting", "historical", "superseded"]),
  })
  .strict();

export const domainPackSchema = z
  .object({
    metadata: compilationArtifactMetadataSchema,
    key: z.string().trim().min(2).max(160),
    version: z.string().trim().min(1).max(80),
    name: z.string().trim().min(2).max(200),
    industryClass: z.string().trim().min(2).max(160),
    capabilityKeys: z.array(z.string().trim().min(2).max(160)).min(1).max(200),
    workflowKeys: z.array(z.string().trim().min(2).max(160)).min(1).max(200),
    controlRefs: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict();

export const companyPackageSchema = z
  .object({
    metadata: compilationArtifactMetadataSchema,
    packageKey: z.string().trim().min(2).max(160),
    packageVersion: z.string().trim().min(1).max(80),
    materializerKey: z.string().trim().min(2).max(160),
    targetCompanyAliases: z.array(z.string().trim().min(2).max(200)).min(1).max(30),
    universalCompanyTemplateRef: artifactEnvelope(referenceSchema),
    domainPackRefs: z.array(artifactEnvelope(referenceSchema)).min(1).max(30),
    companyManifest: artifactEnvelope(
      z
        .object({
          legalName: z.string().trim().min(2).max(240),
          operatingName: z.string().trim().min(2).max(240),
          orgKey: z.string().trim().min(3).max(160),
          ownershipClass: z.enum(companyOwnershipClasses),
          visibility: z.enum(["public", "private", "client_confidential"]),
          mission: z.string().trim().min(10).max(2000),
          offerKeys: z.array(z.string().trim().min(2).max(160)).max(100),
          idealCustomerProfile: z.string().trim().min(3).max(2000),
          lifecycleStage: z.enum(companyLifecycleStages),
          clientAuthorityReference: z.string().trim().min(3).max(500).nullable(),
        })
        .strict(),
    ),
    capabilityManifest: artifactEnvelope(z.array(capabilitySchema).min(1).max(300)),
    lifecycleActivationMap: artifactEnvelope(
      z
        .object({
          requestedState: z.enum(compilationActivationStates),
          activationGates: z.array(z.string().trim().min(3).max(500)).min(1).max(100),
          dependencies: z.array(z.string().trim().min(2).max(300)).max(100),
          rolloutSequence: z.array(z.string().trim().min(2).max(300)).min(1).max(100),
          stopLaws: z.array(z.string().trim().min(3).max(1000)).min(1).max(100),
          rollbackConditions: z.array(z.string().trim().min(3).max(1000)).min(1).max(100),
        })
        .strict(),
    ),
    orgRoleAgentGraph: artifactEnvelope(z.array(seatSchema).min(1).max(500)),
    authorityPolicySet: artifactEnvelope(
      z.array(
        z
          .object({
            key: z.string().trim().min(2).max(160),
            subjectSeatKey: z.string().trim().min(2).max(160),
            authorityClasses: z.array(authorityClassSchema).min(1).max(20),
            dataClasses: z.array(privacyClassSchema).min(1).max(20),
            transactionLimit: z.string().trim().min(2).max(300),
            disclosureLimit: z.string().trim().min(2).max(500),
          })
          .strict(),
      ).min(1).max(500),
    ),
    workflowArtifactMap: artifactEnvelope(
      z.array(
        z
          .object({
            key: z.string().trim().min(2).max(160),
            name: z.string().trim().min(2).max(240),
            stateMachineRef: z.string().trim().min(2).max(500),
            workPacketKeys: z.array(z.string().trim().min(2).max(160)).min(1).max(100),
            artifactRequirements: z.array(z.string().trim().min(2).max(500)).min(1).max(100),
            evidenceRequirements: z.array(z.string().trim().min(2).max(500)).min(1).max(100),
            exceptionPath: z.string().trim().min(3).max(1000),
          })
          .strict(),
      ).min(1).max(500),
    ),
    providerBindingDeclarations: artifactEnvelope(z.array(providerBindingSchema).max(200)),
    economicsMetricContracts: artifactEnvelope(
      z.array(
        z
          .object({
            key: z.string().trim().min(2).max(160),
            name: z.string().trim().min(2).max(240),
            definition: z.string().trim().min(3).max(1000),
            target: z.string().trim().min(1).max(500),
            guardrail: z.string().trim().min(3).max(1000),
            attributionRule: z.string().trim().min(3).max(1000),
            decisionGate: z.string().trim().min(3).max(1000),
          })
          .strict(),
      ).min(1).max(500),
    ),
    dataEvidenceContracts: artifactEnvelope(
      z.array(
        z
          .object({
            key: z.string().trim().min(2).max(160),
            dataClass: privacyClassSchema,
            authoritativeSource: z.string().trim().min(2).max(500),
            retentionRule: z.string().trim().min(3).max(1000),
            lineageRequirement: z.string().trim().min(3).max(1000),
            qualificationRule: z.string().trim().min(3).max(1000),
            promotionRule: z.string().trim().min(3).max(1000),
          })
          .strict(),
      ).min(1).max(500),
    ),
    failureRecoveryMap: artifactEnvelope(
      z.array(
        z
          .object({
            key: z.string().trim().min(2).max(160),
            failureClass: z.string().trim().min(2).max(240),
            incidentOwnerSeatKey: z.string().trim().min(2).max(160),
            fallback: z.string().trim().min(3).max(1000),
            recovery: z.string().trim().min(3).max(1000),
            continuity: z.string().trim().min(3).max(1000),
            learningPromotionRule: z.string().trim().min(3).max(1000),
          })
          .strict(),
      ).min(1).max(500),
    ),
    sourceAuthorityManifest: artifactEnvelope(
      z
        .object({
          sources: z.array(sourceRecordSchema).min(1).max(200),
          unresolvedConflicts: z.array(z.string().trim().min(3).max(1000)).max(100),
          freshnessRule: z.string().trim().min(3).max(1000),
          supersessionRule: z.string().trim().min(3).max(1000),
        })
        .strict(),
    ),
  })
  .strict();

export const compiledCompanyInstanceSchema = z
  .object({
    schemaVersion: z.literal("eos.compiled-company-instance.v1"),
    companyId: z.number().int().positive(),
    organizationKey: z.string().trim().min(3).max(160),
    packageKey: z.string().trim().min(2).max(160),
    packageVersion: z.string().trim().min(1).max(80),
    manifestId: z.string().uuid(),
    activationState: z.enum(compilationActivationStates),
    activationBlockers: z.array(z.string().trim().min(3).max(1000)).max(200),
    activeCapabilityKeys: z.array(z.string().trim().min(2).max(160)).max(500),
    dormantCapabilityKeys: z.array(z.string().trim().min(2).max(160)).max(500),
    providerBindingKeys: z.array(z.string().trim().min(2).max(160)).max(300),
    sourcePackageRefs: z.array(referenceSchema).min(1).max(300),
    provenanceGraph: z.array(
      z
        .object({
          outputRef: z.string().trim().min(2).max(500),
          sourceStableIds: z.array(z.string().trim().min(2).max(160)).min(1).max(100),
        })
        .strict(),
    ).min(1).max(1000),
    dormantCapabilityInventory: z.array(z.string().trim().min(2).max(240)).max(500),
    externalEffectsExecuted: z.literal(false),
    generatedAt: z.string().datetime(),
  })
  .strict();

export type CompanyPackage = z.infer<typeof companyPackageSchema>;
export type DomainPack = z.infer<typeof domainPackSchema>;
export type CompiledCompanyInstance = z.infer<typeof compiledCompanyInstanceSchema>;

export const packageTransitionPlanSchema = z.object({
  schemaVersion: z.literal("eos.company-package-transition.v1"),
  packageKey: z.string().trim().min(2).max(160),
  organizationKey: z.string().trim().min(2).max(160),
  fromVersion: z.string().trim().min(1).max(80).nullable(),
  toVersion: z.string().trim().min(1).max(80),
  transition: z.enum(["install", "no_change", "upgrade", "rollback", "blocked"]),
  compatible: z.boolean(),
  blockers: z.array(z.string().trim().min(3).max(1000)).max(100),
  requiredActions: z.array(z.string().trim().min(3).max(1000)).max(100),
  rollbackAvailable: z.boolean(),
  externalEffectsPermitted: z.literal(false),
});

export type PackageTransitionPlan = z.infer<typeof packageTransitionPlanSchema>;

function versionParts(value: string): Array<string | number> {
  return value.split(/[.\-_]/).filter(Boolean).map((part) => /^\d+$/.test(part) ? Number(part) : part.toLocaleLowerCase());
}

export function comparePackageVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const l = a[index] ?? 0;
    const r = b[index] ?? 0;
    if (l === r) continue;
    if (typeof l === "number" && typeof r === "number") return l < r ? -1 : 1;
    return String(l).localeCompare(String(r));
  }
  return 0;
}

export function planCompanyPackageTransition(input: {
  packageDefinition: CompanyPackage;
  installedVersion: string | null;
  installedOrganizationKey?: string | null;
  rollbackVersions?: string[];
}): PackageTransitionPlan {
  const target = input.packageDefinition;
  const blockers: string[] = [];
  if (input.installedOrganizationKey && input.installedOrganizationKey !== target.companyManifest.value.orgKey)
    blockers.push("The installed organization identity does not match the target package.");
  const validation = validateCompanyPackage(target);
  blockers.push(...validation.findings.map((finding) => `${finding.path}: ${finding.message}`));
  const comparison = input.installedVersion ? comparePackageVersions(input.installedVersion, target.packageVersion) : -1;
  const rollbackAvailable = Boolean(input.installedVersion && (input.rollbackVersions || []).includes(target.packageVersion));
  let transition: PackageTransitionPlan["transition"] = !input.installedVersion ? "install"
    : comparison === 0 ? "no_change"
      : comparison < 0 ? "upgrade" : "rollback";
  if (transition === "rollback" && !rollbackAvailable)
    blockers.push("Rollback requires a content-addressed snapshot of the requested target version.");
  if (blockers.length) transition = "blocked";
  return packageTransitionPlanSchema.parse({
    schemaVersion: "eos.company-package-transition.v1",
    packageKey: target.packageKey,
    organizationKey: target.companyManifest.value.orgKey,
    fromVersion: input.installedVersion,
    toVersion: target.packageVersion,
    transition,
    compatible: blockers.length === 0,
    blockers,
    requiredActions: transition === "install" ? ["Compile the package in dry-run mode.", "Review activation gates and closure gaps."]
      : transition === "upgrade" ? ["Freeze the installed compiled instance as a rollback snapshot.", "Compile the target version and run parity fixtures before activation."]
        : transition === "rollback" ? ["Verify the target snapshot hash.", "Restore the prior compiled instance and record an immutable rollback event."]
          : transition === "no_change" ? ["No materialization is required."]
            : ["Resolve every compatibility blocker before mutation."],
    rollbackAvailable,
    externalEffectsPermitted: false,
  });
}

export type CompanyPackageValidationFinding = {
  code: string;
  path: string;
  message: string;
};

function metadataEnvelopes(value: CompanyPackage) {
  return [
    value.metadata,
    value.universalCompanyTemplateRef.metadata,
    ...value.domainPackRefs.map((item) => item.metadata),
    value.companyManifest.metadata,
    value.capabilityManifest.metadata,
    value.lifecycleActivationMap.metadata,
    value.orgRoleAgentGraph.metadata,
    value.authorityPolicySet.metadata,
    value.workflowArtifactMap.metadata,
    value.providerBindingDeclarations.metadata,
    value.economicsMetricContracts.metadata,
    value.dataEvidenceContracts.metadata,
    value.failureRecoveryMap.metadata,
    value.sourceAuthorityManifest.metadata,
  ];
}

export function validateCompanyPackage(input: unknown): {
  package: CompanyPackage | null;
  findings: CompanyPackageValidationFinding[];
} {
  const parsed = companyPackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      package: null,
      findings: parsed.error.issues.map((issue) => ({
        code: "schema_invalid",
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const value = parsed.data;
  const findings: CompanyPackageValidationFinding[] = [];
  const orgKey = value.companyManifest.value.orgKey;
  metadataEnvelopes(value).forEach((metadata, index) => {
    if (metadata.orgKey !== orgKey)
      findings.push({
        code: "organization_scope_mismatch",
        path: `metadata[${index}].orgKey`,
        message: "Every package artifact must bind to the same organization key.",
      });
  });
  if (value.metadata.stableId !== value.packageKey)
    findings.push({
      code: "package_identity_mismatch",
      path: "metadata.stableId",
      message: "Package metadata stableId must equal packageKey.",
    });
  if (value.metadata.artifactVersion !== value.packageVersion)
    findings.push({
      code: "package_version_mismatch",
      path: "metadata.artifactVersion",
      message: "Package metadata artifactVersion must equal packageVersion.",
    });
  if (value.sourceAuthorityManifest.value.unresolvedConflicts.length)
    findings.push({
      code: "source_authority_unresolved",
      path: "sourceAuthorityManifest.value.unresolvedConflicts",
      message: "Source conflicts must be resolved before company compilation.",
    });
  if (
    value.companyManifest.value.ownershipClass === "external_client" &&
    !value.companyManifest.value.clientAuthorityReference
  )
    findings.push({
      code: "client_authority_missing",
      path: "companyManifest.value.clientAuthorityReference",
      message: "External-client packages require an explicit client authority reference.",
    });
  if (
    ["active", "pre_live_qualified"].includes(
      value.lifecycleActivationMap.value.requestedState,
    ) && value.lifecycleActivationMap.value.activationGates.length
  )
    findings.push({
      code: "activation_gates_open",
      path: "lifecycleActivationMap.value.requestedState",
      message: "A package with open activation gates may compile only as blocked or dry-run.",
    });
  const seatKeys = new Set(value.orgRoleAgentGraph.value.map((seat) => seat.key));
  value.orgRoleAgentGraph.value.forEach((seat, index) => {
    if (seat.reportsToSeatKey && !seatKeys.has(seat.reportsToSeatKey))
      findings.push({
        code: "reporting_parent_missing",
        path: `orgRoleAgentGraph.value.${index}.reportsToSeatKey`,
        message: "Every reporting parent must resolve inside the company package.",
      });
  });
  const sources = value.sourceAuthorityManifest.value.sources;
  if (new Set(sources.map((source) => source.precedence)).size !== sources.length)
    findings.push({
      code: "source_precedence_ambiguous",
      path: "sourceAuthorityManifest.value.sources",
      message: "Every source must have a unique precedence value.",
    });
  return { package: findings.length ? null : value, findings };
}
