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

type SidebarProps = {
  collapsed?: boolean;
};

export function Sidebar({ collapsed = false }: SidebarProps) {
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
            {/* Home → dashboard */}
            <li>
              <Link href="/">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-home-4-line"></i>
                  <span>Home</span>
                </div>
              </Link>
            </li>

            {/* Company → CRM (company/customer profile) */}
            <li>
              <Link href="/crm">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/crm" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-building-line"></i>
                  <span>Company</span>
                </div>
              </Link>
            </li>

            {/* Roles → agent programming */}
            <li>
              <Link href="/agent-programming">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location.startsWith("/agent-programming") 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-user-settings-line"></i>
                  <span>Roles</span>
                </div>
              </Link>
            </li>

            {/* Workflows → analytics (workflow-like dashboard) */}
            <li>
              <Link href="/analytics">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/analytics" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-flow-chart"></i>
                  <span>Workflows</span>
                </div>
              </Link>
            </li>

            {/* Tasks → task board */}
            <li>
              <Link href="/tasks">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/tasks" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-task-line"></i>
                  <span>Tasks</span>
                </div>
              </Link>
            </li>

            {/* Docs → documents */}
            <li>
              <Link href="/documents">
                <div className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
                  location === "/documents" 
                    ? "bg-blue-50 text-primary font-medium" 
                    : "hover:bg-gray-100 text-gray-700"
                )}>
                  <i className="ri-file-list-3-line"></i>
                  <span>Docs</span>
                </div>
              </Link>
            </li>

            {/* AI → agent chat */}
            <li>
              {agents.length > 0 ? (
                <div className="flex items-center">
                  <Link href={`/chat/${agents[0].id}`}>
                    <div className={cn(
                      "flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-gray-100 text-gray-700",
                      location.startsWith("/chat") && "bg-blue-50 text-primary font-medium",
                      "flex-grow"
                    )}>
                      <i className="ri-robot-2-line"></i>
                      <span>AI</span>
                    </div>
                  </Link>
                </div>
              ) : (
                <div 
                  className="flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-gray-100 text-gray-500"
                  onClick={() => setIsModalOpen(true)}
                >
                  <i className="ri-robot-2-line"></i>
                  <span>AI</span>
                </div>
              )}
            </li>

            {/* Settings → settings */}
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
        <li>
          <Link href="/dashboard">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/dashboard"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-dashboard-line"></i>
              <span>Dashboard</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/admin">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/admin"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-dashboard-line"></i>
              <span>AdminDashboard</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/portfolios">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/portfolios"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-layout-line"></i>
              <span>PortfolioList</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/portfolios/:portfolioId">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/portfolios/:portfolioId"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-layout-line"></i>
              <span>PortfolioDetail</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/company/:companyId">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/company/:companyId"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-layout-line"></i>
              <span>CommandCenter</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/company/:companyId/org">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/company/:companyId/org"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-organization-chart"></i>
              <span>OrgChart</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/company/:companyId/chat">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/company/:companyId/chat"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-chat-3-line"></i>
              <span>AgentChat</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/company/:companyId/workflows">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/company/:companyId/workflows"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-layout-line"></i>
              <span>Workflows</span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/company/:companyId/tasks">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "/company/:companyId/tasks"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="ri-task-line"></i>
              <span>TaskBoard</span>
            </div>
          </Link>
        </li>
          </ul>
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
