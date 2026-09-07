import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { registerPublicLegalRoutes } from "../../server/routes/legal";

describe("public legal routes", () => {
  it("serves public terms without requiring an EOS session", async () => {
    const app = express();
    registerPublicLegalRoutes(app);

    const response = await supertest(app).get("/terms").expect(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.text).toContain("Authorized Operator Terms");
    expect(response.text).toContain("QuickBooks");
  });

  it("serves a distinct public privacy notice without requiring an EOS session", async () => {
    const app = express();
    registerPublicLegalRoutes(app);

    const response = await supertest(app).get("/privacy").expect(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Privacy Notice");
    expect(response.text).toContain("role, company, portfolio, and provider authorization");
  });
});
