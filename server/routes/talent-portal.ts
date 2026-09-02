import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { and, eq, inArray, ne } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../db";
import {
  companies,
  eosEvidence,
  eosStakeholders,
  eosTalentApplications,
  eosTalentAssessments,
  eosTalentCandidateEvidence,
  eosTalentCandidateMessages,
  eosTalentNeeds,
  eosTalentPortalEvents,
  eosTalentReviewPackets,
  eosTalentSchedulingRequests,
  eosTalentTrials,
} from "@shared/schema";
import {
  buildTalentPortalProjection,
  talentPortalAdaptiveQuestionSchema,
  talentPortalAssessmentSubmissionSchema,
  talentPortalCorrectionSchema,
  talentPortalEvidenceSchema,
  talentPortalFileEvidenceQuerySchema,
  talentPortalIntakeSchema,
  talentPortalMessageSchema,
  talentPortalSchedulingResponseSchema,
  talentPortalTokenSchema,
  talentPortalTrialResponseSchema,
  talentPortalTrialSubmissionSchema,
  talentPortalVoiceConsentSchema,
  talentPortalWithdrawalSchema,
} from "@shared/talent-portal";
import { talentPortalDigest } from "../talent-portal-token";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import {
  CANDIDATE_FILE_MAX_BYTES,
  candidateFileSha256,
  candidateFileStorageConfigured,
  candidateFileStorageKey,
  deleteCandidateFile,
  readCandidateFile,
  safeAttachmentHeader,
  scanCandidateFile,
  storeCandidateFile,
  validateCandidateFile,
} from "../artifacts/candidate-files";
import { requireScannerBackedArtifactIngress } from "../middleware/untrusted-artifact-ingress";
import { transcribeCandidateAudio } from "../artifacts/candidate-transcription";
import {
  ADAPTIVE_FOLLOW_UP_LIMIT,
  adaptiveContextSha256,
  deterministicAdaptiveFollowUp,
  generateAdaptiveFollowUp,
} from "../talent/adaptive-follow-up";

type PortalContext = {
  application: typeof eosTalentApplications.$inferSelect;
  company: typeof companies.$inferSelect;
  candidate: typeof eosStakeholders.$inferSelect;
  need: typeof eosTalentNeeds.$inferSelect;
};

class CandidatePortalError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const portalRateLimit = fixedWindowRateLimit({
  limit: 90,
  windowMs: 60_000,
  namespace: "talent-portal",
});
const adaptiveQuestionRateLimit = fixedWindowRateLimit({
  limit: 6,
  windowMs: 60_000,
  namespace: "talent-adaptive-question",
});

function portalHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

async function resolvePortal(req: Request): Promise<PortalContext> {
  const token = talentPortalTokenSchema.parse(req.params.token);
  const [application] = await db
    .select()
    .from(eosTalentApplications)
    .where(eq(eosTalentApplications.portalTokenHash, talentPortalDigest(token)))
    .limit(1);
  const now = new Date();
  if (
    !application ||
    application.portalRevokedAt ||
    !application.portalExpiresAt ||
    application.portalExpiresAt <= now
  ) {
    throw new CandidatePortalError(
      404,
      "candidate_portal_unavailable",
      "This candidate link is invalid, expired, or has been replaced.",
    );
  }
  const [[company], [candidate], [need]] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(eq(companies.id, application.companyId))
      .limit(1),
    db
      .select()
      .from(eosStakeholders)
      .where(
        and(
          eq(eosStakeholders.id, application.candidateStakeholderId),
          eq(eosStakeholders.companyId, application.companyId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(eosTalentNeeds)
      .where(
        and(
          eq(eosTalentNeeds.id, application.talentNeedId),
          eq(eosTalentNeeds.companyId, application.companyId),
        ),
      )
      .limit(1),
  ]);
  if (!company || !candidate || !need)
    throw new CandidatePortalError(
      404,
      "candidate_portal_unavailable",
      "This candidate workspace is unavailable.",
    );
  return { application, company, candidate, need };
}

async function projection(context: PortalContext) {
  const [assessments, evidence, messages, scheduling, trials] = await Promise.all([
    db
      .select()
      .from(eosTalentAssessments)
      .where(
        and(
          eq(eosTalentAssessments.companyId, context.application.companyId),
          eq(eosTalentAssessments.applicationId, context.application.id),
        ),
      ),
    db
      .select()
      .from(eosTalentCandidateEvidence)
      .where(
        and(
          eq(
            eosTalentCandidateEvidence.companyId,
            context.application.companyId,
          ),
          eq(eosTalentCandidateEvidence.applicationId, context.application.id),
        ),
      ),
    db
      .select()
      .from(eosTalentCandidateMessages)
      .where(
        and(
          eq(
            eosTalentCandidateMessages.companyId,
            context.application.companyId,
          ),
          eq(eosTalentCandidateMessages.applicationId, context.application.id),
        ),
      )
      .orderBy(eosTalentCandidateMessages.createdAt),
    db
      .select()
      .from(eosTalentSchedulingRequests)
      .where(
        and(
          eq(
            eosTalentSchedulingRequests.companyId,
            context.application.companyId,
          ),
          eq(eosTalentSchedulingRequests.applicationId, context.application.id),
        ),
      )
      .orderBy(eosTalentSchedulingRequests.createdAt),
    db
      .select()
      .from(eosTalentTrials)
      .where(
        and(
          eq(eosTalentTrials.companyId, context.application.companyId),
          eq(eosTalentTrials.applicationId, context.application.id),
          inArray(eosTalentTrials.state, [
            "offered",
            "accepted",
            "active",
            "submitted",
            "under_review",
            "passed",
            "redirected",
            "extended",
            "failed",
            "declined",
          ]),
        ),
      )
      .orderBy(eosTalentTrials.createdAt),
  ]);
  return buildTalentPortalProjection({
    application: context.application,
    company: context.company,
    candidate: context.candidate,
    need: context.need,
    assessments,
    evidence,
    messages,
    scheduling,
    trials,
  });
}

function portalRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    portalHeaders(res);
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof CandidatePortalError)
        return void res
          .status(error.status)
          .json({ code: error.code, message: error.message });
      if (error instanceof ZodError)
        return void res.status(400).json({
          code: "candidate_portal_input_invalid",
          message:
            error.issues[0]?.message || "The submitted information is invalid.",
        });
      return void res.status(500).json({
        code: "candidate_portal_failed",
        message: "The candidate workspace could not complete that action.",
      });
    }
  };
}

