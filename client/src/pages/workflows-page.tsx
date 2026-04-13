import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Workflow as WorkflowIcon,
  CheckCircle2,
  Pause,
  MoreVertical,
  ChevronRight,
} from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company, Workflow, InsertWorkflow } from "@shared/schema";
import { usePostHog } from "posthog-js/react";

function WorkflowStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ backgroundColor: "#6a37d4" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="text-xs font-medium text-white uppercase tracking-wide">
          Active
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100">
      <Pause className="h-2.5 w-2.5 text-amber-800" />
      <span className="text-xs font-medium text-amber-800 uppercase tracking-wide">
        Paused
      </span>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return (
    <Card
      className="bg-white transition-all duration-200 hover:shadow-[0_8px_32px_rgba(106,55,212,0.08)] group"
      style={{
        backdropFilter: "none",
        border: "none",
        borderRadius: "12px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.7)";
        e.currentTarget.style.backdropFilter = "blur(16px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#ffffff";
        e.currentTarget.style.backdropFilter = "none";
      }}
    >
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-[#e9ddff] rounded-[12px] flex items-center justify-center">
            <WorkflowIcon className="h-5 w-5 text-[#6a37d4]" />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <WorkflowStatusBadge status={workflow.status ?? "active"} />
          </div>
        </div>

        <h3 className="text-xl font-semibold text-[#2c2f30] mb-2">
          {workflow.name}
        </h3>
        {workflow.description ? (
          <p className="text-sm text-[#595c5d] leading-relaxed line-clamp-3">
            {workflow.description}
          </p>
        ) : (
          <p className="text-sm text-[#abadae] italic">No description</p>
        )}

        {workflow.createdAt && (
          <p className="text-[10px] text-[#abadae] uppercase tracking-widest mt-6">
            Created {new Date(workflow.createdAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreateClick, disabled }: { onCreateClick: () => void; disabled: boolean }) {
  const templates = [
    { name: "Client Onboarding", description: "Welcome new clients and set up their accounts" },
    { name: "Content Publishing", description: "Draft, review, approve, and publish content" },
    { name: "Sales Pipeline", description: "Lead qualification to close" },
  ];

  return (
    <div className="text-center py-16 max-w-2xl mx-auto">
      <div className="mb-8">
        <WorkflowIcon className="h-10 w-10 text-[#abadae] mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-[#2c2f30] mb-3">
          No workflows yet
        </h2>
        <p className="text-[#595c5d] leading-relaxed mb-8">
          Workflows capture repeatable processes — onboarding, publishing,
          sales — so your team can run them the same way every time.
        </p>
        <Button
          onClick={onCreateClick}
          disabled={disabled}
          className="bg-[#6a37d4] text-white px-5 py-2.5 font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
          style={{ borderRadius: "12px" }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create your first workflow
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#2c2f30] mb-4">
          Suggested templates
        </h3>
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.name}
              className="p-6 bg-white text-left"
              style={{
                borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
              }}
            >
              <h4 className="font-medium text-[#2c2f30] mb-1">
                {template.name}
              </h4>
              <p className="text-sm text-[#595c5d]">{template.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const posthog = usePostHog();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: company } = useQuery<Company, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company");
      return (await res.json()) as Company;
    },
  });

  const {
    data: workflows,
    isLoading,
    error,
    refetch,
  } = useQuery<Workflow[], Error>({
    queryKey: ["/api/workflows"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflows");
      return (await res.json()) as Workflow[];
    },
  });

  const createMutation = useMutation<Workflow, Error, InsertWorkflow>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/workflows", input);
      return (await res.json()) as Workflow;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setShowCreate(false);
      setName("");
      setDescription("");
      toast({
        title: "Workflow created",
        description: created.name,
      });
    },
    onError: (err) => {
      toast({
        title: "Couldn't create workflow",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (!company) {
      toast({
        title: "No company found",
        description:
          "A company is required to create a workflow. Finish company setup first.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      name: trimmedName,
      description: description.trim() || undefined,
      companyId: company.id,
      status: "active",
    });
  }

  if (isLoading) {
    return (
      <UniversalLayout title="Workflows">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="h-9 bg-[#eff1f2] rounded w-32 animate-pulse" />
            <div className="h-10 bg-[#eff1f2] rounded w-40 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white p-8 animate-pulse"
                style={{ borderRadius: "12px", minHeight: "200px" }}
              >
                <div className="h-10 w-10 bg-[#eff1f2] rounded-[12px] mb-4" />
                <div className="h-6 bg-[#eff1f2] rounded w-3/4 mb-3" />
                <div className="h-4 bg-[#eff1f2] rounded w-full mb-2" />
                <div className="h-4 bg-[#eff1f2] rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (error) {
    return (
      <UniversalLayout title="Workflows">
        <div className="p-8">
          <div className="text-center py-16">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-[#595c5d] mb-2 font-semibold">
              Failed to load workflows
            </p>
            <p className="text-sm text-[#595c5d] mb-6">{error.message}</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              style={{ borderRadius: "12px" }}
            >
              Retry
            </Button>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout title="Workflows">
      <div className="max-w-[1200px] mx-auto p-8">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-[#2c2f30] mb-3">
              Workflows
            </h1>
            <p className="text-base text-[#595c5d] max-w-xl">
              Standard operating procedures for your company. Create a workflow
              to capture a process you run repeatedly.
            </p>
          </div>
          {workflows && workflows.length > 0 && (
            <Button
              onClick={() => setShowCreate((v) => !v)}
              disabled={!company}
              className="bg-[#6a37d4] text-white px-5 py-3 flex items-center gap-2 font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
              style={{ borderRadius: "12px" }}
            >
              <Plus className="h-4 w-4" />
              {showCreate ? "Cancel" : "New Workflow"}
            </Button>
          )}
        </div>

        {showCreate && (
          <Card
            className="p-6 mb-8 bg-white"
            style={{
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
            }}
          >
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-[#2c2f30]">
                  Create a workflow
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowCreate(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#595c5d]">
                  Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Client Onboarding"
                  disabled={createMutation.isPending}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#595c5d]">
                  Description{" "}
                  <span className="text-[#abadae] normal-case font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="End-to-end process from contract signing to project kickoff."
                  disabled={createMutation.isPending}
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !name.trim()}
                  className="bg-[#6a37d4] text-white px-5 py-2.5 font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
                  style={{ borderRadius: "12px" }}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create workflow"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {!workflows || workflows.length === 0 ? (
          <EmptyState
            onCreateClick={() => setShowCreate(true)}
            disabled={!company}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </div>
    </UniversalLayout>
  );
}
