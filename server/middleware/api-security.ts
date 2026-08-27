import type { NextFunction, Request, Response } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
  const extraConnectSources = (process.env.EOS_CSP_CONNECT_SRC || "")
    .split(/\s+/)
    .filter((source) => /^https?:\/\/|^wss?:\/\//.test(source));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.posthog.com wss://*.clerk.accounts.dev ${extraConnectSources.join(" ")}`.trim(),
    "frame-src https://*.clerk.accounts.dev https://*.clerk.com",
    "worker-src 'self' blob:",
  ].join("; "));
  if (req.path?.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

export function sanitizeServerErrors(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 500 && body && typeof body === "object") {
      const value = body as Record<string, unknown>;
      const safeBody = {
        ...(typeof value.code === "string" ? { code: value.code } : {}),
        message: "Internal server error",
      };
      return originalJson(safeBody);
    }
    return originalJson(body);
  }) as Response["json"];
  next();
}

export function requireLocalApiAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated?.()) {
    res.setHeader("WWW-Authenticate", "Bearer");
    return res.status(401).json({ code: "not_authenticated", message: "Authentication is required." });
  }
  // The browser client sends a Clerk Bearer token for all authenticated API
  // calls. Requiring it for mutations prevents cookie-based cross-site request
  // forgery while preserving read-only session compatibility. Test harnesses
  // may pre-populate req.user without weakening hosted behavior.
  if (unsafeMethods.has(req.method) && process.env.NODE_ENV !== "test") {
    const authorization = req.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return res.status(403).json({ code: "bearer_required", message: "A Bearer token is required for state-changing requests." });
    }
  }
  return next();
}

export function blockLegacyUnscopedApis(req: Request, res: Response, next: NextFunction) {
  const legacyUnscoped = /^\/(tasks|agents|workflows|conversations|actions|crm|folders|documents|ai-assistant)(\/|$)/.test(req.path)
    || ["/stats", "/analytics", "/ai/stats"].includes(req.path)
    || req.path === "/integrations"
    || req.path === "/integrations/connect"
    || /^\/integrations\/(gmail|notion)\/(auth|status|disconnect)$/.test(req.path)
    || ["/keys/save", "/ai/generate", "/ai/multi-agent", "/ai/models", "/ai/provider-status", "/llm/chat"].includes(req.path);
  if (legacyUnscoped) {
    const replacement = /^\/(agents|ai-assistant)(\/|$)/.test(req.path)
      || ["/ai/generate", "/ai/multi-agent", "/ai/models", "/ai/provider-status", "/llm/chat"].includes(req.path)
      ? "/api/eos/companies/:companyId/executive-assistant/messages"
      : /^\/(tasks|actions)(\/|$)/.test(req.path)
        ? "/api/eos/companies/:companyId/work-packets"
        : /^\/workflows(\/|$)/.test(req.path)
          ? "/api/eos/companies/:companyId/process-definitions"
          : /^\/integrations(\/|$)/.test(req.path)
            ? "/api/eos/companies/:companyId/integrations/:provider/:action"
          : "/api/eos/companies/:companyId/context";
    return res.status(410).json({
      code: "legacy_unscoped_route_disabled",
      message: "This legacy route is permanently disabled because it cannot enforce EOS company, seat, and authority scope. Use the company-scoped EOS runtime.",
      replacement,
      sunset: true,
    });
  }
  return next();
}
