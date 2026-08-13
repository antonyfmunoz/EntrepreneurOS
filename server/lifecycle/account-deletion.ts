import { randomUUID } from "node:crypto";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  accountDeletionRequests,
  agentActions,
  aiMessages,
  companies,
  crmActivities,
  crmContacts,
  crmDeals,
  documents,
  eosCommunicationMessages,
  eosMemberships,
  eosSeats,
  folders,
  notifications,
  oauthTokens,
  portfolios,
  supportTickets,
  umhIdentityBindings,
  users,
} from "@shared/schema";
import { clerkClient } from "../clerkAdmin";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import * as gmail from "../integrations/gmail";
import * as notion from "../integrations/notion";

const graceDays = Math.max(1, Math.min(30, Number(process.env.EOS_ACCOUNT_DELETION_GRACE_DAYS || 7)));

async function erasePersonalData(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], request: typeof accountDeletionRequests.$inferSelect): Promise<void> {
  const userId = request.userId;
  await tx.delete(crmActivities).where(eq(crmActivities.userId, userId));
  await tx.delete(crmDeals).where(eq(crmDeals.userId, userId));
  await tx.delete(crmContacts).where(eq(crmContacts.userId, userId));
  await tx.delete(documents).where(eq(documents.userId, userId));
  await tx.delete(folders).where(eq(folders.userId, userId));
  await tx.delete(notifications).where(eq(notifications.userId, userId));
  await tx.delete(aiMessages).where(eq(aiMessages.userId, userId));
  await tx.delete(oauthTokens).where(eq(oauthTokens.userId, userId));
  await tx.delete(supportTickets).where(eq(supportTickets.userId, userId));
  await tx.delete(agentActions).where(eq(agentActions.userId, userId));
  await tx.delete(eosMemberships).where(eq(eosMemberships.userId, userId));
  await tx.delete(umhIdentityBindings).where(eq(umhIdentityBindings.localUserId, userId));
  await tx.update(eosSeats).set({ occupantUserId: null, agentMode: "autonomous", updatedAt: new Date() }).where(eq(eosSeats.occupantUserId, userId));
  await tx.update(eosCommunicationMessages).set({ senderUserId: null }).where(eq(eosCommunicationMessages.senderUserId, userId));

  // Audit, legal-acceptance, approval, provider, and cost records retain their foreign-key link to
  // this non-identifying tombstone. This preserves legally required evidence
  // without retaining the person's name, email, identity-provider binding,
  // profile, preferences, or provider credentials.
  const tombstone = request.id.replace(/[^a-zA-Z0-9]/g, "").slice(-20).toLowerCase();
  await tx.update(users).set({
    username: `deleted_${tombstone}`,
    password: `deleted:${randomUUID()}`,
    email: `deleted+${tombstone}@users.invalid`,
    fullName: null,
    avatar: null,
    company: null,
    role: null,
    clerkUserId: null,
    preferences: null,
    metadata: { accountDeleted: true },
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

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
    if (ownedCompanies.length || ownedPortfolios.length) {
      await db.update(accountDeletionRequests).set({ status: "blocked", lastError: "Owned organizations must be transferred before personal account deletion." }).where(eq(accountDeletionRequests.id, request.id));
      return;
    }
    const providerRevocations = await Promise.all([
      gmail.revokeAuthorization(request.userId),
      notion.revokeAuthorization(request.userId),
    ]);
    if (providerRevocations.some((result) => !result.providerRevoked)) {
      throw new Error("External provider authorization revocation could not be confirmed.");
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
      await erasePersonalData(tx, request);
      await tx.update(accountDeletionRequests).set({ status: "executed", clerkUserId: null, executedAt: new Date(), lastError: null }).where(eq(accountDeletionRequests.id, request.id));
    });
    writeLog("info", "account_deletion_executed", { deletionRequestId: request.id });
  } catch (error) {
    await db.update(accountDeletionRequests).set({ status: "failed", lastError: "Deletion could not complete; operations review required." }).where(eq(accountDeletionRequests.id, request.id));
    writeLog("error", "account_deletion_failed", { deletionRequestId: request.id, error });
  }
}

export async function processDueAccountDeletion(requestId: string, now = new Date()): Promise<boolean> {
  const [request] = await db.select().from(accountDeletionRequests).where(and(
    eq(accountDeletionRequests.id, requestId),
    inArray(accountDeletionRequests.status, ["scheduled", "failed"]),
    lte(accountDeletionRequests.scheduledFor, now),
  )).limit(1);
  if (!request) return false;
  await executeOne(request);
  return true;
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
