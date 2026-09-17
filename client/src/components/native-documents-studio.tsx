import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2, FileText, History, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type StudioMode = "documents" | "templates";

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function stateVariant(state: string) {
  return ["active", "completed"].includes(state) ? "default" as const : "outline" as const;
}

function formatRecordedAt(value?: string) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function parseVariables(value: string) {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Template variables must be a JSON object.");
  return parsed as Record<string, string>;
}

function resolveTemplate(body: string, variables: Record<string, unknown>) {
  return body.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (token, key) => {
    const value = variables[key];
    return value === undefined || value === null || value === "" ? token : String(value);
  });
}

export function NativeDocumentsStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [mode, setMode] = useState<StudioMode>("documents");
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState("markdown");
  const [variables, setVariables] = useState("{}");
  const [templateValues, setTemplateValues] = useState("{}");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [error, setError] = useState("");

  const query = useQuery<Json>({
    // Documents are visible by role, not merely by company.  A role switch
    // must never reuse another seat's cached document list or revision trail.
    queryKey: [root, roleScopeKey, "native-documents"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/docs`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const documents = useMemo(() => objects.filter((item) => item.objectType === "document"), [objects]);
  const templates = useMemo(() => objects.filter((item) => item.objectType === "template"), [objects]);
  const contextQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-documents-context"], queryFn: async () => (await apiRequest("GET", `${root}/context`)).json() });
  const canViewCrm = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys) && contextQuery.data.principalContext.visibleInstrumentKeys.includes("crm");
  const crmQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-documents-crm-context"], enabled: Boolean(canViewCrm), retry: false, queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json() });
  const relationshipChoices = useMemo(() => {
    const crmObjects: Json[] = crmQuery.data?.objects || [];
    const people = crmObjects.filter((item) => item.objectType === "person");
    return crmObjects.filter((item) => item.objectType === "relationship").map((relationship) => {
      const person = people.find((item) => item.id === relationship.data?.personObjectId);
      return { relationship, label: `${String(relationship.data?.relationshipType || "Relationship").replaceAll("_", " ")} · ${person?.data?.displayName || person?.title || "Visible relationship"}` };
    });
  }, [crmQuery.data]);
  const selectedRelationship = relationshipChoices.find((item) => item.relationship.id === selectedRelationshipId) || null;
  const activeObjects = mode === "documents" ? documents : templates;
  const selected = selectedId === "__new__"
    ? undefined
    : activeObjects.find((item) => item.id === selectedId) || activeObjects[0];
  const selectedEvents = useMemo(() => (query.data?.events || []).filter((event: Json) => event.objectId === selected?.id), [query.data?.events, selected?.id]);

  useEffect(() => {
    setSelectedId("");
    setError("");
  }, [mode]);

  useEffect(() => {
    if (!selected) {
      setTitle(""); setSummary(""); setBody(""); setFormat("markdown"); setVariables("{}");
      return;
    }
    setTitle(String(selected.title || ""));
    setSummary(String(selected.summary || ""));
    setBody(String(selected.data?.body || ""));
    setFormat(String(selected.data?.format || "markdown"));
    setVariables(JSON.stringify(selected.data?.variables || {}, null, 2));
  }, [selected?.id, selected?.version]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-documents"] });
  const beginNewDraft = () => {
    setSelectedId("__new__");
    setTitle("");
    setSummary("");
    setBody("");
    setFormat("markdown");
    setVariables("{}");
    setError("");
  };
  const create = useMutation({
    mutationFn: async () => {
      setError("");
      const objectType = mode === "documents" ? "document" : "template";
      const data = objectType === "document"
        ? { body: body.trim(), format }
        : { body: body.trim(), variables: parseVariables(variables) };
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "docs", objectType, objectKey: `${objectType}:${safeKey(title)}:${Date.now()}`,
        title: title.trim(), summary: summary.trim(), classification: "confidential", visibility: "team",
        data, sourceReference: { authority: "native_eos", capability: objectType }, evidenceIds: [], idempotencyKey: commandKey(`docs-create-${objectType}`),
      })).json();
      let relationshipLinked = true;
      if (objectType === "document" && selectedRelationship) try {
        await apiRequest("POST", `${root}/instrument-links`, {
          sourceObjectId: result.object.id, targetObjectId: selectedRelationship.relationship.id, relationshipType: "concerns_relationship",
          metadata: { relationshipLabel: selectedRelationship.label }, idempotencyKey: commandKey("native-document-relationship-link"),
        });
      } catch { relationshipLinked = false; }
      return { ...result, relationshipLinked };
    },
    onSuccess: async (result) => { setSelectedId(result.object.id); if (!result.relationshipLinked) setError("The document was created, but EOS could not create its CRM relationship link. Review the document before relying on that context."); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a document or template to save.");
      setError("");
      const data = selected.objectType === "document"
        ? { ...selected.data, body: body.trim(), format }
        : { ...selected.data, body: body.trim(), variables: parseVariables(variables) };
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selected.id}`, {
        expectedVersion: selected.version, title: title.trim(), summary: summary.trim(), data,
        idempotencyKey: commandKey("docs-save"),
      })).json();
    },
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state: "active", rationale: "Activate this governed native EOS document or template for its recorded operating purpose.", evidenceIds: [], idempotencyKey: commandKey("docs-activate"),
    })).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const useTemplate = useMutation({
    mutationFn: async () => {
      if (!selected || selected.objectType !== "template") throw new Error("Choose a template before creating a document from it.");
      const values = parseVariables(templateValues);
      const nextTitle = newDocumentTitle.trim();
      if (nextTitle.length < 2) throw new Error("Give the document created from this template a title.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "docs", objectType: "document", objectKey: `document:${safeKey(nextTitle)}:${Date.now()}`,
        title: nextTitle, summary: `Created from template: ${selected.title}.`, classification: selected.classification || "confidential", visibility: selected.visibility || "team",
        data: { body: resolveTemplate(String(selected.data?.body || ""), values), format: "markdown", templateObjectId: selected.id, resolvedVariables: values },
        sourceReference: { authority: "native_eos", templateObjectId: selected.id }, evidenceIds: [], idempotencyKey: commandKey("docs-use-template"),
      })).json();
    },
    onSuccess: async (result) => { setNewDocumentTitle(""); setTemplateValues("{}"); setMode("documents"); setSelectedId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const isTemplate = selected?.objectType === "template";
  const canCreate = title.trim().length >= 2 && body.trim().length >= 1 && (mode === "documents" || (() => { try { parseVariables(variables); return true; } catch { return false; } })());

  return <Card data-testid="native-documents-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Native Docs</CardTitle><CardDescription className="mt-1">Create, edit, activate, and reuse governed operating documents inside EOS. Connected file suites can reconcile later; no external document product is required to begin.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Document command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Native document workspace mode"><Button size="sm" type="button" variant={mode === "documents" ? "default" : "outline"} onClick={() => setMode("documents")}>Documents ({documents.length})</Button><Button size="sm" type="button" variant={mode === "templates" ? "default" : "outline"} onClick={() => setMode("templates")}>Templates ({templates.length})</Button></div>
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <aside className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><FilePlus2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">{mode === "documents" ? "Document library" : "Template library"}</h3></div><Button size="sm" variant="outline" disabled={!canExecute} onClick={beginNewDraft}>New</Button></div><p className="mt-1 text-xs text-muted-foreground">Only records visible to this seat and role appear here.</p><div className="mt-4 space-y-2">{activeObjects.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === item.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-2"><span className="line-clamp-1 text-sm font-medium">{item.title}</span><Badge variant={stateVariant(item.state)}>{item.state}</Badge></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary || "No summary recorded"}</p><p className="mt-2 text-xs text-muted-foreground">Version {item.version} · {formatRecordedAt(item.updatedAt)}</p></button>)}{!activeObjects.length && <p className="py-5 text-center text-sm text-muted-foreground">No native {mode} yet.</p>}</div></aside>
          <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">{selected ? `Version ${selected.version}` : `New ${mode.slice(0, -1)}`}</p><h3 className="mt-1 font-semibold">{selected ? (isTemplate ? "Edit template" : "Edit document") : `Create ${mode.slice(0, -1)}`}</h3></div>{selected?.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selected)}>Activate {isTemplate ? "template" : "document"}</Button>}</div><div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-doc-title">Title</Label><Input id="native-doc-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === "documents" ? "Revenue recovery operating brief" : "Client proposal template"} /></div><div><Label htmlFor="native-doc-format">Format</Label><select id="native-doc-format" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={format} onChange={(event) => setFormat(event.target.value)} disabled={isTemplate}><option value="markdown">Markdown</option><option value="plain_text">Plain text</option></select></div></div><div><Label htmlFor="native-doc-summary">Purpose</Label><Input id="native-doc-summary" className="mt-1" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What operating decision or repeatable work does this support?" /></div>{mode === "documents" && canViewCrm && <div><Label htmlFor="native-document-relationship">Relationship context (optional)</Label><select id="native-document-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRelationshipId} onChange={(event) => setSelectedRelationshipId(event.target.value)} disabled={crmQuery.isFetching}><option value="">No CRM relationship</option>{relationshipChoices.map((choice) => <option key={choice.relationship.id} value={choice.relationship.id}>{choice.label}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only CRM relationships already visible to this role appear here. EOS records an auditable native relationship edge; no external document suite is changed.</p></div>}<div><Label htmlFor="native-doc-body">{isTemplate ? "Template body" : "Document body"}</Label><Textarea id="native-doc-body" className="mt-1 min-h-72 font-mono text-sm" value={body} onChange={(event) => setBody(event.target.value)} placeholder={isTemplate ? "# Proposal for {{client_name}}\n\nPrepared by {{company_name}}" : "Write the governed operating content here."} /></div>{(mode === "templates" || isTemplate) && <div><Label htmlFor="native-doc-variables">Template variables (JSON)</Label><Textarea id="native-doc-variables" className="mt-1 font-mono text-xs" rows={5} value={variables} onChange={(event) => setVariables(event.target.value)} placeholder={'{\n  "client_name": "",\n  "company_name": ""\n}'} /><p className="mt-1 text-xs text-muted-foreground">Use matching placeholders such as <code>{"{{client_name}}"}</code> in the template body.</p></div>}<div className="flex flex-wrap justify-end gap-2"><Button disabled={!canExecute || !canCreate || create.isPending} onClick={() => create.mutate()}><FilePlus2 className="mr-2 h-4 w-4" />{create.isPending ? "Creating…" : `Create native ${mode.slice(0, -1)}`}</Button>{selected && <Button variant="outline" disabled={!canExecute || title.trim().length < 2 || body.trim().length < 1 || save.isPending} onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save new version"}</Button>}</div></div></section>
        <aside className="space-y-4"><section className="rounded-xl border p-3"><div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h3 className="font-semibold">Revision trail</h3></div><p className="mt-1 text-xs text-muted-foreground">Each create, save, and lifecycle transition is an immutable governed event.</p><div className="mt-3 space-y-2">{selectedEvents.map((event: Json) => <div key={event.id} className="rounded-lg bg-muted/40 p-2.5"><p className="text-xs font-medium">{String(event.eventType || "recorded").replaceAll(".", " ")}</p><p className="mt-1 text-xs text-muted-foreground">v{event.objectVersion} · {formatRecordedAt(event.createdAt)}</p></div>)}{selected && !selectedEvents.length && <p className="text-xs text-muted-foreground">No visible revision events yet.</p>}{!selected && <p className="text-xs text-muted-foreground">Choose a record to inspect its history.</p>}</div></section>{isTemplate && <section className="rounded-xl border p-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">Use this template</h3></div><p className="mt-1 text-xs text-muted-foreground">This creates a separate governed draft. It does not overwrite the source template.</p><div className="mt-3 grid gap-3"><div><Label htmlFor="native-doc-template-title">New document title</Label><Input id="native-doc-template-title" className="mt-1" value={newDocumentTitle} onChange={(event) => setNewDocumentTitle(event.target.value)} placeholder="Client proposal · Acme" /></div><div><Label htmlFor="native-doc-template-values">Variable values (JSON)</Label><Textarea id="native-doc-template-values" className="mt-1 font-mono text-xs" rows={5} value={templateValues} onChange={(event) => setTemplateValues(event.target.value)} placeholder={'{\n  "client_name": "Acme"\n}'} /></div><Button size="sm" disabled={!canExecute || newDocumentTitle.trim().length < 2 || useTemplate.isPending} onClick={() => useTemplate.mutate()}>{useTemplate.isPending ? "Creating…" : "Create from template"}</Button></div></section>}</aside>
      </div>
      <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Native, governed, and integration-ready</AlertTitle><AlertDescription>Docs are native EOS records first. External file providers can later reconcile content and references under explicit authority, but they never replace the tenant-scoped source, audit trail, lifecycle, or approval boundary shown here.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
