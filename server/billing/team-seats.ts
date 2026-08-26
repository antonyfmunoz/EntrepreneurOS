import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { companies, eosMembershipInvitations, eosMemberships, users } from "@shared/schema";
import { db } from "../db";
import { teamSeatLimitForOwner } from "./stripe";

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function emailHash(value: string): string {
  return createHash("sha256").update(normalizedEmail(value)).digest("hex");
}

export interface TeamSeatSummary {
  used: number;
  limit: number;
  remaining: number;
  enforced: boolean;
  source: "subscription" | "workspace_default";
}

async function identityUsage(ownerUserId: string, executor: any = db): Promise<{ used: number; identityHashes: Set<string> }> {
  const companyRows = await executor.select({ id: companies.id }).from(companies).where(eq(companies.ownerUserId, ownerUserId));
  const companyIds = companyRows.map((row: { id: number }) => row.id);
  const userIdentities = new Set<string>([`user:${ownerUserId}`]);
  const memberEmailHashes = new Set<string>();
  if (!companyIds.length) return { used: userIdentities.size, identityHashes: userIdentities };

  const membershipRows = await executor.select({ userId: eosMemberships.userId, email: users.email })
    .from(eosMemberships)
    .innerJoin(users, eq(users.id, eosMemberships.userId))
    .where(and(inArray(eosMemberships.companyId, companyIds), eq(eosMemberships.status, "active")));
  for (const member of membershipRows as Array<{ userId: string; email: string }>) {
    userIdentities.add(`user:${member.userId}`);
    memberEmailHashes.add(`email:${emailHash(member.email)}`);
  }

  const invitationRows = await executor.select({ emailHash: eosMembershipInvitations.emailHash })
    .from(eosMembershipInvitations)
    .where(and(inArray(eosMembershipInvitations.companyId, companyIds), inArray(eosMembershipInvitations.status, ["pending_delivery", "pending"])));
  const pendingOnlyEmails = new Set<string>();
  for (const invitation of invitationRows as Array<{ emailHash: string }>) {
    const identity = `email:${invitation.emailHash}`;
    if (!memberEmailHashes.has(identity)) pendingOnlyEmails.add(identity);
  }
  return {
    used: userIdentities.size + pendingOnlyEmails.size,
    identityHashes: new Set([...Array.from(userIdentities), ...Array.from(memberEmailHashes), ...Array.from(pendingOnlyEmails)]),
  };
}

export async function teamSeatSummaryForOwner(ownerUserId: string, executor: any = db): Promise<TeamSeatSummary> {
  const [{ used }, allowance] = await Promise.all([identityUsage(ownerUserId, executor), teamSeatLimitForOwner(ownerUserId)]);
  return { ...allowance, used, remaining: Math.max(0, allowance.limit - used) };
}

export async function mayAddTeamIdentity(ownerUserId: string, candidateEmail: string, executor: any = db): Promise<{ allowed: boolean; summary: TeamSeatSummary }> {
  const [usage, allowance] = await Promise.all([identityUsage(ownerUserId, executor), teamSeatLimitForOwner(ownerUserId)]);
  const alreadyCounted = usage.identityHashes.has(`email:${emailHash(candidateEmail)}`);
  const summary = { ...allowance, used: usage.used, remaining: Math.max(0, allowance.limit - usage.used) };
  return { allowed: alreadyCounted || usage.used < allowance.limit, summary };
}
