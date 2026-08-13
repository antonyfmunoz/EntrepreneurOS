import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, X } from "lucide-react";
import Header from "./header";
import LeftRail from "./left-rail";
import FloatingAIPanel from "./floating-ai-panel";
import { useRailCollapse } from "@/hooks/use-rail-collapse";

export interface UniversalLayoutLeftRailItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
  disabled?: boolean;
  status?: string;
}

export interface UniversalLayoutProps {
  title?: string;
  children: React.ReactNode;
  leftRailItems?: UniversalLayoutLeftRailItem[];
  floatingPanel?: React.ReactNode | false;
  rightRailContent?: React.ReactNode;
  portfolioName?: string;
  portfolioHref?: string;
  companyName?: string;
  companyHref?: string;
  roleName?: string;
}

export function UniversalLayout({
  title,
  children,
  leftRailItems,
  floatingPanel,
  rightRailContent,
  portfolioName,
  portfolioHref,
  companyName,
  companyHref,
  roleName,
}: UniversalLayoutProps) {
  const left = useRailCollapse("ui.leftRail.collapsed");
  const right = useRailCollapse("ui.rightRail.collapsed");
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const hasCustomLeft = Boolean(leftRailItems?.length);
  const hasRight = Boolean(rightRailContent);

  useEffect(() => {
    const openCommunication = () => {
      if (!hasRight) return;
      if (window.matchMedia("(min-width: 1280px)").matches) right.setCollapsed(false);
      else setMobileRightOpen(true);
    };
    window.addEventListener("eos:open-communication", openCommunication);
    return () => window.removeEventListener("eos:open-communication", openCommunication);
  }, [hasRight, right.setCollapsed]);

  const customNavigation = (
    <CustomNavigation items={leftRailItems ?? []} collapsed={left.collapsed} onNavigate={() => setMobileLeftOpen(false)} />
  );

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f5f6f7] text-foreground">
      <Header
        title={title}
        portfolioName={portfolioName}
        portfolioHref={portfolioHref}
        companyName={companyName}
        companyHref={companyHref}
        roleName={roleName}
        onLeftMenuClick={() => setMobileLeftOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside className={(left.collapsed ? "w-12 " : "w-[240px] ") + "relative hidden min-h-0 flex-shrink-0 overflow-visible border-r border-border/60 bg-[#eff1f2] transition-[width] duration-200 lg:block"}>
          <RailToggle side="left" collapsed={left.collapsed} onClick={left.toggle} />
          <div className="h-full overflow-y-auto py-3">{hasCustomLeft ? customNavigation : <LeftRail collapsed={left.collapsed} />}</div>
        </aside>

        <main className="relative min-w-0 flex-1 overflow-y-auto bg-white">
          {floatingPanel === false ? null : floatingPanel ?? <FloatingAIPanel />}
          <div className={
            "mx-auto w-full max-w-[1600px] " +
            (floatingPanel === false
              ? "px-3 py-5 sm:px-6 lg:px-10 lg:py-8"
              : "px-3 pb-5 pt-24 sm:px-6 sm:pb-6 sm:pt-20 lg:px-10 lg:pb-8 lg:pt-20")
          }>
            {children}
          </div>
        </main>

        {hasRight && (
          <aside className={(right.collapsed ? "w-12 " : "w-[240px] ") + "relative hidden min-h-0 flex-shrink-0 flex-col overflow-visible border-l border-border/60 bg-[#f5f6f7] transition-[width] duration-200 xl:flex"}>
            <RailToggle side="right" collapsed={right.collapsed} onClick={right.toggle} />
            {!right.collapsed && <div className="min-h-0 flex-1 overflow-hidden">{rightRailContent}</div>}
          </aside>
        )}
      </div>

      {mobileLeftOpen && (
        <MobileRail side="left" title="EntrepreneurOS" hideAt="lg" onClose={() => setMobileLeftOpen(false)}>
          <CustomNavigation items={leftRailItems ?? []} collapsed={false} onNavigate={() => setMobileLeftOpen(false)} />
        </MobileRail>
      )}
      {hasRight && !mobileRightOpen && (
        <CommunicationFab onClick={() => setMobileRightOpen(true)} />
      )}
      {mobileRightOpen && hasRight && (
        <MobileRail id="mobile-communication-drawer" side="right" title="Communication" hideAt="xl" onClose={() => setMobileRightOpen(false)}>{rightRailContent}</MobileRail>
      )}
    </div>
  );
}

