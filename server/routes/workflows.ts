import { Express } from "express";
import { db } from "../db";
import { workflows, insertWorkflowSchema } from "@shared/schema";

export function registerWorkflowRoutes(app: Express): void {
  app.get("/api/workflows", async (req, res) => {
    try {
      const allWorkflows = await db.select().from(workflows);
      res.json(allWorkflows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/workflows", async (req, res) => {
    try {
      const parsed = insertWorkflowSchema.parse(req.body);

      const newWorkflow = await db
        .insert(workflows)
        .values({
          id: crypto.randomUUID(),
          ...parsed,
        })
        .returning();

      res.json(newWorkflow[0]);
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: "Invalid workflow data" });
    }
  });
}
