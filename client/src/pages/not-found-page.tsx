import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("page_viewed", {
        attemptedRoute: location,
      });
    }
  }, [location]);

  const handleBackToHome = () => {
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("back_to_home_clicked");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-center">
              <span className="font-mono text-6xl text-text-tertiary">404</span>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-mono font-bold text-4xl text-text">
              Page not found
            </h1>
            <p className="font-mono text-base text-text-secondary leading-relaxed">
              This page doesn't exist or you don't have access.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <Link href="/command-center">
            <Button
              onClick={handleBackToHome}
              className="w-full bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to command center
            </Button>
          </Link>

          <Link href="/portfolios">
            <Button
              variant="secondary"
              className="w-full bg-surface-subtle hover:bg-border text-text font-mono font-medium text-sm uppercase tracking-wide px-6 py-3 rounded-md border border-border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <FolderKanban className="w-4 h-4 mr-2" />
              View portfolios
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}