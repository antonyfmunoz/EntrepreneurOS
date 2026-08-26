import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalMigrationContents,
  compatibleMigrationChecksums,
  migrationChecksum,
} from "../../scripts/migration-checksum";

describe("migration checksum", () => {
  it("is stable across LF and CRLF checkouts", () => {
    const lf =
      "CREATE TABLE example (id text);\nALTER TABLE example ADD COLUMN active boolean;\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    const compatible = compatibleMigrationChecksums(lf);
    expect(canonicalMigrationContents(crlf)).toBe(lf);
    expect(migrationChecksum(crlf)).toBe(migrationChecksum(lf));
    expect(compatibleMigrationChecksums(crlf)).toContain(migrationChecksum(lf));
    expect(compatible.size).toBe(2);
    expect(compatible).toContain(
      createHash("sha256").update(crlf).digest("hex"),
    );
    expect([...compatible]).toEqual([...compatibleMigrationChecksums(crlf)]);
  });

  it("still detects substantive migration changes", () => {
    expect(migrationChecksum("SELECT 1;\n")).not.toBe(
      migrationChecksum("SELECT 2;\n"),
    );
  });

  it("keeps command-state migrations compatible with a Drizzle-created baseline", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0031_add_command_state_registries.sql"),
      "utf8",
    );

    expect(migration.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(3);
    expect(migration.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g)).toHaveLength(9);
  });

  it("replaces candidate constraints that may already exist in a Drizzle-created baseline", () => {
    const migrations = [
      "0041_add_candidate_file_evidence.sql",
      "0042_add_candidate_voice_evidence.sql",
      "0043_add_adaptive_candidate_questions.sql",
    ].map((file) => readFileSync(resolve(process.cwd(), "migrations", file), "utf8"));

    for (const migration of migrations) {
      const additions = [...migration.matchAll(/ADD CONSTRAINT ([a-z0-9_]+)/g)].map((match) => match[1]);
      const removals = new Set([...migration.matchAll(/DROP CONSTRAINT IF EXISTS ([a-z0-9_]+)/g)].map((match) => match[1]));
      for (const constraint of additions) expect(removals.has(constraint)).toBe(true);
    }
  });

  it("makes the native policy-decision ledger immutable at the database boundary", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0028_add_policy_decision_point.sql"),
      "utf8",
    );
    expect(migration).toContain(
      "BEFORE UPDATE OR DELETE ON eos_policy_decisions",
    );
    expect(migration).toContain("EOS policy decision history is immutable");
  });

  it("registers stable authority subjects without silently granting them authority", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0029_add_authority_subject_registry.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_authority_subjects",
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS grantee_subject_id");
    expect(migration).toContain("'agent:' || s.id || ':primary'");
    expect(migration).toContain(
      "'permittedTools', COALESCE(s.tool_entitlements",
    );
    expect(migration).toContain("agent grants remain separate");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+eos_authority_grants/i);
  });

  it("adds purpose-bound field minimization only to baseline read policy", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0030_add_field_minimization_policy.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("fieldTransformRules");
    expect(migration).toContain("administer_organization_registry");
    expect(migration).toContain("credentialReference");
    expect(migration).toContain("schema_version = 'authority-grant-v1.2'");
    expect(migration).not.toMatch(/UPDATE\s+eos_authority_subjects/i);
  });

  it("adds the stakeholder commercial graph and protects provider projections", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0032_add_stakeholder_commercial_registries.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_stakeholders");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_stakeholder_relationships",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_offer_programs",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_commercial_cases",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_value_flows");
    expect(migration).toContain(
      "External-authoritative commercial projections are immutable",
    );
  });

  it("adds the canonical Operations graph without duplicating Work or Evidence", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0033_add_operations_instrument.sql"),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_capability_instances",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_process_definitions",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_resources_assets",
    );
    expect(migration).toContain(
      "ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS process_definition_id",
    );
    expect(migration).toContain(
      "ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS verification_state",
    );
    expect(migration).toContain(
      "External-authoritative Operations projections are immutable",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_operations_work_packets",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_operations_evidence",
    );
  });

  it("adds finance planning and allocation without duplicating ledger, obligation, metric, or evidence truth", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0034_add_finance_capital_instrument.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_financial_sources",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_financial_plans",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_capital_allocations",
    );
    expect(migration).toContain(
      "External-authoritative Finance projections are immutable",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_financial_transactions",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_financial_obligations",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_financial_metrics",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_financial_evidence",
    );
  });

  it("adds the governed Systems and Integrations graph without storing provider credentials or duplicating incidents", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0035_add_systems_integrations_instrument.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_systems");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_integration_bindings",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_tool_entitlements",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_automations");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_integration_health_observations",
    );
    expect(migration).toContain("Integration health history is append-only");
    expect(migration).toContain(
      "External-authoritative Systems projections are immutable",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_system_credentials",
    );
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_integration_incidents",
    );
  });

  it("keeps Workforce control on the canonical seat graph and rejects surveillance substitutes", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0036_add_workforce_control_instrument.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_workforce_reviews",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_development_plans",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_succession_hypotheses",
    );
    expect(migration).toContain(
      "External-authoritative Workforce projections are immutable",
    );
    expect(migration).toContain(
      "subject_seat_id text NOT NULL REFERENCES eos_seats",
    );
    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS eos_people");
    expect(migration).not.toMatch(/mouse|keystroke|webcam|private_life/i);
  });

  it("adds a gap-to-placement recruiting spine without duplicating canonical people or granting authority", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0037_add_talent_recruiting_instrument.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_talent_needs");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_talent_applications",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_talent_assessments",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_talent_placements",
    );
    expect(migration).toContain(
      "candidate_stakeholder_id text NOT NULL REFERENCES eos_stakeholders",
    );
    expect(migration).toContain(
      "assignment_id text REFERENCES eos_assignments",
    );
    expect(migration).toContain(
      "External-authoritative Talent projections are immutable",
    );
    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS eos_people");
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_authority_grants",
    );
    expect(migration).not.toMatch(
      /protected_characteristic|automatic_rejection|hidden_score/i,
    );
  });

  it("adds quarantined candidate file metadata without storing binary content in relational records", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0041_add_candidate_file_evidence.sql"),
      "utf8",
    );
    expect(migration).toContain("file_size_bytes BETWEEN 1 AND 10485760");
    expect(migration).toContain("content_sha256");
    expect(migration).toContain("scan_state");
    expect(migration).toContain("storage_key");
    expect(migration).not.toMatch(/bytea|large object/i);
  });

  it("adds consent-gated voice transcript state without embedding audio in relational records", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0042_add_candidate_voice_evidence.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("voice_response_file");
    expect(migration).toContain("transcription_requested");
    expect(migration).toContain("voice_processing_consented");
    expect(migration).not.toMatch(/bytea|large object/i);
  });

  it("adds bounded adaptive candidate questions without creating an automated decision path", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0043_add_adaptive_candidate_questions.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("generation_mode");
    expect(migration).toContain("generated_sequence BETWEEN 1 AND 5");
    expect(migration).toContain("eos_talent_assessments_adaptive_open_idx");
    expect(migration).toContain("adaptive_questioning_consented");
    expect(migration).toContain("adaptive_question_generated");
    expect(migration).toContain("adaptive_question_answered");
    expect(migration).toContain("adaptive_questioning_withdrawn");
    expect(migration).not.toMatch(
      /automatic[_ ]?(reject|hire|decision)|authority[_ ]?grant/i,
    );
  });

  it("adds versioned internal human review packets without changing application state or authority", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0044_add_talent_human_review_packets.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_talent_review_packets",
    );
    expect(migration).toContain("role_hypotheses_snapshot");
    expect(migration).toContain("required_outcomes_snapshot");
    expect(migration).toContain("verified_evidence_ids");
    expect(migration).toContain("materialized_assessment_id");
    expect(migration).toContain("eos_talent_review_packets_open_idx");
    expect(migration).toContain("eos_protect_external_talent_projection");
    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS eos_people");
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_authority_grants",
    );
    expect(migration).not.toMatch(
      /UPDATE\s+eos_talent_applications|automatic[_ ]?(reject|hire|decision)/i,
    );
  });

  it("adds governed paid trials without creating payment, placement, access, or authority", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0045_add_governed_talent_trials.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_talent_trials",
    );
    expect(migration).toContain("compensation_amount_minor");
    expect(migration).toContain("constraints_decision_rights");
    expect(migration).toContain("scorecard_observations");
    expect(migration).toContain("learning_proposal");
    expect(migration).toContain("eos_talent_trials_open_idx");
    expect(migration).toContain("trial_accepted");
    expect(migration).toContain("trial_submitted");
    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS eos_people");
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS eos_authority_grants",
    );
    expect(migration).not.toMatch(
      /UPDATE\s+eos_talent_applications|INSERT\s+INTO\s+eos_talent_placements|payment[_ ]?executed/i,
    );
  });

  it("adds candidate-to-canonical Evidence lineage with withdrawal invalidation state", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0046_promote_candidate_evidence.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("promoted_evidence_id");
    expect(migration).toContain("promoted_by_user_id");
    expect(migration).toContain("withdrawn_at");
    expect(migration).toContain(
      "eos_talent_candidate_evidence_promoted_evidence_idx",
    );
    expect(migration).toContain("talent-candidate-evidence-v1.3");
    expect(migration).not.toMatch(
      /INSERT\s+INTO\s+eos_talent_placements|INSERT\s+INTO\s+eos_authority_grants|payment[_ ]?executed/i,
    );
  });

  it("binds verified onboarding invitations to canonical talent continuity without automatic activation", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0047_bind_talent_onboarding_identity.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("talent_application_id");
    expect(migration).toContain(
      "eos_membership_invitations_one_pending_talent_application_idx",
    );
    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).not.toMatch(
      /UPDATE\s+eos_talent_placements\s+SET\s+state|INSERT\s+INTO\s+eos_authority_grants/i,
    );
  });

  it("adds append-only attributable workforce review dialogue", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0048_add_append_only_workforce_review_dialogue.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("eos_workforce_review_dialogue");
    expect(migration).toContain("correction_request");
    expect(migration).toContain("correction_resolution");
    expect(migration).toContain(
      "eos_workforce_review_dialogue_review_sequence_idx",
    );
    expect(migration).toContain("BEFORE UPDATE OR DELETE");
    expect(migration).not.toMatch(
      /UPDATE\s+eos_workforce_reviews\s+SET\s+(outcome_summary|performance_attribution|evidence_ids)/i,
    );
  });

  it("adds governed role support modes without mutating assignment or authority", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0049_add_role_support_plans.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_role_support_plans");
    expect(migration).toContain("'assist', 'teach', 'guard', 'transfer'");
    expect(migration).toContain("proof_requirements");
    expect(migration).toContain("transfer_target");
    expect(migration).toContain("it never mutates assignment or authority state");
    expect(migration).not.toMatch(
      /INSERT\s+INTO\s+eos_(assignments|authority_grants)|UPDATE\s+eos_(assignments|authority_grants)/i,
    );
  });

  it("adds career path hypotheses without silently promoting or changing economics", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0050_add_career_path_hypotheses.sql"),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS eos_career_path_hypotheses",
    );
    expect(migration).toContain("transition_criteria");
    expect(migration).toContain("proof_requirements");
    expect(migration).toContain("seat_availability");
    expect(migration).toContain(
      "never inserts or updates a seat, assignment, Authority Grant, compensation, or employment decision",
    );
    expect(migration).not.toMatch(
      /INSERT\s+INTO\s+eos_(seats|assignments|authority_grants)|UPDATE\s+eos_(seats|assignments|authority_grants)/i,
    );
    expect(migration).not.toMatch(/UPDATE\s+(users|companies)\s+SET/i);
  });

  it("adds append-only dual-company shared-service coordination without authority edges", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0053_add_shared_service_engagements.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_shared_service_engagements");
    expect(migration).toContain("beneficiary_company_id");
    expect(migration).toContain("provider_company_id");
    expect(migration).toContain("beneficiary_work_packet_id");
    expect(migration).toContain("provider_work_packet_id");
    expect(migration).toContain("external_effects_executed = false");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_shared_service_events");
    expect(migration).toContain("BEFORE UPDATE OR DELETE");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+eos_(seats|assignments|authority_grants)/i);
  });

  it("adds fail-closed Recovery agreement and billing controls without provider execution", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0059_add_recovery_commercial_activation.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_agreement_authorities");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_agreement_instances");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_billing_manifests");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_activation_events");
    expect(migration).toContain("recovery activation events are append-only");
    expect(migration).toContain("external_effects_executed = false");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+eos_provider_executions/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+eos_value_flows/i);
  });

  it("adds immutable signature-verified Recovery provider receipts without provider execution", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0060_add_recovery_provider_receipts.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_provider_receipts");
    expect(migration).toContain("signature_state = 'verified'");
    expect(migration).toContain("recovery provider receipts are append-only");
    expect(migration).toContain("setup_payment_state");
    expect(migration).toContain("subscription_state");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+eos_provider_executions/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+eos_value_flows/i);
  });

  it("keeps every emitted native signing event valid while adding recipient correction", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0065_add_native_esign_recipient_correction.sql"),
      "utf8",
    );
    for (const eventType of [
      "envelope_revised",
      "recipient_corrected",
      "delivery_prepared",
      "delivery_succeeded",
      "recovery_attempt_failed",
    ]) expect(migration).toContain(`'${eventType}'`);
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check");
    expect(migration).toContain("ADD CONSTRAINT eos_esign_events_event_type_check");
  });

  it("adds OTP assurance and durable native-signing delivery operations with immutable attempts", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0066_add_native_esign_enterprise_operations.sql"),
      "utf8",
    );
    expect(migration).toContain("assurance_mode IN ('link','email_otp')");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_webhook_subscriptions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_webhook_deliveries");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_webhook_attempts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_completion_deliveries");
    expect(migration).toContain("Native e-sign delivery attempt history is immutable");
    expect(migration).toContain("'identity_verified'");
    expect(migration).toContain("'completion_delivery_succeeded'");
    expect(migration).not.toMatch(/otp_code|signing_secret text|completion_token text/i);
  });

  it("records immutable native-signing storage recovery receipts without customer artifacts", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0070_add_native_esign_storage_drills.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_storage_drills");
    expect(migration).toContain("eos_esign_storage_drill_running_idx");
    expect(migration).toContain("Native e-sign storage drill receipt is immutable");
    expect(migration).toContain("Native e-sign storage drill history is immutable");
    expect(migration).not.toMatch(/storage_key|payload|bucket_name|secret|credential/i);
  });

  it("adds append-only, authority-bound contract obligation review receipts", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0077_add_native_contract_obligation_reviews.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_obligation_reviews");
    expect(migration).toContain("policy_decision_id text NOT NULL REFERENCES eos_policy_decisions");
    expect(migration).toContain("EOS native contract obligation reviews are append-only");
    expect(migration).toContain("previous_review_sha256");
    expect(migration).toContain("'obligation_reviewed'");
    expect(migration).not.toMatch(/credential|secret|token_digest|storage_key/i);
  });

  it("adds versioned contract plans and append-only renewal decision receipts", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0078_add_native_contract_control_center.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_contract_plans");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_contract_plan_events");
    expect(migration).toContain("contract_ends_at > effective_at");
    expect(migration).toContain("EOS native contract plan events are append-only");
    expect(migration).toContain("last_policy_decision_id text NOT NULL REFERENCES eos_policy_decisions");
    expect(migration).not.toMatch(/credential|secret|token_digest|storage_key/i);
  });
});
