import { Express } from "express";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  portfolios as portfoliosTable,
  companies as companiesTable,
  eosAuditRecords,
  eosMemberships,
  eosPortfolioMemberships,
  users,
  insertPortfolioSchema,
  updatePortfolioSchema,
} from "@shared/schema";
import { portfolioMembershipAdministrationSchema } from "@shared/eos-runtime";
import { db } from "../db";
import { hasEntitlement } from "../billing/stripe";
import { mayAddTeamIdentity, teamSeatSummaryForOwner } from "../billing/team-seats";
import { reconcilePortfolioMembersForCompany, setPortfolioMembershipStatus } from "../portfolio-memberships";
import { randomUUID } from "node:crypto";

async function membershipCompanies(userId: string) {
  const memberships = await db.select({ companyId: eosMemberships.companyId, role: eosMemberships.role })
    .from(eosMemberships)
    .where(and(eq(eosMemberships.userId, userId), eq(eosMemberships.status, "active")));
  if (!memberships.length) return [];
  const companies = await db.select().from(companiesTable).where(inArray(companiesTable.id, Array.from(new Set(memberships.map((membership) => membership.companyId)))));
  const roleByCompany = new Map(memberships.map((membership) => [membership.companyId, membership.role]));
  return companies.map((company) => ({ company, role: roleByCompany.get(company.id) || "member" }));
}

function memberCompanyProjection(company: typeof companiesTable.$inferSelect, role: string) {
  const base = {
    id: company.id,
    portfolioId: company.portfolioId,
    name: company.name,
    access: "member" as const,
    role,
  };
  if (role === "external") return base;
  const operational = { ...base, type: company.type, stage: company.stage };
  if (role === "individual_contributor") return operational;
  return { ...operational, offer: company.offer };
}

