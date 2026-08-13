import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { ProductionGovernanceControls } from "@/components/production-governance-controls";

type ReadinessRequirement = {
  key: string;
  allowedScopes: Array<"repository" | "staging" | "production" | "professional">;
  maximumAgeDays: number;
  subjectKind: "release" | "environment" | "evidence";
  satisfied: boolean;
};

type ReadinessLayer = {
  layer: number;
  name: string;
  status: "pass" | "fail";
  evidence: string[];
  missing: string[];
  requirements: ReadinessRequirement[];
};

type ProductionReadiness = {
  standard: string;
  generatedAt: string;
  releaseSubject: string | null;
  environmentSubject: string | null;
  ready: boolean;
  layers: ReadinessLayer[];
  configurationMissing: string[];
  requiredVendors: string[];
  missingVendors: string[];
};

type EvidenceHistoryItem = {
  id: string;
  status: string;
  evidenceUri: string;
  evidenceHash: string;
  evidenceScope: string;
  subject: string;
  notes: string | null;
  reviewedAt: string;
  expiresAt: string;
  recordedAt: string;
};

type EvidenceForm = {
  evidenceUri: string;
  evidenceHash: string;
  evidenceScope: ReadinessRequirement["allowedScopes"][number] | "";
  subject: string;
  notes: string;
  reviewedAt: string;
  expiresAt: string;
};

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function localDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function mutationMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The control could not be updated.";
  const jsonStart = error.message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(error.message.slice(jsonStart)) as { message?: string };
      if (body.message) return body.message;
    } catch {}
  }
  return error.message;
}

