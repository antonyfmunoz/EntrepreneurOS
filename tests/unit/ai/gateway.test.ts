import { describe, it, expect, vi, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  callAI,
  getGatewayStats,
  resetStats,
  GatewayError,
  _setClientForTesting,
  type GatewayRequest,
} from "../../../server/ai/gateway.js";

function makeMockClient(overrides: {
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  shouldFail?: boolean;
  failMessage?: string;
} = {}) {
  const {
    content = "mock response",
    inputTokens = 100,
    outputTokens = 50,
    shouldFail = false,
    failMessage = "API error",
  } = overrides;

  return {
    messages: {
      create: vi.fn().mockImplementation(async () => {
        if (shouldFail) {
          throw new Error(failMessage);
        }
        return {
          content: [{ type: "text" as const, text: content }],
          usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        };
      }),
    },
  } as unknown as Anthropic;
}

function baseRequest(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    messages: [{ role: "user", content: "Hello" }],
    tier: "fast",
    context: "test-context",
    ...overrides,
  };
}

describe("AI Gateway", () => {
  beforeEach(() => {
    resetStats();
    _setClientForTesting(null);
  });

  describe("callAI", () => {
    it("returns a GatewayResponse with correct shape", async () => {
      _setClientForTesting(makeMockClient({
        content: "hello world",
        inputTokens: 200,
        outputTokens: 80,
      }));

      const response = await callAI(baseRequest());

      expect(response).toEqual({
        content: "hello world",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 200,
        outputTokens: 80,
        cost: expect.any(Number),
      });
      expect(response.cost).toBeGreaterThan(0);
    });

    it("maps 'fast' tier to claude-haiku-4-5-20251001", async () => {
      const mock = makeMockClient();
      _setClientForTesting(mock);

      await callAI(baseRequest({ tier: "fast" }));

      expect(mock.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
      );
    });

    it("maps 'standard' tier to claude-sonnet-4-6", async () => {
      const mock = makeMockClient();
      _setClientForTesting(mock);

      await callAI(baseRequest({ tier: "standard" }));

      expect(mock.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-sonnet-4-6" }),
      );
    });

    it("maps 'advanced' tier to claude-opus-4-6", async () => {
      const mock = makeMockClient();
      _setClientForTesting(mock);

      await callAI(baseRequest({ tier: "advanced" }));

      expect(mock.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-opus-4-6" }),
      );
    });

    it("passes system message and maxTokens to the client", async () => {
      const mock = makeMockClient();
      _setClientForTesting(mock);

      await callAI(baseRequest({
        system: "You are helpful.",
        maxTokens: 4096,
      }));

      expect(mock.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are helpful.",
          max_tokens: 4096,
        }),
      );
    });

    it("defaults maxTokens to 8192 when not provided", async () => {
      const mock = makeMockClient();
      _setClientForTesting(mock);

      await callAI(baseRequest());

      expect(mock.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 8192 }),
      );
    });

    it("calculates cost correctly for haiku", async () => {
      _setClientForTesting(makeMockClient({
        inputTokens: 1000,
        outputTokens: 1000,
      }));

      const response = await callAI(baseRequest({ tier: "fast" }));

      // haiku: (1000/1000)*0.00025 + (1000/1000)*0.00125 = 0.0015
      expect(response.cost).toBeCloseTo(0.0015, 6);
    });

    it("calculates cost correctly for sonnet", async () => {
      _setClientForTesting(makeMockClient({
        inputTokens: 1000,
        outputTokens: 1000,
      }));

      const response = await callAI(baseRequest({ tier: "standard" }));

      // sonnet: (1000/1000)*0.003 + (1000/1000)*0.015 = 0.018
      expect(response.cost).toBeCloseTo(0.018, 6);
    });
  });

  describe("stats tracking", () => {
    it("increments totalCalls per call", async () => {
      _setClientForTesting(makeMockClient());

      await callAI(baseRequest());
      await callAI(baseRequest());

      const stats = getGatewayStats();
      expect(stats.totalCalls).toBe(2);
    });

    it("accumulates totalCost across calls", async () => {
      _setClientForTesting(makeMockClient({
        inputTokens: 1000,
        outputTokens: 1000,
      }));

      await callAI(baseRequest({ tier: "fast" }));
      await callAI(baseRequest({ tier: "fast" }));

      const stats = getGatewayStats();
      expect(stats.totalCost).toBeCloseTo(0.003, 6);
    });

    it("accumulates token counts", async () => {
      _setClientForTesting(makeMockClient({
        inputTokens: 150,
        outputTokens: 75,
      }));

      await callAI(baseRequest());
      await callAI(baseRequest());

      const stats = getGatewayStats();
      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalOutputTokens).toBe(150);
    });

    it("tracks callsByContext correctly", async () => {
      _setClientForTesting(makeMockClient());

      await callAI(baseRequest({ context: "agent-chat" }));
      await callAI(baseRequest({ context: "agent-chat" }));
      await callAI(baseRequest({ context: "task-scoring" }));

      const stats = getGatewayStats();
      expect(stats.callsByContext["agent-chat"]).toBe(2);
      expect(stats.callsByContext["task-scoring"]).toBe(1);
    });
  });

  describe("resetStats", () => {
    it("clears all counters", async () => {
      _setClientForTesting(makeMockClient());

      await callAI(baseRequest({ context: "pre-reset" }));
      resetStats();

      const stats = getGatewayStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.callsByContext).toEqual({});
    });
  });

  describe("GatewayError", () => {
    it("thrown on failure after retries exhausted", async () => {
      _setClientForTesting(makeMockClient({
        shouldFail: true,
        failMessage: "rate limit exceeded",
      }));

      await expect(
        callAI(baseRequest({ context: "failing-call", tier: "standard" })),
      ).rejects.toThrow(GatewayError);

      try {
        await callAI(baseRequest({ context: "failing-call-2", tier: "fast" }));
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gatewayErr = err as GatewayError;
        expect(gatewayErr.context).toBe("failing-call-2");
        expect(gatewayErr.tier).toBe("fast");
        expect(gatewayErr.message).toContain("rate limit exceeded");
      }
    });

    it("has correct name property", () => {
      const err = new GatewayError("test", "ctx", "fast");
      expect(err.name).toBe("GatewayError");
      expect(err instanceof Error).toBe(true);
    });
  });

  describe("getGatewayStats", () => {
    it("returns a copy — mutations do not affect internal state", async () => {
      _setClientForTesting(makeMockClient());
      await callAI(baseRequest());

      const stats = getGatewayStats();
      stats.totalCalls = 999;
      stats.callsByContext["hacked"] = 1;

      const fresh = getGatewayStats();
      expect(fresh.totalCalls).toBe(1);
      expect(fresh.callsByContext["hacked"]).toBeUndefined();
    });
  });
});
