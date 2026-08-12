import { ReactNode } from "react";
import { Bot, FileCheck2, ShieldCheck } from "lucide-react";
import CanonicalUniversalLayout from "@/components/layout/universal-layout";
import { cn } from "@/lib/utils";

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
  const intelligence = rightRailContent ?? (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h2 className="font-semibold">Role Assistant</h2></div>
      <p className="text-sm text-muted-foreground">Contextual communication and advisory mode. The active agent name and scope are resolved from the current company and seat; proposed actions remain subject to local authority and evidence requirements.</p>
      <div className="space-y-3 rounded-xl bg-white p-4 text-xs text-muted-foreground shadow-sm">
        <div className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Context before consequence</div>
        <div className="flex gap-2"><FileCheck2 className="h-4 w-4 text-primary" /> Evidence before completion</div>
      </div>
    </div>
  );

  return (
    <CanonicalUniversalLayout rightRailContent={showRightRail ? intelligence : undefined}>
      <div className={cn("min-h-full", className)}>{children}</div>
    </CanonicalUniversalLayout>
  );
}

export default UniversalLayout;
