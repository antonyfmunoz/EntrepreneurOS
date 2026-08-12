import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";

export type ModelTier = "fast" | "standard" | "advanced";

export interface GatewayRequest {
  messages: Anthropic.MessageParam[];
  system?: string;
  tier: ModelTier;
  maxTokens?: number;
  context: string; // what is this call for — for logging
}

export interface GatewayResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly context: string,
    public readonly tier: ModelTier,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

const MODEL_MAP: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5-20251001",
  standard: "claude-sonnet-4-6",
  advanced: "claude-opus-4-6",
};

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.00025, output: 0.00125 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-opus-4-6": { input: 0.015, output: 0.075 },
};

interface GatewayStats {
  totalCalls: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  callsByContext: Record<string, number>;
}

let stats: GatewayStats = {
  totalCalls: 0,
  totalCost: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  callsByContext: {},
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
  }
  return client;
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = COST_PER_1K[model];
  if (!rates) return 0;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

export async function callAI(request: GatewayRequest): Promise<GatewayResponse> {
  const model = MODEL_MAP[request.tier];
  const maxTokens = request.maxTokens ?? 8192;

  const attempt = async () => {
    const response = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      system: request.system || undefined,
      messages: request.messages,
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    // Track stats
    stats.totalCalls += 1;
    stats.totalCost += cost;
    stats.totalInputTokens += inputTokens;
    stats.totalOutputTokens += outputTokens;
    stats.callsByContext[request.context] =
      (stats.callsByContext[request.context] || 0) + 1;

    console.log(
      `[ai-gateway] ${request.context} | ${request.tier} → ${model} | ${inputTokens}+${outputTokens} tokens | $${cost.toFixed(4)}`,
    );

    const firstBlock = response.content[0];
    const content = firstBlock.type === "text" ? firstBlock.text : "";

    return {
      content,
      model,
      inputTokens,
      outputTokens,
      cost,
    };
  };

  try {
    return await pRetry(attempt, {
      retries: 3,
      minTimeout: process.env.NODE_ENV === "test" ? 1 : 1000,
      factor: 2,
    });
  } catch (error: any) {
    throw new GatewayError(
      `AI gateway call failed after retries: ${error.message}`,
      request.context,
      request.tier,
    );
  }
}

/**
 * Vision call — analyzes an image with a text prompt.
 * Uses claude-sonnet-4-6 (standard tier). Routes through the same stats
 * tracking and retry logic as callAI.
 */
export async function callVision(
  base64Image: string,
  prompt: string,
  context: string = "vision",
): Promise<GatewayResponse> {
  const model = MODEL_MAP.standard;
  const maxTokens = 8192;

  const attempt = async () => {
    const response = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    stats.totalCalls += 1;
    stats.totalCost += cost;
    stats.totalInputTokens += inputTokens;
    stats.totalOutputTokens += outputTokens;
    stats.callsByContext[context] =
      (stats.callsByContext[context] || 0) + 1;

    console.log(
      `[ai-gateway] ${context} | vision → ${model} | ${inputTokens}+${outputTokens} tokens | $${cost.toFixed(4)}`,
    );

    const firstBlock = response.content[0];
    const content = firstBlock.type === "text" ? firstBlock.text : "";

    return { content, model, inputTokens, outputTokens, cost };
  };

  try {
    return await pRetry(attempt, {
      retries: 3,
      minTimeout: process.env.NODE_ENV === "test" ? 1 : 1000,
      factor: 2,
    });
  } catch (error: any) {
    throw new GatewayError(
      `AI gateway vision call failed after retries: ${error.message}`,
      context,
      "standard",
    );
  }
}

export function getGatewayStats(): Readonly<GatewayStats> {
  return { ...stats, callsByContext: { ...stats.callsByContext } };
}

export function resetStats(): void {
  stats = {
    totalCalls: 0,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    callsByContext: {},
  };
}

// Exported for testing — allows injecting a mock client
export function _setClientForTesting(mockClient: Anthropic | null): void {
  client = mockClient;
}
