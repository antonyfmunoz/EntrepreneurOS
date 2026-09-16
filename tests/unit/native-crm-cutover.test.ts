import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const crmStudio = readFileSync(new URL("../../client/src/components/native-crm-studio.tsx", import.meta.url), "utf8");
const instrumentRuntime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");

describe("native relationship CRM cutover", () => {
  it("gives CRM to the founder or a role explicitly equipped with the CRM tool", () => {
    expect(overlay).toContain("NativeCrmStudio");
    expect(overlay).toContain('toolEntitlements.has("crm")');
    expect(overlay).toContain("mayOperateNativeCrm");
    expect(crmStudio).toContain('data-testid="native-crm-studio"');
    expect(instrumentRuntime).toContain("toolKey: key");
  });

  it("keeps people, relationships, facets, pipelines, and opportunities as governed CRM records", () => {
    expect(crmStudio).toContain('objectType: "person"');
    expect(crmStudio).toContain('objectType: "relationship"');
    expect(crmStudio).toContain('objectType: "facet"');
    expect(crmStudio).toContain('objectType: "pipeline"');
    expect(crmStudio).toContain('objectType: "opportunity"');
    expect(crmStudio).toContain("has_relationship");
    expect(crmStudio).toContain("contains_opportunity");
  });

  it("provides a native pipeline board with recorded opportunity movement rather than a provider-only shell", () => {
    expect(crmStudio).toContain("Relationship and pipeline board");
    expect(crmStudio).toContain("moveOpportunity");
    expect(crmStudio).toContain("expectedVersion: opportunity.version");
    expect(crmStudio).toContain("A connected CRM can reconcile here later");
  });
});
