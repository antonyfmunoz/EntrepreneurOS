import { and, eq, gt, inArray, or, isNull } from "drizzle-orm";
import { operationalControls, serviceOwnership, vendorRegistry } from "@shared/schema";
import { db } from "../db";
import { billingConfigured } from "../billing/stripe";

export type ReadinessResult = { layer: number; name: string; status: "pass" | "fail"; evidence: string[]; missing: string[] };

const controlLayers: Array<{ layer: number; name: string; controls: string[] }> = [
  { layer: 1, name: "Front-end foundations", controls: ["frontend_acceptance"] },
  { layer: 2, name: "APIs and back-end logic", controls: ["api_contract_qualification"] },
  { layer: 3, name: "Database and storage", controls: ["database_migration_and_storage"] },
  { layer: 4, name: "Authentication and permissions", controls: ["identity_acceptance"] },
  { layer: 5, name: "Hosting and deployment", controls: ["deployment_smoke"] },
  { layer: 6, name: "Cloud and compute", controls: ["compute_capacity"] },
  { layer: 7, name: "CI/CD and version control", controls: ["ci_qualification"] },
  { layer: 8, name: "Security and database isolation", controls: ["database_isolation_review", "security_review"] },
  { layer: 9, name: "Rate limiting", controls: ["distributed_rate_limit_test"] },
  { layer: 10, name: "Caching and CDN", controls: ["cache_cdn_review"] },
  { layer: 11, name: "Load balancing and scaling", controls: ["load_and_scaling_test"] },
  { layer: 12, name: "Error tracking and logs", controls: ["observability_alert_test"] },
  { layer: 13, name: "Availability and recovery", controls: ["production_restore_drill", "incident_response_drill"] },
  { layer: 14, name: "Payments and billing", controls: ["billing_live_mode_acceptance"] },
  { layer: 15, name: "Legal and compliance", controls: ["legal_approval", "privacy_review", "tax_review"] },
  { layer: 16, name: "Customer support", controls: ["support_staffing"] },
  { layer: 17, name: "Product analytics", controls: ["analytics_dashboard_review"] },
  { layer: 18, name: "Cost controls", controls: ["ai_cost_policy"] },
  { layer: 19, name: "Vendor management", controls: ["vendor_review"] },
  { layer: 20, name: "Operational ownership", controls: ["service_ownership_review"] },
  { layer: 21, name: "Integration operations", controls: ["integration_round_trip"] },
  { layer: 22, name: "AI governance and reliability", controls: ["ai_governance_evaluation"] },
  { layer: 23, name: "Customer and data lifecycle", controls: ["data_lifecycle_drill"] },
  { layer: 24, name: "Release and experience quality", controls: ["accessibility_performance_release", "release_owner_approval"] },
];

export async function productionReadiness() {
  const now = new Date();
  const controls = await db.select().from(operationalControls).where(and(inArray(operationalControls.status, ["pass", "not_applicable"]), or(isNull(operationalControls.expiresAt), gt(operationalControls.expiresAt, now))));
  const controlMap = new Map(controls.map((control) => [control.controlKey, control]));
  const layers: ReadinessResult[] = controlLayers.map((definition) => {
    const missing = definition.controls.filter((key) => !controlMap.has(key));
    return { layer: definition.layer, name: definition.name, status: missing.length ? "fail" : "pass", evidence: definition.controls.filter((key) => controlMap.has(key)).map((key) => `${key}:${controlMap.get(key)!.evidenceHash}`), missing };
  });

  const requiredVendors = [
    "Clerk",
    ...(process.env.ANTHROPIC_API_KEY ? ["Anthropic"] : []),
    ...(process.env.GOOGLE_CLIENT_ID ? ["Google Workspace"] : []),
    ...(process.env.NOTION_API_KEY || process.env.NOTION_API_TOKEN ? ["Notion"] : []),
    ...(billingConfigured() ? ["Stripe"] : []),
    ...(process.env.POSTHOG_API_KEY ? ["PostHog"] : []),
  ];
  const vendors = requiredVendors.length ? await db.select().from(vendorRegistry).where(and(inArray(vendorRegistry.name, requiredVendors), eq(vendorRegistry.status, "approved"))) : [];
  const missingVendors = requiredVendors.filter((name) => !vendors.some((vendor) => vendor.name === name && vendor.reviewEvidenceUri && vendor.lastReviewedAt && (!vendor.nextReviewAt || vendor.nextReviewAt > now)));
  if (missingVendors.length) {
    const layer = layers.find((item) => item.layer === 19)!;
    layer.status = "fail";
    layer.missing.push(...missingVendors.map((name) => `approved_vendor:${name}`));
  }
  const [ownership] = await db.select().from(serviceOwnership).where(eq(serviceOwnership.serviceKey, "entrepreneuros")).limit(1);
  if (!ownership) {
    const layer = layers.find((item) => item.layer === 20)!;
    layer.status = "fail";
    layer.missing.push("service_owner_and_on_call");
  }
  const configurationMissing = [
    ...(process.env.NODE_ENV === "production" && !process.env.CLERK_SECRET_KEY?.startsWith("sk_live_") ? ["production_clerk_secret"] : []),
    ...(process.env.EOS_ACCOUNT_DELETION_ENABLED !== "true" ? ["account_deletion_worker"] : []),
    ...(process.env.EOS_LEGAL_ENFORCEMENT !== "true" ? ["legal_enforcement"] : []),
    ...(process.env.EOS_PUBLIC_PAID_SAAS === "true" && !billingConfigured() ? ["billing_configuration"] : []),
  ];
  return { standard: "eos.production-readiness.v1", generatedAt: now.toISOString(), ready: layers.every((layer) => layer.status === "pass") && !configurationMissing.length, layers, configurationMissing, requiredVendors, missingVendors };
}
