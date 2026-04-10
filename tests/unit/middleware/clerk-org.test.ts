import { describe, it, expect, vi } from "vitest";
import { extractClerkOrg } from "../../../server/middleware/clerk-org";

describe("extractClerkOrg middleware", () => {
  function createMockReq(auth?: { orgId?: string }) {
    return { auth } as any;
  }

  function createMockRes() {
    return {} as any;
  }

  it("attaches orgId from req.auth.orgId when present", () => {
    const req = createMockReq({ orgId: "org_abc123" });
    const res = createMockRes();
    const next = vi.fn();

    extractClerkOrg(req, res, next);

    expect(req.clerkOrg).toBe("org_abc123");
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets clerkOrg to null when no auth", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    extractClerkOrg(req, res, next);

    expect(req.clerkOrg).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets clerkOrg to null when auth exists but orgId is undefined", () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = vi.fn();

    extractClerkOrg(req, res, next);

    expect(req.clerkOrg).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next() always — non-blocking", () => {
    const req = {} as any; // no auth property at all
    const res = createMockRes();
    const next = vi.fn();

    extractClerkOrg(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
