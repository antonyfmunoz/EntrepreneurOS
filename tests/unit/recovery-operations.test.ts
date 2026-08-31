import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  engagementProgress,
  nextRecoveryEngagementState,
  recoveryCampaignUpsertSchema,
  recoveryEngagementCreateSchema,
  recoveryEngagementEvidenceSchema,
  recoveryOpportunityTransitionSchema,
  recoveryOpportunityTransitionAllowed,
  recoveryAttributionAllowed,
  recoveryPoolUpdateSchema,
} from "../../shared/recovery-operations";

const id = "00000000-0000-4000-8000-000000000001";

describe("live Recovery operations", () => {
  it("keeps Client Zero separate from paid-client commercial handoffs", () => {
    const base = {
      title: "Empyrean Recovery Client Zero",
      ownerSeatId: id,
      objective: "Prove the Recovery operating loop on lawful first-party Empyrean records.",
      eligiblePoolKeys: ["missed_calls"],
      sourceBoundary: "Only real first-party Empyrean prospects with a documented lawful source.",
      consentPolicy: "A human verifies rights, suppression, channel consent, and approved copy before communication.",
      clientSideOwner: "Empyrean operator",
      nextAction: "Approve the source boundary.",
      classification: "confidential",
    };
    expect(recoveryEngagementCreateSchema.safeParse({ ...base, mode: "client_zero" }).success).toBe(true);
    expect(recoveryEngagementCreateSchema.safeParse({ ...base, mode: "client_zero", call2PacketId: id }).success).toBe(false);
    expect(recoveryEngagementCreateSchema.safeParse({ ...base, mode: "paid_client" }).success).toBe(false);
    expect(recoveryEngagementCreateSchema.safeParse({ ...base, mode: "paid_client", call2PacketId: id }).success).toBe(true);
  });

  it("enforces the canonical lifecycle and restores only the prior safe state", () => {
    expect(nextRecoveryEngagementState({ state: "draft", action: "approve_scope" })).toEqual({ state: "intake", returnState: null });
    expect(() => nextRecoveryEngagementState({ state: "draft", action: "complete_audit" })).toThrow(/not allowed/);
    expect(nextRecoveryEngagementState({ state: "operating", action: "report_failure" })).toEqual({ state: "recovery_required", returnState: "operating" });
    expect(nextRecoveryEngagementState({ state: "recovery_required", action: "restore_safe_state", returnState: "operating" })).toEqual({ state: "operating", returnState: null });
    expect(() => nextRecoveryEngagementState({ state: "recovery_required", action: "restore_safe_state" })).toThrow(/prior safe state/);
    expect(engagementProgress("draft")).toBe(0);
    expect(engagementProgress("closed")).toBe(100);
  });

  it("reconciles pool counts before a pool can support launch", () => {
    const base = { expectedVersion: 1, state: "qualified", sourceSystemReference: "ghl-list-2026-08-30", rawCount: 10, eligibleCount: 6, excludedCount: 4, activationReadyCount: 5, exclusionSummary: "Four records lacked current channel consent.", qualificationNote: "The accountable operator reconciled all observed records and suppression state.", evidenceIds: [id] };
    expect(recoveryPoolUpdateSchema.safeParse(base).success).toBe(true);
    expect(recoveryPoolUpdateSchema.safeParse({ ...base, excludedCount: 5 }).success).toBe(false);
    expect(recoveryPoolUpdateSchema.safeParse({ ...base, activationReadyCount: 7 }).success).toBe(false);
  });

  it("rejects credential material in live operating forms", () => {
    const evidence = { evidenceType: "provider_receipt", title: "GHL delivery receipt", sourceSystem: "GoHighLevel", sourceReference: "receipt-123", supportedClaimSummary: "The named provider receipt supports one bounded delivery attempt.", verifierMethod: "Compared the receipt identifier and timestamp to the exact provider account.", consentRights: "Internal delivery evidence under the approved client instruction.", dataClassification: "confidential" };
    expect(recoveryEngagementEvidenceSchema.safeParse(evidence).success).toBe(true);
    expect(recoveryEngagementEvidenceSchema.safeParse({ ...evidence, sourceReference: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456" }).success).toBe(false);
    const campaign = { poolKey: "missed_calls", name: "Missed-call recovery", channel: "manual", messageVersionReference: "copy-v1", consentBasis: "Documented first-party follow-up rights verified before the bounded launch.", quietHours: "No sends after 7 PM", cadence: "One initial attempt and one approved follow-up, with stop rules evaluated before each step.", stopConditions: "Stop on response, opt-out, booking, wrong party, dispute, payment, or containment.", optOutHandling: "Suppress immediately and retain the immutable opt-out receipt.", routingOwnerSeatId: id, escalationOwnerSeatId: id };
    expect(recoveryCampaignUpsertSchema.safeParse(campaign).success).toBe(true);
    expect(recoveryCampaignUpsertSchema.safeParse({ ...campaign, consentBasis: "client_secret=abcdefghijklmnopqrstuvwxyz012345" }).success).toBe(false);
  });

  it("does not permit direct attribution before a booked or won outcome", () => {
    const transition = { expectedVersion: 1, state: "qualified", actualValueMinor: 0, attributionModel: "unattributed", nextAction: "Route the verified opportunity.", note: "The record met the documented qualification rule with Evidence.", evidenceIds: [id] };
    expect(recoveryOpportunityTransitionSchema.safeParse(transition).success).toBe(true);
    expect(recoveryOpportunityTransitionAllowed("identified", "qualified")).toBe(false);
    expect(recoveryOpportunityTransitionAllowed("contacted", "qualified")).toBe(true);
    expect(recoveryAttributionAllowed("qualified", "direct")).toBe(false);
    expect(recoveryAttributionAllowed("booked", "direct")).toBe(true);
  });

  it("persists an append-only, non-deletable live operating record", () => {
    const migration = readFileSync(new URL("../../migrations/0112_add_live_recovery_operations.sql", import.meta.url), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_engagements");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_delivery_pools");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_campaign_controls");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_recovery_opportunities");
    expect(migration).toContain("EOS Recovery engagement events are append-only");
    expect(migration).toContain("EOS Recovery engagement records cannot be deleted");
    expect(migration).toContain("external_effects_executed = false");
    expect(migration).not.toMatch(/access_token|refresh_token|client_secret|private_key/i);
  });
});
