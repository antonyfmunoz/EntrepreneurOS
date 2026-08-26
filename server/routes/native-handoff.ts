import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosArtifactClosureRecords,
  eosAuditRecords,
  eosCapabilityInstances,
  eosManifestVersions,
} from "@shared/schema";
import {
  buildNativeHandoffManifest,
  nativeHandoffManifestSchema,
} from "@shared/native-handoff";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import {
  EosRouteError,
  authorizeAction,
  companyAccess,
  mayAccessClassification,
  visibleSeatIds,
} from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "native_handoff_invalid", message: error.issues[0]?.message || "Native handoff input is invalid." });
      next(error);
    }
  };
}

function organizationKey(manifest: unknown, companyId: number) {
  if (manifest && typeof manifest === "object") {
    const value = manifest as any;
    const candidates = [
      value.compiledFrom?.companyPackage?.organizationKey,
      value.compiledFrom?.referenceInstance?.organizationKey,
      value.organizationKey,
      value.orgKey,
    ];
    const key = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
    if (key) return String(key);
  }
  return `EOS-COMPANY-${companyId}`;
}

export function registerNativeHandoffRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/native-handoffs", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    if (!Number.isInteger(companyId)) throw new EosRouteError(400, "company_scope_invalid", "Company scope must be valid.");
    const access = await companyAccess(req);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    if (!allowedSurfacesFor(access.role).some((surface) => ["organization", "operations", "systems"].includes(surface)) && !access.isOwner)
      throw new EosRouteError(403, "native_handoff_scope_denied", "Native handoff state is outside this seat's compiled workspace.");
    await authorizeAction(req, access, {
      authorityClass: "view",
      resource: "native_handoff",
      actionKey: "native_handoff.read",
      purpose: "inspect_native_handoff",
      classification: "confidential",
      consequence: "routine",
    });
    const [capabilities, records, latestManifest] = await Promise.all([
      db.select().from(eosCapabilityInstances).where(eq(eosCapabilityInstances.companyId, companyId)).orderBy(asc(eosCapabilityInstances.name)),
      db.select().from(eosArtifactClosureRecords).where(eq(eosArtifactClosureRecords.companyId, companyId)),
      db.query.eosManifestVersions.findFirst({ where: eq(eosManifestVersions.companyId, companyId), orderBy: [desc(eosManifestVersions.version)] }),
    ]);
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const requestedKey = typeof req.query.capabilityKey === "string" ? req.query.capabilityKey : null;
    const generatedAt = new Date().toISOString();
    const manifests = capabilities
      .filter((capability) => !requestedKey || capability.capabilityInstanceKey === requestedKey)
      .filter((capability) => mayAccessClassification(access, capability.classification) && (access.isOwner || visible.has(capability.accountableSeatId)))
      .map((capability) => {
        const projection = buildNativeHandoffManifest({
          capability,
          organizationKey: organizationKey(latestManifest?.manifest, companyId),
          records: records.filter((record) => record.capabilityInstanceId === capability.id && mayAccessClassification(access, record.classification)),
          generatedAt,
        });
        return nativeHandoffManifestSchema.parse({ ...projection, contentSha256: nativeContractContentSha256(projection) });
      });
    if (requestedKey && !manifests.length) throw new EosRouteError(404, "native_handoff_not_found", "The requested capability handoff is not visible in this authority scope.");
    const readinessCounts = Object.fromEntries(Array.from(new Set(manifests.map((item) => item.readiness))).map((readiness) => [readiness, manifests.filter((item) => item.readiness === readiness).length]));
    res.json({
      schemaVersion: "eos.native-handoff-registry.v1",
      companyId,
      generatedAt,
      handoffs: manifests,
      readinessCounts,
      gapCounts: {
        P0: manifests.reduce((sum, item) => sum + item.gaps.filter((gap) => gap.severity === "P0").length, 0),
        P1: manifests.reduce((sum, item) => sum + item.gaps.filter((gap) => gap.severity === "P1").length, 0),
        P2: manifests.reduce((sum, item) => sum + item.gaps.filter((gap) => gap.severity === "P2").length, 0),
      },
      boundary: "Readiness is derived from tenant-scoped closure records and verified evidence references. Exporting this registry does not qualify field behavior, providers, professional review, or the native runtime.",
    });
  }));

  app.post("/api/eos/companies/:companyId/native-handoffs/export-receipt", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await companyAccess(req);
    if (access.company.id !== companyId || !access.isOwner) throw new EosRouteError(403, "native_handoff_export_denied", "Only the company founder may record a restricted native handoff export receipt.");
    const policy = await authorizeAction(req, access, {
      authorityClass: "decide",
      resource: "native_handoff",
      actionKey: "native_handoff.export",
      purpose: "export_native_handoff",
      classification: "restricted",
      consequence: "material",
    });
    const handoff = nativeHandoffManifestSchema.parse(req.body);
    if (handoff.companyId !== companyId) throw new EosRouteError(409, "native_handoff_tenant_mismatch", "The handoff does not belong to this company.");
    const expected = nativeContractContentSha256({ ...handoff, contentSha256: undefined });
    if (handoff.contentSha256 !== expected) throw new EosRouteError(409, "native_handoff_hash_mismatch", "The handoff content hash does not match its canonical projection.");
    await db.insert(eosAuditRecords).values({
      id: randomUUID(), companyId, actorUserId: req.user.id,
      action: "native_handoff.exported", targetType: "capability_instance", targetId: handoff.capabilityInstanceId,
      traceId: policy.traceId, correlationId: policy.correlationId, result: "receipt_recorded",
      details: { capabilityKey: handoff.capabilityKey, readiness: handoff.readiness, contentSha256: handoff.contentSha256, policyDecisionId: policy.decisionId },
      createdAt: new Date(),
    });
    res.status(201).json({ recorded: true, capabilityKey: handoff.capabilityKey, contentSha256: handoff.contentSha256 });
  }));
}
