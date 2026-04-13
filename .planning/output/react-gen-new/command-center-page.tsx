import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
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
  Sitemap,
} from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { designTokens } from "@/lib/design-tokens";

interface Company {
  id: string;
  name: string;
}

interface KPIData {
  taskCount: number;
  activeWorkflows: number;
  departmentCount: number;
  roleCount: number;
}

interface WorkflowItem {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  currentStep: string;
}

interface Task {
  id: string;
  title: string;
  status: "backlog" | "in_progress" | "in_review" | "done";
  priority: "critical" | "high" | "medium" | "low";
  assigneeId: string | null;
}

interface Alert {
  id: string;
  type: "info" | "warning" | "error";
  message: string;
  createdAt: string;
}

async function fetchCompany(companyId: string): Promise<Company> {
  const response = await fetch(`/api/companies/${companyId}`);
  if (!response.ok) throw new Error("Failed to fetch company");
  return response.json();
}

async function fetchKPIs(companyId: string): Promise<KPIData> {
  const [tasks, workflows, departments, roles] = await Promise.all([
    fetch(`/api/companies/${companyId}/tasks`).then((r) => r.json()),
    fetch(`/api/companies/${companyId}/workflows`).then((r) => r.json()),
    fetch(`/api/companies/${companyId}/departments`).then((r) => r.json()),
    fetch(`/api/companies/${companyId}/roles`).then((r) => r.json()),
  ]);

  return {
    taskCount: tasks.length || 0,
    activeWorkflows: workflows.filter((w: WorkflowItem) => w.status === "active").length || 0,
    departmentCount: departments.length || 0,
    roleCount: roles.length || 0,
  };
}

async function fetchWorkflows(companyId: string): Promise<WorkflowItem[]> {
  const response = await fetch(`/api/companies/${companyId}/workflows`);
  if (!response.ok) throw new Error("Failed to fetch workflows");
  return response.json();
}

async function fetchTasks(companyId: string): Promise<Task[]> {
  const response = await fetch(`/api/companies/${companyId}/tasks`);
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}

async function fetchAlerts(companyId: string): Promise<Alert[]> {
  const response = await fetch(`/api/companies/${companyId}/alerts`);
  if (!response.ok) return [];
  return response.json();
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

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: string;
  onClick?: () => void;
}

function KPICard({ icon, label, value, trend, onClick }: KPICardProps) {
  return (
    <Card
      className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.7)] hover:backdrop-blur-[16px] cursor-pointer"
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
      <div className="text-3.5xl font-semibold text-[#2c2f30] mb-2">{value}</div>
      <div className="text-xs uppercase tracking-[0.05em] text-[#595c5d]">{label}</div>
    </Card>
  );
}

