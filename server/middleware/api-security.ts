import type { NextFunction, Request, Response } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
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
  const legacyUnscoped = /^\/(tasks|agents|workflows|conversations)(\/|$)/.test(req.path)
    || req.path === "/integrations"
    || req.path === "/integrations/connect";
  if (legacyUnscoped && process.env.EOS_ENABLE_LEGACY_UNSCOPED_ROUTES !== "true") {
    return res.status(410).json({
      code: "legacy_unscoped_route_disabled",
      message: "This legacy route is disabled because it cannot enforce company scope. Use the EOS company runtime.",
    });
  }
  return next();
}
