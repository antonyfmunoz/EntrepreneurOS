export type EvidenceScope = "repository" | "staging" | "production" | "professional";
export type EvidenceSubjectKind = "release" | "environment" | "evidence";
export type ControlDefinition = { key: string; allowedScopes: EvidenceScope[]; maximumAgeDays: number; subjectKind: EvidenceSubjectKind };
export type ControlLayerDefinition = { layer: number; name: string; controls: ControlDefinition[] };

const repository = (key: string, maximumAgeDays = 30): ControlDefinition => ({ key, allowedScopes: ["repository", "production"], maximumAgeDays, subjectKind: "release" });
const production = (key: string, maximumAgeDays = 90, subjectKind: EvidenceSubjectKind = "environment"): ControlDefinition => ({ key, allowedScopes: ["production"], maximumAgeDays, subjectKind });
const professional = (key: string, maximumAgeDays = 365, subjectKind: EvidenceSubjectKind = "evidence"): ControlDefinition => ({ key, allowedScopes: ["professional"], maximumAgeDays, subjectKind });

export const CONTROL_LAYERS: ControlLayerDefinition[] = [
  { layer: 1, name: "Front-end foundations", controls: [repository("frontend_acceptance")] },
  { layer: 2, name: "APIs and back-end logic", controls: [repository("api_contract_qualification")] },
  { layer: 3, name: "Database and storage", controls: [production("database_migration_and_storage", 30, "release")] },
  { layer: 4, name: "Authentication and permissions", controls: [production("identity_acceptance")] },
  { layer: 5, name: "Hosting and deployment", controls: [production("deployment_smoke", 30, "release")] },
  { layer: 6, name: "Cloud and compute", controls: [production("compute_capacity", 30)] },
  { layer: 7, name: "CI/CD and version control", controls: [repository("ci_qualification", 30)] },
  { layer: 8, name: "Security and database isolation", controls: [professional("database_isolation_review"), professional("security_review")] },
  { layer: 9, name: "Rate limiting", controls: [production("distributed_rate_limit_test", 30)] },
  { layer: 10, name: "Caching and CDN", controls: [production("cache_cdn_review")] },
  { layer: 11, name: "Load balancing and scaling", controls: [production("load_and_scaling_test", 30)] },
  { layer: 12, name: "Error tracking and logs", controls: [production("observability_alert_test", 30)] },
  { layer: 13, name: "Availability and recovery", controls: [production("production_restore_drill"), production("native_esign_storage_recovery_drill", 30), production("incident_response_drill")] },
  { layer: 14, name: "Payments and billing", controls: [production("billing_live_mode_acceptance", 30)] },
  { layer: 15, name: "Legal and compliance", controls: [professional("legal_approval"), professional("privacy_review"), professional("tax_review")] },
  { layer: 16, name: "Customer support", controls: [production("support_staffing")] },
  { layer: 17, name: "Product analytics", controls: [production("analytics_dashboard_review")] },
  { layer: 18, name: "Cost controls", controls: [production("ai_cost_policy", 90, "evidence")] },
  { layer: 19, name: "Vendor management", controls: [professional("vendor_review")] },
  { layer: 20, name: "Operational ownership", controls: [production("service_ownership_review")] },
  { layer: 21, name: "Integration operations", controls: [production("integration_round_trip", 30)] },
  { layer: 22, name: "AI governance and reliability", controls: [professional("ai_governance_evaluation", 90)] },
  { layer: 23, name: "Customer and data lifecycle", controls: [production("data_lifecycle_drill")] },
  { layer: 24, name: "Release and experience quality", controls: [production("accessibility_performance_release", 30, "release"), production("release_owner_approval", 7, "release")] },
];

export const CONTROL_DEFINITIONS = new Map(CONTROL_LAYERS.flatMap((layer) => layer.controls).map((control) => [control.key, control]));

export function controlEvidenceIsCurrent(input: { definition: ControlDefinition; evidenceScope: string; subject: string; reviewedAt: Date; expiresAt: Date | null; expectedReleaseSubject?: string; expectedEnvironmentSubject?: string; now?: Date }): boolean {
  const now = input.now || new Date();
  const oldestAllowed = now.getTime() - input.definition.maximumAgeDays * 86_400_000;
  const subjectMatches = input.definition.subjectKind === "release"
    ? Boolean(input.expectedReleaseSubject && input.subject === input.expectedReleaseSubject)
    : input.definition.subjectKind === "environment"
      ? Boolean(input.expectedEnvironmentSubject && input.subject === input.expectedEnvironmentSubject)
      : input.subject.trim().length >= 3 && input.subject !== "legacy-unspecified";
  return input.definition.allowedScopes.includes(input.evidenceScope as EvidenceScope)
    && subjectMatches
    && input.reviewedAt.getTime() >= oldestAllowed
    && input.reviewedAt.getTime() <= now.getTime() + 5 * 60_000
    && Boolean(input.expiresAt && input.expiresAt.getTime() > now.getTime())
    && Boolean(input.expiresAt && input.expiresAt.getTime() <= input.reviewedAt.getTime() + input.definition.maximumAgeDays * 86_400_000);
}
