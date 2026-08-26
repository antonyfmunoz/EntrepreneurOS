import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Archive, CalendarClock, Copy, CopyPlus, DatabaseBackup, Download, FilePlus2, ListChecks, LockKeyhole, Mail, MessageSquareText, Pencil, Plus, RefreshCw, RotateCw, Save, Send, ShieldAlert, ShieldCheck, Trash2, UnlockKeyhole, UserPlus, Webhook, XCircle } from "lucide-react";
import type { NativeEsignField } from "@shared/native-esign";
import { nextRiskControlStates } from "@shared/eos-runtime";
import { NativeEsignFieldEditor } from "@/components/native-esign-field-editor";
import { NativeEsignReplacementComposer } from "@/components/native-esign-replacement-composer";
import { NativeContractLibrary } from "@/components/native-contract-library";
import { NativeContractControlCenter } from "@/components/native-contract-control-center";
import { NativeEsignComparisonView, type NativeEsignComparison } from "@/components/native-esign-comparison-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { encodeNativeEsignFieldSchema, nativeEsignErrorMessage } from "@/lib/native-esign";
import { apiBinaryRequest, apiRequest } from "@/lib/queryClient";

type DocumentVersion = {
  id: string; title: string; documentKey: string; documentVersion: string; sourceReference: string;
  sourceSha256: string; pageCount: number; fieldSchema: NativeEsignField[]; createdAt: string;
  templateVersionId?: string | null; generationSnapshot?: Record<string, unknown>;
  parentDocumentVersionId?: string | null; negotiationId?: string | null; revisionSummary?: string; revisionEvidenceSha256?: string;
  comparison?: { comparisonSha256: string; comparisonType: "operator_declared" | "generated_text"; declaredChanges: string[]; sourceSha256: string; targetSha256: string; revisionSummary: string; diffStats?: { equalLines: number; insertedLines: number; deletedLines: number; operationCount: number } } | null;
};
type Envelope = {
  id: string; documentVersionId: string; state: string; routingMode: "sequential" | "parallel";
  assuranceMode: "link" | "email_otp";
  subject: string; message: string; expiresAt: string; version: number; updatedAt: string;
  finalSha256?: string; auditSha256?: string; recoveryAgreementInstanceId?: string | null;
  templateVersionId?: string | null; counterpartyId?: string | null; workPacketId?: string | null; evidenceId?: string | null;
  clonedFromEnvelopeId?: string | null; renewalOfEnvelopeId?: string | null;
  replacesEnvelopeId?: string | null; replacedByEnvelopeId?: string | null;
  comparisonReviewSha256?: string; comparisonReviewedByUserId?: string | null; comparisonReviewedAt?: string | null;
};
type Recipient = {
  id: string; roleKey: string; routingOrder: number; signerName: string; signerEmail: string;
  routingState: "active" | "waiting" | "completed";
  state: string; deliveryState: string; deliveryAttemptCount: number; lastDeliveredAt?: string; version: number;
  identityAssuranceState: string; identityVerifiedAt?: string; completionDeliveryState: string; completionDeliveryAttemptCount: number;
  signatureMethod: string; signatureCaptureSha256: string; signatureCaptureMimeType: string; signatureCaptureSizeBytes: number; signatureCaptureWidth: number; signatureCaptureHeight: number;
  comparisonAcknowledgementSha256?: string; comparisonAcknowledgedAt?: string | null;
};
type IntegrityCheck = { id: string; state: "passed" | "failed" | "unavailable"; triggerType: string; reason: string; sourceSha256: string; finalSha256: string; auditSha256: string; eventCount: number; auditedEventCount: number; captureCount: number; failureCodes: string[]; checkSha256: string; previousCheckSha256: string; checkedAt: string };
type IntegrityProjection = { valid: boolean; state: IntegrityCheck["state"]; verifiedAt: string; sourceSha256: string; finalSha256: string; auditSha256: string; eventCount: number; auditedEventCount: number; captureCount: number; failureCodes: string[] };
type CustodyArtifact = { id: string; artifactKind: string; sha256: string; sizeBytes: number; state: string; backupState: string; retainedUntil?: string | null; lastVerifiedAt?: string | null; lastFailureCode: string; version: number };
type CustodyPolicy = { id: string; name: string; retentionDays: number; backupRequired: boolean; version: number };
type LegalHold = { id: string; reason: string; reference: string; state: string; version: number; placedAt: string; releaseReason: string };
type DeletionRequest = { id: string; state: string; reason: string; decisionReason: string; version: number; createdAt: string; failureCode: string };
type StorageCapability = { provider: string; identitySha256: string; reachable: boolean; shared: boolean; requestedEncryption: string; defaultEncryption: string; versioning: string; objectLock: string; lifecycle: string; failureCode: string };
type StorageDrill = { id: string; state: "running" | "passed" | "failed"; reason: string; primaryProvider: string; backupProvider: string; primaryIdentitySha256: string; backupIdentitySha256: string; capabilitySnapshot: { primary: StorageCapability; backup: StorageCapability }; steps: Array<{ key: string; state: "passed" | "failed"; durationMs: number; failureCode: string }>; receiptSha256: string; failureCode: string; startedAt: string; completedAt?: string | null };
type CustodySummary = { storageProvider: string; backupConfigured: boolean; policy: CustodyPolicy | null; artifacts: CustodyArtifact[]; legalHolds: LegalHold[]; activeLegalHold: LegalHold | null; deletionRequests: DeletionRequest[]; events: Array<Record<string, any>>; readiness: { policyConfigured: boolean; artifactCount: number; activeArtifactCount: number; verifiedArtifactCount: number; backupVerifiedCount: number; held: boolean } };
type Negotiation = { id: string; state: string; subject: string; version: number; resolutionSummary: string; replacementDocumentVersionId?: string | null; replacementEnvelopeId?: string | null; entries: Array<{ id: string; authorType: string; entryType: string; body: string; requestedChanges: string[]; entrySha256: string; createdAt: string }> };
type ReminderSchedule = { id: string; recipientId: string; state: string; nextReminderAt: string; intervalDays: number; maxReminders: number; sentCount: number; version: number };
type EnvelopeDetail = { envelope: Envelope; document: DocumentVersion | null; comparison: NativeEsignComparison | null; recipients: Recipient[]; events: Array<Record<string, any>>; deliveryAttempts: Array<Record<string, any>>; completionDeliveries: Array<Record<string, any>>; completionDeliveryAttempts: Array<Record<string, any>>; integrityChecks: IntegrityCheck[]; negotiations: Negotiation[]; reminderSchedules: ReminderSchedule[]; obligationPromotions: ObligationPromotion[]; custody: CustodySummary | null };
type RecipientDraft = { roleKey: string; signerName: string; signerEmail: string; routingOrder: number };
type WebhookSubscription = { id: string; endpointUrl: string; description: string; eventTypes: string[]; secretFingerprint: string; state: string; version: number; updatedAt: string };
type SigningOperations = { subscriptions: WebhookSubscription[]; webhookDeliveries: Array<Record<string, any>>; webhookAttempts: Array<Record<string, any>>; completionDeliveries: Array<Record<string, any>>; completionAttempts: Array<Record<string, any>>; integrityChecks: IntegrityCheck[] };
type WorkPacket = { id: string; title: string; status: string };
type SeatOption = { id: string; title?: string; kind?: string; agentName?: string; status?: string };
type EvidenceOption = { id: string; title?: string; verificationState?: string; evidenceType?: string; capturedAt?: string };
type ObligationReview = { id: string; stateBefore: string; stateAfter: string; ownerSeatId: string; evidenceIds: string[]; reviewNote: string; nextReviewAt?: string | null; authorityClass: string; reviewSha256: string; reviewedAt: string };
type ObligationPromotion = {
  id: string; obligationId: string; evidenceId: string; sourceExcerpt: string; sourceExcerptSha256: string; receiptSha256: string; promotedAt: string;
  obligation: { id: string; title: string; state: string; ownerSeatId: string; descriptionCauseEventImpact: string; classification: string; dueReviewAt?: string | null; evidenceIds: string[]; updatedAt: string } | null;
  ownerSeat: SeatOption | null;
  reviews: ObligationReview[];
};
type ObligationReviewDraft = { targetState: string; ownerSeatId: string; evidenceIds: string[]; reviewNote: string; nextReviewAt: string };

