import { useState, useCallback, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Building2, MoreVertical, ExternalLink, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  totalCompanies: number;
  activeCompanies: number;
}

interface Company {
  id: string;
  name: string;
  stage: string;
  industry: string;
  createdAt: string;
}

interface CompanyNodeData {
  id: string;
  name: string;
  stage: string;
  industry: string;
  onOpen: (id: string) => void;
  onDetach: (id: string) => void;
}

const CompanyNode = ({ data }: NodeProps<CompanyNodeData>) => {
  return (
    <Card className="w-[280px] bg-white/70 backdrop-blur-md border border-gray-200 shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:shadow-[0_12px_48px_rgba(106,55,212,0.12)] transition-all duration-200 cursor-pointer group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-[#6a37d4]" />
            <h3 className="font-semibold text-base text-[#2c2f30]">{data.name}</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => data.onOpen(data.id)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data.onDetach(data.id)}>
                <Unlink className="h-4 w-4 mr-2" />
                Detach from portfolio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Stage:</span> {data.stage}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Industry:</span> {data.industry}
          </p>
        </div>
      </div>
    </Card>
  );
};

const nodeTypes = {
  company: CompanyNode,
};

export default function PortfolioDetailPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useQuery<Portfolio>({
    queryKey: ["/api/portfolios", portfolioId],
    queryFn: () => apiRequest(`/api/portfolios/${portfolioId}`),
    enabled: !!portfolioId,
  });

  const {
    data: companies = [],
    isLoading: companiesLoading,
    error: companiesError,
  } = useQuery<Company[]>({
    queryKey: ["/api/portfolios", portfolioId, "companies"],
    queryFn: () => apiRequest(`/api/portfolios/${portfolioId}/companies`),
    enabled: !!portfolioId,
  });

  const detachMutation = useMutation({
    mutationFn: (companyId: string) =>
      apiRequest(`/api/companies/${companyId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/portfolios", portfolioId, "companies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/portfolios", portfolioId],
      });
      toast({
        title: "Company detached",
        description: "The company has been removed from this portfolio.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to detach company",
        description: "Failed to detach company. Try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenCompany = useCallback((companyId: string) => {
    navigate(`/companies/${companyId}`);
  }, [navigate]);

  const handleDetachCompany = useCallback((companyId: string) => {
    detachMutation.mutate(companyId);
  }, [detachMutation]);

  const handleAddCompany = useCallback(() => {
    navigate(`/companies/new?portfolioId=${portfolioId}`);
  }, [portfolioId, navigate]);

  const initialNodes = useMemo(() => {
    if (!companies || companies.length === 0) return [];

    const cols = Math.ceil(Math.sqrt(companies.length));
    const nodeWidth = 280;
    const nodeHeight = 140;
    const gapX = 60;
    const gapY = 60;

    return companies.map((company: Company, index: number) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      return {
        id: company.id,
        type: "company",
        position: {
          x: col * (nodeWidth + gapX) + 100,
          y: row * (nodeHeight + gapY) + 100,
        },
        data: {
          id: company.id,
          name: company.name,
          stage: company.stage,
          industry: company.industry,
          onOpen: handleOpenCompany,
          onDetach: handleDetachCompany,
        } as CompanyNodeData,
      };
    });
  }, [companies, handleOpenCompany, handleDetachCompany]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as CompanyNodeData;
    handleOpenCompany(data.id);
  }, [handleOpenCompany]);

  if (portfolioLoading || companiesLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mb-6" />
            <div className="flex items-center space-x-4">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 bg-gray-50 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[280px] h-[140px] bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (portfolioError || companiesError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <h2 className="text-xl font-semibold text-[#2c2f30] mb-2">
            Failed to load companies
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Failed to load companies. Retry or refresh the page.
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      </div>
    );
  }

  const showEmptyState = companies.length === 0;

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[#2c2f30] mb-2">
                {portfolio?.name || "Portfolio"}
              </h1>
              {portfolio?.description && (
                <p className="text-base text-gray-600">{portfolio.description}</p>
              )}
            </div>
            <Button onClick={handleAddCompany} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add company</span>
            </Button>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-sm">
              <span className="text-gray-600">Total companies:</span>{" "}
              <span className="font-semibold text-[#2c2f30]">
                {portfolio?.totalCompanies || 0}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Active companies:</span>{" "}
              <span className="font-semibold text-[#2c2f30]">
                {portfolio?.activeCompanies || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 relative">
        {showEmptyState ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card className="max-w-md w-full p-12 text-center">
              <div className="text-4xl text-gray-300 mb-4">—</div>
              <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
                No companies yet
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                No companies yet. Add your first company to this portfolio.
              </p>
              <Button onClick={handleAddCompany} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add company</span>
              </Button>
            </Card>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
            minZoom={0.2}
            maxZoom={2}
          >
            <Background />
            <Controls />
            <Panel position="top-left" className="bg-white/70 backdrop-blur-md rounded-lg border border-gray-200 p-4 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
              <p className="text-sm text-gray-600">
                Companies in this portfolio. Click a company to open its command center.
              </p>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  );
}