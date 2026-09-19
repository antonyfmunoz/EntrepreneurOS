import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");

describe("instrument record visibility", () => {
  it("requires record-level role visibility in addition to a tool grant for generic writes", () => {
    expect(runtime).toContain("instrument_parent_unavailable");
    expect(runtime).toContain("instrument_object_unavailable");
    expect(runtime).toContain("instrument_link_source_unavailable");
    expect(runtime).toContain("instrument_link_target_unavailable");
  });

  it("does not treat a tool-level read grant as permission to link a hidden record", () => {
    const links = runtime.slice(runtime.indexOf('app.post("/api/eos/companies/:companyId/instrument-links"'));
    expect(links).toContain("visibleObjectSet(access, [source])");
    expect(links).toContain("visibleObjectSet(targetAccess.access, [target])");
  });
});
