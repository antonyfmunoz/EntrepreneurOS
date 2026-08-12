import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { aiBudgets, aiUsageLedger } from "@shared/schema";
import { db } from "../db";

export class AiBudgetError extends Error {
  constructor(public code: "ai_budget_not_configured" | "ai_request_limit_exceeded" | "ai_monthly_budget_exceeded", message: string) { super(message); }
}

export async function reserveAiSpend(input: { companyId: number; userId: string; context: string; model: string; estimatedCostMicros: number }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.companyId}, 24701)`);
    const [budget] = await tx.select().from(aiBudgets).where(and(eq(aiBudgets.companyId, input.companyId), eq(aiBudgets.enabled, true))).limit(1);
    if (!budget) throw new AiBudgetError("ai_budget_not_configured", "AI spend is disabled until a company budget is configured.");
    if (input.estimatedCostMicros > budget.perRequestLimitMicros) throw new AiBudgetError("ai_request_limit_exceeded", "This request exceeds the company per-request AI limit.");
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [usage] = await tx.select({ total: sql<number>`coalesce(sum(case when ${aiUsageLedger.status} = 'completed' then ${aiUsageLedger.actualCostMicros} else ${aiUsageLedger.reservedCostMicros} end), 0)` }).from(aiUsageLedger).where(and(eq(aiUsageLedger.companyId, input.companyId), gte(aiUsageLedger.createdAt, monthStart)));
    if (Number(usage?.total || 0) + input.estimatedCostMicros > budget.monthlyLimitMicros) throw new AiBudgetError("ai_monthly_budget_exceeded", "The company monthly AI budget has been reached.");
    const id = `ai_usage_${randomUUID()}`;
    await tx.insert(aiUsageLedger).values({ id, ...input, reservedCostMicros: input.estimatedCostMicros });
    return { id };
  });
}

export async function completeAiSpend(id: string, input: { actualCostMicros: number; inputTokens: number; outputTokens: number }) {
  await db.update(aiUsageLedger).set({ status: "completed", ...input, completedAt: new Date() }).where(and(eq(aiUsageLedger.id, id), eq(aiUsageLedger.status, "reserved")));
}

export async function failAiSpend(id: string) {
  await db.update(aiUsageLedger).set({ status: "failed", actualCostMicros: 0, completedAt: new Date() }).where(and(eq(aiUsageLedger.id, id), eq(aiUsageLedger.status, "reserved")));
}
