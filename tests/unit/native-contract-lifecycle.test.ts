import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  nativeEsignCounterpartySchema,
  nativeEsignEvidencePromotionSchema,
  nativeEsignTemplateGenerationSchema,
  nativeEsignTemplateVersionSchema,
  nativeEsignBatchSchema,
  nativeEsignCloneSchema,
  nativeEsignNegotiationOpenSchema,
  nativeEsignObligationPromotionSchema,
  nativeEsignReminderScheduleSchema,
  nativeEsignDocumentRevisionSchema,
  nativeEsignGeneratedRevisionSchema,
  nativeEsignReplacementSchema,
  nativeEsignConsentSchema,
  nativeEsignIssueSchema,
  nativeEsignContractPlanSchema,
  nativeEsignContractRenewalDecisionSchema,
  nativeEsignContractNoticeSchema,
  nativeEsignContractNoticeApprovalSchema,
  nativeEsignContractNoticeDeliverySchema,
  nativeEsignContractNoticeReconciliationSchema,
  nativeEsignPortfolioTemplateProposalSchema,
  nativeEsignPortfolioTemplateAdoptionSchema,
  nativeEsignPortfolioTemplateWithdrawalSchema,
  nativeEsignJurisdictionPackSchema,
  nativeEsignJurisdictionPackPublicationSchema,
  nativeEsignJurisdictionApplicabilityDecisionSchema,
  nativeEsignJurisdictionPackWithdrawalSchema,
} from "@shared/native-esign";
import { nativeContractContentSha256, renderNativeContractPdf, renderNativeContractText } from "../../server/esign/template-generation";
import { compareNativeContractText } from "../../server/esign/contract-diff";

