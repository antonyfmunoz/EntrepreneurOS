import { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { registerCompanyRoutes } from "./routes/companies";
import { registerPortfolioRoutes } from "./routes/portfolios";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerUmhFederationRoutes } from "./routes/umh";
import { registerEosRuntimeRoutes } from "./routes/eos-runtime";
import { registerSupportRoutes } from "./routes/support";
import { registerBillingRoutes, registerBillingWebhook } from "./routes/billing";
import { registerUserRoutes } from "./routes/users";
import { registerLegalRoutes, registerPublicLegalRoutes } from "./routes/legal";
import { registerOperationalRoutes } from "./routes/operations";
import { registerPublicTalentPortalRoutes } from "./routes/talent-portal";
import { registerPublicRecoveryCalculatorRoutes, registerRecoveryCalculatorRoutes } from "./routes/recovery-calculator";
import { registerRecoveryOperationsRoutes } from "./routes/recovery-operations";
import { registerNativeEsignRoutes, registerPublicNativeEsignRoutes } from "./routes/native-esign";
import { registerComplianceRoutes } from "./routes/compliance";
import { registerCustomerSuccessRoutes } from "./routes/customer-success";
import { registerProductEvolutionRoutes } from "./routes/product-evolution";
import { registerIntegrationOperationsRoutes } from "./routes/integration-operations";
import { registerProviderIngressRoutes } from "./routes/provider-ingress";
import { registerArtifactClosureRoutes } from "./routes/artifact-closure";
import { registerNativeHandoffRoutes } from "./routes/native-handoff";
import { registerCompanyPackageLifecycleRoutes } from "./routes/company-package-lifecycle";
import { registerWorkflowRuntimeRoutes } from "./routes/workflow-runtime";
import { registerAgentRuntimeRoutes } from "./routes/agent-runtime";
import { registerAdvisorDeliberationRoutes } from "./routes/advisor-deliberation";
import { registerInstitutionalIntelligenceRoutes } from "./routes/institutional-intelligence";
import { registerInstrumentRuntimeRoutes } from "./routes/instrument-runtime";
import { registerPublicStakeholderPortalRoutes, registerStakeholderPortalRoutes } from "./routes/stakeholder-portal";
import { errorHandler } from "./middleware/error-handler";
import { blockLegacyUnscopedApis, requireLocalApiAuth } from "./middleware/api-security";
import { federationCommandRateLimit, localApiRateLimit } from "./middleware/rate-limit";
import { untrustedArtifactIngressMode } from "./security/release-configuration";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/runtime-capabilities", (_req, res) => {
    const artifactIngressMode = untrustedArtifactIngressMode();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      artifactIngressMode,
      untrustedUploadsEnabled: artifactIngressMode === "scanner_backed",
      signatureMethods: artifactIngressMode === "scanner_backed"
        ? ["typed", "drawn", "uploaded"]
        : ["typed"],
    });
  });
  // Set up authentication routes and middleware
  setupAuth(app);
  registerBillingWebhook(app);
  registerPublicLegalRoutes(app);
  registerPublicTalentPortalRoutes(app);
  registerPublicRecoveryCalculatorRoutes(app);
  registerPublicNativeEsignRoutes(app);
  registerPublicStakeholderPortalRoutes(app);

  // Signed federation ingress is authenticated by the projection-owned UMH
  // adapter. Register it before the Clerk gate; every remaining API route
  // requires a resolved local user.
  app.use("/api/umh/v1/commands", federationCommandRateLimit);
  registerUmhFederationRoutes(app);
  app.use("/api", localApiRateLimit);
  app.use("/api", requireLocalApiAuth);
  app.use("/api", blockLegacyUnscopedApis);

  // Register all resource routes
  registerCompanyRoutes(app);
  registerPortfolioRoutes(app);
  registerNotificationRoutes(app);
  registerIntegrationRoutes(app);
  registerRecoveryCalculatorRoutes(app);
  registerRecoveryOperationsRoutes(app);
  registerNativeEsignRoutes(app);
  registerComplianceRoutes(app);
  registerCustomerSuccessRoutes(app);
  registerProductEvolutionRoutes(app);
  registerIntegrationOperationsRoutes(app);
  registerProviderIngressRoutes(app);
  registerArtifactClosureRoutes(app);
  registerNativeHandoffRoutes(app);
  registerCompanyPackageLifecycleRoutes(app);
  registerWorkflowRuntimeRoutes(app);
  registerAgentRuntimeRoutes(app);
  registerAdvisorDeliberationRoutes(app);
  registerInstitutionalIntelligenceRoutes(app);
  registerInstrumentRuntimeRoutes(app);
  registerStakeholderPortalRoutes(app);
  registerEosRuntimeRoutes(app);
  registerSupportRoutes(app);
  registerBillingRoutes(app);
  registerUserRoutes(app);
  registerLegalRoutes(app);
  registerOperationalRoutes(app);

  // __ORCHESTRATOR_GENERATED_ROUTES__ (do not remove this marker)
  {
    const { registerGeneratedRoutes } = await import("./generated/index.js");
    await registerGeneratedRoutes(app);
  }

  // Centralized error handling
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
