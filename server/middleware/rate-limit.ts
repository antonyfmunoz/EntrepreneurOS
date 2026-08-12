import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { writeLog } from "../observability/logger";

interface Bucket { count: number; resetAt: number }

export interface RateLimitStore {
  increment(input: { namespace: string; identity: string; windowMs: number; now: number }): Promise<Bucket>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweepAt = 0;

  async increment(input: { namespace: string; identity: string; windowMs: number; now: number }): Promise<Bucket> {
    if (input.now - this.lastSweepAt >= input.windowMs) {
      this.buckets.forEach((existing, bucketKey) => {
        if (existing.resetAt <= input.now) this.buckets.delete(bucketKey);
      });
      this.lastSweepAt = input.now;
    }
    const key = `${input.namespace}:${input.identity}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= input.now) {
      bucket = { count: 0, resetAt: input.now + input.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket;
  }
}

class PostgresRateLimitStore implements RateLimitStore {
  async increment(input: { namespace: string; identity: string; windowMs: number; now: number }): Promise<Bucket> {
    const windowStartMs = Math.floor(input.now / input.windowMs) * input.windowMs;
    const windowStart = new Date(windowStartMs).toISOString();
    const resetAt = windowStartMs + input.windowMs;
    const identityHash = createHash("sha256").update(input.identity).digest("hex");
    const result = await db.execute(sql`
      INSERT INTO eos_rate_limit_windows (namespace, identity_hash, window_start, count, expires_at)
      VALUES (${input.namespace}, ${identityHash}, ${windowStart}::timestamptz, 1, ${new Date(resetAt + input.windowMs).toISOString()}::timestamptz)
      ON CONFLICT (namespace, identity_hash, window_start)
      DO UPDATE SET count = eos_rate_limit_windows.count + 1
      RETURNING count
    `);
    const count = Number((result as unknown as Array<{ count: number }>)[0]?.count || 1);
    if (Math.random() < 0.005) void db.execute(sql`DELETE FROM eos_rate_limit_windows WHERE expires_at < now()`).catch(() => undefined);
    return { count, resetAt };
  }
}

const memoryStore = new MemoryRateLimitStore();
const postgresStore = new PostgresRateLimitStore();

export function fixedWindowRateLimit(options: { limit: number; windowMs: number; namespace: string; key?: (req: Request) => string; store?: RateLimitStore }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const identity = options.key?.(req) || req.ip || req.socket.remoteAddress || "unknown";
    try {
      const store = options.store || (process.env.NODE_ENV === "production" ? postgresStore : memoryStore);
      const bucket = await store.increment({ namespace: options.namespace, identity, windowMs: options.windowMs, now });
      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, options.limit - bucket.count)));
      res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
      if (bucket.count > options.limit) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        return res.status(429).json({ code: "rate_limited", message: "Request limit exceeded. Retry after the current window." });
      }
      return next();
    } catch (error) {
      writeLog("error", "rate_limit_store_failed", { namespace: options.namespace, requestId: req.requestId, error });
      return res.status(503).json({ code: "rate_limit_unavailable", message: "Request protection is temporarily unavailable." });
    }
  };
}

export const localApiRateLimit = fixedWindowRateLimit({ limit: 600, windowMs: 60_000, namespace: "local-api" });
export const federationCommandRateLimit = fixedWindowRateLimit({
  limit: 120,
  windowMs: 60_000,
  namespace: "umh-command",
  key: (req) => `${req.ip || "unknown"}:${String(req.body?.installationId || "unknown")}`,
});
