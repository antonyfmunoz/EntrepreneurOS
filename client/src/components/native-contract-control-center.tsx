import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, FileClock, MailCheck, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { nativeEsignErrorMessage } from "@/lib/native-esign";
import { apiRequest } from "@/lib/queryClient";

type Seat = { id: string; title?: string; kind?: string; agentName?: string; status?: string };
type Evidence = { id: string; title?: string; verificationState?: string; evidenceType?: string };
type Plan = { id: string; lifecycleState: string; renewalIntent: string; effectiveAt: string; contractEndsAt?: string | null; noticeDeadlineAt?: string | null; nextReviewAt: string; ownerSeatId: string; classification: string; notes: string; version: number };
type NoticeAttempt = { id: string; attemptNumber: number; state: string; providerMessageReference: string; failureMessage: string; reconciliationNote: string; preparedAt: string; completedAt?: string | null };
type ContractNotice = { id: string; noticeType: string; recipientName: string; recipientEmail: string; subject: string; bodyText: string; dueAt: string; ownerSeatId: string; classification: string; contentSha256: string; state: string; version: number; approvalEvidenceIds: string[]; approvalNote: string; approvalSha256: string; approvedAt?: string | null; providerMessageReference: string; deliveredAt?: string | null; attempts: NoticeAttempt[] };
type Contract = {
  envelope: { id: string; subject: string; completedAt?: string | null; evidenceId?: string | null };
  document: { id: string; title: string; documentKey: string; documentVersion: string } | null;
  counterparty: { id: string; displayName: string; legalName: string; signerName: string; signerEmail: string } | null;
  plan: Plan | null;
  owner: Seat | null;
  events: Array<{ id: string; eventType: string; note: string; eventSha256: string; recordedAt: string; evidenceIds: string[] }>;
  obligations: Array<{ id: string; title: string; state: string; dueReviewAt?: string | null }>;
  renewalDraft: { id: string; subject: string; state: string } | null;
  notices: ContractNotice[];
  urgency: { reviewDue: boolean; noticeDue: boolean; termDue: boolean; overdueObligations: number };
  readiness: { evidencePromoted: boolean; integrityPassed: boolean; custodyVerified: boolean };
};
type ControlCenter = { generatedAt: string; metrics: { executedAgreements: number; unplanned: number; reviewDue: number; noticeDue: number; overdueObligations: number; noticeActions: number; custodyExceptions: number }; contracts: Contract[] };
type PlanDraft = { effectiveAt: string; contractEndsAt: string; noticeDeadlineAt: string; nextReviewAt: string; ownerSeatId: string; classification: string; notes: string };
type NoticeDraft = { noticeType: string; recipientName: string; recipientEmail: string; subject: string; bodyText: string; dueAt: string; ownerSeatId: string; classification: string };

