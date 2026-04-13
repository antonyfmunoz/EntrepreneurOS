import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Workflow as WorkflowIcon,
  CheckCircle2,
  Pause,
} from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company, Workflow, InsertWorkflow } from "@shared/schema";
import { usePostHog } from "posthog-js/react";

// The real /api/workflows endpoint in server/routes/workflows.ts exposes
// GET (list) and POST (create). There's no PATCH/DELETE yet, and the
// schema has no `steps` table — workflows are flat rows with a status
// enum of "active" | "paused". Per the wiring rules: no step builder.

export default function WorkflowsPage() {
  const posthog = usePostHog();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Need the company to attach the new workflow to — POST /api/workflows
  // requires a companyId per insertWorkflowSchema.
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

  return (
    <UniversalLayout title="Workflows">
      <div className="max-w-[1200px] mx-auto">
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
          <Button
            onClick={() => setShowCreate((v) => !v)}
            disabled={!company}
            className="bg-[#6a37d4] text-white px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? "Cancel" : "New Workflow"}
          </Button>
        </div>

        {showCreate && (
          <Card className="p-6 mb-8 bg-white shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
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
                <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
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
                <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Description{" "}
                  <span className="text-slate-400 normal-case font-normal">
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
                  className="bg-[#6a37d4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
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

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span className="text-sm">Loading workflows…</span>
          </div>
        )}

        {error && !isLoading && (
          <Card className="p-6 bg-red-50 border border-red-200 max-w-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  Couldn't load workflows
                </p>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
              </div>
            </div>
          </Card>
        )}

        {!isLoading && !error && workflows && workflows.length === 0 && (
          <Card className="p-12 text-center bg-[#f8f9fa] border border-dashed border-slate-200">
            <WorkflowIcon className="h-10 w-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
              No workflows yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Workflows capture repeatable processes — onboarding, publishing,
              sales — so your team can run them the same way every time.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              disabled={!company}
              className="bg-[#6a37d4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first workflow
            </Button>
          </Card>
        )}

        {!isLoading && !error && workflows && workflows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => {
              const isPaused = workflow.status === "paused";
              return (
                <Card
                  key={workflow.id}
                  className="p-6 bg-white hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-[#e9ddff] rounded-lg flex items-center justify-center">
                      <WorkflowIcon className="h-5 w-5 text-[#6a37d4]" />
                    </div>
                    <Badge
                      className={
                        isPaused
                          ? "bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider"
                          : "bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider"
                      }
                    >
                      {isPaused ? (
                        <>
                          <Pause className="h-2.5 w-2.5 mr-1 inline" />
                          Paused
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1 inline" />
                          Active
                        </>
                      )}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
                    {workflow.name}
                  </h3>
                  {workflow.description ? (
                    <p className="text-sm text-slate-500 line-clamp-3">
                      {workflow.description}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      No description
                    </p>
                  )}
                  {workflow.createdAt && (
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-4">
                      Created{" "}
                      {new Date(workflow.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </UniversalLayout>
  );
}
