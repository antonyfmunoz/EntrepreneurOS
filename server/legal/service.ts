import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { legalAcceptances, legalDocuments } from "@shared/schema";
import { db } from "../db";
import { legalEnforcementActive } from "./policy";

export async function publishedLegalDocuments() {
  return db.select().from(legalDocuments).where(eq(legalDocuments.status, "published"));
}

export async function legalStatusForUser(userId: string) {
  const documents = await publishedLegalDocuments();
  const requiredTypes = (process.env.EOS_REQUIRED_LEGAL_DOCUMENTS || "terms,privacy").split(",").map((type) => type.trim()).filter(Boolean);
  const publishedTypes = new Set(documents.map((document) => document.documentType));
  const missingConfiguration = requiredTypes.filter((type) => !publishedTypes.has(type));
  const required = documents.filter((document) => document.required && document.effectiveAt <= new Date());
  const acceptances = required.length
    ? await db.select().from(legalAcceptances).where(and(eq(legalAcceptances.userId, userId), inArray(legalAcceptances.documentId, required.map((document) => document.id))))
    : [];
  const acceptedIds = new Set(acceptances.filter((acceptance) => required.some((document) => document.id === acceptance.documentId && document.checksum === acceptance.documentChecksum)).map((acceptance) => acceptance.documentId));
  const configurationReady = missingConfiguration.length === 0;
  const enforcementRequested = process.env.EOS_LEGAL_ENFORCEMENT === "true";
  const enforcement = legalEnforcementActive({
    requested: enforcementRequested,
    configurationReady,
    publicPaidSaaS: process.env.EOS_PUBLIC_PAID_SAAS === "true",
  });
  return { enforcement, enforcementRequested, configurationReady, missingConfiguration, documents, missing: required.filter((document) => !acceptedIds.has(document.id)), acceptedAt: acceptances.map((acceptance) => ({ documentId: acceptance.documentId, acceptedAt: acceptance.acceptedAt })) };
}

export async function recordLegalAcceptance(input: { userId: string; documentId: string; ip: string; userAgent: string }) {
  const [document] = await db.select().from(legalDocuments).where(and(eq(legalDocuments.id, input.documentId), eq(legalDocuments.status, "published"))).limit(1);
  if (!document) throw new Error("Published legal document not found.");
  const hash = (value: string) => createHash("sha256").update(`${process.env.EOS_LEGAL_AUDIT_SALT || ""}:${value}`).digest("hex");
  const [acceptance] = await db.insert(legalAcceptances).values({ id: `legal_acceptance_${randomUUID()}`, documentId: document.id, userId: input.userId, documentChecksum: document.checksum, ipHash: hash(input.ip), userAgentHash: hash(input.userAgent) }).onConflictDoNothing().returning();
  return acceptance || (await db.select().from(legalAcceptances).where(and(eq(legalAcceptances.documentId, document.id), eq(legalAcceptances.userId, input.userId))).limit(1))[0];
}
