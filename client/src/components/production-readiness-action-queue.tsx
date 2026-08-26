import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CircleDot, ExternalLink, ListChecks, Loader2, RefreshCw, Save, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type OperatorState = "unassigned" | "planned" | "in_progress" | "waiting_external";
type ReadinessAction = {
  blockerKey: string;
  blockerType: "control" | "configuration" | "vendor" | "ownership";
  layer: number;
  title: string;
  evidenceClass: string;
  nextAction: string;
  operatorState: OperatorState;
  ownerUserId: string | null;
  dueAt: string | null;
  notes: string;
  version: number;
  currentBlocker: boolean;
};
type ActionQueue = { standard: string; generatedAt: string; currentBlockerCount: number; initializedCurrentBlockerCount: number; uninitializedBlockerCount: number; actions: ReadinessAction[] };
type Operator = { id: string; email: string; fullName: string | null; current: boolean };
type ActionEvent = { id: string; eventType: string; fromState: string | null; toState: string; ownerUserId: string | null; dueAt: string | null; notes: string; actionVersion: number; createdAt: string };

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function localDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The readiness action could not be saved.";
  const start = error.message.indexOf("{");
  if (start >= 0) {
    try { return JSON.parse(error.message.slice(start)).message || error.message; } catch {}
  }
  return error.message;
}

