import { Express } from "express";
import { storage } from "../storage";
import * as gmail from "../integrations/gmail";
import * as notion from "../integrations/notion";
import { credentialEncryptionConfigured, encryptCredential } from "../security/credential-encryption";

export function registerIntegrationRoutes(app: Express): void {
  app.get("/api/integrations", async (_req, res) => {
    const integrations = await storage.getIntegrations();
    res.json(integrations);
  });

  // Google Workspace OAuth routes. Provider connection state is derived from
  // encrypted OAuth credentials, never from the legacy integration catalog.
  app.get("/api/integrations/gmail/auth", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      if (!gmail.isConfigured()) {
        return res.status(400).json({ message: "Gmail OAuth or EOS credential encryption is not configured." });
      }
      const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
      const authUrl = gmail.getAuthUrl(req.user.id, returnTo);
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/portfolios?integration_error=not_authenticated");
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      if (!code) return res.redirect("/portfolios?integration_error=no_code");
      const oauthState = state ? gmail.readOAuthState(state, req.user.id) : null;
      if (!oauthState) return res.redirect("/portfolios?integration_error=invalid_oauth_state");
      const redirectWith = (key: string, value: string) => {
        const [path, hash] = oauthState.returnTo.split("#");
        return `${path}?${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
      };
      if (!credentialEncryptionConfigured()) return res.redirect(redirectWith("integration_error", "credential_encryption_not_configured"));

      const userId = (req.user as any).id;
      const tokens = await gmail.exchangeCode(code);

      await storage.upsertOauthToken({
        userId,
        provider: "gmail",
        accessToken: encryptCredential(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptCredential(tokens.refreshToken) : undefined,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      });

      res.redirect(redirectWith("google_workspace", "connected"));
    } catch (error: any) {
      console.error("Gmail OAuth callback error:", error);
      res.redirect("/portfolios?integration_error=oauth_callback_failed");
    }
  });

  app.get("/api/integrations/gmail/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const verify = req.query.verify === "true";
      res.json(verify ? await gmail.verifyConnection(userId) : await gmail.connectionSummary(userId));
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

  app.get("/api/integrations/notion/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(await notion.verifyConnection());
  });
}
