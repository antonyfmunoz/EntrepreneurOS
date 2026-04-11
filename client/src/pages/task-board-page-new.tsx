// ⚠ MANUAL REVIEW REQUIRED
// This file was written in supplement mode because an existing page at
// the same kebab filename (task-board-page.tsx) already owns
// the spec page name. Both pages now exist.
//
// Hand-merge: pick which one is authoritative, port any missing logic
// from the other, wire the winner into the route, and delete the loser.
// The integration planner will not repeat this collision once one file
// is deleted.

import { useState } from "react";
import { Link } from "wouter";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Filter,
  ChevronDown,
  MoreHorizontal,
  GripVertical,
  MessageSquare,
  Paperclip,
  Zap,
  CheckCircle2,
  Lightbulb,
  Clock,
  ArrowUpDown,
  Wand2,
  Bot
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  assignee: {
    type: "human" | "ai";
    name: string;
    avatar?: string;
  };
  status: "backlog" | "in-progress" | "in-review" | "done";
  progress?: number;
  attachments?: number;
  comments?: number;
  isActive?: boolean;
  completedDate?: string;
}

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Review Q3 Revenue Data",
    priority: "high",
    assignee: { type: "ai", name: "DEX AI" },
    status: "backlog",
    comments: 0
  },
  {
    id: "2",
    title: "Onboard New Lead Engineer",
    priority: "medium",
    assignee: {
      type: "human",
      name: "Sarah C.",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCnw3YeSKthBnXWxtYdHxNrezQmKVz5iNrVEnwb7NQ1vw7WnBjdfwL_SKlf-1FB0lSlYr_OribH3pctAZme3ZQ2Os1ohUWalvz40VkxSKRu5loEjPkM8Tp9s72Czs62PFj2KRkBRzGKx8o-OkBy3xlIPcW8TGQ75H_QXK8F-fF2B-9BtKizgdcQbils03jlh-Ji9EZ5kdUXS2sDQYwQHEduJS22aCa4RAJ1WUnAdPlbHK8vz09tz0NDxuE_75ZCpJWwKWFyt5oJkYTC"
    },
    status: "backlog",
    attachments: 3
  },
  {
    id: "3",
    title: "Finalize Series B Deck",
    priority: "critical",
    assignee: {
      type: "human",
      name: "You",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCEmurMIyLmtrRgrEUCWKX35wnooMCbYsENG9YKeMbJSecDnTyWoY5LSVwodZRrerTiJdTd_ImjYTsKTNe-kSYzaHSGc-ISepK5VV4X4uRVHLKzqgEsI3GMDgmONxDkGFZ0Ab56kCcdUIy9wKAxRnnrRRVASfw9EDa-Z7IhrpE4kFsD3ku0KV5gOK7aDUypw58blikShccUWnY8RVcCggqN_FlgzxsEq1u7fO3r9Plx2QQIP7TFTze8-04x_5obqdI9ct0VWzrlYVA2"
    },
    status: "in-progress",
    progress: 80
  },
  {
    id: "4",
    title: "Automate Sales Pipeline",
    priority: "high",
    assignee: { type: "ai", name: "DEX AI" },
    status: "in-progress",
    isActive: true
  },
  {
    id: "5",
    title: "Company Entity Registration",
    priority: "medium",
    assignee: {
      type: "human",
      name: "Marcus J.",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBL89h-7Y-6vT_kc_FP3OxHEqd9s28B7lclw1r3Css_kMW8AL33r72_vKRnfCd342glbDhNjiHIv1s0kvKfGinVRjLpOwrlhWOn-o2ep52hEPPrkQ0bG5fQAT4D0yoNwiDfTR9SHgfUnvIqZP8Vs0HkvNb3BHAqxwgRnmezoSeHV6uzozriBk_lCSbce2Y_irnL9uZr-rCjxt4Nv-hpgQqaiMvPB-c8SjyfBL_UYC4vcqxDYy96Wb4fUBG0DoOqaCDrUngyEeXzqr8-"
    },
    status: "done",
    completedDate: "Sep 12"
  }
];

