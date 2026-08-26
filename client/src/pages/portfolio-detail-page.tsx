import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Building2, LayoutGrid, Plus, RefreshCw, Users } from "lucide-react";
import UniversalLayout from "@/components/layout/universal-layout";
import { FullPageStatus } from "@/components/full-page-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface Portfolio {
  id: number | string;
  name: string;
  description?: string | null;
  access?: "owner" | "member";
}

interface Company {
  id: number | string;
  name: string;
  stage?: string | null;
  industry?: string | null;
  offer?: string | null;
  access?: "owner" | "member";
  role?: string;
}

interface PortfolioTeam {
  members: Array<{ id: string; userId: string; role: string; status: "active" | "suspended" | "revoked"; classificationCeiling: string; fullName?: string | null; email: string }>;
  teamSeats: { used: number; limit: number; remaining: number; source: string };
}

export default function PortfolioDetailPage() {
  const { portfolioId = "" } = useParams<{ portfolioId: string }>();
  const queryClient = useQueryClient();
  const portfolioQuery = useQuery<Portfolio>({
    queryKey: ["/api/portfolios", portfolioId],
    queryFn: () => apiRequest<Portfolio>(`/api/portfolios/${portfolioId}`),
    enabled: Boolean(portfolioId),
  });
  const companiesQuery = useQuery<Company[]>({
    queryKey: ["/api/portfolios", portfolioId, "companies"],
    queryFn: () => apiRequest<Company[]>(`/api/portfolios/${portfolioId}/companies`),
    enabled: Boolean(portfolioId),
  });
  const teamQuery = useQuery<PortfolioTeam>({
    queryKey: ["/api/portfolios", portfolioId, "team"],
    queryFn: () => apiRequest<PortfolioTeam>(`/api/portfolios/${portfolioId}/team`),
    enabled: Boolean(portfolioId && portfolioQuery.data?.access === "owner"),
  });
  const teamStatusMutation = useMutation({
    mutationFn: async ({ membershipId, action }: { membershipId: string; action: "suspend" | "reactivate" }) => {
      const response = await apiRequest<Response>("PATCH", `/api/portfolios/${portfolioId}/team/${membershipId}`, { action });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/portfolios", portfolioId, "team"] }),
  });
  const teamRemoveMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const response = await apiRequest<Response>("DELETE", `/api/portfolios/${portfolioId}/team/${membershipId}`);
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/portfolios", portfolioId, "team"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/portfolios", portfolioId, "companies"] }),
      ]);
    },
  });

  if (portfolioQuery.isLoading || companiesQuery.isLoading) {
    return <FullPageStatus label="Portfolio" title="Loading organizations" description="Resolving the organizations available in this portfolio." />;
  }

  if (portfolioQuery.error || companiesQuery.error || !portfolioQuery.data) {
    const retry = async () => Promise.all([portfolioQuery.refetch(), companiesQuery.refetch()]);
    return (
      <FullPageStatus
        label="Portfolio unavailable"
        title="We could not load this portfolio"
        description="The requested portfolio may be outside your authority scope, or the data service may be temporarily unavailable."
        busy={false}
        action={<Button onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>}
      />
    );
  }

  const portfolio = portfolioQuery.data;
  const companies = companiesQuery.data ?? [];
  const canManagePortfolio = portfolio.access !== "member";

  return (
    <UniversalLayout title="Organizations" portfolioName={portfolio.name} portfolioHref={`/portfolios/${portfolio.id}`} leftRailItems={[]} floatingPanel={false}>
      <section className="space-y-8 pb-12">
        <div>
          <Link href="/portfolios" className="inline-flex items-center text-sm font-medium text-primary hover:text-[#5a2dc0]"><ArrowLeft className="mr-1.5 h-4 w-4" />All portfolios</Link>
          <div className="mt-6">
            <p className="eos-label flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" />Organizations</p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{portfolio.name}</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{portfolio.description || "Open an organization or add the next one."}</p>
              </div>
              {canManagePortfolio && <Button asChild size="icon" className="h-11 w-11 flex-shrink-0 rounded-xl"><Link href={`/company-setup?portfolioId=${portfolio.id}`} aria-label="Add organization" title="Add organization"><Plus className="h-4 w-4" /></Link></Button>}
            </div>
          </div>
        </div>

        <div>
          <Metric label="Organizations" value={companies.length} />
        </div>

        {companies.length === 0 && canManagePortfolio ? (
          <Card className="border-0 bg-[#eff1f2] shadow-none">
            <CardContent className="px-6 py-14 text-center sm:px-12 sm:py-20">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary shadow-[0_8px_32px_rgba(106,55,212,0.08)]"><Building2 className="h-7 w-7" /></span>
              <h2 className="mt-6 text-xl font-semibold">Add the first organization</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create a company inside this portfolio, then configure how it operates in EntrepreneurOS.</p>
              <Button asChild className="mt-7"><Link href={`/company-setup?portfolioId=${portfolio.id}`}><Plus className="mr-2 h-4 w-4" />Add organization</Link></Button>
            </CardContent>
          </Card>
        ) : companies.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <Link key={company.id} href={`/company/${company.id}`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Card className="h-full border-0 bg-white shadow-[0_8px_32px_rgba(106,55,212,0.08)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)]">
                    <CardContent className="flex min-h-56 flex-col p-6 sm:p-8">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eff1f2] text-primary"><Building2 className="h-5 w-5" /></span>
                      <h2 className="mt-6 text-xl font-semibold">{company.name}</h2>
                      <p className="mt-2 flex-1 text-sm text-muted-foreground">{company.offer || "Open the organization workspace to define its operating brief, missions, approvals, and evidence."}</p>
                      <div className="mt-6 flex items-center justify-between gap-4"><span className="eos-label">{company.stage || "MVP"}{company.access === "member" && company.role ? ` · ${company.role.replaceAll("_", " ")}` : ""}</span><span className="flex items-center text-sm font-medium text-primary">Open workspace <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></div>
                    </CardContent>
                  </Card>
              </Link>
            ))}
          </div>
        ) : <Card className="border-0 bg-[#eff1f2] shadow-none"><CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">No active organization membership is available in this portfolio.</CardContent></Card>}

        {canManagePortfolio && <section id="team" className="scroll-mt-28 space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eos-label flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Portfolio team</p><h2 className="mt-2 text-2xl font-semibold">People working across organizations</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Portfolio-wide members receive a governed Portfolio Executive seat in every organization. Suspend or remove access once here.</p></div>{companies[0] && <Button asChild variant="outline"><Link href={`/company/${companies[0].id}#organization`}><Plus className="mr-2 h-4 w-4" />Invite from organization</Link></Button>}</div>
          {teamQuery.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading portfolio team…</CardContent></Card> : teamQuery.isError ? <Card><CardContent className="p-6 text-sm text-destructive">Portfolio team controls could not be loaded.</CardContent></Card> : <><div className="grid gap-3 sm:grid-cols-3"><Metric label="Human identities" value={teamQuery.data?.teamSeats.used || 1} /><Metric label="Seat allowance" value={teamQuery.data?.teamSeats.limit || 10} /><Metric label="Available" value={teamQuery.data?.teamSeats.remaining ?? 9} /></div><div className="space-y-3">{(teamQuery.data?.members || []).filter((member) => member.status !== "revoked").map((member) => <Card key={member.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{member.fullName || member.email}</p><span className="rounded-full bg-[#eff1f2] px-2.5 py-1 text-xs">{member.status}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{member.email} · {member.role.replaceAll("_", " ")} · {member.classificationCeiling}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={teamStatusMutation.isPending} onClick={() => teamStatusMutation.mutate({ membershipId: member.id, action: member.status === "active" ? "suspend" : "reactivate" })}>{member.status === "active" ? "Suspend" : "Reactivate"}</Button><Button size="sm" variant="destructive" disabled={teamRemoveMutation.isPending} onClick={() => teamRemoveMutation.mutate(member.id)}>Remove</Button></div></CardContent></Card>)}{!teamQuery.data?.members.some((member) => member.status !== "revoked") && <Card><CardContent className="p-6 text-sm text-muted-foreground">No portfolio-wide team assignments yet. Invite someone from an organization and select portfolio-wide access.</CardContent></Card>}</div>{(teamStatusMutation.isError || teamRemoveMutation.isError) && <p className="text-sm text-destructive">The team change did not complete. Refresh the current state and retry.</p>}</>}
        </section>}
      </section>
    </UniversalLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#eff1f2] p-5"><div className="text-2xl font-semibold text-foreground">{value}</div><div className="eos-label mt-1">{label}</div></div>;
}
