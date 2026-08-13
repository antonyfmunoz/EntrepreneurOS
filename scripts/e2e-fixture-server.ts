/**
 * Loopback-only browser acceptance fixture.
 *
 * This is intentionally separate from the production server. It refuses to
 * start unless NODE_ENV=test and EOS_E2E_FIXTURE=true, binds only to
 * 127.0.0.1, and authenticates one seeded owner through the same pre-populated
 * principal seam used by the HTTP integration tests.
 */
import express from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { registerRoutes } from "../server/routes";
import { client, db } from "../server/db";
import { companies, oauthTokens, portfolios, users } from "../shared/schema";
import { resetInMemoryRateLimitsForFixture } from "../server/middleware/rate-limit";
import { encryptCredential } from "../server/security/credential-encryption";

if (process.env.NODE_ENV !== "test" || process.env.EOS_E2E_FIXTURE !== "true") {
  throw new Error("The EOS browser fixture only runs with NODE_ENV=test and EOS_E2E_FIXTURE=true.");
}

process.env.SESSION_SECRET = "browser-fixture-session-secret-at-least-thirty-two-characters";
process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString("base64");
process.env.NOTION_CLIENT_ID = "browser-fixture-notion-client";
process.env.NOTION_CLIENT_SECRET = "browser-fixture-notion-secret";
process.env.NOTION_REDIRECT_URI = "https://entrepreneuros.net/api/auth/notion/callback";

const networkFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url === "https://api.notion.com/v1/users/me") {
    return new Response(JSON.stringify({ object: "user", id: "browser-fixture-notion-bot", type: "bot", name: "EntrepreneurOS" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url === "https://api.notion.com/v1/search") {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as { query?: string } : {};
    const query = body.query?.trim() || "Latest";
    return new Response(JSON.stringify({ results: [{
      id: `browser-notion-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      object: "page",
      properties: { title: { title: [{ plain_text: `${query} operating plan` }] } },
      url: "https://www.notion.so/browser-fixture-operating-plan",
      last_edited_time: "2026-08-13T12:00:00.000Z",
    }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url === "https://api.notion.com/v1/oauth/revoke") {
    return new Response(null, { status: 200 });
  }
  return networkFetch(input, init);
};

const ownerId = "eos_browser_acceptance_owner";
await db.insert(users).values({
  id: ownerId,
  username: "eos_browser_owner",
  password: "not-used-browser-fixture",
  email: "browser-owner@example.test",
  fullName: "EOS Browser Owner",
}).onConflictDoNothing();

await db.insert(oauthTokens).values({
  id: randomUUID(),
  userId: ownerId,
  provider: "notion",
  accessToken: encryptCredential("browser-fixture-notion-access"),
  refreshToken: encryptCredential("browser-fixture-notion-refresh"),
  tokenType: "bearer",
  metadata: { workspaceId: "browser-fixture-workspace", workspaceName: "EOS Acceptance Workspace" },
}).onConflictDoUpdate({
  target: [oauthTokens.userId, oauthTokens.provider],
  set: {
    accessToken: encryptCredential("browser-fixture-notion-access"),
    refreshToken: encryptCredential("browser-fixture-notion-refresh"),
    metadata: { workspaceId: "browser-fixture-workspace", workspaceName: "EOS Acceptance Workspace" },
    updatedAt: new Date(),
  },
});

let portfolio = await db.query.portfolios.findFirst({ where: eq(portfolios.ownerId, ownerId) });
if (!portfolio) {
  [portfolio] = await db.insert(portfolios).values({
    ownerId,
    name: "EOS Acceptance Portfolio",
    description: "Disposable browser qualification fixture",
  }).returning();
}

let company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerId) });
if (!company) {
  [company] = await db.insert(companies).values({
    ownerUserId: ownerId,
    portfolioId: portfolio.id,
    name: "EOS Browser Acceptance",
    stage: "MVP",
    offer: "Governed operating system",
    targetCustomer: "Founder-led companies",
    goals: "Complete one evidence-bearing operating loop",
    assistantName: "Assistant",
  }).returning();
}

const fixtureUser = {
  id: ownerId,
  username: "eos_browser_owner",
  password: "not-used-browser-fixture",
  email: "browser-owner@example.test",
  fullName: "EOS Browser Owner",
  avatar: null,
  company: null,
  role: null,
  clerkUserId: null,
  preferences: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, _res, next) => {
  (req as any).user = fixtureUser;
  next();
});
app.post("/__fixture/reset-rate-limits", (_req, res) => {
  resetInMemoryRateLimitsForFixture();
  return res.json({ reset: true });
});

const server = await registerRoutes(app);
const port = Number(process.env.PORT || 5111);
server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ ready: true, origin: `http://127.0.0.1:${port}`, companyId: company.id }));
});

const shutdown = () => {
  server.close(() => {
    void client.end({ timeout: 5 }).finally(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
