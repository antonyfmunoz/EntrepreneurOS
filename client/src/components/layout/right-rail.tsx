import React from 'react';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

interface RightRailProps {
  children?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function RightRail({
  children,
  collapsed = false,
  onToggle,
}: RightRailProps) {
  if (!children) {
    return null;
  }

  return (
    <aside
      className={
        (collapsed ? 'w-12 ' : 'w-96 ') +
        'relative border-l border-[#abadae]/10 flex-shrink-0 overflow-y-auto ' +
        'transition-[width] duration-200 ease-out'
      }
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand AI chat' : 'Collapse AI chat'}
          className="absolute top-5 -left-3 z-20 w-6 h-6 rounded-full bg-white border border-[#abadae]/20 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#595c5d] hover:text-[#6a37d4] transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      )}
      {collapsed ? (
        <div className="flex flex-col items-center pt-16">
          <MessageSquare className="w-5 h-5 text-[#6a37d4]" />
        </div>
      ) : (
        <div className="p-6">{children}</div>
      )}
    </aside>
  );
}
