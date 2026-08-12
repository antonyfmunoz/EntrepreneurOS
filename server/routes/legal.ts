import type { Express } from "express";
import { z } from "zod";
import { legalStatusForUser, publishedLegalDocuments, recordLegalAcceptance } from "../legal/service";

export function registerPublicLegalRoutes(app: Express): void {
  app.get("/api/legal/documents", async (_req, res, next) => {
    try {
      const documents = await publishedLegalDocuments();
      return res.json(documents.map(({ checksum: _checksum, ...document }) => document));
    } catch (error) { return next(error); }
  });
}

export function registerLegalRoutes(app: Express): void {
  app.get("/api/legal/status", async (req, res, next) => {
    try { return res.json(await legalStatusForUser(req.user.id)); } catch (error) { return next(error); }
  });
  app.post("/api/legal/acceptances", async (req, res, next) => {
    try {
      const { documentId, accepted } = z.object({ documentId: z.string().min(1), accepted: z.literal(true) }).parse(req.body);
      const acceptance = await recordLegalAcceptance({ userId: req.user.id, documentId, ip: req.ip || "unknown", userAgent: req.get("user-agent") || "unknown" });
      return res.status(201).json({ documentId: acceptance.documentId, acceptedAt: acceptance.acceptedAt });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "explicit_acceptance_required", message: "Explicit acceptance is required." });
      return next(error);
    }
  });
}
