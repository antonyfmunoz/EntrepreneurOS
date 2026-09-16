import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const missionPage = readFileSync(new URL("../../client/src/pages/company-setup-page.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");

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
});
