import type { BackendEndpointSpec } from "@shared/spec-schema.js";
import type { TestFileSpec } from "./types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a resource name from an endpoint path.
 * /api/widgets        -> widgets
 * /api/widgets/:id    -> widgets
 * /api/user/settings  -> user-settings
 */
function deriveResourceName(endpointPath: string): string {
  // Strip leading slash, remove "api/" prefix
  const stripped = endpointPath.replace(/^\/+/, "").replace(/^api\//, "");
  // Replace path params and trailing slashes
  const cleaned = stripped
    .replace(/:[^/]+/g, "")        // remove :param segments
    .replace(/\/+/g, "-")           // slashes -> dashes
    .replace(/-+/g, "-")            // collapse multiple dashes
    .replace(/^-|-$/g, "");         // trim leading/trailing dashes
  return cleaned || "endpoint";
}

/**
 * Map HTTP method to the expected success status code.
 */
function expectedSuccessStatus(method: BackendEndpointSpec["method"]): number {
  switch (method) {
    case "POST":
      return 201;
    case "DELETE":
      return 204;
    default:
      return 200;
  }
}

/**
 * Build the supertest request chain for a given method + path.
 * For POST/PUT/PATCH with a requestBody, appends .send({...}).
 */
function buildRequestChain(
  endpoint: BackendEndpointSpec,
  appVar: string
): string {
  const methodLower = endpoint.method.toLowerCase();
  const base = `request(${appVar}).${methodLower}("${endpoint.path}")`;

  const withBody = ["POST", "PUT", "PATCH"].includes(endpoint.method);
  if (withBody && endpoint.requestBody.length > 0) {
    const fields = endpoint.requestBody
      .map((f) => `${f}: "test-${f}"`)
      .join(", ");
    return `${base}.send({ ${fields} })`;
  }

  return base;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generate a complete Vitest integration test file for a single backend endpoint.
 *
 * Per D-12: fires real HTTP against Express via supertest, uses auth mock middleware
 * injected before routes, and covers the unauthenticated (401) case and the
 * authenticated success case.
 */
export function generateIntegrationTest(
  endpoint: BackendEndpointSpec
): TestFileSpec {
  const resourceName = deriveResourceName(endpoint.path);
  const filePath = `tests/integration/backend/${resourceName}.integration.test.ts`;
  const successStatus = expectedSuccessStatus(endpoint.method);
  const methodLower = endpoint.method.toLowerCase();

  const authedRequest = buildRequestChain(endpoint, "authApp");
  const unauthedRequest = buildRequestChain(endpoint, "app");

  let content: string;

  if (endpoint.authRequired) {
    content = `import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../../../server/routes.js";

describe("${endpoint.method} ${endpoint.path}", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    // Auth mock middleware — unauthenticated, injected before routes
    app.use((req: any, _res: any, next: any) => {
      req.isAuthenticated = () => false;
      req.user = null;
      next();
    });
    await registerRoutes(app);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await ${unauthedRequest};
    expect(res.status).toBe(401);
  });

  it("returns ${successStatus} with authenticated session", async () => {
    // Override auth for this test — injects authenticated user before routes
    const authApp = express();
    authApp.use(express.json());
    authApp.use((req: any, _res: any, next: any) => {
      req.isAuthenticated = () => true;
      req.user = { id: "test-user-id" };
      next();
    });
    await registerRoutes(authApp);

    const res = await ${authedRequest};
    expect(res.status).toBe(${successStatus});
  });
});
`;
  } else {
    // authRequired=false — skip 401 test, only generate success test
    const noAuthRequest = buildRequestChain(endpoint, "app");
    content = `import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../../../server/routes.js";

describe("${endpoint.method} ${endpoint.path}", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    // No auth middleware needed — endpoint is public
    await registerRoutes(app);
  });

  it("returns ${successStatus} without authentication", async () => {
    const res = await ${noAuthRequest};
    expect(res.status).toBe(${successStatus});
  });
});
`;
  }

  return { filePath, content };
}
