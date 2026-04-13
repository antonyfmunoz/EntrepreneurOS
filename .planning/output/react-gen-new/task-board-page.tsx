import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Filter,
  GripVertical,
  Calendar,
  AlertCircle,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { UniversalLayout } from '@/components/universal-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { designTokens } from '@/lib/design-tokens';
import { useToast } from '@/components/ui/use-toast';

type TaskStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  createdBy: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface AgentSlot {
  id: string;
  name: string;
  isActive: boolean;
}

interface AssigneeSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  users: User[];
  agentSlots: AgentSlot[];
}

function AssigneeSelector({ value, onChange, users, agentSlots }: AssigneeSelectorProps) {
  return (
    <Select value={value || 'unassigned'} onValueChange={(v) => onChange(v === 'unassigned' ? null : v)}>
      <SelectTrigger style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}>
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {agentSlots.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.name} (AI)
          </SelectItem>
        ))}
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  users: User[];
  agentSlots: AgentSlot[];
}

function TaskCard({ task, onEdit, users, agentSlots }: TaskCardProps) {
  const assignee = [...users, ...agentSlots].find((a) => a.id === task.assigneeId);
  const priorityColors = {
    low: designTokens.colors.surfaceContainerLow,
    medium: designTokens.colors.secondaryContainer,
    high: designTokens.colors.tertiaryContainer,
    critical: designTokens.colors.primary,
  };

  const priorityTextColors = {
    low: designTokens.colors.onSurface,
    medium: designTokens.colors.onSecondaryContainer,
    high: designTokens.colors.onTertiaryContainer,
    critical: designTokens.colors.onPrimary,
  };

  return (
    <Card
      className="p-4 cursor-pointer transition-all mb-3"
      onClick={onEdit}
      style={{
        backgroundColor: designTokens.colors.surfaceContainerLowest,
        boxShadow: '0 8px 32px rgba(106,55,212,0.08)',
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: designTokens.colors.outlineVariant }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-sm" style={{ color: designTokens.colors.onSurface }}>
              {task.title}
            </h4>
            <div
              className="px-2 py-0.5 text-xs font-medium uppercase tracking-wide whitespace-nowrap"
              style={{
                backgroundColor: priorityColors[task.priority],
                color: priorityTextColors[task.priority],
                borderRadius: designTokens.spacing.borderRadius,
              }}
            >
              {task.priority}
            </div>
          </div>
          {task.description && (
            <p className="text-sm mb-2 line-clamp-2" style={{ color: designTokens.colors.onSurfaceVariant }}>
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 text-xs" style={{ color: designTokens.colors.onSurfaceVariant }}>
            <span>{assignee ? assignee.name : 'Unassigned'}</span>
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TaskCardSkeleton() {
  return (
    <div
      className="p-4 mb-3 animate-pulse"
      style={{
        backgroundColor: designTokens.colors.surfaceContainerLowest,
        borderRadius: designTokens.spacing.borderRadius,
      }}
    >
      <div className="flex gap-2">
        <div className="w-4 h-4 mt-1" style={{ backgroundColor: designTokens.colors.outlineVariant, opacity: 0.3 }} />
        <div className="flex-1">
          <div className="h-4 mb-2" style={{ backgroundColor: designTokens.colors.surfaceContainerLow, borderRadius: '4px' }} />
          <div className="h-3 mb-2 w-3/4" style={{ backgroundColor: designTokens.colors.surfaceContainerLow, borderRadius: '4px' }} />
          <div className="h-3 w-1/2" style={{ backgroundColor: designTokens.colors.surfaceContainerLow, borderRadius: '4px' }} />
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  onEdit: (task: Task) => void;
  users: User[];
  agentSlots: AgentSlot[];
  isEmpty: boolean;
  onCreateFirst?: () => void;
}

function KanbanColumn({ title, status, tasks, onEdit, users, agentSlots, isEmpty, onCreateFirst }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-80 lg:w-96">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-base" style={{ color: designTokens.colors.onSurface }}>
            {title}
          </h3>
          <span
            className="text-xs font-medium px-2 py-1"
            style={{
              backgroundColor: designTokens.colors.surfaceContainerHigh,
              color: designTokens.colors.onSurfaceVariant,
              borderRadius: designTokens.spacing.borderRadius,
            }}
          >
            {tasks.length}
          </span>
        </div>
      </div>
      <div className="min-h-[400px]">
        {isEmpty && status === 'backlog' && onCreateFirst ? (
          <Card
            className="p-8 text-center"
            style={{
              backgroundColor: designTokens.colors.surfaceContainerLowest,
              borderRadius: designTokens.spacing.borderRadius,
            }}
          >
            <p className="text-sm mb-4" style={{ color: designTokens.colors.onSurfaceVariant }}>
              No tasks in backlog. Create your first task to get started.
            </p>
            <Button onClick={onCreateFirst} style={{ backgroundColor: designTokens.colors.primary, color: designTokens.colors.onPrimary }}>
              Create your first task
            </Button>
          </Card>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => onEdit(task)} users={users} agentSlots={agentSlots} />)
        )}
      </div>
    </div>
  );
}

interface TaskFiltersProps {
  assigneeFilter: string | null;
  priorityFilter: string | null;
  onAssigneeChange: (value: string | null) => void;
  onPriorityChange: (value: string | null) => void;
  users: User[];
  agentSlots: AgentSlot[];
}

function TaskFilters({ assigneeFilter, priorityFilter, onAssigneeChange, onPriorityChange, users, agentSlots }: TaskFiltersProps) {
  const activeFilterCount = [assigneeFilter, priorityFilter].filter(Boolean).length;

  return (
    <div className="flex items-center gap-4 flex-wrap mb-6">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4" style={{ color: designTokens.colors.onSurfaceVariant }} />
        <span className="text-sm font-medium" style={{ color: designTokens.colors.onSurface }}>
          Filters
        </span>
        {activeFilterCount > 0 && (
          <span
            className="text-xs font-medium px-2 py-0.5"
            style={{
              backgroundColor: designTokens.colors.primary,
              color: designTokens.colors.onPrimary,
              borderRadius: '12px',
            }}
          >
            {activeFilterCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="assignee-filter" className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
          Assignee
        </Label>
        <Select value={assigneeFilter || 'all'} onValueChange={(v) => onAssigneeChange(v === 'all' ? null : v)}>
          <SelectTrigger id="assignee-filter" className="w-48" style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agentSlots.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name} (AI)
              </SelectItem>
            ))}
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="priority-filter" className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
          Priority
        </Label>
        <Select value={priorityFilter || 'all'} onValueChange={(v) => onPriorityChange(v === 'all' ? null : v)}>
          <SelectTrigger id="priority-filter" className="w-40" style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Task>) => void;
  users: User[];
  agentSlots: AgentSlot[];
}

function CreateTaskDialog({ open, onOpenChange, onSubmit, users, agentSlots }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title,
      description,
      priority,
      assigneeId,
      dueDate: dueDate || null,
      status: 'backlog',
    });
    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssigneeId(null);
    setDueDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: designTokens.colors.surface }}>
        <DialogHeader>
          <DialogTitle style={{ color: designTokens.colors.onSurface }}>Create task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="title" style={{ color: designTokens.colors.onSurface }}>
              Task title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Design landing page"
              style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}
            />
          </div>
          <div>
            <Label htmlFor="description" style={{ color: designTokens.colors.onSurface }}>
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority" style={{ color: designTokens.colors.onSurface }}>
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="priority" style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate" style={{ color: designTokens.colors.onSurface }}>
                Due date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="assignee" style={{ color: designTokens.colors.onSurface }}>
              Assign to
            </Label>
            <AssigneeSelector value={assigneeId} onChange={setAssigneeId} users={users} agentSlots={agentSlots} />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} style={{ color: designTokens.colors.onSurface }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim()} style={{ backgroundColor: designTokens.colors.primary, color: designTokens.colors.onPrimary }}>
              Create task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  users: User[];
  agentSlots: AgentSlot[];
}

