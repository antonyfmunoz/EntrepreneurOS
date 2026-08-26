/**
 * Loopback-only browser acceptance fixture.
 *
 * This is intentionally separate from the production server. It refuses to
 * start unless NODE_ENV=test and EOS_E2E_FIXTURE=true, binds only to
 * 127.0.0.1, and authenticates one seeded owner through the same pre-populated
 * principal seam used by the HTTP integration tests.
 */
import express from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { registerRoutes } from "../server/routes";
import { client, db } from "../server/db";
import {
  aiBudgets,
  aiUsageLedger,
  companies,
  eosApprovalRequests,
  eosAssignments,
  eosMemberships,
  eosSeats,
  eosWorkPackets,
  oauthTokens,
  portfolios,
  users,
} from "../shared/schema";
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
process.env.EOS_PLATFORM_ADMIN_USER_IDS = "eos_browser_acceptance_owner";
process.env.EOS_RELEASE_SUBJECT = `git:${"b".repeat(40)}`;
process.env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT = "environment:eos-browser-acceptance";

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
const onboardingRunId = randomUUID();
const fixturePrincipalRows = {
  owner: { id: ownerId, username: "eos_browser_owner", email: "browser-owner@example.test", fullName: "EOS Browser Owner" },
  onboarding: {
    id: `eos_browser_acceptance_onboarding_${onboardingRunId}`,
    username: `eos_browser_onboarding_${onboardingRunId}`,
    email: `browser-onboarding-${onboardingRunId}@example.test`,
    fullName: "EOS Browser New Founder",
  },
  portfolio: { id: "eos_browser_acceptance_portfolio", username: "eos_browser_portfolio", email: "browser-portfolio@example.test", fullName: "EOS Browser Portfolio Executive" },
  executive: { id: "eos_browser_acceptance_executive", username: "eos_browser_executive", email: "browser-executive@example.test", fullName: "EOS Browser Executive" },
  functional: { id: "eos_browser_acceptance_functional", username: "eos_browser_functional", email: "browser-functional@example.test", fullName: "EOS Browser Functional Executive" },
  manager: { id: "eos_browser_acceptance_manager", username: "eos_browser_manager", email: "browser-manager@example.test", fullName: "EOS Browser Manager" },
  employee: { id: "eos_browser_acceptance_employee", username: "eos_browser_employee", email: "browser-employee@example.test", fullName: "EOS Browser Employee" },
  external: { id: "eos_browser_acceptance_external", username: "eos_browser_external", email: "browser-external@example.test", fullName: "EOS Browser External Collaborator" },
} as const;

for (const principal of Object.values(fixturePrincipalRows)) {
  await db.insert(users).values({
    ...principal,
    password: "not-used-browser-fixture",
  }).onConflictDoUpdate({
    target: users.id,
    set: { username: principal.username, email: principal.email, fullName: principal.fullName, updatedAt: new Date() },
  });
}

// A fresh principal keeps the first-run journey deterministic without deleting
// organizations whose append-only policy-decision history must remain intact.

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

// Reuse the authenticated fixture principal, but never reuse its prior portfolio
// context. Append-only qualification state remains intact while compiled canonical
// identities from an earlier run cannot make the next run ambiguous.
const [portfolio] = await db.insert(portfolios).values({
  ownerId,
  name: `EOS Acceptance Portfolio ${onboardingRunId.slice(0, 8)}`,
  description: `Disposable browser qualification fixture ${onboardingRunId}`,
}).returning();

let company = await db.query.companies.findFirst({ where: and(eq(companies.ownerUserId, ownerId), eq(companies.name, "EOS Browser Acceptance")) });
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
} else {
  [company] = await db.update(companies).set({ portfolioId: portfolio.id, assistantName: "Assistant", updatedAt: new Date() }).where(eq(companies.id, company.id)).returning();
}
await db.delete(eosApprovalRequests).where(
  and(
    eq(eosApprovalRequests.companyId, company.id),
    eq(eosApprovalRequests.assignedToUserId, ownerId),
  ),
);
await db.update(eosWorkPackets).set({ status: "cancelled", updatedAt: new Date() }).where(
  and(
    eq(eosWorkPackets.companyId, company.id),
    eq(eosWorkPackets.accountableUserId, ownerId),
    eq(eosWorkPackets.status, "awaiting_approval"),
  ),
);

