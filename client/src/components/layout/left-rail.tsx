import { useLocation } from "wouter";
import { Blocks, Bot, BriefcaseBusiness, Building2, Command, Home, Landmark, LayoutGrid, Network, Workflow } from "lucide-react";

interface LeftRailProps {
  collapsed?: boolean;
}

export default function LeftRail({ collapsed = false }: LeftRailProps) {
  const [location] = useLocation();
  const companyId = location.match(/^\/company\/([^/]+)/)?.[1];
  const companyRoot = companyId ? `/company/${companyId}` : "/portfolios";
  const items = [
    { label: "Home", href: `${companyRoot}#home`, icon: Home },
    { label: "Portfolio", href: "/portfolios", icon: LayoutGrid },
    { label: "Organizations", href: "/portfolios", icon: Building2 },
    { label: "Command", href: `${companyRoot}#command`, icon: Command },
    { label: "Organization", href: companyId ? `${companyRoot}/org` : "/portfolios", icon: Network },
    { label: "Stakeholder / Commercial", href: `${companyRoot}#commercial`, icon: BriefcaseBusiness },
    { label: "Operations", href: `${companyRoot}#operations`, icon: Workflow },
    { label: "Capital & Finance", href: `${companyRoot}#capital`, icon: Landmark, status: "dormant" },
    { label: "Intelligence", href: companyId ? `${companyRoot}/chat` : "/portfolios", icon: Bot },
    { label: "Systems", href: "/settings", icon: Blocks },
  ];

  return (
    <nav className={collapsed ? "px-1.5" : "px-2"} aria-label="EOS primary navigation">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const path = item.href.split("#")[0];
          const active = location === path || (path !== "/portfolios" && location.startsWith(`${path}/`));
          const Icon = item.icon;
          return (
            <li key={`${item.label}-${item.href}`}>
              <a href={item.href} title={collapsed ? item.label : undefined} className={(collapsed ? "justify-center px-0 " : "px-2.5 ") + (active ? "bg-white text-primary shadow-sm " : "text-muted-foreground hover:bg-white/70 hover:text-foreground ") + "flex min-h-10 items-center gap-2 rounded-lg text-xs font-medium transition-colors"}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                {!collapsed && item.status && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/45" title={item.status} aria-label={item.status} />}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
