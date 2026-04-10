import { Express } from "express";
import { storage } from "../storage";
import * as gmail from "../integrations/gmail";

export function registerIntegrationRoutes(app: Express): void {
  app.get("/api/integrations", async (_req, res) => {
    const integrations = await storage.getIntegrations();
    res.json(integrations);
  });

  app.post("/api/integrations/connect", async (req, res) => {
    try {
      const { type } = req.body;
      if (!type) {
        return res.status(400).json({ message: "Integration type is required" });
      }

      const integration = await storage.connectIntegration(type);

      // Create a notification for the user when integration is connected
      if (req.user && integration) {
        await storage.createNotification({
          userId: req.user.id,
          title: "Integration Connected",
          content: `${integration.name} integration has been successfully connected`,
          type: "integration-connected",
          href: "/integrations",
          relatedId: integration.id
        });
      }

      res.status(201).json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to connect integration" });
    }
  });

  // Gmail Routes
  app.get("/api/integrations/gmail/auth", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      if (!gmail.isConfigured()) {
        return res.status(400).json({ message: "Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
      }
      const authUrl = gmail.getAuthUrl();
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/integrations?error=not_authenticated");
    try {
      const code = req.query.code as string;
      if (!code) return res.redirect("/integrations?error=no_code");

      const userId = (req.user as any).id;
      const tokens = await gmail.exchangeCode(code);

      await storage.upsertOauthToken({
        userId,
        provider: "gmail",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      });

      res.redirect("/integrations?gmail=connected");
    } catch (error: any) {
      console.error("Gmail OAuth callback error:", error);
      res.redirect(`/integrations?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.get("/api/integrations/gmail/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const connected = await gmail.isConnected(userId);
      const configured = gmail.isConfigured();
      res.json({ connected, configured });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/integrations/gmail/disconnect", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      await storage.deleteOauthToken(userId, "gmail");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