let secondCompany = await db.query.companies.findFirst({ where: and(eq(companies.ownerUserId, ownerId), eq(companies.name, "EOS Multi-Workspace Company")) });
if (!secondCompany) {
  [secondCompany] = await db.insert(companies).values({
    ownerUserId: ownerId,
    portfolioId: portfolio.id,
    name: "EOS Multi-Workspace Company",
    stage: "MVP",
    offer: "Second governed workspace",
    targetCustomer: "Multi-company operators",
    goals: "Verify role-safe switching between organizations",
    assistantName: "Orbit",
  }).returning();
} else {
  [secondCompany] = await db.update(companies).set({ portfolioId: portfolio.id, assistantName: "Orbit", updatedAt: new Date() }).where(eq(companies.id, secondCompany.id)).returning();
}

await db.insert(aiBudgets).values({ companyId: company.id, monthlyLimitMicros: 30_000_000, perRequestLimitMicros: 2_000_000, alertThresholdPercent: 80, enabled: true, updatedByUserId: ownerId }).onConflictDoUpdate({ target: aiBudgets.companyId, set: { monthlyLimitMicros: 30_000_000, perRequestLimitMicros: 2_000_000, alertThresholdPercent: 80, enabled: true, updatedByUserId: ownerId, updatedAt: new Date() } });
await db.delete(aiUsageLedger).where(eq(aiUsageLedger.id, "browser_ai_usage_reservation"));
await db.insert(aiUsageLedger).values({ id: "browser_ai_usage_reservation", companyId: company.id, userId: ownerId, context: "browser reconciliation acceptance", model: "fixture-model", status: "reserved", reservedCostMicros: 250_000 });

await db.insert(eosSeats).values({
  id: "10000000-0000-4000-8000-000000000001",
  companyId: company.id,
  title: "Founder / Portfolio Principal",
  kind: "founder",
  occupantUserId: ownerId,
  agentName: company.assistantName || "Assistant",
  agentMode: "assistant",
  mandate: "Own portfolio direction and final local authority.",
  authority: { level: "owner" },
  toolEntitlements: [],
}).onConflictDoUpdate({
  target: eosSeats.id,
  set: {
    companyId: company.id,
    occupantUserId: ownerId,
    agentName: company.assistantName || "Assistant",
    agentMode: "assistant",
    status: "active",
    updatedAt: new Date(),
  },
});
const founderSeat = await db.query.eosSeats.findFirst({
  where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")),
});
if (!founderSeat) throw new Error("Browser fixture could not resolve the founder seat.");

