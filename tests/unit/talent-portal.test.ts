import { describe, expect, it } from "vitest";
import {
  buildTalentPortalProjection,
  candidateNextAction,
  candidateVisibleStatus,
  talentPortalAdaptiveQuestionSchema,
  talentPortalEvidenceSchema,
  talentPortalFileEvidenceQuerySchema,
  talentPortalIntakeSchema,
  talentPortalIssueSchema,
  talentPortalSchedulingResponseSchema,
  talentPortalTokenSchema,
  talentPortalTrialResponseSchema,
  talentPortalTrialSubmissionSchema,
} from "../../shared/talent-portal";
import {
  createTalentPortalSecret,
  talentPortalDigest,
  talentPortalPath,
  talentPortalUrl,
} from "../../server/talent-portal-token";
import {
  providerExecutionCreateSchema,
  talentSchedulingCreateSchema,
} from "../../shared/eos-runtime";

describe("candidate portal boundary", () => {
  it("issues high-entropy links while persisting only a deterministic digest", () => {
    const first = createTalentPortalSecret();
    const second = createTalentPortalSecret();
    expect(first).toHaveLength(43);
    expect(talentPortalTokenSchema.parse(first)).toBe(first);
    expect(second).not.toBe(first);
    expect(talentPortalDigest(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(talentPortalDigest(first)).toBe(talentPortalDigest(first));
    expect(talentPortalPath(first)).toBe(`/talent-portal/${first}`);
    expect(talentPortalUrl(first, "https://entrepreneuros.net/some-path")).toBe(
      `https://entrepreneuros.net/talent-portal/${first}`,
    );
  });

  it("projects the candidate allowlist without internal evaluation, notes, proof gaps, identity, authority, offer, or audit data", () => {
    const projected = buildTalentPortalProjection({
      application: {
        id: "application-secret",
        state: "assessments_incomplete",
        candidateSummary: "Candidate-visible summary",
        candidateData: {
          preferredName: "Alex",
          answers: { motivation: "Build useful systems" },
          internalExtract: "never expose",
        },
        consentState: "limited",
        consentScope: [
          "application",
          "job_relevant_assessment",
          "placement_review",
          "adaptive_questioning",
        ],
        candidateCorrection: "",
        correctionStatus: "none",
        roleHypotheses: ["Operator"],
        proofGaps: ["private gap"],
        internalNotes: "private deliberation",
        portalTokenHash: "secret digest",
        deletionRequestedAt: null,
        retentionUntil: new Date("2027-08-15T00:00:00.000Z"),
      },
      company: { name: "Example Company" },
      candidate: { name: "Alexander" },
      need: {
        title: "Operations",
        requiredOutcomes: ["Reliable weekly delivery"],
      },
      assessments: [
        {
          id: "assessment-1",
          title: "Work sample",
          state: "candidate_action",
          assessmentType: "work_sample",
          decisionQuestion: "Can the candidate produce the required output?",
          evidenceExpected: "Bounded sample",
          candidateSubmission: "",
          internalEvaluation: "reject automatically",
          consentRequired: false,
          evidenceIds: ["internal-evidence"],
        },
        {
          id: "assessment-adaptive-1",
          title: "Adaptive follow-up 1",
          state: "submitted",
          assessmentType: "other",
          decisionQuestion: "What result best demonstrates your role fit?",
          evidenceExpected: "A specific result and observable evidence.",
          candidateSubmission: "I reduced cycle time by 20%.",
          consentRequired: false,
          generationMode: "ai",
          generatedSequence: 1,
          generationModel: "private-model-name",
          generationGovernanceVersion: "private-governance-version",
          generationInputSha256: "a".repeat(64),
          generationRationale: "private generation rationale",
          informationGap: "private information gap",
          roleHypothesesSnapshot: ["Operator", "Program manager"],
        },
      ],
      evidence: [
        {
          id: "candidate-evidence-1",
          title: "Portfolio",
          evidenceType: "portfolio_link",
          sourceUrl: "https://example.test/portfolio",
          candidateStatement: "My work",
          state: "promoted",
          promotedEvidenceId: "private-canonical-evidence-id",
          promotedByUserId: "private-reviewer-id",
          createdAt: new Date("2026-08-15T00:00:00.000Z"),
          internalReview: "private",
        },
        {
          id: "candidate-evidence-2",
          title: "Resume",
          evidenceType: "resume_file",
          fileName: "resume.pdf",
          fileMimeType: "application/pdf",
          fileSizeBytes: 1200,
          storageKey: "private/storage/key",
          contentSha256: "private-hash",
          scanState: "clean",
          state: "submitted",
          createdAt: new Date("2026-08-15T02:00:00.000Z"),
        },
        {
          id: "candidate-evidence-3",
          title: "Voice response",
          evidenceType: "voice_response_file",
          fileName: "response.webm",
          fileMimeType: "audio/webm",
          fileSizeBytes: 800,
          storageKey: "private/voice/key",
          contentSha256: "private-voice-hash",
          scanState: "clean",
          transcriptionRequested: true,
          transcriptionState: "completed",
          transcript: "Candidate-visible machine transcript.",
          transcriptionProvider: "private-provider",
          transcriptionModel: "private-model",
          state: "submitted",
        },
      ],
      messages: [
        {
          id: "message-1",
          direction: "team_to_candidate",
          body: "Your next review is ready.",
          createdAt: new Date("2026-08-15T01:00:00.000Z"),
          internalRouting: "private",
        },
      ],
      scheduling: [
        {
          id: "schedule-1",
          schedulingKind: "interview",
          state: "proposed",
          proposedSlots: ["2026-09-01T17:00:00.000Z"],
          durationMinutes: 45,
          schedulingUrl: "https://calendar.example.test/open",
          teamNote: "Choose a time",
          sourceSystem: "native_eos",
          externalEventReference: "private-provider-event",
        },
      ],
      trials: [
        {
          id: "trial-1",
          version: 1,
          state: "offered",
          title: "Paid operating trial",
          question: "Can you run the bounded weekly cadence?",
          durationDays: 5,
          compensationAmountMinor: 125000,
          compensationCurrency: "USD",
          compensationTerms: "Payable under the executed agreement.",
          legalAgreementReference: "trial-agreement-001",
          jurisdiction: "California, United States",
          inputsSupport: ["Operating brief and reviewer"],
          requiredOutputs: ["Decision log"],
          scorecard: [
            {
              dimension: "Decision quality",
              successAnchor: "Makes evidence-bound decisions",
              weight: 100,
              privateScore: 99,
            },
          ],
          constraintsDecisionRights: ["No production access"],
          observationPoints: ["Midpoint and final review"],
          reviewAt: new Date("2026-09-10T17:00:00.000Z"),
          outcomeCriteria: {
            pass: "Meets the scorecard.",
            redirect: "Evidence supports a different seat.",
            extend: "One bounded uncertainty remains.",
            fail: "Required evidence is absent.",
            privateCriterion: "never expose",
          },
          candidateInstructions: "Record each decision in the supplied workspace.",
          predictedOutcome: "private prediction",
          predictedConfidence: "supported",
          reviewPacketId: "private-review-packet",
          workPacketId: "private-work-packet",
          approvalId: "private-approval",
          scorecardObservations: [{ privateObservation: true }],
          outcomeEvidenceIds: ["private-outcome-evidence"],
          learningProposal: "private learning",
        },
      ],
    });
    const serialized = JSON.stringify(projected);
    expect(projected.application.nextAction).toContain("Work sample");
    expect(projected.application.status).toBe("action_required");
    expect(projected.application.actions.canEditIntake).toBe(false);
    expect(projected.assessments[0]).toMatchObject({
      status: "action_required",
      actionRequired: true,
    });
    expect(projected.assessments[1]).toMatchObject({
      adaptive: true,
      generatedSequence: 1,
      roleHypotheses: ["Operator", "Program manager"],
    });
    expect(projected.adaptiveQuestioning).toMatchObject({
      consentActive: true,
      canRequestNext: true,
      generatedCount: 1,
      remaining: 4,
      maximum: 5,
      openQuestion: false,
    });
    expect(projected.candidate.name).toBe("Alex");
    expect(projected.scheduling[0]).toMatchObject({
      status: "proposed",
      canRespond: true,
      durationMinutes: 45,
      calendarConfirmed: false,
    });
    expect(projected.trials[0]).toMatchObject({
      status: "offered",
      title: "Paid operating trial",
      canRespond: true,
      canSubmit: false,
      agreementReference: "trial-agreement-001",
    });
    expect(projected.evidence[1]).toMatchObject({
      fileName: "resume.pdf",
      fileSizeBytes: 1200,
      scanState: "clean",
      fileAvailable: true,
    });
    expect(projected.evidence[0]).toMatchObject({
      status: "submitted",
      canWithdraw: true,
    });
    expect(projected.evidence[2]).toMatchObject({
      transcriptionRequested: true,
      transcriptionState: "completed",
      transcript: "Candidate-visible machine transcript.",
    });
    for (const secret of [
      "assessments_incomplete",
      "candidate_action",
      "internalNotes",
      "private deliberation",
      "proofGaps",
      "private gap",
      "portalTokenHash",
      "secret digest",
      "internalEvaluation",
      "reject automatically",
      "identityReference",
      "offerSummary",
      "authority",
      "audit",
      "internalExtract",
      "never expose",
      "evidenceIds",
      "internalReview",
      "internalRouting",
      "externalEventReference",
      "private-provider-event",
      "private/storage/key",
      "private-hash",
      "private/voice/key",
      "private-voice-hash",
      "private-provider",
      "private-model",
      "private-model-name",
      "private-governance-version",
      "private generation rationale",
      "private information gap",
      "generationModel",
      "generationGovernanceVersion",
      "generationInputSha256",
      "generationRationale",
      "informationGap",
      "storageKey",
      "contentSha256",
      "transcriptionProvider",
      "transcriptionModel",
      "privateScore",
      "privateCriterion",
      "private prediction",
      "private-review-packet",
      "private-work-packet",
      "private-approval",
      "privateObservation",
      "private-outcome-evidence",
      "private learning",
      "private-canonical-evidence-id",
      "private-reviewer-id",
    ])
      expect(serialized).not.toContain(secret);
  });

  it("accepts bounded candidate input and rejects insecure evidence references", () => {
    expect(talentPortalIssueSchema.parse({})).toEqual({
      expiresInDays: 14,
      retentionDays: 365,
    });
    expect(
      talentPortalIntakeSchema.safeParse({
        preferredName: "Alex",
        phone: "",
        location: "",
        availability: "",
        resumeUrl: "https://example.test/resume",
        portfolioUrl: "",
        candidateSummary: "A factual candidate summary.",
        answers: {},
        consentScope: ["application"],
      }).success,
    ).toBe(true);
    expect(
      talentPortalIntakeSchema.safeParse({
        preferredName: "Alex",
        phone: "",
        location: "",
        availability: "",
        resumeUrl: "",
        portfolioUrl: "",
        candidateSummary: "A factual candidate summary.",
        answers: {},
        consentScope: ["application", "adaptive_questioning"],
      }).success,
    ).toBe(false);
    expect(
      talentPortalAdaptiveQuestionSchema.parse({ consented: true }),
    ).toEqual({ consented: true });
    expect(
      talentPortalAdaptiveQuestionSchema.safeParse({ consented: false })
        .success,
    ).toBe(false);
    expect(
      talentPortalEvidenceSchema.safeParse({
        title: "Portfolio",
        evidenceType: "portfolio_link",
        sourceUrl: "http://insecure.example",
        candidateStatement: "",
      }).success,
    ).toBe(false);
    expect(
      talentPortalEvidenceSchema.safeParse({
        title: "Work history",
        evidenceType: "candidate_statement",
        sourceUrl: "",
        candidateStatement: "I led the weekly operating review.",
      }).success,
    ).toBe(true);
    expect(
      talentPortalFileEvidenceQuerySchema.safeParse({
        title: "Resume",
        evidenceType: "resume_file",
        fileName: "resume.pdf",
      }).success,
    ).toBe(true);
    expect(
      talentPortalFileEvidenceQuerySchema.parse({
        title: "Voice response",
        evidenceType: "voice_response_file",
        fileName: "response.webm",
        transcribe: "true",
      }).transcribe,
    ).toBe(true);
    expect(
      talentPortalFileEvidenceQuerySchema.safeParse({
        title: "Payload",
        evidenceType: "other_link",
        fileName: "payload.exe",
      }).success,
    ).toBe(false);
  });

  it("derives candidate next actions without exposing internal proof gaps", () => {
    expect(candidateNextAction("invited", [])).toBe(
      "Start your guided intake.",
    );
    expect(candidateNextAction("internal_review", [])).toBe(
      "Your evidence is in human review.",
    );
    expect(candidateNextAction("decision", [])).toBe(
      "A human decision is in progress.",
    );
    expect(
      candidateNextAction("trial_recommended", [], [{ state: "offered" }]),
    ).toBe("Review and respond to your paid trial offer.");
    expect(
      candidateNextAction("trial_active", [], [{ state: "active" }]),
    ).toBe("Complete your trial and submit evidence by the review date.");
  });

  it("maps internal lifecycle states to the bounded candidate status vocabulary", () => {
    expect(candidateVisibleStatus("intake_started", [])).toBe("started");
    expect(candidateVisibleStatus("internal_review", [])).toBe("under_review");
    expect(candidateVisibleStatus("interview_ready", [])).toBe(
      "interview_requested",
    );
    expect(candidateVisibleStatus("trial_active", [])).toBe("trial_requested");
    expect(candidateVisibleStatus("activated", [])).toBe(
      "final_decision_communicated",
    );
  });

  it("validates scheduling choices and token-free governed invitation requests", () => {
    expect(
      talentSchedulingCreateSchema.safeParse({
        applicationId: "00000000-0000-4000-8000-000000000001",
        proposedSlots: ["2026-09-01T17:00:00.000Z"],
      }).success,
    ).toBe(true);
    expect(
      talentPortalSchedulingResponseSchema.safeParse({
        response: "accept",
        selectedSlot: "2026-09-01T17:00:00.000Z",
        timezone: "America/Los_Angeles",
      }).success,
    ).toBe(true);
    expect(
      talentPortalSchedulingResponseSchema.safeParse({
        response: "request_alternative",
        timezone: "UTC",
        availability: "",
      }).success,
    ).toBe(false);
    expect(
      talentPortalTrialResponseSchema.safeParse({
        response: "accept",
        attested: false,
      }).success,
    ).toBe(false);
    expect(
      talentPortalTrialResponseSchema.safeParse({
        response: "accept",
        attested: true,
        message: "I understand the bounded terms.",
      }).success,
    ).toBe(true);
    expect(
      talentPortalTrialSubmissionSchema.safeParse({
        summary: "Completed the trial and attached the decision log.",
        evidenceIds: ["00000000-0000-4000-8000-000000000001"],
      }).success,
    ).toBe(true);
    const invitation = providerExecutionCreateSchema.parse({
      provider: "gmail",
      operation: "gmail.send_candidate_portal_invitation_with_local_approval",
      applicationId: "00000000-0000-4000-8000-000000000001",
    });
    expect(invitation).toMatchObject({ expiresInDays: 14, retentionDays: 365 });
    expect(JSON.stringify(invitation)).not.toMatch(
      /token|portalUrl|https:\/\//i,
    );
    expect(
      providerExecutionCreateSchema.safeParse({
        provider: "google_workspace",
        operation: "google.calendar.create_candidate_event_with_local_approval",
        schedulingId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
    expect(
      providerExecutionCreateSchema.safeParse({
        provider: "google_workspace",
        operation: "google.calendar.cancel_candidate_event_with_local_approval",
        schedulingId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
  });
});
