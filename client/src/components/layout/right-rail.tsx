import React from 'react';

interface RightRailProps {
  children?: React.ReactNode;
}

export default function RightRail({ children }: RightRailProps) {
  if (!children) {
    return null;
  }

  return (
    <aside
      className="w-96 border-l border-[#abadae]/10 flex-shrink-0 overflow-y-auto"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="p-6">
        {children}
      </div>
    </aside>
  );
}
