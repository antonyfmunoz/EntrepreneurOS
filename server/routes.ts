import { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { registerAIRoutes } from "./routes/ai";
import { registerAgentRoutes } from "./routes/agents";
import { registerTaskRoutes } from "./routes/tasks";
import { registerCompanyRoutes } from "./routes/companies";
import { registerPortfolioRoutes } from "./routes/portfolios";
import { registerWorkflowRoutes } from "./routes/workflows";
import { registerConversationRoutes } from "./routes/conversations";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerUmhFederationRoutes } from "./routes/umh";
import { registerEosRuntimeRoutes } from "./routes/eos-runtime";
import { registerSupportRoutes } from "./routes/support";
import { registerBillingRoutes, registerBillingWebhook } from "./routes/billing";
import { registerUserRoutes } from "./routes/users";
import { registerLegalRoutes, registerPublicLegalRoutes } from "./routes/legal";
import { registerOperationalRoutes } from "./routes/operations";
import { errorHandler } from "./middleware/error-handler";
import { blockLegacyUnscopedApis, requireLocalApiAuth } from "./middleware/api-security";
import { federationCommandRateLimit, localApiRateLimit } from "./middleware/rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  setupAuth(app);
  registerBillingWebhook(app);
  registerPublicLegalRoutes(app);

  // Signed federation ingress is authenticated by the projection-owned UMH
  // adapter. Register it before the Clerk gate; every remaining API route
  // requires a resolved local user.
  app.use("/api/umh/v1/commands", federationCommandRateLimit);
  registerUmhFederationRoutes(app);
  app.use("/api", localApiRateLimit);
  app.use("/api", requireLocalApiAuth);
  app.use("/api", blockLegacyUnscopedApis);

  // Register all resource routes
  registerAIRoutes(app);
  registerAgentRoutes(app);
  registerCompanyRoutes(app);
  registerPortfolioRoutes(app);
  registerWorkflowRoutes(app);
  registerTaskRoutes(app);
  registerConversationRoutes(app);
  registerNotificationRoutes(app);
  registerIntegrationRoutes(app);
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
