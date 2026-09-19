import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileSearch, Plus, RefreshCw, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Row = Record<string, any>;
const key = (prefix: string) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";

export function NativeKnowledgeHub({ root, canExecute, canDecide }: { root: string; canExecute: boolean; canDecide: boolean }) {
  const cache = useQueryClient();
  const query = useQuery<Row>({ queryKey: [root, "native-knowledge"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/knowledge`)).json() });
  const [kind, setKind] = useState("article");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const objects = query.data?.objects || [];
  const visible = useMemo(() => objects.filter((item: Row) => {
    const term = search.trim().toLowerCase();
    return !term || `${item.title} ${item.summary} ${item.data?.body || ""} ${item.data?.name || ""}`.toLowerCase().includes(term);
  }), [objects, search]);
  const refresh = () => cache.invalidateQueries({ queryKey: [root, "native-knowledge"] });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "knowledge", objectType: kind, objectKey: `knowledge:${kind}:${slug(title)}:${Date.now()}`,
      title: title.trim(), summary: summary.trim(), classification: "confidential", visibility: "organization",
      data: kind === "source" ? { sourceReference: sourceReference.trim(), sourceType: "native_eos" } : kind === "article" ? { body: body.trim(), sourceObjectIds: [] } : kind === "topic" ? { name: title.trim() } : { nodes: [], edges: [] },
      sourceReference: sourceReference.trim() ? { reference: sourceReference.trim(), authority: "native_eos" } : { authority: "native_eos" },
      evidenceIds: [], idempotencyKey: key("knowledge-create"),
    })).json(),
    onSuccess: async () => { setTitle(""); setSummary(""); setBody(""); setSourceReference(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (item: Row) => (await apiRequest("POST", `${root}/instrument-objects/${item.id}/transitions`, { expectedVersion: item.version, state: "active", rationale: "Publish this reviewed native knowledge record for its governed company audience.", evidenceIds: [], idempotencyKey: key("knowledge-publish") })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  return <Card data-testid="native-knowledge-hub">
    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary"/>Native Knowledge Hub</CardTitle><CardDescription className="mt-1">Curate company sources, articles, and topics directly in EOS. External knowledge can reconcile later, but EOS keeps its own governed operating context.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></CardHeader>
    <CardContent className="space-y-5">{error && <Alert variant="destructive"><AlertTitle>Knowledge command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary"/><h3 className="font-semibold">Create governed knowledge</h3></div><div className="mt-3 grid gap-3 md:grid-cols-2"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Knowledge record type">{["source", "article", "topic", "graph"].map((item) => <option key={item} value={item}>{item}</option>)}</select><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title"/><Input className="md:col-span-2" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Purpose or abstract"/>{kind !== "topic" && <Textarea className="md:col-span-2" value={kind === "source" ? sourceReference : body} onChange={(event) => kind === "source" ? setSourceReference(event.target.value) : setBody(event.target.value)} placeholder={kind === "source" ? "Non-secret source reference or EOS file/object ID" : "Reviewed source content, synthesis, or operating guidance"}/>}</div><Button className="mt-3" disabled={!canExecute || title.trim().length < 3 || (kind === "article" && body.trim().length < 20) || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create draft"}</Button></section>
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eos-label">Retrieve</p><h3 className="mt-1 font-semibold">Role-visible operating knowledge</h3></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sources and articles"/></div></div>{visible.map((item: Row) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary"/><p className="font-medium">{item.title}</p><Badge variant={item.state === "active" ? "default" : "outline"}>{item.state}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.data?.body || item.summary || item.data?.sourceReference || "No body recorded."}</p></div>{item.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(item)}>Publish</Button>}</div></div>)}{!visible.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No role-visible knowledge matches this query.</p>}</section>
      <Alert><AlertTitle>Knowledge is not automatic memory</AlertTitle><AlertDescription>Knowledge records can be curated and published by their accountable role. Durable institutional memory still requires the separate reviewed learning and founder-promotion path.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
