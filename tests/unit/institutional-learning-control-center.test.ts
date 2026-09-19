import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/institutional-learning-control-center.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../server/routes/institutional-intelligence.ts", import.meta.url), "utf8");

describe("institutional learning operating control", () => {
  it("exposes the full postmortem-to-memory lifecycle inside the native Operations workspace", () => {
    expect(overlay).toContain("InstitutionalLearningControlCenter");
    expect(studio).toContain('data-testid="institutional-learning-control-center"');
    expect(studio).toContain("/postmortems");
    expect(studio).toContain("/learning-proposals/");
    expect(studio).toContain("Promote reviewed memory");
    expect(studio).toContain("never becomes canon by itself");
  });

  it("keeps canonical-memory decisions founder-bound on the server", () => {
    expect(routes).toContain("institutional_memory_founder_required");
    expect(routes).toContain("Only the company founder may accept, reject, or promote institutional learning.");
    expect(routes).toContain("automaticLearningApplied: false");
  });
});