function WorkflowListItem({ workflow }: { workflow: WorkflowItem }) {
  const statusConfig = {
    active: { label: "In Progress", color: "#6a37d4" },
    paused: { label: "Paused", color: "#595c5d" },
    completed: { label: "Completed", color: "#6a37d4" },
  };

  const config = statusConfig[workflow.status];

  return (
    <Link href={`/workflows/${workflow.id}`}>
      <div className="p-6 bg-white hover:bg-[#f5f6f7] transition-colors duration-150 cursor-pointer first:rounded-t-xl last:rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-[#2c2f30] mb-1">{workflow.name}</h4>
            <p className="text-sm text-[#595c5d]">{workflow.currentStep}</p>
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

function TaskListItem({ task }: { task: Task }) {
  const statusConfig = {
    backlog: { label: "Backlog", color: "#595c5d" },
    in_progress: { label: "In Progress", color: "#6a37d4" },
    in_review: { label: "In Review", color: "#6448b2" },
    done: { label: "Done", color: "#6a37d4" },
  };

  const priorityConfig = {
    critical: { icon: AlertCircle, color: "#6a37d4" },
    high: { icon: AlertCircle, color: "#6448b2" },
    medium: { icon: Clock, color: "#595c5d" },
    low: { icon: Clock, color: "#abadae" },
  };

  const status = statusConfig[task.status];
  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;

  return (
    <Link href={`/tasks/${task.id}`}>
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

function AlertItem({ alert }: { alert: Alert }) {
  const typeConfig = {
    info: { icon: CheckCircle2, color: "#6a37d4" },
    warning: { icon: AlertCircle, color: "#6448b2" },
    error: { icon: AlertCircle, color: "#6a37d4" },
  };

  const config = typeConfig[alert.type];
  const Icon = config.icon;

  return (
    <div className="p-6 bg-white hover:bg-[#f5f6f7] transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
        <div className="flex-1">
          <p className="text-sm text-[#2c2f30] leading-relaxed">{alert.message}</p>
          <p className="text-xs text-[#595c5d] mt-2">
            {new Date(alert.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
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

export default function CommandCenterPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [aiPanelExpanded, setAiPanelExpanded] = useState(false);

  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => fetchCompany(companyId!),
    enabled: !!companyId,
  });

  const kpiQuery = useQuery({
    queryKey: ["kpis", companyId],
    queryFn: () => fetchKPIs(companyId!),
    enabled: !!companyId,
  });

  const workflowsQuery = useQuery({
    queryKey: ["workflows", companyId],
    queryFn: () => fetchWorkflows(companyId!),
    enabled: !!companyId,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", companyId],
    queryFn: () => fetchTasks(companyId!),
    enabled: !!companyId,
  });

  const alertsQuery = useQuery({
    queryKey: ["alerts", companyId],
    queryFn: () => fetchAlerts(companyId!),
    enabled: !!companyId,
  });

  if (companyQuery.isLoading) {
    return (
      <UniversalLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-[#6a37d4] animate-spin" />
        </div>
      </UniversalLayout>
    );
  }

  if (companyQuery.isError) {
    return (
      <UniversalLayout>
        <div className="max-w-4xl mx-auto pt-24 px-6">
          <ErrorState error={companyQuery.error} onRetry={() => companyQuery.refetch()} />
        </div>
      </UniversalLayout>
    );
  }

  const company = companyQuery.data;
  const kpiData = kpiQuery.data;
  const workflows = workflowsQuery.data || [];
  const tasks = tasksQuery.data || [];
  const alerts = alertsQuery.data || [];

  const activeWorkflows = workflows.filter((w) => w.status === "active");
  const recentTasks = tasks.slice(0, 5);

  const isNewCompany =
    kpiData &&
    kpiData.taskCount === 0 &&
    kpiData.activeWorkflows === 0 &&
    kpiData.departmentCount === 0 &&
    kpiData.roleCount === 0;

  return (
    <UniversalLayout>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12 lg:px-12">
          <div className="mb-12">
            <h1 className="text-3.5xl font-semibold text-[#2c2f30] mb-2 tracking-tight">
              Command Center
            </h1>
            <p className="text-[#595c5d]">{company?.name}</p>
          </div>

          <div className="space-y-12">
            <section>
              <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d] mb-6">
                Overview
              </h2>
              {kpiQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <KPICardSkeleton />
                  <KPICardSkeleton />
                  <KPICardSkeleton />
                  <KPICardSkeleton />
                </div>
              ) : kpiQuery.isError ? (
                <ErrorState error={kpiQuery.error} onRetry={() => kpiQuery.refetch()} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <KPICard
                    icon={<ListTodo className="w-6 h-6" />}
                    label="Active Tasks"
                    value={kpiData?.taskCount || 0}
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "kpi_card_clicked",
                            properties: { kpiType: "tasks", companyId },
                          },
                        })
                      );
                    }}
                  />
                  <KPICard
                    icon={<Workflow className="w-6 h-6" />}
                    label="Active Workflows"
                    value={kpiData?.activeWorkflows || 0}
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "kpi_card_clicked",
                            properties: { kpiType: "workflows", companyId },
                          },
                        })
                      );
                    }}
                  />
                  <KPICard
                    icon={<Building2 className="w-6 h-6" />}
                    label="Departments"
                    value={kpiData?.departmentCount || 0}
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "kpi_card_clicked",
                            properties: { kpiType: "departments", companyId },
                          },
                        })
                      );
                    }}
                  />
                  <KPICard
                    icon={<Users className="w-6 h-6" />}
                    label="Roles"
                    value={kpiData?.roleCount || 0}
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "kpi_card_clicked",
                            properties: { kpiType: "roles", companyId },
                          },
                        })
                      );
                    }}
                  />
                </div>
              )}
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
                    actionHref={`/company/${companyId}/tasks/new`}
                  />
                  <EmptyStateCard
                    icon={FileText}
                    title="Create a workflow"
                    description="Codify how your company works. Write a workflow once, run it repeatedly."
                    actionLabel="Create workflow"
                    actionHref={`/company/${companyId}/workflows/new`}
                  />
                  <EmptyStateCard
                    icon={Sitemap}
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
                  {workflowsQuery.isLoading ? (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] animate-pulse">
                      <div className="p-6 space-y-4">
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                      </div>
                    </div>
                  ) : workflowsQuery.isError ? (
                    <ErrorState
                      error={workflowsQuery.error}
                      onRetry={() => workflowsQuery.refetch()}
                    />
                  ) : activeWorkflows.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] text-center">
                      <Workflow className="w-12 h-12 text-[#abadae] mx-auto mb-4" />
                      <p className="text-sm text-[#595c5d] mb-6">
                        No active workflows. Create your first workflow to automate work.
                      </p>
                      <Link href={`/company/${companyId}/workflows/new`}>
                        <Button className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          Create workflow
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] overflow-hidden">
                      {activeWorkflows.slice(0, 3).map((workflow) => (
                        <WorkflowListItem key={workflow.id} workflow={workflow} />
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
                  {tasksQuery.isLoading ? (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] animate-pulse">
                      <div className="p-6 space-y-4">
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                        <div className="h-12 bg-[#eff1f2] rounded" />
                      </div>
                    </div>
                  ) : tasksQuery.isError ? (
                    <ErrorState error={tasksQuery.error} onRetry={() => tasksQuery.refetch()} />
                  ) : recentTasks.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] text-center">
                      <ListTodo className="w-12 h-12 text-[#abadae] mx-auto mb-4" />
                      <p className="text-sm text-[#595c5d] mb-6">
                        No tasks yet. Create your first task to start tracking work.
                      </p>
                      <Link href={`/company/${companyId}/tasks/new`}>
                        <Button className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          Create task
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] overflow-hidden">
                      {recentTasks.map((task) => (
                        <TaskListItem key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </section>

                {alerts.length > 0 && (
                  <section>
                    <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d] mb-6">
                      Alerts
                    </h2>
                    {alertsQuery.isLoading ? (
                      <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] animate-pulse">
                        <div className="p-6 space-y-4">
                          <div className="h-16 bg-[#eff1f2] rounded" />
                          <div className="h-16 bg-[#eff1f2] rounded" />
                        </div>
                      </div>
                    ) : alertsQuery.isError ? (
                      <ErrorState
                        error={alertsQuery.error}
                        onRetry={() => alertsQuery.refetch()}
                      />
                    ) : (
                      <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] overflow-hidden">
                        {alerts.slice(0, 3).map((alert) => (
                          <AlertItem key={alert.id} alert={alert} />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            <section>
              <h2 className="text-xs uppercase tracking-[0.05em] text-[#595c5d] mb-6">
                Quick Actions
              </h2>
              <div className="flex flex-wrap gap-3">
                <Link href={`/company/${companyId}/tasks/new`}>
                  <Button
                    className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] rounded-xl"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "quick_action_clicked",
                            properties: { actionType: "create_task", companyId },
                          },
                        })
                      );
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create task
                  </Button>
                </Link>
                <Link href={`/company/${companyId}/workflows/new`}>
                  <Button
                    variant="secondary"
                    className="bg-[#f5f6f7] text-[#6a37d4] hover:bg-[#eff1f2] rounded-xl"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "quick_action_clicked",
                            properties: { actionType: "create_workflow", companyId },
                          },
                        })
                      );
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create workflow
                  </Button>
                </Link>
                <Link href={`/company/${companyId}/org`}>
                  <Button
                    variant="secondary"
                    className="bg-[#f5f6f7] text-[#6a37d4] hover:bg-[#eff1f2] rounded-xl"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("analytics", {
                          detail: {
                            name: "quick_action_clicked",
                            properties: { actionType: "view_org_chart", companyId },
                          },
                        })
                      );
                    }}
                  >
                    <Sitemap className="w-4 h-4 mr-2" />
                    View org chart
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </UniversalLayout>
  );
}