import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Bot, Brain, CheckCircle2, Eye, Play, RefreshCw, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Json = Record<string, any>;

async function request<T>(method: "GET" | "POST" | "PATCH", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

const interactionSteps = ["See", "Zoom", "Select", "Inspect", "Ask", "Compare", "Simulate", "Enter", "Act", "Observe", "Learn"] as const;

export function NativeOperatingControlCenter({
  root,
  processes,
  seats,
  authoritySubjects,
  canExecute,
  canDecide,
  isFounder,
  onAsk,
}: {
  root: string;
  processes: Json[];
  seats: Json[];
  authoritySubjects: Json[];
  canExecute: boolean;
  canDecide: boolean;
  isFounder: boolean;
  onAsk: (message: string) => void;
}) {
  const cache = useQueryClient();
  const [instrumentStep, setInstrumentStep] = useState<(typeof interactionSteps)[number]>("See");
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [executionMode, setExecutionMode] = useState("manual");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [transitionNote, setTransitionNote] = useState("Advance this governed run while preserving its process, authority, approval, and evidence contract.");
  const [evidenceId, setEvidenceId] = useState("");
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [advisorContext, setAdvisorContext] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleSubjectId, setScheduleSubjectId] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState("daily");

  const runtime = useQuery<Json>({ queryKey: [root, "workflow-runtime"], queryFn: () => request("GET", `${root}/workflow-runtime`) });
  const agents = useQuery<Json>({ queryKey: [root, "agent-runtime"], queryFn: () => request("GET", `${root}/agent-runtime`) });
  const handoffs = useQuery<Json>({ queryKey: [root, "native-handoffs"], queryFn: () => request("GET", `${root}/native-handoffs`) });
  const council = useQuery<Json>({ queryKey: [root, "advisor-deliberations"], queryFn: () => request("GET", `${root}/advisor-deliberations`), enabled: isFounder });
  const selectedRun = (runtime.data?.runs || []).find((run: Json) => run.id === selectedRunId) || runtime.data?.runs?.[0];
  const releasedProcesses = processes.filter((process) => process.releaseState === "released" && ["implemented", "pre_live_qualified", "field_qualified"].includes(process.qualificationState));
  const selectedProcess = releasedProcesses.find((process) => process.id === selectedProcessId);
  const scheduleSubject = authoritySubjects.find((subject) => subject.id === scheduleSubjectId);
  const scheduleSeat = seats.find((seat) => seat.id === scheduleSubject?.seatId);

  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: [root, "workflow-runtime"] }),
      cache.invalidateQueries({ queryKey: [root, "agent-runtime"] }),
      cache.invalidateQueries({ queryKey: [root, "native-handoffs"] }),
      cache.invalidateQueries({ queryKey: [root, "advisor-deliberations"] }),
    ]);
  };

  const createRun = useMutation({
    mutationFn: (simulation: boolean) => request<Json>("POST", `${root}/workflow-runs`, {
      processDefinitionId: selectedProcessId,
      executionMode: simulation ? "manual" : executionMode,
      idempotencyKey: `ui:${simulation ? "simulation" : "run"}:${crypto.randomUUID()}`,
      input: { source: "native_operating_instrument", simulation, externalEffectsPermitted: false },
      classification: "confidential",
    }),
    onSuccess: async (run) => { setSelectedRunId(run.id); setInstrumentStep("Observe"); await refresh(); },
  });
  const transition = useMutation({
    mutationFn: (action: string) => request<Json>("POST", `${root}/workflow-runs/${selectedRun.id}/transition`, {
      expectedVersion: selectedRun.version,
      action,
      note: transitionNote,
      output: action === "complete" ? { operatorSummary: transitionNote } : {},
      evidenceIds: evidenceId ? [evidenceId] : [],
      blocker: ["block", "fail"].includes(action) ? transitionNote : "",
    }),
    onSuccess: async () => { setInstrumentStep("Observe"); await refresh(); },
  });
  const createDeliberation = useMutation({
    mutationFn: () => request<Json>("POST", `${root}/advisor-deliberations`, { question: advisorQuestion, decisionContext: advisorContext, panelMode: "full_council", requestedAdvisorIds: [], evidenceIds: [], classification: "restricted" }),
    onSuccess: async () => { setAdvisorQuestion(""); setAdvisorContext(""); setInstrumentStep("Compare"); await refresh(); },
  });
  const advanceDeliberation = useMutation({
    mutationFn: (id: string) => request<Json>("POST", `${root}/advisor-deliberations/${id}/advance`, {}),
    onSuccess: refresh,
  });
  const createSchedule = useMutation({
    mutationFn: () => {
      if (!scheduleSeat) throw new Error("Choose a verified Role Agent with an active seat.");
      const now = new Date(); now.setUTCDate(now.getUTCDate() + 1);
      return request<Json>("POST", `${root}/agent-schedules`, {
        scheduleKey: `schedule-${scheduleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`,
        name: scheduleName,
        seatId: scheduleSeat.id,
        authoritySubjectId: scheduleSubjectId,
        processDefinitionId: selectedProcessId,
        triggerKind: scheduleCadence === "manual" ? "manual" : "schedule",
        cadence: scheduleCadence,
        eventTypes: [],
        executionMode: scheduleSeat?.occupantUserId ? "assisted" : "autonomous",
        inputTemplate: { source: "native_operating_instrument" },
        ...(scheduleCadence === "manual" ? {} : { nextRunAt: now.toISOString() }),
        maxRunsPerDay: 24,
        evaluationRequired: true,
        classification: "confidential",
      });
    },
    onSuccess: async () => { setScheduleName(""); await refresh(); },
  });
  const scheduleTransition = useMutation({
    mutationFn: (schedule: Json) => request<Json>("PATCH", `${root}/agent-schedules/${schedule.id}/state`, { expectedVersion: schedule.version, state: schedule.state === "active" ? "paused" : "active", rationale: "The operator reviewed the exact seat, Authority Subject, released process, execution mode, cadence, and runtime limits." }),
    onSuccess: refresh,
  });

  const error = [runtime.error, agents.error, handoffs.error, council.error, createRun.error, transition.error, createDeliberation.error, advanceDeliberation.error, createSchedule.error, scheduleTransition.error].find(Boolean);
  const handoffCounts = handoffs.data?.gapCounts || { P0: 0, P1: 0, P2: 0 };
  const activeDeliberation = council.data?.deliberations?.find((item: Json) => !["decided", "calibrated", "failed"].includes(item.state));
  const availableSubjects = useMemo(() => authoritySubjects.filter((subject) => subject.subjectType === "agent" && subject.status === "active" && subject.verificationStatus === "verified" && subject.seatId), [authoritySubjects]);

  return (
    <Card className="border-primary/20 shadow-[0_10px_34px_rgba(106,55,212,0.08)]">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Badge variant="secondary">Native control</Badge><Badge variant="outline">No silent execution</Badge></div>
          <CardTitle className="mt-3">Operating instrument</CardTitle>
          <CardDescription className="mt-2 max-w-3xl">Move from signal to governed action without leaving the workspace. Every run binds an exact process, seat, authority decision, event history, and evidence boundary.</CardDescription>
        </div>
        <Button size="icon" variant="outline" onClick={() => void refresh()} aria-label="Refresh native operating state"><RefreshCw className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Canonical operating interaction">
          {interactionSteps.map((step) => <Button key={step} size="sm" variant={instrumentStep === step ? "default" : "outline"} onClick={() => setInstrumentStep(step)}>{step}</Button>)}
        </div>
        {error && <Alert variant="destructive"><AlertTitle>Native control needs attention</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "Refresh and retry the governed action."}</AlertDescription></Alert>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Fact icon={Workflow} label="Runs" value={String(runtime.data?.runs?.length || 0)} />
          <Fact icon={Bot} label="Active agents" value={String(agents.data?.counts?.active || 0)} />
          <Fact icon={ShieldCheck} label="P0 handoff gaps" value={String(handoffCounts.P0 || 0)} />
          <Fact icon={Brain} label="Deliberations" value={String(council.data?.deliberations?.length || 0)} />
          <Fact icon={Activity} label="Needs review" value={String(agents.data?.counts?.needsReview || 0)} />
        </div>

        <Tabs defaultValue="runs">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4"><TabsTrigger value="runs">Runs</TabsTrigger><TabsTrigger value="agents">Role Agents</TabsTrigger><TabsTrigger value="handoffs">Handoffs</TabsTrigger><TabsTrigger value="council" disabled={!isFounder}>Council</TabsTrigger></TabsList>
          <TabsContent value="runs" className="space-y-4 pt-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto]">
              <select aria-label="Released process" className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedProcessId} onChange={(event) => setSelectedProcessId(event.target.value)}><option value="">Choose a released process</option>{releasedProcesses.map((process) => <option key={process.id} value={process.id}>{process.name} · v{process.version}</option>)}</select>
              <select aria-label="Workflow execution mode" className="h-10 rounded-md border bg-background px-3 text-sm" value={executionMode} onChange={(event) => setExecutionMode(event.target.value)}><option value="manual">Manual</option><option value="assisted">Assisted</option><option value="autonomous">Autonomous</option></select>
              <Button variant="outline" disabled={!selectedProcess || createRun.isPending || !canExecute} onClick={() => createRun.mutate(true)}><Sparkles className="mr-2 h-4 w-4" />Simulate</Button>
              <Button disabled={!selectedProcess || createRun.isPending || !canExecute} onClick={() => createRun.mutate(false)}><Play className="mr-2 h-4 w-4" />Enter run</Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">{(runtime.data?.runs || []).map((run: Json) => <button key={run.id} type="button" onClick={() => setSelectedRunId(run.id)} className={`w-full rounded-xl border p-3 text-left ${selectedRun?.id === run.id ? "border-primary bg-primary/5" : ""}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{run.runKey}</span><Badge variant="outline">{run.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{run.executionMode} · v{run.version}</p></button>)}</div>
              {selectedRun ? <div className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center gap-2"><Badge>{selectedRun.state}</Badge><Badge variant="outline">{selectedRun.executionMode}</Badge><span className="text-xs text-muted-foreground">Step {selectedRun.currentStep}</span></div><Textarea value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} aria-label="Run transition note" /><Input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} placeholder="Verified Evidence ID when required" /><div className="flex flex-wrap gap-2">{selectedRun.state === "queued" && <Button disabled={!canExecute || transition.isPending} onClick={() => transition.mutate("start")}>Start</Button>}{["waiting_input", "waiting_approval", "blocked", "failed"].includes(selectedRun.state) && <Button disabled={!canExecute || transition.isPending} onClick={() => transition.mutate("resume")}>Resume</Button>}{selectedRun.state === "running" && <><Button disabled={!canDecide || transition.isPending} onClick={() => transition.mutate("complete")}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button><Button variant="outline" disabled={!canExecute || transition.isPending} onClick={() => transition.mutate("block")}>Block</Button></>}</div><div className="space-y-2 border-t pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Immutable event trail</p>{(selectedRun.events || []).map((event: Json) => <div key={event.id} className="flex items-center justify-between gap-3 text-xs"><span>{event.sequence}. {event.action}</span><span className="text-muted-foreground">{event.fromState} → {event.toState}</span></div>)}</div></div> : <Empty text="Select a run to inspect and act." />}
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4 pt-4">
            <div className="grid gap-3 lg:grid-cols-4"><Input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="Schedule name" /><select aria-label="Scheduled role agent" className="h-10 rounded-md border bg-background px-3 text-sm" value={scheduleSubjectId} onChange={(event) => setScheduleSubjectId(event.target.value)}><option value="">Choose verified Role Agent</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.displayName}</option>)}</select><select aria-label="Schedule cadence" className="h-10 rounded-md border bg-background px-3 text-sm" value={scheduleCadence} onChange={(event) => setScheduleCadence(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="manual">Manual</option></select><Button disabled={!canDecide || !scheduleName || !scheduleSubject || !selectedProcessId || createSchedule.isPending} onClick={() => createSchedule.mutate()}>Create schedule</Button></div>
            <div className="grid gap-3 md:grid-cols-2">{(agents.data?.schedules || []).map((schedule: Json) => <div key={schedule.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{schedule.name}</p><p className="mt-1 text-xs text-muted-foreground">{schedule.cadence} · {schedule.executionMode}</p></div><Badge variant="outline">{schedule.state}</Badge></div><Button className="mt-4" size="sm" variant="outline" disabled={!canDecide || schedule.state === "retired" || scheduleTransition.isPending} onClick={() => scheduleTransition.mutate(schedule)}>{schedule.state === "active" ? "Pause" : "Activate"}</Button></div>)}</div>
          </TabsContent>

          <TabsContent value="handoffs" className="space-y-3 pt-4">{(handoffs.data?.handoffs || []).map((handoff: Json) => <div key={handoff.capabilityInstanceId} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{handoff.capabilityName}</p><p className="mt-1 text-xs text-muted-foreground">{handoff.capabilityKey} · {handoff.sections.length} handoff sections</p></div><Badge variant={handoff.gaps.length ? "outline" : "default"}>{handoff.readiness.replaceAll("_", " ")}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="destructive">{handoff.gaps.filter((gap: Json) => gap.severity === "P0").length} P0</Badge><Badge variant="secondary">{handoff.gaps.filter((gap: Json) => gap.severity === "P1").length} P1</Badge><Badge variant="outline">{handoff.gaps.filter((gap: Json) => gap.severity === "P2").length} P2</Badge></div></div>)}</TabsContent>

          <TabsContent value="council" className="space-y-4 pt-4"><div className="grid gap-3"><Input value={advisorQuestion} onChange={(event) => setAdvisorQuestion(event.target.value)} placeholder="Decision question for the fifteen-seat council" /><Textarea value={advisorContext} onChange={(event) => setAdvisorContext(event.target.value)} placeholder="Decision context, constraints, options, timing, and what remains uncertain" /><div className="flex flex-wrap gap-2"><Button disabled={!canDecide || advisorQuestion.length < 20 || advisorContext.length < 20 || createDeliberation.isPending} onClick={() => createDeliberation.mutate()}>Open full-council deliberation</Button><Button variant="outline" onClick={() => onAsk(`Help me frame this decision for the advisor council: ${advisorQuestion || "the current operating decision"}`)}><Eye className="mr-2 h-4 w-4" />Ask EA to frame</Button></div></div>{activeDeliberation && <div className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{activeDeliberation.question}</p><p className="mt-1 text-xs text-muted-foreground">{activeDeliberation.advisorIds.length} advisors · v{activeDeliberation.version}</p></div><Badge>{activeDeliberation.state.replaceAll("_", " ")}</Badge></div>{["draft", "independent_complete", "rebuttal_complete", "revision_complete"].includes(activeDeliberation.state) && <Button className="mt-4" disabled={advanceDeliberation.isPending} onClick={() => advanceDeliberation.mutate(activeDeliberation.id)}>Advance next deliberation round</Button>}{activeDeliberation.synthesis && <p className="mt-4 whitespace-pre-wrap text-sm">{activeDeliberation.synthesis}</p>}</div>}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Workflow; label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><Icon className="h-4 w-4 text-primary" /><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>; }
