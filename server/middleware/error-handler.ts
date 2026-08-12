import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({
    message: "Internal server error",
  });
}