const fixtureSeatRows = {
  portfolio: {
    id: "10000000-0000-4000-8000-000000000005",
    title: "Portfolio Executive",
    kind: "portfolio_executive",
    supervisorSeatId: founderSeat.id,
    occupantUserId: fixturePrincipalRows.portfolio.id,
    agentName: "Iris",
    mandate: "Coordinate authorized portfolio rollups and company dependencies.",
    authority: { level: "portfolio_executive" },
    toolEntitlements: ["portfolio_rollups", "portfolio_review"],
  },
  executive: {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Company CEO",
    kind: "company_ceo",
    supervisorSeatId: founderSeat.id,
    occupantUserId: fixturePrincipalRows.executive.id,
    agentName: "Sage",
    mandate: "Translate founder direction into company execution.",
    authority: { level: "company_executive" },
    toolEntitlements: ["company_operations", "company_review"],
  },
  functional: {
    id: "10000000-0000-4000-8000-000000000006",
    title: "Chief Operating Officer",
    kind: "functional_executive",
    supervisorSeatId: "10000000-0000-4000-8000-000000000002",
    occupantUserId: fixturePrincipalRows.functional.id,
    agentName: "Mira",
    mandate: "Own the operating function and its reporting teams.",
    authority: { level: "functional_executive" },
    toolEntitlements: ["function_operations", "function_review"],
  },
  manager: {
    id: "10000000-0000-4000-8000-000000000003",
    title: "Operations Manager",
    kind: "manager",
    supervisorSeatId: "10000000-0000-4000-8000-000000000006",
    occupantUserId: fixturePrincipalRows.manager.id,
    agentName: "Atlas",
    mandate: "Coordinate delivery through the assigned operating team.",
    authority: { level: "team_manager" },
    toolEntitlements: ["team_operations"],
  },
  employee: {
    id: "10000000-0000-4000-8000-000000000004",
    title: "Customer Operations Specialist",
    kind: "individual_contributor",
    supervisorSeatId: "10000000-0000-4000-8000-000000000003",
    occupantUserId: fixturePrincipalRows.employee.id,
    agentName: "Nova",
    mandate: "Complete assigned customer operations work with reviewable evidence.",
    authority: { level: "assigned_work" },
    toolEntitlements: ["assigned_work"],
  },
  external: {
    id: "10000000-0000-4000-8000-000000000007",
    title: "Implementation Partner",
    kind: "external",
    supervisorSeatId: "10000000-0000-4000-8000-000000000003",
    occupantUserId: fixturePrincipalRows.external.id,
    agentName: "Echo",
    mandate: "Complete only explicitly shared implementation work.",
    authority: { level: "relationship" },
    toolEntitlements: ["shared_work"],
  },
} as const;

for (const seat of Object.values(fixtureSeatRows)) {
  await db.insert(eosSeats).values({ ...seat, companyId: company.id, agentMode: "assistant", status: "active" }).onConflictDoUpdate({
    target: eosSeats.id,
    set: { ...seat, agentMode: "assistant", status: "active", updatedAt: new Date() },
  });
}

for (const [index, role] of (["portfolio", "executive", "functional", "manager", "employee", "external"] as const).entries()) {
  const principal = fixturePrincipalRows[role];
  const seat = fixtureSeatRows[role];
  const membershipId = `20000000-0000-4000-8000-00000000000${index + 2}`;
  const effectiveFrom = new Date();
  const classificationCeiling =
    role === "external"
      ? "public"
      : role === "employee"
        ? "internal"
        : role === "executive"
          ? "restricted"
          : "confidential";
  await db.insert(eosMemberships).values({
    id: membershipId,
    companyId: company.id,
    userId: principal.id,
    seatId: seat.id,
    role: seat.kind,
    purpose: "operate",
    classificationCeiling,
  }).onConflictDoUpdate({
    target: eosMemberships.id,
    set: { userId: principal.id, seatId: seat.id, role: seat.kind, status: "active", updatedAt: new Date() },
  });
  await db.insert(eosAssignments).values({
    id: `browser-assignment:${membershipId}`,
    companyId: company.id,
    membershipId,
    principalUserId: principal.id,
    seatId: seat.id,
    assignmentType: "occupant",
    operatingGrant: "operate",
    purpose: "operate",
    classificationCeiling,
    status: "active",
    effectiveFrom,
    createdByUserId: ownerId,
    metadata: { source: "browser_acceptance_fixture" },
    createdAt: effectiveFrom,
    updatedAt: effectiveFrom,
  }).onConflictDoUpdate({
    target: eosAssignments.id,
    set: {
      principalUserId: principal.id,
      seatId: seat.id,
      classificationCeiling,
      status: "active",
      effectiveFrom,
      endedAt: null,
      updatedAt: effectiveFrom,
    },
  });
}

