import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface FullPageStatusProps {
  label?: string;
  title: string;
  description: string;
  action?: ReactNode;
  busy?: boolean;
}

export function FullPageStatus({
  label = "EntrepreneurOS",
  title,
  description,
  action,
  busy = true,
}: FullPageStatusProps) {
  const StatusIcon = busy ? Loader2 : AlertTriangle;

  return (
    <main className="min-h-screen bg-surface px-6 py-12 text-foreground sm:px-10" aria-live="polite" aria-busy={busy}>
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center">
        <div className="w-full rounded-2xl bg-white p-8 shadow-md sm:p-12">
          <span className="mb-8 grid h-12 w-12 place-items-center rounded-xl bg-primary-muted text-primary">
            <StatusIcon className={busy ? "h-6 w-6 animate-spin" : "h-6 w-6"} />
          </span>
          <p className="eos-label mb-3">{label}</p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">{description}</p>
          {action && <div className="mt-7">{action}</div>}
        </div>
      </section>
    </main>
  );
}
