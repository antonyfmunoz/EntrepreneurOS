import express, { type Express } from "express";
import { desc, eq } from "drizzle-orm";
import { eosAlertEmailReceipts } from "@shared/schema";
import { db } from "../db";
import { sendVerifiedAlertEmail } from "../integrations/gmail";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import { requirePlatformAdmin } from "../security/platform-admin";
import { ALERT_EMAIL_PATH, alertEmailConfiguration, renderAlertEmail, verifyAlertEmailRequest } from "../observability/alert-email";

export function registerAlertEmailReceiver(app: Express): void {
  app.post(ALERT_EMAIL_PATH,
    fixedWindowRateLimit({ namespace: "operational-alert-email", limit: 30, windowMs: 60_000 }),
    express.raw({ type: "application/json", limit: "16kb" }),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const config = alertEmailConfiguration();
      if (!config) return res.status(503).json({ code: "alert_email_unconfigured" });
      const raw = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      let alert;
      try {
        alert = verifyAlertEmailRequest(raw, req.get("x-eos-alert-timestamp") || "", req.get("x-eos-alert-signature") || "", config.secret);
      } catch { return res.status(401).json({ code: "invalid_signed_alert" }); }
      try {
        const [claimed] = await db.insert(eosAlertEmailReceipts).values({
          id: alert.id, event: alert.event, severity: alert.severity,
          senderUserId: config.senderUserId, recipient: config.recipient, state: "dispatching",
        }).onConflictDoNothing().returning();
        if (!claimed) {
          const existing = await db.query.eosAlertEmailReceipts.findFirst({ where: eq(eosAlertEmailReceipts.id, alert.id) });
          return res.status(existing?.state === "delivered" ? 200 : 409).json({
            receiptId: alert.id, duplicate: true, state: existing?.state || "uncertain",
          });
        }
        try {
          const receipt = await sendVerifiedAlertEmail(config.senderUserId, config.senderAddress, {
            to: config.recipient, ...renderAlertEmail(alert), receiptId: alert.id,
          });
          if (!receipt.messageId) throw new Error("Provider receipt missing.");
          await db.update(eosAlertEmailReceipts).set({ state: "delivered", providerMessageId: receipt.messageId, settledAt: new Date() })
            .where(eq(eosAlertEmailReceipts.id, alert.id));
          return res.status(200).json({ receiptId: alert.id, state: "delivered" });
        } catch {
          // Never retry a possibly completed send. Operator reconciliation is required.
          await db.update(eosAlertEmailReceipts).set({ state: "uncertain", settledAt: new Date() })
            .where(eq(eosAlertEmailReceipts.id, alert.id));
          return res.status(503).json({ code: "alert_email_reconciliation_required", receiptId: alert.id });
        }
      } catch {
        // Do not recursively alert about the receiver or expose provider/database errors.
        return res.status(503).json({ code: "alert_email_unavailable" });
      }
    });
}

export function registerAlertEmailReceiptRoutes(app: Express): void {
  app.get("/api/platform/alerts/deliveries", async (req, res, next) => {
    try {
      requirePlatformAdmin(req.user.id);
      res.setHeader("Cache-Control", "no-store");
      return res.json(await db.select().from(eosAlertEmailReceipts).orderBy(desc(eosAlertEmailReceipts.receivedAt)).limit(100));
    } catch (error) { return next(error); }
  });
}
