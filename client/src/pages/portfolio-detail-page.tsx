import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Plus,
  Building2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect } from "react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { Portfolio, Company } from "@shared/schema";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GRID_SIZE = 320;
const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;

function CompanyNode({
  data,
}: {
  data: Company & { onClick: () => void };
}) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-[0_8px_32px_rgba(106,55,212,0.08)]"
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        padding: "32px",
        backgroundColor: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(16px)",
        borderRadius: "12px",
        border: "none",
      }}
      onClick={data.onClick}
    >
      <CardHeader style={{ padding: 0, marginBottom: "16px" }}>
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: "#eff1f2" }}
          >
            <Building2 size={20} style={{ color: "#6a37d4" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold truncate"
              style={{ fontSize: "1.125rem", color: "#2c2f30" }}
            >
              {data.name}
            </h3>
          </div>
        </div>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        <div className="space-y-2">
          {data.stage && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#595c5d" }}>
                Stage:
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: "#2c2f30" }}
              >
                {data.stage}
              </span>
            </div>
          )}
          {data.type && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#595c5d" }}>
                Type:
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: "#2c2f30" }}
              >
                {data.type}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const nodeTypes = {
  company: CompanyNode,
};

export default function PortfolioDetailPage() {
  const params = useParams<{ portfolioId?: string }>();
  const [, navigate] = useLocation();
  const portfolioId = params.portfolioId;

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges] = useEdgesState([] as Edge[]);

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
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
    refetch: refetchCompanies,
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

  const handleCompanyClick = (companyId: number) => {
    if (window.gtag) {
      window.gtag("event", "company_opened", { companyId });
    }
    navigate(`/company/${companyId}`);
  };

  const handleAddCompany = () => {
    if (window.gtag) {
      window.gtag("event", "add_company_clicked", { portfolioId });
    }
    navigate("/company-setup");
  };

  useEffect(() => {
    if (portfolio && window.gtag) {
      window.gtag("event", "page_viewed", {
        portfolioId: portfolio.id,
        companyCount: companies?.length ?? 0,
      });
    }
  }, [portfolio, companies]);

  useEffect(() => {
    if (companies && companies.length > 0) {
      const newNodes: Node[] = companies.map((company, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);

        return {
          id: String(company.id),
          type: "company",
          position: {
            x: col * GRID_SIZE + 20,
            y: row * GRID_SIZE + 20,
          },
          data: {
            ...company,
            onClick: () => handleCompanyClick(company.id),
          },
        };
      });

      setNodes(newNodes);
      setEdges([]);
    }
  }, [companies, setNodes, setEdges]);

  const refetch = () => {
    refetchPortfolio();
    refetchCompanies();
  };

  if (isLoading) {
    return (
      <UniversalLayout title={portfolio?.name ?? "Portfolio"}>
        <div className="h-full flex flex-col">
          <div
            className="sticky top-0 z-10 px-6 py-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="flex gap-6">
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </div>
          <div
            className="flex-1 relative"
            style={{ backgroundColor: "#f5f6f7" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className="animate-spin"
                size={32}
                style={{ color: "#6a37d4" }}
              />
            </div>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (error) {
    return (
      <UniversalLayout title="Portfolio">
        <div
          className="h-full flex items-center justify-center"
          style={{ backgroundColor: "#f5f6f7" }}
        >
          <Card
            style={{
              maxWidth: "400px",
              padding: "32px",
              borderRadius: "12px",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle size={48} style={{ color: "#6a37d4" }} />
              <div>
                <h2
                  className="font-semibold mb-2"
                  style={{ fontSize: "1.375rem", color: "#2c2f30" }}
                >
                  Failed to load portfolio
                </h2>
                <p style={{ color: "#595c5d", fontSize: "0.875rem" }}>
                  {error.message}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => refetch()}
                  style={{ backgroundColor: "#6a37d4", borderRadius: "12px" }}
                >
                  Retry
                </Button>
                <Link
                  href="/portfolios"
                  className="text-sm underline"
                  style={{ color: "#6a37d4" }}
                >
                  Back to portfolios
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </UniversalLayout>
    );
  }

  if (!portfolio) {
    return null;
  }

  const hasCompanies = companies && companies.length > 0;
  const companyCount = companies?.length ?? 0;

  return (
    <UniversalLayout title={portfolio.name}>
      <div className="h-full flex flex-col">
        <div
          className="sticky top-0 z-10 px-4 md:px-6 py-4"
          style={{ backgroundColor: "#f5f6f7" }}
        >
          <Link
            href="/portfolios"
            className="inline-flex items-center gap-2 text-sm transition-colors mb-4"
            style={{ color: "#595c5d" }}
          >
            <ArrowLeft className="h-4 w-4" />
            All portfolios
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1
                className="font-semibold mb-1"
                style={{ fontSize: "2rem", color: "#2c2f30" }}
              >
                {portfolio.name}
              </h1>
              {portfolio.description ? (
                <p style={{ color: "#595c5d", fontSize: "0.875rem" }}>
                  {portfolio.description}
                </p>
              ) : (
                <p
                  className="italic"
                  style={{ color: "#abadae", fontSize: "0.875rem" }}
                >
                  No description
                </p>
              )}
            </div>
            <Button
              onClick={handleAddCompany}
              className="shrink-0 hidden md:flex items-center gap-2"
              style={{ backgroundColor: "#6a37d4", borderRadius: "12px" }}
            >
              <Plus size={16} />
              Add company
            </Button>
          </div>

          <div className="flex gap-6">
            <div>
              <div
                className="text-xs mb-1"
                style={{ color: "#595c5d" }}
              >
                Total Companies
              </div>
              <div
                className="font-semibold"
                style={{ fontSize: "1.5rem", color: "#2c2f30" }}
              >
                {companyCount}
              </div>
            </div>
          </div>
        </div>

        {!hasCompanies ? (
          <div
            className="flex-1 flex items-center justify-center"
            style={{ backgroundColor: "#ffffff" }}
          >
            <Card
              style={{
                maxWidth: "480px",
                padding: "32px",
                borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
              }}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div
                  className="p-4 rounded-full"
                  style={{ backgroundColor: "#eff1f2" }}
                >
                  <Building2 size={48} style={{ color: "#6a37d4" }} />
                </div>
                <div>
                  <h2
                    className="font-semibold mb-2"
                    style={{ fontSize: "1.375rem", color: "#2c2f30" }}
                  >
                    No companies yet
                  </h2>
                  <p style={{ color: "#595c5d", fontSize: "0.875rem" }}>
                    Add your first company to this portfolio to get started.
                  </p>
                </div>
                <Button
                  onClick={handleAddCompany}
                  className="flex items-center gap-2"
                  style={{ backgroundColor: "#6a37d4", borderRadius: "12px" }}
                >
                  <Plus size={16} />
                  Add company
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div
            className="flex-1 relative"
            style={{ backgroundColor: "#ffffff" }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.5}
              maxZoom={1.5}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                color="#abadae"
                gap={16}
                size={1}
                style={{ opacity: 0.1 }}
              />
              <Controls
                style={{
                  backgroundColor: "rgba(255,255,255,0.7)",
                  backdropFilter: "blur(16px)",
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
                }}
              />
            </ReactFlow>
          </div>
        )}

        <Button
          onClick={handleAddCompany}
          className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full p-0 flex items-center justify-center shadow-lg z-20"
          style={{
            backgroundColor: "#6a37d4",
            boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
          }}
        >
          <Plus size={24} />
        </Button>
      </div>
    </UniversalLayout>
  );
}
