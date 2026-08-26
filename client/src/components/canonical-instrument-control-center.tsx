import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, ArrowRight, Boxes, Download, Link2, Plus, RefreshCw, Search, ShieldCheck, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  eosInstrumentKeys,
  eosInstrumentManifest,
  instrumentActivationRequirements,
  instrumentDomainFindings,
  instrumentFieldKind,
  instrumentStarterData,
  instrumentTransitions,
  type EosInstrumentKey,
} from "@shared/instrument-runtime";

type JsonRecord = Record<string, any>;
type EvidenceOption = { id: string; title: string; verificationState: string };

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function parseObject(text: string) {
  const value = JSON.parse(text || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Structured data must be a JSON object.");
  return value as JsonRecord;
}

function getPath(value: JsonRecord, path: string) {
  return path.split(".").reduce<any>((cursor, part) => cursor?.[part], value);
}

function setPath(value: JsonRecord, path: string, next: unknown) {
  const copy = structuredClone(value);
  const parts = path.split(".");
  let cursor = copy;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)!] = next;
  return copy;
}

function friendlyField(path: string) {
  return path.split(".").at(-1)!.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function stateTone(state: string) {
  if (["active", "completed"].includes(state)) return "default" as const;
  if (["cancelled", "archived"].includes(state)) return "secondary" as const;
  return "outline" as const;
}

export function CanonicalInstrumentControlCenter({ root, canExecute, canDecide, evidence = [] }: {
  root: string;
  canExecute: boolean;
  canDecide: boolean;
  evidence?: EvidenceOption[];
}) {
  const [instrumentKey, setInstrumentKey] = useState<EosInstrumentKey>("docs");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [objectType, setObjectType] = useState(eosInstrumentManifest.docs.objectTypes[0]);
  const [classification, setClassification] = useState("confidential");
  const [visibility, setVisibility] = useState("organization");
  const [structuredData, setStructuredData] = useState(() => JSON.stringify(instrumentStarterData("docs", "document"), null, 2));
  const [objectEvidenceId, setObjectEvidenceId] = useState("");
  const [transitionEvidenceId, setTransitionEvidenceId] = useState("");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [relationshipType, setRelationshipType] = useState("supports");
  const [error, setError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  const query = useQuery<JsonRecord>({
    queryKey: [root, "canonical-instruments"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments`)).json(),
  });
  const objects: JsonRecord[] = query.data?.objects || [];
  const visible = useMemo(() => objects.filter((item) => item.instrumentKey === instrumentKey && (!search.trim() || `${item.title} ${item.summary} ${item.objectKey}`.toLowerCase().includes(search.trim().toLowerCase()))), [objects, instrumentKey, search]);
  const selected = objects.find((item) => item.id === selectedId);
  const events: JsonRecord[] = (query.data?.events || []).filter((event: JsonRecord) => event.objectId === selectedId);
  const links: JsonRecord[] = (query.data?.links || []).filter((link: JsonRecord) => link.sourceObjectId === selectedId || link.targetObjectId === selectedId);
  const instrument = eosInstrumentManifest[instrumentKey];
  const requiredFields = instrumentActivationRequirements[instrumentKey]?.[objectType] || [];
  const editingData = useMemo(() => {
    try { return parseObject(structuredData); } catch { return {}; }
  }, [structuredData]);
  const readinessFindings = useMemo(() => instrumentDomainFindings(instrumentKey, objectType, editingData), [editingData, instrumentKey, objectType]);

  useEffect(() => {
    const nextType = eosInstrumentManifest[instrumentKey].objectTypes[0];
    setObjectType(nextType);
    setStructuredData(JSON.stringify(instrumentStarterData(instrumentKey, nextType), null, 2));
    setObjectEvidenceId("");
    setSelectedId("");
    setError("");
  }, [instrumentKey]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title || "");
    setSummary(selected.summary || "");
    setObjectType(selected.objectType);
    setClassification(selected.classification);
    setVisibility(selected.visibility);
    setStructuredData(JSON.stringify(selected.data || {}, null, 2));
    setObjectEvidenceId(selected.evidenceIds?.[0] || "");
  }, [selectedId, selected?.version]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, "canonical-instruments"] });
  const createMutation = useMutation({
    mutationFn: async () => {
      setError("");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey, objectType, objectKey: `${instrumentKey}:${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}:${Date.now()}`,
        title: title.trim(), summary: summary.trim(), classification, visibility,
        data: parseObject(structuredData), sourceReference: {}, evidenceIds: objectEvidenceId ? [objectEvidenceId] : [], idempotencyKey: commandKey(`create:${instrumentKey}`),
      })).json();
    },
    onSuccess: async (result) => { await refresh(); setSelectedId(result.object.id); },
    onError: (cause: Error) => setError(cause.message),
  });
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose an object to update.");
      setError("");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selected.id}`, {
        expectedVersion: selected.version, title: title.trim(), summary: summary.trim(), classification, visibility,
        data: parseObject(structuredData), evidenceIds: objectEvidenceId ? [objectEvidenceId] : [], idempotencyKey: commandKey(`update:${instrumentKey}`),
      })).json();
    },
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const transitionMutation = useMutation({
    mutationFn: async (state: string) => {
      if (!selected) throw new Error("Choose an object to transition.");
      const evidenceIds = transitionEvidenceId ? [transitionEvidenceId] : [];
      return (await apiRequest("POST", `${root}/instrument-objects/${selected.id}/transitions`, {
        expectedVersion: selected.version, state, rationale: `Operator moved ${selected.title} to ${state}.`, evidenceIds,
        idempotencyKey: commandKey(`transition:${instrumentKey}:${state}`),
      })).json();
    },
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !linkTargetId) throw new Error("Choose both objects to create a relationship.");
      return (await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selected.id, targetObjectId: linkTargetId, relationshipType, metadata: {}, idempotencyKey: commandKey("link") })).json();
    },
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const importMutation = useMutation({
    mutationFn: async (bundle: unknown) => (await apiRequest("POST", `${root}/instrument-imports`, { bundle, conflictStrategy: "copy", idempotencyKey: commandKey("instrument-import") })).json(),
    onSuccess: async () => { await refresh(); setError(""); },
    onError: (cause: Error) => setError(cause.message),
  });

  const exportBundle = async () => {
    try {
      const response = await apiRequest("GET", `${root}/instrument-export?instrumentKey=${encodeURIComponent(instrumentKey)}`);
      const bundle = await response.json();
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `eos-${instrumentKey}-bundle.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const importBundle = async (file?: File) => {
    if (!file) return;
    try { importMutation.mutate(JSON.parse(await file.text())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The instrument bundle is not valid JSON."); }
    finally { if (importInput.current) importInput.current.value = ""; }
  };

  const resetDraft = () => {
    setSelectedId(""); setTitle(""); setSummary(""); setClassification("confidential"); setVisibility("organization");
    setStructuredData(JSON.stringify(instrumentStarterData(instrumentKey, objectType), null, 2)); setObjectEvidenceId(""); setError("");
  };

  const chooseObjectType = (nextType: string) => {
    setObjectType(nextType);
    if (!selected) setStructuredData(JSON.stringify(instrumentStarterData(instrumentKey, nextType), null, 2));
    setError("");
  };

  const updateField = (path: string, next: unknown) => {
    setStructuredData(JSON.stringify(setPath(editingData, path, next), null, 2));
    setError("");
  };

  return <Card data-testid="canonical-instrument-control-center">
    <CardHeader className="gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary"/>Canonical instrument workspace</CardTitle>
          <CardDescription className="mt-1">Operate every required EOS instrument through one tenant-safe object, authority, lifecycle, Evidence, event, and relationship grammar.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh canonical instruments"><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}/>Refresh</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {eosInstrumentKeys.map((key) => <button key={key} type="button" onClick={() => setInstrumentKey(key)} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${instrumentKey === key ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted"}`} aria-pressed={instrumentKey === key}>
          <span className="block truncate font-medium">{eosInstrumentManifest[key].label}</span>
          <span className="text-muted-foreground">{query.data?.counts?.[key] || 0} objects</span>
        </button>)}
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>{instrument.label}</AlertTitle><AlertDescription>{instrument.purpose} Provider references never become authority or current truth by implication.</AlertDescription></Alert>
      {error && <Alert variant="destructive"><AlertTitle>Command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${instrument.label}`} className="pl-9" aria-label={`Search ${instrument.label}`}/></div>
            <Button type="button" variant="outline" onClick={exportBundle} disabled={query.isLoading}><Download className="mr-2 h-4 w-4"/>Export</Button>
            <input ref={importInput} type="file" accept="application/json,.json" className="hidden" aria-label="Import instrument bundle" onChange={(event) => void importBundle(event.target.files?.[0])}/>
            <Button type="button" variant="outline" onClick={() => importInput.current?.click()} disabled={!canExecute || importMutation.isPending}><Upload className="mr-2 h-4 w-4"/>Import</Button>
            <Button type="button" onClick={resetDraft} disabled={!canExecute}><Plus className="mr-2 h-4 w-4"/>New object</Button>
          </div>
          <div className="space-y-2">
            {visible.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === item.id ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/60"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary || `${item.objectType.replaceAll("_", " ")} · version ${item.version}`}</p></div><Badge variant={stateTone(item.state)}>{item.state}</Badge></div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{item.objectType.replaceAll("_", " ")}</span><span>v{item.version}</span><span>{item.classification}</span><span>{item.visibility}</span></div>
            </button>)}
            {!visible.length && !query.isLoading && <div className="rounded-xl border border-dashed p-8 text-center"><Archive className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-3 font-medium">No {instrument.label} objects yet</p><p className="mt-1 text-sm text-muted-foreground">Create the first governed object. It begins in draft and cannot cause an external effect.</p></div>}
          </div>
        </section>
        <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{selected ? "Edit governed object" : "Create governed object"}</p><p className="text-xs text-muted-foreground">Draft state is safe by default.</p></div>{selected && <Button variant="ghost" size="sm" onClick={resetDraft}>Clear</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="instrument-object-type">Object type</Label><Select value={objectType} onValueChange={chooseObjectType} disabled={Boolean(selected)}><SelectTrigger id="instrument-object-type" className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{instrument.objectTypes.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="instrument-title">Title</Label><Input id="instrument-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300}/></div></div>
          <div><Label htmlFor="instrument-summary">Summary</Label><Textarea id="instrument-summary" className="mt-1" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={5000} rows={3}/></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="instrument-classification">Classification</Label><Select value={classification} onValueChange={setClassification}><SelectTrigger id="instrument-classification" className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="confidential">Confidential</SelectItem><SelectItem value="restricted">Restricted</SelectItem></SelectContent></Select></div><div><Label htmlFor="instrument-visibility">Visibility</Label><Select value={visibility} onValueChange={setVisibility}><SelectTrigger id="instrument-visibility" className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="seat">Seat only</SelectItem><SelectItem value="team">Team hierarchy</SelectItem><SelectItem value="organization">Organization</SelectItem><SelectItem value="portfolio">Portfolio principals</SelectItem></SelectContent></Select></div></div>
          <div><Label htmlFor="instrument-object-evidence">Object Evidence</Label><Select value={objectEvidenceId || "none"} onValueChange={(value) => setObjectEvidenceId(value === "none" ? "" : value)}><SelectTrigger id="instrument-object-evidence" className="mt-1"><SelectValue placeholder="Optional company Evidence"/></SelectTrigger><SelectContent><SelectItem value="none">No Evidence attached</SelectItem>{evidence.map((item) => <SelectItem key={item.id} value={item.id}>{item.title} · {item.verificationState}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-3 rounded-lg border bg-background p-3" aria-label={`${instrument.label} required fields`}>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Required operating fields</p><p className="text-xs text-muted-foreground">Complete these before activation. References stay governed and tenant-scoped.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setStructuredData(JSON.stringify(instrumentStarterData(instrumentKey, objectType), null, 2))}>Load starter</Button></div>
            <div className="grid gap-3 sm:grid-cols-2">{requiredFields.map((path) => {
              const value = getPath(editingData, path);
              const kind = instrumentFieldKind(path, value);
              const inputId = `instrument-field-${path.replaceAll(".", "-")}`;
              return <div key={`${selected?.id || "new"}:${selected?.version || 0}:${objectType}:${path}`} className={kind === "json" ? "sm:col-span-2" : ""}><Label htmlFor={inputId}>{friendlyField(path)}</Label>{kind === "json" ? <Textarea id={inputId} className="mt-1 font-mono text-xs" defaultValue={JSON.stringify(value ?? [], null, 2)} rows={4} onBlur={(event) => { try { updateField(path, JSON.parse(event.target.value)); } catch { setError(`${friendlyField(path)} must be valid JSON.`); } }}/> : <Input id={inputId} className="mt-1" type={kind === "number" ? "number" : "text"} value={value == null ? "" : String(value)} onChange={(event) => updateField(path, kind === "number" ? Number(event.target.value) : event.target.value)} />}</div>;
            })}</div>
            <div className={`rounded-md px-3 py-2 text-xs ${readinessFindings.length ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{readinessFindings.length ? `${readinessFindings.length} activation requirement${readinessFindings.length === 1 ? "" : "s"} remain: ${readinessFindings.map((finding) => finding.message).join(" ")}` : "Activation-ready structure. Decision authority and Evidence rules still apply."}</div>
          </div>
          <details className="rounded-lg border bg-background p-3"><summary className="cursor-pointer text-sm font-medium">Advanced structured data</summary><Label htmlFor="instrument-data" className="sr-only">Structured instrument data JSON</Label><Textarea id="instrument-data" className="mt-3 font-mono text-xs" value={structuredData} onChange={(event) => setStructuredData(event.target.value)} rows={8}/><p className="mt-2 text-xs text-muted-foreground">Managed references such as vault:// are allowed. Credential values are rejected.</p></details>
          <Button className="w-full" disabled={!canExecute || title.trim().length < 2 || createMutation.isPending || updateMutation.isPending} onClick={() => selected ? updateMutation.mutate() : createMutation.mutate()}>{selected ? "Save new version" : "Create draft object"}</Button>
          {selected && <div className="space-y-3 border-t pt-4"><div><p className="text-sm font-medium">Lifecycle controls</p><p className="text-xs text-muted-foreground">Consequential transitions require decision authority. Completion requires verified Evidence.</p></div>{instrumentTransitions[selected.state as keyof typeof instrumentTransitions]?.map((state) => <Button key={state} variant="outline" size="sm" className="mr-2" disabled={transitionMutation.isPending || (["active", "completed", "cancelled", "archived"].includes(state) ? !canDecide : !canExecute)} onClick={() => transitionMutation.mutate(state)}>{selected.state}<ArrowRight className="mx-2 h-3 w-3"/>{state}</Button>)}<Select value={transitionEvidenceId || "none"} onValueChange={(value) => setTransitionEvidenceId(value === "none" ? "" : value)}><SelectTrigger aria-label="Transition Evidence" className="mt-2"><SelectValue placeholder="Optional verified Evidence"/></SelectTrigger><SelectContent><SelectItem value="none">No Evidence attached</SelectItem>{evidence.filter((item) => item.verificationState === "verified").map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></div>}
        </section>
      </div>
      {selected && <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border p-4"><h4 className="font-semibold">Cross-instrument relationships</h4><p className="mt-1 text-sm text-muted-foreground">Link canonical objects without copying or collapsing their source state.</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]"><Select value={linkTargetId || "none"} onValueChange={(value) => setLinkTargetId(value === "none" ? "" : value)}><SelectTrigger aria-label="Relationship target"><SelectValue placeholder="Target object"/></SelectTrigger><SelectContent><SelectItem value="none">Choose target</SelectItem>{objects.filter((item) => item.id !== selected.id).map((item) => <SelectItem key={item.id} value={item.id}>{eosInstrumentManifest[item.instrumentKey as EosInstrumentKey]?.label}: {item.title}</SelectItem>)}</SelectContent></Select><Input value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)} aria-label="Relationship type"/><Button size="icon" variant="outline" onClick={() => linkMutation.mutate()} disabled={!canExecute || !linkTargetId || relationshipType.trim().length < 2} aria-label="Create relationship"><Link2 className="h-4 w-4"/></Button></div><div className="mt-3 space-y-2">{links.map((link) => <p key={link.id} className="rounded-lg bg-muted p-2 text-xs">{link.relationshipType} · {link.sourceObjectId === selected.id ? "outbound" : "inbound"}</p>)}{!links.length && <p className="text-xs text-muted-foreground">No relationships yet.</p>}</div></section><section className="rounded-xl border p-4"><h4 className="font-semibold">Append-only event trail</h4><div className="mt-3 max-h-64 space-y-2 overflow-auto">{events.map((event) => <div key={event.id} className="rounded-lg bg-muted p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-medium">{event.eventType.replaceAll("_", " ")}</span><span>v{event.objectVersion}</span></div><p className="mt-1 text-muted-foreground">{event.fromState || "none"} → {event.toState} · {new Date(event.createdAt).toLocaleString()}</p></div>)}{!events.length && <p className="text-xs text-muted-foreground">Events appear after the first accepted command.</p>}</div></section></div>}
    </CardContent>
  </Card>;
}
