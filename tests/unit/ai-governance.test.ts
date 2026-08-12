import { describe, expect, it } from "vitest";
import { AI_GOVERNANCE_STANDARD, AI_MODEL_REGISTRY, governAiRequest, governImagePayload } from "../../server/ai/governance";

describe("AI governance policy", () => {
  it("accepts a bounded, scoped production request and returns policy provenance", () => {
    expect(governAiRequest({ context: "eos-executive-assistant:42", messages: [{ role: "user", content: "Summarize current evidence." }], maxTokens: 600, companyId: 42, userId: "user_42", production: true })).toMatchObject({
      maxTokens: 600,
      governanceVersion: AI_GOVERNANCE_STANDARD,
      modelRegistryVersion: AI_MODEL_REGISTRY.version,
    });
  });

  it("rejects unscoped production calls, oversized prompts, outputs, and images", () => {
    expect(() => governAiRequest({ context: "legacy", messages: [{ role: "user", content: "hello" }], production: true })).toThrowError(/company and user scope/i);
    expect(() => governAiRequest({ context: "oversized-output", messages: [{ role: "user", content: "hello" }], maxTokens: AI_MODEL_REGISTRY.maximumOutputTokens + 1 })).toThrowError(/output/i);
    expect(() => governAiRequest({ context: "oversized-prompt", messages: [{ role: "user", content: "x".repeat(AI_MODEL_REGISTRY.maximumSerializedPromptBytes + 1) }] })).toThrowError(/size limit/i);
    expect(() => governImagePayload("x".repeat(AI_MODEL_REGISTRY.maximumImageBase64Characters + 1))).toThrowError(/image payload/i);
  });
});
