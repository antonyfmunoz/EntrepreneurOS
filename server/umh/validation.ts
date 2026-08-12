import type { FederationConfig } from "./config";
import { federationConfigured } from "./config";
import type { CommandEnvelope } from "./contracts";
import { verifyCommandSignature } from "./crypto";

export interface FederationValidationFailure extends Error {
  status: number;
  code: string;
}

function failure(status: number, code: string, message: string): never {
  const error = new Error(message) as FederationValidationFailure;
  error.status = status;
  error.code = code;
  throw error;
}

export function validateFederatedCommandTransport(
  command: CommandEnvelope,
  signature: string | undefined,
  config: FederationConfig,
  nowMs = Date.now(),
): void {
  if (!federationConfigured(config)) failure(503, "federation_unavailable", "EntrepreneurOS federation is not configured.");
  if (!signature || !verifyCommandSignature(command, signature, config.commandPublicKeyPem)) failure(401, "invalid_signature", "Command signature could not be verified.");
  if (command.installationId !== config.installationId || command.issuer !== config.issuer) failure(403, "unrecognized_installation", "Command installation or issuer is not authorized.");
  if (Date.parse(command.expiresAt) <= nowMs || Date.parse(command.issuedAt) > nowMs + 60_000) failure(401, "expired_command", "Command is expired or issued too far in the future.");
}
