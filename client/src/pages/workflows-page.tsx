import { useState } from "react";
import { Link } from "wouter";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowRight,
  Plus,
  MoreVertical,
  CheckCircle2,
  Check,
  Sparkles,
  Terminal,
  User,
  X,
  Pause,
  Brain,
  Package,
} from "lucide-react";

interface WorkflowStep {
  id: string;
  type: "human" | "ai" | "tool";
  title: string;
  description: string;
  status: "complete" | "processing" | "pending";
  assignee?: {
    name: string;
    avatar: string;
    completedAt?: string;
  };
  aiMetadata?: {
    tokens: number;
    confidence: number;
    progress: number;
  };
}

interface Workflow {
  id: string;
  title: string;
  description: string;
  status: "active" | "draft" | "completed";
  stepsComplete: number;
  stepsTotal: number;
  assignees: Array<{
    name: string;
    avatar: string;
    isAI?: boolean;
  }>;
  runningInstance?: {
    clientName: string;
    steps: WorkflowStep[];
  };
}

const workflows: Workflow[] = [
  {
    id: "1",
    title: "Client Onboarding",
    description: "End-to-end process from contract signing to project kickoff and setup.",
    status: "active",
    stepsComplete: 3,
    stepsTotal: 5,
    assignees: [
      { name: "Sarah Chen", avatar: "/avatars/sarah.jpg" },
      { name: "Mark Wilson", avatar: "/avatars/mark.jpg" },
      { name: "AI Assistant", avatar: "", isAI: true },
    ],
    runningInstance: {
      clientName: "Nexus Dynamics",
      steps: [
        {
          id: "1",
          type: "human",
          title: "Verify Contract Signature",
          description: "Review PandaDoc for execution by both parties.",
          status: "complete",
          assignee: {
            name: "Sarah Chen",
            avatar: "/avatars/sarah.jpg",
            completedAt: "2h ago",
          },
        },
        {
          id: "2",
          type: "ai",
          title: "Extract Deliverables",
          description: "AI is parsing the SOW to create tasks in Notion.",
          status: "processing",
          aiMetadata: {
            tokens: 1240,
            confidence: 98,
            progress: 75,
          },
        },
        {
          id: "3",
          type: "tool",
          title: "Slack Workspace Setup",
          description: "Automatically create channel and invite team members.",
          status: "pending",
        },
        {
          id: "4",
          type: "human",
          title: "Review Kickoff Deck",
          description: "Final approval of the strategic roadmap before the call.",
          status: "pending",
        },
      ],
    },
  },
  {
    id: "2",
    title: "Content Publishing",
    description: "Multi-channel distribution flow including AI drafting and human review.",
    status: "draft",
    stepsComplete: 1,
    stepsTotal: 8,
    assignees: [
      { name: "David Park", avatar: "/avatars/david.jpg" },
      { name: "AI Assistant", avatar: "", isAI: true },
    ],
  },
  {
    id: "3",
    title: "Sales Pipeline",
    description: "Automation for inbound lead qualification and outreach scheduling.",
    status: "completed",
    stepsComplete: 6,
    stepsTotal: 6,
    assignees: [],
  },
];

const templates = [
  {
    id: "t1",
    title: "AI Talent Acquisition",
    description: "Automate screening and initial interviews",
    icon: Brain,
    color: "primary",
  },
  {
    id: "t2",
    title: "Monthly Financial Audit",
    description: "Reconcile statements and flag anomalies",
    icon: Package,
    color: "secondary",
  },
];

