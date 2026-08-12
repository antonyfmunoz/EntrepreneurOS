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
import { registerRoutes } from "../server/routes";
import { client, db } from "../server/db";
import { companies, portfolios, users } from "../shared/schema";

if (process.env.NODE_ENV !== "test" || process.env.EOS_E2E_FIXTURE !== "true") {
  throw new Error("The EOS browser fixture only runs with NODE_ENV=test and EOS_E2E_FIXTURE=true.");
}

const ownerId = "eos_browser_acceptance_owner";
await db.insert(users).values({
  id: ownerId,
  username: "eos_browser_owner",
  password: "not-used-browser-fixture",
  email: "browser-owner@example.test",
  fullName: "EOS Browser Owner",
}).onConflictDoNothing();

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
