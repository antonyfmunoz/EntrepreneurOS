import { Express } from "express";
import { storage } from "../storage";
import { executeAction } from "../services/action-executor";

export function registerActionRoutes(app: Express): void {
  app.get("/api/actions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const { status, agentId } = req.query;
      const actions = await storage.getActions(userId, {
        status: status as string | undefined,
        agentId: agentId as string | undefined,
      });
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/actions/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const actions = await storage.getPendingActions(userId);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/actions/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const action = await storage.getAction(req.params.id);
      if (!action) return res.status(404).json({ message: "Action not found" });
      res.json(action);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/actions/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const action = await storage.getAction(req.params.id);
      if (!action) return res.status(404).json({ message: "Action not found" });
      if (action.userId !== userId) return res.status(403).json({ message: "Not authorized" });

      await storage.updateAction(action.id, {
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
      });

      const result = await executeAction({ ...action, status: "approved" });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/actions/:id/reject", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const action = await storage.getAction(req.params.id);
      if (!action) return res.status(404).json({ message: "Action not found" });
      if (action.userId !== userId) return res.status(403).json({ message: "Not authorized" });

      const updated = await storage.updateAction(action.id, {
        status: "rejected",
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
