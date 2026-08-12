import { describe, expect, it, vi } from "vitest";
import { fixedWindowRateLimit } from "../../server/middleware/rate-limit";

describe("API rate limiting", () => {
  it("allows the configured window and then rejects excess requests", () => {
    const limiter = fixedWindowRateLimit({ limit: 2, windowMs: 60_000, namespace: "test", key: () => "principal" });
    const req: any = { ip: "127.0.0.1", socket: {} };
    const res: any = { setHeader: vi.fn(), status: vi.fn(function () { return this; }), json: vi.fn(function () { return this; }) };
    const next = vi.fn();
    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
