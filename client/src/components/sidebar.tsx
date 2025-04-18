import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { CreateAgentModal } from "./create-agent-modal";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: string;
  activeTasks: number;
};

export function Sidebar() {
  const [location] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, logoutMutation } = useAuth();

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "marketing":
        return "ri-megaphone-line";
      case "support":
        return "ri-customer-service-2-line";
      case "content":
        return "ri-article-line";
      case "operations":
        return "ri-user-settings-line";
      default:
        return "ri-robot-line";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "marketing":
        return "bg-primary";
      case "support":
        return "bg-secondary";
      case "content":
        return "bg-accent";
      case "operations":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer hover:text-primary transition-colors">
              <i className="ri-cpu-line text-primary text-2xl"></i>
              <h1 className="text-xl font-bold text-gray-800 hover:text-primary">AgentOS</h1>
            </div>
            <p className="text-xs text-gray-500 mt-1">AI Operating System for Business</p>
          </Link>
        </div>

        <nav className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Navigation</h2>
          
          <ul className="space-y-2">
            <li>
              <Link href="/">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-dashboard-line"></i>
                  <span>Dashboard</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/tasks">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/tasks" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-task-line"></i>
                  <span>Task Board</span>
                </div>
              </Link>
            </li>
            <li>
              {agents.length > 0 ? (
                <div className="flex items-center">
                  <Link href={`/chat/${agents[0].id}`}>
                    <div className={cn(
                      "flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-gray-100 text-gray-700",
                      location.startsWith("/chat") && "bg-blue-50 text-primary font-medium",
                      "flex-grow"
                    )}>
                      <i className="ri-chat-3-line"></i>
                      <span>Agent Chat</span>
                    </div>
                  </Link>

                </div>
              ) : (
                <div 
                  className="flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-gray-100 text-gray-500"
                  onClick={() => setIsModalOpen(true)}
                >
                  <i className="ri-chat-3-line"></i>
                  <span>Agent Chat</span>
                </div>
              )}
            </li>
            <li>
              <Link href="/analytics">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/analytics" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-bar-chart-line"></i>
                  <span>Analytics</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/integrations">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/integrations" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-link"></i>
                  <span>Integrations</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/settings">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/settings" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-settings-3-line"></i>
                  <span>Settings</span>
                </div>
              </Link>
            </li>
          </ul>

          {agents.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Agents</h2>
                <button 
                  className="text-xs text-primary hover:text-primary/80"
                  onClick={() => setIsModalOpen(true)}
                >
                  <i className="ri-add-line mr-1"></i>
                  New
                </button>
              </div>
              
              <ul className="space-y-2">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <div className="group">
                      <Link href={`/chat/${agent.id}`}>
                        <div className={cn(
                          "flex items-center space-x-2 px-2 py-2 rounded-md cursor-pointer",
                          location === `/chat/${agent.id}` 
                            ? "bg-blue-50 text-primary" 
                            : "hover:bg-gray-100"
                        )}>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <i className={`${agent.icon || getRoleIcon(agent.role)} text-primary text-sm`}></i>
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium truncate">{agent.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {agent.role === "executive" ? "Chief Executive Officer" : 
                               agent.role === "assistant" ? "Executive Assistant" : 
                               agent.role === "marketing" ? "Marketing Director" :
                               agent.role === "operations" ? "Operations Manager" :
                               agent.role === "content" ? "Content Strategist" :
                               agent.role === "support" ? "Support Specialist" :
                               agent.role}
                            </p>
                          </div>
                          {agent.activeTasks > 0 && (
                            <span className="w-5 h-5 bg-primary/10 text-primary text-xs flex items-center justify-center rounded-full">
                              {agent.activeTasks}
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 hidden group-hover:flex">
                        <Link href={`/agent-programming?id=${agent.id}`}>
                          <button className="text-gray-400 hover:text-primary p-1">
                            <i className="ri-settings-line text-sm"></i>
                          </button>
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <i className="ri-user-line text-gray-600"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {user ? user.fullName || user.username : "Guest"}
              </p>
              <p className="text-xs text-gray-500">
                {user?.company || "Business Owner"}
              </p>
            </div>
            <button 
              className="ml-auto text-gray-400 hover:text-gray-600"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <i className="ri-logout-box-line"></i>
            </button>
          </div>
        </div>
      </div>

      <CreateAgentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
