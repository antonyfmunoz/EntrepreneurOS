import { Request, Response, NextFunction } from "express";
import { writeLog } from "../observability/logger";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  writeLog("error", "unhandled_request_error", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    error: err,
  });
  if (res.headersSent) return;
  res.status(500).json({
    code: "internal_error",
    message: "Internal server error",
    requestId: req.requestId,
  });
}