export function registerPortfolioRoutes(app: Express): void {
  // GET /api/portfolios — list all portfolios for authenticated user
  app.get("/api/portfolios", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const ownedPortfolios = await db
        .select()
        .from(portfoliosTable)
        .where(eq(portfoliosTable.ownerId, userId));
      const [ownedCompanies, memberships] = await Promise.all([
        db.select({ id: companiesTable.id, portfolioId: companiesTable.portfolioId }).from(companiesTable).where(eq(companiesTable.ownerUserId, userId)),
        membershipCompanies(userId),
      ]);
      const ownedIds = new Set(ownedPortfolios.map((portfolio) => portfolio.id));
      const memberPortfolioIds = Array.from(new Set(memberships.map(({ company }) => company.portfolioId).filter((id): id is number => id !== null && !ownedIds.has(id))));
      const memberPortfolios = memberPortfolioIds.length
        ? await db.select().from(portfoliosTable).where(inArray(portfoliosTable.id, memberPortfolioIds))
        : [];
      const ownerRows = ownedPortfolios.map((portfolio) => ({
        ...portfolio,
        access: "owner" as const,
        companyCount: ownedCompanies.filter((company) => company.portfolioId === portfolio.id).length,
        defaultCompanyId: ownedCompanies.find((company) => company.portfolioId === portfolio.id)?.id || null,
      }));
      const memberRows = memberPortfolios.map((portfolio) => {
        const accessibleCompanies = memberships.filter(({ company }) => company.portfolioId === portfolio.id);
        return {
          id: portfolio.id,
          name: portfolio.name,
          description: null,
          access: "member" as const,
          companyCount: accessibleCompanies.length,
          defaultCompanyId: accessibleCompanies[0]?.company.id || null,
        };
      });
      return res.json([...ownerRows, ...memberRows]);
    } catch (error) {
      console.error("Error listing portfolios:", error);
      return res.status(500).json({
        message: "Failed to list portfolios",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/portfolios — create a new portfolio
  app.post("/api/portfolios", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      if (!(await hasEntitlement(userId, "portfolio:create"))) {
        return res.status(402).json({ code: "entitlement_required", message: "Your current plan does not permit another portfolio." });
      }
      const data = insertPortfolioSchema.parse(req.body);

      const [created] = await db
        .insert(portfoliosTable)
        .values({
          ownerId: userId,
          name: data.name,
          description: data.description ?? null,
        })
        .returning();

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid portfolio data", errors: error.errors });
      }
      console.error("Error creating portfolio:", error);
      return res.status(500).json({
        message: "Failed to create portfolio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/portfolios/:id — get a single portfolio
  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ message: "Invalid portfolio id" });
      }

      const owned = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (owned.length) return res.json({ ...owned[0], access: "owner" });
      const memberships = await membershipCompanies(userId);
      if (!memberships.some(({ company }) => company.portfolioId === portfolioId)) return res.status(404).json({ message: "Portfolio not found" });
      const [portfolio] = await db.select({ id: portfoliosTable.id, name: portfoliosTable.name }).from(portfoliosTable).where(eq(portfoliosTable.id, portfolioId)).limit(1);
      if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });
      return res.json({ ...portfolio, description: null, access: "member" });
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      return res.status(500).json({
        message: "Failed to fetch portfolio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/portfolios/:id/team", async (req, res, next) => {
    try {
      const portfolioId = Number(req.params.id);
      if (!Number.isInteger(portfolioId)) return res.status(400).json({ code: "invalid_portfolio", message: "Portfolio id must be a positive integer." });
      const [portfolio] = await db.select().from(portfoliosTable).where(and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, req.user.id))).limit(1);
      if (!portfolio) return res.status(404).json({ code: "portfolio_not_found", message: "Portfolio not found." });
      const members = await db.select({
        id: eosPortfolioMemberships.id,
        userId: eosPortfolioMemberships.userId,
        role: eosPortfolioMemberships.role,
        status: eosPortfolioMemberships.status,
        classificationCeiling: eosPortfolioMemberships.classificationCeiling,
        fullName: users.fullName,
        email: users.email,
        createdAt: eosPortfolioMemberships.createdAt,
        updatedAt: eosPortfolioMemberships.updatedAt,
      }).from(eosPortfolioMemberships).innerJoin(users, eq(users.id, eosPortfolioMemberships.userId)).where(eq(eosPortfolioMemberships.portfolioId, portfolioId));
      return res.json({ members, teamSeats: await teamSeatSummaryForOwner(req.user.id) });
    } catch (error) { return next(error); }
  });

  app.patch("/api/portfolios/:id/team/:membershipId", async (req, res, next) => {
    try {
      const portfolioId = Number(req.params.id);
      if (!Number.isInteger(portfolioId) || portfolioId <= 0) return res.status(400).json({ code: "invalid_portfolio", message: "Portfolio id must be a positive integer." });
      const input = portfolioMembershipAdministrationSchema.parse(req.body);
      const [portfolio] = await db.select().from(portfoliosTable).where(and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, req.user.id))).limit(1);
      if (!portfolio) return res.status(404).json({ code: "portfolio_not_found", message: "Portfolio not found." });
      const updated = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`eos-team-seat:${req.user.id}`}))`);
        const membership = await tx.query.eosPortfolioMemberships.findFirst({ where: and(eq(eosPortfolioMemberships.id, req.params.membershipId), eq(eosPortfolioMemberships.portfolioId, portfolioId)) });
        if (!membership || membership.status === "revoked") return null;
        if (input.action === "reactivate") {
          const principal = await tx.query.users.findFirst({ where: eq(users.id, membership.userId) });
          if (!principal) return null;
          const capacity = await mayAddTeamIdentity(req.user.id, principal.email, tx);
          if (!capacity.allowed) return { capacityError: capacity.summary } as const;
        }
        await setPortfolioMembershipStatus(membership.id, input.action === "reactivate" ? "active" : "suspended", tx);
        const [result] = await tx.select().from(eosPortfolioMemberships).where(eq(eosPortfolioMemberships.id, membership.id));
        const companyRows = await tx.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.portfolioId, portfolioId));
        for (const company of companyRows) await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: company.id, actorUserId: req.user.id, action: `portfolio_membership.${input.action}`, targetType: "portfolio_membership", targetId: membership.id, traceId: randomUUID(), correlationId: randomUUID(), result: result.status, details: { portfolioId } });
        return result;
      });
      if (!updated) return res.status(404).json({ code: "portfolio_membership_not_found", message: "Portfolio team member was not found." });
      if ("capacityError" in updated) return res.status(402).json({ code: "team_seat_limit_reached", message: `All ${updated.capacityError.limit} team seats are allocated.`, teamSeats: updated.capacityError });
      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_team_action", message: "A valid team action is required." });
      return next(error);
    }
  });

  app.delete("/api/portfolios/:id/team/:membershipId", async (req, res, next) => {
    try {
      const portfolioId = Number(req.params.id);
      if (!Number.isInteger(portfolioId) || portfolioId <= 0) return res.status(400).json({ code: "invalid_portfolio", message: "Portfolio id must be a positive integer." });
      const [portfolio] = await db.select().from(portfoliosTable).where(and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, req.user.id))).limit(1);
      if (!portfolio) return res.status(404).json({ code: "portfolio_not_found", message: "Portfolio not found." });
      const removed = await db.transaction(async (tx) => {
        const membership = await tx.query.eosPortfolioMemberships.findFirst({ where: and(eq(eosPortfolioMemberships.id, req.params.membershipId), eq(eosPortfolioMemberships.portfolioId, portfolioId)) });
        if (!membership || membership.status === "revoked") return null;
        await setPortfolioMembershipStatus(membership.id, "revoked", tx);
        const [result] = await tx.select().from(eosPortfolioMemberships).where(eq(eosPortfolioMemberships.id, membership.id));
        const companyRows = await tx.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.portfolioId, portfolioId));
        for (const company of companyRows) await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: company.id, actorUserId: req.user.id, action: "portfolio_membership.revoked", targetType: "portfolio_membership", targetId: membership.id, traceId: randomUUID(), correlationId: randomUUID(), result: "revoked", details: { portfolioId } });
        return result;
      });
      if (!removed) return res.status(404).json({ code: "portfolio_membership_not_found", message: "Portfolio team member was not found." });
      return res.json(removed);
    } catch (error) { return next(error); }
  });

  // PUT /api/portfolios/:id — update a portfolio
  app.put("/api/portfolios/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ message: "Invalid portfolio id" });
      }

      const update = updatePortfolioSchema.parse(req.body);

      const existing = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const updateData: Record<string, any> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(update)) {
        if (v !== undefined) updateData[k] = v;
      }

      const [updated] = await db
        .update(portfoliosTable)
        .set(updateData)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .returning();

      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid portfolio update", errors: error.errors });
      }
      console.error("Error updating portfolio:", error);
      return res.status(500).json({
        message: "Failed to update portfolio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // DELETE /api/portfolios/:id — delete a portfolio
  app.delete("/api/portfolios/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ message: "Invalid portfolio id" });
      }

      const existing = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      await db
        .delete(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        );

      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      return res.status(500).json({
        message: "Failed to delete portfolio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/portfolios/:id/companies — list companies inside a portfolio
  app.get("/api/portfolios/:id/companies", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ message: "Invalid portfolio id" });
      }

      // Owners may browse every company they own in the portfolio. Members
      // receive only organizations containing their active EOS seat.
      const owned = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (owned.length) {
        const rows = await db.select().from(companiesTable).where(and(eq(companiesTable.portfolioId, portfolioId), eq(companiesTable.ownerUserId, userId)));
        return res.json(rows.map((company) => ({ ...company, access: "owner" })));
      }
      const memberships = (await membershipCompanies(userId)).filter(({ company }) => company.portfolioId === portfolioId);
      if (!memberships.length) return res.status(404).json({ message: "Portfolio not found" });
      return res.json(memberships.map(({ company, role }) => memberCompanyProjection(company, role)));
    } catch (error) {
      console.error("Error listing portfolio companies:", error);
      return res.status(500).json({
        message: "Failed to list portfolio companies",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/portfolios/:id/companies — create or attach a company
  // Body: { companyId } to attach existing, or { name, stage, ... } to create new
  app.post("/api/portfolios/:id/companies", async (req, res) => {
    const attachSchema = z.object({ companyId: z.number().int().positive() });
    const createSchema = z.object({
      name: z.string().min(1),
      stage: z.string().min(1),
      industry: z.string().optional(),
      businessModel: z.string().optional(),
      goals: z.string().optional(),
      assistantName: z.string().optional(),
      founderProfile: z.object({
        vision: z.string().max(2000).default(""),
        values: z.string().max(1200).default(""),
        decisionStyle: z.string().max(1200).default(""),
        workingStyle: z.string().max(1200).default(""),
      }).optional(),
    });
    const bodySchema = z.union([attachSchema, createSchema]);

    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ message: "Invalid portfolio id" });
      }

      const body = bodySchema.parse(req.body);

      // Verify portfolio ownership
      const portfolio = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (portfolio.length === 0) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      // Attach existing company
      if ("companyId" in body) {
        const company = await db
          .select()
          .from(companiesTable)
          .where(
            and(eq(companiesTable.id, body.companyId), eq(companiesTable.ownerUserId, userId)),
          )
          .limit(1);

        if (company.length === 0) {
          return res.status(404).json({ message: "Company not found" });
        }

        const [updated] = await db
          .update(companiesTable)
          .set({ portfolioId })
          .where(
            and(eq(companiesTable.id, body.companyId), eq(companiesTable.ownerUserId, userId)),
          )
          .returning();

        await reconcilePortfolioMembersForCompany(updated);

        return res.status(200).json(updated);
      }

      // Create new company and attach to portfolio
      const [created] = await db
        .insert(companiesTable)
        .values({
          ownerUserId: userId,
          portfolioId,
          name: body.name,
          stage: body.stage,
          type: body.businessModel ?? null,
          goals: body.goals ?? null,
          assistantName: body.assistantName ?? "Assistant",
          founderProfile: body.founderProfile ?? {},
        })
        .returning();

      await reconcilePortfolioMembersForCompany(created);

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request body", errors: error.errors });
      }
      console.error("Error creating/attaching company:", error);
      return res.status(500).json({
        message: "Failed to create or attach company",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
