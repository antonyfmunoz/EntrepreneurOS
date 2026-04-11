import React from 'react';
import Header from './header';
import LeftRail from './left-rail';
import RightRail from './right-rail';
import FloatingAIPanel from './floating-ai-panel';

export interface UniversalLayoutLeftRailItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
}

export interface UniversalLayoutProps {
  title?: string;
  children: React.ReactNode;
  /**
   * Optional explicit left-rail item list. If omitted, the default
   * <LeftRail/> component is rendered. Pages that need a custom nav for
   * their workspace (e.g. CompanyCenter scoped to /company/:companyId)
   * can pass their own.
   */
  leftRailItems?: UniversalLayoutLeftRailItem[];
  /**
   * Optional override for the floating AI panel slot. Pages can render
   * their own panel content (KPIs, next action) instead of the default
   * <FloatingAIPanel/> stub.
   */
  floatingPanel?: React.ReactNode;
  /**
   * Optional override for the right rail. Pages can inject an agent
   * chat stub, execution status widget, or any other sidebar content.
   */
  rightRailContent?: React.ReactNode;
  /**
   * Optional company context string shown in the header. When present,
   * the header uses this over the default user-centric title.
   */
  companyName?: string;
}

export function UniversalLayout({
  title,
  children,
  leftRailItems,
  floatingPanel,
  rightRailContent,
  companyName,
}: UniversalLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f5f6f7] flex flex-col">
      <Header title={companyName ?? title} />
      <div className="flex flex-1 overflow-hidden">
        {leftRailItems && leftRailItems.length > 0 ? (
          <nav className="w-[260px] border-r border-[#abadae]/10 bg-[#f5f6f7] py-8 px-4 overflow-y-auto">
            <ul className="flex flex-col gap-1">
              {leftRailItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                      (item.active
                        ? 'bg-[#6a37d4] text-white'
                        : 'text-[#2c2f30] hover:bg-[#eceeef]')
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <LeftRail />
        )}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-[1600px] mx-auto px-8 py-8">
            {children}
          </div>
        </main>
        {rightRailContent ? (
          <aside className="w-[340px] border-l border-[#abadae]/10 bg-[#f5f6f7] overflow-y-auto">
            {rightRailContent}
          </aside>
        ) : (
          <RightRail />
        )}
      </div>
      {floatingPanel ?? <FloatingAIPanel />}
    </div>
  );
}

// Export as default too so existing `import UniversalLayout from ...` paths
// keep working alongside the page sub-agents' named-import preference.
export default UniversalLayout;
