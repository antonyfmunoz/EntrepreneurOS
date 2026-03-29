/**
 * Auth mocking smoke test — validates pre-route middleware injection pattern.
 *
 * This test MUST pass before bulk integration test generation is used (RESEARCH.md
 * Open Question 1). It verifies that:
 *   1. Unauthenticated requests to a protected route return 401
 *   2. Mock-authenticated requests (req.isAuthenticated = () => true) bypass the
 *      auth check and reach the handler
 *
 * Target endpoint: GET /api/company (existing, protected, already in routes.ts)
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../../../server/routes.js";

describe("Auth mocking smoke test — GET /api/company", () => {
  let unauthApp: express.Express;
  let authApp: express.Express;

  beforeAll(async () => {
    // App 1: unauthenticated — req.isAuthenticated returns false
    unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use((req: any, _res: any, next: any) => {
      req.isAuthenticated = () => false;
      req.user = null;
      next();
    });
    await registerRoutes(unauthApp);

    // App 2: authenticated — req.isAuthenticated returns true with mock user
    authApp = express();
    authApp.use(express.json());
    authApp.use((req: any, _res: any, next: any) => {
      req.isAuthenticated = () => true;
      req.user = { id: "test-user-id" };
      next();
    });
    await registerRoutes(authApp);
  }, 30000);

  it("returns 401 when request is unauthenticated", async () => {
    const res = await request(unauthApp).get("/api/company");
    expect(res.status).toBe(401);
  });

  it("returns non-401 status when request is mock-authenticated", async () => {
    // The exact status depends on whether test-user-id has a company in DB,
    // but it must NOT be 401 — that confirms the auth bypass works correctly.
    const res = await request(authApp).get("/api/company");
    expect(res.status).not.toBe(401);
  });
});