describe("EOS governed native contract lifecycle", () => {
  it("renders only declared variables and exact clause versions into a deterministic snapshot", () => {
    const input = {
      titleTemplate: "Services agreement for {{client-name}}",
      bodyTemplate: "Effective {{effective-date}}.\n\n{{clause.payment}}",
      variableSchema: [
        { key: "client-name", label: "Client name", required: true, maxLength: 100 },
        { key: "effective-date", label: "Effective date", required: true, maxLength: 40 },
      ],
      values: { "client-name": "Example Client LLC", "effective-date": "2026-09-01" },
      clauses: [{ clauseKey: "payment", versionId: "clause-version", bodyText: "Payment is due within 30 days.", bodySha256: "a".repeat(64) }],
    };
    const first = renderNativeContractText(input);
    const second = renderNativeContractText({ ...input, values: { "effective-date": "2026-09-01", "client-name": "Example Client LLC" } });
    expect(first.title).toBe("Services agreement for Example Client LLC");
    expect(first.body).toContain("Payment is due within 30 days.");
    expect(first.snapshot).toEqual(second.snapshot);
    expect(nativeContractContentSha256(first.snapshot)).toMatch(/^[0-9a-f]{64}$/);
    expect(() => renderNativeContractText({ ...input, values: { ...input.values, undeclared: "no" } })).toThrow("unknown_variable");
    expect(() => renderNativeContractText({ ...input, values: { "client-name": "", "effective-date": "2026-09-01" } })).toThrow("variable_required");
  });

  it("generates a readable PDF with a visible signature and date field for every role", async () => {
    const result = await renderNativeContractPdf({
      title: "Generated agreement",
      body: "A governed agreement body. ".repeat(250),
      recipients: [
        { roleKey: "provider", label: "Provider", routingOrder: 1 },
        { roleKey: "counterparty", label: "Counterparty", routingOrder: 2 },
      ],
      generationReference: "eos:7:template:version:document:id",
    });
    const parsed = await PDFDocument.load(result.pdf);
    expect(parsed.getPageCount()).toBe(result.pageCount);
    expect(result.fields.filter((field) => field.type === "signature")).toHaveLength(2);
    expect(result.fields.filter((field) => field.type === "date")).toHaveLength(2);
    expect(new Set(result.fields.map((field) => field.id)).size).toBe(4);
  });

  it("validates bounded template, counterparty, generation, and Evidence promotion contracts", () => {
    const version = nativeEsignTemplateVersionSchema.parse({
      versionLabel: "1.0", titleTemplate: "Agreement for {{client-name}}",
      bodyTemplate: "This agreement contains sufficiently complete governed language.",
      variables: [{ key: "client-name", label: "Client name", required: true, maxLength: 240 }],
      recipients: [{ roleKey: "counterparty", label: "Counterparty", routingOrder: 1 }],
      clauseVersionIds: [],
    });
    expect(version.recipients[0].roleKey).toBe("counterparty");
    expect(() => nativeEsignTemplateVersionSchema.parse({ ...version, recipients: [...version.recipients, version.recipients[0]] })).toThrow("unique");
    expect(nativeEsignCounterpartySchema.parse({ partyType: "organization", legalName: "Example LLC", displayName: "Example", signerName: "Signer", signerEmail: "signer@example.test" }).dataClassification).toBe("confidential");
    expect(nativeEsignTemplateGenerationSchema.parse({ values: { "client-name": "Example" } }).values["client-name"]).toBe("Example");
    expect(nativeEsignEvidencePromotionSchema.parse({ workPacketId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", supportedClaimSummary: "The parties executed the governed agreement.", verifierMethod: "Verified EOS native signing hashes." })).toBeTruthy();
  });

  it("migrates versioned libraries, instance lineage, and immutable promotion receipts", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0071_add_native_contract_lifecycle.sql"), "utf8");
    for (const table of ["eos_esign_clauses", "eos_esign_clause_versions", "eos_esign_templates", "eos_esign_template_versions", "eos_esign_counterparties", "eos_esign_evidence_promotions"])
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(migration).toContain("EOS native template version content is immutable");
    expect(migration).toContain("eos_esign_evidence_promotions_immutable");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS work_packet_id");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext/i);
  });

  it("validates governed contract operations and their immutable storage model", () => {
    expect(nativeEsignCloneSchema.parse({ mode: "renewal", expiresAt: new Date(Date.now() + 86_400_000) }).mode).toBe("renewal");
    expect(nativeEsignNegotiationOpenSchema.parse({ subject: "Payment term", body: "Please revise the payment trigger.", requestedChanges: ["Net 45 instead of Net 30"] }).requestedChanges).toHaveLength(1);
    expect(nativeEsignReminderScheduleSchema.parse({ nextReminderAt: new Date(), intervalDays: 3, maxReminders: 4 }).maxReminders).toBe(4);
    expect(() => nativeEsignBatchSchema.parse({ action: "void", envelopeIds: ["8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda"], reason: "Founder-reviewed batch void." })).toThrow("unique");
    expect(nativeEsignObligationPromotionSchema.parse({ obligationKey: "client-reporting", title: "Client reporting", ownerSeatId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", description: "Deliver the agreed monthly client reporting package.", sourceExcerpt: "Provider will deliver a monthly report." }).classification).toBe("confidential");
    const migration = readFileSync(resolve(process.cwd(), "migrations/0072_add_native_contract_operations.sql"), "utf8");
    for (const table of ["eos_esign_negotiations", "eos_esign_negotiation_entries", "eos_esign_reminder_schedules", "eos_esign_batches", "eos_esign_batch_items", "eos_esign_obligation_promotions"])
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(migration).toContain("EOS native contract operation records are immutable");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS renewal_of_envelope_id");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext/i);
  });

  it("validates immutable revision and replacement contracts", () => {
    const fields = [{ id: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", roleKey: "counterparty", type: "signature" as const, page: 1, x: 0.1, y: 0.8, width: 0.25, height: 0.08, label: "Counterparty signature", required: true }];
    expect(nativeEsignDocumentRevisionSchema.parse({ documentVersion: "2.0", title: "Revised agreement", sourceReference: "counsel://agreement/2.0", revisionSummary: "Payment timing was revised after counterparty review.", declaredChanges: ["Net 45 replaces Net 30."], fields }).declaredChanges).toHaveLength(1);
    expect(nativeEsignReplacementSchema.parse({ documentVersionId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", negotiationId: "3320d884-0c5b-4fb3-bfab-70d6b8897824", expiresAt: new Date(Date.now() + 86_400_000) }).expiresAt).toBeInstanceOf(Date);
    const migration = readFileSync(resolve(process.cwd(), "migrations/0073_add_native_contract_revisions.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_document_comparisons");
    expect(migration).toContain("eos_esign_document_comparisons_immutable");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS replaces_envelope_id");
    expect(migration).toContain("document_revision_registered");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext/i);
  });

  it("computes deterministic exact text operations without claiming a legal interpretation", () => {
    const source = { title: "Services agreement", body: "Scope remains unchanged.\nPayment is due in 30 days.\nReports are monthly." };
    const target = { title: "Services agreement", body: "Scope remains unchanged.\nPayment is due in 45 days.\nReports are monthly.\nRenewal requires written approval." };
    const first = compareNativeContractText(source, target);
    const second = compareNativeContractText(source, target);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ exact: true, granularity: "line", algorithm: "lcs", stats: { deletedLines: 1, insertedLines: 2 } });
    expect(first.operations.filter((operation) => operation.type === "delete").flatMap((operation) => operation.lines)).toContain("Payment is due in 30 days.");
    expect(first.operations.filter((operation) => operation.type === "insert").flatMap((operation) => operation.lines)).toContain("Payment is due in 45 days.");
    expect(first.sourceTextSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.targetTextSha256).not.toBe(first.sourceTextSha256);
    expect(JSON.stringify(first)).not.toMatch(/legal[_ -]?approval|legally equivalent/i);
  });

  it("uses an exact bounded comparison for unusually large line matrices", () => {
    const source = { title: "Large agreement", body: Array.from({ length: 1_500 }, (_, index) => `Source line ${index}`).join("\n") };
    const target = { title: "Large agreement", body: Array.from({ length: 1_500 }, (_, index) => index === 750 ? "Target replacement" : `Source line ${index}`).join("\n") };
    const comparison = compareNativeContractText(source, target);
    expect(comparison.algorithm).toBe("bounded-prefix-suffix");
    expect(comparison.stats).toMatchObject({ deletedLines: 1, insertedLines: 1 });
    expect(comparison.operations.flatMap((operation) => operation.lines).filter((line) => line === "Target replacement")).toHaveLength(1);
  });

  it("validates generated revision input and migrates immutable semantic comparison evidence", () => {
    expect(nativeEsignGeneratedRevisionSchema.parse({ templateVersionId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", documentVersion: "2.0", revisionSummary: "Counterparty-approved payment timing update.", negotiationId: "3320d884-0c5b-4fb3-bfab-70d6b8897824", values: { "payment-days": "45" } }).values["payment-days"]).toBe("45");
    const migration = readFileSync(resolve(process.cwd(), "migrations/0074_add_native_contract_semantic_comparisons.sql"), "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS structured_diff");
    expect(migration).toContain("comparison_type = 'generated_text'");
    expect(migration).toContain("document_semantic_comparison_recorded");
    expect(migration).toContain("never a legal interpretation");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext/i);
  });

  it("binds replacement issuance and signer consent to one immutable comparison receipt", () => {
    const comparisonSha256 = "a".repeat(64);
    expect(nativeEsignIssueSchema.parse({ comparisonReviewSha256: comparisonSha256 }).comparisonReviewSha256).toBe(comparisonSha256);
    expect(nativeEsignConsentSchema.parse({ consentVersion: "eos-native-esign-consent.v1", electronicRecordsAccepted: true, electronicSignaturesAccepted: true, comparisonAcknowledgementSha256: comparisonSha256 }).comparisonAcknowledgementSha256).toBe(comparisonSha256);
    expect(nativeEsignIssueSchema.parse({})).toEqual({});
    expect(() => nativeEsignIssueSchema.parse({ comparisonReviewSha256: "not-a-hash" })).toThrow();
    const migration = readFileSync(resolve(process.cwd(), "migrations/0075_add_native_contract_comparison_acknowledgements.sql"), "utf8");
    expect(migration).toContain("comparison_review_sha256");
    expect(migration).toContain("comparison_acknowledgement_sha256");
    expect(migration).toContain("EOS envelope comparison review evidence is immutable");
    expect(migration).toContain("EOS recipient comparison acknowledgement evidence is immutable");
    expect(migration).toContain("'comparison_reviewed','comparison_acknowledged'");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext/i);
  });

  it("keeps unopened sequential recipients distinct from manually deliverable recipients", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0076_add_native_esign_routing_stage_state.sql"), "utf8");
    expect(migration).toContain("'routing_wait','manual_ready'");
    expect(migration).toContain("eos_esign_recipient_delivery_state_check");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext/i);
  });

  it("keeps signing expiry separate from governed agreement terms and seals lifecycle decisions", () => {
    const effectiveAt = new Date("2026-09-01T00:00:00.000Z");
    const contractEndsAt = new Date("2027-09-01T00:00:00.000Z");
    const plan = nativeEsignContractPlanSchema.parse({
      effectiveAt, contractEndsAt, noticeDeadlineAt: new Date("2027-08-01T00:00:00.000Z"),
      nextReviewAt: new Date("2026-10-01T00:00:00.000Z"), ownerSeatId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
    });
    expect(plan.contractEndsAt).toEqual(contractEndsAt);
    expect(() => nativeEsignContractPlanSchema.parse({ ...plan, contractEndsAt: new Date("2026-08-01T00:00:00.000Z") })).toThrow("agreement end");
    expect(() => nativeEsignContractPlanSchema.parse({ ...plan, noticeDeadlineAt: new Date("2028-01-01T00:00:00.000Z") })).toThrow("notice deadline");
    expect(nativeEsignContractRenewalDecisionSchema.parse({ expectedVersion: 1, intent: "renew", evidenceIds: ["3320d884-0c5b-4fb3-bfab-70d6b8897824"], decisionNote: "Verified client health supports renewal." }).intent).toBe("renew");
    expect(() => nativeEsignContractRenewalDecisionSchema.parse({ expectedVersion: 1, intent: "renew", evidenceIds: [], decisionNote: "Unsupported renewal decision." })).toThrow();
    const migration = readFileSync(resolve(process.cwd(), "migrations/0078_add_native_contract_control_center.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_contract_plans");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_contract_plan_events");
    expect(migration).toContain("EOS native contract plan events are append-only");
    expect(migration).toContain("contract_plan_recorded");
    expect(migration).toContain("contract_renewal_decided");
    expect(migration).not.toMatch(/credential|secret|token_digest|storage_key/i);
  });

  it("requires exact approval-bound content before contract notice delivery", () => {
    const notice = nativeEsignContractNoticeSchema.parse({
      noticeType: "renewal_offer", recipientName: "Example Client", recipientEmail: " LEGAL@EXAMPLE.TEST ",
      subject: "Annual agreement renewal", bodyText: "We are providing the reviewed annual renewal notice.",
      dueAt: new Date(Date.now() + 86_400_000), ownerSeatId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
    });
    expect(notice.recipientEmail).toBe("legal@example.test");
    expect(() => nativeEsignContractNoticeSchema.parse({ ...notice, subject: "Invalid\r\nBcc: attacker@example.test" })).toThrow("line breaks");
    expect(nativeEsignContractNoticeApprovalSchema.parse({ expectedVersion: 1, evidenceIds: ["3320d884-0c5b-4fb3-bfab-70d6b8897824"], approvalNote: "Verified performance supports this exact notice." }).evidenceIds).toHaveLength(1);
    expect(() => nativeEsignContractNoticeApprovalSchema.parse({ expectedVersion: 1, evidenceIds: [], approvalNote: "Unsupported approval." })).toThrow();
    expect(nativeEsignContractNoticeDeliverySchema.parse({ expectedVersion: 2 })).toEqual({ expectedVersion: 2 });
    expect(nativeEsignContractNoticeReconciliationSchema.parse({ expectedVersion: 3, outcome: "uncertain", reconciliationNote: "Provider state remains ambiguous after review." }).outcome).toBe("uncertain");
    expect(() => nativeEsignContractNoticeReconciliationSchema.parse({ expectedVersion: 3, outcome: "delivered", reconciliationNote: "Provider dashboard verified delivery." })).toThrow("provider message reference");
    const migration = readFileSync(resolve(process.cwd(), "migrations/0079_add_native_contract_notice_execution.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_contract_notices");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_contract_notice_attempts");
    expect(migration).toContain("EOS approved contract notice content is immutable");
    expect(migration).toContain("EOS contract notice delivery attempts are immutable");
    expect(migration).toContain("contract_notice_delivery_prepared");
    expect(migration).toContain("contract_notice_delivery_reconciled");
    expect(migration).toContain("eos_esign_contract_notices_last_delivery_attempt_fk");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext|token_digest/i);
  });

  it("keeps portfolio standards advisory and company adoption attributable", () => {
    const sourceTemplateVersionId = "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda";
    const reviewEvidenceId = "3320d884-0c5b-4fb3-bfab-70d6b8897824";
    const hash = "a".repeat(64);
    const proposal = nativeEsignPortfolioTemplateProposalSchema.parse({
      sourceTemplateVersionId,
      proposalKey: "services-master-agreement",
      jurisdiction: "California, United States",
      applicabilitySummary: "A starting point for reviewed business services agreements.",
      limitations: "Every company must validate facts, counterparties, law, and local risk.",
      reviewEvidenceId,
      reviewAuthority: "business_review",
    });
    expect(proposal.classification).toBe("confidential");
    expect(nativeEsignPortfolioTemplateAdoptionSchema.parse({ expectedProposalSha256: hash, decision: "accepted", reviewEvidenceId, reviewAuthority: "internal_legal", decisionRationale: "Company-specific review supports creating a local draft for approval." }).decision).toBe("accepted");
    expect(nativeEsignPortfolioTemplateWithdrawalSchema.parse({ expectedProposalSha256: hash, reason: "A newer reviewed proposal supersedes this portfolio starting point." }).reason).toContain("supersedes");
    expect(() => nativeEsignPortfolioTemplateProposalSchema.parse({ ...proposal, proposalKey: "Not Valid" })).toThrow();
    expect(() => nativeEsignPortfolioTemplateAdoptionSchema.parse({ expectedProposalSha256: "not-a-hash", decision: "accepted", reviewEvidenceId, reviewAuthority: "business_review", decisionRationale: "Company-specific review supports a local draft." })).toThrow();
    const migration = readFileSync(resolve(process.cwd(), "migrations/0080_add_portfolio_contract_standard_proposals.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_portfolio_template_proposals");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_portfolio_template_adoptions");
    expect(migration).toContain("EOS portfolio contract proposal content is immutable");
    expect(migration).toContain("EOS portfolio contract adoption decisions are append-only");
    expect(migration).toContain("never cross-company authority");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext|token_digest/i);
  });

  it("keeps jurisdiction packs versioned, counsel-attributed, and locally applicable", () => {
    const reviewEvidenceId = "3320d884-0c5b-4fb3-bfab-70d6b8897824";
    const hash = "b".repeat(64);
    const pack = nativeEsignJurisdictionPackSchema.parse({
      packKey: "us-ca-services", name: "California services agreements", countryCode: "us", subdivision: "California", governingLawLabel: "Laws of the State of California",
      scopeSummary: "A counsel-reviewed source package for ordinary business services agreements.",
      applicabilityCriteria: "Use only after counsel validates the entity, counterparty, transaction, timing, and current law.",
      exclusions: "Excludes employment, consumer, regulated industry, securities, tax, and cross-border matters.",
      requiredReviews: ["Entity and transaction review", "Current-law and counterparty review"],
      sourceReferences: [{ label: "Counsel matter file", reference: "MATTER-2026-CA-001" }],
      effectiveFrom: "2026-08-01", reviewedThrough: "2026-08-15", nextReviewAt: "2027-02-15",
    });
    expect(pack.countryCode).toBe("US");
    expect(nativeEsignJurisdictionPackPublicationSchema.parse({ expectedPackSha256: hash, reviewEvidenceId, reviewerName: "Alex Counsel", reviewerOrganization: "Example Legal", reviewerCredentialReference: "CA-BAR-REFERENCE", publicationNote: "Counsel reviewed the cited sources, scope, limitations, and required company-specific checks." }).reviewerName).toBe("Alex Counsel");
    expect(nativeEsignJurisdictionApplicabilityDecisionSchema.parse({ expectedPackSha256: hash, outcome: "applicable", reviewEvidenceId, reviewerName: "Alex Counsel", reviewerOrganization: "Example Legal", reviewerCredentialReference: "CA-BAR-REFERENCE", factsConsidered: "The company, counterparty, services transaction, term, and current operating facts were reviewed.", decisionRationale: "The exact pack is applicable as a starting point subject to the documented exclusions and final agreement review." }).outcome).toBe("applicable");
    expect(nativeEsignJurisdictionPackWithdrawalSchema.parse({ expectedPackSha256: hash, reason: "A later counsel-reviewed pack supersedes this jurisdiction snapshot." }).reason).toContain("supersedes");
    expect(() => nativeEsignJurisdictionPackSchema.parse({ ...pack, nextReviewAt: "2026-08-10" })).toThrow("Next review");
    expect(() => nativeEsignJurisdictionPackSchema.parse({ ...pack, sourceReferences: [{ label: "Unsafe", reference: "Bearer abcdefghijklmnopqrstuvwxyz123456" }] })).toThrow("credential-shaped");
    const migration = readFileSync(resolve(process.cwd(), "migrations/0081_add_governed_jurisdiction_packs.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_jurisdiction_packs");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_jurisdiction_pack_applicability_decisions");
    expect(migration).toContain("EOS jurisdiction applicability decisions are append-only");
    expect(migration).toContain("NEW.jurisdiction_pack_id IS NOT DISTINCT FROM OLD.jurisdiction_pack_id");
    expect(migration).toContain("does not verify a");
    expect(migration).toContain("professional license");
    expect(migration).not.toMatch(/password|private[_ ]?key|secret_ciphertext|token_digest/i);
  });
});
