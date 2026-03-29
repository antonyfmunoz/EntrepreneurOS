import { Layout } from "@/components/layout";
import { AgentCard } from "@/components/agent-card";
import { TaskBoard } from "@/components/task-board";
import { AiFab } from "@/components/ai-fab";
import { ActionApprovalPanel } from "@/components/action-approval-panel";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/hooks/use-company";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: string;
  latestActivity: string;
  tasks: {
    id: string;
    title: string;
    status: "todo" | "in-progress" | "done";
  }[];
};

type Workflow = {
  id: string;
  name: string;
  description?: string;
  status: "active" | "paused";
};

export default function Dashboard() {
  const { company, hasCompany, isLoading } = useCompany();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !hasCompany) {
      setLocation("/company-setup");
    }
  }, [isLoading, hasCompany, setLocation]);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">

        {/* Company Header */}
        {company && (
          <div className="bg-white shadow rounded-lg p-6 border">
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {company.type || "Company"} • {company.stage || "Stage not set"}
            </p>

            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <p className="text-gray-400">Offer</p>
                <p className="font-medium">{company.offer || "Not defined"}</p>
              </div>

              <div>
                <p className="text-gray-400">Target Customer</p>
                <p className="font-medium">{company.targetCustomer || "Not defined"}</p>
              </div>

              <div>
                <p className="text-gray-400">Goals</p>
                <p className="font-medium">{company.goals || "Not defined"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Workflows */}
        <div className="bg-white shadow rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Company Workflows</h2>

          {workflows.length === 0 ? (
            <p className="text-sm text-gray-500">
              No workflows yet. Create your first workflow to automate your company.
            </p>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="border rounded-md p-3 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{workflow.name}</p>
                    {workflow.description && (
                      <p className="text-sm text-gray-500">
                        {workflow.description}
                      </p>
                    )}
                  </div>

                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {workflow.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <ActionApprovalPanel />

        <h2 className="text-lg font-semibold text-gray-800 mb-4">Company Roles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              id={agent.id}
              name={agent.name}
              role={agent.role}
              icon={agent.icon}
              latestActivity={agent.latestActivity}
              tasks={agent.tasks}
            />
          ))}
        </div>
        
        <TaskBoard />
        
        <AiFab />
      </div>
    </Layout>
  );
}
