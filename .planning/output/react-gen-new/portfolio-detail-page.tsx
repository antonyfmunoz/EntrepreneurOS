import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactFlow, Node, Background, Panel, useNodesState, useEdgesState, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Building2, Loader2, AlertCircle } from 'lucide-react';
import { UniversalLayout } from '@/components/universal-layout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
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

interface PortfolioWithCompanies extends Portfolio {
  companies: Company[];
}

const GRID_SIZE = 320;
const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;

function CompanyNode({ data }: { data: Company & { onClick: () => void } }) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-[0_8px_32px_rgba(106,55,212,0.08)]"
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        padding: '32px',
        backgroundColor: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: 'none'
      }}
      onClick={data.onClick}
    >
      <CardHeader style={{ padding: 0, marginBottom: '16px' }}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#eff1f2' }}>
            <Building2 size={20} style={{ color: '#6a37d4' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate" style={{ fontSize: '1.125rem', color: '#2c2f30' }}>
              {data.name}
            </h3>
          </div>
        </div>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#595c5d' }}>Stage:</span>
            <span className="text-sm font-medium" style={{ color: '#2c2f30' }}>{data.stage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#595c5d' }}>Industry:</span>
            <span className="text-sm font-medium" style={{ color: '#2c2f30' }}>{data.industry}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const nodeTypes = {
  company: CompanyNode
};

export default function PortfolioDetailPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  const { data: portfolio, isLoading, error, refetch } = useQuery<PortfolioWithCompanies>({
    queryKey: ['portfolio', portfolioId],
    queryFn: async () => {
      const [portfolioRes, companiesRes] = await Promise.all([
        fetch(`/api/portfolios/${portfolioId}`),
        fetch(`/api/portfolios/${portfolioId}/companies`)
      ]);

      if (!portfolioRes.ok || !companiesRes.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const portfolioData = await portfolioRes.json();
      const companiesData = await companiesRes.json();

      return {
        ...portfolioData,
        companies: companiesData
      };
    },
    enabled: !!portfolioId
  });

  useEffect(() => {
    if (portfolio?.companies) {
      const newNodes: Node[] = portfolio.companies.map((company, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        
        return {
          id: company.id,
          type: 'company',
          position: {
            x: col * GRID_SIZE + 20,
            y: row * GRID_SIZE + 20
          },
          data: {
            ...company,
            onClick: () => handleCompanyClick(company.id)
          }
        };
      });

      setNodes(newNodes);
      setEdges([]);
    }
  }, [portfolio?.companies, setNodes, setEdges]);

  const handleCompanyClick = (companyId: string) => {
    if (window.gtag) {
      window.gtag('event', 'company_opened', {
        companyId
      });
    }
    setLocation(`/companies/${companyId}/command-center`);
  };

  const handleAddCompany = () => {
    if (window.gtag) {
      window.gtag('event', 'add_company_clicked', {
        portfolioId
      });
    }
    setLocation(`/companies/new?portfolioId=${portfolioId}`);
  };

  useEffect(() => {
    if (portfolio && window.gtag) {
      window.gtag('event', 'page_viewed', {
        portfolioId: portfolio.id,
        companyCount: portfolio.companies?.length || 0
      });
    }
  }, [portfolio]);

  if (isLoading) {
    return (
      <UniversalLayout>
        <div className="h-full flex flex-col">
          <div
            className="sticky top-0 z-10 px-6 py-4"
            style={{
              backgroundColor: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)'
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
          <div className="flex-1 relative" style={{ backgroundColor: '#f5f6f7' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin" size={32} style={{ color: '#6a37d4' }} />
            </div>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (error) {
    return (
      <UniversalLayout>
        <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#f5f6f7' }}>
          <Card style={{ maxWidth: '400px', padding: '32px', borderRadius: '12px' }}>
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle size={48} style={{ color: '#6a37d4' }} />
              <div>
                <h2 className="font-semibold mb-2" style={{ fontSize: '1.375rem', color: '#2c2f30' }}>
                  Failed to load portfolio
                </h2>
                <p style={{ color: '#595c5d', fontSize: '0.875rem' }}>
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
              </div>
              <Button onClick={() => refetch()} style={{ backgroundColor: '#6a37d4' }}>
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </UniversalLayout>
    );
  }

  if (!portfolio) {
    return null;
  }

  const hasCompanies = portfolio.companies && portfolio.companies.length > 0;

  return (
    <UniversalLayout>
      <div className="h-full flex flex-col">
        <div
          className="sticky top-0 z-10 px-4 md:px-6 py-4"
          style={{
            backgroundColor: '#f5f6f7'
          }}
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold mb-1" style={{ fontSize: '2rem', color: '#2c2f30' }}>
                {portfolio.name}
              </h1>
              {portfolio.description && (
                <p style={{ color: '#595c5d', fontSize: '0.875rem' }}>
                  {portfolio.description}
                </p>
              )}
            </div>
            <Button
              onClick={handleAddCompany}
              className="shrink-0 hidden md:flex items-center gap-2"
              style={{ backgroundColor: '#6a37d4', borderRadius: '12px' }}
            >
              <Plus size={16} />
              Add company
            </Button>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-xs mb-1" style={{ color: '#595c5d' }}>
                Total Companies
              </div>
              <div className="font-semibold" style={{ fontSize: '1.5rem', color: '#2c2f30' }}>
                {portfolio.totalCompanies}
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: '#595c5d' }}>
                Active
              </div>
              <div className="font-semibold" style={{ fontSize: '1.5rem', color: '#2c2f30' }}>
                {portfolio.activeCompanies}
              </div>
            </div>
          </div>
        </div>

        {!hasCompanies ? (
          <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
            <Card
              style={{
                maxWidth: '480px',
                padding: '32px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(106,55,212,0.08)'
              }}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 rounded-full" style={{ backgroundColor: '#eff1f2' }}>
                  <Building2 size={48} style={{ color: '#6a37d4' }} />
                </div>
                <div>
                  <h2 className="font-semibold mb-2" style={{ fontSize: '1.375rem', color: '#2c2f30' }}>
                    No companies yet
                  </h2>
                  <p style={{ color: '#595c5d', fontSize: '0.875rem' }}>
                    Add your first company to this portfolio to get started.
                  </p>
                </div>
                <Button
                  onClick={handleAddCompany}
                  className="flex items-center gap-2"
                  style={{ backgroundColor: '#6a37d4', borderRadius: '12px' }}
                >
                  <Plus size={16} />
                  Add company
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 relative" style={{ backgroundColor: '#ffffff' }}>
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
              <Background color="#abadae" gap={16} size={1} style={{ opacity: 0.1 }} />
              <Controls
                style={{
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 8px 32px rgba(106,55,212,0.08)'
                }}
              />
            </ReactFlow>
          </div>
        )}

        <Button
          onClick={handleAddCompany}
          className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full p-0 flex items-center justify-center shadow-lg z-20"
          style={{
            backgroundColor: '#6a37d4',
            boxShadow: '0 8px 32px rgba(106,55,212,0.08)'
          }}
        >
          <Plus size={24} />
        </Button>
      </div>
    </UniversalLayout>
  );
}