import { describe, expect, it, vi } from "vitest";
import { fixedWindowRateLimit, resetInMemoryRateLimitsForFixture } from "../../server/middleware/rate-limit";

describe("API rate limiting", () => {
  it("allows the configured window and then rejects excess requests", async () => {
    const limiter = fixedWindowRateLimit({ limit: 2, windowMs: 60_000, namespace: "test", key: () => "principal" });
    const req: any = { ip: "127.0.0.1", socket: {} };
    const res: any = { setHeader: vi.fn(), status: vi.fn(function () { return this; }), json: vi.fn(function () { return this; }) };
    const next = vi.fn();
    await limiter(req, res, next);
    await limiter(req, res, next);
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("fails closed when the shared store is unavailable", async () => {
    const store = { increment: vi.fn().mockRejectedValue(new Error("store unavailable")) };
    const limiter = fixedWindowRateLimit({ limit: 2, windowMs: 60_000, namespace: "test-fail", store });
    const req: any = { ip: "127.0.0.1", socket: {}, path: "/api/example", requestId: "request-test" };
    const res: any = { setHeader: vi.fn(), status: vi.fn(function () { return this; }), json: vi.fn(function () { return this; }) };
    const next = vi.fn();
    await limiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows rate-limit reset only inside the explicit browser fixture", () => {
    delete process.env.EOS_E2E_FIXTURE;
    expect(() => resetInMemoryRateLimitsForFixture()).toThrow("only be reset by the loopback browser fixture");
    process.env.EOS_E2E_FIXTURE = "true";
    expect(() => resetInMemoryRateLimitsForFixture()).not.toThrow();
    delete process.env.EOS_E2E_FIXTURE;
  });
});
