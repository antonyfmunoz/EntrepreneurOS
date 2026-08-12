import { generateKeyPairSync, sign } from "crypto";
import { describe, expect, it } from "vitest";
import { commandEnvelopeSchema, FEDERATION_PROTOCOL_VERSION } from "../../server/umh/contracts";
import { canonicalCommandBytes, commandHash, verifyCommandSignature } from "../../server/umh/crypto";
import { validateFederatedCommandTransport } from "../../server/umh/validation";

const command = {
  protocolVersion: FEDERATION_PROTOCOL_VERSION,
  commandId: "d61f2233-992e-4da7-a072-3d19afc5ff71",
  commandType: "eos.action.propose.v1",
  issuedAt: "2026-08-03T20:00:00.000Z",
  expiresAt: "2026-08-03T20:05:00.000Z",
  nonce: "1234567890abcdef",
  idempotencyKey: "idem-1234567890abcdef",
  installationId: "eos-production",
  issuer: "https://umh.example.test",
  actor: { externalActorId: "umh_actor_123", localUserId: "user_123", delegationId: "delegation_123" },
  scope: { companyId: 7, capabilities: ["eos.action.propose.v1"] },
  trace: {
    traceId: "18d6c54a-1b35-4c45-9832-9a7bd7cf1dc2",
    correlationId: "a1f0f94f-266b-4477-943e-d14846223c99",
  },
  payload: { actionType: "create_document", agentId: "agent_123", parameters: { title: "Draft" } },
};

describe("EntrepreneurOS UMH federation contract", () => {
  it("accepts only the safe proposal capability", () => {
    expect(commandEnvelopeSchema.parse(command).commandType).toBe("eos.action.propose.v1");
    expect(commandEnvelopeSchema.safeParse({ ...command, commandType: "eos.external.send-email.v1" }).success).toBe(false);
  });

  it("canonically verifies an Ed25519 command signature", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signature = sign(null, canonicalCommandBytes(command), privateKey).toString("base64url");
    expect(verifyCommandSignature(command, signature, publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(true);
    expect(verifyCommandSignature({ ...command, nonce: "abcdef1234567890" }, signature, publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(false);
  });

  it("has a deterministic request hash regardless of object key order", () => {
    const reordered = { ...command, payload: { parameters: { title: "Draft" }, agentId: "agent_123", actionType: "create_document" } };
    expect(commandHash(command)).toBe(commandHash(reordered));
  });

  it("rejects invalid, expired, and wrongly scoped signed transports", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const config = {
      enabled: true,
      installationId: command.installationId,
      issuer: command.issuer,
      commandPublicKeyPem: publicKeyPem,
      eventEndpoint: "",
      eventPrivateKeyPem: "",
    };
    const signature = sign(null, canonicalCommandBytes(command), privateKey).toString("base64url");
    const withinWindow = Date.parse("2026-08-03T20:01:00.000Z");
    expect(() => validateFederatedCommandTransport(command as any, signature, config, withinWindow)).not.toThrow();
    expect(() => validateFederatedCommandTransport(command as any, "invalid", config, withinWindow)).toThrowError(/signature/i);
    expect(() => validateFederatedCommandTransport(command as any, signature, config, Date.parse("2026-08-03T20:06:00.000Z"))).toThrowError(/expired/i);
    expect(() => validateFederatedCommandTransport(command as any, signature, { ...config, installationId: "other" }, withinWindow)).toThrowError(/installation/i);
  });
});
