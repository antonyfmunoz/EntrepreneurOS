import { Express } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  portfolios as portfoliosTable,
  companies as companiesTable,
  insertPortfolioSchema,
  updatePortfolioSchema,
} from "@shared/schema";
import { db } from "../db";

export function registerPortfolioRoutes(app: Express): void {
  // GET /api/portfolios — list all portfolios for authenticated user
  app.get("/api/portfolios", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const rows = await db
        .select()
        .from(portfoliosTable)
        .where(eq(portfoliosTable.ownerId, userId));
      return res.json(rows);
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

      const rows = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.json(rows[0]);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      return res.status(500).json({
        message: "Failed to fetch portfolio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

      // Verify ownership of portfolio first
      const owned = await db
        .select()
        .from(portfoliosTable)
        .where(
          and(eq(portfoliosTable.id, portfolioId), eq(portfoliosTable.ownerId, userId)),
        )
        .limit(1);

      if (owned.length === 0) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      const rows = await db
        .select()
        .from(companiesTable)
        .where(
          and(
            eq(companiesTable.portfolioId, portfolioId),
            eq(companiesTable.ownerUserId, userId),
          ),
        );

      return res.json(rows);
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
