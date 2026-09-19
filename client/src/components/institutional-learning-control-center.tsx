import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, CheckCircle2, ClipboardCheck, GraduationCap, Plus, RefreshCw, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Row = Record<string, any>;
type MemoryDraft = {
  memoryKey: string;
  kind: string;
  title: string;
  content: string;
  supersedesMemoryId: string;
};

const splitLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const commandKey = (prefix: string) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

async function request<T>(method: "GET" | "POST" | "PATCH", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

function proposalMemoryDraft(proposal: Row): MemoryDraft {
  return {
    memoryKey: `learning-${String(proposal.id || "").slice(0, 24)}`,
    kind: "lesson",
    title: String(proposal.title || "").slice(0, 300),
    content: String(proposal.proposal || ""),
    supersedesMemoryId: "",
  };
}

/**
 * Institutional memory deliberately cannot be written as a convenient note.
 * A postmortem may propose a lesson; a role with decision authority reviews
 * it; only the founder can promote the accepted proposal into canonical memory.
 */
export function InstitutionalLearningControlCenter({
  root,
  canExecute,
  canDecide,
  isFounder,
}: {
  root: string;
  canExecute: boolean;
  canDecide: boolean;
  isFounder: boolean;
}) {
  const cache = useQueryClient();
  const intelligence = useQuery<Row>({
    queryKey: [root, "institutional-intelligence"],
    queryFn: () => request("GET", `${root}/institutional-intelligence`),
  });
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("failed_workflow");
  const [eventReference, setEventReference] = useState("");
  const [summary, setSummary] = useState("");
  const [impact, setImpact] = useState("");
  const [timeline, setTimeline] = useState("");
  const [rootCauses, setRootCauses] = useState("");
  const [correctiveActions, setCorrectiveActions] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [reviewRationale, setReviewRationale] = useState<Record<string, string>>({});
  const [proposalTitle, setProposalTitle] = useState<Record<string, string>>({});
  const [proposalText, setProposalText] = useState<Record<string, string>>({});
  const [memoryDrafts, setMemoryDrafts] = useState<Record<string, MemoryDraft>>({});

  const refresh = () => cache.invalidateQueries({ queryKey: [root, "institutional-intelligence"] });
  const postmortems = intelligence.data?.postmortems || [];
  const proposals = intelligence.data?.learningProposals || [];
  const memories = intelligence.data?.memories || [];
  const currentMemories = useMemo(() => memories.filter((item: Row) => item.current), [memories]);

  const createPostmortem = useMutation({
    mutationFn: () => request("POST", `${root}/postmortems`, {
      title: title.trim(), eventType, eventReference: eventReference.trim(),
      summary: summary.trim(), impact: impact.trim(),
      timeline: splitLines(timeline).map((entry, index) => ({ order: index + 1, entry })),
      contributingFactors: [], rootCauses: splitLines(rootCauses),
      correctiveActions: splitLines(correctiveActions).map((action, index) => ({ id: `action-${index + 1}`, action })),
      evidenceIds: evidenceId.trim() ? [evidenceId.trim()] : [], classification: "confidential",
      idempotencyKey: commandKey("postmortem-create"),
    }),
    onSuccess: async () => {
      setTitle(""); setEventReference(""); setSummary(""); setImpact(""); setTimeline("");
      setRootCauses(""); setCorrectiveActions(""); setEvidenceId(""); await refresh();
    },
  });
  const transitionPostmortem = useMutation({
    mutationFn: ({ record, state }: { record: Row; state: string }) => {
      const rationale = (reviewRationale[record.id] || "").trim();
      const proposedTitle = (proposalTitle[record.id] || "").trim();
      const proposedText = (proposalText[record.id] || "").trim();
      return request("PATCH", `${root}/postmortems/${record.id}`, {
        state, rationale,
        ...(state === "accepted" && proposedTitle && proposedText
          ? { learningProposal: { title: proposedTitle, proposal: proposedText, targetType: "memory", targetReference: record.id } }
          : {}),
      });
    },
    onSuccess: refresh,
  });
  const decideProposal = useMutation({
    mutationFn: ({ proposal, state }: { proposal: Row; state: string }) => request("PATCH", `${root}/learning-proposals/${proposal.id}`, {
      state,
      rationale: (reviewRationale[`proposal:${proposal.id}`] || "").trim(),
    }),
    onSuccess: refresh,
  });
  const implementMemory = useMutation({
    mutationFn: (proposal: Row) => {
      const draft = memoryDrafts[proposal.id] || proposalMemoryDraft(proposal);
      return request("PATCH", `${root}/learning-proposals/${proposal.id}`, {
        state: "implemented",
        rationale: (reviewRationale[`proposal:${proposal.id}`] || "").trim(),
        memory: {
          memoryKey: draft.memoryKey.trim(), kind: draft.kind, title: draft.title.trim(), content: draft.content.trim(),
          validFrom: new Date().toISOString(),
          ...(draft.supersedesMemoryId ? { supersedesMemoryId: draft.supersedesMemoryId } : {}),
        },
      });
    },
    onSuccess: async () => { setMemoryDrafts({}); await refresh(); },
  });
  const error = [intelligence.error, createPostmortem.error, transitionPostmortem.error, decideProposal.error, implementMemory.error].find(Boolean);
  const validPostmortem = title.trim().length >= 3 && summary.trim().length >= 30 && impact.trim().length >= 20 && splitLines(timeline).length > 0;

  return <Card data-testid="institutional-learning-control-center">
    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Institutional learning</CardTitle>
        <CardDescription className="mt-1">Convert evidence-bearing operating experience into reviewed organizational memory. A draft, agent, or simulation never becomes canon by itself.</CardDescription>
      </div>
      <Button size="sm" variant="outline" onClick={() => intelligence.refetch()} disabled={intelligence.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${intelligence.isFetching ? "animate-spin" : ""}`}/>Refresh</Button>
    </CardHeader>
    <CardContent className="space-y-6">
      {error && <Alert variant="destructive"><AlertTitle>Learning command not applied</AlertTitle><AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription></Alert>}
      <section className="rounded-xl border p-4">
        <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary"/><h3 className="font-semibold">Create a bounded postmortem</h3></div>
        <p className="mt-1 text-sm text-muted-foreground">Record what happened, its impact, and the reviewable corrective path. Creating this record does not change a process, policy, or memory.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Postmortem title" aria-label="Postmortem title"/>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={eventType} onChange={(event) => setEventType(event.target.value)} aria-label="Postmortem event type">{["incident", "failed_workflow", "missed_outcome", "provider_failure", "security", "customer", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <Input value={eventReference} onChange={(event) => setEventReference(event.target.value)} placeholder="Work packet, provider, or event reference (optional)" className="md:col-span-2"/>
          <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What happened? Include enough factual context for an accountable reviewer."/>
          <Textarea value={impact} onChange={(event) => setImpact(event.target.value)} placeholder="What was the operational, customer, financial, or risk impact?"/>
          <Textarea value={timeline} onChange={(event) => setTimeline(event.target.value)} placeholder="One timeline event per line"/>
          <Textarea value={rootCauses} onChange={(event) => setRootCauses(event.target.value)} placeholder="One root cause per line (required before acceptance)"/>
          <Textarea value={correctiveActions} onChange={(event) => setCorrectiveActions(event.target.value)} placeholder="One corrective action per line (required before acceptance)"/>
          <Input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} placeholder="Company Evidence ID (recommended; required for acceptance)"/>
        </div>
        <Button className="mt-3" disabled={!canExecute || !validPostmortem || createPostmortem.isPending} onClick={() => createPostmortem.mutate()}><Plus className="mr-2 h-4 w-4"/>{createPostmortem.isPending ? "Recording…" : "Record postmortem"}</Button>
      </section>

      <section className="space-y-3">
        <div><p className="eos-label">Review queue</p><h3 className="mt-1 font-semibold">Postmortems and proposed learning</h3></div>
        {postmortems.map((record: Row) => {
          const rationale = reviewRationale[record.id] || "";
          const hasAcceptanceInputs = Array.isArray(record.evidenceIds) && record.evidenceIds.length > 0 && Array.isArray(record.rootCauses) && record.rootCauses.length > 0 && Array.isArray(record.correctiveActions) && record.correctiveActions.length > 0;
          return <div key={record.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{record.title}</p><p className="mt-1 text-xs text-muted-foreground">{String(record.eventType).replaceAll("_", " ")} · {new Date(record.createdAt).toLocaleString()}</p></div><Badge variant={record.state === "accepted" ? "default" : record.state === "rejected" ? "secondary" : "outline"}>{record.state}</Badge></div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{record.summary}</p>
            {record.state === "draft" && <div className="mt-4 space-y-2 border-t pt-3"><Textarea value={rationale} onChange={(event) => setReviewRationale((value) => ({ ...value, [record.id]: event.target.value }))} placeholder="Why this record is ready for accountable review"/><Button size="sm" variant="outline" disabled={!canExecute || rationale.trim().length < 20 || transitionPostmortem.isPending} onClick={() => transitionPostmortem.mutate({ record, state: "review" })}>Submit for review</Button></div>}
            {record.state === "review" && <div className="mt-4 space-y-3 border-t pt-3"><Textarea value={rationale} onChange={(event) => setReviewRationale((value) => ({ ...value, [record.id]: event.target.value }))} placeholder="Accountable decision rationale"/><Input value={proposalTitle[record.id] || ""} onChange={(event) => setProposalTitle((value) => ({ ...value, [record.id]: event.target.value }))} placeholder="Optional institutional learning title"/><Textarea value={proposalText[record.id] || ""} onChange={(event) => setProposalText((value) => ({ ...value, [record.id]: event.target.value }))} placeholder="Optional proposed lesson for founder review; this is not memory yet"/><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!canDecide || !hasAcceptanceInputs || rationale.trim().length < 20 || transitionPostmortem.isPending} onClick={() => transitionPostmortem.mutate({ record, state: "accepted" })}><CheckCircle2 className="mr-2 h-4 w-4"/>Accept review</Button><Button size="sm" variant="outline" disabled={!canDecide || rationale.trim().length < 20 || transitionPostmortem.isPending} onClick={() => transitionPostmortem.mutate({ record, state: "rejected" })}><XCircle className="mr-2 h-4 w-4"/>Reject</Button></div>{!hasAcceptanceInputs && <p className="text-xs text-muted-foreground">Acceptance needs company Evidence, at least one root cause, and at least one corrective action.</p>}</div>}
          </div>;
        })}
        {!postmortems.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No postmortems have been recorded in this authority scope.</p>}
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-primary"/><h3 className="font-semibold">Founder memory promotion</h3></div><p className="mt-1 text-sm text-muted-foreground">Only accepted proposals are eligible. Promotion records a reviewed memory with a source, validity time, and optional same-kind supersession.</p></div><Badge variant="outline">{currentMemories.length} current</Badge></div>
        {!isFounder && <Alert><AlertTitle>Founder review required</AlertTitle><AlertDescription>You can contribute governed learning, but the company founder is the only role that can accept or promote institutional memory.</AlertDescription></Alert>}
        {proposals.map((proposal: Row) => {
          const key = `proposal:${proposal.id}`;
          const rationale = reviewRationale[key] || "";
          const draft = memoryDrafts[proposal.id] || proposalMemoryDraft(proposal);
          const updateDraft = (change: Partial<MemoryDraft>) => setMemoryDrafts((value) => ({ ...value, [proposal.id]: { ...draft, ...change } }));
          return <div key={proposal.id} className="rounded-lg border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{proposal.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.proposal}</p></div><Badge variant={proposal.state === "implemented" ? "default" : proposal.state === "rejected" ? "secondary" : "outline"}>{proposal.state}</Badge></div>{proposal.state !== "implemented" && proposal.state !== "rejected" && <div className="mt-4 space-y-3 border-t pt-3"><Textarea value={rationale} onChange={(event) => setReviewRationale((value) => ({ ...value, [key]: event.target.value }))} placeholder="Founder decision rationale"/>{proposal.state === "proposed" && <div className="flex gap-2"><Button size="sm" disabled={!isFounder || !canDecide || rationale.trim().length < 20 || decideProposal.isPending} onClick={() => decideProposal.mutate({ proposal, state: "accepted" })}>Accept proposal</Button><Button size="sm" variant="outline" disabled={!isFounder || !canDecide || rationale.trim().length < 20 || decideProposal.isPending} onClick={() => decideProposal.mutate({ proposal, state: "rejected" })}>Reject proposal</Button></div>}{proposal.state === "accepted" && <div className="grid gap-3 md:grid-cols-2"><Input value={draft.memoryKey} onChange={(event) => updateDraft({ memoryKey: event.target.value })} placeholder="Memory key"/><select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.kind} onChange={(event) => updateDraft({ kind: event.target.value })}>{["fact", "decision", "lesson", "pattern", "policy"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select><Input className="md:col-span-2" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Memory title"/><Textarea className="md:col-span-2" value={draft.content} onChange={(event) => updateDraft({ content: event.target.value })} placeholder="Reviewed canonical memory"/><select className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2" value={draft.supersedesMemoryId} onChange={(event) => updateDraft({ supersedesMemoryId: event.target.value })}><option value="">Do not supersede existing memory</option>{currentMemories.filter((item: Row) => item.kind === draft.kind).map((item: Row) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button size="sm" disabled={!isFounder || !canDecide || rationale.trim().length < 20 || draft.memoryKey.trim().length < 3 || draft.title.trim().length < 3 || draft.content.trim().length < 20 || implementMemory.isPending} onClick={() => implementMemory.mutate(proposal)}><BookOpenCheck className="mr-2 h-4 w-4"/>Promote reviewed memory</Button></div>}</div>}</div>;
        })}
        {!proposals.length && <p className="text-sm text-muted-foreground">No reviewed learning proposals are awaiting founder action.</p>}
        {currentMemories.length > 0 && <div className="border-t pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current institutional memory</p><div className="mt-2 grid gap-2 md:grid-cols-2">{currentMemories.map((memory: Row) => <div key={memory.id} className="rounded-lg border bg-background p-3"><Badge variant="outline">{memory.kind}</Badge><p className="mt-2 text-sm font-medium">{memory.title}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{memory.content}</p></div>)}</div></div>}
      </section>
    </CardContent>
  </Card>;
}
