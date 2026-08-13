import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Building2, LayoutGrid, Plus, RefreshCw } from "lucide-react";
import UniversalLayout from "@/components/layout/universal-layout";
import { FullPageStatus } from "@/components/full-page-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface Portfolio {
  id: number | string;
  name: string;
  description?: string | null;
}

interface Company {
  id: number | string;
  name: string;
  stage?: string | null;
  industry?: string | null;
  offer?: string | null;
}

export default function PortfolioDetailPage() {
  const { portfolioId = "" } = useParams<{ portfolioId: string }>();
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

  return (
    <UniversalLayout title="Organizations" portfolioName={portfolio.name} portfolioHref={`/portfolios/${portfolio.id}`} floatingPanel={false}>
      <section className="space-y-8 pb-12">
        <div>
          <Link href="/portfolios"><a className="inline-flex items-center text-sm font-medium text-primary hover:text-[#5a2dc0]"><ArrowLeft className="mr-1.5 h-4 w-4" />All portfolios</a></Link>
          <div className="mt-6">
            <p className="eos-label flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" />Organizations</p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{portfolio.name}</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{portfolio.description || "Open an organization or add the next one."}</p>
              </div>
              <Button asChild size="icon" className="h-11 w-11 flex-shrink-0 rounded-xl"><Link href={`/company-setup?portfolioId=${portfolio.id}`} aria-label="Add organization" title="Add organization"><Plus className="h-4 w-4" /></Link></Button>
            </div>
          </div>
        </div>

        <div>
          <Metric label="Organizations" value={companies.length} />
        </div>

        {companies.length === 0 ? (
          <Card className="border-0 bg-[#eff1f2] shadow-none">
            <CardContent className="px-6 py-14 text-center sm:px-12 sm:py-20">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary shadow-[0_8px_32px_rgba(106,55,212,0.08)]"><Building2 className="h-7 w-7" /></span>
              <h2 className="mt-6 text-xl font-semibold">Add the first organization</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create a company inside this portfolio, then configure how it operates in EntrepreneurOS.</p>
              <Button asChild className="mt-7"><Link href={`/company-setup?portfolioId=${portfolio.id}`}><Plus className="mr-2 h-4 w-4" />Add organization</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <Link key={company.id} href={`/company/${company.id}`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Card className="h-full border-0 bg-white shadow-[0_8px_32px_rgba(106,55,212,0.08)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)]">
                    <CardContent className="flex min-h-56 flex-col p-6 sm:p-8">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eff1f2] text-primary"><Building2 className="h-5 w-5" /></span>
                      <h2 className="mt-6 text-xl font-semibold">{company.name}</h2>
                      <p className="mt-2 flex-1 text-sm text-muted-foreground">{company.offer || "Open the organization workspace to define its operating brief, missions, approvals, and evidence."}</p>
                      <div className="mt-6 flex items-center justify-between gap-4"><span className="eos-label">{company.stage || "MVP"}</span><span className="flex items-center text-sm font-medium text-primary">Open workspace <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></div>
                    </CardContent>
                  </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </UniversalLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#eff1f2] p-5"><div className="text-2xl font-semibold text-foreground">{value}</div><div className="eos-label mt-1">{label}</div></div>;
}
