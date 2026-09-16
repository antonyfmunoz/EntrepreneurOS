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
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, "native-lead-capture"] });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", root + "/instrument-objects", {
      instrumentKey: "forms", objectType: "form", objectKey: "lead-form:" + safeKey(title) + ":" + Date.now(),
      title: title.trim(), summary: summary.trim(), classification: "confidential", visibility: "organization",
      data: { publicCapture: true, questions, consentVersion: "native-eos-lead-capture-v1", consentLabel: consentLabel.trim(), confirmationMessage: confirmationMessage.trim() },
      sourceReference: { authority: "native_eos", capability: "website_funnel_lead_capture" },
      evidenceIds: [], idempotencyKey: commandKey("lead-form-create"),
    })).json(),
    onSuccess: async () => { setTitle(""); setSummary(""); setQuestions(starterQuestions); await refresh(); },
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
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><UserRoundPlus className="h-4 w-4 text-primary" /><h3 className="font-semibold">Create a native intake point</h3></div><p className="mt-1 text-sm text-muted-foreground">This is the first building block of an EOS-owned website or funnel. Activate it only when the wording and consent request are ready for public use.</p>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="lead-form-title">Form name</Label><Input id="lead-form-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Revenue recovery discovery" /></div><div><Label htmlFor="lead-form-summary">Purpose</Label><Input id="lead-form-summary" className="mt-1" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Qualify inbound recovery opportunities" /></div></div>
          <div><Label>Questions</Label><div className="mt-2 space-y-2">{questions.map((question, index) => <div key={question.id + "-" + index} className="grid gap-2 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[150px_minmax(0,1fr)_140px_80px_auto]"><Input value={question.id} onChange={(event) => updateQuestion(index, { id: safeKey(event.target.value).replaceAll("-", "_") })} aria-label={"Question " + (index + 1) + " field key"} /><Input value={question.label} onChange={(event) => updateQuestion(index, { label: event.target.value })} aria-label={"Question " + (index + 1) + " label"} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as FieldType })}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="email">Email</option><option value="phone">Phone</option><option value="select">Select</option></select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Required</label><Button type="button" variant="ghost" size="icon" aria-label={"Remove " + question.label} disabled={questions.length <= 1} onClick={() => removeQuestion(index)}><Trash2 className="h-4 w-4" /></Button>{question.type === "select" && <Input className="lg:col-span-5" value={question.options.join(", ")} onChange={(event) => updateQuestion(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Options, separated by commas" />}</div>)}</div><Button type="button" size="sm" variant="outline" className="mt-2" onClick={addQuestion}><Plus className="mr-2 h-4 w-4" />Add question</Button></div>
          <div><Label htmlFor="lead-form-consent">Consent text</Label><Textarea id="lead-form-consent" className="mt-1" value={consentLabel} onChange={(event) => setConsentLabel(event.target.value)} /></div><div><Label htmlFor="lead-form-confirmation">Confirmation message</Label><Textarea id="lead-form-confirmation" className="mt-1" value={confirmationMessage} onChange={(event) => setConfirmationMessage(event.target.value)} /></div>
          <Button disabled={!canExecute || title.trim().length < 2 || questions.some((question) => question.id.length < 2 || question.label.trim().length < 2) || consentLabel.trim().length < 2 || confirmationMessage.trim().length < 2 || create.isPending} onClick={() => create.mutate()}><Plus className="mr-2 h-4 w-4" />{create.isPending ? "Creating form…" : "Create native form"}</Button>
        </div>
      </section>
      <section className="space-y-3"><div><p className="eos-label">Published and draft capture points</p><h3 className="mt-1 font-semibold">Your EOS-owned funnel entry points</h3></div>
        {forms.map((form: Json) => { const url = formUrl(form.id); return <div key={form.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-medium">{form.title}</span><Badge variant={form.state === "active" ? "default" : "outline"}>{form.state}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{form.summary || "No purpose recorded."} · {Array.isArray(form.data?.questions) ? form.data.questions.length : 0} questions</p></div>{form.state === "draft" && <Button size="sm" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(form)}>{activate.isPending ? "Publishing…" : "Publish native form"}</Button>}</div>{form.state === "active" && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input readOnly value={url} aria-label={form.title + " public form link"} /><Button variant="outline" size="sm" onClick={() => copy(url)}><Copy className="mr-2 h-4 w-4" />{copied === url ? "Copied" : "Copy link"}</Button><Button variant="outline" size="sm" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></Button></div>}</div>; })}
        {!forms.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No native public lead forms yet. Create one above; it remains a draft until a role with decision authority publishes it.</p>}
      </section>
      <Alert><AlertTitle>Native first, overlay ready</AlertTitle><AlertDescription>Every accepted submission creates a Forms submission plus native CRM person and lead-relationship records. Future connected CRM imports can reconcile into the same governed objects; this surface never claims an external provider received or owned the lead.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