async function requestJson<T>(method: "GET" | "POST" | "PUT", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

function localDateTime(value?: string | Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function defaultReview(): string {
  return localDateTime(new Date(Date.now() + 30 * 86_400_000));
}

function defaultNoticeDue(): string {
  return localDateTime(new Date(Date.now() + 3 * 86_400_000));
}

function statusVariant(value: string): "default" | "secondary" | "outline" | "destructive" {
  if (["active", "renew", "completed"].includes(value)) return "default";
  if (["up_for_renewal", "renewal_in_progress", "renegotiate"].includes(value)) return "secondary";
  if (["expired", "terminate", "allow_expiry"].includes(value)) return "destructive";
  return "outline";
}

export function NativeContractControlCenter({ root, canOperate, seats, evidence }: { root: string; canOperate: boolean; seats: Seat[]; evidence: Evidence[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [planDraft, setPlanDraft] = useState<PlanDraft>({ effectiveAt: "", contractEndsAt: "", noticeDeadlineAt: "", nextReviewAt: defaultReview(), ownerSeatId: seats[0]?.id || "", classification: "confidential", notes: "" });
  const [decisionId, setDecisionId] = useState("");
  const [decision, setDecision] = useState({ intent: "renew", evidenceIds: [] as string[], decisionNote: "" });
  const [noticeContractId, setNoticeContractId] = useState("");
  const [noticeDraft, setNoticeDraft] = useState<NoticeDraft>({ noticeType: "renewal_offer", recipientName: "", recipientEmail: "", subject: "", bodyText: "", dueAt: defaultNoticeDue(), ownerSeatId: seats[0]?.id || "", classification: "confidential" });
  const [approvalNoticeId, setApprovalNoticeId] = useState("");
  const [noticeApproval, setNoticeApproval] = useState({ evidenceIds: [] as string[], approvalNote: "" });
  const [reconcileNoticeId, setReconcileNoticeId] = useState("");
  const [reconciliation, setReconciliation] = useState({ outcome: "uncertain", providerMessageReference: "", reconciliationNote: "" });
  const control = useQuery<ControlCenter>({ queryKey: [`${root}/native-esign/contracts/control-center`], queryFn: () => requestJson("GET", `${root}/native-esign/contracts/control-center`) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/contracts/control-center`] }),
      queryClient.invalidateQueries({ queryKey: [`${root}/native-esign/envelopes`] }),
    ]);
  };
  const fail = (label: string, error: unknown) => toast({ title: nativeEsignErrorMessage(label, error), variant: "destructive" });
  const openPlan = (contract: Contract) => {
    setEditingId(contract.envelope.id);
    setDecisionId("");
    setPlanDraft({
      effectiveAt: localDateTime(contract.plan?.effectiveAt || contract.envelope.completedAt),
      contractEndsAt: localDateTime(contract.plan?.contractEndsAt),
      noticeDeadlineAt: localDateTime(contract.plan?.noticeDeadlineAt),
      nextReviewAt: localDateTime(contract.plan?.nextReviewAt) || defaultReview(),
      ownerSeatId: contract.plan?.ownerSeatId || seats[0]?.id || "",
      classification: contract.plan?.classification || "confidential",
      notes: contract.plan?.notes || "",
    });
  };
  const savePlan = useMutation({
    mutationFn: (contract: Contract) => requestJson("PUT", `${root}/native-esign/contracts/${contract.envelope.id}/plan`, {
      expectedVersion: contract.plan?.version,
      effectiveAt: new Date(planDraft.effectiveAt).toISOString(),
      contractEndsAt: planDraft.contractEndsAt ? new Date(planDraft.contractEndsAt).toISOString() : null,
      noticeDeadlineAt: planDraft.noticeDeadlineAt ? new Date(planDraft.noticeDeadlineAt).toISOString() : null,
      nextReviewAt: new Date(planDraft.nextReviewAt).toISOString(),
      ownerSeatId: planDraft.ownerSeatId,
      classification: planDraft.classification,
      notes: planDraft.notes,
    }),
    onSuccess: async () => { setEditingId(""); await refresh(); toast({ title: "Contract control plan recorded", description: "Agreement dates, accountable ownership, and the immutable schedule receipt are current." }); },
    onError: (error) => fail("Contract plan failed", error),
  });
  const recordDecision = useMutation({
    mutationFn: (contract: Contract) => requestJson("POST", `${root}/native-esign/contracts/${contract.envelope.id}/renewal-decision`, { expectedVersion: contract.plan!.version, ...decision }),
    onSuccess: async () => { setDecisionId(""); setDecision({ intent: "renew", evidenceIds: [], decisionNote: "" }); await refresh(); toast({ title: "Renewal decision recorded", description: "The material decision, Evidence, authority receipt, and hash chain are bound together." }); },
    onError: (error) => fail("Renewal decision failed", error),
  });
  const createRenewal = useMutation({
    mutationFn: (contract: Contract) => requestJson("POST", `${root}/native-esign/envelopes/${contract.envelope.id}/clone`, { mode: "renewal", subject: `${contract.envelope.subject} · renewal`, expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() }),
    onSuccess: async () => { await refresh(); toast({ title: "Renewal draft created", description: "The new draft retains explicit lineage to the executed agreement." }); },
    onError: (error) => fail("Renewal draft failed", error),
  });
  const openNotice = (contract: Contract) => {
    const noticeType = ["renew", "renegotiate"].includes(contract.plan?.renewalIntent || "") ? "renewal_offer" : ["terminate", "allow_expiry"].includes(contract.plan?.renewalIntent || "") ? "nonrenewal" : "other";
    setNoticeContractId(contract.envelope.id); setEditingId(""); setDecisionId(""); setApprovalNoticeId("");
    setNoticeDraft({ noticeType, recipientName: contract.counterparty?.signerName || contract.counterparty?.displayName || "", recipientEmail: contract.counterparty?.signerEmail || "", subject: `${noticeType === "renewal_offer" ? "Renewal" : noticeType === "nonrenewal" ? "Non-renewal" : "Contract notice"}: ${contract.document?.title || contract.envelope.subject}`, bodyText: "", dueAt: contract.plan?.noticeDeadlineAt && new Date(contract.plan.noticeDeadlineAt) > new Date() ? localDateTime(contract.plan.noticeDeadlineAt) : defaultNoticeDue(), ownerSeatId: contract.plan?.ownerSeatId || seats[0]?.id || "", classification: contract.plan?.classification || "confidential" });
  };
  const createNotice = useMutation({
    mutationFn: (contract: Contract) => requestJson("POST", `${root}/native-esign/contracts/${contract.envelope.id}/notices`, { ...noticeDraft, dueAt: new Date(noticeDraft.dueAt).toISOString() }),
    onSuccess: async () => { setNoticeContractId(""); await refresh(); toast({ title: "Notice draft prepared", description: "Exact content is hashed and waiting for evidence-backed approval. Nothing was sent." }); },
    onError: (error) => fail("Notice preparation failed", error),
  });
  const approveNotice = useMutation({
    mutationFn: ({ contract, notice }: { contract: Contract; notice: ContractNotice }) => requestJson("POST", `${root}/native-esign/contracts/${contract.envelope.id}/notices/${notice.id}/approve`, { expectedVersion: notice.version, ...noticeApproval }),
    onSuccess: async () => { setApprovalNoticeId(""); setNoticeApproval({ evidenceIds: [], approvalNote: "" }); await refresh(); toast({ title: "Exact notice approved", description: "The content hash, operational Evidence, decision authority, and approver are now bound together." }); },
    onError: (error) => fail("Notice approval failed", error),
  });
  const deliverNotice = useMutation({
    mutationFn: ({ contract, notice }: { contract: Contract; notice: ContractNotice }) => requestJson("POST", `${root}/native-esign/contracts/${contract.envelope.id}/notices/${notice.id}/deliver`, { expectedVersion: notice.version }),
    onSuccess: async () => { await refresh(); toast({ title: "Contract notice delivered", description: "Gmail returned a provider receipt for the exact approved content." }); },
    onError: async (error) => { await refresh(); fail("Notice delivery needs review", error); },
  });
  const reconcileNotice = useMutation({
    mutationFn: ({ contract, notice }: { contract: Contract; notice: ContractNotice }) => requestJson("POST", `${root}/native-esign/contracts/${contract.envelope.id}/notices/${notice.id}/reconcile`, { expectedVersion: notice.version, ...reconciliation }),
    onSuccess: async () => { setReconcileNoticeId(""); setReconciliation({ outcome: "uncertain", providerMessageReference: "", reconciliationNote: "" }); await refresh(); toast({ title: "Delivery attempt reconciled", description: "The reviewed outcome and policy receipt are now immutable. Retry is available only when the outcome remains failed or uncertain." }); },
    onError: (error) => fail("Notice reconciliation failed", error),
  });

  const rows = useMemo(() => (control.data?.contracts || []).filter((contract) => {
    const search = `${contract.envelope.subject} ${contract.document?.title || ""} ${contract.counterparty?.displayName || ""} ${contract.owner?.title || ""}`.toLowerCase();
    const attention = !contract.plan || contract.urgency.reviewDue || contract.urgency.noticeDue || contract.urgency.termDue || contract.urgency.overdueObligations > 0 || contract.notices.some((notice) => !["delivered", "cancelled"].includes(notice.state)) || !contract.readiness.integrityPassed || !contract.readiness.custodyVerified;
    return search.includes(query.toLowerCase()) && (!onlyAttention || attention);
  }), [control.data, onlyAttention, query]);
  const verifiedEvidence = evidence.filter((item) => item.verificationState === "verified");

  return <div className="space-y-5" data-testid="native-contract-control-center">
    <Card>
      <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Contract control center</CardTitle><CardDescription>Own agreement terms, renewal decisions, obligations, and evidence readiness across the company.</CardDescription></div><Button variant="outline" size="sm" onClick={() => control.refetch()} disabled={control.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${control.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></div></CardHeader>
      <CardContent className="space-y-4">
        <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Agreement dates are human-reviewed</AlertTitle><AlertDescription>Envelope expiry only controls the signing link. EOS never treats it as the effective date, notice deadline, or end of the executed agreement.</AlertDescription></Alert>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{[
          ["Executed", control.data?.metrics.executedAgreements || 0], ["Unplanned", control.data?.metrics.unplanned || 0], ["Review due", control.data?.metrics.reviewDue || 0], ["Notice due", control.data?.metrics.noticeDue || 0], ["Notice actions", control.data?.metrics.noticeActions || 0], ["Obligations overdue", control.data?.metrics.overdueObligations || 0], ["Custody exceptions", control.data?.metrics.custodyExceptions || 0],
        ].map(([label, value]) => <div key={label} className="rounded-lg border bg-muted/30 p-3"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
        <div className="flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agreements, counterparties, or owners"/><label className="flex shrink-0 items-center gap-2 rounded-md border px-3 text-sm"><Checkbox checked={onlyAttention} onCheckedChange={(checked) => setOnlyAttention(Boolean(checked))}/>Needs attention</label></div>
      </CardContent>
    </Card>

    {control.isLoading ? <p className="text-sm text-muted-foreground">Loading contract controls…</p> : null}
    {!control.isLoading && rows.length === 0 ? <Alert><FileClock className="h-4 w-4"/><AlertTitle>No matching executed agreements</AlertTitle><AlertDescription>Complete an envelope or clear the current filters to populate this control center.</AlertDescription></Alert> : null}
    {rows.map((contract) => {
      const isEditing = editingId === contract.envelope.id;
      const isDeciding = decisionId === contract.envelope.id;
      const isPreparingNotice = noticeContractId === contract.envelope.id;
      const decisionEvidence = verifiedEvidence.filter((item) => item.id !== contract.envelope.evidenceId);
      return <Card key={contract.envelope.id} data-testid={`contract-control-${contract.envelope.id}`}>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><CardTitle className="text-lg">{contract.document?.title || contract.envelope.subject}</CardTitle><CardDescription>{contract.counterparty?.displayName || "Counterparty not linked"} · executed {contract.envelope.completedAt ? new Date(contract.envelope.completedAt).toLocaleDateString() : "date unavailable"}</CardDescription></div><div className="flex flex-wrap gap-1">{contract.plan ? <><Badge variant={statusVariant(contract.plan.lifecycleState)}>{contract.plan.lifecycleState.replaceAll("_", " ")}</Badge><Badge variant={statusVariant(contract.plan.renewalIntent)}>{contract.plan.renewalIntent.replaceAll("_", " ")}</Badge></> : <Badge variant="destructive">plan required</Badge>}</div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Accountable owner</p><p className="font-medium">{contract.owner?.title || "Unassigned"}</p></div>
            <div><p className="text-xs text-muted-foreground">Next review</p><p className="font-medium">{contract.plan ? new Date(contract.plan.nextReviewAt).toLocaleString() : "Not scheduled"}</p></div>
            <div><p className="text-xs text-muted-foreground">Notice deadline</p><p className="font-medium">{contract.plan?.noticeDeadlineAt ? new Date(contract.plan.noticeDeadlineAt).toLocaleDateString() : "Not applicable / unknown"}</p></div>
            <div><p className="text-xs text-muted-foreground">Agreement end</p><p className="font-medium">{contract.plan?.contractEndsAt ? new Date(contract.plan.contractEndsAt).toLocaleDateString() : "Open-ended / unknown"}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">{contract.urgency.reviewDue ? <Badge variant="destructive"><CalendarClock className="mr-1 h-3 w-3"/>review overdue</Badge> : null}{contract.urgency.noticeDue ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3"/>notice window</Badge> : null}{contract.urgency.termDue ? <Badge variant="secondary">term within 60 days</Badge> : null}{contract.urgency.overdueObligations ? <Badge variant="destructive">{contract.urgency.overdueObligations} overdue obligation{contract.urgency.overdueObligations === 1 ? "" : "s"}</Badge> : null}<Badge variant={contract.readiness.evidencePromoted ? "default" : "outline"}>Evidence {contract.readiness.evidencePromoted ? "linked" : "missing"}</Badge><Badge variant={contract.readiness.integrityPassed ? "default" : "outline"}>integrity {contract.readiness.integrityPassed ? "passed" : "unverified"}</Badge><Badge variant={contract.readiness.custodyVerified ? "default" : "outline"}>custody {contract.readiness.custodyVerified ? "verified" : "attention"}</Badge></div>
          {contract.obligations.length ? <details><summary className="cursor-pointer text-sm font-medium">Contract obligations ({contract.obligations.length})</summary><div className="mt-2 space-y-2">{contract.obligations.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"><span>{item.title}</span><Badge variant={statusVariant(item.state)}>{item.state.replaceAll("_", " ")}</Badge></div>)}</div></details> : null}
          {isEditing ? <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
            <Label>Effective date and time<Input type="datetime-local" value={planDraft.effectiveAt} onChange={(event) => setPlanDraft((value) => ({ ...value, effectiveAt: event.target.value }))}/></Label>
            <Label>Next governed review<Input type="datetime-local" value={planDraft.nextReviewAt} onChange={(event) => setPlanDraft((value) => ({ ...value, nextReviewAt: event.target.value }))}/></Label>
            <Label>Agreement end, if any<Input type="datetime-local" value={planDraft.contractEndsAt} onChange={(event) => setPlanDraft((value) => ({ ...value, contractEndsAt: event.target.value }))}/></Label>
            <Label>Notice deadline, if any<Input type="datetime-local" value={planDraft.noticeDeadlineAt} onChange={(event) => setPlanDraft((value) => ({ ...value, noticeDeadlineAt: event.target.value }))}/></Label>
            <Label>Accountable seat<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={planDraft.ownerSeatId} onChange={(event) => setPlanDraft((value) => ({ ...value, ownerSeatId: event.target.value }))}>{seats.filter((seat) => seat.status !== "inactive").map((seat) => <option key={seat.id} value={seat.id}>{seat.title || seat.agentName || seat.id}</option>)}</select></Label>
            <Label>Classification<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={planDraft.classification} onChange={(event) => setPlanDraft((value) => ({ ...value, classification: event.target.value }))}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></Label>
            <Label className="sm:col-span-2">Human-reviewed schedule notes<Textarea value={planDraft.notes} onChange={(event) => setPlanDraft((value) => ({ ...value, notes: event.target.value }))} placeholder="Term source, renewal cadence, or exceptions. Do not record unsupported legal conclusions."/></Label>
            <div className="flex gap-2 sm:col-span-2"><Button onClick={() => savePlan.mutate(contract)} disabled={savePlan.isPending || !planDraft.effectiveAt || !planDraft.nextReviewAt || !planDraft.ownerSeatId}>Save governed plan</Button><Button variant="outline" onClick={() => setEditingId("")}>Cancel</Button></div>
          </div> : null}
          {isDeciding && contract.plan ? <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
            <Label>Renewal decision<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={decision.intent} onChange={(event) => setDecision((value) => ({ ...value, intent: event.target.value }))}><option value="renew">Renew</option><option value="renegotiate">Renegotiate</option><option value="terminate">Terminate</option><option value="allow_expiry">Allow expiry</option></select></Label>
            <div><p className="text-sm font-medium">Verified operational Evidence</p><p className="text-xs text-muted-foreground">The agreement itself cannot prove renewal fitness.</p></div>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border bg-background p-3 sm:col-span-2">{decisionEvidence.length ? decisionEvidence.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={decision.evidenceIds.includes(item.id)} onCheckedChange={(checked) => setDecision((value) => ({ ...value, evidenceIds: checked ? [...value.evidenceIds, item.id] : value.evidenceIds.filter((id) => id !== item.id) }))}/><span>{item.title || item.evidenceType || "Verified Evidence"}</span></label>) : <p className="text-xs text-muted-foreground">No separate verified operational Evidence is visible. Verify supporting Evidence in Command first.</p>}</div>
            <Label className="sm:col-span-2">Decision rationale<Textarea value={decision.decisionNote} onChange={(event) => setDecision((value) => ({ ...value, decisionNote: event.target.value }))} placeholder="State the reviewed commercial decision and the Evidence it relies on."/></Label>
            <div className="flex gap-2 sm:col-span-2"><Button onClick={() => recordDecision.mutate(contract)} disabled={recordDecision.isPending || decision.decisionNote.trim().length < 8 || decision.evidenceIds.length === 0}>Record material decision</Button><Button variant="outline" onClick={() => setDecisionId("")}>Cancel</Button></div>
          </div> : null}
          {isPreparingNotice && contract.plan ? <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2" data-testid="contract-notice-form">
            <div className="sm:col-span-2"><p className="font-medium">Prepare exact contract notice</p><p className="text-xs text-muted-foreground">This creates a hashed draft only. Approval and Gmail delivery remain separate controlled actions.</p></div>
            <Label>Notice type<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={noticeDraft.noticeType} onChange={(event) => setNoticeDraft((value) => ({ ...value, noticeType: event.target.value }))}><option value="renewal_offer">Renewal offer</option><option value="nonrenewal">Non-renewal</option><option value="termination">Termination</option><option value="cure">Cure notice</option><option value="other">Other</option></select></Label>
            <Label>Send by<Input type="datetime-local" value={noticeDraft.dueAt} onChange={(event) => setNoticeDraft((value) => ({ ...value, dueAt: event.target.value }))}/></Label>
            <Label>Recipient name<Input value={noticeDraft.recipientName} onChange={(event) => setNoticeDraft((value) => ({ ...value, recipientName: event.target.value }))}/></Label>
            <Label>Recipient email<Input type="email" value={noticeDraft.recipientEmail} onChange={(event) => setNoticeDraft((value) => ({ ...value, recipientEmail: event.target.value }))}/></Label>
            <Label className="sm:col-span-2">Email subject<Input value={noticeDraft.subject} onChange={(event) => setNoticeDraft((value) => ({ ...value, subject: event.target.value }))}/></Label>
            <Label className="sm:col-span-2">Exact notice text<Textarea className="min-h-40" value={noticeDraft.bodyText} onChange={(event) => setNoticeDraft((value) => ({ ...value, bodyText: event.target.value }))} placeholder="Enter the reviewed notice exactly as the counterparty should receive it."/></Label>
            <Label>Accountable seat<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={noticeDraft.ownerSeatId} onChange={(event) => setNoticeDraft((value) => ({ ...value, ownerSeatId: event.target.value }))}>{seats.filter((seat) => seat.status !== "inactive").map((seat) => <option key={seat.id} value={seat.id}>{seat.title || seat.agentName || seat.id}</option>)}</select></Label>
            <Label>Classification<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={noticeDraft.classification} onChange={(event) => setNoticeDraft((value) => ({ ...value, classification: event.target.value }))}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></Label>
            <div className="flex gap-2 sm:col-span-2"><Button onClick={() => createNotice.mutate(contract)} disabled={createNotice.isPending || noticeDraft.recipientName.trim().length < 2 || !noticeDraft.recipientEmail.includes("@") || noticeDraft.subject.trim().length < 2 || noticeDraft.bodyText.trim().length < 20 || !noticeDraft.dueAt || !noticeDraft.ownerSeatId}>Create notice draft</Button><Button variant="outline" onClick={() => setNoticeContractId("")}>Cancel</Button></div>
          </div> : null}
          {contract.notices.length ? <div className="space-y-3" data-testid="contract-notice-list"><div><p className="text-sm font-medium">Contract notices</p><p className="text-xs text-muted-foreground">Approval-bound drafts and their immutable Gmail delivery attempts.</p></div>{contract.notices.map((notice) => {
            const isApproving = approvalNoticeId === notice.id;
            const isReconciling = reconcileNoticeId === notice.id;
            return <div key={notice.id} className="rounded-lg border p-3 text-sm" data-testid={`contract-notice-${notice.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{notice.subject}</p><p className="text-xs text-muted-foreground">{notice.noticeType.replaceAll("_", " ")} · {notice.recipientName} &lt;{notice.recipientEmail}&gt; · due {new Date(notice.dueAt).toLocaleString()}</p></div><Badge variant={notice.state === "delivered" ? "default" : ["failed", "uncertain"].includes(notice.state) ? "destructive" : "outline"}>{notice.state}</Badge></div>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/30 p-3">{notice.bodyText}</p>
              <p className="mt-2 text-xs text-muted-foreground">Content {notice.contentSha256.slice(0, 12)}…{notice.approvalSha256 ? ` · approval ${notice.approvalSha256.slice(0, 12)}…` : " · approval required"}</p>
              {notice.state === "sending" ? <Alert className="mt-3"><AlertTriangle className="h-4 w-4"/><AlertTitle>Delivery reconciliation required</AlertTitle><AlertDescription>A Gmail attempt was prepared but has no terminal receipt. Do not retry blindly; review provider state and the attempt record first.</AlertDescription></Alert> : null}
              {isReconciling ? <div className="mt-3 grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                <Label>Reviewed outcome<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={reconciliation.outcome} onChange={(event) => setReconciliation((value) => ({ ...value, outcome: event.target.value }))}><option value="uncertain">Still uncertain</option><option value="failed">Definitely failed</option><option value="delivered">Verified delivered</option></select></Label>
                <Label>Provider message reference<Input value={reconciliation.providerMessageReference} onChange={(event) => setReconciliation((value) => ({ ...value, providerMessageReference: event.target.value }))} placeholder={reconciliation.outcome === "delivered" ? "Required verified Gmail message id" : "Optional"}/></Label>
                <Label className="sm:col-span-2">Reconciliation evidence note<Textarea value={reconciliation.reconciliationNote} onChange={(event) => setReconciliation((value) => ({ ...value, reconciliationNote: event.target.value }))} placeholder="State how provider state was checked and why this outcome is justified."/></Label>
                <div className="flex gap-2 sm:col-span-2"><Button onClick={() => reconcileNotice.mutate({ contract, notice })} disabled={reconcileNotice.isPending || reconciliation.reconciliationNote.trim().length < 8 || (reconciliation.outcome === "delivered" && !reconciliation.providerMessageReference.trim())}>Record reviewed outcome</Button><Button variant="outline" onClick={() => setReconcileNoticeId("")}>Cancel</Button></div>
              </div> : null}
              {isApproving ? <div className="mt-3 grid gap-3 rounded-md border bg-muted/20 p-3">
                <div><p className="font-medium">Approve this exact content</p><p className="text-xs text-muted-foreground">The executed agreement alone is not sufficient. Select separate verified operational Evidence.</p></div>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border bg-background p-3">{decisionEvidence.length ? decisionEvidence.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2"><Checkbox checked={noticeApproval.evidenceIds.includes(item.id)} onCheckedChange={(checked) => setNoticeApproval((value) => ({ ...value, evidenceIds: checked ? [...value.evidenceIds, item.id] : value.evidenceIds.filter((id) => id !== item.id) }))}/><span>{item.title || item.evidenceType || "Verified Evidence"}</span></label>) : <p className="text-xs text-muted-foreground">No separate verified operational Evidence is visible.</p>}</div>
                <Label>Approval rationale<Textarea value={noticeApproval.approvalNote} onChange={(event) => setNoticeApproval((value) => ({ ...value, approvalNote: event.target.value }))} placeholder="Why is this exact notice appropriate and supported?"/></Label>
                <div className="flex gap-2"><Button onClick={() => approveNotice.mutate({ contract, notice })} disabled={approveNotice.isPending || noticeApproval.evidenceIds.length === 0 || noticeApproval.approvalNote.trim().length < 8}>Approve exact notice</Button><Button variant="outline" onClick={() => setApprovalNoticeId("")}>Cancel</Button></div>
              </div> : null}
              <div className="mt-3 flex flex-wrap gap-2">{canOperate && notice.state === "draft" ? <Button size="sm" variant="outline" onClick={() => { setApprovalNoticeId(notice.id); setNoticeApproval({ evidenceIds: [], approvalNote: "" }); }}><ShieldCheck className="mr-2 h-4 w-4"/>Review and approve</Button> : null}{canOperate && ["approved", "failed", "uncertain"].includes(notice.state) ? <Button size="sm" onClick={() => deliverNotice.mutate({ contract, notice })} disabled={deliverNotice.isPending}><Send className="mr-2 h-4 w-4"/>{notice.state === "approved" ? "Send via Gmail" : "Retry exact notice"}</Button> : null}{canOperate && notice.state === "sending" ? <Button size="sm" variant="outline" onClick={() => { setReconcileNoticeId(notice.id); setReconciliation({ outcome: "uncertain", providerMessageReference: "", reconciliationNote: "" }); }}><ShieldCheck className="mr-2 h-4 w-4"/>Reconcile attempt</Button> : null}{notice.state === "delivered" ? <Badge variant="secondary"><MailCheck className="mr-1 h-3 w-3"/>receipt {notice.providerMessageReference || "recorded"}</Badge> : null}</div>
              {notice.attempts.length ? <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">Delivery attempts ({notice.attempts.length})</summary><div className="mt-2 space-y-2">{notice.attempts.map((attempt) => <div key={attempt.id} className="rounded-md border p-2 text-xs"><span className="font-medium">Attempt {attempt.attemptNumber}: {attempt.state}</span> · {new Date(attempt.preparedAt).toLocaleString()}{attempt.providerMessageReference ? <p>Provider receipt: {attempt.providerMessageReference}</p> : null}{attempt.failureMessage ? <p className="text-destructive">{attempt.failureMessage}</p> : null}{attempt.reconciliationNote ? <p>Reconciled: {attempt.reconciliationNote}</p> : null}</div>)}</div></details> : null}
            </div>;
          })}</div> : null}
          <div className="flex flex-wrap gap-2">{canOperate ? <Button variant="outline" size="sm" onClick={() => openPlan(contract)}>{contract.plan ? "Update schedule" : "Create control plan"}</Button> : null}{canOperate && contract.plan ? <Button variant="outline" size="sm" onClick={() => { setEditingId(""); setNoticeContractId(""); setDecisionId(contract.envelope.id); setDecision({ intent: "renew", evidenceIds: [], decisionNote: "" }); }}>Decide renewal</Button> : null}{canOperate && contract.plan ? <Button variant="outline" size="sm" onClick={() => openNotice(contract)}><Send className="mr-2 h-4 w-4"/>Prepare notice</Button> : null}{canOperate && contract.plan && ["renew", "renegotiate"].includes(contract.plan.renewalIntent) && !contract.renewalDraft ? <Button size="sm" onClick={() => createRenewal.mutate(contract)} disabled={createRenewal.isPending}>Create renewal draft</Button> : null}{contract.renewalDraft ? <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>renewal {contract.renewalDraft.state}</Badge> : null}</div>
          {contract.events.length ? <details><summary className="cursor-pointer text-xs text-muted-foreground">Immutable lifecycle receipts ({contract.events.length})</summary><div className="mt-2 space-y-2">{contract.events.map((event) => <div key={event.id} className="rounded-md border p-3 text-xs"><div className="flex justify-between gap-2"><span className="font-medium">{event.eventType.replaceAll("_", " ")}</span><span>{new Date(event.recordedAt).toLocaleString()}</span></div>{event.note ? <p className="mt-1 text-sm">{event.note}</p> : null}<p className="mt-1 text-muted-foreground">{event.evidenceIds.length} Evidence · receipt {event.eventSha256.slice(0, 12)}…</p></div>)}</div></details> : null}
        </CardContent>
      </Card>;
    })}
  </div>;
}
