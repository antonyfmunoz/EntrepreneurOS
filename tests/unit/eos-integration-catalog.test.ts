import { describe, expect, it } from "vitest";
import {
  eosIntegrationCatalog,
  eosIntegrationKeys,
  integrationReadiness,
} from "../../shared/eos-integration-catalog";

describe("EOS integration catalog", () => {
  it("holds every selected provider to the same seven control planes", () => {
    expect(eosIntegrationKeys).toEqual([
      "google_workspace", "notion", "stripe", "gohighlevel",
      "docusign", "quickbooks", "slack",
    ]);
    for (const key of eosIntegrationKeys) {
      expect(eosIntegrationCatalog[key].expectedControlPlanes).toEqual([
        "company_scope", "seat_entitlement", "provider_identity", "health",
        "approval", "audit_receipt", "fallback_recovery",
      ]);
      expect(eosIntegrationCatalog[key].executionBoundary.length).toBeGreaterThan(40);
      expect(eosIntegrationCatalog[key].operatorBoundary.length).toBeGreaterThan(40);
    }
  });

  it("keeps a connected identity blocked until live provider execution is enabled", () => {
    const readiness = integrationReadiness({
      catalog: eosIntegrationCatalog.quickbooks,
      configured: true,
      connected: true,
      healthy: true,
      operationCount: 3,
      inboundConfigured: false,
      executionEnabled: false,
    });
    expect(readiness).toMatchObject({
      companyScope: "ready",
      providerIdentity: "ready",
      health: "ready",
      execution: "blocked",
      inboundEvidence: "blocked",
      recovery: "manual_fallback",
    });
  });

  it("does not turn a saved company binding into a live provider claim", () => {
    const readiness = integrationReadiness({
      catalog: eosIntegrationCatalog.docusign,
      configured: true,
      connected: false,
      healthy: false,
      operationCount: 2,
      executionEnabled: true,
    });
    expect(readiness).toMatchObject({
      companyScope: "needs_verification",
      providerIdentity: "needs_verification",
      health: "needs_verification",
      execution: "blocked",
      recovery: "blocked",
    });
  });
});
