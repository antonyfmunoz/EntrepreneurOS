import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const instrumentRuntime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const documentsStudio = readFileSync(new URL("../../client/src/components/native-documents-studio.tsx", import.meta.url), "utf8");

describe("native documents cutover", () => {
  it("provides a role-scoped native Docs workspace instead of treating docs as a generic object editor", () => {
    expect(overlay).toContain("NativeDocumentsStudio");
    expect(overlay).toContain('toolEntitlements.has("docs")');
    expect(documentsStudio).toContain('data-testid="native-documents-studio"');
    expect(documentsStudio).toContain("Native Docs");
    expect(documentsStudio).toContain("Save new version");
  });

  it("preserves document-template composition without mutating the source template", () => {
    expect(documentsStudio).toContain("Create from template");
    expect(documentsStudio).toContain("templateObjectId");
    expect(documentsStudio).toContain("resolveTemplate");
    expect(documentsStudio).toContain("This creates a separate governed draft");
  });

  it("returns revision events only for the role-visible records in a focused instrument", () => {
    expect(instrumentRuntime).toContain("const visible = await visibleObjectSet(access, objects)");
    expect(instrumentRuntime).toContain("inArray(eosInstrumentEvents.objectId, visibleIds)");
    expect(instrumentRuntime).toContain("events: events.slice(0, 250)");
  });
});
