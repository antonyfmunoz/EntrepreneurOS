import { z } from "zod";
import {
  artifactClosureClasses,
  artifactClosureMaturityRank,
  type ArtifactClosureClass,
  type ArtifactClosureMaturity,
} from "./artifact-closure";

export const nativeHandoffSections = [
  "canonical_model",
  "template_overlay_stack",
  "role_seat_position_contract",
  "lifecycle_and_state",
  "sop_and_workflow",
  "work_packets_and_events",
  "metrics_thresholds_and_alerts",
  "interactive_operating_instrument",
  "forms_documents_and_messages",
  "providers_and_source_authority",
  "telemetry_and_observability",
  "evidence_and_provenance",
  "human_agent_operating_split",
  "cadences_and_governance",
  "security_privacy_and_disclosure",
  "failure_recovery_and_rollback",
  "migration_version_and_compatibility",
  "acceptance_fixtures_and_parity",
  "instance_values_and_owners",
  "learning_and_promotion",
] as const;

export type NativeHandoffSectionKey = (typeof nativeHandoffSections)[number];

export const nativeHandoffSectionRequirements: Record<
  NativeHandoffSectionKey,
  readonly ArtifactClosureClass[]
> = {
  canonical_model: ["capability_definition"],
  template_overlay_stack: ["template_ancestry_overlays"],
  role_seat_position_contract: ["role_seat", "position_agreement"],
  lifecycle_and_state: ["workflow_state_machine"],
  sop_and_workflow: ["sops", "workflow_state_machine"],
  work_packets_and_events: ["work_packet_templates", "events_telemetry"],
  metrics_thresholds_and_alerts: ["kpis_scorecard_thresholds"],
  interactive_operating_instrument: ["interactive_instrument_read_model"],
  forms_documents_and_messages: ["forms_intake_checklists", "scripts_messages_documents"],
  providers_and_source_authority: ["tools_integrations_provider_bindings"],
  telemetry_and_observability: ["events_telemetry"],
  evidence_and_provenance: ["evidence_provenance_requirements"],
  human_agent_operating_split: ["role_agent_specialists", "training_onboarding_development"],
  cadences_and_governance: ["meetings_cadences", "authority_permission_disclosure"],
  security_privacy_and_disclosure: ["authority_permission_disclosure"],
  failure_recovery_and_rollback: ["exception_escalation_rollback"],
  migration_version_and_compatibility: ["template_learning_versioning"],
  acceptance_fixtures_and_parity: ["acceptance_tests_rehearsal_fixtures"],
  instance_values_and_owners: ["instance_values_owners_live_configuration"],
  learning_and_promotion: ["template_learning_versioning", "evidence_provenance_requirements"],
};

const handoffMaturitySchema = z.enum([
  "doctrine",
  "mapped",
  "artifact_complete",
  "implemented",
  "pre_live_qualified",
  "field_qualified",
  "native_qualified",
]);

export const nativeHandoffGapSchema = z.object({
  severity: z.enum(["P0", "P1", "P2"]),
  code: z.string().trim().min(3).max(160),
  section: z.enum(nativeHandoffSections),
  message: z.string().trim().min(3).max(1000),
  artifactClasses: z.array(z.enum(artifactClosureClasses)).max(22),
  blocker: z.string().max(2000).default(""),
});

export const nativeHandoffSectionSchema = z.object({
  key: z.enum(nativeHandoffSections),
  requiredArtifactClasses: z.array(z.enum(artifactClosureClasses)).min(1).max(22),
  maturity: handoffMaturitySchema,
  coverage: z.enum(["missing", "partial", "complete", "deferred"]),
  evidenceIds: z.array(z.string()).max(500),
  recordIds: z.array(z.string()).max(500),
  blockers: z.array(z.string()).max(100),
});

