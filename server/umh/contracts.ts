import { z } from "zod";

export const FEDERATION_PROTOCOL_VERSION = "umh.federation.v1";

export const commandEnvelopeSchema = z.object({
  protocolVersion: z.literal(FEDERATION_PROTOCOL_VERSION),
  commandId: z.string().uuid(),
  commandType: z.literal("eos.action.propose.v1"),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  nonce: z.string().min(16).max(256),
  idempotencyKey: z.string().min(16).max(256),
  installationId: z.string().min(1).max(128),
  issuer: z.string().url(),
  actor: z.object({
    externalActorId: z.string().min(1).max(256),
    localUserId: z.string().min(1),
    delegationId: z.string().min(1),
  }),
  scope: z.object({
    companyId: z.number().int().positive(),
    capabilities: z.array(z.literal("eos.action.propose.v1")).min(1),
  }),
  trace: z.object({
    traceId: z.string().uuid(),
    correlationId: z.string().uuid(),
  }),
  payload: z.object({
    actionType: z.enum(["create_task", "create_document"]),
    agentId: z.string().min(1),
    parameters: z.record(z.unknown()),
    description: z.string().max(2000).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  }),
}).strict();

export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

export const commandOutcomeSchema = z.object({
  protocolVersion: z.literal(FEDERATION_PROTOCOL_VERSION),
  commandId: z.string().uuid(),
  status: z.enum(["accepted", "rejected", "completed", "failed"]),
  outcomeCode: z.string(),
  traceId: z.string().uuid(),
  correlationId: z.string().uuid(),
  result: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime(),
});

export type CommandOutcome = z.infer<typeof commandOutcomeSchema>;

export function capabilityManifest(enabled: boolean) {
  return {
    protocolVersion: FEDERATION_PROTOCOL_VERSION,
    projection: { id: "entrepreneuros", name: "EntrepreneurOS" },
    enabled,
    commandEndpoint: "/api/umh/v1/commands",
    outcomeEndpoint: "/api/umh/v1/outcomes/:commandId",
    capabilities: [
      {
        name: "eos.action.propose.v1",
        risk: "internal_draft",
        requiresLocalApproval: true,
        actionTypes: ["create_task", "create_document"],
      },
    ],
    eventTypes: ["eos.work_packet.proposed.v1", "eos.approval.decided.v1", "eos.command.outcome.v1"],
  };
}