await db.insert(eosSeats).values({
  id: "10000000-0000-4000-8000-000000000008",
  companyId: secondCompany.id,
  title: "Founder / Portfolio Principal",
  kind: "founder",
  occupantUserId: ownerId,
  agentName: secondCompany.assistantName || "Orbit",
  agentMode: "assistant",
  mandate: "Own the second company and final local authority.",
  authority: { level: "owner" },
  toolEntitlements: [],
}).onConflictDoUpdate({
  target: eosSeats.id,
  set: { companyId: secondCompany.id, occupantUserId: ownerId, agentName: secondCompany.assistantName || "Orbit", agentMode: "assistant", status: "active", updatedAt: new Date() },
});
await db.insert(eosSeats).values({
  id: "10000000-0000-4000-8000-000000000009",
  companyId: secondCompany.id,
  title: "Transformation Executive",
  kind: "functional_executive",
  supervisorSeatId: "10000000-0000-4000-8000-000000000008",
  occupantUserId: fixturePrincipalRows.manager.id,
  agentName: "Helix",
  agentMode: "assistant",
  mandate: "Lead the transformation function in this organization.",
  authority: { level: "functional_executive" },
  toolEntitlements: ["function_operations"],
}).onConflictDoUpdate({
  target: eosSeats.id,
  set: { companyId: secondCompany.id, occupantUserId: fixturePrincipalRows.manager.id, agentName: "Helix", agentMode: "assistant", status: "active", updatedAt: new Date() },
});
await db.insert(eosMemberships).values({
  id: "20000000-0000-4000-8000-000000000009",
  companyId: secondCompany.id,
  userId: fixturePrincipalRows.manager.id,
  seatId: "10000000-0000-4000-8000-000000000009",
  role: "functional_executive",
  purpose: "operate",
  classificationCeiling: "confidential",
}).onConflictDoUpdate({
  target: eosMemberships.id,
  set: { companyId: secondCompany.id, userId: fixturePrincipalRows.manager.id, seatId: "10000000-0000-4000-8000-000000000009", role: "functional_executive", status: "active", updatedAt: new Date() },
});
{
  const effectiveFrom = new Date();
  await db.insert(eosAssignments).values({
    id: "browser-assignment:20000000-0000-4000-8000-000000000009",
    companyId: secondCompany.id,
    membershipId: "20000000-0000-4000-8000-000000000009",
    principalUserId: fixturePrincipalRows.manager.id,
    seatId: "10000000-0000-4000-8000-000000000009",
    assignmentType: "occupant",
    operatingGrant: "operate",
    purpose: "operate",
    classificationCeiling: "confidential",
    status: "active",
    effectiveFrom,
    createdByUserId: ownerId,
    metadata: { source: "browser_acceptance_fixture" },
    createdAt: effectiveFrom,
    updatedAt: effectiveFrom,
  }).onConflictDoUpdate({
    target: eosAssignments.id,
    set: {
      principalUserId: fixturePrincipalRows.manager.id,
      seatId: "10000000-0000-4000-8000-000000000009",
      status: "active",
      effectiveFrom,
      endedAt: null,
      updatedAt: effectiveFrom,
    },
  });
}

const fixtureWorkRows = [
  { id: "30000000-0000-4000-8000-000000000001", accountableUserId: fixturePrincipalRows.executive.id, accountableSeatId: fixtureSeatRows.executive.id, title: "Set the quarterly operating direction", objective: "Turn founder direction into a company operating plan.", status: "ready", priority: "high", requiresApproval: false, classification: "internal" },
  { id: "30000000-0000-4000-8000-000000000005", accountableUserId: fixturePrincipalRows.functional.id, accountableSeatId: fixtureSeatRows.functional.id, title: "Align the operating function", objective: "Turn company direction into a functional operating plan.", status: "ready", priority: "high", requiresApproval: false, classification: "internal" },
  { id: "30000000-0000-4000-8000-000000000002", accountableUserId: fixturePrincipalRows.manager.id, accountableSeatId: fixtureSeatRows.manager.id, title: "Stabilize the weekly delivery cadence", objective: "Run the team cadence and surface delivery constraints.", status: "ready", priority: "high", requiresApproval: false, classification: "internal" },
  { id: "30000000-0000-4000-8000-000000000003", accountableUserId: fixturePrincipalRows.employee.id, accountableSeatId: fixtureSeatRows.employee.id, title: "Complete the customer handoff checklist", objective: "Complete the assigned handoff and attach reviewable evidence.", status: "ready", priority: "medium", requiresApproval: false, classification: "internal" },
  { id: "30000000-0000-4000-8000-000000000004", accountableUserId: fixturePrincipalRows.employee.id, accountableSeatId: fixtureSeatRows.employee.id, title: "Submit the customer handoff for manager review", objective: "Request the manager decision before the handoff is released.", status: "awaiting_approval", priority: "high", requiresApproval: true, classification: "internal" },
  { id: "30000000-0000-4000-8000-000000000006", accountableUserId: fixturePrincipalRows.external.id, accountableSeatId: fixtureSeatRows.external.id, title: "Deliver the shared implementation artifact", objective: "Complete only the explicitly shared partner deliverable.", status: "ready", priority: "medium", requiresApproval: false, classification: "public" },
] as const;

