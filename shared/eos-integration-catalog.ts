/**
 * The EOS integration catalog is deliberately about governance, not marketing.
 * Every selected provider must satisfy the same control-plane questions even
 * though the business operation is different (for example: sending an
 * agreement is not the same as reading an accounting ledger).
 */
export const eosIntegrationKeys = [
  "google_workspace",
  "notion",
  "stripe",
  "gohighlevel",
  "docusign",
  "quickbooks",
  "slack",
] as const;

export type EosIntegrationKey = (typeof eosIntegrationKeys)[number];
export type EosIntegrationCustody = "seat_oauth" | "company_vault";
export type EosIntegrationFunction = "workspace" | "knowledge" | "merchant" | "crm" | "signature" | "accounting" | "communications";

export type EosIntegrationCatalogEntry = Readonly<{
  key: EosIntegrationKey;
  name: string;
  function: EosIntegrationFunction;
  custody: EosIntegrationCustody;
  companyConnectionKey: string | null;
  providerBindingKey: string | null;
  executionBoundary: string;
  operatorBoundary: string;
  expectedControlPlanes: readonly [
    "company_scope",
    "seat_entitlement",
    "provider_identity",
    "health",
    "approval",
    "audit_receipt",
    "fallback_recovery",
  ];
}>;

const commonControls = [
  "company_scope",
  "seat_entitlement",
  "provider_identity",
  "health",
  "approval",
  "audit_receipt",
  "fallback_recovery",
] as const satisfies EosIntegrationCatalogEntry["expectedControlPlanes"];

/**
 * A single source of truth for the provider ownership model.  `seat_oauth`
 * means a person is only a credential custodian; it never gives that person
 * ownership of the company system.  `company_vault` means EOS holds only a
 * vault reference on the exact company binding, never a shared platform key.
 */
export const eosIntegrationCatalog: Readonly<Record<EosIntegrationKey, EosIntegrationCatalogEntry>> = {
  google_workspace: {
    key: "google_workspace", name: "Google Workspace", function: "workspace", custody: "seat_oauth",
    companyConnectionKey: "google_workspace", providerBindingKey: null,
    executionBoundary: "Mail and calendar writes require the entitled company role, an EOS approval, and a provider receipt.",
    operatorBoundary: "The OAuth custodian can service the connection; EOS policy decides who may use company mail, calendar, and Drive capability.",
    expectedControlPlanes: commonControls,
  },
  notion: {
    key: "notion", name: "Notion", function: "knowledge", custody: "seat_oauth",
    companyConnectionKey: "notion", providerBindingKey: null,
    executionBoundary: "EOS reads only pages explicitly shared with its integration and records bounded provider evidence.",
    operatorBoundary: "The OAuth custodian does not widen access to canonical company knowledge beyond EOS role visibility.",
    expectedControlPlanes: commonControls,
  },
  stripe: {
    key: "stripe", name: "Stripe", function: "merchant", custody: "company_vault",
    companyConnectionKey: null, providerBindingKey: "stripe",
    executionBoundary: "Merchant effects require the exact company binding, restricted vault credential, webhook signing configuration, local approval, and durable receipt.",
    operatorBoundary: "Finance and commercial roles use the company merchant capability; no individual seat receives the merchant credential.",
    expectedControlPlanes: commonControls,
  },
  gohighlevel: {
    key: "gohighlevel", name: "GoHighLevel", function: "crm", custody: "seat_oauth",
    companyConnectionKey: "gohighlevel", providerBindingKey: null,
    executionBoundary: "Contact and pipeline writes require an entitled revenue role, local approval, idempotency, and a provider receipt.",
    operatorBoundary: "The location OAuth custodian is not the owner of the company CRM or its customer records.",
    expectedControlPlanes: commonControls,
  },
  docusign: {
    key: "docusign", name: "DocuSign", function: "signature", custody: "company_vault",
    companyConnectionKey: null, providerBindingKey: "docusign",
    executionBoundary: "Agreement dispatch requires a separately verified production binding, sender and template authority, local approval, and envelope receipt reconciliation.",
    operatorBoundary: "Legal and commercial roles can request governed agreement work; managed signing credentials remain binding-scoped in the vault.",
    expectedControlPlanes: commonControls,
  },
  quickbooks: {
    key: "quickbooks", name: "QuickBooks Online", function: "accounting", custody: "seat_oauth",
    companyConnectionKey: "quickbooks", providerBindingKey: null,
    executionBoundary: "Ledger reads and invoice writes require finance entitlement, local approval for writes, exact company-file verification, and a provider receipt.",
    operatorBoundary: "The accounting OAuth custodian is not the owner of the company ledger; finance roles receive only explicit capabilities.",
    expectedControlPlanes: commonControls,
  },
  slack: {
    key: "slack", name: "Slack", function: "communications", custody: "seat_oauth",
    companyConnectionKey: "slack", providerBindingKey: null,
    executionBoundary: "Messages require a seat entitlement to the exact channel, local approval, and a durable Slack message reference.",
    operatorBoundary: "The workspace OAuth custodian does not grant company-wide communication authority; channel access remains role- and resource-specific.",
    expectedControlPlanes: commonControls,
  },
} as const;

export type IntegrationReadinessState = "ready" | "blocked" | "not_configured" | "needs_verification";

export type IntegrationReadiness = Readonly<{
  companyScope: IntegrationReadinessState;
  credentialCustody: EosIntegrationCustody;
  providerIdentity: IntegrationReadinessState;
  health: IntegrationReadinessState;
  execution: IntegrationReadinessState;
  inboundEvidence: IntegrationReadinessState;
  recovery: "ready" | "manual_fallback" | "blocked";
}>;

/**
 * This projection is intentionally conservative. A provider is never shown
 * as ready for a live effect merely because an OAuth token or binding exists.
 */
export function integrationReadiness(input: {
  catalog: EosIntegrationCatalogEntry;
  configured: boolean;
  connected: boolean;
  healthy: boolean;
  operationCount: number;
  inboundConfigured?: boolean;
  executionEnabled?: boolean;
}): IntegrationReadiness {
  const absent: IntegrationReadinessState = input.configured ? "needs_verification" : "not_configured";
  const companyScope = input.connected ? "ready" : absent;
  const identity = input.connected && input.healthy ? "ready" : input.connected ? "needs_verification" : absent;
  const health = input.connected && input.healthy ? "ready" : input.connected ? "needs_verification" : absent;
  const execution = input.connected && input.healthy && input.operationCount > 0 && input.executionEnabled === true
    ? "ready"
    : input.configured ? "blocked" : "not_configured";
  const inboundEvidence = input.inboundConfigured === true
    ? "ready"
    : input.configured ? "blocked" : "not_configured";
  return {
    companyScope,
    credentialCustody: input.catalog.custody,
    providerIdentity: identity,
    health,
    execution,
    inboundEvidence,
    recovery: input.connected ? "manual_fallback" : "blocked",
  };
}

export function integrationCatalogEntry(key: string): EosIntegrationCatalogEntry | null {
  return Object.prototype.hasOwnProperty.call(eosIntegrationCatalog, key)
    ? eosIntegrationCatalog[key as EosIntegrationKey]
    : null;
}
