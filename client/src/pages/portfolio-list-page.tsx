import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Building2, LayoutGrid, Plus, RefreshCw, X } from "lucide-react";
import UniversalLayout from "@/components/layout/universal-layout";
import { FullPageStatus } from "@/components/full-page-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

interface Portfolio {
  id: number | string;
  name: string;
  description?: string | null;
  companyCount?: number;
  createdAt?: string;
}

export default function PortfolioListPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const portfoliosQuery = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
    queryFn: () => apiRequest<Portfolio[]>("/api/portfolios"),
  });

  if (portfoliosQuery.isLoading) {
    return <FullPageStatus label="Portfolio" title="Loading your portfolio" description="Resolving the organizations available in your authority scope." />;
  }

  if (portfoliosQuery.error) {
    return (
      <FullPageStatus
        label="Portfolio unavailable"
        title="We could not load your portfolio"
        description="Your session is still protected. Retry the request; if it continues, the deployment or data service needs attention."
        busy={false}
        action={<Button onClick={() => portfoliosQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>}
      />
    );
  }

  const portfolios = portfoliosQuery.data ?? [];

  return (
    <UniversalLayout title="Portfolio" floatingPanel={false}>
      <section className="space-y-8 pb-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eos-label flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" />Founder workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Your portfolio</h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">Choose an organization context or create the portfolio that will contain your first company.</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Create portfolio
          </Button>
        </div>

        {portfolios.length === 0 ? (
          <Card className="overflow-hidden border-0 bg-[#eff1f2] shadow-none">
            <CardContent className="px-6 py-14 text-center sm:px-12 sm:py-20">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
                <Building2 className="h-7 w-7" />
              </span>
              <h2 className="mt-6 text-xl font-semibold">Create your first portfolio</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">A portfolio is the top-level home for your companies. You can add the first organization immediately after creating it.</p>
              <Button className="mt-7" onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create portfolio</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {portfolios.map((portfolio) => (
              <Link key={portfolio.id} href={`/portfolios/${portfolio.id}`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Card className="h-full border-0 bg-white shadow-[0_8px_32px_rgba(106,55,212,0.08)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)]">
                    <CardContent className="flex min-h-52 flex-col p-6 sm:p-8">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eff1f2] text-primary"><Building2 className="h-5 w-5" /></span>
                      <h2 className="mt-6 text-xl font-semibold">{portfolio.name}</h2>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{portfolio.description || "Open this portfolio to manage its organizations and operating context."}</p>
                      <div className="mt-6 flex items-center justify-between gap-4">
                        <span className="eos-label">{typeof portfolio.companyCount === "number" ? `${portfolio.companyCount} ${portfolio.companyCount === 1 ? "organization" : "organizations"}` : "Portfolio"}</span>
                        <span className="flex items-center text-sm font-medium text-primary">Open <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                      </div>
                    </CardContent>
                  </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreatePortfolioDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
          setIsCreateOpen(false);
        }}
      />
    </UniversalLayout>
  );
}

function CreatePortfolioDialog({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useMutation({
    mutationFn: () => apiRequest<Portfolio>("/api/portfolios", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    }),
    onSuccess: async () => {
      setName("");
      setDescription("");
      await onCreated();
    },
  });

  if (!isOpen) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-[#2c2f30]/25 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-[0_8px_32px_rgba(106,55,212,0.16)] sm:max-w-lg sm:rounded-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="create-portfolio-title">
        <div className="flex items-start justify-between gap-4">
          <div><p className="eos-label">New context</p><h2 id="create-portfolio-title" className="mt-2 text-2xl font-semibold">Create portfolio</h2></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close create portfolio dialog"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="space-y-2"><Label htmlFor="portfolio-name">Portfolio name</Label><Input id="portfolio-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My ventures" autoFocus required /></div>
          <div className="space-y-2"><Label htmlFor="portfolio-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="portfolio-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this portfolio contains" className="min-h-28" /></div>
          {createMutation.isError && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">The portfolio could not be created. Check the session and try again.</p>}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!name.trim() || createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create portfolio"}</Button></div>
        </form>
      </section>
    </div>
  );
}
