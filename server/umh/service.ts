import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  agents,
  companies,
  eosApprovalRequests,
  eosAuditRecords,
  eosSeats,
  eosWorkPackets,
  umhAuditRecords,
  umhCommands,
  umhEventOutbox,
  umhIdentityBindings,
  umhInstallations,
} from "@shared/schema";
import { commandEnvelopeSchema, type CommandEnvelope, type CommandOutcome, FEDERATION_PROTOCOL_VERSION } from "./contracts";
import { commandHash } from "./crypto";
import { federationConfig } from "./config";
import { validateFederatedCommandTransport } from "./validation";

export class FederationError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

function outcome(command: CommandEnvelope, status: CommandOutcome["status"], outcomeCode: string, result?: Record<string, unknown>): CommandOutcome {
  return {
    protocolVersion: FEDERATION_PROTOCOL_VERSION,
    commandId: command.commandId,
    status,
    outcomeCode,
    traceId: command.trace.traceId,
    correlationId: command.trace.correlationId,
    ...(result ? { result } : {}),
    occurredAt: new Date().toISOString(),
  };
}

function invalid(message: string): never {
  throw new FederationError(400, "invalid_command", message);
}

function proposalTitle(command: CommandEnvelope): string {
  const supplied = command.payload.parameters.title;
  if (typeof supplied === "string" && supplied.trim()) return supplied.trim().slice(0, 180);
  return command.payload.actionType === "create_task" ? "Review proposed task" : "Review proposed document";
}

function proposalObjective(command: CommandEnvelope): string {
  if (command.payload.description?.trim()) return command.payload.description.trim();
  return `Review the UMH-proposed ${command.payload.actionType.replace("_", " ")} request. Execute it only through canonical EOS work after local approval.`;
}

