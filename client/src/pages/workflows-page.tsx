import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Play,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  ChevronRight,
  ArrowLeft,
  User,
  Bot,
  Wrench,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

type StepType = "human" | "ai" | "tool";
type WorkflowStatus = "draft" | "active" | "deprecated";

interface WorkflowStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  stepType: StepType;
  completedAt?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  stepCount: number;
  completedSteps: number;
  steps?: WorkflowStep[];
  currentStepIndex?: number;
}

interface WorkflowFormData {
  name: string;
  description: string;
  status: WorkflowStatus;
}

interface StepFormData {
  title: string;
  description: string;
  stepType: StepType;
}

export default function WorkflowsPage() {
  const [, params] = useRoute("/company/:companyId/workflows");
  const companyId = params?.companyId ?? "";

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: "",
    description: "",
    status: "draft",
  });
  const [steps, setSteps] = useState<StepFormData[]>([]);

  const queryClient = useQueryClient();

  const {
    data: workflows = [],
    isLoading,
    error,
  } = useQuery<Workflow[]>({
    queryKey: ["workflows", companyId],
    queryFn: () =>
      apiRequest<Workflow[]>(`/api/companies/${companyId}/workflows`),
    enabled: !!companyId && !runningWorkflowId,
  });

  const {
    data: runningWorkflow,
    isLoading: isLoadingRunner,
    error: runnerError,
  } = useQuery<Workflow>({
    queryKey: ["workflow", companyId, runningWorkflowId],
    queryFn: async () => {
      const [workflow, workflowSteps] = await Promise.all([
        apiRequest<Workflow>(
          `/api/companies/${companyId}/workflows/${runningWorkflowId}`
        ),
        apiRequest<WorkflowStep[]>(
          `/api/companies/${companyId}/workflows/${runningWorkflowId}/steps`
        ),
      ]);
      return { ...workflow, steps: workflowSteps };
    },
    enabled: !!companyId && !!runningWorkflowId,
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: WorkflowFormData & { steps: StepFormData[] }) => {
      const workflow = await apiRequest<Workflow>(
        `/api/companies/${companyId}/workflows`,
        {
          method: "POST",
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            status: data.status,
          }),
        }
      );

      if (data.steps.length > 0) {
        await Promise.all(
          data.steps.map((step, index) =>
            apiRequest(`/api/companies/${companyId}/workflows/${workflow.id}/steps`, {
              method: "POST",
              body: JSON.stringify({ ...step, order: index }),
            })
          )
        );
      }

      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
      setCreateDialogOpen(false);
      resetForm();
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async (data: {
      workflowId: string;
      updates: Partial<WorkflowFormData>;
      steps?: StepFormData[];
    }) => {
      const workflow = await apiRequest<Workflow>(
        `/api/companies/${companyId}/workflows/${data.workflowId}`,
        {
          method: "PUT",
          body: JSON.stringify(data.updates),
        }
      );

      if (data.steps && data.steps.length > 0) {
        await Promise.all(
          data.steps.map((step, index) =>
            apiRequest(
              `/api/companies/${companyId}/workflows/${data.workflowId}/steps`,
              {
                method: "POST",
                body: JSON.stringify({ ...step, order: index }),
              }
            )
          )
        );
      }

      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
      setEditingWorkflow(null);
      resetForm();
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) =>
      apiRequest(`/api/companies/${companyId}/workflows/${workflowId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
    },
  });

  const completeStepMutation = useMutation({
    mutationFn: ({
      workflowId,
      stepId,
    }: {
      workflowId: string;
      stepId: string;
    }) =>
      apiRequest(
        `/api/companies/${companyId}/workflows/${workflowId}/steps/${stepId}`,
        {
          method: "PUT",
          body: JSON.stringify({ completedAt: new Date().toISOString() }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workflow", companyId, runningWorkflowId],
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", status: "draft" });
    setSteps([]);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingWorkflow(null);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (workflow: Workflow) => {
    setFormData({
      name: workflow.name,
      description: workflow.description ?? "",
      status: workflow.status,
    });
    setSteps([]);
    setEditingWorkflow(workflow);
    setCreateDialogOpen(true);
  };

  const handleSaveWorkflow = () => {
    if (!formData.name.trim()) return;

    if (editingWorkflow) {
      updateWorkflowMutation.mutate({
        workflowId: editingWorkflow.id,
        updates: formData,
        steps: steps.length > 0 ? steps : undefined,
      });
    } else {
      createWorkflowMutation.mutate({ ...formData, steps });
    }
  };

  const handleRunWorkflow = (workflowId: string) => {
    setRunningWorkflowId(workflowId);
  };

  const handleCompleteStep = (stepId: string) => {
    if (!runningWorkflowId) return;
    completeStepMutation.mutate({ workflowId: runningWorkflowId, stepId });
  };

  const addStep = () => {
    setSteps([
      ...steps,
      { title: "", description: "", stepType: "human" },
    ]);
  };

  const updateStep = (index: number, updates: Partial<StepFormData>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const getStepTypeIcon = (stepType: StepType) => {
    switch (stepType) {
      case "human":
        return <User className="w-4 h-4" />;
      case "ai":
        return <Bot className="w-4 h-4" />;
      case "tool":
        return <Wrench className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: WorkflowStatus) => {
    const config = {
      draft: { label: "Draft", className: "bg-surface-subtle text-text-secondary" },
      active: { label: "Active", className: "bg-primary/10 text-primary" },
      deprecated: { label: "Deprecated", className: "bg-destructive/10 text-destructive" },
    };
    const { label, className } = config[status];
    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wide ${className}`}
      >
        {label}
      </span>
    );
  };

  if (runningWorkflowId) {
    if (isLoadingRunner) {
      return (
        <UniversalLayout>
          <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6 flex items-center space-x-4">
              <div className="h-10 w-10 bg-surface-subtle rounded-md animate-pulse" />
              <div className="flex-1 h-8 bg-surface-subtle rounded-md animate-pulse" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-surface-subtle rounded-md animate-pulse"
                />
              ))}
            </div>
          </div>
        </UniversalLayout>
      );
    }

    if (runnerError || !runningWorkflow) {
      return (
        <UniversalLayout>
          <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="font-mono text-sm text-destructive mb-4">
                Failed to start workflow. Try again.
              </p>
              <Button
                onClick={() => setRunningWorkflowId(null)}
                variant="outline"
              >
                Back to workflows
              </Button>
            </div>
          </div>
        </UniversalLayout>
      );
    }

    const currentStep = (runningWorkflow.steps ?? []).find(
      (s) => !s.completedAt
    );
    const completedCount = (runningWorkflow.steps ?? []).filter(
      (s) => s.completedAt
    ).length;
    const totalSteps = runningWorkflow.steps?.length ?? 0;
    const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

    return (
      <UniversalLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRunningWorkflowId(null)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to workflows
            </Button>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-mono font-bold text-4xl text-text mb-2">
                  {runningWorkflow.name}
                </h1>
                {runningWorkflow.description && (
                  <p className="font-mono text-sm text-text-secondary">
                    {runningWorkflow.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="font-mono text-xs uppercase tracking-wide text-text-tertiary mb-1">
                  Progress
                </div>
                <div className="font-mono font-semibold text-2xl text-text">
                  {completedCount}/{totalSteps}
                </div>
              </div>
            </div>
            <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            {(runningWorkflow.steps ?? []).map((step, index) => (
              <div
                key={step.id}
                className={`bg-surface rounded-lg border p-6 transition-all ${
                  step.completedAt
                    ? "border-border-subtle opacity-60"
                    : currentStep?.id === step.id
                    ? "border-primary shadow-md"
                    : "border-border-subtle"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {step.completedAt ? (
                      <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                    ) : currentStep?.id === step.id ? (
                      <Circle className="w-6 h-6 text-primary flex-shrink-0" />
                    ) : (
                      <Circle className="w-6 h-6 text-text-tertiary flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-mono text-xs uppercase tracking-wide text-text-tertiary">
                          Step {index + 1}
                        </span>
                        <div className="flex items-center space-x-1 text-text-secondary">
                          {getStepTypeIcon(step.stepType)}
                          <span className="font-mono text-xs capitalize">
                            {step.stepType}
                          </span>
                        </div>
                      </div>
                      <h3 className="font-mono font-semibold text-lg text-text">
                        {step.title}
                      </h3>
                      {step.description && (
                        <p className="font-mono text-sm text-text-secondary mt-1">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {!step.completedAt && currentStep?.id === step.id && (
                  <div className="flex space-x-3 mt-4 pt-4 border-t border-border-subtle">
                    <Button
                      onClick={() => handleCompleteStep(step.id)}
                      disabled={completeStepMutation.isPending}
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Mark complete
                    </Button>
                    <Button variant="outline" size="sm">
                      Skip
                    </Button>
                  </div>
                )}

                {completeStepMutation.isError &&
                  currentStep?.id === step.id && (
                    <p className="mt-2 font-mono text-xs text-destructive">
                      Failed to complete step. Try again.
                    </p>
                  )}
              </div>
            ))}
          </div>

          {completedCount === totalSteps && totalSteps > 0 && (
            <div className="mt-6 bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-mono font-semibold text-lg text-text mb-2">
                Workflow complete
              </h3>
              <p className="font-mono text-sm text-text-secondary mb-4">
                All steps finished. Ready for the next run.
              </p>
              <Button onClick={() => setRunningWorkflowId(null)}>
                Back to workflows
              </Button>
            </div>
          )}
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-4xl text-text mb-2">
              Workflows
            </h1>
            <p className="font-mono text-sm text-text-secondary">
              Codify how your company works. Run step by step. Hand steps to
              humans or DEX.
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create workflow
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-surface-subtle rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="font-mono text-sm text-destructive mb-4">
              Failed to load workflows. Retry or refresh the page.
            </p>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["workflows", companyId],
                })
              }
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : workflows.length === 0 ? (
          <div className="bg-surface rounded-lg border border-border-subtle p-12 text-center">
            <div className="font-mono text-4xl text-text-tertiary mb-4">—</div>
            <h3 className="font-mono font-semibold text-lg text-text mb-2">
              No workflows yet
            </h3>
            <p className="font-mono text-sm text-text-secondary mb-6">
              Create your first workflow or choose a template based on your
              company stage.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create workflow
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-surface rounded-lg border border-border-subtle p-6 hover:shadow-md hover:border-border transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-mono font-semibold text-lg text-text mb-2">
                      {workflow.name}
                    </h3>
                    {workflow.description && (
                      <p className="font-mono text-sm text-text-secondary mb-3">
                        {workflow.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-3 mb-3">
                      {getStatusBadge(workflow.status)}
                      <span className="font-mono text-xs text-text-tertiary">
                        {workflow.stepCount} steps
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => openEditDialog(workflow)}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteWorkflowMutation.mutate(workflow.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {workflow.stepCount > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs uppercase tracking-wide text-text-tertiary">
                        Progress
                      </span>
                      <span className="font-mono text-xs text-text-secondary">
                        {workflow.completedSteps}/{workflow.stepCount}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{
                          width: `${
                            workflow.stepCount > 0
                              ? (workflow.completedSteps / workflow.stepCount) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => handleRunWorkflow(workflow.id)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run workflow
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-2xl text-text">
              {editingWorkflow ? "Edit workflow" : "Create workflow"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Workflow name
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Client Onboarding, Content Publishing, Sales Pipeline"
              />
              {!formData.name && (
                <p className="mt-1 font-mono text-xs text-destructive">
                  Workflow name is required
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="e.g., Steps to onboard a new client from contract signature to launch"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Status
              </label>
              <Select
                value={formData.status}
                onValueChange={(value: WorkflowStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border-subtle pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-mono font-semibold text-base uppercase tracking-wide text-text mb-1">
                    Steps
                  </h3>
                  <p className="font-mono text-xs text-text-secondary">
                    Human: manual task. AI: DEX handles. Tool: automated action.
                  </p>
                </div>
                <Button onClick={addStep} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add step
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className="bg-surface-subtle rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-mono text-xs uppercase tracking-wide text-text-tertiary">
                        Step {index + 1}
                      </span>
                      <Button
                        onClick={() => removeStep(index)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Input
                          value={step.title}
                          onChange={(e) =>
                            updateStep(index, { title: e.target.value })
                          }
                          placeholder="e.g., Send welcome email, Schedule kickoff call, Create project folder"
                        />
                      </div>

                      <div className="space-y-2">
                        <Textarea
                          value={step.description}
                          onChange={(e) =>
                            updateStep(index, { description: e.target.value })
                          }
                          placeholder="e.g., Use template in shared drive. CC account manager."
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Select
                          value={step.stepType}
                          onValueChange={(value: StepType) =>
                            updateStep(index, { stepType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="human">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4" />
                                <span>Human</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="ai">
                              <div className="flex items-center space-x-2">
                                <Bot className="w-4 h-4" />
                                <span>AI (DEX)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="tool">
                              <div className="flex items-center space-x-2">
                                <Wrench className="w-4 h-4" />
                                <span>Tool</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                onClick={handleSaveWorkflow}
                disabled={
                  !formData.name ||
                  createWorkflowMutation.isPending ||
                  updateWorkflowMutation.isPending
                }
              >
                Save workflow
              </Button>
              <Button
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetForm();
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>

            {(createWorkflowMutation.isError ||
              updateWorkflowMutation.isError) && (
              <p className="font-mono text-xs text-destructive">
                {editingWorkflow
                  ? "Failed to update workflow. Try again."
                  : "Failed to create workflow. Try again."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </UniversalLayout>
  );
}