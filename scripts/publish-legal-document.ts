import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, client } from "../server/db";
import { legalDocuments } from "../shared/schema";

const inputSchema = z.object({
  documentType: z.enum(["terms", "privacy", "acceptable_use", "cookie", "dpa"]),
  title: z.string().min(3).max(160),
  version: z.string().min(1).max(80),
  url: z.string().url(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  effectiveAt: z.coerce.date(),
  required: z.enum(["true", "false"]).transform((value) => value === "true").default("true"),
});

async function main() {
  if (process.env.EOS_LEGAL_PUBLISH_APPROVED !== "true") throw new Error("Set EOS_LEGAL_PUBLISH_APPROVED=true only after qualified legal approval.");
  const input = inputSchema.parse({ documentType: process.env.EOS_LEGAL_DOCUMENT_TYPE, title: process.env.EOS_LEGAL_DOCUMENT_TITLE, version: process.env.EOS_LEGAL_DOCUMENT_VERSION, url: process.env.EOS_LEGAL_DOCUMENT_URL, checksum: process.env.EOS_LEGAL_DOCUMENT_SHA256, effectiveAt: process.env.EOS_LEGAL_DOCUMENT_EFFECTIVE_AT, required: process.env.EOS_LEGAL_DOCUMENT_REQUIRED || "true" });
  const id = `legal_${input.documentType}_${randomUUID()}`;
  await db.transaction(async (tx) => {
    await tx.update(legalDocuments).set({ status: "superseded" }).where(and(eq(legalDocuments.documentType, input.documentType), eq(legalDocuments.status, "published")));
    await tx.insert(legalDocuments).values({ id, ...input, status: "published" });
  });
  console.log(JSON.stringify({ published: true, id, documentType: input.documentType, version: input.version }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Legal publication failed."); process.exitCode = 1; }).finally(() => client.end({ timeout: 5 }));
