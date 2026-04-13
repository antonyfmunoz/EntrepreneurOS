import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, CheckCircle2, Circle, User, Bot, Wrench, MoreVertical, ChevronRight, Edit, Trash2 } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "deprecated";
  stepCount: number;
  completedSteps: number;
}

interface WorkflowStep {
  id: string;
  order: number;
  title: string;
  description: string;
  stepType: "human" | "ai" | "tool";
  completedAt: string | null;
}

interface WorkflowWithSteps extends Workflow {
  steps: WorkflowStep[];
  currentStepIndex: number;
}

const stepTypeIcons = {
  human: User,
  ai: Bot,
  tool: Wrench,
};

const stepTypeLabels = {
  human: "Human",
  ai: "AI",
  tool: "Tool",
};

function WorkflowStatusBadge({ status }: { status: Workflow["status"] }) {
  const colors = {
    draft: "bg-[#595c5d] text-white",
    active: "#6a37d4",
    deprecated: "bg-[#abadae] text-[#2c2f30]",
  };

  if (status === "active") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.active }}>
        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
        <span className="text-xs font-medium text-white uppercase tracking-wide">Active</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors[status]}`}>
      <span className="text-xs font-medium uppercase tracking-wide">{status}</span>
    </div>
  );
}

function WorkflowCard({ workflow, onRun }: { workflow: Workflow; onRun: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useParams<{ companyId: string }>();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(workflow.name);
  const [editDescription, setEditDescription] = useState(workflow.description);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/workflows/${workflow.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete workflow");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
      toast({ title: "Workflow deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete workflow", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/workflows/${workflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      if (!res.ok) throw new Error("Failed to update workflow");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
      setIsEditOpen(false);
      toast({ title: "Workflow updated" });
    },
    onError: () => {
      toast({ title: "Failed to update workflow", variant: "destructive" });
    },
  });

  const progress = workflow.stepCount > 0 ? (workflow.completedSteps / workflow.stepCount) * 100 : 0;

  return (
    <>
      <Card 
        className="bg-white transition-all duration-200 hover:shadow-[0_8px_32px_rgba(106,55,212,0.08)] cursor-pointer group"
        style={{ 
          backdropFilter: "none",
          border: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.7)";
          e.currentTarget.style.backdropFilter = "blur(16px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#ffffff";
          e.currentTarget.style.backdropFilter = "none";
        }}
        onClick={onRun}
      >
        <CardContent className="p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-[#2c2f30] mb-2">{workflow.name}</h3>
              <p className="text-sm text-[#595c5d] leading-relaxed">{workflow.description}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <WorkflowStatusBadge status={workflow.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditOpen(true); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#595c5d]">
                {workflow.completedSteps} of {workflow.stepCount} steps completed
              </span>
              <span className="text-[#595c5d]">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-[#eff1f2] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6a37d4] transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#6a37d4] hover:bg-[#eff1f2]"
              onClick={onRun}
            >
              <Play className="h-4 w-4 mr-2" />
              Run workflow
            </Button>
            <ChevronRight className="h-5 w-5 text-[#abadae] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent 
          className="sm:max-w-md"
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(16px)",
            border: "none",
            boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Workflow name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Client Onboarding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What does this workflow accomplish?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || updateMutation.isPending}
              style={{ backgroundColor: "#6a37d4" }}
              className="text-white"
            >
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateWorkflowDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Array<{ title: string; description: string; stepType: "human" | "ai" | "tool" }>>([]);
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepType, setStepType] = useState<"human" | "ai" | "tool">("human");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const workflowRes = await fetch(`/api/companies/${companyId}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, status: "active" }),
      });
      if (!workflowRes.ok) throw new Error("Failed to create workflow");
      const workflow = await workflowRes.json();

      for (let i = 0; i < steps.length; i++) {
        const stepRes = await fetch(`/api/companies/${companyId}/workflows/${workflow.id}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...steps[i], order: i + 1 }),
        });
        if (!stepRes.ok) throw new Error("Failed to create step");
      }

      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
      setOpen(false);
      setName("");
      setDescription("");
      setSteps([]);
      toast({ title: "Workflow created" });
    },
    onError: () => {
      toast({ title: "Failed to create workflow", variant: "destructive" });
    },
  });

  const addStep = () => {
    if (!stepTitle.trim()) return;
    setSteps([...steps, { title: stepTitle, description: stepDescription, stepType }]);
    setStepTitle("");
    setStepDescription("");
    setStepType("human");
    setShowAddStep(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: "#6a37d4" }} className="text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create workflow
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(16px)",
          border: "none",
          boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
        }}
      >
        <DialogHeader>
          <DialogTitle>Create workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workflow name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Onboarding"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow accomplish?"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Steps</Label>
              {!showAddStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddStep(true)}
                  className="text-[#6a37d4]"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add step
                </Button>
              )}
            </div>

            {steps.length === 0 && !showAddStep && (
              <p className="text-sm text-[#595c5d] py-4 text-center">
                No steps yet. Add your first step to define the workflow.
              </p>
            )}

            {steps.map((step, idx) => {
              const Icon = stepTypeIcons[step.stepType];
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 bg-[#f5f6f7] rounded-xl"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[#6a37d4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[#2c2f30]">{step.title}</span>
                      <span className="text-xs text-[#595c5d] uppercase tracking-wide">
                        {stepTypeLabels[step.stepType]}
                      </span>
                    </div>
                    {step.description && (
                      <p className="text-sm text-[#595c5d]">{step.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4 text-[#595c5d]" />
                  </Button>
                </div>
              );
            })}

            {showAddStep && (
              <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
                <DialogContent
                  className="sm:max-w-md"
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(16px)",
                    border: "none",
                    boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Add step</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="step-title">Step title</Label>
                      <Input
                        id="step-title"
                        value={stepTitle}
                        onChange={(e) => setStepTitle(e.target.value)}
                        placeholder="e.g., Send welcome email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="step-description">Description (optional)</Label>
                      <Textarea
                        id="step-description"
                        value={stepDescription}
                        onChange={(e) => setStepDescription(e.target.value)}
                        placeholder="What happens in this step?"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="step-type">Step type</Label>
                      <Select value={stepType} onValueChange={(v: any) => setStepType(v)}>
                        <SelectTrigger id="step-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="human">Human</SelectItem>
                          <SelectItem value="ai">AI</SelectItem>
                          <SelectItem value="tool">Tool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowAddStep(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={addStep}
                      disabled={!stepTitle.trim()}
                      style={{ backgroundColor: "#6a37d4" }}
                      className="text-white"
                    >
                      Add step
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || steps.length === 0 || createMutation.isPending}
            style={{ backgroundColor: "#6a37d4" }}
            className="text-white"
          >
            {createMutation.isPending ? "Creating..." : "Create workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowStepItem({
  step,
  workflowId,
  companyId,
}: {
  step: WorkflowStep;
  workflowId: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const Icon = stepTypeIcons[step.stepType];
  const isComplete = !!step.completedAt;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/workflows/${workflowId}/steps/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: isComplete ? null : new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to update step");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", companyId, workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflows", companyId] });
    },
    onError: () => {
      toast({ title: "Failed to update step", variant: "destructive" });
    },
  });

  return (
    <div className="flex items-start gap-4">
      <button
        onClick={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        className="flex-shrink-0 mt-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
        style={{
          backgroundColor: isComplete ? "#6a37d4" : "transparent",
        }}
      >
        {isComplete ? (
          <CheckCircle2 className="h-6 w-6 text-white" />
        ) : (
          <Circle className="h-6 w-6 text-[#abadae]" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-[#6a37d4]" />
            <span className="text-xs text-[#595c5d] uppercase tracking-wide">
              {stepTypeLabels[step.stepType]}
            </span>
          </div>
        </div>
        <h4 className="text-base font-semibold text-[#2c2f30] mb-1">{step.title}</h4>
        {step.description && (
          <p className="text-sm text-[#595c5d] leading-relaxed">{step.description}</p>
        )}
      </div>
    </div>
  );
}

function WorkflowRunner({ workflowId, onBack }: { workflowId: string; onBack: () => void }) {
  const { companyId } = useParams<{ companyId: string }>();
  const { toast } = useToast();

  const { data: workflow, isLoading, error, refetch } = useQuery<WorkflowWithSteps>({
    queryKey: ["workflow", companyId, workflowId],
    queryFn: async () => {
      const [workflowRes, stepsRes] = await Promise.all([
        fetch(`/api/companies/${companyId}/workflows/${workflowId}`),
        fetch(`/api/companies/${companyId}/workflows/${workflowId}/steps`),
      ]);
      if (!workflowRes.ok || !stepsRes.ok) throw new Error("Failed to fetch workflow");
      const workflow = await workflowRes.json();
      const steps = await stepsRes.json();
      return {
        ...workflow,
        steps: steps.sort((a: WorkflowStep, b: WorkflowStep) => a.order - b.order),
        currentStepIndex: steps.findIndex((s: WorkflowStep) => !s.completedAt),
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-2 bg-[#eff1f2] rounded-full overflow-hidden">
          <div className="h-full w-0 bg-[#6a37d4]" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-4 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-[#eff1f2]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[#eff1f2] rounded w-24" />
              <div className="h-5 bg-[#eff1f2] rounded w-1/2" />
              <div className="h-4 bg-[#eff1f2] rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-[#595c5d] mb-4">Failed to load workflow</p>
        <Button onClick={() => refetch()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!workflow) return null;

  const progress = workflow.stepCount > 0 ? (workflow.completedSteps / workflow.stepCount) * 100 : 0;
  const isComplete = workflow.completedSteps === workflow.stepCount && workflow.stepCount > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Back to workflows
        </Button>
        <WorkflowStatusBadge status={workflow.status} />
      </div>

      <div>
        <h1 className="text-3xl font-semibold text-[#2c2f30] mb-2">{workflow.name}</h1>
        <p className="text-[#595c5d] leading-relaxed">{workflow.description}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#595c5d]">
            {workflow.completedSteps} of {workflow.stepCount} steps completed
          </span>
          <span className="text-[#595c5d]">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-[#eff1f2] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#6a37d4] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isComplete && (
        <div className="p-6 bg-[#f5f6f7] rounded-xl text-center">
          <CheckCircle2 className="h-12 w-12 text-[#6a37d4] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#2c2f30] mb-1">Workflow complete</h3>
          <p className="text-sm text-[#595c5d]">All steps have been marked complete.</p>
        </div>
      )}

      <div className="space-y-6">
        {workflow.steps.map((step) => (
          <WorkflowStepItem
            key={step.id}
            step={step}
            workflowId={workflow.id}
            companyId={companyId!}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ companyId }: { companyId: string }) {
  const templates = [
    { name: "Client Onboarding", description: "Welcome new clients and set up their accounts" },
    { name: "Content Publishing", description: "Draft, review, approve, and publish content" },
    { name: "Sales Pipeline", description: "Lead qualification to close" },
  ];

  return (
    <div className="text-center py-16 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[#2c2f30] mb-3">No workflows yet</h2>
        <p className="text-[#595c5d] leading-relaxed mb-8">
          Workflows codify how your company works. Write a workflow once, run it step by step, and assign steps to humans or your assistant.
        </p>
        <CreateWorkflowDialog companyId={companyId} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#2c2f30] mb-4">Suggested templates</h3>
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.name}
              className="p-6 bg-white rounded-xl text-left"
              style={{
                boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
              }}
            >
              <h4 className="font-medium text-[#2c2f30] mb-1">{template.name}</h4>
              <p className="text-sm text-[#595c5d]">{template.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [, setLocation] = useLocation();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows, isLoading, error, refetch } = useQuery<Workflow[]>({
    queryKey: ["workflows", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/workflows`);
      if (!res.ok) throw new Error("Failed to fetch workflows");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <UniversalLayout>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="h-9 bg-[#eff1f2] rounded w-32 animate-pulse" />
            <div className="h-10 bg-[#eff1f2] rounded w-40 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-8 animate-pulse" style={{ minHeight: "240px" }}>
                <div className="h-6 bg-[#eff1f2] rounded w-3/4 mb-4" />
                <div className="h-4 bg-[#eff1f2] rounded w-full mb-2" />
                <div className="h-4 bg-[#eff1f2] rounded w-2/3 mb-6" />
                <div className="h-2 bg-[#eff1f2] rounded w-full mb-4" />
                <div className="h-9 bg-[#eff1f2] rounded w-32" />
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
        <div className="p-8">
          <div className="text-center py-16">
            <p className="text-[#595c5d] mb-4">Failed to load workflows</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (selectedWorkflowId) {
    return (
      <UniversalLayout>
        <div className="p-8 max-w-4xl mx-auto">
          <WorkflowRunner
            workflowId={selectedWorkflowId}
            onBack={() => setSelectedWorkflowId(null)}
          />
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold text-[#2c2f30]">Workflows</h1>
          {workflows && workflows.length > 0 && <CreateWorkflowDialog companyId={companyId!} />}
        </div>

        {!workflows || workflows.length === 0 ? (
          <EmptyState companyId={companyId!} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onRun={() => setSelectedWorkflowId(workflow.id)}
              />
            ))}
          </div>
        )}
      </div>
    </UniversalLayout>
  );
}