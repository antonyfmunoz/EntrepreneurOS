import { useEffect, useMemo, useState } from "react";
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
import { nativeAgentEventCatalog, nativeAgentEventLabel } from "@shared/agent-event-catalog";

type Json = Record<string, any>;
type EventRule = { path: string; equals: string };

async function request<T>(method: "GET" | "POST" | "PATCH", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

const interactionSteps = ["See", "Zoom", "Select", "Inspect", "Ask", "Compare", "Simulate", "Enter", "Act", "Observe", "Learn"] as const;

function eventRuleValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function setNestedEventFact(payload: Json, path: string, value: unknown) {
  const segments = path.split(".");
  let current = payload;
  for (const segment of segments.slice(0, -1)) {
    if (!current[segment] || typeof current[segment] !== "object" || Array.isArray(current[segment])) current[segment] = {};
    current = current[segment];
  }
  current[segments[segments.length - 1]] = value;
}

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
  const [scheduleProcessId, setScheduleProcessId] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState("daily");
  const [scheduleEventTypes, setScheduleEventTypes] = useState("");
  const [nativeEventChoice, setNativeEventChoice] = useState("");
  const [scheduleEventRules, setScheduleEventRules] = useState<EventRule[]>([]);
  const [eventRulePath, setEventRulePath] = useState("");
  const [eventRuleEquals, setEventRuleEquals] = useState("");
  const [operatingTab, setOperatingTab] = useState("runs");

  const runtime = useQuery<Json>({ queryKey: [root, "workflow-runtime"], queryFn: () => request("GET", `${root}/workflow-runtime`) });
  const evidence = useQuery<Json[]>({ queryKey: [root, "evidence"], queryFn: () => request("GET", `${root}/evidence`) });
  const agents = useQuery<Json>({ queryKey: [root, "agent-runtime"], queryFn: () => request("GET", `${root}/agent-runtime`) });
  const handoffs = useQuery<Json>({ queryKey: [root, "native-handoffs"], queryFn: () => request("GET", `${root}/native-handoffs`) });
  const council = useQuery<Json>({ queryKey: [root, "advisor-deliberations"], queryFn: () => request("GET", `${root}/advisor-deliberations`), enabled: isFounder });
  const selectedRun = (runtime.data?.runs || []).find((run: Json) => run.id === selectedRunId) || runtime.data?.runs?.[0];
  const selectedRunProcess = selectedRun ? processes.find((process) => process.id === selectedRun.processDefinitionId) : undefined;
  const selectedRunSteps: Json[] = Array.isArray(selectedRunProcess?.procedureSteps) ? selectedRunProcess.procedureSteps : [];
  const currentRunStep = selectedRun && selectedRun.currentStep < selectedRunSteps.length ? selectedRunSteps[selectedRun.currentStep] : null;
  const currentRunHasDeclaredRoute = Boolean(currentRunStep?.actionKind === "condition" && currentRunStep?.onTrueStepId && currentRunStep?.onFalseStepId);
  const releasedProcesses = processes.filter((process) => process.releaseState === "released" && ["implemented", "pre_live_qualified", "field_qualified"].includes(process.qualificationState));
  const selectedProcess = releasedProcesses.find((process) => process.id === selectedProcessId);
  const selectedProcessOwner = selectedProcess ? seats.find((seat) => seat.id === selectedProcess.accountableSeatId) : undefined;
  const selectedProcessHasHumanOwner = Boolean(selectedProcessOwner?.occupantUserId);
  const selectedProcessAllowsAutonomous = Boolean(selectedProcessOwner && !selectedProcessHasHumanOwner && selectedProcessOwner.agentMode === "autonomous");
  const scheduleSubject = authoritySubjects.find((subject) => subject.id === scheduleSubjectId);
  const scheduleSeat = seats.find((seat) => seat.id === scheduleSubject?.seatId);
  const verifiedEvidence = useMemo(
    () => (evidence.data || []).filter((item) => item.verificationState === "verified"),
    [evidence.data],
  );

  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: [root, "workflow-runtime"] }),
      cache.invalidateQueries({ queryKey: [root, "evidence"] }),
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
    mutationFn: ({ action, selectedConditionOutcome }: { action: string; selectedConditionOutcome?: boolean }) => request<Json>("POST", `${root}/workflow-runs/${selectedRun.id}/transition`, {
      expectedVersion: selectedRun.version,
      action,
      note: transitionNote,
      output: action === "complete" ? { operatorSummary: transitionNote } : {},
      evidenceIds: evidenceId ? [evidenceId] : [],
      blocker: ["block", "fail"].includes(action) ? transitionNote : "",
      ...(selectedConditionOutcome === undefined ? {} : { conditionOutcome: selectedConditionOutcome }),
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
      const eventTypes = scheduleEventTypes.split(",").map((value) => value.trim()).filter(Boolean);
      const triggerKind = scheduleCadence === "manual" ? "manual" : scheduleCadence === "event" ? "event" : "schedule";
      if (triggerKind === "event" && !eventTypes.length)
        throw new Error("Add at least one EOS event type before creating an event-triggered Role Agent schedule.");
      const now = new Date(); now.setUTCDate(now.getUTCDate() + 1);
      return request<Json>("POST", `${root}/agent-schedules`, {
        scheduleKey: `schedule-${scheduleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`,
        name: scheduleName,
        seatId: scheduleSeat.id,
        authoritySubjectId: scheduleSubjectId,
        processDefinitionId: scheduleProcessId,
        triggerKind,
        cadence: scheduleCadence,
        eventTypes,
        eventFilter: { all: triggerKind === "event" ? scheduleEventRules.map((rule) => ({ path: rule.path, equals: eventRuleValue(rule.equals) })) : [] },
        executionMode: scheduleExecutionMode,
        inputTemplate: { source: "native_operating_instrument" },
        ...(triggerKind === "schedule" ? { nextRunAt: now.toISOString() } : {}),
        maxRunsPerDay: 24,
        evaluationRequired: true,
        classification: "confidential",
      });
    },
    onSuccess: async () => { setScheduleName(""); setScheduleProcessId(""); setScheduleEventTypes(""); setScheduleEventRules([]); setEventRulePath(""); setEventRuleEquals(""); await refresh(); },
  });
  const scheduleTransition = useMutation({
    mutationFn: (schedule: Json) => request<Json>("PATCH", `${root}/agent-schedules/${schedule.id}/state`, { expectedVersion: schedule.version, state: schedule.state === "active" ? "paused" : "active", rationale: "The operator reviewed the exact seat, Authority Subject, released process, execution mode, cadence, and runtime limits." }),
    onSuccess: refresh,
  });
  const runSchedule = useMutation({
    mutationFn: (schedule: Json) => request<Json>("POST", `${root}/agent-schedules/${schedule.id}/run`, {
      idempotencyKey: `ui:manual-agent-schedule:${schedule.id}:${crypto.randomUUID()}`,
    }),
    onSuccess: async (run) => {
      setSelectedRunId(run.id);
      setInstrumentStep("Observe");
      setOperatingTab("runs");
      await refresh();
    },
  });
  const dispatchScheduleEvent = useMutation({
    mutationFn: (schedule: Json) => {
      const eventType = Array.isArray(schedule.eventTypes) ? schedule.eventTypes[0] : "";
      if (!eventType) throw new Error("This event schedule has no declared EOS event type. Refresh and correct the schedule before testing it.");
      const payload: Json = {
        source: "native_operating_instrument",
        test: true,
        scheduleId: schedule.id,
        externalEffectsPermitted: false,
      };
      const rules = Array.isArray(schedule.eventFilter?.all) ? schedule.eventFilter.all : [];
      for (const rule of rules) {
        if (typeof rule?.path === "string" && (typeof rule.equals === "string" || typeof rule.equals === "number" || typeof rule.equals === "boolean")) setNestedEventFact(payload, rule.path, rule.equals);
      }
      return request<Json>("POST", `${root}/agent-events`, {
        eventType,
        eventId: `ui:role-agent-event-test:${schedule.id}:${crypto.randomUUID()}`,
        payload,
      });
    },
    onSuccess: async (result) => {
      if (result.runIds?.[0]) setSelectedRunId(result.runIds[0]);
      setInstrumentStep("Observe");
      setOperatingTab("runs");
      await refresh();
    },
  });

  const error = [runtime.error, evidence.error, agents.error, handoffs.error, council.error, createRun.error, transition.error, createDeliberation.error, advanceDeliberation.error, createSchedule.error, scheduleTransition.error, runSchedule.error, dispatchScheduleEvent.error].find(Boolean);
  const handoffCounts = handoffs.data?.gapCounts || { P0: 0, P1: 0, P2: 0 };
  const activeDeliberation = council.data?.deliberations?.find((item: Json) => !["decided", "calibrated", "failed"].includes(item.state));
  const availableSubjects = useMemo(() => authoritySubjects.filter((subject) => subject.subjectType === "agent" && subject.status === "active" && subject.verificationStatus === "verified" && subject.seatId), [authoritySubjects]);
  const scheduleProcesses = useMemo(
    () => releasedProcesses.filter((process) => process.accountableSeatId === scheduleSeat?.id),
    [releasedProcesses, scheduleSeat?.id],
  );
  const scheduleProcess = scheduleProcesses.find((process) => process.id === scheduleProcessId);
  const scheduleExecutionMode = scheduleSeat?.occupantUserId ? "assisted" : "autonomous";
  const configuredEventTypes = scheduleEventTypes.split(",").map((value) => value.trim()).filter(Boolean);
  const filterableEventFields = useMemo(() => Array.from(new Set(
    nativeAgentEventCatalog.filter((event) => configuredEventTypes.includes(event.eventType)).flatMap((event) => event.filterFields),
  )), [configuredEventTypes.join(",")]);
  const addEventRule = () => {
    const path = eventRulePath.trim(); const equals = eventRuleEquals.trim();
    if (!path || !equals || scheduleEventRules.some((rule) => rule.path === path)) return;
    setScheduleEventRules((current) => [...current, { path, equals }]);
    setEventRulePath(""); setEventRuleEquals("");
  };
  const addNativeEventType = (eventType: string) => {
    if (!eventType) return;
    setScheduleEventTypes((current) => Array.from(new Set([...current.split(",").map((value) => value.trim()).filter(Boolean), eventType])).join(", "));
    setNativeEventChoice("");
  };
  const scheduleTriggerDescription = scheduleCadence === "event"
    ? configuredEventTypes.length ? `when EOS observes ${configuredEventTypes.join(", ")}` : "when a declared EOS event occurs"
    : scheduleCadence === "manual" ? "only when an authorized operator runs it" : `on a ${scheduleCadence} cadence`;

  useEffect(() => {
    if (executionMode === "assisted" && !selectedProcessHasHumanOwner) setExecutionMode("manual");
    if (executionMode === "autonomous" && !selectedProcessAllowsAutonomous) setExecutionMode("manual");
  }, [executionMode, selectedProcessAllowsAutonomous, selectedProcessHasHumanOwner]);

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

        <Tabs value={operatingTab} onValueChange={setOperatingTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4"><TabsTrigger value="runs">Runs</TabsTrigger><TabsTrigger value="agents">Role Agents</TabsTrigger><TabsTrigger value="handoffs">Handoffs</TabsTrigger><TabsTrigger value="council" disabled={!isFounder}>Council</TabsTrigger></TabsList>
          <TabsContent value="runs" className="space-y-4 pt-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto]">
              <select aria-label="Released process" className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedProcessId} onChange={(event) => setSelectedProcessId(event.target.value)}><option value="">Choose a released process</option>{releasedProcesses.map((process) => <option key={process.id} value={process.id}>{process.name} · v{process.version}</option>)}</select>
              <select aria-label="Workflow execution mode" className="h-10 rounded-md border bg-background px-3 text-sm" value={executionMode} onChange={(event) => setExecutionMode(event.target.value)}><option value="manual">Manual</option><option value="assisted" disabled={!selectedProcessHasHumanOwner}>Assisted</option><option value="autonomous" disabled={!selectedProcessAllowsAutonomous}>Autonomous</option></select>
              <Button variant="outline" disabled={!selectedProcess || createRun.isPending || !canExecute} onClick={() => createRun.mutate(true)}><Sparkles className="mr-2 h-4 w-4" />Simulate</Button>
              <Button disabled={!selectedProcess || createRun.isPending || !canExecute} onClick={() => createRun.mutate(false)}><Play className="mr-2 h-4 w-4" />Enter run</Button>
            </div>
            {selectedProcess && <p className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Execution boundary:</span> {selectedProcessHasHumanOwner ? `${selectedProcessOwner?.agentName || "The role agent"} is this human-led role's assistant, so assisted work is available and autonomous work is not.` : selectedProcessAllowsAutonomous ? `${selectedProcessOwner?.agentName || "The accountable role agent"} owns this vacant role, so autonomous work is available.` : "This process has no active autonomous role agent. Run it manually until its accountable seat is configured."}</p>}
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">{(runtime.data?.runs || []).map((run: Json) => <button key={run.id} type="button" onClick={() => setSelectedRunId(run.id)} className={`w-full rounded-xl border p-3 text-left ${selectedRun?.id === run.id ? "border-primary bg-primary/5" : ""}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{run.runKey}</span><Badge variant="outline">{run.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{run.executionMode} · v{run.version}</p></button>)}</div>
              {selectedRun ? <div className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center gap-2"><Badge>{selectedRun.state}</Badge><Badge variant="outline">{selectedRun.executionMode}</Badge><span className="text-xs text-muted-foreground">Step {Math.min((selectedRun.currentStep || 0) + 1, Math.max(selectedRunSteps.length, 1))} of {selectedRunSteps.length || "?"}</span></div>{selectedRunSteps.length > 0 && <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bound process steps</p><div className="mt-2 space-y-2">{selectedRunSteps.map((step, index) => <div key={step.id || index} className={`rounded-md px-2 py-1.5 text-xs ${index < selectedRun.currentStep ? "bg-emerald-50 text-emerald-900" : index === selectedRun.currentStep ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><span className="mr-2 font-semibold">{index < selectedRun.currentStep ? "✓" : index + 1}.</span>{step.title}</div>)}</div>{currentRunStep && <p className="mt-3 text-xs text-muted-foreground">Now: {currentRunStep.instructions} · Complete when: {currentRunStep.completionCriteria}</p>}</div>}<Textarea value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} aria-label="Run transition note" /><div><select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} aria-label="Verified workflow evidence" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Attach verified evidence when this action requires it</option>{verifiedEvidence.map((item) => <option key={item.id} value={item.id}>{item.title || item.id} · {item.evidenceType || "evidence"}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only evidence visible to this role and already verified by EOS can be attached to the run.</p></div><div className="flex flex-wrap gap-2">{selectedRun.state === "queued" && <Button disabled={!canExecute || transition.isPending} onClick={() => transition.mutate({ action: "start" })}>Start</Button>}{["waiting_input", "waiting_approval", "blocked", "failed"].includes(selectedRun.state) && <Button disabled={!canExecute || transition.isPending} onClick={() => transition.mutate({ action: "resume" })}>Resume</Button>}{selectedRun.state === "running" && <>{currentRunHasDeclaredRoute ? <><p className="w-full text-xs text-muted-foreground">Record the observed outcome for <span className="font-medium">{currentRunStep?.conditionKey || "this condition"}</span>; EOS will follow the declared route.</p><Button disabled={!canExecute || transition.isPending} onClick={() => transition.mutate({ action: "advance_step", selectedConditionOutcome: true })}><CheckCircle2 className="mr-2 h-4 w-4" />Yes — follow declared route</Button><Button variant="outline" disabled={!canExecute || transition.isPending} onClick={() => transition.mutate({ action: "advance_step", selectedConditionOutcome: false })}>No — follow declared route</Button></> : currentRunStep && <Button disabled={!canExecute || transition.isPending} onClick={() => transition.mutate({ action: "advance_step" })}><CheckCircle2 className="mr-2 h-4 w-4" />Complete step {selectedRun.currentStep + 1}</Button>}<Button disabled={!canDecide || transition.isPending || Boolean(currentRunStep)} onClick={() => transition.mutate({ action: "complete" })}><CheckCircle2 className="mr-2 h-4 w-4" />Complete run</Button><Button variant="outline" disabled={!canExecute || transition.isPending} onClick={() => transition.mutate({ action: "block" })}>Block</Button></>}</div><div className="space-y-2 border-t pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Immutable event trail</p>{(selectedRun.events || []).map((event: Json) => <div key={event.id} className="flex items-center justify-between gap-3 text-xs"><span>{event.sequence}. {event.action.replaceAll("_", " ")}</span><span className="text-muted-foreground">{event.fromState} → {event.toState}{event.eventProjection?.currentStepAfter != null ? ` · step ${event.eventProjection.currentStepAfter + 1}` : ""}{event.eventProjection?.conditionOutcome != null ? ` · condition ${event.eventProjection.conditionOutcome ? "yes" : "no"}` : ""}</span></div>)}</div></div> : <Empty text="Select a run to inspect and act." />}
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4 pt-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-3">
                <p className="text-sm font-medium">Create governed Role Agent schedule</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose the exact verified Role Agent first. EOS then limits the process list to work for that role, so a schedule cannot accidentally bind a different department's process.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-5">
                <Input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="Schedule name" />
                <select aria-label="Scheduled role agent" className="h-10 rounded-md border bg-background px-3 text-sm" value={scheduleSubjectId} onChange={(event) => { setScheduleSubjectId(event.target.value); setScheduleProcessId(""); }}>
                  <option value="">Choose verified Role Agent</option>
                  {availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.displayName}</option>)}
                </select>
                <select aria-label="Scheduled released process" className="h-10 rounded-md border bg-background px-3 text-sm" value={scheduleProcessId} disabled={!scheduleSubject} onChange={(event) => setScheduleProcessId(event.target.value)}>
                  <option value="">{scheduleSubject ? "Choose this role's released process" : "Choose a Role Agent first"}</option>
                  {scheduleProcesses.map((process) => <option key={process.id} value={process.id}>{process.name} · v{process.version}</option>)}
                </select>
                <select aria-label="Schedule cadence" className="h-10 rounded-md border bg-background px-3 text-sm" value={scheduleCadence} onChange={(event) => setScheduleCadence(event.target.value)}>
                  <option value="once">Once</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="event">When EOS observes an event</option><option value="manual">Manual</option>
                </select>
                <Button disabled={!canDecide || !scheduleName || !scheduleSubject || !scheduleProcess || (scheduleCadence === "event" && !configuredEventTypes.length) || createSchedule.isPending} onClick={() => createSchedule.mutate()}>Create schedule</Button>
              </div>
              {scheduleCadence === "event" && <div className="mt-3 space-y-3 rounded-lg border bg-background p-3"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><label className="space-y-1 text-xs font-medium text-muted-foreground">Native EOS event<select aria-label="Native Role Agent event" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={nativeEventChoice} onChange={(event) => { setNativeEventChoice(event.target.value); addNativeEventType(event.target.value); }}><option value="">Add a native event…</option>{nativeAgentEventCatalog.map((event) => <option key={event.eventType} value={event.eventType}>{event.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Subscribed event types<Input aria-label="Role Agent event types" value={scheduleEventTypes} onChange={(event) => setScheduleEventTypes(event.target.value)} placeholder="Select a native event or enter a documented adapter event" /></label></div><div className="rounded-md border bg-muted/20 p-3"><p className="text-sm font-medium">Only run when these facts match</p><p className="mt-1 text-xs text-muted-foreground">Optional exact-match rules narrow this agent without writing code. All listed rules must match a bounded fact that EOS already committed in the event.</p><div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><label className="sr-only" htmlFor="role-agent-event-rule-field">Event fact</label><select id="role-agent-event-rule-field" className="h-10 rounded-md border bg-background px-3 text-sm" value={eventRulePath} onChange={(event) => setEventRulePath(event.target.value)}><option value="">Choose an event fact</option>{filterableEventFields.map((field) => <option key={field} value={field}>{field}</option>)}</select><Input aria-label="Role Agent event rule value" value={eventRuleEquals} onChange={(event) => setEventRuleEquals(event.target.value)} placeholder="Equals value, e.g. active or true" /><Button type="button" variant="outline" disabled={!eventRulePath || !eventRuleEquals || scheduleEventRules.length >= 8} onClick={addEventRule}>Add rule</Button></div>{scheduleEventRules.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{scheduleEventRules.map((rule) => <button type="button" key={rule.path} className="rounded-full border bg-background px-2 py-1 text-xs hover:border-destructive" onClick={() => setScheduleEventRules((current) => current.filter((item) => item.path !== rule.path))}>{rule.path} = {rule.equals} ×</button>)}</div>}</div><div className="grid gap-2 md:grid-cols-2">{nativeAgentEventCatalog.map((event) => <div key={event.eventType} className="rounded-md border bg-muted/20 p-2 text-xs"><p className="font-medium">{event.label}</p><p className="mt-1 text-muted-foreground">{event.description}</p><p className="mt-1 text-muted-foreground">Carries: {event.payloadSummary}</p></div>)}</div><p className="text-xs text-muted-foreground">Choose a native event rather than memorizing an internal name. A documented adapter event may still be entered for a governed connected system. Every trigger schedules EOS work only; it never turns an event into an unreviewed external effect.</p></div>}
              {scheduleSubject && !scheduleProcesses.length && <p className="mt-3 text-sm text-muted-foreground">This Role Agent has no implemented, released process assigned yet. Assign and release its process in Org Studio before scheduling it.</p>}
              {scheduleSubject && scheduleProcess && <p className="mt-3 rounded-lg border bg-background p-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Scope preview:</span> {scheduleSubject.displayName} will run {scheduleProcess.name} as {scheduleExecutionMode} work {scheduleTriggerDescription}. External effects remain blocked unless a separately authorized provider action produces its own receipt.</p>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">{(agents.data?.schedules || []).map((schedule: Json) => { const process = processes.find((item) => item.id === schedule.processDefinitionId); const eventTypes = Array.isArray(schedule.eventTypes) ? schedule.eventTypes : []; const eventRules = Array.isArray(schedule.eventFilter?.all) ? schedule.eventFilter.all : []; return <div key={schedule.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{schedule.name}</p><p className="mt-1 text-xs text-muted-foreground">{process?.name || "Released process"} · {schedule.cadence} · {schedule.executionMode}</p></div><Badge variant="outline">{schedule.state}</Badge></div>{schedule.triggerKind === "manual" && <p className="mt-3 text-xs text-muted-foreground">Manual run: creates a governed EOS workflow run now. It does not claim or perform an external provider effect.</p>}{schedule.triggerKind === "event" && <><p className="mt-3 text-xs text-muted-foreground">Event trigger: {eventTypes.length ? eventTypes.map(nativeAgentEventLabel).join(", ") : "not declared"}. Testing emits a bounded EOS event only; it does not call a provider.</p>{eventRules.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Only when: {eventRules.map((rule: Json) => `${rule.path} = ${String(rule.equals)}`).join(" and ")}</p>}</>}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!canDecide || schedule.state === "retired" || scheduleTransition.isPending} onClick={() => scheduleTransition.mutate(schedule)}>{schedule.state === "active" ? "Pause" : "Activate"}</Button>{schedule.triggerKind === "manual" && <Button size="sm" disabled={!canExecute || schedule.state !== "active" || runSchedule.isPending} onClick={() => runSchedule.mutate(schedule)}><Play className="mr-2 h-4 w-4" />{runSchedule.isPending ? "Starting…" : "Run now"}</Button>}{schedule.triggerKind === "event" && <Button size="sm" disabled={!canExecute || schedule.state !== "active" || !eventTypes.length || dispatchScheduleEvent.isPending} onClick={() => dispatchScheduleEvent.mutate(schedule)}><Activity className="mr-2 h-4 w-4" />{dispatchScheduleEvent.isPending ? "Testing…" : "Test event"}</Button>}</div></div>; })}</div>
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