function EditTaskDialog({ task, open, onOpenChange, onUpdate, onDelete, users, agentSlots }: EditTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');

  useState(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setStatus(task.status);
      setAssigneeId(task.assigneeId);
      setDueDate(task.dueDate || '');
    }
  });

  const handleUpdate = () => {
    if (!task || !title.trim()) return;
    onUpdate(task.id, {
      title,
      description,
      priority,
      status,
      assigneeId,
      dueDate: dueDate || null,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!task) return;
    onDelete(task.id);
    onOpenChange(false);
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: designTokens.colors.surface }}>
        <DialogHeader>
          <DialogTitle style={{ color: designTokens.colors.onSurface }}>Edit task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="edit-title" style={{ color: designTokens.colors.onSurface }}>
              Task title
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}
            />
          </div>
          <div>
            <Label htmlFor="edit-description" style={{ color: designTokens.colors.onSurface }}>
              Description
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-priority" style={{ color: designTokens.colors.onSurface }}>
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="edit-priority" style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-status" style={{ color: designTokens.colors.onSurface }}>
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="edit-status" style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit-dueDate" style={{ color: designTokens.colors.onSurface }}>
              Due date
            </Label>
            <Input
              id="edit-dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ backgroundColor: designTokens.colors.surfaceContainerHighest }}
            />
          </div>
          <div>
            <Label htmlFor="edit-assignee" style={{ color: designTokens.colors.onSurface }}>
              Assign to
            </Label>
            <AssigneeSelector value={assigneeId} onChange={setAssigneeId} users={users} agentSlots={agentSlots} />
          </div>
          <div className="flex gap-2 justify-between pt-4">
            <Button variant="ghost" onClick={handleDelete} style={{ color: designTokens.colors.error }}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} style={{ color: designTokens.colors.onSurface }}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={!title.trim()} style={{ backgroundColor: designTokens.colors.primary, color: designTokens.colors.onPrimary }}>
                <Check className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskBoardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['tasks', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/tasks`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json() as Promise<{ tasks: Task[]; users: User[]; agentSlots: AgentSlot[] }>;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await fetch(`/api/companies/${companyId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', companyId] });
      toast({ title: 'Task created.' });
    },
    onError: () => {
      toast({ title: 'Failed to create task. Try again.', variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const res = await fetch(`/api/companies/${companyId}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', companyId] });
      toast({ title: 'Task updated.' });
    },
    onError: () => {
      toast({ title: 'Failed to update task. Try again.', variant: 'destructive' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${companyId}/tasks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', companyId] });
      toast({ title: 'Task deleted.' });
    },
    onError: () => {
      toast({ title: 'Failed to delete task. Try again.', variant: 'destructive' });
    },
  });

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setEditDialogOpen(true);
  };

  const tasks = tasksData?.tasks || [];
  const users = tasksData?.users || [];
  const agentSlots = tasksData?.agentSlots || [];

  const filteredTasks = tasks.filter((task) => {
    if (assigneeFilter && assigneeFilter !== 'unassigned' && task.assigneeId !== assigneeFilter) return false;
    if (assigneeFilter === 'unassigned' && task.assigneeId !== null) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    return true;
  });

  const tasksByStatus = {
    backlog: filteredTasks.filter((t) => t.status === 'backlog'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    in_review: filteredTasks.filter((t) => t.status === 'in_review'),
    done: filteredTasks.filter((t) => t.status === 'done'),
  };

  const columns = [
    { title: 'Backlog', status: 'backlog' as TaskStatus },
    { title: 'In Progress', status: 'in_progress' as TaskStatus },
    { title: 'In Review', status: 'in_review' as TaskStatus },
    { title: 'Done', status: 'done' as TaskStatus },
  ];

  return (
    <UniversalLayout>
      <div className="flex-1 overflow-auto" style={{ backgroundColor: designTokens.colors.background }}>
        <div className="p-6 lg:p-8" style={{ backgroundColor: designTokens.colors.surfaceContainerLow }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-semibold" style={{ color: designTokens.colors.onSurface }}>
                  Task Board
                </h1>
                <p className="text-sm mt-1" style={{ color: designTokens.colors.onSurfaceVariant }}>
                  Drag tasks between columns. Assign to your team or your assistant.
                </p>
              </div>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                style={{ backgroundColor: designTokens.colors.primary, color: designTokens.colors.onPrimary }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create task
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {tasksError ? (
              <Card className="p-8 text-center" style={{ backgroundColor: designTokens.colors.surfaceContainerLowest }}>
                <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: designTokens.colors.error }} />
                <p className="text-sm mb-4" style={{ color: designTokens.colors.onSurface }}>
                  Failed to load tasks. Try again.
                </p>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['tasks', companyId] })} style={{ backgroundColor: designTokens.colors.primary, color: designTokens.colors.onPrimary }}>
                  Retry
                </Button>
              </Card>
            ) : (
              <>
                <TaskFilters
                  assigneeFilter={assigneeFilter}
                  priorityFilter={priorityFilter}
                  onAssigneeChange={setAssigneeFilter}
                  onPriorityChange={setPriorityFilter}
                  users={users}
                  agentSlots={agentSlots}
                />
                <div className="overflow-x-auto -mx-6 lg:-mx-8 px-6 lg:px-8">
                  <div className="flex gap-6 pb-6">
                    {tasksLoading ? (
                      columns.map((col) => (
                        <div key={col.status} className="flex-shrink-0 w-80 lg:w-96">
                          <h3 className="font-semibold text-base mb-4" style={{ color: designTokens.colors.onSurface }}>
                            {col.title}
                          </h3>
                          <TaskCardSkeleton />
                          <TaskCardSkeleton />
                        </div>
                      ))
                    ) : (
                      columns.map((col) => (
                        <KanbanColumn
                          key={col.status}
                          title={col.title}
                          status={col.status}
                          tasks={tasksByStatus[col.status]}
                          onEdit={handleEdit}
                          users={users}
                          agentSlots={agentSlots}
                          isEmpty={tasks.length === 0 && !assigneeFilter && !priorityFilter}
                          onCreateFirst={col.status === 'backlog' ? () => setCreateDialogOpen(true) : undefined}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={(data) => createTaskMutation.mutate(data)}
        users={users}
        agentSlots={agentSlots}
      />

      <EditTaskDialog
        task={selectedTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdate={(id, data) => updateTaskMutation.mutate({ id, data })}
        onDelete={(id) => deleteTaskMutation.mutate(id)}
        users={users}
        agentSlots={agentSlots}
      />
    </UniversalLayout>
  );
}