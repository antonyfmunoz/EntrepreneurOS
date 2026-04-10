import { Express } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { companies as companiesTable } from "@shared/schema";
import { db } from "../db";

export function registerCompanyRoutes(app: Express): void {
  app.get("/api/company", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const companies = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.ownerUserId, userId))
        .limit(1);

      if (companies.length === 0) {
        return res.status(404).json({ message: "Company not found" });
      }

      return res.json(companies[0]);
    } catch (error) {
      console.error("Error fetching company:", error);
      return res.status(500).json({
        message: "Failed to fetch company",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/company", async (req, res) => {
    const createCompanySchema = z.object({
      name: z.string().min(1, "Name is required"),
      type: z.string().optional(),
      stage: z.string().optional(),
      offer: z.string().optional(),
      targetCustomer: z.string().optional(),
      goals: z.string().optional(),
      assistantName: z.string().optional(),
    });

    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const data = createCompanySchema.parse(req.body);

      const [created] = await db
        .insert(companiesTable)
        .values({
          ownerUserId: userId,
          name: data.name,
          type: data.type ?? null,
          stage: data.stage ?? null,
          offer: data.offer ?? null,
          targetCustomer: data.targetCustomer ?? null,
          goals: data.goals ?? null,
          assistantName: data.assistantName || "Assistant",
        })
        .returning();

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid company data", errors: error.errors });
      }
      console.error("Error creating company:", error);
      return res.status(500).json({
        message: "Failed to create company",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/company/:id", async (req, res) => {
    const updateCompanySchema = z.object({
      name: z.string().min(1).optional(),
      type: z.string().optional().nullable(),
      stage: z.string().optional().nullable(),
      offer: z.string().optional().nullable(),
      targetCustomer: z.string().optional().nullable(),
      goals: z.string().optional().nullable(),
      assistantName: z.string().optional().nullable(),
    });

    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const companyId = Number(req.params.id);
      if (!Number.isFinite(companyId)) {
        return res.status(400).json({ message: "Invalid company id" });
      }

      const update = updateCompanySchema.parse(req.body);

      const existing = await db
        .select()
        .from(companiesTable)
        .where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerUserId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: "Company not found" });
      }

      const updateData: Record<string, any> = {};
      for (const [k, v] of Object.entries(update)) {
        if (v !== undefined) updateData[k] = v;
      }

      const [updated] = await db
        .update(companiesTable)
        .set(updateData)
        .where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerUserId, userId)))
        .returning();

      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid company update", errors: error.errors });
      }
      console.error("Error updating company:", error);
      return res.status(500).json({
        message: "Failed to update company",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
