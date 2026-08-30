import type { CompanyPackage } from "@shared/company-compilation";
import { companyPackageSchema } from "@shared/company-compilation";
import type { CompanySourceBinding } from "@shared/company-source-adapter";
import { createNotionSourceBinding } from "../company-compilation/notion-source-adapter";
import {
  declarativeCompanyPackageMaterializer,
  type DeclarativeRuntimeBindings,
} from "../company-compilation/declarative-materializer";

type ArtifactValue<K extends keyof CompanyPackage> =
  CompanyPackage[K] extends { value: infer V } ? V : never;

export type PortfolioCompanySource = {
  key: string;
  sourceRef: string;
  pageClass: CompanySourceBinding["pageClass"];
  classification?: CompanySourceBinding["classification"];
  maxAgeDays?: number;
  status?: "canonical" | "supporting" | "historical" | "superseded";
};

export type PortfolioCompanyBlueprint = {
  packageKey: string;
  packageVersion: string;
  organizationKey: string;
  aliases: string[];
  legalName: string;
  operatingName: string;
  ownerRole: string;
  effectiveAt: string;
  ownershipClass?: "owned" | "external_client" | "partner";
  visibility: "public" | "private" | "client_confidential";
  mission: string;
  offerKeys: string[];
  idealCustomerProfile: string;
  lifecycleStage: CompanyPackage["companyManifest"]["value"]["lifecycleStage"];
  requestedState: CompanyPackage["lifecycleActivationMap"]["value"]["requestedState"];
  sources: PortfolioCompanySource[];
  domainPacks: Array<{ key: string; version?: string; sourceKey: string }>;
  capabilities: ArtifactValue<"capabilityManifest">;
  activationGates: string[];
  dependencies: string[];
  rolloutSequence: string[];
  stopLaws: string[];
  rollbackConditions: string[];
  seats: ArtifactValue<"orgRoleAgentGraph">;
  authorityPolicies: ArtifactValue<"authorityPolicySet">;
  workflows: ArtifactValue<"workflowArtifactMap">;
  providers: ArtifactValue<"providerBindingDeclarations">;
  metrics: ArtifactValue<"economicsMetricContracts">;
  evidenceContracts: ArtifactValue<"dataEvidenceContracts">;
  failureRecovery: ArtifactValue<"failureRecoveryMap">;
  unresolvedConflicts?: string[];
  freshnessRule: string;
  supersessionRule: string;
  runtimeBindings: DeclarativeRuntimeBindings;
};

function sourceByKey(blueprint: PortfolioCompanyBlueprint, key: string) {
  const source = blueprint.sources.find((candidate) => candidate.key === key);
  if (!source) throw new Error(`Missing source ${key} for ${blueprint.packageKey}.`);
  return source.sourceRef;
}

