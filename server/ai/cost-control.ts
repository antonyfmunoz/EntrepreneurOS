import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { aiBudgetAlerts, aiBudgets, aiUsageLedger, notifications } from "@shared/schema";
import { db } from "../db";

export class AiBudgetError extends Error {
  constructor(public code: "ai_budget_not_configured" | "ai_request_limit_exceeded" | "ai_monthly_budget_exceeded" | "ai_usage_not_reconcilable", message: string) { super(message); }
}

type CostTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function currentMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function notifyThresholdIfNeeded(tx: CostTransaction, companyId: number, monthStart: Date): Promise<void> {
  const [budget] = await tx.select().from(aiBudgets).where(and(eq(aiBudgets.companyId, companyId), eq(aiBudgets.enabled, true))).limit(1);
  if (!budget) return;
  const [usage] = await tx.select({ total: sql<number>`coalesce(sum(case when ${aiUsageLedger.status} = 'completed' then ${aiUsageLedger.actualCostMicros} when ${aiUsageLedger.status} = 'reserved' then ${aiUsageLedger.reservedCostMicros} else 0 end), 0)` }).from(aiUsageLedger).where(and(eq(aiUsageLedger.companyId, companyId), gte(aiUsageLedger.createdAt, monthStart)));
  const usageMicros = Number(usage?.total || 0);
  if (usageMicros * 100 < budget.monthlyLimitMicros * budget.alertThresholdPercent) return;
  const [alert] = await tx.insert(aiBudgetAlerts).values({ id: `ai_budget_alert_${randomUUID()}`, companyId, monthStart, thresholdPercent: budget.alertThresholdPercent, usageMicros, limitMicros: budget.monthlyLimitMicros }).onConflictDoNothing().returning();
  if (!alert) return;
  await tx.insert(notifications).values({ id: `notification_${randomUUID()}`, userId: budget.updatedByUserId, title: "AI budget threshold reached", content: `AI spend and active reservations reached ${budget.alertThresholdPercent}% of the monthly company limit.`, type: "ai-budget-threshold", href: `/settings?companyId=${companyId}&cost=1`, relatedId: String(companyId), metadata: { companyId, thresholdPercent: budget.alertThresholdPercent, usageMicros, limitMicros: budget.monthlyLimitMicros }, read: false });
}

export async function reserveAiSpend(input: { companyId: number; userId: string; context: string; model: string; estimatedCostMicros: number }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.companyId}, 24701)`);
    const [budget] = await tx.select().from(aiBudgets).where(and(eq(aiBudgets.companyId, input.companyId), eq(aiBudgets.enabled, true))).limit(1);
    if (!budget) throw new AiBudgetError("ai_budget_not_configured", "AI spend is disabled until a company budget is configured.");
    if (input.estimatedCostMicros > budget.perRequestLimitMicros) throw new AiBudgetError("ai_request_limit_exceeded", "This request exceeds the company per-request AI limit.");
    const now = new Date();
    const monthStart = currentMonthStart(now);
    const [usage] = await tx.select({ total: sql<number>`coalesce(sum(case when ${aiUsageLedger.status} = 'completed' then ${aiUsageLedger.actualCostMicros} else ${aiUsageLedger.reservedCostMicros} end), 0)` }).from(aiUsageLedger).where(and(eq(aiUsageLedger.companyId, input.companyId), gte(aiUsageLedger.createdAt, monthStart)));
    if (Number(usage?.total || 0) + input.estimatedCostMicros > budget.monthlyLimitMicros) throw new AiBudgetError("ai_monthly_budget_exceeded", "The company monthly AI budget has been reached.");
    const id = `ai_usage_${randomUUID()}`;
    await tx.insert(aiUsageLedger).values({ id, ...input, reservedCostMicros: input.estimatedCostMicros });
    await notifyThresholdIfNeeded(tx, input.companyId, monthStart);
    return { id };
  });
}

export async function completeAiSpend(id: string, input: { actualCostMicros: number; inputTokens: number; outputTokens: number }) {
  await db.transaction(async (tx) => {
    const [usage] = await tx.select().from(aiUsageLedger).where(eq(aiUsageLedger.id, id)).limit(1).for("update");
    if (!usage || usage.status !== "reserved") return;
    await tx.update(aiUsageLedger).set({ status: "completed", ...input, completedAt: new Date() }).where(eq(aiUsageLedger.id, id));
    await notifyThresholdIfNeeded(tx, usage.companyId, currentMonthStart());
  });
}

export async function failAiSpend(id: string) {
  await db.update(aiUsageLedger).set({ status: "failed", actualCostMicros: 0, completedAt: new Date() }).where(and(eq(aiUsageLedger.id, id), eq(aiUsageLedger.status, "reserved")));
}

export async function evaluateAiBudgetThreshold(companyId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${companyId}, 24701)`);
    await notifyThresholdIfNeeded(tx, companyId, currentMonthStart());
  });
}

export async function reconcileAiSpend(input: { id: string; companyId: number; userId: string; status: "completed" | "failed"; actualCostMicros: number; inputTokens?: number; outputTokens?: number; evidenceUri: string }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.companyId}, 24701)`);
    const [usage] = await tx.select().from(aiUsageLedger).where(and(eq(aiUsageLedger.id, input.id), eq(aiUsageLedger.companyId, input.companyId))).limit(1).for("update");
    if (!usage || usage.status !== "reserved") throw new AiBudgetError("ai_usage_not_reconcilable", "Only an unresolved reservation can be reconciled.");
    const [updated] = await tx.update(aiUsageLedger).set({ status: input.status, actualCostMicros: input.status === "failed" ? 0 : input.actualCostMicros, inputTokens: input.inputTokens ?? null, outputTokens: input.outputTokens ?? null, reconciliationEvidenceUri: input.evidenceUri, reconciledByUserId: input.userId, reconciledAt: new Date(), completedAt: new Date() }).where(eq(aiUsageLedger.id, usage.id)).returning();
    if (input.status === "completed") await notifyThresholdIfNeeded(tx, input.companyId, currentMonthStart());
    return updated;
  });
}