export function ProductionReadinessControls() {
  const readiness = useQuery<ProductionReadiness>({
    queryKey: ["/api/platform/readiness"],
    queryFn: async () => (await apiRequest<Response>("GET", "/api/platform/readiness")).json(),
  });
  const [selectedControlKey, setSelectedControlKey] = useState("");
  const [recordedControl, setRecordedControl] = useState("");
  const [form, setForm] = useState<EvidenceForm>({ evidenceUri: "", evidenceHash: "", evidenceScope: "", subject: "", notes: "", reviewedAt: "", expiresAt: "" });

  const allRequirements = useMemo(() => readiness.data?.layers.flatMap((layer) => layer.requirements) ?? [], [readiness.data]);
  const missingRequirements = useMemo(() => allRequirements.filter((requirement) => !requirement.satisfied), [allRequirements]);
  const selectedRequirement = allRequirements.find((requirement) => requirement.key === selectedControlKey) ?? null;
  const passingLayers = readiness.data?.layers.filter((layer) => layer.status === "pass").length ?? 0;
  const evidenceHistory = useQuery<EvidenceHistoryItem[]>({
    queryKey: ["/api/platform/controls", selectedControlKey, "evidence"],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/platform/controls/${selectedControlKey}/evidence`)).json(),
    enabled: Boolean(selectedControlKey),
  });

  useEffect(() => {
    if (!selectedControlKey) setSelectedControlKey((missingRequirements[0] || allRequirements[0])?.key || "");
  }, [allRequirements, missingRequirements, selectedControlKey]);

  useEffect(() => {
    if (!selectedRequirement) return;
    const reviewedAt = new Date();
    const expiresAt = new Date(reviewedAt.getTime() + Math.max(1, selectedRequirement.maximumAgeDays - 1) * 86_400_000);
    const subject = selectedRequirement.subjectKind === "release"
      ? readiness.data?.releaseSubject || ""
      : selectedRequirement.subjectKind === "environment"
        ? readiness.data?.environmentSubject || ""
        : "";
    setForm({ evidenceUri: "", evidenceHash: "", evidenceScope: selectedRequirement.allowedScopes[0] || "", subject, notes: "", reviewedAt: localDateTime(reviewedAt), expiresAt: localDateTime(expiresAt) });
    setRecordedControl("");
  }, [readiness.data?.environmentSubject, readiness.data?.releaseSubject, selectedRequirement?.key]);

  const recordEvidence = useMutation({
    mutationFn: async () => {
      if (!selectedRequirement) throw new Error("Choose a readiness requirement first.");
      return (await apiRequest<Response>("PUT", `/api/platform/controls/${selectedRequirement.key}`, {
        status: "pass",
        evidenceUri: form.evidenceUri.trim(),
        evidenceHash: form.evidenceHash.trim().toLowerCase(),
        evidenceScope: form.evidenceScope,
        subject: form.subject.trim(),
        notes: form.notes.trim() || undefined,
        reviewedAt: new Date(form.reviewedAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
      })).json();
    },
    onSuccess: async () => {
      setRecordedControl(selectedRequirement?.key || "control");
      await Promise.all([readiness.refetch(), evidenceHistory.refetch()]);
    },
  });

  const alertTest = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", "/api/platform/alerts/test", {})).json() as Promise<{ delivered: boolean; result: string }>,
  });

  if (readiness.isLoading) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;
  if (readiness.isError || !readiness.data) {
    return <Card className="rounded-[1.5rem] border-destructive/20 p-6"><h2 className="font-semibold">Production readiness could not load</h2><p className="mt-2 text-sm text-muted-foreground">Your platform-admin access may have changed, or the readiness service is unavailable.</p><Button className="mt-4" variant="outline" onClick={() => readiness.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></Card>;
  }

  const canSubmit = Boolean(selectedRequirement && form.evidenceUri.trim() && /^[a-fA-F0-9]{64}$/.test(form.evidenceHash.trim()) && form.evidenceScope && form.subject.trim() && form.reviewedAt && form.expiresAt);

  return (
    <div className="space-y-6">
      <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div><h2 className="text-xl font-semibold">Production readiness</h2><p className="mt-1 text-sm text-muted-foreground">The enforceable 24-layer release decision for this exact environment and release.</p></div>
          </div>
          <Button variant="outline" onClick={() => readiness.refetch()} disabled={readiness.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${readiness.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Decision</p><p className={`mt-2 text-lg font-semibold ${readiness.data.ready ? "text-emerald-700" : "text-amber-800"}`}>{readiness.data.ready ? "Ready to release" : "Release blocked"}</p></div>
          <div className="rounded-2xl bg-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Passing layers</p><p className="mt-2 text-lg font-semibold">{passingLayers} of 24</p></div>
          <div className="rounded-2xl bg-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Required vendors</p><p className="mt-2 text-lg font-semibold">{readiness.data.requiredVendors.length - readiness.data.missingVendors.length} of {readiness.data.requiredVendors.length}</p></div>
        </div>
        {(readiness.data.configurationMissing.length > 0 || readiness.data.missingVendors.length > 0) && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Non-evidence blockers</p>{readiness.data.configurationMissing.length > 0 && <p className="mt-2">Configuration: {readiness.data.configurationMissing.map(titleCase).join(", ")}</p>}{readiness.data.missingVendors.length > 0 && <p className="mt-1">Vendor records: {readiness.data.missingVendors.join(", ")}</p>}</div>}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {readiness.data.layers.map((layer) => <Card key={layer.layer} className="rounded-2xl border-white/70 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Layer {layer.layer}</p><h3 className="mt-1 font-semibold">{layer.name}</h3></div><Badge variant={layer.status === "pass" ? "secondary" : "outline"} className={layer.status === "pass" ? "bg-emerald-100 text-emerald-800" : "border-amber-300 text-amber-900"}>{layer.status === "pass" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <CircleAlert className="mr-1 h-3.5 w-3.5" />}{layer.status}</Badge></div>{layer.missing.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{layer.missing.map((item) => <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-950">{titleCase(item)}</span>)}</div> : <p className="mt-4 text-sm text-emerald-700">All required evidence is current.</p>}</Card>)}
      </div>

      <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">Record control evidence</h2>
        <p className="mt-2 text-sm text-muted-foreground">Record one reviewed artifact against its exact subject and expiry. This cannot replace vendor, ownership, configuration, or live-provider evidence.</p>
        {!missingRequirements.length && <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Every registered control requirement is current. You can still renew evidence before it expires.</p>}
        <div className="mt-6 space-y-5">
          <div className="space-y-2"><Label htmlFor="readiness-control">Control requirement</Label><Select value={selectedControlKey} onValueChange={setSelectedControlKey}><SelectTrigger id="readiness-control" aria-label="Readiness control requirement"><SelectValue placeholder="Choose a control" /></SelectTrigger><SelectContent>{allRequirements.map((requirement) => <SelectItem key={requirement.key} value={requirement.key}>{titleCase(requirement.key)}{requirement.satisfied ? " · current" : " · missing"}</SelectItem>)}</SelectContent></Select>{selectedRequirement && <p className="text-xs text-muted-foreground">Allowed scope: {selectedRequirement.allowedScopes.map(titleCase).join(" or ")} · maximum age: {selectedRequirement.maximumAgeDays} days · subject: {selectedRequirement.subjectKind}</p>}</div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="evidence-scope">Evidence scope</Label><Select value={form.evidenceScope} onValueChange={(evidenceScope) => setForm((current) => ({ ...current, evidenceScope: evidenceScope as EvidenceForm["evidenceScope"] }))}><SelectTrigger id="evidence-scope"><SelectValue /></SelectTrigger><SelectContent>{selectedRequirement?.allowedScopes.map((scope) => <SelectItem key={scope} value={scope}>{titleCase(scope)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="evidence-subject">Evidence subject</Label><Input id="evidence-subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} readOnly={selectedRequirement?.subjectKind !== "evidence" && Boolean(form.subject)} placeholder={selectedRequirement?.subjectKind === "release" ? "Configure EOS_RELEASE_SUBJECT" : selectedRequirement?.subjectKind === "environment" ? "Configure EOS_PRODUCTION_ENVIRONMENT_SUBJECT" : "Named reviewed artifact"} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="evidence-uri">Secret-free HTTPS evidence URL</Label><Input id="evidence-uri" type="url" value={form.evidenceUri} onChange={(event) => setForm((current) => ({ ...current, evidenceUri: event.target.value }))} placeholder="https://evidence.example.com/reviews/report" /></div>
          <div className="space-y-2"><Label htmlFor="evidence-hash">SHA-256 evidence hash</Label><Input id="evidence-hash" value={form.evidenceHash} onChange={(event) => setForm((current) => ({ ...current, evidenceHash: event.target.value }))} maxLength={64} spellCheck={false} placeholder="64 lowercase hexadecimal characters" /></div>
          <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="reviewed-at">Reviewed at</Label><Input id="reviewed-at" type="datetime-local" value={form.reviewedAt} onChange={(event) => setForm((current) => ({ ...current, reviewedAt: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="expires-at">Expires at</Label><Input id="expires-at" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></div></div>
          <div className="space-y-2"><Label htmlFor="evidence-notes">Review notes</Label><Textarea id="evidence-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={2000} placeholder="Who reviewed this evidence, what it proves, and any bounded exception." /></div>
          <Button onClick={() => recordEvidence.mutate()} disabled={!canSubmit || recordEvidence.isPending}>{recordEvidence.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Record reviewed evidence</Button>
          {recordEvidence.isSuccess && recordedControl && <p className="text-sm text-emerald-700">Evidence recorded for {titleCase(recordedControl)}. The 24-layer decision has been recalculated.</p>}
          {recordEvidence.isError && <p role="alert" className="text-sm text-destructive">{mutationMessage(recordEvidence.error)}</p>}
        </div>
        <div className="mt-8 border-t pt-6"><h3 className="font-semibold">Recent evidence history</h3><p className="mt-1 text-sm text-muted-foreground">Append-only receipts for the selected control.</p>{evidenceHistory.isLoading ? <div className="mt-4 h-20 animate-pulse rounded-2xl bg-muted" /> : evidenceHistory.data?.length ? <div className="mt-4 space-y-3">{evidenceHistory.data.slice(0, 5).map((item) => <div key={item.id} className="rounded-2xl bg-muted p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{titleCase(item.evidenceScope)} · {titleCase(item.status)}</span><span className="text-xs text-muted-foreground">Reviewed {new Date(item.reviewedAt).toLocaleString()}</span></div><p className="mt-2 break-all text-xs text-muted-foreground">Subject: {item.subject} · SHA-256 {item.evidenceHash.slice(0, 12)}…</p><a href={item.evidenceUri} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">Open evidence artifact</a>{item.notes && <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>}</div>)}</div> : <p className="mt-4 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No evidence has been recorded for this control.</p>}</div>
      </Card>

      <ProductionGovernanceControls requiredVendors={readiness.data.requiredVendors} missingVendors={readiness.data.missingVendors} onChanged={() => readiness.refetch()} />

      <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Operational alert route</h2><p className="mt-1 text-sm text-muted-foreground">Send a signed, deduplicated test event through the configured on-call receiver.</p></div><Button variant="outline" onClick={() => alertTest.mutate()} disabled={alertTest.isPending}>{alertTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send test alert</Button></div>{alertTest.isSuccess && <p className={`mt-4 text-sm ${alertTest.data.delivered ? "text-emerald-700" : "text-amber-800"}`}>Alert result: {titleCase(alertTest.data.result)}.</p>}{alertTest.isError && <p role="alert" className="mt-4 text-sm text-destructive">{mutationMessage(alertTest.error)}</p>}</Card>
    </div>
  );
}
