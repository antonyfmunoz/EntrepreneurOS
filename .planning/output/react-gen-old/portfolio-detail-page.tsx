import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  Building2,
  ChevronRight,
} from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { Portfolio, Company } from "@shared/schema";

export default function PortfolioDetail() {
  const params = useParams<{ portfolioId?: string }>();
  const [, navigate] = useLocation();
  const portfolioId = params.portfolioId;

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useQuery<Portfolio, Error>({
    queryKey: ["/api/portfolios", portfolioId],
    enabled: Boolean(portfolioId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/portfolios/${portfolioId}`);
      return (await res.json()) as Portfolio;
    },
  });

  const {
    data: companies,
    isLoading: companiesLoading,
    error: companiesError,
  } = useQuery<Company[], Error>({
    queryKey: ["/api/portfolios", portfolioId, "companies"],
    enabled: Boolean(portfolioId),
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/portfolios/${portfolioId}/companies`,
      );
      return (await res.json()) as Company[];
    },
  });

  const isLoading = portfolioLoading || companiesLoading;
  const error = portfolioError ?? companiesError;

  return (
    <UniversalLayout title={portfolio?.name ?? "Portfolio"}>
      <div className="max-w-[1200px] mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/portfolios"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#6a37d4] transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          All portfolios
        </Link>

        {/* Header — portfolio name + description */}
        {portfolio && (
          <div className="flex items-start justify-between mb-12">
            <div>
              <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-[#2c2f30] mb-3">
                {portfolio.name}
              </h1>
              {portfolio.description ? (
                <p className="text-base text-[#595c5d] max-w-2xl">
                  {portfolio.description}
                </p>
              ) : (
                <p className="text-base text-slate-400 italic">
                  No description
                </p>
              )}
              <div className="mt-4">
                <Badge className="bg-[#e9ddff] text-[#6a37d4] text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                  {companies?.length ?? 0}{" "}
                  {companies?.length === 1 ? "company" : "companies"}
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => navigate("/company-setup")}
              className="bg-[#6a37d4] text-white px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm hover:bg-[#5a2dc0]"
            >
              <Plus className="h-4 w-4" />
              Add Company
            </Button>
          </div>
        )}

        {/* Loading state — hold the layout while queries resolve */}
        {isLoading && !portfolio && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span className="text-sm">Loading portfolio…</span>
          </div>
        )}

        {/* Error — portfolio not found or API failure */}
        {error && !isLoading && (
          <Card className="p-6 bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  Couldn't load this portfolio
                </p>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
                <Link
                  href="/portfolios"
                  className="text-sm text-red-700 underline mt-2 inline-block"
                >
                  Back to portfolios
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Companies grid */}
        {portfolio && companies && companies.length === 0 && (
          <Card className="p-12 text-center bg-[#f8f9fa] border border-dashed border-slate-200">
            <Building2 className="h-10 w-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
              No companies in this portfolio yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Add a company to start building inside this portfolio.
            </p>
            <Button
              onClick={() => navigate("/company-setup")}
              className="bg-[#6a37d4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5a2dc0]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add your first company
            </Button>
          </Card>
        )}

        {portfolio && companies && companies.length > 0 && (
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
              Companies
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/company/${company.id}`}
                >
                  <Card className="p-6 bg-white cursor-pointer hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-[#e9ddff] rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-[#6a37d4]" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#6a37d4] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
                      {company.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {company.type && (
                        <span className="text-xs text-slate-500">
                          {company.type}
                        </span>
                      )}
                      {company.stage && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500">
                            {company.stage}
                          </span>
                        </>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </UniversalLayout>
  );
}
