import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const crmStudio = readFileSync(new URL("../../client/src/components/native-crm-studio.tsx", import.meta.url), "utf8");

describe("native CRM record controls", () => {
  it("keeps people, relationships, and opportunities configurable with version protection", () => {
    expect(crmStudio).toContain("Configure selected person");
    expect(crmStudio).toContain("crm-person-configure");
    expect(crmStudio).toContain("expectedVersion: selectedPerson.version");
    expect(crmStudio).toContain("Configure selected relationship");
    expect(crmStudio).toContain("crm-relationship-configure");
    expect(crmStudio).toContain("expectedVersion: selectedRelationship.version");
    expect(crmStudio).toContain("Configure selected opportunity");
    expect(crmStudio).toContain("crm-opportunity-configure");
    expect(crmStudio).toContain("expectedVersion: selectedOpportunity.version");
  });
});
