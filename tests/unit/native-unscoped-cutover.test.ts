import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routes = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
const clientRoot = fileURLToPath(new URL("../../client/src", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("native unscoped runtime cutover", () => {
  it("does not compile or register generic task, workflow, or conversation handlers", () => {
    for (const module of ["tasks", "workflows", "conversations"]) {
      expect(existsSync(new URL(`../../server/routes/${module}.ts`, import.meta.url))).toBe(false);
      expect(routes).not.toContain(`./routes/${module}`);
    }
    for (const registration of ["registerTaskRoutes", "registerWorkflowRoutes", "registerConversationRoutes"]) {
      expect(routes).not.toContain(registration);
    }
  });

  it("contains no client call to a retired global authority surface", () => {
    const source = sourceFiles(clientRoot).map((path) => readFileSync(path, "utf8")).join("\n");
    for (const endpoint of ["/api/agents", "/api/ai-assistant", "/api/ai/models", "/api/ai/provider-status", "/api/tasks", "/api/actions/pending", "/api/workflows", "/api/integrations/gmail", "/api/integrations/notion"]) {
      expect(source).not.toContain(endpoint);
    }
    expect(source).toContain("/api/eos/companies/");
  });

  it("keeps provider controls on the company-scoped EOS surface", () => {
    const integrationRoutes = readFileSync(new URL("../../server/routes/integrations.ts", import.meta.url), "utf8");
    expect(integrationRoutes).toContain("/api/eos/companies/:companyId/integrations/:provider/auth");
    expect(integrationRoutes).toContain("/api/eos/companies/:companyId/integrations/:provider/status");
    expect(integrationRoutes).toContain("/api/eos/companies/:companyId/integrations/:provider/disconnect");
    expect(integrationRoutes).toContain("companyAccess(req)");
    expect(integrationRoutes).toContain("authorizeAction(req, access");
  });
});
