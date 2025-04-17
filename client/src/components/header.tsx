import { Link, useLocation } from "wouter";
import { ReactNode, useState } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type HeaderProps = {
  title: string;
  children?: ReactNode;
};

export function Header({ title, children }: HeaderProps) {
  const [_, navigate] = useLocation();
  const [notificationCount] = useState(2); // This would come from a real notification service

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
      <div className="flex items-center">
        {children}
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      </div>
      <div className="ml-auto flex items-center space-x-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <i className="ri-notification-3-line"></i>
              {notificationCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px]" 
                  variant="destructive"
                >
                  {notificationCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuItem 
              className="cursor-pointer"
              onClick={() => navigate("/notifications")}
            >
              <div className="w-full">
                <div className="flex justify-between items-center">
                  <span className="font-medium">New Task Assigned</span>
                  <span className="text-xs text-gray-500">2h ago</span>
                </div>
                <p className="text-sm text-gray-600 truncate">Sales Agent assigned you a task: Create marketing content</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="cursor-pointer"
              onClick={() => navigate("/notifications")}
            >
              <div className="w-full">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Integration Connected</span>
                  <span className="text-xs text-gray-500">1d ago</span>
                </div>
                <p className="text-sm text-gray-600 truncate">Notion integration was successfully connected</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="justify-center text-primary cursor-pointer"
              onClick={() => navigate("/notifications")}
            >
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <i className="ri-question-line"></i>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" onClick={() => window.open("https://docs.agentos.dev", "_blank")}>
              Documentation
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => window.open("https://discord.gg/agentos", "_blank")}>
              Discord Community
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/tutorials")}>
              Tutorials
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/support")}>
              Contact Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
