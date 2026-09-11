import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { registerPublicLegalRoutes } from "../../server/routes/legal";
import { registerDocusignConsentRoutes } from "../../server/routes/docusign-consent";

describe("public legal routes", () => {
  it("serves public terms without requiring an EOS session", async () => {
    const app = express();
    registerPublicLegalRoutes(app);

    const response = await supertest(app).get("/terms").expect(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.text).toContain("Internal Operator Terms");
    expect(response.text).toContain("proprietary internal operating environment");
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

  it("clears a DocuSign Demo authorization return without retaining or rendering its code", async () => {
    const app = express();
    registerDocusignConsentRoutes(app);

    const response = await supertest(app)
      .get("/api/auth/docusign/callback?code=short-lived-provider-code")
      .expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.text).toContain('history.replaceState({}, "", "/")');
    expect(response.text).not.toContain("short-lived-provider-code");
  });

  it("reports a declined DocuSign authorization without exposing provider query data", async () => {
    const app = express();
    registerDocusignConsentRoutes(app);

    const response = await supertest(app)
      .get("/api/auth/docusign/callback?error=access_denied&error_description=provider-detail")
      .expect(400);

    expect(response.text).toContain("DocuSign authorization was not completed");
    expect(response.text).not.toContain("provider-detail");
  });
});
