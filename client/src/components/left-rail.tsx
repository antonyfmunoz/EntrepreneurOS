import * as React from "react";
import { Link, useLocation } from "wouter";
import { LucideIcon, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import designTokens from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface LeftRailProps {
  items: NavItem[];
  onLogout?: () => void;
  className?: string;
}

export function LeftRail({ items, onLogout, className }: LeftRailProps) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location.startsWith(href);
  };

  const navContent = (
    <>
      <div className="flex items-center justify-between px-6 py-6">
        {!isCollapsed && (
          <span
            className="font-semibold text-lg"
            style={{ color: designTokens.colors.onSurface }}
          >
            EntrepreneurOS
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex h-8 w-8"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.href);

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 relative group",
                    isActive
                      ? "font-medium"
                      : "font-normal hover:bg-white/60"
                  )}
                  style={{
                    color: isActive
                      ? designTokens.colors.primary
                      : designTokens.colors.onSurfaceVariant,
                    backgroundColor: isActive
                      ? "rgba(106, 55, 212, 0.08)"
                      : "transparent",
                  }}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-sm">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-medium text-white"
                          style={{
                            backgroundColor: designTokens.colors.primary,
                          }}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {onLogout && (
        <div className="px-3 py-6">
          <Button
            variant="ghost"
            onClick={onLogout}
            className={cn(
              "w-full justify-start gap-3 px-3 py-3 h-auto rounded-xl font-normal hover:bg-white/60",
              isCollapsed && "justify-center"
            )}
            style={{ color: designTokens.colors.onSurfaceVariant }}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm">Log out</span>}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl"
        style={{
          backgroundColor: designTokens.colors.surfaceContainerLow,
          color: designTokens.colors.onSurface,
        }}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <ChevronLeft className="h-6 w-6" />
        ) : (
          <ChevronRight className="h-6 w-6" />
        )}
      </button>

      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 h-screen flex flex-col transition-all duration-300 z-40",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
          className
        )}
        style={{
          backgroundColor: designTokens.colors.surfaceContainerLow,
          borderRight: `1px solid ${designTokens.colors.outlineVariant}20`,
        }}
      >
        {navContent}
      </aside>
    </>
  );
}

export default LeftRail;