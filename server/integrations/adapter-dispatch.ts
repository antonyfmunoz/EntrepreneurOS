import { createHash } from "node:crypto";
import {
  executableAdapterOperations,
  gmailSendRequestSchema,
  notionPageReadSnapshotRequestSchema,
  notionWorkspaceSearchRequestSchema,
  notionWorkspaceVerifyRequestSchema,
} from "@shared/integration-operations";
import * as gmail from "./gmail";
import * as notion from "./notion";

export type AdapterDispatchResult = {
  authority: "provider_receipt";
  externalReference: string;
  summary: string;
  responseShape: Record<string, unknown>;
};

export type AdapterDispatchClients = {
  gmail: Pick<typeof gmail, "isConnected" | "sendEmail">;
  notion: Pick<typeof notion, "connectionSummary" | "verifyConnection" | "searchWorkspace" | "readPageSnapshot">;
};

const liveClients: AdapterDispatchClients = { gmail, notion };
const operations = new Set<string>(executableAdapterOperations);

export class AdapterDispatchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly outcome: "failed" | "uncertain" = "failed",
  ) { super(message); }
}

export function adapterOperationIsExecutable(operation: string): boolean {
  return operations.has(operation);
}

export function providerMatchesOperation(providerKey: string, operation: string): boolean {
  const provider = providerKey.trim().toLowerCase().replaceAll("-", "_");
  if (operation.startsWith("gmail.")) return ["gmail", "google", "google_workspace"].includes(provider);
  if (operation.startsWith("notion.")) return provider === "notion";
  return false;
}

export function validateAdapterOperationRequest(operation: string, requestShape: unknown) {
  if (operation === "gmail.send") return gmailSendRequestSchema.parse(requestShape);
  if (operation === "notion.workspace.verify") return notionWorkspaceVerifyRequestSchema.parse(requestShape);
  if (operation === "notion.workspace.search") return notionWorkspaceSearchRequestSchema.parse(requestShape);
  if (operation === "notion.page.read_snapshot") return notionPageReadSnapshotRequestSchema.parse(requestShape);
  throw new AdapterDispatchError("adapter_operation_not_executable", "This operation has no audited native dispatcher.");
}

function providerFailure(error: unknown, operation: string): AdapterDispatchError {
  if (error instanceof AdapterDispatchError) return error;
  const value = error as any;
  const status = Number(value?.code || value?.status || value?.response?.status || 0);
  const message = error instanceof Error ? error.message : "Provider request failed.";
  const mutating = operation === "gmail.send";
  const uncertain = mutating && (!status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500 || value?.name === "AbortError");
  return new AdapterDispatchError(uncertain ? "provider_outcome_uncertain" : "provider_request_failed", message.slice(0, 1000), uncertain ? "uncertain" : "failed");
}

export async function dispatchAllowlistedAdapterOperation(input: {
  userId: string;
  providerKey: string;
  operation: string;
  requestShape: unknown;
}, clients: AdapterDispatchClients = liveClients): Promise<AdapterDispatchResult> {
  if (!adapterOperationIsExecutable(input.operation)) throw new AdapterDispatchError("adapter_operation_not_executable", "This operation has no audited native dispatcher.");
  if (!providerMatchesOperation(input.providerKey, input.operation)) throw new AdapterDispatchError("adapter_provider_mismatch", "The integration provider does not own the requested operation namespace.");

  try {
    if (input.operation === "gmail.send") {
      const request = gmailSendRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      if (!(await clients.gmail.isConnected(input.userId))) throw new AdapterDispatchError("gmail_authorization_unavailable", "The current operator has no healthy Gmail authorization.");
      const receipt = await clients.gmail.sendEmail(input.userId, request);
      if (!receipt.messageId?.trim()) throw new AdapterDispatchError("gmail_receipt_missing", "Gmail returned no durable message reference.", "uncertain");
      return { authority: "provider_receipt", externalReference: receipt.messageId, summary: "Gmail accepted the approved message and returned a durable provider message reference.", responseShape: { messageId: receipt.messageId } };
    }
    if (input.operation === "notion.workspace.verify") {
      notionWorkspaceVerifyRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.notion.verifyConnection(input.userId);
      if (!result.connected || !result.healthy) throw new AdapterDispatchError("notion_authorization_unhealthy", "Notion authorization is unavailable or unhealthy.");
      const workspaceId = result.workspace?.workspaceId || "connected-workspace";
      return { authority: "provider_receipt", externalReference: `notion:workspace:${workspaceId}`, summary: "Notion confirmed the connected workspace authorization is healthy.", responseShape: { connected: true, healthy: true, workspaceId, workspaceName: result.workspace?.workspaceName || null } };
    }
    if (input.operation === "notion.workspace.search") {
      const request = notionWorkspaceSearchRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const connection = await clients.notion.connectionSummary(input.userId);
      if (!connection.connected) throw new AdapterDispatchError("notion_authorization_unavailable", "The current operator has no connected Notion workspace.");
      const results = await clients.notion.searchWorkspace(input.userId, request.query, request.pageSize);
      const responseSha256 = createHash("sha256").update(JSON.stringify(results)).digest("hex");
      return { authority: "provider_receipt", externalReference: `notion:search:${responseSha256}`, summary: `Notion returned ${results.length} bounded workspace search result${results.length === 1 ? "" : "s"}.`, responseShape: { resultCount: results.length, results, responseSha256 } };
    }
    const request = notionPageReadSnapshotRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
    const connection = await clients.notion.connectionSummary(input.userId);
    if (!connection.connected) throw new AdapterDispatchError("notion_authorization_unavailable", "The current operator has no connected Notion workspace.");
    const snapshot = await clients.notion.readPageSnapshot(input.userId, request.pageId, request.maxBlocks);
    const boundedTextSha256 = createHash("sha256").update(snapshot.boundedText).digest("hex");
    return { authority: "provider_receipt", externalReference: `notion:page:${snapshot.pageId}:${snapshot.lastEditedTime}`, summary: `Notion returned the bounded ${snapshot.title} page snapshot at its declared provider revision.`, responseShape: { pageId: snapshot.pageId, url: snapshot.url, title: snapshot.title, lastEditedTime: snapshot.lastEditedTime, boundedTextSha256, truncated: snapshot.truncated } };
  } catch (error) {
    throw providerFailure(error, input.operation);
  }
}
