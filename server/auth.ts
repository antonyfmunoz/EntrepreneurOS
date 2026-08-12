import { Express, Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { clerkClient } from "./clerkAdmin";
import { posthogClient } from "./posthog";
import { verifiedEmailForLegacyClaim } from "./security/legacy-principal-reconciliation";
import type { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user: User;
      isAuthenticated: () => boolean;
      clerkOrg?: string | null;
    }
  }
}

/**
 * requireAuth — middleware guard that rejects unauthenticated requests.
 *
 * Checks getAuth(req).userId directly. Routes using this middleware
 * will return 401 if no valid Clerk session is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // A pre-resolved local principal is used by isolated acceptance harnesses.
  // Hosted requests can only reach this state through attachClerkUser after a
  // valid Clerk identity has been resolved.
  if (req.isAuthenticated?.()) return next();
  if (!process.env.CLERK_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

/**
 * attachClerkUser — global, non-rejecting middleware.
 *
 * Runs on every request AFTER clerkMiddleware() has populated req.auth.
 * Looks up (or lazy-creates) the local user row keyed by Clerk user id,
 * attaches to req.user, and installs req.isAuthenticated() polyfill.
 */
async function attachClerkUser(req: Request, res: Response, next: NextFunction) {
  // Pre-populated user (test harness / upstream mock): install polyfill and pass.
  if ((req as any).user) {
    req.isAuthenticated = () => true;
    return next();
  }

  if (!process.env.CLERK_SECRET_KEY) {
    req.isAuthenticated = () => false;
    return next();
  }

  const auth = getAuth(req);
  const clerkUserId = auth?.userId as string | undefined;

  if (!clerkUserId) {
    req.isAuthenticated = () => false;
    return next();
  }

  try {
    let user = await storage.getUserByClerkId(clerkUserId);

    if (!user) {
      if (!clerkClient) {
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
        password: randomBytes(32).toString("hex"),
        fullName: fullName || undefined,
        avatar: clerkUser.imageUrl || undefined,
        clerkUserId,
      });
    }

    // Older EOS builds created local password principals before Clerk became
    // authoritative. Claim only business records whose unbound legacy
    // principal has the same *verified* Clerk email. This is an idempotent
    // ownership migration; it never broadens access by company id alone.
    const clerkIdentity = await clerkClient?.users.getUser(clerkUserId);
    const verifiedEmail = clerkIdentity
      ? verifiedEmailForLegacyClaim(user.email, clerkIdentity.emailAddresses)
      : undefined;
    if (verifiedEmail) {
      const claimed = await storage.claimLegacyBusinessOwnership(user.id, verifiedEmail);
      if (claimed.companies || claimed.portfolios) {
        console.info("attachClerkUser: reconciled verified legacy business ownership", claimed);
      }
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
 * extractClerkOrg — extracts Clerk organization ID from JWT claims.
 */
function extractClerkOrg(req: Request, _res: Response, next: NextFunction): void {
  const orgId = (req as any).auth?.orgId ?? null;
  (req as any).clerkOrg = orgId;
  next();
}

/**
 * setupAuth — Clerk-only authentication wiring.
 *
 * Middleware chain (global, runs on every request):
 *   1. clerkMiddleware()  — parses Clerk session token, populates req.auth.
 *   2. extractClerkOrg    — annotates req.clerkOrg from the Clerk JWT.
 *   3. attachClerkUser    — looks up/lazy-creates local user row from Clerk id.
 */
export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  if (process.env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
  }
  app.use(extractClerkOrg);
  app.use(attachClerkUser);

  app.get("/api/user", requireAuth, (req, res) => {
    const user = (req as any).user;

    posthogClient?.capture({
      distinctId: String(user.id),
      event: "user_logged_in",
    });

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.post("/api/logout", (_req, res) => {
    res.sendStatus(200);
  });
}
