import { z } from "zod";

export const artifactClosureClasses = [
  "capability_definition",
  "template_ancestry_overlays",
  "role_seat",
  "position_agreement",
  "role_agent_specialists",
  "authority_permission_disclosure",
  "sops",
  "workflow_state_machine",
  "work_packet_templates",
  "kpis_scorecard_thresholds",
  "meetings_cadences",
  "interactive_instrument_read_model",
  "forms_intake_checklists",
  "scripts_messages_documents",
  "tools_integrations_provider_bindings",
  "events_telemetry",
  "evidence_provenance_requirements",
  "exception_escalation_rollback",
  "training_onboarding_development",
  "acceptance_tests_rehearsal_fixtures",
  "instance_values_owners_live_configuration",
  "template_learning_versioning",
] as const;

export const artifactClosureApplicability = [
  "inherited",
  "instantiated",
  "missing",
  "not_applicable",
  "deferred_by_trigger",
] as const;

export const artifactClosureMaturity = [
  "doctrine",
  "mapped",
  "artifact_complete",
  "implemented",
  "pre_live_qualified",
  "field_qualified",
  "native_qualified",
] as const;

export type ArtifactClosureClass = (typeof artifactClosureClasses)[number];
export type ArtifactClosureMaturity = (typeof artifactClosureMaturity)[number];

export const artifactClosureInitializeSchema = z.object({
  moduleId: z.number().int().min(1).max(14),
  capabilityKey: z.string().trim().min(2).max(160),
  capabilityInstanceId: z.string().uuid().optional(),
  ownerSeatId: z.string().uuid(),
  templateStack: z.array(z.string().trim().min(1).max(240)).max(40).default([]),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

export const artifactClosureInitializeModuleSchema = z.object({
  moduleId: z.number().int().min(1).max(14),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

export const artifactClosureInitializeCompanySchema = z.object({
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

export const preLiveScenarioTypes = [
  "normal_flow",
  "authority_denial",
  "provider_unavailable",
  "failure_recovery",
  "rollback",
  "tenant_isolation",
  "audit_replay",
] as const;

export const preLiveQualificationRunCreateSchema = z.object({
  title: z.string().trim().min(5).max(200),
  moduleIds: z.array(z.number().int().min(1).max(14)).min(1).max(14)
    .transform((values) => Array.from(new Set(values)).sort((a, b) => a - b)),
  ownerSeatId: z.string().uuid(),
  objective: z.string().trim().min(20).max(4000),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

export const preLiveQualificationRunTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  rationale: z.string().trim().min(20).max(4000),
});

export const preLiveQualificationScenarioUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["passed", "failed", "blocked"]),
  ownerSeatId: z.string().uuid(),
  evidenceIds: z.array(z.string().uuid()).min(1).max(50),
  resultSummary: z.string().trim().min(20).max(4000),
  blocker: z.string().trim().max(2000).default(""),
}).superRefine((value, context) => {
  if (value.status !== "passed" && !value.blocker) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "A failed or blocked scenario requires a named blocker." });
  if (value.status === "passed" && value.blocker) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "A passed scenario cannot retain an active blocker." });
});

export const preLiveQualificationReleaseSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(["released", "rejected"]),
  evidenceIds: z.array(z.string().uuid()).min(1).max(50),
  rationale: z.string().trim().min(30).max(4000),
});

export const artifactClosureUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  applicability: z.enum(artifactClosureApplicability),
  maturity: z.enum(artifactClosureMaturity),
  ownerSeatId: z.string().uuid(),
  templateStack: z.array(z.string().trim().min(1).max(240)).max(40).default([]),
  evidenceIds: z.array(z.string().uuid()).max(50).default([]),
  blocker: z.string().trim().max(2000).default(""),
  nextAction: z.string().trim().min(10).max(2000),
  rationale: z.string().trim().min(20).max(4000),
  triggerCondition: z.string().trim().max(2000).default(""),
  classification: z.enum(["internal", "confidential", "restricted"]),
});

export const artifactClosureMaturityRank = Object.fromEntries(
  artifactClosureMaturity.map((state, rank) => [state, rank]),
) as Record<ArtifactClosureMaturity, number>;

export function artifactClosureInputIssues(input: z.infer<typeof artifactClosureUpdateSchema>): string[] {
  const issues: string[] = [];
  if (input.applicability === "missing" && !input.blocker) issues.push("a named blocker");
  if (["not_applicable", "deferred_by_trigger"].includes(input.applicability) && !input.triggerCondition)
    issues.push("an explicit non-applicability or activation trigger");
  if (["pre_live_qualified", "field_qualified", "native_qualified"].includes(input.maturity) && !input.evidenceIds.length)
    issues.push("verified qualification Evidence");
  if (["pre_live_qualified", "field_qualified", "native_qualified"].includes(input.maturity) && input.blocker)
    issues.push("closure of the active blocker");
  if (input.applicability === "missing" && artifactClosureMaturityRank[input.maturity] >= artifactClosureMaturityRank.artifact_complete)
    issues.push("a non-missing artifact before Artifact Complete");
  return issues;
}

export function closureGroupState(records: Array<{ artifactClass: string; applicability: string; maturity: string; blocker: string }>) {
  const rank = (value: string) => artifactClosureMaturityRank[value as ArtifactClosureMaturity] ?? -1;
  const completeCoverage = new Set(records.map((item) => item.artifactClass)).size === artifactClosureClasses.length;
  const applicable = records.filter((item) => !["not_applicable", "deferred_by_trigger"].includes(item.applicability));
  const openBlockers = records.filter((item) => item.applicability === "missing" || Boolean(item.blocker)).length;
  const gateable = completeCoverage && openBlockers === 0 && applicable.length > 0;
  const atLeast = (state: ArtifactClosureMaturity) => gateable && applicable.every((item) => rank(item.maturity) >= artifactClosureMaturityRank[state]);
  return {
    completeCoverage,
    applicableArtifacts: applicable.length,
    openBlockers,
    artifactComplete: atLeast("artifact_complete"),
    implemented: atLeast("implemented"),
    preLiveQualified: atLeast("pre_live_qualified"),
    fieldQualified: atLeast("field_qualified"),
    nativeQualified: atLeast("native_qualified"),
  };
}

export type ArtifactClosureGroupProjection = {
  moduleId: number;
  rowCount: number;
  openBlockers: number;
  artifactComplete: boolean;
  implemented: boolean;
  preLiveQualified: boolean;
  fieldQualified: boolean;
  nativeQualified: boolean;
};

export function closureModuleState(groups: ArtifactClosureGroupProjection[], moduleId: number) {
  const moduleGroups = groups.filter((group) => group.moduleId === moduleId);
  const all = (key: keyof Pick<ArtifactClosureGroupProjection, "artifactComplete" | "implemented" | "preLiveQualified" | "fieldQualified" | "nativeQualified">) =>
    moduleGroups.length > 0 && moduleGroups.every((group) => group[key]);
  const state = all("nativeQualified") ? "native_qualified"
    : all("fieldQualified") ? "field_qualified"
      : all("preLiveQualified") ? "pre_live_qualified"
        : all("implemented") ? "implemented"
          : all("artifactComplete") ? "artifact_complete"
            : moduleGroups.length ? "closure_in_progress" : "closure_not_initialized";
  return {
    state,
    capabilityGroups: moduleGroups.length,
    rows: moduleGroups.reduce((sum, group) => sum + group.rowCount, 0),
    blockers: moduleGroups.reduce((sum, group) => sum + group.openBlockers, 0),
  };
}
