import type { Express } from "express";
import { capabilityManifest } from "../umh/contracts";
import { federationConfig, federationConfigured } from "../umh/config";
import { verifyCommandSignature } from "../umh/crypto";
import { acceptFederatedCommand, FederationError, getFederatedOutcome } from "../umh/service";

export function registerUmhFederationRoutes(app: Express): void {
  app.get("/.well-known/umh/capability-manifest", (_req, res) => {
    res.json(capabilityManifest(federationConfigured()));
  });

  app.post("/api/umh/v1/commands", async (req, res) => {
    try {
      const result = await acceptFederatedCommand(req.body, req.header("x-umh-signature") || undefined);
      res.status(202).json(result);
    } catch (error) {
      if (error instanceof FederationError) return res.status(error.status).json({ code: error.code, message: error.message });
      console.error("UMH command failed", error);
      return res.status(500).json({ code: "command_processing_failed", message: "The command could not be processed." });
    }
  });

  app.get("/api/umh/v1/outcomes/:commandId", async (req, res) => {
    const config = federationConfig();
    const installationId = req.header("x-umh-installation-id") || "";
    const signature = req.header("x-umh-signature") || "";
    const lookup = {
      protocolVersion: "umh.federation.v1",
      commandId: req.params.commandId,
      installationId,
      issuer: config.issuer,
    };
    if (!federationConfigured(config)) return res.status(503).json({ code: "federation_unavailable" });
    if (installationId !== config.installationId || !verifyCommandSignature(lookup, signature, config.commandPublicKeyPem)) {
      return res.status(401).json({ code: "invalid_signature" });
    }
    const outcome = await getFederatedOutcome(req.params.commandId);
    if (!outcome) return res.status(404).json({ code: "outcome_not_found" });
    return res.json(outcome);
  });
}
