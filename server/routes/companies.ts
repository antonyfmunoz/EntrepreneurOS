import { Express } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  companies as companiesTable,
  departments as departmentsTable,
  roles as rolesTable,
  workflows as workflowsTable,
} from "@shared/schema";
import { db } from "../db";

export function registerCompanyRoutes(app: Express): void {
  // GET /api/companies/:id — single company by ID
  app.get("/api/companies/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = req.user.id;
      const companyId = Number(req.params.id);
      if (!Number.isFinite(companyId)) {
        return res.status(400).json({ message: "Invalid company id" });
      }
      const rows = await db
        .select()
        .from(companiesTable)
        .where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerUserId, userId)))
        .limit(1);
      if (rows.length === 0) {
        return res.status(404).json({ message: "Company not found" });
      }
      return res.json(rows[0]);
    } catch (error) {
      console.error("Error fetching company by id:", error);
      return res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // GET /api/companies/:id/tasks — tasks scoped to company (placeholder: returns [])
  app.get("/api/companies/:id/tasks", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Tasks table has no companyId column — return empty until schema is extended
      return res.json([]);
    } catch (error) {
      console.error("Error fetching company tasks:", error);
      return res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // GET /api/companies/:id/departments — departments for company
  app.get("/api/companies/:id/departments", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const companyId = req.params.id;
      const rows = await db
        .select()
        .from(departmentsTable)
        .where(eq(departmentsTable.companyId, companyId));
      return res.json(rows);
    } catch (error) {
      console.error("Error fetching company departments:", error);
      return res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  // GET /api/companies/:id/roles — roles for company
  app.get("/api/companies/:id/roles", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const companyId = req.params.id;
      const rows = await db
        .select()
        .from(rolesTable)
        .where(eq(rolesTable.companyId, companyId));
      return res.json(rows);
    } catch (error) {
      console.error("Error fetching company roles:", error);
      return res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // GET /api/companies/:id/workflows — workflows for company
  app.get("/api/companies/:id/workflows", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const companyId = Number(req.params.id);
      if (!Number.isFinite(companyId)) {
        return res.status(400).json({ message: "Invalid company id" });
      }
      const rows = await db
        .select()
        .from(workflowsTable)
        .where(eq(workflowsTable.companyId, companyId));
      return res.json(rows);
    } catch (error) {
      console.error("Error fetching company workflows:", error);
      return res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  // GET /api/company — legacy: return first company for user
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
