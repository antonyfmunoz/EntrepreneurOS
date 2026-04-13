import { useState } from "react";
import { Bell, ChevronDown, Building2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import designTokens from "@/lib/design-tokens";

const DESIGN_TOKENS = {
  ...designTokens,
  borderRadius: designTokens.borderRadius.default,
};

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface Context {
  id: string;
  name: string;
  type: "company" | "project";
}

interface HeaderProps {
  user: User;
  currentContext: Context;
  availableContexts: Context[];
  onContextChange: (contextId: string) => void;
  onNotificationsClick: () => void;
  onProfileClick: () => void;
  onSignOut: () => void;
  unreadNotifications?: number;
}

export function Header({
  user,
  currentContext,
  availableContexts,
  onContextChange,
  onNotificationsClick,
  onProfileClick,
  onSignOut,
  unreadNotifications = 0,
}: HeaderProps) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const contextsByType = (availableContexts ?? []).reduce(
    (acc, context) => {
      acc[context.type].push(context);
      return acc;
    },
    { company: [], project: [] } as Record<"company" | "project", Context[]>
  );

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: DESIGN_TOKENS.glassmorphism.background,
        backdropFilter: DESIGN_TOKENS.glassmorphism.backdropFilter,
        boxShadow: DESIGN_TOKENS.glassmorphism.shadow,
      }}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center"
              style={{
                background: DESIGN_TOKENS.colors.primary,
                borderRadius: DESIGN_TOKENS.borderRadius,
              }}
            >
              <span className="text-white text-sm font-semibold">E</span>
            </div>
            <span
              className="hidden sm:block text-base font-semibold tracking-tight"
              style={{ color: DESIGN_TOKENS.colors.onSurface }}
            >
              EntrepreneurOS
            </span>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-4 min-w-0">
          <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="max-w-xs md:max-w-sm flex items-center gap-2 px-3 h-9 min-w-0 hover:bg-transparent"
                style={{
                  background:
                    contextMenuOpen || window.innerWidth >= 768
                      ? "rgba(255, 255, 255, 0.9)"
                      : "transparent",
                  borderRadius: DESIGN_TOKENS.borderRadius,
                }}
              >
                {currentContext?.type === "company" ? (
                  <Building2
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                  />
                ) : (
                  <FolderKanban
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                  />
                )}
                <span
                  className="truncate text-sm font-medium"
                  style={{ color: DESIGN_TOKENS.colors.onSurface }}
                >
                  {currentContext?.name}
                </span>
                <ChevronDown
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="w-64"
              style={{
                background: DESIGN_TOKENS.glassmorphism.background,
                backdropFilter: DESIGN_TOKENS.glassmorphism.backdropFilter,
                boxShadow: DESIGN_TOKENS.glassmorphism.shadow,
                borderRadius: DESIGN_TOKENS.borderRadius,
                border: "none",
              }}
            >
              {contextsByType.company.length > 0 && (
                <>
                  <div
                    className="px-2 py-1.5 text-xs font-medium"
                    style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                  >
                    Companies
                  </div>
                  {contextsByType.company.map((context) => (
                    <DropdownMenuItem
                      key={context.id}
                      onClick={() => {
                        onContextChange(context.id);
                        setContextMenuOpen(false);
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                      style={{
                        background:
                          context.id === currentContext?.id
                            ? "rgba(106, 55, 212, 0.08)"
                            : "transparent",
                      }}
                    >
                      <Building2
                        className="h-4 w-4"
                        style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                      />
                      <span style={{ color: DESIGN_TOKENS.colors.onSurface }}>
                        {context.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {contextsByType.company.length > 0 && contextsByType.project.length > 0 && (
                <DropdownMenuSeparator
                  style={{ background: DESIGN_TOKENS.colors.outlineVariant }}
                />
              )}
              {contextsByType.project.length > 0 && (
                <>
                  <div
                    className="px-2 py-1.5 text-xs font-medium"
                    style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                  >
                    Projects
                  </div>
                  {contextsByType.project.map((context) => (
                    <DropdownMenuItem
                      key={context.id}
                      onClick={() => {
                        onContextChange(context.id);
                        setContextMenuOpen(false);
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                      style={{
                        background:
                          context.id === currentContext?.id
                            ? "rgba(106, 55, 212, 0.08)"
                            : "transparent",
                      }}
                    >
                      <FolderKanban
                        className="h-4 w-4"
                        style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                      />
                      <span style={{ color: DESIGN_TOKENS.colors.onSurface }}>
                        {context.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNotificationsClick}
            className="relative h-9 w-9"
            style={{
              color: DESIGN_TOKENS.colors.onSurfaceVariant,
            }}
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 border-2"
                style={{
                  background: DESIGN_TOKENS.colors.primary,
                  color: "#ffffff",
                  borderColor: DESIGN_TOKENS.colors.background,
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </Badge>
            )}
          </Button>

          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 w-9 rounded-full p-0 hover:bg-transparent"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback
                    style={{
                      background: DESIGN_TOKENS.colors.primary,
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              style={{
                background: DESIGN_TOKENS.glassmorphism.background,
                backdropFilter: DESIGN_TOKENS.glassmorphism.backdropFilter,
                boxShadow: DESIGN_TOKENS.glassmorphism.shadow,
                borderRadius: DESIGN_TOKENS.borderRadius,
                border: "none",
              }}
            >
              <div className="flex items-center gap-3 px-2 py-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback
                    style={{
                      background: DESIGN_TOKENS.colors.primary,
                      color: "#ffffff",
                    }}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: DESIGN_TOKENS.colors.onSurface }}
                  >
                    {user.name}
                  </span>
                  <span
                    className="text-xs truncate"
                    style={{ color: DESIGN_TOKENS.colors.onSurfaceVariant }}
                  >
                    {user.email}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator
                style={{ background: DESIGN_TOKENS.colors.outlineVariant }}
              />
              <DropdownMenuItem
                onClick={() => {
                  onProfileClick();
                  setUserMenuOpen(false);
                }}
                className="cursor-pointer"
                style={{ color: DESIGN_TOKENS.colors.onSurface }}
              >
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator
                style={{ background: DESIGN_TOKENS.colors.outlineVariant }}
              />
              <DropdownMenuItem
                onClick={() => {
                  onSignOut();
                  setUserMenuOpen(false);
                }}
                className="cursor-pointer"
                style={{ color: DESIGN_TOKENS.colors.onSurface }}
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default Header;