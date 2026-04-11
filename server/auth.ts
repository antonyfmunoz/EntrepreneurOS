import { Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { extractClerkOrg } from "./middleware/clerk-org";
import { attachClerkUser, requireAuth } from "./middleware/auth";

/**
 * setupAuth — Clerk-only authentication wiring.
 *
 * The previous Passport local + scrypt + express-session stack has been
 * removed entirely. Clerk is now the sole authentication provider.
 *
 * Middleware chain (global, runs on every request):
 *   1. clerkMiddleware()    — parses the Clerk session token from cookies /
 *                             Authorization headers, populates req.auth.
 *                             Non-blocking: unauthenticated requests still
 *                             pass through, they just have no req.auth.userId.
 *   2. extractClerkOrg      — annotates req.clerkOrg from the Clerk JWT.
 *   3. attachClerkUser      — non-rejecting sync: if req.auth.userId exists,
 *                             looks up (or lazy-creates) the local users row
 *                             keyed by Clerk user id, attaches to req.user,
 *                             and installs req.isAuthenticated() polyfill.
 *                             This preserves the 56 existing
 *                             `req.isAuthenticated()` / `req.user.id` call
 *                             sites across server/routes/*.ts unchanged.
 *
 * Endpoints exposed:
 *   - GET  /api/user    — returns the authenticated local user row (sans password).
 *   - POST /api/logout  — server-side no-op. Clerk manages session teardown
 *                          via its SDK (clerkSignOut() in the frontend clears
 *                          the Clerk session cookie). The endpoint remains so
 *                          the frontend logout mutation has a canonical hook
 *                          and we can extend it later (audit log, cleanup).
 *
 * Removed:
 *   - POST /api/register — Clerk's signUp handles account creation.
 *   - POST /api/login    — Clerk's signIn handles credential verification.
 *   - POST /api/auth/clerk — replaced by lazy sync in attachClerkUser.
 */
export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  // Conditional mount: clerkMiddleware() from @clerk/express requires
  // CLERK_SECRET_KEY at request time and throws without it. In the vitest
  // test environment the secret is intentionally absent so we skip it; the
  // downstream attachClerkUser middleware already handles the "no req.auth"
  // case gracefully by installing isAuthenticated = () => false. In real
  // deployments (dev + prod) CLERK_SECRET_KEY is always set so Clerk runs
  // normally.
  if (process.env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
  }
  app.use(extractClerkOrg);
  app.use(attachClerkUser);

  app.get("/api/user", requireAuth, (req, res) => {
    const user = (req as any).user;
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.post("/api/logout", (_req, res) => {
    res.sendStatus(200);
  });
}
