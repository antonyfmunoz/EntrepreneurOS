import { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { registerAIRoutes } from "./routes/ai";
import { registerAgentRoutes } from "./routes/agents";
import { registerTaskRoutes } from "./routes/tasks";
import { registerCompanyRoutes } from "./routes/companies";
import { registerWorkflowRoutes } from "./routes/workflows";
import { registerConversationRoutes } from "./routes/conversations";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerCRMRoutes } from "./routes/crm";
import { registerDocumentRoutes } from "./routes/documents";
import { registerActionRoutes } from "./routes/actions";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { errorHandler } from "./middleware/error-handler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  setupAuth(app);

  // Register all resource routes
  registerAIRoutes(app);
  registerAgentRoutes(app);
  registerCompanyRoutes(app);
  registerWorkflowRoutes(app);
  registerTaskRoutes(app);
  registerConversationRoutes(app);
  registerNotificationRoutes(app);
  registerIntegrationRoutes(app);
  registerCRMRoutes(app);
  registerDocumentRoutes(app);
  registerActionRoutes(app);
  registerAnalyticsRoutes(app);

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
