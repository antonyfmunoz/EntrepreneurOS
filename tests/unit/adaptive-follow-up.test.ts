import { describe, expect, it, vi } from "vitest";
import {
  adaptiveContextSha256,
  deterministicAdaptiveFollowUp,
  generateAdaptiveFollowUp,
  minimizeAdaptiveFollowUpContext,
  type AdaptiveFollowUpContext,
} from "../../server/talent/adaptive-follow-up";

const context: AdaptiveFollowUpContext = {
  opportunityTitle: "Operations lead",
  opportunityOutcomes: ["Reliable weekly delivery"],
  candidateSummary: "Built a recurring operating cadence.",
  candidateAnswers: {
    motivation: "I want to make delivery predictable.",
    relevantWork: "Owned a weekly launch review.",
  },
  roleHypotheses: ["Operations lead", "Program manager"],
  priorFollowUps: [],
};

describe("adaptive recruiting follow-ups", () => {
  it("minimizes and bounds the provider context", () => {
    const minimized = minimizeAdaptiveFollowUpContext({
      ...context,
      candidateSummary:
        "My date of birth is private. Reach me at candidate@example.test, +1 (555) 555-1212, or https://candidate.example.test.",
      opportunityOutcomes: Array.from(
        { length: 20 },
        (_, index) => `Outcome ${index}`,
      ),
      candidateAnswers: Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [
          `answer-${index}`,
          "x".repeat(2_500),
        ]),
      ),
    });
    const serialized = JSON.stringify(minimized);
    expect(minimized.opportunityOutcomes).toHaveLength(10);
    expect(Object.keys(minimized.candidateAnswers)).toHaveLength(20);
    expect(Object.values(minimized.candidateAnswers)[0]).toHaveLength(2_000);
    expect(serialized).not.toMatch(
      /email|phone|resumeUrl|portfolioUrl|voice|proofGaps|internalNotes/i,
    );
    expect(serialized).not.toMatch(
      /date of birth|candidate@example|555-1212|candidate\.example\.test/i,
    );
  });

  it("uses five deterministic, role-relevant templates", () => {
    const questions = Array.from({ length: 5 }, (_, index) =>
      deterministicAdaptiveFollowUp({
        ...context,
        priorFollowUps: Array.from({ length: index }, () => ({
          question: "Prior question?",
          answer: "Prior answer",
        })),
      }),
    );
    expect(new Set(questions.map((item) => item.question)).size).toBe(5);
    expect(
      questions.every((item) => item.question.includes("Operations lead")),
    ).toBe(true);
  });

  it("falls back without calling a provider when none is configured", async () => {
    const result = await generateAdaptiveFollowUp(
      context,
      { companyId: 1, userId: "user-1" },
      {},
    );
    expect(result).toMatchObject({
      mode: "deterministic_fallback",
      model: null,
      governanceVersion: null,
      safetyReason: "provider_unavailable",
    });
  });

  it("accepts strict safe provider JSON and records bounded provenance", async () => {
    const execute = vi.fn(async () => ({
      content: JSON.stringify({
        question:
          "Which part of your weekly launch review best predicts reliable delivery, and what evidence supports that?",
        evidenceExpected:
          "A concrete review practice, its observable result, and the candidate's contribution.",
        candidateBurden: "About 3 minutes",
        informationGap: "predictive evidence from the recurring review",
        rationale: "Branches from the candidate's stated weekly launch work.",
      }),
      model: "test-model",
      governanceVersion: "eos.ai-governance.v1",
    }));
    const result = await generateAdaptiveFollowUp(
      context,
      { companyId: 1, userId: "user-1" },
      {},
      execute,
    );
    expect(result).toMatchObject({
      mode: "ai",
      model: "test-model",
      governanceVersion: "eos.ai-governance.v1",
      safetyReason: "validated",
    });
    expect(result.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(execute.mock.calls[0][0].prompt).not.toMatch(
      /email|phone|resumeUrl|portfolioUrl|voice|proofGaps|internalNotes/i,
    );
  });

  it("rejects unsafe or malformed output and uses the deterministic fallback", async () => {
    for (const content of [
      "not-json",
      JSON.stringify({
        question: "What is your date of birth and why is it relevant?",
        evidenceExpected:
          "A direct answer about the candidate's date of birth.",
        candidateBurden: "One minute",
        informationGap: "age information",
        rationale: "Collect a protected characteristic.",
      }),
    ]) {
      const result = await generateAdaptiveFollowUp(
        context,
        { companyId: 1, userId: "user-1" },
        {},
        async () => ({
          content,
          model: "unsafe-model",
          governanceVersion: "test",
        }),
      );
      expect(result.mode).toBe("deterministic_fallback");
      expect(result.model).toBeNull();
      expect(result.question).not.toMatch(/birth|age/i);
    }
  });

  it("hashes the minimized input stably and changes on a new answer", () => {
    expect(adaptiveContextSha256(context)).toBe(
      adaptiveContextSha256({ ...context }),
    );
    expect(adaptiveContextSha256(context)).not.toBe(
      adaptiveContextSha256({
        ...context,
        candidateAnswers: { ...context.candidateAnswers, new: "New evidence" },
      }),
    );
  });
});
