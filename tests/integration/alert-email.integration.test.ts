import express from "express";
import supertest from "supertest";
import postgres from "postgres";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const delivery = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../../server/integrations/gmail", () => ({ sendVerifiedAlertEmail: delivery.send }));
const databaseUrl = process.env.EOS_TEST_DATABASE_URL;
const secret = "synthetic-alert-integration-secret-not-production";

describe.skipIf(!databaseUrl)("operational alert email HTTP lifecycle", () => {
  const sql = postgres(databaseUrl || "postgresql://invalid", { max: 1 });
  let api: ReturnType<typeof supertest>;
  let actor = "test_alert_operator";
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.EOS_PLATFORM_ADMIN_USER_IDS = actor;
    process.env.EOS_ALERT_EMAIL_SENDER_USER_ID = actor;
    process.env.EOS_ALERT_EMAIL_SENDER_ADDRESS = "sender@example.test";
    process.env.EOS_ALERT_EMAIL_RECIPIENT = "recipient@example.test";
    process.env.EOS_ALERT_WEBHOOK_SECRET = secret;
    await sql`DELETE FROM eos_alert_email_receipts WHERE sender_user_id = 'test_alert_operator'`;
    const { registerAlertEmailReceiver, registerAlertEmailReceiptRoutes } = await import("../../server/routes/alert-email");
    const app = express();
    app.use(express.json({ verify(req, _res, raw) { (req as express.Request).rawBody = Buffer.from(raw); } }));
    registerAlertEmailReceiver(app);
    app.use((req, _res, next) => { (req as any).user = { id: actor }; next(); });
    registerAlertEmailReceiptRoutes(app);
    app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ code: error.code || "error" }));
    api = supertest(app);
  });
  beforeEach(() => { actor = "test_alert_operator"; delivery.send.mockReset().mockResolvedValue({ messageId: "gmail-fixture-receipt" }); });
  afterAll(async () => {
    await sql`DELETE FROM eos_alert_email_receipts WHERE sender_user_id = 'test_alert_operator'`;
    await sql.end();
    const { client } = await import("../../server/db");
    await client.end({ timeout: 5 });
    for (const key of ["EOS_PLATFORM_ADMIN_USER_IDS", "EOS_ALERT_EMAIL_SENDER_USER_ID", "EOS_ALERT_EMAIL_SENDER_ADDRESS", "EOS_ALERT_EMAIL_RECIPIENT", "EOS_ALERT_WEBHOOK_SECRET"]) delete process.env[key];
  });
  function request(payload?: string, signature?: string) {
    const raw = payload || JSON.stringify({ standard: "eos.operational-alert.v1", event: "operational_alert_test", severity: "TEST", sentAt: new Date().toISOString(), deduplicationKey: randomUUID(), to: "attacker@example.test", secret: "must-never-be-forwarded" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    return { raw, send: () => api.post("/api/operations/alert-email").set("Content-Type", "application/json").set("x-eos-alert-timestamp", timestamp).set("x-eos-alert-signature", signature || "sha256=" + createHmac("sha256", secret).update(timestamp + "." + raw).digest("hex")).send(raw) };
  }
  it("requires signatures, fixes the recipient, stores receipts and suppresses exact duplicates", async () => {
    await request(undefined, "sha256=" + "0".repeat(64)).send().expect(401);
    expect(delivery.send).not.toHaveBeenCalled();
    const alert = request();
    const result = await alert.send().expect(200);
    expect(result.body.state).toBe("delivered");
    expect(delivery.send).toHaveBeenCalledWith("test_alert_operator", "sender@example.test", expect.objectContaining({ to: "recipient@example.test" }));
    expect(JSON.stringify(delivery.send.mock.calls)).not.toContain("must-never-be-forwarded");
    await request(alert.raw).send().expect(200).expect(({ body }) => expect(body.duplicate).toBe(true));
    expect(delivery.send).toHaveBeenCalledTimes(1);
    const rows = await api.get("/api/platform/alerts/deliveries").expect(200);
    expect(rows.body.find((row: any) => row.id === result.body.receiptId)).toMatchObject({ state: "delivered", providerMessageId: "gmail-fixture-receipt" });
    actor = "other_user";
    await api.get("/api/platform/alerts/deliveries").expect(403);
  });
  it("does not repeat a failed or ambiguous provider send", async () => {
    delivery.send.mockRejectedValue(new Error("sensitive provider response"));
    const alert = request();
    const failed = await alert.send().expect(503);
    expect(JSON.stringify(failed.body)).not.toContain("sensitive");
    await request(alert.raw).send().expect(409).expect(({ body }) => expect(body.state).toBe("uncertain"));
    expect(delivery.send).toHaveBeenCalledTimes(1);
  });
  it("requires an actual Gmail message receipt", async () => {
    delivery.send.mockResolvedValue({ messageId: "" });
    await request().send().expect(503);
  });
  it("claims concurrent duplicate deliveries only once", async () => {
    let finish!: (value: { messageId: string }) => void;
    delivery.send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const alert = request();
    const first = alert.send().then(response => response);
    await vi.waitFor(() => expect(delivery.send).toHaveBeenCalledTimes(1));
    await request(alert.raw).send().expect(409);
    finish({ messageId: "concurrent-receipt" });
    expect((await first).status).toBe(200);
    expect(delivery.send).toHaveBeenCalledTimes(1);
  });
});
