import { describe, it, expect } from "vitest";
import { generateIntegrationTest } from "../../../lib/test-runner/test-generator.js";
import type { BackendEndpointSpec } from "@shared/spec-schema.js";

describe("generateIntegrationTest", () => {
  it("generates correct file path from endpoint path", () => {
    const endpoint: BackendEndpointSpec = {
      method: "GET",
      path: "/api/widgets",
      description: "List all widgets",
      requestBody: [],
      responseFields: ["id", "name"],
      authRequired: true,
      source: "explicit",
    };

    const result = generateIntegrationTest(endpoint);
    expect(result.filePath).toBe(
      "tests/integration/backend/widgets.integration.test.ts"
    );
  });

  it("GET with authRequired=true produces 401 unauthenticated and 200 authenticated tests", () => {
    const endpoint: BackendEndpointSpec = {
      method: "GET",
      path: "/api/widgets",
      description: "List all widgets",
      requestBody: [],
      responseFields: ["id", "name"],
      authRequired: true,
      source: "explicit",
    };

    const result = generateIntegrationTest(endpoint);
    const content = result.content;

    // describe block
    expect(content).toContain('describe("GET /api/widgets"');
    // uses supertest
    expect(content).toContain('request(app).get("/api/widgets")');
    // 401 test for unauthenticated
    expect(content).toContain("expect(res.status).toBe(401)");
    // 200 test for authenticated GET
    expect(content).toContain("expect(res.status).toBe(200)");
    // auth mock middleware
    expect(content).toContain("req.isAuthenticated");
    // registerRoutes import
    expect(content).toContain("registerRoutes");
  });

  it("POST with requestBody generates send() call and 201 expectation", () => {
    const endpoint: BackendEndpointSpec = {
      method: "POST",
      path: "/api/widgets",
      description: "Create a widget",
      requestBody: ["name", "color"],
      responseFields: ["id", "name"],
      authRequired: true,
      source: "explicit",
    };

    const result = generateIntegrationTest(endpoint);
    const content = result.content;

    expect(content).toContain('describe("POST /api/widgets"');
    expect(content).toContain('request(app).post("/api/widgets")');
    expect(content).toContain(".send({");
    expect(content).toContain("expect(res.status).toBe(201)");
  });

  it("authRequired=false skips the 401 unauthenticated test", () => {
    const endpoint: BackendEndpointSpec = {
      method: "GET",
      path: "/api/public-info",
      description: "Public endpoint",
      requestBody: [],
      responseFields: ["info"],
      authRequired: false,
      source: "explicit",
    };

    const result = generateIntegrationTest(endpoint);
    const content = result.content;

    // No 401 test
    expect(content).not.toContain("expect(res.status).toBe(401)");
    // Has the 200 test
    expect(content).toContain("expect(res.status).toBe(200)");
  });

  it("DELETE endpoint produces 204 expected status", () => {
    const endpoint: BackendEndpointSpec = {
      method: "DELETE",
      path: "/api/widgets/:id",
      description: "Delete a widget",
      requestBody: [],
      responseFields: [],
      authRequired: true,
      source: "explicit",
    };

    const result = generateIntegrationTest(endpoint);
    const content = result.content;

    expect(content).toContain("expect(res.status).toBe(204)");
  });
});
