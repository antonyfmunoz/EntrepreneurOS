import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/clerk-react";
import { Bell, ChevronDown, Building2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
  onLeftMenuClick?: () => void;
  onRightMenuClick?: () => void;
  currentCompany?: {
    id: string;
    name: string;
  };
  currentProject?: {
    id: string;
    name: string;
  };
  companies?: Array<{
    id: string;
    name: string;
  }>;
  projects?: Array<{
    id: string;
    name: string;
  }>;
  onCompanyChange?: (companyId: string) => void;
  onProjectChange?: (projectId: string) => void;
  notificationCount?: number;
}

export function Header({
  title,
  children,
  currentCompany,
  currentProject,
  companies = [],
  projects = [],
  onCompanyChange,
  onProjectChange,
  notificationCount = 0,
}: HeaderProps) {
  const { user } = useUser();
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "U";

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
      }}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        {/* Left: Logo/Brand */}
        <div className="flex items-center gap-6">
          {children}
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-semibold text-sm"
                style={{ background: "#6a37d4" }}
              >
                EO
              </div>
              <span className="hidden md:block font-semibold text-base" style={{ color: "#2c2f30" }}>
                EntrepreneurOS
              </span>
          </Link>
          {title && <span className="hidden md:block text-sm font-medium text-[#595c5d]">{title}</span>}
        </div>

        {/* Center: Context Switchers */}
        <div className="hidden lg:flex items-center gap-3">
          {currentCompany && (
            <DropdownMenu open={isCompanyOpen} onOpenChange={setIsCompanyOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 px-3 h-9"
                  style={{
                    borderRadius: "12px",
                    color: "#2c2f30",
                  }}
                >
                  <Building2 className="h-4 w-4" style={{ color: "#6a37d4" }} />
                  <span className="max-w-[120px] truncate text-sm font-medium">
                    {currentCompany.name}
                  </span>
                  <ChevronDown className="h-4 w-4" style={{ color: "#595c5d" }} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-56"
                style={{
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
                  border: "none",
                }}
              >
                <DropdownMenuLabel style={{ color: "#595c5d" }}>
                  Switch Company
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ background: "#eff1f2" }} />
                {(companies ?? []).map((company) => (
                  <DropdownMenuItem
                    key={company.id}
                    onClick={() => {
                      onCompanyChange?.(company.id);
                      setIsCompanyOpen(false);
                    }}
                    className="cursor-pointer"
                    style={{
                      color: company.id === currentCompany.id ? "#6a37d4" : "#2c2f30",
                      fontWeight: company.id === currentCompany.id ? 600 : 400,
                    }}
                  >
                    {company.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {currentProject && (
            <DropdownMenu open={isProjectOpen} onOpenChange={setIsProjectOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 px-3 h-9"
                  style={{
                    borderRadius: "12px",
                    color: "#2c2f30",
                  }}
                >
                  <FolderKanban className="h-4 w-4" style={{ color: "#6448b2" }} />
                  <span className="max-w-[120px] truncate text-sm font-medium">
                    {currentProject.name}
                  </span>
                  <ChevronDown className="h-4 w-4" style={{ color: "#595c5d" }} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-56"
                style={{
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
                  border: "none",
                }}
              >
                <DropdownMenuLabel style={{ color: "#595c5d" }}>
                  Switch Project
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ background: "#eff1f2" }} />
                {(projects ?? []).map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => {
                      onProjectChange?.(project.id);
                      setIsProjectOpen(false);
                    }}
                    className="cursor-pointer"
                    style={{
                      color: project.id === currentProject.id ? "#6a37d4" : "#2c2f30",
                      fontWeight: project.id === currentProject.id ? 600 : 400,
                    }}
                  >
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              style={{ borderRadius: "12px" }}
            >
              <Bell className="h-5 w-5" style={{ color: "#595c5d" }} />
            </Button>
            {notificationCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs font-semibold"
                style={{
                  background: "#6a37d4",
                  color: "#ffffff",
                  borderRadius: "12px",
                }}
              >
                {notificationCount > 9 ? "9+" : notificationCount}
              </Badge>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 px-2"
                style={{ borderRadius: "12px" }}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? ""} />
                  <AvatarFallback
                    style={{
                      background: "#6a37d4",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden md:block h-4 w-4" style={{ color: "#595c5d" }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              style={{
                borderRadius: "12px",
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
                border: "none",
              }}
            >
              <DropdownMenuLabel style={{ color: "#2c2f30" }}>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{user?.fullName ?? "User"}</span>
                  <span className="text-xs font-normal" style={{ color: "#595c5d" }}>
                    {user?.emailAddresses?.[0]?.emailAddress ?? ""}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator style={{ background: "#eff1f2" }} />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer w-full" style={{ color: "#2c2f30" }}>Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/sign-out" className="cursor-pointer w-full" style={{ color: "#2c2f30" }}>Sign Out</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default Header;
