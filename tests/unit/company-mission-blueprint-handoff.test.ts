import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const missionPage = readFileSync(new URL("../../client/src/pages/company-setup-page.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");
const orgStudio = readFileSync(new URL("../../client/src/pages/org-studio-page.tsx", import.meta.url), "utf8");

describe("Company Mission blueprint handoff", () => {
  it("compiles the native company blueprint immediately after the shared intake is saved", () => {
    expect(missionPage).toContain("/company-blueprint/instantiate");
    expect(missionPage).toContain("Compiling business blueprint");
    expect(missionPage).toContain("Retry blueprint compilation");
    expect(missionPage).toContain("from=mission&compiled=1");
  });

  it("uses the governed idempotent blueprint endpoint rather than an integration-first setup path", () => {
    expect(runtime).toContain('"/api/eos/companies/:companyId/company-blueprint/instantiate"');
    expect(runtime).toContain('actionKey: "company_blueprint.instantiate"');
    expect(runtime).toContain("ensureSeatOperatingKernel");
  });

  it("materializes native objectives and draft launch packets from the same company variables", () => {
    expect(runtime).toContain("compileCompanyBlueprintStarters");
    expect(runtime).toContain("createdStarterObjectiveIds");
    expect(runtime).toContain("createdStarterPacketIds");
    expect(runtime).toContain('source: "compiler"');
    expect(runtime).toContain("No external provider effect is implied by this native starter packet.");
  });

  it("links each compiled launch packet to an editable native workflow draft instead of a template label", () => {
    expect(runtime).toContain("materializeNativeWorkflowStarter");
    expect(runtime).toContain('capabilityInstanceKey: workflowCapabilityKey');
    expect(runtime).toContain("createdStarterProcessIds");
    expect(runtime).toContain("processDefinitionId: process.id");
    expect(runtime).toContain('releaseState: "draft"');
    expect(runtime).toContain("Do not transmit data to an external provider unless an explicit provider capability");
  });

  it("also creates private native tool drafts without replacing an established company's edits", () => {
    expect(runtime).toContain("materializeNativeBusinessStarters");
    expect(runtime).toContain("createdNativeAssetIds");
    expect(runtime).toContain("preservedNativeAssetIds");
    expect(runtime).toContain('state: "draft"');
    expect(runtime).toContain("Existing lifecycle controls still govern whether any form, site, or");
  });

  it("binds role labels to the same canonical native tool keys enforced by policy", () => {
    expect(runtime).toContain("canonicalToolEntitlements(role.tools)");
    expect(runtime).toContain("canonicalToolEntitlements(input.toolEntitlements)");
    expect(runtime).toContain("grant:${seat.id}:baseline");
  });

  it("lets a founder preview and explicitly apply legacy role-tool repairs without rewriting custom labels", () => {
    expect(runtime).toContain('"/api/eos/companies/:companyId/organization-runtime/tool-entitlements/reconcile"');
    expect(runtime).toContain("reconcileLegacyToolEntitlements");
    expect(runtime).toContain('action: "seat.tool_entitlements_reconciled"');
    expect(orgStudio).toContain("Keep tools and authority in sync");
    expect(orgStudio).toContain("Review role tools");
    expect(orgStudio).toContain("Apply ${roleToolChanges.length} repair");
  });
});
