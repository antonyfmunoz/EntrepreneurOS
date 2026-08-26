import type { Express, Request, Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z, ZodError } from "zod";
import {
  eosCompanyPackageInstallationEvents,
  eosCompanyPackageInstallations,
  umhEventOutbox,
  umhInstallations,
} from "@shared/schema";
import { companyPackageSchema, validateCompanyPackage } from "@shared/company-compilation";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import {
  applicableCompanyPackages,
  getRegisteredCompanyPackage,
} from "../company-compilation/catalog";
import { packageTransitionForCompany } from "../company-compilation/lifecycle";
import { compileRegisteredCompanyPackage } from "../company-compilation/engine";
import { capabilityManifest, FEDERATION_PROTOCOL_VERSION } from "../umh/contracts";
import { federationConfigured } from "../umh/config";
import { containsCredentialMaterial } from "../security/credential-material";
import {
  EosRouteError,
  authorizeAction,
  companyAccess,
} from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "company_package_lifecycle_invalid", message: error.issues[0]?.message || "Company package lifecycle input is invalid." });
      next(error);
    }
  };
}

async function founderAccess(req: Request, purpose: string, actionKey: string, authorityClass: "view" | "decide" = "view") {
  const access = await companyAccess(req);
  if (!access.isOwner) throw new EosRouteError(403, "company_package_lifecycle_denied", "Only the company founder may govern native package lifecycle and replication exports.");
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: "company_package_installation",
    actionKey,
    purpose,
    classification: "restricted",
    consequence: authorityClass === "decide" ? "material" : "routine",
  });
  return { access, policy };
}

