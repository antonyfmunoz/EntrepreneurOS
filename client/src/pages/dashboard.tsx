import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { StatsOverview } from "@/components/stats-overview";
import { AgentCard } from "@/components/agent-card";
import { TaskBoard } from "@/components/task-board";
import { Integrations } from "@/components/integrations";
import { useQuery } from "@tanstack/react-query";

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

export default function Dashboard() {
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  return (
    <div className="bg-gray-50 h-screen flex overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header title="Dashboard" />
        
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <StatsOverview />
          
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Agents</h2>
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
          
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Integrations</h2>
          <Integrations />
        </div>
      </div>
    </div>
  );
}
