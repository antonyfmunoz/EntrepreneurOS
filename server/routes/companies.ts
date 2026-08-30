import { Express } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  companies as companiesTable,
  departments as departmentsTable,
  eosSeats,
  roles as rolesTable,
  workflows as workflowsTable,
} from "@shared/schema";
import { db } from "../db";
import { hasEntitlement } from "../billing/stripe";

async function ownsCompany(companyId: number, userId: string): Promise<boolean> {
  const rows = await db.select({ id: companiesTable.id }).from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerUserId, userId))).limit(1);
  return rows.length === 1;
}

export function registerCompanyRoutes(app: Express): void {
  app.get("/api/companies", async (req, res, next) => {
    try {
      const rows = await db.select().from(companiesTable).where(eq(companiesTable.ownerUserId, req.user.id));
      return res.json({ companies: rows });
    } catch (error) { return next(error); }
  });
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

  // Legacy company-task projection. EOS work is governed by role-visible Work
  // Packets; returning an empty array here made a broken screen look healthy.
  app.get("/api/companies/:id/tasks", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const companyId = Number(req.params.id);
      if (!Number.isInteger(companyId) || !(await ownsCompany(companyId, req.user.id))) {
        return res.status(404).json({ message: "Company not found" });
      }
      return res.status(410).json({
        code: "company_tasks_replaced_by_work_packets",
        message: "Company tasks have moved to the governed EOS Work Room.",
        replacement: `/api/eos/companies/${companyId}/work-packets`,
      });
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
      const numericCompanyId = Number(req.params.id);
      if (!Number.isInteger(numericCompanyId) || !(await ownsCompany(numericCompanyId, req.user.id))) {
        return res.status(404).json({ message: "Company not found" });
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
      const numericCompanyId = Number(req.params.id);
      if (!Number.isInteger(numericCompanyId) || !(await ownsCompany(numericCompanyId, req.user.id))) {
        return res.status(404).json({ message: "Company not found" });
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
      if (!(await ownsCompany(companyId, req.user.id))) {
        return res.status(404).json({ message: "Company not found" });
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
      legalName: z.string().trim().min(1).max(240).optional(),
      assumedBusinessNames: z.array(z.string().trim().min(2).max(240)).max(30).optional(),
      type: z.string().optional(),
      stage: z.string().optional(),
      offer: z.string().optional(),
      targetCustomer: z.string().optional(),
      goals: z.string().optional(),
      assistantName: z.string().trim().min(1).max(40).optional(),
      founderProfile: z.record(z.unknown()).optional(),
    });

    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      if (!(await hasEntitlement(userId, "company:create"))) {
        return res.status(402).json({ code: "entitlement_required", message: "Your current plan does not permit another company." });
      }
      const data = createCompanySchema.parse(req.body);

      const [created] = await db
        .insert(companiesTable)
        .values({
          ownerUserId: userId,
          name: data.name,
          legalName: data.legalName || data.name,
          assumedBusinessNames: data.assumedBusinessNames || [],
          type: data.type ?? null,
          stage: data.stage ?? null,
          offer: data.offer ?? null,
          targetCustomer: data.targetCustomer ?? null,
          goals: data.goals ?? null,
          assistantName: data.assistantName || "Assistant",
          founderProfile: data.founderProfile || {},
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
      legalName: z.string().trim().min(1).max(240).optional(),
      assumedBusinessNames: z.array(z.string().trim().min(2).max(240)).max(30).optional(),
      type: z.string().optional().nullable(),
      stage: z.string().optional().nullable(),
      offer: z.string().optional().nullable(),
      targetCustomer: z.string().optional().nullable(),
      goals: z.string().optional().nullable(),
      assistantName: z.string().trim().min(1).max(40).optional().nullable(),
      founderProfile: z.record(z.unknown()).optional(),
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

      const updated = await db.transaction(async (tx) => {
        const [company] = await tx
          .update(companiesTable)
          .set(updateData)
          .where(
            and(
              eq(companiesTable.id, companyId),
              eq(companiesTable.ownerUserId, userId),
            ),
          )
          .returning();
        if (Object.hasOwn(update, "assistantName"))
          await tx
            .update(eosSeats)
            .set({
              agentName: update.assistantName || "Assistant",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(eosSeats.companyId, companyId),
                eq(eosSeats.kind, "founder"),
                eq(eosSeats.status, "active"),
              ),
            );
        return company;
      });

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

  app.put("/api/companies/:id", async (req, res, next) => {
    const updateSchema = z.object({
      name: z.string().trim().min(1).max(160).optional(),
      legalName: z.string().trim().min(1).max(240).optional(),
      assumedBusinessNames: z.array(z.string().trim().min(2).max(240)).max(30).optional(),
      stage: z.string().trim().max(80).optional(),
      goals: z.string().trim().max(10_000).optional(),
    }).strict();
    try {
      const companyId = Number(req.params.id);
      if (!Number.isInteger(companyId)) return res.status(400).json({ code: "invalid_company", message: "Invalid company id." });
      const update = updateSchema.parse(req.body);
      const [company] = await db.update(companiesTable).set(update).where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerUserId, req.user.id))).returning();
      if (!company) return res.status(404).json({ code: "company_not_found", message: "Company not found." });
      return res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_company_update", message: "Check the company fields.", issues: error.issues });
      return next(error);
    }
  });

  app.put("/api/companies/:id/autonomy", (_req, res) => {
    return res.status(410).json({
      code: "autonomy_not_runtime_enforced",
      message: "A company-wide autonomy switch is unavailable. EOS authority is enforced through roles, work packets, approvals, and evidence requirements.",
    });
  });
}
