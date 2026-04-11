import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Circle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, InsertTask, UpdateTask } from "@shared/schema";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const statusColumns: Array<{
  id: TaskStatus;
  title: string;
  accent: string;
  icon: typeof Circle;
}> = [
  { id: "todo", title: "Todo", accent: "text-slate-500", icon: Circle },
  {
    id: "in-progress",
    title: "In Progress",
    accent: "text-[#6a37d4]",
    icon: Clock,
  },
  {
    id: "done",
    title: "Done",
    accent: "text-emerald-600",
    icon: CheckCircle2,
  },
];

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-700",
};

function nextStatus(current: TaskStatus): TaskStatus | null {
  if (current === "todo") return "in-progress";
  if (current === "in-progress") return "done";
  return null;
}

function prevStatus(current: TaskStatus): TaskStatus | null {
  if (current === "done") return "in-progress";
  if (current === "in-progress") return "todo";
  return null;
}

export default function TaskBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const {
    data: tasks,
    isLoading,
    error,
  } = useQuery<Task[], Error>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tasks");
      return (await res.json()) as Task[];
    },
  });

  const createMutation = useMutation<Task, Error, InsertTask>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/tasks", input);
      return (await res.json()) as Task;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      toast({ title: "Task created", description: created.title });
    },
    onError: (err) => {
      toast({
        title: "Couldn't create task",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation<
    Task,
    Error,
    { id: string; status: TaskStatus }
  >({
    mutationFn: async ({ id, status }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, {
        status,
      } satisfies UpdateTask);
      return (await res.json()) as Task;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previous = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      if (previous) {
        queryClient.setQueryData<Task[]>(
          ["/api/tasks"],
          previous.map((t) => (t.id === id ? { ...t, status } : t)),
        );
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err, _vars, ctx) => {
      const previous = (ctx as { previous?: Task[] } | undefined)?.previous;
      if (previous) queryClient.setQueryData(["/api/tasks"], previous);
      toast({
        title: "Couldn't move task",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previous = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      if (previous) {
        queryClient.setQueryData<Task[]>(
          ["/api/tasks"],
          previous.filter((t) => t.id !== id),
        );
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err, _vars, ctx) => {
      const previous = (ctx as { previous?: Task[] } | undefined)?.previous;
      if (previous) queryClient.setQueryData(["/api/tasks"], previous);
      toast({
        title: "Couldn't delete task",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) return;
    createMutation.mutate({
      title: trimmedTitle,
      description: trimmedDescription,
      status: "todo",
      priority,
      taskType: "standard",
    });
  }

  function tasksInColumn(status: TaskStatus): Task[] {
    if (!tasks) return [];
    return tasks.filter((t) => (t.status as TaskStatus) === status);
  }

  return (
    <UniversalLayout title="Task Board">
      <div className="max-w-[1600px] mx-auto px-8 pb-12">
        <header className="flex justify-between items-end mb-10">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#2c2f30]">
              Task Board
            </h1>
            <p className="text-slate-500 font-medium">
              Plan, track, and complete tasks across your company.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-[#6a37d4] text-white px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm hover:bg-[#5a2dc0]"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? "Cancel" : "Create Task"}
          </Button>
        </header>

        {showCreate && (
          <Card className="p-6 mb-8 bg-white shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-[#2c2f30]">
                  New task
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowCreate(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Title
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Finalize Q4 launch plan"
                  disabled={createMutation.isPending}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Description
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline the release checklist, confirm marketing assets, and schedule the go-live."
                  disabled={createMutation.isPending}
                  required
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Priority
                </Label>
                <div className="flex gap-2">
                  {(["low", "medium", "high", "urgent"] as TaskPriority[]).map(
                    (p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        disabled={createMutation.isPending}
                        className={
                          "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors " +
                          (priority === p
                            ? priorityStyles[p]
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100")
                        }
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !title.trim() ||
                    !description.trim()
                  }
                  className="bg-[#6a37d4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create task"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span className="text-sm">Loading tasks…</span>
          </div>
        )}

        {error && !isLoading && (
          <Card className="p-6 bg-red-50 border border-red-200 max-w-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  Couldn't load tasks
                </p>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
              </div>
            </div>
          </Card>
        )}

        {!isLoading && !error && tasks && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statusColumns.map((column) => {
              const columnTasks = tasksInColumn(column.id);
              const Icon = column.icon;
              return (
                <div key={column.id} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${column.accent}`} />
                      <h2 className="font-bold text-[#2c2f30] text-lg">
                        {column.title}
                      </h2>
                      <Badge className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-bold">
                        {columnTasks.length}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {columnTasks.length === 0 ? (
                      <div className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                        No tasks
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const priority = (task.priority ??
                          "medium") as TaskPriority;
                        const currentStatus = (task.status ??
                          "todo") as TaskStatus;
                        const backStatus = prevStatus(currentStatus);
                        const forwardStatus = nextStatus(currentStatus);
                        const isUpdating =
                          updateStatusMutation.isPending &&
                          updateStatusMutation.variables?.id === task.id;
                        return (
                          <Card
                            key={task.id}
                            className="p-4 bg-white hover:shadow-[0_12px_40px_rgba(106,55,212,0.10)] transition-shadow"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge
                                className={`${priorityStyles[priority]} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded`}
                              >
                                {priority}
                              </Badge>
                              <button
                                type="button"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(task.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <h3
                              className={
                                "font-semibold text-sm text-[#2c2f30] mb-1 leading-snug " +
                                (currentStatus === "done"
                                  ? "line-through decoration-slate-400"
                                  : "")
                              }
                            >
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              {backStatus && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: task.id,
                                      status: backStatus,
                                    })
                                  }
                                  className="h-7 px-2 text-xs text-slate-500 hover:text-[#6a37d4]"
                                >
                                  <ArrowLeft className="h-3 w-3 mr-1" />
                                  {statusColumns.find((c) => c.id === backStatus)?.title}
                                </Button>
                              )}
                              {forwardStatus && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: task.id,
                                      status: forwardStatus,
                                    })
                                  }
                                  className="h-7 px-2 text-xs text-slate-500 hover:text-[#6a37d4] ml-auto"
                                >
                                  {statusColumns.find((c) => c.id === forwardStatus)?.title}
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                              {isUpdating && (
                                <Loader2 className="h-3 w-3 animate-spin text-slate-400 ml-auto" />
                              )}
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UniversalLayout>
  );
}
