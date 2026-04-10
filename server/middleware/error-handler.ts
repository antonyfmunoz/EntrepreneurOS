import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: err instanceof Error ? err.message : String(err),
  });
}
