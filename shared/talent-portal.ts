import { z } from "zod";

export const TALENT_PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const TALENT_PORTAL_DEFAULT_TTL_DAYS = 14;
export const TALENT_PORTAL_MAX_TTL_DAYS = 30;

export const talentPortalTokenSchema = z
  .string()
  .regex(TALENT_PORTAL_TOKEN_PATTERN, "Invalid candidate portal link");

const boundedText = (max: number) => z.string().trim().max(max);
const optionalHttpsUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .url()
    .max(2_048)
    .refine(
      (value) => value.startsWith("https://"),
      "Only HTTPS links are accepted",
    ),
]);

export const talentPortalIssueSchema = z.object({
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(TALENT_PORTAL_MAX_TTL_DAYS)
    .default(TALENT_PORTAL_DEFAULT_TTL_DAYS),
  retentionDays: z.number().int().min(30).max(1_095).default(365),
});

export const talentPortalIntakeSchema = z.object({
  preferredName: boundedText(120),
  phone: boundedText(80),
  location: boundedText(160),
  availability: boundedText(500),
  resumeUrl: optionalHttpsUrl,
  portfolioUrl: optionalHttpsUrl,
  candidateSummary: boundedText(4_000),
  answers: z
    .record(z.string(), boundedText(2_000))
    .refine(
      (value) => Object.keys(value).length <= 25,
      "Too many intake answers",
    ),
  consentScope: z
    .array(
      z.enum([
        "application",
        "job_relevant_assessment",
        "placement_review",
        "voice_processing",
      ]),
    )
    .max(4),
});

export const talentPortalAssessmentSubmissionSchema = z.object({
  submission: z.string().trim().min(1).max(20_000),
  consentAcknowledged: z.boolean().default(false),
});

export const talentPortalEvidenceSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    evidenceType: z.enum([
      "portfolio_link",
      "resume_link",
      "work_sample_link",
      "reference_link",
      "candidate_statement",
      "other_link",
    ]),
    sourceUrl: optionalHttpsUrl.default(""),
    candidateStatement: boundedText(10_000).default(""),
  })
  .superRefine((value, context) => {
    if (!value.sourceUrl && !value.candidateStatement)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide an HTTPS reference or candidate statement",
      });
  });

export const talentPortalFileEvidenceQuerySchema = z.object({
  title: z.string().trim().min(2).max(200),
  evidenceType: z.enum([
    "portfolio_file",
    "resume_file",
    "work_sample_file",
    "assessment_file",
    "other_file",
    "voice_response_file",
  ]),
  fileName: z.string().trim().min(1).max(240),
  transcribe: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const talentPortalVoiceConsentSchema = z.object({
  consented: z.literal(true),
});

export const talentPortalAdaptiveQuestionSchema = z.object({
  consented: z.literal(true),
});

export const talentPortalCorrectionSchema = z.object({
  correction: z.string().trim().min(3).max(4_000),
});

export const talentPortalMessageSchema = z.object({
  message: z.string().trim().min(2).max(4_000),
});

export const talentPortalWithdrawalSchema = z.object({
  reason: boundedText(2_000).default(""),
});

export const talentPortalSchedulingResponseSchema = z
  .object({
    response: z.enum(["accept", "request_alternative", "decline"]),
    selectedSlot: z.string().datetime().optional(),
    timezone: z.string().trim().min(1).max(120),
    availability: boundedText(2_000).default(""),
    message: boundedText(2_000).default(""),
  })
  .superRefine((value, context) => {
    if (value.response === "accept" && !value.selectedSlot)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose one proposed time",
      });
    if (value.response === "request_alternative" && !value.availability)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Share availability for an alternative",
      });
  });

export const talentPortalTrialResponseSchema = z
  .object({
    response: z.enum(["accept", "decline"]),
    attested: z.boolean().default(false),
    message: boundedText(2_000).default(""),
  })
  .superRefine((value, context) => {
    if (value.response === "accept" && !value.attested)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm that you understand the trial terms",
      });
  });

export const talentPortalTrialSubmissionSchema = z.object({
  summary: z.string().trim().min(3).max(4_000),
  evidenceIds: z.array(z.string().uuid()).min(1).max(20),
});

export type TalentPortalProjectionInput = {
  application: Record<string, unknown>;
  company: { name: string };
  candidate: { name: string };
  need: { title: string; requiredOutcomes?: unknown };
  assessments: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  scheduling?: Array<Record<string, unknown>>;
  trials?: Array<Record<string, unknown>>;
};

