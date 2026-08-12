import { randomUUID } from "node:crypto";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { accountDeletionRequests, companies, portfolios, users, workflows } from "@shared/schema";
import { clerkClient } from "../clerkAdmin";
import { db } from "../db";
import { writeLog } from "../observability/logger";

const graceDays = Math.max(1, Math.min(30, Number(process.env.EOS_ACCOUNT_DELETION_GRACE_DAYS || 7)));

export async function scheduleAccountDeletion(input: { userId: string; clerkUserId: string | null; deleteOwnedOrganizations: boolean }) {
  const scheduledFor = new Date(Date.now() + graceDays * 86_400_000);
  const id = `account_deletion_${randomUUID()}`;
  const [request] = await db.insert(accountDeletionRequests).values({ id, ...input, scheduledFor, status: "scheduled" }).onConflictDoUpdate({ target: accountDeletionRequests.userId, set: { clerkUserId: input.clerkUserId, deleteOwnedOrganizations: input.deleteOwnedOrganizations, scheduledFor, status: "scheduled", requestedAt: new Date(), cancelledAt: null, executedAt: null, lastError: null } }).returning();
  return request;
}

export async function deletionRequestForUser(userId: string) {
  return (await db.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.userId, userId)).limit(1))[0] || null;
}

export async function cancelAccountDeletion(userId: string) {
  return (await db.update(accountDeletionRequests).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "scheduled"))).returning())[0] || null;
}

async function executeOne(request: typeof accountDeletionRequests.$inferSelect): Promise<void> {
  const claimed = await db.update(accountDeletionRequests).set({ status: "executing", attempts: sql`${accountDeletionRequests.attempts} + 1`, lastError: null }).where(and(eq(accountDeletionRequests.id, request.id), inArray(accountDeletionRequests.status, ["scheduled", "failed"]))).returning();
  if (!claimed.length) return;
  try {
    const ownedCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerUserId, request.userId));
    const ownedPortfolios = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.ownerId, request.userId));
    if (!request.deleteOwnedOrganizations && (ownedCompanies.length || ownedPortfolios.length)) {
      await db.update(accountDeletionRequests).set({ status: "blocked", lastError: "Owned organizations must be transferred or explicitly included." }).where(eq(accountDeletionRequests.id, request.id));
      return;
    }
    if (request.clerkUserId && clerkClient) {
      try { await clerkClient.users.deleteUser(request.clerkUserId); } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 404) throw error;
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("Identity provider deletion is unavailable.");
    }
    await db.transaction(async (tx) => {
      if (request.deleteOwnedOrganizations) {
        for (const company of ownedCompanies) await tx.delete(workflows).where(eq(workflows.companyId, company.id));
        await tx.delete(companies).where(eq(companies.ownerUserId, request.userId));
        await tx.delete(portfolios).where(eq(portfolios.ownerId, request.userId));
      }
      await tx.delete(users).where(eq(users.id, request.userId));
      await tx.update(accountDeletionRequests).set({ status: "executed", executedAt: new Date(), lastError: null }).where(eq(accountDeletionRequests.id, request.id));
    });
    writeLog("info", "account_deletion_executed", { deletionRequestId: request.id });
  } catch (error) {
    await db.update(accountDeletionRequests).set({ status: "failed", lastError: "Deletion could not complete; operations review required." }).where(eq(accountDeletionRequests.id, request.id));
    writeLog("error", "account_deletion_failed", { deletionRequestId: request.id, error });
  }
}

export async function processDueAccountDeletions(): Promise<void> {
  if (process.env.EOS_ACCOUNT_DELETION_ENABLED !== "true") return;
  const due = await db.select().from(accountDeletionRequests).where(and(inArray(accountDeletionRequests.status, ["scheduled", "failed"]), lte(accountDeletionRequests.scheduledFor, new Date()))).limit(20);
  for (const request of due) await executeOne(request);
}

export function startAccountDeletionWorker(): () => void {
  const timer = setInterval(() => void processDueAccountDeletions().catch((error) => writeLog("error", "account_deletion_worker_failed", { error })), 60 * 60 * 1000);
  timer.unref();
  void processDueAccountDeletions().catch((error) => writeLog("error", "account_deletion_worker_failed", { error }));
  return () => clearInterval(timer);
}
