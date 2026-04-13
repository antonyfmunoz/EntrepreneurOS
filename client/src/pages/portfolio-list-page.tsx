import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ReactFlow, type Node, type Edge, Controls, MiniMap, Background, useNodesState, useEdgesState, ConnectionLineType, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, MoreVertical, ArrowRight, AlertCircle } from 'lucide-react';
import { UniversalLayout } from '@/components/layout/universal-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import designTokens from '@/lib/design-tokens';
import { usePostHog } from 'posthog-js/react';
import type { Portfolio, InsertPortfolio } from '@shared/schema';

interface PortfolioNodeData {
  portfolio: Portfolio;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

const PortfolioNode = ({ data }: { data: PortfolioNodeData }) => {
  const { portfolio, onOpen, onDelete } = data;

  return (
    <div
      className="group relative"
      style={{
        width: '280px',
        background: designTokens.glassmorphism.background,
        backdropFilter: designTokens.glassmorphism.backdropFilter,
        borderRadius: designTokens.borderRadius.default,
        padding: '24px',
        boxShadow: designTokens.glassmorphism.shadow,
        border: 'none',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-[#2c2f30] leading-tight pr-6">
          {portfolio.name}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#eff1f2]"
              aria-label="Portfolio actions"
            >
              <MoreVertical className="w-4 h-4 text-[#595c5d]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(portfolio.id);
              }}
              className="text-red-600"
            >
              Delete portfolio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {portfolio.description && (
        <p className="text-sm text-[#595c5d] mb-4 line-clamp-2">
          {portfolio.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-[#595c5d]">
          Portfolio
        </span>
        <Button
          size="sm"
          onClick={() => onOpen(portfolio.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: designTokens.colors.primary,
            color: '#ffffff',
          }}
        >
          Open
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  portfolio: PortfolioNode,
};

const EmptyStateNode = ({ onCreate }: { onCreate: () => void }) => {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        width: '320px',
        background: designTokens.glassmorphism.background,
        backdropFilter: designTokens.glassmorphism.backdropFilter,
        borderRadius: designTokens.borderRadius.default,
        padding: '48px 32px',
        boxShadow: designTokens.glassmorphism.shadow,
        border: 'none',
      }}
    >
      <h2 className="text-xl font-semibold text-[#2c2f30] mb-2">
        No portfolios yet
      </h2>
      <p className="text-sm text-[#595c5d] mb-6">
        Create your first portfolio to organize companies and track progress.
      </p>
      <Button
        onClick={onCreate}
        style={{
          background: designTokens.colors.primary,
          color: '#ffffff',
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Create your first portfolio
      </Button>
    </div>
  );
};

const LoadingNode = () => {
  return (
    <div
      className="animate-pulse"
      style={{
        width: '280px',
        background: designTokens.glassmorphism.background,
        backdropFilter: designTokens.glassmorphism.backdropFilter,
        borderRadius: designTokens.borderRadius.default,
        padding: '24px',
        boxShadow: designTokens.glassmorphism.shadow,
        border: 'none',
      }}
    >
      <div className="h-6 bg-[#eff1f2] rounded mb-3 w-3/4" />
      <div className="h-4 bg-[#eff1f2] rounded mb-2 w-full" />
      <div className="h-4 bg-[#eff1f2] rounded mb-4 w-5/6" />
      <div className="flex items-center justify-between">
        <div className="h-4 bg-[#eff1f2] rounded w-24" />
        <div className="h-8 bg-[#eff1f2] rounded w-16" />
      </div>
    </div>
  );
};

export default function PortfolioListPage() {
  const posthog = usePostHog();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges] = useEdgesState([] as Edge[]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const {
    data: portfolios = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Portfolio[], Error>({
    queryKey: ['/api/portfolios'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/portfolios');
      return (await res.json()) as Portfolio[];
    },
  });

  const createMutation = useMutation<Portfolio, Error, InsertPortfolio>({
    mutationFn: async (input) => {
      const res = await apiRequest('POST', '/api/portfolios', input);
      return (await res.json()) as Portfolio;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      setCreateDialogOpen(false);
      setNewPortfolioName('');
      setNewPortfolioDescription('');
      toast({
        title: 'Portfolio created',
        description: `${created.name} is ready.`,
      });
      posthog?.capture('portfolio_created', { portfolioId: created.id });
      navigate(`/portfolios/${created.id}`);
    },
    onError: (err) => {
      toast({
        title: 'Couldn\'t create portfolio',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiRequest('DELETE', `/api/portfolios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      setDeleteDialogOpen(false);
      setPortfolioToDelete(null);
      toast({
        title: 'Portfolio deleted',
      });
    },
    onError: (err) => {
      toast({
        title: 'Deletion failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleOpenPortfolio = useCallback((id: number) => {
    setSelectedPortfolioId(id);
    setDetailSheetOpen(true);
    posthog?.capture('portfolio_opened', { portfolioId: id });
  }, [posthog]);

  const handleDeletePortfolio = useCallback((id: number) => {
    setPortfolioToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleCreatePortfolio = useCallback(() => {
    if (!newPortfolioName.trim()) {
      toast({
        title: 'Portfolio name required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({
      name: newPortfolioName.trim(),
      description: newPortfolioDescription.trim() || undefined,
    });
  }, [newPortfolioName, newPortfolioDescription, createMutation, toast]);

  useEffect(() => {
    if (isLoading) {
      const loadingNodes: Node[] = Array.from({ length: 3 }, (_, i) => ({
        id: `loading-${i}`,
        type: 'default',
        position: { x: (i % 3) * 340 + 50, y: Math.floor(i / 3) * 240 + 50 },
        data: {},
        draggable: false,
      }));
      setNodes(loadingNodes);
      setEdges([]);
    } else if (portfolios.length === 0) {
      setNodes([]);
      setEdges([]);
    } else {
      const portfolioNodes: Node[] = portfolios.map((portfolio, index) => ({
        id: String(portfolio.id),
        type: 'portfolio',
        position: { x: (index % 3) * 340 + 50, y: Math.floor(index / 3) * 240 + 50 },
        data: {
          portfolio,
          onOpen: handleOpenPortfolio,
          onDelete: handleDeletePortfolio,
        },
        draggable: true,
      }));
      setNodes(portfolioNodes);
      setEdges([]);
    }
  }, [portfolios, isLoading, setNodes, setEdges, handleOpenPortfolio, handleDeletePortfolio]);

  useEffect(() => {
    posthog?.capture('portfolio_list_viewed', { portfolioCount: portfolios.length });
  }, [portfolios.length, posthog]);

  const selectedPortfolio = useMemo(() => {
    return portfolios.find(p => p.id === selectedPortfolioId);
  }, [portfolios, selectedPortfolioId]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance]);

  return (
    <UniversalLayout title="Portfolios">
      <div className="relative w-full h-screen">
        {isLoading ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            style={{
              background: designTokens.colors.surface,
            }}
          >
            <Background color={designTokens.colors.outlineVariant} gap={24} size={1} />
          </ReactFlow>
        ) : isError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#2c2f30] mb-2">
                Failed to load portfolios
              </h2>
              <p className="text-sm text-[#595c5d] mb-4">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <Button
                onClick={() => refetch()}
                style={{
                  background: designTokens.colors.primary,
                  color: '#ffffff',
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : portfolios.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyStateNode onCreate={() => {
              setCreateDialogOpen(true);
              posthog?.capture('create_portfolio_clicked');
            }} />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            style={{
              background: designTokens.colors.surface,
            }}
          >
            <Background color={designTokens.colors.outlineVariant} gap={24} size={1} />
            <Controls
              showInteractive={false}
              style={{
                background: designTokens.glassmorphism.background,
                backdropFilter: designTokens.glassmorphism.backdropFilter,
                boxShadow: designTokens.glassmorphism.shadow,
                borderRadius: designTokens.borderRadius.default,
                padding: '8px',
              }}
            />
            <MiniMap
              style={{
                background: designTokens.glassmorphism.background,
                backdropFilter: designTokens.glassmorphism.backdropFilter,
                boxShadow: designTokens.glassmorphism.shadow,
                borderRadius: designTokens.borderRadius.default,
              }}
              maskColor="rgba(106,55,212,0.1)"
            />
          </ReactFlow>
        )}

        {!isLoading && (
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            {portfolios.length > 0 && (
              <Button
                size="sm"
                onClick={handleFitView}
                style={{
                  background: designTokens.glassmorphism.background,
                  backdropFilter: designTokens.glassmorphism.backdropFilter,
                  color: designTokens.colors.primary,
                }}
              >
                Fit view
              </Button>
            )}
            <Button
              onClick={() => {
                setCreateDialogOpen(true);
                posthog?.capture('create_portfolio_clicked');
              }}
              style={{
                background: designTokens.colors.primary,
                color: '#ffffff',
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create portfolio
            </Button>
          </div>
        )}

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create portfolio</DialogTitle>
              <DialogDescription>
                Organize companies and track progress across your portfolio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Portfolio name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 2024 Ventures"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPortfolioName.trim()) {
                      handleCreatePortfolio();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="e.g., Early-stage SaaS investments"
                  value={newPortfolioDescription}
                  onChange={(e) => setNewPortfolioDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePortfolio}
                disabled={!newPortfolioName.trim() || createMutation.isPending}
                style={{
                  background: designTokens.colors.primary,
                  color: '#ffffff',
                }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create portfolio'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete portfolio?</DialogTitle>
              <DialogDescription>
                This will remove the portfolio and all its associations. Companies will not be deleted. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (portfolioToDelete !== null) {
                    deleteMutation.mutate(portfolioToDelete);
                  }
                }}
                disabled={deleteMutation.isPending}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete portfolio'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            {selectedPortfolio && (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedPortfolio.name}</SheetTitle>
                  {selectedPortfolio.description && (
                    <SheetDescription>{selectedPortfolio.description}</SheetDescription>
                  )}
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-[#595c5d] mb-1">
                      Created
                    </div>
                    <div className="text-sm text-[#2c2f30]">
                      {selectedPortfolio.createdAt
                        ? new Date(selectedPortfolio.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'Unknown'}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      navigate(`/portfolios/${selectedPortfolio.id}`);
                    }}
                    className="w-full mt-6"
                    style={{
                      background: designTokens.colors.primary,
                      color: '#ffffff',
                    }}
                  >
                    Open portfolio
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </UniversalLayout>
  );
}