export async function acceptFederatedCommand(raw: unknown, signature: string | undefined): Promise<CommandOutcome> {
  const parsed = commandEnvelopeSchema.safeParse(raw);
  if (!parsed.success) invalid("Command envelope does not match the supported federation contract.");
  const command = parsed.data;
  const config = federationConfig();

  try {
    validateFederatedCommandTransport(command, signature, config);
  } catch (error) {
    const failure = error as { status?: number; code?: string; message?: string };
    throw new FederationError(failure.status || 400, failure.code || "invalid_command", failure.message || "Command transport validation failed.");
  }

  const installation = await db.query.umhInstallations.findFirst({
    where: and(
      eq(umhInstallations.umhInstallationId, command.installationId),
      eq(umhInstallations.issuer, command.issuer),
      eq(umhInstallations.enabled, true),
      eq(umhInstallations.companyId, command.scope.companyId),
    ),
  });
  if (!installation) throw new FederationError(403, "installation_not_active", "Installation is not enabled for the requested company.");

  const allowed = Array.isArray(installation.capabilities) && installation.capabilities.includes(command.commandType);
  if (!allowed || !command.scope.capabilities.includes(command.commandType)) {
    throw new FederationError(403, "capability_not_granted", "The command capability is not granted for this installation.");
  }

  const requestHash = commandHash(command);
  const existing = await db.query.umhCommands.findFirst({
    where: and(eq(umhCommands.installationId, installation.id), eq(umhCommands.idempotencyKey, command.idempotencyKey)),
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new FederationError(409, "idempotency_conflict", "Idempotency key was previously used for a different command.");
    }
    return existing.outcome as CommandOutcome;
  }
  const nonceSeen = await db.query.umhCommands.findFirst({
    where: and(eq(umhCommands.installationId, installation.id), eq(umhCommands.nonce, command.nonce)),
  });
  if (nonceSeen) throw new FederationError(409, "replayed_nonce", "Command nonce has already been accepted.");

  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, command.scope.companyId), eq(companies.ownerUserId, command.actor.localUserId)),
  });
  if (!company) throw new FederationError(403, "scope_not_authorized", "The delegated user is not authorized for the requested company.");
  const identityBinding = await db.query.umhIdentityBindings.findFirst({
    where: and(
      eq(umhIdentityBindings.installationId, installation.id),
      eq(umhIdentityBindings.externalActorId, command.actor.externalActorId),
      eq(umhIdentityBindings.localUserId, command.actor.localUserId),
      eq(umhIdentityBindings.delegationId, command.actor.delegationId),
      eq(umhIdentityBindings.companyId, command.scope.companyId),
      eq(umhIdentityBindings.enabled, true),
    ),
  });
  if (!identityBinding) throw new FederationError(403, "identity_binding_not_active", "External actor and delegation are not bound to the requested local authority.");
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, command.payload.agentId), eq(agents.companyId, command.scope.companyId)),
  });
  if (!agent) throw new FederationError(403, "agent_not_in_scope", "The target agent is not authorized for the requested company.");

  let founderSeat = await db.query.eosSeats.findFirst({
    where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")),
  });
  if (!founderSeat) {
    await db.insert(eosSeats).values({
      id: randomUUID(), companyId: company.id, title: "Founder / Portfolio Principal", kind: "founder",
      occupantUserId: command.actor.localUserId, agentName: company.assistantName || "Assistant", agentMode: "assistant",
      mandate: "Own portfolio direction and final local authority.", authority: { level: "owner" }, toolEntitlements: [],
    }).onConflictDoNothing();
    founderSeat = await db.query.eosSeats.findFirst({
      where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")),
    });
  }
  if (!founderSeat) throw new FederationError(500, "founder_seat_unavailable", "The company approval authority could not be resolved.");

  const workPacketId = randomUUID();
  const approvalId = randomUUID();
  const commandId = command.commandId;
  const now = new Date();

  const persistedOutcome = outcome(command, "accepted", "work_packet_proposed", {
    actionId: workPacketId,
    workPacketId,
    approvalId,
    approvalRequired: true,
  });
  try {
    await db.transaction(async (tx) => {
    await tx.insert(eosWorkPackets).values({
      id: workPacketId,
      companyId: command.scope.companyId,
      createdByUserId: command.actor.localUserId,
      accountableUserId: command.actor.localUserId,
      accountableSeatId: founderSeat.id,
      title: proposalTitle(command),
      objective: proposalObjective(command),
      status: "awaiting_approval",
      priority: command.payload.priority === "urgent" ? "critical" : command.payload.priority || "medium",
      source: "umh_federation",
      visibility: "company",
      classification: "internal",
      requiresApproval: true,
      toolPack: [{
        kind: "federation_proposal",
        capability: command.commandType,
        actionType: command.payload.actionType,
        targetAgentId: command.payload.agentId,
        parameters: command.payload.parameters,
      }],
      evidenceRequirements: command.payload.actionType === "create_document" ? ["Approved document"] : ["Task completion evidence"],
      traceId: command.trace.traceId,
      correlationId: command.trace.correlationId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(eosApprovalRequests).values({
      id: approvalId,
      companyId: command.scope.companyId,
      workPacketId,
      requestedByUserId: command.actor.localUserId,
      assignedToUserId: command.actor.localUserId,
      assignedToSeatId: founderSeat.id,
      summary: `Review UMH proposal: ${proposalTitle(command)}`,
      status: "pending",
      createdAt: now,
    });
    await tx.insert(umhCommands).values({
      id: commandId,
      installationId: installation.id,
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      nonce: command.nonce,
      requestHash,
      traceId: command.trace.traceId,
      correlationId: command.trace.correlationId,
      actorUserId: command.actor.localUserId,
      companyId: command.scope.companyId,
      workPacketId,
      approvalId,
      status: "accepted",
      outcome: persistedOutcome,
      createdAt: now,
    });
    await tx.insert(umhAuditRecords).values({
      id: randomUUID(),
      installationId: installation.id,
      commandId,
      eventType: "eos.work_packet.proposed.v1",
      traceId: command.trace.traceId,
      correlationId: command.trace.correlationId,
      actorUserId: command.actor.localUserId,
      details: { commandType: command.commandType, workPacketId, approvalId, requestHash },
      createdAt: now,
    });
    await tx.insert(eosAuditRecords).values({
      id: randomUUID(), companyId: command.scope.companyId, actorUserId: command.actor.localUserId,
      action: "federation.proposal.accepted", targetType: "work_packet", targetId: workPacketId,
      traceId: command.trace.traceId, correlationId: command.trace.correlationId, result: "awaiting_approval",
      details: { commandId, installationId: installation.id, approvalId, actionType: command.payload.actionType }, createdAt: now,
    });
    await tx.insert(umhEventOutbox).values([
      {
        id: randomUUID(), installationId: installation.id, eventType: "eos.work_packet.proposed.v1",
        payload: { workPacketId, approvalId, commandId, companyId: command.scope.companyId, trace: command.trace }, createdAt: now,
      },
      {
        id: randomUUID(), installationId: installation.id, eventType: "eos.command.outcome.v1",
        payload: persistedOutcome, createdAt: now,
      },
    ]);
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const raced = await db.query.umhCommands.findFirst({
        where: and(eq(umhCommands.installationId, installation.id), eq(umhCommands.idempotencyKey, command.idempotencyKey)),
      });
      if (raced?.requestHash === requestHash) return raced.outcome as CommandOutcome;
      throw new FederationError(409, "idempotency_conflict", "Idempotency or nonce was accepted concurrently for a different command.");
    }
    throw error;
  }

  return persistedOutcome;
}

export async function getFederatedOutcome(commandId: string): Promise<CommandOutcome | undefined> {
  const record = await db.query.umhCommands.findFirst({ where: eq(umhCommands.id, commandId) });
  return record?.outcome as CommandOutcome | undefined;
}
