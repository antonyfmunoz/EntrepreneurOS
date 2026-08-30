import type { Request } from "express";
import { eq, sql } from "drizzle-orm";
import {
  companies,
  eosCapabilityInstances,
  eosCompanyPackageInstallations,
  eosIntegrationBindings,
  eosManifestVersions,
  eosProviderExecutions,
  eosSeats,
  eosSystems,
  users,
} from "@shared/schema";
import { client, db } from "../server/db";
import { compileRegisteredCompanyPackage } from "../server/company-compilation/engine";
import { authorizeAction, companyAccess } from "../server/routes/eos-runtime";

type Options = {
  companyId: number;
  packageKey: string;
  organizationKey: string;
};

function optionsFrom(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("Usage: --company-id <id> --package-key <key> --organization-key <key>");
    values.set(key, value);
  }
  const companyId = Number(values.get("--company-id"));
  const packageKey = values.get("--package-key")?.trim() || "";
  const organizationKey = values.get("--organization-key")?.trim() || "";
  if (!Number.isInteger(companyId) || companyId <= 0 || !packageKey || !organizationKey)
    throw new Error("A positive company id, package key, and organization key are required.");
  if (values.size !== 3)
    throw new Error("Only --company-id, --package-key, and --organization-key are accepted.");
  return { companyId, packageKey, organizationKey };
}

function requestFor(companyId: number, user: typeof users.$inferSelect): Request {
  return {
    params: { companyId: String(companyId) },
    query: {},
    user,
    get: () => undefined,
  } as unknown as Request;
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = String(row[key] ?? "unknown");
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

async function providerExecutionCount(companyId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eosProviderExecutions)
    .where(eq(eosProviderExecutions.companyId, companyId));
  return Number(row?.count || 0);
}

async function runtimeReceipt(companyId: number) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const [seats, capabilities, systems, integrations, manifests, installations, providerExecutions] = await Promise.all([
    db.select({ status: eosSeats.status }).from(eosSeats).where(eq(eosSeats.companyId, companyId)),
    db.select({ state: eosCapabilityInstances.state }).from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)),
    db.select({ id: eosSystems.id }).from(eosSystems).where(eq(eosSystems.companyId, companyId)),
    db.select({ id: eosIntegrationBindings.id }).from(eosIntegrationBindings).where(eq(eosIntegrationBindings.companyId, companyId)),
    db.select({ id: eosManifestVersions.id }).from(eosManifestVersions).where(eq(eosManifestVersions.companyId, companyId)),
    db.select({
      packageKey: eosCompanyPackageInstallations.packageKey,
      state: eosCompanyPackageInstallations.state,
      installedVersion: eosCompanyPackageInstallations.installedVersion,
      compiledInstance: eosCompanyPackageInstallations.compiledInstance,
    }).from(eosCompanyPackageInstallations).where(eq(eosCompanyPackageInstallations.companyId, companyId)),
    providerExecutionCount(companyId),
  ]);
  const installation = installations[0];
  const compiledInstance = (installation?.compiledInstance || {}) as Record<string, unknown>;
  return {
    companyId,
    companyName: company?.name,
    seats: { total: seats.length, byStatus: countBy(seats, "status") },
    capabilities: { total: capabilities.length, byState: countBy(capabilities, "state") },
    systems: systems.length,
    integrations: integrations.length,
    manifests: manifests.length,
    installation: installation ? {
      packageKey: installation.packageKey,
      state: installation.state,
      installedVersion: installation.installedVersion,
      activationState: compiledInstance.activationState,
      externalEffectsExecuted: compiledInstance.externalEffectsExecuted,
    } : null,
    providerExecutions,
  };
}

async function main() {
  if (process.env.EOS_COMPANY_PACKAGE_COMPILE_AUTHORIZED !== "true")
    throw new Error("Set EOS_COMPANY_PACKAGE_COMPILE_AUTHORIZED=true only after explicit production authorization.");
  const options = optionsFrom(process.argv.slice(2));
  const company = await db.query.companies.findFirst({ where: eq(companies.id, options.companyId) });
  if (!company) throw new Error("The target company does not exist.");
  const principal = await db.query.users.findFirst({ where: eq(users.id, company.ownerUserId) });
  if (!principal) throw new Error("The target company owner does not exist.");

  const req = requestFor(options.companyId, principal);
  const access = await companyAccess(req);
  if (access.role !== "founder" || !access.isCompanyOwner)
    throw new Error("The target company did not resolve to its founder authority context.");
  const policy = await authorizeAction(req, access, {
    authorityClass: "decide",
    resource: "organization_manifest",
    actionKey: "company_package.compile",
    purpose: "compile_company_package",
    classification: "restricted",
    consequence: "material",
  });
  const providerExecutionsBefore = await providerExecutionCount(options.companyId);
  const compile = () => db.transaction((tx) => compileRegisteredCompanyPackage(tx, {
    packageKey: options.packageKey,
    confirmOrganizationKey: options.organizationKey,
    companyId: options.companyId,
    actorUserId: principal.id,
    actorName: principal.fullName || principal.username || "Founder",
  }));
  const first = await compile();
  const second = await compile();
  const providerExecutionsAfter = await providerExecutionCount(options.companyId);
  if (providerExecutionsAfter !== providerExecutionsBefore)
    throw new Error("Provider execution count changed during package compilation.");

  console.log(JSON.stringify({
    schemaVersion: "eos.company-package-compilation-receipt.v1",
    packageKey: options.packageKey,
    firstCreated: first.created,
    firstInstallationRecorded: first.packageInstallation.recorded,
    secondCreated: second.created,
    secondInstallationRecorded: second.packageInstallation.recorded,
    policyOutcome: policy.outcome,
    providerExecutionsBefore,
    providerExecutionsAfter,
    providerExecutionsDelta: providerExecutionsAfter - providerExecutionsBefore,
    runtime: await runtimeReceipt(options.companyId),
  }, null, 2));
}

try {
  await main();
} finally {
  await client.end();
}
