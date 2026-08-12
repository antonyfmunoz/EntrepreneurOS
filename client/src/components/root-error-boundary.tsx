import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("EOS client failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-surface px-6 py-12 text-foreground sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center">
          <div className="w-full rounded-2xl bg-white p-8 shadow-md sm:p-12" role="alert">
            <span className="mb-8 grid h-12 w-12 place-items-center rounded-xl bg-destructive-muted text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <p className="eos-label mb-3">EntrepreneurOS</p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">The workspace could not start</h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              The interface encountered an unexpected client error. Reload once; if the problem remains, check the browser console and application configuration.
            </p>
            <Button className="mt-8" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload EntrepreneurOS
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
