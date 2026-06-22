import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { appendFileSync } from "fs";
import { getAuth } from "@clerk/express";
import { storage } from "../storage";
import { clerkClient } from "../clerkAdmin";
import type { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    // Local user record attached to the request after successful Clerk auth
    // (populated by attachClerkUser from storage.getUserByClerkId + lazy create).
    interface User extends SelectUser {}
    interface Request {
      // Non-optional to match the old Passport Express.User typing. Route
      // handlers still guard access via `if (!req.isAuthenticated()) ...`
      // before reading req.user.id, exactly as they did under Passport.
      user: User;
      // Polyfill of the Passport-era check. Backed by Clerk: returns true iff
      // attachClerkUser succeeded in populating req.user from a valid Clerk
      // session. Kept as a function (not a boolean) so the existing call
      // sites across server/routes/*.ts continue to work unchanged.
      isAuthenticated: () => boolean;
    }
  }
}

/**
 * attachClerkUser — global, non-rejecting middleware.
 *
 * Runs on every request AFTER clerkMiddleware() has populated req.auth.
 *
 * Behavior:
 *   - If req.user is already set (test harness or upstream middleware),
 *     installs the isAuthenticated polyfill and passes through. This
 *     preserves the existing auth-smoke test mocking pattern.
 *   - If req.auth.userId is absent (no Clerk session), installs
 *     isAuthenticated = () => false and passes through. Unauthenticated
 *     endpoints still work; authenticated endpoints will 401 via their
 *     existing inline checks.
 *   - Otherwise, looks up (or lazy-creates) the local user row keyed by
 *     Clerk user id, attaches to req.user, and installs
 *     isAuthenticated = () => true.
 *
 * This replaces the Passport deserializeUser path. Does one DB lookup per
 * authenticated request; zero cost for anonymous requests.
 */
export async function attachClerkUser(req: Request, res: Response, next: NextFunction) {
  // Pre-populated user (test harness / upstream mock): install polyfill and pass.
  if ((req as any).user) {
    req.isAuthenticated = () => true;
    return next();
  }

  const auth = getAuth(req);
  const clerkUserId = auth?.userId as string | undefined;
  const debugLog = (msg: string) => {
    appendFileSync('C:/Users/antonys beast pc/dev/EntrepreneurOS/auth-debug.log', msg + '\n');
  };
  debugLog(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  debugLog(`  getAuth(req): ${JSON.stringify(auth)}`);
  debugLog(`  clerkUserId: ${clerkUserId}`);
  debugLog(`  cookies.__session: ${(req as any).cookies?.__session ? 'present' : 'absent'}`);
  debugLog(`  headers.authorization: ${req.headers.authorization ? 'present' : 'absent'}`);

  if (!clerkUserId) {
    req.isAuthenticated = () => false;
    return next();
  }

  try {
    let user = await storage.getUserByClerkId(clerkUserId);

    if (!user) {
      if (!clerkClient) {
        // Clerk secret missing — treat as unauthenticated rather than hard-failing
        // the request. Routes that require auth will return 401 via their inline
        // req.isAuthenticated() checks.
        console.warn("attachClerkUser: CLERK_SECRET_KEY not set, cannot sync user");
        req.isAuthenticated = () => false;
        return next();
      }

      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        console.warn(`attachClerkUser: Clerk user ${clerkUserId} has no email`);
        req.isAuthenticated = () => false;
        return next();
      }

      const fullName = [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ");
      const username =
        clerkUser.username ||
        `${email.split("@")[0]}_${Math.floor(Math.random() * 10000)}`;

      user = await storage.createUser({
        username,
        email,
        // Clerk owns password management. The local users table still has a
        // notNull password column for historical reasons; we populate it with
        // random bytes that are never used for authentication.
        password: randomBytes(32).toString("hex"),
        fullName: fullName || undefined,
        avatar: clerkUser.imageUrl || undefined,
        clerkUserId,
      });
    }

    (req as any).user = user;
    req.isAuthenticated = () => true;
    return next();
  } catch (error) {
    console.error("attachClerkUser: sync failed", error);
    req.isAuthenticated = () => false;
    return next();
  }
}

/**
 * requireAuth — explicit guard for routes that want middleware-level
 * rejection instead of inline `if (!req.isAuthenticated())` checks. Included
 * for new routes going forward; existing routes continue to use the inline
 * pattern backed by the isAuthenticated polyfill installed by attachClerkUser.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}
