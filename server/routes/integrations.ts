import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { eosAuditRecords, eosIntegrationBindings, eosProviderConnections } from "@shared/schema";
import { storage } from "../storage";
import { db } from "../db";
import * as gmail from "../integrations/gmail";
import * as notion from "../integrations/notion";
import { verifyStripeConnection } from "../integrations/stripe-health";
import { credentialEncryptionConfigured, encryptCredential } from "../security/credential-encryption";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { authorizeAction, companyAccess, EosRouteError, visibleSeatIds } from "./eos-runtime";

type SupportedProvider = "gmail" | "notion" | "stripe";
type OAuthProvider = Exclude<SupportedProvider, "stripe">;
type CompanyProviderKey = "google_workspace" | "notion";

const attachConnectionSchema = z.object({
  ownerSeatId: z.string().uuid().optional(),
  recoveryOwnerSeatId: z.string().uuid().optional(),
}).strict();

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

function oauthProvider(provider: SupportedProvider): OAuthProvider {
  if (provider === "stripe") {
    throw new EosRouteError(409, "integration_provider_managed_connection", "Stripe is a company-managed merchant connection. Configure its binding and vaulted restricted key through the Systems registry.");
  }
  return provider;
}

function companyProviderKey(provider: OAuthProvider): CompanyProviderKey {
  return provider === "gmail" ? "google_workspace" : "notion";
}

function providerLabel(provider: SupportedProvider): string {
  return provider === "gmail" ? "Google Workspace" : provider === "notion" ? "Notion" : "Stripe";
}

async function integrationAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string) {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("systems")) {
    throw new EosRouteError(403, "integration_scope_denied", "Provider administration is outside this seat's visibility scope.");
  }
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: "integration",
    actionKey,
    purpose: "administer_systems_registry",
    classification: "confidential",
  });
  return { access, policy };
}

type ProviderIdentity = {
  connected: boolean;
  healthy: boolean;
  accountReference: string | null;
  accountScope: string;
  grantedPermissions: string[];
  providerMetadata: Record<string, unknown>;
};

/** Reads provider identity only from the current person's encrypted OAuth credential. */
async function providerIdentity(provider: OAuthProvider, userId: string): Promise<ProviderIdentity> {
  if (provider === "gmail") {
    const result = await gmail.verifyConnection(userId);
    return {
      connected: result.connected,
      healthy: result.healthy,
      accountReference: result.accountEmail,
      accountScope: result.grantedScopes.length
        ? `Google Workspace services: ${Object.entries(result.services).filter(([, available]) => available).map(([service]) => service).join(", ") || "none"}`
        : "",
      grantedPermissions: result.grantedScopes,
      providerMetadata: result.accountEmail ? { accountEmail: result.accountEmail, services: result.services } : { services: result.services },
    };
  }

  const result = await notion.verifyConnection(userId);
  const workspace = result.workspace;
  return {
    connected: result.connected,
    healthy: result.healthy,
    accountReference: workspace?.workspaceId || workspace?.workspaceName || null,
    accountScope: workspace?.workspaceName
      ? `Notion workspace: ${workspace.workspaceName}; EOS can read only content shared with its integration.`
      : "",
    grantedPermissions: ["Read content explicitly shared with the EntrepreneurOS integration"],
    providerMetadata: workspace ? {
      workspaceId: workspace.workspaceId || null,
      workspaceName: workspace.workspaceName || null,
      botId: workspace.botId || null,
      ownerType: workspace.ownerType || null,
    } : {},
  };
}

