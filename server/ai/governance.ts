export const AI_GOVERNANCE_STANDARD = "eos.ai-governance.v1" as const;
export const AI_MODEL_REGISTRY = Object.freeze({
  version: "2026-08-12",
  tiers: {
    fast: "claude-haiku-4-5-20251001",
    standard: "claude-sonnet-4-6",
    advanced: "claude-opus-4-6",
  },
  maximumOutputTokens: 8192,
  maximumMessages: 50,
  maximumSerializedPromptBytes: 200_000,
  maximumSystemCharacters: 30_000,
  maximumImageBase64Characters: 14_000_000,
});

export class AiGovernanceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AiGovernanceError";
  }
}

export function governAiRequest(input: {
  context: string;
  messages: unknown[];
  system?: string;
  maxTokens?: number;
  companyId?: number;
  userId?: string;
  production?: boolean;
}) {
  const context = input.context?.trim();
  if (!context || context.length > 160 || /[\u0000-\u001f\u007f]/.test(context)) throw new AiGovernanceError("invalid_ai_context", "AI context must be a stable, printable identifier of at most 160 characters.");
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > AI_MODEL_REGISTRY.maximumMessages) throw new AiGovernanceError("invalid_ai_message_count", `AI calls require 1-${AI_MODEL_REGISTRY.maximumMessages} messages.`);
  if ((input.system?.length || 0) > AI_MODEL_REGISTRY.maximumSystemCharacters) throw new AiGovernanceError("ai_system_prompt_too_large", "AI system instructions exceed the governed size limit.");
  const serializedBytes = Buffer.byteLength(JSON.stringify(input.messages), "utf8") + Buffer.byteLength(input.system || "", "utf8");
  if (serializedBytes > AI_MODEL_REGISTRY.maximumSerializedPromptBytes) throw new AiGovernanceError("ai_prompt_too_large", "AI request content exceeds the governed size limit.");
  const maxTokens = input.maxTokens ?? AI_MODEL_REGISTRY.maximumOutputTokens;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > AI_MODEL_REGISTRY.maximumOutputTokens) throw new AiGovernanceError("invalid_ai_output_limit", `AI output must be limited to 1-${AI_MODEL_REGISTRY.maximumOutputTokens} tokens.`);
  if (input.production && (!input.companyId || !input.userId)) throw new AiGovernanceError("unscoped_ai_request", "Production AI calls require company and user scope.");
  return { context, maxTokens, serializedBytes, governanceVersion: AI_GOVERNANCE_STANDARD, modelRegistryVersion: AI_MODEL_REGISTRY.version };
}

export function governImagePayload(base64Image: string): void {
  if (!base64Image || base64Image.length > AI_MODEL_REGISTRY.maximumImageBase64Characters) throw new AiGovernanceError("invalid_ai_image_size", "AI image payload is empty or exceeds the governed size limit.");
}