function assertOpenForCandidateInput(context: PortalContext): void {
  if (
    ["activated", "rejected", "withdrawn"].includes(context.application.state)
  )
    throw new CandidatePortalError(
      409,
      "candidate_process_closed",
      "This candidate process is closed.",
    );
}

function candidateConsentState(
  scopes: string[],
): "granted" | "limited" | "pending" {
  if (!scopes.length) return "pending";
  return ["application", "job_relevant_assessment", "placement_review"].every(
    (scope) => scopes.includes(scope),
  )
    ? "granted"
    : "limited";
}

function adaptiveContextFor(
  context: PortalContext,
  assessments: Array<typeof eosTalentAssessments.$inferSelect>,
) {
  const candidateData =
    context.application.candidateData &&
    typeof context.application.candidateData === "object"
      ? (context.application.candidateData as Record<string, unknown>)
      : {};
  const answers =
    candidateData.answers && typeof candidateData.answers === "object"
      ? Object.fromEntries(
          Object.entries(candidateData.answers as Record<string, unknown>)
            .filter(([, value]) => typeof value === "string")
            .map(([key, value]) => [key, String(value)]),
        )
      : {};
  return {
    opportunityTitle: context.need.title,
    opportunityOutcomes: Array.isArray(context.need.requiredOutcomes)
      ? context.need.requiredOutcomes.map(String)
      : [],
    candidateSummary: context.application.candidateSummary,
    candidateAnswers: answers,
    roleHypotheses: Array.isArray(context.application.roleHypotheses)
      ? context.application.roleHypotheses.map(String)
      : [],
    priorFollowUps: assessments
      .filter((assessment) => assessment.generationMode !== "manual")
      .sort(
        (left, right) =>
          Number(left.generatedSequence || 0) -
          Number(right.generatedSequence || 0),
      )
      .map((assessment) => ({
        question: assessment.decisionQuestion,
        answer: assessment.candidateSubmission,
      })),
  };
}

