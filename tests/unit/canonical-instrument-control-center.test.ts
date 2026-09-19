import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlCenter = readFileSync(new URL("../../client/src/components/canonical-instrument-control-center.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");

describe("canonical instrument relationship map", () => {
  it("renders the real governed graph with named related records instead of opaque IDs", () => {
    expect(controlCenter).toContain('data-testid="canonical-instrument-relationship-map"');
    expect(controlCenter).toContain("Relationship map");
    expect(controlCenter).toContain("instrumentObjectLabel(connected)");
    expect(controlCenter).toContain("humanizeRelationship(link.relationshipType)");
  });

  it("lets an operator traverse only records already included in the role-scoped result", () => {
    expect(controlCenter).toContain("focusLinkedObject(connected)");
    expect(controlCenter).toContain("The related record is unavailable in your current role scope.");
    expect(runtime).toContain("inArray(eosInstrumentLinks.sourceObjectId, visibleIds), inArray(eosInstrumentLinks.targetObjectId, visibleIds)");
  });
});
