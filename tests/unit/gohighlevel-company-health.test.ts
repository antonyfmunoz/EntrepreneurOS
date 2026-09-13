import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCompanyConnection } from "../../server/integrations/gohighlevel";

const binding = {
  id: "11111111-1111-4111-8111-111111111111",
  providerKey: "gohighlevel",
  providerAccountReference: "location-empyrean",
  credentialReference: "op://EntrepreneurOS/Production/EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS",
  adapterReference: "gohighlevel-private-integration-v1",
};

const originalCredentials = process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalCredentials === undefined) delete process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS;
  else process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = originalCredentials;
});

describe("GoHighLevel company private-integration health", () => {
  it("proves the exact bound location with a vault-only token and never returns the token", async () => {
    const token = "pit_company_token_that_must_never_reach_a_browser";
    process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = JSON.stringify({
      [binding.id]: { provider: "gohighlevel", privateIntegrationToken: token, locationId: binding.providerAccountReference },
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ opportunities: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyCompanyConnection(binding);

    expect(result).toMatchObject({ connected: true, healthy: true, reason: "ready" });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(fetchMock.mock.calls[0][0]).toContain("location-empyrean");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("does not call HighLevel when the exact binding has no credential", async () => {
    process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = "{}";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCompanyConnection(binding)).resolves.toMatchObject({ connected: false, healthy: false, reason: "credential_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
