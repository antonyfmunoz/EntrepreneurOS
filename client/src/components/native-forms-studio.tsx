import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
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
  { id: "summary", label: "What should the owner know?", type: "long_text", required: true, options: [] },
];

function commandKey(prefix: string) {
  return prefix + ":" + (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}
function emptyAnswers(questions: Question[]) {
  return Object.fromEntries(questions.map((question) => [question.id, ""]));
}

export function NativeFormsStudio({ root, canExecute, canDecide }: { root: string; canExecute: boolean; canDecide: boolean }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("Your response was recorded in EOS.");
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [editing, setEditing] = useState<Json | null>(null);
  const [openForm, setOpenForm] = useState<Json | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const query = useQuery<Json>({
    queryKey: [root, "native-forms"],
    queryFn: async () => (await apiRequest("GET", root + "/instruments/forms")).json(),
  });
  const forms = useMemo(() => (query.data?.objects || []).filter((item: Json) =>
    item.objectType === "form" && item.data?.internalCapture === true && item.data?.publicCapture !== true,
  ), [query.data]);
  const submissions = useMemo(() => (query.data?.objects || []).filter((item: Json) =>
    item.objectType === "submission" && item.data?.submissionChannel === "internal_eos",
  ), [query.data]);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, "native-forms"] });

  useEffect(() => {
    if (!openForm) return;
    const current = forms.find((form: Json) => form.id === openForm.id);
    if (!current) { setOpenForm(null); return; }
    setOpenForm(current);
    setAnswers(emptyAnswers(current.data?.questions || []));
  }, [forms]);

  const clearEditor = () => {
    setEditing(null); setTitle(""); setSummary("");
    setConfirmationMessage("Your response was recorded in EOS."); setQuestions(starterQuestions);
  };
  const beginEdit = (form: Json) => {
    setEditing(form); setTitle(String(form.title || "")); setSummary(String(form.summary || ""));
    setConfirmationMessage(String(form.data?.confirmationMessage || "Your response was recorded in EOS."));
    setQuestions(Array.isArray(form.data?.questions) && form.data.questions.length ? form.data.questions : starterQuestions);
    setError(""); setNotice("");
  };
  const definition = () => ({
    internalCapture: true,
    questions,
    consentVersion: String(editing?.data?.consentVersion || "native-eos-internal-form-v1"),
    confirmationMessage: confirmationMessage.trim(),
  });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", root + "/instrument-objects", {
      instrumentKey: "forms", objectType: "form", objectKey: `internal-form:${safeKey(title)}:${Date.now()}`,
      title: title.trim(), summary: summary.trim(), classification: "confidential", visibility: "organization",
      data: definition(), sourceReference: { authority: "native_eos", capability: "internal_forms" },
      evidenceIds: [], idempotencyKey: commandKey("internal-form-create"),
    })).json(),
    onSuccess: async () => { clearEditor(); setNotice("Draft created. A role with decision authority can activate it when the questions are ready."); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Choose a native form to edit.");
      return (await apiRequest("PATCH", root + "/instrument-objects/" + editing.id, {
        expectedVersion: editing.version, title: title.trim(), summary: summary.trim(), data: { ...editing.data, ...definition() },
        idempotencyKey: commandKey("internal-form-save"),
      })).json();
    },
    onSuccess: async () => { clearEditor(); setNotice("Draft version saved."); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (form: Json) => (await apiRequest("POST", root + "/instrument-objects/" + form.id + "/transitions", {
      expectedVersion: form.version, state: "active",
      rationale: "Activate this private native EOS form so authorized company roles can submit governed internal responses.",
      evidenceIds: [], idempotencyKey: commandKey("internal-form-activate"),
    })).json(),
    onSuccess: async () => { setNotice("Native form activated for its authorized company scope."); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (!openForm) throw new Error("Choose an active native form.");
      return (await apiRequest("POST", `${root}/forms/${openForm.id}/submissions`, {
        answers, idempotencyKey: commandKey("internal-form-submit"),
      })).json();
    },
    onSuccess: async (result: Json) => {
      setNotice(String(result.confirmationMessage || "Your response was recorded in EOS."));
      setOpenForm(null); setAnswers({}); await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const addQuestion = () => setQuestions((current) => [...current, { id: `field_${current.length + 1}`, label: "New question", type: "short_text", required: false, options: [] }]);
  const updateQuestion = (index: number, patch: Partial<Question>) => setQuestions((current) => current.map((question, currentIndex) => currentIndex === index ? { ...question, ...patch } : question));
  const removeQuestion = (index: number) => setQuestions((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const editorValid = title.trim().length >= 2 && confirmationMessage.trim().length >= 2 && questions.length > 0 && questions.every((question) => question.id.length >= 2 && question.label.trim().length >= 2 && (question.type !== "select" || question.options.length > 0)) && new Set(questions.map((question) => question.id)).size === questions.length;

  return <Card id="native-forms" data-testid="native-forms-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Native Forms Studio</CardTitle><CardDescription className="mt-1">Build private operational forms for the company. Responses stay inside EOS under the form owner’s governed scope—no public form service or external workflow tool is required.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Native form command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>EOS recorded the change</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
      <section className="rounded-xl border p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">{editing ? "Edit internal form draft" : "Create an internal form"}</h3><p className="mt-1 text-sm text-muted-foreground">Use this for employee check-ins, client handoffs, project intake, review packets, and any structured company workflow.</p></div>{editing && <Button size="sm" variant="ghost" onClick={clearEditor}>Cancel edit</Button>}</div>
        <div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-form-title">Form name</Label><Input id="native-form-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project intake" /></div><div><Label htmlFor="native-form-purpose">Purpose</Label><Input id="native-form-purpose" className="mt-1" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Collect a governed project request" /></div></div>
          <div><Label>Questions</Label><div className="mt-2 space-y-2">{questions.map((question, index) => <div key={`${question.id}-${index}`} className="grid gap-2 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[150px_minmax(0,1fr)_140px_80px_auto]"><Input value={question.id} onChange={(event) => updateQuestion(index, { id: safeKey(event.target.value).replaceAll("-", "_") })} aria-label={`Question ${index + 1} field key`} /><Input value={question.label} onChange={(event) => updateQuestion(index, { label: event.target.value })} aria-label={`Question ${index + 1} label`} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as FieldType })}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="email">Email</option><option value="phone">Phone</option><option value="select">Select</option></select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Required</label><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${question.label}`} disabled={questions.length <= 1} onClick={() => removeQuestion(index)}><Trash2 className="h-4 w-4" /></Button>{question.type === "select" && <Input className="lg:col-span-5" value={question.options.join(", ")} onChange={(event) => updateQuestion(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Options, separated by commas" />}</div>)}</div><Button type="button" size="sm" variant="outline" className="mt-2" onClick={addQuestion}><Plus className="mr-2 h-4 w-4" />Add question</Button></div>
          <div><Label htmlFor="native-form-confirmation">Confirmation message</Label><Textarea id="native-form-confirmation" className="mt-1" value={confirmationMessage} onChange={(event) => setConfirmationMessage(event.target.value)} /></div>
          <Button disabled={!canExecute || !editorValid || create.isPending || save.isPending} onClick={() => editing ? save.mutate() : create.mutate()}><Plus className="mr-2 h-4 w-4" />{editing ? (save.isPending ? "Saving draft…" : "Save draft version") : (create.isPending ? "Creating form…" : "Create native form")}</Button>
        </div>
      </section>
      <section className="space-y-3"><div><p className="eos-label">Private operating forms</p><h3 className="mt-1 font-semibold">Company-native intake and review points</h3></div>
        {forms.map((form: Json) => { const formQuestions = Array.isArray(form.data?.questions) ? form.data.questions as Question[] : []; const count = submissions.filter((submission: Json) => submission.data?.formObjectId === form.id).length; return <div key={form.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{form.title}</span><Badge variant={form.state === "active" ? "default" : "outline"}>{form.state}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{form.summary || "No purpose recorded."} · {formQuestions.length} questions · {count} visible response{count === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-2">{canExecute && form.state === "draft" && <Button size="sm" variant="outline" onClick={() => beginEdit(form)}>Edit</Button>}{form.state === "draft" && <Button size="sm" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(form)}>{activate.isPending ? "Activating…" : "Activate"}</Button>}{form.state === "active" && <Button size="sm" disabled={!canExecute} onClick={() => { setOpenForm(form); setAnswers(emptyAnswers(formQuestions)); setError(""); setNotice(""); }}><Send className="mr-2 h-4 w-4" />Open form</Button>}</div></div></div>; })}
        {!forms.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No private native forms yet. Create one above; it remains a draft until a role with decision authority activates it.</p>}
      </section>
      {openForm && <section className="rounded-xl border bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{openForm.title}</h3><p className="mt-1 text-sm text-muted-foreground">{openForm.summary || "Complete this governed EOS form."}</p></div><Button size="sm" variant="ghost" onClick={() => setOpenForm(null)}>Close</Button></div><div className="mt-4 space-y-3">{(openForm.data?.questions || []).map((question: Question) => <div key={question.id}><Label htmlFor={`native-answer-${question.id}`}>{question.label}{question.required ? " *" : ""}</Label>{question.type === "long_text" ? <Textarea id={`native-answer-${question.id}`} className="mt-1" value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /> : question.type === "select" ? <select id={`native-answer-${question.id}`} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}><option value="">Choose one</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <Input id={`native-answer-${question.id}`} className="mt-1" type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : "text"} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />}</div>)}<Button disabled={!canExecute || submit.isPending} onClick={() => submit.mutate()}><Send className="mr-2 h-4 w-4" />{submit.isPending ? "Recording response…" : "Submit to EOS"}</Button></div></section>}
      <Alert><AlertTitle>Native first, authority-bound</AlertTitle><AlertDescription>Internal forms are EOS records, not provider placeholders. Activating a form is a governed decision; submitting it validates only its active definition, preserves the owner’s review scope, and creates an immutable command, event, and audit receipt without placing answer content in those receipts.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
