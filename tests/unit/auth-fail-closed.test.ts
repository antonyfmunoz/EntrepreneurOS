import express from "express";
import supertest from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { setupAuth } from "../../server/auth";

describe("Clerk configuration failure", () => {
  afterEach(() => { delete process.env.CLERK_SECRET_KEY; });

  it("returns 401 without crashing when Clerk middleware is unavailable", async () => {
    delete process.env.CLERK_SECRET_KEY;
    const app = express();
    setupAuth(app);
    app.get("/api/protected-probe", (req, res) => {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
      return res.json({ ok: true });
    });

    await supertest(app).get("/api/user").expect(401);
    const protectedProbe = await supertest(app).get("/api/protected-probe").expect(401);
    expect(protectedProbe.body.error).toBe("Unauthorized");
  });
});
