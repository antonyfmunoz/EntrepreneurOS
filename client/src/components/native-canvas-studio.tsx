import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, GitBranch, LayoutDashboard, Link2, Plus, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Row = Record<string, any>;
const commandKey = (prefix: string) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
const point = (value: unknown) => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { x: Number.isFinite(Number(source.x)) ? Number(source.x) : 0, y: Number.isFinite(Number(source.y)) ? Number(source.y) : 0 };
};

/** A bounded visual graph over already-authorized native records. Canvas never
 * becomes a second database: nodes reference canonical source objects and an
 * edge records only the operator's visual relationship. */
export function NativeCanvasStudio({ root, canExecute, canDecide }: { root: string; canExecute: boolean; canDecide: boolean }) {
  const cache = useQueryClient();
  const query = useQuery<Row>({ queryKey: [root, "native-canvas"], queryFn: async () => (await apiRequest("GET", `${root}/instruments`)).json() });
  const [canvasTitle, setCanvasTitle] = useState("");
  const [selectedCanvasId, setSelectedCanvasId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [edgeStartId, setEdgeStartId] = useState("");
  const [edgeEndId, setEdgeEndId] = useState("");
  const [error, setError] = useState("");
  const objects: Row[] = query.data?.objects || [];
  const canvases = objects.filter((item) => item.instrumentKey === "canvas" && item.objectType === "canvas");
  const selectedCanvas = canvases.find((item) => item.id === selectedCanvasId) || canvases[0];
  const nodes = useMemo(() => objects.filter((item) => item.instrumentKey === "canvas" && item.objectType === "node" && item.parentObjectId === selectedCanvas?.id), [objects, selectedCanvas?.id]);
  const edges = useMemo(() => objects.filter((item) => item.instrumentKey === "canvas" && item.objectType === "edge" && item.parentObjectId === selectedCanvas?.id), [objects, selectedCanvas?.id]);
  const sourceObjects = useMemo(() => objects.filter((item) => item.instrumentKey !== "canvas" && item.state !== "archived"), [objects]);
  const byId = useMemo(() => new Map(objects.map((item) => [item.id, item])), [objects]);
  const refresh = () => cache.invalidateQueries({ queryKey: [root, "native-canvas"] });
  const patchCanvas = async (canvas: Row, patch: Record<string, unknown>, prefix: string) => (await apiRequest("PATCH", `${root}/instrument-objects/${canvas.id}`, {
    expectedVersion: canvas.version, data: { ...(canvas.data || {}), ...patch }, idempotencyKey: commandKey(prefix),
  })).json();
  const createCanvas = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "canvas", objectType: "canvas", objectKey: `canvas:canvas:${slug(canvasTitle)}:${Date.now()}`,
      title: canvasTitle.trim(), summary: "A native EOS visual operating map.", classification: "confidential", visibility: "organization",
      data: { nodes: [], edges: [] }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("canvas-create"),
    })).json(),
    onSuccess: async (result) => { setCanvasTitle(""); setSelectedCanvasId(result.object?.id || ""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const addNode = useMutation({
    mutationFn: async () => {
      if (!selectedCanvas || !sourceId) throw new Error("Choose a canvas and one visible source record.");
      const source = byId.get(sourceId);
      if (!source) throw new Error("That source record is no longer visible to this role.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "canvas", objectType: "node", objectKey: `canvas:node:${source.id}:${Date.now()}`,
        title: source.title, summary: `Visual reference to ${source.instrumentKey} · ${source.objectType}.`, classification: "confidential", visibility: "organization", parentObjectId: selectedCanvas.id,
        data: { sourceObjectId: source.id, position: { x: (nodes.length % 3) * 250, y: Math.floor(nodes.length / 3) * 160 } }, sourceReference: { authority: "native_eos", sourceObjectId: source.id }, evidenceIds: [], idempotencyKey: commandKey("canvas-node-create"),
      })).json();
      await patchCanvas(selectedCanvas, { nodes: [...(selectedCanvas.data?.nodes || []), result.object.id] }, "canvas-add-node");
    },
    onSuccess: async () => { setSourceId(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const addEdge = useMutation({
    mutationFn: async () => {
      if (!selectedCanvas || !edgeStartId || !edgeEndId || edgeStartId === edgeEndId) throw new Error("Choose two different nodes.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "canvas", objectType: "edge", objectKey: `canvas:edge:${edgeStartId}:${edgeEndId}:${Date.now()}`,
        title: "Visual relationship", summary: "A native EOS visual relationship between two canonical references.", classification: "confidential", visibility: "organization", parentObjectId: selectedCanvas.id,
        data: { sourceNodeId: edgeStartId, targetNodeId: edgeEndId }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("canvas-edge-create"),
      })).json();
      await patchCanvas(selectedCanvas, { edges: [...(selectedCanvas.data?.edges || []), result.object.id] }, "canvas-add-edge");
    },
    onSuccess: async () => { setEdgeStartId(""); setEdgeEndId(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const shiftNode = useMutation({
    mutationFn: async ({ node, dx, dy }: { node: Row; dx: number; dy: number }) => {
      const current = point(node.data?.position);
      return (await apiRequest("PATCH", `${root}/instrument-objects/${node.id}`, { expectedVersion: node.version, data: { ...(node.data || {}), position: { x: Math.max(0, current.x + dx), y: Math.max(0, current.y + dy) } }, idempotencyKey: commandKey("canvas-node-position") })).json();
    }, onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const publishCanvas = useMutation({
    mutationFn: async () => {
      if (!selectedCanvas) throw new Error("Choose a canvas to publish.");
      return (await apiRequest("POST", `${root}/instrument-objects/${selectedCanvas.id}/transitions`, { expectedVersion: selectedCanvas.version, state: "active", rationale: "Publish this reviewed native visual map for its governed company audience.", evidenceIds: [], idempotencyKey: commandKey("canvas-publish") })).json();
    }, onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  return <Card data-testid="native-canvas-studio"><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-primary"/>Native Canvas</CardTitle><CardDescription>Map authorized native company records visually, without copying their source data or requiring an external whiteboard subscription.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></CardHeader><CardContent className="space-y-5">{error && <Alert variant="destructive"><AlertTitle>Canvas command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}<div className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto]"><Input value={canvasTitle} onChange={(event) => setCanvasTitle(event.target.value)} placeholder="Business operating map" aria-label="Canvas title"/><Button disabled={!canExecute || canvasTitle.trim().length < 3 || createCanvas.isPending} onClick={() => createCanvas.mutate()}><Plus className="mr-2 h-4 w-4"/>Create canvas</Button></div><div className="grid gap-5 xl:grid-cols-[260px_1fr]"><aside className="space-y-3 rounded-xl border p-3"><p className="text-sm font-semibold">Visual maps</p>{canvases.map((canvas) => <button key={canvas.id} type="button" onClick={() => setSelectedCanvasId(canvas.id)} className={`w-full rounded-lg border p-3 text-left ${selectedCanvas?.id === canvas.id ? "border-primary bg-primary/5" : "bg-muted/20"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{canvas.title}</span><Badge variant={canvas.state === "active" ? "default" : "outline"}>{canvas.state}</Badge></div></button>)}{!canvases.length && <p className="text-sm text-muted-foreground">Create a map to begin.</p>}</aside><section className="space-y-4">{selectedCanvas ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eos-label">Canvas · {selectedCanvas.title}</p><h3 className="mt-1 font-semibold">Model relationships without a duplicate system of record</h3></div>{selectedCanvas.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || !nodes.length || !edges.length || publishCanvas.isPending} onClick={() => publishCanvas.mutate()}>Publish map</Button>}</div><div className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_auto]"><select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)} aria-label="Visible record to add to canvas"><option value="">Add a visible native record…</option>{sourceObjects.map((source) => <option key={source.id} value={source.id}>{source.instrumentKey.replaceAll("_", " ")} · {source.title}</option>)}</select><Button disabled={!canExecute || !sourceId || addNode.isPending} onClick={() => addNode.mutate()}><Plus className="mr-2 h-4 w-4"/>Add record</Button></div><div className="grid gap-3 rounded-xl border border-dashed p-4 lg:grid-cols-[1fr_1fr_auto]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={edgeStartId} onChange={(event) => setEdgeStartId(event.target.value)} aria-label="Relationship source node"><option value="">From node…</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={edgeEndId} onChange={(event) => setEdgeEndId(event.target.value)} aria-label="Relationship target node"><option value="">To node…</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select><Button variant="outline" disabled={!canExecute || !edgeStartId || !edgeEndId || addEdge.isPending} onClick={() => addEdge.mutate()}><Link2 className="mr-2 h-4 w-4"/>Connect</Button></div><div className="overflow-auto rounded-xl border bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted))_1px,transparent_0)] bg-[size:18px_18px] p-5"><div className="min-w-[640px]"><div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="h-4 w-4"/>{nodes.length} nodes · {edges.length} visual relationships</div><div className="grid gap-4 md:grid-cols-3">{nodes.map((node) => { const source = byId.get(node.data?.sourceObjectId); const position = point(node.data?.position); return <article key={node.id} className="rounded-xl border bg-background p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{source?.title || node.title}</p><p className="mt-1 text-xs text-muted-foreground">{source ? `${source.instrumentKey.replaceAll("_", " ")} · ${source.objectType}` : "Source record unavailable"}</p></div><Badge variant="outline">{position.x},{position.y}</Badge></div><div className="mt-3 flex items-center gap-1"><Button size="sm" variant="ghost" disabled={!canExecute || shiftNode.isPending} onClick={() => shiftNode.mutate({ node, dx: -80, dy: 0 })}>←</Button><Button size="sm" variant="ghost" disabled={!canExecute || shiftNode.isPending} onClick={() => shiftNode.mutate({ node, dx: 0, dy: -80 })}>↑</Button><Button size="sm" variant="ghost" disabled={!canExecute || shiftNode.isPending} onClick={() => shiftNode.mutate({ node, dx: 0, dy: 80 })}>↓</Button><Button size="sm" variant="ghost" disabled={!canExecute || shiftNode.isPending} onClick={() => shiftNode.mutate({ node, dx: 80, dy: 0 })}>→</Button></div></article>; })}</div>{edges.length > 0 && <div className="mt-5 border-t pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationships</p><div className="mt-2 flex flex-wrap gap-2">{edges.map((edge) => <Badge key={edge.id} variant="secondary">{byId.get(edge.data?.sourceNodeId)?.title || "Node"} <ChevronDown className="mx-1 h-3 w-3 -rotate-90"/> {byId.get(edge.data?.targetNodeId)?.title || "Node"}</Badge>)}</div></div>}{!nodes.length && <p className="rounded-lg border border-dashed bg-background/80 p-6 text-sm text-muted-foreground">Add records that this role is authorized to see, then connect them into an operating map.</p>}</div></div></> : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Choose or create a visual map.</p>}</section></div><Alert><AlertTitle>Native visual-model boundary</AlertTitle><AlertDescription>Canvas stores node positions and visual relationships only. Every node still resolves to its canonical EOS record; Canvas cannot bypass source authority, lifecycle, or external-provider boundaries.</AlertDescription></Alert></CardContent></Card>;
}
