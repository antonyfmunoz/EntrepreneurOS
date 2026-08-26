import { eq } from "drizzle-orm";
import {
  compiledCompanyInstanceSchema,
  validateCompanyPackage,
  type CompanyPackage,
  type CompiledCompanyInstance,
} from "@shared/company-compilation";
import { companies } from "@shared/schema";
import {
  companyMatchesPackage,
  getRegisteredCompanyPackage,
  type CompanyPackageCompileInput,
} from "./catalog";
import {
  founderSeatForCompany,
  recordCompiledPackageInstallation,
} from "./lifecycle";

export class CompanyCompilationError extends Error {
  constructor(
    public code: string,
    message: string,
    public findings: Array<{ code: string; path: string; message: string }> = [],
  ) {
    super(message);
  }
}

function metadataStableIds(packageDefinition: CompanyPackage): string[] {
  return [
    packageDefinition.metadata.stableId,
    packageDefinition.universalCompanyTemplateRef.metadata.stableId,
    ...packageDefinition.domainPackRefs.map((item) => item.metadata.stableId),
    packageDefinition.companyManifest.metadata.stableId,
    packageDefinition.capabilityManifest.metadata.stableId,
    packageDefinition.lifecycleActivationMap.metadata.stableId,
    packageDefinition.orgRoleAgentGraph.metadata.stableId,
    packageDefinition.authorityPolicySet.metadata.stableId,
    packageDefinition.workflowArtifactMap.metadata.stableId,
    packageDefinition.providerBindingDeclarations.metadata.stableId,
    packageDefinition.economicsMetricContracts.metadata.stableId,
    packageDefinition.dataEvidenceContracts.metadata.stableId,
    packageDefinition.failureRecoveryMap.metadata.stableId,
    packageDefinition.sourceAuthorityManifest.metadata.stableId,
  ];
}

function recordOutputRefs(report: Record<string, unknown>): string[] {
  const records = report.records;
  if (!records || typeof records !== "object") return ["organization-manifest"];
  const outputRefs: string[] = [];
  for (const [kind, value] of Object.entries(records)) {
    if (Array.isArray(value))
      outputRefs.push(...value.map((item) => `${kind}:${String(item)}`));
    else if (value) outputRefs.push(`${kind}:${String(value)}`);
  }
  return outputRefs.length ? outputRefs : ["organization-manifest"];
}

function compiledInstanceFromResult(
  packageDefinition: CompanyPackage,
  result: {
    company: Record<string, unknown>;
    manifest: Record<string, unknown>;
    report: Record<string, unknown>;
  },
): CompiledCompanyInstance {
  const sourceStableIds = metadataStableIds(packageDefinition);
  const activeCapabilityKeys = packageDefinition.capabilityManifest.value
    .filter((capability) =>
      ["required", "available"].includes(capability.state),
    )
    .map((capability) => capability.key);
  const dormantCapabilityKeys = packageDefinition.capabilityManifest.value
    .filter((capability) => capability.state === "dormant")
    .map((capability) => capability.key);
  const sourcePackageRefs = [
    packageDefinition.universalCompanyTemplateRef.value,
    ...packageDefinition.domainPackRefs.map((item) => item.value),
    ...packageDefinition.sourceAuthorityManifest.value.sources.map((source) => ({
      key: source.key,
      version: source.sourceRevision,
      sourceRef: source.sourceRef,
      sourceRevision: source.sourceRevision,
    })),
  ];
  return compiledCompanyInstanceSchema.parse({
    schemaVersion: "eos.compiled-company-instance.v1",
    companyId: Number(result.company.id),
    organizationKey: packageDefinition.companyManifest.value.orgKey,
    packageKey: packageDefinition.packageKey,
    packageVersion: packageDefinition.packageVersion,
    manifestId: String(result.manifest.id),
    activationState: result.report.activationState,
    activationBlockers: packageDefinition.lifecycleActivationMap.value.activationGates,
    activeCapabilityKeys,
    dormantCapabilityKeys,
    providerBindingKeys:
      packageDefinition.providerBindingDeclarations.value.map((binding) => binding.key),
    sourcePackageRefs,
    provenanceGraph: recordOutputRefs(result.report).map((outputRef) => ({
      outputRef,
      sourceStableIds,
    })),
    dormantCapabilityInventory:
      packageDefinition.capabilityManifest.value
        .filter((capability) => capability.state === "dormant")
        .map((capability) => capability.name),
    externalEffectsExecuted: false,
    generatedAt: new Date().toISOString(),
  });
}

export async function compileRegisteredCompanyPackage(
  executor: any,
  input: CompanyPackageCompileInput & {
    packageKey: string;
    confirmOrganizationKey: string;
  },
) {
  const registration = getRegisteredCompanyPackage(input.packageKey);
  if (!registration)
    throw new CompanyCompilationError(
      "company_package_not_found",
      "The selected company package is not registered in this EOS runtime.",
    );
  const validation = validateCompanyPackage(registration.package);
  if (!validation.package)
    throw new CompanyCompilationError(
      "company_package_invalid",
      "The selected company package failed schema or stop-law validation.",
      validation.findings,
    );
  if (
    input.confirmOrganizationKey !==
    validation.package.companyManifest.value.orgKey
  )
    throw new CompanyCompilationError(
      "organization_confirmation_mismatch",
      "The explicit organization confirmation does not match the selected package.",
    );
  const company = await executor.query.companies.findFirst({
    where: eq(companies.id, input.companyId),
  });
  if (!company)
    throw new CompanyCompilationError(
      "company_not_found",
      "The selected company no longer exists.",
    );
  if (!companyMatchesPackage(company.name, validation.package))
    throw new CompanyCompilationError(
      "company_package_target_mismatch",
      "The selected package is not bound to this company's explicit identity.",
    );
  const result = await registration.materialize(executor, input);
  const compiledInstance = compiledInstanceFromResult(validation.package, result);
  const founderSeat = await founderSeatForCompany(executor, input.companyId);
  if (!founderSeat)
    throw new CompanyCompilationError(
      "founder_seat_required",
      "A governed company package installation requires an active founder seat.",
    );
  const packageInstallation = await recordCompiledPackageInstallation(executor, {
    companyId: input.companyId,
    portfolioId: Number(result.company.portfolioId) || null,
    actorUserId: input.actorUserId,
    ownerSeatId: founderSeat.id,
    packageDefinition: validation.package,
    compiledInstance,
  });
  return { ...result, compiledInstance, packageInstallation };
}
