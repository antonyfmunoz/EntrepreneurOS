import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  Activity,
  BadgeCheck,
  Blocks,
  Bot,
  BriefcaseBusiness,
  ClipboardCheck,
  Check,
  Command,
  Copy,
  ExternalLink,
  FileCheck2,
  Gauge,
  Home,
  Landmark,
  Link2,
  BookOpen,
  Map,
  MessagesSquare,
  Network,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  Unplug,
  Workflow,
  X,
} from "lucide-react";
import { AgentChatStub, type ChatMessage } from "@/components/agent-chat-stub";
import { NativeEsignFieldEditor } from "@/components/native-esign-field-editor";
import UniversalLayout from "@/components/layout/universal-layout";
import FloatingAIPanel from "@/components/layout/floating-ai-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiBinaryRequest, apiRequest } from "@/lib/queryClient";
import { encodeNativeEsignFieldSchema } from "@/lib/native-esign";
import { useToast } from "@/hooks/use-toast";
import {
  authorityClasses,
  authorityGrantCoversResource,
  eosActiveModules,
  nextCapabilityStates,
  nextCommercialCaseStates,
  nextMetricOutcomeStates,
  nextObjectiveStates,
  nextOfferStates,
  nextProcessQualificationStates,
  nextProcessReleaseStates,
  nextRelationshipStates,
  nextResourceStates,
  nextRiskControlStates,
  nextStakeholderStates,
  nextUsableSurfaceFor,
  nextValueFlowStates,
  nextFinancialSourceStates,
  nextFinancialPlanStates,
  nextCapitalAllocationStates,
  nextSystemLifecycleStates,
  nextEntitlementStates,
  nextAutomationStates,
  nextWorkforceReviewStates,
  nextDevelopmentPlanStates,
  nextRoleSupportPlanStates,
  nextCareerPathStates,
  nextSuccessionStates,
  nextTalentNeedStates,
  nextTalentApplicationStates,
  nextTalentAssessmentStates,
  nextTalentReviewPacketStates,
  nextTalentTrialStates,
  nextTalentPlacementStates,
  rolePracticeActionFor,
  type AuthorityClass,
  type EosActiveModule,
  type EosNextActionReason,
} from "@shared/eos-runtime";
import { organizationRegistryFieldTransformRules } from "@shared/eos-policy";
import { recoveryAgreementIssues } from "@shared/recovery-commercial-activation";
import { closureModuleState, type ArtifactClosureGroupProjection } from "@shared/artifact-closure";
import type { NativeEsignField } from "@shared/native-esign";

const NativeEsignOperatorConsole = lazy(() => import("@/components/native-esign-operator-console").then((module) => ({ default: module.NativeEsignOperatorConsole })));
const ComplianceControlCenter = lazy(() => import("@/components/compliance-control-center").then((module) => ({ default: module.ComplianceControlCenter })));
const CustomerSuccessControlCenter = lazy(() => import("@/components/customer-success-control-center").then((module) => ({ default: module.CustomerSuccessControlCenter })));
const ProductEvolutionControlCenter = lazy(() => import("@/components/product-evolution-control-center").then((module) => ({ default: module.ProductEvolutionControlCenter })));
const IntegrationOperationsControlCenter = lazy(() => import("@/components/integration-operations-control-center").then((module) => ({ default: module.IntegrationOperationsControlCenter })));
const ArtifactClosureControlCenter = lazy(() => import("@/components/artifact-closure-control-center").then((module) => ({ default: module.ArtifactClosureControlCenter })));
const NativeOperatingControlCenter = lazy(() => import("@/components/native-operating-control-center").then((module) => ({ default: module.NativeOperatingControlCenter })));
const CanonicalInstrumentControlCenter = lazy(() => import("@/components/canonical-instrument-control-center").then((module) => ({ default: module.CanonicalInstrumentControlCenter })));
const EndStateGovernanceControlCenter = lazy(() => import("@/components/end-state-governance-control-center").then((module) => ({ default: module.EndStateGovernanceControlCenter })));

function DeferredControlFallback() {
  return <div className="rounded-2xl border bg-muted/40 p-6 text-sm text-muted-foreground">Loading governed control…</div>;
}

type JsonRecord = Record<string, any>;
type CommandTransitionDraft = {
  kind: "objective" | "metric_outcome" | "risk_control";
  id: string;
  state: string;
  title: string;
};
const highConsequenceCommandStates = new Set([
  "failed",
  "superseded",
  "archived",
  "verified",
  "contested",
  "retired",
  "accepted",
  "satisfied_closed",
]);

const governedAuthorityResources = [
  ["work_packet", "Work Packets"],
  ["approval", "Approvals"],
  ["evidence", "Evidence"],
  ["provider_execution", "Provider executions"],
  ["organization_manifest", "Organization manifests"],
  ["objective", "Objectives & constraints"],
  ["metric_outcome", "Metrics & outcomes"],
  ["risk_control", "Risks, obligations & controls"],
  ["organization", "Organization design"],
  ["authority_subject", "Authority subject registry"],
  ["authority_grant", "Authority Grants"],
  ["financial_plan", "Financial plans"],
  ["capital_allocation", "Capital allocations"],
  ["workforce_review", "Workforce reviews"],
  ["development_plan", "Development plans"],
  ["role_support_plan", "Role support plans"],
  ["career_path", "Career paths"],
  ["succession_hypothesis", "Succession hypotheses"],
  ["talent_need", "Talent needs"],
  ["talent_application", "Talent applications"],
  ["talent_assessment", "Talent assessments"],
  ["talent_trial", "Paid trials"],
  ["talent_placement", "Talent placements"],
] as const;

async function requestJson<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
): Promise<T> {
  let requestUrl = url;
  if (typeof window !== "undefined" && url.includes("/api/eos/companies/")) {
    const seatId = new URLSearchParams(window.location.search).get("seat");
    if (seatId) {
      const scoped = new URL(url, window.location.origin);
      scoped.searchParams.set("seatId", seatId);
      requestUrl = `${scoped.pathname}${scoped.search}`;
    }
  }
  const response = (await apiRequest(method, requestUrl, body)) as Response;
  return response.json() as Promise<T>;
}

function StateBadge({ state }: { state: string }) {
  const good = [
    "active",
    "ready",
    "in_progress",
    "completed",
    "connected",
    "approved",
    "healthy",
    "applied",
    "signed",
    "checkout_eligible",
    "artifact_complete",
    "implemented",
    "pre_live_qualified",
    "field_qualified",
    "native_qualified",
  ].includes(state);
  const warning = [
    "draft",
    "awaiting_approval",
    "pending",
    "available",
    "reference_only",
    "degraded",
  ].includes(state);
  return (
    <Badge variant={good ? "default" : warning ? "secondary" : "outline"}>
      {state.replaceAll("_", " ")}
    </Badge>
  );
}

function mutationFailure(action: string, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      if (typeof parsed?.message === "string")
        return `${action} failed: ${parsed.message}`;
    } catch {}
  }
  return `${action} failed. Retry the action or refresh the workspace.`;
}

function RecoveryCall2Control({
  session,
  root,
  onChanged,
  activationBindings,
  evidence,
  providerExecutions,
  canRecordCounselDisposition,
}: {
  session: JsonRecord;
  root: string;
  onChanged: () => Promise<unknown>;
  activationBindings: JsonRecord[];
  evidence: JsonRecord[];
  providerExecutions: JsonRecord[];
  canRecordCounselDisposition: boolean;
}) {
  const { toast } = useToast();
  const packet = session.call2Packet as JsonRecord | null;
  const [draft, setDraft] = useState<JsonRecord>({});
  const [exceptionSummary, setExceptionSummary] = useState("");
  const [decision, setDecision] = useState<JsonRecord>({
    disposition: "closed_won_pending_agreement_payment",
    decisionMaker: "",
    dependencyOrLostReason: "",
    nextAction: "Send the approved agreement and payment path.",
    nextActionAt: "",
    agreementVersion: "",
    paymentPath: "",
    onboardingTrigger: "Agreement signed and payment verified through authorized provider receipts.",
  });
  const [counsel, setCounsel] = useState<JsonRecord>({
    disposition: "approved_with_changes", reviewerName: "", reviewerCredentialReference: "",
    jurisdiction: "", exactLanguageReference: "", unresolvedBusinessChoices: "",
    complianceDependencies: "", effectiveVersion: "", effectiveAt: "", evidenceId: "",
    issueDispositions: recoveryAgreementIssues.map((issue) => ({ issue, state: "resolved", note: "Resolved in the referenced counsel output." })),
  });
  const [agreementConfig, setAgreementConfig] = useState<JsonRecord>({
    clientLegalName: "", clientSignerName: "", clientSignerEmail: "", providerLegalName: "",
    agreementVersion: "", eSignProvider: "eos_native", eSignTemplateReference: "", eSignBindingId: "",
  });
  const [nativeSigningLinks, setNativeSigningLinks] = useState<JsonRecord[]>([]);
  const [nativeDocumentFile, setNativeDocumentFile] = useState<File | null>(null);
  const [nativeDocumentFields, setNativeDocumentFields] = useState<NativeEsignField[]>([]);
  const [billingConfig, setBillingConfig] = useState<JsonRecord>({
    stripeBindingId: "", providerProductReference: "", setupPriceReference: "", recurringPriceReference: "",
    currency: "USD", taxTreatment: "Collect applicable tax using the provider's authoritative tax configuration.",
    statementDescriptor: "EMPYREAN", paymentMethodPolicy: "Use payment methods enabled in the authorized Stripe account.",
    subscriptionStartRule: "Create setup and recurring service in one hosted Checkout; send the agreement only after authoritative payment and subscription receipts.",
    receiptBehavior: "Send provider receipts to the authorized client billing contact.",
    cancellationRefundAuthority: "Apply only the effective agreement and an explicitly authorized finance decision.",
  });
  const [compensation, setCompensation] = useState<JsonRecord>({
    timing: "period_end",
    reason: "requested_by_customer",
    rationale: "",
  });

  useEffect(() => {
    if (!packet) return;
    setDraft({
      version: packet.version,
      buyerDecisionMakers: (packet.buyerDecisionMakers || []).join(", "),
      observedFacts: packet.observedFacts || "",
      measuredSignals: packet.measuredSignals || "",
      unavailableData: packet.unavailableData || "",
      changesSinceCall1: packet.changesSinceCall1 || "",
      recoveryThesis: packet.recoveryThesis || "",
      scopeDiscussion: packet.scopeDiscussion || "",
      measurementAttribution: packet.measurementAttribution || "",
      clientResponsibilities: packet.clientResponsibilities || "",
      objections: packet.objections || "",
      recommendedPackage: packet.recommendedPackage || "standard",
      foundingProofConsideration: packet.foundingProofConsideration || "",
    });
  }, [packet?.id, packet?.version]);

  const activation = packet?.activation as JsonRecord | null;
  const authority = activation?.authority as JsonRecord | null;
  const billing = activation?.billingManifest as JsonRecord | null;
  useEffect(() => {
    if (!activation || !authority || !billing) return;
    setAgreementConfig((current) => ({
      ...current, clientLegalName: activation.clientLegalName || session.companyName || "",
      clientSignerName: activation.clientSignerName || "", clientSignerEmail: activation.clientSignerEmail || session.workEmail || "",
      providerLegalName: activation.providerLegalName || "", agreementVersion: activation.agreementVersion || authority.effectiveVersion || "",
      eSignProvider: activation.eSignProvider || "eos_native",
      eSignTemplateReference: activation.eSignTemplateReference || "", eSignBindingId: activation.eSignBindingId || "",
    }));
    setBillingConfig((current) => ({
      ...current, stripeBindingId: billing.stripeBindingId || "", providerProductReference: billing.providerProductReference || "",
      setupPriceReference: billing.setupPriceReference || "", recurringPriceReference: billing.recurringPriceReference || "",
      taxTreatment: billing.taxTreatment || current.taxTreatment, statementDescriptor: billing.statementDescriptor || current.statementDescriptor,
      paymentMethodPolicy: billing.paymentMethodPolicy || current.paymentMethodPolicy,
      subscriptionStartRule: billing.subscriptionStartRule || current.subscriptionStartRule,
      receiptBehavior: billing.receiptBehavior || current.receiptBehavior,
      cancellationRefundAuthority: billing.cancellationRefundAuthority || current.cancellationRefundAuthority,
    }));
  }, [activation?.id, activation?.version, authority?.version, billing?.version]);

  const fail = (label: string, error: unknown) =>
    toast({ title: mutationFailure(label, error), variant: "destructive" });
  const create = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/recovery-calculator/${session.id}/call-2`, {}),
    onSuccess: async () => { await onChanged(); toast({ title: "Call-2 packet prepared" }); },
    onError: (error) => fail("Call-2 preparation", error),
  });
  const save = useMutation({
    mutationFn: () => requestJson<JsonRecord>("PUT", `${root}/recovery-call-2/${packet?.id}`, {
      ...draft,
      version: packet?.version,
      buyerDecisionMakers: String(draft.buyerDecisionMakers || "").split(",").map((item) => item.trim()).filter(Boolean),
    }),
    onSuccess: async () => { await onChanged(); toast({ title: "Call-2 evidence and terms saved" }); },
    onError: (error) => fail("Call-2 save", error),
  });
  const ready = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/recovery-call-2/${packet?.id}/ready`, { version: packet?.version }),
    onSuccess: async () => { await onChanged(); toast({ title: "Call-2 packet ready", description: "Terms are now locked for this decision." }); },
    onError: (error) => fail("Call-2 readiness", error),
  });
  const requestException = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/recovery-call-2/${packet?.id}/exception`, { version: packet?.version, summary: exceptionSummary }),
    onSuccess: async () => { setExceptionSummary(""); await onChanged(); toast({ title: "Commercial exception sent for approval" }); },
    onError: (error) => fail("Exception request", error),
  });
  const recordDecision = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/recovery-call-2/${packet?.id}/decision`, {
      ...decision,
      version: packet?.version,
      nextActionAt: decision.nextActionAt ? new Date(decision.nextActionAt).toISOString() : undefined,
    }),
    onSuccess: async () => { await onChanged(); toast({ title: "Commercial disposition recorded", description: "No agreement, payment, onboarding, or provider effect was asserted." }); },
    onError: (error) => fail("Call-2 decision", error),
  });
  const prepareActivation = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/recovery-call-2/${packet?.id}/activation`, {}),
    onSuccess: async () => { await onChanged(); toast({ title: "Agreement and billing controls prepared", description: "Counsel, signature, and payment gates remain explicit." }); },
    onError: (error) => fail("Commercial activation preparation", error),
  });
  const recordCounsel = useMutation({
    mutationFn: () => requestJson<JsonRecord>("PUT", `${root}/recovery-call-2/${packet?.id}/activation/counsel`, {
      ...counsel, version: authority?.version,
      effectiveAt: counsel.effectiveAt ? new Date(counsel.effectiveAt).toISOString() : undefined,
    }),
    onSuccess: async () => { await onChanged(); toast({ title: "Counsel disposition recorded", description: "This is an operator-recorded counsel output, not legal advice generated by EOS." }); },
    onError: (error) => fail("Counsel disposition", error),
  });
  const saveAgreement = useMutation({
    mutationFn: () => requestJson<JsonRecord>("PUT", `${root}/recovery-call-2/${packet?.id}/activation/agreement`, { ...agreementConfig, version: activation?.version }),
    onSuccess: async () => { await onChanged(); toast({ title: "Agreement package configured", description: "No signing envelope was issued." }); },
    onError: (error) => fail("Agreement configuration", error),
  });
  const nativeDocuments = useQuery<JsonRecord[]>({
    queryKey: [`${root}/native-esign/documents`],
    enabled: Boolean(activation),
    queryFn: () => requestJson<JsonRecord[]>("GET", `${root}/native-esign/documents`),
  });
  const activeNativeEnvelopeId = String(activation?.nativeEnvelopeId || nativeSigningLinks[0]?.envelopeId || "");
  const nativeEnvelope = useQuery<JsonRecord>({
    queryKey: [`${root}/native-esign/envelopes/${activeNativeEnvelopeId}`],
    enabled: Boolean(activeNativeEnvelopeId),
    queryFn: () => requestJson<JsonRecord>("GET", `${root}/native-esign/envelopes/${activeNativeEnvelopeId}`),
  });
  const uploadNativeDocument = useMutation({
    mutationFn: async () => {
      if (!nativeDocumentFile || !authority?.counselEvidenceId)
        throw new Error("Select the counsel-approved PDF and verified counsel evidence first.");
      if (!nativeDocumentFields.some((field) => field.type === "signature" && field.required && field.roleKey === "client"))
        throw new Error("Place a required client signature field on the PDF before registration.");
      const query = new URLSearchParams({
        documentKey: `recovery-agreement-${activation?.id}`,
        documentVersion: String(agreementConfig.agreementVersion || authority.effectiveVersion || ""),
        title: `${agreementConfig.clientLegalName || session.companyName || "Client"} Recovery agreement`,
        sourceReference: String(authority.exactLanguageReference || authority.counselPacketSource || "verified-counsel-output"),
        counselEvidenceId: String(authority.counselEvidenceId),
      });
      return apiBinaryRequest<JsonRecord>(`${root}/native-esign/documents?${query}`, nativeDocumentFile, {
        "Content-Type": "application/pdf",
        "x-eos-field-schema": encodeNativeEsignFieldSchema(nativeDocumentFields),
      });
    },
    onSuccess: async (document) => {
      setAgreementConfig((value) => ({ ...value, eSignProvider: "eos_native", eSignTemplateReference: document.id, agreementVersion: document.documentVersion }));
      setNativeDocumentFile(null);
      setNativeDocumentFields([]);
      await nativeDocuments.refetch();
      toast({ title: "Counsel-approved PDF registered", description: "The immutable PDF hash and version are now available for the agreement package." });
    },
    onError: (error) => fail("Native document registration", error),
  });
  const issueNativeAgreement = useMutation({
    mutationFn: async () => {
      const envelope = activation?.nativeEnvelopeId
        ? { id: activation.nativeEnvelopeId }
        : await requestJson<JsonRecord>("POST", `${root}/native-esign/envelopes`, {
            documentVersionId: agreementConfig.eSignTemplateReference,
            recoveryAgreementInstanceId: activation?.id,
            subject: `${agreementConfig.agreementVersion} agreement — ${agreementConfig.clientLegalName}`,
            message: "Review the approved agreement, provide electronic consent, and sign if you agree.",
            routingMode: "sequential",
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000).toISOString(),
            recipients: [{ roleKey: "client", routingOrder: 1, signerName: agreementConfig.clientSignerName, signerEmail: agreementConfig.clientSignerEmail }],
          });
      return requestJson<JsonRecord>("POST", `${root}/native-esign/envelopes/${envelope.id}/issue`, {});
    },
    onSuccess: async (result) => {
      setNativeSigningLinks(((result.recipients || []) as JsonRecord[]).map((recipient) => ({ ...recipient, envelopeId: result.id })));
      await onChanged();
      toast({ title: "EOS native agreement issued", description: "Copy the private link or deliver it through the connected Gmail account." });
    },
    onError: (error) => fail("Native agreement issuance", error),
  });
  const deliverNativeAgreement = useMutation({
    mutationFn: ({ envelopeId, recipientId }: { envelopeId: string; recipientId: string }) =>
      requestJson<JsonRecord>("POST", `${root}/native-esign/envelopes/${envelopeId}/recipients/${recipientId}/deliver`, {}),
    onSuccess: async (result) => {
      setNativeSigningLinks((current) => current.map((item) => item.id === result.recipientId ? { ...item, deliveryState: result.state } : item));
      await nativeEnvelope.refetch();
      toast({ title: "Signing email delivered", description: "EOS reconciled the Gmail provider receipt to this recipient." });
    },
    onError: (error) => { void nativeEnvelope.refetch(); fail("Native signing email", error); },
  });
  const recoverNativeEnvelope = useMutation({
    mutationFn: (envelopeId: string) => requestJson<JsonRecord>("POST", `${root}/native-esign/envelopes/${envelopeId}/recover`, {}),
    onSuccess: async () => { await Promise.all([nativeEnvelope.refetch(), onChanged()]); toast({ title: "Envelope seal recovered", description: "The completed PDF and audit artifact were rebuilt and hash-reconciled." }); },
    onError: (error) => fail("Native envelope recovery", error),
  });
  const saveBilling = useMutation({
    mutationFn: () => requestJson<JsonRecord>("PUT", `${root}/recovery-call-2/${packet?.id}/activation/billing`, { ...billingConfig, version: billing?.version }),
    onSuccess: async () => { await onChanged(); toast({ title: "Billing manifest configured", description: "Server-owned terms were preserved; no Stripe action occurred." }); },
    onError: (error) => fail("Billing configuration", error),
  });
  const evaluateActivation = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/recovery-call-2/${packet?.id}/activation/evaluate`, {}),
    onSuccess: async () => { await onChanged(); toast({ title: "Commercial gates evaluated", description: "Provider and evidence blockers were refreshed without external effects." }); },
    onError: (error) => fail("Commercial gate evaluation", error),
  });
  const requestProviderEffect = useMutation({
    mutationFn: (body: JsonRecord) => requestJson<JsonRecord>(
      "POST",
      `${root}/work-packets/${activation?.workPacketId || billing?.workPacketId}/provider-executions`,
      body,
    ),
    onSuccess: async () => {
      await onChanged();
      toast({ title: "Provider effect sent for approval", description: "Nothing executes until the assigned approval is granted and authority is revalidated." });
    },
    onError: (error) => fail("Provider effect request", error),
  });
  const retryProviderEffect = useMutation({
    mutationFn: (executionId: string) => requestJson<JsonRecord>("POST", `${root}/provider-executions/${executionId}/retry`, {}),
    onSuccess: async () => {
      await onChanged();
      toast({ title: "Approved provider effect retried", description: "The original provider idempotency key was preserved." });
    },
    onError: (error) => fail("Provider effect retry", error),
  });

  if (!packet) {
    const qualified = session.fit === "high_fit" && session.route === "recovery_diagnostic" && Boolean(session.contactCapturedAt);
    return qualified ? (
      <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
        <FileCheck2 className="mr-2 h-4 w-4" />Prepare Call 2
      </Button>
    ) : (
      <p className="text-xs text-muted-foreground">Call 2 unlocks after a consented high-fit diagnostic.</p>
    );
  }

  const terms = packet.termsPresented || {};
  const docusignBindings = activationBindings.filter((item) => item.providerKey === "docusign");
  const nativeDocumentVersions = nativeDocuments.data || [];
  const stripeBindings = activationBindings.filter((item) => item.providerKey === "stripe");
  const counselEvidence = authority ? evidence.filter((item) => item.workPacketId === authority.workPacketId && item.verificationState === "verified") : [];
  const agreementReceipts = (activation?.providerReceipts || []) as JsonRecord[];
  const billingReceipts = (billing?.providerReceipts || []) as JsonRecord[];
  const providerReceipts = [...agreementReceipts, ...billingReceipts].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  const activationExecutions = providerExecutions.filter((execution) => {
    const request = execution.request || {};
    return request.agreementInstanceId === activation?.id || request.billingManifestId === billing?.id;
  });
  const copyWebhookPath = async (provider: "docusign" | "stripe", bindingId: string) => {
    const path = `/api/eos/recovery-provider-webhooks/${provider}/${bindingId}`;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast({ title: `${provider === "docusign" ? "DocuSign" : "Stripe"} receipt URL copied` });
    } catch (error) { fail("Webhook URL copy", error); }
  };
  const update = (field: string, value: unknown) => setDraft((current) => ({ ...current, [field]: value }));
  const updateDecision = (field: string, value: unknown) => setDecision((current) => ({ ...current, [field]: value }));
  return (
    <details className="rounded-xl border border-primary/20 bg-primary/5 p-4" open={packet.state === "ready"}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-semibold">Call-2 close packet</p><p className="mt-1 text-xs text-muted-foreground">Explicit terms, exception control, decision, and operative handoff.</p></div>
          <StateBadge state={packet.state} />
        </div>
      </summary>
      <div className="mt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-background p-3"><p className="eos-label">Package</p><p className="mt-2 text-sm font-semibold">{terms.label}</p></div>
          <div className="rounded-lg bg-background p-3"><p className="eos-label">Setup</p><p className="mt-2 text-sm font-semibold">${Number(terms.setupAmount || 0).toLocaleString()}</p></div>
          <div className="rounded-lg bg-background p-3"><p className="eos-label">Monthly</p><p className="mt-2 text-sm font-semibold">${Number(terms.monthlyAmount || 0).toLocaleString()}</p></div>
          <div className="rounded-lg bg-background p-3"><p className="eos-label">Authority</p><p className="mt-2 text-sm font-semibold">Current v1 terms</p></div>
        </div>
        <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Model is not realized value</AlertTitle><AlertDescription>{terms.guaranteeBoundary || "The calculator is a hypothesis; source records and outcomes still require verification."}</AlertDescription></Alert>

        {packet.state === "draft" && <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">Buyer / decision makers<Input value={draft.buyerDecisionMakers || ""} onChange={(event) => update("buyerDecisionMakers", event.target.value)} placeholder="Names or roles, comma separated" /></label>
            <label className="space-y-2 text-sm font-medium">Authorized package<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={draft.recommendedPackage || "standard"} onChange={(event) => update("recommendedPackage", event.target.value)}><option value="standard">Standard — $5,000 + $2,500/month</option><option value="founding_proof_cohort">Founding proof — $3,000 + $1,500/month</option></select></label>
          </div>
          {draft.recommendedPackage === "founding_proof_cohort" && <label className="space-y-2 text-sm font-medium">Named proof consideration<Textarea value={draft.foundingProofConsideration || ""} onChange={(event) => update("foundingProofConsideration", event.target.value)} placeholder="Exactly what proof participation is being considered" /></label>}
          <div className="grid gap-3 lg:grid-cols-2">
            {[
              ["observedFacts", "Observed facts"], ["measuredSignals", "Measured / modeled signals"],
              ["unavailableData", "Unavailable data"], ["changesSinceCall1", "Changes since Call 1"],
              ["recoveryThesis", "Recovery thesis"], ["scopeDiscussion", "Scope and exclusions"],
              ["measurementAttribution", "Measurement and attribution"], ["clientResponsibilities", "Client responsibilities"],
              ["objections", "Objections and dependencies"],
            ].map(([field, label]) => <label key={field} className="space-y-2 text-sm font-medium">{label}<Textarea value={draft[field] || ""} onChange={(event) => update(field, event.target.value)} /></label>)}
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>Save packet</Button><Button onClick={() => ready.mutate()} disabled={ready.isPending}>Lock terms and mark ready</Button></div>
        </div>}

        {packet.state === "ready" && <div className="space-y-5">
          <section className="rounded-lg bg-background p-4"><h4 className="font-semibold">Commercial exception</h4>{packet.exceptionApprovalId ? <div className="mt-3 flex items-center gap-2"><StateBadge state={packet.exceptionApprovalStatus || "pending"}/><p className="text-sm text-muted-foreground">{packet.exceptionSummary}</p></div> : <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={exceptionSummary} onChange={(event) => setExceptionSummary(event.target.value)} placeholder="Named discount, scope, or guarantee exception"/><Button variant="outline" onClick={() => requestException.mutate()} disabled={requestException.isPending || exceptionSummary.trim().length < 8}>Request approval</Button></div>}</section>
          <section className="space-y-3 rounded-lg bg-background p-4"><h4 className="font-semibold">Record the decision</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">Disposition<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={decision.disposition} onChange={(event) => updateDecision("disposition", event.target.value)}><option value="closed_won_pending_agreement_payment">Closed won — pending agreement/payment</option><option value="conditional_named_dependency">Conditional — named dependency</option><option value="nurture_not_now">Nurture / not now</option><option value="closed_lost_reason">Closed lost — reason</option></select></label>
              <label className="space-y-2 text-sm font-medium">Decision maker<Input value={decision.decisionMaker} onChange={(event) => updateDecision("decisionMaker", event.target.value)}/></label>
              <label className="space-y-2 text-sm font-medium">Next action<Input value={decision.nextAction} onChange={(event) => updateDecision("nextAction", event.target.value)}/></label>
              <label className="space-y-2 text-sm font-medium">Next-action date<Input type="datetime-local" value={decision.nextActionAt} onChange={(event) => updateDecision("nextActionAt", event.target.value)}/></label>
              {decision.disposition !== "closed_won_pending_agreement_payment" && <label className="space-y-2 text-sm font-medium lg:col-span-2">Named dependency / decision reason<Textarea value={decision.dependencyOrLostReason} onChange={(event) => updateDecision("dependencyOrLostReason", event.target.value)}/></label>}
              {decision.disposition === "closed_won_pending_agreement_payment" && <><label className="space-y-2 text-sm font-medium">Agreement version to send<Input value={decision.agreementVersion} onChange={(event) => updateDecision("agreementVersion", event.target.value)} placeholder="Version/reference, not a signature claim"/></label><label className="space-y-2 text-sm font-medium">Payment path<Input value={decision.paymentPath} onChange={(event) => updateDecision("paymentPath", event.target.value)} placeholder="Authorized path to initiate, not paid status"/></label><label className="space-y-2 text-sm font-medium lg:col-span-2">Onboarding trigger<Textarea value={decision.onboardingTrigger} onChange={(event) => updateDecision("onboardingTrigger", event.target.value)}/></label></>}
            </div>
            <Button onClick={() => recordDecision.mutate()} disabled={recordDecision.isPending}>Record canonical disposition</Button>
          </section>
        </div>}

        {["handoff_ready", "closed"].includes(packet.state) && <Alert><FileCheck2 className="h-4 w-4"/><AlertTitle>{String(packet.disposition || "Decision recorded").replaceAll("_", " ")}</AlertTitle><AlertDescription>Decision maker: {packet.decisionMaker}. Next: {packet.nextAction}. Agreement, payment, onboarding, and provider effects remain unverified until separate receipts exist.</AlertDescription></Alert>}

        {packet.state === "handoff_ready" && !activation && <section className="rounded-lg border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">Agreement and billing controls</h4><p className="mt-1 text-sm text-muted-foreground">Create the governed client package, counsel gate, and fixed-price billing manifest.</p></div><Button size="sm" onClick={() => prepareActivation.mutate()} disabled={prepareActivation.isPending}>Prepare controls</Button></div>
        </section>}

        {activation && authority && billing && <details className="rounded-xl border bg-background p-4" open>
          <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Commercial activation</p><p className="mt-1 text-xs text-muted-foreground">Counsel authority → Checkout → verified payment → agreement → verified signature → onboarding.</p></div><div className="flex flex-wrap gap-2"><StateBadge state={authority.state}/><StateBadge state={activation.state}/><StateBadge state={billing.state}/></div></div></summary>
          <div className="mt-5 space-y-5">
            <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Fail-closed commercial boundary</AlertTitle><AlertDescription>Sequence: approved Checkout, verified payment and subscription, authorized agreement issuance, verified native or provider signature evidence, then onboarding. EOS native signing is the default; DocuSign remains optional.</AlertDescription></Alert>

            <section className="space-y-3 rounded-lg bg-muted/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">1. Counsel-reviewed authority</h4><p className="mt-1 text-sm text-muted-foreground">Current gate: {String(authority.state).replaceAll("_", " ")}. All 15 issues require an attributable disposition.</p></div><StateBadge state={authority.state}/></div>
              {canRecordCounselDisposition ? <details className="rounded-lg border bg-background p-3"><summary className="cursor-pointer font-medium">Record qualified counsel output</summary><div className="mt-4 space-y-4">
                {!counselEvidence.length && <Alert variant="destructive"><TriangleAlert className="h-4 w-4"/><AlertTitle>Verified counsel evidence required</AlertTitle><AlertDescription>Create and verify Evidence on Work Packet {authority.workPacketId} before recording approval.</AlertDescription></Alert>}
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">Disposition<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={counsel.disposition || "approved_with_changes"} onChange={(event) => setCounsel((value) => ({ ...value, disposition: event.target.value }))}><option value="approved">Approved</option><option value="approved_with_changes">Approved with changes</option><option value="rejected">Rejected</option></select></label>
                  <label className="space-y-2 text-sm font-medium">Verified counsel evidence<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={counsel.evidenceId || ""} onChange={(event) => setCounsel((value) => ({ ...value, evidenceId: event.target.value }))}><option value="">Select Evidence</option>{counselEvidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                  <label className="space-y-2 text-sm font-medium">Reviewer name<Input value={counsel.reviewerName || ""} onChange={(event) => setCounsel((value) => ({ ...value, reviewerName: event.target.value }))}/></label>
                  <label className="space-y-2 text-sm font-medium">Reviewer credential reference<Input value={counsel.reviewerCredentialReference || ""} onChange={(event) => setCounsel((value) => ({ ...value, reviewerCredentialReference: event.target.value }))} placeholder="Reference only; never paste credentials"/></label>
                  <label className="space-y-2 text-sm font-medium">Jurisdiction<Input value={counsel.jurisdiction || ""} onChange={(event) => setCounsel((value) => ({ ...value, jurisdiction: event.target.value }))}/></label>
                  <label className="space-y-2 text-sm font-medium">Effective agreement version<Input value={counsel.effectiveVersion || ""} onChange={(event) => setCounsel((value) => ({ ...value, effectiveVersion: event.target.value }))}/></label>
                  <label className="space-y-2 text-sm font-medium">Effective date<Input type="datetime-local" value={counsel.effectiveAt || ""} onChange={(event) => setCounsel((value) => ({ ...value, effectiveAt: event.target.value }))}/></label>
                  <label className="space-y-2 text-sm font-medium">Exact revised-language reference<Input value={counsel.exactLanguageReference || ""} onChange={(event) => setCounsel((value) => ({ ...value, exactLanguageReference: event.target.value }))} placeholder="Document/version reference"/></label>
                  <label className="space-y-2 text-sm font-medium lg:col-span-2">Compliance dependencies<Textarea value={counsel.complianceDependencies || ""} onChange={(event) => setCounsel((value) => ({ ...value, complianceDependencies: event.target.value }))}/></label>
                  <label className="space-y-2 text-sm font-medium lg:col-span-2">Unresolved business choices<Textarea value={counsel.unresolvedBusinessChoices || ""} onChange={(event) => setCounsel((value) => ({ ...value, unresolvedBusinessChoices: event.target.value }))}/></label>
                </div>
                <div className="space-y-3"><p className="text-sm font-semibold">Required issue dispositions</p>{(counsel.issueDispositions as JsonRecord[]).map((item, index) => <div key={String(item.issue)} className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1fr_180px_1fr]"><p className="text-sm font-medium">{String(item.issue)}</p><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={item.state || "resolved"} onChange={(event) => setCounsel((value) => ({ ...value, issueDispositions: (value.issueDispositions as JsonRecord[]).map((entry, position) => position === index ? { ...entry, state: event.target.value } : entry) }))}><option value="resolved">Resolved</option><option value="accepted_dependency">Accepted dependency</option><option value="unresolved">Unresolved</option></select><Input value={item.note || ""} onChange={(event) => setCounsel((value) => ({ ...value, issueDispositions: (value.issueDispositions as JsonRecord[]).map((entry, position) => position === index ? { ...entry, note: event.target.value } : entry) }))}/></div>)}</div>
                <Button onClick={() => recordCounsel.mutate()} disabled={recordCounsel.isPending || !counsel.evidenceId}>Record counsel disposition</Button>
              </div></details> : <p className="text-sm text-muted-foreground">Founder authority is required to record counsel's disposition.</p>}
            </section>

            <section className="space-y-4 rounded-lg bg-muted/40 p-4"><div><h4 className="font-semibold">2. Client agreement package</h4><p className="mt-1 text-sm text-muted-foreground">Configure exact legal identity and choose EOS native signing or an optional provider; issuance remains blocked until payment and subscription receipts are authoritative.</p></div>
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">Client legal name<Input value={agreementConfig.clientLegalName || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, clientLegalName: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Provider legal name<Input value={agreementConfig.providerLegalName || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, providerLegalName: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Authorized signer<Input value={agreementConfig.clientSignerName || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, clientSignerName: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Signer email<Input type="email" value={agreementConfig.clientSignerEmail || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, clientSignerEmail: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Effective agreement version<Input value={agreementConfig.agreementVersion || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, agreementVersion: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Signing engine<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={agreementConfig.eSignProvider || "eos_native"} onChange={(event) => setAgreementConfig((value) => ({ ...value, eSignProvider: event.target.value, eSignTemplateReference: "", eSignBindingId: "" }))}><option value="eos_native">EOS native — no per-envelope fee</option><option value="docusign">DocuSign adapter</option></select></label>
                {agreementConfig.eSignProvider === "eos_native" ? <><label className="space-y-2 text-sm font-medium lg:col-span-2">Counsel-linked EOS document version<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={agreementConfig.eSignTemplateReference || ""} onChange={(event) => { const document = nativeDocumentVersions.find((item) => item.id === event.target.value); setAgreementConfig((value) => ({ ...value, eSignTemplateReference: event.target.value, agreementVersion: document?.documentVersion || value.agreementVersion })); }}><option value="">Select immutable PDF version</option>{nativeDocumentVersions.map((item) => <option key={item.id} value={item.id}>{item.title} — {Number(item.pageCount || 1)} page{Number(item.pageCount || 1) === 1 ? "" : "s"} — {item.documentVersion} — {String(item.sourceSha256).slice(0, 10)}…</option>)}</select></label><div className="space-y-3 rounded-lg border bg-background p-3 lg:col-span-2"><div><p className="text-sm font-medium">Register a new counsel-approved PDF</p><p className="text-xs text-muted-foreground">Uses the recorded effective version, exact-language reference, and verified counsel Evidence. Place signer fields before the source PDF becomes immutable.</p></div><Input type="file" accept="application/pdf,.pdf" onChange={(event) => { setNativeDocumentFile(event.target.files?.[0] || null); setNativeDocumentFields([]); }}/><NativeEsignFieldEditor file={nativeDocumentFile} fields={nativeDocumentFields} onFieldsChange={setNativeDocumentFields} roleOptions={[{ value: "client", label: "Client signer" }]}/><div className="flex justify-end"><Button type="button" variant="outline" onClick={() => uploadNativeDocument.mutate()} disabled={uploadNativeDocument.isPending || !nativeDocumentFile || !authority.counselEvidenceId || !nativeDocumentFields.some((field) => field.type === "signature" && field.required && field.roleKey === "client")}>{uploadNativeDocument.isPending ? "Registering…" : "Register immutable PDF"}</Button></div></div></> : <><label className="space-y-2 text-sm font-medium">DocuSign template reference<Input value={agreementConfig.eSignTemplateReference || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, eSignTemplateReference: event.target.value }))}/></label><label className="space-y-2 text-sm font-medium">DocuSign Integration Binding<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={agreementConfig.eSignBindingId || ""} onChange={(event) => setAgreementConfig((value) => ({ ...value, eSignBindingId: event.target.value }))}><option value="">Select binding</option>{docusignBindings.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.connectionState}/{item.healthState}/{item.parityState}</option>)}</select></label></>}
              </div>
              {(activation.blockers || []).length > 0 && <ul className="space-y-1 text-sm text-destructive">{activation.blockers.map((item: string) => <li key={item}>• {item}</li>)}</ul>}
              <Button variant="outline" onClick={() => saveAgreement.mutate()} disabled={saveAgreement.isPending}>Save agreement configuration</Button>
            </section>

            <section className="space-y-4 rounded-lg bg-muted/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">3. Fixed-price billing manifest</h4><p className="mt-1 text-sm text-muted-foreground">Provider references are configurable; commercial amounts are server-owned.</p></div><div className="text-right text-sm font-semibold"><p>${(Number(billing.setupAmountMinor || 0) / 100).toLocaleString()} setup</p><p>${(Number(billing.recurringAmountMinor || 0) / 100).toLocaleString()}/month</p></div></div>
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="space-y-2 text-sm font-medium lg:col-span-2">Stripe Integration Binding<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={billingConfig.stripeBindingId || ""} onChange={(event) => setBillingConfig((value) => ({ ...value, stripeBindingId: event.target.value }))}><option value="">Select binding</option>{stripeBindings.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.connectionState}/{item.healthState}/{item.parityState}</option>)}</select></label>
                <label className="space-y-2 text-sm font-medium">Product reference<Input value={billingConfig.providerProductReference || ""} onChange={(event) => setBillingConfig((value) => ({ ...value, providerProductReference: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Setup price reference<Input value={billingConfig.setupPriceReference || ""} onChange={(event) => setBillingConfig((value) => ({ ...value, setupPriceReference: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Recurring price reference<Input value={billingConfig.recurringPriceReference || ""} onChange={(event) => setBillingConfig((value) => ({ ...value, recurringPriceReference: event.target.value }))}/></label>
                <label className="space-y-2 text-sm font-medium">Statement descriptor<Input value={billingConfig.statementDescriptor || ""} maxLength={22} onChange={(event) => setBillingConfig((value) => ({ ...value, statementDescriptor: event.target.value }))}/></label>
                {[['taxTreatment','Tax treatment'],['paymentMethodPolicy','Payment-method policy'],['subscriptionStartRule','Subscription start rule'],['receiptBehavior','Receipt behavior'],['cancellationRefundAuthority','Cancellation / refund authority']].map(([field,label]) => <label key={field} className="space-y-2 text-sm font-medium">{label}<Textarea value={billingConfig[field] || ""} onChange={(event) => setBillingConfig((value) => ({ ...value, [field]: event.target.value }))}/></label>)}
              </div>
              {(billing.blockers || []).length > 0 && <ul className="space-y-1 text-sm text-destructive">{billing.blockers.map((item: string) => <li key={item}>• {item}</li>)}</ul>}
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => saveBilling.mutate()} disabled={saveBilling.isPending}>Save billing configuration</Button><Button onClick={() => evaluateActivation.mutate()} disabled={evaluateActivation.isPending}>Evaluate all gates</Button></div>
            </section>

            <section className="space-y-4 rounded-lg bg-muted/40 p-4">
              <div><h4 className="font-semibold">4. Approval-gated provider actions</h4><p className="mt-1 text-sm text-muted-foreground">Every effect creates a named approval. EOS revalidates authority, tenant, target version, binding, and lifecycle again after approval.</p></div>
              <div className="flex flex-wrap gap-2">
                {billing.state === "checkout_eligible" && <Button onClick={() => requestProviderEffect.mutate({ provider: "stripe", operation: "stripe.create_recovery_checkout_with_local_approval", billingManifestId: billing.id })} disabled={requestProviderEffect.isPending}>Request Checkout issuance</Button>}
                {activation.state === "eligible_to_issue" && activation.eSignProvider === "eos_native" && canRecordCounselDisposition && <Button onClick={() => issueNativeAgreement.mutate()} disabled={issueNativeAgreement.isPending}>Issue EOS native agreement</Button>}
                {activation.state === "eligible_to_issue" && activation.eSignProvider === "docusign" && <Button onClick={() => requestProviderEffect.mutate({ provider: "docusign", operation: "docusign.send_recovery_agreement_with_local_approval", agreementInstanceId: activation.id })} disabled={requestProviderEffect.isPending}>Request DocuSign issuance</Button>}
                {activation.state === "issued" && activation.eSignProvider === "docusign" && <Button variant="destructive" onClick={() => requestProviderEffect.mutate({ provider: "docusign", operation: "docusign.void_recovery_agreement_with_local_approval", agreementInstanceId: activation.id, rationale: compensation.rationale })} disabled={requestProviderEffect.isPending || String(compensation.rationale || "").trim().length < 8}>Request envelope void</Button>}
              </div>
              {nativeSigningLinks.length > 0 && <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="text-sm font-semibold">Private signer link</p>{nativeSigningLinks.map((link) => <div key={link.id} className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 truncate text-xs">{link.signingUrl}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(String(link.signingUrl))}>Copy</Button><Button size="sm" onClick={() => deliverNativeAgreement.mutate({ envelopeId: String(link.envelopeId), recipientId: String(link.id) })} disabled={deliverNativeAgreement.isPending || link.deliveryState === "delivered"}>{link.deliveryState === "delivered" ? "Delivered" : "Email with Gmail"}</Button></div>)}<p className="text-xs text-muted-foreground">The raw link is shown only at issuance and is never stored in EOS. Gmail delivery rotates it, sends the new private link, and records the provider receipt.</p></div>}
              {nativeEnvelope.data && <div className="space-y-2 rounded-lg border bg-background p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Native envelope</p><StateBadge state={String(nativeEnvelope.data.envelope?.state || "unknown")}/></div>{((nativeEnvelope.data.recipients || []) as JsonRecord[]).map((recipient) => <div key={recipient.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-2"><div><p className="text-sm font-medium">{recipient.signerName}</p><p className="text-xs text-muted-foreground">{recipient.signerEmail} · {String(recipient.deliveryState || "manual_ready").replaceAll("_", " ")}{recipient.lastDeliveredAt ? ` · ${new Date(recipient.lastDeliveredAt).toLocaleString()}` : ""}</p></div>{["sent", "opened", "consented"].includes(String(recipient.state)) && <Button size="sm" variant="outline" onClick={() => deliverNativeAgreement.mutate({ envelopeId: activeNativeEnvelopeId, recipientId: String(recipient.id) })} disabled={deliverNativeAgreement.isPending}>{["failed", "uncertain"].includes(String(recipient.deliveryState)) ? "Rotate and retry Gmail" : Number(recipient.deliveryAttemptCount || 0) > 0 ? "Send reminder" : "Email with Gmail"}</Button>}</div>)}{nativeEnvelope.data.envelope?.state === "recovery_required" && <Button size="sm" variant="destructive" onClick={() => recoverNativeEnvelope.mutate(activeNativeEnvelopeId)} disabled={recoverNativeEnvelope.isPending}>Recover completed seal</Button>}</div>}
              {(billing.providerSubscriptionReference || billing.setupPaymentState === "succeeded") && <div className="grid gap-3 rounded-lg border bg-background p-3 lg:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">Cancellation timing<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={compensation.timing} onChange={(event) => setCompensation((value) => ({ ...value, timing: event.target.value }))}><option value="period_end">At period end</option><option value="immediate">Immediately</option></select></label>
                <label className="space-y-2 text-sm font-medium">Refund reason<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={compensation.reason} onChange={(event) => setCompensation((value) => ({ ...value, reason: event.target.value }))}><option value="requested_by_customer">Requested by customer</option><option value="duplicate">Duplicate</option><option value="fraudulent">Fraudulent</option></select></label>
                <label className="space-y-2 text-sm font-medium lg:col-span-2">Required rationale<Textarea value={compensation.rationale || ""} onChange={(event) => setCompensation((value) => ({ ...value, rationale: event.target.value }))} placeholder="State the governing agreement, decision, and operational reason." /></label>
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  {billing.providerSubscriptionReference && !["cancelled", "refunded"].includes(billing.state) && <Button variant="outline" onClick={() => requestProviderEffect.mutate({ provider: "stripe", operation: "stripe.cancel_recovery_subscription_with_local_approval", billingManifestId: billing.id, timing: compensation.timing, rationale: compensation.rationale })} disabled={requestProviderEffect.isPending || String(compensation.rationale || "").trim().length < 8}>Request subscription cancellation</Button>}
                  {billing.setupPaymentState === "succeeded" && <Button variant="destructive" onClick={() => requestProviderEffect.mutate({ provider: "stripe", operation: "stripe.refund_recovery_setup_with_local_approval", billingManifestId: billing.id, reason: compensation.reason, rationale: compensation.rationale })} disabled={requestProviderEffect.isPending || String(compensation.rationale || "").trim().length < 8}>Request full setup refund</Button>}
                </div>
              </div>}
              <div className="space-y-2">
                {activationExecutions.map((execution) => <div key={execution.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"><div><p className="text-sm font-medium">{String(execution.operation).replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{String(execution.reconciliationStatus).replaceAll("_", " ")} · {new Date(execution.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><StateBadge state={String(execution.status)}/>{execution.status === "failed" && <Button size="sm" variant="outline" onClick={() => retryProviderEffect.mutate(execution.id)} disabled={retryProviderEffect.isPending}>Retry safely</Button>}</div></div>)}
                {!activationExecutions.length && <p className="text-sm text-muted-foreground">No provider effect has been requested for this activation.</p>}
              </div>
            </section>

            <section className="space-y-4 rounded-lg bg-muted/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">5. Authoritative execution evidence</h4><p className="mt-1 text-sm text-muted-foreground">EOS-native hash-chained signing evidence and signature-verified provider events reconcile into the same governed state. Contradictions stop in recovery.</p></div><BadgeCheck className="h-5 w-5 text-primary"/></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-background p-3"><p className="eos-label">Agreement</p><div className="mt-2"><StateBadge state={String(activation.state)}/></div></div>
                <div className="rounded-lg bg-background p-3"><p className="eos-label">Setup payment</p><div className="mt-2"><StateBadge state={String(billing.setupPaymentState || "pending")}/></div></div>
                <div className="rounded-lg bg-background p-3"><p className="eos-label">Subscription</p><div className="mt-2"><StateBadge state={String(billing.subscriptionState || "pending")}/></div></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Provider destinations</p>
                {activation.eSignBindingId ? <div className="flex items-center gap-2 rounded-lg border bg-background p-2"><code className="min-w-0 flex-1 truncate text-xs">/api/eos/recovery-provider-webhooks/docusign/{activation.eSignBindingId}</code><Button size="icon" variant="ghost" aria-label="Copy DocuSign receipt URL" onClick={() => copyWebhookPath("docusign", activation.eSignBindingId)}><Copy className="h-4 w-4"/></Button></div> : null}
                {billing.stripeBindingId ? <div className="flex items-center gap-2 rounded-lg border bg-background p-2"><code className="min-w-0 flex-1 truncate text-xs">/api/eos/recovery-provider-webhooks/stripe/{billing.stripeBindingId}</code><Button size="icon" variant="ghost" aria-label="Copy Stripe receipt URL" onClick={() => copyWebhookPath("stripe", billing.stripeBindingId)}><Copy className="h-4 w-4"/></Button></div> : null}
                <p className="text-xs text-muted-foreground">Provider webhooks are required only for external adapters. Native envelopes keep document hashes, recipient state, and the append-only audit chain inside EOS.</p>
              </div>
              {!providerReceipts.length ? <Alert><Activity className="h-4 w-4"/><AlertTitle>{activation.eSignProvider === "eos_native" ? "Native signing state" : "Awaiting provider evidence"}</AlertTitle><AlertDescription>{activation.eSignProvider === "eos_native" ? `The EOS envelope is ${String(activation.state).replaceAll("_", " ")}. Completion requires every named recipient, final PDF generation, and the chained audit artifact.` : "No signed provider receipt has been reconciled for this activation."}</AlertDescription></Alert> : <div className="space-y-2">
                {providerReceipts.map((receipt) => <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{receipt.providerKey === "docusign" ? "DocuSign" : "Stripe"} · {String(receipt.eventType).replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(receipt.occurredAt).toLocaleString()} · signature verified · {receipt.providerObjectReference || "object reference unavailable"}</p>{receipt.failureSummary ? <p className="mt-1 text-xs text-destructive">{receipt.failureSummary}</p> : null}</div><StateBadge state={String(receipt.processingState)}/></div>)}
              </div>}
            </section>
          </div>
        </details>}
      </div>
    </details>
  );
}

export default function EosOverlayPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const root = `/api/eos/companies/${companyId}`;
  const [activeTab, setActiveTab] = useState("home");
  const [packetTitle, setPacketTitle] = useState("");
  const [packetObjective, setPacketObjective] = useState("");
  const [packetApproval, setPacketApproval] = useState(true);
  const [packetEvidenceRequirements, setPacketEvidenceRequirements] = useState<
    string[]
  >(["A reviewable artifact or observed outcome"]);
  const [packetCapabilityId, setPacketCapabilityId] = useState("");
  const [packetProcessId, setPacketProcessId] = useState("");
  const [packetResourceIds, setPacketResourceIds] = useState<string[]>([]);
  const [packetExpectedOutput, setPacketExpectedOutput] = useState("");
  const [packetAcceptanceCriteria, setPacketAcceptanceCriteria] = useState("");
  const [capabilityName, setCapabilityName] = useState("");
  const [capabilityKey, setCapabilityKey] = useState("");
  const [capabilityTrigger, setCapabilityTrigger] = useState("");
  const [capabilityModuleId, setCapabilityModuleId] = useState("");
  const [processCapabilityId, setProcessCapabilityId] = useState("");
  const [processName, setProcessName] = useState("");
  const [processPurpose, setProcessPurpose] = useState("");
  const [processOutcome, setProcessOutcome] = useState("");
  const [processTrigger, setProcessTrigger] = useState("");
  const [processStep, setProcessStep] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceType, setResourceType] = useState("system_tool");
  const [resourceRights, setResourceRights] = useState("");
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveStatement, setObjectiveStatement] = useState("");
  const [objectiveType, setObjectiveType] = useState("objective");
  const [metricTitle, setMetricTitle] = useState("");
  const [metricType, setMetricType] = useState("target");
  const [metricTarget, setMetricTarget] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [riskDescription, setRiskDescription] = useState("");
  const [riskType, setRiskType] = useState("risk");
  const [stakeholderName, setStakeholderName] = useState("");
  const [stakeholderType, setStakeholderType] = useState("person");
  const [stakeholderIdentity, setStakeholderIdentity] = useState("");
  const [relationshipPartyId, setRelationshipPartyId] = useState("");
  const [relationshipType, setRelationshipType] = useState("prospect");
  const [relationshipTitle, setRelationshipTitle] = useState("");
  const [relationshipNeed, setRelationshipNeed] = useState("");
  const [offerName, setOfferName] = useState("");
  const [offerType, setOfferType] = useState("service");
  const [offerProblem, setOfferProblem] = useState("");
  const [offerPromise, setOfferPromise] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [casePartyId, setCasePartyId] = useState("");
  const [caseOfferId, setCaseOfferId] = useState("");
  const [caseValue, setCaseValue] = useState("");
  const [caseProbability, setCaseProbability] = useState("");
  const [caseNextAction, setCaseNextAction] = useState("");
  const [flowTitle, setFlowTitle] = useState("");
  const [flowType, setFlowType] = useState("commitment");
  const [flowFromPartyId, setFlowFromPartyId] = useState("");
  const [flowToPartyId, setFlowToPartyId] = useState("");
  const [flowOfferId, setFlowOfferId] = useState("");
  const [flowCaseId, setFlowCaseId] = useState("");
  const [flowAmount, setFlowAmount] = useState("");
  const [flowAgreementReference, setFlowAgreementReference] = useState("");
  const [customerCycleTitle, setCustomerCycleTitle] = useState("TEST-PRELIVE-Recovery-System-Rehearsal");
  const [customerCycleCaseId, setCustomerCycleCaseId] = useState("");
  const [customerCycleRelationshipId, setCustomerCycleRelationshipId] = useState("");
  const [customerCycleObjective, setCustomerCycleObjective] = useState("Prove one continuous synthetic customer-value transaction from commercial approval through closeout without external effects.");
  const [customerCycleAcceptance, setCustomerCycleAcceptance] = useState("Every phase has a linked verified receipt, failure recovery is proven, no data is re-keyed, and no external effect or real metric is created.");
  const [customerCycleCleanup, setCustomerCycleCleanup] = useState("Preserve the append-only audit and evidence receipts, mark the fixture terminal, and leave every provider and third-party record unchanged.");
  const [customerCycleNotes, setCustomerCycleNotes] = useState<Record<string, string>>({});
  const [customerCycleEvidenceNotes, setCustomerCycleEvidenceNotes] = useState<Record<string, string>>({});
  const [customerCycleEvidenceIds, setCustomerCycleEvidenceIds] = useState<Record<string, string>>({});
  const [sharedServiceProviderId, setSharedServiceProviderId] = useState("");
  const [sharedServiceTitle, setSharedServiceTitle] = useState("");
  const [sharedServiceScope, setSharedServiceScope] = useState("");
  const [sharedServiceBeneficiary, setSharedServiceBeneficiary] = useState("");
  const [sharedServicePriority, setSharedServicePriority] = useState("high");
  const [sharedServiceInputs, setSharedServiceInputs] = useState("");
  const [sharedServiceAcceptance, setSharedServiceAcceptance] = useState("");
  const [sharedServiceDueAt, setSharedServiceDueAt] = useState("");
  const [sharedServiceCostTreatment, setSharedServiceCostTreatment] =
    useState("");
  const [sharedServiceNotes, setSharedServiceNotes] = useState<
    Record<string, string>
  >({});
  const [sharedServiceEvidenceIds, setSharedServiceEvidenceIds] = useState<
    Record<string, string>
  >({});
  const [sharedServiceEvidenceNotes, setSharedServiceEvidenceNotes] = useState<
    Record<string, string>
  >({});
  const [sharedServiceCostOutcomes, setSharedServiceCostOutcomes] = useState<
    Record<string, string>
  >({});
  const [financeSourceName, setFinanceSourceName] = useState("");
  const [financeEntityName, setFinanceEntityName] = useState("");
  const [financeSourceType, setFinanceSourceType] = useState("bank");
  const [financeProvider, setFinanceProvider] = useState("");
  const [financeExternalId, setFinanceExternalId] = useState("");
  const [financePlanName, setFinancePlanName] = useState("");
  const [financePlanType, setFinancePlanType] = useState("budget");
  const [financePlanSourceId, setFinancePlanSourceId] = useState("");
  const [financePlanAmount, setFinancePlanAmount] = useState("");
  const [financePlanStart, setFinancePlanStart] = useState("");
  const [financePlanEnd, setFinancePlanEnd] = useState("");
  const [financePlanAssumption, setFinancePlanAssumption] = useState("");
  const [financePlanLineName, setFinancePlanLineName] = useState("");
  const [financePlanLineAmount, setFinancePlanLineAmount] = useState("");
  const [financeReconcileFlowIds, setFinanceReconcileFlowIds] = useState<
    string[]
  >([]);
  const [financeReconcileEvidenceIds, setFinanceReconcileEvidenceIds] =
    useState<string[]>([]);
  const [financeReconcileActual, setFinanceReconcileActual] = useState("");
  const [allocationName, setAllocationName] = useState("");
  const [allocationType, setAllocationType] = useState("reserve");
  const [allocationPlanId, setAllocationPlanId] = useState("");
  const [allocationTarget, setAllocationTarget] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationRationale, setAllocationRationale] = useState("");
  const [allocationOutcome, setAllocationOutcome] = useState("");
  const [allocationRisk, setAllocationRisk] = useState("");
  const [allocationWorkPacketId, setAllocationWorkPacketId] = useState("");
  const [financeObligationTitle, setFinanceObligationTitle] = useState("");
  const [financeObligationDescription, setFinanceObligationDescription] =
    useState("");
  const [selectedModuleId, setSelectedModuleId] = useState(1);
  const [evidenceDetails, setEvidenceDetails] = useState<
    Record<string, string>
  >({});
  const [decisionDraft, setDecisionDraft] = useState<{
    id: string;
    summary: string;
    decision: "approved" | "rejected";
  } | null>(null);
  const [commandTransitionDraft, setCommandTransitionDraft] =
    useState<CommandTransitionDraft | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [eaMessages, setEaMessages] = useState<ChatMessage[]>([]);
  const [isEditingAssistantName, setIsEditingAssistantName] = useState(false);
  const [assistantNameDraft, setAssistantNameDraft] = useState("");
  const [providerPacketId, setProviderPacketId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [seatTitle, setSeatTitle] = useState("");
  const [seatKind, setSeatKind] = useState("individual_contributor");
  const [seatAgentName, setSeatAgentName] = useState("");
  const [seatSupervisorId, setSeatSupervisorId] = useState("");
  const [selectedMapSeatId, setSelectedMapSeatId] = useState("");
  const [mapSeatSearch, setMapSeatSearch] = useState("");
  const [showAllMapSeats, setShowAllMapSeats] = useState(false);
  const [showAllMapReports, setShowAllMapReports] = useState(false);
  const [membershipEmail, setMembershipEmail] = useState("");
  const [membershipSeatId, setMembershipSeatId] = useState("");
  const [membershipPortfolioScope, setMembershipPortfolioScope] =
    useState(false);
  const [identityDomains, setIdentityDomains] = useState("");
  const [allowExternalCollaborators, setAllowExternalCollaborators] =
    useState(true);
  const [authoritySubjectType, setAuthoritySubjectType] = useState("provider");
  const [authoritySubjectName, setAuthoritySubjectName] = useState("");
  const [authoritySubjectKey, setAuthoritySubjectKey] = useState("");
  const [authoritySubjectSeatId, setAuthoritySubjectSeatId] = useState("");
  const [authoritySubjectParentId, setAuthoritySubjectParentId] = useState("");
  const [authoritySubjectExternalKey, setAuthoritySubjectExternalKey] =
    useState("");
  const [authoritySubjectSource, setAuthoritySubjectSource] = useState("");
  const [authoritySubjectEvidence, setAuthoritySubjectEvidence] = useState("");
  const [authoritySubjectDetail, setAuthoritySubjectDetail] = useState("");
  const [authoritySubjectMembers, setAuthoritySubjectMembers] = useState("");
  const [
    authoritySubjectCredentialReference,
    setAuthoritySubjectCredentialReference,
  ] = useState("");
  const [authoritySubjectEnvironment, setAuthoritySubjectEnvironment] =
    useState("production");
  const [authoritySubjectClassification, setAuthoritySubjectClassification] =
    useState("internal");
  const [
    authoritySubjectLifecycleEvidence,
    setAuthoritySubjectLifecycleEvidence,
  ] = useState("");
  const [authorityGranteeType, setAuthorityGranteeType] = useState("seat");
  const [authorityGranteeSubjectId, setAuthorityGranteeSubjectId] =
    useState("");
  const [authoritySeatId, setAuthoritySeatId] = useState("");
  const [authorityResource, setAuthorityResource] = useState("work_packet");
  const [authorityClassDraft, setAuthorityClassDraft] = useState<
    AuthorityClass[]
  >(["view"]);
  const [authorityEffect, setAuthorityEffect] = useState("allow");
  const [authorityClassification, setAuthorityClassification] =
    useState("internal");
  const [authorityConsequence, setAuthorityConsequence] = useState("routine");
  const [authorityMaxAmount, setAuthorityMaxAmount] = useState("");
  const [authorityCurrency, setAuthorityCurrency] = useState("USD");
  const [authorityMinimumApprovals, setAuthorityMinimumApprovals] =
    useState("0");
  const [authorityEvidenceMinimum, setAuthorityEvidenceMinimum] = useState("0");
  const [authorityRequireDistinctSeat, setAuthorityRequireDistinctSeat] =
    useState(false);
  const [
    authorityMinimizeProtectedFields,
    setAuthorityMinimizeProtectedFields,
  ] = useState(true);
  const [authorityPolicySource, setAuthorityPolicySource] = useState("");
  const [authorityEffectiveUntil, setAuthorityEffectiveUntil] = useState("");
  const [authorityReviewAt, setAuthorityReviewAt] = useState("");
  const [activateAuthorityGrant, setActivateAuthorityGrant] = useState(false);
  const [monthlyAiBudget, setMonthlyAiBudget] = useState("25");
  const [perRequestAiBudget, setPerRequestAiBudget] = useState("1");
  const [aiBudgetEnabled, setAiBudgetEnabled] = useState(true);
  const [notionSearchDraft, setNotionSearchDraft] = useState("");
  const [notionSearch, setNotionSearch] = useState("");
  const [sourcePackageKey, setSourcePackageKey] = useState("");
  const [companySourceSnapshot, setCompanySourceSnapshot] =
    useState<JsonRecord | null>(null);
  const [showClosedWork, setShowClosedWork] = useState(false);
  const [showDecisionHistory, setShowDecisionHistory] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [activeSeatContext, setActiveSeatContext] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("seat") || "",
  );
  useEffect(() => {
    const syncHash = () => {
      const requested = window.location.hash.slice(1);
      const aliases: Record<string, string> = {
        brief: "home",
        missions: "operations",
        approvals: "operations",
        evidence: "operations",
      };
      const tab = aliases[requested] ?? requested;
      if (
        [
          "home",
          "command",
          "organization",
          "talent",
          "workforce",
          "my-role",
          "modules",
          "commercial",
          "operations",
          "work-room",
          "review",
          "academy",
          "portfolio-map",
          "capital",
          "intelligence",
          "systems",
        ].includes(tab)
      )
        setActiveTab(tab);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const roleScopeKey = activeSeatContext || "default";
  const contextQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "context"],
    queryFn: () => requestJson("GET", `${root}/context`),
    enabled: Boolean(companyId),
  });
  const companyPackagesQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "company-packages"],
    queryFn: () => requestJson("GET", `${root}/reference-packages`),
    enabled: Boolean(
      companyId && contextQuery.data?.principalContext?.role === "founder",
    ),
  });
  const companyPackageSourcesQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "company-package-sources", sourcePackageKey],
    queryFn: () =>
      requestJson(
        "GET",
        `${root}/company-packages/${encodeURIComponent(sourcePackageKey)}/sources`,
      ),
    enabled: Boolean(companyId && sourcePackageKey),
  });
  const briefQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "brief"],
    queryFn: () => requestJson("GET", `${root}/brief`),
    enabled: Boolean(companyId),
  });
  const packetsQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "work-packets"],
    queryFn: () => requestJson("GET", `${root}/work-packets`),
    enabled: Boolean(companyId),
  });
  const approvalsQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "approvals"],
    queryFn: () => requestJson("GET", `${root}/approvals`),
    enabled: Boolean(companyId),
  });
  const evidenceQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "evidence"],
    queryFn: () => requestJson("GET", `${root}/evidence`),
    enabled: Boolean(companyId),
  });
  const integrationsQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "integrations"],
    queryFn: () => requestJson("GET", `${root}/integrations`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "systems",
      ),
    ),
  });
  const systemsStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "systems-state"],
    queryFn: () => requestJson("GET", `${root}/systems-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "systems",
      ),
    ),
  });
  const workforceStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "workforce-state"],
    queryFn: () => requestJson("GET", `${root}/workforce-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "workforce",
      ),
    ),
  });
  const talentStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "talent-state"],
    queryFn: () => requestJson("GET", `${root}/talent-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "talent",
      ),
    ),
  });
  const commandStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "command-state"],
    queryFn: () => requestJson("GET", `${root}/command-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "command",
      ),
    ),
  });
  const commercialStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "commercial-state"],
    queryFn: () => requestJson("GET", `${root}/commercial-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "commercial",
      ),
    ),
  });
  const recoveryLeadsQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "recovery-calculator"],
    queryFn: () => requestJson("GET", `${root}/recovery-calculator`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "commercial",
      ),
    ),
  });
  const sharedServiceCandidatesQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "shared-service-candidates"],
    queryFn: () => requestJson("GET", `${root}/shared-services/candidates`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "commercial",
      ),
    ),
  });
  const sharedServicesQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "shared-services"],
    queryFn: () => requestJson("GET", `${root}/shared-services`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "commercial",
      ),
    ),
  });
  const operationsStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "operations-state"],
    queryFn: () => requestJson("GET", `${root}/operations-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "operations",
      ),
    ),
  });
  const artifactClosureSummaryQuery = useQuery<JsonRecord>({
    queryKey: [`${root}/artifact-closure`, roleScopeKey, "summary"],
    queryFn: () => requestJson("GET", `${root}/artifact-closure`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "operations",
      ),
    ),
  });
  const financeStateQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "finance-state"],
    queryFn: () => requestJson("GET", `${root}/finance-state`),
    enabled: Boolean(
      companyId &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "capital",
      ),
    ),
  });
  const advisorVisible = [
    "founder",
    "portfolio_executive",
    "company_ceo",
  ].includes(contextQuery.data?.principalContext?.role);
  const councilQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "advisor-council"],
    queryFn: () => requestJson("GET", `${root}/advisor-council`),
    enabled: Boolean(companyId && advisorVisible),
  });
  const consultationsQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "advisor-consultations"],
    queryFn: () => requestJson("GET", `${root}/advisor-council/consultations`),
    enabled: Boolean(
      companyId && contextQuery.data?.principalContext?.role === "founder",
    ),
  });
  const organizationQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "organization-runtime"],
    queryFn: () => requestJson("GET", `${root}/organization-runtime`),
    enabled: Boolean(companyId),
  });
  const policyDecisionsQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "policy-decisions"],
    queryFn: () => requestJson("GET", `${root}/policy-decisions`),
    enabled: Boolean(companyId && contextQuery.data?.principalContext),
  });
  const communicationQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "executive-assistant", "messages"],
    queryFn: () => requestJson("GET", `${root}/executive-assistant/messages`),
    enabled: Boolean(companyId),
  });
  const providerExecutionsQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "provider-executions"],
    queryFn: () => requestJson("GET", `${root}/provider-executions`),
    enabled: Boolean(companyId),
  });
  const auditVisible = [
    "founder",
    "portfolio_executive",
    "company_ceo",
  ].includes(contextQuery.data?.principalContext?.role);
  const auditQuery = useQuery<JsonRecord[]>({
    queryKey: [root, roleScopeKey, "audit"],
    queryFn: () => requestJson("GET", `${root}/audit`),
    enabled: Boolean(companyId && auditVisible),
  });
  const aiBudgetQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "ai-budget"],
    queryFn: () => requestJson("GET", `${root}/ai-budget`),
    enabled: Boolean(
      companyId && contextQuery.data?.principalContext?.role === "founder",
    ),
  });
  const googleConnected = Boolean(
    integrationsQuery.data?.find((item) => item.id === "google_workspace")
      ?.connected,
  );
  const notionConnected = Boolean(
    integrationsQuery.data?.find((item) => item.id === "notion")?.connected,
  );
  const googleContextQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "google-context"],
    queryFn: () => requestJson("GET", `${root}/integrations/google/context`),
    enabled: Boolean(
      companyId &&
      googleConnected &&
      ["home", "work-room", "systems"].includes(activeTab),
    ),
  });
  const notionContextQuery = useQuery<JsonRecord>({
    queryKey: [root, roleScopeKey, "notion-context", notionSearch],
    queryFn: () =>
      requestJson(
        "GET",
        `${root}/integrations/notion/context?q=${encodeURIComponent(notionSearch)}`,
      ),
    enabled: Boolean(
      companyId &&
      notionConnected &&
      (contextQuery.data?.principalContext?.allowedSurfaces || []).includes(
        "systems",
      ) &&
      ["home", "organization", "academy", "systems"].includes(activeTab),
    ),
  });

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [root] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const enterRole = async (assignment: JsonRecord) => {
    const url = new URL(window.location.href);
    if (assignment.role === "founder") url.searchParams.delete("seat");
    else url.searchParams.set("seat", assignment.seatId);
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setActiveSeatContext(
      assignment.role === "founder" ? "" : assignment.seatId,
    );
    setEaMessages([]);
    await queryClient.invalidateQueries({ queryKey: [root] });
    toast({
      title: `Entered ${assignment.seat}`,
      description:
        "The workspace, assistant, visibility, tools, work, and decisions now reflect this role assignment.",
    });
  };

  const showMutationError = (action: string, error: unknown) =>
    toast({
      title: `${action} failed`,
      description: mutationFailure(action, error),
      variant: "destructive",
    });

  const company = contextQuery.data?.company;
  const manifest = contextQuery.data?.manifest;
  const manifestPackageSelections = Array.isArray(
    manifest?.manifest?.packageSelections,
  )
    ? manifest.manifest.packageSelections
    : [];
  const availableCompanyPackages = companyPackagesQuery.data || [];
  const packets = packetsQuery.data || [];
  const approvals = approvalsQuery.data || [];
  const evidence = evidenceQuery.data || [];
  const activePackets = packets.filter(
    (packet) => !["completed", "cancelled"].includes(packet.status),
  );
  const closedPackets = packets.filter((packet) =>
    ["completed", "cancelled"].includes(packet.status),
  );
  const operationsPackets = showClosedWork ? packets : activePackets;
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending",
  );
  const visibleApprovals = showDecisionHistory ? approvals : pendingApprovals;
  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(0, 10);
  const principalContext = contextQuery.data?.principalContext;
  const operatingAssignments = (
    principalContext?.availableAssignments || []
  ).filter((assignment: JsonRecord) => assignment.operatingGrant === "operate");
  const assistantName =
    principalContext?.communicationAgent ||
    company?.assistantName ||
    "Assistant";
  const isFounder = principalContext?.role === "founder";
  const effectiveAuthorityClasses = new Set<string>(
    principalContext?.authority?.classes || [],
  );
  const canOperateNativeSigning = Boolean(
    principalContext?.authority?.grants?.some(
      (grant: JsonRecord) =>
        Array.isArray(grant.authorityClasses) &&
        grant.authorityClasses.includes("sign") &&
        authorityGrantCoversResource(
          grant,
          "native_esign",
          principalContext?.seatId,
        ),
    ),
  );
  const mayAdminOrganization =
    ["founder", "company_ceo"].includes(principalContext?.role) &&
    effectiveAuthorityClasses.has("grant_access");
  const activeRolePack = principalContext?.roleOperatingPack?.contract || {};
  const activePositionAgreement =
    principalContext?.positionAgreement?.contract || {};
  const allowedSurfaces = new Set<string>(
    principalContext?.allowedSurfaces || [],
  );
  const visibleModules = eosActiveModules.filter((module) =>
    allowedSurfaces.has(module.operatingSurface),
  );
  const selectedModule =
    visibleModules.find((module) => module.id === selectedModuleId) ||
    visibleModules[0];
  const visibleSeats = organizationQuery.data?.seats || [];
  const authorityGrants = organizationQuery.data?.authorityGrants || [];
  const authoritySubjects = organizationQuery.data?.authoritySubjects || [];
  const selectedAuthoritySubject = authoritySubjects.find(
    (subject: JsonRecord) => subject.id === authorityGranteeSubjectId,
  );
  const authorityTargetSeatId =
    authorityGranteeType === "seat"
      ? authoritySeatId
      : selectedAuthoritySubject?.seatId || "";
  const authorityNeedsReview =
    authorityClassDraft.some((authorityClass) =>
      ["spend", "sign", "grant_access", "override_emergency"].includes(
        authorityClass,
      ),
    ) ||
    ["restricted", "highly_restricted", "contextual"].includes(
      authorityClassification,
    ) ||
    ["irreversible", "emergency"].includes(authorityConsequence);
  const matchingMapSeats = visibleSeats.filter((seat: JsonRecord) => {
    const query = mapSeatSearch.trim().toLowerCase();
    return (
      !query ||
      [seat.title, seat.agentName, seat.kind].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      )
    );
  });
  const displayedMapSeats =
    showAllMapSeats || mapSeatSearch.trim()
      ? matchingMapSeats
      : matchingMapSeats.slice(0, 12);
  const selectedMapSeat =
    visibleSeats.find((seat: JsonRecord) => seat.id === selectedMapSeatId) ||
    visibleSeats.find(
      (seat: JsonRecord) => seat.id === organizationQuery.data?.activeSeatId,
    ) ||
    visibleSeats[0];
  const selectedMapSupervisor = selectedMapSeat?.supervisorSeatId
    ? visibleSeats.find(
        (seat: JsonRecord) => seat.id === selectedMapSeat.supervisorSeatId,
      )
    : undefined;
  const selectedMapReports = selectedMapSeat
    ? visibleSeats.filter(
        (seat: JsonRecord) => seat.supervisorSeatId === selectedMapSeat.id,
      )
    : [];
  const displayedMapReports = showAllMapReports
    ? selectedMapReports
    : selectedMapReports.slice(0, 8);
  const selectedMapPackets = selectedMapSeat
    ? activePackets.filter(
        (packet) => packet.accountableSeatId === selectedMapSeat.id,
      )
    : [];
  const selectedWorkPacket =
    activePackets.find((packet) => packet.id === providerPacketId) ||
    activePackets[0];
  const selectedWorkPacketEvidence = selectedWorkPacket
    ? evidence.filter((item) => item.workPacketId === selectedWorkPacket.id)
    : [];
  const selectedWorkRequirements =
    selectedWorkPacket &&
    Array.isArray(selectedWorkPacket.evidenceRequirements) &&
    selectedWorkPacket.evidenceRequirements.length
      ? selectedWorkPacket.evidenceRequirements.map(String)
      : ["A reviewable artifact or observed outcome"];
  const selectedWorkRecordedTitles = new Set(
    selectedWorkPacketEvidence.map((item) =>
      String(item.title).trim().toLowerCase(),
    ),
  );
  const selectedWorkMissingRequirements = selectedWorkRequirements.filter(
    (requirement: string) =>
      !selectedWorkRecordedTitles.has(requirement.trim().toLowerCase()),
  );
  const selectedWorkNextRequirement = selectedWorkMissingRequirements[0];
  const manifestModuleIds = new Set<number>(
    manifest?.manifest?.enabledModules ||
      eosActiveModules.map((module) => module.id),
  );
  const artifactClosureGroups = (artifactClosureSummaryQuery.data?.groups || []) as ArtifactClosureGroupProjection[];
  const moduleQualification = (module: EosActiveModule) =>
    closureModuleState(artifactClosureGroups, module.id);
  const moduleState = (module: EosActiveModule) =>
    !manifestModuleIds.has(module.id)
      ? "not_enabled"
      : artifactClosureSummaryQuery.data
        ? moduleQualification(module).state
        : `overlay_${module.activation === "active" ? "ready" : "partial"}`;
  const practiceAction = rolePracticeActionFor(
    principalContext?.role || "external",
    activePackets.length > 0,
  );

  useEffect(() => {
    if (!principalContext || allowedSurfaces.has(activeTab)) return;
    setActiveTab("home");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#home`,
    );
  }, [activeTab, principalContext?.role]);

  useEffect(() => {
    const persisted = communicationQuery.data?.messages || [];
    setEaMessages(
      persisted.map((message: JsonRecord) => ({
        id: message.id,
        role: message.senderType === "human" ? "user" : "assistant",
        content: message.content,
        timestamp: new Date(message.createdAt),
      })),
    );
  }, [communicationQuery.data]);

  useEffect(() => {
    if (!isEditingAssistantName) setAssistantNameDraft(assistantName);
  }, [assistantName, isEditingAssistantName]);

  useEffect(() => {
    if (!aiBudgetQuery.data?.configured) return;
    setMonthlyAiBudget(
      String((aiBudgetQuery.data.monthlyLimitMicros || 0) / 1_000_000),
    );
    setPerRequestAiBudget(
      String((aiBudgetQuery.data.perRequestLimitMicros || 0) / 1_000_000),
    );
    setAiBudgetEnabled(Boolean(aiBudgetQuery.data.enabled));
  }, [aiBudgetQuery.data]);

  useEffect(() => {
    const policy = organizationQuery.data?.identityPolicy;
    if (!policy) return;
    setIdentityDomains(
      Array.isArray(policy.allowedEmailDomains)
        ? policy.allowedEmailDomains.join(", ")
        : "",
    );
    setAllowExternalCollaborators(policy.allowExternalCollaborators !== false);
  }, [organizationQuery.data?.identityPolicy]);

  useEffect(() => {
    if (!visibleSeats.length) {
      setSelectedMapSeatId("");
      return;
    }
    if (visibleSeats.some((seat: JsonRecord) => seat.id === selectedMapSeatId))
      return;
    setSelectedMapSeatId(
      organizationQuery.data?.activeSeatId || visibleSeats[0].id,
    );
  }, [
    organizationQuery.data?.activeSeatId,
    organizationQuery.data?.seats,
    selectedMapSeatId,
  ]);

  useEffect(() => {
    if (!visibleSeats.length) {
      setAuthoritySeatId("");
      return;
    }
    if (visibleSeats.some((seat: JsonRecord) => seat.id === authoritySeatId))
      return;
    const lowerSeat = visibleSeats.find(
      (seat: JsonRecord) => seat.id !== organizationQuery.data?.activeSeatId,
    );
    setAuthoritySeatId(lowerSeat?.id || visibleSeats[0].id);
  }, [
    authoritySeatId,
    organizationQuery.data?.activeSeatId,
    organizationQuery.data?.seats,
  ]);

  useEffect(() => {
    const matchingSubjects = authoritySubjects.filter(
      (subject: JsonRecord) =>
        subject.subjectType === authorityGranteeType &&
        subject.status === "active" &&
        subject.verificationStatus === "verified",
    );
    if (!matchingSubjects.length) {
      setAuthorityGranteeSubjectId("");
      return;
    }
    if (
      matchingSubjects.some(
        (subject: JsonRecord) => subject.id === authorityGranteeSubjectId,
      )
    )
      return;
    setAuthorityGranteeSubjectId(matchingSubjects[0].id);
  }, [
    authorityGranteeSubjectId,
    authorityGranteeType,
    organizationQuery.data?.authoritySubjects,
  ]);

  useEffect(() => {
    if (!activePackets.length) {
      setProviderPacketId("");
      return;
    }
    if (activePackets.some((packet) => packet.id === providerPacketId)) return;
    setProviderPacketId(activePackets[0].id);
  }, [packetsQuery.data, providerPacketId]);

  const compilerMutation = useMutation({
    mutationFn: async () =>
      requestJson<JsonRecord>("POST", `${root}/compiler/drafts`, {
        purpose:
          company?.goals ||
          `Build a durable, operator-ready organization for ${company?.name || "this company"}.`,
        stage: company?.stage || "MVP",
        offer: company?.offer || "Define and validate the primary offer",
        targetCustomer:
          company?.targetCustomer || "Define the initial ideal customer",
        goals: String(
          company?.goals || "Activate the first repeatable customer-value loop",
        )
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        enabledModules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        ownerSeat: { title: "Founder / Owner", authority: "owner" },
        operatingCadence: "weekly",
        founderProfile: {
          vision: company?.founderProfile?.vision || "",
          values: company?.founderProfile?.values || "",
          decisionStyle: company?.founderProfile?.decisionStyle || "",
          workingStyle: company?.founderProfile?.workingStyle || "",
        },
        sourceAssertions: [
          {
            label: "Company setup",
            value: company?.goals || "Initial owner-defined company intent",
            sourceType: "user_assertion",
          },
        ],
        assumptions: [],
        unknowns: [],
        packageSelections: [
          {
            id: "eos-overlay-core",
            version: "1.0",
            rationale: "Required operating foundation",
          },
          ...manifestPackageSelections.filter(
            (selection: JsonRecord) => selection.id !== "eos-overlay-core",
          ),
        ],
        provisioningChecklist: [
          {
            id: "owner-context",
            label: "Owner identity and organization verified",
            required: true,
            complete: true,
          },
        ],
        verificationChecks: [
          {
            id: "runtime-ready",
            label: "EOS runtime readiness",
            status: "passed",
            evidence: "/api/ready",
          },
        ],
      }),
    onSuccess: async (draft) => {
      await refresh();
      toast({
        title: `Manifest v${draft.version} compiled`,
        description:
          "Advance it through diagnostic, proposal, review, provisioning, and verification before activation.",
      });
    },
    onError: (error) => showMutationError("Manifest compilation", error),
  });

  const companyPackageMutation = useMutation({
    mutationFn: (packageDefinition: JsonRecord) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/company-packages/${encodeURIComponent(
          String(packageDefinition.packageKey || ""),
        )}/compile`,
        {
          confirmOrganizationKey: String(
            packageDefinition.organizationKey || "",
          ),
        },
      ),
    onSuccess: async (result, packageDefinition) => {
      await refresh();
      toast({
        title: result.created
          ? `${packageDefinition.operatingName} reference instance compiled`
          : `${packageDefinition.operatingName} reference instance already compiled`,
        description:
          "Open Map, Command, Commercial, Operations, Work Room, and Systems to operate the compiled company. Activation remains blocked until the listed authority and evidence gates pass.",
      });
    },
    onError: (error) =>
      showMutationError("Company package compilation", error),
  });

  const companySourceSnapshotMutation = useMutation({
    mutationFn: ({ packageKey, sourceKey }: { packageKey: string; sourceKey: string }) =>
      requestJson<JsonRecord>(
        "GET",
        `${root}/company-packages/${encodeURIComponent(packageKey)}/sources/${encodeURIComponent(sourceKey)}/snapshot`,
      ),
    onSuccess: (snapshot) => {
      setCompanySourceSnapshot(snapshot);
      toast({
        title: `${snapshot.title} source captured`,
        description: "This bounded, hashed snapshot is reference-only and did not mutate EOS or Notion.",
      });
    },
    onError: (error) => showMutationError("Company source snapshot", error),
  });

  const manifestTransitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      requestJson("POST", `${root}/manifests/${id}/transition`, { status }),
    onSuccess: async (_, variables) => {
      await refresh();
      toast({
        title: `Manifest moved to ${variables.status.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Manifest transition", error),
  });

  const activateMutation = useMutation({
    mutationFn: (manifestId: string) =>
      requestJson("POST", `${root}/manifests/${manifestId}/activate`, {}),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Organization manifest activated" });
    },
    onError: (error) => showMutationError("Manifest activation", error),
  });

  const objectiveMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/objectives`, {
        title: objectiveTitle,
        statement: objectiveStatement,
        recordType: objectiveType,
        priority: "medium",
      }),
    onSuccess: async () => {
      setObjectiveTitle("");
      setObjectiveStatement("");
      await commandStateQuery.refetch();
      toast({
        title: "Objective recorded",
        description: "It begins proposed and must be explicitly activated.",
      });
    },
    onError: (error) => showMutationError("Objective creation", error),
  });

  const objectiveTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/objectives/${id}`, { state }),
    onSuccess: async (_, variables) => {
      setCommandTransitionDraft(null);
      await commandStateQuery.refetch();
      toast({
        title: `Objective moved to ${variables.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Objective transition", error),
  });

  const metricOutcomeMutation = useMutation({
    mutationFn: () => {
      const value = Number(metricTarget);
      const valueField =
        metricType === "target" || metricType === "benchmark"
          ? { targetValue: value }
          : metricType === "forecast"
            ? { forecastValue: value }
            : { actualValue: value, asOf: new Date().toISOString() };
      return requestJson<JsonRecord>("POST", `${root}/metrics-outcomes`, {
        title: metricTitle,
        recordType: metricType,
        ...valueField,
        unitCurrency: metricUnit,
        definitionFormula: `${metricType.replaceAll("_", " ")} for ${metricTitle}`,
      });
    },
    onSuccess: async () => {
      setMetricTitle("");
      setMetricTarget("");
      setMetricUnit("");
      await commandStateQuery.refetch();
      toast({
        title: "Metric target recorded",
        description:
          "Define and activate it before treating it as an operating scorecard.",
      });
    },
    onError: (error) => showMutationError("Metric creation", error),
  });

  const metricOutcomeTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/metrics-outcomes/${id}`, { state }),
    onSuccess: async (_, variables) => {
      setCommandTransitionDraft(null);
      await commandStateQuery.refetch();
      toast({
        title: `Metric moved to ${variables.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Metric transition", error),
  });

  const riskControlMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/risks-controls`, {
        title: riskTitle,
        descriptionCauseEventImpact: riskDescription,
        recordType: riskType,
      }),
    onSuccess: async () => {
      setRiskTitle("");
      setRiskDescription("");
      await commandStateQuery.refetch();
      toast({
        title: `${riskType.replaceAll("_", " ")} recorded`,
        description: "It is identified and ready for governed assessment.",
      });
    },
    onError: (error) => showMutationError("Risk or control creation", error),
  });

  const riskControlTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/risks-controls/${id}`, { state }),
    onSuccess: async (_, variables) => {
      setCommandTransitionDraft(null);
      await commandStateQuery.refetch();
      toast({
        title: `Exception state moved to ${variables.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Risk or control transition", error),
  });

  const stakeholderMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/stakeholders`, {
        name: stakeholderName,
        partyType: stakeholderType,
        identityReference: stakeholderIdentity,
      }),
    onSuccess: async (record) => {
      setStakeholderName("");
      setStakeholderIdentity("");
      setRelationshipPartyId(record.id);
      setCasePartyId(record.id);
      setFlowToPartyId(record.id);
      await commercialStateQuery.refetch();
      toast({
        title: "Canonical party recorded",
        description:
          "Add relationship contexts to this identity instead of duplicating the contact.",
      });
    },
    onError: (error) => showMutationError("Stakeholder creation", error),
  });
  const stakeholderTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/stakeholders/${id}`, { state }),
    onSuccess: async (_, value) => {
      await commercialStateQuery.refetch();
      toast({ title: `Party moved to ${value.state}` });
    },
    onError: (error) => showMutationError("Stakeholder transition", error),
  });

  const relationshipMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/stakeholder-relationships`, {
        stakeholderId: relationshipPartyId,
        relationshipType,
        title: relationshipTitle,
        needConstraint: relationshipNeed,
      }),
    onSuccess: async () => {
      setRelationshipTitle("");
      setRelationshipNeed("");
      await commercialStateQuery.refetch();
      toast({ title: "Relationship context recorded" });
    },
    onError: (error) => showMutationError("Relationship creation", error),
  });
  const relationshipTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/stakeholder-relationships/${id}`, {
        state,
      }),
    onSuccess: async (_, value) => {
      await commercialStateQuery.refetch();
      toast({ title: `Relationship moved to ${value.state}` });
    },
    onError: (error) => showMutationError("Relationship transition", error),
  });

  const offerMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/offers`, {
        name: offerName,
        offerType,
        problemNeed: offerProblem,
        promiseOutcome: offerPromise,
      }),
    onSuccess: async (record) => {
      setOfferName("");
      setOfferProblem("");
      setOfferPromise("");
      setCaseOfferId(record.id);
      setFlowOfferId(record.id);
      await commercialStateQuery.refetch();
      toast({
        title: "Offer thesis recorded",
        description: "Validate it before activation.",
      });
    },
    onError: (error) => showMutationError("Offer creation", error),
  });
  const offerTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/offers/${id}`, { state }),
    onSuccess: async (_, value) => {
      await commercialStateQuery.refetch();
      toast({ title: `Offer moved to ${value.state}` });
    },
    onError: (error) => showMutationError("Offer transition", error),
  });

  const commercialCaseMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/commercial-cases`, {
        title: caseTitle,
        objectClass: "commercial_opportunity",
        stakeholderIds: [casePartyId],
        ...(caseOfferId ? { offerId: caseOfferId } : {}),
        ...(caseValue ? { valueEstimate: Number(caseValue) } : {}),
        ...(caseProbability
          ? { probabilityConfidence: Number(caseProbability) }
          : {}),
        nextAction: caseNextAction,
      }),
    onSuccess: async (record) => {
      setCaseTitle("");
      setCaseValue("");
      setCaseProbability("");
      setCaseNextAction("");
      setFlowCaseId(record.id);
      await commercialStateQuery.refetch();
      toast({ title: "Commercial opportunity recorded" });
    },
    onError: (error) =>
      showMutationError("Commercial opportunity creation", error),
  });
  const commercialCaseTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/commercial-cases/${id}`, { state }),
    onSuccess: async (_, value) => {
      await commercialStateQuery.refetch();
      toast({
        title: `Commercial case moved to ${value.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Commercial case transition", error),
  });

  const valueFlowMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/value-flows`, {
        title: flowTitle,
        flowType,
        ...(flowFromPartyId ? { fromStakeholderId: flowFromPartyId } : {}),
        ...(flowToPartyId ? { toStakeholderId: flowToPartyId } : {}),
        ...(flowOfferId ? { offerId: flowOfferId } : {}),
        ...(flowCaseId ? { commercialCaseId: flowCaseId } : {}),
        ...(flowAmount ? { amount: Number(flowAmount) } : {}),
        agreementReference: flowAgreementReference,
      }),
    onSuccess: async () => {
      setFlowTitle("");
      setFlowAmount("");
      setFlowAgreementReference("");
      await commercialStateQuery.refetch();
      toast({
        title: "Governed value flow recorded",
        description: "No external invoice or payment was created.",
      });
    },
    onError: (error) => showMutationError("Value-flow creation", error),
  });
  const valueFlowTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/value-flows/${id}`, { state }),
    onSuccess: async (_, value) => {
      await commercialStateQuery.refetch();
      toast({
        title: `Value flow moved to ${value.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Value-flow transition", error),
  });

  const customerValueCycleMutation = useMutation({
    mutationFn: () => {
      const commercialCase = (commercialStateQuery.data?.cases || []).find(
        (item: JsonRecord) => item.id === customerCycleCaseId,
      );
      const relationship = (commercialStateQuery.data?.relationships || []).find(
        (item: JsonRecord) => item.id === customerCycleRelationshipId,
      );
      if (!commercialCase?.offerId || !relationship?.stakeholderId)
        throw new Error("Choose a linked commercial case and relationship.");
      if (!(commercialCase.stakeholderIds || []).includes(relationship.stakeholderId))
        throw new Error("The selected relationship must belong to a party in the selected case.");
      return requestJson<JsonRecord>("POST", `${root}/customer-value-cycles`, {
        title: customerCycleTitle,
        stakeholderId: relationship.stakeholderId,
        relationshipId: relationship.id,
        offerId: commercialCase.offerId,
        commercialCaseId: commercialCase.id,
        objective: customerCycleObjective,
        acceptanceCriteria: customerCycleAcceptance,
        cleanupCriteria: customerCycleCleanup,
      });
    },
    onSuccess: async () => {
      await refresh();
      toast({
        title: "Pre-live customer-value cycle created",
        description: "Approve it in the decision HUD, then advance it with verified phase receipts.",
      });
    },
    onError: (error) => showMutationError("Customer-value cycle creation", error),
  });

  const customerValueCycleEvidenceMutation = useMutation({
    mutationFn: ({ cycleId, workPacketId, note }: { cycleId: string; workPacketId: string; note: string }) =>
      requestJson<JsonRecord>("POST", `${root}/evidence`, {
        workPacketId,
        evidenceType: "review",
        title: "Synthetic customer-value phase receipt",
        details: {
          capturedFrom: "customer_value_cycle_control",
          cycleId,
          note,
          syntheticLabel: "Synthetic / Non-Production",
          externalEffectsExecuted: false,
        },
        verificationState: "verified",
        confidenceQuality: "high",
        supportedClaimSummary: note,
        verifierMethod: "Verified by the authorized EOS operator in the pre-live customer-value control.",
      }),
    onSuccess: async (record, variables) => {
      setCustomerCycleEvidenceIds((current) => ({ ...current, [variables.cycleId]: record.id }));
      setCustomerCycleEvidenceNotes((current) => ({ ...current, [variables.cycleId]: "" }));
      await refresh();
      toast({ title: "Synthetic phase receipt verified" });
    },
    onError: (error) => showMutationError("Customer-value evidence", error),
  });

  const customerValueCycleActionMutation = useMutation({
    mutationFn: ({ cycleId, action, note, evidenceId }: { cycleId: string; action: string; note: string; evidenceId: string }) =>
      requestJson<JsonRecord>("POST", `${root}/customer-value-cycles/${cycleId}/actions`, {
        action,
        note,
        evidenceIds: [evidenceId],
      }),
    onSuccess: async (_, variables) => {
      setCustomerCycleNotes((current) => ({ ...current, [variables.cycleId]: "" }));
      setCustomerCycleEvidenceIds((current) => ({ ...current, [variables.cycleId]: "" }));
      await refresh();
      toast({ title: `Customer-value cycle: ${variables.action.replaceAll("_", " ")}` });
    },
    onError: (error) => showMutationError("Customer-value cycle action", error),
  });

  const customerValueProviderContractMutation = useMutation({
    mutationFn: ({ cycleId, checkpointId }: { cycleId: string; checkpointId: string }) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/customer-value-cycles/${cycleId}/provider-checkpoints/${checkpointId}/run-contract-suite`,
        { confirmFixtureOnly: true },
      ),
    onSuccess: async (record) => {
      await commercialStateQuery.refetch();
      toast({
        title: `${String(record.providerKey)} contract qualified`,
        description: "Deterministic pre-live scenarios passed. The live provider remains unverified.",
      });
    },
    onError: (error) => showMutationError("Provider contract fixture", error),
  });

  const sharedServiceRequestMutation = useMutation({
    mutationFn: () => {
      const candidate = (sharedServiceCandidatesQuery.data || []).find(
        (item: JsonRecord) => String(item.companyId) === sharedServiceProviderId,
      );
      if (!candidate) throw new Error("Choose an eligible provider company.");
      return requestJson<JsonRecord>("POST", `${root}/shared-services`, {
        providerCompanyId: Number(candidate.companyId),
        beneficiaryRelationshipId: candidate.relationshipId,
        title: sharedServiceTitle,
        serviceType: "production",
        scope: sharedServiceScope,
        beneficiary: sharedServiceBeneficiary,
        priority: sharedServicePriority,
        inputs: sharedServiceInputs
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        acceptanceCriteria: sharedServiceAcceptance,
        dueAt: new Date(sharedServiceDueAt).toISOString(),
        costCapacityTreatment: sharedServiceCostTreatment,
      });
    },
    onSuccess: async () => {
      setSharedServiceTitle("");
      setSharedServiceScope("");
      setSharedServiceBeneficiary("");
      setSharedServicePriority("high");
      setSharedServiceInputs("");
      setSharedServiceAcceptance("");
      setSharedServiceDueAt("");
      setSharedServiceCostTreatment("");
      await refresh();
      toast({
        title: "Shared-service request created",
        description:
          "It remains inside the beneficiary company until its local approval is recorded.",
      });
    },
    onError: (error) => showMutationError("Shared-service request", error),
  });

  const sharedServiceActionMutation = useMutation({
    mutationFn: ({
      engagementId,
      action,
      body,
    }: {
      engagementId: string;
      action:
        | "provider-response"
        | "clarify"
        | "start"
        | "deliver"
        | "disposition";
      body?: JsonRecord;
      success: string;
    }) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/shared-services/${engagementId}/${action}`,
        body || {},
      ),
    onSuccess: async (_, variables) => {
      setSharedServiceNotes((current) => ({
        ...current,
        [variables.engagementId]: "",
      }));
      await refresh();
      toast({ title: variables.success });
    },
    onError: (error) => showMutationError("Shared-service action", error),
  });

  const sharedServiceEvidenceMutation = useMutation({
    mutationFn: ({
      engagementId,
      workPacketId,
      title,
      details,
    }: {
      engagementId: string;
      workPacketId: string;
      title: string;
      details: string;
    }) =>
      requestJson<JsonRecord>("POST", `${root}/evidence`, {
        workPacketId,
        evidenceType: "review",
        title,
        details: { capturedFrom: "shared_service_control", note: details },
        verificationState: "verified",
        confidenceQuality: "high",
        supportedClaimSummary: title,
        verifierMethod:
          "Verified by the authorized company-local operator in the shared-service control.",
      }),
    onSuccess: async (record, variables) => {
      setSharedServiceEvidenceIds((current) => ({
        ...current,
        [variables.engagementId]: record.id,
      }));
      setSharedServiceEvidenceNotes((current) => ({
        ...current,
        [variables.engagementId]: "",
      }));
      await refresh();
      toast({
        title: "Company-local evidence verified",
        description:
          "The evidence is available to this company only and is selected for the next handoff.",
      });
    },
    onError: (error) =>
      showMutationError("Shared-service evidence verification", error),
  });

  const capabilityMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/capabilities`, {
        name: capabilityName,
        capabilityKey,
        activationTrigger: capabilityTrigger,
        moduleIds: capabilityModuleId ? [Number(capabilityModuleId)] : [],
      }),
    onSuccess: async (record) => {
      setCapabilityName("");
      setCapabilityKey("");
      setCapabilityTrigger("");
      setCapabilityModuleId("");
      setProcessCapabilityId(record.id);
      setPacketCapabilityId(record.id);
      await operationsStateQuery.refetch();
      toast({ title: "Capability instance mapped" });
    },
    onError: (error) => showMutationError("Capability creation", error),
  });
  const capabilityTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/capabilities/${id}`, { state }),
    onSuccess: async (_, value) => {
      await operationsStateQuery.refetch();
      toast({
        title: `Capability moved to ${value.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Capability transition", error),
  });
  const capabilityModuleMutation = useMutation({
    mutationFn: ({ id, moduleIds }: { id: string; moduleIds: number[] }) =>
      requestJson("PATCH", `${root}/capabilities/${id}`, { moduleIds }),
    onSuccess: async () => {
      await Promise.all([operationsStateQuery.refetch(), artifactClosureSummaryQuery.refetch()]);
      toast({ title: "Capability module assignment updated" });
    },
    onError: (error) => showMutationError("Capability module assignment", error),
  });
  const processMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/processes`, {
        capabilityInstanceId: processCapabilityId,
        name: processName,
        workflowKey: `workflow:${processName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`,
        purpose: processPurpose,
        intendedOutcome: processOutcome,
        triggerCondition: processTrigger,
        procedureSteps: [
          {
            id: "step-1",
            title: processStep.slice(0, 120),
            instructions: processStep,
            completionCriteria: processOutcome,
          },
        ],
        requiredOutputs: [processOutcome],
        evidenceRequirements: ["Observed execution result"],
        failurePaths: [
          "Stop, preserve state, and escalate to the accountable seat",
        ],
        terminalCriteria: [processOutcome],
        acceptanceTests: [
          "An authorized fixture operator completes the normal path from the rendered SOP",
        ],
      }),
    onSuccess: async (record) => {
      setProcessName("");
      setProcessPurpose("");
      setProcessOutcome("");
      setProcessTrigger("");
      setProcessStep("");
      setPacketProcessId(record.id);
      setPacketCapabilityId(record.capabilityInstanceId);
      await operationsStateQuery.refetch();
      toast({
        title: "Executable process mapped",
        description:
          "Advance its qualification only as implementation and observed evidence become real.",
      });
    },
    onError: (error) => showMutationError("Process creation", error),
  });
  const processTransitionMutation = useMutation({
    mutationFn: ({
      id,
      qualificationState,
    }: {
      id: string;
      qualificationState: string;
    }) =>
      requestJson("PATCH", `${root}/processes/${id}`, { qualificationState }),
    onSuccess: async (_, value) => {
      await operationsStateQuery.refetch();
      toast({
        title: `Process moved to ${value.qualificationState.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Process qualification", error),
  });
  const processReleaseMutation = useMutation({
    mutationFn: ({ id, releaseState }: { id: string; releaseState: string }) =>
      requestJson("PATCH", `${root}/processes/${id}`, { releaseState }),
    onSuccess: async (_, value) => {
      await operationsStateQuery.refetch();
      toast({
        title: `Process release moved to ${value.releaseState.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Process release", error),
  });
  const resourceMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/resources`, {
        name: resourceName,
        assetType: resourceType,
        ownerOrganizationKey: `company:${companyId}`,
        rightsUsageLicense: resourceRights,
      }),
    onSuccess: async (record) => {
      setResourceName("");
      setResourceRights("");
      setPacketResourceIds((current) =>
        Array.from(new Set([...current, record.id])),
      );
      await operationsStateQuery.refetch();
      toast({ title: "Resource registered" });
    },
    onError: (error) => showMutationError("Resource creation", error),
  });
  const resourceTransitionMutation = useMutation({
    mutationFn: ({
      id,
      lifecycleState,
    }: {
      id: string;
      lifecycleState: string;
    }) => requestJson("PATCH", `${root}/resources/${id}`, { lifecycleState }),
    onSuccess: async (_, value) => {
      await operationsStateQuery.refetch();
      toast({
        title: `Resource moved to ${value.lifecycleState.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Resource transition", error),
  });

  const financialSourceMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/financial-sources`, {
        name: financeSourceName,
        legalEntityName: financeEntityName,
        accountType: financeSourceType,
        currency: "USD",
        lifecycleState:
          financeProvider && financeExternalId ? "connected" : "draft",
        ...(financeProvider && financeExternalId
          ? {
              sourceSystem: financeProvider,
              externalId: financeExternalId,
              sourceAuthority: "external_authoritative",
              reconciliationState: "pending",
              freshnessAsOf: new Date().toISOString(),
            }
          : {}),
      }),
    onSuccess: async (record) => {
      setFinanceSourceName("");
      setFinanceProvider("");
      setFinanceExternalId("");
      setFinancePlanSourceId(record.id);
      await financeStateQuery.refetch();
      toast({
        title:
          record.lifecycleState === "connected"
            ? "Financial source connected"
            : "Financial source boundary drafted",
        description:
          record.lifecycleState === "connected"
            ? "Provider identity is mapped; provider facts remain authoritative."
            : "Add a real provider account before marking it connected.",
      });
    },
    onError: (error) => showMutationError("Financial source creation", error),
  });
  const financialSourceTransitionMutation = useMutation({
    mutationFn: ({
      id,
      lifecycleState,
    }: {
      id: string;
      lifecycleState: string;
    }) =>
      requestJson("PATCH", `${root}/financial-sources/${id}`, {
        lifecycleState,
      }),
    onSuccess: async (_, value) => {
      await financeStateQuery.refetch();
      toast({
        title: `Financial source moved to ${value.lifecycleState.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Financial source transition", error),
  });

  const financialPlanMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/financial-plans`, {
        name: financePlanName,
        planType: financePlanType,
        ...(financePlanSourceId
          ? { financialSourceId: financePlanSourceId }
          : {}),
        periodStart: new Date(
          `${financePlanStart}T00:00:00.000Z`,
        ).toISOString(),
        periodEnd: new Date(`${financePlanEnd}T00:00:00.000Z`).toISOString(),
        currency: "USD",
        plannedAmount: Number(financePlanAmount),
        assumptions: [financePlanAssumption],
        lineItems: [
          {
            name: financePlanLineName,
            amount: Number(financePlanLineAmount),
            category: financePlanType,
            assumption: financePlanAssumption,
          },
        ],
      }),
    onSuccess: async (record) => {
      setFinancePlanName("");
      setFinancePlanAmount("");
      setFinancePlanAssumption("");
      setFinancePlanLineName("");
      setFinancePlanLineAmount("");
      setAllocationPlanId(record.id);
      await financeStateQuery.refetch();
      toast({
        title: "Financial plan drafted",
        description:
          "Review and approve its explicit assumptions before using it for allocation.",
      });
    },
    onError: (error) => showMutationError("Financial plan creation", error),
  });
  const financialPlanTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/financial-plans/${id}`, { state }),
    onSuccess: async (_, value) => {
      await financeStateQuery.refetch();
      toast({
        title: `Financial plan moved to ${value.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Financial plan transition", error),
  });
  const financialPlanReconcileMutation = useMutation({
    mutationFn: (id: string) =>
      requestJson("POST", `${root}/financial-plans/${id}/reconcile`, {
        sourceValueFlowIds: financeReconcileFlowIds,
        evidenceIds: financeReconcileEvidenceIds,
        actualAmount: Number(financeReconcileActual),
        note: "The accountable operator declared this observed amount from the explicitly selected authoritative financial flows and verified evidence; EOS did not infer accounting signs or ledger treatment.",
      }),
    onSuccess: async () => {
      setFinanceReconcileFlowIds([]);
      setFinanceReconcileEvidenceIds([]);
      setFinanceReconcileActual("");
      await financeStateQuery.refetch();
      toast({
        title: "Financial plan reconciled",
        description:
          "Actual and variance are tied to the selected source facts and evidence.",
      });
    },
    onError: (error) =>
      showMutationError("Financial plan reconciliation", error),
  });

  const capitalAllocationMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/capital-allocations`, {
        name: allocationName,
        allocationType,
        financialPlanId: allocationPlanId,
        targetType: "operating_target",
        targetKey: allocationTarget,
        amount: Number(allocationAmount),
        currency: "USD",
        rationale: allocationRationale,
        expectedOutcome: allocationOutcome,
        downsideRisk: allocationRisk,
        ...(allocationWorkPacketId
          ? { workPacketId: allocationWorkPacketId }
          : {}),
      }),
    onSuccess: async () => {
      setAllocationName("");
      setAllocationTarget("");
      setAllocationAmount("");
      setAllocationRationale("");
      setAllocationOutcome("");
      setAllocationRisk("");
      await financeStateQuery.refetch();
      toast({
        title: "Capital allocation proposed",
        description: "This is a governed proposal, not movement of funds.",
      });
    },
    onError: (error) => showMutationError("Capital allocation proposal", error),
  });
  const capitalAllocationTransitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/capital-allocations/${id}`, { state }),
    onSuccess: async (_, value) => {
      await financeStateQuery.refetch();
      toast({
        title: `Allocation moved to ${value.state.replaceAll("_", " ")}`,
      });
    },
    onError: (error) =>
      showMutationError("Capital allocation transition", error),
  });

  const financeObligationMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/risks-controls`, {
        title: financeObligationTitle,
        descriptionCauseEventImpact: financeObligationDescription,
        recordType: "obligation",
        capabilityProcessAssetKey: `finance:${companyId}`,
      }),
    onSuccess: async () => {
      setFinanceObligationTitle("");
      setFinanceObligationDescription("");
      await Promise.all([
        commandStateQuery.refetch(),
        financeStateQuery.refetch(),
      ]);
      toast({
        title: "Financial obligation recorded",
        description:
          "It now uses the shared Risk, Obligation & Control registry.",
      });
    },
    onError: (error) =>
      showMutationError("Financial obligation creation", error),
  });

  const packetMutation = useMutation({
    mutationFn: () =>
      requestJson("POST", `${root}/work-packets`, {
        title: packetTitle,
        objective: packetObjective,
        priority: "medium",
        requiresApproval: packetApproval,
        toolPack: [],
        evidenceRequirements: packetEvidenceRequirements,
        source: "manual",
        ...(packetCapabilityId
          ? { capabilityInstanceId: packetCapabilityId }
          : {}),
        ...(packetProcessId ? { processDefinitionId: packetProcessId } : {}),
        resourceIds: packetResourceIds,
        expectedOutput: packetExpectedOutput,
        acceptanceCriteria: packetAcceptanceCriteria,
      }),
    onSuccess: async () => {
      setPacketTitle("");
      setPacketObjective("");
      setPacketCapabilityId("");
      setPacketProcessId("");
      setPacketResourceIds([]);
      setPacketExpectedOutput("");
      setPacketAcceptanceCriteria("");
      setPacketEvidenceRequirements([
        "A reviewable artifact or observed outcome",
      ]);
      await refresh();
      toast({
        title: "Work Packet created",
        description: packetApproval
          ? "It is waiting for local approval."
          : "It is ready to start.",
      });
    },
    onError: (error) => showMutationError("Work Packet creation", error),
  });

  const requestScopedWorkMutation = useMutation({
    mutationFn: ({
      title,
      objective,
      evidenceRequirement,
    }: {
      title: string;
      objective: string;
      evidenceRequirement: string;
    }) =>
      requestJson<JsonRecord>("POST", `${root}/work-packets`, {
        title: title.slice(0, 200),
        objective: objective.slice(0, 2000),
        priority: "medium",
        requiresApproval: true,
        toolPack: [],
        evidenceRequirements: [evidenceRequirement.slice(0, 300)],
        source: "manual",
      }),
    onSuccess: async () => {
      await refresh();
      goToSurface("work-room");
      toast({
        title: "Practice request recorded",
        description:
          "The Work Packet is waiting for approval through your reporting chain.",
      });
    },
    onError: (error) => showMutationError("Practice request", error),
  });

  const approvalMutation = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "approved" | "rejected";
      reason?: string;
    }) =>
      requestJson("POST", `${root}/approvals/${id}/decide`, {
        decision,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: async (_, variables) => {
      setDecisionDraft(null);
      setDecisionReason("");
      await refresh();
      toast({
        title:
          variables.decision === "approved" ? "Work approved" : "Work rejected",
        description:
          variables.reason ||
          "The decision and resulting state change were recorded.",
      });
    },
    onError: (error) => showMutationError("Approval decision", error),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      requestJson("POST", `${root}/work-packets/${id}/transition`, { status }),
    onSuccess: async (_, variables) => {
      await refresh();
      toast({
        title: `Work moved to ${variables.status.replaceAll("_", " ")}`,
      });
    },
    onError: (error) => showMutationError("Work transition", error),
  });

  const evidenceMutation = useMutation({
    mutationFn: ({
      packetId,
      requirement,
      details,
    }: {
      packetId: string;
      requirement: string;
      details: string;
    }) =>
      requestJson("POST", `${root}/evidence`, {
        workPacketId: packetId,
        evidenceType: "artifact",
        title: requirement,
        ...(/^https:\/\/\S+$/i.test(details.trim())
          ? { uri: details.trim() }
          : {}),
        details: { capturedFrom: "eos_overlay", note: details.trim() },
        verificationState: "observed",
        confidenceQuality: "medium",
        supportedClaimSummary: requirement,
        verifierMethod:
          "Recorded by the accountable EOS operator; independent verification may still be required.",
      }),
    onSuccess: async (_, variables) => {
      setEvidenceDetails((current) => ({
        ...current,
        [variables.packetId]: "",
      }));
      await refresh();
      toast({
        title: "Required evidence recorded",
        description: variables.requirement,
      });
    },
    onError: (error) => showMutationError("Evidence recording", error),
  });

  const connectIntegrationMutation = useMutation({
    mutationFn: (integration: JsonRecord) => {
      const provider =
        integration.id === "google_workspace" ? "gmail" : integration.id;
      return requestJson<{ authUrl: string }>(
        "GET",
        `/api/integrations/${provider}/auth?returnTo=${encodeURIComponent(`/company/${companyId}#systems`)}`,
      );
    },
    onSuccess: ({ authUrl }) => window.location.assign(authUrl),
    onError: (error, integration) =>
      showMutationError(`${integration.name} connection`, error),
  });

  const disconnectIntegrationMutation = useMutation({
    mutationFn: (integration: JsonRecord) => {
      const provider =
        integration.id === "google_workspace" ? "gmail" : integration.id;
      return requestJson<{ providerRevoked?: boolean }>(
        "POST",
        `/api/integrations/${provider}/disconnect`,
        {},
      );
    },
    onSuccess: async (result, integration) => {
      await integrationsQuery.refetch();
      toast({
        title: `${integration.name} disconnected`,
        description:
          result.providerRevoked === false
            ? "The local encrypted credential was removed. Provider revocation could not be confirmed; revoke EntrepreneurOS in the provider security settings."
            : "The provider authorization and local encrypted credential were removed.",
      });
    },
    onError: (error, integration) =>
      showMutationError(`${integration.name} disconnection`, error),
  });

  const verifyIntegrationMutation = useMutation({
    mutationFn: async (integration: JsonRecord) => {
      const provider =
        integration.id === "google_workspace" ? "gmail" : integration.id;
      const status = await requestJson<JsonRecord>(
        "GET",
        `/api/integrations/${provider}/status?verify=true`,
      );
      if (!status.connected || !status.healthy)
        throw new Error(
          `${integration.name} did not pass its provider health check.`,
        );
      await integrationsQuery.refetch();
      return integration;
    },
    onSuccess: (integration) =>
      toast({
        title: `${integration.name} verified`,
        description:
          "EntrepreneurOS reached the external provider using its configured adapter.",
      }),
    onError: (error, integration) =>
      showMutationError(`${integration.name} verification`, error),
  });

  const eaMessageMutation = useMutation({
    mutationFn: async (content: string) =>
      requestJson<{ response: string }>(
        "POST",
        `${root}/executive-assistant/messages`,
        { content },
      ),
    onSuccess: async ({ response }) => {
      setEaMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        },
      ]);
      await communicationQuery.refetch();
    },
    onError: (error) => showMutationError(`${assistantName} message`, error),
  });

  const providerExecutionMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/work-packets/${providerPacketId}/provider-executions`,
        {
          provider: "gmail",
          operation: "gmail.send_with_local_approval",
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        },
      ),
    onSuccess: async () => {
      setEmailTo("");
      setEmailSubject("");
      setEmailBody("");
      await refresh();
      toast({
        title: "Gmail effect submitted",
        description:
          "It is waiting in the local authority queue before provider delivery.",
      });
    },
    onError: (error) => showMutationError("Gmail execution request", error),
  });

  const seatMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/seats`, {
        title: seatTitle.trim(),
        kind: seatKind,
        agentName: seatAgentName.trim(),
        ...(seatSupervisorId ? { supervisorSeatId: seatSupervisorId } : {}),
        mandate: `Operate the ${seatTitle.trim()} seat within its delegated authority.`,
        authority: {
          approval: "supervisor",
          visibility: seatKind === "manager" ? "reporting_tree" : "seat",
        },
        toolEntitlements: [],
      }),
    onSuccess: async (seat) => {
      setSeatTitle("");
      setSeatAgentName("");
      setMembershipSeatId(seat.id);
      await refresh();
      toast({
        title: "Organizational seat created",
        description: `${seat.title} now has its own Role Agent and reporting position.`,
      });
    },
    onError: (error) => showMutationError("Seat creation", error),
  });

  const membershipMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/invitations`, {
        email: membershipEmail.trim().toLowerCase(),
        seatId: membershipSeatId,
        purpose: "operate",
        classificationCeiling: "internal",
        portfolioScope: membershipPortfolioScope,
      }),
    onSuccess: async () => {
      setMembershipEmail("");
      setMembershipPortfolioScope(false);
      await refresh();
      toast({
        title: "Invitation sent",
        description:
          "The seat remains unoccupied until the recipient signs in and accepts the role.",
      });
    },
    onError: (error) => showMutationError("Invitation", error),
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/invitations/${invitationId}/revoke`,
      ),
    onSuccess: async () => {
      await refresh();
      toast({
        title: "Invitation revoked",
        description: "The invitation can no longer grant access.",
      });
    },
    onError: (error) => showMutationError("Invitation revocation", error),
  });

  const memberAdministrationMutation = useMutation({
    mutationFn: ({
      membershipId,
      action,
      seatId,
      classificationCeiling,
    }: {
      membershipId: string;
      action: "suspend" | "reactivate" | "reassign" | "change_access";
      seatId?: string;
      classificationCeiling?: string;
    }) =>
      requestJson<JsonRecord>("PATCH", `${root}/memberships/${membershipId}`, {
        action,
        ...(seatId ? { seatId } : {}),
        ...(classificationCeiling ? { classificationCeiling } : {}),
      }),
    onSuccess: async (_, variables) => {
      await refresh();
      toast({
        title: `Team member ${variables.action.replaceAll("_", " ")}`,
        description:
          "The seat, access state, and audit record were updated together.",
      });
    },
    onError: (error) => showMutationError("Team administration", error),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (membershipId: string) =>
      requestJson<JsonRecord>("DELETE", `${root}/memberships/${membershipId}`),
    onSuccess: async () => {
      await refresh();
      toast({
        title: "Team member removed",
        description:
          "Organization access ended and the Role Agent returned to autonomous mode.",
      });
    },
    onError: (error) => showMutationError("Team member removal", error),
  });

  const identityPolicyMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("PUT", `${root}/identity-policy`, {
        allowedEmailDomains: identityDomains
          .split(",")
          .map((domain) => domain.trim().toLowerCase())
          .filter(Boolean),
        allowExternalCollaborators,
      }),
    onSuccess: async () => {
      await refresh();
      toast({
        title: "Identity policy saved",
        description:
          "Future invitations now enforce the configured employee domains and external-collaborator rule.",
      });
    },
    onError: (error) => showMutationError("Identity policy", error),
  });

  const authoritySubjectMutation = useMutation({
    mutationFn: () => {
      const principalId = String(principalContext?.principalId || "");
      const memberPrincipalIds = authoritySubjectMembers
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const subjectKey =
        authoritySubjectKey.trim() ||
        `${authoritySubjectType}:${authoritySubjectName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}`;
      const common = {
        subjectType: authoritySubjectType,
        subjectKey,
        displayName: authoritySubjectName.trim(),
        ...(authoritySubjectSeatId ? { seatId: authoritySubjectSeatId } : {}),
        ...(authoritySubjectExternalKey.trim()
          ? { externalIdentityKey: authoritySubjectExternalKey.trim() }
          : {}),
        sourceAuthority: authoritySubjectSource.trim(),
        classificationCeiling: authoritySubjectClassification,
        evidenceReferences: authoritySubjectEvidence.trim()
          ? [authoritySubjectEvidence.trim()]
          : [],
        reviewAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
      if (authoritySubjectType === "agent")
        return requestJson<JsonRecord>("POST", `${root}/authority-subjects`, {
          ...common,
          agentClass: authoritySubjectParentId ? "sub_agent" : "advisor_agent",
          ...(authoritySubjectParentId
            ? { parentSubjectId: authoritySubjectParentId }
            : {}),
          identityAttributes: {
            operatingMode: authoritySubjectParentId
              ? "approval_gated"
              : "advisory",
            workforceRoleMode: authoritySubjectParentId
              ? "nested_specialist"
              : "primary_role_operator",
            memoryScope: authoritySubjectDetail.trim(),
            modelRuntime: "configured_reasoning_gateway",
            humanFallbackUserId: principalId,
            permittedTools: [],
          },
        });
      if (authoritySubjectType === "team")
        return requestJson<JsonRecord>("POST", `${root}/authority-subjects`, {
          ...common,
          identityAttributes: {
            teamKind: "functional",
            memberPrincipalIds: memberPrincipalIds.length
              ? memberPrincipalIds
              : [principalId],
            charterReference: authoritySubjectDetail.trim(),
            decisionMode: "manager",
          },
        });
      if (authoritySubjectType === "provider")
        return requestJson<JsonRecord>("POST", `${root}/authority-subjects`, {
          ...common,
          identityAttributes: {
            providerKind: "vendor",
            legalName: authoritySubjectName.trim(),
            agreementReference: authoritySubjectDetail.trim(),
            providerSystemKeys: [],
          },
        });
      if (authoritySubjectType === "service_account")
        return requestJson<JsonRecord>("POST", `${root}/authority-subjects`, {
          ...common,
          identityAttributes: {
            providerKey: authoritySubjectExternalKey.trim(),
            externalAccountReference: authoritySubjectDetail.trim(),
            environment: authoritySubjectEnvironment,
            credentialReference: authoritySubjectCredentialReference.trim(),
            rotationOwnerUserId: principalId,
          },
        });
      return requestJson<JsonRecord>("POST", `${root}/authority-subjects`, {
        ...common,
        identityAttributes: {
          bodyKind: "committee",
          charterReference: authoritySubjectDetail.trim(),
          memberPrincipalIds: memberPrincipalIds.length
            ? memberPrincipalIds
            : [principalId],
          quorum: 1,
          conflictPolicyReference: authoritySubjectEvidence.trim(),
        },
      });
    },
    onSuccess: async (subject) => {
      setAuthoritySubjectName("");
      setAuthoritySubjectKey("");
      setAuthoritySubjectSeatId("");
      setAuthoritySubjectParentId("");
      setAuthoritySubjectExternalKey("");
      setAuthoritySubjectSource("");
      setAuthoritySubjectEvidence("");
      setAuthoritySubjectDetail("");
      setAuthoritySubjectMembers("");
      setAuthoritySubjectCredentialReference("");
      await refresh();
      toast({
        title: "Canonical subject registered",
        description: `${subject.displayName} is awaiting evidence-backed verification before it can receive active authority.`,
      });
    },
    onError: (error) =>
      showMutationError("Authority subject registration", error),
  });

  const authoritySubjectTransitionMutation = useMutation({
    mutationFn: ({
      subjectId,
      action,
    }: {
      subjectId: string;
      action: "verify" | "activate" | "review" | "suspend" | "retire";
    }) => {
      const evidenceReferences = authoritySubjectLifecycleEvidence.trim()
        ? [authoritySubjectLifecycleEvidence.trim()]
        : [];
      const reviewAt = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const body =
        action === "verify"
          ? { action, evidenceReferences, reviewAt }
          : action === "activate"
            ? { action, evidenceReferences, reviewAt }
            : action === "review"
              ? { action, evidenceReferences, reviewAt }
              : {
                  action,
                  reason: `Canonical subject lifecycle action '${action}' recorded by an organization administrator.`,
                  evidenceReferences,
                };
      return requestJson<JsonRecord>(
        "PATCH",
        `${root}/authority-subjects/${subjectId}`,
        body,
      );
    },
    onSuccess: async (subject, variables) => {
      await refresh();
      toast({
        title: `Subject ${variables.action.replaceAll("_", " ")}`,
        description: `${subject.displayName} and every dependent Authority Grant were updated under the governed lifecycle.`,
      });
    },
    onError: (error) => showMutationError("Authority subject lifecycle", error),
  });

  const authorityGrantMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("POST", `${root}/authority-grants`, {
        authorityKey: `${authorityGranteeType}:${authorityGranteeType === "seat" ? authoritySeatId : selectedAuthoritySubject?.subjectKey}:${authorityResource}:${crypto.randomUUID()}`,
        granteeType: authorityGranteeType,
        granteeKey:
          authorityGranteeType === "seat"
            ? authoritySeatId
            : selectedAuthoritySubject?.subjectKey,
        ...(authorityTargetSeatId ? { seatId: authorityTargetSeatId } : {}),
        effect: authorityEffect,
        authorityClasses: authorityClassDraft,
        actionResourceScope: {
          companyId: Number(companyId),
          ...(authorityTargetSeatId ? { seatId: authorityTargetSeatId } : {}),
          resource: authorityResource,
        },
        ceilingThreshold: {
          classification: authorityClassification,
          consequence: authorityConsequence,
          ...(authorityMaxAmount
            ? {
                maxAmount: Number(authorityMaxAmount),
                currency: authorityCurrency,
              }
            : {}),
          ...(["organization", "authority_subject"].includes(
            authorityResource,
          ) && authorityMinimizeProtectedFields
            ? { fieldTransformRules: organizationRegistryFieldTransformRules }
            : {}),
        },
        conditionRules:
          Number(authorityEvidenceMinimum) > 0
            ? [
                {
                  type: "evidence_minimum",
                  count: Number(authorityEvidenceMinimum),
                },
              ]
            : [],
        approvalPolicy: {
          minimumApprovals: Number(authorityMinimumApprovals),
          approverSeatIds: [],
          approverAuthorityClasses: ["approve"],
          disallowRequester: true,
          requireDistinctPrincipals: true,
          requireDistinctSeats: authorityRequireDistinctSeat,
        },
        separationOfDuties: authorityClassDraft.includes("approve")
          ? [
              {
                authorityClass: "approve",
                distinctFrom: ["initiator"],
                requireDistinctSeat: authorityRequireDistinctSeat,
              },
            ]
          : [],
        policyDecisionSource: authorityPolicySource.trim(),
        ...(authorityEffectiveUntil
          ? { effectiveUntil: new Date(authorityEffectiveUntil).toISOString() }
          : {}),
        ...(authorityReviewAt
          ? { reviewAt: new Date(authorityReviewAt).toISOString() }
          : {}),
        activate: activateAuthorityGrant,
      }),
    onSuccess: async (grant) => {
      setAuthorityClassDraft(["view"]);
      setAuthorityEffect("allow");
      setAuthorityClassification("internal");
      setAuthorityConsequence("routine");
      setAuthorityMaxAmount("");
      setAuthorityMinimumApprovals("0");
      setAuthorityEvidenceMinimum("0");
      setAuthorityRequireDistinctSeat(false);
      setAuthorityMinimizeProtectedFields(true);
      setAuthorityPolicySource("");
      setAuthorityEffectiveUntil("");
      setAuthorityReviewAt("");
      setActivateAuthorityGrant(false);
      await refresh();
      toast({
        title: `Authority Grant ${grant.state}`,
        description:
          "The bounded grant and its policy lineage are now visible in the organization registry.",
      });
    },
    onError: (error) => showMutationError("Authority Grant creation", error),
  });

  const authorityTransitionMutation = useMutation({
    mutationFn: ({
      grantId,
      state,
      reviewAt,
    }: {
      grantId: string;
      state: "active" | "suspended" | "revoked";
      reviewAt?: string;
    }) =>
      requestJson<JsonRecord>("PATCH", `${root}/authority-grants/${grantId}`, {
        state,
        reason: `Authority lifecycle changed to ${state} by an organization administrator.`,
        ...(reviewAt ? { reviewAt } : {}),
      }),
    onSuccess: async (_, variables) => {
      await refresh();
      toast({
        title: `Authority Grant ${variables.state}`,
        description:
          "Effective permissions were recalculated from the recorded grant state.",
      });
    },
    onError: (error) => showMutationError("Authority Grant transition", error),
  });

  const assistantNameMutation = useMutation({
    mutationFn: async (name: string) =>
      requestJson<JsonRecord>("PATCH", `/api/company/${companyId}`, {
        assistantName: name.trim(),
      }),
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData<JsonRecord>(
        [root, roleScopeKey, "context"],
        (current) =>
          current
            ? {
                ...current,
                company: updatedCompany,
                principalContext: current.principalContext
                  ? {
                      ...current.principalContext,
                      communicationAgent:
                        updatedCompany.assistantName || "Assistant",
                    }
                  : current.principalContext,
              }
            : current,
      );
      setAssistantNameDraft(updatedCompany.assistantName || "Assistant");
      setIsEditingAssistantName(false);
      toast({
        title: "Executive Assistant renamed",
        description: `Your communication agent is now ${updatedCompany.assistantName}.`,
      });
    },
    onError: (error) => showMutationError("Executive Assistant rename", error),
  });

  const aiBudgetMutation = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>("PUT", `${root}/ai-budget`, {
        monthlyLimitDollars: Number(monthlyAiBudget),
        perRequestLimitDollars: Number(perRequestAiBudget),
        enabled: aiBudgetEnabled,
      }),
    onSuccess: async () => {
      await Promise.all([aiBudgetQuery.refetch(), auditQuery.refetch()]);
      toast({
        title: "AI spend controls saved",
        description:
          "The monthly and per-request limits are now enforced by the EOS AI gateway.",
      });
    },
    onError: (error) => showMutationError("AI spend control update", error),
  });

  const saveAssistantName = () => {
    const nextName = assistantNameDraft.trim();
    if (
      !nextName ||
      nextName === assistantName ||
      assistantNameMutation.isPending
    ) {
      if (nextName === assistantName) setIsEditingAssistantName(false);
      return;
    }
    assistantNameMutation.mutate(nextName);
  };

  const sendEaMessage = (content: string) => {
    setEaMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() },
    ]);
    eaMessageMutation.mutate(content);
    window.dispatchEvent(new Event("eos:open-communication"));
  };

  const goToSurface = (surface: string) => {
    setActiveTab(surface);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${surface}`,
    );
  };

  const openCommunication = () =>
    window.dispatchEvent(new Event("eos:open-communication"));

  const requestApprovalDecision = (
    approval: JsonRecord,
    decision: "approved" | "rejected",
  ) => {
    setDecisionReason("");
    setDecisionDraft({ id: approval.id, summary: approval.summary, decision });
  };

  const prepareWorkPacket = (
    title: string,
    objective: string,
    evidenceRequirement = "A reviewable artifact or observed outcome",
  ) => {
    setPacketTitle(title.slice(0, 200));
    setPacketObjective(objective.slice(0, 2000));
    setPacketEvidenceRequirements([evidenceRequirement.slice(0, 300)]);
    goToSurface("operations");
    toast({
      title: "Work Packet prepared",
      description:
        "Review the objective and authority gate, then create it when ready.",
    });
  };

  const requestSupervisorWork = (
    title: string,
    objective: string,
    evidenceRequirement = "Supervisor-reviewed output and named evidence",
  ) => {
    requestScopedWorkMutation.mutate({ title, objective, evidenceRequirement });
  };

  const startRolePractice = () => {
    const title = `Seat practice: ${principalContext?.seat || "active role"}`;
    const objective = `Complete a practical exercise for the ${principalContext?.seat || "active role"}, record evidence, and request supervisor review.`;
    if (practiceAction === "prepare_work")
      return prepareWorkPacket(
        title,
        objective,
        "Supervisor-reviewed output and named evidence",
      );
    if (practiceAction === "open_assigned_work")
      return goToSurface("work-room");
    requestSupervisorWork(title, objective);
  };

  const promoteAssistantMessage = (message: ChatMessage) => {
    if (allowedSurfaces.has("operations"))
      return prepareWorkPacket(
        `${assistantName} recommendation`,
        message.content,
      );
    requestSupervisorWork(
      `${assistantName} recommendation`,
      message.content,
      "Supervisor decision and reviewed outcome",
    );
  };

  const openModule = (module: EosActiveModule) => {
    setSelectedModuleId(module.id);
    goToSurface("modules");
    window.requestAnimationFrame(() =>
      document
        .getElementById("module-workspace")
        ?.scrollIntoView({ behavior: "auto", block: "start" }),
    );
  };

  const nextTransition = (status: string): string | undefined =>
    ({
      ready: "in_progress",
      in_progress: "in_review",
      blocked: "in_progress",
      in_review: "completed",
    })[status];
  const nextManifestStatus = (status?: string): string | undefined =>
    (
      ({
        draft: "diagnostic",
        diagnostic: "proposed",
        proposed: "review",
        review: "approved",
        approved: "provisioning",
        provisioning: "verifying",
      }) as Record<string, string>
    )[status || ""];
  const nav = useMemo(
    () =>
      [
        {
          icon: Home,
          label: "Home",
          href: `#home`,
          active: activeTab === "home",
        },
        {
          icon: Command,
          label: "Command",
          href: `#command`,
          active: activeTab === "command",
        },
        {
          icon: Network,
          label: "Organization",
          href: `#organization`,
          active: activeTab === "organization",
        },
        {
          icon: UserRound,
          label: "Talent",
          href: `#talent`,
          active: activeTab === "talent",
        },
        {
          icon: UserRound,
          label: "Workforce",
          href: `#workforce`,
          active: activeTab === "workforce",
        },
        {
          icon: UserRound,
          label: "My Role",
          href: `#my-role`,
          active: activeTab === "my-role",
        },
        {
          icon: Blocks,
          label: "Modules",
          href: `#modules`,
          active: activeTab === "modules",
        },
        {
          icon: BriefcaseBusiness,
          label: "Stakeholder / Commercial",
          href: `#commercial`,
          active: activeTab === "commercial",
          status: "overlay",
        },
        {
          icon: Workflow,
          label: "Operations",
          href: `#operations`,
          active: activeTab === "operations",
        },
        {
          icon: BriefcaseBusiness,
          label: "Work Room",
          href: `#work-room`,
          active: activeTab === "work-room",
        },
        {
          icon: ClipboardCheck,
          label: "Review Room",
          href: `#review`,
          active: activeTab === "review",
        },
        {
          icon: BookOpen,
          label: "Academy",
          href: `#academy`,
          active: activeTab === "academy",
        },
        {
          icon: Map,
          label: "Portfolio Map",
          href: `#portfolio-map`,
          active: activeTab === "portfolio-map",
        },
        {
          icon: Landmark,
          label: "Capital & Investor Relations",
          href: `#capital`,
          active: activeTab === "capital",
          status: "dormant",
        },
        {
          icon: Bot,
          label: "Intelligence",
          href: `#intelligence`,
          active: activeTab === "intelligence",
        },
        {
          icon: Blocks,
          label: "Systems",
          href: `#systems`,
          active: activeTab === "systems",
        },
      ].filter((item) => allowedSurfaces.has(item.href.slice(1))),
    [activeTab, principalContext?.role],
  );

  const commandTransitionPending =
    objectiveTransitionMutation.isPending ||
    metricOutcomeTransitionMutation.isPending ||
    riskControlTransitionMutation.isPending;
  const confirmCommandTransition = () => {
    if (!commandTransitionDraft) return;
    const input = {
      id: commandTransitionDraft.id,
      state: commandTransitionDraft.state,
    };
    if (commandTransitionDraft.kind === "objective")
      objectiveTransitionMutation.mutate(input);
    else if (commandTransitionDraft.kind === "metric_outcome")
      metricOutcomeTransitionMutation.mutate(input);
    else riskControlTransitionMutation.mutate(input);
  };

  if (contextQuery.isLoading)
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Loading EOS context…
      </div>
    );
  if (contextQuery.error || !company)
    return (
      <main className="min-h-screen bg-[#f5f6f7] px-4 py-10 sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
          <Card className="w-full border-0 p-7 shadow-[0_8px_32px_rgba(106,55,212,0.08)] sm:p-10">
            <p className="eos-label">Organization</p>
            <h1 className="mt-3 text-2xl font-semibold">
              This workspace is unavailable
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The organization may have moved from a legacy account, may no
              longer exist, or may be outside your verified authority scope.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => contextQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button asChild variant="secondary">
                <Link href="/portfolios">Choose an organization</Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );

  const intelligenceRail = (
    <div className="flex h-full min-h-0 flex-col bg-white/45">
      <div className="flex-shrink-0 border-b border-border/70 px-3 py-2.5 pr-11 xl:pr-3">
        {isFounder && isEditingAssistantName ? (
          <div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveAssistantName();
              }}
              className="flex min-w-0 items-center gap-1"
            >
              <Input
                value={assistantNameDraft}
                onChange={(event) => setAssistantNameDraft(event.target.value)}
                maxLength={40}
                autoFocus
                disabled={assistantNameMutation.isPending}
                aria-label="Executive Assistant name"
                className="h-8 min-w-0 flex-1 px-2 text-xs"
              />
              <button
                type="submit"
                disabled={
                  !assistantNameDraft.trim() || assistantNameMutation.isPending
                }
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                aria-label="Save Executive Assistant name"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={assistantNameMutation.isPending}
                onClick={() => {
                  setAssistantNameDraft(assistantName);
                  setIsEditingAssistantName(false);
                }}
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Cancel renaming"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              Rename Executive Assistant
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessagesSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <h2 className="truncate text-sm font-semibold">
                  {assistantName}
                </h2>
                {isFounder && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAssistantName(true)}
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={`Rename ${assistantName}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {isFounder
                  ? "Executive Assistant · founder channel"
                  : "Role Agent · personal assistant mode"}
              </p>
            </div>
            <span
              className="hidden h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500 xl:block"
              title="Communication available"
            />
          </div>
        )}
        <div className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden">
          {isFounder && (
            <Badge
              variant="secondary"
              className="h-5 flex-shrink-0 px-1.5 text-[9px]"
            >
              15 advisors
            </Badge>
          )}
          <Badge
            variant="outline"
            className="h-5 min-w-0 truncate px-1.5 text-[9px]"
          >
            {principalContext?.seat || "Active seat"}
          </Badge>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <AgentChatStub
          messages={eaMessages}
          onSendMessage={sendEaMessage}
          onPromoteMessage={promoteAssistantMessage}
          promoteLabel={
            allowedSurfaces.has("operations")
              ? "Turn into work"
              : "Request supervisor approval"
          }
          suggestions={["Brief me", "Prioritize work", "Prepare a decision"]}
          isLoading={eaMessageMutation.isPending}
          placeholder={`Message ${assistantName}…`}
          assistantName={assistantName}
          compact
          className="h-full shadow-none"
        />
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5 border-t border-border/70 px-3 py-1.5 text-[9px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3 flex-shrink-0 text-primary" />
        <span className="truncate">
          EOS authority · advice is not execution
        </span>
      </div>
    </div>
  );

  const sectionTitle: Record<string, string> = {
    home: "Home",
    command: "Command",
    organization: "Organization",
    talent: "Talent",
    workforce: "Workforce",
    "my-role": "My Role",
    modules: "Modules",
    commercial: "Stakeholder / Commercial",
    operations: "Operations",
    "work-room": "Work Room",
    review: "Review Room",
    academy: "Academy",
    "portfolio-map": "Portfolio Map",
    capital: "Capital & Investor Relations",
    intelligence: "Intelligence",
    systems: "Systems",
  };
  const sectionDescription: Record<string, string> = {
    home: "See priorities, decisions, and the next move at a glance.",
    command: "Direct work, resolve constraints, and keep execution moving.",
    organization: "Shape the structure, authority, and operating rules.",
    talent: "Turn capability gaps into fair, evidence-backed placements.",
    workforce: "Develop people, review role outcomes, and protect continuity.",
    "my-role": "Know your scope, responsibilities, and next actions.",
    modules: "Enter a business function and move it through governed work.",
    commercial: "Turn market signals into accountable commercial action.",
    operations: "Create, assign, and advance evidence-backed work.",
    "work-room": "Move active work from intent to verified outcome.",
    review: "Approve, reject, and audit consequential decisions.",
    academy: "Build role mastery through real, evidence-backed practice.",
    "portfolio-map": "See the portfolio structure within your authority scope.",
    capital:
      "Prepare the dormant investor-relations architecture without implying financial authority.",
    intelligence: `Work with ${assistantName} to turn context into clear decisions.`,
    systems: "Connect providers and control how EOS operates.",
  };
  const pendingApprovalCount = pendingApprovals.length;
  const operatingStateReady =
    manifest?.status !== "active" ||
    (packetsQuery.isSuccess && approvalsQuery.isSuccess);
  const operatingStateFailed =
    manifest?.status === "active" &&
    (packetsQuery.isError || approvalsQuery.isError);
  const nextActionReason: EosNextActionReason =
    pendingApprovalCount
      ? "approval"
      : manifest?.status !== "active"
        ? "organization_setup"
        : activePackets.length
          ? "active_work"
          : "new_work";
  const nextActionTarget =
    operatingStateReady && principalContext?.role
      ? nextUsableSurfaceFor(principalContext.role, nextActionReason)
      : undefined;
  const nextAction = !operatingStateReady
    ? operatingStateFailed
      ? "Retry workspace data"
      : "Loading current priorities"
    : nextActionReason === "organization_setup"
      ? nextActionTarget === "organization"
        ? `Advance the organization manifest${manifest?.status ? ` from ${manifest.status.replaceAll("_", " ")}` : ""}`
        : "Escalate organization setup through your reporting path"
      : nextActionReason === "approval"
        ? nextActionTarget === "review"
          ? "Review pending approvals"
          : "Advance assigned work within your authority"
        : nextActionReason === "active_work"
          ? "Advance the highest-priority Work Packet"
          : nextActionTarget === "operations"
            ? "Create the next evidence-bearing mission"
            : `Ask ${assistantName} for the next authorized action`;
  const nextActionLabel = !operatingStateReady
    ? operatingStateFailed
      ? "Retry next action"
      : "Loading next action…"
    : nextActionReason === "organization_setup" &&
        nextActionTarget === "organization"
      ? "Continue organization setup"
      : nextActionReason === "approval" && nextActionTarget === "review"
        ? `Review ${pendingApprovalCount} pending decision${pendingApprovalCount === 1 ? "" : "s"}`
        : nextActionTarget === "work-room"
          ? "Open assigned work"
          : nextActionTarget === "operations"
            ? "Create a mission"
            : nextActionTarget === "intelligence"
              ? `Ask ${assistantName}`
              : "Review my role";
  const NextActionIcon = !operatingStateReady
    ? RefreshCw
    : nextActionTarget === "organization"
      ? Network
      : nextActionTarget === "review"
        ? ClipboardCheck
        : nextActionTarget === "work-room"
          ? BriefcaseBusiness
          : nextActionTarget === "intelligence"
            ? MessagesSquare
            : nextActionTarget === "my-role"
              ? UserRound
              : Plus;
  const runNextAction = () => {
    if (nextActionTarget) goToSurface(nextActionTarget);
    else if (operatingStateFailed) void refresh();
  };

  return (
    <UniversalLayout
      portfolioName={
        contextQuery.data?.portfolio?.name || "Independent portfolio"
      }
      portfolioHref={
        contextQuery.data?.portfolio?.id
          ? `/portfolios/${contextQuery.data.portfolio.id}`
          : "/portfolios"
      }
      companyName={company.name}
      companyHref={`/company/${companyId}`}
      roleName={principalContext?.seat || "Founder / Portfolio Principal"}
      allowedSurfaces={principalContext?.allowedSurfaces || []}
      canBrowsePortfolio
      canManageCompanySettings={principalContext?.role === "founder"}
      leftRailItems={nav}
      rightRailContent={intelligenceRail}
      floatingPanel={
        <FloatingAIPanel
          assistantName={assistantName}
          seatName={principalContext?.seat}
          openWork={activePackets.length}
          approvals={pendingApprovalCount}
          nextAction={nextAction}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Choose a controlled next step. Consequential actions still enter
              the approval and evidence lifecycle.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!operatingStateReady && !operatingStateFailed}
                onClick={runNextAction}
              >
                <NextActionIcon
                  className={`mr-1.5 h-3.5 w-3.5 ${!operatingStateReady && !operatingStateFailed ? "animate-spin" : ""}`}
                />
                {nextActionLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  sendEaMessage(
                    "Brief me on the current state, the most important risk, and the next authorized action.",
                  )
                }
              >
                <MessagesSquare className="mr-1.5 h-3.5 w-3.5" />
                Ask {assistantName}
              </Button>
            </div>
          </div>
        </FloatingAIPanel>
      }
    >
      <div className="space-y-8">
        <div>
          <div className="eos-label flex items-center gap-2">
            <Command className="h-4 w-4 text-primary" /> EOS overlay ·{" "}
            {company.stage || "MVP"}
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                {sectionTitle[activeTab]}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {sectionDescription[activeTab]}
              </p>
            </div>
            <Button
              size="icon"
              variant="secondary"
              className="h-11 w-11 flex-shrink-0 rounded-xl"
              onClick={refresh}
              disabled={isRefreshing}
              aria-label={
                isRefreshing ? "Refreshing workspace" : "Refresh workspace"
              }
              title={
                isRefreshing ? "Refreshing workspace" : "Refresh workspace"
              }
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {[
          briefQuery,
          packetsQuery,
          approvalsQuery,
          evidenceQuery,
          integrationsQuery,
          commandStateQuery,
          commercialStateQuery,
        ].some((query) => query.isError) && (
          <Alert variant="destructive">
            <AlertTitle>Some workspace data could not be loaded</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                The organization is available, but one or more operating
                surfaces need to be retried.
              </span>
              <Button size="sm" variant="outline" onClick={refresh}>
                Retry workspace data
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="sr-only">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="command">Command</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="talent">Talent</TabsTrigger>
            <TabsTrigger value="workforce">Workforce</TabsTrigger>
            <TabsTrigger value="my-role">My Role</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="work-room">Work Room</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="academy">Academy</TabsTrigger>
            <TabsTrigger value="portfolio-map">Portfolio Map</TabsTrigger>
            <TabsTrigger value="capital">Capital</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="systems">Systems</TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Morning Brief</CardTitle>
                <CardDescription>
                  {briefQuery.data?.generatedAt
                    ? `Generated ${new Date(briefQuery.data.generatedAt).toLocaleString()}`
                    : "Loading current state…"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-lg">{briefQuery.data?.headline}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!operatingStateReady && !operatingStateFailed}
                    onClick={runNextAction}
                  >
                    <NextActionIcon
                      className={`mr-2 h-4 w-4 ${!operatingStateReady && !operatingStateFailed ? "animate-spin" : ""}`}
                    />
                    {nextActionLabel}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      sendEaMessage(
                        "Brief me on today's priorities, exceptions, decisions, and the next authorized action.",
                      )
                    }
                  >
                    <MessagesSquare className="mr-2 h-4 w-4" />
                    Discuss with {assistantName}
                  </Button>
                  {operatingStateReady &&
                    allowedSurfaces.has("operations") &&
                    nextActionTarget !== "operations" && (
                      <Button
                        variant="outline"
                        onClick={() => goToSurface("operations")}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create mission
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <ListCard
                title="Priority missions"
                empty="No open missions yet."
                items={briefQuery.data?.priorities || []}
                actionLabel="Open mission"
                onSelect={() => goToSurface("operations")}
              />
              <ListCard
                title="Exceptions"
                empty="No active exceptions."
                items={briefQuery.data?.exceptions || []}
                actionLabel="Resolve"
                onSelect={() => goToSurface("review")}
              />
            </div>
          </TabsContent>

          <TabsContent value="command" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Open directives"
                value={commandStateQuery.data?.counts?.objectives || 0}
                icon={Command}
                actionLabel="Direct priorities"
                onClick={() =>
                  document
                    .getElementById("command-objectives")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Scorecard records"
                value={commandStateQuery.data?.counts?.metrics || 0}
                icon={Gauge}
                actionLabel="Open scorecard"
                onClick={() =>
                  document
                    .getElementById("command-scorecard")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Material exceptions"
                value={commandStateQuery.data?.counts?.exceptions || 0}
                icon={Activity}
                actionLabel="Open exceptions"
                onClick={() =>
                  document
                    .getElementById("command-exceptions")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Stale or missing"
                value={commandStateQuery.data?.counts?.stale || 0}
                icon={RefreshCw}
                actionLabel="Review freshness"
                onClick={() =>
                  document
                    .getElementById("command-scorecard")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
            </div>
            {!commandStateQuery.isLoading &&
              !(commandStateQuery.data?.objectives || []).length &&
              !(commandStateQuery.data?.metricsOutcomes || []).length &&
              !(commandStateQuery.data?.risksControls || []).length && (
                <Alert>
                  <Gauge className="h-4 w-4" />
                  <AlertTitle>
                    Institutional command state is not recorded yet
                  </AlertTitle>
                  <AlertDescription>
                    This is missing source state—not healthy performance. Add
                    the first objective, measurable target, or material risk
                    below.
                  </AlertDescription>
                </Alert>
              )}
            <Card>
              <CardHeader>
                <CardTitle>Organization command state</CardTitle>
                <CardDescription>
                  Purpose and phase stay compressed while the exceptions and
                  governed next moves remain actionable.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Fact label="Lifecycle stage" value={company.stage || "MVP"} />
                <Fact
                  label="Manifest"
                  value={
                    manifest
                      ? `v${manifest.version} · ${manifest.status}`
                      : "Not compiled"
                  }
                />
                <Fact
                  label="Open work"
                  value={`${contextQuery.data?.counts?.openWorkPackets || 0} Work Packet${contextQuery.data?.counts?.openWorkPackets === 1 ? "" : "s"}`}
                />
                <Fact label="Next authorized move" value={nextAction} />
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card id="command-objectives" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Objectives & constraints</CardTitle>
                  <CardDescription>
                    Direct the institution, name the boundary, then move it
                    through an explicit lifecycle.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="grid grid-cols-[9rem_1fr] gap-3">
                      <select
                        aria-label="Objective record type"
                        value={objectiveType}
                        onChange={(event) =>
                          setObjectiveType(event.target.value)
                        }
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="objective">Objective</option>
                        <option value="constraint">Constraint</option>
                        <option value="mandate">Mandate</option>
                        <option value="hypothesis">Hypothesis</option>
                        <option value="success_condition">
                          Success condition
                        </option>
                        <option value="guardrail">Guardrail</option>
                      </select>
                      <Input
                        aria-label="Objective title"
                        value={objectiveTitle}
                        onChange={(event) =>
                          setObjectiveTitle(event.target.value)
                        }
                        placeholder="What must be true?"
                      />
                    </div>
                    <Textarea
                      aria-label="Objective statement"
                      value={objectiveStatement}
                      onChange={(event) =>
                        setObjectiveStatement(event.target.value)
                      }
                      placeholder="State the intended outcome, constraint, or governing condition."
                      className="min-h-24"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        objectiveTitle.trim().length < 3 ||
                        objectiveStatement.trim().length < 3 ||
                        !effectiveAuthorityClasses.has("decide") ||
                        objectiveMutation.isPending
                      }
                      onClick={() => objectiveMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {objectiveMutation.isPending
                        ? "Recording…"
                        : "Record proposed objective"}
                    </Button>
                    {!effectiveAuthorityClasses.has("decide") && (
                      <p className="text-xs text-muted-foreground">
                        Unavailable: this operating seat lacks decision
                        authority.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {(commandStateQuery.data?.objectives || []).map(
                      (item: JsonRecord) => {
                        const nextStates = (nextObjectiveStates as any)(
                          item.state,
                        ) as string[];
                        const owner = visibleSeats.find(
                          (seat: JsonRecord) => seat.id === item.ownerSeatId,
                        );
                        return (
                          <div key={item.id} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StateBadge state={item.state} />
                              <Badge variant="outline">
                                {item.recordType.replaceAll("_", " ")}
                              </Badge>
                              <Badge
                                variant={
                                  item.freshness?.status === "current"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {item.freshness?.status || "missing"}
                              </Badge>
                            </div>
                            <p className="mt-3 font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.statement}
                            </p>
                            <p className="mt-3 text-xs text-muted-foreground">
                              Owner: {owner?.title || "Unresolved seat"} ·{" "}
                              {item.priority} priority
                            </p>
                            {nextStates.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {nextStates.map((state) => (
                                  <Button
                                    key={state}
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      !effectiveAuthorityClasses.has(
                                        "decide",
                                      ) || objectiveTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      highConsequenceCommandStates.has(state)
                                        ? setCommandTransitionDraft({
                                            kind: "objective",
                                            id: item.id,
                                            state,
                                            title: item.title,
                                          })
                                        : objectiveTransitionMutation.mutate({
                                            id: item.id,
                                            state,
                                          })
                                    }
                                  >
                                    {state.replaceAll("_", " ")}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                    {!commandStateQuery.isLoading &&
                      !(commandStateQuery.data?.objectives || []).length && (
                        <p className="text-sm text-muted-foreground">
                          No objectives or constraints have been recorded.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="command-scorecard" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Scorecard & outcomes</CardTitle>
                  <CardDescription>
                    Define targets separately from observed measurements,
                    forecasts, and verified outcomes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="grid grid-cols-[9rem_1fr] gap-3">
                      <select
                        aria-label="Metric record type"
                        value={metricType}
                        onChange={(event) => setMetricType(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="target">Target</option>
                        <option value="measurement">Measurement</option>
                        <option value="forecast">Forecast</option>
                        <option value="benchmark">Benchmark</option>
                        <option value="outcome">Outcome</option>
                        <option value="impact">Impact</option>
                      </select>
                      <Input
                        aria-label="Metric title"
                        value={metricTitle}
                        onChange={(event) => setMetricTitle(event.target.value)}
                        placeholder="Metric or outcome name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        aria-label="Metric target value"
                        type="number"
                        value={metricTarget}
                        onChange={(event) =>
                          setMetricTarget(event.target.value)
                        }
                        placeholder="Value"
                      />
                      <Input
                        aria-label="Metric unit"
                        value={metricUnit}
                        onChange={(event) => setMetricUnit(event.target.value)}
                        placeholder="Unit / currency"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        metricTitle.trim().length < 3 ||
                        metricTarget.trim() === "" ||
                        !Number.isFinite(Number(metricTarget)) ||
                        !effectiveAuthorityClasses.has("decide") ||
                        metricOutcomeMutation.isPending
                      }
                      onClick={() => metricOutcomeMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {metricOutcomeMutation.isPending
                        ? "Recording…"
                        : metricType === "target"
                          ? "Record metric target"
                          : `Record ${metricType.replaceAll("_", " ")}`}
                    </Button>
                    {!effectiveAuthorityClasses.has("decide") && (
                      <p className="text-xs text-muted-foreground">
                        Unavailable: this operating seat lacks decision
                        authority.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {(commandStateQuery.data?.metricsOutcomes || []).map(
                      (item: JsonRecord) => {
                        const nextStates = (nextMetricOutcomeStates as any)(
                          item.state,
                        ) as string[];
                        const owner = visibleSeats.find(
                          (seat: JsonRecord) => seat.id === item.ownerSeatId,
                        );
                        return (
                          <div key={item.id} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StateBadge state={item.state} />
                              <Badge variant="outline">
                                {item.recordType.replaceAll("_", " ")}
                              </Badge>
                              <Badge
                                variant={
                                  item.freshness?.status === "current"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {item.freshness?.status || "missing"}
                              </Badge>
                            </div>
                            <p className="mt-3 font-semibold">{item.title}</p>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                              <Fact
                                label="Target"
                                value={item.targetValue ?? "—"}
                              />
                              <Fact
                                label="Actual"
                                value={item.actualValue ?? "—"}
                              />
                              <Fact
                                label="Forecast"
                                value={item.forecastValue ?? "—"}
                              />
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                              {item.unitCurrency || "No unit"} · Owner:{" "}
                              {owner?.title || "Unresolved seat"}
                              {item.freshness?.asOf
                                ? ` · as of ${new Date(item.freshness.asOf).toLocaleDateString()}`
                                : " · observation missing"}
                            </p>
                            {nextStates.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {nextStates.map((state) => (
                                  <Button
                                    key={state}
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      !effectiveAuthorityClasses.has(
                                        "decide",
                                      ) ||
                                      metricOutcomeTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      highConsequenceCommandStates.has(state)
                                        ? setCommandTransitionDraft({
                                            kind: "metric_outcome",
                                            id: item.id,
                                            state,
                                            title: item.title,
                                          })
                                        : metricOutcomeTransitionMutation.mutate(
                                            { id: item.id, state },
                                          )
                                    }
                                  >
                                    {state.replaceAll("_", " ")}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                    {!commandStateQuery.isLoading &&
                      !(commandStateQuery.data?.metricsOutcomes || [])
                        .length && (
                        <p className="text-sm text-muted-foreground">
                          No scorecard definition exists. This is missing data,
                          not a green score.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="command-exceptions" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Risks, obligations & controls</CardTitle>
                  <CardDescription>
                    Capture material exposure and move it from identification
                    through treatment, evidence, and closure.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="grid grid-cols-[8rem_1fr] gap-3">
                      <select
                        aria-label="Risk record type"
                        value={riskType}
                        onChange={(event) => setRiskType(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="risk">Risk</option>
                        <option value="obligation">Obligation</option>
                        <option value="control">Control</option>
                        <option value="incident">Incident</option>
                        <option value="finding">Finding</option>
                        <option value="remediation">Remediation</option>
                      </select>
                      <Input
                        aria-label="Risk title"
                        value={riskTitle}
                        onChange={(event) => setRiskTitle(event.target.value)}
                        placeholder="What needs attention?"
                      />
                    </div>
                    <Textarea
                      aria-label="Risk description"
                      value={riskDescription}
                      onChange={(event) =>
                        setRiskDescription(event.target.value)
                      }
                      placeholder="Describe the cause, event, impact, requirement, or control."
                      className="min-h-24"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        riskTitle.trim().length < 3 ||
                        riskDescription.trim().length < 3 ||
                        !effectiveAuthorityClasses.has("execute") ||
                        riskControlMutation.isPending
                      }
                      onClick={() => riskControlMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {riskControlMutation.isPending
                        ? "Recording…"
                        : `Record ${riskType.replaceAll("_", " ")}`}
                    </Button>
                    {!effectiveAuthorityClasses.has("execute") && (
                      <p className="text-xs text-muted-foreground">
                        Unavailable: this operating seat lacks execution
                        authority.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {(commandStateQuery.data?.risksControls || []).map(
                      (item: JsonRecord) => {
                        const nextStates = (nextRiskControlStates as any)(
                          item.state,
                        ) as string[];
                        const owner = visibleSeats.find(
                          (seat: JsonRecord) => seat.id === item.ownerSeatId,
                        );
                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border p-4 ${item.overdue || item.state === "overdue_breached" ? "border-destructive/50 bg-destructive/5" : ""}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <StateBadge state={item.state} />
                              <Badge variant="outline">
                                {item.recordType.replaceAll("_", " ")}
                              </Badge>
                              {item.overdue && (
                                <Badge variant="destructive">overdue</Badge>
                              )}
                            </div>
                            <p className="mt-3 font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.descriptionCauseEventImpact}
                            </p>
                            <p className="mt-3 text-xs text-muted-foreground">
                              Owner: {owner?.title || "Unresolved seat"}
                              {item.dueReviewAt
                                ? ` · review ${new Date(item.dueReviewAt).toLocaleDateString()}`
                                : " · review date missing"}
                            </p>
                            {nextStates.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {nextStates.map((state) => {
                                  const needsDecision = [
                                    "accepted",
                                    "satisfied_closed",
                                    "superseded",
                                  ].includes(state);
                                  return (
                                    <Button
                                      key={state}
                                      size="sm"
                                      variant="outline"
                                      disabled={
                                        !effectiveAuthorityClasses.has(
                                          needsDecision ? "decide" : "execute",
                                        ) ||
                                        riskControlTransitionMutation.isPending
                                      }
                                      onClick={() =>
                                        highConsequenceCommandStates.has(state)
                                          ? setCommandTransitionDraft({
                                              kind: "risk_control",
                                              id: item.id,
                                              state,
                                              title: item.title,
                                            })
                                          : riskControlTransitionMutation.mutate(
                                              { id: item.id, state },
                                            )
                                      }
                                    >
                                      {state.replaceAll("_", " ")}
                                    </Button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                    {!commandStateQuery.isLoading &&
                      !(commandStateQuery.data?.risksControls || []).length && (
                        <p className="text-sm text-muted-foreground">
                          No risks, obligations, controls, or incidents have
                          been recorded.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="organization" className="space-y-4">
            {organizationQuery.data?.disclosureDecision?.outcome ===
              "transform_minimize" && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Minimum-necessary view applied</AlertTitle>
                <AlertDescription>
                  This seat can use the organization registry, but{" "}
                  {organizationQuery.data.disclosureDecision.transformedPaths
                    ?.length || 0}{" "}
                  protected field group
                  {organizationQuery.data.disclosureDecision.transformedPaths
                    ?.length === 1
                    ? " was"
                    : "s were"}{" "}
                  omitted or redacted under its active data ceiling. The
                  immutable policy receipt remains available below.
                </AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Organization Compiler</CardTitle>
                <CardDescription>
                  Compile current company intent into a versioned manifest.
                  Activation is an explicit local owner decision.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <Fact label="Stage" value={company.stage || "MVP"} />
                  <Fact
                    label="Offer"
                    value={company.offer || "Needs definition"}
                  />
                  <Fact
                    label="Target customer"
                    value={company.targetCustomer || "Needs definition"}
                  />
                  <Fact
                    label="Goal source"
                    value={
                      company.goals || "First repeatable customer-value loop"
                    }
                  />
                </div>
                {manifest ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-5">
                    <div>
                      <div className="font-medium">
                        Manifest v{manifest.version}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {manifest.status === "active"
                          ? "Authoritative local organization contract"
                          : "Compiler lifecycle requires explicit review, provisioning, and verification"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StateBadge state={manifest.status} />
                      {nextManifestStatus(manifest.status) && (
                        <Button
                          onClick={() =>
                            manifestTransitionMutation.mutate({
                              id: manifest.id,
                              status: nextManifestStatus(manifest.status)!,
                            })
                          }
                          disabled={manifestTransitionMutation.isPending}
                        >
                          Advance to{" "}
                          {nextManifestStatus(manifest.status)!.replaceAll(
                            "_",
                            " ",
                          )}
                        </Button>
                      )}
                      {manifest.status === "verifying" && (
                        <Button
                          onClick={() => activateMutation.mutate(manifest.id)}
                          disabled={activateMutation.isPending}
                        >
                          {activateMutation.isPending
                            ? "Activating…"
                            : "Activate verified manifest"}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>No manifest compiled</AlertTitle>
                    <AlertDescription>
                      The app is usable, but organizational defaults have not
                      yet been made explicit.
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  onClick={() => compilerMutation.mutate()}
                  disabled={compilerMutation.isPending}
                >
                  {compilerMutation.isPending
                    ? "Compiling…"
                    : manifest
                      ? "Compile next draft"
                      : "Compile organization draft"}
                </Button>
                {isFounder &&
                  availableCompanyPackages.map(
                    (packageDefinition: JsonRecord) => {
                      const installed = Boolean(packageDefinition.installed);
                      const blockerCount = Array.isArray(
                        packageDefinition.activationBlockers,
                      )
                        ? packageDefinition.activationBlockers.length
                        : 0;
                      return (
                        <div
                          key={String(packageDefinition.packageKey)}
                          className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="max-w-2xl">
                              <div className="flex items-center gap-2">
                                <Blocks className="h-4 w-4 text-primary" />
                                <p className="font-semibold">
                                  {packageDefinition.operatingName} reference
                                  instance
                                </p>
                                <StateBadge
                                  state={installed ? "compiled" : "available"}
                                />
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Compile the validated company package, role and
                                agent graph, capabilities, workflows, provider
                                declarations, economics, evidence contracts,
                                recovery controls, and source provenance into
                                this isolated organization.
                              </p>
                              <p className="mt-3 text-sm font-medium text-amber-800">
                                Activation remains blocked by {blockerCount}{" "}
                                current authority, provider,
                                professional-review, and rehearsal gates.
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {packageDefinition.capabilityCount || 0} capabilities ·{" "}
                                {packageDefinition.providerBindingCount || 0} provider declarations ·{" "}
                                {packageDefinition.sourceBindingCount || 0} governed live-source bindings
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {Number(packageDefinition.sourceBindingCount || 0) > 0 && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setCompanySourceSnapshot(null);
                                    setSourcePackageKey((current) =>
                                      current === packageDefinition.packageKey
                                        ? ""
                                        : String(packageDefinition.packageKey),
                                    );
                                  }}
                                >
                                  <BookOpen className="mr-2 h-4 w-4" />
                                  {sourcePackageKey === packageDefinition.packageKey
                                    ? "Hide sources"
                                    : "Inspect sources"}
                                </Button>
                              )}
                              <Button
                                onClick={() =>
                                  companyPackageMutation.mutate(
                                    packageDefinition,
                                  )
                                }
                                disabled={
                                  companyPackageMutation.isPending || installed
                                }
                              >
                                <Blocks className="mr-2 h-4 w-4" />
                                {companyPackageMutation.isPending
                                  ? `Compiling ${packageDefinition.operatingName}…`
                                  : installed
                                    ? "Reference instance compiled"
                                    : `Compile ${packageDefinition.operatingName} instance`}
                              </Button>
                            </div>
                          </div>
                          {sourcePackageKey === packageDefinition.packageKey && (
                            <div className="mt-4 space-y-3 border-t border-primary/15 pt-4">
                              {companyPackageSourcesQuery.isLoading && (
                                <p className="text-sm text-muted-foreground">Loading governed source bindings…</p>
                              )}
                              {(companyPackageSourcesQuery.data || []).map((source: JsonRecord) => (
                                <div key={source.sourceKey} className="flex flex-col gap-3 rounded-xl bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="font-medium">{String(source.sourceKey).replaceAll("-", " ")}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {String(source.pageClass).replaceAll("_", " ")} · precedence {source.precedence} · reference only
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button asChild size="sm" variant="ghost">
                                      <a href={source.sourceRef} target="_blank" rel="noreferrer">
                                        Open source <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={companySourceSnapshotMutation.isPending}
                                      onClick={() => companySourceSnapshotMutation.mutate({
                                        packageKey: String(packageDefinition.packageKey),
                                        sourceKey: String(source.sourceKey),
                                      })}
                                    >
                                      Read current snapshot
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {companySourceSnapshot && companySourceSnapshot.sourceKey && (
                                <div className="rounded-xl border bg-background p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold">{companySourceSnapshot.title}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Revision {new Date(companySourceSnapshot.sourceRevision).toLocaleString()} · {companySourceSnapshot.truncated ? "bounded and truncated" : "bounded complete read"}
                                      </p>
                                    </div>
                                    <Badge variant="outline">reference only</Badge>
                                  </div>
                                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                    {String(companySourceSnapshot.boundedText || "No readable text returned.").slice(0, 800)}
                                    {String(companySourceSnapshot.boundedText || "").length > 800 ? "…" : ""}
                                  </p>
                                  <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">
                                    {companySourceSnapshot.contentHash}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Operating modules</CardTitle>
                <CardDescription>
                  Enter the non-dormant business functions available to this
                  seat. Each one routes into governed work, approvals, evidence,
                  provider controls, or a safe fallback.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-2xl font-semibold">
                    {visibleModules.length}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    of 14 non-dormant overlay modules visible in this authority
                    scope
                  </p>
                </div>
                <Button onClick={() => goToSurface("modules")}>
                  <Blocks className="mr-2 h-4 w-4" />
                  Open module control center
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Role-compiled visibility</CardTitle>
                <CardDescription>
                  Every screen, search result, metric, message, approval, and
                  agent context is compiled for the active seat. Higher
                  organizational accountability receives broader authorized
                  downline visibility.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <Fact
                    label="Active seat"
                    value={
                      principalContext?.seat || "Founder / Portfolio Principal"
                    }
                  />
                  <Fact
                    label="Visibility scope"
                    value={principalContext?.visibility?.scope || "portfolio"}
                  />
                  <Fact
                    label="Communication path"
                    value={
                      principalContext?.visibility?.communicationPath ||
                      `Founder ↔ ${assistantName}`
                    }
                  />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl bg-muted p-4">
                    <p className="eos-label mb-2">Visible in this seat</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {(principalContext?.visibility?.sees || []).map(
                        (item: string) => (
                          <li key={item}>• {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <p className="eos-label mb-2">
                      Still requires a separate grant
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {(principalContext?.visibility?.cannotSee || []).map(
                        (item: string) => (
                          <li key={item}>• {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
                <Alert>
                  <Network className="h-4 w-4" />
                  <AlertTitle>Organizational communication law</AlertTitle>
                  <AlertDescription>
                    Founder ↔ Executive Assistant ↔ Portfolio Advisors and
                    Company CEO Agents. Inside a company, each employee or Role
                    Agent communicates through the real reporting chain. When a
                    human occupies an existing agent-run role, that Role Agent
                    becomes the human's assistant instead of competing for the
                    seat.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Instantiated seats</CardTitle>
                <CardDescription>
                  This is the visibility-filtered reporting graph, not a
                  decorative org chart.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(organizationQuery.data?.seats || []).map(
                  (seat: JsonRecord) => (
                    <div key={seat.id} className="rounded-xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{seat.title}</span>
                        <StateBadge state={seat.agentMode} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {seat.kind.replaceAll("_", " ")} · {seat.agentName}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {seat.mandate || "Mandate awaiting definition"}
                      </p>
                    </div>
                  ),
                )}
              </CardContent>
            </Card>
            {mayAdminOrganization && (
              <Card>
                <CardHeader>
                  <CardTitle>Build the operating hierarchy</CardTitle>
                  <CardDescription>
                    Create an accountable seat, position it under a supervisor,
                    then invite a person to accept it. Once accepted, the
                    existing Role Agent becomes that person's assistant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="eos-label">Create seat</p>
                    <Input
                      value={seatTitle}
                      onChange={(event) => setSeatTitle(event.target.value)}
                      placeholder="Seat title, e.g. Head of Growth"
                    />
                    <Input
                      value={seatAgentName}
                      onChange={(event) => setSeatAgentName(event.target.value)}
                      placeholder="Role Agent name"
                    />
                    <select
                      aria-label="Seat role"
                      value={seatKind}
                      onChange={(event) => setSeatKind(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="company_ceo">Company CEO</option>
                      <option value="functional_executive">
                        Functional executive
                      </option>
                      <option value="manager">Manager</option>
                      <option value="individual_contributor">
                        Individual contributor
                      </option>
                      <option value="external">External collaborator</option>
                    </select>
                    <select
                      aria-label="Reporting supervisor"
                      value={seatSupervisorId}
                      onChange={(event) =>
                        setSeatSupervisorId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Report to my active seat</option>
                      {(organizationQuery.data?.seats || []).map(
                        (seat: JsonRecord) => (
                          <option key={seat.id} value={seat.id}>
                            {seat.title}
                          </option>
                        ),
                      )}
                    </select>
                    <Button
                      disabled={
                        seatTitle.trim().length < 2 ||
                        seatAgentName.trim().length < 2 ||
                        seatMutation.isPending
                      }
                      onClick={() => seatMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {seatMutation.isPending
                        ? "Creating…"
                        : "Create accountable seat"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <p className="eos-label">Invite person to seat</p>
                    <Input
                      type="email"
                      value={membershipEmail}
                      onChange={(event) =>
                        setMembershipEmail(event.target.value)
                      }
                      placeholder="Work email address"
                    />
                    <select
                      aria-label="Seat for invitation"
                      value={membershipSeatId}
                      onChange={(event) =>
                        setMembershipSeatId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose an unoccupied seat</option>
                      {(organizationQuery.data?.seats || [])
                        .filter(
                          (seat: JsonRecord) =>
                            !seat.occupantUserId &&
                            !(organizationQuery.data?.invitations || []).some(
                              (invitation: JsonRecord) =>
                                invitation.seatId === seat.id &&
                                ["pending", "pending_delivery"].includes(
                                  invitation.status,
                                ),
                            ),
                        )
                        .map((seat: JsonRecord) => (
                          <option key={seat.id} value={seat.id}>
                            {seat.title}
                          </option>
                        ))}
                    </select>
                    {isFounder && contextQuery.data?.portfolio?.id && (
                      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={membershipPortfolioScope}
                          onChange={(event) =>
                            setMembershipPortfolioScope(event.target.checked)
                          }
                        />
                        <span>
                          <span className="font-medium">
                            Portfolio-wide executive access
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Grant a governed Portfolio Executive seat in every
                            organization in {contextQuery.data.portfolio.name}.
                          </span>
                        </span>
                      </label>
                    )}
                    <Button
                      variant="secondary"
                      disabled={
                        !membershipEmail.includes("@") ||
                        !membershipSeatId ||
                        membershipMutation.isPending
                      }
                      onClick={() => membershipMutation.mutate()}
                    >
                      {membershipMutation.isPending
                        ? "Sending…"
                        : "Send secure invitation"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Access begins only after the recipient signs in with this
                      verified email and accepts the exact role. Human
                      identities: {organizationQuery.data?.teamSeats?.used || 1}{" "}
                      of {organizationQuery.data?.teamSeats?.limit || 10}{" "}
                      allocated.
                    </p>
                    {(organizationQuery.data?.invitations || [])
                      .filter((invitation: JsonRecord) =>
                        ["pending", "pending_delivery"].includes(
                          invitation.status,
                        ),
                      )
                      .map((invitation: JsonRecord) => {
                        const seat = (organizationQuery.data?.seats || []).find(
                          (item: JsonRecord) => item.id === invitation.seatId,
                        );
                        return (
                          <div
                            key={invitation.id}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {invitation.email}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {seat?.title || "Organizational seat"} ·{" "}
                                {invitation.portfolioScope
                                  ? "portfolio-wide · "
                                  : ""}
                                {invitation.status === "pending_delivery"
                                  ? "delivery in progress"
                                  : `expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Revoke invitation for ${invitation.email}`}
                              disabled={revokeInvitationMutation.isPending}
                              onClick={() =>
                                revokeInvitationMutation.mutate(invitation.id)
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
            {mayAdminOrganization && (
              <Card>
                <CardHeader>
                  <CardTitle>Team access</CardTitle>
                  <CardDescription>
                    Administer accepted members without bypassing seat
                    authority. Suspending or removing a person returns their
                    Role Agent to autonomous mode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Fact
                      label="Human identities"
                      value={`${organizationQuery.data?.teamSeats?.used || 1} / ${organizationQuery.data?.teamSeats?.limit || 10}`}
                    />
                    <Fact
                      label="Available"
                      value={String(
                        organizationQuery.data?.teamSeats?.remaining ?? 9,
                      )}
                    />
                    <Fact
                      label="Allowance source"
                      value={(
                        organizationQuery.data?.teamSeats?.source ||
                        "workspace_default"
                      ).replaceAll("_", " ")}
                    />
                  </div>
                  {(organizationQuery.data?.memberships || []).map(
                    (member: JsonRecord) => {
                      const seat = (organizationQuery.data?.seats || []).find(
                        (item: JsonRecord) => item.id === member.seatId,
                      );
                      const canAdmin =
                        isFounder ||
                        (!["portfolio_executive", "company_ceo"].includes(
                          member.role,
                        ) &&
                          member.userId !== principalContext?.principalId);
                      return (
                        <div key={member.id} className="rounded-xl border p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {member.fullName || member.email}
                                </p>
                                <StateBadge state={member.status} />
                                {member.portfolioMembershipId && (
                                  <Badge variant="outline">
                                    portfolio-wide
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {member.email} ·{" "}
                                {seat?.title ||
                                  member.role.replaceAll("_", " ")}
                              </p>
                            </div>
                            {member.portfolioMembershipId &&
                            contextQuery.data?.portfolio?.id ? (
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/portfolios/${contextQuery.data.portfolio.id}#team`}
                                >
                                  Manage at portfolio
                                </Link>
                              </Button>
                            ) : (
                              canAdmin && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    aria-label={`${member.status === "active" ? "Suspend" : "Reactivate"} ${member.email}`}
                                    disabled={
                                      memberAdministrationMutation.isPending
                                    }
                                    onClick={() =>
                                      memberAdministrationMutation.mutate({
                                        membershipId: member.id,
                                        action:
                                          member.status === "active"
                                            ? "suspend"
                                            : "reactivate",
                                      })
                                    }
                                  >
                                    {member.status === "active"
                                      ? "Suspend"
                                      : "Reactivate"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    aria-label={`Remove ${member.email}`}
                                    disabled={removeMemberMutation.isPending}
                                    onClick={() =>
                                      removeMemberMutation.mutate(member.id)
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              )
                            )}
                          </div>
                          {canAdmin && !member.portfolioMembershipId && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <select
                                aria-label={`Seat for ${member.fullName || member.email}`}
                                value={member.seatId || ""}
                                onChange={(event) =>
                                  memberAdministrationMutation.mutate({
                                    membershipId: member.id,
                                    action: "reassign",
                                    seatId: event.target.value,
                                  })
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              >
                                {(organizationQuery.data?.seats || [])
                                  .filter(
                                    (candidate: JsonRecord) =>
                                      candidate.id === member.seatId ||
                                      (!candidate.occupantUserId &&
                                        candidate.kind !== "founder"),
                                  )
                                  .map((candidate: JsonRecord) => (
                                    <option
                                      key={candidate.id}
                                      value={candidate.id}
                                    >
                                      {candidate.title}
                                    </option>
                                  ))}
                              </select>
                              <select
                                aria-label={`Access ceiling for ${member.fullName || member.email}`}
                                value={member.classificationCeiling}
                                onChange={(event) =>
                                  memberAdministrationMutation.mutate({
                                    membershipId: member.id,
                                    action: "change_access",
                                    classificationCeiling: event.target.value,
                                  })
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="public">Public</option>
                                <option value="internal">Internal</option>
                                <option value="confidential">
                                  Confidential
                                </option>
                                <option value="restricted">Restricted</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                  {!organizationQuery.data?.memberships?.length && (
                    <p className="text-sm text-muted-foreground">
                      No accepted team members yet. Create a seat and send the
                      first secure invitation above.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {mayAdminOrganization && (
              <Card>
                <CardHeader>
                  <CardTitle>Canonical authority subjects</CardTitle>
                  <CardDescription>
                    Register every Agent, team, provider, service account, and
                    governing body once. Verification establishes identity; it
                    does not grant authority.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="authority-subject-type"
                        className="text-sm font-medium"
                      >
                        Subject type
                      </label>
                      <select
                        id="authority-subject-type"
                        value={authoritySubjectType}
                        onChange={(event) =>
                          setAuthoritySubjectType(event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="agent">Advisor or Sub-Agent</option>
                        <option value="team">Team</option>
                        <option value="provider">Provider</option>
                        <option value="service_account">Service account</option>
                        <option value="governing_body">Governing body</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="authority-subject-name"
                        className="text-sm font-medium"
                      >
                        Display name
                      </label>
                      <Input
                        id="authority-subject-name"
                        className="mt-2"
                        value={authoritySubjectName}
                        onChange={(event) =>
                          setAuthoritySubjectName(event.target.value)
                        }
                        placeholder="Northstar Advisory Council"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="authority-subject-key"
                        className="text-sm font-medium"
                      >
                        Canonical key{" "}
                        <span className="font-normal text-muted-foreground">
                          (generated if blank)
                        </span>
                      </label>
                      <Input
                        id="authority-subject-key"
                        className="mt-2"
                        value={authoritySubjectKey}
                        onChange={(event) =>
                          setAuthoritySubjectKey(event.target.value)
                        }
                        placeholder={`${authoritySubjectType}:stable-key`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="authority-subject-seat"
                        className="text-sm font-medium"
                      >
                        Bound seat{" "}
                        <span className="font-normal text-muted-foreground">
                          (when applicable)
                        </span>
                      </label>
                      <select
                        id="authority-subject-seat"
                        value={authoritySubjectSeatId}
                        onChange={(event) =>
                          setAuthoritySubjectSeatId(event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">No seat binding</option>
                        {visibleSeats.map((seat: JsonRecord) => (
                          <option key={seat.id} value={seat.id}>
                            {seat.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    {authoritySubjectType === "agent" && (
                      <div>
                        <label
                          htmlFor="authority-subject-parent"
                          className="text-sm font-medium"
                        >
                          Parent Agent{" "}
                          <span className="font-normal text-muted-foreground">
                            (Sub-Agent only)
                          </span>
                        </label>
                        <select
                          id="authority-subject-parent"
                          value={authoritySubjectParentId}
                          onChange={(event) => {
                            const parentId = event.target.value;
                            setAuthoritySubjectParentId(parentId);
                            const parent = authoritySubjects.find(
                              (subject: JsonRecord) => subject.id === parentId,
                            );
                            if (parent?.seatId)
                              setAuthoritySubjectSeatId(parent.seatId);
                          }}
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Portfolio advisor agent</option>
                          {authoritySubjects
                            .filter(
                              (subject: JsonRecord) =>
                                subject.subjectType === "agent" &&
                                subject.status === "active",
                            )
                            .map((subject: JsonRecord) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.displayName}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    {["provider", "service_account"].includes(
                      authoritySubjectType,
                    ) && (
                      <div>
                        <label
                          htmlFor="authority-subject-external"
                          className="text-sm font-medium"
                        >
                          External identity / provider key
                        </label>
                        <Input
                          id="authority-subject-external"
                          className="mt-2"
                          value={authoritySubjectExternalKey}
                          onChange={(event) =>
                            setAuthoritySubjectExternalKey(event.target.value)
                          }
                          placeholder="google-workspace:account-id"
                        />
                      </div>
                    )}
                    <div>
                      <label
                        htmlFor="authority-subject-source"
                        className="text-sm font-medium"
                      >
                        Source authority
                      </label>
                      <Input
                        id="authority-subject-source"
                        className="mt-2"
                        value={authoritySubjectSource}
                        onChange={(event) =>
                          setAuthoritySubjectSource(event.target.value)
                        }
                        placeholder="Approved vendor agreement or organization manifest"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="authority-subject-detail"
                        className="text-sm font-medium"
                      >
                        {authoritySubjectType === "agent"
                          ? "Memory boundary"
                          : authoritySubjectType === "service_account"
                            ? "External account reference"
                            : authoritySubjectType === "provider"
                              ? "Agreement reference"
                              : "Charter reference"}
                      </label>
                      <Input
                        id="authority-subject-detail"
                        className="mt-2"
                        value={authoritySubjectDetail}
                        onChange={(event) =>
                          setAuthoritySubjectDetail(event.target.value)
                        }
                        placeholder="Evidence-backed reference or bounded scope"
                      />
                    </div>
                    {["team", "governing_body"].includes(
                      authoritySubjectType,
                    ) && (
                      <div>
                        <label
                          htmlFor="authority-subject-members"
                          className="text-sm font-medium"
                        >
                          Member principal IDs{" "}
                          <span className="font-normal text-muted-foreground">
                            (comma-separated)
                          </span>
                        </label>
                        <Input
                          id="authority-subject-members"
                          className="mt-2"
                          value={authoritySubjectMembers}
                          onChange={(event) =>
                            setAuthoritySubjectMembers(event.target.value)
                          }
                          placeholder="Defaults to your current identity"
                        />
                      </div>
                    )}
                    {authoritySubjectType === "service_account" && (
                      <>
                        <div>
                          <label
                            htmlFor="authority-subject-environment"
                            className="text-sm font-medium"
                          >
                            Environment
                          </label>
                          <select
                            id="authority-subject-environment"
                            value={authoritySubjectEnvironment}
                            onChange={(event) =>
                              setAuthoritySubjectEnvironment(event.target.value)
                            }
                            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="development">Development</option>
                            <option value="test">Test</option>
                            <option value="staging">Staging</option>
                            <option value="production">Production</option>
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="authority-subject-credential"
                            className="text-sm font-medium"
                          >
                            Credential reference
                          </label>
                          <Input
                            id="authority-subject-credential"
                            className="mt-2"
                            value={authoritySubjectCredentialReference}
                            onChange={(event) =>
                              setAuthoritySubjectCredentialReference(
                                event.target.value,
                              )
                            }
                            placeholder="op://vault/item/field — never the secret"
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label
                        htmlFor="authority-subject-classification"
                        className="text-sm font-medium"
                      >
                        Data ceiling
                      </label>
                      <select
                        id="authority-subject-classification"
                        value={authoritySubjectClassification}
                        onChange={(event) =>
                          setAuthoritySubjectClassification(event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="public">Public</option>
                        <option value="internal">Internal</option>
                        <option value="confidential">Confidential</option>
                        <option value="restricted">Restricted</option>
                        <option value="highly_restricted">
                          Highly restricted
                        </option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="authority-subject-evidence"
                        className="text-sm font-medium"
                      >
                        Registration evidence reference
                      </label>
                      <Input
                        id="authority-subject-evidence"
                        className="mt-2"
                        value={authoritySubjectEvidence}
                        onChange={(event) =>
                          setAuthoritySubjectEvidence(event.target.value)
                        }
                        placeholder="notion://decision/... or https://evidence/..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        disabled={
                          !authoritySubjectName.trim() ||
                          !authoritySubjectSource.trim() ||
                          !authoritySubjectDetail.trim() ||
                          authoritySubjectMutation.isPending ||
                          (authoritySubjectType === "governing_body" &&
                            !authoritySubjectEvidence.trim()) ||
                          (authoritySubjectType === "service_account" &&
                            (!authoritySubjectExternalKey.trim() ||
                              !authoritySubjectCredentialReference.trim())) ||
                          (authoritySubjectType === "agent" &&
                            Boolean(authoritySubjectParentId) &&
                            !authoritySubjectSeatId)
                        }
                        onClick={() => authoritySubjectMutation.mutate()}
                      >
                        {authoritySubjectMutation.isPending
                          ? "Registering…"
                          : "Register canonical subject"}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="authority-subject-lifecycle-evidence"
                      className="text-sm font-medium"
                    >
                      Verification and review evidence
                    </label>
                    <Input
                      id="authority-subject-lifecycle-evidence"
                      className="mt-2"
                      value={authoritySubjectLifecycleEvidence}
                      onChange={(event) =>
                        setAuthoritySubjectLifecycleEvidence(event.target.value)
                      }
                      placeholder="Required for Verify and Review"
                    />
                  </div>
                  <div className="space-y-3">
                    {authoritySubjects.map((subject: JsonRecord) => {
                      const reviewOverdue =
                        subject.reviewAt &&
                        new Date(subject.reviewAt).getTime() <= Date.now();
                      const seat = visibleSeats.find(
                        (item: JsonRecord) => item.id === subject.seatId,
                      );
                      const persistentRoleAgent = Boolean(
                        subject.seatId &&
                        subject.subjectKey ===
                          `agent:${subject.seatId}:primary`,
                      );
                      return (
                        <div key={subject.id} className="rounded-xl border p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {subject.displayName}
                                </p>
                                <StateBadge state={subject.status} />
                                <Badge
                                  variant={
                                    subject.verificationStatus === "verified"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {subject.verificationStatus}
                                </Badge>
                                <Badge variant="outline">
                                  {String(subject.subjectType).replaceAll(
                                    "_",
                                    " ",
                                  )}
                                </Badge>
                                {reviewOverdue && (
                                  <Badge variant="destructive">
                                    review overdue
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {subject.subjectKey}
                                {seat ? ` · ${seat.title}` : ""}
                                {subject.agentClass
                                  ? ` · ${String(subject.agentClass).replaceAll("_", " ")}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {subject.verificationStatus !== "verified" &&
                                subject.status !== "retired" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      !authoritySubjectLifecycleEvidence.trim() ||
                                      authoritySubjectTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authoritySubjectTransitionMutation.mutate(
                                        {
                                          subjectId: subject.id,
                                          action: "verify",
                                        },
                                      )
                                    }
                                  >
                                    Verify
                                  </Button>
                                )}
                              {subject.verificationStatus === "verified" &&
                                ["provisioning", "suspended"].includes(
                                  subject.status,
                                ) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      authoritySubjectTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authoritySubjectTransitionMutation.mutate(
                                        {
                                          subjectId: subject.id,
                                          action: "activate",
                                        },
                                      )
                                    }
                                  >
                                    Activate
                                  </Button>
                                )}
                              {subject.status === "active" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      !authoritySubjectLifecycleEvidence.trim() ||
                                      authoritySubjectTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authoritySubjectTransitionMutation.mutate(
                                        {
                                          subjectId: subject.id,
                                          action: "review",
                                        },
                                      )
                                    }
                                  >
                                    Review +90 days
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      authoritySubjectTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authoritySubjectTransitionMutation.mutate(
                                        {
                                          subjectId: subject.id,
                                          action: "suspend",
                                        },
                                      )
                                    }
                                  >
                                    Suspend
                                  </Button>
                                </>
                              )}
                              {subject.status !== "retired" &&
                                !persistentRoleAgent && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={
                                      authoritySubjectTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authoritySubjectTransitionMutation.mutate(
                                        {
                                          subjectId: subject.id,
                                          action: "retire",
                                        },
                                      )
                                    }
                                  >
                                    Retire
                                  </Button>
                                )}
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            Owner:{" "}
                            {subject.ownerUserId ===
                            principalContext?.principalId
                              ? "you"
                              : subject.ownerUserId}{" "}
                            · Source: {subject.sourceAuthority}
                            {subject.reviewAt
                              ? ` · review ${new Date(subject.reviewAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            {mayAdminOrganization && (
              <Card>
                <CardHeader>
                  <CardTitle>Authority Grant registry</CardTitle>
                  <CardDescription>
                    Grant a verified canonical subject or named seat only the
                    action class, resource, time window, and tools its reviewed
                    operating contract requires. Identity, titles, and software
                    access do not create authority.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="authority-grantee-type"
                          className="text-sm font-medium"
                        >
                          Grantee type
                        </label>
                        <select
                          id="authority-grantee-type"
                          value={authorityGranteeType}
                          onChange={(event) =>
                            setAuthorityGranteeType(event.target.value)
                          }
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="seat">Organizational seat</option>
                          <option value="agent">Agent</option>
                          <option value="team">Team</option>
                          <option value="provider">Provider</option>
                          <option value="service_account">
                            Service account
                          </option>
                          <option value="governing_body">Governing body</option>
                        </select>
                      </div>
                      {authorityGranteeType === "seat" ? (
                        <div>
                          <label
                            htmlFor="authority-seat"
                            className="text-sm font-medium"
                          >
                            Grantee seat
                          </label>
                          <select
                            id="authority-seat"
                            value={authoritySeatId}
                            onChange={(event) =>
                              setAuthoritySeatId(event.target.value)
                            }
                            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Choose a seat</option>
                            {visibleSeats.map((seat: JsonRecord) => (
                              <option key={seat.id} value={seat.id}>
                                {seat.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label
                            htmlFor="authority-subject-grantee"
                            className="text-sm font-medium"
                          >
                            Verified canonical subject
                          </label>
                          <select
                            id="authority-subject-grantee"
                            value={authorityGranteeSubjectId}
                            onChange={(event) =>
                              setAuthorityGranteeSubjectId(event.target.value)
                            }
                            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Choose an active subject</option>
                            {authoritySubjects
                              .filter(
                                (subject: JsonRecord) =>
                                  subject.subjectType ===
                                    authorityGranteeType &&
                                  subject.status === "active" &&
                                  subject.verificationStatus === "verified",
                              )
                              .map((subject: JsonRecord) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.displayName}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label
                          htmlFor="authority-resource"
                          className="text-sm font-medium"
                        >
                          Governed resource
                        </label>
                        <select
                          id="authority-resource"
                          value={authorityResource}
                          onChange={(event) =>
                            setAuthorityResource(event.target.value)
                          }
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {governedAuthorityResources.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="authority-effect"
                            className="text-sm font-medium"
                          >
                            Effect
                          </label>
                          <select
                            id="authority-effect"
                            value={authorityEffect}
                            onChange={(event) =>
                              setAuthorityEffect(event.target.value)
                            }
                            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="allow">Allow</option>
                            <option value="deny">Explicit deny</option>
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="authority-classification"
                            className="text-sm font-medium"
                          >
                            Data ceiling
                          </label>
                          <select
                            id="authority-classification"
                            value={authorityClassification}
                            onChange={(event) =>
                              setAuthorityClassification(event.target.value)
                            }
                            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="public">Public</option>
                            <option value="internal">Internal</option>
                            <option value="confidential">Confidential</option>
                            <option value="restricted">Restricted</option>
                            <option value="highly_restricted">
                              Highly restricted
                            </option>
                            <option value="contextual">Contextual</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="authority-consequence"
                          className="text-sm font-medium"
                        >
                          Consequence ceiling
                        </label>
                        <select
                          id="authority-consequence"
                          value={authorityConsequence}
                          onChange={(event) =>
                            setAuthorityConsequence(event.target.value)
                          }
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="routine">Routine</option>
                          <option value="material">Material</option>
                          <option value="irreversible">Irreversible</option>
                          <option value="emergency">Emergency</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-[1fr_7rem] gap-3">
                        <div>
                          <label
                            htmlFor="authority-max-amount"
                            className="text-sm font-medium"
                          >
                            Financial ceiling{" "}
                            <span className="font-normal text-muted-foreground">
                              (optional)
                            </span>
                          </label>
                          <Input
                            id="authority-max-amount"
                            className="mt-2"
                            type="number"
                            min="0"
                            value={authorityMaxAmount}
                            onChange={(event) =>
                              setAuthorityMaxAmount(event.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="authority-currency"
                            className="text-sm font-medium"
                          >
                            Currency
                          </label>
                          <Input
                            id="authority-currency"
                            className="mt-2"
                            maxLength={3}
                            value={authorityCurrency}
                            onChange={(event) =>
                              setAuthorityCurrency(
                                event.target.value.toUpperCase(),
                              )
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="authority-until"
                          className="text-sm font-medium"
                        >
                          Effective until{" "}
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </label>
                        <Input
                          id="authority-until"
                          className="mt-2"
                          type="datetime-local"
                          value={authorityEffectiveUntil}
                          onChange={(event) =>
                            setAuthorityEffectiveUntil(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="authority-review"
                          className="text-sm font-medium"
                        >
                          Review deadline{" "}
                          <span className="font-normal text-muted-foreground">
                            (required for sensitive active grants)
                          </span>
                        </label>
                        <Input
                          id="authority-review"
                          className="mt-2"
                          type="datetime-local"
                          value={authorityReviewAt}
                          onChange={(event) =>
                            setAuthorityReviewAt(event.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Authority classes</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {authorityClasses.map((authorityClass) => {
                            const held =
                              effectiveAuthorityClasses.has(authorityClass);
                            const selected =
                              authorityClassDraft.includes(authorityClass);
                            return (
                              <label
                                key={authorityClass}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${held ? "" : "opacity-45"}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!held}
                                  onChange={(event) =>
                                    setAuthorityClassDraft((current) =>
                                      event.target.checked
                                        ? Array.from(
                                            new Set([
                                              ...current,
                                              authorityClass,
                                            ]),
                                          )
                                        : current.filter(
                                            (item) => item !== authorityClass,
                                          ),
                                    )
                                  }
                                />
                                {authorityClass.replaceAll("_", " ")}
                              </label>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          You can grant only classes currently held by this
                          operating seat at organization scope.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="authority-min-approvals"
                            className="text-sm font-medium"
                          >
                            Minimum approvals
                          </label>
                          <Input
                            id="authority-min-approvals"
                            className="mt-2"
                            type="number"
                            min="0"
                            max="20"
                            value={authorityMinimumApprovals}
                            onChange={(event) =>
                              setAuthorityMinimumApprovals(event.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="authority-min-evidence"
                            className="text-sm font-medium"
                          >
                            Evidence minimum
                          </label>
                          <Input
                            id="authority-min-evidence"
                            className="mt-2"
                            type="number"
                            min="0"
                            max="100"
                            value={authorityEvidenceMinimum}
                            onChange={(event) =>
                              setAuthorityEvidenceMinimum(event.target.value)
                            }
                          />
                        </div>
                      </div>
                      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={authorityRequireDistinctSeat}
                          onChange={(event) =>
                            setAuthorityRequireDistinctSeat(
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <span className="font-medium">
                            Require distinct approver seats
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Duplicate principals or seats cannot satisfy the
                            approval quorum.
                          </span>
                        </span>
                      </label>
                      {["organization", "authority_subject"].includes(
                        authorityResource,
                      ) && (
                        <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={authorityMinimizeProtectedFields}
                            onChange={(event) =>
                              setAuthorityMinimizeProtectedFields(
                                event.target.checked,
                              )
                            }
                          />
                          <span>
                            <span className="font-medium">
                              Minimize fields above this data ceiling
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Return an evidence-backed redacted view when the
                              purpose is valid, instead of exposing credential
                              references, agent memory, or registry identifiers.
                            </span>
                          </span>
                        </label>
                      )}
                      <div>
                        <label
                          htmlFor="authority-policy-source"
                          className="text-sm font-medium"
                        >
                          Policy decision source
                        </label>
                        <Textarea
                          id="authority-policy-source"
                          className="mt-2 min-h-20"
                          value={authorityPolicySource}
                          onChange={(event) =>
                            setAuthorityPolicySource(event.target.value)
                          }
                          placeholder="Reviewed position agreement, decision record, or founder mandate"
                        />
                      </div>
                      <label className="flex items-start gap-3 rounded-xl bg-muted p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={activateAuthorityGrant}
                          disabled={!effectiveAuthorityClasses.has("approve")}
                          onChange={(event) =>
                            setActivateAuthorityGrant(event.target.checked)
                          }
                        />
                        <span>
                          <span className="font-medium">
                            Activate immediately
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Leave off to create a proposed grant for separate
                            review.
                          </span>
                        </span>
                      </label>
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <Button
                        disabled={
                          (authorityGranteeType === "seat"
                            ? !authoritySeatId
                            : !selectedAuthoritySubject) ||
                          !authorityClassDraft.length ||
                          authorityPolicySource.trim().length < 3 ||
                          authorityGrantMutation.isPending ||
                          (activateAuthorityGrant &&
                            authorityNeedsReview &&
                            !authorityReviewAt &&
                            !authorityEffectiveUntil)
                        }
                        onClick={() => authorityGrantMutation.mutate()}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {authorityGrantMutation.isPending
                          ? "Recording…"
                          : activateAuthorityGrant
                            ? "Create and activate grant"
                            : "Create proposed grant"}
                      </Button>
                      {activateAuthorityGrant &&
                        authorityNeedsReview &&
                        !authorityReviewAt &&
                        !authorityEffectiveUntil && (
                          <p className="text-xs text-destructive">
                            Set a review deadline or effective-until time before
                            activating this sensitive grant.
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="eos-label">Current registry</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every change is tenant-bound and audit-recorded.
                        Revocation is terminal.
                      </p>
                    </div>
                    {authorityGrants.map((grant: JsonRecord) => {
                      const seat = visibleSeats.find(
                        (item: JsonRecord) =>
                          item.id === (grant.seatId || grant.granteeKey),
                      );
                      const scope = grant.actionResourceScope || {};
                      const ceiling = grant.ceilingThreshold || {};
                      const resources = Array.isArray(scope.resources)
                        ? scope.resources
                        : [scope.resource].filter(Boolean);
                      const protectedBaseline =
                        grant.authorityKey?.endsWith(":baseline") &&
                        seat?.kind === "founder";
                      const canChange =
                        !protectedBaseline &&
                        (isFounder ||
                          !["founder", "company_ceo"].includes(seat?.kind));
                      const reviewOverdue =
                        grant.reviewAt &&
                        new Date(grant.reviewAt).getTime() <= Date.now();
                      return (
                        <div key={grant.id} className="rounded-xl border p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {seat?.title || grant.granteeKey}
                                </p>
                                <StateBadge state={grant.state} />
                                <Badge
                                  variant={
                                    grant.effect === "deny"
                                      ? "destructive"
                                      : "outline"
                                  }
                                >
                                  {grant.effect || "allow"}
                                </Badge>
                                {grant.delegable && (
                                  <Badge variant="outline">delegable</Badge>
                                )}
                                {protectedBaseline && (
                                  <Badge variant="outline">
                                    ownership protected
                                  </Badge>
                                )}
                                {reviewOverdue && (
                                  <Badge variant="destructive">
                                    review overdue
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                {grant.authorityKey}
                              </p>
                            </div>
                            {canChange && (
                              <div className="flex flex-wrap gap-2">
                                {reviewOverdue && grant.state === "active" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      authorityTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authorityTransitionMutation.mutate({
                                        grantId: grant.id,
                                        state: "active",
                                        reviewAt: new Date(
                                          Date.now() + 90 * 24 * 60 * 60 * 1000,
                                        ).toISOString(),
                                      })
                                    }
                                  >
                                    Review +90 days
                                  </Button>
                                )}
                                {grant.state !== "active" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      authorityTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authorityTransitionMutation.mutate({
                                        grantId: grant.id,
                                        state: "active",
                                        ...(reviewOverdue
                                          ? {
                                              reviewAt: new Date(
                                                Date.now() +
                                                  90 * 24 * 60 * 60 * 1000,
                                              ).toISOString(),
                                            }
                                          : {}),
                                      })
                                    }
                                  >
                                    Activate
                                  </Button>
                                )}
                                {grant.state === "active" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      authorityTransitionMutation.isPending
                                    }
                                    onClick={() =>
                                      authorityTransitionMutation.mutate({
                                        grantId: grant.id,
                                        state: "suspended",
                                      })
                                    }
                                  >
                                    Suspend
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={
                                    authorityTransitionMutation.isPending
                                  }
                                  onClick={() =>
                                    authorityTransitionMutation.mutate({
                                      grantId: grant.id,
                                      state: "revoked",
                                    })
                                  }
                                >
                                  Revoke
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {(grant.authorityClasses || []).map(
                              (authorityClass: string) => (
                                <Badge key={authorityClass} variant="secondary">
                                  {authorityClass.replaceAll("_", " ")}
                                </Badge>
                              ),
                            )}
                            {resources.map((resource: string) => (
                              <Badge key={resource} variant="outline">
                                {resource.replaceAll("_", " ")}
                              </Badge>
                            ))}
                            {ceiling.classification && (
                              <Badge variant="outline">
                                ≤{" "}
                                {String(ceiling.classification).replaceAll(
                                  "_",
                                  " ",
                                )}
                              </Badge>
                            )}
                            {ceiling.consequence && (
                              <Badge variant="outline">
                                ≤ {ceiling.consequence}
                              </Badge>
                            )}
                            {grant.approvalPolicy?.minimumApprovals > 0 && (
                              <Badge variant="outline">
                                {grant.approvalPolicy.minimumApprovals} approval
                                {grant.approvalPolicy.minimumApprovals === 1
                                  ? ""
                                  : "s"}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            Source: {grant.policyDecisionSource || "Unresolved"}
                            {grant.effectiveUntil
                              ? ` · expires ${new Date(grant.effectiveUntil).toLocaleString()}`
                              : " · no expiry"}
                            {grant.reviewAt
                              ? ` · review ${new Date(grant.reviewAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                      );
                    })}
                    {!authorityGrants.length && (
                      <p className="text-sm text-muted-foreground">
                        No visible Authority Grants. Resolve the active seat
                        kernel before granting action rights.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {isFounder && (
              <Card>
                <CardHeader>
                  <CardTitle>Identity policy</CardTitle>
                  <CardDescription>
                    Restrict employee-seat invitations to approved domains while
                    keeping external collaborators an explicit, separately
                    controlled role.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label
                      htmlFor="identity-domains"
                      className="text-sm font-medium"
                    >
                      Approved employee email domains
                    </label>
                    <Input
                      id="identity-domains"
                      className="mt-2"
                      value={identityDomains}
                      onChange={(event) =>
                        setIdentityDomains(event.target.value)
                      }
                      placeholder="example.com, subsidiary.com"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Leave empty to allow any verified email. External seats
                      are governed separately.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={allowExternalCollaborators}
                      onChange={(event) =>
                        setAllowExternalCollaborators(event.target.checked)
                      }
                    />
                    <span>
                      <span className="font-medium">
                        Allow external collaborator invitations
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        External collaborators still receive only
                        relationship-scoped visibility.
                      </span>
                    </span>
                  </label>
                  <Button
                    onClick={() => identityPolicyMutation.mutate()}
                    disabled={identityPolicyMutation.isPending}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {identityPolicyMutation.isPending
                      ? "Saving…"
                      : "Save identity policy"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="talent" className="space-y-6">
            <TalentInstrument
              root={root}
              state={talentStateQuery.data}
              loading={talentStateQuery.isLoading}
              error={talentStateQuery.isError}
              refetch={refresh}
              seats={visibleSeats}
              evidence={evidence}
              workPackets={activePackets}
              authorityClasses={effectiveAuthorityClasses}
              showError={showMutationError}
              askAssistant={sendEaMessage}
              assistantName={assistantName}
            />
          </TabsContent>

          <TabsContent value="workforce" className="space-y-6">
            <div>
              <p className="eos-label">Workforce instrument</p>
              <h2 className="mt-1 text-2xl font-semibold">
                Performance to succession
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Turn role expectations, work evidence, development, and bench
                readiness into governed decisions. EOS measures outcomes and
                organizational conditions—not private human activity.
              </p>
            </div>
            <WorkforceInstrument
              root={root}
              state={workforceStateQuery.data}
              loading={workforceStateQuery.isLoading}
              error={workforceStateQuery.isError}
              refetch={() => workforceStateQuery.refetch()}
              seats={visibleSeats}
              evidence={evidence}
              authorityClasses={effectiveAuthorityClasses}
              principalSeatId={principalContext?.seatId || ""}
              role={principalContext?.role || ""}
              showError={showMutationError}
              askAssistant={sendEaMessage}
              assistantName={assistantName}
            />
          </TabsContent>

          <TabsContent value="my-role" className="space-y-6">
            {operatingAssignments.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Enter a role</CardTitle>
                  <CardDescription>
                    Switch operating perspective without changing your identity
                    or inheriting authority from another seat.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {operatingAssignments.map((assignment: JsonRecord) => {
                    const active =
                      assignment.id === principalContext?.activeAssignmentId;
                    return (
                      <button
                        key={assignment.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => !active && enterRole(assignment)}
                        className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{assignment.seat}</span>
                          {active && <Badge>active</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {String(assignment.role).replaceAll("_", " ")} ·{" "}
                          {String(assignment.assignmentType).replaceAll(
                            "_",
                            " ",
                          )}
                        </p>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{principalContext?.seat}</CardTitle>
                <CardDescription>
                  Your compiled seat, visibility ceiling, communication path,
                  and tool authority.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <Fact
                    label="Role"
                    value={(principalContext?.role || "unresolved").replaceAll(
                      "_",
                      " ",
                    )}
                  />
                  <Fact
                    label="Visibility"
                    value={principalContext?.visibility?.scope || "unresolved"}
                  />
                  <Fact label="Assistant" value={assistantName} />
                </div>
                <div>
                  <p className="eos-label mb-2">Tool entitlements</p>
                  <div className="flex flex-wrap gap-2">
                    {(principalContext?.toolEntitlements || []).length ? (
                      principalContext.toolEntitlements.map((tool: string) => (
                        <Badge key={tool} variant="outline">
                          {tool}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No delegated provider tools; local work remains
                        available.
                      </span>
                    )}
                  </div>
                </div>
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Authority is explicit</AlertTitle>
                  <AlertDescription>
                    {assistantName} can assist this seat but cannot expand its
                    visibility, approve its own request, or communicate around
                    the reporting hierarchy.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
            {(principalContext?.allowedSurfaces || []).includes("workforce") && (
              <Card>
                <CardHeader>
                  <CardTitle>My performance, development, and career</CardTitle>
                  <CardDescription>
                    Your role-scoped reviews, support, development, and plausible
                    career paths. Employee statements remain append-only and
                    attributable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Fact
                      label="My reviews"
                      value={String(
                        (workforceStateQuery.data?.reviews || []).filter(
                          (item: JsonRecord) =>
                            item.subjectSeatId === principalContext?.seatId,
                        ).length,
                      )}
                    />
                    <Fact
                      label="Active development"
                      value={String(
                        (
                          workforceStateQuery.data?.developmentPlans || []
                        ).filter(
                          (item: JsonRecord) =>
                            item.subjectSeatId === principalContext?.seatId &&
                            ["active", "paused"].includes(item.state),
                        ).length,
                      )}
                    />
                    <Fact
                      label="Active support"
                      value={String(
                        (workforceStateQuery.data?.roleSupportPlans || []).filter(
                          (item: JsonRecord) =>
                            item.subjectSeatId === principalContext?.seatId &&
                            ["active", "ready_for_review"].includes(item.state),
                        ).length,
                      )}
                    />
                    <Fact
                      label="Career paths"
                      value={String(
                        (workforceStateQuery.data?.careerPaths || []).filter(
                          (item: JsonRecord) =>
                            item.subjectSeatId === principalContext?.seatId &&
                            !["declined", "withdrawn"].includes(item.state),
                        ).length,
                      )}
                    />
                  </div>
                  {(workforceStateQuery.data?.careerPaths || [])
                    .filter(
                      (item: JsonRecord) =>
                        item.subjectSeatId === principalContext?.seatId &&
                        !["declined", "withdrawn"].includes(item.state),
                    )
                    .slice(0, 2)
                    .map((item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">My Career</Badge>
                          <StateBadge state={item.state} />
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {item.targetRole}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.aspirationStatement}
                        </p>
                      </div>
                    ))}
                  {(workforceStateQuery.data?.roleSupportPlans || [])
                    .filter(
                      (item: JsonRecord) =>
                        item.subjectSeatId === principalContext?.seatId &&
                        !["completed", "cancelled"].includes(item.state),
                    )
                    .slice(0, 2)
                    .map((item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{item.supportMode}</Badge>
                          <StateBadge state={item.state} />
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {item.responsibility}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.objective}
                        </p>
                      </div>
                    ))}
                  {(workforceStateQuery.data?.reviews || [])
                    .filter(
                      (item: JsonRecord) =>
                        item.subjectSeatId === principalContext?.seatId,
                    )
                    .slice(0, 3)
                    .map((item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge state={item.state} />
                          {item.correctionStatus !== "none" && (
                            <Badge variant="outline">
                              correction {item.correctionStatus}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm">{item.outcomeSummary}</p>
                      </div>
                    ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveTab("workforce");
                      window.location.hash = "workforce";
                    }}
                  >
                    Open my workforce cockpit
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Effective authority</CardTitle>
                <CardDescription>
                  These powers come from currently effective, tenant-bound
                  Authority Grants—not from your title or access to a tool.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {Array.from(effectiveAuthorityClasses).map(
                    (authorityClass) => (
                      <Badge key={authorityClass} variant="outline">
                        {authorityClass.replaceAll("_", " ")}
                      </Badge>
                    ),
                  )}
                  {!effectiveAuthorityClasses.size && (
                    <span className="text-sm text-muted-foreground">
                      No effective action authority. Inspect the grant lifecycle
                      or escalate through your reporting path.
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {(principalContext?.authority?.grants || []).map(
                    (grant: JsonRecord) => (
                      <div key={grant.id} className="rounded-xl bg-muted p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {grant.authorityKey}
                          </span>
                          {grant.delegable && <Badge>delegable</Badge>}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {(grant.conditions || []).join(" · ") ||
                            "No additional conditions recorded."}
                        </p>
                        {grant.effectiveUntil && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Effective until{" "}
                            {new Date(grant.effectiveUntil).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Policy decision evidence</CardTitle>
                <CardDescription>
                  Recent permit, denial, approval, evidence, and escalation
                  results for this identity—or the organization when your seat
                  has administration authority.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(policyDecisionsQuery.data || [])
                  .slice(0, 12)
                  .map((decision: JsonRecord) => (
                    <div key={decision.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {String(
                              decision.actionKey || decision.resource,
                            ).replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {String(decision.authorityClass).replaceAll(
                              "_",
                              " ",
                            )}{" "}
                            · {decision.purpose.replaceAll("_", " ")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            decision.outcome === "permit"
                              ? "default"
                              : decision.outcome === "deny"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {decision.outcome.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {(decision.reasonCodes || []).join(" · ") ||
                          "No reason code recorded"}{" "}
                        · {new Date(decision.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                {policyDecisionsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading policy evidence…
                  </p>
                )}
                {policyDecisionsQuery.isError && (
                  <p className="text-sm text-destructive">
                    Policy evidence could not be loaded for this seat.
                  </p>
                )}
                {policyDecisionsQuery.isSuccess &&
                  !policyDecisionsQuery.data?.length && (
                    <p className="text-sm text-muted-foreground">
                      No policy decisions have been recorded in this authority
                      scope yet.
                    </p>
                  )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Role Operating Pack</CardTitle>
                <CardDescription>
                  The institutional role contract persists while occupants
                  change.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="eos-label">Mission</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    {activeRolePack.mission ||
                      activePositionAgreement.resultStatement ||
                      "Mission awaiting compilation."}
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-muted p-4">
                    <p className="eos-label mb-2">Accountable outputs</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {(activeRolePack.outputs || []).map((item: string) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <p className="eos-label mb-2">Qualification</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {(activeRolePack.qualificationTests || []).map(
                        (item: string) => (
                          <li key={item}>• {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Fact
                    label="Review cadence"
                    value={activeRolePack.reviewCadence || "Not compiled"}
                  />
                  <Fact
                    label="Queue types"
                    value={
                      (activeRolePack.queueTypes || []).join(", ") ||
                      "Not compiled"
                    }
                  />
                  <Fact
                    label="Evidence standard"
                    value={
                      (activeRolePack.evidenceRequirements ||
                        activePositionAgreement.evidenceRequirements || [
                          "Not compiled",
                        ])[0]
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>My next move</CardTitle>
                <CardDescription>
                  Use only actions available inside this seat's compiled
                  authority.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Fact
                  label="Current priority"
                  value={
                    pendingApprovalCount && allowedSurfaces.has("review")
                      ? `${pendingApprovalCount} assigned decision${pendingApprovalCount === 1 ? "" : "s"}`
                      : activePackets[0]?.title || nextAction
                  }
                />
                <div className="flex flex-wrap gap-2">
                  {pendingApprovalCount > 0 &&
                    allowedSurfaces.has("review") && (
                      <Button onClick={() => goToSurface("review")}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Review assigned decisions
                      </Button>
                    )}
                  {allowedSurfaces.has("work-room") && (
                    <Button
                      variant={
                        pendingApprovalCount > 0 &&
                        allowedSurfaces.has("review")
                          ? "outline"
                          : "default"
                      }
                      onClick={() => goToSurface("work-room")}
                    >
                      <BriefcaseBusiness className="mr-2 h-4 w-4" />
                      Open assigned work
                    </Button>
                  )}
                  {allowedSurfaces.has("academy") && (
                    <Button
                      variant="outline"
                      onClick={() => goToSurface("academy")}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Practice this role
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      sendEaMessage(
                        `Brief me on the next action for my ${principalContext?.seat || "current seat"}. Keep it inside my authority and reporting path.`,
                      )
                    }
                  >
                    <MessagesSquare className="mr-2 h-4 w-4" />
                    Ask {assistantName}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules" className="space-y-6">
            {selectedModule && (
              <Card
                id="module-workspace"
                className="scroll-mt-72 border-primary/20"
              >
                <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        Module {selectedModule.id}
                      </Badge>
                      <StateBadge state={moduleState(selectedModule)} />
                    </div>
                    <CardTitle className="mt-3">
                      {selectedModule.name}
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-3xl">
                      {selectedModule.overlayBoundary}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedSurfaces.has("operations") && (
                      <Button
                        onClick={() =>
                          prepareWorkPacket(
                            `Module ${selectedModule.id}: ${selectedModule.missionTitle}`,
                            selectedModule.missionObjective,
                            selectedModule.evidenceRequirement,
                          )
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Prepare governed mission
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        sendEaMessage(
                          `For EOS module ${selectedModule.id}, ${selectedModule.name}, assess the current state in my authority scope and prepare the next safe action. Preserve source identity, approvals, and required evidence.`,
                        )
                      }
                    >
                      <MessagesSquare className="mr-2 h-4 w-4" />
                      Ask {assistantName}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Fact
                      label="Operating surface"
                      value={sectionTitle[selectedModule.operatingSurface]}
                    />
                    <Fact
                      label="Required proof"
                      value={selectedModule.evidenceRequirement}
                    />
                    <Fact
                      label="Manual fallback"
                      value={selectedModule.fallback}
                    />
                    <Fact
                      label="Visible closure"
                      value={artifactClosureSummaryQuery.data
                        ? `${moduleQualification(selectedModule).capabilityGroups} capability ${moduleQualification(selectedModule).capabilityGroups === 1 ? "matrix" : "matrices"} · ${moduleQualification(selectedModule).blockers} open blockers`
                        : "Qualification state is outside this seat's visible operating scope."}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        goToSurface(selectedModule.operatingSurface)
                      }
                    >
                      Open {sectionTitle[selectedModule.operatingSurface]}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      The overlay coordinates work here; authoritative provider
                      records remain authoritative until a qualified native
                      cutover.
                    </span>
                  </div>
                  <Suspense fallback={<DeferredControlFallback />}>
                  {selectedModule.id === 13 && (
                    <ComplianceControlCenter
                      root={root}
                      canExecute={effectiveAuthorityClasses.has("execute")}
                      canDecide={effectiveAuthorityClasses.has("decide")}
                    />
                  )}
                  {selectedModule.id === 7 && (
                    <CustomerSuccessControlCenter
                      root={root}
                      canExecute={effectiveAuthorityClasses.has("execute")}
                      canDecide={effectiveAuthorityClasses.has("decide")}
                    />
                  )}
                  {selectedModule.id === 11 && (
                    <ProductEvolutionControlCenter
                      root={root}
                      canExecute={effectiveAuthorityClasses.has("execute")}
                      canDecide={effectiveAuthorityClasses.has("decide")}
                      isFounder={isFounder}
                    />
                  )}
                  {selectedModule.id === 12 && (
                    <IntegrationOperationsControlCenter
                      root={root}
                      canExecute={effectiveAuthorityClasses.has("execute")}
                      canDecide={effectiveAuthorityClasses.has("decide")}
                      canApprove={effectiveAuthorityClasses.has("approve")}
                    />
                  )}
                  <div className="mt-6">
                    <ArtifactClosureControlCenter
                      root={root}
                      module={selectedModule}
                      canExecute={effectiveAuthorityClasses.has("execute")}
                      canDecide={effectiveAuthorityClasses.has("decide")}
                    />
                  </div>
                  </Suspense>
                </CardContent>
              </Card>
            )}
            <div>
              <p className="eos-label">Role-available business functions</p>
              <h2 className="mt-1 text-xl font-semibold">Choose a module</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                You see only modules whose operating surface is available to
                your compiled seat. Opening one reveals a real next action,
                proof requirement, and fallback.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleModules.map((module) => (
                <Card
                  key={module.id}
                  className={
                    selectedModule?.id === module.id
                      ? "border-primary/30 shadow-[0_8px_28px_rgba(106,55,212,0.10)]"
                      : ""
                  }
                >
                  <CardContent className="flex h-full flex-col pt-8">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">Module {module.id}</Badge>
                      <StateBadge state={moduleState(module)} />
                    </div>
                    <h3 className="mt-5 font-semibold">{module.name}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">
                      {module.missionObjective}
                    </p>
                    {artifactClosureSummaryQuery.data && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        {moduleQualification(module).capabilityGroups
                          ? `${moduleQualification(module).capabilityGroups} visible ${moduleQualification(module).capabilityGroups === 1 ? "matrix" : "matrices"} · ${moduleQualification(module).rows}/${moduleQualification(module).capabilityGroups * 22} canonical rows · ${moduleQualification(module).blockers} blockers`
                          : "No capability closure matrix has been initialized."}
                      </p>
                    )}
                    <Button
                      className="mt-5 w-full"
                      variant={
                        selectedModule?.id === module.id ? "default" : "outline"
                      }
                      aria-pressed={selectedModule?.id === module.id}
                      onClick={() => openModule(module)}
                    >
                      Open module
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!visibleModules.length && (
              <EmptyState
                icon={Blocks}
                title="No operating modules are assigned"
                description="Ask your direct supervisor to review this seat's authority and tool entitlements."
              />
            )}
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Dormant modules stay dormant</AlertTitle>
              <AlertDescription>
                Capital & Investor Relations, M&amp;A, and Board &amp; Advisor
                Governance remain mapped for the future but cannot initiate
                active workflows in this MVP.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="commercial" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric
                label="Canonical parties"
                value={commercialStateQuery.data?.counts?.parties || 0}
                icon={UserRound}
                actionLabel="Add party"
                onClick={() =>
                  document
                    .getElementById("commercial-parties")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Active relationships"
                value={
                  commercialStateQuery.data?.counts?.activeRelationships || 0
                }
                icon={Network}
                actionLabel="Open relationships"
                onClick={() =>
                  document
                    .getElementById("commercial-relationships")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Active offers"
                value={commercialStateQuery.data?.counts?.activeOffers || 0}
                icon={Blocks}
                actionLabel="Open offers"
                onClick={() =>
                  document
                    .getElementById("commercial-offers")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Open cases"
                value={commercialStateQuery.data?.counts?.openCases || 0}
                icon={BriefcaseBusiness}
                actionLabel="Open pipeline"
                onClick={() =>
                  document
                    .getElementById("commercial-cases")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Open commitments"
                value={commercialStateQuery.data?.counts?.openCommitments || 0}
                icon={Workflow}
                actionLabel="Open value flow"
                onClick={() =>
                  document
                    .getElementById("commercial-flows")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Stakeholder & commercial instrument</CardTitle>
                <CardDescription>
                  Move one canonical party through relationship, offer,
                  opportunity, commitment, and outcome without duplicating
                  identity or rewriting provider facts.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    sendEaMessage(
                      `Assess the commercial position for ${company.name} from its canonical party, relationship, offer, opportunity, and value-flow state. Name missing evidence and the next decision.`,
                    )
                  }
                >
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Ask {assistantName} for assessment
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    prepareWorkPacket(
                      "Validate commercial assumptions",
                      `Test the current offer, party need, fit hypothesis, and next action for ${company.name}; attach evidence and return the next governed decision.`,
                    )
                  }
                >
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Create validation mission
                </Button>
              </CardContent>
            </Card>

            <Card id="recovery-sales-briefs" className="scroll-mt-40">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Recovery diagnostic queue</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl">
                      Consent-qualified calculator submissions become canonical
                      prospect relationships with a deterministic Sales Brief.
                      Modeled opportunity is never treated as verified revenue.
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline">
                    <a href={`/recovery?companyId=${encodeURIComponent(companyId)}`} target="_blank" rel="noreferrer">
                      Open public calculator
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(recoveryLeadsQuery.data?.providerReceiptExceptions || []).length > 0 && <Alert variant="destructive"><TriangleAlert className="h-4 w-4"/><AlertTitle>Provider receipt recovery queue</AlertTitle><AlertDescription>{recoveryLeadsQuery.data?.providerReceiptExceptions?.length || 0} signature-verified event{recoveryLeadsQuery.data?.providerReceiptExceptions?.length === 1 ? "" : "s"} could not be safely applied. Open the matching activation timeline and reconcile account, tenant, object, package, price, amount, currency, or terminal-state conflicts before proceeding.</AlertDescription></Alert>}
                {(recoveryLeadsQuery.data?.sessions || []).map(
                  (session: JsonRecord) => (
                    <article
                      key={session.id}
                      className="space-y-4 rounded-xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StateBadge state={session.status} />
                            {session.fit && (
                              <Badge variant="outline">
                                {String(session.fit).replaceAll("_", " ")}
                              </Badge>
                            )}
                            {typeof session.score === "number" && (
                              <Badge variant="secondary">
                                Score {session.score}
                              </Badge>
                            )}
                          </div>
                          <h3 className="mt-3 font-semibold">
                            {session.companyName || "Anonymous diagnostic"}
                            {session.firstName ? ` · ${session.firstName}` : ""}
                          </h3>
                          {session.workEmail && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {session.workEmail}
                              {session.phone ? ` · ${session.phone}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{String(session.route || "not routed").replaceAll("_", " ")}</p>
                          <p className="mt-1">
                            {session.contactCapturedAt
                              ? new Date(session.contactCapturedAt).toLocaleString()
                              : "Contact not captured"}
                          </p>
                        </div>
                      </div>
                      {session.salesBrief?.headline && (
                        <div className="grid gap-3 lg:grid-cols-3">
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="eos-label">Dominant pool</p>
                            <p className="mt-2 text-sm font-medium">
                              {session.salesBrief.dominantOpportunity?.label}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="eos-label">Modeled base</p>
                            <p className="mt-2 text-sm font-medium">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }).format(
                                session.salesBrief.modeledRange?.base || 0,
                              )} / month
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="eos-label">Writeback</p>
                            <p className="mt-2 text-sm font-medium">
                              Native EOS saved · external {String(
                                session.externalWritebackState ||
                                  "not_configured",
                              ).replaceAll("_", " ")}
                            </p>
                          </div>
                        </div>
                      )}
                      {session.salesBrief?.validationQuestions?.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">
                            Open Sales Brief
                          </summary>
                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="text-sm font-semibold">Validation questions</p>
                              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                {session.salesBrief.validationQuestions.map(
                                  (question: string) => (
                                    <li key={question}>• {question}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Fit concerns</p>
                              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                {(session.salesBrief.fitConcerns || []).map(
                                  (concern: string) => (
                                    <li key={concern}>• {concern}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                            <Alert className="lg:col-span-2">
                              <ShieldCheck className="h-4 w-4" />
                              <AlertTitle>Commercial guardrail</AlertTitle>
                              <AlertDescription>
                                {session.salesBrief.commercialGuardrail}
                              </AlertDescription>
                            </Alert>
                          </div>
                        </details>
                      )}
                      <RecoveryCall2Control
                        session={session}
                        root={root}
                        onChanged={refresh}
                        activationBindings={recoveryLeadsQuery.data?.activationBindings || []}
                        evidence={evidenceQuery.data || []}
                        providerExecutions={providerExecutionsQuery.data || []}
                        canRecordCounselDisposition={Boolean(recoveryLeadsQuery.data?.capabilities?.recordCounselDisposition)}
                      />
                    </article>
                  ),
                )}
                {!recoveryLeadsQuery.isLoading &&
                  !(recoveryLeadsQuery.data?.sessions || []).length && (
                    <EmptyState
                      icon={Gauge}
                      title="No Recovery diagnostics yet"
                      description="Share the public calculator. Contact details are written into EOS only after explicit consent."
                    />
                  )}
              </CardContent>
            </Card>

            <Card id="customer-value-cycles" className="scroll-mt-40">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Pre-live customer-value cycle</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl">
                      Rehearse one continuous path from commercial approval to
                      agreement, onboarding, delivery, reporting, and renewal
                      or closeout. This instrument is synthetic-only and cannot
                      execute external effects or enter real metrics.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Synthetic / Non-Production</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3 rounded-xl border p-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <select
                      aria-label="Customer-value commercial case"
                      value={customerCycleCaseId}
                      onChange={(event) => {
                        setCustomerCycleCaseId(event.target.value);
                        setCustomerCycleRelationshipId("");
                      }}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose a case with an offer</option>
                      {(commercialStateQuery.data?.cases || [])
                        .filter((item: JsonRecord) => Boolean(item.offerId))
                        .map((item: JsonRecord) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                    </select>
                    <select
                      aria-label="Customer-value relationship"
                      value={customerCycleRelationshipId}
                      onChange={(event) => setCustomerCycleRelationshipId(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose the case relationship</option>
                      {(commercialStateQuery.data?.relationships || [])
                        .filter((relationship: JsonRecord) => {
                          const selectedCase = (commercialStateQuery.data?.cases || []).find(
                            (item: JsonRecord) => item.id === customerCycleCaseId,
                          );
                          return (selectedCase?.stakeholderIds || []).includes(relationship.stakeholderId);
                        })
                        .map((item: JsonRecord) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                    </select>
                  </div>
                  <Input
                    aria-label="Customer-value fixture title"
                    value={customerCycleTitle}
                    onChange={(event) => setCustomerCycleTitle(event.target.value)}
                    placeholder="TEST-PRELIVE-Customer-Value-Rehearsal"
                  />
                  <div className="grid gap-3 lg:grid-cols-3">
                    <Textarea
                      aria-label="Customer-value objective"
                      value={customerCycleObjective}
                      onChange={(event) => setCustomerCycleObjective(event.target.value)}
                      placeholder="Synthetic rehearsal objective"
                    />
                    <Textarea
                      aria-label="Customer-value acceptance criteria"
                      value={customerCycleAcceptance}
                      onChange={(event) => setCustomerCycleAcceptance(event.target.value)}
                      placeholder="Observable acceptance criteria"
                    />
                    <Textarea
                      aria-label="Customer-value cleanup criteria"
                      value={customerCycleCleanup}
                      onChange={(event) => setCustomerCycleCleanup(event.target.value)}
                      placeholder="Restored-safe-state and cleanup criteria"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      !customerCycleTitle.toUpperCase().startsWith("TEST-PRELIVE-") ||
                      customerCycleTitle.trim().length < 16 ||
                      !customerCycleCaseId ||
                      !customerCycleRelationshipId ||
                      customerCycleObjective.trim().length < 10 ||
                      customerCycleAcceptance.trim().length < 10 ||
                      customerCycleCleanup.trim().length < 10 ||
                      !effectiveAuthorityClasses.has("execute") ||
                      customerValueCycleMutation.isPending
                    }
                    onClick={() => customerValueCycleMutation.mutate()}
                  >
                    <Workflow className="mr-2 h-4 w-4" />
                    {customerValueCycleMutation.isPending ? "Creating rehearsal…" : "Create approval-gated rehearsal"}
                  </Button>
                </div>

                <div className="space-y-4">
                  {(commercialStateQuery.data?.customerValueCycles || []).map((cycle: JsonRecord) => {
                    const cycleEvidence = evidence.filter(
                      (item: JsonRecord) => item.workPacketId === cycle.workPacketId && item.verificationState === "verified",
                    );
                    const note = customerCycleNotes[cycle.id] || "";
                    const evidenceNote = customerCycleEvidenceNotes[cycle.id] || "";
                    const selectedEvidenceId = customerCycleEvidenceIds[cycle.id] || "";
                    const providerCheckpoints = cycle.providerCheckpoints || [];
                    const qualifiedProviderCheckpoints = providerCheckpoints.filter(
                      (checkpoint: JsonRecord) => checkpoint.state === "contract_qualified",
                    );
                    const providerContractsReady =
                      providerCheckpoints.length === 5 &&
                      qualifiedProviderCheckpoints.length === providerCheckpoints.length;
                    const primaryActions: Record<string, Array<{ action: string; label: string }>> = {
                      commercial_approved: [{ action: "verify_agreement", label: "Verify agreement fixture" }],
                      agreement_ready: [{ action: "start_onboarding", label: "Start onboarding" }],
                      onboarding: [{ action: "start_delivery", label: "Start delivery" }],
                      delivery: [{ action: "start_reporting", label: "Start reporting" }],
                      reporting: [{ action: "start_renewal_review", label: "Start renewal review" }],
                      renewal_review: [
                        { action: "renew", label: "Renew fixture" },
                        { action: "close", label: "Close fixture" },
                      ],
                      renewed: [{ action: "close", label: "Close fixture" }],
                      recovery_required: [{ action: "restore_safe_state", label: "Verify safe-state restoration" }],
                    };
                    const phaseActions = primaryActions[cycle.state] || [];
                    const mayFail = ["agreement_ready", "onboarding", "delivery", "reporting", "renewal_review"].includes(cycle.state);
                    const mayCancel = !["awaiting_commercial_approval", "commercial_rejected", "renewed", "closed", "cancelled"].includes(cycle.state);
                    return (
                      <div key={cycle.id} className="space-y-4 rounded-xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <StateBadge state={cycle.state} />
                              <Badge variant="outline">{cycle.syntheticLabel}</Badge>
                              <Badge variant="secondary">Excluded from metrics</Badge>
                            </div>
                            <p className="mt-3 font-semibold">{cycle.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{cycle.objective}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">v{cycle.version} · {cycle.events?.length || 0} receipts</span>
                        </div>

                        {cycle.state === "awaiting_commercial_approval" && (
                          <Alert>
                            <ShieldCheck className="h-4 w-4" />
                            <AlertTitle>Commercial decision required</AlertTitle>
                            <AlertDescription>Use the approval HUD to approve or reject this rehearsal before any phase can advance.</AlertDescription>
                          </Alert>
                        )}
                        {cycle.state === "recovery_required" && (
                          <Alert variant="destructive">
                            <TriangleAlert className="h-4 w-4" />
                            <AlertTitle>Recovery required</AlertTitle>
                            <AlertDescription>{cycle.failureSummary}</AlertDescription>
                          </Alert>
                        )}

                        <div className="space-y-3 rounded-lg border bg-background p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">Provider contract checkpoints</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {qualifiedProviderCheckpoints.length}/{providerCheckpoints.length || 5} deterministic adapter suites qualified. This does not verify a provider account, credential, permission, health check, or live effect.
                              </p>
                            </div>
                            <Badge variant={providerContractsReady ? "default" : "secondary"}>
                              {providerContractsReady ? "Pre-live contracts ready" : "Agreement gate blocked"}
                            </Badge>
                          </div>
                          <div className="grid gap-2 lg:grid-cols-2">
                            {providerCheckpoints.map((checkpoint: JsonRecord) => (
                              <div key={checkpoint.id} className="space-y-2 rounded-lg border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">{String(checkpoint.providerKey).replaceAll("-", " ")}</p>
                                    <p className="text-xs text-muted-foreground">{String(checkpoint.phaseKey).replaceAll("_", " ")}</p>
                                  </div>
                                  <StateBadge state={checkpoint.state} />
                                </div>
                                <p className="break-words text-xs text-muted-foreground">{checkpoint.operationKey}</p>
                                {checkpoint.state === "contract_qualified" ? (
                                  <div className="space-y-1 text-xs">
                                    <p>{checkpoint.scenarioResults?.length || 0} scenarios passed · hashes and evidence retained</p>
                                    <p className="font-medium text-amber-700 dark:text-amber-300">Live provider unverified</p>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={cycle.state !== "commercial_approved" || customerValueProviderContractMutation.isPending}
                                    onClick={() => customerValueProviderContractMutation.mutate({ cycleId: cycle.id, checkpointId: checkpoint.id })}
                                  >
                                    Run fixture suite
                                  </Button>
                                )}
                                <details>
                                  <summary className="cursor-pointer text-xs font-medium">Live activation blocker</summary>
                                  <p className="mt-2 text-xs text-muted-foreground">{checkpoint.liveProviderBlocker}</p>
                                </details>
                              </div>
                            ))}
                          </div>
                        </div>

                        {(phaseActions.length > 0 || mayFail || mayCancel) && (
                          <div className="space-y-3 rounded-lg bg-muted/40 p-3">
                            <Textarea
                              aria-label={`Customer-value action note for ${cycle.title}`}
                              value={note}
                              onChange={(event) => setCustomerCycleNotes((current) => ({ ...current, [cycle.id]: event.target.value }))}
                              placeholder="What was verified, what changed, and what remains true?"
                            />
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                              <select
                                aria-label={`Customer-value evidence for ${cycle.title}`}
                                value={selectedEvidenceId}
                                onChange={(event) => setCustomerCycleEvidenceIds((current) => ({ ...current, [cycle.id]: event.target.value }))}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="">Choose a verified cycle receipt</option>
                                {cycleEvidence.map((item: JsonRecord) => (
                                  <option key={item.id} value={item.id}>{item.title}</option>
                                ))}
                              </select>
                              <Button
                                variant="outline"
                                disabled={evidenceNote.trim().length < 5 || customerValueCycleEvidenceMutation.isPending}
                                onClick={() => customerValueCycleEvidenceMutation.mutate({ cycleId: cycle.id, workPacketId: cycle.workPacketId, note: evidenceNote })}
                              >
                                Verify receipt
                              </Button>
                            </div>
                            <Input
                              aria-label={`New customer-value evidence note for ${cycle.title}`}
                              value={evidenceNote}
                              onChange={(event) => setCustomerCycleEvidenceNotes((current) => ({ ...current, [cycle.id]: event.target.value }))}
                              placeholder="Describe the synthetic phase receipt, failure, or restored-safe-state proof"
                            />
                            <div className="flex flex-wrap gap-2">
                              {phaseActions.map((item) => (
                                <Button
                                  key={item.action}
                                  size="sm"
                                  disabled={
                                    note.trim().length < 5 ||
                                    !selectedEvidenceId ||
                                    customerValueCycleActionMutation.isPending ||
                                    (item.action === "verify_agreement" && !providerContractsReady)
                                  }
                                  onClick={() => customerValueCycleActionMutation.mutate({ cycleId: cycle.id, action: item.action, note, evidenceId: selectedEvidenceId })}
                                >
                                  {item.label}
                                </Button>
                              ))}
                              {mayFail && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={note.trim().length < 5 || !selectedEvidenceId || customerValueCycleActionMutation.isPending}
                                  onClick={() => customerValueCycleActionMutation.mutate({ cycleId: cycle.id, action: "report_failure", note, evidenceId: selectedEvidenceId })}
                                >
                                  Report failure
                                </Button>
                              )}
                              {mayCancel && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={note.trim().length < 5 || !selectedEvidenceId || customerValueCycleActionMutation.isPending}
                                  onClick={() => customerValueCycleActionMutation.mutate({ cycleId: cycle.id, action: "cancel", note, evidenceId: selectedEvidenceId })}
                                >
                                  Cancel safely
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        <details>
                          <summary className="cursor-pointer text-sm font-medium">Evidence trail ({cycle.events?.length || 0})</summary>
                          <div className="mt-3 space-y-2">
                            {(cycle.events || []).map((event: JsonRecord) => (
                              <div key={event.id} className="rounded-lg border bg-background p-3 text-sm">
                                <span className="font-medium">{event.eventType.replaceAll("_", " ")}</span>
                                <span className="text-muted-foreground"> · {event.fromState.replaceAll("_", " ")} → {event.toState.replaceAll("_", " ")}</span>
                                {event.note && <p className="mt-1 text-muted-foreground">{event.note}</p>}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                  {!commercialStateQuery.isLoading && !(commercialStateQuery.data?.customerValueCycles || []).length && (
                    <p className="text-sm text-muted-foreground">No customer-value rehearsal has been created yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card id="commercial-shared-services" className="scroll-mt-40">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Company-to-company shared services</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl">
                      Request work through an approved intercompany
                      relationship. Each company keeps its own authority,
                      Work Packet, evidence, decisions, and reporting line.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">No direct agent commands</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {(sharedServiceCandidatesQuery.data || []).length > 0 && (
                  <div className="space-y-3 rounded-xl border p-4">
                    <div>
                      <p className="font-semibold">Request a shared service</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The provider sees the request only after your company
                        approves it. Acceptance by the provider is a separate
                        decision.
                      </p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <select
                        aria-label="Shared-service provider"
                        value={sharedServiceProviderId}
                        onChange={(event) =>
                          setSharedServiceProviderId(event.target.value)
                        }
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Choose provider company</option>
                        {(sharedServiceCandidatesQuery.data || []).map(
                          (candidate: JsonRecord) => (
                            <option
                              key={candidate.companyId}
                              value={candidate.companyId}
                            >
                              {candidate.companyName} · {candidate.relationshipTitle}
                            </option>
                          ),
                        )}
                      </select>
                      <select
                        aria-label="Shared-service priority"
                        value={sharedServicePriority}
                        onChange={(event) =>
                          setSharedServicePriority(event.target.value)
                        }
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                        <option value="urgent">Urgent priority</option>
                      </select>
                    </div>
                    <Input
                      aria-label="Shared-service title"
                      value={sharedServiceTitle}
                      onChange={(event) =>
                        setSharedServiceTitle(event.target.value)
                      }
                      placeholder="Deliverable title"
                    />
                    <div className="grid gap-3 lg:grid-cols-2">
                      <Textarea
                        aria-label="Shared-service scope"
                        value={sharedServiceScope}
                        onChange={(event) =>
                          setSharedServiceScope(event.target.value)
                        }
                        placeholder="Bounded scope — what is and is not included"
                      />
                      <Textarea
                        aria-label="Shared-service beneficiary"
                        value={sharedServiceBeneficiary}
                        onChange={(event) =>
                          setSharedServiceBeneficiary(event.target.value)
                        }
                        placeholder="Who benefits and what operating outcome they need"
                      />
                      <Textarea
                        aria-label="Shared-service inputs"
                        value={sharedServiceInputs}
                        onChange={(event) =>
                          setSharedServiceInputs(event.target.value)
                        }
                        placeholder="Required inputs — one per line"
                      />
                      <Textarea
                        aria-label="Shared-service acceptance criteria"
                        value={sharedServiceAcceptance}
                        onChange={(event) =>
                          setSharedServiceAcceptance(event.target.value)
                        }
                        placeholder="Observable acceptance criteria"
                      />
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <Input
                        aria-label="Shared-service due date"
                        type="datetime-local"
                        min={new Date(Date.now() + 60_000)
                          .toISOString()
                          .slice(0, 16)}
                        value={sharedServiceDueAt}
                        onChange={(event) =>
                          setSharedServiceDueAt(event.target.value)
                        }
                      />
                      <Input
                        aria-label="Shared-service cost and capacity treatment"
                        value={sharedServiceCostTreatment}
                        onChange={(event) =>
                          setSharedServiceCostTreatment(event.target.value)
                        }
                        placeholder="Capacity reservation, transfer price, or no-charge rationale"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        !sharedServiceProviderId ||
                        sharedServiceTitle.trim().length < 3 ||
                        sharedServiceScope.trim().length < 10 ||
                        sharedServiceBeneficiary.trim().length < 3 ||
                        !sharedServiceInputs.trim() ||
                        sharedServiceAcceptance.trim().length < 10 ||
                        !sharedServiceDueAt ||
                        new Date(sharedServiceDueAt).getTime() <= Date.now() ||
                        sharedServiceCostTreatment.trim().length < 5 ||
                        !effectiveAuthorityClasses.has("execute") ||
                        sharedServiceRequestMutation.isPending
                      }
                      onClick={() => sharedServiceRequestMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {sharedServiceRequestMutation.isPending
                        ? "Creating request…"
                        : "Create approval-gated request"}
                    </Button>
                  </div>
                )}

                {!sharedServiceCandidatesQuery.isLoading &&
                  !(sharedServiceCandidatesQuery.data || []).length &&
                  !(sharedServicesQuery.data || []).length && (
                    <Alert>
                      <Network className="h-4 w-4" />
                      <AlertTitle>No eligible provider relationship</AlertTitle>
                      <AlertDescription>
                        Compile both companies in the same portfolio, then add
                        an active organization relationship using the provider's
                        canonical EOS organization identity. EOS will not infer
                        a cross-company authority path.
                      </AlertDescription>
                    </Alert>
                  )}

                <div className="space-y-4">
                  {(sharedServicesQuery.data || []).map(
                    (engagement: JsonRecord) => {
                      const isProvider = engagement.side === "provider";
                      const localWorkPacketId = isProvider
                        ? engagement.providerWorkPacketId
                        : engagement.beneficiaryWorkPacketId;
                      const localEvidence = evidence.filter(
                        (item: JsonRecord) =>
                          item.workPacketId === localWorkPacketId &&
                          item.verificationState === "verified",
                      );
                      const actionNote =
                        sharedServiceNotes[engagement.id] || "";
                      const evidenceNote =
                        sharedServiceEvidenceNotes[engagement.id] || "";
                      const selectedEvidenceId =
                        sharedServiceEvidenceIds[engagement.id] || "";
                      const canRecordEvidence =
                        Boolean(localWorkPacketId) &&
                        ((isProvider &&
                          ["in_progress", "rework_requested"].includes(
                            engagement.state,
                          )) ||
                          (!isProvider && engagement.state === "delivered"));
                      return (
                        <div
                          key={engagement.id}
                          className="space-y-4 rounded-xl border p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <StateBadge state={engagement.state} />
                                <Badge variant="outline">
                                  {isProvider ? "Provider" : "Beneficiary"}
                                </Badge>
                                <Badge variant="secondary">
                                  {engagement.priority} priority
                                </Badge>
                              </div>
                              <h3 className="mt-3 font-semibold">
                                {engagement.title}
                              </h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {engagement.beneficiaryCompanyName} →{" "}
                                {engagement.providerCompanyName} · due{" "}
                                {new Date(engagement.dueAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {engagement.beneficiaryApprovalStatus} beneficiary
                              approval
                            </Badge>
                          </div>

                          <div className="grid gap-3 text-sm lg:grid-cols-2">
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="font-medium">Scope</p>
                              <p className="mt-1 text-muted-foreground">
                                {engagement.scope}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="font-medium">Acceptance</p>
                              <p className="mt-1 text-muted-foreground">
                                {engagement.acceptanceCriteria}
                              </p>
                            </div>
                          </div>

                          {canRecordEvidence && (
                            <div className="space-y-3 rounded-lg border border-dashed p-3">
                              <p className="text-sm font-medium">
                                {isProvider
                                  ? "Provider delivery evidence"
                                  : "Beneficiary review evidence"}
                              </p>
                              <Textarea
                                aria-label={`Evidence note for ${engagement.title}`}
                                value={evidenceNote}
                                onChange={(event) =>
                                  setSharedServiceEvidenceNotes((current) => ({
                                    ...current,
                                    [engagement.id]: event.target.value,
                                  }))
                                }
                                placeholder="Describe the inspected artifact, test, or review result"
                              />
                              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                                <select
                                  aria-label={`Verified evidence for ${engagement.title}`}
                                  value={selectedEvidenceId}
                                  onChange={(event) =>
                                    setSharedServiceEvidenceIds((current) => ({
                                      ...current,
                                      [engagement.id]: event.target.value,
                                    }))
                                  }
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                  <option value="">
                                    Choose verified company-local evidence
                                  </option>
                                  {localEvidence.map((item: JsonRecord) => (
                                    <option key={item.id} value={item.id}>
                                      {item.title}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  variant="outline"
                                  disabled={
                                    evidenceNote.trim().length < 5 ||
                                    !effectiveAuthorityClasses.has("approve") ||
                                    sharedServiceEvidenceMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceEvidenceMutation.mutate({
                                      engagementId: engagement.id,
                                      workPacketId: localWorkPacketId,
                                      title: isProvider
                                        ? `Verified delivery evidence: ${engagement.title}`
                                        : `Verified acceptance review: ${engagement.title}`,
                                      details: evidenceNote,
                                    })
                                  }
                                >
                                  <FileCheck2 className="mr-2 h-4 w-4" />
                                  Record verified evidence
                                </Button>
                              </div>
                              {!effectiveAuthorityClasses.has("approve") && (
                                <p className="text-xs text-muted-foreground">
                                  A supervisor with evidence-approval authority
                                  must verify the local record before handoff.
                                </p>
                              )}
                            </div>
                          )}

                          {["provider_review", "clarification_requested", "in_progress", "rework_requested", "delivered"].includes(
                            engagement.state,
                          ) && (
                            <Textarea
                              aria-label={`Action note for ${engagement.title}`}
                              value={actionNote}
                              onChange={(event) =>
                                setSharedServiceNotes((current) => ({
                                  ...current,
                                  [engagement.id]: event.target.value,
                                }))
                              }
                              placeholder={
                                engagement.state === "delivered"
                                  ? "Acceptance, rejection, or bounded rework rationale"
                                  : "Response, clarification, or delivery summary"
                              }
                            />
                          )}

                          <div className="flex flex-wrap gap-2">
                            {!isProvider &&
                              engagement.state ===
                                "awaiting_beneficiary_approval" && (
                                <Button
                                  onClick={() => goToSurface("operations")}
                                >
                                  <ClipboardCheck className="mr-2 h-4 w-4" />
                                  Review local approval
                                </Button>
                              )}
                            {isProvider && engagement.state === "provider_review" && (
                              <>
                                <Button
                                  disabled={
                                    actionNote.trim().length < 3 ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "provider-response",
                                      body: {
                                        decision: "accept",
                                        response: actionNote,
                                      },
                                      success: "Provider accepted the bounded request",
                                    })
                                  }
                                >
                                  Accept request
                                </Button>
                                <Button
                                  variant="outline"
                                  disabled={
                                    actionNote.trim().length < 3 ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "provider-response",
                                      body: {
                                        decision: "request_clarification",
                                        response: actionNote,
                                      },
                                      success: "Clarification requested",
                                    })
                                  }
                                >
                                  Request clarification
                                </Button>
                                <Button
                                  variant="destructive"
                                  disabled={
                                    actionNote.trim().length < 3 ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "provider-response",
                                      body: {
                                        decision: "reject",
                                        response: actionNote,
                                      },
                                      success: "Provider rejected the request",
                                    })
                                  }
                                >
                                  Reject request
                                </Button>
                              </>
                            )}
                            {!isProvider &&
                              engagement.state === "clarification_requested" && (
                                <Button
                                  disabled={
                                    actionNote.trim().length < 3 ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "clarify",
                                      body: {
                                        response: actionNote,
                                        confirmsNoMaterialChange: true,
                                      },
                                      success:
                                        "Clarification returned without changing scope",
                                    })
                                  }
                                >
                                  Return bounded clarification
                                </Button>
                              )}
                            {isProvider && engagement.state === "provider_accepted" && (
                              <Button
                                disabled={sharedServiceActionMutation.isPending}
                                onClick={() =>
                                  sharedServiceActionMutation.mutate({
                                    engagementId: engagement.id,
                                    action: "start",
                                    success: "Provider-local work started",
                                  })
                                }
                              >
                                Start provider work
                              </Button>
                            )}
                            {isProvider &&
                              ["in_progress", "rework_requested"].includes(
                                engagement.state,
                              ) && (
                                <Button
                                  disabled={
                                    actionNote.trim().length < 10 ||
                                    !selectedEvidenceId ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "deliver",
                                      body: {
                                        deliverySummary: actionNote,
                                        evidenceIds: [selectedEvidenceId],
                                      },
                                      success:
                                        "Evidence-bearing delivery returned to the beneficiary",
                                    })
                                  }
                                >
                                  Deliver for acceptance
                                </Button>
                              )}
                            {!isProvider && engagement.state === "delivered" && (
                              <>
                                <Input
                                  aria-label={`Cost and capacity outcome for ${engagement.title}`}
                                  className="min-w-[18rem] flex-1"
                                  value={
                                    sharedServiceCostOutcomes[engagement.id] || ""
                                  }
                                  onChange={(event) =>
                                    setSharedServiceCostOutcomes((current) => ({
                                      ...current,
                                      [engagement.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Actual capacity, cost, and outcome attribution"
                                />
                                <Button
                                  disabled={
                                    actionNote.trim().length < 5 ||
                                    !selectedEvidenceId ||
                                    (sharedServiceCostOutcomes[engagement.id] || "")
                                      .trim().length < 5 ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "disposition",
                                      body: {
                                        decision: "accept",
                                        disposition: actionNote,
                                        evidenceIds: [selectedEvidenceId],
                                        costCapacityOutcome:
                                          sharedServiceCostOutcomes[
                                            engagement.id
                                          ],
                                      },
                                      success:
                                        "Beneficiary accepted the delivery",
                                    })
                                  }
                                >
                                  Accept delivery
                                </Button>
                                <Button
                                  variant="outline"
                                  disabled={
                                    actionNote.trim().length < 5 ||
                                    !selectedEvidenceId ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "disposition",
                                      body: {
                                        decision: "request_rework",
                                        disposition: actionNote,
                                        evidenceIds: [selectedEvidenceId],
                                      },
                                      success: "Bounded rework requested",
                                    })
                                  }
                                >
                                  Request rework
                                </Button>
                                <Button
                                  variant="destructive"
                                  disabled={
                                    actionNote.trim().length < 5 ||
                                    !selectedEvidenceId ||
                                    (sharedServiceCostOutcomes[engagement.id] || "")
                                      .trim().length < 5 ||
                                    sharedServiceActionMutation.isPending
                                  }
                                  onClick={() =>
                                    sharedServiceActionMutation.mutate({
                                      engagementId: engagement.id,
                                      action: "disposition",
                                      body: {
                                        decision: "reject",
                                        disposition: actionNote,
                                        evidenceIds: [selectedEvidenceId],
                                        costCapacityOutcome:
                                          sharedServiceCostOutcomes[
                                            engagement.id
                                          ],
                                      },
                                      success:
                                        "Beneficiary rejected the delivery",
                                    })
                                  }
                                >
                                  Reject delivery
                                </Button>
                              </>
                            )}
                          </div>

                          <details className="text-sm">
                            <summary className="cursor-pointer font-medium">
                              Control history ({engagement.events?.length || 0})
                            </summary>
                            <div className="mt-3 space-y-2 border-l pl-3">
                              {(engagement.events || []).map(
                                (event: JsonRecord) => (
                                  <div key={event.id}>
                                    <p className="font-medium">
                                      {event.eventType.replaceAll("_", " ")}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {event.fromState.replaceAll("_", " ")} →{" "}
                                      {event.toState.replaceAll("_", " ")} ·{" "}
                                      {new Date(event.createdAt).toLocaleString()}
                                      {event.evidenceCount
                                        ? ` · ${event.evidenceCount} evidence item(s)`
                                        : ""}
                                    </p>
                                    {event.note && (
                                      <p className="mt-1 text-muted-foreground">
                                        {event.note}
                                      </p>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </details>
                        </div>
                      );
                    },
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card id="commercial-parties" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Canonical parties</CardTitle>
                  <CardDescription>
                    Record identity once. An email, CRM key, domain, or other
                    stable reference is normalized for duplicate detection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="grid grid-cols-[9rem_1fr] gap-3">
                      <select
                        aria-label="Party type"
                        value={stakeholderType}
                        onChange={(event) =>
                          setStakeholderType(event.target.value)
                        }
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="person">Person</option>
                        <option value="organization">Organization</option>
                        <option value="audience_segment">
                          Audience segment
                        </option>
                        <option value="customer_segment">
                          Customer segment
                        </option>
                        <option value="community">Community</option>
                        <option value="investor">Investor</option>
                        <option value="regulator">Regulator</option>
                        <option value="other">Other</option>
                      </select>
                      <Input
                        aria-label="Party name"
                        value={stakeholderName}
                        onChange={(event) =>
                          setStakeholderName(event.target.value)
                        }
                        placeholder="Person, organization, or segment"
                      />
                    </div>
                    <Input
                      aria-label="Stable identity reference"
                      value={stakeholderIdentity}
                      onChange={(event) =>
                        setStakeholderIdentity(event.target.value)
                      }
                      placeholder="Stable identity reference — email, domain, CRM key"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        stakeholderName.trim().length < 1 ||
                        stakeholderIdentity.trim().length < 1 ||
                        !effectiveAuthorityClasses.has("execute") ||
                        stakeholderMutation.isPending
                      }
                      onClick={() => stakeholderMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {stakeholderMutation.isPending
                        ? "Recording…"
                        : "Record canonical party"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(commercialStateQuery.data?.stakeholders || []).map(
                      (item: JsonRecord) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StateBadge state={item.state} />
                            <Badge variant="outline">
                              {item.partyType.replaceAll("_", " ")}
                            </Badge>
                            {item.sourceAuthority !== "native_eos" && (
                              <Badge variant="secondary">
                                {item.sourceAuthority.replaceAll("_", " ")}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-3 font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.stakeholderKey}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextStakeholderStates(item.state).map((state) => (
                              <Button
                                key={state}
                                size="sm"
                                variant="outline"
                                disabled={
                                  stakeholderTransitionMutation.isPending ||
                                  !effectiveAuthorityClasses.has(
                                    state === "closed" ? "decide" : "execute",
                                  )
                                }
                                onClick={() =>
                                  stakeholderTransitionMutation.mutate({
                                    id: item.id,
                                    state,
                                  })
                                }
                              >
                                {state}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                    {!commercialStateQuery.isLoading &&
                      !(commercialStateQuery.data?.stakeholders || [])
                        .length && (
                        <p className="text-sm text-muted-foreground">
                          No canonical parties recorded yet.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="commercial-relationships" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Relationship contexts</CardTitle>
                  <CardDescription>
                    The same party can be a prospect, customer, partner, vendor,
                    investor, or another governed context.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <select
                      aria-label="Relationship party"
                      value={relationshipPartyId}
                      onChange={(event) =>
                        setRelationshipPartyId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose a canonical party</option>
                      {(commercialStateQuery.data?.stakeholders || [])
                        .filter((item: JsonRecord) => item.state !== "closed")
                        .map((item: JsonRecord) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    <div className="grid grid-cols-[9rem_1fr] gap-3">
                      <select
                        aria-label="Relationship type"
                        value={relationshipType}
                        onChange={(event) =>
                          setRelationshipType(event.target.value)
                        }
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="prospect">Prospect</option>
                        <option value="customer">Customer</option>
                        <option value="partner">Partner</option>
                        <option value="vendor_provider">Vendor</option>
                        <option value="investor">Investor</option>
                        <option value="candidate">Candidate</option>
                        <option value="beneficiary">Beneficiary</option>
                        <option value="other">Other</option>
                      </select>
                      <Input
                        aria-label="Relationship title"
                        value={relationshipTitle}
                        onChange={(event) =>
                          setRelationshipTitle(event.target.value)
                        }
                        placeholder="Relationship context"
                      />
                    </div>
                    <Textarea
                      aria-label="Need or constraint"
                      value={relationshipNeed}
                      onChange={(event) =>
                        setRelationshipNeed(event.target.value)
                      }
                      placeholder="Observed need or constraint"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        !relationshipPartyId ||
                        !relationshipTitle.trim() ||
                        !effectiveAuthorityClasses.has("execute") ||
                        relationshipMutation.isPending
                      }
                      onClick={() => relationshipMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {relationshipMutation.isPending
                        ? "Recording…"
                        : "Add relationship context"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(commercialStateQuery.data?.relationships || []).map(
                      (item: JsonRecord) => {
                        const party = (
                          commercialStateQuery.data?.stakeholders || []
                        ).find(
                          (candidate: JsonRecord) =>
                            candidate.id === item.stakeholderId,
                        );
                        return (
                          <div key={item.id} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StateBadge state={item.state} />
                              <Badge variant="outline">
                                {item.relationshipType.replaceAll("_", " ")}
                              </Badge>
                            </div>
                            <p className="mt-3 font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {party?.name || "Withheld party"}
                              {item.needConstraint
                                ? ` · ${item.needConstraint}`
                                : ""}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {nextRelationshipStates(item.state).map(
                                (state) => (
                                  <Button
                                    key={state}
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      relationshipTransitionMutation.isPending ||
                                      !effectiveAuthorityClasses.has(
                                        state === "closed"
                                          ? "decide"
                                          : "execute",
                                      )
                                    }
                                    onClick={() =>
                                      relationshipTransitionMutation.mutate({
                                        id: item.id,
                                        state,
                                      })
                                    }
                                  >
                                    {state}
                                  </Button>
                                ),
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                    {!commercialStateQuery.isLoading &&
                      !(commercialStateQuery.data?.relationships || [])
                        .length && (
                        <p className="text-sm text-muted-foreground">
                          No relationship contexts recorded yet.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="commercial-offers" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Offers & programs</CardTitle>
                  <CardDescription>
                    Control the problem, promise, delivery model, economics, and
                    lifecycle separately from a sales opportunity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="grid grid-cols-[9rem_1fr] gap-3">
                      <select
                        aria-label="Offer type"
                        value={offerType}
                        onChange={(event) => setOfferType(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="service">Service</option>
                        <option value="product">Product</option>
                        <option value="program">Program</option>
                        <option value="subscription">Subscription</option>
                        <option value="engagement">Engagement</option>
                        <option value="content_series">Content series</option>
                        <option value="internal_capability">
                          Internal capability
                        </option>
                      </select>
                      <Input
                        aria-label="Offer name"
                        value={offerName}
                        onChange={(event) => setOfferName(event.target.value)}
                        placeholder="Offer or program name"
                      />
                    </div>
                    <Textarea
                      aria-label="Problem or need"
                      value={offerProblem}
                      onChange={(event) => setOfferProblem(event.target.value)}
                      placeholder="Problem or need"
                    />
                    <Textarea
                      aria-label="Promise or outcome"
                      value={offerPromise}
                      onChange={(event) => setOfferPromise(event.target.value)}
                      placeholder="Bounded promise or outcome"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        offerName.trim().length < 2 ||
                        offerProblem.trim().length < 3 ||
                        offerPromise.trim().length < 3 ||
                        !effectiveAuthorityClasses.has("decide") ||
                        offerMutation.isPending
                      }
                      onClick={() => offerMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {offerMutation.isPending
                        ? "Recording…"
                        : "Record offer thesis"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(commercialStateQuery.data?.offers || []).map(
                      (item: JsonRecord) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StateBadge state={item.state} />
                            <Badge variant="outline">
                              {item.offerType.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-3 font-semibold">{item.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.problemNeed} → {item.promiseOutcome}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextOfferStates(item.state).map((state) => (
                              <Button
                                key={state}
                                size="sm"
                                variant="outline"
                                disabled={
                                  offerTransitionMutation.isPending ||
                                  !effectiveAuthorityClasses.has("decide")
                                }
                                onClick={() =>
                                  offerTransitionMutation.mutate({
                                    id: item.id,
                                    state,
                                  })
                                }
                              >
                                {state}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                    {!commercialStateQuery.isLoading &&
                      !(commercialStateQuery.data?.offers || []).length && (
                        <p className="text-sm text-muted-foreground">
                          No offers or programs recorded yet.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="commercial-cases" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Opportunity pipeline</CardTitle>
                  <CardDescription>
                    Qualify opportunities against a canonical party and, when
                    applicable, a governed offer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <Input
                      aria-label="Opportunity title"
                      value={caseTitle}
                      onChange={(event) => setCaseTitle(event.target.value)}
                      placeholder="Opportunity or engagement"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        aria-label="Opportunity party"
                        value={casePartyId}
                        onChange={(event) => setCasePartyId(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Choose party</option>
                        {(commercialStateQuery.data?.stakeholders || [])
                          .filter((item: JsonRecord) => item.state !== "closed")
                          .map((item: JsonRecord) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                      <select
                        aria-label="Opportunity offer"
                        value={caseOfferId}
                        onChange={(event) => setCaseOfferId(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">No linked offer yet</option>
                        {(commercialStateQuery.data?.offers || [])
                          .filter(
                            (item: JsonRecord) => item.state !== "retired",
                          )
                          .map((item: JsonRecord) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        aria-label="Opportunity value"
                        type="number"
                        min="0"
                        value={caseValue}
                        onChange={(event) => setCaseValue(event.target.value)}
                        placeholder="Estimated value"
                      />
                      <Input
                        aria-label="Opportunity probability"
                        type="number"
                        min="0"
                        max="100"
                        value={caseProbability}
                        onChange={(event) =>
                          setCaseProbability(event.target.value)
                        }
                        placeholder="Confidence %"
                      />
                    </div>
                    <Input
                      aria-label="Next commercial action"
                      value={caseNextAction}
                      onChange={(event) =>
                        setCaseNextAction(event.target.value)
                      }
                      placeholder="Next accountable action"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        caseTitle.trim().length < 3 ||
                        !casePartyId ||
                        !effectiveAuthorityClasses.has("execute") ||
                        commercialCaseMutation.isPending
                      }
                      onClick={() => commercialCaseMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {commercialCaseMutation.isPending
                        ? "Recording…"
                        : "Record opportunity"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(commercialStateQuery.data?.cases || []).map(
                      (item: JsonRecord) => {
                        const party = (
                          commercialStateQuery.data?.stakeholders || []
                        ).find((candidate: JsonRecord) =>
                          (item.stakeholderIds || []).includes(candidate.id),
                        );
                        const offer = (
                          commercialStateQuery.data?.offers || []
                        ).find(
                          (candidate: JsonRecord) =>
                            candidate.id === item.offerId,
                        );
                        return (
                          <div key={item.id} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StateBadge state={item.state} />
                              <Badge variant="outline">
                                {item.objectClass.replaceAll("_", " ")}
                              </Badge>
                            </div>
                            <p className="mt-3 font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {party?.name || "Withheld party"}
                              {offer ? ` · ${offer.name}` : ""} ·{" "}
                              {item.valueEstimate
                                ? `${item.currency} ${Number(item.valueEstimate).toLocaleString()}`
                                : "value not estimated"}
                              {item.probabilityConfidence
                                ? ` · ${Number(item.probabilityConfidence)}%`
                                : ""}
                            </p>
                            <p className="mt-2 text-sm">
                              {item.nextAction || "Next action not set"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {nextCommercialCaseStates(item.state).map(
                                (state) => {
                                  const needsDecision = [
                                    "committed",
                                    "won",
                                    "lost",
                                    "disqualified",
                                    "closed",
                                  ].includes(state);
                                  return (
                                    <Button
                                      key={state}
                                      size="sm"
                                      variant="outline"
                                      disabled={
                                        commercialCaseTransitionMutation.isPending ||
                                        !effectiveAuthorityClasses.has(
                                          needsDecision ? "decide" : "execute",
                                        )
                                      }
                                      onClick={() =>
                                        commercialCaseTransitionMutation.mutate(
                                          { id: item.id, state },
                                        )
                                      }
                                    >
                                      {state.replaceAll("_", " ")}
                                    </Button>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                    {!commercialStateQuery.isLoading &&
                      !(commercialStateQuery.data?.cases || []).length && (
                        <p className="text-sm text-muted-foreground">
                          No opportunities, engagements, or cases recorded yet.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card id="commercial-flows" className="scroll-mt-40">
              <CardHeader>
                <CardTitle>Commitments & value flow</CardTitle>
                <CardDescription>
                  Record proposals, commitments, referrals, allocations, and
                  outcomes here. Invoice, payment, refund, cost, and revenue
                  facts require an authoritative provider adapter and external
                  receipt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2">
                  <Input
                    aria-label="Value flow title"
                    value={flowTitle}
                    onChange={(event) => setFlowTitle(event.target.value)}
                    placeholder="Commitment or value-flow title"
                  />
                  <select
                    aria-label="Value flow type"
                    value={flowType}
                    onChange={(event) => setFlowType(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="commitment">Commitment</option>
                    <option value="proposal">Proposal</option>
                    <option value="referral">Referral</option>
                    <option value="lead_attribution">Lead attribution</option>
                    <option value="outcome">Outcome</option>
                    <option value="resource_allocation">
                      Resource allocation
                    </option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    aria-label="Value from party"
                    value={flowFromPartyId}
                    onChange={(event) => setFlowFromPartyId(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">From organization / unrecorded</option>
                    {(commercialStateQuery.data?.stakeholders || []).map(
                      (item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Value to party"
                    value={flowToPartyId}
                    onChange={(event) => setFlowToPartyId(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">To organization / unrecorded</option>
                    {(commercialStateQuery.data?.stakeholders || []).map(
                      (item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Value flow offer"
                    value={flowOfferId}
                    onChange={(event) => setFlowOfferId(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No linked offer</option>
                    {(commercialStateQuery.data?.offers || []).map(
                      (item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Value flow case"
                    value={flowCaseId}
                    onChange={(event) => setFlowCaseId(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No linked case</option>
                    {(commercialStateQuery.data?.cases || []).map(
                      (item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ),
                    )}
                  </select>
                  <Input
                    aria-label="Value flow amount"
                    type="number"
                    min="0"
                    value={flowAmount}
                    onChange={(event) => setFlowAmount(event.target.value)}
                    placeholder="Amount, if economic"
                  />
                  <Input
                    aria-label="Agreement reference"
                    value={flowAgreementReference}
                    onChange={(event) =>
                      setFlowAgreementReference(event.target.value)
                    }
                    placeholder="Signed agreement or evidence reference"
                  />
                  <Button
                    className="lg:col-span-2"
                    disabled={
                      flowTitle.trim().length < 3 ||
                      (!flowFromPartyId && !flowToPartyId) ||
                      !effectiveAuthorityClasses.has(
                        ["commitment", "proposal"].includes(flowType)
                          ? "decide"
                          : "execute",
                      ) ||
                      valueFlowMutation.isPending
                    }
                    onClick={() => valueFlowMutation.mutate()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {valueFlowMutation.isPending
                      ? "Recording…"
                      : "Record governed value flow"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {(commercialStateQuery.data?.valueFlows || []).map(
                    (item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge state={item.state} />
                          <Badge variant="outline">
                            {item.flowType.replaceAll("_", " ")}
                          </Badge>
                          <Badge
                            variant={
                              item.sourceAuthority === "native_eos"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {item.sourceAuthority.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.amount
                            ? `${item.currency} ${Number(item.amount).toLocaleString()}`
                            : "Non-monetary or unpriced"}
                          {item.agreementReference
                            ? ` · ${item.agreementReference}`
                            : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nextValueFlowStates(item.state).map((state) => {
                            const needsDecision = [
                              "committed",
                              "invoiced",
                              "paid_settled",
                              "partially_settled",
                              "cancelled",
                              "reconciled",
                            ].includes(state);
                            return (
                              <Button
                                key={state}
                                size="sm"
                                variant="outline"
                                disabled={
                                  valueFlowTransitionMutation.isPending ||
                                  !effectiveAuthorityClasses.has(
                                    needsDecision ? "decide" : "execute",
                                  )
                                }
                                onClick={() =>
                                  valueFlowTransitionMutation.mutate({
                                    id: item.id,
                                    state,
                                  })
                                }
                              >
                                {state.replaceAll("_", " ")}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  )}
                  {!commercialStateQuery.isLoading &&
                    !(commercialStateQuery.data?.valueFlows || []).length && (
                      <p className="text-sm text-muted-foreground">
                        No commitments or value-flow records exist yet.
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Authority boundary</AlertTitle>
              <AlertDescription>
                EOS owns native relationship and commercial control state.
                External CRM, agreement, invoice, and payment records remain
                provider-authoritative until a field-level adapter and cutover
                are explicitly qualified.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="operations" className="space-y-8">
            <Suspense fallback={<DeferredControlFallback />}>
              <NativeOperatingControlCenter
                root={root}
                processes={operationsStateQuery.data?.processes || []}
                seats={organizationQuery.data?.seats || []}
                authoritySubjects={organizationQuery.data?.authoritySubjects || []}
                canExecute={effectiveAuthorityClasses.has("execute")}
                canDecide={effectiveAuthorityClasses.has("decide")}
                isFounder={isFounder}
                onAsk={sendEaMessage}
              />
            </Suspense>
            <Suspense fallback={<DeferredControlFallback />}>
              <EndStateGovernanceControlCenter
                root={root}
                canExecute={effectiveAuthorityClasses.has("execute")}
                canDecide={effectiveAuthorityClasses.has("decide")}
                isFounder={isFounder}
              />
            </Suspense>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Active capabilities"
                value={
                  operationsStateQuery.data?.counts?.activeCapabilities || 0
                }
                icon={Blocks}
                actionLabel="Map capability"
                onClick={() =>
                  document
                    .getElementById("operations-capabilities")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Released processes"
                value={
                  operationsStateQuery.data?.counts?.releasedProcesses || 0
                }
                icon={Workflow}
                actionLabel="Open processes"
                onClick={() =>
                  document
                    .getElementById("operations-processes")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Field qualified"
                value={
                  operationsStateQuery.data?.counts?.fieldQualifiedProcesses ||
                  0
                }
                icon={BadgeCheck}
                actionLabel="Review qualification"
                onClick={() =>
                  document
                    .getElementById("operations-processes")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <Metric
                label="Active resources"
                value={operationsStateQuery.data?.counts?.activeResources || 0}
                icon={Plug}
                actionLabel="Open resources"
                onClick={() =>
                  document
                    .getElementById("operations-resources")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Operations instrument</CardTitle>
                <CardDescription>
                  Define the capability, executable process, resources, governed
                  work, and evidence as one traceable operating loop.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    sendEaMessage(
                      `Inspect ${company.name}'s capability, process, resource, Work Packet, and evidence graph. Identify the next blocked transition and the proof needed to advance it.`,
                    )
                  }
                >
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Ask {assistantName} for an operating diagnosis
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    document
                      .getElementById("operations-capabilities")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Build an operating loop
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card id="operations-capabilities" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Capabilities</CardTitle>
                  <CardDescription>
                    An organization-specific ability with an accountable seat,
                    activation trigger, lifecycle, and maturity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <Input
                      aria-label="Capability name"
                      value={capabilityName}
                      onChange={(event) =>
                        setCapabilityName(event.target.value)
                      }
                      placeholder="Capability name"
                    />
                    <Input
                      aria-label="Capability catalog key"
                      value={capabilityKey}
                      onChange={(event) => setCapabilityKey(event.target.value)}
                      placeholder="Stable catalog key"
                    />
                    <Textarea
                      aria-label="Capability activation trigger"
                      value={capabilityTrigger}
                      onChange={(event) =>
                        setCapabilityTrigger(event.target.value)
                      }
                      placeholder="What must be true before activation?"
                    />
                    <select
                      aria-label="Capability primary module"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={capabilityModuleId}
                      onChange={(event) => setCapabilityModuleId(event.target.value)}
                    >
                      <option value="">Choose its primary EOS module</option>
                      {eosActiveModules.map((module) => (
                        <option key={module.id} value={module.id}>Module {module.id} · {module.name}</option>
                      ))}
                    </select>
                    <Button
                      className="w-full"
                      disabled={
                        capabilityName.trim().length < 2 ||
                        capabilityKey.trim().length < 2 ||
                        !capabilityModuleId ||
                        capabilityMutation.isPending ||
                        !effectiveAuthorityClasses.has("execute")
                      }
                      onClick={() => capabilityMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {capabilityMutation.isPending
                        ? "Mapping…"
                        : "Map capability"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(operationsStateQuery.data?.capabilities || []).map(
                      (item: JsonRecord) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StateBadge state={item.state} />
                            <Badge variant="outline">
                              {item.maturity.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-3 font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.capabilityKey}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(item.moduleIds || []).map((moduleId: number) => (
                              <Button
                                key={moduleId}
                                size="sm"
                                variant="secondary"
                                aria-label={`Remove module ${moduleId} from ${item.name}`}
                                disabled={capabilityModuleMutation.isPending || !effectiveAuthorityClasses.has("execute")}
                                onClick={() => capabilityModuleMutation.mutate({ id: item.id, moduleIds: item.moduleIds.filter((value: number) => value !== moduleId) })}
                              >
                                Module {moduleId} <X className="ml-1 h-3 w-3" />
                              </Button>
                            ))}
                            <select
                              aria-label={`Add module assignment for ${item.name}`}
                              className="h-8 min-w-44 rounded-md border border-input bg-background px-2 text-xs"
                              value=""
                              disabled={capabilityModuleMutation.isPending || !effectiveAuthorityClasses.has("execute")}
                              onChange={(event) => {
                                const moduleId = Number(event.target.value);
                                if (moduleId) capabilityModuleMutation.mutate({ id: item.id, moduleIds: Array.from(new Set<number>([...(item.moduleIds || []), moduleId])).sort((a, b) => a - b) });
                              }}
                            >
                              <option value="">Add module…</option>
                              {eosActiveModules.filter((module) => !(item.moduleIds || []).includes(module.id)).map((module) => (
                                <option key={module.id} value={module.id}>Module {module.id} · {module.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextCapabilityStates(item.state).map((state) => (
                              <Button
                                key={state}
                                size="sm"
                                variant="outline"
                                disabled={
                                  capabilityTransitionMutation.isPending ||
                                  !effectiveAuthorityClasses.has(
                                    ["active", "deprecated"].includes(state)
                                      ? "decide"
                                      : "execute",
                                  )
                                }
                                onClick={() =>
                                  capabilityTransitionMutation.mutate({
                                    id: item.id,
                                    state,
                                  })
                                }
                              >
                                {state.replaceAll("_", " ")}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                    {!operationsStateQuery.isLoading &&
                      !(operationsStateQuery.data?.capabilities || [])
                        .length && (
                        <p className="text-sm text-muted-foreground">
                          No organization capabilities mapped yet.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="operations-processes" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Processes & SOPs</CardTitle>
                  <CardDescription>
                    A versioned executable contract served inside work—not
                    narrative instructions in another system.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <select
                      aria-label="Process capability"
                      value={processCapabilityId}
                      onChange={(event) =>
                        setProcessCapabilityId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose a capability</option>
                      {(operationsStateQuery.data?.capabilities || [])
                        .filter(
                          (item: JsonRecord) => item.state !== "deprecated",
                        )
                        .map((item: JsonRecord) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    <Input
                      aria-label="Process name"
                      value={processName}
                      onChange={(event) => setProcessName(event.target.value)}
                      placeholder="Process / SOP name"
                    />
                    <Textarea
                      aria-label="Process purpose"
                      value={processPurpose}
                      onChange={(event) =>
                        setProcessPurpose(event.target.value)
                      }
                      placeholder="Purpose"
                    />
                    <Textarea
                      aria-label="Process intended outcome"
                      value={processOutcome}
                      onChange={(event) =>
                        setProcessOutcome(event.target.value)
                      }
                      placeholder="Intended outcome and completion criterion"
                    />
                    <Input
                      aria-label="Process trigger"
                      value={processTrigger}
                      onChange={(event) =>
                        setProcessTrigger(event.target.value)
                      }
                      placeholder="Trigger event or condition"
                    />
                    <Textarea
                      aria-label="First procedure step"
                      value={processStep}
                      onChange={(event) => setProcessStep(event.target.value)}
                      placeholder="First executable step"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        !processCapabilityId ||
                        processName.trim().length < 2 ||
                        processPurpose.trim().length < 3 ||
                        processOutcome.trim().length < 3 ||
                        processTrigger.trim().length < 3 ||
                        processStep.trim().length < 1 ||
                        processMutation.isPending ||
                        !effectiveAuthorityClasses.has("execute")
                      }
                      onClick={() => processMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {processMutation.isPending
                        ? "Mapping…"
                        : "Map executable process"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(operationsStateQuery.data?.processes || []).map(
                      (item: JsonRecord) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StateBadge state={item.qualificationState} />
                            <Badge variant="outline">v{item.version}</Badge>
                            <Badge variant="secondary">
                              {item.releaseState}
                            </Badge>
                          </div>
                          <p className="mt-3 font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(item.procedureSteps || []).length} executable step
                            {(item.procedureSteps || []).length === 1
                              ? ""
                              : "s"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextProcessQualificationStates(
                              item.qualificationState,
                            ).map((qualificationState) => (
                              <Button
                                key={qualificationState}
                                size="sm"
                                variant="outline"
                                disabled={
                                  processTransitionMutation.isPending ||
                                  !effectiveAuthorityClasses.has("decide")
                                }
                                onClick={() =>
                                  processTransitionMutation.mutate({
                                    id: item.id,
                                    qualificationState,
                                  })
                                }
                              >
                                {qualificationState.replaceAll("_", " ")}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                    {!operationsStateQuery.isLoading &&
                      !(operationsStateQuery.data?.processes || []).length && (
                        <p className="text-sm text-muted-foreground">
                          Map a capability before defining its executable
                          process.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card id="operations-resources" className="scroll-mt-40">
                <CardHeader>
                  <CardTitle>Resources & assets</CardTitle>
                  <CardDescription>
                    Register custody, rights, source authority, classification,
                    and replacement path before allocating an asset to work.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <Input
                      aria-label="Resource name"
                      value={resourceName}
                      onChange={(event) => setResourceName(event.target.value)}
                      placeholder="Resource or asset name"
                    />
                    <select
                      aria-label="Resource type"
                      value={resourceType}
                      onChange={(event) => setResourceType(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="system_tool">System / tool</option>
                      <option value="document">Document</option>
                      <option value="dataset">Dataset</option>
                      <option value="template">Template</option>
                      <option value="intellectual_property">
                        Intellectual property
                      </option>
                      <option value="credential_reference">
                        Credential reference
                      </option>
                      <option value="other">Other</option>
                    </select>
                    <Textarea
                      aria-label="Resource rights and usage"
                      value={resourceRights}
                      onChange={(event) =>
                        setResourceRights(event.target.value)
                      }
                      placeholder="Rights, usage, license, and restrictions"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        resourceName.trim().length < 2 ||
                        resourceMutation.isPending ||
                        !effectiveAuthorityClasses.has("execute")
                      }
                      onClick={() => resourceMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {resourceMutation.isPending
                        ? "Registering…"
                        : "Register resource"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(operationsStateQuery.data?.resources || []).map(
                      (item: JsonRecord) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StateBadge state={item.lifecycleState} />
                            <Badge variant="outline">
                              {item.assetType.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-3 font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.dataClassification.replaceAll("_", " ")} ·{" "}
                            {item.sourceAuthority.replaceAll("_", " ")}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextResourceStates(item.lifecycleState).map(
                              (lifecycleState) => (
                                <Button
                                  key={lifecycleState}
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    resourceTransitionMutation.isPending ||
                                    !effectiveAuthorityClasses.has(
                                      [
                                        "active",
                                        "restricted",
                                        "archived",
                                      ].includes(lifecycleState)
                                        ? "decide"
                                        : "execute",
                                    )
                                  }
                                  onClick={() =>
                                    resourceTransitionMutation.mutate({
                                      id: item.id,
                                      lifecycleState,
                                    })
                                  }
                                >
                                  {lifecycleState.replaceAll("_", " ")}
                                </Button>
                              ),
                            )}
                          </div>
                        </div>
                      ),
                    )}
                    {!operationsStateQuery.isLoading &&
                      !(operationsStateQuery.data?.resources || []).length && (
                        <p className="text-sm text-muted-foreground">
                          No governed resources registered yet.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
            {(operationsStateQuery.data?.processes || []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Process release control</CardTitle>
                  <CardDescription>
                    Qualification proves the artifact and execution; release
                    state separately controls whether a process version is
                    approved for operating use.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(operationsStateQuery.data?.processes || []).map(
                    (item: JsonRecord) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-semibold">
                            {item.name} · v{item.version}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <StateBadge state={item.qualificationState} />
                            <StateBadge state={item.releaseState} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {nextProcessReleaseStates(item.releaseState).map(
                            (releaseState) => (
                              <Button
                                key={releaseState}
                                size="sm"
                                variant="outline"
                                disabled={
                                  processReleaseMutation.isPending ||
                                  !effectiveAuthorityClasses.has("decide")
                                }
                                onClick={() =>
                                  processReleaseMutation.mutate({
                                    id: item.id,
                                    releaseState,
                                  })
                                }
                              >
                                {releaseState === "review"
                                  ? "Submit release review"
                                  : releaseState.replaceAll("_", " ")}
                              </Button>
                            ),
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Create Work Packet</CardTitle>
                <CardDescription>
                  Instantiate a governed execution from the selected capability
                  and process, with explicit resources, output, acceptance,
                  approval, and evidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    aria-label="Work Packet capability"
                    value={packetCapabilityId}
                    onChange={(event) => {
                      setPacketCapabilityId(event.target.value);
                      const process = (
                        operationsStateQuery.data?.processes || []
                      ).find((item: JsonRecord) => item.id === packetProcessId);
                      if (
                        process &&
                        process.capabilityInstanceId !== event.target.value
                      )
                        setPacketProcessId("");
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No capability selected</option>
                    {(operationsStateQuery.data?.capabilities || [])
                      .filter((item: JsonRecord) => item.state !== "deprecated")
                      .map((item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                  <select
                    aria-label="Work Packet process"
                    value={packetProcessId}
                    onChange={(event) => {
                      const process = (
                        operationsStateQuery.data?.processes || []
                      ).find(
                        (item: JsonRecord) => item.id === event.target.value,
                      );
                      setPacketProcessId(event.target.value);
                      if (process) {
                        setPacketCapabilityId(process.capabilityInstanceId);
                        setPacketEvidenceRequirements(
                          Array.isArray(process.evidenceRequirements) &&
                            process.evidenceRequirements.length
                            ? process.evidenceRequirements
                            : ["A reviewable artifact or observed outcome"],
                        );
                        setPacketExpectedOutput(
                          Array.isArray(process.requiredOutputs)
                            ? process.requiredOutputs.join("; ")
                            : "",
                        );
                      }
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No executable process selected</option>
                    {(operationsStateQuery.data?.processes || [])
                      .filter(
                        (item: JsonRecord) =>
                          !packetCapabilityId ||
                          item.capabilityInstanceId === packetCapabilityId,
                      )
                      .map((item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · v{item.version}
                        </option>
                      ))}
                  </select>
                </div>
                <Input
                  value={packetTitle}
                  onChange={(event) => setPacketTitle(event.target.value)}
                  placeholder="Mission title"
                />
                <Textarea
                  value={packetObjective}
                  onChange={(event) => setPacketObjective(event.target.value)}
                  placeholder="Objective and intended outcome"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Textarea
                    aria-label="Expected Work Packet output"
                    value={packetExpectedOutput}
                    onChange={(event) =>
                      setPacketExpectedOutput(event.target.value)
                    }
                    placeholder="Expected output or effect"
                  />
                  <Textarea
                    aria-label="Work Packet acceptance criteria"
                    value={packetAcceptanceCriteria}
                    onChange={(event) =>
                      setPacketAcceptanceCriteria(event.target.value)
                    }
                    placeholder="Acceptance criteria"
                  />
                </div>
                {(operationsStateQuery.data?.resources || []).length > 0 && (
                  <div className="rounded-xl border p-4">
                    <p className="eos-label">Allocated resources</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {(operationsStateQuery.data?.resources || [])
                        .filter(
                          (item: JsonRecord) =>
                            !["deprecated", "archived"].includes(
                              item.lifecycleState,
                            ),
                        )
                        .map((item: JsonRecord) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={packetResourceIds.includes(item.id)}
                              onChange={(event) =>
                                setPacketResourceIds((current) =>
                                  event.target.checked
                                    ? Array.from(new Set([...current, item.id]))
                                    : current.filter((id) => id !== item.id),
                                )
                              }
                            />
                            {item.name}
                          </label>
                        ))}
                    </div>
                  </div>
                )}
                <div className="rounded-xl bg-muted p-3">
                  <p className="eos-label">Required proof</p>
                  <p className="mt-1 text-sm">
                    {packetEvidenceRequirements.join(" · ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={packetApproval}
                    onChange={(event) =>
                      setPacketApproval(event.target.checked)
                    }
                  />{" "}
                  Require local approval before work begins
                </label>
                <Button
                  className="w-fit"
                  disabled={
                    packetTitle.trim().length < 3 ||
                    packetObjective.trim().length < 3 ||
                    packetMutation.isPending
                  }
                  onClick={() => packetMutation.mutate()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {packetMutation.isPending
                    ? "Creating…"
                    : "Create Work Packet"}
                </Button>
              </CardContent>
            </Card>
            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eos-label">Work queue</p>
                  <h2 className="mt-1 text-xl font-semibold">Work Packets</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Active work stays in view. Closed work remains available
                    when you need its history.
                  </p>
                </div>
                {closedPackets.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowClosedWork((current) => !current)}
                  >
                    {showClosedWork
                      ? "Hide closed work"
                      : `Show closed work (${closedPackets.length})`}
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {operationsPackets.map((packet) => {
                  const next = nextTransition(packet.status);
                  const packetEvidence = evidence.filter(
                    (item) => item.workPacketId === packet.id,
                  );
                  const requirements =
                    Array.isArray(packet.evidenceRequirements) &&
                    packet.evidenceRequirements.length
                      ? packet.evidenceRequirements.map(String)
                      : ["A reviewable artifact or observed outcome"];
                  const recordedTitles = new Set(
                    packetEvidence.map((item) =>
                      String(item.title).trim().toLowerCase(),
                    ),
                  );
                  const missingRequirements = requirements.filter(
                    (requirement) =>
                      !recordedTitles.has(requirement.trim().toLowerCase()),
                  );
                  const nextRequirement = missingRequirements[0];
                  return (
                    <Card key={packet.id}>
                      <CardContent className="pt-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{packet.title}</h3>
                              <StateBadge state={packet.status} />
                              <Badge variant="outline">{packet.priority}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {packet.objective}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Required evidence{" "}
                              {requirements.length - missingRequirements.length}
                              /{requirements.length} · Trace{" "}
                              {packet.traceId?.slice(0, 8)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {next && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  transitionMutation.isPending ||
                                  (next === "completed" &&
                                    missingRequirements.length > 0)
                                }
                                onClick={() =>
                                  transitionMutation.mutate({
                                    id: packet.id,
                                    status: next,
                                  })
                                }
                              >
                                {next === "in_progress"
                                  ? "Start / resume"
                                  : next === "in_review"
                                    ? "Submit for review"
                                    : "Complete"}
                              </Button>
                            )}
                          </div>
                        </div>
                        {!["completed", "cancelled"].includes(packet.status) &&
                          nextRequirement && (
                            <div className="mt-5 rounded-xl bg-muted/60 p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Required next
                              </p>
                              <p className="mt-1 text-sm font-medium">
                                {nextRequirement}
                              </p>
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <Input
                                  aria-label={`Evidence details for ${packet.title}`}
                                  value={evidenceDetails[packet.id] || ""}
                                  onChange={(event) =>
                                    setEvidenceDetails((current) => ({
                                      ...current,
                                      [packet.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Add a proof note or HTTPS link"
                                />
                                <Button
                                  variant="secondary"
                                  disabled={
                                    !evidenceDetails[packet.id]?.trim() ||
                                    evidenceMutation.isPending
                                  }
                                  onClick={() =>
                                    evidenceMutation.mutate({
                                      packetId: packet.id,
                                      requirement: nextRequirement,
                                      details: evidenceDetails[packet.id],
                                    })
                                  }
                                >
                                  {evidenceMutation.isPending
                                    ? "Recording…"
                                    : "Record required evidence"}
                                </Button>
                              </div>
                            </div>
                          )}
                        {!["completed", "cancelled"].includes(packet.status) &&
                          !nextRequirement && (
                            <div className="mt-5 flex items-center gap-2 rounded-xl bg-primary/10 p-4 text-sm font-medium text-primary">
                              <BadgeCheck className="h-4 w-4" />
                              All required evidence is recorded. This Work
                              Packet can complete after review.
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  );
                })}
                {!operationsPackets.length && (
                  <EmptyState
                    icon={Workflow}
                    title={
                      packets.length
                        ? "No active Work Packets"
                        : "No Work Packets"
                    }
                    description={
                      packets.length
                        ? "Closed work is preserved in history. Create a mission when new work is ready."
                        : "Create the first evidence-bearing mission above."
                    }
                  />
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eos-label">Authority queue</p>
                  <h2 className="mt-1 text-xl font-semibold">Approvals</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pending decisions stay prominent; resolved decisions remain
                    available for review.
                  </p>
                </div>
                {approvals.length > pendingApprovals.length && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setShowDecisionHistory((current) => !current)
                    }
                  >
                    {showDecisionHistory
                      ? "Hide decision history"
                      : `Show decision history (${approvals.length - pendingApprovals.length})`}
                  </Button>
                )}
              </div>
              {visibleApprovals.map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="flex flex-col gap-4 pt-8 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{approval.summary}</h3>
                        <StateBadge state={approval.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested{" "}
                        {new Date(approval.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {approval.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled={approvalMutation.isPending}
                          onClick={() =>
                            requestApprovalDecision(approval, "rejected")
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          disabled={approvalMutation.isPending}
                          onClick={() =>
                            requestApprovalDecision(approval, "approved")
                          }
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {!visibleApprovals.length && (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No pending approvals"
                  description={
                    approvals.length
                      ? "Resolved decisions are preserved in decision history."
                      : "Approval-gated missions will appear here."
                  }
                />
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eos-label">Proof and provenance</p>
                  <h2 className="mt-1 text-xl font-semibold">Evidence</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The ten most recent records are shown first.
                  </p>
                </div>
                {evidence.length > 10 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowAllEvidence((current) => !current)}
                  >
                    {showAllEvidence
                      ? "Show recent evidence"
                      : `Show all evidence (${evidence.length})`}
                  </Button>
                )}
              </div>
              {visibleEvidence.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex items-start gap-3 pt-8">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.evidenceType.replaceAll("_", " ")} ·{" "}
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!evidence.length && (
                <EmptyState
                  icon={FileCheck2}
                  title="No evidence recorded"
                  description="Work cannot be marked complete until evidence exists."
                />
              )}
            </section>
          </TabsContent>

          <TabsContent value="work-room" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Work Room</CardTitle>
                <CardDescription>
                  Work, provider actions, artifacts, evidence, and blockers stay
                  attached to the governed Work Packet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activePackets.map((packet) => (
                  <button
                    key={packet.id}
                    type="button"
                    onClick={() => setProviderPacketId(packet.id)}
                    className={`w-full rounded-xl p-4 text-left ${providerPacketId === packet.id ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{packet.title}</span>
                      <StateBadge state={packet.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {packet.objective}
                    </p>
                  </button>
                ))}
                {!activePackets.length && (
                  <p className="text-sm text-muted-foreground">
                    No active Work Packet is available to this seat.
                  </p>
                )}
              </CardContent>
            </Card>
            {selectedWorkPacket && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eos-label">Selected work</p>
                      <CardTitle className="mt-2">
                        {selectedWorkPacket.title}
                      </CardTitle>
                      <CardDescription>
                        {selectedWorkPacket.objective}
                      </CardDescription>
                    </div>
                    <StateBadge state={selectedWorkPacket.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Fact
                      label="Required proof"
                      value={`${selectedWorkRequirements.length - selectedWorkMissingRequirements.length}/${selectedWorkRequirements.length} recorded`}
                    />
                    <Fact
                      label="Priority"
                      value={selectedWorkPacket.priority}
                    />
                    <Fact
                      label="Authority"
                      value={
                        selectedWorkPacket.requiresApproval
                          ? "Supervisor approval required"
                          : "Delegated to this seat"
                      }
                    />
                  </div>
                  {selectedWorkNextRequirement ? (
                    <div className="rounded-xl bg-muted/60 p-4">
                      <p className="eos-label">Required next</p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedWorkNextRequirement}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          aria-label={`Work Room evidence for ${selectedWorkPacket.title}`}
                          value={evidenceDetails[selectedWorkPacket.id] || ""}
                          onChange={(event) =>
                            setEvidenceDetails((current) => ({
                              ...current,
                              [selectedWorkPacket.id]: event.target.value,
                            }))
                          }
                          placeholder="Add a proof note or HTTPS link"
                        />
                        <Button
                          variant="secondary"
                          disabled={
                            !evidenceDetails[selectedWorkPacket.id]?.trim() ||
                            evidenceMutation.isPending
                          }
                          onClick={() =>
                            evidenceMutation.mutate({
                              packetId: selectedWorkPacket.id,
                              requirement: selectedWorkNextRequirement,
                              details: evidenceDetails[selectedWorkPacket.id],
                            })
                          }
                        >
                          {evidenceMutation.isPending
                            ? "Recording…"
                            : "Record required evidence"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-4 text-sm font-medium text-primary">
                      <BadgeCheck className="h-4 w-4" />
                      All required evidence is recorded. Submit or complete the
                      work when ready.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {nextTransition(selectedWorkPacket.status) && (
                      <Button
                        disabled={
                          transitionMutation.isPending ||
                          (nextTransition(selectedWorkPacket.status) ===
                            "completed" &&
                            selectedWorkMissingRequirements.length > 0)
                        }
                        onClick={() =>
                          transitionMutation.mutate({
                            id: selectedWorkPacket.id,
                            status: nextTransition(selectedWorkPacket.status)!,
                          })
                        }
                      >
                        {nextTransition(selectedWorkPacket.status) ===
                        "in_progress"
                          ? "Start / resume work"
                          : nextTransition(selectedWorkPacket.status) ===
                              "in_review"
                            ? "Submit work for review"
                            : "Complete work"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        sendEaMessage(
                          `Help me advance the ${selectedWorkPacket.title} Work Packet. Identify the next action and evidence inside my authority and reporting path.`,
                        )
                      }
                    >
                      <MessagesSquare className="mr-2 h-4 w-4" />
                      Ask {assistantName} about this work
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {selectedWorkPacket && (
              <Card>
                <CardHeader>
                  <CardTitle>Approved Gmail delivery</CardTitle>
                  <CardDescription>
                    Create a provider effect attached to{" "}
                    {selectedWorkPacket.title}. Delivery occurs only after the
                    assigned supervisor or owner approves it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Input
                    value={emailTo}
                    onChange={(event) => setEmailTo(event.target.value)}
                    type="email"
                    placeholder="Recipient email"
                    disabled={!googleConnected}
                  />
                  <Input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    placeholder="Subject"
                    disabled={!googleConnected}
                  />
                  <Textarea
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                    placeholder="Approved message body"
                    disabled={!googleConnected}
                  />
                  <Button
                    className="w-fit"
                    disabled={
                      !emailTo ||
                      !emailSubject ||
                      !emailBody ||
                      providerExecutionMutation.isPending ||
                      !googleConnected
                    }
                    onClick={() => providerExecutionMutation.mutate()}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Request Gmail execution
                  </Button>
                  {!googleConnected && (
                    <div className="flex flex-col items-start gap-3 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Google Workspace is not connected for this user. Local
                        work and evidence remain available.
                      </p>
                      {allowedSurfaces.has("systems") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => goToSurface("systems")}
                        >
                          <Plug className="mr-2 h-4 w-4" />
                          Open Systems
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            sendEaMessage(
                              "Ask my supervisor or system owner to connect Google Workspace, and give me a local handoff I can use meanwhile.",
                            )
                          }
                        >
                          <MessagesSquare className="mr-2 h-4 w-4" />
                          Request a supervisor handoff
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {googleContextQuery.data && (
              <div className="grid gap-4 lg:grid-cols-2">
                <ListCard
                  title="Upcoming Calendar context"
                  empty="No upcoming events returned."
                  items={(googleContextQuery.data.calendar || []).map(
                    (item: JsonRecord) => ({
                      ...item,
                      title: item.summary,
                      objective: item.start || "Date unavailable",
                      status: "provider",
                    }),
                  )}
                />
                <ListCard
                  title="Recent Drive context"
                  empty="No recent files returned."
                  items={(googleContextQuery.data.drive || []).map(
                    (item: JsonRecord) => ({
                      ...item,
                      title: item.name,
                      objective: item.modifiedTime || "Timestamp unavailable",
                      status: "provider",
                    }),
                  )}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <section className="space-y-3">
              <div>
                <p className="eos-label">Assigned authority queue</p>
                <h2 className="mt-1 text-xl font-semibold">
                  Decisions requiring this seat
                </h2>
              </div>
              {pendingApprovals.map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="flex flex-col gap-4 pt-8 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold">{approval.summary}</h3>
                      <StateBadge state={approval.status} />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={approvalMutation.isPending}
                        onClick={() =>
                          requestApprovalDecision(approval, "rejected")
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        disabled={approvalMutation.isPending}
                        onClick={() =>
                          requestApprovalDecision(approval, "approved")
                        }
                      >
                        Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!pendingApprovals.length && (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No assigned decisions"
                  description="Only pending approvals assigned to this principal appear here. Resolved decisions remain in the control receipts below."
                />
              )}
            </section>
            <Card>
              <CardHeader>
                <CardTitle>Provider reconciliation</CardTitle>
                <CardDescription>
                  External effects remain explicit through request, approval,
                  receipt, and reconciliation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(providerExecutionsQuery.data || []).map((execution) => (
                  <div key={execution.id} className="rounded-xl bg-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{execution.operation}</span>
                      <StateBadge state={execution.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {execution.reconciliationStatus.replaceAll("_", " ")} ·
                      trace {execution.traceId.slice(0, 8)}
                    </p>
                  </div>
                ))}
                {!providerExecutionsQuery.data?.length && (
                  <p className="text-sm text-muted-foreground">
                    No provider executions in this visibility scope.
                  </p>
                )}
              </CardContent>
            </Card>
            {auditVisible && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent control receipts</CardTitle>
                  <CardDescription>
                    Persisted audit evidence for actions within this seat's
                    visibility.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(auditQuery.data || []).slice(0, 12).map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-2 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {String(record.action).replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {record.targetType} ·{" "}
                          {new Date(record.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StateBadge state={record.result || "recorded"} />
                        <code className="text-[10px] text-muted-foreground">
                          {String(record.traceId || "").slice(0, 8)}
                        </code>
                      </div>
                    </div>
                  ))}
                  {auditQuery.isLoading && (
                    <p className="text-sm text-muted-foreground">
                      Loading signed control history…
                    </p>
                  )}
                  {!auditQuery.isLoading && !auditQuery.data?.length && (
                    <p className="text-sm text-muted-foreground">
                      No audit receipts are visible yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="academy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seat Academy</CardTitle>
                <CardDescription>
                  Practice inside real work, then prove advancement with
                  reviewed evidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Fact
                  label="Current learning objective"
                  value={`Operate the ${principalContext?.seat || "active seat"} within its authority ceiling`}
                />
                <Fact
                  label="Practical exercise"
                  value={
                    activePackets[0]?.title ||
                    (practiceAction === "prepare_work"
                      ? "Create the first evidence-bearing Work Packet"
                      : "Request a supervisor-approved practice assignment")
                  }
                />
                <Fact
                  label="Advancement proof"
                  value="Reviewed output, named evidence, and supervisor acceptance"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={startRolePractice}
                    disabled={requestScopedWorkMutation.isPending}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    {practiceAction === "prepare_work"
                      ? "Start practical exercise"
                      : practiceAction === "open_assigned_work"
                        ? "Open practical work"
                        : requestScopedWorkMutation.isPending
                          ? "Requesting…"
                          : "Request practice assignment"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      sendEaMessage(
                        `Coach me on the next practical skill for the ${principalContext?.seat || "active role"}. Ground it in current work and define the evidence required.`,
                      )
                    }
                  >
                    <MessagesSquare className="mr-2 h-4 w-4" />
                    Ask role coach
                  </Button>
                </div>
              </CardContent>
            </Card>
            {notionContextQuery.data && (
              <ListCard
                title="Canonical Notion references"
                empty="No shared Notion pages were returned."
                actionLabel="Open in Notion"
                onSelect={(item) =>
                  item.url &&
                  window.open(item.url, "_blank", "noopener,noreferrer")
                }
                items={(notionContextQuery.data.results || []).map(
                  (item: JsonRecord) => ({
                    ...item,
                    title: item.title,
                    objective: item.lastEditedTime
                      ? `Updated ${new Date(item.lastEditedTime).toLocaleString()}`
                      : "Reference",
                    status: "reference",
                  }),
                )}
              />
            )}
          </TabsContent>

          <TabsContent value="portfolio-map" className="space-y-6">
            <Card>
              <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>
                    {contextQuery.data?.portfolio?.name ||
                      "Independent portfolio"}
                  </CardTitle>
                  <CardDescription>
                    Select a visible seat to inspect accountability and take the
                    next authorized action.
                  </CardDescription>
                </div>
                {allowedSurfaces.has("organization") && (
                  <Button
                    variant="outline"
                    onClick={() => goToSurface("organization")}
                  >
                    <Network className="mr-2 h-4 w-4" />
                    Open organization
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl bg-primary/10 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eos-label">Organization</p>
                      <p className="mt-1 text-lg font-semibold">
                        {company.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {company.stage || "Stage not set"} ·{" "}
                        {visibleSeats.length} visible seat
                        {visibleSeats.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {principalContext?.visibility?.scope || "authorized"} view
                    </Badge>
                  </div>
                </div>
                {visibleSeats.length > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      aria-label="Search visible seats"
                      value={mapSeatSearch}
                      onChange={(event) => setMapSeatSearch(event.target.value)}
                      placeholder="Search by seat, agent, or role"
                      className="sm:max-w-sm"
                    />
                    {visibleSeats.length > 12 && !mapSeatSearch.trim() && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          setShowAllMapSeats((current) => !current)
                        }
                      >
                        {showAllMapSeats
                          ? "Show fewer seats"
                          : `Show all seats (${visibleSeats.length})`}
                      </Button>
                    )}
                  </div>
                )}
                {displayedMapSeats.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {displayedMapSeats.map((seat: JsonRecord) => {
                      const supervisor = seat.supervisorSeatId
                        ? visibleSeats.find(
                            (item: JsonRecord) =>
                              item.id === seat.supervisorSeatId,
                          )
                        : undefined;
                      const selected = seat.id === selectedMapSeat?.id;
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedMapSeatId(seat.id);
                            setShowAllMapReports(false);
                          }}
                          className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? "border-primary/30 bg-primary/10" : "border-border bg-muted/60 hover:border-primary/20 hover:bg-primary/5"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold">{seat.title}</span>
                            <StateBadge state={seat.agentMode} />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Reports to{" "}
                            {supervisor?.title ||
                              (seat.supervisorSeatId
                                ? "an authorized parent outside this view"
                                : "the portfolio principal")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Network}
                    title={
                      visibleSeats.length
                        ? "No seats match your search"
                        : "No seats are visible"
                    }
                    description={
                      visibleSeats.length
                        ? "Try a seat title, agent name, or role."
                        : "This authority scope does not currently include an organizational seat."
                    }
                  />
                )}
              </CardContent>
            </Card>
            {selectedMapSeat && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eos-label">Selected accountability</p>
                      <CardTitle className="mt-2">
                        {selectedMapSeat.title}
                      </CardTitle>
                      <CardDescription>
                        {selectedMapSeat.kind.replaceAll("_", " ")} ·{" "}
                        {selectedMapSeat.agentName}
                      </CardDescription>
                    </div>
                    <StateBadge state={selectedMapSeat.agentMode} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedMapSeat.mandate ||
                      "This seat's mandate has not been defined yet."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Fact
                      label="Reports to"
                      value={
                        selectedMapSupervisor?.title ||
                        (selectedMapSeat.supervisorSeatId
                          ? "Authorized parent outside this view"
                          : "Portfolio principal")
                      }
                    />
                    <Fact
                      label="Visible reports"
                      value={String(selectedMapReports.length)}
                    />
                    <Fact
                      label="Active work"
                      value={String(selectedMapPackets.length)}
                    />
                    <Fact
                      label="Human + agent"
                      value={
                        selectedMapSeat.occupantUserId
                          ? `${selectedMapSeat.agentName} assists the seat holder`
                          : `${selectedMapSeat.agentName} operates the role`
                      }
                    />
                  </div>
                  {selectedMapReports.length > 0 && (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="eos-label">Visible direct reports</p>
                        {selectedMapReports.length > 8 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setShowAllMapReports((current) => !current)
                            }
                          >
                            {showAllMapReports
                              ? "Show fewer reports"
                              : `Show all reports (${selectedMapReports.length})`}
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {displayedMapReports.map((seat: JsonRecord) => (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => {
                              setSelectedMapSeatId(seat.id);
                              setShowAllMapReports(false);
                            }}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary/5"
                          >
                            {seat.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedMapPackets.length > 0 &&
                      allowedSurfaces.has("work-room") && (
                        <Button
                          onClick={() => {
                            setProviderPacketId(selectedMapPackets[0].id);
                            goToSurface("work-room");
                          }}
                        >
                          <BriefcaseBusiness className="mr-2 h-4 w-4" />
                          Open seat work
                        </Button>
                      )}
                    <Button
                      variant={
                        selectedMapPackets.length > 0 ? "outline" : "default"
                      }
                      onClick={() =>
                        sendEaMessage(
                          `Explain the accountability, current work, reporting dependencies, and next authorized action for the ${selectedMapSeat.title} seat. Keep the answer inside my visibility and communication path.`,
                        )
                      }
                    >
                      <MessagesSquare className="mr-2 h-4 w-4" />
                      Ask {assistantName} about this seat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="capital" className="space-y-6">
            <div>
              <p className="eos-label">Finance &amp; capital instrument</p>
              <h2 className="mt-1 text-2xl font-semibold">
                Cash to allocation
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Trace legal entity and provider sources through budgets,
                obligations, reconciled variance, unit economics, and governed
                allocation. EOS controls decisions and evidence; providers
                retain ledger truth.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Fact
                label="Connected sources"
                value={String(
                  financeStateQuery.data?.counts?.connectedSources || 0,
                )}
              />
              <Fact
                label="Approved plans"
                value={String(
                  financeStateQuery.data?.counts?.approvedPlans || 0,
                )}
              />
              <Fact
                label="Reconciled plans"
                value={String(
                  financeStateQuery.data?.counts?.reconciledPlans || 0,
                )}
              />
              <Fact
                label="Open obligations"
                value={String(
                  financeStateQuery.data?.counts?.openObligations || 0,
                )}
              />
              <Fact
                label="Awaiting allocation decision"
                value={String(
                  financeStateQuery.data?.counts?.allocationsAwaitingDecision ||
                    0,
                )}
              />
            </div>
            {financeStateQuery.isLoading && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Compiling financial sources, plans, obligations, and
                  allocation state…
                </CardContent>
              </Card>
            )}
            {financeStateQuery.isError && (
              <Alert variant="destructive">
                <AlertTitle>Finance instrument unavailable</AlertTitle>
                <AlertDescription>
                  Refresh the workspace. EOS will not substitute invented
                  financial state.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Financial sources</CardTitle>
                <CardDescription>
                  Map the legal entity and authoritative account boundary. A
                  draft is planning context; a connected source requires a real
                  provider account reference.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2">
                  <Input
                    aria-label="Financial source name"
                    value={financeSourceName}
                    onChange={(event) =>
                      setFinanceSourceName(event.target.value)
                    }
                    placeholder="Operating account projection"
                  />
                  <Input
                    aria-label="Financial legal entity"
                    value={financeEntityName}
                    onChange={(event) =>
                      setFinanceEntityName(event.target.value)
                    }
                    placeholder="Legal entity name"
                  />
                  <select
                    aria-label="Financial source type"
                    value={financeSourceType}
                    onChange={(event) =>
                      setFinanceSourceType(event.target.value)
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="bank">Bank</option>
                    <option value="accounting">Accounting</option>
                    <option value="payment">Payment</option>
                    <option value="payroll">Payroll</option>
                    <option value="tax">Tax</option>
                    <option value="investment">Investment</option>
                    <option value="receivable">Receivable</option>
                    <option value="payable">Payable</option>
                    <option value="cash_equivalent">Cash equivalent</option>
                    <option value="other">Other</option>
                  </select>
                  <Input
                    aria-label="Financial provider"
                    value={financeProvider}
                    onChange={(event) => setFinanceProvider(event.target.value)}
                    placeholder="Provider/system (optional)"
                  />
                  <Input
                    aria-label="Financial external account ID"
                    value={financeExternalId}
                    onChange={(event) =>
                      setFinanceExternalId(event.target.value)
                    }
                    placeholder="External account reference (optional)"
                  />
                  <Button
                    className="lg:col-span-2"
                    disabled={
                      financeSourceName.trim().length < 2 ||
                      financeEntityName.trim().length < 2 ||
                      Boolean(financeProvider) !== Boolean(financeExternalId) ||
                      financialSourceMutation.isPending ||
                      !effectiveAuthorityClasses.has("execute")
                    }
                    onClick={() => financialSourceMutation.mutate()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {financialSourceMutation.isPending
                      ? "Mapping…"
                      : financeProvider
                        ? "Map provider source"
                        : "Draft source boundary"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {(financeStateQuery.data?.sources || []).map(
                    (item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge state={item.lifecycleState} />
                          <Badge variant="outline">
                            {item.accountType.replaceAll("_", " ")}
                          </Badge>
                          <Badge
                            variant={
                              item.sourceAuthority === "external_authoritative"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {item.sourceAuthority.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.legalEntityName} · {item.currency}
                          {item.sourceSystem
                            ? ` · ${item.sourceSystem}`
                            : " · provider not bound"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reconciliation:{" "}
                          {item.reconciliationState.replaceAll("_", " ")}
                          {item.freshnessAsOf
                            ? ` · as of ${new Date(item.freshnessAsOf).toLocaleString()}`
                            : " · freshness not established"}
                        </p>
                        {item.sourceAuthority !== "external_authoritative" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextFinancialSourceStates(item.lifecycleState).map(
                              (lifecycleState) => (
                                <Button
                                  key={lifecycleState}
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    financialSourceTransitionMutation.isPending ||
                                    !effectiveAuthorityClasses.has("decide") ||
                                    (lifecycleState === "connected" &&
                                      !item.sourceSystem)
                                  }
                                  onClick={() =>
                                    financialSourceTransitionMutation.mutate({
                                      id: item.id,
                                      lifecycleState,
                                    })
                                  }
                                >
                                  {lifecycleState.replaceAll("_", " ")}
                                </Button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                  {!financeStateQuery.isLoading &&
                    !(financeStateQuery.data?.sources || []).length && (
                      <p className="text-sm text-muted-foreground">
                        No legal-entity/account boundary has been mapped.
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budgets, forecasts &amp; scenarios</CardTitle>
                <CardDescription>
                  Model planned economics with explicit assumptions, then
                  advance them through review and approval. Approved plan
                  artifacts are immutable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2">
                  <Input
                    aria-label="Financial plan name"
                    value={financePlanName}
                    onChange={(event) => setFinancePlanName(event.target.value)}
                    placeholder="Quarterly operating budget"
                  />
                  <select
                    aria-label="Financial plan type"
                    value={financePlanType}
                    onChange={(event) => setFinancePlanType(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="budget">Budget</option>
                    <option value="forecast">Forecast</option>
                    <option value="scenario">Scenario</option>
                    <option value="liquidity">Liquidity</option>
                    <option value="unit_economics">Unit economics</option>
                    <option value="capital_plan">Capital plan</option>
                  </select>
                  <select
                    aria-label="Financial plan source"
                    value={financePlanSourceId}
                    onChange={(event) =>
                      setFinancePlanSourceId(event.target.value)
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No linked provider source</option>
                    {(financeStateQuery.data?.sources || []).map(
                      (item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ),
                    )}
                  </select>
                  <Input
                    aria-label="Financial planned amount"
                    type="number"
                    min="0"
                    value={financePlanAmount}
                    onChange={(event) =>
                      setFinancePlanAmount(event.target.value)
                    }
                    placeholder="Planned amount (USD)"
                  />
                  <Input
                    aria-label="Financial plan start"
                    type="date"
                    value={financePlanStart}
                    onChange={(event) =>
                      setFinancePlanStart(event.target.value)
                    }
                  />
                  <Input
                    aria-label="Financial plan end"
                    type="date"
                    value={financePlanEnd}
                    onChange={(event) => setFinancePlanEnd(event.target.value)}
                  />
                  <Input
                    aria-label="Financial plan line item"
                    value={financePlanLineName}
                    onChange={(event) =>
                      setFinancePlanLineName(event.target.value)
                    }
                    placeholder="Primary line item"
                  />
                  <Input
                    aria-label="Financial plan line amount"
                    type="number"
                    min="0"
                    value={financePlanLineAmount}
                    onChange={(event) =>
                      setFinancePlanLineAmount(event.target.value)
                    }
                    placeholder="Line-item amount"
                  />
                  <Textarea
                    aria-label="Financial plan assumption"
                    className="lg:col-span-2"
                    value={financePlanAssumption}
                    onChange={(event) =>
                      setFinancePlanAssumption(event.target.value)
                    }
                    placeholder="State the economic assumption and its uncertainty"
                  />
                  <Button
                    className="lg:col-span-2"
                    disabled={
                      financePlanName.trim().length < 2 ||
                      !Number(financePlanAmount) ||
                      !financePlanStart ||
                      !financePlanEnd ||
                      financePlanEnd <= financePlanStart ||
                      financePlanAssumption.trim().length < 3 ||
                      financePlanLineName.trim().length < 1 ||
                      !Number(financePlanLineAmount) ||
                      financialPlanMutation.isPending ||
                      !effectiveAuthorityClasses.has("execute")
                    }
                    onClick={() => financialPlanMutation.mutate()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {financialPlanMutation.isPending
                      ? "Drafting…"
                      : "Draft financial plan"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {(financeStateQuery.data?.plans || []).map(
                    (item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge state={item.state} />
                          <Badge variant="outline">
                            {item.planType.replaceAll("_", " ")}
                          </Badge>
                          <Badge
                            variant={
                              item.reconciliationState === "reconciled"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {item.reconciliationState.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.currency}{" "}
                          {Number(item.plannedAmount).toLocaleString()} planned
                          {item.actualAmount !== null
                            ? ` · ${Number(item.actualAmount).toLocaleString()} actual · ${Number(item.varianceAmount).toLocaleString()} variance`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.periodStart).toLocaleDateString()}–
                          {new Date(item.periodEnd).toLocaleDateString()} ·{" "}
                          {(item.assumptions || []).length} assumption(s)
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nextFinancialPlanStates(item.state).map((state) => (
                            <Button
                              key={state}
                              size="sm"
                              variant="outline"
                              disabled={
                                financialPlanTransitionMutation.isPending ||
                                !effectiveAuthorityClasses.has(
                                  state === "approved" ? "approve" : "decide",
                                )
                              }
                              onClick={() =>
                                financialPlanTransitionMutation.mutate({
                                  id: item.id,
                                  state,
                                })
                              }
                            >
                              {state.replaceAll("_", " ")}
                            </Button>
                          ))}
                          {["approved", "active"].includes(item.state) &&
                            item.reconciliationState !== "reconciled" && (
                              <Button
                                size="sm"
                                disabled={
                                  financeReconcileActual === "" ||
                                  Number(financeReconcileActual) < 0 ||
                                  !financeReconcileFlowIds.length ||
                                  !financeReconcileEvidenceIds.length ||
                                  financialPlanReconcileMutation.isPending ||
                                  !effectiveAuthorityClasses.has("approve")
                                }
                                onClick={() =>
                                  financialPlanReconcileMutation.mutate(item.id)
                                }
                              >
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                Reconcile selected facts
                              </Button>
                            )}
                        </div>
                      </div>
                    ),
                  )}
                  {!financeStateQuery.isLoading &&
                    !(financeStateQuery.data?.plans || []).length && (
                      <p className="text-sm text-muted-foreground">
                        No budget, forecast, scenario, liquidity,
                        unit-economics, or capital plan exists.
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Authoritative financial facts</CardTitle>
                  <CardDescription>
                    Select provider-backed value flows and verified evidence
                    before reconciling a plan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label
                      htmlFor="finance-observed-actual"
                      className="eos-label"
                    >
                      Observed actual (USD)
                    </label>
                    <Input
                      id="finance-observed-actual"
                      aria-label="Finance observed actual"
                      type="number"
                      min="0"
                      value={financeReconcileActual}
                      onChange={(event) =>
                        setFinanceReconcileActual(event.target.value)
                      }
                      className="mt-2"
                      placeholder="Operator-declared actual supported by selected facts"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      EOS does not infer accounting signs or ledger treatment
                      from mixed financial events.
                    </p>
                  </div>
                  <div>
                    <p className="eos-label">Value flows</p>
                    <div className="mt-2 space-y-2">
                      {(financeStateQuery.data?.valueFlows || []).map(
                        (item: JsonRecord) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={financeReconcileFlowIds.includes(
                                item.id,
                              )}
                              onChange={() =>
                                setFinanceReconcileFlowIds((current) =>
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id],
                                )
                              }
                            />
                            <span>
                              <span className="font-medium">{item.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {item.flowType} · {item.currency}{" "}
                                {Number(item.amount || 0).toLocaleString()} ·{" "}
                                {item.sourceSystem || "source missing"}
                              </span>
                            </span>
                          </label>
                        ),
                      )}
                      {!(financeStateQuery.data?.valueFlows || []).length && (
                        <p className="text-sm text-muted-foreground">
                          No provider-backed invoice, payment, refund, cost, or
                          revenue projection is available.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="eos-label">Verified evidence</p>
                    <div className="mt-2 space-y-2">
                      {(evidenceQuery.data || [])
                        .filter(
                          (item) =>
                            item.verificationState === "verified" &&
                            [
                              "financial_record",
                              "provider_receipt",
                              "external_verification",
                              "review",
                            ].includes(item.evidenceType),
                        )
                        .map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={financeReconcileEvidenceIds.includes(
                                item.id,
                              )}
                              onChange={() =>
                                setFinanceReconcileEvidenceIds((current) =>
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id],
                                )
                              }
                            />
                            <span>
                              <span className="font-medium">{item.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {item.evidenceType.replaceAll("_", " ")} ·
                                verified
                              </span>
                            </span>
                          </label>
                        ))}
                      {!(evidenceQuery.data || []).some(
                        (item) =>
                          item.verificationState === "verified" &&
                          [
                            "financial_record",
                            "provider_receipt",
                            "external_verification",
                            "review",
                          ].includes(item.evidenceType),
                      ) && (
                        <p className="text-sm text-muted-foreground">
                          Record and verify financial evidence through a
                          governed Work Packet before reconciliation.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Financial obligations</CardTitle>
                  <CardDescription>
                    Obligations remain in the shared Risk, Obligation &amp;
                    Control registry, with the finance scope attached.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border p-4">
                    <Input
                      aria-label="Financial obligation title"
                      value={financeObligationTitle}
                      onChange={(event) =>
                        setFinanceObligationTitle(event.target.value)
                      }
                      placeholder="Tax filing, debt covenant, payable, or control obligation"
                    />
                    <Textarea
                      aria-label="Financial obligation description"
                      value={financeObligationDescription}
                      onChange={(event) =>
                        setFinanceObligationDescription(event.target.value)
                      }
                      placeholder="Describe requirement, cause, due consequence, and accountable control"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        financeObligationTitle.trim().length < 3 ||
                        financeObligationDescription.trim().length < 3 ||
                        financeObligationMutation.isPending ||
                        !effectiveAuthorityClasses.has("execute")
                      }
                      onClick={() => financeObligationMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Record obligation
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(financeStateQuery.data?.obligations || []).map(
                      (item: JsonRecord) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <StateBadge state={item.state} />
                          <p className="mt-3 font-semibold">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.descriptionCauseEventImpact}
                          </p>
                        </div>
                      ),
                    )}
                    {!(financeStateQuery.data?.obligations || []).length && (
                      <p className="text-sm text-muted-foreground">
                        No financial obligation has been recorded.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Capital allocation decisions</CardTitle>
                <CardDescription>
                  Compare uses of capital against an approved plan. Approval is
                  a governed decision; committed or deployed state still
                  requires fresh spend authority and provider evidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2">
                  <Input
                    aria-label="Capital allocation name"
                    value={allocationName}
                    onChange={(event) => setAllocationName(event.target.value)}
                    placeholder="Allocation proposal"
                  />
                  <select
                    aria-label="Capital allocation type"
                    value={allocationType}
                    onChange={(event) => setAllocationType(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="operating">Operating</option>
                    <option value="growth">Growth</option>
                    <option value="reserve">Reserve</option>
                    <option value="debt_service">Debt service</option>
                    <option value="asset_purchase">Asset purchase</option>
                    <option value="internal_investment">
                      Internal investment
                    </option>
                    <option value="external_investment">
                      External investment
                    </option>
                    <option value="distribution">Distribution</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    aria-label="Capital allocation plan"
                    value={allocationPlanId}
                    onChange={(event) =>
                      setAllocationPlanId(event.target.value)
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choose approved plan</option>
                    {(financeStateQuery.data?.plans || [])
                      .filter((item: JsonRecord) =>
                        ["approved", "active"].includes(item.state),
                      )
                      .map((item: JsonRecord) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                  <Input
                    aria-label="Capital allocation amount"
                    type="number"
                    min="0.01"
                    value={allocationAmount}
                    onChange={(event) =>
                      setAllocationAmount(event.target.value)
                    }
                    placeholder="Amount (USD)"
                  />
                  <Input
                    aria-label="Capital allocation target"
                    value={allocationTarget}
                    onChange={(event) =>
                      setAllocationTarget(event.target.value)
                    }
                    placeholder="Capability, project, reserve, or obligation target"
                  />
                  <select
                    aria-label="Capital allocation work packet"
                    value={allocationWorkPacketId}
                    onChange={(event) =>
                      setAllocationWorkPacketId(event.target.value)
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No approved Work Packet yet</option>
                    {(packetsQuery.data || [])
                      .filter((item) => item.status === "ready")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                  <Textarea
                    aria-label="Capital allocation rationale"
                    value={allocationRationale}
                    onChange={(event) =>
                      setAllocationRationale(event.target.value)
                    }
                    placeholder="Why this use of capital is preferred"
                  />
                  <Textarea
                    aria-label="Capital allocation outcome"
                    value={allocationOutcome}
                    onChange={(event) =>
                      setAllocationOutcome(event.target.value)
                    }
                    placeholder="Expected measurable outcome"
                  />
                  <Textarea
                    aria-label="Capital allocation downside"
                    className="lg:col-span-2"
                    value={allocationRisk}
                    onChange={(event) => setAllocationRisk(event.target.value)}
                    placeholder="Downside, opportunity cost, and stop condition"
                  />
                  <div className="flex flex-wrap gap-2 lg:col-span-2">
                    <Button
                      disabled={
                        !allocationPlanId ||
                        !allocationWorkPacketId ||
                        allocationName.trim().length < 2 ||
                        !Number(allocationAmount) ||
                        allocationTarget.trim().length < 1 ||
                        allocationRationale.trim().length < 3 ||
                        allocationOutcome.trim().length < 3 ||
                        allocationRisk.trim().length < 3 ||
                        capitalAllocationMutation.isPending ||
                        !effectiveAuthorityClasses.has("recommend")
                      }
                      onClick={() => capitalAllocationMutation.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {capitalAllocationMutation.isPending
                        ? "Proposing…"
                        : "Propose allocation"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        prepareWorkPacket(
                          "Review capital allocation",
                          `Review the proposed use of capital for ${company.name}, compare alternatives and downside, confirm the approved plan ceiling, and record an accountable approval decision. Do not move funds.`,
                        )
                      }
                    >
                      <BriefcaseBusiness className="mr-2 h-4 w-4" />
                      Prepare approval packet
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {(financeStateQuery.data?.allocations || []).map(
                    (item: JsonRecord) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge state={item.state} />
                          <Badge variant="outline">
                            {item.allocationType.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.currency} {Number(item.amount).toLocaleString()}{" "}
                          → {item.targetKey}
                        </p>
                        <p className="mt-2 text-sm">{item.rationale}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expected: {item.expectedOutcome} · Downside:{" "}
                          {item.downsideRisk}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nextCapitalAllocationStates(item.state).map(
                            (state) => (
                              <Button
                                key={state}
                                size="sm"
                                variant="outline"
                                disabled={
                                  capitalAllocationTransitionMutation.isPending ||
                                  !effectiveAuthorityClasses.has(
                                    state === "approved"
                                      ? "approve"
                                      : ["committed", "deployed"].includes(
                                            state,
                                          )
                                        ? "spend"
                                        : "decide",
                                  ) ||
                                  (state === "approved" && !item.workPacketId)
                                }
                                onClick={() =>
                                  capitalAllocationTransitionMutation.mutate({
                                    id: item.id,
                                    state,
                                  })
                                }
                              >
                                {state.replaceAll("_", " ")}
                              </Button>
                            ),
                          )}
                        </div>
                        {item.state === "under_review" &&
                          !item.workPacketId && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Link a ready, approved Work Packet in a revised
                              proposal before approval.
                            </p>
                          )}
                      </div>
                    ),
                  )}
                  {!(financeStateQuery.data?.allocations || []).length && (
                    <p className="text-sm text-muted-foreground">
                      No allocation proposal exists.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Investor Relations remains dormant</CardTitle>
                <CardDescription>
                  Its interface and object contract are mapped, but execution
                  stays unavailable until a real capital breakpoint activates
                  the legal, instrument, investor-identity, disclosure,
                  professional-review, approval, and reporting boundary.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    prepareWorkPacket(
                      "Define capital readiness boundary",
                      `Identify the legal entity, accounts, instruments, investor data, professional review, approval authority, disclosure controls, and evidence ${company.name} would need before Investor Relations can activate.`,
                    )
                  }
                >
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Prepare readiness mission
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    sendEaMessage(
                      `Inspect ${company.name}'s current finance graph. Explain the next safe cash-to-allocation action, material source or evidence gap, and why Investor Relations remains dormant.`,
                    )
                  }
                >
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Ask {assistantName} for a finance diagnosis
                </Button>
              </CardContent>
            </Card>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>
                No implied ledger, movement-of-funds, tax, accounting, or
                securities authority
              </AlertTitle>
              <AlertDescription>
                Plans and forecasts are EOS decision artifacts. Actuals require
                explicit provider projections and verified evidence.
                Professional and external execution boundaries remain intact.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {assistantName} ·{" "}
                  {isFounder
                    ? "Executive Office"
                    : `${principalContext?.seat} assistant`}
                </CardTitle>
                <CardDescription>
                  {isFounder
                    ? "One founder-facing conversation, orchestrating portfolio advisors and company CEO Agents without flattening the organization."
                    : "A persistent Role Agent operating as the human seat occupant's assistant inside the reporting hierarchy."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {assistantName} may explain state, preserve provenance, and
                  draft bounded work. It may not expand this seat's visibility,
                  grant authority, or execute consequential effects.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <Fact
                    label="Channel"
                    value={
                      principalContext?.visibility?.communicationPath ||
                      assistantName
                    }
                  />
                  <Fact
                    label="Operating mode"
                    value={
                      principalContext?.communicationMode?.replaceAll(
                        "_",
                        " ",
                      ) || "assistant"
                    }
                  />
                  <Fact
                    label="Authority"
                    value="Advice only; EOS approvals govern effects"
                  />
                </div>
                <Button onClick={openCommunication}>
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Open {assistantName} conversation
                </Button>
              </CardContent>
            </Card>
            {advisorVisible && (
              <div>
                <p className="eos-label">Portfolio intelligence</p>
                <h2 className="mt-1 text-xl font-semibold">
                  15-advisor council
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  The mandates are stable; each consultation is personalized,
                  persisted, and synthesized by the EA with source identity and
                  dissent retained.
                </p>
              </div>
            )}
            {councilQuery.isLoading && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Compiling the advisor council…
                </CardContent>
              </Card>
            )}
            {councilQuery.isError && (
              <Alert variant="destructive">
                <AlertTitle>Advisor council unavailable</AlertTitle>
                <AlertDescription>
                  Retry the workspace. No substitute council is implied.
                </AlertDescription>
              </Alert>
            )}
            {advisorVisible && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(councilQuery.data?.advisors || []).map(
                  (advisor: JsonRecord, index: number) => (
                    <Card key={advisor.id}>
                      <CardContent className="flex h-full flex-col pt-8">
                        <div className="flex items-start justify-between gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-sm font-semibold text-primary">
                            {index + 1}
                          </span>
                          <Badge variant="outline">{advisor.timeHorizon}</Badge>
                        </div>
                        <h3 className="mt-5 font-semibold">{advisor.name}</h3>
                        <p className="mt-2 flex-1 text-sm text-muted-foreground">
                          {advisor.mandate}
                        </p>
                        {advisor.professionalBoundary && (
                          <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                            {advisor.professionalBoundary}
                          </p>
                        )}
                        <Button
                          className="mt-4 w-full"
                          variant="outline"
                          onClick={() =>
                            sendEaMessage(
                              `Consult the ${advisor.name} perspective on our current company priorities. Return its assumptions, risks, recommendation, and material dissent through your EA synthesis.`,
                            )
                          }
                        >
                          <MessagesSquare className="mr-2 h-4 w-4" />
                          Consult through {assistantName}
                        </Button>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            )}
            {advisorVisible && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent advisor artifacts</CardTitle>
                  <CardDescription>
                    Each artifact identifies which advisor was actually
                    consulted and which model produced the result.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(consultationsQuery.data || []).slice(0, 12).map((item) => (
                    <div key={item.id} className="rounded-xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.advisorName}</span>
                        <StateBadge state={item.status} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.response}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.model || "No provider model"} ·{" "}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {!consultationsQuery.data?.length && (
                    <p className="text-sm text-muted-foreground">
                      Advisor artifacts appear after the EA convenes relevant
                      seats for a founder request.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {advisorVisible && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Council outputs are advisory artifacts</AlertTitle>
                <AlertDescription>
                  The founder does not manage fifteen parallel chats.{" "}
                  {assistantName} convenes the relevant perspectives, returns a
                  synthesis with dissent and provenance, and moves requested
                  action into the Work Packet and approval lifecycle.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="systems" className="space-y-5">
            <Suspense fallback={<DeferredControlFallback />}>
              <CanonicalInstrumentControlCenter
                root={root}
                canExecute={effectiveAuthorityClasses.has("execute")}
                canDecide={effectiveAuthorityClasses.has("decide")}
                evidence={evidence.map((item: JsonRecord) => ({
                  id: String(item.id),
                  title: String(item.title || "Evidence"),
                  verificationState: String(item.verificationState || ""),
                }))}
              />
            </Suspense>
            <Card>
              <CardHeader>
                <CardTitle>Integration Core</CardTitle>
                <CardDescription>
                  Provider truth, granted authority, health, tool schema, and
                  fallback are visible before any external effect.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Fact
                  label="Control model"
                  value="Local approval before consequence"
                />
                <Fact
                  label="Credential boundary"
                  value="Encrypted or deployment-managed"
                />
                <Fact
                  label="Provider health"
                  value="Live adapter verification"
                />
              </CardContent>
            </Card>
            {allowedSurfaces.has("systems") ? (
              <Suspense fallback={<DeferredControlFallback />}>
              <NativeEsignOperatorConsole
                root={root}
                canOperate={canOperateNativeSigning}
                canApproveReplacements={isFounder}
                seats={visibleSeats.map((seat: JsonRecord) => ({
                  id: String(seat.id),
                  title: String(seat.title || ""),
                  kind: String(seat.kind || ""),
                  agentName: String(seat.agentName || ""),
                  status: String(seat.status || "active"),
                }))}
                evidence={evidence.map((item: JsonRecord) => ({
                  id: String(item.id),
                  title: String(item.title || ""),
                  verificationState: String(item.verificationState || ""),
                  evidenceType: String(item.evidenceType || ""),
                  capturedAt: item.capturedAt ? String(item.capturedAt) : undefined,
                }))}
                onOpenCommand={() => setActiveTab("command")}
              />
              </Suspense>
            ) : null}
            <SystemsRegistryInstrument
              root={root}
              state={systemsStateQuery.data}
              loading={systemsStateQuery.isLoading}
              error={systemsStateQuery.isError}
              refetch={() => systemsStateQuery.refetch()}
              seats={visibleSeats}
              authorityGrants={authorityGrants}
              packets={packets}
              evidence={evidence}
              authorityClasses={effectiveAuthorityClasses}
              showError={showMutationError}
            />
            {(integrationsQuery.data || []).map((integration) => (
              <IntegrationControlCard
                key={integration.id}
                integration={integration}
                pending={
                  connectIntegrationMutation.isPending ||
                  disconnectIntegrationMutation.isPending ||
                  verifyIntegrationMutation.isPending
                }
                onConnect={() => connectIntegrationMutation.mutate(integration)}
                onDisconnect={() =>
                  disconnectIntegrationMutation.mutate(integration)
                }
                onVerify={() => verifyIntegrationMutation.mutate(integration)}
              />
            ))}
            {notionConnected && (
              <Card>
                <CardHeader>
                  <CardTitle>Search connected Notion</CardTitle>
                  <CardDescription>
                    Find operating context in pages explicitly shared with the
                    workspace connection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const next = notionSearchDraft.trim();
                      if (next === notionSearch)
                        void notionContextQuery.refetch();
                      else setNotionSearch(next);
                    }}
                  >
                    <Input
                      value={notionSearchDraft}
                      onChange={(event) =>
                        setNotionSearchDraft(event.target.value)
                      }
                      maxLength={200}
                      placeholder="Search shared pages and data sources"
                      aria-label="Search connected Notion workspace"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={notionContextQuery.isFetching}
                    >
                      <RefreshCw
                        className={`mr-2 h-4 w-4 ${notionContextQuery.isFetching ? "animate-spin" : ""}`}
                      />
                      {notionSearch ? "Search again" : "Load workspace"}
                    </Button>
                  </form>
                  {notionContextQuery.isError && (
                    <Alert variant="destructive">
                      <AlertTitle>Notion search unavailable</AlertTitle>
                      <AlertDescription>
                        Verify the connection or open Notion directly. No cached
                        result is represented as current.
                      </AlertDescription>
                    </Alert>
                  )}
                  {notionContextQuery.data && (
                    <ListCard
                      title={
                        notionSearch
                          ? `Results for “${notionSearch}”`
                          : "Recently updated Notion references"
                      }
                      empty="No shared Notion pages matched."
                      actionLabel="Open in Notion"
                      onSelect={(item) =>
                        item.url &&
                        window.open(item.url, "_blank", "noopener,noreferrer")
                      }
                      items={(notionContextQuery.data.results || []).map(
                        (item: JsonRecord) => ({
                          ...item,
                          title: item.title,
                          objective: item.lastEditedTime
                            ? `Updated ${new Date(item.lastEditedTime).toLocaleString()}`
                            : "Reference",
                          status: "reference",
                        }),
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            )}
            {!integrationsQuery.isLoading &&
              !integrationsQuery.data?.length && (
                <EmptyState
                  icon={Blocks}
                  title="Integration state unavailable"
                  description="Refresh the workspace to reload provider configuration and health."
                />
              )}
            {isFounder && (
              <Card>
                <CardHeader>
                  <CardTitle>AI spend controls</CardTitle>
                  <CardDescription>
                    Set enforceable limits for advisor, EA, and role-agent model
                    usage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="monthly-ai-budget" className="eos-label">
                        Monthly limit (USD)
                      </label>
                      <Input
                        id="monthly-ai-budget"
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        value={monthlyAiBudget}
                        onChange={(event) =>
                          setMonthlyAiBudget(event.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <label htmlFor="request-ai-budget" className="eos-label">
                        Per-request limit (USD)
                      </label>
                      <Input
                        id="request-ai-budget"
                        type="number"
                        min="0.01"
                        max="1000"
                        step="0.01"
                        value={perRequestAiBudget}
                        onChange={(event) =>
                          setPerRequestAiBudget(event.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={aiBudgetEnabled}
                      onChange={(event) =>
                        setAiBudgetEnabled(event.target.checked)
                      }
                    />
                    Enforce AI spend controls
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={
                        aiBudgetMutation.isPending ||
                        !Number(monthlyAiBudget) ||
                        !Number(perRequestAiBudget) ||
                        Number(perRequestAiBudget) > Number(monthlyAiBudget)
                      }
                      onClick={() => aiBudgetMutation.mutate()}
                    >
                      {aiBudgetMutation.isPending
                        ? "Saving…"
                        : "Save spend controls"}
                    </Button>
                    {aiBudgetQuery.data && (
                      <span className="text-sm text-muted-foreground">
                        Spent this month: $
                        {(
                          (aiBudgetQuery.data.spentMicros || 0) / 1_000_000
                        ).toFixed(2)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Standalone-safe operation</AlertTitle>
              <AlertDescription>
                EOS keeps manifests, work, approvals, audit, and evidence
                available when Universal Meta Harness or providers are offline.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog
        open={Boolean(commandTransitionDraft)}
        onOpenChange={(open) => {
          if (!open && !commandTransitionPending)
            setCommandTransitionDraft(null);
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm governed state change</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block font-medium text-foreground">
                {commandTransitionDraft?.title}
              </span>
              <span className="block">
                This will move the canonical record to{" "}
                <strong>
                  {commandTransitionDraft?.state.replaceAll("_", " ")}
                </strong>
                . The policy decision and result will remain in the audit trail;
                terminal states cannot be reopened through the normal lifecycle.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commandTransitionPending}>
              Keep current state
            </AlertDialogCancel>
            <Button
              variant={
                commandTransitionDraft?.state === "failed"
                  ? "destructive"
                  : "default"
              }
              disabled={!commandTransitionDraft || commandTransitionPending}
              onClick={confirmCommandTransition}
            >
              {commandTransitionPending
                ? "Recording change…"
                : "Confirm state change"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(decisionDraft)}
        onOpenChange={(open) => {
          if (!open && !approvalMutation.isPending) {
            setDecisionDraft(null);
            setDecisionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decisionDraft?.decision === "approved"
                ? "Confirm approval"
                : "Confirm rejection"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block font-medium text-foreground">
                {decisionDraft?.summary}
              </span>
              <span className="block">
                {decisionDraft?.decision === "approved"
                  ? /gmail|delivery|provider/i.test(
                      decisionDraft?.summary || "",
                    )
                    ? "Approval will execute the queued provider effect immediately. EOS will retain the provider receipt and reconciliation state."
                    : "Approval will move this Work Packet into ready work and preserve the decision in the audit trail."
                  : "Rejection will cancel the associated Work Packet. Add a reason so the requester knows what must change."}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <label htmlFor="decision-reason" className="eos-label">
              {decisionDraft?.decision === "rejected"
                ? "Rejection reason"
                : "Decision note (optional)"}
            </label>
            <Textarea
              id="decision-reason"
              className="mt-2"
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              placeholder={
                decisionDraft?.decision === "rejected"
                  ? "Explain what must change before this can be approved"
                  : "Add context for the audit trail"
              }
              maxLength={1000}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approvalMutation.isPending}>
              Keep pending
            </AlertDialogCancel>
            <Button
              variant={
                decisionDraft?.decision === "rejected"
                  ? "destructive"
                  : "default"
              }
              disabled={
                !decisionDraft ||
                approvalMutation.isPending ||
                (decisionDraft.decision === "rejected" &&
                  decisionReason.trim().length < 3)
              }
              onClick={() =>
                decisionDraft &&
                approvalMutation.mutate({
                  ...decisionDraft,
                  reason: decisionReason.trim() || undefined,
                })
              }
            >
              {approvalMutation.isPending
                ? "Recording decision…"
                : decisionDraft?.decision === "approved"
                  ? "Confirm approval"
                  : "Confirm rejection"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UniversalLayout>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  actionLabel,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${actionLabel}`}
      className="group rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Card className="h-full transition-[transform,box-shadow] group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_32px_rgba(106,55,212,0.12)]">
        <CardContent className="pt-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="eos-label mt-1">{label}</div>
              <div className="mt-3 text-xs font-medium text-primary">
                {actionLabel} →
              </div>
            </div>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function ListCard({
  title,
  items,
  empty,
  actionLabel,
  onSelect,
}: {
  title: string;
  items: JsonRecord[];
  empty: string;
  actionLabel?: string;
  onSelect?: (item: JsonRecord) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={
              index % 2 === 0
                ? "rounded-xl bg-muted p-4"
                : "rounded-xl bg-[#f5f6f7] p-4"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.title}</span>
              <StateBadge state={item.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.objective}
            </p>
            {onSelect && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 -ml-3 text-primary"
                onClick={() => onSelect(item)}
              >
                {actionLabel || "Open"}
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {!items.length && (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Workflow;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function IntegrationControlCard({
  integration,
  pending,
  onConnect,
  onDisconnect,
  onVerify,
}: {
  integration: JsonRecord;
  pending: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onVerify: () => void;
}) {
  const actions = new Set<string>(integration.actions || []);
  const scopeLabels: Record<string, string> = {
    "https://www.googleapis.com/auth/gmail.send": "Send approved email",
    "https://www.googleapis.com/auth/calendar.readonly": "Read calendars",
    "https://www.googleapis.com/auth/calendar.events":
      "Read and create approved calendar events",
    "https://www.googleapis.com/auth/drive.metadata.readonly":
      "Read Drive file metadata",
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-lg">{integration.name}</CardTitle>
          <CardDescription className="mt-1">
            {integration.description}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <StateBadge state={integration.state} />
          {integration.health && integration.health !== integration.state && (
            <StateBadge state={integration.health} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            label="Connection"
            value={(integration.providerType || "provider").replaceAll(
              "_",
              " ",
            )}
          />
          <Fact
            label="Authority"
            value={(integration.authority || "none").replaceAll("_", " ")}
          />
          <Fact
            label="Risk"
            value={(integration.risk || "unclassified").replaceAll("_", " ")}
          />
          <Fact
            label="Adapter"
            value={integration.executionAdapter || "Not configured"}
          />
        </div>

        {integration.serviceHealth && (
          <div>
            <p className="eos-label mb-2">Live service health</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(integration.serviceHealth).map(
                ([service, healthy]) => (
                  <Badge
                    key={service}
                    variant={healthy ? "default" : "outline"}
                  >
                    {service}: {healthy ? "reachable" : "unavailable"}
                  </Badge>
                ),
              )}
            </div>
          </div>
        )}
        {integration.workspace?.workspaceName && (
          <div className="rounded-xl border border-border/70 p-4">
            <p className="eos-label">Authorized workspace</p>
            <p className="mt-1 font-medium">
              {integration.workspace.workspaceName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only content shared with this Notion connection is visible to EOS.
            </p>
          </div>
        )}

        <details className="rounded-xl border border-border/70 bg-muted/25 p-4">
          <summary className="cursor-pointer font-medium">
            Capabilities and required access
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="eos-label mb-2">Tool schema</p>
              <div className="flex flex-wrap gap-2">
                {(integration.operations || []).map((operation: string) => (
                  <Badge key={operation} variant="outline">
                    {operation}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="eos-label mb-2">Required scopes</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(integration.requiredScopes || []).map((scope: string) => (
                  <li key={scope}>• {scopeLabels[scope] || scope}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>

        <div className="rounded-xl bg-muted p-4 text-sm">
          <span className="font-medium">Manual fallback:</span>{" "}
          <span className="text-muted-foreground">
            {integration.manualFallback}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(actions.has("connect") || actions.has("reconnect")) && (
            <Button onClick={onConnect} disabled={pending}>
              <Plug className="mr-2 h-4 w-4" />
              {actions.has("reconnect")
                ? `Reconnect ${integration.name}`
                : `Connect ${integration.name}`}
            </Button>
          )}
          {actions.has("verify") && (
            <Button variant="outline" onClick={onVerify} disabled={pending}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`}
              />
              Verify connection
            </Button>
          )}
          {actions.has("disconnect") && (
            <Button variant="outline" onClick={onDisconnect} disabled={pending}>
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          )}
          {actions.has("view_manifest") && (
            <Button asChild variant="outline">
              <a
                href={integration.capabilityManifest}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View capability manifest
              </a>
            </Button>
          )}
        </div>

        {!integration.configured && integration.id !== "umh" && (
          <Alert>
            <AlertTitle>Secure provider configuration required</AlertTitle>
            <AlertDescription>
              This adapter must be configured in the EntrepreneurOS deployment
              before a user can authorize it.
            </AlertDescription>
          </Alert>
        )}
        {!integration.configured && integration.id === "umh" && (
          <Alert>
            <AlertTitle>Federation is deployment-managed</AlertTitle>
            <AlertDescription>
              Universal Meta Harness activation requires an installation-bound
              issuer and signing keys. It is intentionally not enabled from the
              browser.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

async function downloadAuthenticatedFile(
  url: string,
  fileName: string,
): Promise<void> {
  let requestUrl = url;
  if (typeof window !== "undefined" && url.includes("/api/eos/companies/")) {
    const seatId = new URLSearchParams(window.location.search).get("seat");
    if (seatId) {
      const scoped = new URL(url, window.location.origin);
      scoped.searchParams.set("seatId", seatId);
      requestUrl = `${scoped.pathname}${scoped.search}`;
    }
  }
  const response = (await apiRequest("GET", requestUrl)) as Response;
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "candidate-evidence";
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function CandidateFileEvidenceReview({
  root,
  evidence,
  workPackets,
  canExecute,
  canApprove,
  refetch,
  showError,
}: {
  root: string;
  evidence: JsonRecord[];
  workPackets: JsonRecord[];
  canExecute: boolean;
  canApprove: boolean;
  refetch: () => Promise<unknown>;
  showError: (action: string, error: unknown) => void;
}) {
  const { toast } = useToast();
  const [promotionWorkPacketId, setPromotionWorkPacketId] = useState("");
  const [promotionClaim, setPromotionClaim] = useState("");
  const [promotionMethod, setPromotionMethod] = useState("");
  const rescan = useMutation({
    mutationFn: (id: string) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/talent-candidate-evidence/${id}/rescan`,
        {},
      ),
    onSuccess: async (record) => {
      await refetch();
      toast({
        title: "Security scan reconciled",
        description: `File state: ${String(record.scanState || "pending").replaceAll("_", " ")}.`,
      });
    },
    onError: (failure) => showError("Candidate file scan", failure),
  });
  const transcribe = useMutation({
    mutationFn: (id: string) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/talent-candidate-evidence/${id}/transcribe`,
        {},
      ),
    onSuccess: async (record) => {
      await refetch();
      toast({
        title: "Voice transcription reconciled",
        description: `Transcription: ${String(record.transcriptionState || "unavailable").replaceAll("_", " ")}.`,
      });
    },
    onError: (failure) => showError("Candidate voice transcription", failure),
  });
  const promote = useMutation({
    mutationFn: (id: string) =>
      requestJson<{ candidateEvidence: JsonRecord; evidence: JsonRecord }>(
        "POST",
        `${root}/talent-candidate-evidence/${id}/promote`,
        {
          ...(promotionWorkPacketId
            ? { workPacketId: promotionWorkPacketId }
            : {}),
          supportedClaimSummary: promotionClaim,
          verifierMethod: promotionMethod,
          confidenceQuality: "high",
        },
      ),
    onSuccess: async (result) => {
      await refetch();
      setPromotionClaim("");
      setPromotionMethod("");
      toast({
        title: "Candidate evidence verified",
        description: `Canonical Evidence ${String(result.evidence.id).slice(0, 8)} is now bound to its Work Packet.`,
      });
    },
    onError: (failure) =>
      showError("Candidate evidence verification", failure),
  });
  if (!evidence.length) return null;
  return (
    <div className="mt-4 space-y-2">
      <p className="eos-label">Candidate-provided evidence</p>
      <div className="grid gap-2 rounded-xl border bg-background p-3 lg:grid-cols-3">
        <select
          aria-label="Candidate evidence Work Packet"
          value={promotionWorkPacketId}
          onChange={(event) => setPromotionWorkPacketId(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Trial packet auto-selected</option>
          {workPackets.map((packet) => (
            <option key={packet.id} value={packet.id}>
              {String(packet.title || packet.summary || packet.id)}
            </option>
          ))}
        </select>
        <Input
          aria-label="Verified candidate evidence claim"
          value={promotionClaim}
          onChange={(event) => setPromotionClaim(event.target.value)}
          placeholder="Claim this evidence supports"
        />
        <Input
          aria-label="Candidate evidence verification method"
          value={promotionMethod}
          onChange={(event) => setPromotionMethod(event.target.value)}
          placeholder="How a human verified it"
        />
        <p className="text-xs text-muted-foreground lg:col-span-3">
          Trial submissions are locked to the Trial Work Packet. Other evidence
          requires the visible Work Packet selected here. Verification records
          the reviewer and never creates placement, access, payment, or authority.
        </p>
      </div>
      {evidence.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-muted/45 p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {String(item.evidenceType).replaceAll("_", " ")}
              {item.fileName
                ? ` · ${item.fileName} · ${Math.max(1, Math.ceil(Number(item.fileSizeBytes || 0) / 1024))} KB`
                : ""}
            </p>
            {item.fileName && (
              <p
                className={`mt-1 text-xs ${item.scanState === "clean" ? "text-emerald-700" : item.scanState === "infected" || item.scanState === "failed" ? "text-destructive" : "text-amber-700"}`}
              >
                Security:{" "}
                {String(item.scanState || "pending").replaceAll("_", " ")}
              </p>
            )}
            {item.transcriptionRequested && (
              <p className="mt-1 text-xs text-muted-foreground">
                Transcription:{" "}
                {String(item.transcriptionState || "awaiting_scan").replaceAll(
                  "_",
                  " ",
                )}
              </p>
            )}
            {item.transcript && (
              <div className="mt-2 rounded-lg border bg-background p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  Candidate-visible transcript
                </p>
                {item.transcript}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {item.fileName &&
              item.scanState === "clean" &&
              item.state !== "withdrawn" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void downloadAuthenticatedFile(
                      `${root}/talent-candidate-evidence/${item.id}/file`,
                      item.fileName,
                    ).catch((failure) =>
                      showError("Candidate file download", failure),
                    )
                  }
                >
                  Download
                </Button>
              )}
            {item.fileName &&
              ["pending", "failed"].includes(item.scanState) &&
              item.state !== "withdrawn" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canExecute || rescan.isPending}
                  onClick={() => rescan.mutate(item.id)}
                >
                  Run security scan
                </Button>
              )}
            {item.evidenceType === "voice_response_file" &&
              item.scanState === "clean" &&
              item.transcriptionRequested &&
              ["unavailable", "failed", "awaiting_scan"].includes(
                item.transcriptionState,
              ) &&
              item.state !== "withdrawn" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canExecute || transcribe.isPending}
                  onClick={() => transcribe.mutate(item.id)}
                >
                  Retry transcription
                </Button>
              )}
            {item.state === "submitted" &&
              (item.fileName
                ? item.scanState === "clean"
                : item.scanState === "not_applicable") && (
                <Button
                  size="sm"
                  disabled={
                    !canApprove ||
                    promote.isPending ||
                    promotionClaim.trim().length < 3 ||
                    promotionMethod.trim().length < 3
                  }
                  onClick={() => promote.mutate(String(item.id))}
                >
                  Verify into Evidence
                </Button>
              )}
            <StateBadge
              state={
                item.state === "withdrawn"
                  ? "withdrawn"
                  : item.state === "promoted"
                    ? "verified"
                  : item.fileName
                    ? item.scanState
                    : item.state
              }
            />
            {item.promotedEvidenceId && (
              <span className="self-center text-xs text-muted-foreground">
                Evidence {String(item.promotedEvidenceId).slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TalentInstrument({
  root,
  state,
  loading,
  error,
  refetch,
  seats,
  evidence,
  workPackets,
  authorityClasses: effectiveClasses,
  showError,
  askAssistant,
  assistantName,
}: {
  root: string;
  state?: JsonRecord;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
  seats: JsonRecord[];
  evidence: JsonRecord[];
  workPackets: JsonRecord[];
  authorityClasses: Set<string>;
  showError: (action: string, error: unknown) => void;
  askAssistant: (content: string) => void;
  assistantName: string;
}) {
  const { toast } = useToast();
  const needs = state?.needs || [];
  const applications = state?.applications || [];
  const assessments = state?.assessments || [];
  const reviewPackets = state?.reviewPackets || [];
  const trials = state?.trials || [];
  const placements = state?.placements || [];
  const candidates = state?.candidates || [];
  const candidateEvidence = state?.candidateEvidence || [];
  const candidateMessages = state?.candidateMessages || [];
  const scheduling = state?.scheduling || [];
  const verifiedEvidence = evidence.filter(
    (item) => item.verificationState === "verified",
  );
  const [needTitle, setNeedTitle] = useState("");
  const [needSeatId, setNeedSeatId] = useState("");
  const [needUrgency, setNeedUrgency] = useState("planned");
  const [needRationale, setNeedRationale] = useState("");
  const [needOutcome, setNeedOutcome] = useState("");
  const [needEvidenceId, setNeedEvidenceId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateIdentity, setCandidateIdentity] = useState("");
  const [candidateNeedId, setCandidateNeedId] = useState("");
  const [candidateSummary, setCandidateSummary] = useState("");
  const [candidateHypothesis, setCandidateHypothesis] = useState("");
  const [candidateEvidenceId, setCandidateEvidenceId] = useState("");
  const [assessmentApplicationId, setAssessmentApplicationId] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState("work_sample");
  const [assessmentQuestion, setAssessmentQuestion] = useState("");
  const [assessmentExpected, setAssessmentExpected] = useState("");
  const [assessmentBurden, setAssessmentBurden] = useState("");
  const [assessmentEvidenceId, setAssessmentEvidenceId] = useState("");
  const [assessmentConsent, setAssessmentConsent] = useState(false);
  const [reviewEditingPacketId, setReviewEditingPacketId] = useState("");
  const [reviewApplicationId, setReviewApplicationId] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewProofGap, setReviewProofGap] = useState("");
  const [reviewInterviewFocus, setReviewInterviewFocus] = useState("");
  const [reviewTeamQuestion, setReviewTeamQuestion] = useState("");
  const [reviewRoleConfidence, setReviewRoleConfidence] = useState<
    Record<string, string>
  >({});
  const [reviewRoleEvidence, setReviewRoleEvidence] = useState<
    Record<string, string>
  >({});
  const [reviewOutcomeEvidence, setReviewOutcomeEvidence] = useState<
    Record<string, string>
  >({});
  const [reviewNextType, setReviewNextType] = useState("work_sample");
  const [reviewNextTitle, setReviewNextTitle] = useState("");
  const [reviewNextQuestion, setReviewNextQuestion] = useState("");
  const [reviewNextExpected, setReviewNextExpected] = useState("");
  const [reviewNextBurden, setReviewNextBurden] = useState("");
  const [reviewNextRationale, setReviewNextRationale] = useState("");
  const [reviewNextConsent, setReviewNextConsent] = useState(false);
  const [reviewDecision, setReviewDecision] = useState("collect_more_evidence");
  const [reviewRationale, setReviewRationale] = useState("");
  const [trialApplicationId, setTrialApplicationId] = useState("");
  const [trialSeatId, setTrialSeatId] = useState("");
  const [trialTitle, setTrialTitle] = useState("");
  const [trialQuestion, setTrialQuestion] = useState("");
  const [trialDuration, setTrialDuration] = useState("5");
  const [trialCompensation, setTrialCompensation] = useState("");
  const [trialCurrency, setTrialCurrency] = useState("USD");
  const [trialTerms, setTrialTerms] = useState("");
  const [trialAgreement, setTrialAgreement] = useState("");
  const [trialJurisdiction, setTrialJurisdiction] = useState("");
  const [trialSupport, setTrialSupport] = useState("");
  const [trialOutput, setTrialOutput] = useState("");
  const [trialDimension, setTrialDimension] = useState("");
  const [trialSuccessAnchor, setTrialSuccessAnchor] = useState("");
  const [trialConstraint, setTrialConstraint] = useState("");
  const [trialObservationPoint, setTrialObservationPoint] = useState("");
  const [trialReviewAt, setTrialReviewAt] = useState("");
  const [trialPass, setTrialPass] = useState("");
  const [trialRedirect, setTrialRedirect] = useState("");
  const [trialExtend, setTrialExtend] = useState("");
  const [trialFail, setTrialFail] = useState("");
  const [trialPrediction, setTrialPrediction] = useState("");
  const [trialConfidence, setTrialConfidence] = useState("insufficient");
  const [trialInstructions, setTrialInstructions] = useState("");
  const [trialObservationRating, setTrialObservationRating] = useState("meets");
  const [trialObservationNotes, setTrialObservationNotes] = useState("");
  const [trialOutcomeEvidenceId, setTrialOutcomeEvidenceId] = useState("");
  const [trialActualOutcome, setTrialActualOutcome] = useState("");
  const [trialReviewerRationale, setTrialReviewerRationale] = useState("");
  const [trialCandidateFeedback, setTrialCandidateFeedback] = useState("");
  const [trialLearningProposal, setTrialLearningProposal] = useState("");
  const [trialLearningRationale, setTrialLearningRationale] = useState("");
  const [placementApplicationId, setPlacementApplicationId] = useState("");
  const [placementSeatId, setPlacementSeatId] = useState("");
  const [placementRationale, setPlacementRationale] = useState("");
  const [placementOffer, setPlacementOffer] = useState("");
  const [placementOnboarding, setPlacementOnboarding] = useState("");
  const [placementAccess, setPlacementAccess] = useState("");
  const [placementEvidenceId, setPlacementEvidenceId] = useState("");
  const [placementInviteEmail, setPlacementInviteEmail] = useState("");
  const [scheduleApplicationId, setScheduleApplicationId] = useState("");
  const [scheduleKind, setScheduleKind] = useState("interview");
  const [scheduleDuration, setScheduleDuration] = useState("45");
  const [scheduleSlotOne, setScheduleSlotOne] = useState("");
  const [scheduleSlotTwo, setScheduleSlotTwo] = useState("");
  const [scheduleUrl, setScheduleUrl] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleProviderPacketId, setScheduleProviderPacketId] = useState("");
  const mutate = (
    action: string,
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
  ) =>
    requestJson<JsonRecord>(method, `${root}${path}`, body).then(
      async (result) => {
        await refetch();
        toast({
          title: action,
          description:
            "The talent graph and attributable audit trail were updated.",
        });
        return result;
      },
    );
  const needCreate = useMutation({
    mutationFn: () =>
      mutate("Capability gap recorded", "POST", "/talent-needs", {
        title: needTitle.trim(),
        targetSeatId: needSeatId || undefined,
        urgency: needUrgency,
        rationale: needRationale.trim(),
        requiredOutcomes: [needOutcome.trim()],
        requiredNow: ["urgent", "critical"].includes(needUrgency),
        evidenceIds: needEvidenceId ? [needEvidenceId] : [],
        classification: "confidential",
      }),
    onSuccess: () => {
      setNeedTitle("");
      setNeedRationale("");
      setNeedOutcome("");
    },
    onError: (failure) => showError("Talent need", failure),
  });
  const needUpdate = useMutation({
    mutationFn: ({ id, state: next }: { id: string; state: string }) =>
      mutate("Talent need advanced", "PATCH", `/talent-needs/${id}`, {
        state: next,
      }),
    onError: (failure) => showError("Talent need lifecycle", failure),
  });
  const applicationCreate = useMutation({
    mutationFn: () => {
      const need = needs.find(
        (item: JsonRecord) => item.id === candidateNeedId,
      );
      return mutate("Candidate entered", "POST", "/talent-applications", {
        candidateName: candidateName.trim(),
        identityReference: candidateIdentity.trim(),
        consentLegalBasis:
          "Candidate-provided identity for this recruiting process",
        talentNeedId: candidateNeedId,
        targetSeatId: need?.targetSeatId || undefined,
        candidateSummary: candidateSummary.trim(),
        consentState: "pending",
        consentScope: [],
        roleHypotheses: candidateHypothesis.trim()
          ? [candidateHypothesis.trim()]
          : [],
        proofGaps: [],
        internalNotes: "",
        evidenceIds: candidateEvidenceId ? [candidateEvidenceId] : [],
        classification: "confidential",
      });
    },
    onSuccess: () => {
      setCandidateName("");
      setCandidateIdentity("");
      setCandidateSummary("");
      setCandidateHypothesis("");
    },
    onError: (failure) => showError("Candidate intake", failure),
  });
  const applicationUpdate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: JsonRecord }) =>
      mutate(
        "Candidate lifecycle advanced",
        "PATCH",
        `/talent-applications/${id}`,
        body,
      ),
    onError: (failure) => showError("Candidate lifecycle", failure),
  });
  const assessmentCreate = useMutation({
    mutationFn: () =>
      mutate("Assessment composed", "POST", "/talent-assessments", {
        applicationId: assessmentApplicationId,
        assessmentType,
        title: assessmentTitle.trim(),
        decisionQuestion: assessmentQuestion.trim(),
        evidenceExpected: assessmentExpected.trim(),
        validityScope: "This role hypothesis and company stage only",
        candidateBurden: assessmentBurden.trim(),
        consentRequired: assessmentConsent,
        consentCaptured: assessmentConsent,
        evidenceIds: assessmentEvidenceId ? [assessmentEvidenceId] : [],
        classification: "confidential",
      }),
    onSuccess: () => {
      setAssessmentTitle("");
      setAssessmentQuestion("");
      setAssessmentExpected("");
      setAssessmentBurden("");
    },
    onError: (failure) => showError("Talent assessment", failure),
  });
  const assessmentUpdate = useMutation({
    mutationFn: ({ id, state: next }: { id: string; state: string }) =>
      mutate("Assessment advanced", "PATCH", `/talent-assessments/${id}`, {
        state: next,
      }),
    onError: (failure) => showError("Assessment lifecycle", failure),
  });
  const selectedReviewApplication = applications.find(
    (item: JsonRecord) => item.id === reviewApplicationId,
  );
  const selectedReviewNeed = needs.find(
    (item: JsonRecord) => item.id === selectedReviewApplication?.talentNeedId,
  );
  const selectedReviewRoles = Array.isArray(
    selectedReviewApplication?.roleHypotheses,
  )
    ? selectedReviewApplication.roleHypotheses.map(String)
    : [];
  const selectedReviewOutcomes = Array.isArray(
    selectedReviewNeed?.requiredOutcomes,
  )
    ? selectedReviewNeed.requiredOutcomes.map(String)
    : [];
  const reviewPacketBody = () => ({
    ...(!reviewEditingPacketId ? { applicationId: reviewApplicationId } : {}),
    packetSummary: reviewSummary.trim(),
    roleAssessments: selectedReviewRoles.map((role: string) => ({
      roleHypothesis: role,
      confidence: reviewRoleConfidence[role] || "insufficient",
      evidenceForIds: reviewRoleEvidence[role]
        ? [reviewRoleEvidence[role]]
        : [],
      evidenceAgainstIds: [],
      unresolvedQuestions: reviewProofGap.trim() ? [reviewProofGap.trim()] : [],
    })),
    outcomeCoverage: selectedReviewOutcomes.map((outcome: string) => ({
      outcome,
      evidenceIds: reviewOutcomeEvidence[outcome]
        ? [reviewOutcomeEvidence[outcome]]
        : [],
    })),
    proofGaps: reviewProofGap.trim() ? [reviewProofGap.trim()] : [],
    nextAssessment:
      reviewNextTitle.trim() &&
      reviewNextQuestion.trim() &&
      reviewNextExpected.trim() &&
      reviewNextRationale.trim()
        ? {
            assessmentType: reviewNextType,
            title: reviewNextTitle.trim(),
            decisionQuestion: reviewNextQuestion.trim(),
            evidenceExpected: reviewNextExpected.trim(),
            candidateBurden: reviewNextBurden.trim(),
            rationale: reviewNextRationale.trim(),
            consentRequired: reviewNextConsent,
          }
        : null,
    interviewFocus: reviewInterviewFocus.trim()
      ? [reviewInterviewFocus.trim()]
      : [],
    teamFitQuestions: reviewTeamQuestion.trim()
      ? [reviewTeamQuestion.trim()]
      : [],
    classification: "restricted",
  });
  const reviewPacketSave = useMutation({
    mutationFn: () =>
      mutate(
        reviewEditingPacketId
          ? "Human review packet updated"
          : "Human review packet opened",
        reviewEditingPacketId ? "PATCH" : "POST",
        reviewEditingPacketId
          ? `/talent-review-packets/${reviewEditingPacketId}`
          : "/talent-review-packets",
        reviewPacketBody(),
      ),
    onSuccess: () => {
      setReviewEditingPacketId("");
      setReviewSummary("");
      setReviewProofGap("");
      setReviewInterviewFocus("");
      setReviewTeamQuestion("");
      setReviewNextTitle("");
      setReviewNextQuestion("");
      setReviewNextExpected("");
      setReviewNextBurden("");
      setReviewNextRationale("");
      setReviewRoleConfidence({});
      setReviewRoleEvidence({});
      setReviewOutcomeEvidence({});
    },
    onError: (failure) => showError("Human review packet", failure),
  });
  const reviewPacketUpdate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: JsonRecord }) =>
      mutate(
        "Human review packet advanced",
        "PATCH",
        `/talent-review-packets/${id}`,
        body,
      ),
    onError: (failure) => showError("Human review lifecycle", failure),
  });
  const reviewPacketRefresh = useMutation({
    mutationFn: (id: string) =>
      mutate(
        "Evidence snapshot refreshed",
        "POST",
        `/talent-review-packets/${id}/refresh`,
        {},
      ),
    onError: (failure) => showError("Review packet refresh", failure),
  });
  const reviewPacketMaterialize = useMutation({
    mutationFn: (id: string) =>
      mutate(
        "Next assessment planned",
        "POST",
        `/talent-review-packets/${id}/materialize-next-assessment`,
        {},
      ),
    onError: (failure) => showError("Next assessment", failure),
  });
  const trialCreate = useMutation({
    mutationFn: () =>
      mutate("Governed paid trial proposed", "POST", "/talent-trials", {
        applicationId: trialApplicationId,
        targetSeatId: trialSeatId,
        title: trialTitle.trim(),
        question: trialQuestion.trim(),
        durationDays: Number(trialDuration),
        compensationAmountMinor: Math.round(Number(trialCompensation) * 100),
        compensationCurrency: trialCurrency.trim().toUpperCase(),
        compensationTerms: trialTerms.trim(),
        legalAgreementReference: trialAgreement.trim(),
        jurisdiction: trialJurisdiction.trim(),
        inputsSupport: [trialSupport.trim()],
        requiredOutputs: [trialOutput.trim()],
        scorecard: [
          {
            dimension: trialDimension.trim(),
            successAnchor: trialSuccessAnchor.trim(),
            weight: 100,
          },
        ],
        constraintsDecisionRights: [trialConstraint.trim()],
        observationPoints: [trialObservationPoint.trim()],
        reviewAt: new Date(trialReviewAt).toISOString(),
        outcomeCriteria: {
          pass: trialPass.trim(),
          redirect: trialRedirect.trim(),
          extend: trialExtend.trim(),
          fail: trialFail.trim(),
        },
        predictedOutcome: trialPrediction.trim(),
        predictedConfidence: trialConfidence,
        candidateInstructions: trialInstructions.trim(),
        classification: "restricted",
      }),
    onSuccess: () => {
      setTrialTitle("");
      setTrialQuestion("");
      setTrialCompensation("");
      setTrialSupport("");
      setTrialOutput("");
      setTrialDimension("");
      setTrialSuccessAnchor("");
      setTrialObservationPoint("");
      setTrialPrediction("");
      setTrialInstructions("");
    },
    onError: (failure) => showError("Paid trial", failure),
  });
  const trialUpdate = useMutation({
    mutationFn: ({ id, state: next }: { id: string; state: string }) => {
      const trial = trials.find((item: JsonRecord) => item.id === id);
      const outcome = ["passed", "redirected", "extended", "failed"].includes(
        next,
      );
      return mutate("Trial lifecycle advanced", "PATCH", `/talent-trials/${id}`, {
        state: next,
        ...(outcome
          ? {
              scorecardObservations: (trial?.scorecard || []).map(
                (item: JsonRecord) => ({
                  dimension: item.dimension,
                  rating: trialObservationRating,
                  evidenceIds: trialOutcomeEvidenceId
                    ? [trialOutcomeEvidenceId]
                    : [],
                  notes: trialObservationNotes.trim(),
                }),
              ),
              outcomeEvidenceIds: trialOutcomeEvidenceId
                ? [trialOutcomeEvidenceId]
                : [],
              actualOutcomeSummary: trialActualOutcome.trim(),
              reviewerRationale: trialReviewerRationale.trim(),
              candidateFeedback: trialCandidateFeedback.trim(),
              learningProposal: trialLearningProposal.trim(),
            }
          : {}),
      });
    },
    onError: (failure) => showError("Paid trial lifecycle", failure),
  });
  const trialLearningDecision = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      mutate(
        "Trial learning reviewed",
        "POST",
        `/talent-trials/${id}/learning-decision`,
        { decision, rationale: trialLearningRationale.trim() },
      ),
    onError: (failure) => showError("Trial learning", failure),
  });
  const placementCreate = useMutation({
    mutationFn: () =>
      mutate("Placement decision opened", "POST", "/talent-placements", {
        applicationId: placementApplicationId,
        targetSeatId: placementSeatId,
        rationale: placementRationale.trim(),
        offerSummary: placementOffer.trim(),
        onboardingChecklist: placementOnboarding.trim()
          ? [placementOnboarding.trim()]
          : [],
        accessPlan: placementAccess.trim() ? [placementAccess.trim()] : [],
        evidenceIds: placementEvidenceId ? [placementEvidenceId] : [],
        classification: "restricted",
      }),
    onSuccess: () => {
      setPlacementRationale("");
      setPlacementOffer("");
    },
    onError: (failure) => showError("Talent placement", failure),
  });
  const placementUpdate = useMutation({
    mutationFn: ({ id, state: next }: { id: string; state: string }) =>
      mutate("Placement advanced", "PATCH", `/talent-placements/${id}`, {
        state: next,
      }),
    onError: (failure) => showError("Placement lifecycle", failure),
  });
  const talentOnboardingInvite = useMutation({
    mutationFn: ({ applicationId, seatId }: { applicationId: string; seatId: string }) =>
      mutate("Onboarding invitation sent", "POST", "/invitations", {
        email: placementInviteEmail.trim(),
        seatId,
        talentApplicationId: applicationId,
        purpose: "talent_onboarding",
        classificationCeiling: "internal",
        portfolioScope: false,
      }),
    onSuccess: () => setPlacementInviteEmail(""),
    onError: (failure) => showError("Candidate onboarding", failure),
  });
  const schedulingCreate = useMutation({
    mutationFn: () =>
      mutate("Candidate times proposed", "POST", "/talent-scheduling", {
        applicationId: scheduleApplicationId,
        schedulingKind: scheduleKind,
        durationMinutes: Number(scheduleDuration),
        proposedSlots: [scheduleSlotOne, scheduleSlotTwo]
          .filter(Boolean)
          .map((value) => new Date(value).toISOString()),
        schedulingUrl: scheduleUrl.trim(),
        teamNote: scheduleNote.trim(),
        sourceSystem: scheduleUrl.trim() ? "external_scheduling" : "native_eos",
      }),
    onSuccess: () => {
      setScheduleSlotOne("");
      setScheduleSlotTwo("");
      setScheduleUrl("");
      setScheduleNote("");
    },
    onError: (failure) => showError("Candidate scheduling", failure),
  });
  const schedulingUpdate = useMutation({
    mutationFn: ({ id, state: next }: { id: string; state: string }) =>
      mutate(
        "Candidate scheduling updated",
        "PATCH",
        `/talent-scheduling/${id}`,
        { state: next },
      ),
    onError: (failure) => showError("Candidate scheduling", failure),
  });
  const schedulingBook = useMutation({
    mutationFn: (schedulingId: string) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/work-packets/${scheduleProviderPacketId || workPackets[0]?.id}/provider-executions`,
        {
          provider: "google_workspace",
          operation:
            "google.calendar.create_candidate_event_with_local_approval",
          schedulingId,
        },
      ),
    onSuccess: async () => {
      await refetch();
      toast({
        title: "Calendar booking awaiting approval",
        description:
          "Google Calendar will create the event and invite the candidate only after local approval.",
      });
    },
    onError: (failure) => showError("Calendar booking", failure),
  });
  const schedulingCancelProvider = useMutation({
    mutationFn: (schedulingId: string) =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/work-packets/${scheduleProviderPacketId || workPackets[0]?.id}/provider-executions`,
        {
          provider: "google_workspace",
          operation:
            "google.calendar.cancel_candidate_event_with_local_approval",
          schedulingId,
        },
      ),
    onSuccess: async () => {
      await refetch();
      toast({
        title: "Calendar cancellation awaiting approval",
        description:
          "The provider event will remain active until a local approver authorizes cancellation.",
      });
    },
    onError: (failure) => showError("Calendar cancellation", failure),
  });
  const candidateNameFor = (application: JsonRecord) =>
    candidates.find(
      (candidate: JsonRecord) =>
        candidate.id === application.candidateStakeholderId,
    )?.name || "Candidate";
  if (loading)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading the governed talent graph…
        </CardContent>
      </Card>
    );
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Talent registry unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          The recruiting control state could not be loaded.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          label="Open capability gaps"
          value={String(state?.counts?.openNeeds || 0)}
        />
        <Fact
          label="Active candidates"
          value={String(state?.counts?.activeCandidates || 0)}
        />
        <Fact
          label="Decisions due"
          value={String(state?.counts?.decisionsDue || 0)}
        />
        <Fact
          label="Onboarding"
          value={String(state?.counts?.onboarding || 0)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Institutional need graph</CardTitle>
          <CardDescription>
            Recruiting starts with missing capability and accountable
            outcomes—not a person, title, or hiring quota.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              aria-label="Talent need title"
              value={needTitle}
              onChange={(event) => setNeedTitle(event.target.value)}
              placeholder="Capability gap or role hypothesis"
            />
            <select
              aria-label="Talent need target seat"
              value={needSeatId}
              onChange={(event) => setNeedSeatId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No instantiated seat yet</option>
              {seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Talent need urgency"
              value={needUrgency}
              onChange={(event) => setNeedUrgency(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="planned">Planned</option>
              <option value="soon">Soon</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
            <EvidenceSelect
              label="Talent need evidence"
              value={needEvidenceId}
              onChange={setNeedEvidenceId}
              evidence={verifiedEvidence}
            />
            <Textarea
              aria-label="Talent need rationale"
              value={needRationale}
              onChange={(event) => setNeedRationale(event.target.value)}
              placeholder="Why the institution needs this capability now"
            />
            <Textarea
              aria-label="Talent need outcome"
              value={needOutcome}
              onChange={(event) => setNeedOutcome(event.target.value)}
              placeholder="Observable result this role must own"
            />
            <Button
              className="lg:col-span-2"
              disabled={
                !effectiveClasses.has("decide") ||
                needCreate.isPending ||
                needTitle.trim().length < 2 ||
                needRationale.trim().length < 3 ||
                needOutcome.trim().length < 2
              }
              onClick={() => needCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Record capability gap
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {needs.map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{item.title}</span>
                  <StateBadge state={item.state} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.rationale}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.urgency} · {(item.requiredOutcomes || []).join(" · ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextTalentNeedStates(item.state).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      disabled={
                        needUpdate.isPending ||
                        !effectiveClasses.has(
                          ["open", "filled"].includes(next)
                            ? "approve"
                            : "decide",
                        )
                      }
                      onClick={() =>
                        needUpdate.mutate({ id: item.id, state: next })
                      }
                    >
                      {next}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Candidate pipeline</CardTitle>
          <CardDescription>
            One canonical person identity can be considered for multiple roles
            without duplicating the person or granting a seat prematurely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              aria-label="Candidate name"
              value={candidateName}
              onChange={(event) => setCandidateName(event.target.value)}
              placeholder="Candidate name"
            />
            <Input
              aria-label="Candidate identity reference"
              value={candidateIdentity}
              onChange={(event) => setCandidateIdentity(event.target.value)}
              placeholder="Candidate-provided email or stable identity reference"
            />
            <select
              aria-label="Candidate talent need"
              value={candidateNeedId}
              onChange={(event) => setCandidateNeedId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose validated/open need</option>
              {needs
                .filter((item: JsonRecord) =>
                  ["validated", "open"].includes(item.state),
                )
                .map((item: JsonRecord) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
            <EvidenceSelect
              label="Candidate evidence"
              value={candidateEvidenceId}
              onChange={setCandidateEvidenceId}
              evidence={verifiedEvidence}
            />
            <Textarea
              aria-label="Candidate summary"
              value={candidateSummary}
              onChange={(event) => setCandidateSummary(event.target.value)}
              placeholder="Candidate-visible factual summary"
            />
            <Textarea
              aria-label="Candidate role hypothesis"
              value={candidateHypothesis}
              onChange={(event) => setCandidateHypothesis(event.target.value)}
              placeholder="Explainable role-fit hypothesis, not an opaque score"
            />
            <Button
              className="lg:col-span-2"
              disabled={
                !effectiveClasses.has("execute") ||
                applicationCreate.isPending ||
                candidateName.trim().length < 2 ||
                candidateIdentity.trim().length < 3 ||
                !candidateNeedId
              }
              onClick={() => applicationCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Enter candidate once
            </Button>
          </div>
          <div className="space-y-3">
            {applications.map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{candidateNameFor(item)}</p>
                    <p className="text-xs text-muted-foreground">
                      {needs.find(
                        (need: JsonRecord) => need.id === item.talentNeedId,
                      )?.title || "Need unavailable"}
                    </p>
                  </div>
                  <StateBadge state={item.state} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.candidateSummary || "Intake summary pending."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextTalentApplicationStates(item.state).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      disabled={
                        applicationUpdate.isPending ||
                        !effectiveClasses.has(
                          [
                            "decision",
                            "onboarding",
                            "activated",
                            "rejected",
                          ].includes(next)
                            ? "approve"
                            : "decide",
                        )
                      }
                      onClick={() =>
                        applicationUpdate.mutate({
                          id: item.id,
                          body: {
                            state: next,
                            ...(next === "intake_submitted"
                              ? {
                                  consentState: "granted",
                                  consentScope: [
                                    "application",
                                    "job-relevant assessment",
                                    "placement review",
                                  ],
                                }
                              : {}),
                          },
                        })
                      }
                    >
                      {next.replaceAll("_", " ")}
                    </Button>
                  ))}
                </div>
                <CandidatePortalLinkControls
                  root={root}
                  application={item}
                  messages={candidateMessages.filter(
                    (message: JsonRecord) => message.applicationId === item.id,
                  )}
                  workPackets={workPackets}
                  canExecute={effectiveClasses.has("execute")}
                  refetch={refetch}
                  showError={showError}
                />
                <CandidateFileEvidenceReview
                  root={root}
                  evidence={candidateEvidence.filter(
                    (record: JsonRecord) => record.applicationId === item.id,
                  )}
                  workPackets={workPackets}
                  canExecute={effectiveClasses.has("execute")}
                  canApprove={effectiveClasses.has("approve")}
                  refetch={refetch}
                  showError={showError}
                />
                {item.correctionStatus === "requested" && (
                  <p className="mt-3 text-sm text-amber-700">
                    Candidate correction requested: {item.candidateCorrection}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Candidate scheduling</CardTitle>
          <CardDescription>
            Propose concrete times in EOS and let the candidate accept, decline,
            or request alternatives. Once accepted, submit an approved Google
            Calendar booking; EOS marks it confirmed only after the provider
            event is reconciled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <select
              aria-label="Scheduling candidate"
              value={scheduleApplicationId}
              onChange={(event) => setScheduleApplicationId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose candidate</option>
              {applications
                .filter(
                  (item: JsonRecord) =>
                    !["activated", "rejected", "withdrawn"].includes(
                      item.state,
                    ),
                )
                .map((item: JsonRecord) => (
                  <option key={item.id} value={item.id}>
                    {candidateNameFor(item)}
                  </option>
                ))}
            </select>
            <select
              aria-label="Scheduling kind"
              value={scheduleKind}
              onChange={(event) => setScheduleKind(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="intro">Introduction</option>
              <option value="interview">Interview</option>
              <option value="work_sample">Work sample</option>
              <option value="trial">Trial</option>
              <option value="decision_conversation">
                Decision conversation
              </option>
            </select>
            <select
              aria-label="Scheduling duration"
              value={scheduleDuration}
              onChange={(event) => setScheduleDuration(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
            <select
              aria-label="Calendar booking work packet"
              value={scheduleProviderPacketId || workPackets[0]?.id || ""}
              onChange={(event) =>
                setScheduleProviderPacketId(event.target.value)
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose governed Work Packet</option>
              {workPackets.map((packet) => (
                <option key={packet.id} value={packet.id}>
                  {packet.title}
                </option>
              ))}
            </select>
            <Input
              type="datetime-local"
              aria-label="First proposed time"
              value={scheduleSlotOne}
              onChange={(event) => setScheduleSlotOne(event.target.value)}
            />
            <Input
              type="datetime-local"
              aria-label="Second proposed time"
              value={scheduleSlotTwo}
              onChange={(event) => setScheduleSlotTwo(event.target.value)}
            />
            <Input
              aria-label="External scheduling URL"
              value={scheduleUrl}
              onChange={(event) => setScheduleUrl(event.target.value)}
              placeholder="Optional https:// scheduling link"
            />
            <Input
              aria-label="Candidate-visible scheduling note"
              value={scheduleNote}
              onChange={(event) => setScheduleNote(event.target.value)}
              placeholder="Candidate-visible context"
            />
            <Button
              className="lg:col-span-2"
              disabled={
                !effectiveClasses.has("execute") ||
                schedulingCreate.isPending ||
                !scheduleApplicationId ||
                !scheduleSlotOne
              }
              onClick={() => schedulingCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Propose times
            </Button>
          </div>
          <div className="space-y-2">
            {scheduling.map((item: JsonRecord) => {
              const application = applications.find(
                (candidate: JsonRecord) => candidate.id === item.applicationId,
              );
              const calendarConfirmed =
                item.sourceSystem === "google_calendar" &&
                Boolean(item.externalEventReference) &&
                item.state !== "cancelled";
              return (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {candidateNameFor(application || {})} ·{" "}
                        {String(item.schedulingKind).replaceAll("_", " ")} ·{" "}
                        {item.durationMinutes || 45} minutes
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(item.proposedSlots || [])
                          .map((slot: string) =>
                            new Date(slot).toLocaleString(),
                          )
                          .join(" · ")}
                      </p>
                    </div>
                    <StateBadge
                      state={
                        calendarConfirmed ? "calendar_confirmed" : item.state
                      }
                    />
                  </div>
                  {item.candidateAvailability && (
                    <p className="mt-2 text-sm">
                      Alternative availability: {item.candidateAvailability} (
                      {item.candidateTimezone})
                    </p>
                  )}
                  {item.selectedSlot && (
                    <p className="mt-2 text-sm text-emerald-700">
                      Accepted: {new Date(item.selectedSlot).toLocaleString()} ·{" "}
                      {calendarConfirmed
                        ? "Google Calendar event reconciled."
                        : item.state === "cancelled"
                          ? "Provider cancellation reconciled."
                          : "Provider booking still requires approval."}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!["cancelled", "completed"].includes(item.state) &&
                      !calendarConfirmed && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={schedulingUpdate.isPending}
                          onClick={() =>
                            schedulingUpdate.mutate({
                              id: item.id,
                              state: "cancelled",
                            })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    {item.state === "accepted" && calendarConfirmed && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !effectiveClasses.has("execute") ||
                          (!scheduleProviderPacketId && !workPackets[0]?.id) ||
                          schedulingCancelProvider.isPending
                        }
                        onClick={() => schedulingCancelProvider.mutate(item.id)}
                      >
                        Cancel calendar event
                      </Button>
                    )}
                    {item.state === "accepted" && !calendarConfirmed && (
                      <Button
                        size="sm"
                        disabled={
                          !effectiveClasses.has("execute") ||
                          (!scheduleProviderPacketId && !workPackets[0]?.id) ||
                          schedulingBook.isPending
                        }
                        onClick={() => schedulingBook.mutate(item.id)}
                      >
                        <Plug className="mr-2 h-3.5 w-3.5" />
                        Book with Google Calendar
                      </Button>
                    )}
                    {item.state === "accepted" && calendarConfirmed && (
                      <Button
                        size="sm"
                        disabled={
                          !effectiveClasses.has("decide") ||
                          schedulingUpdate.isPending
                        }
                        onClick={() =>
                          schedulingUpdate.mutate({
                            id: item.id,
                            state: "completed",
                          })
                        }
                      >
                        Mark completed
                      </Button>
                    )}
                    {calendarConfirmed && item.schedulingUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            item.schedulingUrl,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Open event
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Minimum sufficient assessment</CardTitle>
            <CardDescription>
              Every assessment declares the decision question, expected
              evidence, validity scope, burden, and consent boundary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              aria-label="Assessment candidate"
              value={assessmentApplicationId}
              onChange={(event) =>
                setAssessmentApplicationId(event.target.value)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose candidate</option>
              {applications
                .filter(
                  (item: JsonRecord) =>
                    !["activated", "rejected", "withdrawn"].includes(
                      item.state,
                    ),
                )
                .map((item: JsonRecord) => (
                  <option key={item.id} value={item.id}>
                    {candidateNameFor(item)}
                  </option>
                ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Assessment title"
                value={assessmentTitle}
                onChange={(event) => setAssessmentTitle(event.target.value)}
                placeholder="Role-specific work sample"
              />
              <select
                aria-label="Assessment type"
                value={assessmentType}
                onChange={(event) => setAssessmentType(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="evidence_review">Evidence review</option>
                <option value="structured_interview">
                  Structured interview
                </option>
                <option value="work_sample">Work sample</option>
                <option value="simulation">Simulation</option>
                <option value="reference">Reference</option>
                <option value="skills_test">Skills test</option>
                <option value="paid_trial">Paid trial</option>
                <option value="consented_contextual">
                  Consented contextual assessment
                </option>
              </select>
            </div>
            <Textarea
              aria-label="Assessment decision question"
              value={assessmentQuestion}
              onChange={(event) => setAssessmentQuestion(event.target.value)}
              placeholder="What uncertainty will this resolve?"
            />
            <Textarea
              aria-label="Assessment evidence expected"
              value={assessmentExpected}
              onChange={(event) => setAssessmentExpected(event.target.value)}
              placeholder="What evidence would answer it?"
            />
            <Input
              aria-label="Assessment candidate burden"
              value={assessmentBurden}
              onChange={(event) => setAssessmentBurden(event.target.value)}
              placeholder="Time and effort expected"
            />
            <EvidenceSelect
              label="Assessment evidence"
              value={assessmentEvidenceId}
              onChange={setAssessmentEvidenceId}
              evidence={verifiedEvidence}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assessmentConsent}
                onChange={(event) => setAssessmentConsent(event.target.checked)}
              />
              Consent-sensitive assessment; consent captured
            </label>
            <Button
              className="w-full"
              disabled={
                !effectiveClasses.has("execute") ||
                assessmentCreate.isPending ||
                !assessmentApplicationId ||
                assessmentTitle.trim().length < 2 ||
                assessmentQuestion.trim().length < 3 ||
                assessmentExpected.trim().length < 3
              }
              onClick={() => assessmentCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Compose assessment
            </Button>
            <div className="space-y-2">
              {assessments.map((item: JsonRecord) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.generationMode !== "manual" && (
                        <Badge variant="secondary">
                          {item.generationMode === "ai" ? "AI" : "Fallback"}
                          {item.generatedSequence
                            ? ` adaptive #${item.generatedSequence}`
                            : " adaptive"}
                        </Badge>
                      )}
                    </div>
                    <StateBadge state={item.state} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.decisionQuestion}
                  </p>
                  {item.generationMode !== "manual" && (
                    <div className="mt-2 space-y-1 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                      {item.informationGap && (
                        <p>
                          <span className="font-medium text-foreground">
                            Evidence gap:
                          </span>{" "}
                          {item.informationGap}
                        </p>
                      )}
                      {Array.isArray(item.roleHypothesesSnapshot) &&
                        item.roleHypothesesSnapshot.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.roleHypothesesSnapshot.map(
                              (role: unknown) => (
                                <Badge key={String(role)} variant="outline">
                                  {String(role)}
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                      <p>
                        Provenance: {String(item.generationMode)}
                        {item.generationModel
                          ? ` · ${String(item.generationModel)}`
                          : ""}
                        {item.generationGovernanceVersion
                          ? ` · ${String(item.generationGovernanceVersion)}`
                          : ""}
                      </p>
                      <p>
                        AI collected and organized evidence only. A human must
                        make every consequential decision.
                      </p>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextTalentAssessmentStates(item.state).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={
                          assessmentUpdate.isPending ||
                          !effectiveClasses.has(
                            next === "reviewed" ? "approve" : "decide",
                          )
                        }
                        onClick={() =>
                          assessmentUpdate.mutate({ id: item.id, state: next })
                        }
                      >
                        {next.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Human review packet</CardTitle>
            <CardDescription>
              Organize person, role, stage, team, assessment, and verified
              evidence context for an attributable human sign-off. This packet
              never changes application state by itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              aria-label="Review packet candidate"
              value={reviewApplicationId}
              disabled={Boolean(reviewEditingPacketId)}
              onChange={(event) => {
                setReviewApplicationId(event.target.value);
                setReviewRoleConfidence({});
                setReviewRoleEvidence({});
                setReviewOutcomeEvidence({});
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose candidate</option>
              {applications
                .filter(
                  (item: JsonRecord) =>
                    !["activated", "rejected", "withdrawn"].includes(
                      item.state,
                    ),
                )
                .map((item: JsonRecord) => (
                  <option key={item.id} value={item.id}>
                    {candidateNameFor(item)} ·{" "}
                    {String(item.state).replaceAll("_", " ")}
                  </option>
                ))}
            </select>
            {reviewApplicationId && selectedReviewRoles.length === 0 && (
              <Alert variant="destructive">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Role hypothesis required</AlertTitle>
                <AlertDescription>
                  Add at least one plausible role to the candidate record before
                  opening a review packet.
                </AlertDescription>
              </Alert>
            )}
            {selectedReviewRoles.map((role: string) => (
              <div key={role} className="rounded-xl border p-3">
                <p className="text-sm font-semibold">{role}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    aria-label={role + " fit confidence"}
                    value={reviewRoleConfidence[role] || "insufficient"}
                    onChange={(event) =>
                      setReviewRoleConfidence((current) => ({
                        ...current,
                        [role]: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="insufficient">Insufficient evidence</option>
                    <option value="emerging">Emerging evidence</option>
                    <option value="supported">Supported by evidence</option>
                    <option value="contradicted">
                      Contradicted by evidence
                    </option>
                  </select>
                  <EvidenceSelect
                    label={role + " verified evidence"}
                    value={reviewRoleEvidence[role] || ""}
                    onChange={(value) =>
                      setReviewRoleEvidence((current) => ({
                        ...current,
                        [role]: value,
                      }))
                    }
                    evidence={verifiedEvidence}
                  />
                </div>
              </div>
            ))}
            {selectedReviewOutcomes.map((outcome: string) => (
              <div key={outcome} className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-medium">Required outcome</p>
                <p className="mt-1 text-sm">{outcome}</p>
                <div className="mt-2">
                  <EvidenceSelect
                    label="Verified outcome evidence"
                    value={reviewOutcomeEvidence[outcome] || ""}
                    onChange={(value) =>
                      setReviewOutcomeEvidence((current) => ({
                        ...current,
                        [outcome]: value,
                      }))
                    }
                    evidence={verifiedEvidence}
                  />
                </div>
              </div>
            ))}
            <Textarea
              aria-label="Human review summary"
              value={reviewSummary}
              onChange={(event) => setReviewSummary(event.target.value)}
              placeholder="Separate verified work evidence, self-report, uncertainty, and limits."
            />
            <Input
              aria-label="Unresolved proof gap"
              value={reviewProofGap}
              onChange={(event) => setReviewProofGap(event.target.value)}
              placeholder="Highest-value unresolved proof gap"
            />
            <Input
              aria-label="Human interview focus"
              value={reviewInterviewFocus}
              onChange={(event) => setReviewInterviewFocus(event.target.value)}
              placeholder="Relationship, trust, judgment, or ambiguity to explore"
            />
            <Input
              aria-label="Team fit question"
              value={reviewTeamQuestion}
              onChange={(event) => setReviewTeamQuestion(event.target.value)}
              placeholder="Human team-complementarity question; no hidden score"
            />
            <div className="rounded-xl border p-3">
              <p className="text-sm font-semibold">
                Smallest next assessment recommendation
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank only when no proof gap remains. Materializing it
                creates a planned assessment, not candidate action.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="Recommended assessment type"
                  value={reviewNextType}
                  onChange={(event) => setReviewNextType(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="evidence_review">Evidence review</option>
                  <option value="structured_interview">
                    Structured interview
                  </option>
                  <option value="work_sample">Work sample</option>
                  <option value="simulation">Simulation</option>
                  <option value="reference">Reference</option>
                  <option value="skills_test">Skills test</option>
                  <option value="paid_trial">Paid trial</option>
                  <option value="consented_contextual">
                    Consented contextual assessment
                  </option>
                </select>
                <Input
                  aria-label="Recommended assessment title"
                  value={reviewNextTitle}
                  onChange={(event) => setReviewNextTitle(event.target.value)}
                  placeholder="Bounded work sample"
                />
              </div>
              <Textarea
                className="mt-2"
                aria-label="Recommended assessment question"
                value={reviewNextQuestion}
                onChange={(event) => setReviewNextQuestion(event.target.value)}
                placeholder="What exact uncertainty should it resolve?"
              />
              <Textarea
                className="mt-2"
                aria-label="Recommended assessment evidence"
                value={reviewNextExpected}
                onChange={(event) => setReviewNextExpected(event.target.value)}
                placeholder="What observable evidence would answer it?"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="Recommended assessment burden"
                  value={reviewNextBurden}
                  onChange={(event) => setReviewNextBurden(event.target.value)}
                  placeholder="Expected candidate time and effort"
                />
                <Input
                  aria-label="Recommended assessment rationale"
                  value={reviewNextRationale}
                  onChange={(event) =>
                    setReviewNextRationale(event.target.value)
                  }
                  placeholder="Why this is the minimum sufficient test"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewNextConsent}
                  onChange={(event) =>
                    setReviewNextConsent(event.target.checked)
                  }
                />
                Recommended assessment requires separate candidate consent
              </label>
            </div>
            <Button
              className="w-full"
              disabled={
                !effectiveClasses.has("execute") ||
                reviewPacketSave.isPending ||
                !reviewApplicationId ||
                selectedReviewRoles.length === 0 ||
                reviewSummary.trim().length < 3
              }
              onClick={() => reviewPacketSave.mutate()}
            >
              <FileCheck2 className="mr-2 h-4 w-4" />
              {reviewEditingPacketId
                ? "Save review packet draft"
                : "Open review packet draft"}
            </Button>
            {reviewEditingPacketId && (
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setReviewEditingPacketId("")}
              >
                Cancel draft editing
              </Button>
            )}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold">Human sign-off</p>
              <div className="mt-2 grid gap-2">
                <select
                  aria-label="Human review recommendation"
                  value={reviewDecision}
                  onChange={(event) => setReviewDecision(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="collect_more_evidence">
                    Collect more evidence
                  </option>
                  <option value="interview_ready">Interview ready</option>
                  <option value="trial_recommended">Trial recommended</option>
                  <option value="decision_ready">Decision ready</option>
                  <option value="hold">Hold</option>
                  <option value="do_not_advance_recommendation">
                    Recommend not advancing
                  </option>
                </select>
                <Textarea
                  aria-label="Human reviewer rationale"
                  value={reviewRationale}
                  onChange={(event) => setReviewRationale(event.target.value)}
                  placeholder="Evidence-bound human rationale; application state remains unchanged."
                />
              </div>
            </div>
            <div className="space-y-3">
              {reviewPackets.map((item: JsonRecord) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {candidateNameFor(
                          applications.find(
                            (candidate: JsonRecord) =>
                              candidate.id === item.applicationId,
                          ) || {},
                        )}{" "}
                        · packet v{item.version}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stage: {String(item.stageSnapshot).replaceAll("_", " ")}{" "}
                        ·{" "}
                        {Array.isArray(item.verifiedEvidenceIds)
                          ? item.verifiedEvidenceIds.length
                          : 0}{" "}
                        verified evidence ·{" "}
                        {Array.isArray(item.assessmentIds)
                          ? item.assessmentIds.length
                          : 0}{" "}
                        assessments
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.sourceStale && (
                        <Badge variant="destructive">Snapshot stale</Badge>
                      )}
                      <StateBadge state={item.state} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{item.packetSummary}</p>
                  {Array.isArray(item.roleAssessments) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.roleAssessments.map((role: JsonRecord) => (
                        <Badge
                          key={String(role.roleHypothesis)}
                          variant="outline"
                        >
                          {String(role.roleHypothesis)} ·{" "}
                          {String(role.confidence).replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {Array.isArray(item.readinessIssues) &&
                    item.readinessIssues.length > 0 && (
                      <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                        Still required: {item.readinessIssues.join(" · ")}
                      </div>
                    )}
                  {item.nextAssessment && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Next assessment: {item.nextAssessment.title} ·{" "}
                      {item.nextAssessment.rationale}
                    </p>
                  )}
                  {item.reviewerDecision && (
                    <p className="mt-2 text-xs">
                      Human recommendation:{" "}
                      {String(item.reviewerDecision).replaceAll("_", " ")} ·{" "}
                      {item.reviewerRationale}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.state === "draft" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewPacketRefresh.isPending}
                          onClick={() => reviewPacketRefresh.mutate(item.id)}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Refresh evidence
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewEditingPacketId(item.id);
                            setReviewApplicationId(item.applicationId);
                            setReviewSummary(item.packetSummary || "");
                            setReviewProofGap(
                              Array.isArray(item.proofGaps)
                                ? item.proofGaps[0] || ""
                                : "",
                            );
                            setReviewInterviewFocus(
                              Array.isArray(item.interviewFocus)
                                ? item.interviewFocus[0] || ""
                                : "",
                            );
                            setReviewTeamQuestion(
                              Array.isArray(item.teamFitQuestions)
                                ? item.teamFitQuestions[0] || ""
                                : "",
                            );
                            setReviewRoleConfidence(
                              Object.fromEntries(
                                (item.roleAssessments || []).map(
                                  (role: JsonRecord) => [
                                    String(role.roleHypothesis),
                                    String(role.confidence),
                                  ],
                                ),
                              ),
                            );
                            setReviewRoleEvidence(
                              Object.fromEntries(
                                (item.roleAssessments || []).map(
                                  (role: JsonRecord) => [
                                    String(role.roleHypothesis),
                                    Array.isArray(role.evidenceForIds)
                                      ? role.evidenceForIds[0] || ""
                                      : "",
                                  ],
                                ),
                              ),
                            );
                            setReviewOutcomeEvidence(
                              Object.fromEntries(
                                (item.outcomeCoverage || []).map(
                                  (coverage: JsonRecord) => [
                                    String(coverage.outcome),
                                    Array.isArray(coverage.evidenceIds)
                                      ? coverage.evidenceIds[0] || ""
                                      : "",
                                  ],
                                ),
                              ),
                            );
                            if (item.nextAssessment) {
                              setReviewNextType(
                                item.nextAssessment.assessmentType,
                              );
                              setReviewNextTitle(item.nextAssessment.title);
                              setReviewNextQuestion(
                                item.nextAssessment.decisionQuestion,
                              );
                              setReviewNextExpected(
                                item.nextAssessment.evidenceExpected,
                              );
                              setReviewNextBurden(
                                item.nextAssessment.candidateBurden || "",
                              );
                              setReviewNextRationale(
                                item.nextAssessment.rationale,
                              );
                              setReviewNextConsent(
                                Boolean(item.nextAssessment.consentRequired),
                              );
                            } else {
                              setReviewNextType("work_sample");
                              setReviewNextTitle("");
                              setReviewNextQuestion("");
                              setReviewNextExpected("");
                              setReviewNextBurden("");
                              setReviewNextRationale("");
                              setReviewNextConsent(false);
                            }
                          }}
                        >
                          Edit draft
                        </Button>
                      </>
                    )}
                    {nextTalentReviewPacketStates(item.state).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={
                          reviewPacketUpdate.isPending ||
                          !effectiveClasses.has(
                            next === "signed_off" ? "approve" : "decide",
                          ) ||
                          (next === "signed_off" &&
                            reviewRationale.trim().length < 3)
                        }
                        onClick={() =>
                          reviewPacketUpdate.mutate({
                            id: item.id,
                            body: {
                              state: next,
                              ...(next === "signed_off"
                                ? {
                                    reviewerDecision: reviewDecision,
                                    reviewerRationale: reviewRationale.trim(),
                                  }
                                : {}),
                            },
                          })
                        }
                      >
                        {String(next).replaceAll("_", " ")}
                      </Button>
                    ))}
                    {item.nextAssessment &&
                      ["ready_for_review", "in_review", "signed_off"].includes(
                        item.state,
                      ) &&
                      !item.materializedAssessmentId && (
                        <Button
                          size="sm"
                          disabled={
                            reviewPacketMaterialize.isPending ||
                            !effectiveClasses.has("execute")
                          }
                          onClick={() =>
                            reviewPacketMaterialize.mutate(item.id)
                          }
                        >
                          Plan next assessment
                        </Button>
                      )}
                    {item.materializedAssessmentId && (
                      <Badge variant="secondary">Next assessment planned</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Governed paid trial</CardTitle>
            <CardDescription>
              Test the largest remaining uncertainty with explicit compensation,
              decision rights, observation, evidence, and a human outcome. A
              trial never creates placement, payment, access, or authority.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <select
                aria-label="Trial candidate"
                value={trialApplicationId}
                onChange={(event) => {
                  const id = event.target.value;
                  setTrialApplicationId(id);
                  setTrialSeatId(
                    applications.find((item: JsonRecord) => item.id === id)
                      ?.targetSeatId || "",
                  );
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose trial-recommended candidate</option>
                {applications
                  .filter((item: JsonRecord) => item.state === "trial_recommended")
                  .map((item: JsonRecord) => (
                    <option key={item.id} value={item.id}>
                      {candidateNameFor(item)}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Trial target seat"
                value={trialSeatId}
                onChange={(event) => setTrialSeatId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose target seat</option>
                {seats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.title}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Trial title"
                value={trialTitle}
                onChange={(event) => setTrialTitle(event.target.value)}
                placeholder="Bounded paid trial title"
              />
              <Input
                aria-label="Trial question"
                value={trialQuestion}
                onChange={(event) => setTrialQuestion(event.target.value)}
                placeholder="What remaining uncertainty will this trial test?"
              />
              <Input
                aria-label="Trial duration days"
                type="number"
                min="1"
                max="30"
                value={trialDuration}
                onChange={(event) => setTrialDuration(event.target.value)}
                placeholder="Duration in days"
              />
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Input
                  aria-label="Trial compensation"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={trialCompensation}
                  onChange={(event) => setTrialCompensation(event.target.value)}
                  placeholder="Compensation amount"
                />
                <Input
                  aria-label="Trial compensation currency"
                  value={trialCurrency}
                  onChange={(event) => setTrialCurrency(event.target.value)}
                  placeholder="USD"
                />
              </div>
              <Input
                aria-label="Trial compensation terms"
                value={trialTerms}
                onChange={(event) => setTrialTerms(event.target.value)}
                placeholder="When and how compensation becomes due"
              />
              <Input
                aria-label="Trial agreement reference"
                value={trialAgreement}
                onChange={(event) => setTrialAgreement(event.target.value)}
                placeholder="Executed trial agreement reference"
              />
              <Input
                aria-label="Trial jurisdiction"
                value={trialJurisdiction}
                onChange={(event) => setTrialJurisdiction(event.target.value)}
                placeholder="Applicable jurisdiction"
              />
              <Input
                aria-label="Trial support"
                value={trialSupport}
                onChange={(event) => setTrialSupport(event.target.value)}
                placeholder="Inputs, access, support, and owner provided"
              />
              <Input
                aria-label="Trial required output"
                value={trialOutput}
                onChange={(event) => setTrialOutput(event.target.value)}
                placeholder="Required candidate output"
              />
              <Input
                aria-label="Trial scorecard dimension"
                value={trialDimension}
                onChange={(event) => setTrialDimension(event.target.value)}
                placeholder="Scorecard dimension"
              />
              <Input
                aria-label="Trial success anchor"
                value={trialSuccessAnchor}
                onChange={(event) => setTrialSuccessAnchor(event.target.value)}
                placeholder="Observable success anchor"
              />
              <Input
                aria-label="Trial constraints"
                value={trialConstraint}
                onChange={(event) => setTrialConstraint(event.target.value)}
                placeholder="Constraint and candidate decision rights"
              />
              <Input
                aria-label="Trial observation point"
                value={trialObservationPoint}
                onChange={(event) => setTrialObservationPoint(event.target.value)}
                placeholder="When and how the reviewer observes"
              />
              <Input
                aria-label="Trial review date"
                type="datetime-local"
                value={trialReviewAt}
                onChange={(event) => setTrialReviewAt(event.target.value)}
              />
              <select
                aria-label="Predicted trial confidence"
                value={trialConfidence}
                onChange={(event) => setTrialConfidence(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {[
                  "insufficient",
                  "emerging",
                  "supported",
                  "contradicted",
                ].map((value) => (
                  <option key={value} value={value}>
                    Predicted confidence: {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Trial pass criterion"
                value={trialPass}
                onChange={(event) => setTrialPass(event.target.value)}
                placeholder="Pass criterion"
              />
              <Input
                aria-label="Trial redirect criterion"
                value={trialRedirect}
                onChange={(event) => setTrialRedirect(event.target.value)}
                placeholder="Redirect criterion"
              />
              <Input
                aria-label="Trial extension criterion"
                value={trialExtend}
                onChange={(event) => setTrialExtend(event.target.value)}
                placeholder="Extension criterion"
              />
              <Input
                aria-label="Trial failure criterion"
                value={trialFail}
                onChange={(event) => setTrialFail(event.target.value)}
                placeholder="Failure criterion"
              />
            </div>
            <Textarea
              aria-label="Predicted trial outcome"
              value={trialPrediction}
              onChange={(event) => setTrialPrediction(event.target.value)}
              placeholder="Evidence-bound predicted outcome before the trial starts"
            />
            <Textarea
              aria-label="Candidate trial instructions"
              value={trialInstructions}
              onChange={(event) => setTrialInstructions(event.target.value)}
              placeholder="Candidate-visible instructions and support path"
            />
            <Button
              className="w-full"
              disabled={
                trialCreate.isPending ||
                !effectiveClasses.has("execute") ||
                !trialApplicationId ||
                !trialSeatId ||
                !trialReviewAt ||
                [
                  trialTitle,
                  trialQuestion,
                  trialCompensation,
                  trialTerms,
                  trialAgreement,
                  trialJurisdiction,
                  trialSupport,
                  trialOutput,
                  trialDimension,
                  trialSuccessAnchor,
                  trialConstraint,
                  trialObservationPoint,
                  trialPass,
                  trialRedirect,
                  trialExtend,
                  trialFail,
                  trialPrediction,
                  trialInstructions,
                ].some((value) => value.trim().length < 3)
              }
              onClick={() => trialCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Propose trial and request approval
            </Button>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-sm font-medium">Human outcome inputs</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Used only when an under-review trial receives pass, redirect,
                extend, or fail. Evidence must already be verified in EOS.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <select
                  aria-label="Trial observation rating"
                  value={trialObservationRating}
                  onChange={(event) => setTrialObservationRating(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {["not_observed", "below", "meets", "exceeds"].map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <EvidenceSelect
                  label="Verified trial outcome evidence"
                  value={trialOutcomeEvidenceId}
                  onChange={setTrialOutcomeEvidenceId}
                  evidence={verifiedEvidence}
                />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {[
                  ["Observation notes", trialObservationNotes, setTrialObservationNotes],
                  ["Actual outcome summary", trialActualOutcome, setTrialActualOutcome],
                  ["Reviewer rationale", trialReviewerRationale, setTrialReviewerRationale],
                  ["Candidate feedback", trialCandidateFeedback, setTrialCandidateFeedback],
                  ["Predicted-versus-actual learning proposal", trialLearningProposal, setTrialLearningProposal],
                  ["Learning decision rationale", trialLearningRationale, setTrialLearningRationale],
                ].map(([label, value, setter]) => (
                  <Textarea
                    key={label as string}
                    aria-label={label as string}
                    value={value as string}
                    onChange={(event) =>
                      (setter as (value: string) => void)(event.target.value)
                    }
                    placeholder={label as string}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {trials.map((item: JsonRecord) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {item.title} · {candidateNameFor(
                          applications.find(
                            (application: JsonRecord) =>
                              application.id === item.applicationId,
                          ) || {},
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.durationDays} days · {item.compensationCurrency}{" "}
                        {(Number(item.compensationAmountMinor) / 100).toFixed(2)} ·
                        review {new Date(item.reviewAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">
                        approval {item.approvalStatus || "pending"}
                      </Badge>
                      <StateBadge state={item.state} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{item.question}</p>
                  {Array.isArray(item.readinessIssues) &&
                    item.readinessIssues.length > 0 && (
                      <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                        Still required: {item.readinessIssues.join(" · ")}
                      </p>
                    )}
                  {item.candidateSubmission && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Candidate submission: {item.candidateSubmission}
                    </p>
                  )}
                  {item.actualOutcomeSummary && (
                    <p className="mt-2 text-xs">
                      Actual: {item.actualOutcomeSummary} · Predicted: {item.predictedOutcome}
                    </p>
                  )}
                  {item.learningProposal && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Learning proposal ({item.learningStatus}): {item.learningProposal}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.state === "draft" && (
                      <Badge variant="outline">Approve in the decision HUD</Badge>
                    )}
                    {nextTalentTrialStates(item.state)
                      .filter((next) =>
                        [
                          "offered",
                          "active",
                          "under_review",
                          "passed",
                          "redirected",
                          "extended",
                          "failed",
                          "cancelled",
                        ].includes(next),
                      )
                      .map((next) => {
                        const outcome = [
                          "passed",
                          "redirected",
                          "extended",
                          "failed",
                        ].includes(next);
                        return (
                          <Button
                            key={next}
                            size="sm"
                            variant="outline"
                            disabled={
                              trialUpdate.isPending ||
                              !effectiveClasses.has(
                                outcome
                                  ? "approve"
                                  : next === "active"
                                    ? "execute"
                                    : "decide",
                              ) ||
                              (outcome &&
                                (!trialOutcomeEvidenceId ||
                                  [
                                    trialObservationNotes,
                                    trialActualOutcome,
                                    trialReviewerRationale,
                                    trialCandidateFeedback,
                                    trialLearningProposal,
                                  ].some((value) => value.trim().length < 3)))
                            }
                            onClick={() =>
                              trialUpdate.mutate({ id: item.id, state: next })
                            }
                          >
                            {next.replaceAll("_", " ")}
                          </Button>
                        );
                      })}
                    {item.learningStatus === "proposed" && (
                      <>
                        <Button
                          size="sm"
                          disabled={
                            trialLearningDecision.isPending ||
                            !effectiveClasses.has("approve") ||
                            trialLearningRationale.trim().length < 3
                          }
                          onClick={() =>
                            trialLearningDecision.mutate({
                              id: item.id,
                              decision: "accepted",
                            })
                          }
                        >
                          Accept learning
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            trialLearningDecision.isPending ||
                            !effectiveClasses.has("approve") ||
                            trialLearningRationale.trim().length < 3
                          }
                          onClick={() =>
                            trialLearningDecision.mutate({
                              id: item.id,
                              decision: "rejected",
                            })
                          }
                        >
                          Reject learning
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decision, offer and onboarding</CardTitle>
            <CardDescription>
              A human-attributable placement connects the candidate to a seat.
              Activation still requires a separately provisioned user and active
              operating assignment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              aria-label="Placement candidate"
              value={placementApplicationId}
              onChange={(event) => {
                const id = event.target.value;
                setPlacementApplicationId(id);
                setPlacementSeatId(
                  applications.find((item: JsonRecord) => item.id === id)
                    ?.targetSeatId || "",
                );
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose candidate at decision stage</option>
              {applications
                .filter((item: JsonRecord) => item.state === "decision")
                .map((item: JsonRecord) => (
                  <option key={item.id} value={item.id}>
                    {candidateNameFor(item)}
                  </option>
                ))}
            </select>
            <select
              aria-label="Placement target seat"
              value={placementSeatId}
              onChange={(event) => setPlacementSeatId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose seat</option>
              {seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.title}
                </option>
              ))}
            </select>
            <Textarea
              aria-label="Placement rationale"
              value={placementRationale}
              onChange={(event) => setPlacementRationale(event.target.value)}
              placeholder="Factor-level decision rationale and unresolved risk"
            />
            <Textarea
              aria-label="Placement offer summary"
              value={placementOffer}
              onChange={(event) => setPlacementOffer(event.target.value)}
              placeholder="Restricted offer terms summary"
            />
            <Input
              aria-label="Placement onboarding item"
              value={placementOnboarding}
              onChange={(event) => setPlacementOnboarding(event.target.value)}
              placeholder="First onboarding outcome"
            />
            <Input
              aria-label="Placement access plan"
              value={placementAccess}
              onChange={(event) => setPlacementAccess(event.target.value)}
              placeholder="Least-privilege access and revocation plan"
            />
            <EvidenceSelect
              label="Placement evidence"
              value={placementEvidenceId}
              onChange={setPlacementEvidenceId}
              evidence={verifiedEvidence}
            />
            <Button
              className="w-full"
              disabled={
                !effectiveClasses.has("approve") ||
                placementCreate.isPending ||
                !placementApplicationId ||
                !placementSeatId ||
                placementRationale.trim().length < 3
              }
              onClick={() => placementCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Open placement decision
            </Button>
            <div className="space-y-2">
              {placements.map((item: JsonRecord) => {
                const application = applications.find(
                  (candidateApplication: JsonRecord) =>
                    candidateApplication.id === item.applicationId,
                ) as JsonRecord | undefined;
                const identityAndAssignmentLinked = Boolean(
                  application?.candidateUserId && item.assignmentId,
                );
                const canInviteForOnboarding =
                  ["offer_accepted", "onboarding"].includes(String(item.state)) &&
                  !application?.candidateUserId &&
                  !item.assignmentId;
                return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {candidateNameFor(application || {})}
                    </span>
                    <StateBadge state={item.state} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.rationale}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {identityAndAssignmentLinked
                      ? "Verified identity and seat assignment linked"
                      : "Awaiting verified onboarding acceptance"}
                  </p>
                  {canInviteForOnboarding && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input
                        aria-label="Candidate onboarding email"
                        type="email"
                        value={placementInviteEmail}
                        onChange={(event) =>
                          setPlacementInviteEmail(event.target.value)
                        }
                        placeholder="Candidate's verified email"
                      />
                      <Button
                        size="sm"
                        disabled={
                          talentOnboardingInvite.isPending ||
                          !effectiveClasses.has("grant_access") ||
                          !placementInviteEmail.trim()
                        }
                        onClick={() =>
                          talentOnboardingInvite.mutate({
                            applicationId: String(item.applicationId),
                            seatId: String(item.targetSeatId),
                          })
                        }
                      >
                        Send onboarding invite
                      </Button>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextTalentPlacementStates(item.state).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={
                          placementUpdate.isPending ||
                          !effectiveClasses.has(
                            [
                              "offer_approved",
                              "activated",
                              "rejected",
                            ].includes(next)
                              ? "approve"
                              : "decide",
                          )
                        }
                        onClick={() =>
                          placementUpdate.mutate({ id: item.id, state: next })
                        }
                      >
                        {next.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Talent diagnosis</CardTitle>
          <CardDescription>
            Ask the role-bound assistant to compare institutional need,
            candidate evidence, proof gaps, team complementarity, and the
            smallest fair next test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() =>
              askAssistant(
                `Inspect the talent state visible to my role. Identify the highest-value capability gap or candidate next action. Separate verified evidence from self-report, explain uncertainty, protect candidate privacy, and do not recommend an automatic adverse decision.`,
              )
            }
          >
            <MessagesSquare className="mr-2 h-4 w-4" />
            Ask {assistantName}
          </Button>
        </CardContent>
      </Card>
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Fair, bilateral and human-governed</AlertTitle>
        <AlertDescription>
          Candidates remain people, not scores. No protected-characteristic
          inference, hidden personality labels, black-box rejection, seat
          assignment, tool access, or authority is created by assessment state.
          Secure candidate links expose only the candidate allowlist and can be
          rotated or revoked at any time.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function CandidatePortalLinkControls({
  root,
  application,
  messages,
  workPackets,
  canExecute,
  refetch,
  showError,
}: {
  root: string;
  application: JsonRecord;
  messages: JsonRecord[];
  workPackets: JsonRecord[];
  canExecute: boolean;
  refetch: () => Promise<unknown>;
  showError: (action: string, error: unknown) => void;
}) {
  const { toast } = useToast();
  const [issuedPath, setIssuedPath] = useState("");
  const [reply, setReply] = useState("");
  const [invitationPacketId, setInvitationPacketId] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const selectedPacketId = invitationPacketId || workPackets[0]?.id || "";
  const issue = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/talent-applications/${application.id}/portal-link`,
        { expiresInDays: 14, retentionDays: 365 },
      ),
    onSuccess: async (result) => {
      setIssuedPath(`${window.location.origin}${result.path}`);
      await refetch();
      toast({
        title: "Candidate link issued",
        description:
          "Copy it now. EOS stores only its hash and cannot recover this exact link later.",
      });
    },
    onError: (failure) => showError("Candidate portal link", failure),
  });
  const revoke = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/talent-applications/${application.id}/portal-link/revoke`,
        {},
      ),
    onSuccess: async () => {
      setIssuedPath("");
      await refetch();
      toast({ title: "Candidate link revoked" });
    },
    onError: (failure) => showError("Candidate portal revocation", failure),
  });
  const respond = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/talent-applications/${application.id}/candidate-messages`,
        { message: reply },
      ),
    onSuccess: async () => {
      setReply("");
      await refetch();
      toast({ title: "Candidate reply sent" });
    },
    onError: (failure) => showError("Candidate reply", failure),
  });
  const deliver = useMutation({
    mutationFn: () =>
      requestJson<JsonRecord>(
        "POST",
        `${root}/work-packets/${selectedPacketId}/provider-executions`,
        {
          provider: "gmail",
          operation:
            "gmail.send_candidate_portal_invitation_with_local_approval",
          applicationId: application.id,
          expiresInDays: 14,
          retentionDays: 365,
          personalMessage,
        },
      ),
    onSuccess: async () => {
      setPersonalMessage("");
      await refetch();
      toast({
        title: "Candidate invitation awaiting approval",
        description:
          "After approval, EOS will create the private link in memory, send it through Gmail, and retain only its hash and provider receipt.",
      });
    },
    onError: (failure) => showError("Candidate invitation delivery", failure),
  });
  const closed = ["activated", "rejected", "withdrawn"].includes(
    application.state,
  );
  return (
    <div className="mt-3 rounded-xl bg-muted/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Candidate portal
          </p>
          <p className="text-xs text-muted-foreground">
            {application.portalRevokedAt
              ? "Revoked"
              : application.portalExpiresAt
                ? `Active until ${new Date(application.portalExpiresAt).toLocaleDateString()}`
                : "Not issued"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canExecute || closed || issue.isPending}
            onClick={() => issue.mutate()}
          >
            <Link2 className="mr-2 h-3.5 w-3.5" />
            {application.portalExpiresAt ? "Rotate link" : "Issue link"}
          </Button>
          {application.portalExpiresAt && !application.portalRevokedAt && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!canExecute || revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              Revoke
            </Button>
          )}
        </div>
      </div>
      {issuedPath && (
        <div className="mt-3 flex gap-2">
          <Input
            aria-label="One-time candidate portal URL"
            readOnly
            value={issuedPath}
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="Copy candidate portal URL"
            onClick={() =>
              void navigator.clipboard
                .writeText(issuedPath)
                .then(() => toast({ title: "Candidate link copied" }))
            }
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[1fr_auto]">
        <select
          aria-label="Candidate invitation work packet"
          value={selectedPacketId}
          onChange={(event) => setInvitationPacketId(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
        >
          <option value="">Choose governed Work Packet</option>
          {workPackets.map((packet) => (
            <option key={packet.id} value={packet.id}>
              {packet.title}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={
            !canExecute || closed || !selectedPacketId || deliver.isPending
          }
          onClick={() => deliver.mutate()}
        >
          <Send className="mr-2 h-3.5 w-3.5" />
          Send secure invite
        </Button>
        <Input
          className="sm:col-span-2"
          aria-label="Candidate invitation personal message"
          value={personalMessage}
          onChange={(event) => setPersonalMessage(event.target.value)}
          placeholder="Optional candidate-visible note; link is generated only after approval"
        />
      </div>
      {messages.length > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {messages.slice(-4).map((message) => (
            <div key={message.id} className="text-xs">
              <span className="font-semibold">
                {message.direction === "candidate_to_team"
                  ? "Candidate"
                  : "Team"}
                :
              </span>{" "}
              {message.body}
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              aria-label="Reply to candidate"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Reply in the private portal"
            />
            <Button
              size="sm"
              disabled={
                !canExecute || reply.trim().length < 2 || respond.isPending
              }
              onClick={() => respond.mutate()}
            >
              Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkforceInstrument({
  root,
  state,
  loading,
  error,
  refetch,
  seats,
  evidence,
  authorityClasses: effectiveClasses,
  principalSeatId,
  role,
  showError,
  askAssistant,
  assistantName,
}: {
  root: string;
  state?: JsonRecord;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
  seats: JsonRecord[];
  evidence: JsonRecord[];
  authorityClasses: Set<string>;
  principalSeatId: string;
  role: string;
  showError: (action: string, error: unknown) => void;
  askAssistant: (content: string) => void;
  assistantName: string;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const quarterAgo = new Date(Date.now() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [reviewSeatId, setReviewSeatId] = useState(principalSeatId);
  const [reviewStart, setReviewStart] = useState(quarterAgo);
  const [reviewEnd, setReviewEnd] = useState(today);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewAttribution, setReviewAttribution] = useState("undetermined");
  const [reviewStrength, setReviewStrength] = useState("");
  const [reviewGap, setReviewGap] = useState("");
  const [managerObligation, setManagerObligation] = useState("");
  const [reviewMetricIds, setReviewMetricIds] = useState<string[]>([]);
  const [reviewEvidenceIds, setReviewEvidenceIds] = useState<string[]>([]);
  const [correctionText, setCorrectionText] = useState("");
  const [supportSeatId, setSupportSeatId] = useState(principalSeatId);
  const [supportMode, setSupportMode] = useState("assist");
  const [supportResponsibility, setSupportResponsibility] = useState("");
  const [supportObjective, setSupportObjective] = useState("");
  const [supportHumanOwnership, setSupportHumanOwnership] = useState("");
  const [supportInstructions, setSupportInstructions] = useState("");
  const [supportGuardrail, setSupportGuardrail] = useState("");
  const [supportProof, setSupportProof] = useState("");
  const [supportTransferTarget, setSupportTransferTarget] = useState("");
  const [supportReviewAt, setSupportReviewAt] = useState("");
  const [supportEvidenceIds, setSupportEvidenceIds] = useState<string[]>([]);
  const [careerSeatId, setCareerSeatId] = useState(principalSeatId);
  const [careerTargetRole, setCareerTargetRole] = useState("");
  const [careerTransitionType, setCareerTransitionType] =
    useState("level_promotion");
  const [careerTrack, setCareerTrack] = useState("individual_contributor");
  const [careerAspiration, setCareerAspiration] = useState("");
  const [careerBusinessNeed, setCareerBusinessNeed] = useState("");
  const [careerSeatAvailability, setCareerSeatAvailability] =
    useState("unknown");
  const [careerCriteria, setCareerCriteria] = useState("");
  const [careerTraining, setCareerTraining] = useState("");
  const [careerProof, setCareerProof] = useState("");
  const [careerReviewAt, setCareerReviewAt] = useState("");
  const [careerEvidenceIds, setCareerEvidenceIds] = useState<string[]>([]);
  const [developmentSeatId, setDevelopmentSeatId] = useState(principalSeatId);
  const [developmentTarget, setDevelopmentTarget] = useState("");
  const [developmentGap, setDevelopmentGap] = useState("");
  const [developmentAction, setDevelopmentAction] = useState("");
  const [developmentSuccess, setDevelopmentSuccess] = useState("");
  const [developmentReviewAt, setDevelopmentReviewAt] = useState("");
  const [developmentEvidenceIds, setDevelopmentEvidenceIds] = useState<
    string[]
  >([]);
  const [criticalSeatId, setCriticalSeatId] = useState("");
  const [candidateSeatId, setCandidateSeatId] = useState("");
  const [successionReadiness, setSuccessionReadiness] = useState("unassessed");
  const [successionRationale, setSuccessionRationale] = useState("");
  const [successionGap, setSuccessionGap] = useState("");
  const [successionAssignment, setSuccessionAssignment] = useState("");
  const [successionEvidenceIds, setSuccessionEvidenceIds] = useState<string[]>(
    [],
  );
  const [externalHiringRequired, setExternalHiringRequired] = useState(false);
  useEffect(() => {
    if (!principalSeatId) return;
    setReviewSeatId((current) => current || principalSeatId);
    setSupportSeatId((current) => current || principalSeatId);
    setCareerSeatId((current) => current || principalSeatId);
    setDevelopmentSeatId((current) => current || principalSeatId);
  }, [principalSeatId]);
  const verifiedEvidence = evidence.filter(
    (item) => item.verificationState === "verified",
  );
  const managerRole = [
    "founder",
    "portfolio_executive",
    "company_ceo",
    "functional_executive",
    "manager",
  ].includes(role);
  const metrics = state?.metrics || [];
  const seatName = (id: string | null | undefined) =>
    seats.find((seat) => seat.id === id)?.title ||
    (id ? "Authorized seat" : "External / unassigned");
  const toggle = (
    id: string,
    values: string[],
    setter: (value: string[]) => void,
  ) =>
    setter(
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  const mutation = (
    action: string,
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
  ) =>
    requestJson<JsonRecord>(method, `${root}${path}`, body).then(
      async (result) => {
        await refetch();
        toast({
          title: action,
          description:
            "The governed workforce record and audit trail were updated.",
        });
        return result;
      },
    );

  const reviewCreate = useMutation({
    mutationFn: () =>
      mutation("Review drafted", "POST", "/workforce-reviews", {
        subjectSeatId: reviewSeatId,
        periodStart: `${reviewStart}T00:00:00.000Z`,
        periodEnd: `${reviewEnd}T23:59:59.000Z`,
        outcomeSummary: reviewSummary.trim(),
        performanceAttribution: reviewAttribution,
        strengths: reviewStrength.trim() ? [reviewStrength.trim()] : [],
        gaps: reviewGap.trim() ? [reviewGap.trim()] : [],
        managerObligations: managerObligation.trim()
          ? [managerObligation.trim()]
          : [],
        metricIds: reviewMetricIds,
        evidenceIds: reviewEvidenceIds,
        workPacketIds: [],
        classification: "internal",
      }),
    onSuccess: () => {
      setReviewSummary("");
      setReviewStrength("");
      setReviewGap("");
      setManagerObligation("");
    },
    onError: (error) => showError("Workforce review", error),
  });
  const reviewUpdate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: JsonRecord }) =>
      mutation("Review updated", "PATCH", `/workforce-reviews/${id}`, body),
    onSuccess: () => setCorrectionText(""),
    onError: (error) => showError("Workforce review update", error),
  });
  const reviewDialogue = useMutation({
    mutationFn: ({
      id,
      responseType,
      correctionDecision,
    }: {
      id: string;
      responseType: string;
      correctionDecision?: "resolved" | "rejected";
    }) =>
      mutation(
        "Review dialogue appended",
        "POST",
        `/workforce-reviews/${id}/dialogue`,
        {
          responseType,
          body: correctionText.trim(),
          ...(correctionDecision ? { correctionDecision } : {}),
        },
      ),
    onSuccess: () => setCorrectionText(""),
    onError: (error) => showError("Review dialogue", error),
  });
  const supportCreate = useMutation({
    mutationFn: () =>
      mutation("Role support plan drafted", "POST", "/role-support-plans", {
        subjectSeatId: supportSeatId,
        supportMode,
        responsibility: supportResponsibility.trim(),
        objective: supportObjective.trim(),
        humanOwnership: supportHumanOwnership.trim(),
        supportInstructions: supportInstructions.trim(),
        guardrails: supportGuardrail.trim() ? [supportGuardrail.trim()] : [],
        proofRequirements: supportProof.trim() ? [supportProof.trim()] : [],
        evidenceIds: supportEvidenceIds,
        transferTarget:
          supportMode === "transfer" ? supportTransferTarget.trim() : "",
        ...(supportReviewAt
          ? {
              reviewAt: new Date(
                `${supportReviewAt}T12:00:00Z`,
              ).toISOString(),
            }
          : {}),
        classification: "internal",
      }),
    onSuccess: () => {
      setSupportResponsibility("");
      setSupportObjective("");
      setSupportHumanOwnership("");
      setSupportInstructions("");
      setSupportGuardrail("");
      setSupportProof("");
      setSupportTransferTarget("");
      setSupportEvidenceIds([]);
    },
    onError: (error) => showError("Role support plan", error),
  });
  const supportUpdate = useMutation({
    mutationFn: ({ id, state: nextState }: { id: string; state: string }) =>
      mutation(
        "Role support plan updated",
        "PATCH",
        `/role-support-plans/${id}`,
        { state: nextState },
      ),
    onError: (error) => showError("Role support transition", error),
  });
  const careerCreate = useMutation({
    mutationFn: () =>
      mutation("Career path proposed", "POST", "/career-paths", {
        subjectSeatId: careerSeatId,
        targetRole: careerTargetRole.trim(),
        transitionType: careerTransitionType,
        careerTrack,
        aspirationStatement: careerAspiration.trim(),
        businessNeed: careerBusinessNeed.trim(),
        seatAvailability: careerSeatAvailability,
        transitionCriteria: [careerCriteria.trim()],
        trainingRequirements: careerTraining.trim()
          ? [careerTraining.trim()]
          : [],
        proofRequirements: [careerProof.trim()],
        evidenceIds: careerEvidenceIds,
        ...(careerReviewAt
          ? {
              reviewAt: new Date(`${careerReviewAt}T12:00:00Z`).toISOString(),
            }
          : {}),
        classification: "internal",
      }),
    onSuccess: () => {
      setCareerTargetRole("");
      setCareerAspiration("");
      setCareerBusinessNeed("");
      setCareerCriteria("");
      setCareerTraining("");
      setCareerProof("");
      setCareerEvidenceIds([]);
    },
    onError: (error) => showError("Career path", error),
  });
  const careerUpdate = useMutation({
    mutationFn: ({ id, state: nextState }: { id: string; state: string }) =>
      mutation(
        "Career path updated",
        "PATCH",
        `/career-paths/${id}`,
        { state: nextState },
      ),
    onError: (error) => showError("Career path transition", error),
  });
  const developmentCreate = useMutation({
    mutationFn: () =>
      mutation("Development plan drafted", "POST", "/development-plans", {
        subjectSeatId: developmentSeatId,
        targetRole: developmentTarget.trim(),
        capabilityGaps: developmentGap.trim() ? [developmentGap.trim()] : [],
        developmentActions: developmentAction.trim()
          ? [developmentAction.trim()]
          : [],
        successCriteria: developmentSuccess.trim()
          ? [developmentSuccess.trim()]
          : [],
        evidenceIds: developmentEvidenceIds,
        workPacketIds: [],
        ...(developmentReviewAt
          ? {
              reviewAt: new Date(
                `${developmentReviewAt}T12:00:00Z`,
              ).toISOString(),
            }
          : {}),
        classification: "internal",
      }),
    onSuccess: () => {
      setDevelopmentTarget("");
      setDevelopmentGap("");
      setDevelopmentAction("");
      setDevelopmentSuccess("");
    },
    onError: (error) => showError("Development plan", error),
  });
  const developmentUpdate = useMutation({
    mutationFn: ({ id, state: nextState }: { id: string; state: string }) =>
      mutation(
        "Development plan updated",
        "PATCH",
        `/development-plans/${id}`,
        { state: nextState },
      ),
    onError: (error) => showError("Development plan transition", error),
  });
  const successionCreate = useMutation({
    mutationFn: () =>
      mutation(
        "Succession hypothesis recorded",
        "POST",
        "/succession-hypotheses",
        {
          criticalSeatId,
          ...(candidateSeatId ? { candidateSeatId } : {}),
          readinessWindow: successionReadiness,
          rationale: successionRationale.trim(),
          proofGaps: successionGap.trim() ? [successionGap.trim()] : [],
          developmentalAssignments: successionAssignment.trim()
            ? [successionAssignment.trim()]
            : [],
          externalHiringRequired,
          evidenceIds: successionEvidenceIds,
          classification: "internal",
        },
      ),
    onSuccess: () => {
      setSuccessionRationale("");
      setSuccessionGap("");
      setSuccessionAssignment("");
    },
    onError: (error) => showError("Succession hypothesis", error),
  });
  const successionUpdate = useMutation({
    mutationFn: ({ id, state: nextState }: { id: string; state: string }) =>
      mutation(
        "Succession hypothesis updated",
        "PATCH",
        `/succession-hypotheses/${id}`,
        { state: nextState },
      ),
    onError: (error) => showError("Succession transition", error),
  });

  if (loading)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Compiling role scorecards, development, and succession state…
        </CardContent>
      </Card>
    );
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Workforce instrument unavailable</AlertTitle>
        <AlertDescription>
          Refresh the workspace. EOS will not substitute invented employee or
          succession state.
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Fact
          label="Open reviews"
          value={String(state?.counts?.openReviews || 0)}
        />
        <Fact
          label="Active development"
          value={String(state?.counts?.activeDevelopmentPlans || 0)}
        />
        <Fact
          label="Active support"
          value={String(state?.counts?.activeSupportPlans || 0)}
        />
        <Fact
          label="Active career paths"
          value={String(state?.counts?.activeCareerPaths || 0)}
        />
        <Fact
          label="Ready-now successors"
          value={String(state?.counts?.readySuccessors || 0)}
        />
        <Fact
          label="Correction requests"
          value={String(state?.counts?.unresolvedCorrections || 0)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role outcome reviews</CardTitle>
          <CardDescription>
            Review the role, work, evidence, capacity, process, and management
            conditions together. A draft may collect evidence; calibration
            requires a scorecard metric and verified work evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              Draft a review
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <select
                aria-label="Review subject seat"
                value={reviewSeatId}
                onChange={(event) => setReviewSeatId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose role</option>
                {seats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.title}
                  </option>
                ))}
              </select>
              <select
                aria-label="Performance attribution"
                value={reviewAttribution}
                onChange={(event) => setReviewAttribution(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="undetermined">Attribution undetermined</option>
                <option value="person">Person performance</option>
                <option value="role_design">Role design</option>
                <option value="process">Process</option>
                <option value="management">Management</option>
                <option value="capacity">Capacity</option>
                <option value="fit">Person × role × stage fit</option>
                <option value="mixed">Mixed causes</option>
              </select>
              <Input
                aria-label="Review period start"
                type="date"
                value={reviewStart}
                onChange={(event) => setReviewStart(event.target.value)}
              />
              <Input
                aria-label="Review period end"
                type="date"
                value={reviewEnd}
                onChange={(event) => setReviewEnd(event.target.value)}
              />
              <Textarea
                aria-label="Review outcome summary"
                className="lg:col-span-2"
                value={reviewSummary}
                onChange={(event) => setReviewSummary(event.target.value)}
                placeholder="Observed outcomes, expectations, and important context"
              />
              <Input
                value={reviewStrength}
                onChange={(event) => setReviewStrength(event.target.value)}
                placeholder="Demonstrated strength"
              />
              <Input
                value={reviewGap}
                onChange={(event) => setReviewGap(event.target.value)}
                placeholder="Role, capability, process, or capacity gap"
              />
              <Input
                className="lg:col-span-2"
                value={managerObligation}
                onChange={(event) => setManagerObligation(event.target.value)}
                placeholder="Manager obligation or system correction"
              />
              <WorkforceReferencePicker
                title="Scorecard metrics"
                items={metrics}
                selected={reviewMetricIds}
                onToggle={(id) =>
                  toggle(id, reviewMetricIds, setReviewMetricIds)
                }
                empty="Create a role metric in Command before calibration."
              />
              <WorkforceReferencePicker
                title="Verified work evidence"
                items={verifiedEvidence}
                selected={reviewEvidenceIds}
                onToggle={(id) =>
                  toggle(id, reviewEvidenceIds, setReviewEvidenceIds)
                }
                empty="Verify work evidence before calibration."
              />
              <Button
                className="lg:col-span-2"
                disabled={
                  !reviewSeatId ||
                  reviewSummary.trim().length < 3 ||
                  !reviewStart ||
                  !reviewEnd ||
                  reviewEnd < reviewStart ||
                  reviewCreate.isPending ||
                  !effectiveClasses.has("execute")
                }
                onClick={() => reviewCreate.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Draft review
              </Button>
            </div>
          </details>
          <Input
            value={correctionText}
            onChange={(event) => setCorrectionText(event.target.value)}
            placeholder="Employee response, correction request, or manager resolution rationale"
          />
          <div className="space-y-3">
            {(state?.reviews || []).map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={item.state} />
                  <Badge variant="outline">
                    {seatName(item.subjectSeatId)}
                  </Badge>
                  <Badge variant="secondary">
                    {item.performanceAttribution.replaceAll("_", " ")}
                  </Badge>
                  {item.correctionStatus !== "none" && (
                    <Badge variant="outline">
                      correction {item.correctionStatus}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 font-medium">{item.outcomeSummary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(item.periodStart).toLocaleDateString()}–
                  {new Date(item.periodEnd).toLocaleDateString()} ·{" "}
                  {(item.metricIds || []).length} metrics ·{" "}
                  {(item.evidenceIds || []).length} evidence items
                </p>
                <div className="mt-3 space-y-2">
                  {(state?.reviewDialogue || [])
                    .filter(
                      (entry: JsonRecord) => entry.reviewId === item.id,
                    )
                    .map((entry: JsonRecord) => (
                      <div key={entry.id} className="rounded-lg bg-muted p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">
                            {String(entry.responseType).replaceAll("_", " ")}
                          </Badge>
                          {entry.correctionDecision && (
                            <Badge variant="secondary">
                              {entry.correctionDecision}
                            </Badge>
                          )}
                          <span className="text-muted-foreground">
                            {seatName(entry.authorSeatId)} ·{" "}
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{entry.body}</p>
                      </div>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextWorkforceReviewStates(item.state).map((nextState) => {
                    const selfStep =
                      item.subjectSeatId === principalSeatId &&
                      ["self_review", "acknowledged"].includes(nextState);
                    const permitted = selfStep
                      ? effectiveClasses.has("execute")
                      : ["calibrated", "closed"].includes(nextState)
                        ? effectiveClasses.has("approve")
                        : effectiveClasses.has("decide");
                    return (
                      <Button
                        key={nextState}
                        size="sm"
                        variant="outline"
                        disabled={!permitted || reviewUpdate.isPending}
                        onClick={() =>
                          reviewUpdate.mutate({
                            id: item.id,
                            body: { state: nextState },
                          })
                        }
                      >
                        {nextState.replaceAll("_", " ")}
                      </Button>
                    );
                  })}
                  {item.subjectSeatId === principalSeatId && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        correctionText.trim().length < 3 ||
                        reviewDialogue.isPending ||
                        !effectiveClasses.has("execute")
                      }
                      onClick={() =>
                        reviewDialogue.mutate({
                          id: item.id,
                          responseType: "employee_response",
                        })
                      }
                    >
                      Add employee response
                    </Button>
                  )}
                  {item.subjectSeatId === principalSeatId &&
                    item.correctionStatus !== "requested" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          correctionText.trim().length < 3 ||
                          reviewDialogue.isPending ||
                          !effectiveClasses.has("execute")
                        }
                        onClick={() =>
                          reviewDialogue.mutate({
                            id: item.id,
                            responseType: "correction_request",
                          })
                        }
                      >
                        Request correction
                      </Button>
                    )}
                  {item.correctionStatus === "requested" &&
                    [
                      "founder",
                      "portfolio_executive",
                      "company_ceo",
                      "functional_executive",
                      "manager",
                    ].includes(role) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            correctionText.trim().length < 3 ||
                            reviewDialogue.isPending ||
                            !effectiveClasses.has("decide")
                          }
                          onClick={() =>
                            reviewDialogue.mutate({
                              id: item.id,
                              responseType: "correction_resolution",
                              correctionDecision: "resolved",
                            })
                          }
                        >
                          Resolve correction
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            correctionText.trim().length < 3 ||
                            reviewDialogue.isPending ||
                            !effectiveClasses.has("decide")
                          }
                          onClick={() =>
                            reviewDialogue.mutate({
                              id: item.id,
                              responseType: "correction_resolution",
                              correctionDecision: "rejected",
                            })
                          }
                        >
                          Reject with rationale
                        </Button>
                      </>
                    )}
                </div>
              </div>
            ))}
            {!(state?.reviews || []).length && (
              <p className="text-sm text-muted-foreground">
                No review has been opened in this role scope.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Role support modes</CardTitle>
          <CardDescription>
            Choose how EOS should support a real responsibility: assist the
            owner, teach capability, guard consequential work, or prepare a
            proven transfer. Transfer completion records proof; it never changes
            the seat assignment or Authority Grant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              Choose support for a responsibility
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <select
                aria-label="Support subject seat"
                value={supportSeatId}
                onChange={(event) => setSupportSeatId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose role</option>
                {seats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.title}
                  </option>
                ))}
              </select>
              <select
                aria-label="Support mode"
                value={supportMode}
                onChange={(event) => setSupportMode(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="assist">Assist — owner performs the work</option>
                <option value="teach">Teach — build owned capability</option>
                <option value="guard">Guard — constrain consequential error</option>
                <option value="transfer">Transfer — prove safe handoff</option>
              </select>
              <Input
                value={supportResponsibility}
                onChange={(event) => setSupportResponsibility(event.target.value)}
                placeholder="Meaningful responsibility"
              />
              <Input
                type="date"
                value={supportReviewAt}
                onChange={(event) => setSupportReviewAt(event.target.value)}
                aria-label="Support review date"
              />
              <Textarea
                value={supportObjective}
                onChange={(event) => setSupportObjective(event.target.value)}
                placeholder="Outcome this support must produce"
              />
              <Textarea
                value={supportHumanOwnership}
                onChange={(event) => setSupportHumanOwnership(event.target.value)}
                placeholder="What the human still owns and decides"
              />
              <Textarea
                value={supportInstructions}
                onChange={(event) => setSupportInstructions(event.target.value)}
                placeholder="What the Role Agent, manager, or system should do"
              />
              <Textarea
                value={supportGuardrail}
                onChange={(event) => setSupportGuardrail(event.target.value)}
                placeholder={
                  ["guard", "transfer"].includes(supportMode)
                    ? "Required guardrail or stop condition"
                    : "Optional guardrail or stop condition"
                }
              />
              <Textarea
                value={supportProof}
                onChange={(event) => setSupportProof(event.target.value)}
                placeholder={
                  ["teach", "transfer"].includes(supportMode)
                    ? "Required observable proof"
                    : "Optional observable proof"
                }
              />
              {supportMode === "transfer" && (
                <Textarea
                  value={supportTransferTarget}
                  onChange={(event) =>
                    setSupportTransferTarget(event.target.value)
                  }
                  placeholder="Execution target after a separately governed assignment or authority change"
                />
              )}
              <div className="lg:col-span-2">
                <WorkforceReferencePicker
                  title="Verified support evidence"
                  items={verifiedEvidence}
                  selected={supportEvidenceIds}
                  onToggle={(id) =>
                    toggle(id, supportEvidenceIds, setSupportEvidenceIds)
                  }
                  empty="Evidence can be attached before manager verification."
                />
              </div>
              <Button
                className="lg:col-span-2"
                disabled={
                  !supportSeatId ||
                  supportResponsibility.trim().length < 3 ||
                  supportObjective.trim().length < 3 ||
                  supportHumanOwnership.trim().length < 3 ||
                  supportInstructions.trim().length < 3 ||
                  (["guard", "transfer"].includes(supportMode) &&
                    supportGuardrail.trim().length < 3) ||
                  (["teach", "transfer"].includes(supportMode) &&
                    supportProof.trim().length < 3) ||
                  (supportMode === "transfer" &&
                    supportTransferTarget.trim().length < 3) ||
                  (["guard", "transfer"].includes(supportMode) &&
                    supportSeatId === principalSeatId) ||
                  supportCreate.isPending ||
                  !effectiveClasses.has(
                    ["guard", "transfer"].includes(supportMode)
                      ? "decide"
                      : "execute",
                  )
                }
                onClick={() => supportCreate.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Draft {supportMode} support
              </Button>
            </div>
          </details>
          <div className="space-y-3">
            {(state?.roleSupportPlans || []).map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={item.state} />
                  <Badge variant="secondary">{item.supportMode}</Badge>
                  <Badge variant="outline">
                    {seatName(item.subjectSeatId)}
                  </Badge>
                </div>
                <p className="mt-3 font-medium">{item.responsibility}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.objective}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Human ownership:</span>{" "}
                  {item.humanOwnership}
                </p>
                {item.supportMode === "transfer" && (
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Proposed target:</span>{" "}
                    {item.transferTarget}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextRoleSupportPlanStates(item.state).map((nextState) => (
                    <Button
                      key={nextState}
                      size="sm"
                      variant="outline"
                      disabled={
                        supportUpdate.isPending ||
                        (nextState === "completed" && !managerRole) ||
                        !effectiveClasses.has(
                          nextState === "completed"
                            ? "approve"
                            : nextState === "active" &&
                                ["guard", "transfer"].includes(
                                  item.supportMode,
                                )
                              ? "decide"
                              : "execute",
                        )
                      }
                      onClick={() =>
                        supportUpdate.mutate({ id: item.id, state: nextState })
                      }
                    >
                      {nextState.replaceAll("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {!(state?.roleSupportPlans || []).length && (
              <p className="text-sm text-muted-foreground">
                No support mode has been chosen in this role scope.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>My Career and mobility</CardTitle>
          <CardDescription>
            Make a plausible next role, specialist or management track, business
            need, transition criteria, development, and proof visible. An
            endorsed path remains a hypothesis—it does not promote the person,
            assign a seat, change compensation, or grant authority.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              Propose a career path
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <select
                aria-label="Career path subject seat"
                value={careerSeatId}
                onChange={(event) => setCareerSeatId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose current role</option>
                {seats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.title}
                  </option>
                ))}
              </select>
              <Input
                value={careerTargetRole}
                onChange={(event) => setCareerTargetRole(event.target.value)}
                placeholder="Plausible next role or level"
              />
              <select
                aria-label="Career transition type"
                value={careerTransitionType}
                onChange={(event) =>
                  setCareerTransitionType(event.target.value)
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="level_promotion">Level promotion</option>
                <option value="senior_ic_path">Senior specialist path</option>
                <option value="management_path">Management path</option>
                <option value="leadership_path">Leadership path</option>
                <option value="lateral_adjacent">Lateral / adjacent</option>
                <option value="cross_functional">Cross-functional</option>
                <option value="recovery_reposition">Recovery / reposition</option>
              </select>
              <select
                aria-label="Career track"
                value={careerTrack}
                onChange={(event) => setCareerTrack(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="individual_contributor">Individual contributor</option>
                <option value="management">Management</option>
                <option value="leadership">Leadership</option>
                <option value="executive">Executive</option>
                <option value="cross_functional">Cross-functional</option>
              </select>
              <Textarea
                value={careerAspiration}
                onChange={(event) => setCareerAspiration(event.target.value)}
                placeholder="Why this path matters to the person"
              />
              <Textarea
                value={careerBusinessNeed}
                onChange={(event) => setCareerBusinessNeed(event.target.value)}
                placeholder="Real institutional need this path could serve"
              />
              <select
                aria-label="Target seat availability"
                value={careerSeatAvailability}
                onChange={(event) =>
                  setCareerSeatAvailability(event.target.value)
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="unknown">Seat availability unknown</option>
                <option value="available">Activated seat available</option>
                <option value="unavailable">No seat currently available</option>
                <option value="not_required">No new seat required</option>
              </select>
              <Input
                type="date"
                value={careerReviewAt}
                onChange={(event) => setCareerReviewAt(event.target.value)}
                aria-label="Career path review date"
              />
              <Textarea
                value={careerCriteria}
                onChange={(event) => setCareerCriteria(event.target.value)}
                placeholder="Observable transition criteria"
              />
              <Textarea
                value={careerTraining}
                onChange={(event) => setCareerTraining(event.target.value)}
                placeholder="Training or developmental assignment"
              />
              <Textarea
                value={careerProof}
                onChange={(event) => setCareerProof(event.target.value)}
                placeholder="Evidence required before endorsement"
              />
              <div className="lg:col-span-2">
                <WorkforceReferencePicker
                  title="Verified transition evidence"
                  items={verifiedEvidence}
                  selected={careerEvidenceIds}
                  onToggle={(id) =>
                    toggle(id, careerEvidenceIds, setCareerEvidenceIds)
                  }
                  empty="Evidence can be attached before the path becomes evidence-ready."
                />
              </div>
              <Button
                className="lg:col-span-2"
                disabled={
                  !careerSeatId ||
                  careerTargetRole.trim().length < 3 ||
                  careerAspiration.trim().length < 3 ||
                  careerCriteria.trim().length < 3 ||
                  careerProof.trim().length < 3 ||
                  careerCreate.isPending ||
                  !effectiveClasses.has("execute")
                }
                onClick={() => careerCreate.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Propose career path
              </Button>
            </div>
          </details>
          <div className="space-y-3">
            {(state?.careerPaths || []).map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={item.state} />
                  <Badge variant="secondary">
                    {item.careerTrack.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    {seatName(item.subjectSeatId)}
                  </Badge>
                  <Badge variant="outline">{item.origin} proposed</Badge>
                </div>
                <p className="mt-3 font-medium">{item.targetRole}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.aspirationStatement}
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="font-medium">Business need:</span>{" "}
                    {item.businessNeed || "Not yet established"}
                  </p>
                  <p>
                    <span className="font-medium">Seat:</span>{" "}
                    {item.seatAvailability.replaceAll("_", " ")}
                  </p>
                  <p>
                    <span className="font-medium">Criteria:</span>{" "}
                    {(item.transitionCriteria || []).join(" · ")}
                  </p>
                  <p>
                    <span className="font-medium">Proof:</span>{" "}
                    {(item.proofRequirements || []).join(" · ")}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextCareerPathStates(item.state)
                    .filter(
                      (nextState) =>
                        managerRole ||
                        (item.subjectSeatId === principalSeatId &&
                          nextState === "withdrawn"),
                    )
                    .map((nextState) => (
                      <Button
                        key={nextState}
                        size="sm"
                        variant="outline"
                        disabled={
                          careerUpdate.isPending ||
                          !effectiveClasses.has(
                            nextState === "endorsed"
                              ? "approve"
                              : nextState === "withdrawn" && !managerRole
                                ? "execute"
                                : "decide",
                          )
                        }
                        onClick={() =>
                          careerUpdate.mutate({
                            id: item.id,
                            state: nextState,
                          })
                        }
                      >
                        {nextState.replaceAll("_", " ")}
                      </Button>
                    ))}
                </div>
              </div>
            ))}
            {!(state?.careerPaths || []).length && (
              <p className="text-sm text-muted-foreground">
                No career or mobility hypothesis is visible in this role scope.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Development plans</CardTitle>
          <CardDescription>
            Convert a verified capability gap into actions, success evidence,
            and a review date. Completion requires verified evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              Draft a development plan
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <select
                aria-label="Development subject seat"
                value={developmentSeatId}
                onChange={(event) => setDevelopmentSeatId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose role</option>
                {seats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.title}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={developmentReviewAt}
                onChange={(event) => setDevelopmentReviewAt(event.target.value)}
                aria-label="Development review date"
              />
              <Input
                value={developmentTarget}
                onChange={(event) => setDevelopmentTarget(event.target.value)}
                placeholder="Target role or level"
              />
              <Input
                value={developmentGap}
                onChange={(event) => setDevelopmentGap(event.target.value)}
                placeholder="Capability or proof gap"
              />
              <Textarea
                value={developmentAction}
                onChange={(event) => setDevelopmentAction(event.target.value)}
                placeholder="Developmental assignment, training, or coaching action"
              />
              <Textarea
                value={developmentSuccess}
                onChange={(event) => setDevelopmentSuccess(event.target.value)}
                placeholder="Observable success evidence"
              />
              <div className="lg:col-span-2">
                <WorkforceReferencePicker
                  title="Existing verified evidence"
                  items={verifiedEvidence}
                  selected={developmentEvidenceIds}
                  onToggle={(id) =>
                    toggle(
                      id,
                      developmentEvidenceIds,
                      setDevelopmentEvidenceIds,
                    )
                  }
                  empty="Evidence can be attached later before completion."
                />
              </div>
              <Button
                className="lg:col-span-2"
                disabled={
                  !developmentSeatId ||
                  (!developmentGap.trim() && !developmentAction.trim()) ||
                  developmentCreate.isPending ||
                  !effectiveClasses.has("execute")
                }
                onClick={() => developmentCreate.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Draft development plan
              </Button>
            </div>
          </details>
          <div className="space-y-3">
            {(state?.developmentPlans || []).map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={item.state} />
                  <Badge variant="outline">
                    {seatName(item.subjectSeatId)}
                  </Badge>
                </div>
                <p className="mt-3 font-medium">
                  {item.targetRole || "Current-role development"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(item.capabilityGaps || []).join(" · ") ||
                    (item.developmentActions || []).join(" · ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextDevelopmentPlanStates(item.state).map((nextState) => (
                    <Button
                      key={nextState}
                      size="sm"
                      variant="outline"
                      disabled={
                        developmentUpdate.isPending ||
                        !(nextState === "completed"
                          ? effectiveClasses.has("approve")
                          : effectiveClasses.has("decide"))
                      }
                      onClick={() =>
                        developmentUpdate.mutate({
                          id: item.id,
                          state: nextState,
                        })
                      }
                    >
                      {nextState.replaceAll("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {!(state?.developmentPlans || []).length && (
              <p className="text-sm text-muted-foreground">
                No development plan is visible in this role scope.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {state?.canManageSuccession && (
        <Card>
          <CardHeader>
            <CardTitle>Succession hypotheses</CardTitle>
            <CardDescription>
              Maintain continuously revisable bench state for critical seats.
              Readiness is a governed hypothesis; “ready” and “selected” require
              positive readiness and verified evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">
                Open a succession hypothesis
              </summary>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <select
                  aria-label="Critical seat"
                  value={criticalSeatId}
                  onChange={(event) => setCriticalSeatId(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Critical seat</option>
                  {seats.map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      {seat.title}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Candidate seat"
                  value={candidateSeatId}
                  onChange={(event) => setCandidateSeatId(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">External / no candidate</option>
                  {seats
                    .filter((seat) => seat.id !== criticalSeatId)
                    .map((seat) => (
                      <option key={seat.id} value={seat.id}>
                        {seat.title}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Succession readiness"
                  value={successionReadiness}
                  onChange={(event) =>
                    setSuccessionReadiness(event.target.value)
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="unassessed">Unassessed</option>
                  <option value="ready_now">Ready now</option>
                  <option value="within_6_months">Within 6 months</option>
                  <option value="within_12_months">Within 12 months</option>
                  <option value="within_18_months">Within 18 months</option>
                  <option value="not_ready">Not ready</option>
                </select>
                <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={externalHiringRequired}
                    onChange={(event) =>
                      setExternalHiringRequired(event.target.checked)
                    }
                  />
                  External hiring may be required
                </label>
                <Textarea
                  className="lg:col-span-2"
                  value={successionRationale}
                  onChange={(event) =>
                    setSuccessionRationale(event.target.value)
                  }
                  placeholder="Why this seat is critical and why this candidate/readiness hypothesis is justified"
                />
                <Input
                  value={successionGap}
                  onChange={(event) => setSuccessionGap(event.target.value)}
                  placeholder="Missing readiness proof"
                />
                <Input
                  value={successionAssignment}
                  onChange={(event) =>
                    setSuccessionAssignment(event.target.value)
                  }
                  placeholder="Assignment that could close the gap"
                />
                <div className="lg:col-span-2">
                  <WorkforceReferencePicker
                    title="Verified readiness evidence"
                    items={verifiedEvidence}
                    selected={successionEvidenceIds}
                    onToggle={(id) =>
                      toggle(
                        id,
                        successionEvidenceIds,
                        setSuccessionEvidenceIds,
                      )
                    }
                    empty="Evidence can be added while the hypothesis remains unassessed."
                  />
                </div>
                <Button
                  className="lg:col-span-2"
                  disabled={
                    !criticalSeatId ||
                    successionRationale.trim().length < 3 ||
                    successionCreate.isPending ||
                    !effectiveClasses.has("decide")
                  }
                  onClick={() => successionCreate.mutate()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Record hypothesis
                </Button>
              </div>
            </details>
            <div className="space-y-3">
              {(state?.successionHypotheses || []).map((item: JsonRecord) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge state={item.state} />
                    <Badge variant="outline">
                      {seatName(item.criticalSeatId)}
                    </Badge>
                    <Badge variant="secondary">
                      {item.readinessWindow.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-3 font-medium">
                    Candidate: {seatName(item.candidateSeatId)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.rationale}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nextSuccessionStates(item.state).map((nextState) => (
                      <Button
                        key={nextState}
                        size="sm"
                        variant="outline"
                        disabled={
                          successionUpdate.isPending ||
                          !(nextState === "selected"
                            ? effectiveClasses.has("approve")
                            : effectiveClasses.has("decide"))
                        }
                        onClick={() =>
                          successionUpdate.mutate({
                            id: item.id,
                            state: nextState,
                          })
                        }
                      >
                        {nextState.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {!(state?.successionHypotheses || []).length && (
                <p className="text-sm text-muted-foreground">
                  No succession hypothesis is visible in this management scope.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Workforce diagnosis</CardTitle>
          <CardDescription>
            Ask the role-bound assistant to separate person, role, process,
            management, capacity, and fit explanations before recommending
            action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() =>
              askAssistant(
                `Inspect the workforce state visible to my ${role.replaceAll("_", " ")} role. Identify the highest-value review, development, capacity, management, or succession exception. Preserve employee privacy, cite the visible evidence, and recommend only an action inside my authority.`,
              )
            }
          >
            <MessagesSquare className="mr-2 h-4 w-4" />
            Ask {assistantName}
          </Button>
        </CardContent>
      </Card>
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Transparent, role-bound workforce evidence</AlertTitle>
        <AlertDescription>
          Employees see their own role state and may request correction.
          Managers see their reporting scope. Executives receive authorized
          rollups. No hidden psychological profiling, private-life inference,
          passive activity surveillance, or automatic promotion/termination is
          created here.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function WorkforceReferencePicker({
  title,
  items,
  selected,
  onToggle,
  empty,
}: {
  title: string;
  items: JsonRecord[];
  selected: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="eos-label">{title}</p>
      <div className="mt-2 max-h-32 space-y-2 overflow-auto">
        {items.slice(0, 20).map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
            />
            <span>
              {item.title}
              <span className="block text-xs text-muted-foreground">
                {item.verificationState ||
                  item.state ||
                  item.recordType ||
                  "available"}
              </span>
            </span>
          </label>
        ))}
        {!items.length && (
          <p className="text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}

function IntegrationBindingEditor({
  draft,
  setDraft,
  verifiedEvidence,
  saving,
  canSave,
  onSave,
  onCancel,
}: {
  draft: JsonRecord;
  setDraft: (draft: JsonRecord) => void;
  verifiedEvidence: JsonRecord[];
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const update = (field: string, value: unknown) =>
    setDraft({ ...draft, [field]: value });
  const selectedEvidence = (draft.evidenceIds || []) as string[];
  const textFields = [
    ["Binding name", "name", "Provider to EOS binding"],
    ["Provider key", "providerKey", "stripe"],
    [
      "Provider account/resource reference",
      "providerAccountReference",
      "Safe provider account or workspace ID",
    ],
    ["Adapter reference", "adapterReference", "Module, service, or endpoint"],
    ["Adapter version", "adapterVersion", "1.0.0"],
    ["Transport", "transport", "HTTPS + OAuth 2.0"],
    [
      "Provider administrator reference",
      "administratorReference",
      "Safe identity or admin-record reference",
    ],
    [
      "Credential reference",
      "credentialReference",
      "op://vault/item/field — reference only",
    ],
    ["Latency budget (ms)", "latencyBudgetMs", "2000"],
    ["Timeout (ms)", "timeoutMs", "10000"],
    ["Cost model", "costModel", "Plan, marginal cost, and budget owner"],
  ] as const;
  const textAreas = [
    ["Exact account scope", "accountScope", "Tenant, resources, and environments"],
    [
      "Execution authority",
      "executionAuthority",
      "Authority Grant, approvals, and prohibited effects",
    ],
    [
      "Native permissions (one per line)",
      "nativePermissionsText",
      "contacts.read\ncontacts.write",
    ],
    [
      "Allowed operations (one per line)",
      "operationsText",
      "contact.upsert\nopportunity.advance",
    ],
    [
      "Expected events (one per line)",
      "expectedEventsText",
      "payment.succeeded\npayment.failed",
    ],
    [
      "Evidence requirements (one per line)",
      "evidenceRequirementsText",
      "Provider receipt\nReconciliation receipt",
    ],
    ["Rate-limit policy", "rateLimitPolicy", "Quota, budget, and backpressure"],
    [
      "Idempotency strategy",
      "idempotencyStrategy",
      "Stable key, retention window, duplicate behavior",
    ],
    ["Retry policy", "retryPolicy", "Bounded attempts and terminal behavior"],
    [
      "Cancellation behavior",
      "cancellationBehavior",
      "Before and after provider dispatch",
    ],
    ["Redaction policy", "redactionPolicy", "Fields masked in logs and evidence"],
    ["Test capability", "testCapability", "Sandbox, fixture, or bounded probe"],
    [
      "Revocation procedure",
      "revocationProcedure",
      "Revoke, suspend, rotate reference, verify closure",
    ],
    ["Manual fallback", "manualFallback", "Safe path while unavailable"],
    [
      "Failure recovery",
      "failureRecovery",
      "Detect, contain, reconcile, restore, and assign owner",
    ],
  ] as const;
  const schemas = [
    ["Input schema", "inputSchemaText"],
    ["Output schema", "outputSchemaText"],
    ["Event schema", "eventSchemaText"],
  ] as const;
  return (
    <div className="mt-4 space-y-5 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Configure provider adapter</p>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Record identifiers and secret-manager references only. Never paste
            an API key, token, signing secret, password, or private key.
          </p>
        </div>
        <Badge variant="outline">Configuration v{draft.configurationVersion}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {textFields.map(([label, field, placeholder]) => (
          <label key={field} className="space-y-1 text-xs font-medium">
            <span>{label}</span>
            <Input
              aria-label={label}
              value={String(draft[field] || "")}
              onChange={(event) => update(field, event.target.value)}
              placeholder={placeholder}
            />
          </label>
        ))}
        <label className="space-y-1 text-xs font-medium">
          <span>Adapter kind</span>
          <select
            aria-label="Adapter kind"
            value={String(draft.adapterKind || "oauth")}
            onChange={(event) => update("adapterKind", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {[
              "oauth",
              "api_key",
              "webhook",
              "signed_https",
              "service_account",
              "database",
              "file_exchange",
              "manual",
              "native",
            ].map((kind) => (
              <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {textAreas.map(([label, field, placeholder]) => (
          <label key={field} className="space-y-1 text-xs font-medium">
            <span>{label}</span>
            <Textarea
              aria-label={label}
              value={String(draft[field] || "")}
              onChange={(event) => update(field, event.target.value)}
              placeholder={placeholder}
              className="min-h-24"
            />
          </label>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {schemas.map(([label, field]) => (
          <label key={field} className="space-y-1 text-xs font-medium">
            <span>{label} (JSON object)</span>
            <Textarea
              aria-label={`${label} JSON`}
              value={String(draft[field] || "")}
              onChange={(event) => update(field, event.target.value)}
              placeholder={'{\n  "type": "object"\n}'}
              className="min-h-32 font-mono text-xs"
            />
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          <span>Replacement status</span>
          <select
            aria-label="Replacement status"
            value={String(draft.replacementStatus || "unknown")}
            onChange={(event) => update("replacementStatus", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {["unknown", "keep", "integrate", "migrate", "replace", "retire"].map(
              (state) => <option key={state} value={state}>{state}</option>,
            )}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Parity state</span>
          <select
            aria-label="Parity state"
            value={String(draft.parityState || "not_tested")}
            onChange={(event) => update("parityState", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {["not_tested", "test_planned", "passing", "failing", "accepted_exception"].map((state) => (
              <option key={state} value={state}>{state.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-medium">Verified configuration evidence</p>
        <select
          aria-label="Add verified integration evidence"
          value=""
          onChange={(event) => {
            if (event.target.value)
              update("evidenceIds", [
                ...Array.from(
                  new Set([...selectedEvidence, event.target.value]),
                ),
              ]);
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Add verified evidence</option>
          {verifiedEvidence
            .filter((item) => !selectedEvidence.includes(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {selectedEvidence.map((id) => {
            const item = verifiedEvidence.find((candidate) => candidate.id === id);
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  update("evidenceIds", selectedEvidence.filter((value) => value !== id))
                }
              >
                {item?.title || id} ×
              </Button>
            );
          })}
          {!selectedEvidence.length && (
            <span className="text-xs text-muted-foreground">No verified evidence attached.</span>
          )}
        </div>
      </div>

      <label className="space-y-1 text-xs font-medium">
        <span>Change summary</span>
        <Textarea
          aria-label="Integration configuration change summary"
          value={String(draft.changeSummary || "")}
          onChange={(event) => update("changeSummary", event.target.value)}
          placeholder="What changed, why, and which authority approved it"
        />
      </label>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Immutable configuration history ({(draft.configurationHistory || []).length})
        </summary>
        <div className="mt-3 space-y-2">
          {(draft.configurationHistory || []).map((revision: JsonRecord) => (
            <div key={revision.id} className="rounded-md bg-background p-3 text-xs">
              <p className="font-medium">v{revision.configurationVersion} · {revision.changeSummary}</p>
              <p className="mt-1 text-muted-foreground">
                {new Date(revision.createdAt).toLocaleString()} · trace {revision.traceId}
              </p>
            </div>
          ))}
          {!(draft.configurationHistory || []).length && (
            <p className="text-xs text-muted-foreground">No revision recorded yet.</p>
          )}
        </div>
      </details>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!canSave || saving} onClick={onSave}>
          {saving ? "Saving…" : "Save governed configuration"}
        </Button>
      </div>
    </div>
  );
}

function SystemsRegistryInstrument({
  root,
  state,
  loading,
  error,
  refetch,
  seats,
  authorityGrants,
  packets,
  evidence,
  authorityClasses: effectiveClasses,
  showError,
}: {
  root: string;
  state?: JsonRecord;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
  seats: JsonRecord[];
  authorityGrants: JsonRecord[];
  packets: JsonRecord[];
  evidence: JsonRecord[];
  authorityClasses: Set<string>;
  showError: (action: string, error: unknown) => void;
}) {
  const { toast } = useToast();
  const [systemName, setSystemName] = useState("");
  const [systemType, setSystemType] = useState("application");
  const [systemCapability, setSystemCapability] = useState("");
  const [systemDataDomain, setSystemDataDomain] = useState("");
  const [systemAuthorityField, setSystemAuthorityField] = useState("");
  const [systemReplacement, setSystemReplacement] = useState("unknown");
  const [systemEvidenceId, setSystemEvidenceId] = useState("");
  const [bindingName, setBindingName] = useState("");
  const [bindingSystemId, setBindingSystemId] = useState("");
  const [bindingProvider, setBindingProvider] = useState("");
  const [bindingAdapterKind, setBindingAdapterKind] = useState("oauth");
  const [bindingAdapterRef, setBindingAdapterRef] = useState("");
  const [bindingAccount, setBindingAccount] = useState("");
  const [bindingScope, setBindingScope] = useState("");
  const [bindingPermission, setBindingPermission] = useState("");
  const [bindingCredentialRef, setBindingCredentialRef] = useState("");
  const [bindingAuthority, setBindingAuthority] = useState("");
  const [bindingOperation, setBindingOperation] = useState("");
  const [bindingFallback, setBindingFallback] = useState("");
  const [bindingRecovery, setBindingRecovery] = useState("");
  const [bindingEvidenceId, setBindingEvidenceId] = useState("");
  const [bindingEdit, setBindingEdit] = useState<JsonRecord | null>(null);
  const [healthBindingId, setHealthBindingId] = useState("");
  const [healthState, setHealthState] = useState("healthy");
  const [healthCheckType, setHealthCheckType] = useState("manual_test");
  const [healthSummary, setHealthSummary] = useState("");
  const [healthEvidenceId, setHealthEvidenceId] = useState("");
  const [entitlementSystemId, setEntitlementSystemId] = useState("");
  const [entitlementBindingId, setEntitlementBindingId] = useState("");
  const [entitlementSeatId, setEntitlementSeatId] = useState("");
  const [entitlementResource, setEntitlementResource] = useState("");
  const [entitlementPermission, setEntitlementPermission] = useState("");
  const [entitlementCredentialRef, setEntitlementCredentialRef] = useState("");
  const [entitlementAuthorityGrantId, setEntitlementAuthorityGrantId] =
    useState("");
  const [entitlementMastery, setEntitlementMastery] = useState("unverified");
  const [entitlementEvidenceId, setEntitlementEvidenceId] = useState("");
  const [automationName, setAutomationName] = useState("");
  const [automationBindingId, setAutomationBindingId] = useState("");
  const [automationTrigger, setAutomationTrigger] = useState("");
  const [automationAction, setAutomationAction] = useState("");
  const [automationFailure, setAutomationFailure] = useState("");
  const [automationFallback, setAutomationFallback] = useState("");
  const [automationPacketId, setAutomationPacketId] = useState("");
  const [automationEvidenceId, setAutomationEvidenceId] = useState("");
  const verifiedEvidence = evidence.filter(
    (item) => item.verificationState === "verified",
  );
  const systems = state?.systems || [];
  const bindings = state?.bindings || [];
  const entitlements = state?.entitlements || [];
  const automations = state?.automations || [];
  const observations = state?.healthObservations || [];
  const after = async (title: string) => {
    await refetch();
    toast({ title });
  };
  const systemCreate = useMutation({
    mutationFn: () =>
      requestJson("POST", `${root}/systems`, {
        name: systemName,
        systemType,
        capabilities: [systemCapability],
        dataDomains: [systemDataDomain],
        authoritativeFields: [systemAuthorityField],
        replacementIntent: systemReplacement,
        evidenceIds: systemEvidenceId ? [systemEvidenceId] : [],
      }),
    onSuccess: async () => {
      setSystemName("");
      setSystemCapability("");
      setSystemDataDomain("");
      setSystemAuthorityField("");
      await after("System registered");
    },
    onError: (failure) => showError("System registration", failure),
  });
  const systemTransition = useMutation({
    mutationFn: ({
      id,
      lifecycleState,
    }: {
      id: string;
      lifecycleState: string;
    }) => requestJson("PATCH", `${root}/systems/${id}`, { lifecycleState }),
    onSuccess: async () => after("System lifecycle updated"),
    onError: (failure) => showError("System lifecycle", failure),
  });
  const bindingCreate = useMutation({
    mutationFn: () =>
      requestJson("POST", `${root}/integration-bindings`, {
        name: bindingName,
        toSystemId: bindingSystemId,
        providerKey: bindingProvider,
        providerAccountReference: bindingAccount,
        adapterKind: bindingAdapterKind,
        adapterReference: bindingAdapterRef,
        connectionState: bindingAccount ? "configured" : "unconfigured",
        accountScope: bindingScope,
        nativePermissions: bindingPermission ? [bindingPermission] : [],
        credentialReference: bindingCredentialRef || undefined,
        executionAuthority: bindingAuthority,
        operations: bindingOperation ? [bindingOperation] : [],
        expectedEvents: [],
        manualFallback: bindingFallback,
        failureRecovery: bindingRecovery,
        evidenceIds: bindingEvidenceId ? [bindingEvidenceId] : [],
      }),
    onSuccess: async () => {
      setBindingName("");
      setBindingProvider("");
      setBindingAdapterRef("");
      setBindingAccount("");
      setBindingScope("");
      setBindingPermission("");
      setBindingCredentialRef("");
      setBindingAuthority("");
      setBindingOperation("");
      setBindingFallback("");
      setBindingRecovery("");
      await after("Integration binding registered");
    },
    onError: (failure) => showError("Integration registration", failure),
  });
  const bindingTransition = useMutation({
    mutationFn: ({
      id,
      lifecycleState,
      expectedConfigurationVersion,
    }: {
      id: string;
      lifecycleState: string;
      expectedConfigurationVersion: number;
    }) =>
      requestJson("PATCH", `${root}/integration-bindings/${id}`, {
        lifecycleState,
        expectedConfigurationVersion,
      }),
    onSuccess: async () => after("Integration lifecycle updated"),
    onError: (failure) => showError("Integration lifecycle", failure),
  });
  const bindingConfigure = useMutation({
    mutationFn: () => {
      if (!bindingEdit) throw new Error("Choose an integration binding first.");
      const parseSchema = (label: string, value: unknown) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(value || "{}"));
        } catch {
          throw new Error(`${label} must be valid JSON.`);
        }
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
          throw new Error(`${label} must be a JSON object.`);
        return parsed;
      };
      const lines = (value: unknown) =>
        String(value || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
      const optionalPositiveNumber = (label: string, value: unknown) => {
        if (!String(value || "").trim()) return undefined;
        const number = Number(value);
        if (!Number.isInteger(number) || number <= 0)
          throw new Error(`${label} must be a positive whole number.`);
        return number;
      };
      return requestJson(
        "PATCH",
        `${root}/integration-bindings/${bindingEdit.id}`,
        {
          providerKey: String(bindingEdit.providerKey || "").trim(),
          providerAccountReference: String(
            bindingEdit.providerAccountReference || "",
          ).trim(),
          adapterKind: bindingEdit.adapterKind,
          adapterReference: String(bindingEdit.adapterReference || "").trim(),
          adapterVersion: String(bindingEdit.adapterVersion || "").trim(),
          transport: String(bindingEdit.transport || "").trim(),
          administratorReference: String(
            bindingEdit.administratorReference || "",
          ).trim(),
          accountScope: String(bindingEdit.accountScope || "").trim(),
          nativePermissions: lines(bindingEdit.nativePermissionsText),
          credentialReference:
            String(bindingEdit.credentialReference || "").trim() || null,
          executionAuthority: String(
            bindingEdit.executionAuthority || "",
          ).trim(),
          operations: lines(bindingEdit.operationsText),
          expectedEvents: lines(bindingEdit.expectedEventsText),
          inputSchema: parseSchema(
            "Input schema",
            bindingEdit.inputSchemaText,
          ),
          outputSchema: parseSchema(
            "Output schema",
            bindingEdit.outputSchemaText,
          ),
          eventSchema: parseSchema(
            "Event schema",
            bindingEdit.eventSchemaText,
          ),
          costModel: String(bindingEdit.costModel || "").trim(),
          latencyBudgetMs: optionalPositiveNumber(
            "Latency budget",
            bindingEdit.latencyBudgetMs,
          ),
          rateLimitPolicy: String(
            bindingEdit.rateLimitPolicy || "",
          ).trim(),
          idempotencyStrategy: String(
            bindingEdit.idempotencyStrategy || "",
          ).trim(),
          retryPolicy: String(bindingEdit.retryPolicy || "").trim(),
          timeoutMs: optionalPositiveNumber(
            "Timeout",
            bindingEdit.timeoutMs,
          ),
          cancellationBehavior: String(
            bindingEdit.cancellationBehavior || "",
          ).trim(),
          redactionPolicy: String(
            bindingEdit.redactionPolicy || "",
          ).trim(),
          evidenceRequirements: lines(bindingEdit.evidenceRequirementsText),
          testCapability: String(bindingEdit.testCapability || "").trim(),
          revocationProcedure: String(
            bindingEdit.revocationProcedure || "",
          ).trim(),
          manualFallback: String(bindingEdit.manualFallback || "").trim(),
          failureRecovery: String(bindingEdit.failureRecovery || "").trim(),
          replacementStatus: bindingEdit.replacementStatus,
          parityState: bindingEdit.parityState,
          evidenceIds: bindingEdit.evidenceIds || [],
          expectedConfigurationVersion: Number(
            bindingEdit.configurationVersion,
          ),
          changeSummary: String(bindingEdit.changeSummary || "").trim(),
        },
      );
    },
    onSuccess: async () => {
      setBindingEdit(null);
      await after("Integration configuration saved");
    },
    onError: (failure) => showError("Integration configuration", failure),
  });
  const healthCreate = useMutation({
    mutationFn: () =>
      requestJson("POST", `${root}/integration-health-observations`, {
        integrationBindingId: healthBindingId,
        healthState,
        checkType: healthCheckType,
        summary: healthSummary,
        evidenceIds: [healthEvidenceId],
      }),
    onSuccess: async () => {
      setHealthSummary("");
      await after("Health observation recorded");
    },
    onError: (failure) => showError("Health observation", failure),
  });
  const entitlementCreate = useMutation({
    mutationFn: () =>
      requestJson("POST", `${root}/tool-entitlements`, {
        systemId: entitlementSystemId,
        integrationBindingId: entitlementBindingId || undefined,
        granteeSeatId: entitlementSeatId,
        providerResourceReference: entitlementResource,
        nativePermissions: [entitlementPermission],
        authorityGrantId: entitlementAuthorityGrantId || undefined,
        credentialReference: entitlementCredentialRef || undefined,
        masteryState: entitlementMastery,
        state: "proposed",
        evidenceIds: entitlementEvidenceId ? [entitlementEvidenceId] : [],
      }),
    onSuccess: async () => {
      setEntitlementResource("");
      setEntitlementPermission("");
      setEntitlementCredentialRef("");
      await after("Tool entitlement proposed");
    },
    onError: (failure) => showError("Tool entitlement", failure),
  });
  const entitlementTransition = useMutation({
    mutationFn: ({ id, state: nextState }: { id: string; state: string }) =>
      requestJson("PATCH", `${root}/tool-entitlements/${id}`, {
        state: nextState,
      }),
    onSuccess: async () => after("Entitlement lifecycle updated"),
    onError: (failure) => showError("Entitlement lifecycle", failure),
  });
  const automationCreate = useMutation({
    mutationFn: () =>
      requestJson("POST", `${root}/automations`, {
        name: automationName,
        integrationBindingId: automationBindingId,
        triggerContract: automationTrigger,
        actionContract: automationAction,
        consequence: "routine",
        failureBehavior: automationFailure,
        manualFallback: automationFallback,
        workPacketId: automationPacketId || undefined,
        evidenceIds: automationEvidenceId ? [automationEvidenceId] : [],
      }),
    onSuccess: async () => {
      setAutomationName("");
      setAutomationTrigger("");
      setAutomationAction("");
      setAutomationFailure("");
      setAutomationFallback("");
      await after("Automation contract drafted");
    },
    onError: (failure) => showError("Automation contract", failure),
  });
  const automationTransition = useMutation({
    mutationFn: ({
      id,
      lifecycleState,
    }: {
      id: string;
      lifecycleState: string;
    }) => requestJson("PATCH", `${root}/automations/${id}`, { lifecycleState }),
    onSuccess: async () => after("Automation lifecycle updated"),
    onError: (failure) => showError("Automation lifecycle", failure),
  });
  const openBindingEditor = (item: JsonRecord) =>
    setBindingEdit({
      ...item,
      nativePermissionsText: (item.nativePermissions || []).join("\n"),
      operationsText: (item.operations || []).join("\n"),
      expectedEventsText: (item.expectedEvents || []).join("\n"),
      evidenceRequirementsText: (item.evidenceRequirements || []).join("\n"),
      inputSchemaText: JSON.stringify(item.inputSchema || {}, null, 2),
      outputSchemaText: JSON.stringify(item.outputSchema || {}, null, 2),
      eventSchemaText: JSON.stringify(item.eventSchema || {}, null, 2),
      latencyBudgetMs: item.latencyBudgetMs || "",
      timeoutMs: item.timeoutMs || "",
      changeSummary: "Provider adapter configuration reviewed",
    });
  if (loading)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading the governed systems graph…
        </CardContent>
      </Card>
    );
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Systems registry unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          The live provider cards remain separate, but canonical architecture
          state could not be loaded.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Fact label="Systems" value={String(systems.length)} />
        <Fact label="Bindings" value={String(bindings.length)} />
        <Fact
          label="Active entitlements"
          value={String(
            entitlements.filter((item: JsonRecord) => item.state === "active")
              .length,
          )}
        />
        <Fact
          label="Enabled automations"
          value={String(
            automations.filter(
              (item: JsonRecord) => item.lifecycleState === "enabled",
            ).length,
          )}
        />
        <Fact
          label="Open incidents"
          value={String(
            (state?.incidents || []).filter(
              (item: JsonRecord) =>
                !["satisfied_closed", "superseded"].includes(item.state),
            ).length,
          )}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Enterprise architecture inventory</CardTitle>
          <CardDescription>
            Identify systems, carried capabilities and data, authoritative
            fields, ownership, evidence, and replacement intent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              aria-label="System name"
              value={systemName}
              onChange={(event) => setSystemName(event.target.value)}
              placeholder="Customer CRM"
            />
            <select
              aria-label="System type"
              value={systemType}
              onChange={(event) => setSystemType(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="system">System</option>
              <option value="application">Application</option>
              <option value="service">Service</option>
              <option value="tool">Tool</option>
              <option value="data_platform">Data platform</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="provider">Provider</option>
            </select>
            <Input
              aria-label="System capability"
              value={systemCapability}
              onChange={(event) => setSystemCapability(event.target.value)}
              placeholder="Capability carried"
            />
            <Input
              aria-label="System data domain"
              value={systemDataDomain}
              onChange={(event) => setSystemDataDomain(event.target.value)}
              placeholder="Data domain"
            />
            <Input
              aria-label="System authoritative field"
              value={systemAuthorityField}
              onChange={(event) => setSystemAuthorityField(event.target.value)}
              placeholder="Authoritative fields"
            />
            <select
              aria-label="System replacement intent"
              value={systemReplacement}
              onChange={(event) => setSystemReplacement(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="unknown">Unknown/manual</option>
              <option value="keep">Keep</option>
              <option value="integrate">Integrate</option>
              <option value="migrate">Migrate</option>
              <option value="replace">Replace</option>
              <option value="retire">Retire</option>
            </select>
            <EvidenceSelect
              label="System evidence"
              value={systemEvidenceId}
              onChange={setSystemEvidenceId}
              evidence={verifiedEvidence}
            />
            <Button
              disabled={
                !effectiveClasses.has("execute") ||
                systemCreate.isPending ||
                systemName.trim().length < 2 ||
                !systemCapability.trim() ||
                !systemDataDomain.trim() ||
                !systemAuthorityField.trim()
              }
              onClick={() => systemCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Register system
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {systems.map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={item.lifecycleState} />
                  <Badge variant="outline">
                    {item.systemType.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="secondary">{item.replacementIntent}</Badge>
                </div>
                <p className="mt-3 font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Authority:{" "}
                  {(item.authoritativeFields || []).join(", ") || "unknown"} ·
                  Data: {(item.dataDomains || []).join(", ") || "unknown"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextSystemLifecycleStates(item.lifecycleState).map(
                    (next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={
                          systemTransition.isPending ||
                          !effectiveClasses.has(
                            next === "active" ? "approve" : "decide",
                          )
                        }
                        onClick={() =>
                          systemTransition.mutate({
                            id: item.id,
                            lifecycleState: next,
                          })
                        }
                      >
                        {next.replaceAll("_", " ")}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Adapter and access-path registry</CardTitle>
          <CardDescription>
            Map provider account scope, native permission, credential reference,
            execution authority, operations, health, fallback, recovery, and
            replacement state. Secret values never belong here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              aria-label="Integration name"
              value={bindingName}
              onChange={(event) => setBindingName(event.target.value)}
              placeholder="CRM qualification adapter"
            />
            <select
              aria-label="Integration system"
              value={bindingSystemId}
              onChange={(event) => setBindingSystemId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose system endpoint</option>
              {systems.map((item: JsonRecord) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Input
              aria-label="Integration provider"
              value={bindingProvider}
              onChange={(event) => setBindingProvider(event.target.value)}
              placeholder="Provider key"
            />
            <select
              aria-label="Integration adapter kind"
              value={bindingAdapterKind}
              onChange={(event) => setBindingAdapterKind(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="oauth">OAuth</option>
              <option value="api_key">API key</option>
              <option value="webhook">Webhook</option>
              <option value="signed_https">Signed HTTPS</option>
              <option value="service_account">Service account</option>
              <option value="database">Database</option>
              <option value="file_exchange">File exchange</option>
              <option value="manual">Manual</option>
              <option value="native">Native</option>
            </select>
            <Input
              aria-label="Integration adapter reference"
              value={bindingAdapterRef}
              onChange={(event) => setBindingAdapterRef(event.target.value)}
              placeholder="Adapter/version reference"
            />
            <Input
              aria-label="Provider account reference"
              value={bindingAccount}
              onChange={(event) => setBindingAccount(event.target.value)}
              placeholder="Non-secret provider account/resource ID"
            />
            <Input
              aria-label="Integration account scope"
              value={bindingScope}
              onChange={(event) => setBindingScope(event.target.value)}
              placeholder="Exact account/resource scope"
            />
            <Input
              aria-label="Integration native permission"
              value={bindingPermission}
              onChange={(event) => setBindingPermission(event.target.value)}
              placeholder="Native permission or OAuth scope"
            />
            <Input
              aria-label="Integration credential reference"
              value={bindingCredentialRef}
              onChange={(event) => setBindingCredentialRef(event.target.value)}
              placeholder="op://vault/item/field (reference only)"
            />
            <Input
              aria-label="Integration execution authority"
              value={bindingAuthority}
              onChange={(event) => setBindingAuthority(event.target.value)}
              placeholder="Authority Grant / approval boundary"
            />
            <Input
              aria-label="Integration operation"
              value={bindingOperation}
              onChange={(event) => setBindingOperation(event.target.value)}
              placeholder="Allowed operation"
            />
            <EvidenceSelect
              label="Integration evidence"
              value={bindingEvidenceId}
              onChange={setBindingEvidenceId}
              evidence={verifiedEvidence}
            />
            <Textarea
              aria-label="Integration manual fallback"
              value={bindingFallback}
              onChange={(event) => setBindingFallback(event.target.value)}
              placeholder="Safe manual fallback"
            />
            <Textarea
              aria-label="Integration failure recovery"
              value={bindingRecovery}
              onChange={(event) => setBindingRecovery(event.target.value)}
              placeholder="Failure, retry, revocation, and recovery behavior"
            />
            <Button
              className="lg:col-span-2"
              disabled={
                !effectiveClasses.has("execute") ||
                bindingCreate.isPending ||
                !bindingSystemId ||
                bindingName.trim().length < 2 ||
                !bindingProvider.trim() ||
                !bindingAdapterRef.trim() ||
                bindingFallback.trim().length < 3 ||
                bindingRecovery.trim().length < 3
              }
              onClick={() => bindingCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Register integration binding
            </Button>
          </div>
          <div className="space-y-3">
            {bindings.map((item: JsonRecord) => {
              const latest = observations.find(
                (observation: JsonRecord) =>
                  observation.integrationBindingId === item.id,
              );
              return (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge state={item.lifecycleState} />
                    <StateBadge state={item.connectionState} />
                    <StateBadge state={item.healthState} />
                    <Badge variant="outline">
                      {item.adapterKind.replaceAll("_", " ")}
                    </Badge>
                    <Badge variant="secondary">
                      config v{item.configurationVersion}
                    </Badge>
                  </div>
                  <p className="mt-3 font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.providerKey} · {item.accountScope || "scope unknown"}{" "}
                    · {item.providerAccountReference || "account unknown"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fallback: {item.manualFallback}
                    {latest
                      ? ` · Last observed ${new Date(latest.observedAt).toLocaleString()}`
                      : " · No health observation"}
                  </p>
                  {(item.activationIssues || []).length > 0 && (
                    <Alert className="mt-3">
                      <AlertTitle>
                        Activation blocked · {item.activationIssues.length} requirement
                        {item.activationIssues.length === 1 ? "" : "s"}
                      </AlertTitle>
                      <AlertDescription>
                        {(item.activationIssues || []).join(" · ")}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={bindingEdit?.id === item.id ? "secondary" : "outline"}
                      disabled={!effectiveClasses.has("decide")}
                      onClick={() =>
                        bindingEdit?.id === item.id
                          ? setBindingEdit(null)
                          : openBindingEditor(item)
                      }
                    >
                      {bindingEdit?.id === item.id ? "Close configuration" : "Configure adapter"}
                    </Button>
                    {nextSystemLifecycleStates(item.lifecycleState).map(
                      (next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant="outline"
                          disabled={
                            bindingTransition.isPending ||
                            !effectiveClasses.has(
                              next === "active" ? "approve" : "decide",
                            )
                          }
                          onClick={() =>
                            bindingTransition.mutate({
                              id: item.id,
                              lifecycleState: next,
                              expectedConfigurationVersion: Number(
                                item.configurationVersion,
                              ),
                            })
                          }
                        >
                          {next.replaceAll("_", " ")}
                        </Button>
                      ),
                    )}
                  </div>
                  {bindingEdit?.id === item.id && (
                    <IntegrationBindingEditor
                      draft={bindingEdit!}
                      setDraft={(draft) => setBindingEdit(draft)}
                      verifiedEvidence={verifiedEvidence}
                      saving={bindingConfigure.isPending}
                      canSave={effectiveClasses.has("decide")}
                      onSave={() => bindingConfigure.mutate()}
                      onCancel={() => setBindingEdit(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health and recovery evidence</CardTitle>
            <CardDescription>
              Append an evidence-backed observation. A live-provider check is
              verified server-side for supported adapters; fixture/manual
              evidence never silently becomes provider health.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              aria-label="Health integration binding"
              value={healthBindingId}
              onChange={(event) => setHealthBindingId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose integration</option>
              {bindings.map((item: JsonRecord) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label="Health state"
                value={healthState}
                onChange={(event) => setHealthState(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="healthy">Healthy</option>
                <option value="degraded">Degraded</option>
                <option value="unavailable">Unavailable</option>
                <option value="unknown">Unknown</option>
              </select>
              <select
                aria-label="Health check type"
                value={healthCheckType}
                onChange={(event) => setHealthCheckType(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="manual_test">Manual test</option>
                <option value="fixture">Controlled fixture</option>
                <option value="recovery_test">Recovery test</option>
                <option value="parity_test">Parity test</option>
                <option value="live_provider">Live provider</option>
              </select>
            </div>
            <Textarea
              aria-label="Health observation summary"
              value={healthSummary}
              onChange={(event) => setHealthSummary(event.target.value)}
              placeholder="Observed result, failure classification, and recovery state"
            />
            <EvidenceSelect
              label="Health evidence"
              value={healthEvidenceId}
              onChange={setHealthEvidenceId}
              evidence={verifiedEvidence}
            />
            <Button
              className="w-full"
              disabled={
                !effectiveClasses.has("execute") ||
                healthCreate.isPending ||
                !healthBindingId ||
                !healthEvidenceId ||
                healthSummary.trim().length < 3
              }
              onClick={() => healthCreate.mutate()}
            >
              <Activity className="mr-2 h-4 w-4" />
              Record health observation
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tool entitlement / connection</CardTitle>
            <CardDescription>
              Bind one exact seat to one provider resource. Activation remains
              gated by native permission, Authority Grant, mastery, credential
              reference, evidence, and revocation ownership.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              aria-label="Entitlement system"
              value={entitlementSystemId}
              onChange={(event) => setEntitlementSystemId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose system</option>
              {systems.map((item: JsonRecord) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Entitlement binding"
              value={entitlementBindingId}
              onChange={(event) => setEntitlementBindingId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No binding yet</option>
              {bindings.map((item: JsonRecord) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Entitlement seat"
              value={entitlementSeatId}
              onChange={(event) => setEntitlementSeatId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose seat</option>
              {seats.map((item: JsonRecord) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <Input
              aria-label="Entitlement provider resource"
              value={entitlementResource}
              onChange={(event) => setEntitlementResource(event.target.value)}
              placeholder="Exact provider account/resource"
            />
            <Input
              aria-label="Entitlement native permission"
              value={entitlementPermission}
              onChange={(event) => setEntitlementPermission(event.target.value)}
              placeholder="Native permission"
            />
            <Input
              aria-label="Entitlement credential reference"
              value={entitlementCredentialRef}
              onChange={(event) =>
                setEntitlementCredentialRef(event.target.value)
              }
              placeholder="Secret-manager reference (never the secret)"
            />
            <select
              aria-label="Entitlement Authority Grant"
              value={entitlementAuthorityGrantId}
              onChange={(event) =>
                setEntitlementAuthorityGrantId(event.target.value)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No effective Authority Grant selected</option>
              {authorityGrants
                .filter((item) => item.state === "active")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.authorityKey || item.granteeKey}
                  </option>
                ))}
            </select>
            <select
              aria-label="Entitlement mastery"
              value={entitlementMastery}
              onChange={(event) => setEntitlementMastery(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="unverified">Mastery unverified</option>
              <option value="training">Training</option>
              <option value="qualified">Qualified</option>
              <option value="expired">Expired</option>
            </select>
            <EvidenceSelect
              label="Entitlement evidence"
              value={entitlementEvidenceId}
              onChange={setEntitlementEvidenceId}
              evidence={verifiedEvidence}
            />
            <Button
              className="w-full"
              disabled={
                !effectiveClasses.has("execute") ||
                entitlementCreate.isPending ||
                !entitlementSystemId ||
                !entitlementSeatId ||
                !entitlementResource.trim() ||
                !entitlementPermission.trim()
              }
              onClick={() => entitlementCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Propose entitlement
            </Button>
            <div className="space-y-2">
              {entitlements.map((item: JsonRecord) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {item.providerResourceReference}
                    </span>
                    <StateBadge state={item.state} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextEntitlementStates(item.state).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={
                          entitlementTransition.isPending ||
                          !effectiveClasses.has(
                            next === "active" ? "approve" : "decide",
                          )
                        }
                        onClick={() =>
                          entitlementTransition.mutate({
                            id: item.id,
                            state: next,
                          })
                        }
                      >
                        {next}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Automation control plane</CardTitle>
          <CardDescription>
            Draft trigger/action contracts and explicit failure paths.
            Enablement requires an active healthy binding, approved Work Packet,
            and verified evidence; high-consequence effects remain
            human-executed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              aria-label="Automation name"
              value={automationName}
              onChange={(event) => setAutomationName(event.target.value)}
              placeholder="Consented lead intake"
            />
            <select
              aria-label="Automation integration binding"
              value={automationBindingId}
              onChange={(event) => setAutomationBindingId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose integration</option>
              {bindings.map((item: JsonRecord) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Textarea
              aria-label="Automation trigger"
              value={automationTrigger}
              onChange={(event) => setAutomationTrigger(event.target.value)}
              placeholder="Typed trigger and scope"
            />
            <Textarea
              aria-label="Automation action"
              value={automationAction}
              onChange={(event) => setAutomationAction(event.target.value)}
              placeholder="Bounded action and expected event"
            />
            <Textarea
              aria-label="Automation failure behavior"
              value={automationFailure}
              onChange={(event) => setAutomationFailure(event.target.value)}
              placeholder="Retry, dead-letter, alert, and compensation behavior"
            />
            <Textarea
              aria-label="Automation manual fallback"
              value={automationFallback}
              onChange={(event) => setAutomationFallback(event.target.value)}
              placeholder="Safe manual fallback"
            />
            <select
              aria-label="Automation work packet"
              value={automationPacketId}
              onChange={(event) => setAutomationPacketId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No approved packet yet</option>
              {packets
                .filter((item) => item.status === "ready")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
            <EvidenceSelect
              label="Automation evidence"
              value={automationEvidenceId}
              onChange={setAutomationEvidenceId}
              evidence={verifiedEvidence}
            />
            <Button
              className="lg:col-span-2"
              disabled={
                !effectiveClasses.has("execute") ||
                automationCreate.isPending ||
                !automationBindingId ||
                automationName.trim().length < 2 ||
                automationTrigger.trim().length < 3 ||
                automationAction.trim().length < 3 ||
                automationFailure.trim().length < 3 ||
                automationFallback.trim().length < 3
              }
              onClick={() => automationCreate.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Draft automation contract
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {automations.map((item: JsonRecord) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{item.name}</span>
                  <StateBadge state={item.lifecycleState} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  When: {item.triggerContract}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Then: {item.actionContract}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextAutomationStates(item.lifecycleState).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      disabled={
                        automationTransition.isPending ||
                        !effectiveClasses.has(
                          next === "enabled" ? "approve" : "decide",
                        )
                      }
                      onClick={() =>
                        automationTransition.mutate({
                          id: item.id,
                          lifecycleState: next,
                        })
                      }
                    >
                      {next}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EvidenceSelect({
  label,
  value,
  onChange,
  evidence,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  evidence: JsonRecord[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">No verified evidence selected</option>
      {evidence.map((item) => (
        <option key={item.id} value={item.id}>
          {item.title}
        </option>
      ))}
    </select>
  );
}