export function buildPortfolioCompanyPackage(blueprint: PortfolioCompanyBlueprint) {
  const artifact = <T>(
    stableId: string,
    artifactType: string,
    sourceKey: string,
    value: T,
  ) => ({
    metadata: {
      stableId,
      orgKey: blueprint.organizationKey,
      artifactType,
      schemaVersion: "eos.company-compilation.v1",
      artifactVersion: blueprint.packageVersion,
      status: "approved" as const,
      activationState: blueprint.requestedState,
      ownershipClass: blueprint.ownershipClass || ("owned" as const),
      authorityClass: "reference" as const,
      privacyClass: "internal" as const,
      ownerRole: blueprint.ownerRole,
      sourceRef: sourceByKey(blueprint, sourceKey),
      sourceRevision: blueprint.packageVersion,
      effectiveAt: blueprint.effectiveAt,
      expiresAt: null,
      supersedes: [],
      confidence: "supported" as const,
      evidenceRefs: [],
      dependencyRefs: [],
      approvalRefs: [],
    },
    value,
  });

  const registrySourceKey = blueprint.sources.some((source) => source.key === "registry")
    ? "registry"
    : blueprint.sources[0].key;
  const packageDefinition = companyPackageSchema.parse({
    metadata: artifact(
      blueprint.packageKey,
      "company_package",
      registrySourceKey,
      null,
    ).metadata,
    packageKey: blueprint.packageKey,
    packageVersion: blueprint.packageVersion,
    materializerKey: "declarative-company-package-v1",
    targetCompanyAliases: blueprint.aliases,
    universalCompanyTemplateRef: artifact(
      `${blueprint.organizationKey.toLowerCase()}-universal-template-ref`,
      "universal_company_template_ref",
      registrySourceKey,
      {
        key: "eos-universal-company-template",
        version: "1.0",
        sourceRef: "https://app.notion.com/p/3b0da8b96e4f81e5bb28eee117838b5e",
        sourceRevision: "2026-08-06",
      },
    ),
    domainPackRefs: blueprint.domainPacks.map((domainPack) =>
      artifact(
        `domain-pack-${domainPack.key}`,
        "domain_pack_ref",
        domainPack.sourceKey,
        {
          key: domainPack.key,
          version: domainPack.version || "1.0",
          sourceRef: sourceByKey(blueprint, domainPack.sourceKey),
          sourceRevision: blueprint.packageVersion,
        },
      ),
    ),
    companyManifest: artifact(
      `${blueprint.organizationKey.toLowerCase()}-company-manifest`,
      "company_manifest",
      registrySourceKey,
      {
        legalName: blueprint.legalName,
        operatingName: blueprint.operatingName,
        orgKey: blueprint.organizationKey,
        ownershipClass: blueprint.ownershipClass || "owned",
        visibility: blueprint.visibility,
        mission: blueprint.mission,
        offerKeys: blueprint.offerKeys,
        idealCustomerProfile: blueprint.idealCustomerProfile,
        lifecycleStage: blueprint.lifecycleStage,
        clientAuthorityReference: null,
      },
    ),
    capabilityManifest: artifact(
      `${blueprint.organizationKey.toLowerCase()}-capability-manifest`,
      "capability_manifest",
      "runtime",
      blueprint.capabilities,
    ),
    lifecycleActivationMap: artifact(
      `${blueprint.organizationKey.toLowerCase()}-activation-map`,
      "lifecycle_activation_map",
      registrySourceKey,
      {
        requestedState: blueprint.requestedState,
        activationGates: blueprint.activationGates,
        dependencies: blueprint.dependencies,
        rolloutSequence: blueprint.rolloutSequence,
        stopLaws: blueprint.stopLaws,
        rollbackConditions: blueprint.rollbackConditions,
      },
    ),
    orgRoleAgentGraph: artifact(
      `${blueprint.organizationKey.toLowerCase()}-role-agent-graph`,
      "org_role_agent_graph",
      "organization",
      blueprint.seats,
    ),
    authorityPolicySet: artifact(
      `${blueprint.organizationKey.toLowerCase()}-authority-policy-set`,
      "authority_policy_set",
      "organization",
      blueprint.authorityPolicies,
    ),
    workflowArtifactMap: artifact(
      `${blueprint.organizationKey.toLowerCase()}-workflow-map`,
      "workflow_artifact_map",
      "workflow",
      blueprint.workflows,
    ),
    providerBindingDeclarations: artifact(
      `${blueprint.organizationKey.toLowerCase()}-provider-bindings`,
      "provider_binding_declarations",
      "runtime",
      blueprint.providers,
    ),
    economicsMetricContracts: artifact(
      `${blueprint.organizationKey.toLowerCase()}-metric-contracts`,
      "economics_metric_contracts",
      "scorecard",
      blueprint.metrics,
    ),
    dataEvidenceContracts: artifact(
      `${blueprint.organizationKey.toLowerCase()}-evidence-contracts`,
      "data_evidence_contracts",
      "runtime",
      blueprint.evidenceContracts,
    ),
    failureRecoveryMap: artifact(
      `${blueprint.organizationKey.toLowerCase()}-failure-recovery-map`,
      "failure_recovery_map",
      "workflow",
      blueprint.failureRecovery,
    ),
    sourceAuthorityManifest: artifact(
      `${blueprint.organizationKey.toLowerCase()}-source-authority`,
      "source_authority_manifest",
      registrySourceKey,
      {
        sources: blueprint.sources.map((source, index) => ({
          key: source.key,
          sourceRef: source.sourceRef,
          sourceRevision: blueprint.packageVersion,
          precedence: index + 1,
          status: source.status || "canonical",
        })),
        unresolvedConflicts: blueprint.unresolvedConflicts || [],
        freshnessRule: blueprint.freshnessRule,
        supersessionRule: blueprint.supersessionRule,
      },
    ),
  });

  const sourceBindings = blueprint.sources.map((source, index) =>
    createNotionSourceBinding({
      sourceKey: source.key,
      orgKey: blueprint.organizationKey,
      pageClass: source.pageClass,
      sourceRef: source.sourceRef,
      expectedRevision: blueprint.packageVersion,
      precedence: index + 1,
      maxAgeDays: source.maxAgeDays || 90,
      classification: source.classification || "internal",
      importAuthority: "reference_only",
    }),
  );

  return {
    package: packageDefinition,
    sourceBindings,
    materialize: declarativeCompanyPackageMaterializer(
      packageDefinition,
      blueprint.runtimeBindings,
    ),
  };
}
