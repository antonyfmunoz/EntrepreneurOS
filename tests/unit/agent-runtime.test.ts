import { describe, expect, it } from "vitest";
import {
  agentScheduleCreateSchema,
  agentEvaluationSchema,
  nextAgentScheduleAt,
} from "../../shared/agent-runtime";

describe("scheduled and event-driven Role Agent contracts", () => {
  const base = {
    scheduleKey: "daily-operating-brief",
    name: "Daily operating brief",
    seatId: "seat-1",
    authoritySubjectId: "subject-1",
    processDefinitionId: "process-1",
    inputTemplate: {},
    maxRunsPerDay: 1,
    evaluationRequired: true,
    classification: "confidential" as const,
  };

  it("requires coherent time, event, and manual trigger configuration", () => {
    expect(agentScheduleCreateSchema.safeParse({ ...base, triggerKind: "schedule", cadence: "daily", executionMode: "autonomous", nextRunAt: "2026-08-27T08:00:00.000Z", eventTypes: [] }).success).toBe(true);
    expect(agentScheduleCreateSchema.safeParse({ ...base, triggerKind: "event", cadence: "event", executionMode: "assisted", eventTypes: ["customer.risk.detected"] }).success).toBe(true);
    expect(agentScheduleCreateSchema.safeParse({ ...base, triggerKind: "event", cadence: "daily", executionMode: "assisted", eventTypes: [] }).success).toBe(false);
    expect(agentScheduleCreateSchema.safeParse({ ...base, triggerKind: "schedule", cadence: "daily", executionMode: "delegated", nextRunAt: "2026-08-27T08:00:00.000Z", eventTypes: [] }).success).toBe(false);
  });

  it("calculates bounded UTC cadence without pretending event or one-time work recurs", () => {
    const from = new Date("2026-08-26T08:00:00.000Z");
    expect(nextAgentScheduleAt("hourly", from)?.toISOString()).toBe("2026-08-26T09:00:00.000Z");
    expect(nextAgentScheduleAt("weekly", from)?.toISOString()).toBe("2026-09-02T08:00:00.000Z");
    expect(nextAgentScheduleAt("event", from)).toBeNull();
    expect(nextAgentScheduleAt("once", from)).toBeNull();
  });

  it("requires a complete five-dimension evaluation and attributable rationale", () => {
    const valid = { expectedRunVersion: 3, outcome: "passed", scores: { correctness: 1, authorityCompliance: 1, evidenceQuality: 0.8, usefulness: 0.9, efficiency: 0.7 }, rationale: "The completed run stayed inside authority, produced the expected output, and retained evidence.", evidenceIds: [], learningProposal: "" };
    expect(agentEvaluationSchema.safeParse(valid).success).toBe(true);
    expect(agentEvaluationSchema.safeParse({ ...valid, scores: { ...valid.scores, authorityCompliance: 1.2 } }).success).toBe(false);
  });
});
