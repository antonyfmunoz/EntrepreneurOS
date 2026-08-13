import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import { clerkClient } from "./clerkAdmin";
import { eosMembershipInvitations } from "@shared/schema";

export const MEMBERSHIP_INVITATION_TTL_DAYS = 7;

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function invitationDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createInvitationSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function invitationAcceptancePath(token: string): string {
  return `/invitations/accept?token=${encodeURIComponent(token)}`;
}

function publicOrigin(): string {
  const value = process.env.EOS_PUBLIC_ORIGIN || "";
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("EOS_PUBLIC_ORIGIN must use HTTPS for membership invitations.");
  }
  return url.origin;
}

export async function deliverMembershipInvitation(input: {
  invitationId: string;
  email: string;
  token: string;
}): Promise<{ providerInvitationId: string }> {
  if (process.env.NODE_ENV === "test") {
    return { providerInvitationId: `test_invitation_${input.invitationId}` };
  }
  if (!clerkClient) throw new Error("Clerk invitation delivery is not configured.");
  const invitation = await clerkClient.invitations.createInvitation({
    emailAddress: input.email,
    expiresInDays: MEMBERSHIP_INVITATION_TTL_DAYS,
    ignoreExisting: true,
    notify: true,
    publicMetadata: { eosInvitationId: input.invitationId },
    redirectUrl: `${publicOrigin()}${invitationAcceptancePath(input.token)}`,
  });
  return { providerInvitationId: invitation.id };
}

export async function revokeDeliveredMembershipInvitation(providerInvitationId: string | null): Promise<void> {
  if (!providerInvitationId || process.env.NODE_ENV === "test") return;
  if (!clerkClient) throw new Error("Clerk invitation revocation is not configured.");
  await clerkClient.invitations.revokeInvitation(providerInvitationId);
}

export async function expireMembershipInvitations(now = new Date()): Promise<number> {
  const expired = await db.update(eosMembershipInvitations).set({
    status: "expired",
    invitedEmail: null,
    updatedAt: now,
  }).where(and(
    inArray(eosMembershipInvitations.status, ["pending_delivery", "pending"]),
    lt(eosMembershipInvitations.expiresAt, now),
  )).returning({ id: eosMembershipInvitations.id });
  return expired.length;
}

export function startMembershipInvitationWorker(intervalMs = 60 * 60 * 1000): () => void {
  const run = () => void expireMembershipInvitations().catch((error) => {
    console.error("membership invitation expiry failed", { error });
  });
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

export function newMembershipInvitationId(): string {
  return randomUUID();
}