const columns = [
  { id: "backlog", title: "Backlog", color: "text-on-surface-variant" },
  { id: "in-progress", title: "In Progress", color: "text-primary" },
  { id: "in-review", title: "In Review", color: "text-on-surface-variant" },
  { id: "done", title: "Done", color: "text-tertiary" }
] as const;

const getPriorityConfig = (priority: Task["priority"]) => {
  switch (priority) {
    case "critical":
      return { label: "Critical", className: "bg-error text-white" };
    case "high":
      return { label: "High", className: "bg-error/10 text-error" };
    case "medium":
      return { label: "Medium", className: "bg-secondary/10 text-secondary" };
    case "low":
      return { label: "Low", className: "bg-outline-variant/10 text-outline" };
  }
};

function TaskCard({ task }: { task: Task }) {
  const priorityConfig = getPriorityConfig(task.priority);
  const isDone = task.status === "done";

  return (
    <Card
      className={`p-5 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] group cursor-grab active:cursor-grabbing border border-transparent hover:border-primary/10 transition-all ${
        task.priority === "critical" && task.status === "in-progress"
          ? "border-l-4 border-l-error"
          : ""
      } ${isDone ? "opacity-70 bg-surface-container-lowest/60" : "bg-surface-container-lowest"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge
          className={`${priorityConfig.className} text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-sm`}
        >
          {isDone ? "Done" : priorityConfig.label}
        </Badge>
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-tertiary fill-tertiary" />
        ) : (
          <GripVertical className="h-4 w-4 text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <h3
        className={`font-bold text-on-surface mb-4 leading-tight ${
          isDone ? "line-through decoration-on-surface/30" : ""
        }`}
      >
        {task.title}
      </h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignee.type === "ai" ? (
            <>
              <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-white">
                <Zap className="h-3.5 w-3.5 fill-white" />
              </div>
              <span className="text-[11px] font-medium text-outline">
                {task.assignee.name}
              </span>
            </>
          ) : (
            <>
              <Avatar className="w-6 h-6">
                <AvatarImage src={task.assignee.avatar} />
                <AvatarFallback>{task.assignee.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-medium text-outline">
                {task.assignee.name}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.progress !== undefined && (
            <>
              <Progress value={task.progress} className="w-8 h-1" />
              <span className="text-[10px] font-bold text-outline">
                {task.progress}%
              </span>
            </>
          )}
          {task.isActive && (
            <div className="px-2 py-1 bg-primary/5 rounded flex items-center gap-1">
              <Wand2 className="h-2.5 w-2.5 text-primary" />
              <span className="text-[9px] font-bold text-primary uppercase">
                Active
              </span>
            </div>
          )}
          {task.attachments !== undefined && task.attachments > 0 && (
            <>
              <Paperclip className="h-3.5 w-3.5 text-outline" />
              <span className="text-[10px] font-bold text-outline">
                {task.attachments}
              </span>
            </>
          )}
          {task.comments !== undefined && task.comments > 0 && (
            <MessageSquare className="h-3.5 w-3.5 text-outline" />
          )}
          {task.completedDate && (
            <span className="text-[10px] font-bold text-outline">
              {task.completedDate}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function KanbanColumn({
  column,
  tasks
}: {
  column: (typeof columns)[number];
  tasks: Task[];
}) {
  const taskCount = tasks.length;
  const isEmpty = taskCount === 0;

  return (
    <div className="kanban-column flex flex-col gap-4 min-w-[320px]">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h2 className="font-extrabold text-on-surface text-lg">
            {column.title}
          </h2>
          <Badge
            className={`${
              column.id === "in-progress"
                ? "bg-primary/10 text-primary"
                : column.id === "done"
                ? "bg-tertiary/10 text-tertiary"
                : "bg-surface-container-high text-on-surface-variant"
            } text-xs px-2 py-0.5 rounded-full font-bold`}
          >
            {taskCount}
          </Badge>
        </div>
        <MoreHorizontal className="h-5 w-5 text-outline cursor-pointer" />
      </div>
      <div className="flex flex-col gap-4">
        {isEmpty ? (
          <div className="h-32 border-2 border-dashed border-outline-variant/20 rounded-2xl flex flex-col items-center justify-center text-outline-variant gap-2 bg-surface-container-low/30">
            <Plus className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Drop here
            </span>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

export default function TaskBoard() {
  const [tasks] = useState<Task[]>(mockTasks);

  const getTasksByStatus = (status: Task["status"]) =>
    tasks.filter((task) => task.status === status);

  return (
    <UniversalLayout title="Task Board">
      <div className="max-w-[1600px] mx-auto px-8 pb-12">
        <header className="flex justify-between items-end mb-10">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">
              Task Board
            </h1>
            <p className="text-on-surface-variant/70 font-medium">
              Operational oversight and autonomous task execution.
            </p>
          </div>
          <Button className="bg-primary-container text-white px-6 py-3 rounded-xl font-bold text-sm shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[0.98] transition-transform flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </header>

        <section className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl">
            <Filter className="h-4 w-4 text-outline" />
            <span className="text-xs font-bold text-outline uppercase tracking-widest">
              Filters
            </span>
          </div>
          <Button
            variant="ghost"
            className="bg-surface-container-lowest px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 text-on-surface-variant hover:bg-white transition-colors"
          >
            Assignee: All
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            className="bg-surface-container-lowest px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 text-on-surface-variant hover:bg-white transition-colors"
          >
            Priority: Any
            <ChevronDown className="h-3 w-3" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-outline">
              Sorted by: Priority
            </span>
            <ArrowUpDown className="h-4 w-4 text-outline" />
          </div>
        </section>

        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getTasksByStatus(column.id)}
            />
          ))}
        </div>
      </div>

      <aside className="hidden xl:flex fixed right-0 top-0 h-screen w-80 pt-24 pb-8 px-6 bg-surface-container-low flex-col gap-8 z-40">
        <section>
          <h4 className="text-xs font-black text-outline uppercase tracking-widest mb-6">
            Agent Status
          </h4>
          <Card className="bg-white p-4 rounded-2xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>
              <div>
                <p className="font-bold text-sm text-on-surface">
                  DEX-01 Core
                </p>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">
                  Active Optimization
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-on-surface-variant">
                <span>CPU LOAD</span>
                <span>12%</span>
              </div>
              <Progress value={12} className="h-1.5" />
            </div>
          </Card>
        </section>

        <section className="flex-grow">
          <h4 className="text-xs font-black text-outline uppercase tracking-widest mb-6">
            AI Insights
          </h4>
          <div className="space-y-4">
            <Card className="bg-primary/5 p-4 rounded-2xl border-l-2 border-primary">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <Lightbulb className="h-3.5 w-3.5" />
                <span className="text-[11px] font-black uppercase tracking-tight">
                  Bottleneck Alert
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                "Finalize Series B Deck" is at 80% but has stalled for 6 hours.
                Recommend delegating financial appendix to DEX AI.
              </p>
              <button className="mt-3 text-[10px] font-bold text-primary hover:underline">
                Apply Action
              </button>
            </Card>
            <Card className="bg-white/50 p-4 rounded-2xl border border-transparent">
              <div className="flex items-center gap-2 mb-2 text-outline">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[11px] font-black uppercase tracking-tight">
                  Workflow Trend
                </span>
              </div>
              <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                Sales pipeline automation has increased throughput by 42% this
                week.
              </p>
            </Card>
          </div>
        </section>

        <footer className="mt-auto">
          <div className="flex gap-4 mb-4">
            <Link
              href="/support"
              className="text-[10px] font-bold text-outline hover:text-primary transition-colors uppercase tracking-widest"
            >
              Support
            </Link>
            <Link
              href="/docs"
              className="text-[10px] font-bold text-outline hover:text-primary transition-colors uppercase tracking-widest"
            >
              Docs
            </Link>
          </div>
          <p className="text-[10px] text-outline-variant font-medium">
            © 2024 EntrepreneurOS
          </p>
        </footer>
      </aside>
    </UniversalLayout>
  );
}