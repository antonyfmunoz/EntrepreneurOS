import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync(new URL("../../client/src/components/lead-capture-studio.tsx", import.meta.url), "utf8");

describe("native lead capture controls", () => {
  it("keeps compiled and user-created forms editable through the native governed surface", () => {
    expect(studio).toContain("Edit native intake point");
    expect(studio).toContain("Save new version");
    expect(studio).toContain("lead-form-save");
    expect(studio).toContain("expectedVersion: editingForm.version");
    expect(studio).toContain("nativeObjectId");
  });
});
