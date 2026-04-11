import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutGrid,
  Command,
  Network,
  MessageSquare,
  ListTodo,
  Workflow,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Portfolio', href: '/portfolio', icon: <LayoutGrid className="h-5 w-5" /> },
  { label: 'Command Center', href: '/command-center', icon: <Command className="h-5 w-5" /> },
  { label: 'Org Chart', href: '/org-chart', icon: <Network className="h-5 w-5" /> },
  { label: 'Agent Chat', href: '/agent-chat', icon: <MessageSquare className="h-5 w-5" /> },
  { label: 'Task Board', href: '/task-board', icon: <ListTodo className="h-5 w-5" /> },
  { label: 'Workflows', href: '/workflows', icon: <Workflow className="h-5 w-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="h-5 w-5" /> },
];

interface LeftRailProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function LeftRail({ collapsed = false, onToggle }: LeftRailProps) {
  const [location] = useLocation();

  return (
    <aside
      className={
        (collapsed ? 'w-16 ' : 'w-64 ') +
        'relative bg-[#eff1f2] border-r border-[#abadae]/10 flex-shrink-0 ' +
        'transition-[width] duration-200 ease-out'
      }
    >
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="absolute top-5 -right-3 z-20 w-6 h-6 rounded-full bg-white border border-[#abadae]/20 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#595c5d] hover:text-[#6a37d4] transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      )}
      <nav className={'py-8 ' + (collapsed ? 'px-2' : 'px-4')}>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;

            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <a
                    title={collapsed ? item.label : undefined}
                    className={
                      'flex items-center gap-3 rounded-xl transition-colors ' +
                      (collapsed ? 'justify-center px-0 py-3 ' : 'px-4 py-3 ') +
                      (isActive
                        ? 'bg-white text-[#6a37d4] shadow-[0_8px_32px_rgba(106,55,212,0.08)]'
                        : 'text-[#595c5d] hover:bg-white/50 hover:text-[#2c2f30]')
                    }
                  >
                    {item.icon}
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
