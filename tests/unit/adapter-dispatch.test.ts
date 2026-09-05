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
  quickbooks: {
    connectionSummary: vi.fn(async () => ({ configured: true, connected: true, company: { realmId: "9130354812345678", companyName: "Empyrean Studios" } })),
    verifyConnection: vi.fn(async () => ({ configured: true, connected: true, healthy: true, company: { realmId: "9130354812345678", companyName: "Empyrean Studios" } })),
    listOpenInvoices: vi.fn(async () => ({ company: { realmId: "9130354812345678", companyName: "Empyrean Studios" }, invoices: [{ id: "invoice-1", docNumber: "1001", balance: 1500, totalAmount: 1500, dueDate: "2026-09-15", txnDate: "2026-09-01", customer: { value: "customer-1" } }] })),
    createInvoice: vi.fn(async () => ({ company: { realmId: "9130354812345678", companyName: "Empyrean Studios" }, invoice: { id: "invoice-2", docNumber: "1002", totalAmount: 2500, balance: 2500, txnDate: "2026-09-04", dueDate: "2026-09-18", customer: { value: "customer-1" } } })),
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

  it("reads an accounting-company invoice projection and creates an approved invoice through the company custodian", async () => {
    const open = await dispatchAllowlistedAdapterOperation({ userId: "finance-owner", providerKey: "quickbooks", operation: "quickbooks.invoice.list_open", requestShape: { maxResults: 10 } }, clients);
    expect(open).toMatchObject({ authority: "provider_receipt", responseShape: { realmId: "9130354812345678", invoiceCount: 1 } });
    const created = await dispatchAllowlistedAdapterOperation({ userId: "finance-owner", providerKey: "quickbooks", operation: "quickbooks.invoice.create", requestShape: { customerId: "customer-1", lineItems: [{ itemId: "service-1", amount: 2500, description: "Approved recovery service" }], dueDate: "2026-09-18" } }, clients);
    expect(created).toMatchObject({ externalReference: "quickbooks:invoice:invoice-2", responseShape: { invoice: { id: "invoice-2" } } });
    expect(clients.quickbooks.createInvoice).toHaveBeenCalledWith("finance-owner", expect.objectContaining({ customerId: "customer-1" }));
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
