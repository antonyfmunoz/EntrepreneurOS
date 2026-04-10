import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      clerkOrg?: string | null;
    }
  }
}

/**
 * Middleware that extracts Clerk organization ID from JWT claims.
 * Attaches orgId to req.clerkOrg if present. Non-breaking — orgId is optional.
 */
export function extractClerkOrg(req: Request, _res: Response, next: NextFunction): void {
  // Read org_id from Clerk session claims if available
  // Clerk puts org_id in the JWT when user has selected an active organization
  // This is non-blocking — if no org, just continue
  const orgId = (req as any).auth?.orgId ?? null;
  (req as any).clerkOrg = orgId;
  next();
}
