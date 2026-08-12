import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const secretKeyPattern = /(authorization|cookie|password|secret|token|api[-_]?key|credential)/i;

function safeValue(key: string, value: unknown): unknown {
  if (secretKeyPattern.test(key)) return "[REDACTED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(process.env.NODE_ENV === "production" ? {} : { stack: value.stack }),
    };
  }
  if (Array.isArray(value)) return value.map((item) => safeValue(key, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as LogFields).map(([childKey, childValue]) => [childKey, safeValue(childKey, childValue)]));
  }
  return value;
}

export function writeLog(level: LogLevel, event: string, fields: LogFields = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "entrepreneuros",
    environment: process.env.NODE_ENV || "development",
    event,
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, safeValue(key, value)])),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestTelemetry(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.get("x-request-id")?.slice(0, 128) || randomUUID();
  const startedAt = performance.now();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;
    writeLog(res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info", "http_request", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      userId: req.user?.id,
      clerkOrg: req.clerkOrg,
      ip: req.ip,
    });
  });
  next();
}
