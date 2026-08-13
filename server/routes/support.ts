import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createSupportTicketSchema, notifications, supportTicketMessages, supportTickets, users } from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import { dispatchOperationalAlert } from "../observability/alerts";
import { requirePlatformAdmin } from "../security/platform-admin";

const statusSchema = z.enum(["open", "in_progress", "waiting_on_customer", "resolved", "closed"]);
const replySchema = z.object({ body: z.string().trim().min(1).max(10_000) }).strict();
const supportReplySchema = replySchema.extend({ status: statusSchema.default("waiting_on_customer") }).strict();

function publicMessage(message: typeof supportTicketMessages.$inferSelect) {
  return { id: message.id, ticketId: message.ticketId, authorKind: message.authorKind, body: message.body, createdAt: message.createdAt };
}

async function ownedTicket(ticketId: string, userId: string) {
  const ticket = (await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1))[0];
  return ticket?.userId === userId ? ticket : null;
}

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
      const ticket = await db.transaction(async (tx) => {
        const [created] = await tx.insert(supportTickets).values({ id, userId: req.user.id, ...input, requestId: req.requestId }).returning();
        await tx.insert(supportTicketMessages).values({ id: `support_message_${randomUUID()}`, ticketId: id, authorUserId: req.user.id, authorKind: "customer", body: input.message, requestId: req.requestId });
        return created;
      });
      writeLog("info", "support_ticket_created", { requestId: req.requestId, ticketId: ticket.id, category: ticket.category, userId: req.user.id });
      if (process.env.NODE_ENV === "production") {
        void dispatchOperationalAlert({ event: "support_ticket_created", deduplicationKey: ticket.id, severity: "SEV-3", ticketId: ticket.id, category: ticket.category }).catch((error) => writeLog("error", "support_ticket_alert_failed", { ticketId: ticket.id, error }));
      }
      return res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_request", message: "Check the support request fields and try again.", issues: error.issues });
      return next(error);
    }
  });

  app.get("/api/support/tickets/:ticketId/messages", async (req, res, next) => {
    try {
      if (!await ownedTicket(req.params.ticketId, req.user.id)) return res.status(404).json({ code: "support_ticket_not_found", message: "Support request not found." });
      const messages = await db.select().from(supportTicketMessages).where(eq(supportTicketMessages.ticketId, req.params.ticketId)).orderBy(asc(supportTicketMessages.createdAt));
      return res.json(messages.map(publicMessage));
    } catch (error) { return next(error); }
  });

  app.post("/api/support/tickets/:ticketId/messages", async (req, res, next) => {
    try {
      const input = replySchema.parse(req.body);
      const outcome = await db.transaction(async (tx) => {
        const ticket = (await tx.select().from(supportTickets).where(eq(supportTickets.id, req.params.ticketId)).limit(1).for("update"))[0];
        if (!ticket || ticket.userId !== req.user.id) return { kind: "not_found" as const };
        if (ticket.status === "closed") return { kind: "closed" as const };
        const [message] = await tx.insert(supportTicketMessages).values({ id: `support_message_${randomUUID()}`, ticketId: ticket.id, authorUserId: req.user.id, authorKind: "customer", body: input.body, requestId: req.requestId }).returning();
        if (["waiting_on_customer", "resolved"].includes(ticket.status)) await tx.update(supportTickets).set({ status: "open", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
        return { kind: "created" as const, message, ticket };
      });
      if (outcome.kind === "not_found") return res.status(404).json({ code: "support_ticket_not_found", message: "Support request not found." });
      if (outcome.kind === "closed") return res.status(409).json({ code: "support_ticket_closed", message: "Closed requests cannot receive new replies. Create a new request if more help is needed." });
      writeLog("info", "support_ticket_customer_replied", { requestId: req.requestId, ticketId: outcome.ticket.id, userId: req.user.id });
      if (process.env.NODE_ENV === "production") void dispatchOperationalAlert({ event: "support_ticket_customer_replied", deduplicationKey: outcome.message.id, severity: "SEV-3", ticketId: outcome.ticket.id, category: outcome.ticket.category }).catch((error) => writeLog("error", "support_ticket_alert_failed", { ticketId: outcome.ticket.id, error }));
      return res.status(201).json(publicMessage(outcome.message));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_reply", message: "Enter a support reply before sending.", issues: error.issues });
      return next(error);
    }
  });

  app.get("/api/platform/support/tickets", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const status = req.query.status ? statusSchema.parse(req.query.status) : undefined;
      const selection = { ticket: supportTickets, reporterEmail: users.email, reporterName: users.fullName };
      const query = db.select(selection).from(supportTickets).innerJoin(users, eq(users.id, supportTickets.userId));
      const tickets = status
        ? await query.where(eq(supportTickets.status, status)).orderBy(desc(supportTickets.createdAt)).limit(200)
        : await query.orderBy(desc(supportTickets.createdAt)).limit(200);
      return res.json(tickets.map(({ ticket, reporterEmail, reporterName }) => ({ ...ticket, reporterEmail, reporterName })));
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string };
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_status", message: "Unknown support status." });
      if (typed.status) return res.status(typed.status).json({ code: typed.code, message: typed.message });
      return next(error);
    }
  });

  app.get("/api/platform/support/tickets/:ticketId/messages", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const ticket = (await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.ticketId)).limit(1))[0];
      if (!ticket) return res.status(404).json({ code: "support_ticket_not_found", message: "Support request not found." });
      const messages = await db.select().from(supportTicketMessages).where(eq(supportTicketMessages.ticketId, ticket.id)).orderBy(asc(supportTicketMessages.createdAt));
      return res.json(messages.map(publicMessage));
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string };
      if (typed.status) return res.status(typed.status).json({ code: typed.code, message: typed.message });
      return next(error);
    }
  });

  app.post("/api/platform/support/tickets/:ticketId/messages", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      const input = supportReplySchema.parse(req.body);
      const outcome = await db.transaction(async (tx) => {
        const ticket = (await tx.select().from(supportTickets).where(eq(supportTickets.id, req.params.ticketId)).limit(1).for("update"))[0];
        if (!ticket) return null;
        const [created] = await tx.insert(supportTicketMessages).values({ id: `support_message_${randomUUID()}`, ticketId: ticket.id, authorUserId: req.user.id, authorKind: "support", body: input.body, requestId: req.requestId }).returning();
        await tx.update(supportTickets).set({ status: input.status, updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
        await tx.insert(notifications).values({ id: `notification_${randomUUID()}`, userId: ticket.userId, title: "Support replied", content: `There is an update on ${ticket.subject}.`, type: "support-reply", href: `/support?ticket=${encodeURIComponent(ticket.id)}`, relatedId: ticket.id, metadata: { ticketId: ticket.id, status: input.status }, read: false });
        return { message: created, ticket };
      });
      if (!outcome) return res.status(404).json({ code: "support_ticket_not_found", message: "Support request not found." });
      writeLog("info", "support_ticket_agent_replied", { requestId: req.requestId, ticketId: outcome.ticket.id, status: input.status, actorUserId: req.user.id });
      return res.status(201).json({ message: publicMessage(outcome.message), status: input.status });
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string };
      if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_support_reply", message: "Enter a support reply and valid next status.", issues: error.issues });
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