export function ProductionReadinessActionQueue({ onReadinessChanged }: { onReadinessChanged: () => void | Promise<unknown> }) {
  const queue = useQuery<ActionQueue>({ queryKey: ["/api/platform/readiness/actions"], queryFn: async () => (await apiRequest<Response>("GET", "/api/platform/readiness/actions")).json() });
  const operators = useQuery<Operator[]>({ queryKey: ["/api/platform/operators"] });
  const [selectedKey, setSelectedKey] = useState("");
  const selected = queue.data?.actions.find((action) => action.blockerKey === selectedKey) || null;
  const [form, setForm] = useState<{ operatorState: OperatorState; ownerUserId: string; dueAt: string; notes: string }>({ operatorState: "unassigned", ownerUserId: "", dueAt: "", notes: "" });
  const events = useQuery<ActionEvent[]>({
    queryKey: ["/api/platform/readiness/actions", selectedKey, "events"],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/platform/readiness/actions/${encodeURIComponent(selectedKey)}/events`)).json(),
    enabled: Boolean(selectedKey),
  });

  const active = useMemo(() => queue.data?.actions.filter((action) => action.currentBlocker) || [], [queue.data]);
  useEffect(() => {
    if (!selectedKey || !queue.data?.actions.some((action) => action.blockerKey === selectedKey)) setSelectedKey(active[0]?.blockerKey || queue.data?.actions[0]?.blockerKey || "");
  }, [active, queue.data, selectedKey]);
  useEffect(() => {
    if (!selected) return;
    setForm({ operatorState: selected.operatorState, ownerUserId: selected.ownerUserId || "", dueAt: selected.dueAt ? localDateTime(new Date(selected.dueAt)) : "", notes: selected.notes || "" });
  }, [selected?.blockerKey, selected?.version]);

  const refresh = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", "/api/platform/readiness/actions/refresh", {})).json(),
    onSuccess: async () => { await Promise.all([queue.refetch(), onReadinessChanged()]); },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a readiness action first.");
      return (await apiRequest<Response>("PUT", `/api/platform/readiness/actions/${encodeURIComponent(selected.blockerKey)}`, {
        expectedVersion: selected.version,
        operatorState: form.operatorState,
        ownerUserId: form.operatorState === "unassigned" ? null : form.ownerUserId,
        dueAt: form.operatorState === "unassigned" ? null : new Date(form.dueAt).toISOString(),
        notes: form.notes,
      })).json();
    },
    onSuccess: async () => { await Promise.all([queue.refetch(), events.refetch()]); },
  });

  const setState = (operatorState: OperatorState) => {
    if (operatorState === "unassigned") return setForm({ operatorState, ownerUserId: "", dueAt: "", notes: form.notes });
    const currentOperator = operators.data?.find((operator) => operator.current) || operators.data?.[0];
    setForm((current) => ({ ...current, operatorState, ownerUserId: current.ownerUserId || currentOperator?.id || "", dueAt: current.dueAt || localDateTime(new Date(Date.now() + 7 * 86_400_000)) }));
  };
  const canSave = Boolean(selected && (form.operatorState === "unassigned" || (form.ownerUserId && form.dueAt && (form.operatorState !== "waiting_external" || form.notes.trim().length >= 10))));
  const assignedCount = active.filter((action) => action.operatorState !== "unassigned").length;
  const waitingCount = active.filter((action) => action.operatorState === "waiting_external").length;

  if (queue.isLoading) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;
  if (queue.isError || !queue.data) return <Card className="rounded-[1.5rem] border-destructive/20 p-6"><h2 className="font-semibold">Closure queue unavailable</h2><p className="mt-2 text-sm text-muted-foreground">EOS will not infer ownership while the readiness queue is unavailable.</p><Button className="mt-4" variant="outline" onClick={() => queue.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></Card>;

  return <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><ListChecks className="mt-0.5 h-5 w-5 text-primary"/><div><h2 className="text-xl font-semibold">Production closure queue</h2><p className="mt-1 text-sm text-muted-foreground">Assign and time-box real blockers. An action state never passes a readiness control; only the underlying evidence predicate can remove it.</p></div></div><Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}Refresh blockers</Button></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current blockers</p><p className="mt-2 text-lg font-semibold">{queue.data.currentBlockerCount}</p></div><div className="rounded-2xl bg-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Assigned</p><p className="mt-2 text-lg font-semibold">{assignedCount}</p></div><div className="rounded-2xl bg-muted p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Waiting externally</p><p className="mt-2 text-lg font-semibold">{waitingCount}</p></div></div>
    {queue.data.uninitializedBlockerCount > 0 && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">{queue.data.uninitializedBlockerCount} blocker{queue.data.uninitializedBlockerCount === 1 ? " is" : "s are"} not yet in the operator queue.</p><p className="mt-1">Refresh blockers to initialize append-only action history without asserting readiness.</p></div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">{queue.data.actions.length ? queue.data.actions.map((action) => <button type="button" key={action.blockerKey} onClick={() => setSelectedKey(action.blockerKey)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedKey === action.blockerKey ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/60"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Layer {action.layer} · {titleCase(action.blockerType)}</p><p className="mt-1 font-medium">{action.title}</p></div><Badge variant={action.currentBlocker ? "outline" : "secondary"}>{action.currentBlocker ? titleCase(action.operatorState) : "Predicate resolved"}</Badge></div><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{action.nextAction}</p></button>) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No actions are initialized. Refresh blockers to create the current queue.</p>}</div>
      {selected ? <div className="rounded-2xl border p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Layer {selected.layer} · {titleCase(selected.evidenceClass)}</p><h3 className="mt-1 font-semibold">{selected.title}</h3></div><Badge variant={selected.currentBlocker ? "outline" : "secondary"}>{selected.currentBlocker ? "Current blocker" : "Predicate resolved"}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{selected.nextAction}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Operator state</Label><Select value={form.operatorState} onValueChange={(value) => setState(value as OperatorState)}><SelectTrigger aria-label="Readiness action state"><SelectValue/></SelectTrigger><SelectContent>{["unassigned","planned","in_progress","waiting_external"].map((value) => <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Accountable operator</Label><Select value={form.ownerUserId} onValueChange={(ownerUserId) => setForm((current) => ({ ...current, ownerUserId }))} disabled={form.operatorState === "unassigned"}><SelectTrigger aria-label="Readiness action owner"><SelectValue placeholder="Choose an operator"/></SelectTrigger><SelectContent>{operators.data?.map((operator) => <SelectItem key={operator.id} value={operator.id}>{operator.fullName || operator.email}{operator.current ? " · you" : ""}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="mt-4 space-y-2"><Label htmlFor="readiness-action-due">Due date</Label><Input id="readiness-action-due" type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} disabled={form.operatorState === "unassigned"}/></div>
        <div className="mt-4 space-y-2"><Label htmlFor="readiness-action-notes">Dependency and execution notes</Label><Textarea id="readiness-action-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={2000} placeholder="Exact next step, external dependency, handoff, and evidence expected."/></div>
        <Button className="mt-4" onClick={() => save.mutate()} disabled={!canSave || save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Save operator plan</Button>{save.isSuccess && <p className="mt-3 text-sm text-emerald-700">Plan saved. The readiness predicate remains independently enforced.</p>}{save.isError && <p role="alert" className="mt-3 text-sm text-destructive">{errorMessage(save.error)}</p>}
        <div className="mt-6 border-t pt-4"><h4 className="flex items-center gap-2 font-medium"><CircleDot className="h-4 w-4"/>Immutable action history</h4>{events.isLoading ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-muted"/> : events.data?.length ? <div className="mt-3 space-y-2">{events.data.slice(0,5).map((event) => <div key={event.id} className="rounded-xl bg-muted p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">v{event.actionVersion} · {titleCase(event.eventType)}</span><span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span></div><div className="mt-2 flex flex-wrap gap-3 text-muted-foreground">{event.ownerUserId && <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3"/>{operators.data?.find((operator) => operator.id === event.ownerUserId)?.fullName || "Assigned operator"}</span>}{event.dueAt && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3"/>{new Date(event.dueAt).toLocaleString()}</span>}</div>{event.notes && <p className="mt-2 text-muted-foreground">{event.notes}</p>}</div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No history is available.</p>}</div>
      </div> : <div className="rounded-2xl border p-5 text-sm text-muted-foreground">Choose an initialized blocker to plan its closure.</div>}
    </div>
    <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ExternalLink className="h-3.5 w-3.5"/>Resolved predicates remain visible as history; they cannot be reopened or closed by editing narrative state.</p>
  </Card>;
}
