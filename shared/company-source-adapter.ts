import { createHash } from "node:crypto";
import { z } from "zod";

export const companySourcePageClasses = [
  "registry",
  "runtime",
  "accountability_chart",
  "workflow",
  "scorecard",
  "role_pack",
  "authority",
  "supporting",
] as const;

export const companySourceBindingSchema = z.object({
  sourceKey: z.string().trim().min(2).max(160),
  orgKey: z.string().trim().min(3).max(160),
  pageClass: z.enum(companySourcePageClasses),
  sourceRef: z.string().url().max(2000),
  expectedPageId: z.string().uuid(),
  expectedRevision: z.string().trim().min(1).max(160),
  precedence: z.number().int().min(1).max(1000),
  maxAgeDays: z.number().int().positive().max(3650),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  importAuthority: z.literal("reference_only"),
}).strict();

export const notionCompanySourceSnapshotSchema = z.object({
  schemaVersion: z.literal("eos.notion-company-source-snapshot.v1"),
  sourceKey: z.string().trim().min(2).max(160),
  orgKey: z.string().trim().min(3).max(160),
  pageClass: z.enum(companySourcePageClasses),
  sourceRef: z.string().url().max(2000),
  pageId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  sourceRevision: z.string().datetime(),
  capturedAt: z.string().datetime(),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  importAuthority: z.literal("reference_only"),
  boundedText: z.string().max(50_000),
  truncated: z.boolean(),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();

export type CompanySourceBinding = z.infer<typeof companySourceBindingSchema>;
export type NotionCompanySourceSnapshot = z.infer<typeof notionCompanySourceSnapshotSchema>;

export function normalizeNotionPageId(value: string): string | null {
  const compact = value.replace(/-/g, "").toLowerCase();
  const match = compact.match(/([a-f0-9]{32})(?:\?.*)?$/);
  if (!match) return null;
  const id = match[1];
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

export function companySourceContentHash(input: Omit<NotionCompanySourceSnapshot, "contentHash">): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{20,}\b/i,
];

export function validateCompanySourceSnapshot(
  bindingInput: unknown,
  snapshotInput: unknown,
  now = new Date(),
): { snapshot: NotionCompanySourceSnapshot | null; findings: Array<{ code: string; message: string }> } {
  const binding = companySourceBindingSchema.safeParse(bindingInput);
  const snapshot = notionCompanySourceSnapshotSchema.safeParse(snapshotInput);
  const findings: Array<{ code: string; message: string }> = [];
  if (!binding.success) findings.push({ code: "source_binding_invalid", message: binding.error.message });
  if (!snapshot.success) findings.push({ code: "source_snapshot_invalid", message: snapshot.error.message });
  if (!binding.success || !snapshot.success) return { snapshot: null, findings };
  const expected = binding.data;
  const actual = snapshot.data;
  if (actual.sourceKey !== expected.sourceKey || actual.orgKey !== expected.orgKey)
    findings.push({ code: "source_scope_mismatch", message: "Snapshot source and organization scope must match the declared binding." });
  if (actual.pageClass !== expected.pageClass || actual.pageId !== expected.expectedPageId)
    findings.push({ code: "source_identity_mismatch", message: "Snapshot page class and exact Notion page identity must match the declared binding." });
  if (actual.sourceRef !== expected.sourceRef || actual.classification !== expected.classification)
    findings.push({ code: "source_contract_mismatch", message: "Snapshot URL and classification must match the declared binding." });
  const revision = new Date(actual.sourceRevision);
  const ageMs = now.getTime() - revision.getTime();
  if (ageMs < 0 || ageMs > expected.maxAgeDays * 86_400_000)
    findings.push({ code: "source_revision_stale", message: "Snapshot revision falls outside the binding freshness window." });
  const { contentHash, ...hashInput } = actual;
  if (companySourceContentHash(hashInput) !== contentHash)
    findings.push({ code: "source_hash_mismatch", message: "Snapshot content hash does not match its canonical envelope." });
  if (secretPatterns.some((pattern) => pattern.test(actual.boundedText)))
    findings.push({ code: "source_secret_detected", message: "Snapshot contains credential-shaped material and cannot cross the source boundary." });
  return { snapshot: findings.length ? null : actual, findings };
}
