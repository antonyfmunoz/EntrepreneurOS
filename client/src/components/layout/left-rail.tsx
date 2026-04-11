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

export default function LeftRail() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-[#eff1f2] border-r border-[#abadae]/10 flex-shrink-0">
      <nav className="py-8 px-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <a
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                      ${
                        isActive
                          ? 'bg-white text-[#6a37d4] shadow-[0_8px_32px_rgba(106,55,212,0.08)]'
                          : 'text-[#595c5d] hover:bg-white/50 hover:text-[#2c2f30]'
                      }
                    `}
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
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