export const candidateVisibleStatuses = [
  "invited",
  "started",
  "action_required",
  "submitted",
  "under_review",
  "interview_requested",
  "trial_requested",
  "final_decision_communicated",
] as const;

export type CandidateVisibleStatus = (typeof candidateVisibleStatuses)[number];

export function candidateVisibleStatus(
  state: string,
  assessments: Array<Record<string, unknown>>,
): CandidateVisibleStatus {
  if (state === "invited") return "invited";
  if (state === "intake_started") return "started";
  if (assessments.some((item) => item.state === "candidate_action"))
    return "action_required";
  if (["intake_submitted", "assessments_incomplete"].includes(state))
    return "submitted";
  if (["interview_ready"].includes(state)) return "interview_requested";
  if (["trial_recommended", "trial_active"].includes(state))
    return "trial_requested";
  if (["onboarding", "activated", "rejected", "withdrawn"].includes(state))
    return "final_decision_communicated";
  return "under_review";
}

function candidateAssessmentStatus(
  state: string,
): "upcoming" | "action_required" | "submitted" | "closed" {
  if (state === "candidate_action") return "action_required";
  if (["submitted", "verified", "reviewed"].includes(state)) return "submitted";
  if (["waived", "cancelled"].includes(state)) return "closed";
  return "upcoming";
}

function candidateEvidenceStatus(state: string): "submitted" | "withdrawn" {
  return state === "withdrawn" ? "withdrawn" : "submitted";
}

export function candidateNextAction(
  state: string,
  assessments: Array<Record<string, unknown>>,
  trials: Array<Record<string, unknown>> = [],
): string {
  if (state === "invited") return "Start your guided intake.";
  if (state === "intake_started") return "Complete and submit your intake.";
  const pending = assessments.find((item) => item.state === "candidate_action");
  if (pending)
    return `Complete: ${String(pending.title || "assigned assessment")}.`;
  if (["intake_submitted", "assessments_incomplete"].includes(state))
    return "Your team will assign the smallest useful next assessment.";
  if (["assessments_complete", "internal_review"].includes(state))
    return "Your evidence is in human review.";
  if (state === "interview_ready")
    return "Your team will coordinate the next conversation.";
  if (trials.some((item) => item.state === "offered"))
    return "Review and respond to your paid trial offer.";
  if (trials.some((item) => item.state === "active"))
    return "Complete your trial and submit evidence by the review date.";
  if (trials.some((item) => item.state === "submitted"))
    return "Your trial evidence is awaiting human review.";
  if (["trial_recommended", "trial_active"].includes(state))
    return "Your team is preparing the next trial step.";
  if (state === "decision") return "A human decision is in progress.";
  if (state === "onboarding")
    return "Complete the onboarding steps shared by the team.";
  if (state === "activated") return "Your placement is active.";
  if (state === "hold")
    return "The process is on hold; the team will contact you when it resumes.";
  if (state === "rejected")
    return "This application is closed. You may still request a factual correction.";
  if (state === "withdrawn") return "You withdrew from this process.";
  return "Check back for the next human-reviewed step.";
}

