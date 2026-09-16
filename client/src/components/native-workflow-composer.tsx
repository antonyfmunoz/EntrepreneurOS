import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GitBranch, GripVertical, Plus, Save, ShieldCheck, Sparkles, Trash2, Workflow } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import {
  nativeWorkflowStarters,
  nativeWorkflowTools,
  type NativeWorkflowStarter,
  type NativeWorkflowStarterStep,
} from "@shared/native-workflow-starters";

type Json = Record<string, any>;
type WorkflowStep = NativeWorkflowStarterStep & {
  id: string;
  conditionKey?: string;
  onTrueStepId?: string;
  onFalseStepId?: string;
};

function newStep(): WorkflowStep {
  return { id: `step-${crypto.randomUUID().slice(0, 8)}`, title: "", instructions: "", completionCriteria: "", actionKind: "manual", authorityClass: "execute", toolKey: "operations", onFailure: "Stop, preserve the current state, and escalate to the accountable role.", conditionKey: "", onTrueStepId: "", onFalseStepId: "" };
}
function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workflow";
}
function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function NativeWorkflowComposer({
  root,
  capabilities,
  processes,
  canExecute,
  canDecide,
  onChanged,
}: {
  root: string;
  capabilities: Json[];
  processes: Json[];
  canExecute: boolean;
  canDecide: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [editingId, setEditingId] = useState("");
  const [capabilityId, setCapabilityId] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [outcome, setOutcome] = useState("");
  const [trigger, setTrigger] = useState("");
  const [approvalGates, setApprovalGates] = useState("");
  const [branchConditions, setBranchConditions] = useState("");
  const [templateAncestry, setTemplateAncestry] = useState("native_workflow_composer.v1");
  const [steps, setSteps] = useState<WorkflowStep[]>([newStep()]);
  const [error, setError] = useState("");
  const editableProcesses = useMemo(() => processes.filter((process) => process.releaseState === "draft"), [processes]);

  const clear = () => {
    setEditingId(""); setCapabilityId(""); setName(""); setPurpose(""); setOutcome(""); setTrigger(""); setApprovalGates(""); setBranchConditions(""); setTemplateAncestry("native_workflow_composer.v1"); setSteps([newStep()]); setError("");
  };
  const load = (process: Json) => {
    setEditingId(process.id); setCapabilityId(process.capabilityInstanceId || ""); setName(process.name || ""); setPurpose(process.purpose || ""); setOutcome(process.intendedOutcome || ""); setTrigger(process.triggerCondition || "");
    setApprovalGates((process.approvalGates || []).join("\n")); setBranchConditions((process.branchConditions || []).join("\n")); setTemplateAncestry(process.templateAncestry || "native_workflow_composer.v1");
    setSteps((Array.isArray(process.procedureSteps) && process.procedureSteps.length ? process.procedureSteps : [newStep()]).map((step: Json, index: number) => ({
      id: step.id || `step-${index + 1}`, title: step.title || "", instructions: step.instructions || "", completionCriteria: step.completionCriteria || "", actionKind: ["manual", "native", "approval", "condition"].includes(step.actionKind) ? step.actionKind : "manual", authorityClass: ["view", "execute", "decide"].includes(step.authorityClass) ? step.authorityClass : "execute", toolKey: step.toolKey || "operations", onFailure: step.onFailure || "Stop, preserve the current state, and escalate to the accountable role.", conditionKey: step.conditionKey || "", onTrueStepId: step.onTrueStepId || "", onFalseStepId: step.onFalseStepId || "",
    })));
    setError("");
  };
  const updateStep = (index: number, patch: Partial<WorkflowStep>) => setSteps((current) => current.map((step, currentIndex) => currentIndex === index ? { ...step, ...patch } : step));
  const applyStarter = (starter: NativeWorkflowStarter) => {
    setEditingId(""); setName(starter.name); setPurpose(starter.purpose); setOutcome(starter.outcome); setTrigger(starter.trigger); setApprovalGates(starter.approvals.join("\n")); setBranchConditions(starter.branches.join("\n")); setTemplateAncestry(`native_workflow_starter.${starter.key}.v1`); setSteps(starter.steps.map((step) => ({ ...step, id: `step-${crypto.randomUUID().slice(0, 8)}` }))); setError("");
  };
  const moveStep = (index: number, direction: -1 | 1) => setSteps((current) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= current.length) return current;
    const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next;
  });
  const valid = Boolean(capabilityId && name.trim().length >= 2 && purpose.trim().length >= 3 && outcome.trim().length >= 3 && trigger.trim().length >= 3 && steps.every((step, index) => step.title.trim() && step.instructions.trim() && step.completionCriteria.trim() && (step.actionKind !== "condition" || (Boolean(step.conditionKey?.trim()) && Boolean(step.onTrueStepId) && Boolean(step.onFalseStepId) && index < steps.length - 1))));
  const payload = () => ({
    name: name.trim(), workflowKey: `workflow:${safeKey(name)}`, purpose: purpose.trim(), intendedOutcome: outcome.trim(), triggerCondition: trigger.trim(),
    templateAncestry, applicableOverlays: [], supportingActorKeys: [], requiredAuthority: Array.from(new Set(steps.map((step) => step.authorityClass))), disclosureScope: "internal",
    prerequisites: [], requiredInputs: [], toolSystemBoundaries: Array.from(new Set(steps.map((step) => step.toolKey))), procedureSteps: steps,
    branchConditions: lines(branchConditions), approvalGates: Array.from(new Set([...lines(approvalGates), ...steps.filter((step) => step.actionKind === "approval").map((step) => `${step.title}: ${step.completionCriteria}`)])),
    prohibitedActions: ["Do not transmit data to an external provider unless an explicit provider capability, matching authority, and governed provider binding exist."], requiredOutputs: [outcome.trim()], evidenceRequirements: ["Observed execution result"], qualityCriteria: ["Each step is completed only by the required authority and recorded in the immutable run trail."], sla: "", emittedEvents: ["workflow.run.recorded"], failurePaths: Array.from(new Set(steps.map((step) => step.onFailure))), terminalCriteria: [outcome.trim()], trainingPrerequisites: [], acceptanceTests: ["An authorized fixture operator completes the normal path from this rendered native workflow without asserting an external effect."], reviewerKeys: [], classification: "confidential",
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!valid) throw new Error("Complete the capability, workflow context, and every workflow step before saving.");
      const body = payload();
      const response = editingId
        ? await apiRequest("PATCH", `${root}/processes/${editingId}`, body)
        : await apiRequest("POST", `${root}/processes`, { ...body, capabilityInstanceId: capabilityId });
      return response.json() as Promise<Json>;
    },
    onSuccess: async (process) => { setEditingId(process.id); await onChanged(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const version = useMutation({
    mutationFn: async (process: Json) => (await apiRequest("POST", `${root}/processes/${process.id}/versions`, { reason: "Create a new immutable draft version before changing the native no-code workflow." })).json() as Promise<Json>,
    onSuccess: async (process) => { load(process); await onChanged(); }, onError: (cause: Error) => setError(cause.message),
  });

  return <Card data-testid="native-workflow-composer" className="border-primary/20 shadow-[0_10px_34px_rgba(106,55,212,0.08)]">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex gap-2"><Badge variant="secondary">Native automation</Badge><Badge variant="outline">No-code composer</Badge></div><CardTitle className="mt-3 flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" />Workflow Composer</CardTitle><CardDescription className="mt-2 max-w-3xl">Configure how this company operates: trigger, ordered work, conditions, approval gates, authority, and EOS-owned tools. The saved workflow is an immutable process version; a provider can be added later, but it is never required.</CardDescription></div><Button variant="outline" size="sm" onClick={clear}><Sparkles className="mr-2 h-4 w-4" />New workflow</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Workflow was not saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {!editingId && <section className="rounded-xl border bg-muted/20 p-4"><div><p className="eos-label">Business-in-a-box starters</p><h3 className="mt-1 font-semibold">Start from a proven native operating pattern</h3><p className="mt-1 text-sm text-muted-foreground">Choose a starter, then replace the contextual details for this company. EOS preserves the template ancestry so later improvements remain visible without treating this company’s completed version as generic boilerplate.</p></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{nativeWorkflowStarters.map((starter) => <button key={starter.key} type="button" onClick={() => applyStarter(starter)} className={`rounded-xl border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${templateAncestry.includes(`.${starter.key}.`) ? "border-primary bg-primary/5" : "bg-background"}`}><p className="font-medium text-sm">{starter.label}</p><p className="mt-1 text-xs text-muted-foreground">{starter.description}</p></button>)}</div></section>}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"><select aria-label="Existing draft workflow" className="h-10 rounded-md border bg-background px-3 text-sm" value={editingId} onChange={(event) => { const process = editableProcesses.find((item) => item.id === event.target.value); if (process) load(process); }}><option value="">Start a new workflow or choose a draft</option>{editableProcesses.map((process) => <option key={process.id} value={process.id}>{process.name} · v{process.version}</option>)}</select><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!editingId || version.isPending || !canDecide} onClick={() => { const process = processes.find((item) => item.id === editingId); if (process) version.mutate(process); }}>New version</Button><Button size="sm" disabled={!canExecute || !valid || save.isPending} onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : editingId ? "Save draft" : "Create workflow"}</Button></div></div>
      <section className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2"><div><Label htmlFor="workflow-capability">Company capability</Label><select id="workflow-capability" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={capabilityId} disabled={Boolean(editingId)} onChange={(event) => setCapabilityId(event.target.value)}><option value="">Choose the capability this workflow operates</option>{capabilities.filter((capability) => capability.state !== "deprecated").map((capability) => <option key={capability.id} value={capability.id}>{capability.name}</option>)}</select></div><div><Label htmlFor="workflow-name">Workflow name</Label><Input id="workflow-name" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="Revenue recovery lead qualification" /></div><div><Label htmlFor="workflow-trigger">When it starts</Label><Input id="workflow-trigger" className="mt-1" value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="A consented lead enters the native CRM" /></div><div><Label htmlFor="workflow-outcome">Done when</Label><Input id="workflow-outcome" className="mt-1" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="The next authorized action and its evidence are recorded" /></div><div className="lg:col-span-2"><Label htmlFor="workflow-purpose">Operating purpose</Label><Textarea id="workflow-purpose" className="mt-1 min-h-20" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Why this workflow exists and the business outcome it protects." /></div></section>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Flow canvas</p><h3 className="mt-1 font-semibold">Ordered native work with real routes</h3><p className="mt-1 text-sm text-muted-foreground">Conditions select an explicit yes or no route. EOS records the observed outcome and selected downstream step in the immutable run trail.</p></div><Button size="sm" variant="outline" onClick={() => setSteps((current) => [...current, newStep()])}><Plus className="mr-2 h-4 w-4" />Add step</Button></div><div className="mt-4 space-y-3">{steps.map((step, index) => <div key={step.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex flex-wrap items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><Badge variant="outline">{index + 1}</Badge><Input className="min-w-48 flex-1" value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} placeholder="Step title" aria-label={`Workflow step ${index + 1} title`} /><select className="h-9 rounded-md border bg-background px-2 text-sm" value={step.actionKind} onChange={(event) => updateStep(index, { actionKind: event.target.value as WorkflowStep["actionKind"], ...(event.target.value === "condition" ? {} : { conditionKey: "", onTrueStepId: "", onFalseStepId: "" }) })} aria-label={`Workflow step ${index + 1} type`}><option value="manual">Human / agent work</option><option value="native">Native EOS action</option><option value="condition">Condition</option><option value="approval">Approval gate</option></select><Button size="icon" variant="ghost" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="Move step up"><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} aria-label="Move step down"><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={steps.length === 1} onClick={() => setSteps((current) => current.filter((_, currentIndex) => currentIndex !== index))} aria-label="Remove workflow step"><Trash2 className="h-4 w-4" /></Button></div><div className="mt-3 grid gap-3 md:grid-cols-3"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={step.toolKey} onChange={(event) => updateStep(index, { toolKey: event.target.value })} aria-label={`Workflow step ${index + 1} native tool`}>{nativeWorkflowTools.map((tool) => <option key={tool} value={tool}>{tool.replaceAll("_", " ")}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={step.authorityClass} onChange={(event) => updateStep(index, { authorityClass: event.target.value as WorkflowStep["authorityClass"] })} aria-label={`Workflow step ${index + 1} authority`}><option value="view">View</option><option value="execute">Execute</option><option value="decide">Decide / approve</option></select><Input value={step.completionCriteria} onChange={(event) => updateStep(index, { completionCriteria: event.target.value })} placeholder="Completion criterion" aria-label={`Workflow step ${index + 1} completion criterion`} /></div>{step.actionKind === "condition" && <div className="mt-3 grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 md:grid-cols-3"><Input value={step.conditionKey || ""} onChange={(event) => updateStep(index, { conditionKey: event.target.value })} placeholder="Condition key, e.g. lead-qualified" aria-label={`Workflow step ${index + 1} condition key`} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={step.onTrueStepId || ""} onChange={(event) => updateStep(index, { onTrueStepId: event.target.value })} aria-label={`Workflow step ${index + 1} yes route`}><option value="">If yes, go to…</option>{steps.slice(index + 1).map((target, targetOffset) => <option key={target.id} value={target.id}>Step {index + targetOffset + 2}: {target.title || "Untitled"}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={step.onFalseStepId || ""} onChange={(event) => updateStep(index, { onFalseStepId: event.target.value })} aria-label={`Workflow step ${index + 1} no route`}><option value="">If no, go to…</option>{steps.slice(index + 1).map((target, targetOffset) => <option key={target.id} value={target.id}>Step {index + targetOffset + 2}: {target.title || "Untitled"}</option>)}</select><p className="md:col-span-3 text-xs text-muted-foreground">Routes may only move forward. That prevents accidental loops and keeps every execution path inspectable.</p></div>}<Textarea className="mt-3 min-h-16" value={step.instructions} onChange={(event) => updateStep(index, { instructions: event.target.value })} placeholder="What happens in this step?" aria-label={`Workflow step ${index + 1} instructions`} /><Input className="mt-3" value={step.onFailure} onChange={(event) => updateStep(index, { onFailure: event.target.value })} placeholder="Safe failure path" aria-label={`Workflow step ${index + 1} failure path`} /></div>)}</div></section>
      <section className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2"><div><Label htmlFor="workflow-conditions">Additional branch conditions</Label><Textarea id="workflow-conditions" className="mt-1 min-h-20" value={branchConditions} onChange={(event) => setBranchConditions(event.target.value)} placeholder="One condition per line, for example: If consent is absent, stop and request it." /><p className="mt-1 text-xs text-muted-foreground">Use a Condition step for a visible point in the flow; use this for shared branch rules.</p></div><div><Label htmlFor="workflow-approvals">Additional approval safeguards</Label><Textarea id="workflow-approvals" className="mt-1 min-h-20" value={approvalGates} onChange={(event) => setApprovalGates(event.target.value)} placeholder="One safeguard per line, for example: Founder approval is required before a commercial commitment." /><p className="mt-1 text-xs text-muted-foreground">Approval steps are automatically included here too.</p></div></section>
      <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Draft first, governed release second</AlertTitle><AlertDescription>Saving creates or updates a draft process version. EOS will not treat it as executable until the existing qualification and release controls confirm its evidence and authority. External effects remain prohibited unless a separate, governed provider capability is explicitly connected.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
