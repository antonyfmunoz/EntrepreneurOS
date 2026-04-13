import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ReactFlow, Node, Edge, Controls, MiniMap, Background, useNodesState, useEdgesState, ConnectionLineType, NodeProps, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, X, MoreVertical, ArrowRight, AlertCircle } from 'lucide-react';
import { UniversalLayout } from '@/components/universal-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { designTokens } from '@/lib/design-tokens';

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  companyCount: number;
  createdAt: string;
}

interface PortfolioNodeData {
  portfolio: Portfolio;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const PortfolioNode = ({ data }: NodeProps<PortfolioNodeData>) => {
  const { portfolio, onOpen, onDelete } = data;

  return (
    <div
      className="group relative"
      style={{
        width: '280px',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(106,55,212,0.08)',
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
          {portfolio.companyCount} {portfolio.companyCount === 1 ? 'company' : 'companies'}
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

const nodeTypes = {
  portfolio: PortfolioNode,
};

const EmptyStateNode = ({ onCreate }: { onCreate: () => void }) => {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        width: '320px',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        padding: '48px 32px',
        boxShadow: '0 8px 32px rgba(106,55,212,0.08)',
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
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(106,55,212,0.08)',
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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const { data: portfolios = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const response = await fetch('/api/portfolios', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch portfolios');
      }
      return response.json() as Promise<Portfolio[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create portfolio');
      }
      return response.json() as Promise<Portfolio>;
    },
    onSuccess: (portfolio) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setCreateDialogOpen(false);
      setNewPortfolioName('');
      setNewPortfolioDescription('');
      toast({
        title: 'Portfolio created',
        description: `${portfolio.name} is ready.`,
      });
      if (typeof window !== 'undefined' && window.umami) {
        window.umami.track('portfolio_created', { portfolioId: portfolio.id });
      }
    },
    onError: () => {
      toast({
        title: 'Creation failed',
        description: 'Could not create portfolio. Try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/portfolios/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete portfolio');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setDeleteDialogOpen(false);
      setPortfolioToDelete(null);
      toast({
        title: 'Portfolio deleted',
      });
    },
    onError: () => {
      toast({
        title: 'Deletion failed',
        description: 'Could not delete portfolio. Try again.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenPortfolio = useCallback((id: string) => {
    setSelectedPortfolioId(id);
    setDetailSheetOpen(true);
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track('portfolio_opened', { portfolioId: id });
    }
  }, []);

  const handleDeletePortfolio = useCallback((id: string) => {
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
      const portfolioNodes: Node<PortfolioNodeData>[] = portfolios.map((portfolio, index) => ({
        id: portfolio.id,
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
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track('page_viewed', { portfolioCount: portfolios.length });
    }
  }, [portfolios.length]);

  const selectedPortfolio = useMemo(() => {
    return portfolios.find(p => p.id === selectedPortfolioId);
  }, [portfolios, selectedPortfolioId]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance]);

  return (
    <UniversalLayout pageTitle="Portfolios">
      <div className="relative w-full h-screen">
        {isLoading ? (
          <ReactFlow
            nodes={nodes.map(node => ({
              ...node,
              data: <LoadingNode />,
            }))}
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
              <Button onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : portfolios.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyStateNode onCreate={() => {
              setCreateDialogOpen(true);
              if (typeof window !== 'undefined' && window.umami) {
                window.umami.track('create_portfolio_clicked');
              }
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
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(106,55,212,0.08)',
                borderRadius: '12px',
                padding: '8px',
              }}
            />
            <MiniMap
              style={{
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(106,55,212,0.08)',
                borderRadius: '12px',
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
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(16px)',
                  color: designTokens.colors.primary,
                }}
              >
                Fit view
              </Button>
            )}
            <Button
              onClick={() => {
                setCreateDialogOpen(true);
                if (typeof window !== 'undefined' && window.umami) {
                  window.umami.track('create_portfolio_clicked');
                }
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
                  if (portfolioToDelete) {
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
                      Companies
                    </div>
                    <div className="text-2xl font-semibold text-[#2c2f30]">
                      {selectedPortfolio.companyCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#595c5d] mb-1">
                      Created
                    </div>
                    <div className="text-sm text-[#2c2f30]">
                      {new Date(selectedPortfolio.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
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