// This is the sole candidate projection builder. Keep the allowlist explicit:
// internal evaluation, internal notes, proof gaps, identity references, offer
// strategy, policy decisions, authority and audit records never cross it.
export function buildTalentPortalProjection(
  input: TalentPortalProjectionInput,
) {
  const application = input.application;
  const state = String(application.state || "invited");
  const candidateData =
    application.candidateData && typeof application.candidateData === "object"
      ? (application.candidateData as Record<string, unknown>)
      : {};
  const assessments = input.assessments.map((assessment) => ({
    id: String(assessment.id || ""),
    title: String(assessment.title || "Assessment"),
    assessmentType: String(assessment.assessmentType || "other"),
    status: candidateAssessmentStatus(String(assessment.state || "planned")),
    actionRequired: assessment.state === "candidate_action",
    decisionQuestion: String(assessment.decisionQuestion || ""),
    evidenceExpected: String(assessment.evidenceExpected || ""),
    validityScope: String(assessment.validityScope || ""),
    candidateBurden: String(assessment.candidateBurden || ""),
    candidateSubmission: String(assessment.candidateSubmission || ""),
    consentRequired: Boolean(assessment.consentRequired),
    consentCaptured: Boolean(assessment.consentCaptured),
    adaptive: String(assessment.generationMode || "manual") !== "manual",
    generatedSequence: Number(assessment.generatedSequence || 0),
    roleHypotheses: Array.isArray(assessment.roleHypothesesSnapshot)
      ? assessment.roleHypothesesSnapshot.map(String)
      : [],
  }));
  const adaptiveAssessments = input.assessments.filter(
    (assessment) => String(assessment.generationMode || "manual") !== "manual",
  );
  const adaptiveOpen = adaptiveAssessments.some((assessment) =>
    ["planned", "candidate_action"].includes(
      String(assessment.state || "planned"),
    ),
  );
  const consentScope = Array.isArray(application.consentScope)
    ? application.consentScope.map(String)
    : [];
  const adaptiveEligible = [
    "intake_submitted",
    "assessments_incomplete",
    "assessments_complete",
    "internal_review",
    "interview_ready",
  ].includes(state);
  const trials = (input.trials || []).map((trial) => ({
    id: String(trial.id || ""),
    version: Number(trial.version || 1),
    status: String(trial.state || "offered"),
    title: String(trial.title || "Paid trial"),
    question: String(trial.question || ""),
    durationDays: Number(trial.durationDays || 0),
    compensationAmountMinor: Number(trial.compensationAmountMinor || 0),
    compensationCurrency: String(trial.compensationCurrency || "USD"),
    compensationTerms: String(trial.compensationTerms || ""),
    agreementReference: String(trial.legalAgreementReference || ""),
    jurisdiction: String(trial.jurisdiction || ""),
    inputsSupport: Array.isArray(trial.inputsSupport)
      ? trial.inputsSupport.map(String)
      : [],
    requiredOutputs: Array.isArray(trial.requiredOutputs)
      ? trial.requiredOutputs.map(String)
      : [],
    scorecard: Array.isArray(trial.scorecard)
      ? trial.scorecard
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            dimension: String(item.dimension || ""),
            successAnchor: String(item.successAnchor || ""),
            weight: Number(item.weight || 1),
          }))
      : [],
    constraints: Array.isArray(trial.constraintsDecisionRights)
      ? trial.constraintsDecisionRights.map(String)
      : [],
    observationPoints: Array.isArray(trial.observationPoints)
      ? trial.observationPoints.map(String)
      : [],
    reviewAt:
      trial.reviewAt instanceof Date
        ? trial.reviewAt.toISOString()
        : trial.reviewAt || null,
    outcomeCriteria:
      trial.outcomeCriteria && typeof trial.outcomeCriteria === "object"
        ? {
            pass: String(
              (trial.outcomeCriteria as Record<string, unknown>).pass || "",
            ),
            redirect: String(
              (trial.outcomeCriteria as Record<string, unknown>).redirect || "",
            ),
            extend: String(
              (trial.outcomeCriteria as Record<string, unknown>).extend || "",
            ),
            fail: String(
              (trial.outcomeCriteria as Record<string, unknown>).fail || "",
            ),
          }
        : {},
    candidateInstructions: String(trial.candidateInstructions || ""),
    candidateAcceptance: String(trial.candidateAcceptance || ""),
    candidateSubmission: String(trial.candidateSubmission || ""),
    candidateEvidenceIds: Array.isArray(trial.candidateEvidenceIds)
      ? trial.candidateEvidenceIds.map(String)
      : [],
    candidateFeedback: ["passed", "redirected", "extended", "failed"].includes(
      String(trial.state || ""),
    )
      ? String(trial.candidateFeedback || "")
      : "",
    outcome: ["passed", "redirected", "extended", "failed"].includes(
      String(trial.state || ""),
    )
      ? String(trial.outcome || "")
      : "",
    canRespond: trial.state === "offered",
    canSubmit: trial.state === "active",
  }));
  return {
    company: { name: input.company.name },
    candidate: {
      name: String(candidateData.preferredName || input.candidate.name),
    },
    application: {
      status: candidateVisibleStatus(state, input.assessments),
      actions: {
        canEditIntake: ["invited", "intake_started"].includes(state),
        canSubmitIntake: ["invited", "intake_started"].includes(state),
        canSubmitEvidence: !["activated", "rejected", "withdrawn"].includes(
          state,
        ),
        canAskQuestion: !["withdrawn"].includes(state),
        canWithdraw: !["activated", "rejected", "withdrawn"].includes(state),
      },
      summary: String(application.candidateSummary || ""),
      intake: {
        preferredName: String(candidateData.preferredName || ""),
        phone: String(candidateData.phone || ""),
        location: String(candidateData.location || ""),
        availability: String(candidateData.availability || ""),
        resumeUrl: String(candidateData.resumeUrl || ""),
        portfolioUrl: String(candidateData.portfolioUrl || ""),
        answers:
          candidateData.answers && typeof candidateData.answers === "object"
            ? candidateData.answers
            : {},
      },
      consentState: String(application.consentState || "pending"),
      consentScope,
      correctionStatus: String(application.correctionStatus || "none"),
      candidateCorrection: String(application.candidateCorrection || ""),
      plausibleRoles: Array.isArray(application.roleHypotheses)
        ? application.roleHypotheses
        : [],
      retentionUntil:
        application.retentionUntil instanceof Date
          ? application.retentionUntil.toISOString()
          : application.retentionUntil || null,
      deletionRequestedAt:
        application.deletionRequestedAt instanceof Date
          ? application.deletionRequestedAt.toISOString()
          : application.deletionRequestedAt || null,
      nextAction: candidateNextAction(state, input.assessments, input.trials),
    },
    opportunity: {
      title: input.need.title,
      outcomes: Array.isArray(input.need.requiredOutcomes)
        ? input.need.requiredOutcomes
        : [],
    },
    adaptiveQuestioning: {
      consentActive: consentScope.includes("adaptive_questioning"),
      canRequestNext:
        adaptiveEligible &&
        consentScope.includes("application") &&
        consentScope.includes("job_relevant_assessment") &&
        !adaptiveOpen &&
        adaptiveAssessments.length < 5,
      generatedCount: adaptiveAssessments.length,
      remaining: Math.max(0, 5 - adaptiveAssessments.length),
      maximum: 5,
      openQuestion: adaptiveOpen,
      disclosure:
        "When you opt in, EOS sends only your job-relevant summary, answers, role hypotheses, opportunity outcomes, and prior follow-up answers to the configured AI provider. Contact fields, links, files, voice, internal notes, proof gaps, and scores are excluded. A human makes every consequential decision.",
    },
    assessments,
    evidence: input.evidence.map((item) => ({
      id: String(item.id || ""),
      title: String(item.title || "Evidence"),
      evidenceType: String(item.evidenceType || "candidate_statement"),
      sourceUrl: String(item.sourceUrl || ""),
      candidateStatement: String(item.candidateStatement || ""),
      fileName: String(item.fileName || ""),
      fileMimeType: String(item.fileMimeType || ""),
      fileSizeBytes: Number(item.fileSizeBytes || 0),
      scanState: String(item.scanState || "not_applicable"),
      fileAvailable:
        Boolean(item.storageKey) &&
        item.scanState === "clean" &&
        item.state !== "withdrawn",
      transcriptionRequested: Boolean(item.transcriptionRequested),
      transcriptionState: String(item.transcriptionState || "not_requested"),
      transcript:
        item.state === "withdrawn" ? "" : String(item.transcript || ""),
      status: candidateEvidenceStatus(String(item.state || "submitted")),
      canWithdraw: ["submitted", "promoted"].includes(String(item.state)),
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item.createdAt || null,
    })),
    scheduling: (input.scheduling || []).map((item) => ({
      id: String(item.id || ""),
      kind: String(item.schedulingKind || "interview"),
      status: String(item.state || "proposed"),
      proposedSlots: Array.isArray(item.proposedSlots)
        ? item.proposedSlots
        : [],
      selectedSlot: String(item.selectedSlot || ""),
      durationMinutes: Number(item.durationMinutes || 45),
      schedulingUrl: String(item.schedulingUrl || ""),
      teamNote: String(item.teamNote || ""),
      candidateTimezone: String(item.candidateTimezone || ""),
      candidateAvailability: String(item.candidateAvailability || ""),
      candidateMessage: String(item.candidateMessage || ""),
      canRespond: ["proposed", "alternative_requested"].includes(
        String(item.state || "proposed"),
      ),
      calendarConfirmed:
        item.sourceSystem === "google_calendar" &&
        Boolean(item.externalEventReference) &&
        item.state !== "cancelled",
    })),
    trials,
    messages: input.messages.map((item) => ({
      id: String(item.id || ""),
      direction: String(item.direction || "candidate_to_team"),
      body: String(item.body || ""),
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item.createdAt || null,
    })),
  };
}
