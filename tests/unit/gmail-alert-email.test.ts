import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sendVerifiedAlertEmail } from "../../server/integrations/gmail";
const mocks = vi.hoisted(() => ({ profile: vi.fn(), send: vi.fn(), token: vi.fn() }));
vi.mock("../../server/storage", () => ({ storage: { getOauthToken: mocks.token } }));
vi.mock("../../server/security/credential-encryption", () => ({ decryptCredential: () => "synthetic-token", encryptCredential: (value: string) => value, credentialEncryptionConfigured: () => true }));
vi.mock("googleapis", () => ({ google: { auth: { OAuth2: class { setCredentials() {} } }, gmail: () => ({ users: { getProfile: mocks.profile, messages: { send: mocks.send } } }) } }));
const params = { to: "recipient@example.test", subject: "EOS test", body: "Safe operational summary", receiptId: "a".repeat(64) };
describe("verified Gmail operational sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
    mocks.token.mockResolvedValue({ accessToken: "encrypted-test-token", scope: "https://www.googleapis.com/auth/gmail.send" });
    mocks.profile.mockResolvedValue({ data: { emailAddress: "sender@example.test" } });
    mocks.send.mockResolvedValue({ data: { id: "provider-receipt" } });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("checks the exact mailbox and disables send retries", async () => {
    expect(await sendVerifiedAlertEmail("operator", "sender@example.test", params)).toEqual({ messageId: "provider-receipt" });
    expect(mocks.profile).toHaveBeenCalledWith({ userId: "me" }, { timeout: 10_000, retry: false });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ userId: "me" }), { timeout: 15_000, retry: false });
    const mime = Buffer.from(mocks.send.mock.calls[0][0].requestBody.raw, "base64url").toString();
    expect(mime).toContain("To: recipient@example.test");
    expect(mime).not.toContain("Bcc:");
  });
  it("does not send through a different connected mailbox", async () => {
    mocks.profile.mockResolvedValue({ data: { emailAddress: "other@example.test" } });
    await expect(sendVerifiedAlertEmail("operator", "sender@example.test", params)).rejects.toThrow("identity mismatch");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("requires Gmail send scope", async () => {
    mocks.token.mockResolvedValue({ scope: "https://www.googleapis.com/auth/gmail.readonly" });
    await expect(sendVerifiedAlertEmail("operator", "sender@example.test", params)).rejects.toThrow("send scope");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects header injection before using credentials", async () => {
    await expect(sendVerifiedAlertEmail("operator", "sender@example.test", { ...params, to: "a@example.test\r\nBcc:b@example.test" })).rejects.toThrow();
    expect(mocks.token).not.toHaveBeenCalled();
  });
});