export const nativeHandoffManifestSchema = z.object({
  schemaVersion: z.literal("eos.native-handoff.v1"),
  companyId: z.number().int().positive(),
  portfolioId: z.number().int().positive().nullable(),
  organizationKey: z.string().trim().min(2).max(160),
  capabilityKey: z.string().trim().min(2).max(160),
  capabilityInstanceId: z.string().trim().min(1).max(200),
  capabilityName: z.string().trim().min(2).max(240),
  moduleIds: z.array(z.number().int().min(1).max(14)).max(14),
  ownerSeatId: z.string().trim().min(1).max(200),
  sourceAuthority: z.string().trim().min(2).max(500),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  capabilityState: z.string().trim().min(2).max(80),
  sections: z.array(nativeHandoffSectionSchema).length(nativeHandoffSections.length),
  gaps: z.array(nativeHandoffGapSchema).max(500),
  readiness: z.enum([
    "not_initialized",
    "semantic_incomplete",
    "semantic_ready",
    "implementation_ready",
    "pre_live_qualified",
    "field_qualified",
    "native_qualified",
  ]),
  minimumMaturity: handoffMaturitySchema,
  sourceVersions: z.array(z.string().trim().min(1).max(240)).max(100),
  generatedAt: z.string().datetime(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export type NativeHandoffManifest = z.infer<typeof nativeHandoffManifestSchema>;

type ClosureRecord = {
  id: string;
  artifactClass: string;
  applicability: string;
  maturity: string;
  blocker: string;
  evidenceIds?: unknown;
  templateStack?: unknown;
};

type Capability = {
  id: string;
  companyId: number;
  portfolioId: number | null;
  capabilityInstanceKey: string;
  name: string;
  moduleIds: unknown;
  accountableSeatId: string;
  sourceAuthority: string;
  classification: string;
  state: string;
  schemaVersion: string;
};

function maturityOf(records: ClosureRecord[]): ArtifactClosureMaturity {
  if (!records.length) return "doctrine";
  return records.reduce<ArtifactClosureMaturity>((minimum, record) => {
    const candidate = artifactClosureMaturityRank[record.maturity as ArtifactClosureMaturity] === undefined
      ? "doctrine"
      : record.maturity as ArtifactClosureMaturity;
    return artifactClosureMaturityRank[candidate] < artifactClosureMaturityRank[minimum]
      ? candidate
      : minimum;
  }, "native_qualified");
}

function readinessFrom(maturity: ArtifactClosureMaturity, complete: boolean) {
  if (!complete) return "semantic_incomplete" as const;
  if (maturity === "native_qualified") return "native_qualified" as const;
  if (maturity === "field_qualified") return "field_qualified" as const;
  if (maturity === "pre_live_qualified") return "pre_live_qualified" as const;
  if (maturity === "implemented") return "implementation_ready" as const;
  if (maturity === "artifact_complete") return "semantic_ready" as const;
  return "semantic_incomplete" as const;
}

export function buildNativeHandoffManifest(input: {
  capability: Capability;
  organizationKey: string;
  records: ClosureRecord[];
  generatedAt?: string;
}): Omit<NativeHandoffManifest, "contentSha256"> {
  const activeRecords = input.records.filter((record) => record.applicability !== "not_applicable");
  const sections = nativeHandoffSections.map((key) => {
    const requiredArtifactClasses = [...nativeHandoffSectionRequirements[key]];
    const records = activeRecords.filter((record) => requiredArtifactClasses.includes(record.artifactClass as ArtifactClosureClass));
    const represented = new Set(records.map((record) => record.artifactClass));
    const blockers = records.map((record) => record.blocker).filter(Boolean);
    const deferred = records.length > 0 && records.every((record) => record.applicability === "deferred_by_trigger");
    const coverage = deferred ? "deferred" as const
      : represented.size === 0 ? "missing" as const
        : represented.size < requiredArtifactClasses.length ? "partial" as const
          : "complete" as const;
    return {
      key,
      requiredArtifactClasses,
      maturity: maturityOf(records),
      coverage,
      evidenceIds: Array.from(new Set(records.flatMap((record) => Array.isArray(record.evidenceIds) ? record.evidenceIds.map(String) : []))),
      recordIds: records.map((record) => record.id),
      blockers,
    };
  });
  const gaps = sections.flatMap((section) => {
    if (section.coverage === "complete" && !section.blockers.length && artifactClosureMaturityRank[section.maturity] >= artifactClosureMaturityRank.artifact_complete)
      return [];
    const severity = ["canonical_model", "role_seat_position_contract", "lifecycle_and_state", "security_privacy_and_disclosure", "failure_recovery_and_rollback"]
      .includes(section.key) ? "P0" as const
      : ["providers_and_source_authority", "evidence_and_provenance", "acceptance_fixtures_and_parity", "instance_values_and_owners"]
        .includes(section.key) ? "P1" as const : "P2" as const;
    return [{
      severity,
      code: section.coverage === "complete" ? "handoff_section_not_qualified" : "handoff_section_incomplete",
      section: section.key,
      message: section.coverage === "complete"
        ? `${section.key} has not reached artifact-complete maturity.`
        : `${section.key} does not have complete attributable artifact coverage.`,
      artifactClasses: section.requiredArtifactClasses,
      blocker: section.blockers.join(" | "),
    }];
  });
  const minimumMaturity = sections.reduce<ArtifactClosureMaturity>((minimum, section) =>
    artifactClosureMaturityRank[section.maturity] < artifactClosureMaturityRank[minimum] ? section.maturity : minimum,
  "native_qualified");
  const complete = sections.every((section) => section.coverage === "complete" && !section.blockers.length);
  return nativeHandoffManifestSchema.omit({ contentSha256: true }).parse({
    schemaVersion: "eos.native-handoff.v1",
    companyId: input.capability.companyId,
    portfolioId: input.capability.portfolioId,
    organizationKey: input.organizationKey,
    capabilityKey: input.capability.capabilityInstanceKey,
    capabilityInstanceId: input.capability.id,
    capabilityName: input.capability.name,
    moduleIds: Array.isArray(input.capability.moduleIds) ? input.capability.moduleIds.map(Number) : [],
    ownerSeatId: input.capability.accountableSeatId,
    sourceAuthority: input.capability.sourceAuthority,
    classification: input.capability.classification,
    capabilityState: input.capability.state,
    sections,
    gaps,
    readiness: input.records.length ? readinessFrom(minimumMaturity, complete) : "not_initialized",
    minimumMaturity,
    sourceVersions: Array.from(new Set([
      input.capability.schemaVersion,
      ...input.records.flatMap((record) => Array.isArray(record.templateStack) ? record.templateStack.map(String) : []),
    ])).sort(),
    generatedAt: input.generatedAt || new Date().toISOString(),
  });
}
