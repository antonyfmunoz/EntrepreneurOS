import { ReactNode, useState } from "react";
import { Header } from "@/components/header";
import { LeftRail } from "@/components/left-rail";
import { RightRail } from "@/components/right-rail";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

export interface UniversalLayoutProps {
  children: ReactNode;
  showRightRail?: boolean;
  rightRailContent?: ReactNode;
  className?: string;
}

export function UniversalLayout({
  children,
  showRightRail = false,
  rightRailContent,
  className,
}: UniversalLayoutProps) {
  const [leftRailOpen, setLeftRailOpen] = useState(false);
  const [rightRailOpen, setRightRailOpen] = useState(false);

  const toggleLeftRail = () => {
    setLeftRailOpen(!leftRailOpen);
    if (rightRailOpen) setRightRailOpen(false);
  };

  const toggleRightRail = () => {
    setRightRailOpen(!rightRailOpen);
    if (leftRailOpen) setLeftRailOpen(false);
  };

  const closeRails = () => {
    setLeftRailOpen(false);
    setRightRailOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#f5f6f7]">
      <Header
        onLeftMenuClick={toggleLeftRail}
        onRightMenuClick={showRightRail ? toggleRightRail : undefined}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <aside
          className={clsx(
            "fixed lg:static top-[64px] left-0 bottom-0 w-64 bg-[#eff1f2] z-40 transition-transform duration-300",
            leftRailOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <LeftRail onNavigate={closeRails} />
        </aside>

        <main
          className={clsx(
            "flex-1 overflow-y-auto overflow-x-hidden",
            className
          )}
        >
          <div className="w-full h-full">
            {children}
          </div>
        </main>

        {showRightRail && (
          <aside
            className={clsx(
              "fixed lg:static top-[64px] right-0 bottom-0 w-80 bg-[#eff1f2] z-40 transition-transform duration-300",
              rightRailOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
            )}
          >
            {rightRailContent && (
              <RightRail>{rightRailContent}</RightRail>
            )}
          </aside>
        )}

        {(leftRailOpen || rightRailOpen) && (
          <div
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
            onClick={closeRails}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

export default UniversalLayout;