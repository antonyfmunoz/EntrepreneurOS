import { createHash } from "node:crypto";
import {
  executableAdapterOperations,
  gmailSendRequestSchema,
  notionPageReadSnapshotRequestSchema,
  notionWorkspaceSearchRequestSchema,
  notionWorkspaceVerifyRequestSchema,
  quickbooksCompanyVerifyRequestSchema,
  quickbooksCreateInvoiceRequestSchema,
  quickbooksOpenInvoicesRequestSchema,
  slackConversationsListRequestSchema,
  slackMessageSendRequestSchema,
  slackWorkspaceVerifyRequestSchema,
} from "@shared/integration-operations";
import * as gmail from "./gmail";
import * as notion from "./notion";
import * as quickbooks from "./quickbooks";
import * as slack from "./slack";

export type AdapterDispatchResult = {
  authority: "provider_receipt";
  externalReference: string;
  summary: string;
  responseShape: Record<string, unknown>;
};

export type AdapterDispatchClients = {
  gmail: Pick<typeof gmail, "isConnected" | "sendEmail">;
  notion: Pick<typeof notion, "connectionSummary" | "verifyConnection" | "searchWorkspace" | "readPageSnapshot">;
  quickbooks: Pick<typeof quickbooks, "connectionSummary" | "verifyConnection" | "listOpenInvoices" | "createInvoice">;
  slack: Pick<typeof slack, "connectionSummary" | "verifyConnection" | "listConversations" | "sendMessage">;
};

const liveClients: AdapterDispatchClients = { gmail, notion, quickbooks, slack };
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
  if (operation.startsWith("quickbooks.")) return provider === "quickbooks";
  if (operation.startsWith("slack.")) return provider === "slack";
  return false;
}

export function validateAdapterOperationRequest(operation: string, requestShape: unknown) {
  if (operation === "gmail.send") return gmailSendRequestSchema.parse(requestShape);
  if (operation === "notion.workspace.verify") return notionWorkspaceVerifyRequestSchema.parse(requestShape);
  if (operation === "notion.workspace.search") return notionWorkspaceSearchRequestSchema.parse(requestShape);
  if (operation === "notion.page.read_snapshot") return notionPageReadSnapshotRequestSchema.parse(requestShape);
  if (operation === "quickbooks.company.verify") return quickbooksCompanyVerifyRequestSchema.parse(requestShape);
  if (operation === "quickbooks.invoice.list_open") return quickbooksOpenInvoicesRequestSchema.parse(requestShape);
  if (operation === "quickbooks.invoice.create") return quickbooksCreateInvoiceRequestSchema.parse(requestShape);
  if (operation === "slack.workspace.verify") return slackWorkspaceVerifyRequestSchema.parse(requestShape);
  if (operation === "slack.conversations.list") return slackConversationsListRequestSchema.parse(requestShape);
  if (operation === "slack.message.send") return slackMessageSendRequestSchema.parse(requestShape);
  throw new AdapterDispatchError("adapter_operation_not_executable", "This operation has no audited native dispatcher.");
}

function providerFailure(error: unknown, operation: string): AdapterDispatchError {
  if (error instanceof AdapterDispatchError) return error;
  const value = error as any;
  const status = Number(value?.code || value?.status || value?.response?.status || 0);
  const message = error instanceof Error ? error.message : "Provider request failed.";
  const mutating = operation === "gmail.send" || operation === "quickbooks.invoice.create" || operation === "slack.message.send";
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
    if (input.operation === "quickbooks.company.verify") {
      quickbooksCompanyVerifyRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.quickbooks.verifyConnection(input.userId);
      if (!result.connected || !result.healthy || !result.company?.realmId) throw new AdapterDispatchError("quickbooks_authorization_unhealthy", "QuickBooks authorization is unavailable or unhealthy.");
      return { authority: "provider_receipt", externalReference: `quickbooks:company:${result.company.realmId}`, summary: "QuickBooks Online confirmed the company accounting authorization is healthy.", responseShape: { realmId: result.company.realmId, companyName: result.company.companyName || null } };
    }
    if (input.operation === "quickbooks.invoice.list_open") {
      const request = quickbooksOpenInvoicesRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.quickbooks.listOpenInvoices(input.userId, request.maxResults);
      const responseSha256 = createHash("sha256").update(JSON.stringify(result.invoices)).digest("hex");
      return { authority: "provider_receipt", externalReference: `quickbooks:open-invoices:${responseSha256}`, summary: `QuickBooks returned ${result.invoices.length} bounded open invoice record${result.invoices.length === 1 ? "" : "s"}.`, responseShape: { realmId: result.company.realmId, companyName: result.company.companyName || null, invoiceCount: result.invoices.length, invoices: result.invoices, responseSha256 } };
    }
    if (input.operation === "quickbooks.invoice.create") {
      const request = quickbooksCreateInvoiceRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.quickbooks.createInvoice(input.userId, request);
      return { authority: "provider_receipt", externalReference: `quickbooks:invoice:${result.invoice.id}`, summary: "QuickBooks created the approved invoice and returned its durable invoice reference.", responseShape: { realmId: result.company.realmId, companyName: result.company.companyName || null, invoice: result.invoice } };
    }
    if (input.operation === "slack.workspace.verify") {
      slackWorkspaceVerifyRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.slack.verifyConnection(input.userId);
      if (!result.connected || !result.healthy || !result.workspace?.teamId) throw new AdapterDispatchError("slack_authorization_unhealthy", "Slack authorization is unavailable or unhealthy.");
      return { authority: "provider_receipt", externalReference: `slack:workspace:${result.workspace.teamId}`, summary: "Slack confirmed the connected company workspace authorization is healthy.", responseShape: { teamId: result.workspace.teamId, teamName: result.workspace.teamName || null, botUserId: result.workspace.botUserId || null } };
    }
    if (input.operation === "slack.conversations.list") {
      const request = slackConversationsListRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.slack.listConversations(input.userId, request.limit);
      const responseSha256 = createHash("sha256").update(JSON.stringify(result.channels)).digest("hex");
      return { authority: "provider_receipt", externalReference: `slack:conversations:${result.workspace.teamId}:${responseSha256}`, summary: `Slack returned ${result.channels.length} bounded channel metadata record${result.channels.length === 1 ? "" : "s"}.`, responseShape: { teamId: result.workspace.teamId, teamName: result.workspace.teamName || null, channelCount: result.channels.length, channels: result.channels, nextCursor: result.nextCursor, responseSha256 } };
    }
    if (input.operation === "slack.message.send") {
      const request = slackMessageSendRequestSchema.parse(validateAdapterOperationRequest(input.operation, input.requestShape));
      const result = await clients.slack.sendMessage(input.userId, request);
      return { authority: "provider_receipt", externalReference: `slack:message:${result.message.channelId}:${result.message.ts}`, summary: "Slack accepted the approved company message and returned its durable message reference.", responseShape: { teamId: result.workspace.teamId, teamName: result.workspace.teamName || null, message: result.message } };
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