for (const packet of fixtureWorkRows) {
  await db.insert(eosWorkPackets).values({
    ...packet,
    companyId: company.id,
    createdByUserId: packet.accountableUserId,
    source: "manual",
    visibility: "reporting_tree",
    classification: packet.classification,
    toolPack: [],
    evidenceRequirements: ["Supervisor-reviewed output and named evidence"],
    traceId: `browser-trace-${packet.id}`,
    correlationId: `browser-correlation-${packet.id}`,
  }).onConflictDoUpdate({
    target: eosWorkPackets.id,
    set: { title: packet.title, objective: packet.objective, status: packet.status, priority: packet.priority, accountableUserId: packet.accountableUserId, accountableSeatId: packet.accountableSeatId, requiresApproval: packet.requiresApproval, classification: packet.classification, updatedAt: new Date() },
  });
}

await db.insert(eosApprovalRequests).values({
  id: "40000000-0000-4000-8000-000000000001",
  companyId: company.id,
  workPacketId: "30000000-0000-4000-8000-000000000004",
  requestedByUserId: fixturePrincipalRows.employee.id,
  assignedToUserId: fixturePrincipalRows.manager.id,
  assignedToSeatId: fixtureSeatRows.manager.id,
  summary: "Approve the customer handoff release.",
  status: "pending",
}).onConflictDoUpdate({
  target: eosApprovalRequests.id,
  set: { assignedToUserId: fixturePrincipalRows.manager.id, assignedToSeatId: fixtureSeatRows.manager.id, status: "pending", decisionReason: null, decidedByUserId: null, decidedAt: null },
});

const fixtureUser = (principal: typeof fixturePrincipalRows[keyof typeof fixturePrincipalRows]) => ({
  id: principal.id,
  username: principal.username,
  password: "not-used-browser-fixture",
  email: principal.email,
  fullName: principal.fullName,
  avatar: null,
  company: null,
  role: null,
  clerkUserId: null,
  preferences: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie || "";
  const role = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith("eos_fixture_principal="))?.split("=")[1] as keyof typeof fixturePrincipalRows | undefined;
  const principal = role && role in fixturePrincipalRows ? fixturePrincipalRows[role] : fixturePrincipalRows.owner;
  (req as any).user = fixtureUser(principal);
  next();
});
app.post("/api/__fixture/principal", (req, res) => {
  const role = req.body?.role as keyof typeof fixturePrincipalRows | undefined;
  if (!role || !(role in fixturePrincipalRows)) return res.status(400).json({ error: "Unknown browser fixture principal." });
  res.setHeader("Set-Cookie", `eos_fixture_principal=${role}; Path=/; HttpOnly; SameSite=Strict`);
  return res.json({ principal: role });
});
app.post("/__fixture/reset-rate-limits", (_req, res) => {
  resetInMemoryRateLimitsForFixture();
  return res.json({ reset: true });
});

const server = await registerRoutes(app);
const port = Number(process.env.PORT || 5111);
server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ ready: true, origin: `http://127.0.0.1:${port}`, companyId: company.id, secondCompanyId: secondCompany.id }));
});

const shutdown = () => {
  server.close(() => {
    void client.end({ timeout: 5 }).finally(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
