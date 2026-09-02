import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import * as gmail from "../integrations/gmail";
import * as notion from "../integrations/notion";
import { verifyStripeConnection } from "../integrations/stripe-health";
import { credentialEncryptionConfigured, encryptCredential } from "../security/credential-encryption";
import { db } from "../db";
import { eosIntegrationBindings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { authorizeAction, companyAccess, EosRouteError } from "./eos-runtime";

type SupportedProvider = "gmail" | "notion" | "stripe";

function providerFrom(req: Request): SupportedProvider {
  if (["gmail", "notion", "stripe"].includes(req.params.provider)) return req.params.provider as SupportedProvider;
  throw new EosRouteError(404, "integration_provider_not_found", "This provider is not available in the EOS integration registry.");
}

async function stripeConnectionStatus(companyId: number) {
  const bindings = await db.select().from(eosIntegrationBindings).where(
    eq(eosIntegrationBindings.companyId, companyId),
  );
  const binding = bindings.find((item) => item.providerKey === "stripe" && item.lifecycleState === "active")
    || bindings.find((item) => item.providerKey === "stripe")
    || null;
  if (!binding) {
    return {
      configured: false,
      connected: false,
      healthy: false,
      reason: "binding_invalid" as const,
      accountReference: null,
      bindingId: null,
    };
  }
  const health = await verifyStripeConnection(binding);
  return {
    configured: true,
    ...health,
    accountReference: binding.providerAccountReference,
    bindingId: binding.id,
  };
}

async function integrationAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string) {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("systems")) {
    throw new EosRouteError(403, "integration_scope_denied", "Provider administration is outside this seat's visibility scope.");
  }
  await authorizeAction(req, access, {
    authorityClass,
    resource: "integration",
    actionKey,
    purpose: "administer_systems_registry",
    classification: "confidential",
  });
  return access;
}

function providerError(res: Response, error: unknown) {
  if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
  return res.status(500).json({ code: "integration_provider_request_failed", message: "The provider request could not be completed." });
}

export function registerIntegrationRoutes(app: Express): void {
  // Provider OAuth controls are company- and seat-scoped even though the
  // encrypted credential belongs to the signed-in human. This prevents a
  // global provider connection surface from escaping EOS authority context.
  app.get("/api/eos/companies/:companyId/integrations/:provider/auth", async (req, res) => {
    try {
      await integrationAccess(req, "execute", "integration_provider_authorization.request");
      const provider = providerFrom(req);
      if (provider === "stripe") {
        throw new EosRouteError(409, "integration_provider_managed_connection", "Stripe is a company-managed merchant connection. Configure its binding and vaulted restricted key through the Systems registry.");
      }
      const adapter = provider === "gmail" ? gmail : notion;
      if (!adapter.isConfigured()) return res.status(400).json({ code: "integration_provider_not_configured", message: `${provider === "gmail" ? "Google Workspace" : "Notion"} OAuth or EOS credential encryption is not configured.` });
      const returnTo = `/company/${encodeURIComponent(req.params.companyId)}#systems`;
      return res.json({ authUrl: adapter.getAuthUrl(req.user.id, returnTo) });
    } catch (error) {
      return providerError(res, error);
    }
  });

  app.get("/api/eos/companies/:companyId/integrations/:provider/status", async (req, res) => {
    try {
      await integrationAccess(req, "view", "integration_provider_connection.read");
      const provider = providerFrom(req);
      if (provider === "stripe") {
        return res.json(await stripeConnectionStatus(Number(req.params.companyId)));
      }
      const adapter = provider === "gmail" ? gmail : notion;
      const verify = req.query.verify === "true";
      return res.json(verify ? await adapter.verifyConnection(req.user.id) : await adapter.connectionSummary(req.user.id));
    } catch (error) {
      return providerError(res, error);
    }
  });

  app.post("/api/eos/companies/:companyId/integrations/:provider/disconnect", async (req, res) => {
    try {
      await integrationAccess(req, "decide", "integration_provider_authorization.revoke");
      const provider = providerFrom(req);
      if (provider === "stripe") {
        throw new EosRouteError(409, "integration_provider_managed_connection", "Stripe credentials are company-managed. Revoke the binding's provider access and credential reference through the approved merchant recovery procedure.");
      }
      return res.json(provider === "gmail" ? await gmail.disconnect(req.user.id) : await notion.disconnect(req.user.id));
    } catch (error) {
      return providerError(res, error);
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

  app.get("/api/auth/notion/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/portfolios?integration_error=not_authenticated");
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const oauthState = state ? notion.readOAuthState(state, req.user.id) : null;
      if (!code) return res.redirect("/portfolios?integration_error=no_code");
      if (!oauthState) return res.redirect("/portfolios?integration_error=invalid_oauth_state");
      const redirectWith = (key: string, value: string) => {
        const [path, hash] = oauthState.returnTo.split("#");
        return `${path}?${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
      };
      if (!credentialEncryptionConfigured()) return res.redirect(redirectWith("integration_error", "credential_encryption_not_configured"));

      const tokens = await notion.exchangeCode(code);
      await storage.upsertOauthToken({
        userId: req.user.id,
        provider: "notion",
        accessToken: encryptCredential(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptCredential(tokens.refreshToken) : undefined,
        tokenType: tokens.tokenType,
        metadata: tokens.metadata,
      });
      res.redirect(redirectWith("notion", "connected"));
    } catch (error: any) {
      console.error("Notion OAuth callback error:", error);
      res.redirect("/portfolios?integration_error=oauth_callback_failed");
    }
  });

}
