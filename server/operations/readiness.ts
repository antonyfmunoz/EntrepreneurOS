import { and, eq, gt, inArray } from "drizzle-orm";
import { operationalControls, serviceOwnership, vendorRegistry } from "@shared/schema";
import { db } from "../db";
import { billingConfigured } from "../billing/stripe";
import { CONTROL_LAYERS, controlEvidenceIsCurrent } from "./control-definitions";
import { serviceOwnershipIssues } from "./ownership";
import { platformAdminIds } from "../security/platform-admin";

export type ReadinessResult = {
  layer: number;
  name: string;
  status: "pass" | "fail";
  evidence: string[];
  missing: string[];
  requirements: Array<{
    key: string;
    allowedScopes: string[];
    maximumAgeDays: number;
    subjectKind: string;
    satisfied: boolean;
  }>;
};

export async function productionReadiness() {
  const now = new Date();
  const expectedReleaseSubject = process.env.EOS_RELEASE_SUBJECT;
  const expectedEnvironmentSubject = process.env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT;
  const controls = await db.select().from(operationalControls).where(and(eq(operationalControls.status, "pass"), gt(operationalControls.expiresAt, now)));
  const controlMap = new Map(controls.map((control) => [control.controlKey, control]));
  const layers: ReadinessResult[] = CONTROL_LAYERS.map((definition) => {
    const missing = definition.controls.filter((required) => {
      const evidence = controlMap.get(required.key);
      return !evidence || !controlEvidenceIsCurrent({ definition: required, evidenceScope: evidence.evidenceScope, subject: evidence.subject, reviewedAt: evidence.reviewedAt, expiresAt: evidence.expiresAt, expectedReleaseSubject, expectedEnvironmentSubject, now });
    }).map((control) => control.key);
    return {
      layer: definition.layer,
      name: definition.name,
      status: missing.length ? "fail" : "pass",
      evidence: definition.controls.filter((required) => !missing.includes(required.key)).map((required) => { const item = controlMap.get(required.key)!; return `${required.key}:${item.evidenceScope}:${item.subject}:${item.evidenceHash}`; }),
      missing,
      requirements: definition.controls.map((required) => ({
        key: required.key,
        allowedScopes: required.allowedScopes,
        maximumAgeDays: required.maximumAgeDays,
        subjectKind: required.subjectKind,
        satisfied: !missing.includes(required.key),
      })),
    };
  });

  const requiredVendors = [
    "Clerk",
    ...(process.env.ANTHROPIC_API_KEY ? ["Anthropic"] : []),
    ...(process.env.GOOGLE_CLIENT_ID ? ["Google Workspace"] : []),
    ...(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET ? ["Notion"] : []),
    ...(billingConfigured() ? ["Stripe"] : []),
    ...(process.env.POSTHOG_API_KEY ? ["PostHog"] : []),
  ];
  const vendors = requiredVendors.length ? await db.select().from(vendorRegistry).where(and(inArray(vendorRegistry.name, requiredVendors), eq(vendorRegistry.status, "approved"))) : [];
  const missingVendors = requiredVendors.filter((name) => !vendors.some((vendor) => vendor.name === name
    && vendor.reviewEvidenceUri
    && vendor.lastReviewedAt
    && vendor.lastReviewedAt <= now
    && vendor.lastReviewedAt >= new Date(now.getTime() - 365 * 86_400_000)
    && vendor.nextReviewAt
    && vendor.nextReviewAt > now
    && vendor.nextReviewAt <= new Date(vendor.lastReviewedAt.getTime() + 365 * 86_400_000)
    && ["executed", "not_required"].includes(vendor.dpaStatus)
    && ["reviewed", "not_applicable"].includes(vendor.subprocessorStatus)));
  if (missingVendors.length) {
    const layer = layers.find((item) => item.layer === 19)!;
    layer.status = "fail";
    layer.missing.push(...missingVendors.map((name) => `approved_vendor:${name}`));
  }
  const [ownership] = await db.select().from(serviceOwnership).where(eq(serviceOwnership.serviceKey, "entrepreneuros")).limit(1);
  const ownershipMissing = serviceOwnershipIssues(ownership, now, platformAdminIds());
  if (ownershipMissing.length) {
    const layer = layers.find((item) => item.layer === 20)!;
    layer.status = "fail";
    layer.missing.push(...ownershipMissing);
  }
  const configurationMissing = [
    ...(process.env.NODE_ENV === "production" && !process.env.CLERK_SECRET_KEY?.startsWith("sk_live_") ? ["production_clerk_secret"] : []),
    ...(process.env.EOS_ACCOUNT_DELETION_ENABLED !== "true" ? ["account_deletion_worker"] : []),
    ...(process.env.EOS_LEGAL_ENFORCEMENT !== "true" ? ["legal_enforcement"] : []),
    ...(process.env.EOS_PUBLIC_PAID_SAAS === "true" && !billingConfigured() ? ["billing_configuration"] : []),
    ...(!expectedReleaseSubject ? ["release_subject"] : []),
    ...(!expectedEnvironmentSubject ? ["production_environment_subject"] : []),
  ];
  return { standard: "eos.production-readiness.v1", generatedAt: now.toISOString(), releaseSubject: expectedReleaseSubject || null, environmentSubject: expectedEnvironmentSubject || null, ready: layers.every((layer) => layer.status === "pass") && !configurationMissing.length, layers, configurationMissing, requiredVendors, missingVendors };
}
