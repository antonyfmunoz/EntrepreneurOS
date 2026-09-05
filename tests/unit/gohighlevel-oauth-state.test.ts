import { describe, expect, it } from "vitest";
import { createOAuthState, readOAuthState } from "../../server/integrations/gohighlevel";

describe("GoHighLevel OAuth state", () => {
  it("binds authorization to the initiating EOS user and company Systems return path", async () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "x".repeat(48);
    const state = await createOAuthState("operator-a", 1_000, "/company/12#systems");
    await expect(readOAuthState(state, "operator-a", 2_000)).resolves.toMatchObject({ returnTo: "/company/12#systems" });
    await expect(readOAuthState(state, "operator-b", 2_000)).resolves.toBeNull();
    await expect(readOAuthState(state, "operator-a", 700_001)).resolves.toBeNull();
    if (original === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = original;
  });
});
