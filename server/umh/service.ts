import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  type AgentAction,
  agentActions,
  agents,
  companies,
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

  const actionId = `action_${randomUUID()}`;
  const commandId = command.commandId;
  const now = new Date();

  const persistedOutcome = outcome(command, "accepted", "action_proposed", { actionId, approvalRequired: true });
  try {
    await db.transaction(async (tx) => {
    await tx.insert(agentActions).values({
      id: actionId,
      agentId: command.payload.agentId,
      userId: command.actor.localUserId,
      companyId: command.scope.companyId,
      actionType: command.payload.actionType,
      actionName: command.payload.actionType,
      description: command.payload.description || null,
      parameters: command.payload.parameters,
      status: "pending",
      // This first bridge slice creates a local proposal only. It never executes side effects.
      requiresApproval: true,
      priority: command.payload.priority || "medium",
      metadata: { umhCommandId: commandId, delegationId: command.actor.delegationId },
      createdAt: now,
      updatedAt: now,
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
      status: "accepted",
      outcome: persistedOutcome,
      createdAt: now,
    });
    await tx.insert(umhAuditRecords).values({
      id: randomUUID(),
      installationId: installation.id,
      commandId,
      eventType: "eos.command.accepted.v1",
      traceId: command.trace.traceId,
      correlationId: command.trace.correlationId,
      actorUserId: command.actor.localUserId,
      details: { commandType: command.commandType, actionId, requestHash },
      createdAt: now,
    });
    await tx.insert(umhEventOutbox).values([
      {
        id: randomUUID(), installationId: installation.id, eventType: "eos.action.proposed.v1",
        payload: { actionId, commandId, companyId: command.scope.companyId, trace: command.trace }, createdAt: now,
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

/** Append federation evidence for a locally decided/executed action. No caller
 * can mutate command history or deliver directly to UMH; the outbox owns it. */
export async function recordFederatedActionEvent(
  action: AgentAction,
  eventType: "eos.approval.decided.v1" | "eos.action.completed.v1" | "eos.action.failed.v1",
  details: Record<string, unknown>,
): Promise<void> {
  const commandId = (action.metadata as Record<string, unknown> | null)?.umhCommandId;
  if (typeof commandId !== "string") return;
  const command = await db.query.umhCommands.findFirst({ where: eq(umhCommands.id, commandId) });
  if (!command) return;
  const now = new Date();
  const terminalStatus: CommandOutcome["status"] | undefined = eventType === "eos.action.completed.v1"
    ? "completed"
    : eventType === "eos.action.failed.v1"
      ? "failed"
      : eventType === "eos.approval.decided.v1" && details.decision === "rejected"
        ? "rejected"
        : undefined;
  const terminalOutcome = terminalStatus ? {
    protocolVersion: FEDERATION_PROTOCOL_VERSION,
    commandId,
    status: terminalStatus,
    outcomeCode: terminalStatus === "completed" ? "action_completed" : terminalStatus === "failed" ? "action_failed" : "approval_rejected",
    traceId: command.traceId,
    correlationId: command.correlationId,
    result: { actionId: action.id },
    occurredAt: now.toISOString(),
  } satisfies CommandOutcome : undefined;
  await db.transaction(async (tx) => {
    await tx.insert(umhAuditRecords).values({
      id: randomUUID(), installationId: command.installationId, commandId,
      eventType, traceId: command.traceId, correlationId: command.correlationId,
      actorUserId: action.userId, details, createdAt: now,
    });
    await tx.insert(umhEventOutbox).values({
      id: randomUUID(), installationId: command.installationId, eventType,
      payload: { commandId, actionId: action.id, status: action.status, details, traceId: command.traceId, correlationId: command.correlationId },
      createdAt: now,
    });
    if (terminalOutcome) {
      await tx.update(umhCommands).set({ status: terminalOutcome.status, outcome: terminalOutcome, completedAt: now }).where(eq(umhCommands.id, commandId));
      await tx.insert(umhEventOutbox).values({
        id: randomUUID(), installationId: command.installationId, eventType: "eos.command.outcome.v1",
        payload: terminalOutcome, createdAt: now,
      });
    }
  });
}