function connectionProjection(connection: typeof eosProviderConnections.$inferSelect, currentUserId?: string) {
  return {
    id: connection.id,
    providerKey: connection.providerKey,
    providerAccountReference: connection.providerAccountReference,
    accountScope: connection.accountScope,
    grantedPermissions: connection.grantedPermissions,
    authorizedForCurrentUser: currentUserId === undefined ? undefined : connection.authorizationUserId === currentUserId,
    ownerSeatId: connection.ownerSeatId,
    recoveryOwnerSeatId: connection.recoveryOwnerSeatId,
    connectionState: connection.connectionState,
    healthState: connection.healthState,
    providerMetadata: connection.providerMetadata,
    lastHealthAt: connection.lastHealthAt,
    revokedAt: connection.revokedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

async function visibleCompanyConnection(companyId: number, connectionId: string, access: Awaited<ReturnType<typeof companyAccess>>) {
  const connection = await db.query.eosProviderConnections.findFirst({
    where: and(eq(eosProviderConnections.id, connectionId), eq(eosProviderConnections.companyId, companyId)),
  });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!connection || !visible.has(connection.ownerSeatId)) {
    throw new EosRouteError(404, "provider_connection_not_found", "Provider connection not found in this authority scope.");
  }
  return connection;
}

function providerError(res: Response, error: unknown) {
  if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ code: "provider_connection_input_invalid", message: error.issues[0]?.message || "Provider connection input is invalid." });
  return res.status(500).json({ code: "integration_provider_request_failed", message: "The provider request could not be completed." });
}

