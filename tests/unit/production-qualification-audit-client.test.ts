import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../.github/workflows/production-qualification.yml", import.meta.url), "utf8");

describe("production qualification dependency audit client", () => {
  it("uses a maintained npm client before the fail-closed vulnerability gate", () => {
    const client = workflow.indexOf("npm install --global npm@11.9.0");
    const audit = workflow.indexOf("npm audit --omit=dev --audit-level=high");
    expect(client).toBeGreaterThan(-1);
    expect(audit).toBeGreaterThan(client);
    expect(workflow).toContain("npm audit --audit-level=high");
  });
});
