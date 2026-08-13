import { describe, expect, it } from "vitest";
import { serviceOwnershipIssues } from "../../server/operations/ownership";

describe("service ownership evidence", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const valid = {
    ownerUserId: "primary-owner",
    backupOwnerReference: "backup-owner",
    onCallReference: "https://operations.example.com/on-call",
    escalationReference: "https://operations.example.com/escalation",
    incidentRunbookUri: "https://operations.example.com/runbooks/entrepreneuros",
    accessReviewEvidenceUri: "https://evidence.example.com/access-review",
    accessReviewedAt: new Date("2026-08-12T12:00:00Z"),
    nextAccessReviewAt: new Date("2026-09-12T12:00:00Z"),
  };

  it("requires a distinct backup owner and current bounded access review", () => {
    expect(serviceOwnershipIssues(valid, now)).toEqual([]);
    expect(serviceOwnershipIssues({ ...valid, backupOwnerReference: "primary-owner", accessReviewedAt: new Date("2026-01-01T00:00:00Z"), nextAccessReviewAt: new Date("2027-01-01T00:00:00Z") }, now)).toEqual([
      "distinct_backup_service_owner",
      "current_access_review",
      "bounded_next_access_review",
    ]);
  });

  it("requires HTTPS operational routes and evidence", () => {
    expect(serviceOwnershipIssues({ ...valid, onCallReference: "http://example.com", escalationReference: null, incidentRunbookUri: "not-a-url", accessReviewEvidenceUri: "https://example.com/review?token=secret" }, now)).toEqual([
      "https_on_call_route",
      "https_escalation_route",
      "https_incident_runbook",
      "access_review_evidence",
    ]);
  });
});
