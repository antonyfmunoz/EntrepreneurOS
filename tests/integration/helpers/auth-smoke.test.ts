/**
 * Auth mocking smoke test — validates pre-route middleware injection pattern.
 *
 * This test MUST pass before bulk integration test generation is used. It
 * verifies that:
 *   1. Unauthenticated requests to a protected route return 401
 *   2. Mock-authenticated requests (req.user pre-populated) bypass the
 *      Clerk lookup in attachClerkUser and reach the handler
 *
 * Under the Clerk-only auth model, attachClerkUser short-circuits when
 * req.user is already set by upstream middleware, so the mock pattern is
 * simply: push a middleware that sets req.user before registerRoutes runs.
 * The attachClerkUser middleware then installs req.isAuthenticated = () =>
 * true automatically, and the existing `if (!req.isAuthenticated())` checks
 * in route files pass through to the handler.
 *
 * Target endpoint: GET /api/company (existing, protected).
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../../../server/routes.js";

describe("Auth mocking smoke test — GET /api/company", () => {
  let unauthApp: express.Express;
  let authApp: express.Express;

  beforeAll(async () => {
    // App 1: unauthenticated — no req.user, no req.auth. attachClerkUser will
    // see no Clerk session and install isAuthenticated = () => false.
    unauthApp = express();
    unauthApp.use(express.json());
    await registerRoutes(unauthApp);

    // App 2: mock-authenticated — pre-populate req.user so attachClerkUser
    // short-circuits and installs isAuthenticated = () => true without
    // touching Clerk or the database.
    authApp = express();
    authApp.use(express.json());
    authApp.use((req: any, _res: any, next: any) => {
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
