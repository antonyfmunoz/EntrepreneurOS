import { Blocks } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

/**
 * Compatibility surface for the retired unscoped integrations page.
 * Provider controls now live inside a company-scoped Systems workspace.
 */
export function Integrations() {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Blocks className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Integrations are organization-scoped</h3>
          <p className="mt-1 text-sm text-muted-foreground">Choose an organization, then open Systems to connect, verify, or disconnect its real providers.</p>
          <Button asChild className="mt-4"><Link href="/portfolios">Choose an organization</Link></Button>
        </div>
      </div>
    </div>
  );
}
