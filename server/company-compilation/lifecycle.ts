import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  eosCompanyPackageInstallationEvents,
  eosCompanyPackageInstallations,
  eosSeats,
} from "@shared/schema";
import {
  comparePackageVersions,
  planCompanyPackageTransition,
  type CompanyPackage,
  type CompiledCompanyInstance,
} from "@shared/company-compilation";
import { nativeContractContentSha256 } from "../esign/template-generation";

type Executor = any;

function installedSnapshot(installation: typeof eosCompanyPackageInstallations.$inferSelect) {
  return {
    packageVersion: installation.installedVersion,
    compiledInstance: installation.compiledInstance,
    snapshotSha256: installation.snapshotSha256,
    capturedAt: installation.updatedAt instanceof Date ? installation.updatedAt.toISOString() : String(installation.updatedAt),
  };
}

export async function packageTransitionForCompany(executor: Executor, input: {
  companyId: number;
  packageDefinition: CompanyPackage;
}) {
  const [installation] = await executor.select().from(eosCompanyPackageInstallations)
    .where(and(eq(eosCompanyPackageInstallations.companyId, input.companyId), eq(eosCompanyPackageInstallations.packageKey, input.packageDefinition.packageKey))).limit(1);
  const rollbackVersions = Array.isArray(installation?.rollbackSnapshots)
    ? installation.rollbackSnapshots.map((snapshot: any) => String(snapshot?.packageVersion || "")).filter(Boolean)
    : [];
  return {
    installation: installation || null,
    plan: planCompanyPackageTransition({
      packageDefinition: input.packageDefinition,
      installedVersion: installation?.installedVersion || null,
      installedOrganizationKey: installation?.organizationKey || null,
      rollbackVersions,
    }),
  };
}

export async function recordCompiledPackageInstallation(executor: Executor, input: {
  companyId: number;
  portfolioId: number | null;
  actorUserId: string;
  ownerSeatId: string;
  packageDefinition: CompanyPackage;
  compiledInstance: CompiledCompanyInstance;
}) {
  const { installation, plan } = await packageTransitionForCompany(executor, input);
  if (!plan.compatible) return { installation, plan, recorded: false };
  if (installation?.installedVersion === input.packageDefinition.packageVersion)
    return { installation, plan, recorded: false };
  const now = new Date();
  const snapshot = {
    schemaVersion: "eos.company-package-installation-snapshot.v1",
    companyId: input.companyId,
    packageKey: input.packageDefinition.packageKey,
    organizationKey: input.packageDefinition.companyManifest.value.orgKey,
    packageVersion: input.packageDefinition.packageVersion,
    compiledInstance: input.compiledInstance,
    capturedAt: now.toISOString(),
    externalEffectsExecuted: false,
  };
  const snapshotSha256 = nativeContractContentSha256(snapshot);
  const activationBlocked = input.compiledInstance.activationState === "blocked" || input.compiledInstance.activationBlockers.length > 0;
  if (!installation) {
    const installationId = randomUUID();
    const state = activationBlocked ? "blocked" : "installed";
    const created = (await executor.insert(eosCompanyPackageInstallations).values({
      id: installationId,
      companyId: input.companyId,
      portfolioId: input.portfolioId,
      packageKey: input.packageDefinition.packageKey,
      organizationKey: input.packageDefinition.companyManifest.value.orgKey,
      installedVersion: input.packageDefinition.packageVersion,
      desiredVersion: input.packageDefinition.packageVersion,
      state,
      compatibilityReport: plan,
      compiledInstance: input.compiledInstance,
      rollbackSnapshots: [],
      snapshotSha256,
      ownerSeatId: input.ownerSeatId,
      classification: "restricted",
      version: 1,
      lastAction: activationBlocked ? "blocked" : "installed",
      recordedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    }).returning())[0];
    const eventProjection = {
      schemaVersion: "eos.company-package-installation-event.v1",
      installationId,
      sequence: 1,
      action: activationBlocked ? "blocked" : "installed",
      fromVersion: null,
      toVersion: input.packageDefinition.packageVersion,
      snapshotSha256,
      activationState: input.compiledInstance.activationState,
      activationBlockers: input.compiledInstance.activationBlockers,
      recordedAt: now.toISOString(),
    };
    await executor.insert(eosCompanyPackageInstallationEvents).values({
      id: randomUUID(), installationId, companyId: input.companyId, sequence: 1,
      action: activationBlocked ? "blocked" : "installed", fromVersion: null, toVersion: input.packageDefinition.packageVersion,
      eventProjection, eventSha256: nativeContractContentSha256(eventProjection), recordedByUserId: input.actorUserId, recordedAt: now,
    });
    return { installation: created, plan, recorded: true };
  }
  const comparison = comparePackageVersions(installation.installedVersion || "0", input.packageDefinition.packageVersion);
  const action = activationBlocked ? "blocked" : comparison < 0 ? "upgraded" : "rolled_back";
  const previous = installedSnapshot(installation);
  const rollbackSnapshots = [...(Array.isArray(installation.rollbackSnapshots) ? installation.rollbackSnapshots : []), previous].slice(-20);
  const nextVersion = installation.version + 1;
  const eventProjection = {
    schemaVersion: "eos.company-package-installation-event.v1",
    installationId: installation.id,
    sequence: nextVersion,
    action,
    fromVersion: installation.installedVersion,
    toVersion: input.packageDefinition.packageVersion,
    snapshotSha256,
    activationState: input.compiledInstance.activationState,
    activationBlockers: input.compiledInstance.activationBlockers,
    recordedAt: now.toISOString(),
  };
  await executor.insert(eosCompanyPackageInstallationEvents).values({
    id: randomUUID(), installationId: installation.id, companyId: input.companyId, sequence: nextVersion,
    action, fromVersion: installation.installedVersion, toVersion: input.packageDefinition.packageVersion,
    eventProjection, eventSha256: nativeContractContentSha256(eventProjection), recordedByUserId: input.actorUserId, recordedAt: now,
  });
  const updated = (await executor.update(eosCompanyPackageInstallations).set({
    installedVersion: input.packageDefinition.packageVersion,
    desiredVersion: input.packageDefinition.packageVersion,
    state: activationBlocked ? "blocked" : "installed",
    compatibilityReport: plan,
    compiledInstance: input.compiledInstance,
    rollbackSnapshots,
    snapshotSha256,
    version: nextVersion,
    lastAction: action,
    updatedAt: now,
  }).where(eq(eosCompanyPackageInstallations.id, installation.id)).returning())[0];
  return { installation: updated, plan, recorded: true };
}

export async function founderSeatForCompany(executor: Executor, companyId: number) {
  const [seat] = await executor.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active"))).limit(1);
  return seat || null;
}
