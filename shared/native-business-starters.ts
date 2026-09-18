export type NativeBusinessStarter = {
  key: string;
  instrumentKey: "commerce" | "crm" | "docs" | "finance" | "forms" | "sheets" | "websites";
  objectType: string;
  title: string;
  summary: string;
  ownerRoleKey: string;
  data: Record<string, unknown>;
};

/**
 * A compiler starter can point to another starter by its stable template key.
 * The company compiler resolves this marker to the UUID of the actual object
 * it creates. Keeping the template key here avoids embedding a tenant's
 * runtime identifiers in the shared business-in-a-box library.
 */
export type NativeBusinessStarterReference = { starterAssetId: string };
export const nativeBusinessStarterReference = (starterAssetId: string): NativeBusinessStarterReference => ({ starterAssetId });

export function materializeNativeBusinessStarters(input: {
  companyName: string;
  offer: string;
  targetCustomer: string;
  goals?: string;
  stage?: string;
  businessModel?: string;
  formation?: string;
  founderVision?: string;
  founderValues?: string;
  decisionStyle?: string;
  workingStyle?: string;
  /**
   * The active blueprint's accountable commercial seat.  Different business
   * models use different stable keys (for example, `growth` or
   * `brand_growth`), so native commercial assets must not silently fall back
   * to the CEO just because a template was written for a service studio.
   */
  ownerRoleKey?: string;
  /**
   * The universal control records are intentionally owned by their
   * accountable institutional seats.  The commercial owner remains the
   * compatibility fallback for callers that predate the complete control
   * foundation.
   */
  ownerRoleKeys?: {
    commercial?: string;
    executive?: string;
    finance?: string;
    legal?: string;
    operations?: string;
  };
}) : readonly NativeBusinessStarter[] {
  const companyName = input.companyName.trim() || "This company";
  const offer = input.offer.trim() || "the declared offer";
  const targetCustomer = input.targetCustomer.trim() || "the declared customer";
  const goals = input.goals?.trim() || "the declared near-term outcomes";
  const stage = input.stage?.trim() || "not yet declared";
  const businessModel = input.businessModel?.trim() || "not yet declared";
  const formation = input.formation?.trim() || "not yet declared";
  const founderVision = input.founderVision?.trim() || "not yet captured";
  const founderValues = input.founderValues?.trim() || "not yet captured";
  const decisionStyle = input.decisionStyle?.trim() || "not yet captured";
  const workingStyle = input.workingStyle?.trim() || "not yet captured";
  const commercialOwnerRoleKey = input.ownerRoleKeys?.commercial?.trim() || input.ownerRoleKey?.trim() || "growth";
  const executiveOwnerRoleKey = input.ownerRoleKeys?.executive?.trim() || "company_ceo";
  const financeOwnerRoleKey = input.ownerRoleKeys?.finance?.trim() || "finance_capital";
  const legalOwnerRoleKey = input.ownerRoleKeys?.legal?.trim() || "legal_governance";
  const operationsOwnerRoleKey = input.ownerRoleKeys?.operations?.trim() || "operations_administration";
  return [
    { key: "company-operating-brief", instrumentKey: "docs", objectType: "document", title: `${companyName} operating brief`, summary: "Company-specific operating context compiled from the shared Mission Journey.", ownerRoleKey: executiveOwnerRoleKey, data: { compilerStarter: true, format: "markdown", body: `# ${companyName} operating brief\n\n## Company model\n- Stage: ${stage}\n- Business model: ${businessModel}\n- Operating formation: ${formation}\n- Initial offer: ${offer}\n- First customer or buyer: ${targetCustomer}\n\n## Founder direction\n- Vision: ${founderVision}\n- Values and standards: ${founderValues}\n- Decision style: ${decisionStyle}\n- Working style: ${workingStyle}\n\n## Near-term outcomes\n${goals}\n\n## Operating boundary\nThis is an EOS-controlled planning record compiled from the Company Mission Journey. It is not an external commitment, legal conclusion, financial statement, or provider-side configuration. Update it through normal governed document controls as the company learns.`, sourceAuthority: "company_mission_journey", reviewState: "draft" } },
    { key: "commercial-pipeline", instrumentKey: "crm", objectType: "pipeline", title: `${offer} pipeline`, summary: `Native commercial pipeline for ${targetCustomer}.`, ownerRoleKey: commercialOwnerRoleKey, data: { stages: ["Qualified", "Discovery", "Proposal", "Won", "Lost"], compilerStarter: true } },
    { key: "commercial-intake", instrumentKey: "forms", objectType: "form", title: `${offer} discovery`, summary: `Private native intake draft for ${targetCustomer}.`, ownerRoleKey: commercialOwnerRoleKey, data: { publicCapture: true, compilerStarter: true, questions: [{ id: "name", label: "Full name", type: "short_text", required: true, options: [] }, { id: "email", label: "Work email", type: "email", required: true, options: [] }, { id: "company", label: "Company", type: "short_text", required: false, options: [] }, { id: "goals", label: "What are you looking to accomplish?", type: "long_text", required: false, options: [] }], consentVersion: "native-eos-lead-capture-v1", consentLabel: `I agree that ${companyName} may use my information to respond to my request.`, confirmationMessage: "Thank you. Your request has been received." } },
    { key: "company-site", instrumentKey: "websites", objectType: "site", title: companyName, summary: "EOS-owned native website draft.", ownerRoleKey: commercialOwnerRoleKey, data: { brandName: companyName, compilerStarter: true } },
    {
      key: "commercial-page",
      instrumentKey: "websites",
      objectType: "page",
      title: `${offer} · Start here`,
      summary: `Native public-page draft for ${targetCustomer}.`,
      ownerRoleKey: commercialOwnerRoleKey,
      data: {
        publicPage: true,
        compilerStarter: true,
        siteObjectId: nativeBusinessStarterReference("company-site"),
        headline: `${offer} for ${targetCustomer}`,
        supportingCopy: `Start a focused conversation with ${companyName} about ${offer}.`,
        primaryCtaLabel: "Start a conversation",
        primaryCtaTarget: "capture_form",
        primaryCtaTargetId: nativeBusinessStarterReference("commercial-intake"),
        primaryCtaHref: "",
        path: "/start",
        sections: [
          { id: "outcomes", kind: "outcomes", title: "What changes", body: "A focused next step based on your current context.", items: [] },
          { id: "steps", kind: "steps", title: "How it works", body: "", items: ["Share your context", "Review the recommended next step"] },
        ],
      },
    },
    {
      key: "commercial-funnel",
      instrumentKey: "websites",
      objectType: "funnel",
      title: `${offer} · Discovery funnel`,
      summary: `Native funnel draft that routes ${targetCustomer} into EOS intake.`,
      ownerRoleKey: commercialOwnerRoleKey,
      data: {
        publicFunnel: true,
        compilerStarter: true,
        headline: `${offer} for ${targetCustomer}`,
        supportingCopy: `Tell ${companyName} what you are trying to accomplish and receive the right next step.`,
        primaryCtaLabel: "Start discovery",
        captureFormObjectId: nativeBusinessStarterReference("commercial-intake"),
      },
    },
    { key: "native-offer-catalog", instrumentKey: "commerce", objectType: "offer", title: offer, summary: `Native EOS offer record for ${targetCustomer}; commercial activation remains governed.`, ownerRoleKey: commercialOwnerRoleKey, data: { name: offer, priceMinor: 0, currency: "USD", operatingMode: "native_eos", compilerStarter: true, priceState: "unconfigured" } },
    { key: "finance-control-plan", instrumentKey: "finance", objectType: "plan", title: `${companyName} finance control plan`, summary: "Native finance planning record with explicit source and approval boundaries.", ownerRoleKey: financeOwnerRoleKey, data: { compilerStarter: true, period: "initial_operating_cycle", sourceAuthority: "native_eos", sourceBoundary: "Provider, accounting, bank, payroll, tax, and payment rails remain authoritative until a verified receipt is reconciled.", approvalBoundary: "No money movement, tax or accounting conclusion, capital allocation, or provider action is implied by this plan." } },
    { key: "finance-reconciliation-register", instrumentKey: "finance", objectType: "reconciliation", title: `${companyName} reconciliation register`, summary: "Native queue for finance-source freshness, variance, exception, and resolution evidence.", ownerRoleKey: financeOwnerRoleKey, data: { compilerStarter: true, state: "ready_for_sources", providerReceipts: "not_asserted", manualFallback: "Record and review a source-labeled exception before treating any provider value as reconciled." } },
    { key: "finance-control-workbook", instrumentKey: "sheets", objectType: "workbook", title: `${companyName} finance control workbook`, summary: "Native EOS workbook for the initial cash, commitment, allocation, and variance control cycle.", ownerRoleKey: financeOwnerRoleKey, data: { compilerStarter: true, worksheets: [nativeBusinessStarterReference("finance-control-worksheet")], sourceAuthority: "native_eos", providerBoundary: "A workbook is a planning and reconciliation surface; it is not a bank, accounting, payroll, tax, or payment-system ledger." } },
    { key: "finance-control-worksheet", instrumentKey: "sheets", objectType: "worksheet", title: "Cash, commitments, and variance", summary: "Initial native worksheet for source-labeled finance planning and reconciliation.", ownerRoleKey: financeOwnerRoleKey, data: { compilerStarter: true, workbookObjectId: nativeBusinessStarterReference("finance-control-workbook"), columns: ["Period", "Category", "Source authority", "Planned amount", "Observed amount", "Variance", "Owner", "Evidence status", "Review state"], rows: [], reviewBoundary: "Enter only source-labeled planning or observed values. A value is not settled financial truth without the applicable authoritative source and evidence." } },
    { key: "governance-obligation-register", instrumentKey: "docs", objectType: "document", title: `${companyName} governance and obligation register`, summary: "Controlled native record for policies, obligations, rights, risks, and review dates.", ownerRoleKey: legalOwnerRoleKey, data: { compilerStarter: true, format: "markdown", body: `# Governance and obligation register\n\nUse this controlled record to identify source authority, affected parties, effective dates, obligations, rights, risks, evidence needs, and professional-review boundaries for ${companyName}.\n\nThis document is not legal advice and does not establish compliance, an executed agreement, or any external legal effect.`, reviewState: "draft" } },
    { key: "vendor-service-pipeline", instrumentKey: "crm", objectType: "pipeline", title: `${companyName} vendor and service review`, summary: "Native vendor/service control pipeline. A stage does not establish a contract, payment, access grant, or provider connection.", ownerRoleKey: operationsOwnerRoleKey, data: { compilerStarter: true, stages: ["Proposed need", "Scope and risk review", "Awaiting approval", "Approved service", "Offboarding or replacement"], authorityBoundary: "An authorized human approves any contract, spend, access, data disclosure, account connection, or other irreversible external effect." } },
  ];
}
