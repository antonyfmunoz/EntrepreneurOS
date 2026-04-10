import { Express } from "express";
import { storage } from "../storage";

export function registerConversationRoutes(app: Express): void {
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({
        message: "Failed to fetch conversation",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
