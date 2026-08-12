import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import { completeAiSpend, failAiSpend, reserveAiSpend } from "./cost-control";
import { writeLog } from "../observability/logger";

export type ModelTier = "fast" | "standard" | "advanced";

export interface GatewayRequest {
  messages: Anthropic.MessageParam[];
  system?: string;
  tier: ModelTier;
  maxTokens?: number;
  context: string;
  companyId?: number;
  userId?: string;
}

export interface GatewayResponse { content: string; model: string; inputTokens: number; outputTokens: number; cost: number }

export class GatewayError extends Error {
  constructor(message: string, public readonly context: string, public readonly tier: ModelTier) { super(message); this.name = "GatewayError"; }
}

const MODEL_MAP: Record<ModelTier, string> = { fast: "claude-haiku-4-5-20251001", standard: "claude-sonnet-4-6", advanced: "claude-opus-4-6" };
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.00025, output: 0.00125 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-opus-4-6": { input: 0.015, output: 0.075 },
};

interface GatewayStats { totalCalls: number; totalCost: number; totalInputTokens: number; totalOutputTokens: number; callsByContext: Record<string, number> }
let stats: GatewayStats = { totalCalls: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, callsByContext: {} };
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY, baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL });
  return client;
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K[model];
  return rates ? (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output : 0;
}

async function runGovernedCall(input: { request: GatewayRequest; model: string; maxTokens: number; invoke: () => Promise<Anthropic.Message> }): Promise<GatewayResponse> {
  const { request, model, maxTokens } = input;
  if (process.env.NODE_ENV === "production" && (!request.companyId || !request.userId)) throw new GatewayError("Company and user scope are required for production AI calls.", request.context, request.tier);
  const estimatedInputTokens = Math.ceil((JSON.stringify(request.messages).length + (request.system?.length || 0)) / 4);
  const estimatedCostMicros = Math.ceil(calculateCost(model, estimatedInputTokens, maxTokens) * 1_000_000);
  const reservation = request.companyId && request.userId ? await reserveAiSpend({ companyId: request.companyId, userId: request.userId, context: request.context, model, estimatedCostMicros }) : null;
  try {
    const response = await pRetry(input.invoke, { retries: 3, minTimeout: process.env.NODE_ENV === "test" ? 1 : 1000, factor: 2 });
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);
    if (reservation) await completeAiSpend(reservation.id, { actualCostMicros: Math.ceil(cost * 1_000_000), inputTokens, outputTokens });
    stats.totalCalls += 1; stats.totalCost += cost; stats.totalInputTokens += inputTokens; stats.totalOutputTokens += outputTokens;
    stats.callsByContext[request.context] = (stats.callsByContext[request.context] || 0) + 1;
    writeLog("info", "ai_gateway_completed", { companyId: request.companyId, userId: request.userId, context: request.context, tier: request.tier, model, inputTokens, outputTokens, costMicros: Math.ceil(cost * 1_000_000) });
    const firstBlock = response.content[0];
    return { content: firstBlock.type === "text" ? firstBlock.text : "", model, inputTokens, outputTokens, cost };
  } catch (error) {
    if (reservation) await failAiSpend(reservation.id);
    throw new GatewayError(`AI gateway call failed after retries: ${error instanceof Error ? error.message : "unknown error"}`, request.context, request.tier);
  }
}

export async function callAI(request: GatewayRequest): Promise<GatewayResponse> {
  const model = MODEL_MAP[request.tier];
  const maxTokens = request.maxTokens ?? 8192;
  return runGovernedCall({ request, model, maxTokens, invoke: () => getClient().messages.create({ model, max_tokens: maxTokens, system: request.system || undefined, messages: request.messages }) });
}

export async function callVision(base64Image: string, prompt: string, context = "vision", scope?: { companyId: number; userId: string }): Promise<GatewayResponse> {
  const model = MODEL_MAP.standard;
  const maxTokens = 8192;
  const request: GatewayRequest = { messages: [{ role: "user", content: prompt }], tier: "standard", context, ...scope };
  return runGovernedCall({ request, model, maxTokens, invoke: () => getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } }] }] }) });
}

export function getGatewayStats(): Readonly<GatewayStats> { return { ...stats, callsByContext: { ...stats.callsByContext } }; }
export function resetStats(): void { stats = { totalCalls: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, callsByContext: {} }; }
export function _setClientForTesting(mockClient: Anthropic | null): void { client = mockClient; }
