import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Workflow,
  Users,
  Building2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
  ListTodo,
  FileText,
  Network,
  Home,
  CheckSquare,
  Settings,
  MessageSquare,
} from "lucide-react";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import type { Company, Task } from "@shared/schema";

interface WorkflowSummary {
  id: string;
  name: string;
  status?: string | null;
}

interface CommandCenterProps {
  params: {
    companyId: string;
  };
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: string;
  isLoading?: boolean;
  onClick?: () => void;
}

function KPICardSkeleton() {
  return (
    <div className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 bg-[#eff1f2] rounded-xl" />
        <div className="w-8 h-4 bg-[#eff1f2] rounded" />
      </div>
      <div className="h-8 w-20 bg-[#eff1f2] rounded mb-2" />
      <div className="h-4 w-24 bg-[#eff1f2] rounded" />
    </div>
  );
}

function KPICard({ icon, label, value, trend, isLoading, onClick }: KPICardProps) {
  return (
    <Card
      className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.7)] hover:backdrop-blur-[16px] cursor-pointer border-none"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 bg-[#f5f6f7] rounded-xl flex items-center justify-center text-[#6a37d4]">
          {icon}
        </div>
        {trend && (
          <span className="text-xs uppercase tracking-[0.05em] text-[#595c5d]">{trend}</span>
        )}
      </div>
      <div className="text-4xl font-semibold text-[#2c2f30] mb-2">
        {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-slate-300" /> : value}
      </div>
      <div className="text-xs uppercase tracking-[0.05em] text-[#595c5d]">{label}</div>
    </Card>
  );
}

