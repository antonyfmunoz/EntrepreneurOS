import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './header';
import LeftRail from './left-rail';
import RightRail from './right-rail';
import FloatingAIPanel from './floating-ai-panel';
import { useRailCollapse } from '@/hooks/use-rail-collapse';

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
  // Shared localStorage keys so both the default and custom rail paths
  // honor the same collapsed state across pages / reloads.
  const left = useRailCollapse('ui.leftRail.collapsed');
  const right = useRailCollapse('ui.rightRail.collapsed');

  const hasCustomLeft = Boolean(leftRailItems && leftRailItems.length > 0);
  const hasCustomRight = Boolean(rightRailContent);

  return (
    <div className="min-h-screen bg-[#f5f6f7] flex flex-col">
      <Header title={companyName ?? title} />
      <div className="flex flex-1 overflow-hidden">
        {hasCustomLeft ? (
          <nav
            className={
              (left.collapsed ? 'w-16 ' : 'w-[260px] ') +
              'relative border-r border-[#abadae]/10 bg-[#f5f6f7] py-8 overflow-y-auto ' +
              (left.collapsed ? 'px-2 ' : 'px-4 ') +
              'transition-[width] duration-200 ease-out'
            }
          >
            <button
              type="button"
              onClick={left.toggle}
              aria-label={left.collapsed ? 'Expand navigation' : 'Collapse navigation'}
              className="absolute top-5 -right-3 z-20 w-6 h-6 rounded-full bg-white border border-[#abadae]/20 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#595c5d] hover:text-[#6a37d4] transition-colors"
            >
              {left.collapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
            <ul className="flex flex-col gap-1">
              {leftRailItems!.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    title={left.collapsed ? item.label : undefined}
                    className={
                      'flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ' +
                      (left.collapsed ? 'justify-center px-0 py-2.5 ' : 'px-4 py-2.5 ') +
                      (item.active
                        ? 'bg-[#6a37d4] text-white'
                        : 'text-[#2c2f30] hover:bg-[#eceeef]')
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {!left.collapsed && item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <LeftRail collapsed={left.collapsed} onToggle={left.toggle} />
        )}

        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-[1600px] mx-auto px-8 py-8">{children}</div>
        </main>

        {hasCustomRight ? (
          <aside
            className={
              (right.collapsed ? 'w-12 ' : 'w-[340px] ') +
              'relative border-l border-[#abadae]/10 bg-[#f5f6f7] overflow-y-auto ' +
              'transition-[width] duration-200 ease-out'
            }
          >
            <button
              type="button"
              onClick={right.toggle}
              aria-label={right.collapsed ? 'Expand AI chat' : 'Collapse AI chat'}
              className="absolute top-5 -left-3 z-20 w-6 h-6 rounded-full bg-white border border-[#abadae]/20 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#595c5d] hover:text-[#6a37d4] transition-colors"
            >
              {right.collapsed ? (
                <ChevronLeft className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {!right.collapsed && rightRailContent}
          </aside>
        ) : (
          <RightRail collapsed={right.collapsed} onToggle={right.toggle} />
        )}
      </div>
      {floatingPanel ?? <FloatingAIPanel />}
    </div>
  );
}

// Export as default too so existing `import UniversalLayout from ...` paths
// keep working alongside the page sub-agents' named-import preference.
export default UniversalLayout;
