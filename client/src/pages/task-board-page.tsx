import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Plus, Filter, X, MoreVertical, Calendar, AlertCircle } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "backlog" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  assigneeId?: string;
  dueDate?: string;
  createdBy: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface AgentSlot {
  id: string;
  name: string;
  type: "agent";
}

const STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export default function TaskBoardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading, error } = useQuery<Task[]>({
    queryKey: ["tasks", companyId],
    queryFn: () => apiRequest(`/api/companies/${companyId}/tasks`),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users", companyId],
    queryFn: () => apiRequest(`/api/companies/${companyId}/users`),
  });

  const { data: agentSlots = [] } = useQuery<AgentSlot[]>({
    queryKey: ["agents", companyId],
    queryFn: () => apiRequest(`/api/companies/${companyId}/agents`),
  });

  const createTaskMutation = useMutation<Task, Error, Partial<Task>>({
    mutationFn: (newTaskData) =>
      apiRequest(`/api/companies/${companyId}/tasks`, {
        method: "POST",
        body: JSON.stringify(newTaskData),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", companyId] });
      setCreateDialogOpen(false);
    },
  });

  const updateTaskMutation = useMutation<Task, Error, { taskId: string; updates: Partial<Task> }>({
    mutationFn: ({ taskId, updates }) =>
      apiRequest(`/api/companies/${companyId}/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", companyId] });
      setEditDialogOpen(false);
      setSelectedTask(null);
    },
  });

  const deleteTaskMutation = useMutation<void, Error, string>({
    mutationFn: (taskId) =>
      apiRequest(`/api/companies/${companyId}/tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", companyId] });
    },
  });

  const handleCreateTask = (formData: FormData) => {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = formData.get("priority") as Task["priority"];
    const assigneeId = formData.get("assigneeId") as string;
    const dueDate = formData.get("dueDate") as string;

    if (!title) return;

    createTaskMutation.mutate({
      title,
      description,
      status: "backlog",
      priority,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
    });
  };

  const handleEditTask = (formData: FormData) => {
    if (!selectedTask) return;

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = formData.get("priority") as Task["priority"];
    const status = formData.get("status") as Task["status"];
    const assigneeId = formData.get("assigneeId") as string;
    const dueDate = formData.get("dueDate") as string;

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      updates: {
        title,
        description,
        priority,
        status,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
      },
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm("Delete this task? This can't be undone.")) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: Task["status"]) => {
    if (!draggedTask) return;

    updateTaskMutation.mutate({
      taskId: draggedTask.id,
      updates: { status },
    });

    setDraggedTask(null);
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterAssignee && task.assigneeId !== filterAssignee) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    if (filterStatus && task.status !== filterStatus) return false;
    return true;
  });

  const getTasksByStatus = (status: Task["status"]) => {
    return filteredTasks.filter((t) => t.status === status);
  };

  const getAssigneeName = (assigneeId?: string) => {
    if (!assigneeId) return "Unassigned";
    const user = users.find((u) => u.id === assigneeId);
    if (user) return user.name;
    const agent = agentSlots.find((a) => a.id === assigneeId);
    if (agent) return agent.name;
    return "Unknown";
  };

  const hasActiveFilters = filterAssignee || filterPriority || filterStatus;

  const clearFilters = () => {
    setFilterAssignee("");
    setFilterPriority("");
    setFilterStatus("");
  };

  if (isLoading) {
    return (
      <UniversalLayout>
        <div className="p-6">
          <div className="mb-6">
            <div className="h-10 w-48 bg-surface-subtle rounded animate-pulse mb-2" />
            <div className="h-6 w-96 bg-surface-subtle rounded animate-pulse" />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-6">
            {STATUSES.map((status) => (
              <div key={status.value} className="flex-shrink-0 w-80">
                <div className="h-8 w-32 bg-surface-subtle rounded animate-pulse mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-surface-subtle rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (error) {
    return (
      <UniversalLayout>
        <div className="p-6">
          <div className="bg-surface rounded-lg border border-border-subtle p-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-mono font-semibold text-lg text-text mb-2">Failed to load tasks</h3>
            <p className="font-mono text-sm text-text-secondary mb-6">
              Connection failed. Check your network.
            </p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["tasks", companyId] })}>
              Retry
            </Button>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-4xl text-text mb-2">Task board</h1>
            <p className="font-mono text-base text-text-secondary">
              Move work through stages. Assign to your team or DEX.
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create task
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All assignees</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
              {agentSlots.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All priorities</SelectItem>
              {PRIORITIES.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  {priority.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear filters
            </Button>
          )}
        </div>

        {tasks.length === 0 && !hasActiveFilters ? (
          <div className="bg-surface rounded-lg border border-border-subtle p-12 text-center">
            <div className="font-mono text-4xl text-text-tertiary mb-4">—</div>
            <h3 className="font-mono font-semibold text-lg text-text mb-2">No tasks yet</h3>
            <p className="font-mono text-sm text-text-secondary mb-6">
              Create your first task or ask DEX to generate tasks from your goals.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create task
            </Button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6">
            {STATUSES.map((status) => {
              const columnTasks = getTasksByStatus(status.value);
              return (
                <div
                  key={status.value}
                  className="flex-shrink-0 w-80"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(status.value)}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-mono font-semibold text-base uppercase tracking-wide text-text">
                      {status.label}
                    </h3>
                    <span className="font-mono text-xs text-text-tertiary">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {columnTasks.length === 0 && (
                      <div className="bg-surface-subtle rounded-lg border border-border-subtle p-6 text-center">
                        <p className="font-mono text-sm text-text-tertiary">No tasks</p>
                      </div>
                    )}
                    {columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        className="p-4 cursor-move hover:shadow-md transition-shadow"
                        draggable
                        onDragStart={() => handleDragStart(task)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-mono font-semibold text-sm text-text flex-1">
                            {task.title}
                          </h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTask(task);
                                  setEditDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {task.description && (
                          <p className="font-mono text-xs text-text-secondary mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full font-mono text-xs uppercase tracking-wide ${
                              task.priority === "critical"
                                ? "bg-destructive-muted text-destructive"
                                : task.priority === "high"
                                ? "bg-warning-muted text-warning"
                                : task.priority === "medium"
                                ? "bg-surface-subtle text-text-secondary border border-border"
                                : "bg-surface-subtle text-text-tertiary"
                            }`}
                          >
                            {task.priority}
                          </span>

                          <span className="font-mono text-xs text-text-secondary">
                            {getAssigneeName(task.assigneeId)}
                          </span>

                          {task.dueDate && (
                            <span className="flex items-center gap-1 font-mono text-xs text-text-tertiary">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-2xl text-text">
              Create task
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateTask(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g., Draft Q2 product roadmap"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="e.g., Research competitors, outline feature priorities, share with team for review"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-mono text-xs text-text-tertiary">
                  Critical: blocks other work. High: due this week. Medium/Low: flex.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigneeId">Assignee</Label>
                <Select name="assigneeId">
                  <SelectTrigger id="assigneeId">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                    {agentSlots.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-mono text-xs text-text-tertiary">
                  Assign to a team member or DEX (your AI assistant).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
                <p className="font-mono text-xs text-text-tertiary">
                  Optional. Set a deadline to track urgency.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "Saving..." : "Save task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-2xl text-text">Edit task</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditTask(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    name="title"
                    defaultValue={selectedTask.title}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={selectedTask.description}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select name="status" defaultValue={selectedTask.status}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select name="priority" defaultValue={selectedTask.priority}>
                    <SelectTrigger id="edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-assigneeId">Assignee</Label>
                  <Select name="assigneeId" defaultValue={selectedTask.assigneeId || ""}>
                    <SelectTrigger id="edit-assigneeId">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                      {agentSlots.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dueDate">Due date</Label>
                  <Input
                    id="edit-dueDate"
                    name="dueDate"
                    type="date"
                    defaultValue={
                      selectedTask.dueDate
                        ? new Date(selectedTask.dueDate).toISOString().split("T")[0]
                        : ""
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedTask(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTaskMutation.isPending}>
                  {updateTaskMutation.isPending ? "Saving..." : "Save task"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </UniversalLayout>
  );
}