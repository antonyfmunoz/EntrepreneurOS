import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface FloatingAiPanelProps {
  assistantName?: string;
  seatName?: string;
  openWork?: number;
  approvals?: number;
  nextAction?: string;
  children?: React.ReactNode;
}

export default function FloatingAIPanel({
  assistantName = "Executive Assistant",
  seatName = "Founder / Portfolio Principal",
  openWork = 0,
  approvals = 0,
  nextAction = "Review the current operating context",
  children,
}: FloatingAiPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pointer-events-none sticky top-3 z-40 h-0 px-3 sm:px-6 lg:px-10" aria-label="Executive decision control HUD">
      <div className="eos-glass pointer-events-auto mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-primary/20 shadow-[0_12px_34px_rgba(106,55,212,0.16)]">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-14 w-full flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-left sm:px-6"
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-2 font-medium text-foreground"><Sparkles className="h-4 w-4 text-primary" />{assistantName}</span>
          <span className="rounded-full bg-primary-muted px-3 py-1 text-xs font-medium text-primary">{openWork} open</span>
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />{approvals} approvals</span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground"><strong className="font-medium text-foreground">Next:</strong> {nextAction}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {expanded && (
          <div className="border-t border-border/60 bg-white px-4 pb-5 pt-4 sm:px-6">
            {children ?? <div className="space-y-2 text-sm text-muted-foreground"><p><strong className="font-medium text-foreground">Active seat:</strong> {seatName}</p><p>{assistantName} is your Executive Assistant and sole founder-facing communication channel. It coordinates advisors and company CEO agents, but cannot authorize consequential effects.</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}
