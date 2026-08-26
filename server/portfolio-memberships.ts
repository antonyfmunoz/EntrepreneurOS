import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { companies, eosAssignments, eosMemberships, eosPortfolioMemberships, eosSeats, users } from "@shared/schema";
import { db } from "./db";

async function founderSeatForCompany(company: typeof companies.$inferSelect, executor: any): Promise<typeof eosSeats.$inferSelect> {
  let founder = await executor.query.eosSeats.findFirst({ where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")) });
  if (founder) return founder;
  try {
    [founder] = await executor.insert(eosSeats).values({
      id: randomUUID(),
      companyId: company.id,
      title: "Founder / Portfolio Principal",
      kind: "founder",
      occupantUserId: company.ownerUserId,
      agentName: company.assistantName || "Assistant",
      agentMode: "assistant",
      mandate: "Own final company and portfolio authority.",
      authority: { owner: true },
      toolEntitlements: [],
    }).returning();
  } catch {
    founder = await executor.query.eosSeats.findFirst({ where: and(eq(eosSeats.companyId, company.id), eq(eosSeats.kind, "founder"), eq(eosSeats.status, "active")) });
  }
  if (!founder) throw new Error("Founder seat could not be resolved while granting portfolio access.");
  return founder;
}

async function materializeOne(
  portfolioMembership: typeof eosPortfolioMemberships.$inferSelect,
  company: typeof companies.$inferSelect,
  executor: any,
): Promise<void> {
  const existing = await executor.query.eosMemberships.findFirst({ where: and(eq(eosMemberships.companyId, company.id), eq(eosMemberships.userId, portfolioMembership.userId)) });
  const principal = await executor.query.users.findFirst({ where: eq(users.id, portfolioMembership.userId) });
  if (!principal) throw new Error("Portfolio member identity is unavailable.");
  if (existing?.status === "active" && existing.seatId) {
    const now = new Date();
    await executor.update(eosMemberships).set({
      portfolioMembershipId: portfolioMembership.id,
      classificationCeiling: portfolioMembership.classificationCeiling,
      updatedAt: now,
    }).where(eq(eosMemberships.id, existing.id));
    const assignments = await executor.update(eosAssignments).set({
      classificationCeiling: portfolioMembership.classificationCeiling,
      status: "active",
      effectiveFrom: now,
      endedAt: null,
      updatedAt: now,
    }).where(and(eq(eosAssignments.membershipId, existing.id), eq(eosAssignments.seatId, existing.seatId))).returning({ id: eosAssignments.id });
    if (!assignments.length)
      await executor.insert(eosAssignments).values({ id: existing.id, companyId: company.id, membershipId: existing.id, principalUserId: principal.id, seatId: existing.seatId, assignmentType: "occupant", operatingGrant: "operate", purpose: existing.purpose, classificationCeiling: portfolioMembership.classificationCeiling, status: "active", effectiveFrom: now, metadata: { source: "portfolio_membership" }, createdAt: existing.createdAt, updatedAt: now }).onConflictDoUpdate({ target: eosAssignments.id, set: { seatId: existing.seatId, classificationCeiling: portfolioMembership.classificationCeiling, status: "active", effectiveFrom: now, endedAt: null, updatedAt: now } });
    return;
  }
  if (existing?.seatId) {
    const reusableSeat = await executor.query.eosSeats.findFirst({
      where: and(eq(eosSeats.id, existing.seatId), eq(eosSeats.companyId, company.id), eq(eosSeats.status, "active")),
    });
    if (reusableSeat && (!reusableSeat.occupantUserId || reusableSeat.occupantUserId === principal.id)) {
      const now = new Date();
      await executor.update(eosSeats).set({ occupantUserId: principal.id, agentMode: "assistant", updatedAt: now }).where(eq(eosSeats.id, reusableSeat.id));
      await executor.update(eosMemberships).set({
        status: "active",
        portfolioMembershipId: portfolioMembership.id,
        classificationCeiling: portfolioMembership.classificationCeiling,
        updatedAt: now,
      }).where(eq(eosMemberships.id, existing.id));
      await executor.insert(eosAssignments).values({ id: existing.id, companyId: company.id, membershipId: existing.id, principalUserId: principal.id, seatId: reusableSeat.id, assignmentType: "occupant", operatingGrant: "operate", purpose: existing.purpose, classificationCeiling: portfolioMembership.classificationCeiling, status: "active", effectiveFrom: now, metadata: { source: "portfolio_membership" }, createdAt: existing.createdAt, updatedAt: now }).onConflictDoUpdate({ target: eosAssignments.id, set: { seatId: reusableSeat.id, classificationCeiling: portfolioMembership.classificationCeiling, status: "active", effectiveFrom: now, endedAt: null, updatedAt: now } });
      return;
    }
  }
  const founder = await founderSeatForCompany(company, executor);
  const [seat] = await executor.insert(eosSeats).values({
    id: randomUUID(),
    companyId: company.id,
    title: "Portfolio Executive",
    kind: "portfolio_executive",
    supervisorSeatId: founder.id,
    occupantUserId: principal.id,
    agentName: `${principal.fullName || principal.username || "Portfolio"} Office`,
    agentMode: "assistant",
    mandate: "Coordinate authorized portfolio priorities, dependencies, and company reporting without bypassing Company CEO authority.",
    authority: { scope: "portfolio", approval: "founder" },
    toolEntitlements: [],
  }).returning();

  const now = new Date();
  const values = {
    companyId: company.id,
    userId: principal.id,
    seatId: seat.id,
    portfolioMembershipId: portfolioMembership.id,
    role: "portfolio_executive",
    status: "active",
    purpose: "portfolio_operate",
    classificationCeiling: portfolioMembership.classificationCeiling,
    updatedAt: now,
  };
  const membershipId = existing?.id || randomUUID();
  if (existing) await executor.update(eosMemberships).set(values).where(eq(eosMemberships.id, existing.id));
  else await executor.insert(eosMemberships).values({ id: membershipId, ...values, createdAt: now });
  await executor.insert(eosAssignments).values({ id: membershipId, companyId: company.id, membershipId, principalUserId: principal.id, seatId: seat.id, assignmentType: "occupant", operatingGrant: "operate", purpose: "portfolio_operate", classificationCeiling: portfolioMembership.classificationCeiling, status: "active", effectiveFrom: now, metadata: { source: "portfolio_membership" }, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: eosAssignments.id, set: { seatId: seat.id, classificationCeiling: portfolioMembership.classificationCeiling, status: "active", effectiveFrom: now, endedAt: null, updatedAt: now } });
}

export async function materializePortfolioMembership(portfolioMembershipId: string, executor: any = db, companyIds?: number[]): Promise<void> {
  const portfolioMembership = await executor.query.eosPortfolioMemberships.findFirst({ where: and(eq(eosPortfolioMemberships.id, portfolioMembershipId), eq(eosPortfolioMemberships.status, "active")) });
  if (!portfolioMembership) return;
  const predicates = [eq(companies.portfolioId, portfolioMembership.portfolioId)];
  if (companyIds?.length) predicates.push(inArray(companies.id, companyIds));
  const companyRows = await executor.select().from(companies).where(and(...predicates));
  for (const company of companyRows as Array<typeof companies.$inferSelect>) await materializeOne(portfolioMembership, company, executor);
}

export async function syncPortfolioMembersForCompany(company: typeof companies.$inferSelect, executor: any = db): Promise<void> {
  if (!company.portfolioId) return;
  const memberships = await executor.select().from(eosPortfolioMemberships).where(and(eq(eosPortfolioMemberships.portfolioId, company.portfolioId), eq(eosPortfolioMemberships.status, "active")));
  for (const membership of memberships as Array<typeof eosPortfolioMemberships.$inferSelect>) await materializeOne(membership, company, executor);
}

export async function reconcilePortfolioMembersForCompany(company: typeof companies.$inferSelect, executor: any = db): Promise<void> {
  const derived = await executor.select().from(eosMemberships).where(and(eq(eosMemberships.companyId, company.id), inArray(eosMemberships.status, ["active", "suspended"])));
  for (const membership of derived as Array<typeof eosMemberships.$inferSelect>) {
    if (!membership.portfolioMembershipId) continue;
    const portfolioMembership = await executor.query.eosPortfolioMemberships.findFirst({ where: eq(eosPortfolioMemberships.id, membership.portfolioMembershipId) });
    if (portfolioMembership?.portfolioId === company.portfolioId && portfolioMembership.status === "active") continue;
    const now = new Date();
    const assignments = await executor.select().from(eosAssignments).where(and(eq(eosAssignments.membershipId, membership.id), inArray(eosAssignments.status, ["active", "suspended"])));
    for (const assignment of assignments) if (assignment.operatingGrant === "operate") await executor.update(eosSeats).set({ occupantUserId: null, agentMode: "autonomous", updatedAt: now }).where(and(eq(eosSeats.id, assignment.seatId), eq(eosSeats.occupantUserId, membership.userId)));
    await executor.update(eosAssignments).set({ status: "ended", endedAt: now, updatedAt: now }).where(and(eq(eosAssignments.membershipId, membership.id), inArray(eosAssignments.status, ["active", "suspended"])));
    await executor.update(eosMemberships).set({ status: "revoked", portfolioMembershipId: null, updatedAt: now }).where(eq(eosMemberships.id, membership.id));
  }
  await syncPortfolioMembersForCompany(company, executor);
}

export async function setPortfolioMembershipStatus(portfolioMembershipId: string, status: "active" | "suspended" | "revoked", executor: any = db): Promise<void> {
  const membership = await executor.query.eosPortfolioMemberships.findFirst({ where: eq(eosPortfolioMemberships.id, portfolioMembershipId) });
  if (!membership) return;
  await executor.update(eosPortfolioMemberships).set({ status, updatedAt: new Date() }).where(eq(eosPortfolioMemberships.id, membership.id));
  if (status === "active") {
    await materializePortfolioMembership(membership.id, executor);
    return;
  }
  const companyMemberships = await executor.select().from(eosMemberships).where(and(eq(eosMemberships.portfolioMembershipId, membership.id), eq(eosMemberships.status, "active")));
  for (const companyMembership of companyMemberships as Array<typeof eosMemberships.$inferSelect>) {
    const now = new Date();
    const assignments = await executor.select().from(eosAssignments).where(and(eq(eosAssignments.membershipId, companyMembership.id), eq(eosAssignments.status, "active")));
    for (const assignment of assignments) if (assignment.operatingGrant === "operate") await executor.update(eosSeats).set({ occupantUserId: null, agentMode: "autonomous", updatedAt: now }).where(and(eq(eosSeats.id, assignment.seatId), eq(eosSeats.occupantUserId, companyMembership.userId)));
    await executor.update(eosAssignments).set(status === "suspended" ? { status: "suspended", updatedAt: now } : { status: "ended", endedAt: now, updatedAt: now }).where(and(eq(eosAssignments.membershipId, companyMembership.id), eq(eosAssignments.status, "active")));
    await executor.update(eosMemberships).set({ status, updatedAt: now }).where(eq(eosMemberships.id, companyMembership.id));
  }
}
