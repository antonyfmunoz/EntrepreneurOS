import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CheckSquare,
  GitBranch,
  Network,
  MessageSquare,
  Settings,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { colors, borderRadius } from "@/lib/design-tokens";

interface LeftRailProps {
  companyId?: string;
  activeItem?: string;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

function buildNavItems(companyId?: string): NavItem[] {
  const items: NavItem[] = [
    { id: "portfolio", label: "Portfolio", href: "/portfolios", icon: Briefcase },
  ];

  if (companyId) {
    items.push(
      { id: "home", label: "Home", href: `/company/${companyId}`, icon: LayoutDashboard },
      { id: "tasks", label: "Tasks", href: `/company/${companyId}/tasks`, icon: CheckSquare },
      { id: "workflows", label: "Workflows", href: `/company/${companyId}/workflows`, icon: GitBranch },
      { id: "org", label: "Org Chart", href: `/company/${companyId}/org`, icon: Network },
      { id: "chat", label: "Assistant", href: `/company/${companyId}/chat`, icon: MessageSquare },
    );
  }

  items.push(
    { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  );

  return items;
}

export function LeftRail({ companyId, activeItem, className }: LeftRailProps) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = useMemo(() => buildNavItems(companyId), [companyId]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileOpen]);

  const isActive = (item: NavItem) => {
    if (activeItem) return item.id === activeItem;
    if (item.href === "/") return location === "/";
    return location.startsWith(item.href);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl"
        style={{
          backgroundColor: colors.surfaceContainerLow,
          color: colors.onSurface,
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

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed md:sticky top-0 left-0 h-screen flex flex-col transition-all duration-300 z-40",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          className ?? "",
        ].join(" ")}
        style={{ backgroundColor: colors.surfaceContainerLow }}
      >
        {/* Collapse toggle */}
        <div className="hidden md:flex items-center justify-end px-3 py-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
            style={{ color: colors.onSurfaceVariant }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                    style={{
                      color: active ? colors.primary : colors.onSurfaceVariant,
                      backgroundColor: active ? "rgba(106, 55, 212, 0.08)" : "transparent",
                      fontWeight: active ? 500 : 400,
                    }}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="flex-1 text-sm">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export default LeftRail;
