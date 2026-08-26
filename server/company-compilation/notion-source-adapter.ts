import {
  companySourceBindingSchema,
  companySourceContentHash,
  normalizeNotionPageId,
  notionCompanySourceSnapshotSchema,
  validateCompanySourceSnapshot,
  type CompanySourceBinding,
  type NotionCompanySourceSnapshot,
} from "@shared/company-source-adapter";
import { readPageSnapshot } from "../integrations/notion";

export class CompanySourceAdapterError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function createNotionSourceBinding(input: Omit<CompanySourceBinding, "expectedPageId">): CompanySourceBinding {
  const pageId = normalizeNotionPageId(input.sourceRef);
  if (!pageId)
    throw new CompanySourceAdapterError("source_page_id_invalid", "The source binding does not contain an exact Notion page identity.");
  const source = new URL(input.sourceRef);
  if (!source.hostname.endsWith("notion.com") && !source.hostname.endsWith("notion.site"))
    throw new CompanySourceAdapterError("source_provider_invalid", "The source binding must resolve to a Notion page.");
  return companySourceBindingSchema.parse({ ...input, expectedPageId: pageId });
}

export async function captureNotionCompanySource(
  userId: string,
  binding: CompanySourceBinding,
): Promise<NotionCompanySourceSnapshot> {
  const page = await readPageSnapshot(userId, binding.expectedPageId, 250);
  const actualPageId = normalizeNotionPageId(page.pageId);
  if (actualPageId !== binding.expectedPageId)
    throw new CompanySourceAdapterError("source_identity_mismatch", "Notion returned a page outside the exact declared source binding.");
  const envelope = {
    schemaVersion: "eos.notion-company-source-snapshot.v1" as const,
    sourceKey: binding.sourceKey,
    orgKey: binding.orgKey,
    pageClass: binding.pageClass,
    sourceRef: binding.sourceRef,
    pageId: binding.expectedPageId,
    title: page.title,
    sourceRevision: page.lastEditedTime,
    capturedAt: new Date().toISOString(),
    classification: binding.classification,
    importAuthority: "reference_only" as const,
    boundedText: page.boundedText,
    truncated: page.truncated,
  };
  const snapshot = notionCompanySourceSnapshotSchema.parse({
    ...envelope,
    contentHash: companySourceContentHash(envelope),
  });
  const validated = validateCompanySourceSnapshot(binding, snapshot);
  if (!validated.snapshot)
    throw new CompanySourceAdapterError(
      validated.findings[0]?.code || "source_snapshot_invalid",
      validated.findings.map((finding) => finding.message).join(" "),
    );
  return validated.snapshot;
}
