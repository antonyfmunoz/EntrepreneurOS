import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, CirclePlay, ClipboardList, FolderKanban, Plus, RefreshCw, UserRoundCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type Seat = { id: string; title: string; status?: string };

function commandKey(prefix: string) { return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
function safeKey(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"; }
function stateVariant(state: string) { return state === "active" || state === "completed" ? "default" as const : "outline" as const; }

export function NativeProjectsStudio({ root, roleScopeKey, activeSeatId, seats, canExecute, canDecide }: {
  root: string; roleScopeKey: string; activeSeatId: string; seats: Seat[]; canExecute: boolean; canDecide: boolean;
}) {
  const [projectTitle, setProjectTitle] = useState("");
  const [projectObjective, setProjectObjective] = useState("");
  const [projectOwnerId, setProjectOwnerId] = useState(activeSeatId);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [editingProjectTitle, setEditingProjectTitle] = useState("");
  const [editingProjectObjective, setEditingProjectObjective] = useState("");
  const [editingProjectOwnerId, setEditingProjectOwnerId] = useState(activeSeatId);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskObjective, setTaskObjective] = useState("");
  const [taskOwnerId, setTaskOwnerId] = useState(activeSeatId);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskObjective, setEditingTaskObjective] = useState("");
  const [editingTaskOwnerId, setEditingTaskOwnerId] = useState(activeSeatId);
  const [error, setError] = useState("");
  const projectsQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-projects"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/projects`)).json() });
  const tasksQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-tasks"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/tasks`)).json() });
  const projects: Json[] = useMemo(() => (projectsQuery.data?.objects || []).filter((item: Json) => item.objectType === "project"), [projectsQuery.data]);
  const tasks: Json[] = useMemo(() => (tasksQuery.data?.objects || []).filter((item: Json) => item.objectType === "task"), [tasksQuery.data]);
  const contextQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-projects-context"], queryFn: async () => (await apiRequest("GET", `${root}/context`)).json() });
  const canViewCrm = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys) && contextQuery.data.principalContext.visibleInstrumentKeys.includes("crm");
  const canViewCommerce = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys) && contextQuery.data.principalContext.visibleInstrumentKeys.includes("commerce");
  const crmQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-projects-crm-context"], enabled: Boolean(canViewCrm), retry: false, queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json() });
  const commerceQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-projects-commerce-context"], enabled: Boolean(canViewCommerce), retry: false, queryFn: async () => (await apiRequest("GET", `${root}/instruments/commerce`)).json() });
  const relationshipChoices = useMemo(() => {
    const crmObjects: Json[] = crmQuery.data?.objects || [];
    const people = crmObjects.filter((item) => item.objectType === "person");
    return crmObjects.filter((item) => item.objectType === "relationship").map((relationship) => {
      const person = people.find((item) => item.id === relationship.data?.personObjectId);
      return { relationship, label: `${String(relationship.data?.relationshipType || "Relationship").replaceAll("_", " ")} · ${person?.data?.displayName || person?.title || "Visible relationship"}` };
    });
  }, [crmQuery.data]);
  const selectedRelationship = relationshipChoices.find((item) => item.relationship.id === selectedRelationshipId) || null;
  const activeSeats = seats.filter((seat) => seat.status !== "inactive");
  const selectedProject = projects.find((item) => item.id === selectedProjectId) || projects[0];
  const selectedTask = tasks.find((item) => item.id === selectedTaskId) || tasks.find((item) => item.data?.projectObjectId === selectedProject?.id) || tasks[0];
  const selectedProjectOrderId = typeof selectedProject?.data?.orderObjectId === "string" ? selectedProject.data.orderObjectId : "";
  const selectedProjectOrder = useMemo(() => ((commerceQuery.data?.objects || []) as Json[]).find((item) => item.id === selectedProjectOrderId && item.objectType === "order") || null, [commerceQuery.data, selectedProjectOrderId]);
  const selectedProjectOpportunityId = typeof selectedProject?.data?.sourceOpportunityObjectId === "string" ? selectedProject.data.sourceOpportunityObjectId : "";
  const selectedProjectOpportunity = useMemo(() => ((crmQuery.data?.objects || []) as Json[]).find((item) => item.id === selectedProjectOpportunityId && item.objectType === "opportunity") || null, [crmQuery.data, selectedProjectOpportunityId]);
  useEffect(() => {
    setEditingProjectTitle(String(selectedProject?.title || ""));
    setEditingProjectObjective(String(selectedProject?.data?.objective || selectedProject?.summary || ""));
    setEditingProjectOwnerId(String(selectedProject?.data?.ownerSeatId || activeSeatId));
  }, [activeSeatId, selectedProject?.id, selectedProject?.version]);
  useEffect(() => {
    setEditingTaskTitle(String(selectedTask?.title || ""));
    setEditingTaskObjective(String(selectedTask?.data?.objective || selectedTask?.summary || ""));
    setEditingTaskOwnerId(String(selectedTask?.data?.ownerSeatId || activeSeatId));
  }, [activeSeatId, selectedTask?.id, selectedTask?.version]);
  const refresh = async () => Promise.all([queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-projects"] }), queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-tasks"] })]);
  const createProject = useMutation({
    mutationFn: async () => {
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "projects", objectType: "project", objectKey: `project:${safeKey(projectTitle)}:${Date.now()}`, title: projectTitle.trim(), summary: projectObjective.trim(), classification: "confidential", visibility: "team",
        data: { objective: projectObjective.trim(), ownerSeatId: projectOwnerId || activeSeatId, operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "project_management" }, evidenceIds: [], idempotencyKey: commandKey("native-project-create"),
      })).json();
      let relationshipLinked = true;
      if (selectedRelationship) try {
        await apiRequest("POST", `${root}/instrument-links`, {
          sourceObjectId: result.object.id, targetObjectId: selectedRelationship.relationship.id, relationshipType: "concerns_relationship",
          metadata: { relationshipLabel: selectedRelationship.label }, idempotencyKey: commandKey("native-project-relationship-link"),
        });
      } catch { relationshipLinked = false; }
      return { ...result, relationshipLinked };
    },
    onSuccess: async (result) => { setSelectedProjectId(result.object.id); setProjectTitle(""); setProjectObjective(""); if (!result.relationshipLinked) setError("The project was created, but EOS could not create its CRM relationship link. Review the project before relying on that context."); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const saveProject = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Select a project to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedProject.id}`, {
        expectedVersion: selectedProject.version,
        title: editingProjectTitle.trim(), summary: editingProjectObjective.trim(),
        data: { ...selectedProject.data, objective: editingProjectObjective.trim(), ownerSeatId: editingProjectOwnerId, operatingMode: "native_eos" },
        idempotencyKey: commandKey("native-project-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedProjectId(result.object.id); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createTask = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Create or select a project first.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "tasks", objectType: "task", objectKey: `task:${safeKey(taskTitle)}:${Date.now()}`, title: taskTitle.trim(), summary: taskObjective.trim(), classification: "confidential", visibility: "team", parentObjectId: selectedProject.id,
        data: { objective: taskObjective.trim(), ownerSeatId: taskOwnerId || activeSeatId, projectObjectId: selectedProject.id, operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "task_management" }, evidenceIds: [], idempotencyKey: commandKey("native-task-create"),
      })).json();
    }, onSuccess: async (result) => { setSelectedTaskId(result.object.id); setTaskTitle(""); setTaskObjective(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const saveTask = useMutation({
    mutationFn: async () => {
      if (!selectedTask) throw new Error("Select a task to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedTask.id}`, {
        expectedVersion: selectedTask.version,
        title: editingTaskTitle.trim(), summary: editingTaskObjective.trim(),
        data: { ...selectedTask.data, objective: editingTaskObjective.trim(), ownerSeatId: editingTaskOwnerId, operatingMode: "native_eos" },
        idempotencyKey: commandKey("native-task-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedTaskId(result.object.id); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const transition = useMutation({
    mutationFn: async ({ object, state }: { object: Json; state: "active" | "completed" }) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state, rationale: state === "active" ? "Start this accountable native EOS work item." : "Mark this native EOS work item complete after the accountable outcome is recorded.", evidenceIds: [], idempotencyKey: commandKey(`native-work-${state}`),
    })).json(), onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const ownerName = (id: string) => activeSeats.find((seat) => seat.id === id)?.title || "Owner not visible";

  return <Card data-testid="native-projects-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" />Native Projects & Tasks</CardTitle><CardDescription className="mt-1">Turn the company’s priorities into accountable projects and role-owned tasks inside EOS. Projects remain linked to owners, lifecycle state, and evidence instead of becoming an external task-board dependency.</CardDescription></div><Button size="sm" variant="outline" onClick={() => { projectsQuery.refetch(); tasksQuery.refetch(); }} disabled={projectsQuery.isFetching || tasksQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${(projectsQuery.isFetching || tasksQuery.isFetching) ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Work command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /><h3 className="font-semibold">Project charter</h3></div><p className="mt-1 text-sm text-muted-foreground">Make the accountable outcome and owner explicit before breaking the work down.</p><div className="mt-4 grid gap-3"><Input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="Project name" aria-label="Project name" /><Textarea value={projectObjective} onChange={(event) => setProjectObjective(event.target.value)} placeholder="What business outcome will this project produce?" aria-label="Project objective" />{canViewCrm && <div><Label htmlFor="native-project-relationship">Relationship context (optional)</Label><select id="native-project-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRelationshipId} onChange={(event) => setSelectedRelationshipId(event.target.value)} disabled={crmQuery.isFetching}><option value="">No CRM relationship</option>{relationshipChoices.map((choice) => <option key={choice.relationship.id} value={choice.relationship.id}>{choice.label}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only CRM relationships already visible to this role appear here. EOS records an auditable native relationship edge; no external project system is changed.</p></div>}<div><Label htmlFor="project-owner">Accountable owner</Label><select id="project-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={projectOwnerId} onChange={(event) => setProjectOwnerId(event.target.value)}>{activeSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><Button disabled={!canExecute || projectTitle.trim().length < 2 || projectObjective.trim().length < 3 || !projectOwnerId || createProject.isPending} onClick={() => createProject.mutate()}><Plus className="mr-2 h-4 w-4" />{createProject.isPending ? "Creating…" : "Create project"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /><h3 className="font-semibold">Role-owned task</h3></div><p className="mt-1 text-sm text-muted-foreground">Assign work to a human or agent role. The role’s assistant and authority rules remain in effect; this does not bypass the hierarchy.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="task-project">Project</Label><select id="task-project" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedProject?.id || ""} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></div><Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task name" aria-label="Task name" /><Textarea value={taskObjective} onChange={(event) => setTaskObjective(event.target.value)} placeholder="What concrete result is required?" aria-label="Task objective" /><div><Label htmlFor="task-owner">Role owner</Label><select id="task-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={taskOwnerId} onChange={(event) => setTaskOwnerId(event.target.value)}>{activeSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><Button disabled={!canExecute || !selectedProject || taskTitle.trim().length < 2 || taskObjective.trim().length < 3 || !taskOwnerId || createTask.isPending} onClick={() => createTask.mutate()}><Plus className="mr-2 h-4 w-4" />{createTask.isPending ? "Creating…" : "Create task"}</Button></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Native operating view</p><h3 className="mt-1 font-semibold">Accountable work board</h3></div><Badge variant="outline">{projects.length} projects · {tasks.length} tasks</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-3">{projects.map((project) => { const projectTasks = tasks.filter((task) => task.data?.projectObjectId === project.id); return <div key={project.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{project.title}</p><p className="mt-1 text-xs text-muted-foreground">{project.summary}</p></div><Badge variant={stateVariant(project.state)}>{project.state}</Badge></div><p className="mt-3 text-xs text-muted-foreground"><UserRoundCheck className="mr-1 inline h-3.5 w-3.5" />{ownerName(project.data?.ownerSeatId)}</p><div className="mt-3 space-y-2">{projectTasks.map((task) => <div key={task.id} className="rounded-lg border bg-background p-2.5"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{task.title}</p><Badge variant={stateVariant(task.state)}>{task.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{ownerName(task.data?.ownerSeatId)}</p><div className="mt-2 flex gap-2">{task.state === "draft" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: task, state: "active" })}><CirclePlay className="mr-1 h-3.5 w-3.5" />Start</Button>}{task.state === "active" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: task, state: "completed" })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Complete</Button>}</div></div>)}{!projectTasks.length && <p className="text-xs text-muted-foreground">No tasks yet.</p>}</div>{project.state === "draft" && <Button size="sm" className="mt-3" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: project, state: "active" })}>Activate project</Button>}</div>; })}{!projects.length && <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Create a project to turn company priorities into accountable work.</div>}</div></section>
      {selectedProject && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Configure selected project</p>{selectedProjectOrderId && <div className="mt-3 rounded-lg border bg-background/70 p-3"><p className="text-sm font-medium">Commercial source</p>{canViewCommerce ? <><p className="mt-1 text-sm text-muted-foreground">{selectedProjectOrder ? `This delivery project was created from the native order “${selectedProjectOrder.title}”.` : "The linked native order is no longer visible to this role."}</p>{selectedProjectOrder && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Buyer: {String(selectedProjectOrder.data?.buyerReference || "Governed buyer")}</span>{selectedProjectOpportunity && <span>CRM opportunity: {selectedProjectOpportunity.title}</span>}</div>}</> : <p className="mt-1 text-sm text-muted-foreground">This project has a commercial origin, but your role has not been granted Commerce. EOS keeps that order and buyer data private while you operate the assigned work.</p>}</div>}<div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-edit-project-title">Project name</Label><Input id="native-edit-project-title" className="mt-1" value={editingProjectTitle} onChange={(event) => setEditingProjectTitle(event.target.value)} /></div><div><Label htmlFor="native-edit-project-owner">Accountable owner</Label><select id="native-edit-project-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingProjectOwnerId} onChange={(event) => setEditingProjectOwnerId(event.target.value)}>{activeSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><div className="md:col-span-2"><Label htmlFor="native-edit-project-objective">Business outcome</Label><Textarea id="native-edit-project-objective" className="mt-1" value={editingProjectObjective} onChange={(event) => setEditingProjectObjective(event.target.value)} /></div><div className="md:col-span-2"><Button size="sm" disabled={!canExecute || editingProjectTitle.trim().length < 2 || editingProjectObjective.trim().length < 3 || !editingProjectOwnerId || saveProject.isPending} onClick={() => saveProject.mutate()}>{saveProject.isPending ? "Saving…" : "Save native project"}</Button></div></div></section>}
      {selectedTask && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Configure selected task</p><p className="mt-1 text-sm text-muted-foreground">The project connection and lifecycle remain unchanged while you refine the accountable work.</p></div>{tasks.length > 1 && <select aria-label="Task to configure" className="h-9 rounded-md border bg-background px-2 text-sm" value={selectedTask.id} onChange={(event) => setSelectedTaskId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-edit-task-title">Task name</Label><Input id="native-edit-task-title" className="mt-1" value={editingTaskTitle} onChange={(event) => setEditingTaskTitle(event.target.value)} /></div><div><Label htmlFor="native-edit-task-owner">Role owner</Label><select id="native-edit-task-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingTaskOwnerId} onChange={(event) => setEditingTaskOwnerId(event.target.value)}>{activeSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><div className="md:col-span-2"><Label htmlFor="native-edit-task-objective">Concrete result</Label><Textarea id="native-edit-task-objective" className="mt-1" value={editingTaskObjective} onChange={(event) => setEditingTaskObjective(event.target.value)} /></div><div className="md:col-span-2"><Button size="sm" disabled={!canExecute || editingTaskTitle.trim().length < 2 || editingTaskObjective.trim().length < 3 || !editingTaskOwnerId || saveTask.isPending} onClick={() => saveTask.mutate()}>{saveTask.isPending ? "Saving…" : "Save native task"}</Button></div></div></section>}
      <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Native execution, not a detached task list</AlertTitle><AlertDescription>EOS retains the project objective, owner seat, hierarchy, lifecycle, and linked tasks as governed company state. Work can be automated or carried by a human employee with the role agent acting as that person’s assistant, but ownership remains explicit.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
