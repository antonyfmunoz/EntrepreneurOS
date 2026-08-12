import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createSupportTicketSchema, supportTickets } from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import { requirePlatformAdmin } from "../security/platform-admin";

const statusSchema = z.enum(["open", "in_progress", "waiting_on_customer", "resolved", "closed"]);

export function registerSupportRoutes(app: Express): void {
  app.get("/api/support/tickets", async (req, res, next) => {
    try {
      const tickets = await db.select().from(supportTickets)
        .where(eq(supportTickets.userId, req.user.id))
        .orderBy(desc(supportTickets.createdAt))
        .limit(50);
      return res.json(tickets);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/support/tickets", async (req, res, next) => {
    try {
      const input = createSupportTicketSchema.parse(req.body);
      const id = `support_${randomUUID()}`;
      const [ticket] = await db.insert(supportTickets).values({ id, userId: req.user.id, ...input, requestId: req.requestId }).returning();
      writeLog("info", "support_ticket_created", { requestId: req.requestId, ticketId: ticket.id, category: ticket.category, userId: req.user.id });
      return res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_request", message: "Check the support request fields and try again.", issues: error.issues });
      return next(error);
    }
  });

  app.get("/api/platform/support/tickets", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const status = req.query.status ? statusSchema.parse(req.query.status) : undefined;
      const query = db.select().from(supportTickets);
      const tickets = status
        ? await query.where(eq(supportTickets.status, status)).orderBy(desc(supportTickets.createdAt)).limit(200)
        : await query.orderBy(desc(supportTickets.createdAt)).limit(200);
      return res.json(tickets);
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string };
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_status", message: "Unknown support status." });
      if (typed.status) return res.status(typed.status).json({ code: typed.code, message: typed.message });
      return next(error);
    }
  });

  app.patch("/api/platform/support/tickets/:ticketId", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const status = statusSchema.parse(req.body?.status);
      const [ticket] = await db.update(supportTickets).set({ status, updatedAt: new Date() })
        .where(eq(supportTickets.id, req.params.ticketId)).returning();
      if (!ticket) return res.status(404).json({ code: "support_ticket_not_found", message: "Support request not found." });
      writeLog("info", "support_ticket_status_changed", { requestId: req.requestId, ticketId: ticket.id, status, actorUserId: req.user.id });
      return res.json(ticket);
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string };
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_status", message: "Unknown support status." });
      if (typed.status) return res.status(typed.status).json({ code: typed.code, message: typed.message });
      return next(error);
    }
  });
}
