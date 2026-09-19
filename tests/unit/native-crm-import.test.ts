import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-crm-import-studio.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");

describe("native CRM historical migration", () => {
  it("offers a CRM-role-scoped CSV path that imports native drafts without a provider", () => {
    expect(overlay).toContain("NativeCrmImportStudio");
    expect(studio).toContain('data-testid="native-crm-import-studio"');
    expect(studio).toContain("parseContacts");
    expect(studio).toContain('conflictStrategy: "skip_existing"');
    expect(studio).toContain("legacy_company_csv");
    expect(studio).toContain("Import as native CRM drafts");
  });

  it("resolves only declared legacy contact keys into canonical person IDs inside the import transaction", () => {
    expect(runtime).toContain("crm_csv_person_reference_missing");
    expect(runtime).toContain("personObjectKey");
    expect(runtime).toContain('source.authority !== "legacy_company_csv"');
    expect(runtime).toContain('personObjectId: person.id');
  });
});
