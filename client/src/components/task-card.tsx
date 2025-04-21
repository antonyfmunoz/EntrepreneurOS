import { Badge } from "@/components/ui/badge";
import { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: "todo" | "in-progress" | "done";
  instructions?: string;
  agent: {
    id: string;
    name: string;
    role: string;
  } | null;
};

type TaskCardProps = {
  task: Task;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onEdit?: (task: Task) => void;
  badgeVariant?: VariantProps<typeof Badge>["variant"];
  isDone?: boolean;
};

export function TaskCard({ task, onMoveLeft, onMoveRight, onEdit, badgeVariant = "default", isDone = false }: TaskCardProps) {
  const formatDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dueDate = new Date(task.dueDate);
    
    if (isDone) {
      return (
        <div className="flex items-center text-xs space-x-1 text-gray-500">
          <i className="ri-check-line text-green-500"></i>
          <span>Completed</span>
        </div>
      );
    }
    
    if (dueDate.toDateString() === today.toDateString()) {
      return (
        <div className="flex items-center text-xs space-x-1 text-gray-500">
          <i className="ri-time-line"></i>
          <span>Due today</span>
        </div>
      );
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      return (
        <div className="flex items-center text-xs space-x-1 text-gray-500">
          <i className="ri-time-line"></i>
          <span>Due tomorrow</span>
        </div>
      );
    } else {
      // Calculate difference in days
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return (
          <div className="flex items-center text-xs space-x-1 text-red-500">
            <i className="ri-alarm-warning-line"></i>
            <span>Overdue by {Math.abs(diffDays)} days</span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center text-xs space-x-1 text-gray-500">
            <i className="ri-time-line"></i>
            <span>Due in {diffDays} days</span>
          </div>
        );
      }
    }
  };

  return (
    <div className="bg-gray-50 p-3 rounded border border-gray-200 shadow-sm hover:shadow transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-gray-800">{task.title}</h4>
        {formatDate()}
      </div>
      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
      {task.instructions && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Instructions:</p>
          <p className="text-xs text-gray-600 bg-gray-100 p-2 rounded">{task.instructions}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Badge variant={badgeVariant}>
          {task.agent ? task.agent.name : 'Unassigned'}
        </Badge>
        <div className="flex space-x-1">
          {onEdit && (
            <button 
              className="text-gray-500 hover:text-blue-600" 
              title="Edit task"
              onClick={() => onEdit(task)}
            >
              <i className="ri-edit-line"></i>
            </button>
          )}
          {onMoveLeft && (
            <button 
              className="text-gray-400 hover:text-gray-600" 
              title="Move back"
              onClick={onMoveLeft}
            >
              <i className="ri-arrow-left-line"></i>
            </button>
          )}
          {onMoveRight && (
            <button 
              className="text-primary hover:text-blue-700" 
              title="Move forward"
              onClick={onMoveRight}
            >
              <i className="ri-arrow-right-line"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
