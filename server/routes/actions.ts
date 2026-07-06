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

      // Atomic claim: pending → approved. Returns undefined when the action
      // was already approved/rejected/executing/completed — prevents a
      // double-approve from re-firing effects (e.g. sending a second email).
      const claimed = await storage.claimPendingAction(action.id, {
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
      });
      if (!claimed) {
        const current = await storage.getAction(action.id);
        return res.status(409).json({
          message: `Action is not pending (current status: ${current?.status ?? "unknown"}) — approve not applied`,
          status: current?.status ?? action.status,
        });
      }

      const result = await executeAction(claimed);
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

      // Atomic claim: pending → rejected. Same status-claim doctrine as approve.
      const claimed = await storage.claimPendingAction(action.id, {
        status: "rejected",
      });
      if (!claimed) {
        const current = await storage.getAction(action.id);
        return res.status(409).json({
          message: `Action is not pending (current status: ${current?.status ?? "unknown"}) — reject not applied`,
          status: current?.status ?? action.status,
        });
      }
      res.json(claimed);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