async function requestJson<T>(method: "GET" | "POST" | "PATCH" | "PUT", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

async function downloadAuthenticated(url: string, fileName: string): Promise<void> {
  const response = await apiRequest("GET", url) as Response;
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function localExpiry(): string {
  const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateTime(value: string | Date): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function roleKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
}

function stateVariant(state: string): "default" | "secondary" | "outline" | "destructive" {
  if (["completed", "signed", "delivered", "passed"].includes(state)) return "default";
  if (["declined", "voided", "expired", "failed", "recovery_required", "overdue_breached"].includes(state)) return "destructive";
  if (["issued", "in_progress", "opened", "consented", "sent"].includes(state)) return "secondary";
  return "outline";
}

export function NativeEsignOperatorConsole({ root, canOperate = true, canApproveReplacements = false, seats = [], evidence = [], onOpenCommand }: { root: string; canOperate?: boolean; canApproveReplacements?: boolean; seats?: SeatOption[]; evidence?: EvidenceOption[]; onOpenCommand?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<NativeEsignField[]>([]);
  const [roles, setRoles] = useState([{ value: "signer", label: "Signer" }]);
  const [newRole, setNewRole] = useState("");
  const [documentDraft, setDocumentDraft] = useState({ documentKey: "", documentVersion: "1.0", title: "", sourceReference: "" });
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [recipientDrafts, setRecipientDrafts] = useState<RecipientDraft[]>([]);
  const [envelopeDraft, setEnvelopeDraft] = useState({ subject: "", message: "Please review and sign this document.", routingMode: "sequential" as "sequential" | "parallel", assuranceMode: "link" as "link" | "email_otp", expiresAt: localExpiry() });
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState("");
  const [editingEnvelopeId, setEditingEnvelopeId] = useState("");
  const [correctingRecipientId, setCorrectingRecipientId] = useState("");
  const [recipientCorrection, setRecipientCorrection] = useState({ signerName: "", signerEmail: "", reason: "" });
  const [transientLinks, setTransientLinks] = useState<Record<string, string>>({});
  const [voidReason, setVoidReason] = useState("");
  const [webhookDraft, setWebhookDraft] = useState({ endpointUrl: "", description: "", eventTypes: "*" });
  const [webhookSecret, setWebhookSecret] = useState("");
  const [replayReason, setReplayReason] = useState("Operator-confirmed retry after destination recovery.");
  const [integrityReason, setIntegrityReason] = useState("Operator-requested completed-envelope evidence verification.");
  const [custodyDraft, setCustodyDraft] = useState({ policyName: "Signing evidence retention", retentionDays: "", holdReason: "", holdReference: "", deletionReason: "", decisionReason: "" });
  const [storageDrillReason, setStorageDrillReason] = useState("Founder-requested synthetic storage loss and recovery qualification.");
  const [envelopeSearch, setEnvelopeSearch] = useState("");
  const [envelopeState, setEnvelopeState] = useState("all");
  const [promotionDraft, setPromotionDraft] = useState({ workPacketId: "", supportedClaimSummary: "The executed agreement proves the parties completed the recorded contractual commitment.", verifierMethod: "EOS native signature integrity and custody verification." });
  const [selectedEnvelopeIds, setSelectedEnvelopeIds] = useState<string[]>([]);
  const [batchReason, setBatchReason] = useState("Founder-reviewed contract operations batch.");
  const [cloneDraft, setCloneDraft] = useState({ mode: "clone" as "clone" | "renewal", subject: "", expiresAt: localExpiry() });
  const [negotiationResponse, setNegotiationResponse] = useState("");
  const [negotiationResolution, setNegotiationResolution] = useState("");
  const [reminderDraft, setReminderDraft] = useState({ nextReminderAt: localDateTime(new Date(Date.now() + 24 * 60 * 60 * 1_000)), intervalDays: 3, maxReminders: 3 });
  const [obligationDraft, setObligationDraft] = useState({ obligationKey: "", title: "", ownerSeatId: "", description: "", sourceExcerpt: "", dueReviewAt: "", classification: "confidential" });
  const [obligationReviewDrafts, setObligationReviewDrafts] = useState<Record<string, ObligationReviewDraft>>({});
  const [comparisonReviews, setComparisonReviews] = useState<Record<string, boolean>>({});

  const documents = useQuery<DocumentVersion[]>({ queryKey: [`${root}/native-esign/documents`], queryFn: () => requestJson("GET", `${root}/native-esign/documents`) });
  const envelopeQuery = new URLSearchParams({ q: envelopeSearch, state: envelopeState, limit: "200" }).toString();
  const envelopes = useQuery<Envelope[]>({ queryKey: [`${root}/native-esign/envelopes`, envelopeSearch, envelopeState], queryFn: () => requestJson("GET", `${root}/native-esign/envelopes?${envelopeQuery}`) });
  const detail = useQuery<EnvelopeDetail>({ queryKey: [`${root}/native-esign/envelopes/${selectedEnvelopeId}`], enabled: Boolean(selectedEnvelopeId), queryFn: () => requestJson("GET", `${root}/native-esign/envelopes/${selectedEnvelopeId}`) });
  const operations = useQuery<SigningOperations>({ queryKey: [`${root}/native-esign/operations`], queryFn: () => requestJson("GET", `${root}/native-esign/operations`) });
  const storageDrills = useQuery<StorageDrill[]>({ queryKey: [`${root}/native-esign/custody/storage-drills`], queryFn: () => requestJson("GET", `${root}/native-esign/custody/storage-drills`) });
  const workPackets = useQuery<WorkPacket[]>({ queryKey: [root, "work-packets", "native-esign"], queryFn: () => requestJson("GET", `${root}/work-packets`) });
  const selectedDocument = useMemo(() => documents.data?.find((document) => document.id === selectedDocumentId) || null, [documents.data, selectedDocumentId]);

  useEffect(() => {
    if (!selectedEnvelopeId && envelopes.data?.length) setSelectedEnvelopeId(envelopes.data[0].id);
  }, [envelopes.data, selectedEnvelopeId]);

  useEffect(() => {
    if (!obligationDraft.ownerSeatId && seats.length) setObligationDraft((value) => ({ ...value, ownerSeatId: seats[0].id }));
  }, [obligationDraft.ownerSeatId, seats]);

  const fail = (action: string, error: unknown) => toast({ title: nativeEsignErrorMessage(action, error), variant: "destructive" });
  const reviewDraftFor = (promotion: ObligationPromotion): ObligationReviewDraft => {
    const obligation = promotion.obligation;
    const nextStates = obligation ? (nextRiskControlStates as (state: string) => readonly string[])(obligation.state) : [];
    return obligationReviewDrafts[promotion.obligationId] || {
      targetState: nextStates[0] || "",
      ownerSeatId: obligation?.ownerSeatId || "",
      evidenceIds: [],
      reviewNote: "",
      nextReviewAt: localDateTime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000)),
    };
  };
  const updateReviewDraft = (promotion: ObligationPromotion, updates: Partial<ObligationReviewDraft>) =>
    setObligationReviewDrafts((current) => ({ ...current, [promotion.obligationId]: { ...reviewDraftFor(promotion), ...updates } }));
  const refreshEnvelopes = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/envelopes`] });
    if (id) {
      setSelectedEnvelopeId(id);
      await queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/envelopes/${id}`] });
    }
  };

  const missingDocumentSignatureRoles = roles.filter((role) => !fields.some((field) => field.roleKey === role.value && field.type === "signature" && field.required));

  const registerDocument = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a PDF first.");
      if (missingDocumentSignatureRoles.length) throw new Error(`Place a required signature field for ${missingDocumentSignatureRoles.map((role) => role.label).join(", ")}.`);
      const query = new URLSearchParams(documentDraft);
      return apiBinaryRequest<DocumentVersion>(`${root}/native-esign/documents?${query}`, file, { "Content-Type": "application/pdf", "x-eos-field-schema": encodeNativeEsignFieldSchema(fields) });
    },
    onSuccess: async (document) => {
      setFile(null); setFields([]); setDocumentDraft({ documentKey: "", documentVersion: "1.0", title: "", sourceReference: "" });
      await queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/documents`] });
      prepareEnvelope(document);
      toast({ title: "Immutable signing document registered", description: `${document.pageCount} page${document.pageCount === 1 ? "" : "s"} and ${document.fieldSchema.length} field${document.fieldSchema.length === 1 ? "" : "s"} recorded.` });
    },
    onError: (error) => fail("Document registration failed", error),
  });

  function prepareEnvelope(document: DocumentVersion) {
    const roleKeys = Array.from(new Set(document.fieldSchema.map((field) => field.roleKey)));
    setSelectedDocumentId(document.id);
    setRecipientDrafts(roleKeys.map((key, index) => ({ roleKey: key, signerName: "", signerEmail: "", routingOrder: index + 1 })));
    setEnvelopeDraft((current) => ({ ...current, subject: document.title, expiresAt: localExpiry() }));
  }

  const createEnvelope = useMutation({
    mutationFn: () => requestJson<Envelope>("POST", `${root}/native-esign/envelopes`, {
      documentVersionId: selectedDocumentId,
      subject: envelopeDraft.subject,
      message: envelopeDraft.message,
      routingMode: envelopeDraft.routingMode,
      assuranceMode: envelopeDraft.assuranceMode,
      expiresAt: new Date(envelopeDraft.expiresAt).toISOString(),
      recipients: recipientDrafts.map((recipient, index) => ({ ...recipient, routingOrder: envelopeDraft.routingMode === "parallel" ? 1 : recipient.routingOrder || index + 1 })),
    }),
    onSuccess: async (envelope) => { await refreshEnvelopes(envelope.id); toast({ title: "Draft envelope created", description: "Review recipients, then issue when ready." }); },
    onError: (error) => fail("Envelope creation failed", error),
  });

  const updateEnvelope = useMutation({
    mutationFn: (envelope: Envelope) => requestJson<Envelope>("PATCH", `${root}/native-esign/envelopes/${envelope.id}`, {
      version: envelope.version,
      subject: envelopeDraft.subject,
      message: envelopeDraft.message,
      routingMode: envelopeDraft.routingMode,
      assuranceMode: envelopeDraft.assuranceMode,
      expiresAt: new Date(envelopeDraft.expiresAt).toISOString(),
      recipients: recipientDrafts.map((recipient, index) => ({
        ...recipient,
        routingOrder: envelopeDraft.routingMode === "parallel" ? 1 : recipient.routingOrder || index + 1,
      })),
    }),
    onSuccess: async (envelope) => {
      setEditingEnvelopeId("");
      await refreshEnvelopes(envelope.id);
      toast({ title: "Draft envelope updated", description: `Revision ${envelope.version} is now the authoritative draft.` });
    },
    onError: (error) => fail("Draft update failed", error),
  });

  const issueEnvelope = useMutation({
    mutationFn: ({ id, comparisonReviewSha256 }: { id: string; comparisonReviewSha256?: string }) => requestJson<{ id: string; recipients: Array<Recipient & { signingUrl: string | null }> }>("POST", `${root}/native-esign/envelopes/${id}/issue`, { comparisonReviewSha256 }),
    onSuccess: async (result) => {
      setTransientLinks(Object.fromEntries(result.recipients
        .filter((recipient) => recipient.routingState === "active" && recipient.signingUrl)
        .map((recipient) => [recipient.id, recipient.signingUrl!])));
      await refreshEnvelopes(result.id);
      toast({ title: "Envelope issued", description: "Private links are visible only in this response. Emailing rotates each link again." });
    },
    onError: (error) => fail("Envelope issuance failed", error),
  });

  const deliver = useMutation({
    mutationFn: ({ envelopeId, recipientId }: { envelopeId: string; recipientId: string }) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${envelopeId}/recipients/${recipientId}/deliver`, {}),
    onSuccess: async (result) => {
      setTransientLinks((current) => { const next = { ...current }; delete next[String(result.recipientId)]; return next; });
      await refreshEnvelopes(selectedEnvelopeId);
      toast({ title: "Signing email delivered", description: "The Gmail provider receipt is reconciled to the recipient." });
    },
    onError: (error) => fail("Signing email failed", error),
  });

  const rotate = useMutation({
    mutationFn: ({ envelopeId, recipientId }: { envelopeId: string; recipientId: string }) => requestJson<{ recipientId: string; signingUrl: string }>("POST", `${root}/native-esign/envelopes/${envelopeId}/recipients/${recipientId}/rotate-link`, {}),
    onSuccess: async (result) => { setTransientLinks((current) => ({ ...current, [result.recipientId]: result.signingUrl })); await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Private link rotated", description: "The earlier link is now invalid." }); },
    onError: (error) => fail("Link rotation failed", error),
  });

  const correctRecipient = useMutation({
    mutationFn: ({ envelopeId, recipient }: { envelopeId: string; recipient: Recipient }) => requestJson<{
      recipient: Recipient;
      signingUrl: string;
    }>("PATCH", `${root}/native-esign/envelopes/${envelopeId}/recipients/${recipient.id}`, {
      version: recipient.version,
      signerName: recipientCorrection.signerName,
      signerEmail: recipientCorrection.signerEmail,
      reason: recipientCorrection.reason,
    }),
    onSuccess: async (result) => {
      setTransientLinks((current) => ({ ...current, [result.recipient.id]: result.signingUrl }));
      setCorrectingRecipientId("");
      setRecipientCorrection({ signerName: "", signerEmail: "", reason: "" });
      await refreshEnvelopes(selectedEnvelopeId);
      toast({ title: "Recipient corrected", description: "The old link and consent are invalid. Review the replacement identity before delivery." });
    },
    onError: (error) => fail("Recipient correction failed", error),
  });

  const voidEnvelope = useMutation({
    mutationFn: (envelope: Envelope) => requestJson<Envelope>("POST", `${root}/native-esign/envelopes/${envelope.id}/void`, { version: envelope.version, reason: voidReason }),
    onSuccess: async () => { setVoidReason(""); setTransientLinks({}); await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Envelope voided" }); },
    onError: (error) => fail("Envelope void failed", error),
  });

  const recover = useMutation({
    mutationFn: (id: string) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${id}/recover`, {}),
    onSuccess: async () => { await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Envelope resealed", description: "Recorded signer evidence was reused without requesting another signature." }); },
    onError: (error) => fail("Envelope recovery failed", error),
  });

  const promoteEvidence = useMutation({
    mutationFn: (id: string) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${id}/promote-evidence`, { ...promotionDraft, workPacketId: promotionDraft.workPacketId || detail.data?.envelope.workPacketId || "" }),
    onSuccess: async () => { await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Executed contract promoted to Evidence", description: "The Work Packet now carries a verified, retention-governed contract claim and immutable promotion receipt." }); },
    onError: (error) => fail("Evidence promotion failed", error),
  });

  const cloneEnvelope = useMutation({
    mutationFn: (envelope: Envelope) => requestJson<{ envelope: Envelope }>("POST", `${root}/native-esign/envelopes/${envelope.id}/clone`, { mode: cloneDraft.mode, subject: cloneDraft.subject || undefined, expiresAt: new Date(cloneDraft.expiresAt).toISOString() }),
    onSuccess: async (result) => { setCloneDraft({ mode: "clone", subject: "", expiresAt: localExpiry() }); await refreshEnvelopes(result.envelope.id); toast({ title: result.envelope.renewalOfEnvelopeId ? "Renewal draft created" : "Contract draft cloned", description: "Signer state and links were reset while immutable source lineage was preserved." }); },
    onError: (error) => fail("Contract clone failed", error),
  });

  const respondNegotiation = useMutation({
    mutationFn: ({ envelopeId, negotiationId }: { envelopeId: string; negotiationId: string }) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${envelopeId}/negotiations/${negotiationId}/entries`, { body: negotiationResponse, requestedChanges: [] }),
    onSuccess: async () => { setNegotiationResponse(""); await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Negotiation response recorded" }); },
    onError: (error) => fail("Negotiation response failed", error),
  });

  const resolveNegotiation = useMutation({
    mutationFn: ({ envelopeId, negotiation }: { envelopeId: string; negotiation: Negotiation }) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${envelopeId}/negotiations/${negotiation.id}/resolve`, { version: negotiation.version, resolutionSummary: negotiationResolution }),
    onSuccess: async () => { setNegotiationResolution(""); await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Negotiation resolved", description: "The immutable entry chain and resolution are preserved." }); },
    onError: (error) => fail("Negotiation resolution failed", error),
  });

  const scheduleReminder = useMutation({
    mutationFn: ({ envelopeId, recipientId }: { envelopeId: string; recipientId: string }) => requestJson<ReminderSchedule>("POST", `${root}/native-esign/envelopes/${envelopeId}/recipients/${recipientId}/reminder-schedule`, { ...reminderDraft, nextReminderAt: new Date(reminderDraft.nextReminderAt).toISOString() }),
    onSuccess: async () => { await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Reminder schedule activated" }); },
    onError: (error) => fail("Reminder schedule failed", error),
  });

  const updateReminder = useMutation({
    mutationFn: ({ schedule, state }: { schedule: ReminderSchedule; state: "active" | "paused" | "cancelled" }) => requestJson<ReminderSchedule>("PATCH", `${root}/native-esign/reminder-schedules/${schedule.id}`, { version: schedule.version, state }),
    onSuccess: async () => { await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Reminder schedule updated" }); },
    onError: (error) => fail("Reminder update failed", error),
  });

  const executeBatch = useMutation({
    mutationFn: (action: "remind" | "void") => requestJson<{ state: string; succeededCount: number; failedCount: number }>("POST", `${root}/native-esign/batches`, { action, envelopeIds: selectedEnvelopeIds, reason: batchReason }),
    onSuccess: async (result) => { setSelectedEnvelopeIds([]); await refreshEnvelopes(selectedEnvelopeId); toast({ title: `Batch ${result.state.replaceAll("_", " ")}`, description: `${result.succeededCount} succeeded · ${result.failedCount} not completed.` }); },
    onError: (error) => fail("Bulk contract operation failed", error),
  });

  const promoteObligation = useMutation({
    mutationFn: (envelopeId: string) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${envelopeId}/promote-obligation`, { ...obligationDraft, obligationKey: roleKey(obligationDraft.obligationKey), dueReviewAt: obligationDraft.dueReviewAt ? new Date(obligationDraft.dueReviewAt).toISOString() : undefined }),
    onSuccess: async () => { setObligationDraft({ obligationKey: "", title: "", ownerSeatId: "", description: "", sourceExcerpt: "", dueReviewAt: "", classification: "confidential" }); await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Contract obligation promoted", description: "A human-reviewed canonical EOS obligation now points back to the executed Evidence." }); },
    onError: (error) => fail("Obligation promotion failed", error),
  });

  const reviewObligation = useMutation({
    mutationFn: ({ promotion, draft }: { promotion: ObligationPromotion; draft: ObligationReviewDraft }) => {
      if (!promotion.obligation) throw new Error("Canonical obligation is unavailable.");
      return requestJson<{ obligation: ObligationPromotion["obligation"]; review: ObligationReview }>("POST", `${root}/native-esign/envelopes/${selectedEnvelopeId}/obligations/${promotion.obligationId}/reviews`, {
        expectedUpdatedAt: promotion.obligation.updatedAt,
        targetState: draft.targetState,
        ownerSeatId: draft.ownerSeatId,
        evidenceIds: draft.evidenceIds,
        reviewNote: draft.reviewNote,
        nextReviewAt: ["satisfied_closed", "superseded"].includes(draft.targetState) ? undefined : new Date(draft.nextReviewAt).toISOString(),
      });
    },
    onSuccess: async (_result, variables) => {
      setObligationReviewDrafts((current) => { const next = { ...current }; delete next[variables.promotion.obligationId]; return next; });
      await refreshEnvelopes(selectedEnvelopeId);
      toast({ title: "Obligation review recorded", description: "The state change, authority decision, and verified operational Evidence were sealed into an append-only receipt." });
    },
    onError: (error) => fail("Obligation review failed", error),
  });

  const createWebhook = useMutation({
    mutationFn: () => requestJson<{ subscription: WebhookSubscription; signingSecret: string }>("POST", `${root}/native-esign/webhooks`, {
      endpointUrl: webhookDraft.endpointUrl, description: webhookDraft.description,
      eventTypes: webhookDraft.eventTypes.split(",").map((value) => value.trim()).filter(Boolean),
    }),
    onSuccess: async (result) => {
      setWebhookSecret(result.signingSecret);
      setWebhookDraft({ endpointUrl: "", description: "", eventTypes: "*" });
      await operations.refetch();
      toast({ title: "Signed webhook created", description: "Copy the signing secret now. EOS will not reveal it again." });
    },
    onError: (error) => fail("Webhook creation failed", error),
  });

  const updateWebhook = useMutation({
    mutationFn: ({ subscription, state }: { subscription: WebhookSubscription; state: "active" | "paused" | "revoked" }) => requestJson<WebhookSubscription>("PATCH", `${root}/native-esign/webhooks/${subscription.id}`, { version: subscription.version, endpointUrl: subscription.endpointUrl, description: subscription.description, eventTypes: subscription.eventTypes, state }),
    onSuccess: async () => { await operations.refetch(); toast({ title: "Webhook lifecycle updated" }); },
    onError: (error) => fail("Webhook update failed", error),
  });

  const rotateWebhookSecret = useMutation({
    mutationFn: (subscription: WebhookSubscription) => requestJson<{ subscription: WebhookSubscription; signingSecret: string }>("POST", `${root}/native-esign/webhooks/${subscription.id}/rotate-secret`, { version: subscription.version, reason: replayReason }),
    onSuccess: async (result) => { setWebhookSecret(result.signingSecret); await operations.refetch(); toast({ title: "Webhook secret rotated", description: "Update the destination before its next delivery." }); },
    onError: (error) => fail("Secret rotation failed", error),
  });

  const replayWebhook = useMutation({
    mutationFn: (deliveryId: string) => requestJson<Record<string, any>>("POST", `${root}/native-esign/webhook-deliveries/${deliveryId}/replay`, { reason: replayReason }),
    onSuccess: async () => { await operations.refetch(); toast({ title: "Webhook replay queued" }); },
    onError: (error) => fail("Webhook replay failed", error),
  });

  const replayCompletion = useMutation({
    mutationFn: ({ envelopeId, recipientId }: { envelopeId: string; recipientId: string }) => requestJson<Record<string, any>>("POST", `${root}/native-esign/envelopes/${envelopeId}/recipients/${recipientId}/completion-delivery/replay`, { reason: replayReason }),
    onSuccess: async () => { await Promise.all([operations.refetch(), refreshEnvelopes(selectedEnvelopeId)]); toast({ title: "Completion receipt replay queued" }); },
    onError: (error) => fail("Completion replay failed", error),
  });

  const verifyIntegrity = useMutation({
    mutationFn: (envelopeId: string) => requestJson<{ report: IntegrityProjection; check: IntegrityCheck }>("POST", `${root}/native-esign/envelopes/${envelopeId}/verify`, { reason: integrityReason }),
    onSuccess: async (result) => {
      await Promise.all([operations.refetch(), refreshEnvelopes(selectedEnvelopeId)]);
      toast({ title: result.report.valid ? "Signed evidence verified" : "Evidence verification requires attention", description: result.report.valid ? `${result.report.eventCount} events and ${result.report.captureCount} captures passed independent verification.` : result.report.failureCodes.join(", ").replaceAll("_", " "), variant: result.report.valid ? "default" : "destructive" });
    },
    onError: (error) => fail("Evidence verification failed", error),
  });

  const custodyAction = useMutation({
    mutationFn: ({ method, path, body }: { method: "POST" | "PUT"; path: string; body?: unknown }) => requestJson<Record<string, any>>(method, `${root}/native-esign${path}`, body),
    onSuccess: async () => { await refreshEnvelopes(selectedEnvelopeId); toast({ title: "Evidence custody updated" }); },
    onError: (error) => fail("Evidence custody action failed", error),
  });

  const runStorageDrill = useMutation({
    mutationFn: () => requestJson<StorageDrill>("POST", `${root}/native-esign/custody/storage-drills`, {
      reason: storageDrillReason,
      acknowledgeSyntheticPrimaryLoss: true,
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/custody/storage-drills`] });
      toast({
        title: result.state === "passed" ? "Storage recovery drill passed" : "Storage recovery drill failed",
        description: result.state === "passed" ? `Receipt ${result.receiptSha256.slice(0, 16)}…` : result.failureCode.replaceAll("_", " "),
        variant: result.state === "passed" ? "default" : "destructive",
      });
    },
    onError: (error) => fail("Storage recovery drill failed", error),
  });

  const configureCustodyPolicy = () => custodyAction.mutate({
    method: "PUT", path: "/custody/retention-policy",
    body: { name: custodyDraft.policyName, retentionDays: Number(custodyDraft.retentionDays), backupRequired: true, version: detail.data?.custody?.policy?.version },
  });

  const decideDeletion = (request: DeletionRequest, approve: boolean) => custodyAction.mutate({
    method: "POST", path: `/custody/deletion-requests/${request.id}/decision`,
    body: { approve, reason: custodyDraft.decisionReason, version: request.version },
  });

  function addRole() {
    const key = roleKey(newRole);
    if (!key || roles.some((role) => role.value === key)) return;
    setRoles((current) => [...current, { value: key, label: newRole.trim() }]);
    setNewRole("");
  }

  function beginDraftEdit(envelope: Envelope, recipients: Recipient[]) {
    setEditingEnvelopeId(envelope.id);
    setEnvelopeDraft({
      subject: envelope.subject,
      message: envelope.message,
      routingMode: envelope.routingMode,
      assuranceMode: envelope.assuranceMode,
      expiresAt: localDateTime(envelope.expiresAt),
    });
    setRecipientDrafts(recipients.map((recipient) => ({
      roleKey: recipient.roleKey,
      signerName: recipient.signerName,
      signerEmail: recipient.signerEmail,
      routingOrder: recipient.routingOrder,
    })));
  }

  function beginRecipientCorrection(recipient: Recipient) {
    setCorrectingRecipientId(recipient.id);
    setRecipientCorrection({ signerName: recipient.signerName, signerEmail: recipient.signerEmail, reason: "" });
  }

  const canRegister = Boolean(file && documentDraft.documentKey.trim().length >= 2 && documentDraft.title.trim().length >= 2 && documentDraft.documentVersion.trim() && documentDraft.sourceReference.trim().length >= 2 && missingDocumentSignatureRoles.length === 0);
  const canCreateEnvelope = Boolean(selectedDocument && envelopeDraft.subject.trim().length >= 2 && envelopeDraft.expiresAt && recipientDrafts.length && recipientDrafts.every((recipient) => recipient.signerName.trim().length >= 2 && /.+@.+\..+/.test(recipient.signerEmail)));
  const canUpdateEnvelope = Boolean(envelopeDraft.subject.trim().length >= 2 && envelopeDraft.expiresAt && recipientDrafts.length && recipientDrafts.every((recipient) => recipient.signerName.trim().length >= 2 && /.+@.+\..+/.test(recipient.signerEmail)));
  const current = detail.data?.envelope;
  const custody = detail.data?.custody;
  const latestStorageDrill = storageDrills.data?.[0];
  const openDeletionRequest = custody?.deletionRequests.find((request) => ["pending_approval", "approved", "executing", "blocked", "failed"].includes(request.state));
  const custodyPanel = current && custody ? <div className="space-y-4 rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Evidence custody</p><p className="text-xs text-muted-foreground">Retention authority, independently verified backup, legal holds, recovery, and governed deletion for every signing artifact.</p></div><Badge variant={custody.readiness.policyConfigured && custody.readiness.verifiedArtifactCount === custody.readiness.artifactCount ? "default" : "outline"}>{custody.readiness.verifiedArtifactCount}/{custody.readiness.artifactCount} verified</Badge></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Primary plane</p><p className="font-medium">{custody.storageProvider}</p></div>
      <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Retention</p><p className="font-medium">{custody.policy ? `${custody.policy.retentionDays.toLocaleString()} days` : "Policy required"}</p></div>
      <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Backup</p><p className="font-medium">{custody.readiness.backupVerifiedCount}/{custody.readiness.artifactCount} verified</p></div>
      <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Legal hold</p><p className="font-medium">{custody.activeLegalHold ? "Active" : "None"}</p></div>
    </div>
    <details><summary className="cursor-pointer text-sm font-medium">Artifact inventory ({custody.artifacts.length})</summary><div className="mt-2 space-y-2">{custody.artifacts.map((artifact) => <div key={artifact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs"><div><span className="font-medium">{artifact.artifactKind.replaceAll("_", " ")}</span><span className="ml-2 text-muted-foreground">{artifact.sizeBytes.toLocaleString()} bytes · {artifact.sha256.slice(0, 12)}…</span>{artifact.retainedUntil ? <p className="text-muted-foreground">Retained through {new Date(artifact.retainedUntil).toLocaleString()}</p> : <p className="text-destructive">No retention policy assigned</p>}</div><div className="flex items-center gap-1"><Badge variant={stateVariant(artifact.state)}>{artifact.state.replaceAll("_", " ")}</Badge><Badge variant={artifact.backupState === "verified" ? "default" : "outline"}>backup {artifact.backupState.replaceAll("_", " ")}</Badge>{canOperate && artifact.state === "recovery_required" && artifact.backupState === "verified" ? <Button size="sm" variant="outline" onClick={() => custodyAction.mutate({ method: "POST", path: `/envelopes/${current.id}/custody/artifacts/${artifact.id}/restore` })}><RotateCw className="mr-2 h-3 w-3"/>Restore</Button> : null}</div></div>)}</div></details>
    {canOperate ? <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => custodyAction.mutate({ method: "POST", path: `/envelopes/${current.id}/custody/verify` })} disabled={custodyAction.isPending}><ShieldCheck className="mr-2 h-4 w-4"/>Verify custody</Button><Button size="sm" variant="outline" onClick={() => custodyAction.mutate({ method: "POST", path: `/envelopes/${current.id}/custody/backup` })} disabled={custodyAction.isPending || !custody.backupConfigured}><DatabaseBackup className="mr-2 h-4 w-4"/>Back up and verify</Button></div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Storage loss-and-recovery drill</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">Writes synthetic data only, verifies the independent backup, removes the primary copy, restores it, verifies its hash, cleans both planes, and preserves an immutable receipt. A local pass is not production evidence.</p>
          {latestStorageDrill ? <div className="space-y-2 rounded-lg bg-muted p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><span>{new Date(latestStorageDrill.startedAt).toLocaleString()}</span><Badge variant={stateVariant(latestStorageDrill.state)}>{latestStorageDrill.state}</Badge></div>
            <p>{latestStorageDrill.steps.filter((step) => step.state === "passed").length}/{latestStorageDrill.steps.length} steps passed{latestStorageDrill.failureCode ? ` · ${latestStorageDrill.failureCode.replaceAll("_", " ")}` : ""}</p>
            <p>Primary {latestStorageDrill.capabilitySnapshot.primary.provider} · backup {latestStorageDrill.capabilitySnapshot.backup.provider} · {latestStorageDrill.capabilitySnapshot.primary.identitySha256 === latestStorageDrill.capabilitySnapshot.backup.identitySha256 ? "not independent" : "independent identities"}</p>
            <p>Encryption {latestStorageDrill.capabilitySnapshot.primary.requestedEncryption.replaceAll("_", " ")} · versioning {latestStorageDrill.capabilitySnapshot.primary.versioning} · object lock {latestStorageDrill.capabilitySnapshot.primary.objectLock} · lifecycle {latestStorageDrill.capabilitySnapshot.primary.lifecycle}</p>
            {latestStorageDrill.receiptSha256 ? <p className="break-all font-mono">Receipt {latestStorageDrill.receiptSha256}</p> : null}
          </div> : <p className="text-xs text-muted-foreground">No storage recovery receipt exists for this organization.</p>}
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={storageDrillReason} onChange={(event) => setStorageDrillReason(event.target.value)} placeholder="Reason for this recovery qualification"/><Button size="sm" variant="outline" onClick={() => runStorageDrill.mutate()} disabled={runStorageDrill.isPending || !custody.backupConfigured || storageDrillReason.trim().length < 8}>{runStorageDrill.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseBackup className="mr-2 h-4 w-4"/>}Run recovery drill</Button></div>
        </div>
      </details>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Retention authority</summary><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]"><Input value={custodyDraft.policyName} onChange={(event) => setCustodyDraft((value) => ({ ...value, policyName: event.target.value }))} placeholder="Policy name"/><Input type="number" min={1} max={36500} value={custodyDraft.retentionDays} onChange={(event) => setCustodyDraft((value) => ({ ...value, retentionDays: event.target.value }))} placeholder="Days"/><Button onClick={configureCustodyPolicy} disabled={custodyAction.isPending || custodyDraft.policyName.trim().length < 2 || Number(custodyDraft.retentionDays) < 1}><Archive className="mr-2 h-4 w-4"/>{custody.policy ? "Replace policy" : "Activate policy"}</Button></div><p className="mt-2 text-xs text-muted-foreground">EOS does not invent a legal retention period. Activate only a reviewed company policy. Automatic deletion stays disabled.</p></details>
      {custody.activeLegalHold ? <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:bg-amber-950/10"><p className="text-sm font-medium">Legal hold active · {custody.activeLegalHold.reason}</p><Textarea value={custodyDraft.holdReason} onChange={(event) => setCustodyDraft((value) => ({ ...value, holdReason: event.target.value }))} placeholder="Reason for releasing this hold"/><Button size="sm" variant="outline" onClick={() => custodyAction.mutate({ method: "POST", path: `/envelopes/${current.id}/custody/legal-holds/${custody.activeLegalHold!.id}/release`, body: { reason: custodyDraft.holdReason, version: custody.activeLegalHold!.version } })} disabled={custodyAction.isPending || custodyDraft.holdReason.trim().length < 10}><UnlockKeyhole className="mr-2 h-4 w-4"/>Release hold</Button></div> : <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Place legal hold</summary><div className="mt-3 space-y-2"><Textarea value={custodyDraft.holdReason} onChange={(event) => setCustodyDraft((value) => ({ ...value, holdReason: event.target.value }))} placeholder="Reviewed reason for preserving this envelope"/><Input value={custodyDraft.holdReference} onChange={(event) => setCustodyDraft((value) => ({ ...value, holdReference: event.target.value }))} placeholder="Matter or authority reference (optional)"/><Button size="sm" onClick={() => custodyAction.mutate({ method: "POST", path: `/envelopes/${current.id}/custody/legal-holds`, body: { reason: custodyDraft.holdReason, reference: custodyDraft.holdReference } })} disabled={custodyAction.isPending || custodyDraft.holdReason.trim().length < 10}><LockKeyhole className="mr-2 h-4 w-4"/>Place hold</Button></div></details>}
      {openDeletionRequest ? <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Deletion request · {openDeletionRequest.state.replaceAll("_", " ")}</p><Badge variant={stateVariant(openDeletionRequest.state)}>{openDeletionRequest.state.replaceAll("_", " ")}</Badge></div><p className="text-xs text-muted-foreground">{openDeletionRequest.reason}{openDeletionRequest.failureCode ? ` · ${openDeletionRequest.failureCode.replaceAll("_", " ")}` : ""}</p>{openDeletionRequest.state === "pending_approval" ? <><Textarea value={custodyDraft.decisionReason} onChange={(event) => setCustodyDraft((value) => ({ ...value, decisionReason: event.target.value }))} placeholder="Independent decision rationale"/><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => custodyAction.mutate({ method: "POST", path: `/custody/deletion-requests/${openDeletionRequest.id}/cancel`, body: { version: openDeletionRequest.version } })}>Cancel my request</Button><Button size="sm" variant="outline" onClick={() => decideDeletion(openDeletionRequest, false)} disabled={custodyDraft.decisionReason.trim().length < 10}>Reject</Button><Button size="sm" variant="destructive" onClick={() => decideDeletion(openDeletionRequest, true)} disabled={custodyDraft.decisionReason.trim().length < 10}>Approve</Button></div></> : null}{openDeletionRequest.state === "approved" ? <Button size="sm" variant="destructive" onClick={() => custodyAction.mutate({ method: "POST", path: `/custody/deletion-requests/${openDeletionRequest.id}/execute`, body: { version: openDeletionRequest.version } })}>Execute as third operator</Button> : null}</div> : current.state === "completed" ? <details className="rounded-lg border border-destructive/20 p-3"><summary className="cursor-pointer text-sm font-medium text-destructive">Request governed deletion</summary><div className="mt-3 space-y-2"><Textarea value={custodyDraft.deletionReason} onChange={(event) => setCustodyDraft((value) => ({ ...value, deletionReason: event.target.value }))} placeholder="Reason for deleting envelope artifacts after retention expires"/><Button size="sm" variant="destructive" onClick={() => custodyAction.mutate({ method: "POST", path: `/envelopes/${current.id}/custody/deletion-requests`, body: { reason: custodyDraft.deletionReason } })} disabled={custodyAction.isPending || custodyDraft.deletionReason.trim().length < 10}><Trash2 className="mr-2 h-4 w-4"/>Request deletion</Button><p className="text-xs text-muted-foreground">Request, approval, and execution require three distinct authorized users. Active holds and unexpired or missing retention policy block execution.</p></div></details> : null}
    </div> : null}
  </div> : null;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>EOS Native Signing</CardTitle>{!canOperate ? <Badge variant="outline">Read only</Badge> : null}</div><CardDescription>Own document versions, recipients, routing, delivery, signing evidence, completed PDFs, and audit records without a per-envelope platform subscription.</CardDescription></div><Button type="button" variant="outline" size="sm" onClick={() => { void documents.refetch(); void envelopes.refetch(); void storageDrills.refetch(); if (selectedEnvelopeId) void detail.refetch(); }}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></CardHeader>
    <CardContent>
      <Tabs defaultValue="contracts" className="space-y-5">
        <TabsList className="grid w-full grid-cols-5"><TabsTrigger value="contracts">Contracts</TabsTrigger><TabsTrigger value="library">Library</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="envelopes">Envelopes</TabsTrigger><TabsTrigger value="operations">Operations</TabsTrigger></TabsList>
        <TabsContent value="contracts" className="space-y-5"><NativeContractControlCenter root={root} canOperate={canOperate} seats={seats} evidence={evidence}/></TabsContent>
        <TabsContent value="library" className="space-y-5"><NativeContractLibrary root={root} canOperate={canOperate} evidence={evidence} onGenerated={prepareEnvelope}/></TabsContent>
        <TabsContent value="documents" className="space-y-5">
          {!canOperate ? <Alert><ShieldAlert className="h-4 w-4"/><AlertTitle>Signing records are read only in this role</AlertTitle><AlertDescription>Document registration, revision, issuance, delivery, void, and recovery controls require an active signing Authority Grant for this seat.</AlertDescription></Alert> : <details className="rounded-xl border bg-muted/20 p-4" open={!documents.data?.length}><summary className="cursor-pointer font-semibold">Register an immutable signing document</summary><div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-sm font-medium">Document title<Input value={documentDraft.title} onChange={(event) => setDocumentDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Mutual services agreement"/></label><label className="space-y-1 text-sm font-medium">Internal document key<Input value={documentDraft.documentKey} onChange={(event) => setDocumentDraft((value) => ({ ...value, documentKey: roleKey(event.target.value) }))} placeholder="mutual-services-agreement"/></label><label className="space-y-1 text-sm font-medium">Version<Input value={documentDraft.documentVersion} onChange={(event) => setDocumentDraft((value) => ({ ...value, documentVersion: event.target.value }))}/></label><label className="space-y-1 text-sm font-medium">Source / approval reference<Input value={documentDraft.sourceReference} onChange={(event) => setDocumentDraft((value) => ({ ...value, sourceReference: event.target.value }))} placeholder="counsel://msa/2026-08-24"/></label></div>
            <div className="space-y-2"><Label>Recipient roles</Label><div className="flex flex-wrap gap-2">{roles.map((role) => <Badge key={role.value} variant="secondary" className="gap-1">{role.label}{roles.length > 1 && !fields.some((field) => field.roleKey === role.value) ? <button type="button" aria-label={`Remove ${role.label}`} onClick={() => setRoles((current) => current.filter((item) => item.value !== role.value))}><Trash2 className="h-3 w-3"/></button> : null}</Badge>)}</div><div className="flex gap-2"><Input value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="Counterparty signer" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRole(); } }}/><Button type="button" variant="outline" onClick={addRole} disabled={!roleKey(newRole)}><UserPlus className="mr-2 h-4 w-4"/>Add role</Button></div></div>
            <Input type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0] || null); setFields([]); }}/>
            <NativeEsignFieldEditor file={file} fields={fields} onFieldsChange={setFields} roleOptions={roles}/>
            <div className="flex justify-end"><Button type="button" onClick={() => registerDocument.mutate()} disabled={!canRegister || registerDocument.isPending}><FilePlus2 className="mr-2 h-4 w-4"/>{registerDocument.isPending ? "Registering…" : "Register document"}</Button></div>
          </div></details>}
          <div className="grid gap-3 lg:grid-cols-2">{(documents.data || []).map((document) => <div key={document.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{document.title}</p><p className="text-xs text-muted-foreground">{document.documentVersion} · {document.pageCount} page{document.pageCount === 1 ? "" : "s"} · {document.fieldSchema.length} field{document.fieldSchema.length === 1 ? "" : "s"}</p></div>{canOperate ? <Button size="sm" variant="outline" onClick={() => prepareEnvelope(document)}>Use</Button> : null}</div><p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">SHA-256 {document.sourceSha256}</p>{document.parentDocumentVersionId ? <div className="mt-3 rounded-lg bg-primary/5 p-3 text-xs"><p className="font-medium">Revision of <code>{document.parentDocumentVersionId}</code></p><p className="mt-1">{document.revisionSummary}</p>{document.comparison ? <div className="mt-2 text-[10px] text-muted-foreground"><p className="font-mono">Comparison {document.comparison.comparisonSha256.slice(0, 16)}… · {document.comparison.comparisonType === "generated_text" ? "exact generated-text diff" : "declared by operator"}</p>{document.comparison.diffStats ? <p>{document.comparison.diffStats.deletedLines} deleted · {document.comparison.diffStats.insertedLines} inserted · {document.comparison.diffStats.equalLines} unchanged lines</p> : null}</div> : null}</div> : null}<div className="mt-3 flex flex-wrap gap-1">{Array.from(new Set(document.fieldSchema.map((field) => field.roleKey))).map((role) => <Badge key={role} variant="outline">{role}</Badge>)}</div></div>)}{!documents.isLoading && !documents.data?.length ? <p className="text-sm text-muted-foreground">No native signing documents are registered yet.</p> : null}</div>
          {selectedDocument && <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><div><p className="font-semibold">Compose envelope · {selectedDocument.title}</p><p className="text-xs text-muted-foreground">Every authored role maps to exactly one tenant-scoped recipient.</p></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-sm font-medium">Subject<Input value={envelopeDraft.subject} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, subject: event.target.value }))}/></label><label className="space-y-1 text-sm font-medium">Expires<Input type="datetime-local" value={envelopeDraft.expiresAt} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, expiresAt: event.target.value }))}/></label><label className="space-y-1 text-sm font-medium">Routing<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={envelopeDraft.routingMode} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, routingMode: event.target.value as "sequential" | "parallel" }))}><option value="sequential">Sequential</option><option value="parallel">Parallel</option></select></label><label className="space-y-1 text-sm font-medium">Signer assurance<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={envelopeDraft.assuranceMode} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, assuranceMode: event.target.value as "link" | "email_otp" }))}><option value="link">Private link</option><option value="email_otp">Private link + email OTP</option></select></label><label className="space-y-1 text-sm font-medium md:col-span-2">Message<Textarea value={envelopeDraft.message} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, message: event.target.value }))}/></label></div><div className="space-y-3">{recipientDrafts.map((recipient, index) => <div key={recipient.roleKey} className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[150px_1fr_1fr_100px]"><div><p className="text-xs text-muted-foreground">Role</p><p className="font-medium">{recipient.roleKey}</p></div><Input value={recipient.signerName} onChange={(event) => setRecipientDrafts((current) => current.map((item, position) => position === index ? { ...item, signerName: event.target.value } : item))} placeholder="Signer name"/><Input type="email" value={recipient.signerEmail} onChange={(event) => setRecipientDrafts((current) => current.map((item, position) => position === index ? { ...item, signerEmail: event.target.value } : item))} placeholder="signer@example.com"/><Input type="number" min={1} max={100} disabled={envelopeDraft.routingMode === "parallel"} value={envelopeDraft.routingMode === "parallel" ? 1 : recipient.routingOrder} onChange={(event) => setRecipientDrafts((current) => current.map((item, position) => position === index ? { ...item, routingOrder: Number(event.target.value) } : item))} aria-label={`${recipient.roleKey} routing order`}/></div>)}</div><div className="flex justify-end"><Button onClick={() => createEnvelope.mutate()} disabled={!canCreateEnvelope || createEnvelope.isPending}><Plus className="mr-2 h-4 w-4"/>{createEnvelope.isPending ? "Creating…" : "Create draft envelope"}</Button></div></div>}
        </TabsContent>

        <TabsContent value="envelopes" className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-[1fr_220px]"><Input type="search" value={envelopeSearch} onChange={(event) => setEnvelopeSearch(event.target.value)} placeholder="Search envelope subject or message"/><select className="h-10 rounded-md border bg-background px-3" value={envelopeState} onChange={(event) => setEnvelopeState(event.target.value)}><option value="all">All states</option><option value="draft">Draft</option><option value="issued">Issued</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="declined">Declined</option><option value="voided">Voided</option><option value="expired">Expired</option><option value="recovery_required">Recovery required</option></select></div>
          {canOperate && selectedEnvelopeIds.length ? <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{selectedEnvelopeIds.length} envelope{selectedEnvelopeIds.length === 1 ? "" : "s"} selected</p><Input className="mt-2" value={batchReason} onChange={(event) => setBatchReason(event.target.value)} placeholder="Attributable batch reason"/></div><div className="flex gap-2"><Button variant="outline" onClick={() => executeBatch.mutate("remind")} disabled={executeBatch.isPending || batchReason.trim().length < 8}><Mail className="mr-2 h-4 w-4"/>Remind</Button><Button variant="destructive" onClick={() => executeBatch.mutate("void")} disabled={executeBatch.isPending || batchReason.trim().length < 8}><XCircle className="mr-2 h-4 w-4"/>Void</Button></div></div> : null}
          <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.5fr)]"><div className="space-y-2">{(envelopes.data || []).map((envelope) => <div key={envelope.id} className={`flex items-start gap-2 rounded-xl border p-3 transition ${selectedEnvelopeId === envelope.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>{canOperate ? <Checkbox className="mt-1" checked={selectedEnvelopeIds.includes(envelope.id)} onCheckedChange={(checked) => setSelectedEnvelopeIds((items) => checked ? [...items, envelope.id] : items.filter((id) => id !== envelope.id))} aria-label={`Select ${envelope.subject}`}/> : null}<button type="button" onClick={() => { setSelectedEnvelopeId(envelope.id); setEditingEnvelopeId(""); setCorrectingRecipientId(""); setTransientLinks({}); }} className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-2"><p className="font-medium">{envelope.subject}</p><Badge variant={stateVariant(envelope.state)}>{envelope.state.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-xs text-muted-foreground">Revision {envelope.version} · updated {new Date(envelope.updatedAt).toLocaleString()}</p></button></div>)}{!envelopes.isLoading && !envelopes.data?.length ? <p className="text-sm text-muted-foreground">No envelopes yet. Choose a document and compose one.</p> : null}</div>
            <div>{current && detail.data ? <div className="space-y-4 rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold">{current.subject}</p><p className="text-sm text-muted-foreground">{current.routingMode} routing · {current.assuranceMode === "email_otp" ? "email OTP assurance" : "private-link assurance"} · expires {new Date(current.expiresAt).toLocaleString()}</p></div><Badge variant={stateVariant(current.state)}>{current.state.replaceAll("_", " ")}</Badge></div>
              {current.message ? <p className="rounded-lg bg-muted p-3 text-sm">{current.message}</p> : null}
              {current.clonedFromEnvelopeId ? <p className="text-xs text-muted-foreground">Lineage: {current.renewalOfEnvelopeId ? "renewal of" : "cloned from"} envelope <code>{current.clonedFromEnvelopeId}</code>.</p> : null}
              {current.replacesEnvelopeId ? <p className="text-xs text-muted-foreground">Governed replacement for envelope <code>{current.replacesEnvelopeId}</code>.</p> : null}
              {current.replacedByEnvelopeId ? <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Superseded contract text</AlertTitle><AlertDescription>This envelope and every prior signing link were retired by replacement draft {current.replacedByEnvelopeId}.</AlertDescription></Alert> : null}
              {detail.data.comparison ? <div className="space-y-3"><NativeEsignComparisonView comparison={detail.data.comparison}/>{current.state === "draft" && canOperate && canApproveReplacements ? <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><Checkbox checked={comparisonReviews[current.id] === true} onCheckedChange={(value) => setComparisonReviews((reviews) => ({ ...reviews, [current.id]: value === true }))}/><span><strong className="block">Approve this exact replacement comparison</strong>I reviewed the displayed changes and authorize issuance of the replacement text identified by comparison hash <code className="break-all text-xs">{detail.data.comparison.comparisonSha256}</code>.</span></label> : current.comparisonReviewedAt ? <p className="text-xs text-muted-foreground">Issuance review sealed {new Date(current.comparisonReviewedAt).toLocaleString()} · <code>{current.comparisonReviewSha256?.slice(0, 16)}…</code></p> : current.state === "draft" ? <Alert><ShieldAlert className="h-4 w-4"/><AlertTitle>Founder review required</AlertTitle><AlertDescription>You may inspect the exact comparison, but only the active founder can acknowledge and issue replacement contract text.</AlertDescription></Alert> : null}</div> : current.replacesEnvelopeId ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4"/><AlertTitle>Replacement comparison unavailable</AlertTitle><AlertDescription>Issuance is blocked because EOS cannot resolve an immutable comparison for this replacement draft.</AlertDescription></Alert> : null}
              {canOperate && !current.recoveryAgreementInstanceId ? <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Clone or renew this agreement</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium">Operation<select className="h-10 w-full rounded-md border bg-background px-3" value={cloneDraft.mode} onChange={(event) => setCloneDraft((value) => ({ ...value, mode: event.target.value as "clone" | "renewal" }))}><option value="clone">Clone as new draft</option><option value="renewal" disabled={current.state !== "completed"}>Renew completed agreement</option></select></label><label className="space-y-1 text-sm font-medium">New expiry<Input type="datetime-local" value={cloneDraft.expiresAt} onChange={(event) => setCloneDraft((value) => ({ ...value, expiresAt: event.target.value }))}/></label><label className="space-y-1 text-sm font-medium sm:col-span-2">Subject override<Input value={cloneDraft.subject} onChange={(event) => setCloneDraft((value) => ({ ...value, subject: event.target.value }))} placeholder="Leave blank for an EOS-generated copy or renewal subject"/></label><div className="sm:col-span-2"><Button variant="outline" onClick={() => cloneEnvelope.mutate(current)} disabled={cloneEnvelope.isPending || !cloneDraft.expiresAt}><CopyPlus className="mr-2 h-4 w-4"/>{cloneDraft.mode === "renewal" ? "Create renewal draft" : "Clone draft"}</Button></div></div></details> : null}
              {detail.data.negotiations.length ? <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div><p className="font-semibold">Agreement negotiation</p><p className="text-xs text-muted-foreground">The signer and sender share this append-only thread. Accepted text changes become a hashed document revision and a fresh envelope; the old signing path is retired.</p></div>{detail.data.negotiations.map((negotiation) => <div key={negotiation.id} className="space-y-3 rounded-lg border bg-background p-3"><div className="flex items-center justify-between gap-2"><p className="font-medium">{negotiation.subject}</p><Badge variant={stateVariant(negotiation.state)}>{negotiation.state}</Badge></div><div className="space-y-2">{negotiation.entries.map((entry) => <div key={entry.id} className="rounded-lg bg-muted p-3 text-sm"><div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{entry.authorType} · {entry.entryType.replaceAll("_", " ")}</span><span>{new Date(entry.createdAt).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap">{entry.body}</p>{entry.requestedChanges.length ? <ul className="mt-2 list-disc pl-5 text-xs">{entry.requestedChanges.map((change) => <li key={change}>{change}</li>)}</ul> : null}<code className="mt-2 block text-[10px] text-muted-foreground">{entry.entrySha256.slice(0, 16)}…</code></div>)}</div>{canOperate && negotiation.state === "open" ? <div className="space-y-2"><Textarea value={negotiationResponse} onChange={(event) => setNegotiationResponse(event.target.value)} placeholder="Respond to the requested changes"/><Button size="sm" variant="outline" onClick={() => respondNegotiation.mutate({ envelopeId: current.id, negotiationId: negotiation.id })} disabled={respondNegotiation.isPending || negotiationResponse.trim().length < 2}><MessageSquareText className="mr-2 h-4 w-4"/>Record response</Button><Textarea value={negotiationResolution} onChange={(event) => setNegotiationResolution(event.target.value)} placeholder="Resolution summary when no document replacement is needed"/><Button size="sm" onClick={() => resolveNegotiation.mutate({ envelopeId: current.id, negotiation })} disabled={resolveNegotiation.isPending || negotiationResolution.trim().length < 8}><ShieldCheck className="mr-2 h-4 w-4"/>Resolve without replacement</Button>{documents.data?.find((document) => document.id === current.documentVersionId) ? <NativeEsignReplacementComposer root={root} sourceDocument={documents.data.find((document) => document.id === current.documentVersionId)!} sourceEnvelope={current} negotiationId={negotiation.id} onCompleted={async (envelopeId) => { await queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/documents`] }); await refreshEnvelopes(envelopeId); }}/>: null}</div> : negotiation.resolutionSummary ? <div className="space-y-1 text-sm"><p>Resolution: {negotiation.resolutionSummary}</p>{negotiation.replacementEnvelopeId ? <p className="text-xs text-muted-foreground">Replacement envelope <code>{negotiation.replacementEnvelopeId}</code> · document <code>{negotiation.replacementDocumentVersionId}</code></p> : null}</div> : null}</div>)}</div> : null}
              {current.state === "completed" ? <div className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Evidence integrity</p><p className="text-xs text-muted-foreground">EOS independently re-reads every private artifact, recomputes the event chain, and compares the sealed audit snapshot.</p></div>{detail.data.integrityChecks[0] ? <Badge variant={stateVariant(detail.data.integrityChecks[0].state)}>{detail.data.integrityChecks[0].state}</Badge> : <Badge variant="outline">not checked</Badge>}</div>{detail.data.integrityChecks[0] ? <div className="grid gap-2 rounded-lg bg-muted p-3 text-xs sm:grid-cols-2"><p>{detail.data.integrityChecks[0].eventCount} chained events · {detail.data.integrityChecks[0].auditedEventCount} sealed events</p><p>{detail.data.integrityChecks[0].captureCount} signature captures</p><p>Source <code>{detail.data.integrityChecks[0].sourceSha256.slice(0, 16)}…</code></p><p>Final <code>{detail.data.integrityChecks[0].finalSha256.slice(0, 16)}…</code></p><p>Audit <code>{detail.data.integrityChecks[0].auditSha256.slice(0, 16)}…</code></p><p>Check <code>{detail.data.integrityChecks[0].checkSha256.slice(0, 16)}…</code></p><p className="sm:col-span-2">{detail.data.integrityChecks[0].failureCodes.length ? `Attention: ${detail.data.integrityChecks[0].failureCodes.join(", ").replaceAll("_", " ")}` : `Verified ${new Date(detail.data.integrityChecks[0].checkedAt).toLocaleString()} by ${detail.data.integrityChecks[0].triggerType}.`}</p></div> : <p className="text-sm text-muted-foreground">No durable verification observation exists yet.</p>}{canOperate ? <div className="flex flex-col gap-2 sm:flex-row"><Input value={integrityReason} onChange={(event) => setIntegrityReason(event.target.value)} placeholder="Reason for verification"/><Button variant="outline" onClick={() => verifyIntegrity.mutate(current.id)} disabled={verifyIntegrity.isPending || integrityReason.trim().length < 8}>{verifyIntegrity.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4"/>}Verify evidence now</Button></div> : null}{detail.data.integrityChecks.length > 1 ? <details><summary className="cursor-pointer text-xs font-medium">Verification history ({detail.data.integrityChecks.length})</summary><div className="mt-2 space-y-2">{detail.data.integrityChecks.map((check) => <div key={check.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs"><span>{new Date(check.checkedAt).toLocaleString()} · {check.triggerType}</span><span className="flex items-center gap-2"><Badge variant={stateVariant(check.state)}>{check.state}</Badge><code>{check.checkSha256.slice(0, 12)}…</code></span></div>)}</div></details> : null}</div> : null}
              {custodyPanel}
              {current.state === "completed" ? current.evidenceId ? <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Canonical Evidence linked</AlertTitle><AlertDescription>This executed contract is attached to Work Packet {current.workPacketId} under Evidence {current.evidenceId}.</AlertDescription></Alert> : canOperate ? <details className="rounded-xl border border-primary/30 bg-primary/5 p-4"><summary className="cursor-pointer font-semibold">Promote into canonical EOS Evidence</summary><div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">Promotion requires a current passing integrity check, active retention policy, and verified custody for every artifact. It never happens automatically.</p><select className="h-10 w-full rounded-md border bg-background px-3" value={promotionDraft.workPacketId || current.workPacketId || ""} onChange={(event) => setPromotionDraft((value) => ({ ...value, workPacketId: event.target.value }))}><option value="">Choose Work Packet</option>{workPackets.data?.map((packet) => <option key={packet.id} value={packet.id}>{packet.title} · {packet.status}</option>)}</select><Textarea value={promotionDraft.supportedClaimSummary} onChange={(event) => setPromotionDraft((value) => ({ ...value, supportedClaimSummary: event.target.value }))} placeholder="Exact claim this executed agreement supports"/><Input value={promotionDraft.verifierMethod} onChange={(event) => setPromotionDraft((value) => ({ ...value, verifierMethod: event.target.value }))} placeholder="Verification method"/><Button onClick={() => promoteEvidence.mutate(current.id)} disabled={promoteEvidence.isPending || !(promotionDraft.workPacketId || current.workPacketId) || promotionDraft.supportedClaimSummary.trim().length < 10 || promotionDraft.verifierMethod.trim().length < 8}><ShieldCheck className="mr-2 h-4 w-4"/>{promoteEvidence.isPending ? "Promoting…" : "Promote verified contract"}</Button></div></details> : null : null}
              {canOperate && current.state === "completed" && current.evidenceId ? <details className="rounded-xl border border-primary/30 bg-primary/5 p-4"><summary className="cursor-pointer font-semibold">Record a human-reviewed contract obligation</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><p className="text-xs text-muted-foreground sm:col-span-2">EOS records the operator's interpretation and exact source excerpt. It does not autonomously interpret law or approve legal conclusions.</p><Input value={obligationDraft.title} onChange={(event) => setObligationDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Obligation title"/><Input value={obligationDraft.obligationKey} onChange={(event) => setObligationDraft((value) => ({ ...value, obligationKey: roleKey(event.target.value) }))} placeholder="Unique obligation key"/><label className="space-y-1 text-sm font-medium">Accountable seat<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={obligationDraft.ownerSeatId} onChange={(event) => setObligationDraft((value) => ({ ...value, ownerSeatId: event.target.value }))}><option value="">Choose an active visible seat</option>{seats.filter((seat) => !seat.status || seat.status === "active").map((seat) => <option key={seat.id} value={seat.id}>{seat.title || seat.kind || seat.agentName || "EOS seat"}</option>)}</select></label><label className="space-y-1 text-sm font-medium">First review<Input type="datetime-local" value={obligationDraft.dueReviewAt} onChange={(event) => setObligationDraft((value) => ({ ...value, dueReviewAt: event.target.value }))}/></label><Textarea className="sm:col-span-2" value={obligationDraft.description} onChange={(event) => setObligationDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Operational obligation, trigger, and consequence"/><Textarea className="sm:col-span-2" value={obligationDraft.sourceExcerpt} onChange={(event) => setObligationDraft((value) => ({ ...value, sourceExcerpt: event.target.value }))} placeholder="Exact contract excerpt reviewed by the operator"/><div className="sm:col-span-2"><Button onClick={() => promoteObligation.mutate(current.id)} disabled={promoteObligation.isPending || obligationDraft.title.trim().length < 2 || roleKey(obligationDraft.obligationKey).length < 2 || obligationDraft.ownerSeatId.trim().length < 10 || obligationDraft.description.trim().length < 10 || obligationDraft.sourceExcerpt.trim().length < 5}><ShieldCheck className="mr-2 h-4 w-4"/>Promote obligation</Button></div>{detail.data.obligationPromotions.length ? <p className="text-xs text-muted-foreground sm:col-span-2">{detail.data.obligationPromotions.length} obligation{detail.data.obligationPromotions.length === 1 ? "" : "s"} already promoted from this Evidence.</p> : null}</div></details> : null}
              {detail.data.obligationPromotions.length ? <section className="space-y-3 rounded-xl border p-4" aria-label="Promoted contract obligations">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Contract obligation operations</p><p className="text-xs text-muted-foreground">Review accountable work against separate verified Evidence. Contract source Evidence alone cannot prove performance or breach.</p></div>{onOpenCommand ? <Button size="sm" variant="outline" onClick={onOpenCommand}><ListChecks className="mr-2 h-4 w-4"/>Open Command</Button> : null}</div>
                {detail.data.obligationPromotions.map((promotion) => {
                  const obligation = promotion.obligation;
                  if (!obligation) return <Alert key={promotion.id} variant="destructive"><AlertTitle>Canonical obligation unavailable</AlertTitle><AlertDescription>Promotion {promotion.id} remains preserved, but its mutable command projection could not be loaded.</AlertDescription></Alert>;
                  const nextStates = (nextRiskControlStates as (state: string) => readonly string[])(obligation.state);
                  const draft = reviewDraftFor(promotion);
                  const operationalEvidence = evidence.filter((item) => item.verificationState === "verified" && item.id !== promotion.evidenceId);
                  const requiresOperationalEvidence = ["overdue_breached", "satisfied_closed"].includes(draft.targetState);
                  const requiresNextReview = !["satisfied_closed", "superseded"].includes(draft.targetState);
                  const reviewReady = Boolean(draft.targetState && draft.ownerSeatId && draft.reviewNote.trim().length >= 8 && (!requiresNextReview || draft.nextReviewAt) && (!requiresOperationalEvidence || draft.evidenceIds.length));
                  return <article key={promotion.id} className="space-y-3 rounded-lg border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{obligation.title}</p><p className="text-sm text-muted-foreground">{obligation.descriptionCauseEventImpact}</p></div><div className="flex flex-wrap gap-1"><Badge variant={stateVariant(obligation.state)}>{obligation.state.replaceAll("_", " ")}</Badge><Badge variant="outline">{promotion.ownerSeat?.title || seats.find((seat) => seat.id === obligation.ownerSeatId)?.title || "Accountable seat"}</Badge></div></div>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span>Source {promotion.sourceExcerptSha256.slice(0, 12)}…</span><span>{obligation.dueReviewAt ? `Review ${new Date(obligation.dueReviewAt).toLocaleString()}` : "No review scheduled"}</span><span>{promotion.reviews.length} sealed review{promotion.reviews.length === 1 ? "" : "s"}</span></div>
                    <details className="rounded-md bg-muted/50 p-3"><summary className="cursor-pointer text-xs font-medium">Reviewed source excerpt</summary><blockquote className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">{promotion.sourceExcerpt}</blockquote></details>
                    {canOperate && nextStates.length ? <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-2">
                      <label className="space-y-1 text-sm font-medium">Next governed state<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={draft.targetState} onChange={(event) => updateReviewDraft(promotion, { targetState: event.target.value, evidenceIds: [] })}>{nextStates.map((state) => <option key={state} value={state}>{state.replaceAll("_", " ")}</option>)}</select></label>
                      <label className="space-y-1 text-sm font-medium">Accountable seat<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={draft.ownerSeatId} onChange={(event) => updateReviewDraft(promotion, { ownerSeatId: event.target.value })}>{seats.filter((seat) => !seat.status || seat.status === "active").map((seat) => <option key={seat.id} value={seat.id}>{seat.title || seat.kind || seat.agentName || "EOS seat"}</option>)}</select></label>
                      {requiresNextReview ? <label className="space-y-1 text-sm font-medium sm:col-span-2">Next review<Input type="datetime-local" value={draft.nextReviewAt} onChange={(event) => updateReviewDraft(promotion, { nextReviewAt: event.target.value })}/></label> : null}
                      <label className="space-y-1 text-sm font-medium sm:col-span-2">Review finding<Textarea value={draft.reviewNote} onChange={(event) => updateReviewDraft(promotion, { reviewNote: event.target.value })} placeholder="What was reviewed, what the Evidence establishes, and what happens next"/></label>
                      <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">Operational Evidence {requiresOperationalEvidence ? <span className="text-destructive">required</span> : <span className="text-muted-foreground">optional</span>}</legend>{operationalEvidence.length ? <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border bg-background p-3">{operationalEvidence.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={draft.evidenceIds.includes(item.id)} onCheckedChange={(checked) => updateReviewDraft(promotion, { evidenceIds: checked ? [...draft.evidenceIds, item.id] : draft.evidenceIds.filter((id) => id !== item.id) })}/><span><span className="font-medium">{item.title || item.evidenceType || "Verified Evidence"}</span><span className="block text-xs text-muted-foreground">{item.evidenceType || "evidence"} · {item.id.slice(0, 8)}…</span></span></label>)}</div> : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No separate verified operational Evidence is visible yet. Add and verify Evidence in Command before recording breach or satisfaction.</p>}</fieldset>
                      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">{onOpenCommand ? <Button size="sm" variant="ghost" onClick={onOpenCommand}>Manage Evidence</Button> : null}<Button size="sm" onClick={() => reviewObligation.mutate({ promotion, draft })} disabled={!reviewReady || reviewObligation.isPending}><ShieldCheck className="mr-2 h-4 w-4"/>{reviewObligation.isPending ? "Sealing review…" : "Record review"}</Button></div>
                    </div> : <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">This obligation has no further permitted state transition. Its immutable review history remains available below.</p>}
                    {promotion.reviews.length ? <details><summary className="cursor-pointer text-sm font-medium">Review receipts ({promotion.reviews.length})</summary><div className="mt-2 space-y-2">{promotion.reviews.map((review) => <div key={review.id} className="rounded-md border p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{review.stateBefore.replaceAll("_", " ")} → {review.stateAfter.replaceAll("_", " ")}</span><span className="text-muted-foreground">{new Date(review.reviewedAt).toLocaleString()}</span></div><p className="mt-2 text-sm">{review.reviewNote}</p><p className="mt-2 text-muted-foreground">{review.evidenceIds.length} operational Evidence · {review.authorityClass} authority · receipt {review.reviewSha256.slice(0, 12)}…</p></div>)}</div></details> : null}
                  </article>;
                })}
              </section> : null}
              {canOperate && current.state === "draft" && editingEnvelopeId === current.id ? <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><div><p className="font-semibold">Edit draft revision {current.version}</p><p className="text-xs text-muted-foreground">Saving replaces the unissued recipient snapshot atomically. Stale revisions fail closed.</p></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-sm font-medium">Subject<Input value={envelopeDraft.subject} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, subject: event.target.value }))}/></label><label className="space-y-1 text-sm font-medium">Expires<Input type="datetime-local" value={envelopeDraft.expiresAt} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, expiresAt: event.target.value }))}/></label><label className="space-y-1 text-sm font-medium">Routing<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={envelopeDraft.routingMode} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, routingMode: event.target.value as "sequential" | "parallel" }))}><option value="sequential">Sequential</option><option value="parallel">Parallel</option></select></label><label className="space-y-1 text-sm font-medium">Signer assurance<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={envelopeDraft.assuranceMode} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, assuranceMode: event.target.value as "link" | "email_otp" }))}><option value="link">Private link</option><option value="email_otp">Private link + email OTP</option></select></label><label className="space-y-1 text-sm font-medium md:col-span-2">Message<Textarea value={envelopeDraft.message} onChange={(event) => setEnvelopeDraft((value) => ({ ...value, message: event.target.value }))}/></label></div><div className="space-y-3">{recipientDrafts.map((recipient, index) => <div key={recipient.roleKey} className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[150px_1fr_1fr_100px]"><div><p className="text-xs text-muted-foreground">Role</p><p className="font-medium">{recipient.roleKey}</p></div><Input value={recipient.signerName} onChange={(event) => setRecipientDrafts((items) => items.map((item, position) => position === index ? { ...item, signerName: event.target.value } : item))} placeholder="Signer name"/><Input type="email" value={recipient.signerEmail} onChange={(event) => setRecipientDrafts((items) => items.map((item, position) => position === index ? { ...item, signerEmail: event.target.value } : item))} placeholder="signer@example.com"/><Input type="number" min={1} max={100} disabled={envelopeDraft.routingMode === "parallel"} value={envelopeDraft.routingMode === "parallel" ? 1 : recipient.routingOrder} onChange={(event) => setRecipientDrafts((items) => items.map((item, position) => position === index ? { ...item, routingOrder: Number(event.target.value) } : item))} aria-label={`${recipient.roleKey} routing order`}/></div>)}</div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingEnvelopeId("")}>Cancel</Button><Button type="button" onClick={() => updateEnvelope.mutate(current)} disabled={!canUpdateEnvelope || updateEnvelope.isPending}><Save className="mr-2 h-4 w-4"/>{updateEnvelope.isPending ? "Saving…" : "Save revision"}</Button></div></div> : null}
              <div className="space-y-3">{detail.data.recipients.map((recipient) => {
                const active = recipient.routingState === "active" && ["pending", "sent", "opened", "consented"].includes(recipient.state) && ["issued", "in_progress"].includes(current.state);
                const correcting = correctingRecipientId === recipient.id;
                const identityChanged = recipientCorrection.signerName.trim() !== recipient.signerName || recipientCorrection.signerEmail.trim().toLowerCase() !== recipient.signerEmail.toLowerCase();
                const correctionReady = identityChanged && recipientCorrection.signerName.trim().length >= 2 && /.+@.+\..+/.test(recipientCorrection.signerEmail) && recipientCorrection.reason.trim().length >= 8;
                return <div key={recipient.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{recipient.signerName}</p><p className="text-sm text-muted-foreground">{recipient.signerEmail} · {recipient.roleKey} · order {recipient.routingOrder}</p>{recipient.routingState === "waiting" ? <p className="mt-1 text-xs text-muted-foreground">Waiting for the earlier routing stage. Email, reminders, and replacement links stay locked.</p> : null}{recipient.state === "signed" ? <p className="mt-1 text-xs text-muted-foreground">{recipient.signatureMethod} signature · capture {recipient.signatureCaptureSha256.slice(0, 16)}…{recipient.signatureCaptureMimeType ? ` · ${recipient.signatureCaptureMimeType} ${recipient.signatureCaptureWidth}×${recipient.signatureCaptureHeight} · ${recipient.signatureCaptureSizeBytes.toLocaleString()} bytes` : " · canonical typed evidence"}</p> : null}</div><div className="flex flex-wrap gap-1"><Badge variant={stateVariant(recipient.state)}>{recipient.state}</Badge>{recipient.routingState === "waiting" ? <Badge variant="outline">waiting for order</Badge> : null}<Badge variant={stateVariant(recipient.deliveryState)}>{recipient.deliveryState.replaceAll("_", " ")}</Badge>{current.assuranceMode === "email_otp" ? <Badge variant={recipient.identityAssuranceState === "verified" ? "default" : "outline"}>OTP {recipient.identityAssuranceState}</Badge> : null}{current.state === "completed" ? <Badge variant={stateVariant(recipient.completionDeliveryState)}>{`receipt ${recipient.completionDeliveryState.replaceAll("_", " ")}`}</Badge> : null}</div></div>
                  {transientLinks[recipient.id] ? <div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{transientLinks[recipient.id]}</code><Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(transientLinks[recipient.id])} aria-label="Copy private signing link"><Copy className="h-4 w-4"/></Button></div> : null}
                  {canOperate && active && !current.recoveryAgreementInstanceId && correcting ? <div className="mt-3 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div><p className="font-medium">Correct recipient identity</p><p className="text-xs text-muted-foreground">This invalidates the current link and consent. Earlier delivery attempts remain in the audit record.</p></div>
                    <div className="grid gap-2 sm:grid-cols-2"><Input value={recipientCorrection.signerName} onChange={(event) => setRecipientCorrection((value) => ({ ...value, signerName: event.target.value }))} placeholder="Correct signer name"/><Input type="email" value={recipientCorrection.signerEmail} onChange={(event) => setRecipientCorrection((value) => ({ ...value, signerEmail: event.target.value }))} placeholder="corrected@example.com"/></div>
                    <Textarea value={recipientCorrection.reason} onChange={(event) => setRecipientCorrection((value) => ({ ...value, reason: event.target.value }))} placeholder="Reason for correcting this recipient"/>
                    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCorrectingRecipientId("")}>Cancel</Button><Button type="button" onClick={() => correctRecipient.mutate({ envelopeId: current.id, recipient })} disabled={!correctionReady || correctRecipient.isPending}><Save className="mr-2 h-4 w-4"/>{correctRecipient.isPending ? "Correcting…" : "Correct recipient"}</Button></div>
                  </div> : null}
                  {canOperate && active && !correcting ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => deliver.mutate({ envelopeId: current.id, recipientId: recipient.id })} disabled={deliver.isPending}><Mail className="mr-2 h-4 w-4"/>{recipient.deliveryAttemptCount ? "Send reminder" : "Email"}</Button><Button size="sm" variant="ghost" onClick={() => rotate.mutate({ envelopeId: current.id, recipientId: recipient.id })} disabled={rotate.isPending}><RotateCw className="mr-2 h-4 w-4"/>Rotate link</Button>{!current.recoveryAgreementInstanceId ? <Button size="sm" variant="ghost" onClick={() => beginRecipientCorrection(recipient)}><Pencil className="mr-2 h-4 w-4"/>Correct recipient</Button> : null}</div> : null}
                  {canOperate && active && recipient.state !== "pending" ? (() => { const schedule = detail.data.reminderSchedules.find((item) => item.recipientId === recipient.id && ["active", "paused"].includes(item.state)); return schedule ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2 text-xs"><CalendarClock className="h-4 w-4"/><span>{schedule.state} · {schedule.sentCount}/{schedule.maxReminders} sent · next {new Date(schedule.nextReminderAt).toLocaleString()}</span><Button size="sm" variant="ghost" onClick={() => updateReminder.mutate({ schedule, state: schedule.state === "active" ? "paused" : "active" })}>{schedule.state === "active" ? "Pause" : "Resume"}</Button><Button size="sm" variant="ghost" onClick={() => updateReminder.mutate({ schedule, state: "cancelled" })}>Cancel</Button></div> : <details className="mt-3 rounded-lg border p-2"><summary className="cursor-pointer text-xs font-medium">Schedule reminders</summary><div className="mt-2 grid gap-2 sm:grid-cols-3"><Input type="datetime-local" value={reminderDraft.nextReminderAt} onChange={(event) => setReminderDraft((value) => ({ ...value, nextReminderAt: event.target.value }))}/><Input type="number" min={1} max={30} value={reminderDraft.intervalDays} onChange={(event) => setReminderDraft((value) => ({ ...value, intervalDays: Number(event.target.value) }))} aria-label="Reminder interval days"/><Input type="number" min={1} max={20} value={reminderDraft.maxReminders} onChange={(event) => setReminderDraft((value) => ({ ...value, maxReminders: Number(event.target.value) }))} aria-label="Maximum reminders"/><Button size="sm" variant="outline" onClick={() => scheduleReminder.mutate({ envelopeId: current.id, recipientId: recipient.id })} disabled={scheduleReminder.isPending}><CalendarClock className="mr-2 h-4 w-4"/>Activate</Button></div></details>; })() : null}
                  {canOperate && current.state === "completed" && ["retry", "dead_letter"].includes(recipient.completionDeliveryState) ? <Button className="mt-3" size="sm" variant="outline" onClick={() => replayCompletion.mutate({ envelopeId: current.id, recipientId: recipient.id })} disabled={replayCompletion.isPending}><RotateCw className="mr-2 h-4 w-4"/>Replay completion receipt</Button> : null}
                </div>;
              })}</div>
              <div className="flex flex-wrap gap-2">{canOperate && current.state === "draft" ? <><Button variant="outline" onClick={() => beginDraftEdit(current, detail.data.recipients)} disabled={editingEnvelopeId === current.id}><Pencil className="mr-2 h-4 w-4"/>Edit draft</Button>{!current.replacesEnvelopeId || canApproveReplacements ? <Button onClick={() => issueEnvelope.mutate({ id: current.id, comparisonReviewSha256: detail.data.comparison?.comparisonSha256 })} disabled={issueEnvelope.isPending || editingEnvelopeId === current.id || Boolean(current.replacesEnvelopeId && (!detail.data.comparison || comparisonReviews[current.id] !== true))}><Send className="mr-2 h-4 w-4"/>Issue envelope</Button> : null}</> : null}{current.state === "completed" ? <><Button variant="outline" onClick={() => void downloadAuthenticated(`${root}/native-esign/envelopes/${current.id}/completed-document`, `${current.id}-signed.pdf`).catch((error) => fail("Signed PDF download failed", error))}><Download className="mr-2 h-4 w-4"/>Signed PDF</Button><Button variant="outline" onClick={() => void downloadAuthenticated(`${root}/native-esign/envelopes/${current.id}/audit`, `${current.id}-audit.json`).catch((error) => fail("Audit download failed", error))}><Download className="mr-2 h-4 w-4"/>Audit record</Button></> : null}{canOperate && current.state === "recovery_required" ? <Button onClick={() => recover.mutate(current.id)} disabled={recover.isPending}><ShieldAlert className="mr-2 h-4 w-4"/>Recover seal</Button> : null}</div>
              {canOperate && ["draft", "issued", "in_progress"].includes(current.state) ? <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row"><Input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Reason for voiding this envelope"/><Button variant="destructive" onClick={() => voidEnvelope.mutate(current)} disabled={voidReason.trim().length < 8 || voidEnvelope.isPending}><XCircle className="mr-2 h-4 w-4"/>Void</Button></div> : null}
              <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Audit timeline ({detail.data.events.length})</summary><div className="mt-3 space-y-2">{detail.data.events.map((event) => <div key={String(event.id)} className="flex items-center justify-between gap-3 text-xs"><span>{String(event.eventType || "event").replaceAll("_", " ")}</span><span className="text-muted-foreground">{event.occurredAt ? new Date(String(event.occurredAt)).toLocaleString() : ""}</span></div>)}</div></details>
            </div> : detail.isLoading ? <p className="text-sm text-muted-foreground">Loading envelope…</p> : <Alert><ShieldAlert className="h-4 w-4"/><AlertTitle>Select an envelope</AlertTitle><AlertDescription>Review tenant-scoped recipients, delivery receipts, lifecycle controls, and audit evidence.</AlertDescription></Alert>}</div></div>
        </TabsContent>
        <TabsContent value="operations" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border p-4"><p className="text-2xl font-semibold">{operations.data?.subscriptions.filter((item) => item.state === "active").length || 0}</p><p className="text-sm text-muted-foreground">active webhook subscriptions</p></div><div className="rounded-xl border p-4"><p className="text-2xl font-semibold">{operations.data?.webhookDeliveries.filter((item) => item.state === "dead_letter").length || 0}</p><p className="text-sm text-muted-foreground">webhook dead letters</p></div><div className="rounded-xl border p-4"><p className="text-2xl font-semibold">{operations.data?.completionDeliveries.filter((item) => item.state === "dead_letter").length || 0}</p><p className="text-sm text-muted-foreground">completion dead letters</p></div><div className="rounded-xl border p-4"><p className="text-2xl font-semibold">{operations.data?.integrityChecks.filter((item) => item.state !== "passed").length || 0}</p><p className="text-sm text-muted-foreground">integrity checks requiring attention</p></div></div>
          {canOperate ? <div className="space-y-3 rounded-xl border p-4"><div><p className="font-semibold">Create signed lifecycle webhook</p><p className="text-xs text-muted-foreground">EOS signs the exact JSON body with HMAC-SHA256 and retries acknowledged failures through a durable queue.</p></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-sm font-medium">HTTPS endpoint<Input value={webhookDraft.endpointUrl} onChange={(event) => setWebhookDraft((value) => ({ ...value, endpointUrl: event.target.value }))} placeholder="https://operations.example.com/eos-signing"/></label><label className="space-y-1 text-sm font-medium">Description<Input value={webhookDraft.description} onChange={(event) => setWebhookDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Contract lifecycle automation"/></label><label className="space-y-1 text-sm font-medium md:col-span-2">Events<Input value={webhookDraft.eventTypes} onChange={(event) => setWebhookDraft((value) => ({ ...value, eventTypes: event.target.value }))} placeholder="* or envelope_completed,recipient_declined"/></label></div><Button onClick={() => createWebhook.mutate()} disabled={createWebhook.isPending || !webhookDraft.endpointUrl.trim()}><Webhook className="mr-2 h-4 w-4"/>Create webhook</Button>{webhookSecret ? <Alert><ShieldAlert className="h-4 w-4"/><AlertTitle>Copy this signing secret now</AlertTitle><AlertDescription><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-muted p-2 text-xs">{webhookSecret}</code><Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(webhookSecret)} aria-label="Copy webhook signing secret"><Copy className="h-4 w-4"/></Button></div></AlertDescription></Alert> : null}</div> : null}
          <div className="space-y-3"><div className="flex items-center justify-between"><div><p className="font-semibold">Webhook destinations</p><p className="text-xs text-muted-foreground">Secrets are write-only. Fingerprints let operators confirm which key is active.</p></div><Button size="sm" variant="outline" onClick={() => operations.refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>{operations.isLoading ? <p className="text-sm text-muted-foreground">Loading signing operations…</p> : operations.data?.subscriptions.map((subscription) => <div key={subscription.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{subscription.description || "Signing lifecycle webhook"}</p><p className="break-all text-sm text-muted-foreground">{subscription.endpointUrl}</p><p className="mt-2 text-xs text-muted-foreground">Events {subscription.eventTypes.join(", ")} · key {subscription.secretFingerprint.slice(0, 12)}…</p></div><Badge variant={stateVariant(subscription.state)}>{subscription.state}</Badge></div>{canOperate && subscription.state !== "revoked" ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => updateWebhook.mutate({ subscription, state: subscription.state === "active" ? "paused" : "active" })}>{subscription.state === "active" ? "Pause" : "Resume"}</Button><Button size="sm" variant="outline" onClick={() => rotateWebhookSecret.mutate(subscription)}><RotateCw className="mr-2 h-4 w-4"/>Rotate secret</Button><Button size="sm" variant="destructive" onClick={() => updateWebhook.mutate({ subscription, state: "revoked" })}>Revoke</Button></div> : null}</div>)}</div>
          <div className="space-y-3 rounded-xl border p-4"><div><p className="font-semibold">Recovery and replay</p><p className="text-xs text-muted-foreground">Replays preserve every prior attempt and never rewrite a delivered receipt.</p></div>{canOperate ? <Input value={replayReason} onChange={(event) => setReplayReason(event.target.value)} placeholder="Reason for controlled replay"/> : null}<div className="space-y-2">{operations.data?.webhookDeliveries.filter((delivery) => ["retry", "dead_letter"].includes(String(delivery.state))).map((delivery) => <div key={String(delivery.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3"><div><p className="text-sm font-medium">Webhook {String(delivery.id).slice(0, 8)} · {String(delivery.state).replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{Number(delivery.attemptCount)} attempts · {String(delivery.lastFailureMessage || "awaiting retry")}</p></div>{canOperate ? <Button size="sm" variant="outline" onClick={() => replayWebhook.mutate(String(delivery.id))} disabled={replayWebhook.isPending || replayReason.trim().length < 8}><RotateCw className="mr-2 h-4 w-4"/>Replay</Button> : null}</div>)}{!operations.data?.webhookDeliveries.some((delivery) => ["retry", "dead_letter"].includes(String(delivery.state))) ? <p className="text-sm text-muted-foreground">No failed webhook deliveries require operator action.</p> : null}</div></div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>;
}
