import { describe, expect, it, vi } from "vitest";
import {
  AdapterDispatchError,
  adapterOperationIsExecutable,
  dispatchAllowlistedAdapterOperation,
  providerMatchesOperation,
} from "../../server/integrations/adapter-dispatch";

const clients = {
  gmail: {
    isConnected: vi.fn(async () => true),
    sendEmail: vi.fn(async () => ({ messageId: "gmail-message-123" })),
  },
  notion: {
    connectionSummary: vi.fn(async () => ({ configured: true, connected: true, workspace: { workspaceId: "workspace-1", workspaceName: "EOS" } })),
    verifyConnection: vi.fn(async () => ({ configured: true, connected: true, healthy: true, workspace: { workspaceId: "workspace-1", workspaceName: "EOS" } })),
    searchWorkspace: vi.fn(async () => [{ id: "page-1", object: "page", title: "Operating Brief", url: "https://notion.so/page-1", lastEditedTime: "2026-08-25T00:00:00.000Z" }]),
    readPageSnapshot: vi.fn(async () => ({ pageId: "11111111-1111-1111-1111-111111111111", url: "https://notion.so/page", title: "Operating Brief", lastEditedTime: "2026-08-25T00:00:00.000Z", boundedText: "Canonical bounded text", truncated: false })),
  },
};

describe("allowlisted adapter dispatch", () => {
  it("dispatches a validated Gmail message and retains only its durable reference", async () => {
    const result = await dispatchAllowlistedAdapterOperation({ userId: "founder", providerKey: "gmail", operation: "gmail.send", requestShape: { to: "recipient@example.test", subject: "Approved update", body: "The approved operating update." } }, clients);
    expect(result).toMatchObject({ authority: "provider_receipt", externalReference: "gmail-message-123", responseShape: { messageId: "gmail-message-123" } });
    expect(clients.gmail.sendEmail).toHaveBeenCalledWith("founder", expect.objectContaining({ to: "recipient@example.test" }));
  });

  it("returns bounded Notion search and page observations without raw page text", async () => {
    const search = await dispatchAllowlistedAdapterOperation({ userId: "founder", providerKey: "notion", operation: "notion.workspace.search", requestShape: { query: "Operating", pageSize: 10 } }, clients);
    expect(search.responseShape).toMatchObject({ resultCount: 1 });
    const page = await dispatchAllowlistedAdapterOperation({ userId: "founder", providerKey: "notion", operation: "notion.page.read_snapshot", requestShape: { pageId: "11111111-1111-1111-1111-111111111111", maxBlocks: 100 } }, clients);
    expect(page.responseShape).toHaveProperty("boundedTextSha256");
    expect(JSON.stringify(page.responseShape)).not.toContain("Canonical bounded text");
  });

  it("rejects undeclared operation namespaces and provider mismatches", async () => {
    expect(adapterOperationIsExecutable("slack.message.send")).toBe(false);
    expect(providerMatchesOperation("notion", "gmail.send")).toBe(false);
    await expect(dispatchAllowlistedAdapterOperation({ userId: "founder", providerKey: "notion", operation: "gmail.send", requestShape: { to: "recipient@example.test", subject: "Approved update", body: "Body" } }, clients)).rejects.toMatchObject({ code: "adapter_provider_mismatch" });
  });

  it("classifies ambiguous Gmail transport failures as uncertain", async () => {
    const uncertainClients = { ...clients, gmail: { ...clients.gmail, sendEmail: vi.fn(async () => { throw new Error("socket closed before response"); }) } };
    await expect(dispatchAllowlistedAdapterOperation({ userId: "founder", providerKey: "gmail", operation: "gmail.send", requestShape: { to: "recipient@example.test", subject: "Approved update", body: "Body" } }, uncertainClients)).rejects.toEqual(expect.objectContaining<Partial<AdapterDispatchError>>({ code: "provider_outcome_uncertain", outcome: "uncertain" }));
  });

  it("fails request validation before a provider client is invoked", async () => {
    const before = clients.gmail.sendEmail.mock.calls.length;
    await expect(dispatchAllowlistedAdapterOperation({ userId: "founder", providerKey: "gmail", operation: "gmail.send", requestShape: { to: "not-an-email", subject: "Bad", body: "Body" } }, clients)).rejects.toBeTruthy();
    expect(clients.gmail.sendEmail.mock.calls.length).toBe(before);
  });
});