export function registerPublicTalentPortalRoutes(app: Express): void {
  app.use("/api/eos/talent-portal", portalRateLimit);

  app.get(
    "/api/eos/talent-portal/:token",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(eosTalentApplications)
          .set({ portalLastAccessedAt: now, updatedAt: now })
          .where(eq(eosTalentApplications.id, context.application.id));
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "portal_viewed",
          traceId,
          correlationId: traceId,
          details: {},
          createdAt: now,
        });
      });
      context.application.portalLastAccessedAt = now;
      res.json(await projection(context));
    }),
  );

  app.patch(
    "/api/eos/talent-portal/:token/intake",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      if (!["invited", "intake_started"].includes(context.application.state))
        throw new CandidatePortalError(
          409,
          "candidate_intake_locked",
          "The submitted intake is already in review. Request a correction instead.",
        );
      const input = talentPortalIntakeSchema.parse(req.body);
      const now = new Date();
      const nextState =
        context.application.state === "invited"
          ? "intake_started"
          : context.application.state;
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            state: nextState,
            candidateSummary: input.candidateSummary,
            candidateData: {
              preferredName: input.preferredName,
              phone: input.phone,
              location: input.location,
              availability: input.availability,
              resumeUrl: input.resumeUrl,
              portfolioUrl: input.portfolioUrl,
              answers: input.answers,
            },
            consentState: candidateConsentState(input.consentScope),
            consentScope: input.consentScope,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentApplications.id, context.application.id),
              eq(eosTalentApplications.state, context.application.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new CandidatePortalError(
            409,
            "candidate_portal_concurrent_change",
            "The application changed. Reload before saving again.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "intake_saved",
          traceId,
          correlationId: traceId,
          details: {
            fields: [
              "preferredName",
              "phone",
              "location",
              "availability",
              "resumeUrl",
              "portfolioUrl",
              "candidateSummary",
              "answers",
              "consentScope",
            ],
            answerCount: Object.keys(input.answers).length,
          },
          createdAt: now,
        });
        return changed;
      });
      context.application = updated;
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/intake/submit",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      if (!["invited", "intake_started"].includes(context.application.state))
        throw new CandidatePortalError(
          409,
          "candidate_intake_locked",
          "The intake has already been submitted.",
        );
      const input = talentPortalIntakeSchema.parse(req.body);
      if (!input.consentScope.includes("application"))
        throw new CandidatePortalError(
          409,
          "candidate_application_consent_required",
          "Application processing consent is required to submit. You may save without submitting.",
        );
      if (input.candidateSummary.length < 20)
        throw new CandidatePortalError(
          409,
          "candidate_intake_incomplete",
          "Add a short factual summary before submitting your intake.",
        );
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            state: "intake_submitted",
            candidateSummary: input.candidateSummary,
            candidateData: {
              preferredName: input.preferredName,
              phone: input.phone,
              location: input.location,
              availability: input.availability,
              resumeUrl: input.resumeUrl,
              portfolioUrl: input.portfolioUrl,
              answers: input.answers,
            },
            consentState: candidateConsentState(input.consentScope),
            consentScope: input.consentScope,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentApplications.id, context.application.id),
              eq(eosTalentApplications.state, context.application.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new CandidatePortalError(
            409,
            "candidate_portal_concurrent_change",
            "The application changed. Reload before submitting again.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "intake_submitted",
          traceId,
          correlationId: traceId,
          details: {
            consentScope: input.consentScope,
            answerCount: Object.keys(input.answers).length,
          },
          createdAt: now,
        });
        return changed;
      });
      context.application = updated;
      res.json(await projection(context));
    }),
  );

  app.patch(
    "/api/eos/talent-portal/:token/assessments/:assessmentId",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      const input = talentPortalAssessmentSubmissionSchema.parse(req.body);
      const [assessment] = await db
        .select()
        .from(eosTalentAssessments)
        .where(
          and(
            eq(eosTalentAssessments.id, req.params.assessmentId),
            eq(eosTalentAssessments.applicationId, context.application.id),
            eq(eosTalentAssessments.companyId, context.application.companyId),
          ),
        )
        .limit(1);
      if (!assessment || assessment.state !== "candidate_action")
        throw new CandidatePortalError(
          404,
          "candidate_assessment_unavailable",
          "This assessment is not available for candidate action.",
        );
      if (assessment.consentRequired && !input.consentAcknowledged)
        throw new CandidatePortalError(
          409,
          "candidate_assessment_consent_required",
          "This assessment requires explicit consent before submission.",
        );
      const now = new Date();
      await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentAssessments)
          .set({
            state: "submitted",
            candidateSubmission: input.submission,
            consentCaptured: assessment.consentRequired
              ? true
              : assessment.consentCaptured,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentAssessments.id, assessment.id),
              eq(eosTalentAssessments.state, "candidate_action"),
            ),
          )
          .returning();
        if (!changed[0])
          throw new CandidatePortalError(
            409,
            "candidate_portal_concurrent_change",
            "The assessment changed before submission. Reload and check its status.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "assessment_submitted",
          traceId,
          correlationId: traceId,
          details: {
            assessmentId: assessment.id,
            consentCaptured: assessment.consentRequired
              ? true
              : assessment.consentCaptured,
          },
          createdAt: now,
        });
        if (assessment.generationMode !== "manual")
          await tx.insert(eosTalentPortalEvents).values({
            id: randomUUID(),
            companyId: context.application.companyId,
            applicationId: context.application.id,
            eventType: "adaptive_question_answered",
            traceId,
            correlationId: traceId,
            details: {
              assessmentId: assessment.id,
              generatedSequence: assessment.generatedSequence,
              characterCount: input.submission.length,
            },
            createdAt: now,
          });
      });
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/adaptive-questions/next",
    adaptiveQuestionRateLimit,
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      talentPortalAdaptiveQuestionSchema.parse(req.body);
      if (
        ![
          "intake_submitted",
          "assessments_incomplete",
          "assessments_complete",
          "internal_review",
          "interview_ready",
        ].includes(context.application.state)
      )
        throw new CandidatePortalError(
          409,
          "adaptive_questioning_not_ready",
          "Submit your guided intake before requesting an adaptive follow-up.",
        );
      const existingScopes = Array.isArray(context.application.consentScope)
        ? context.application.consentScope.map(String)
        : [];
      if (
        !existingScopes.includes("application") ||
        !existingScopes.includes("job_relevant_assessment")
      )
        throw new CandidatePortalError(
          409,
          "adaptive_questioning_base_consent_required",
          "Application and job-relevant assessment consent are required before adaptive questioning.",
        );
      const assessments = await db
        .select()
        .from(eosTalentAssessments)
        .where(
          and(
            eq(eosTalentAssessments.companyId, context.application.companyId),
            eq(eosTalentAssessments.applicationId, context.application.id),
          ),
        );
      const adaptive = assessments.filter(
        (assessment) => assessment.generationMode !== "manual",
      );
      const planned = adaptive.find(
        (assessment) => assessment.state === "planned",
      );
      if (planned) {
        if (Date.now() - planned.updatedAt.getTime() < 120_000)
          throw new CandidatePortalError(
            409,
            "adaptive_question_generation_in_progress",
            "Your next question is still being prepared. Try again shortly.",
          );
        const now = new Date();
        await db.transaction(async (tx) => {
          const recovered = await tx
            .update(eosTalentAssessments)
            .set({ state: "candidate_action", updatedAt: now })
            .where(
              and(
                eq(eosTalentAssessments.id, planned.id),
                eq(eosTalentAssessments.state, "planned"),
              ),
            )
            .returning();
          if (!recovered[0])
            throw new CandidatePortalError(
              409,
              "adaptive_question_concurrent_change",
              "The adaptive question changed before recovery completed.",
            );
          const traceId = randomUUID();
          await tx.insert(eosTalentPortalEvents).values({
            id: randomUUID(),
            companyId: context.application.companyId,
            applicationId: context.application.id,
            eventType: "adaptive_question_generated",
            traceId,
            correlationId: traceId,
            details: {
              assessmentId: planned.id,
              generatedSequence: planned.generatedSequence,
              generationMode: "deterministic_fallback",
              recovery: true,
            },
            createdAt: now,
          });
        });
        return void res.json(await projection(context));
      }
      if (
        adaptive.some((assessment) => assessment.state === "candidate_action")
      )
        throw new CandidatePortalError(
          409,
          "adaptive_question_already_open",
          "Answer or close the current adaptive question before requesting another.",
        );
      if (adaptive.length >= ADAPTIVE_FOLLOW_UP_LIMIT)
        throw new CandidatePortalError(
          409,
          "adaptive_question_limit_reached",
          "You have reached the five-question adaptive follow-up limit.",
        );
      const generationContext = adaptiveContextFor(context, assessments);
      const fallback = deterministicAdaptiveFollowUp(generationContext);
      const sequence = adaptive.length + 1;
      const id = randomUUID();
      const now = new Date();
      const scopes = Array.from(
        new Set([...existingScopes, "adaptive_questioning"]),
      );
      try {
        await db.transaction(async (tx) => {
          if (!existingScopes.includes("adaptive_questioning")) {
            await tx
              .update(eosTalentApplications)
              .set({
                consentScope: scopes,
                consentState: candidateConsentState(scopes),
                updatedAt: now,
              })
              .where(eq(eosTalentApplications.id, context.application.id));
            const consentTraceId = randomUUID();
            await tx.insert(eosTalentPortalEvents).values({
              id: randomUUID(),
              companyId: context.application.companyId,
              applicationId: context.application.id,
              eventType: "adaptive_questioning_consented",
              traceId: consentTraceId,
              correlationId: consentTraceId,
              details: {
                disclosure:
                  "candidate_requested_minimized_ai_adaptive_questioning",
              },
              createdAt: now,
            });
          }
          await tx.insert(eosTalentAssessments).values({
            id,
            companyId: context.application.companyId,
            applicationId: context.application.id,
            assessmentKey: `adaptive-follow-up:${context.application.id}:${sequence}`,
            assessmentType: "other",
            title: `Adaptive follow-up ${sequence}`,
            state: "planned",
            decisionQuestion: fallback.question,
            evidenceExpected: fallback.evidenceExpected,
            validityScope:
              "Candidate-selected evidence collection for the current role hypotheses; not a hiring decision.",
            candidateBurden: fallback.candidateBurden,
            candidateSubmission: "",
            internalEvaluation: "",
            consentRequired: false,
            consentCaptured: true,
            generationMode: "deterministic_fallback",
            generatedSequence: sequence,
            generationModel: null,
            generationGovernanceVersion: null,
            generationInputSha256: adaptiveContextSha256(generationContext),
            generationRationale: fallback.rationale,
            informationGap: fallback.informationGap,
            roleHypothesesSnapshot: generationContext.roleHypotheses,
            evidenceIds: [],
            sourceAuthority: "native_eos",
            classification: "confidential",
            schemaVersion: "talent-assessment-v1.1",
            recordedByUserId: context.application.recordedByUserId,
            createdAt: now,
            updatedAt: now,
          });
        });
      } catch (error: any) {
        if (error?.code === "23505")
          throw new CandidatePortalError(
            409,
            "adaptive_question_concurrent_request",
            "Another adaptive question request is already active.",
          );
        throw error;
      }
      const generated = await generateAdaptiveFollowUp(generationContext, {
        companyId: context.application.companyId,
        userId: context.application.recordedByUserId,
      });
      await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentAssessments)
          .set({
            state: "candidate_action",
            decisionQuestion: generated.question,
            evidenceExpected: generated.evidenceExpected,
            candidateBurden: generated.candidateBurden,
            generationMode: generated.mode,
            generationModel: generated.model,
            generationGovernanceVersion: generated.governanceVersion,
            generationInputSha256: generated.inputSha256,
            generationRationale: generated.rationale,
            informationGap: generated.informationGap,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(eosTalentAssessments.id, id),
              eq(eosTalentAssessments.state, "planned"),
            ),
          )
          .returning();
        if (!changed[0])
          throw new CandidatePortalError(
            409,
            "adaptive_question_concurrent_change",
            "The adaptive question changed before generation completed.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "adaptive_question_generated",
          traceId,
          correlationId: traceId,
          details: {
            assessmentId: id,
            generatedSequence: sequence,
            generationMode: generated.mode,
            safetyReason: generated.safetyReason,
          },
          createdAt: new Date(),
        });
      });
      context.application = {
        ...context.application,
        consentScope: scopes,
        consentState: candidateConsentState(scopes),
      };
      res.status(201).json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/adaptive-questions/consent/withdraw",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const scopes = Array.isArray(context.application.consentScope)
        ? context.application.consentScope
            .map(String)
            .filter((scope) => scope !== "adaptive_questioning")
        : [];
      const now = new Date();
      const traceId = randomUUID();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            consentScope: scopes,
            consentState: candidateConsentState(scopes),
            updatedAt: now,
          })
          .where(eq(eosTalentApplications.id, context.application.id))
          .returning();
        await tx
          .update(eosTalentAssessments)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentAssessments.applicationId, context.application.id),
              ne(eosTalentAssessments.generationMode, "manual"),
              inArray(eosTalentAssessments.state, [
                "planned",
                "candidate_action",
              ]),
            ),
          );
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "adaptive_questioning_withdrawn",
          traceId,
          correlationId: traceId,
          details: { openQuestionsCancelled: true },
          createdAt: now,
        });
        return changed;
      });
      context.application = updated;
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/evidence",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      const input = talentPortalEvidenceSchema.parse(req.body);
      const now = new Date();
      const id = randomUUID();
      const record = {
        id,
        companyId: context.application.companyId,
        applicationId: context.application.id,
        evidenceKey: `candidate-evidence:${context.application.id}:${id}`,
        title: input.title,
        evidenceType: input.evidenceType,
        sourceUrl: input.sourceUrl,
        candidateStatement: input.candidateStatement,
        state: "submitted",
        classification: "confidential",
        schemaVersion: "talent-candidate-evidence-v1.3",
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentCandidateEvidence).values(record);
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "evidence_submitted",
          traceId,
          correlationId: traceId,
          details: {
            evidenceId: id,
            evidenceType: input.evidenceType,
            hasReference: Boolean(input.sourceUrl),
            hasStatement: Boolean(input.candidateStatement),
          },
          createdAt: now,
        });
      });
      res.status(201).json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/evidence/files",
    requireScannerBackedArtifactIngress,
    express.raw({
      type: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "text/plain",
        "audio/webm",
        "audio/mp4",
      ],
      limit: CANDIDATE_FILE_MAX_BYTES,
    }),
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      if (!candidateFileStorageConfigured())
        throw new CandidatePortalError(
          503,
          "candidate_file_storage_unavailable",
          "File uploads are temporarily unavailable. You can still submit an HTTPS reference or factual statement.",
        );
      if (!Buffer.isBuffer(req.body))
        throw new CandidatePortalError(
          400,
          "candidate_file_body_required",
          "Choose a supported file to upload.",
        );
      const input = talentPortalFileEvidenceQuerySchema.parse(req.query);
      if (input.transcribe && input.evidenceType !== "voice_response_file")
        throw new CandidatePortalError(
          400,
          "candidate_transcription_voice_required",
          "Only a voice response can be transcribed.",
        );
      if (
        input.transcribe &&
        !(context.application.consentScope as string[]).includes(
          "voice_processing",
        )
      )
        throw new CandidatePortalError(
          409,
          "candidate_voice_consent_required",
          "Give explicit voice-processing consent before requesting transcription.",
        );
      let metadata;
      try {
        metadata = validateCandidateFile(
          req.body,
          req.headers["content-type"] || "",
          input.fileName,
        );
      } catch (error: any) {
        const message =
          error?.message === "candidate_file_size_invalid"
            ? "Files must be between 1 byte and 10 MB."
            : error?.message === "candidate_file_content_mismatch"
              ? "The file contents do not match the declared file type."
              : "Upload a PDF, PNG, JPEG, UTF-8 text, WebM audio, or MP4 audio file.";
        throw new CandidatePortalError(
          400,
          String(error?.message || "candidate_file_invalid"),
          message,
        );
      }
      const id = randomUUID();
      const now = new Date();
      const storageKey = candidateFileStorageKey(
        context.application.companyId,
        context.application.id,
        id,
      );
      await storeCandidateFile(storageKey, req.body);
      try {
        const scan = await scanCandidateFile(req.body, metadata);
        if (scan.state === "infected") await deleteCandidateFile(storageKey);
        const transcription =
          input.transcribe && scan.state === "clean"
            ? await transcribeCandidateAudio(req.body, metadata)
            : null;
        const transcriptionState = !input.transcribe
          ? "not_requested"
          : scan.state === "clean"
            ? transcription!.state
            : scan.state === "pending"
              ? "awaiting_scan"
              : "failed";
        const record = {
          id,
          companyId: context.application.companyId,
          applicationId: context.application.id,
          evidenceKey: `candidate-evidence:${context.application.id}:${id}`,
          title: input.title,
          evidenceType: input.evidenceType,
          sourceUrl: "",
          candidateStatement: "",
          fileName: metadata.fileName,
          fileMimeType: metadata.mimeType,
          fileSizeBytes: metadata.sizeBytes,
          contentSha256: metadata.sha256,
          storageProvider: "filesystem",
          storageKey,
          scanState: scan.state,
          scanEngine: scan.engine,
          scanCompletedAt: scan.completedAt,
          transcriptionRequested: input.transcribe,
          transcriptionState,
          transcript: transcription?.transcript || "",
          transcriptionProvider: transcription?.provider || null,
          transcriptionModel: transcription?.model || null,
          transcriptionCompletedAt: transcription?.completedAt || null,
          state: "submitted",
          classification: "confidential",
          schemaVersion: "talent-candidate-evidence-v1.3",
          createdAt: now,
          updatedAt: now,
        };
        await db.transaction(async (tx) => {
          await tx.insert(eosTalentCandidateEvidence).values(record);
          const traceId = randomUUID();
          await tx.insert(eosTalentPortalEvents).values({
            id: randomUUID(),
            companyId: context.application.companyId,
            applicationId: context.application.id,
            eventType: "evidence_submitted",
            traceId,
            correlationId: traceId,
            details: {
              evidenceId: id,
              evidenceType: input.evidenceType,
              submissionKind: "file",
              mimeType: metadata.mimeType,
              sizeBytes: metadata.sizeBytes,
              scanState: scan.state,
              transcriptionRequested: input.transcribe,
              transcriptionState,
            },
            createdAt: now,
          });
          if (
            input.transcribe &&
            ["completed", "failed", "unavailable"].includes(transcriptionState)
          )
            await tx.insert(eosTalentPortalEvents).values({
              id: randomUUID(),
              companyId: context.application.companyId,
              applicationId: context.application.id,
              eventType:
                transcriptionState === "completed"
                  ? "voice_transcription_completed"
                  : "voice_transcription_failed",
              traceId,
              correlationId: traceId,
              details: { evidenceId: id, transcriptionState },
              createdAt: now,
            });
        });
        res.status(201).json(await projection(context));
      } catch (error) {
        await deleteCandidateFile(storageKey).catch(() => undefined);
        throw error;
      }
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/voice-consent",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      talentPortalVoiceConsentSchema.parse(req.body);
      const scopes = Array.from(
        new Set([
          ...(context.application.consentScope as string[]),
          "voice_processing",
        ]),
      );
      const now = new Date();
      const traceId = randomUUID();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            consentScope: scopes,
            consentState: candidateConsentState(scopes),
            updatedAt: now,
          })
          .where(eq(eosTalentApplications.id, context.application.id))
          .returning();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "voice_processing_consented",
          traceId,
          correlationId: traceId,
          details: {
            disclosure: "candidate_requested_optional_external_transcription",
          },
          createdAt: now,
        });
        return changed;
      });
      context.application = updated;
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/voice-consent/withdraw",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const scopes = (context.application.consentScope as string[]).filter(
        (scope) => scope !== "voice_processing",
      );
      const now = new Date();
      const traceId = randomUUID();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            consentScope: scopes,
            consentState: candidateConsentState(scopes),
            updatedAt: now,
          })
          .where(eq(eosTalentApplications.id, context.application.id))
          .returning();
        await tx
          .update(eosTalentCandidateEvidence)
          .set({
            transcript: "",
            transcriptionState: "declined",
            transcriptionProvider: null,
            transcriptionModel: null,
            transcriptionCompletedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(
                eosTalentCandidateEvidence.applicationId,
                context.application.id,
              ),
              eq(
                eosTalentCandidateEvidence.evidenceType,
                "voice_response_file",
              ),
              eq(eosTalentCandidateEvidence.transcriptionRequested, true),
            ),
          );
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "voice_processing_withdrawn",
          traceId,
          correlationId: traceId,
          details: { transcriptsRemoved: true },
          createdAt: now,
        });
        return changed;
      });
      context.application = updated;
      res.json(await projection(context));
    }),
  );

  app.get(
    "/api/eos/talent-portal/:token/evidence/:evidenceId/file",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const [evidence] = await db
        .select()
        .from(eosTalentCandidateEvidence)
        .where(
          and(
            eq(eosTalentCandidateEvidence.id, req.params.evidenceId),
            eq(
              eosTalentCandidateEvidence.applicationId,
              context.application.id,
            ),
            eq(
              eosTalentCandidateEvidence.companyId,
              context.application.companyId,
            ),
          ),
        )
        .limit(1);
      if (
        !evidence ||
        evidence.state === "withdrawn" ||
        evidence.scanState !== "clean" ||
        !evidence.storageKey ||
        !evidence.contentSha256
      )
        throw new CandidatePortalError(
          404,
          "candidate_file_unavailable",
          "This file is not available for download.",
        );
      const file = await readCandidateFile(evidence.storageKey);
      if (candidateFileSha256(file) !== evidence.contentSha256)
        throw new CandidatePortalError(
          409,
          "candidate_file_integrity_failed",
          "This file failed its integrity check and is unavailable.",
        );
      res.setHeader(
        "Content-Type",
        evidence.fileMimeType || "application/octet-stream",
      );
      res.setHeader("Content-Length", String(file.length));
      res.setHeader(
        "Content-Disposition",
        safeAttachmentHeader(evidence.fileName),
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(file);
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/scheduling/:schedulingId/respond",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      const input = talentPortalSchedulingResponseSchema.parse(req.body);
      const [request] = await db
        .select()
        .from(eosTalentSchedulingRequests)
        .where(
          and(
            eq(eosTalentSchedulingRequests.id, req.params.schedulingId),
            eq(
              eosTalentSchedulingRequests.applicationId,
              context.application.id,
            ),
            eq(
              eosTalentSchedulingRequests.companyId,
              context.application.companyId,
            ),
          ),
        );
      if (
        !request ||
        !["proposed", "alternative_requested"].includes(request.state)
      )
        throw new CandidatePortalError(
          409,
          "candidate_scheduling_closed",
          "This scheduling request is no longer open for a response.",
        );
      const proposedSlots = Array.isArray(request.proposedSlots)
        ? request.proposedSlots.map(String)
        : [];
      if (
        input.response === "accept" &&
        (!input.selectedSlot || !proposedSlots.includes(input.selectedSlot))
      )
        throw new CandidatePortalError(
          409,
          "candidate_scheduling_slot_invalid",
          "Choose one of the currently proposed times.",
        );
      const nextState =
        input.response === "accept"
          ? "accepted"
          : input.response === "decline"
            ? "declined"
            : "alternative_requested";
      const now = new Date();
      await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentSchedulingRequests)
          .set({
            state: nextState,
            selectedSlot:
              input.response === "accept" ? input.selectedSlot : null,
            candidateTimezone: input.timezone,
            candidateAvailability: input.availability,
            candidateMessage: input.message,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentSchedulingRequests.id, request.id),
              eq(eosTalentSchedulingRequests.state, request.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new CandidatePortalError(
            409,
            "candidate_scheduling_concurrent_change",
            "The proposed times changed. Reload before responding.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "scheduling_responded",
          traceId,
          correlationId: traceId,
          details: {
            schedulingId: request.id,
            response: input.response,
            selectedSlot: input.selectedSlot || null,
          },
          createdAt: now,
        });
      });
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/trials/:trialId/respond",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      const input = talentPortalTrialResponseSchema.parse(req.body);
      const now = new Date();
      const nextState = input.response === "accept" ? "accepted" : "declined";
      await db.transaction(async (tx) => {
        const [trial] = await tx
          .update(eosTalentTrials)
          .set({
            state: nextState,
            candidateAcceptance: input.message,
            acceptedAt: input.response === "accept" ? now : null,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentTrials.id, req.params.trialId),
              eq(eosTalentTrials.companyId, context.application.companyId),
              eq(eosTalentTrials.applicationId, context.application.id),
              eq(eosTalentTrials.state, "offered"),
            ),
          )
          .returning();
        if (!trial)
          throw new CandidatePortalError(
            409,
            "candidate_trial_closed",
            "This trial offer is no longer open for a response.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType:
            input.response === "accept" ? "trial_accepted" : "trial_declined",
          traceId,
          correlationId: traceId,
          details: {
            trialId: trial.id,
            trialVersion: trial.version,
            attested: input.attested,
            messageProvided: Boolean(input.message),
          },
          createdAt: now,
        });
      });
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/trials/:trialId/submit",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      const input = talentPortalTrialSubmissionSchema.parse(req.body);
      const evidenceIds = Array.from(new Set(input.evidenceIds));
      if (evidenceIds.length !== input.evidenceIds.length)
        throw new CandidatePortalError(
          400,
          "candidate_trial_evidence_invalid",
          "Choose each evidence item only once.",
        );
      const evidence = await db
        .select()
        .from(eosTalentCandidateEvidence)
        .where(
          and(
            eq(eosTalentCandidateEvidence.companyId, context.application.companyId),
            eq(eosTalentCandidateEvidence.applicationId, context.application.id),
            inArray(eosTalentCandidateEvidence.id, evidenceIds),
          ),
        );
      const usableEvidence = evidence.every(
        (item) =>
          ["submitted", "promoted"].includes(item.state) &&
          (item.storageKey ? item.scanState === "clean" : item.scanState === "not_applicable"),
      );
      if (evidence.length !== evidenceIds.length || !usableEvidence)
        throw new CandidatePortalError(
          409,
          "candidate_trial_evidence_unavailable",
          "Every trial evidence item must belong to this application and be available for review.",
        );
      const now = new Date();
      await db.transaction(async (tx) => {
        const [trial] = await tx
          .update(eosTalentTrials)
          .set({
            state: "submitted",
            candidateSubmission: input.summary,
            candidateEvidenceIds: evidenceIds,
            submittedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentTrials.id, req.params.trialId),
              eq(eosTalentTrials.companyId, context.application.companyId),
              eq(eosTalentTrials.applicationId, context.application.id),
              eq(eosTalentTrials.state, "active"),
            ),
          )
          .returning();
        if (!trial)
          throw new CandidatePortalError(
            409,
            "candidate_trial_not_active",
            "This trial is not open for submission.",
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "trial_submitted",
          traceId,
          correlationId: traceId,
          details: {
            trialId: trial.id,
            trialVersion: trial.version,
            evidenceCount: evidenceIds.length,
          },
          createdAt: now,
        });
      });
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/evidence/:evidenceId/withdraw",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const now = new Date();
      const [changed] = await db.transaction(async (tx) => {
        const updated = await tx
          .update(eosTalentCandidateEvidence)
          .set({
            state: "withdrawn",
            withdrawnAt: now,
            transcript: "",
            transcriptionState: "declined",
            transcriptionProvider: null,
            transcriptionModel: null,
            transcriptionCompletedAt: null,
            schemaVersion: "talent-candidate-evidence-v1.3",
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentCandidateEvidence.id, req.params.evidenceId),
              eq(
                eosTalentCandidateEvidence.applicationId,
                context.application.id,
              ),
              eq(
                eosTalentCandidateEvidence.companyId,
                context.application.companyId,
              ),
              inArray(eosTalentCandidateEvidence.state, [
                "submitted",
                "promoted",
              ]),
            ),
          )
          .returning();
        if (!updated[0])
          throw new CandidatePortalError(
            404,
            "candidate_evidence_unavailable",
            "That evidence reference cannot be withdrawn.",
          );
        const expiredCanonicalEvidence = updated[0].promotedEvidenceId
          ? await tx
              .update(eosEvidence)
              .set({ verificationState: "expired" })
              .where(
                and(
                  eq(eosEvidence.id, updated[0].promotedEvidenceId),
                  eq(eosEvidence.companyId, context.application.companyId),
                  eq(eosEvidence.verificationState, "verified"),
                ),
              )
              .returning({ id: eosEvidence.id })
          : [];
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "evidence_withdrawn",
          traceId,
          correlationId: traceId,
          details: {
            evidenceId: req.params.evidenceId,
            canonicalEvidenceId: updated[0].promotedEvidenceId,
            canonicalEvidenceExpired: expiredCanonicalEvidence.length === 1,
          },
          createdAt: now,
        });
        return updated;
      });
      if (changed.storageKey)
        await deleteCandidateFile(changed.storageKey).catch(() => undefined);
      res.json({
        id: changed.id,
        state: changed.state,
        withdrawnAt: changed.withdrawnAt,
      });
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/corrections",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const input = talentPortalCorrectionSchema.parse(req.body);
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            candidateCorrection: input.correction,
            correctionStatus: "requested",
            updatedAt: now,
          })
          .where(eq(eosTalentApplications.id, context.application.id))
          .returning();
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "correction_requested",
          traceId,
          correlationId: traceId,
          details: { characterCount: input.correction.length },
          createdAt: now,
        });
        return changed;
      });
      context.application = updated;
      res.json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/messages",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      assertOpenForCandidateInput(context);
      const input = talentPortalMessageSchema.parse(req.body);
      const now = new Date();
      const id = randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentCandidateMessages).values({
          id,
          companyId: context.application.companyId,
          applicationId: context.application.id,
          direction: "candidate_to_team",
          body: input.message,
          sentByUserId: null,
          createdAt: now,
        });
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "candidate_question_submitted",
          traceId,
          correlationId: traceId,
          details: { messageId: id, characterCount: input.message.length },
          createdAt: now,
        });
      });
      res.status(201).json(await projection(context));
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/consent/withdraw",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const input = talentPortalWithdrawalSchema.parse(req.body);
      const now = new Date();
      await db.transaction(async (tx) => {
        const candidateEvidence = await tx
          .select()
          .from(eosTalentCandidateEvidence)
          .where(
            and(
              eq(
                eosTalentCandidateEvidence.applicationId,
                context.application.id,
              ),
              eq(
                eosTalentCandidateEvidence.companyId,
                context.application.companyId,
              ),
            ),
          );
        const promotedEvidenceIds = candidateEvidence
          .map((item) => item.promotedEvidenceId)
          .filter((id): id is string => Boolean(id));
        await tx
          .update(eosTalentApplications)
          .set({
            consentState: "withdrawn",
            consentScope: [],
            state: "withdrawn",
            portalRevokedAt: now,
            updatedAt: now,
          })
          .where(eq(eosTalentApplications.id, context.application.id));
        await tx
          .update(eosTalentCandidateEvidence)
          .set({
            state: "withdrawn",
            withdrawnAt: now,
            transcript: "",
            transcriptionState: "declined",
            transcriptionProvider: null,
            transcriptionModel: null,
            transcriptionCompletedAt: null,
            schemaVersion: "talent-candidate-evidence-v1.3",
            updatedAt: now,
          })
          .where(
            and(
              eq(
                eosTalentCandidateEvidence.applicationId,
                context.application.id,
              ),
              ne(eosTalentCandidateEvidence.state, "withdrawn"),
            ),
          );
        const expiredCanonicalEvidence = promotedEvidenceIds.length
          ? await tx
              .update(eosEvidence)
              .set({ verificationState: "expired" })
              .where(
                and(
                  eq(eosEvidence.companyId, context.application.companyId),
                  inArray(eosEvidence.id, promotedEvidenceIds),
                  eq(eosEvidence.verificationState, "verified"),
                ),
              )
              .returning({ id: eosEvidence.id })
          : [];
        await tx
          .update(eosTalentAssessments)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentAssessments.applicationId, context.application.id),
              ne(eosTalentAssessments.generationMode, "manual"),
              inArray(eosTalentAssessments.state, [
                "planned",
                "candidate_action",
              ]),
            ),
          );
        await tx
          .update(eosTalentReviewPackets)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentReviewPackets.applicationId, context.application.id),
              inArray(eosTalentReviewPackets.state, [
                "draft",
                "ready_for_review",
                "in_review",
              ]),
            ),
          );
        await tx
          .update(eosTalentTrials)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentTrials.applicationId, context.application.id),
              inArray(eosTalentTrials.state, [
                "draft",
                "approved",
                "offered",
                "accepted",
                "active",
                "submitted",
                "under_review",
              ]),
            ),
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "consent_withdrawn",
          traceId,
          correlationId: traceId,
          details: {
            reasonProvided: Boolean(input.reason),
            voiceTranscriptsRemoved: true,
            candidateEvidenceWithdrawn: candidateEvidence.filter(
              (item) => item.state !== "withdrawn",
            ).length,
            canonicalEvidenceExpired: expiredCanonicalEvidence.length,
            openReviewPacketsCancelled: true,
            openTrialsCancelled: true,
          },
          createdAt: now,
        });
      });
      res.json({
        state: "withdrawn",
        message: "Consent was withdrawn and this link has been revoked.",
      });
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/withdraw",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const input = talentPortalWithdrawalSchema.parse(req.body);
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(eosTalentApplications)
          .set({ state: "withdrawn", portalRevokedAt: now, updatedAt: now })
          .where(eq(eosTalentApplications.id, context.application.id));
        await tx
          .update(eosTalentAssessments)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentAssessments.applicationId, context.application.id),
              ne(eosTalentAssessments.generationMode, "manual"),
              inArray(eosTalentAssessments.state, [
                "planned",
                "candidate_action",
              ]),
            ),
          );
        await tx
          .update(eosTalentReviewPackets)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentReviewPackets.applicationId, context.application.id),
              inArray(eosTalentReviewPackets.state, [
                "draft",
                "ready_for_review",
                "in_review",
              ]),
            ),
          );
        await tx
          .update(eosTalentTrials)
          .set({ state: "cancelled", updatedAt: now })
          .where(
            and(
              eq(eosTalentTrials.applicationId, context.application.id),
              inArray(eosTalentTrials.state, [
                "draft",
                "approved",
                "offered",
                "accepted",
                "active",
                "submitted",
                "under_review",
              ]),
            ),
          );
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "application_withdrawn",
          traceId,
          correlationId: traceId,
          details: {
            reasonProvided: Boolean(input.reason),
            openReviewPacketsCancelled: true,
            openTrialsCancelled: true,
          },
          createdAt: now,
        });
      });
      res.json({
        state: "withdrawn",
        message:
          "Your application was withdrawn and this link has been revoked.",
      });
    }),
  );

  app.post(
    "/api/eos/talent-portal/:token/deletion-request",
    portalRoute(async (req, res) => {
      const context = await resolvePortal(req);
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(eosTalentApplications)
          .set({ deletionRequestedAt: now, updatedAt: now })
          .where(eq(eosTalentApplications.id, context.application.id));
        const traceId = randomUUID();
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: context.application.companyId,
          applicationId: context.application.id,
          eventType: "deletion_requested",
          traceId,
          correlationId: traceId,
          details: {},
          createdAt: now,
        });
      });
      res.json({
        deletionRequestedAt: now.toISOString(),
        message:
          "Your deletion request was recorded for human review and applicable retention handling.",
      });
    }),
  );
}
