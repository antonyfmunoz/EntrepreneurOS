import { afterEach, describe, expect, it, vi } from "vitest";
import { applySecurityHeaders, blockLegacyUnscopedApis, requireLocalApiAuth, sanitizeServerErrors } from "../../server/middleware/api-security";

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  return res;
}

afterEach(() => { process.env.NODE_ENV = "test"; });

describe("EOS API security boundary", () => {
  it("rejects API requests without a resolved local principal", () => {
    const res = response(); const next = vi.fn();
    requireLocalApiAuth({ isAuthenticated: () => false } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows authenticated requests to continue", () => {
    const res = response(); const next = vi.fn();
    requireLocalApiAuth({ method: "GET", isAuthenticated: () => true } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("requires bearer authentication for hosted mutations", () => {
    process.env.NODE_ENV = "production";
    const res = response(); const next = vi.fn();
    requireLocalApiAuth({ method: "POST", get: () => undefined, isAuthenticated: () => true } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows hosted mutations carrying a bearer token", () => {
    process.env.NODE_ENV = "production";
    const res = response(); const next = vi.fn();
    requireLocalApiAuth({ method: "POST", get: () => "Bearer clerk-token", isAuthenticated: () => true } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets baseline browser security headers", () => {
    const res = response(); const next = vi.fn();
    applySecurityHeaders({} as any, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(res.setHeader).toHaveBeenCalledWith("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Security-Policy", expect.stringContaining("frame-ancestors 'none'"));
    expect(next).toHaveBeenCalledOnce();
  });

  it("removes internal details from server errors", () => {
    const originalJson = vi.fn();
    const res: any = { statusCode: 500, json: originalJson };
    const next = vi.fn();
    sanitizeServerErrors({} as any, res, next);
    res.json({ message: "database failed", error: "postgres://secret" });
    expect(originalJson).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  it("quarantines globally scoped legacy resources by default", () => {
    const res = response(); const next = vi.fn();
    blockLegacyUnscopedApis({ path: "/tasks" } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(next).not.toHaveBeenCalled();
    blockLegacyUnscopedApis({ path: "/conversations/foreign" } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(410);
    blockLegacyUnscopedApis({ path: "/keys/save" } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(410);
    blockLegacyUnscopedApis({ path: "/llm/chat" } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(410);
    for (const path of ["/actions/pending", "/crm/contacts", "/folders", "/documents", "/ai-assistant/messages", "/stats", "/analytics", "/ai/stats"]) {
      blockLegacyUnscopedApis({ path } as any, res, next);
      expect(res.status).toHaveBeenLastCalledWith(410);
    }
  });

  it("does not block company-scoped EOS runtime routes", () => {
    const res = response(); const next = vi.fn();
    blockLegacyUnscopedApis({ path: "/eos/companies/1/work-packets" } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