function WorkflowListItem({ workflow, companyId }: { workflow: WorkflowSummary; companyId: string }) {
  const status = workflow.status ?? "active";
  const statusConfig: Record<string, { label: string; color: string }> = {
    active: { label: "In Progress", color: "#6a37d4" },
    paused: { label: "Paused", color: "#595c5d" },
    completed: { label: "Completed", color: "#6a37d4" },
  };

  const config = statusConfig[status] ?? statusConfig.active;

  return (
    <Link href={`/company/${companyId}/workflows`}>
      <div className="p-6 bg-white hover:bg-[#f5f6f7] transition-colors duration-150 cursor-pointer first:rounded-t-xl last:rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-[#2c2f30] mb-1">{workflow.name}</h4>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="text-xs uppercase tracking-[0.05em] px-3 py-1 rounded-xl"
              style={{ color: config.color, backgroundColor: `${config.color}15` }}
            >
              {config.label}
            </span>
            <ChevronRight className="w-5 h-5 text-[#abadae]" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function TaskListItem({ task, companyId }: { task: Task; companyId: string }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    backlog: { label: "Backlog", color: "#595c5d" },
    in_progress: { label: "In Progress", color: "#6a37d4" },
    in_review: { label: "In Review", color: "#6448b2" },
    done: { label: "Done", color: "#6a37d4" },
  };

  const priorityConfig: Record<string, { icon: typeof AlertCircle; color: string }> = {
    critical: { icon: AlertCircle, color: "#6a37d4" },
    high: { icon: AlertCircle, color: "#6448b2" },
    medium: { icon: Clock, color: "#595c5d" },
    low: { icon: Clock, color: "#abadae" },
  };

  const status = statusConfig[task.status ?? "backlog"] ?? statusConfig.backlog;
  const priority = priorityConfig[task.priority ?? "medium"] ?? priorityConfig.medium;
  const PriorityIcon = priority.icon;

  return (
    <Link href={`/company/${companyId}/tasks`}>
      <div className="p-6 bg-white hover:bg-[#f5f6f7] transition-colors duration-150 cursor-pointer first:rounded-t-xl last:rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <PriorityIcon className="w-4 h-4" style={{ color: priority.color }} />
            <span className="font-medium text-[#2c2f30]">{task.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="text-xs uppercase tracking-[0.05em] px-3 py-1 rounded-xl"
              style={{ color: status.color, backgroundColor: `${status.color}15` }}
            >
              {status.label}
            </span>
            <ChevronRight className="w-5 h-5 text-[#abadae]" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="bg-white p-8 rounded-xl text-center">
      <div className="w-16 h-16 bg-[#f5f6f7] rounded-xl flex items-center justify-center mx-auto mb-6">
        <Icon className="w-8 h-8 text-[#6a37d4]" />
      </div>
      <h3 className="font-semibold text-lg text-[#2c2f30] mb-2">{title}</h3>
      <p className="text-sm text-[#595c5d] mb-6 leading-relaxed max-w-md mx-auto">
        {description}
      </p>
      <Link href={actionHref}>
        <Button className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl">
          {actionLabel}
        </Button>
      </Link>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="bg-white p-8 rounded-xl text-center">
      <AlertCircle className="w-12 h-12 text-[#6a37d4] mx-auto mb-4" />
      <h3 className="font-semibold text-lg text-[#2c2f30] mb-2">Failed to load data</h3>
      <p className="text-sm text-[#595c5d] mb-6">{error.message}</p>
      <Button
        onClick={onRetry}
        className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

export default function CommandCenter({ params }: CommandCenterProps) {
  const [, navigate] = useLocation();
  const companyId = params.companyId;

  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
    refetch: companyRefetch,
  } = useQuery<Company, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company");
      return (await res.json()) as Company;
    },
  });

  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
    refetch: tasksRefetch,
  } = useQuery<Task[], Error>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tasks");
      return (await res.json()) as Task[];
    },
  });

  const {
    data: workflows,
    isLoading: workflowsLoading,
    isError: workflowsError,
    error: workflowsErrorObj,
    refetch: workflowsRefetch,
  } = useQuery<WorkflowSummary[], Error>({
    queryKey: ["/api/workflows"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflows");
      return (await res.json()) as WorkflowSummary[];
    },
  });

  const companyName = company?.name ?? "Company";

  const leftRailItems = [
    {
      icon: Home,
      label: "Home",
      href: `/company/${companyId}`,
      active: true,
    },
    {
      icon: CheckSquare,
      label: "Tasks",
      href: `/company/${companyId}/tasks`,
      active: false,
    },
    {
      icon: Workflow,
      label: "Workflows",
      href: `/company/${companyId}/workflows`,
      active: false,
    },
    {
      icon: Building2,
      label: "Org",
      href: `/company/${companyId}/org`,
      active: false,
    },
    {
      icon: MessageSquare,
      label: "Chat",
      href: `/company/${companyId}/chat`,
      active: false,
    },
    {
      icon: Settings,
      label: "Settings",
      href: `/settings`,
      active: false,
    },
  ];

  const openTaskCount = tasks?.filter((t) => t.status !== "done").length ?? 0;
  const activeWorkflowCount =
    workflows?.filter((w) => w.status !== "paused").length ?? 0;
  const recentTasks = (tasks ?? []).filter((t) => t.status !== "done").slice(0, 5);
  const activeWorkflows = (workflows ?? []).filter((w) => w.status !== "paused");

  const isNewCompany = !tasksLoading && !workflowsLoading && openTaskCount === 0 && activeWorkflowCount === 0;

  if (companyLoading) {
    return (
      <UniversalLayout
        title="Command Center"
        leftRailItems={leftRailItems}
        companyName={companyName}
      >
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-[#6a37d4] animate-spin" />
        </div>
      </UniversalLayout>
    );
  }

  if (companyError && !companyLoading) {
    return (
      <UniversalLayout
        title="Command Center"
        leftRailItems={leftRailItems}
        companyName={companyName}
      >
        <div className="max-w-4xl mx-auto pt-24 px-6">
          <ErrorState error={companyError} onRetry={() => companyRefetch()} />
          <div className="text-center mt-4">
            <Link
              href="/portfolios"
              className="text-sm text-[#6a37d4] underline"
            >
              Back to portfolios
            </Link>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout
      title="Command Center"
      leftRailItems={leftRailItems}
      companyName={companyName}
    >
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12 lg:px-12">
          <div className="mb-12">
            <h1 className="text-4xl font-semibold text-[#2c2f30] mb-2 tracking-tight">
              Command Center
            </h1>
            <p className="text-[#595c5d]">{companyName}</p>
            {company?.stage && (
              <p className="text-sm text-slate-400 mt-2">
                {company.stage}
                {company.type && ` \u2022 ${company.type}`}
              </p>
            )}
          </div>

          <div className="space-y-12">
            <section>
              <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d] mb-6">
                Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                  icon={<ListTodo className="w-6 h-6" />}
                  label="Open Tasks"
                  value={openTaskCount}
                  isLoading={tasksLoading}
                  onClick={() => navigate(`/company/${companyId}/tasks`)}
                />
                <KPICard
                  icon={<Workflow className="w-6 h-6" />}
                  label="Active Workflows"
                  value={activeWorkflowCount}
                  isLoading={workflowsLoading}
                  onClick={() => navigate(`/company/${companyId}/workflows`)}
                />
                <KPICard
                  icon={<Building2 className="w-6 h-6" />}
                  label="Stage"
                  value={company?.stage ?? "\u2014"}
                  onClick={() => navigate(`/company/${companyId}/org`)}
                />
                <KPICard
                  icon={<MessageSquare className="w-6 h-6" />}
                  label="Assistant"
                  value={company?.assistantName ?? "OS-1"}
                  onClick={() => navigate(`/company/${companyId}/chat`)}
                />
              </div>
            </section>

            {isNewCompany ? (
              <section>
                <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d] mb-6">
                  Get Started
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EmptyStateCard
                    icon={ListTodo}
                    title="Add your first task"
                    description="Start tracking work. Create a task and assign it to your team or your assistant."
                    actionLabel="Create task"
                    actionHref={`/company/${companyId}/tasks`}
                  />
                  <EmptyStateCard
                    icon={FileText}
                    title="Create a workflow"
                    description="Codify how your company works. Write a workflow once, run it repeatedly."
                    actionLabel="Create workflow"
                    actionHref={`/company/${companyId}/workflows`}
                  />
                  <EmptyStateCard
                    icon={Network}
                    title="Set up your org chart"
                    description="Define your company structure. Assign roles to humans or AI agents."
                    actionLabel="Build org chart"
                    actionHref={`/company/${companyId}/org`}
                  />
                </div>
              </section>
            ) : (
              <>
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d]">
                      Active Workflows
                    </h2>
                    <Link href={`/company/${companyId}/workflows`}>
                      <Button
                        variant="ghost"
                        className="text-[#6a37d4] hover:bg-[#f5f6f7] rounded-xl"
                      >
                        View all
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                  {workflowsLoading ? (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] animate-pulse">
                      <div className="p-6 space-y-4">
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                      </div>
                    </div>
                  ) : workflowsError && workflowsErrorObj ? (
                    <ErrorState
                      error={workflowsErrorObj}
                      onRetry={() => workflowsRefetch()}
                    />
                  ) : activeWorkflows.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] text-center">
                      <Workflow className="w-12 h-12 text-[#abadae] mx-auto mb-4" />
                      <p className="text-sm text-[#595c5d] mb-6">
                        No active workflows. Create your first workflow to automate work.
                      </p>
                      <Link href={`/company/${companyId}/workflows`}>
                        <Button className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          Create workflow
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] overflow-hidden">
                      {activeWorkflows.slice(0, 3).map((workflow) => (
                        <WorkflowListItem key={workflow.id} workflow={workflow} companyId={companyId} />
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d]">
                      Recent Tasks
                    </h2>
                    <Link href={`/company/${companyId}/tasks`}>
                      <Button
                        variant="ghost"
                        className="text-[#6a37d4] hover:bg-[#f5f6f7] rounded-xl"
                      >
                        View all
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                  {tasksLoading ? (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] animate-pulse">
                      <div className="p-6 space-y-4">
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                      </div>
                    </div>
                  ) : tasksError && tasksErrorObj ? (
                    <ErrorState error={tasksErrorObj} onRetry={() => tasksRefetch()} />
                  ) : recentTasks.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] text-center">
                      <ListTodo className="w-12 h-12 text-[#abadae] mx-auto mb-4" />
                      <p className="text-sm text-[#595c5d] mb-6">
                        No tasks yet. Create your first task to start tracking work.
                      </p>
                      <Link href={`/company/${companyId}/tasks`}>
                        <Button className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          Create task
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] overflow-hidden">
                      {recentTasks.map((task) => (
                        <TaskListItem key={task.id} task={task} companyId={companyId} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            <section>
              <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d] mb-6">
                Quick Actions
              </h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl"
                  onClick={() => navigate(`/company/${companyId}/tasks`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create task
                </Button>
                <Button
                  variant="secondary"
                  className="bg-[#f5f6f7] text-[#6a37d4] hover:bg-[#eff1f2] rounded-xl"
                  onClick={() => navigate(`/company/${companyId}/workflows`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create workflow
                </Button>
                <Button
                  variant="secondary"
                  className="bg-[#f5f6f7] text-[#6a37d4] hover:bg-[#eff1f2] rounded-xl"
                  onClick={() => navigate(`/company/${companyId}/org`)}
                >
                  <Network className="w-4 h-4 mr-2" />
                  View org chart
                </Button>
                <Button
                  variant="secondary"
                  className="bg-[#f5f6f7] text-[#6a37d4] hover:bg-[#eff1f2] rounded-xl"
                  onClick={() => navigate(`/company/${companyId}/chat`)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Talk to {company?.assistantName ?? "OS-1"}
                </Button>
                <Button
                  variant="secondary"
                  className="bg-[#f5f6f7] text-[#6a37d4] hover:bg-[#eff1f2] rounded-xl"
                  onClick={() => navigate(`/settings`)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </UniversalLayout>
  );
}
