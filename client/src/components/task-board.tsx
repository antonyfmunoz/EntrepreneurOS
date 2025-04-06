import { useState } from "react";
import { TaskCard } from "./task-card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: "todo" | "in-progress" | "done";
  agent: {
    id: string;
    name: string;
    role: string;
  } | null;
};

type Agent = {
  id: string;
  name: string;
  role: string;
};

export function TaskBoard() {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    dueDate: "",
    agentId: ""
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const res = await apiRequest("POST", "/api/tasks", taskData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsAddTaskOpen(false);
      resetTaskForm();
    }
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string, status: string }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    }
  });

  const resetTaskForm = () => {
    setNewTask({
      title: "",
      description: "",
      dueDate: "",
      agentId: ""
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createTaskMutation.mutate(newTask);
  };

  const moveTask = (taskId: string, newStatus: "todo" | "in-progress" | "done") => {
    updateTaskStatusMutation.mutate({ taskId, status: newStatus });
  };

  const todoTasks = tasks.filter(task => task.status === "todo");
  const inProgressTasks = tasks.filter(task => task.status === "in-progress");
  const doneTasks = tasks.filter(task => task.status === "done");

  const getBadgeVariantFromRole = (role: string) => {
    switch (role) {
      case "marketing":
        return "marketing";
      case "support":
        return "support";
      case "content":
        return "content";
      case "operations":
        return "operations";
      default:
        return "default";
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Task Board</h2>
        <Button 
          onClick={() => setIsAddTaskOpen(true)}
          className="text-sm flex items-center space-x-1 text-primary bg-transparent hover:bg-primary/10"
        >
          <i className="ri-add-line"></i>
          <span>Add Task</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* To Do Column */}
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-700 flex items-center">
              <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
              To Do
            </h3>
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">{todoTasks.length}</span>
          </div>
          
          <div className="space-y-3">
            {todoTasks.map(task => (
              <TaskCard 
                key={task.id}
                task={task}
                badgeVariant={task.agent ? getBadgeVariantFromRole(task.agent.role) : undefined}
                onMoveRight={() => moveTask(task.id, "in-progress")}
              />
            ))}
          </div>
        </div>
        
        {/* In Progress Column */}
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-700 flex items-center">
              <span className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></span>
              In Progress
            </h3>
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">{inProgressTasks.length}</span>
          </div>
          
          <div className="space-y-3">
            {inProgressTasks.map(task => (
              <TaskCard 
                key={task.id}
                task={task}
                badgeVariant={task.agent ? getBadgeVariantFromRole(task.agent.role) : undefined}
                onMoveLeft={() => moveTask(task.id, "todo")}
                onMoveRight={() => moveTask(task.id, "done")}
              />
            ))}
          </div>
        </div>
        
        {/* Done Column */}
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-700 flex items-center">
              <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              Done
            </h3>
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">{doneTasks.length}</span>
          </div>
          
          <div className="space-y-3">
            {doneTasks.map(task => (
              <TaskCard 
                key={task.id}
                task={task}
                badgeVariant={task.agent ? getBadgeVariantFromRole(task.agent.role) : undefined}
                onMoveLeft={() => moveTask(task.id, "in-progress")}
                isDone
              />
            ))}
          </div>
        </div>
      </div>

      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input 
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  placeholder="Enter task title"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Describe the task..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent">Assign to Agent</Label>
                <Select 
                  value={newTask.agentId} 
                  onValueChange={(value) => setNewTask({...newTask, agentId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
