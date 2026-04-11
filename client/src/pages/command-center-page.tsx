import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  CheckSquare,
  Workflow,
  Building2,
  Settings,
  Plus,
  Loader2,
  AlertCircle,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import type { Company, Task } from "@shared/schema";

// The manual routes in server/routes/workflows.ts return a flat list of
// workflows keyed by the authenticated user; it doesn't accept a companyId
// filter yet. Defining the shape inline rather than importing from
// @shared/schema because the shape varies between the DB table and the
// JSON returned by registerWorkflowRoutes.
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

export default function CommandCenter({ params }: CommandCenterProps) {
  const [, navigate] = useLocation();
  const companyId = params.companyId;

  // GET /api/company — returns the currently-authenticated user's company.
  // The generated GET /api/companies/:id endpoint is a 501 stub right now,
  // so we fall back to the manual single-company endpoint. This is accurate
  // for single-company accounts; multi-company scoping lands in a follow-up.
  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
  } = useQuery<Company, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company");
      return (await res.json()) as Company;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[], Error>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tasks");
      return (await res.json()) as Task[];
    },
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery<
    WorkflowSummary[],
    Error
  >({
    queryKey: ["/api/workflows"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflows");
      return (await res.json()) as WorkflowSummary[];
    },
  });

  const isLoading = companyLoading;
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

  return (
    <UniversalLayout
      title="Command Center"
      leftRailItems={leftRailItems}
      companyName={companyName}
    >
      <div className="p-12">
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span className="text-sm">Loading company…</span>
          </div>
        )}

        {companyError && !isLoading && (
          <Card className="p-6 bg-red-50 border border-red-200 max-w-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  Couldn't load company
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {companyError.message}
                </p>
                <Link
                  href="/portfolios"
                  className="text-sm text-red-700 underline mt-2 inline-block"
                >
                  Back to portfolios
                </Link>
              </div>
            </div>
          </Card>
        )}

        {company && (
          <>
            <div className="mb-16">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6a37d4] mb-4 block">
                Operationally Wise
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-[#2c2f30] mb-2">
                Good Morning, Founder.
              </h1>
              <p className="text-[#595c5d] text-lg">
                Command Center <span className="text-slate-300 mx-2">/</span>{" "}
                {companyName}
              </p>
              {company.stage && (
                <p className="text-sm text-slate-400 mt-2">
                  {company.stage}
                  {company.type && ` • ${company.type}`}
                </p>
              )}
            </div>

            {/* Live counts — real data from /api/tasks and /api/workflows */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              <Card className="bg-[#eceeef] p-8 rounded-[24px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] flex flex-col justify-between min-h-[160px] border-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Open Tasks
                </span>
                <span className="text-4xl font-bold">
                  {tasksLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                  ) : (
                    openTaskCount
                  )}
                </span>
              </Card>
              <Card className="bg-[#eceeef] p-8 rounded-[24px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] flex flex-col justify-between min-h-[160px] border-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Active Workflows
                </span>
                <span className="text-4xl font-bold">
                  {workflowsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                  ) : (
                    activeWorkflowCount
                  )}
                </span>
              </Card>
              <Card className="bg-[#eceeef] p-8 rounded-[24px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] flex flex-col justify-between min-h-[160px] border-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Stage
                </span>
                <span className="text-4xl font-bold">
                  {company.stage ?? "—"}
                </span>
              </Card>
              <Card className="bg-[#eceeef] p-8 rounded-[24px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] flex flex-col justify-between min-h-[160px] border-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Assistant
                </span>
                <span className="text-4xl font-bold">
                  {company.assistantName ?? "OS-1"}
                </span>
              </Card>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card
                onClick={() => navigate(`/company/${companyId}/tasks`)}
                className="p-8 bg-white cursor-pointer hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-[#e9ddff] rounded-xl flex items-center justify-center">
                    <CheckSquare className="h-6 w-6 text-[#6a37d4]" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-[#6a37d4] group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-xl font-bold text-[#2c2f30] mb-2">
                  Open Task Board
                </h3>
                <p className="text-sm text-slate-500">
                  {openTaskCount} open{" "}
                  {openTaskCount === 1 ? "task" : "tasks"}
                </p>
              </Card>

              <Card
                onClick={() => navigate(`/company/${companyId}/workflows`)}
                className="p-8 bg-white cursor-pointer hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-[#e9ddff] rounded-xl flex items-center justify-center">
                    <Workflow className="h-6 w-6 text-[#6a37d4]" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-[#6a37d4] group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-xl font-bold text-[#2c2f30] mb-2">
                  Run a Workflow
                </h3>
                <p className="text-sm text-slate-500">
                  {activeWorkflowCount} active{" "}
                  {activeWorkflowCount === 1 ? "workflow" : "workflows"}
                </p>
              </Card>

              <Card
                onClick={() => navigate(`/company/${companyId}/chat`)}
                className="p-8 bg-white cursor-pointer hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-[#e9ddff] rounded-xl flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-[#6a37d4]" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-[#6a37d4] group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-xl font-bold text-[#2c2f30] mb-2">
                  Talk to {company.assistantName ?? "OS-1"}
                </h3>
                <p className="text-sm text-slate-500">
                  Ask your assistant anything
                </p>
              </Card>
            </div>

            <div className="mt-8 flex gap-4">
              <Button
                variant="outline"
                onClick={() => navigate(`/company/${companyId}/org`)}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                View Org Chart
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/settings`)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/company/${companyId}/tasks`)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </>
        )}
      </div>
    </UniversalLayout>
  );
}