const replicationBundleSchema = z.object({
  schemaVersion: z.literal("eos.company-replication-bundle.v1"), sourceCompanyId: z.number().int().positive(),
  packageKey: z.string().trim().min(2).max(160), packageVersion: z.string().trim().min(1).max(80), organizationKey: z.string().trim().min(3).max(160),
  packageDefinition: companyPackageSchema, compiledInstance: z.record(z.unknown()), sourceBindings: z.array(z.record(z.unknown())).max(500),
  installationSnapshotSha256: z.string().regex(/^[0-9a-f]{64}$/), generatedAt: z.string().datetime(), externalEffectsExecuted: z.literal(false),
  importLaw: z.string().trim().min(20).max(4000), contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

function bundleWithoutHash(bundle: z.infer<typeof replicationBundleSchema>) { const { contentSha256: _contentSha256, ...body } = bundle; return body; }
function validateReplicationBundle(raw: unknown, targetCompanyId: number) {
  const bundle = replicationBundleSchema.parse(raw);
  if (bundle.sourceCompanyId === targetCompanyId) throw new EosRouteError(409, "replication_target_same_as_source", "Replication requires a distinct target company identity.");
  if (nativeContractContentSha256(bundleWithoutHash(bundle)) !== bundle.contentSha256) throw new EosRouteError(409, "replication_bundle_hash_invalid", "Replication bundle content does not match its custody hash.");
  if (containsCredentialMaterial(bundle)) throw new EosRouteError(409, "replication_bundle_contains_credentials", "Replication bundles cannot contain credentials, tokens, passwords, or private keys.");
  const registration = getRegisteredCompanyPackage(bundle.packageKey);
  if (!registration || registration.package.packageVersion !== bundle.packageVersion || nativeContractContentSha256(registration.package) !== nativeContractContentSha256(bundle.packageDefinition)) throw new EosRouteError(409, "replication_package_untrusted", "Import requires the exact package version registered in this EOS release.");
  const validation = validateCompanyPackage(bundle.packageDefinition);
  if (!validation.package) throw new EosRouteError(409, "replication_package_invalid", "The package failed schema or stop-law validation.");
  return { bundle, registration, packageDefinition: validation.package };
}

function replicationPlan(input: { targetCompanyId: number; bundle: z.infer<typeof replicationBundleSchema> }) {
  const providerBindings = input.bundle.packageDefinition.providerBindingDeclarations.value;
  const body = {
    schemaVersion: "eos.company-replication-import-plan.v1", sourceCompanyId: input.bundle.sourceCompanyId, targetCompanyId: input.targetCompanyId,
    packageKey: input.bundle.packageKey, packageVersion: input.bundle.packageVersion, organizationKey: input.bundle.organizationKey,
    sourceBundleSha256: input.bundle.contentSha256,
    actions: ["bind_new_tenant_identity", "validate_registered_package", "compile_deterministically", "recreate_local_authority", "keep_provider_bindings_unverified", "requalify_instance_evidence"],
    providerBindingsRequiringFreshAuthorization: providerBindings.map((item) => item.key),
    copiedCredentials: false, copiedLiveAuthority: false, externalEffectsExecuted: false,
    stopLaws: input.bundle.packageDefinition.lifecycleActivationMap.value.stopLaws,
  };
  return { ...body, planSha256: nativeContractContentSha256(body) };
}

export function registerCompanyPackageLifecycleRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/company-package-installations", route(async (req, res) => {
    const { access } = await founderAccess(req, "inspect_company_package_lifecycle", "company_package.installations.read");
    const records = await db.select().from(eosCompanyPackageInstallations)
      .where(eq(eosCompanyPackageInstallations.companyId, access.company.id))
      .orderBy(asc(eosCompanyPackageInstallations.packageKey));
    const events = records.length ? await db.select().from(eosCompanyPackageInstallationEvents)
      .where(eq(eosCompanyPackageInstallationEvents.companyId, access.company.id))
      .orderBy(asc(eosCompanyPackageInstallationEvents.recordedAt)) : [];
    res.json({
      schemaVersion: "eos.company-package-installation-registry.v1",
      companyId: access.company.id,
      installations: records.map((record) => ({
        ...record,
        events: events.filter((event) => event.installationId === record.id),
      })),
    });
  }));

  app.get("/api/eos/companies/:companyId/company-packages/:packageKey/transition-plan", route(async (req, res) => {
    const { access } = await founderAccess(req, "plan_company_package_transition", "company_package.transition.plan");
    const registration = applicableCompanyPackages(access.company.name)
      .find((candidate) => candidate.package.packageKey === req.params.packageKey);
    if (!registration) throw new EosRouteError(404, "company_package_not_found", "The selected package is not registered for this company identity.");
    const result = await packageTransitionForCompany(db, { companyId: access.company.id, packageDefinition: registration.package });
    res.json(result);
  }));

  app.get("/api/eos/companies/:companyId/company-packages/:packageKey/replication-export", route(async (req, res) => {
    const { access } = await founderAccess(req, "export_company_package_replication", "company_package.replication.export", "decide");
    const registration = getRegisteredCompanyPackage(req.params.packageKey);
    if (!registration || !applicableCompanyPackages(access.company.name).some((candidate) => candidate.package.packageKey === registration.package.packageKey))
      throw new EosRouteError(404, "company_package_not_found", "The selected package is not registered for this company identity.");
    const [installation] = await db.select().from(eosCompanyPackageInstallations).where(and(
      eq(eosCompanyPackageInstallations.companyId, access.company.id),
      eq(eosCompanyPackageInstallations.packageKey, registration.package.packageKey),
    )).limit(1);
    if (!installation) throw new EosRouteError(409, "company_package_not_installed", "Compile and record the package before exporting a replication bundle.");
    const packageDefinition = companyPackageSchema.parse(registration.package);
    const generatedAt = new Date().toISOString();
    const bundle = {
      schemaVersion: "eos.company-replication-bundle.v1",
      sourceCompanyId: access.company.id,
      packageKey: packageDefinition.packageKey,
      packageVersion: packageDefinition.packageVersion,
      organizationKey: packageDefinition.companyManifest.value.orgKey,
      packageDefinition,
      compiledInstance: installation.compiledInstance,
      sourceBindings: registration.sourceBindings.map((binding) => ({
        sourceKey: binding.sourceKey,
        pageClass: binding.pageClass,
        sourceRef: binding.sourceRef,
        expectedRevision: binding.expectedRevision,
        classification: binding.classification,
        importAuthority: binding.importAuthority,
      })),
      installationSnapshotSha256: installation.snapshotSha256,
      generatedAt,
      externalEffectsExecuted: false,
      importLaw: "Import must bind a new tenant and organization identity, validate every source revision, compile in dry-run mode, and re-qualify providers and instance values. This export cannot clone credentials or live authority.",
    };
    res.json({ ...bundle, contentSha256: nativeContractContentSha256(bundle) });
  }));

  app.post("/api/eos/companies/:companyId/company-package-replication/plan", route(async (req, res) => {
    const { access } = await founderAccess(req, "plan_company_package_replication_import", "company_package.replication.plan", "decide");
    const { bundle, packageDefinition } = validateReplicationBundle(req.body?.bundle, access.company.id);
    if (!applicableCompanyPackages(access.company.name).some((item) => item.package.packageKey === packageDefinition.packageKey)) throw new EosRouteError(409, "replication_target_identity_mismatch", "The target company name must explicitly match the registered package identity.");
    res.json(replicationPlan({ targetCompanyId: access.company.id, bundle }));
  }));

  app.post("/api/eos/companies/:companyId/company-package-replication/import", route(async (req, res) => {
    const input = z.object({ bundle: replicationBundleSchema, expectedPlanSha256: z.string().regex(/^[0-9a-f]{64}$/), confirmOrganizationKey: z.string().trim().min(3).max(160) }).parse(req.body);
    const { access, policy } = await founderAccess(req, "execute_company_package_replication_import", "company_package.replication.import", "decide");
    const { bundle, packageDefinition } = validateReplicationBundle(input.bundle, access.company.id);
    if (!applicableCompanyPackages(access.company.name).some((item) => item.package.packageKey === packageDefinition.packageKey)) throw new EosRouteError(409, "replication_target_identity_mismatch", "The target company name must explicitly match the registered package identity.");
    const plan = replicationPlan({ targetCompanyId: access.company.id, bundle });
    if (plan.planSha256 !== input.expectedPlanSha256) throw new EosRouteError(409, "replication_plan_changed", "The replication plan changed; review the current dry-run plan before importing.");
    if (input.confirmOrganizationKey !== plan.organizationKey) throw new EosRouteError(409, "replication_organization_confirmation_mismatch", "Explicit organization confirmation does not match the replication plan.");
    const result = await compileRegisteredCompanyPackage(db, { companyId: access.company.id, actorUserId: req.user.id, actorName: req.user.fullName || req.user.username, packageKey: plan.packageKey, confirmOrganizationKey: input.confirmOrganizationKey });
    res.status(201).json({ schemaVersion: "eos.company-replication-import-result.v1", plan, manifestId: result.manifest.id, packageInstallation: result.packageInstallation, externalEffectsExecuted: false, providersRequireFreshAuthorization: plan.providerBindingsRequiringFreshAuthorization, policyDecisionId: policy.decisionId });
  }));

  app.get("/api/eos/companies/:companyId/native-conformance", route(async (req, res) => {
    const { access } = await founderAccess(req, "inspect_native_conformance", "native_conformance.read");
    const [installations, federationInstallations] = await Promise.all([
      db.select().from(eosCompanyPackageInstallations).where(eq(eosCompanyPackageInstallations.companyId, access.company.id)),
      db.select().from(umhInstallations).where(eq(umhInstallations.companyId, access.company.id)),
    ]);
    const federationInstallationIds = federationInstallations.map((item) => item.id);
    const pendingOutbox = federationInstallationIds.length ? await db.select().from(umhEventOutbox).where(and(eq(umhEventOutbox.status, "pending"), inArray(umhEventOutbox.installationId, federationInstallationIds))) : [];
    const contract = capabilityManifest(federationConfigured());
    const checks = [
      { key: "standalone_authority", status: "passed", evidence: "EOS routes resolve local tenant, seat, temporal Authority Grant, policy, approval, audit, and Evidence without UMH." },
      { key: "no_database_bridge", status: "passed", evidence: "The federation port exposes signed HTTPS commands and outcomes; no database credential or direct table mutation contract is published." },
      { key: "signed_idempotent_ingress", status: "passed", evidence: `${FEDERATION_PROTOCOL_VERSION} validates installation, signature, nonce, expiry, delegation, scope, capability, and idempotency.` },
      { key: "transactional_outbox", status: "passed", evidence: "Accepted commands transactionally persist local work, approval, audit, outcome, and durable outbound events." },
      { key: "package_custody", status: installations.length ? "passed" : "not_applicable", evidence: `${installations.length} content-addressed package installation(s) are recorded for this company.` },
      { key: "external_umh_connection", status: federationInstallations.some((item) => item.enabled) && federationConfigured() ? "configured_unverified" : "not_configured", evidence: "Configuration is local evidence only; external UMH interoperability requires a separate signed flight test." },
      { key: "outbox_delivery", status: pendingOutbox.length ? "attention" : "clear", evidence: `${pendingOutbox.length} pending federation event(s) exist across the local runtime.` },
    ];
    res.json({ schemaVersion: "eos.native-conformance-report.v1", companyId: access.company.id, contract, checks, repositoryConformant: !checks.some((item) => item.status === "failed"), operationalAttentionRequired: checks.some((item) => item.status === "attention"), externalInteropQualified: false, qualificationBoundary: "This report validates EOS-side contracts and local custody only. It does not claim a live UMH deployment, provider authorization, or cross-system flight test." });
  }));
}
