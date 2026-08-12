import type { NextFunction, Request, Response } from "express";

interface Bucket { count: number; resetAt: number }

export function fixedWindowRateLimit(options: { limit: number; windowMs: number; namespace: string; key?: (req: Request) => string }) {
  const buckets = new Map<string, Bucket>();
  let lastSweepAt = 0;
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastSweepAt >= options.windowMs) {
      buckets.forEach((existing, bucketKey) => {
        if (existing.resetAt <= now) buckets.delete(bucketKey);
      });
      lastSweepAt = now;
    }
    const identity = options.key?.(req) || req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.namespace}:${identity}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(options.limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.limit - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > options.limit) return res.status(429).json({ code: "rate_limited", message: "Request limit exceeded. Retry after the current window." });
    return next();
  };
}

export const localApiRateLimit = fixedWindowRateLimit({ limit: 600, windowMs: 60_000, namespace: "local-api" });
export const federationCommandRateLimit = fixedWindowRateLimit({
  limit: 120,
  windowMs: 60_000,
  namespace: "umh-command",
  key: (req) => `${req.ip || "unknown"}:${String(req.body?.installationId || "unknown")}`,
});
