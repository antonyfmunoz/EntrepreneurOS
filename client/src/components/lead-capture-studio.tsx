import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, FileInput, Plus, RefreshCw, Trash2, UserRoundPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type FieldType = "short_text" | "long_text" | "email" | "phone" | "select";
type Question = { id: string; label: string; type: FieldType; required: boolean; options: string[] };
const starterQuestions: Question[] = [
  { id: "name", label: "Full name", type: "short_text", required: true, options: [] },
  { id: "email", label: "Work email", type: "email", required: true, options: [] },
  { id: "company", label: "Company", type: "short_text", required: false, options: [] },
  { id: "goals", label: "What are you looking to accomplish?", type: "long_text", required: false, options: [] },
];

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  return prefix + ":" + suffix;
}
function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}
function formUrl(formId: string) { return window.location.origin + "/capture/" + formId; }

export function LeadCaptureStudio({ root, canExecute, canDecide }: { root: string; canExecute: boolean; canDecide: boolean }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [consentLabel, setConsentLabel] = useState("I agree that this organization may use my information to respond to my request.");
  const [confirmationMessage, setConfirmationMessage] = useState("Thank you. Your request has been received.");
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [commercialPipelineObjectId, setCommercialPipelineObjectId] = useState("");
  const [commercialInitialStage, setCommercialInitialStage] = useState("");
  const [editingForm, setEditingForm] = useState<Json | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") !== "native-lead-capture") return;
    document.getElementById("native-lead-capture")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const query = useQuery<Json>({
    queryKey: [root, "native-lead-capture"],
    queryFn: async () => (await apiRequest("GET", root + "/instruments/forms")).json(),
  });
  const forms = useMemo(() => (query.data?.objects || []).filter((item: Json) => item.objectType === "form" && item.data?.publicCapture === true), [query.data]);
  const crmQuery = useQuery<Json>({
    queryKey: [root, "native-lead-capture-crm"], retry: false,
    queryFn: async () => (await apiRequest("GET", root + "/instruments/crm")).json(),
  });
  const pipelines = useMemo(() => (crmQuery.data?.objects || []).filter((item: Json) => item.objectType === "pipeline" && item.state === "active"), [crmQuery.data]);
  const selectedPipeline = pipelines.find((pipeline: Json) => pipeline.id === commercialPipelineObjectId) || null;
  const pipelineStages = useMemo(() => Array.isArray(selectedPipeline?.data?.stages) ? selectedPipeline.data.stages.filter((stage: unknown): stage is string => typeof stage === "string" && stage.trim().length > 0) : [], [selectedPipeline]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const objectId = params.get("nativeObjectId");
    if (params.get("focus") !== "native-lead-capture" || !objectId) return;
    const form = forms.find((item: Json) => item.id === objectId);
    if (form && editingForm?.id !== form.id) beginEdit(form);
  }, [forms, editingForm?.id]);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, "native-lead-capture"] });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", root + "/instrument-objects", {
      instrumentKey: "forms", objectType: "form", objectKey: "lead-form:" + safeKey(title) + ":" + Date.now(),
      title: title.trim(), summary: summary.trim(), classification: "confidential", visibility: "organization",
      data: { publicCapture: true, questions, consentVersion: "native-eos-lead-capture-v1", consentLabel: consentLabel.trim(), confirmationMessage: confirmationMessage.trim(), ...(commercialPipelineObjectId ? { commercialPipelineObjectId, commercialInitialStage } : {}) },
      sourceReference: { authority: "native_eos", capability: "website_funnel_lead_capture" },
      evidenceIds: [], idempotencyKey: commandKey("lead-form-create"),
    })).json(),
    onSuccess: async () => { setTitle(""); setSummary(""); setQuestions(starterQuestions); setCommercialPipelineObjectId(""); setCommercialInitialStage(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!editingForm) throw new Error("Choose a native form to edit.");
      return (await apiRequest("PATCH", root + "/instrument-objects/" + editingForm.id, {
        expectedVersion: editingForm.version,
        title: title.trim(), summary: summary.trim(),
        data: { ...editingForm.data, publicCapture: true, questions, consentVersion: String(editingForm.data?.consentVersion || "native-eos-lead-capture-v1"), consentLabel: consentLabel.trim(), confirmationMessage: confirmationMessage.trim(), commercialPipelineObjectId: commercialPipelineObjectId || undefined, commercialInitialStage: commercialPipelineObjectId ? commercialInitialStage : undefined },
        idempotencyKey: commandKey("lead-form-save"),
      })).json();
    },
    onSuccess: async () => { setEditingForm(null); setTitle(""); setSummary(""); setConsentLabel("I agree that my information may be used to respond to this request."); setConfirmationMessage("Thank you. Your request has been received."); setQuestions(starterQuestions); setCommercialPipelineObjectId(""); setCommercialInitialStage(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (form: Json) => (await apiRequest("POST", root + "/instrument-objects/" + form.id + "/transitions", {
      expectedVersion: form.version, state: "active",
      rationale: "Publish this native EOS lead-capture form so it can receive consented public submissions into the company CRM.",
      evidenceIds: [], idempotencyKey: commandKey("lead-form-publish"),
    })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const addQuestion = () => setQuestions((current) => [...current, { id: "field_" + (current.length + 1), label: "New question", type: "short_text", required: false, options: [] }]);
  const updateQuestion = (index: number, patch: Partial<Question>) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));
  const removeQuestion = (index: number) => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index));
  const beginEdit = (form: Json) => {
    setEditingForm(form);
    setTitle(String(form.title || ""));
    setSummary(String(form.summary || ""));
    setConsentLabel(String(form.data?.consentLabel || "I agree that my information may be used to respond to this request."));
    setConfirmationMessage(String(form.data?.confirmationMessage || "Thank you. Your request has been received."));
    setQuestions(Array.isArray(form.data?.questions) && form.data.questions.length ? form.data.questions : starterQuestions);
    setCommercialPipelineObjectId(String(form.data?.commercialPipelineObjectId || ""));
    setCommercialInitialStage(String(form.data?.commercialInitialStage || ""));
    setError("");
  };
  const cancelEdit = () => { setEditingForm(null); setTitle(""); setSummary(""); setConsentLabel("I agree that my information may be used to respond to this request."); setConfirmationMessage("Thank you. Your request has been received."); setQuestions(starterQuestions); setCommercialPipelineObjectId(""); setCommercialInitialStage(""); };
  const routingValid = !commercialPipelineObjectId || (Boolean(selectedPipeline) && pipelineStages.includes(commercialInitialStage));
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied((current) => current === url ? "" : current), 1800);
    } catch { setError("Copy was unavailable in this browser. Select the link and copy it manually."); }
  };

  return <Card id="native-lead-capture" data-testid="native-lead-capture-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><FileInput className="h-5 w-5 text-primary" />Lead Capture Studio</CardTitle><CardDescription className="mt-1">Build and publish native EOS lead forms. They collect consented submissions directly into EOS Forms and CRM—no external form builder or CRM is required.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={"mr-2 h-4 w-4 " + (query.isFetching ? "animate-spin" : "")} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Lead-capture command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="rounded-xl border p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><UserRoundPlus className="h-4 w-4 text-primary" /><h3 className="font-semibold">{editingForm ? "Edit native intake point" : "Create a native intake point"}</h3></div>{editingForm && <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel edit</Button>}</div><p className="mt-1 text-sm text-muted-foreground">This is the first building block of an EOS-owned website or funnel. Activate it only when the wording and consent request are ready for public use.</p>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="lead-form-title">Form name</Label><Input id="lead-form-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Revenue recovery discovery" /></div><div><Label htmlFor="lead-form-summary">Purpose</Label><Input id="lead-form-summary" className="mt-1" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Qualify inbound recovery opportunities" /></div></div>
          <div><Label>Questions</Label><div className="mt-2 space-y-2">{questions.map((question, index) => <div key={question.id + "-" + index} className="grid gap-2 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[150px_minmax(0,1fr)_140px_80px_auto]"><Input value={question.id} onChange={(event) => updateQuestion(index, { id: safeKey(event.target.value).replaceAll("-", "_") })} aria-label={"Question " + (index + 1) + " field key"} /><Input value={question.label} onChange={(event) => updateQuestion(index, { label: event.target.value })} aria-label={"Question " + (index + 1) + " label"} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as FieldType })}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="email">Email</option><option value="phone">Phone</option><option value="select">Select</option></select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Required</label><Button type="button" variant="ghost" size="icon" aria-label={"Remove " + question.label} disabled={questions.length <= 1} onClick={() => removeQuestion(index)}><Trash2 className="h-4 w-4" /></Button>{question.type === "select" && <Input className="lg:col-span-5" value={question.options.join(", ")} onChange={(event) => updateQuestion(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Options, separated by commas" />}</div>)}</div><Button type="button" size="sm" variant="outline" className="mt-2" onClick={addQuestion}><Plus className="mr-2 h-4 w-4" />Add question</Button></div>
          <div className="rounded-lg border bg-muted/20 p-3"><Label htmlFor="lead-form-pipeline">Commercial destination (optional)</Label><p className="mt-1 text-xs text-muted-foreground">When selected, each consented submission is linked to the relationship’s live native opportunity in this pipeline—or creates one at the chosen stage. Leave it off to keep intake and agent handoff separate.</p><div className="mt-3 grid gap-2 md:grid-cols-2"><select id="lead-form-pipeline" className="h-10 rounded-md border bg-background px-3 text-sm" value={commercialPipelineObjectId} onChange={(event) => { const pipeline = pipelines.find((item: Json) => item.id === event.target.value); const stages = Array.isArray(pipeline?.data?.stages) ? pipeline.data.stages.filter((stage: unknown): stage is string => typeof stage === "string") : []; setCommercialPipelineObjectId(event.target.value); setCommercialInitialStage(stages[0] || ""); }} disabled={crmQuery.isFetching}><option value="">No automatic opportunity</option>{pipelines.map((pipeline: Json) => <option key={pipeline.id} value={pipeline.id}>{pipeline.title}</option>)}</select><select id="lead-form-pipeline-stage" className="h-10 rounded-md border bg-background px-3 text-sm" value={commercialInitialStage} onChange={(event) => setCommercialInitialStage(event.target.value)} disabled={!commercialPipelineObjectId || !pipelineStages.length}><option value="">Choose first stage</option>{pipelineStages.map((stage: string) => <option key={stage} value={stage}>{stage}</option>)}</select></div>{commercialPipelineObjectId && !routingValid && <p className="mt-2 text-xs text-destructive">Choose an active native pipeline and one of its current stages.</p>}</div>
          <div><Label htmlFor="lead-form-consent">Consent text</Label><Textarea id="lead-form-consent" className="mt-1" value={consentLabel} onChange={(event) => setConsentLabel(event.target.value)} /></div><div><Label htmlFor="lead-form-confirmation">Confirmation message</Label><Textarea id="lead-form-confirmation" className="mt-1" value={confirmationMessage} onChange={(event) => setConfirmationMessage(event.target.value)} /></div>
          <Button disabled={!canExecute || title.trim().length < 2 || questions.some((question) => question.id.length < 2 || question.label.trim().length < 2) || consentLabel.trim().length < 2 || confirmationMessage.trim().length < 2 || !routingValid || create.isPending || save.isPending} onClick={() => editingForm ? save.mutate() : create.mutate()}><Plus className="mr-2 h-4 w-4" />{editingForm ? (save.isPending ? "Saving form…" : "Save new version") : (create.isPending ? "Creating form…" : "Create native form")}</Button>
        </div>
      </section>
      <section className="space-y-3"><div><p className="eos-label">Published and draft capture points</p><h3 className="mt-1 font-semibold">Your EOS-owned funnel entry points</h3></div>
        {forms.map((form: Json) => { const url = formUrl(form.id); return <div key={form.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-medium">{form.title}</span><Badge variant={form.state === "active" ? "default" : "outline"}>{form.state}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{form.summary || "No purpose recorded."} · {Array.isArray(form.data?.questions) ? form.data.questions.length : 0} questions</p></div><div className="flex flex-wrap gap-2">{canExecute && <Button size="sm" variant="outline" onClick={() => beginEdit(form)}>Edit</Button>}{form.state === "draft" && <Button size="sm" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(form)}>{activate.isPending ? "Publishing…" : "Publish native form"}</Button>}</div></div>{form.state === "active" && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input readOnly value={url} aria-label={form.title + " public form link"} /><Button variant="outline" size="sm" onClick={() => copy(url)}><Copy className="mr-2 h-4 w-4" />{copied === url ? "Copied" : "Copy link"}</Button><Button variant="outline" size="sm" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></Button></div>}</div>; })}
        {!forms.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No native public lead forms yet. Create one above; it remains a draft until a role with decision authority publishes it.</p>}
      </section>
      <Alert><AlertTitle>Native first, overlay ready</AlertTitle><AlertDescription>Every accepted submission creates a Forms submission plus native CRM person and lead-relationship records. A configured native pipeline can receive or create the linked opportunity without requiring an external CRM. Future connected CRM imports can reconcile into the same governed objects; this surface never claims an external provider received or owned the lead.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
