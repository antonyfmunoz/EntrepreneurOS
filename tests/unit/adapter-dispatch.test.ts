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
  slack: {
    connectionSummary: vi.fn(async () => ({ configured: true, connected: true, workspace: { teamId: "T12345678", teamName: "Empyrean Studios" } })),
    verifyConnection: vi.fn(async () => ({ configured: true, connected: true, healthy: true, workspace: { teamId: "T12345678", teamName: "Empyrean Studios", botUserId: "U12345678" } })),
    listConversations: vi.fn(async () => ({ workspace: { teamId: "T12345678", teamName: "Empyrean Studios" }, channels: [{ id: "C12345678", name: "operations", isPrivate: false, isMember: true }], nextCursor: null })),
    sendMessage: vi.fn(async () => ({ workspace: { teamId: "T12345678", teamName: "Empyrean Studios" }, message: { channelId: "C12345678", ts: "1735689600.000100", threadTs: null } })),
  },
  gohighlevel: {
    connectionSummary: vi.fn(async () => ({ configured: true, connected: true, location: { locationId: "location-1" } })),
    verifyConnection: vi.fn(async () => ({ configured: true, connected: true, healthy: true, location: { locationId: "location-1", companyId: "company-1" }, grantedScopes: ["contacts.readonly", "contacts.write", "opportunities.readonly", "opportunities.write"] })),
    lookupContact: vi.fn(async () => ({ locationId: "location-1", contacts: [{ id: "contact-1", email: "client@example.test" }] })),
    upsertContact: vi.fn(async () => ({ locationId: "location-1", contact: { id: "contact-1", email: "client@example.test" } })),
    searchOpportunities: vi.fn(async () => ({ locationId: "location-1", opportunities: [{ id: "opportunity-1", name: "Recovery offer", status: "open" }] })),
    createOpportunity: vi.fn(async () => ({ locationId: "location-1", opportunity: { id: "opportunity-2", name: "Approved recovery offer", status: "open" } })),
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

  it("lists bounded channel metadata and sends an approved company message", async () => {
    const listed = await dispatchAllowlistedAdapterOperation({ userId: "operations-owner", providerKey: "slack", operation: "slack.conversations.list", requestShape: { limit: 20 } }, clients);
    expect(listed).toMatchObject({ externalReference: expect.stringContaining("slack:conversations:T12345678"), responseShape: { channelCount: 1 } });
    const sent = await dispatchAllowlistedAdapterOperation({ userId: "operations-owner", providerKey: "slack", operation: "slack.message.send", requestShape: { channelId: "C12345678", text: "Approved operating update." } }, clients);
    expect(sent).toMatchObject({ externalReference: "slack:message:C12345678:1735689600.000100" });
    expect(clients.slack.sendMessage).toHaveBeenCalledWith("operations-owner", expect.objectContaining({ channelId: "C12345678" }));
  });
  it("keeps CRM reads and approved CRM writes in the attached company location", async () => {
    const lookup = await dispatchAllowlistedAdapterOperation({ userId: "revenue-owner", providerKey: "gohighlevel", operation: "gohighlevel.contact.lookup", requestShape: { email: "client@example.test" } }, clients);
    expect(lookup).toMatchObject({ responseShape: { locationId: "location-1", contactCount: 1 } });
    const opportunity = await dispatchAllowlistedAdapterOperation({ userId: "revenue-owner", providerKey: "gohighlevel", operation: "gohighlevel.opportunity.create", requestShape: { pipelineId: "pipeline-1", contactId: "contact-1", name: "Approved recovery offer", status: "open", monetaryValue: 2500 } }, clients);
    expect(opportunity).toMatchObject({ externalReference: "gohighlevel:opportunity:opportunity-2", responseShape: { locationId: "location-1" } });
  });

  it("rejects undeclared operation namespaces and provider mismatches", async () => {
    expect(adapterOperationIsExecutable("slack.message.send")).toBe(true);
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
