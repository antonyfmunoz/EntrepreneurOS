import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Plus, AlertCircle, CheckCircle2, Clock, Users, Workflow, BarChart3 } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface Company {
  id: string;
  name: string;
  stage?: string;
  industry?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string;
}

interface WorkflowInstance {
  id: string;
  name: string;
  status: string;
  currentStep?: string;
  progress?: number;
}

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  departmentId: string;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export default function CommandCenterPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId ?? "";
  const queryClient = useQueryClient();
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const { data: company, isLoading: companyLoading, error: companyError } = useQuery<Company>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => { const r = await apiRequest("GET", `/api/companies/${companyId}`); return r.json(); },
    enabled: !!companyId,
  });

  const { data: tasksData = [], isLoading: tasksLoading, error: tasksError } = useQuery<Task[]>({
    queryKey: ["/api/companies", companyId, "tasks"],
    queryFn: async () => { const r = await apiRequest("GET", `/api/companies/${companyId}/tasks`); return r.json(); },
    enabled: !!companyId,
  });

  const { data: workflowsData = [], isLoading: workflowsLoading, error: workflowsError } = useQuery<WorkflowInstance[]>({
    queryKey: ["/api/companies", companyId, "workflows"],
    queryFn: async () => { const r = await apiRequest("GET", `/api/companies/${companyId}/workflows`); return r.json(); },
    enabled: !!companyId,
  });

  const { data: departmentsData = [], isLoading: departmentsLoading, error: departmentsError } = useQuery<Department[]>({
    queryKey: ["/api/companies", companyId, "departments"],
    queryFn: async () => { const r = await apiRequest("GET", `/api/companies/${companyId}/departments`); return r.json(); },
    enabled: !!companyId,
  });

  const { data: rolesData = [], isLoading: rolesLoading, error: rolesError } = useQuery<Role[]>({
    queryKey: ["/api/companies", companyId, "roles"],
    queryFn: async () => { const r = await apiRequest("GET", `/api/companies/${companyId}/roles`); return r.json(); },
    enabled: !!companyId,
  });

  const tasks = Array.isArray(tasksData) ? tasksData : [];
  const workflows = Array.isArray(workflowsData) ? workflowsData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const roles = Array.isArray(rolesData) ? rolesData : [];

  const taskCount = tasks.length;
  const activeWorkflowCount = workflows.filter(w => w.status === "active" || w.status === "in_progress").length;
  const departmentCount = departments.length;
  const roleCount = roles.length;

  const recentTasks = tasks.slice(0, 5);
  const activeWorkflows = workflows.filter(w => w.status === "active" || w.status === "in_progress").slice(0, 5);

  const alerts: Alert[] = workflows
    .filter(w => w.status === "blocked" || w.status === "needs_review")
    .map(w => ({
      id: w.id,
      type: w.status === "blocked" ? "warning" : "info",
      message: `Workflow "${w.name}" ${w.status === "blocked" ? "is blocked" : "needs review"}`,
      createdAt: new Date().toISOString(),
    }))
    .filter(a => !dismissedAlerts.includes(a.id));

  const isLoading = companyLoading || tasksLoading || workflowsLoading || departmentsLoading || rolesLoading;
  const hasError = companyError || tasksError || workflowsError || departmentsError || rolesError;

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => [...prev, alertId]);
  };

  if (hasError) {
    return (
      <UniversalLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-mono font-semibold text-xl text-text mb-2">Failed to load command center data</h2>
            <p className="font-mono text-sm text-text-secondary mb-6">Retry or refresh the page.</p>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
              }}
            >
              Retry
            </Button>
          </Card>
        </div>
      </UniversalLayout>
    );
  }

  const isEmpty = taskCount === 0 && activeWorkflowCount === 0 && departmentCount === 0;

  return (
    <UniversalLayout showRightRail={true}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-4xl text-text mb-2">Command center</h1>
            {company && (
              <p className="font-mono text-sm text-text-secondary">
                {company.name} {company.stage && `• ${company.stage}`}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Link href={`/company/${companyId}/tasks/new`}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create task
              </Button>
            </Link>
            <Link href={`/company/${companyId}/workflows/new`}>
              <Button variant="secondary">
                <Plus className="w-4 h-4 mr-2" />
                Create workflow
              </Button>
            </Link>
            <Link href={`/company/${companyId}/org`}>
              <Button variant="secondary">View org chart</Button>
            </Link>
          </div>
        </div>

        {isEmpty && !isLoading && (
          <Card className="p-12 text-center">
            <div className="font-mono text-4xl text-text-tertiary mb-4">—</div>
            <h3 className="font-mono font-semibold text-lg text-text mb-2">New company</h3>
            <p className="font-mono text-sm text-text-secondary mb-6">
              Add your first task, create a workflow, or set up your org chart to get started.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <Link href={`/company/${companyId}/tasks/new`}>
                <Button>Create task</Button>
              </Link>
              <Link href={`/company/${companyId}/workflows/new`}>
                <Button variant="secondary">Create workflow</Button>
              </Link>
              <Link href={`/company/${companyId}/org`}>
                <Button variant="secondary">Set up org chart</Button>
              </Link>
            </div>
          </Card>
        )}

        {!isEmpty && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                icon={<CheckCircle2 className="w-5 h-5" />}
                label="Tasks"
                value={taskCount}
                isLoading={isLoading}
                linkTo={`/company/${companyId}/tasks`}
              />
              <KPICard
                icon={<Workflow className="w-5 h-5" />}
                label="Active workflows"
                value={activeWorkflowCount}
                isLoading={isLoading}
                linkTo={`/company/${companyId}/workflows`}
              />
              <KPICard
                icon={<BarChart3 className="w-5 h-5" />}
                label="Departments"
                value={departmentCount}
                isLoading={isLoading}
                linkTo={`/company/${companyId}/org`}
              />
              <KPICard
                icon={<Users className="w-5 h-5" />}
                label="Roles"
                value={roleCount}
                isLoading={isLoading}
                linkTo={`/company/${companyId}/org`}
              />
            </div>

            {alerts.length > 0 && (
              <Card className="p-6">
                <h2 className="font-mono font-semibold text-lg text-text mb-4">Alerts</h2>
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      className="flex items-start justify-between p-4 bg-surface-subtle rounded-md border border-border-subtle"
                    >
                      <div className="flex items-start space-x-3">
                        <AlertCircle className={`w-5 h-5 flex-shrink-0 ${alert.type === "warning" ? "text-warning" : "text-primary"}`} />
                        <div>
                          <p className="font-mono text-sm text-text">{alert.message}</p>
                          <p className="font-mono text-xs text-text-tertiary mt-1">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissAlert(alert.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono font-semibold text-lg text-text">Active workflows</h2>
                  <Link href={`/company/${companyId}/workflows`}>
                    <Button variant="ghost" size="sm">View all</Button>
                  </Link>
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-surface-subtle rounded-md h-20 animate-pulse" />
                    ))}
                  </div>
                ) : activeWorkflows.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="font-mono text-sm text-text-secondary">No active workflows</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeWorkflows.map(workflow => (
                      <Link key={workflow.id} href={`/company/${companyId}/workflows/${workflow.id}`}>
                        <div className="p-4 bg-surface-subtle rounded-md border border-border-subtle hover:bg-surface hover:border-border transition-all cursor-pointer">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-mono font-medium text-sm text-text mb-1">{workflow.name}</h3>
                              {workflow.currentStep && (
                                <p className="font-mono text-xs text-text-secondary">Current: {workflow.currentStep}</p>
                              )}
                            </div>
                            <Badge variant={workflow.status === "active" ? "default" : "secondary"}>
                              {workflow.status}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono font-semibold text-lg text-text">Recent tasks</h2>
                  <Link href={`/company/${companyId}/tasks`}>
                    <Button variant="ghost" size="sm">View all</Button>
                  </Link>
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-surface-subtle rounded-md h-20 animate-pulse" />
                    ))}
                  </div>
                ) : recentTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="font-mono text-sm text-text-secondary">No tasks yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTasks.map(task => (
                      <Link key={task.id} href={`/company/${companyId}/tasks/${task.id}`}>
                        <div className="p-4 bg-surface-subtle rounded-md border border-border-subtle hover:bg-surface hover:border-border transition-all cursor-pointer">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-mono font-medium text-sm text-text mb-1">{task.title}</h3>
                              {task.assigneeName && (
                                <p className="font-mono text-xs text-text-secondary">Assigned to: {task.assigneeName}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
                              <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </UniversalLayout>
  );
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  isLoading: boolean;
  linkTo: string;
}

function KPICard({ icon, label, value, isLoading, linkTo }: KPICardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="bg-surface-subtle rounded-md h-20 animate-pulse" />
      </Card>
    );
  }

  return (
    <Link href={linkTo}>
      <Card className="p-6 hover:shadow-md hover:border-border transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <div className="text-text-secondary">{icon}</div>
        </div>
        <div className="font-mono font-bold text-3xl text-text mb-1">{value}</div>
        <div className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</div>
      </Card>
    </Link>
  );
}

function getPriorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority.toLowerCase()) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    default:
      return "secondary";
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "done":
    case "completed":
      return "default";
    case "in_progress":
    case "in progress":
      return "secondary";
    case "blocked":
      return "destructive";
    default:
      return "outline";
  }
}