function CustomNavigation({ items, collapsed, onNavigate }: { items: UniversalLayoutLeftRailItem[]; collapsed: boolean; onNavigate: () => void }) {
  return (
    <nav className={collapsed ? "px-1.5" : "px-2"} aria-label="EOS primary navigation">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={`${item.label}-${item.href}`}>
            <a
              href={item.disabled ? undefined : item.href}
              aria-disabled={item.disabled || undefined}
              onClick={item.disabled ? (event) => event.preventDefault() : onNavigate}
              title={collapsed ? `${item.label}${item.status ? ` — ${item.status}` : ""}` : undefined}
              className={
                "group flex min-h-10 items-center gap-2 rounded-lg text-xs font-medium transition-colors " +
                (collapsed ? "justify-center px-0 " : "px-2.5 ") +
                (item.active
                  ? "bg-white text-primary shadow-sm"
                  : item.disabled
                    ? "cursor-not-allowed text-muted-foreground/55"
                    : "text-muted-foreground hover:bg-white/70 hover:text-foreground")
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              {!collapsed && item.status && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/45" title={item.status} aria-label={item.status} />}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RailToggle({ side, collapsed, onClick }: { side: "left" | "right"; collapsed: boolean; onClick: () => void }) {
  const Icon = side === "left" ? (collapsed ? ChevronRight : ChevronLeft) : (collapsed ? ChevronLeft : ChevronRight);
  return (
    <button type="button" onClick={onClick} aria-label={`${collapsed ? "Expand" : "Collapse"} ${side} rail`} className={(side === "left" ? "-right-3 " : "-left-3 ") + "absolute top-5 z-20 grid h-6 w-6 place-items-center rounded-full bg-white text-muted-foreground shadow-md transition-colors hover:text-primary"}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function CommunicationFab({ onClick }: { onClick: () => void }) {
  const FAB_SIZE = 64;
  const EDGE_MARGIN = 8;
  const DRAG_THRESHOLD = 8;
  const STORAGE_KEY = "eos.communicationFab.position";
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const startPosition = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: EDGE_MARGIN, y: EDGE_MARGIN });

  const clampPosition = useCallback((x: number, y: number) => ({
    x: Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - FAB_SIZE - EDGE_MARGIN)),
    y: Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - FAB_SIZE - EDGE_MARGIN)),
  }), []);

  useEffect(() => {
    const defaultPosition = clampPosition(
      window.innerWidth - FAB_SIZE - 16,
      window.innerHeight - FAB_SIZE - 20,
    );
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { x?: unknown; y?: unknown };
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition(clampPosition(parsed.x, parsed.y));
          return;
        }
      }
    } catch {
      // Storage may be unavailable in private browsing; the FAB still works.
    }
    setPosition(defaultPosition);
  }, [clampPosition]);

  useEffect(() => {
    const handleResize = () => setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [clampPosition]);

  const savePosition = useCallback((nextPosition: { x: number; y: number }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPosition));
    } catch {
      // Position persistence is an enhancement, not a requirement to communicate.
    }
  }, []);

  const finishDrag = (pointerId: number) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (buttonRef.current?.hasPointerCapture(pointerId)) {
      buttonRef.current.releasePointerCapture(pointerId);
    }
    if (moved.current) setPosition((current) => {
      savePosition(current);
      return current;
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragging.current = true;
        moved.current = false;
        setIsDragging(true);
        startPoint.current = { x: event.clientX, y: event.clientY };
        startPosition.current = position;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const dx = event.clientX - startPoint.current.x;
        const dy = event.clientY - startPoint.current.y;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved.current = true;
        if (moved.current) setPosition(clampPosition(startPosition.current.x + dx, startPosition.current.y + dy));
      }}
      onPointerUp={(event) => finishDrag(event.pointerId)}
      onPointerCancel={(event) => finishDrag(event.pointerId)}
      onClick={(event) => {
        if (moved.current) {
          event.preventDefault();
          moved.current = false;
          return;
        }
        onClick();
      }}
      aria-label="Open communication"
      title="Drag to move. Tap to open communication."
      aria-controls="mobile-communication-drawer"
      aria-expanded="false"
      data-testid="communication-fab"
      className={`fixed z-[60] grid h-16 w-16 touch-none select-none place-items-center rounded-full border-2 border-primary/40 bg-background/95 text-primary shadow-[0_0_18px_rgba(106,55,212,0.28)] backdrop-blur-md transition-[box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 xl:hidden ${isDragging ? "cursor-grabbing scale-105 shadow-[0_0_24px_rgba(106,55,212,0.42)]" : "cursor-grab hover:shadow-[0_0_24px_rgba(106,55,212,0.36)] active:scale-95"}`}
      style={{ left: position.x, top: position.y, WebkitUserSelect: "none", userSelect: "none" }}
    >
      <Bot className="pointer-events-none h-7 w-7" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function MobileRail({ id, side, title, hideAt, onClose, children }: { id?: string; side: "left" | "right"; title: string; hideAt: "lg" | "xl"; onClose: () => void; children: React.ReactNode }) {
  const isCommunication = side === "right";
  return (
    <div id={id} className={`fixed inset-0 z-[70] ${hideAt === "xl" ? "xl:hidden" : "lg:hidden"}`}>
      <button type="button" className="absolute inset-0 bg-[#2c2f30]/20 backdrop-blur-sm" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} />
      <aside className={isCommunication
        ? "eos-glass absolute inset-y-0 right-0 flex w-full min-h-0 flex-col overflow-hidden border-l border-border/60 shadow-[-12px_0_36px_rgba(44,47,48,0.16)]"
        : "eos-glass absolute inset-y-0 left-0 flex w-[55vw] min-h-0 flex-col overflow-hidden border-r border-border/60 shadow-[12px_0_36px_rgba(44,47,48,0.16)]"
      }>
        {isCommunication ? (
          <>
            <button type="button" onClick={onClose} className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Close ${title.toLowerCase()}`}><X className="h-4 w-4" /></button>
            <div className="min-h-0 flex-1">{children}</div>
          </>
        ) : (
          <>
            <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-border/70 px-3">
              <span className="min-w-0 truncate text-xs font-semibold text-foreground">{title}</span>
              <button type="button" onClick={onClose} className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Close ${title.toLowerCase()}`}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-3">{children}</div>
          </>
        )}
      </aside>
    </div>
  );
}

export default UniversalLayout;