export function registerIntegrationRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/integrations/:provider/auth", async (req, res) => {
    try {
      await integrationAccess(req, "execute", "integration_provider_authorization.request");
      const provider = oauthProvider(providerFrom(req));
      const adapter = provider === "gmail" ? gmail : notion;
      if (!adapter.isConfigured()) return res.status(400).json({ code: "integration_provider_not_configured", message: `${providerLabel(provider)} OAuth or EOS credential encryption is not configured.` });
      const returnTo = `/company/${encodeURIComponent(req.params.companyId)}#systems`;
      return res.json({ authUrl: adapter.getAuthUrl(req.user.id, returnTo) });
    } catch (error) { return providerError(res, error); }
  });

  app.get("/api/eos/companies/:companyId/integrations/:provider/status", async (req, res) => {
    try {
      await integrationAccess(req, "view", "integration_provider_connection.read");
      const requestedProvider = providerFrom(req);
      if (requestedProvider === "stripe") {
        return res.json(await stripeConnectionStatus(Number(req.params.companyId)));
      }
      const provider = oauthProvider(requestedProvider);
      const adapter = provider === "gmail" ? gmail : notion;
      return res.json(req.query.verify === "true" ? await adapter.verifyConnection(req.user.id) : await adapter.connectionSummary(req.user.id));
    } catch (error) { return providerError(res, error); }
  });

  app.get("/api/eos/companies/:companyId/integrations/:provider/connections", async (req, res) => {
    try {
      const { access } = await integrationAccess(req, "view", "integration_provider_connection.read");
      const provider = oauthProvider(providerFrom(req));
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      const connections = await db.select().from(eosProviderConnections).where(and(
        eq(eosProviderConnections.companyId, access.company.id),
        eq(eosProviderConnections.providerKey, companyProviderKey(provider)),
      ));
      return res.json({
        currentAuthorization: await providerIdentity(provider, req.user.id),
        connections: connections.filter((connection) => visible.has(connection.ownerSeatId)).map((connection) => connectionProjection(connection, req.user.id)),
      });
    } catch (error) { return providerError(res, error); }
  });

  // This is the tenant boundary. It adopts a verified OAuth authorization for
  // this company only; it does not activate provider effects or a binding.
  app.post("/api/eos/companies/:companyId/integrations/:provider/connections/attach", async (req, res) => {
    try {
      const { access, policy } = await integrationAccess(req, "execute", "integration_provider_connection.attach");
      const provider = oauthProvider(providerFrom(req));
      const input = attachConnectionSchema.parse(req.body || {});
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      const recoveryOwnerSeatId = input.recoveryOwnerSeatId || ownerSeatId;
      if (!visible.has(ownerSeatId) || !visible.has(recoveryOwnerSeatId)) {
        throw new EosRouteError(403, "provider_connection_owner_scope_denied", "The accountable and recovery seats must be inside your visible company hierarchy.");
      }
      const identity = await providerIdentity(provider, req.user.id);
      if (!identity.connected || !identity.healthy || !identity.accountReference) {
        throw new EosRouteError(409, "provider_authorization_not_verified", `Connect and verify ${providerLabel(provider)} before attaching it to this company.`);
      }
      const providerKey = companyProviderKey(provider);
      const now = new Date();
      const [existing] = await db.select().from(eosProviderConnections).where(and(
        eq(eosProviderConnections.companyId, access.company.id),
        eq(eosProviderConnections.providerKey, providerKey),
        eq(eosProviderConnections.providerAccountReference, identity.accountReference),
      )).limit(1);
      if (existing && !visible.has(existing.ownerSeatId)) {
        throw new EosRouteError(409, "provider_connection_owner_not_visible", "That provider account is already linked to this company under a seat outside your authority scope.");
      }
      const values = {
        authorizationUserId: req.user.id, ownerSeatId, recoveryOwnerSeatId,
        accountScope: identity.accountScope, grantedPermissions: identity.grantedPermissions,
        credentialReference: "encrypted_user_oauth", connectionState: "connected", healthState: "healthy",
        providerMetadata: identity.providerMetadata, lastHealthAt: now, revokedAt: null, updatedAt: now,
      } as const;
      const connection = existing
        ? (await db.update(eosProviderConnections).set(values).where(eq(eosProviderConnections.id, existing.id)).returning())[0]
        : (await db.insert(eosProviderConnections).values({
          id: randomUUID(), companyId: access.company.id, providerKey,
          providerAccountReference: identity.accountReference, createdByUserId: req.user.id, createdAt: now, ...values,
        }).returning())[0];
      await db.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
        action: "provider_connection.attached", targetType: "provider_connection", targetId: connection.id,
        traceId: policy.traceId, correlationId: policy.correlationId, result: "connected",
        details: { providerKey, providerAccountReference: identity.accountReference, ownerSeatId, recoveryOwnerSeatId, policyDecisionId: policy.decisionId }, createdAt: now,
      });
      return res.status(existing ? 200 : 201).json(connectionProjection(connection));
    } catch (error) { return providerError(res, error); }
  });

  app.post("/api/eos/companies/:companyId/integrations/:provider/connections/:connectionId/verify", async (req, res) => {
    try {
      const { access, policy } = await integrationAccess(req, "execute", "integration_provider_connection.verify");
      const provider = oauthProvider(providerFrom(req));
      const connection = await visibleCompanyConnection(access.company.id, req.params.connectionId, access);
      if (connection.providerKey !== companyProviderKey(provider)) throw new EosRouteError(404, "provider_connection_not_found", "Provider connection not found in this authority scope.");
      if (connection.authorizationUserId !== req.user.id) throw new EosRouteError(409, "provider_connection_reauthorization_required", "This company connection is owned by another authorized seat. That seat must reauthorize it, or an authorized administrator can attach their own provider account.");
      const identity = await providerIdentity(provider, req.user.id);
      const healthy = identity.connected && identity.healthy && identity.accountReference === connection.providerAccountReference;
      const now = new Date();
      const [updated] = await db.update(eosProviderConnections).set({
        connectionState: healthy ? "connected" : "failed", healthState: healthy ? "healthy" : identity.connected ? "degraded" : "unavailable",
        accountScope: identity.accountScope || connection.accountScope,
        grantedPermissions: identity.grantedPermissions.length ? identity.grantedPermissions : connection.grantedPermissions,
        providerMetadata: Object.keys(identity.providerMetadata).length ? identity.providerMetadata : connection.providerMetadata,
        lastHealthAt: now, updatedAt: now,
      }).where(eq(eosProviderConnections.id, connection.id)).returning();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
        action: "provider_connection.verified", targetType: "provider_connection", targetId: updated.id,
        traceId: policy.traceId, correlationId: policy.correlationId, result: updated.healthState,
        details: { providerKey: updated.providerKey, policyDecisionId: policy.decisionId }, createdAt: now,
      });
      return res.json(connectionProjection(updated));
    } catch (error) { return providerError(res, error); }
  });

  // This only revokes company use. The underlying human OAuth credential may
  // remain safely attached to another company the same person serves.
  app.post("/api/eos/companies/:companyId/integrations/:provider/connections/:connectionId/revoke", async (req, res) => {
    try {
      const { access, policy } = await integrationAccess(req, "decide", "integration_provider_connection.revoke");
      const provider = oauthProvider(providerFrom(req));
      const connection = await visibleCompanyConnection(access.company.id, req.params.connectionId, access);
      if (connection.providerKey !== companyProviderKey(provider)) throw new EosRouteError(404, "provider_connection_not_found", "Provider connection not found in this authority scope.");
      const now = new Date();
      const [updated] = await db.update(eosProviderConnections).set({ connectionState: "revoked", healthState: "unknown", revokedAt: now, updatedAt: now }).where(eq(eosProviderConnections.id, connection.id)).returning();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
        action: "provider_connection.revoked", targetType: "provider_connection", targetId: updated.id,
        traceId: policy.traceId, correlationId: policy.correlationId, result: "revoked",
        details: { providerKey: updated.providerKey, policyDecisionId: policy.decisionId }, createdAt: now,
      });
      return res.json(connectionProjection(updated));
    } catch (error) { return providerError(res, error); }
  });

  // Account-wide disconnect is deliberately stronger. It refuses to remove a
  // credential while it is still linked to another company.
  app.post("/api/eos/companies/:companyId/integrations/:provider/disconnect", async (req, res) => {
    try {
      const { access } = await integrationAccess(req, "decide", "integration_provider_authorization.revoke");
      const requestedProvider = providerFrom(req);
      if (requestedProvider === "stripe") {
        throw new EosRouteError(409, "integration_provider_managed_connection", "Stripe credentials are company-managed. Revoke the binding's provider access and credential reference through the approved merchant recovery procedure.");
      }
      const provider = oauthProvider(requestedProvider);
      const otherConnections = await db.select({ companyId: eosProviderConnections.companyId }).from(eosProviderConnections).where(and(
        eq(eosProviderConnections.authorizationUserId, req.user.id),
        eq(eosProviderConnections.providerKey, companyProviderKey(provider)),
        eq(eosProviderConnections.connectionState, "connected"),
      ));
      if (otherConnections.some((connection) => connection.companyId !== access.company.id)) {
        throw new EosRouteError(409, "provider_authorization_shared_across_companies", "This provider authorization is still attached to another company. Revoke the company-specific connection there first; EOS will not break another tenant's provider access.");
      }
      return res.json(provider === "gmail" ? await gmail.disconnect(req.user.id) : await notion.disconnect(req.user.id));
    } catch (error) { return providerError(res, error); }
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
      const tokens = await gmail.exchangeCode(code);
      await storage.upsertOauthToken({ userId: req.user.id, provider: "gmail", accessToken: encryptCredential(tokens.accessToken), refreshToken: tokens.refreshToken ? encryptCredential(tokens.refreshToken) : undefined, expiresAt: tokens.expiresAt, scope: tokens.scope });
      res.redirect(redirectWith("google_workspace", "authorized"));
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
      await storage.upsertOauthToken({ userId: req.user.id, provider: "notion", accessToken: encryptCredential(tokens.accessToken), refreshToken: tokens.refreshToken ? encryptCredential(tokens.refreshToken) : undefined, tokenType: tokens.tokenType, metadata: tokens.metadata });
      res.redirect(redirectWith("notion", "authorized"));
    } catch (error: any) {
      console.error("Notion OAuth callback error:", error);
      res.redirect("/portfolios?integration_error=oauth_callback_failed");
    }
  });
}
