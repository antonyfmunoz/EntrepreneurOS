import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../../server/middleware/api-security.ts", import.meta.url), "utf8");
const canonicalRuntime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");

describe("native communication authority cutover", () => {
  it("does not register legacy global agent or assistant route modules", () => {
    expect(routes).not.toContain("registerAIRoutes");
    expect(routes).not.toContain("registerAgentRoutes");
    expect(routes).not.toContain('from "./routes/ai"');
    expect(routes).not.toContain('from "./routes/agents"');
  });

  it("keeps stable tombstones for every legacy communication escape hatch", () => {
    for (const path of ["agents", "ai-assistant", "/ai/models", "/ai/provider-status", "/ai/multi-agent", "/llm/chat", "/keys/save"]) {
      expect(security).toContain(path);
    }
    expect(security).toContain("/api/eos/companies/:companyId/executive-assistant/messages");
    expect(security).toContain("sunset: true");
  });

  it("retains the role-scoped EA and Role-Agent runtime as the sole chat authority", () => {
    expect(canonicalRuntime).toContain('"/api/eos/companies/:companyId/executive-assistant/messages"');
    expect(canonicalRuntime).toContain("sole founder-facing communication channel");
    expect(canonicalRuntime).toContain("Respect the reporting chain");
  });
});