export default function WorkflowsPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const getStatusBadge = (status: Workflow["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold uppercase tracking-wider">
            Active
          </Badge>
        );
      case "draft":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-bold uppercase tracking-wider">
            Draft
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100 text-[10px] font-bold uppercase tracking-wider">
            Completed
          </Badge>
        );
    }
  };

  const getStepIcon = (type: WorkflowStep["type"], status: WorkflowStep["status"]) => {
    if (status === "complete") {
      return <Check className="w-5 h-5 text-white" />;
    }
    switch (type) {
      case "human":
        return <User className="w-5 h-5 text-slate-600" />;
      case "ai":
        return <Sparkles className="w-5 h-5 text-white" />;
      case "tool":
        return <Terminal className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStepStatusColor = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "complete":
        return "bg-emerald-500";
      case "processing":
        return "bg-primary";
      case "pending":
        return "bg-slate-200";
    }
  };

  const getStepStatusLabel = (type: WorkflowStep["type"], status: WorkflowStep["status"]) => {
    const typeLabel = type === "human" ? "Human Task" : type === "ai" ? "AI Action" : "Tool Integration";
    const statusLabel = status === "complete" ? "Complete" : status === "processing" ? "Processing" : "Pending";
    const colorClass =
      status === "complete"
        ? "text-emerald-600"
        : status === "processing"
        ? "text-primary"
        : "text-on-surface-variant";

    return (
      <p className={`text-xs font-bold uppercase tracking-tighter mb-1 ${colorClass}`}>
        {typeLabel} • {statusLabel}
      </p>
    );
  };

  return (
    <UniversalLayout title="Standard Operating Procedures">
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* AI Control Panel */}
        <div className="flex justify-center mb-12">
          <div className="glass-panel rounded-full px-6 py-3 flex items-center gap-8 border border-white/40 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-semibold text-on-surface">3 Active Workflows</span>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant/30"></div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-label uppercase text-on-surface-variant tracking-wider">
                Next Action
              </span>
              <span className="text-sm font-medium text-primary">Review Hire</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-4 h-8 w-8 rounded-full hover:bg-primary-fixed text-primary"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex justify-between items-end mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-on-surface">
              Standard Operating Procedures
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              Run your company from one place with automated excellence.
            </p>
          </div>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              className="px-6 py-2.5 rounded-full font-semibold text-primary hover:bg-primary/5"
            >
              Browse Templates
            </Button>
            <Button className="px-6 py-2.5 rounded-full font-semibold bg-gradient-to-br from-[#5210bc] to-[#6a37d4] text-white hover:opacity-90 flex items-center gap-2">
              <Plus className="h-[18px] w-[18px]" />
              Create Workflow
            </Button>
          </div>
        </div>

        {/* Workflow Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className={`group bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden ${
                workflow.status === "completed" ? "border-2 border-dashed border-primary/20" : ""
              }`}
              onClick={() => workflow.runningInstance && setSelectedWorkflow(workflow)}
            >
              {workflow.status === "active" && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              )}
              <div className="relative">
                <div className="flex justify-between items-start mb-6">
                  {getStatusBadge(workflow.status)}
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-on-surface-variant/40">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2">{workflow.title}</h3>
                <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                  {workflow.description}
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-medium text-on-surface-variant">
                    <span>Step Progress</span>
                    <span>
                      {workflow.stepsComplete}/{workflow.stepsTotal} steps
                    </span>
                  </div>
                  {workflow.status === "completed" ? (
                    <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="w-full h-full bg-emerald-500"></div>
                    </div>
                  ) : (
                    <Progress
                      value={(workflow.stepsComplete / workflow.stepsTotal) * 100}
                      className="h-1.5"
                    />
                  )}
                  {workflow.status === "completed" ? (
                    <div className="flex items-center gap-2 pt-2 text-emerald-600 text-xs font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Archived Yesterday</span>
                    </div>
                  ) : (
                    <div className="flex -space-x-2 pt-2">
                      {workflow.assignees.map((assignee, idx) =>
                        assignee.isAI ? (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded-full border-2 border-white bg-secondary-fixed flex items-center justify-center text-[10px] font-bold text-on-secondary-fixed-variant"
                          >
                            +AI
                          </div>
                        ) : (
                          <Avatar key={idx} className="w-8 h-8 border-2 border-white">
                            <AvatarImage src={assignee.avatar} alt={assignee.name} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State / Templates Section */}
        <div className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-violet-200/20 blur-[100px] rounded-full"></div>
            <div className="relative bg-surface-container-low p-1 rounded-3xl">
              <div className="bg-surface rounded-[22px] overflow-hidden">
                <div className="w-full aspect-video bg-gradient-to-br from-violet-50 to-slate-50 flex items-center justify-center opacity-80">
                  <div className="text-center p-12">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-primary" />
                    </div>
                    <p className="text-sm text-on-surface-variant">Workflow visualization placeholder</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-on-surface">Ready to scale efficiency?</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Choose from our pre-built operational templates to automate your business logic in
              minutes. Every SOP is an asset you own.
            </p>
            <div className="flex flex-col gap-3">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <div
                    key={template.id}
                    className="flex items-center gap-4 p-4 bg-white/50 rounded-xl hover:bg-white transition-all cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg ${
                        template.color === "primary" ? "bg-primary-fixed text-primary" : "bg-secondary-fixed text-secondary"
                      } flex items-center justify-center`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{template.title}</p>
                      <p className="text-xs text-on-surface-variant">{template.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Runner View (Side Panel) */}
      <Sheet open={!!selectedWorkflow} onOpenChange={(open) => !open && setSelectedWorkflow(null)}>
        <SheetContent side="right" className="w-[450px] p-0 flex flex-col">
          <SheetHeader className="p-8 border-b border-surface-container/50">
            <div className="flex justify-between items-center mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedWorkflow(null)}
                className="h-10 w-10 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="px-4 py-2 text-xs font-bold border-primary/20 text-primary rounded-full"
                >
                  <Pause className="h-3 w-3 mr-1" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  className="px-4 py-2 text-xs font-bold bg-gradient-to-br from-[#5210bc] to-[#6a37d4] text-white rounded-full hover:opacity-90"
                >
                  Execute Now
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-label uppercase tracking-widest text-primary font-bold">
                Currently Running
              </span>
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            </div>
            <SheetTitle className="text-2xl font-bold text-on-surface text-left">
              {selectedWorkflow?.title}
            </SheetTitle>
            <p className="text-on-surface-variant text-sm mt-2 leading-relaxed text-left">
              Active instance for{" "}
              <span className="text-on-surface font-semibold">
                {selectedWorkflow?.runningInstance?.clientName}
              </span>
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-8">
            <div className="space-y-10 relative">
              {/* Progress Line */}
              <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-surface-container"></div>

              {selectedWorkflow?.runningInstance?.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`relative flex gap-6 ${step.status === "pending" ? "opacity-40" : ""}`}
                >
                  <div
                    className={`z-10 w-12 h-12 rounded-full ${getStepStatusColor(
                      step.status
                    )} flex items-center justify-center ring-8 ring-white`}
                  >
                    {getStepIcon(step.type, step.status)}
                  </div>
                  <div className="flex-1">
                    {getStepStatusLabel(step.type, step.status)}
                    <h4 className="text-lg font-bold text-on-surface">{step.title}</h4>
                    <p className="text-sm text-on-surface-variant mt-1">{step.description}</p>
                    {step.assignee && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={step.assignee.avatar} alt={step.assignee.name} />
                          <AvatarFallback>{step.assignee.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>
                          {step.assignee.name} verified this {step.assignee.completedAt}
                        </span>
                      </div>
                    )}
                    {step.aiMetadata && (
                      <div className="mt-4 p-4 bg-primary/5 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-primary uppercase">
                            Tokens: {step.aiMetadata.tokens.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-primary uppercase">
                            {step.aiMetadata.confidence}% confidence
                          </span>
                        </div>
                        <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary animate-pulse transition-all"
                            style={{ width: `${step.aiMetadata.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </UniversalLayout>
  );
}