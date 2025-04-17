import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/notification-dropdown";

type HeaderProps = {
  title: string;
  children?: ReactNode;
};

export function Header({ title, children }: HeaderProps) {
  const [_, navigate] = useLocation();

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
      <div className="flex items-center">
        {children}
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      </div>
      <div className="ml-auto flex items-center space-x-4">
        <NotificationDropdown />

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
