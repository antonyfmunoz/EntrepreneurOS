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
});
