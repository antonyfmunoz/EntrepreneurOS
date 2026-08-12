



import express from "express";
import { sql } from "drizzle-orm";
import { registerRoutes } from "./routes";
import { startFederationOutboxWorker } from "./umh/outbox";
import { serveStatic, log } from "./runtime";
import { client, db } from "./db";
import { applySecurityHeaders, sanitizeServerErrors } from "./middleware/api-security";
import { shutdownPosthog } from "./posthog";
import { requestTelemetry, writeLog } from "./observability/logger";
import { startAccountDeletionWorker } from "./lifecycle/account-deletion";

const app = express();
app.use(applySecurityHeaders);
app.use(sanitizeServerErrors);
app.use(requestTelemetry);
app.use(express.json({
  limit: process.env.EOS_JSON_BODY_LIMIT || "1mb",
  verify(req, _res, buffer) {
    const request = req as express.Request;
    if (request.originalUrl === "/api/billing/webhook") request.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: false, limit: process.env.EOS_FORM_BODY_LIMIT || "256kb" }));

// Health check endpoint — required by Dockerfile HEALTHCHECK and platform health probes
// (Railway, Render, Fly.io all probe this path). Placed before route registration so it
// responds even if registerRoutes has issues.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", app: "eos" });
});

app.get("/api/ready", async (_req, res) => {
  const required = ["DATABASE_URL", "CLERK_SECRET_KEY", "EOS_CREDENTIAL_ENCRYPTION_KEY"];
  const missing = process.env.NODE_ENV === "production"
    ? required.filter((name) => !process.env[name]?.trim())
    : [];
  try {
    await db.execute(sql`select 1`);
    if (missing.length) return res.status(503).json({ status: "not_ready", reason: "configuration" });
    return res.status(200).json({ status: "ready", app: "eos" });
  } catch {
    return res.status(503).json({ status: "not_ready", reason: "database" });
  }
});

void (async () => {
  const server = await registerRoutes(app);
  const stopOutbox = startFederationOutboxWorker();
  const stopDeletionWorker = startAccountDeletionWorker();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // PORT env var support: Railway, Render, Fly.io inject PORT at runtime.
  // Defaults to 5000 for local development.
  const port = parseInt(process.env.PORT ?? "5000", 10);

  server.listen(port, () => {
    log(`serving on port ${port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`received ${signal}; shutting down`);
    stopOutbox();
    stopDeletionWorker();
    server.close(() => {
      void Promise.allSettled([client.end({ timeout: 5 }), shutdownPosthog()]).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})().catch((error) => {
  writeLog("error", "startup_failed", { error });
  process.exitCode = 1;
});
