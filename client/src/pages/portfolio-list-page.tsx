import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Plus, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  companyCount: number;
  createdAt: string;
}

interface PortfolioNodeData {
  id: string;
  name: string;
  description?: string;
  companyCount: number;
  createdAt: string;
}

type PortfolioNode = Node<PortfolioNodeData>;

function PortfolioNodeComponent({ data }: { data: PortfolioNodeData }) {
  return (
    <Card className="w-[280px] p-6 bg-white/70 backdrop-blur-[16px] border-none shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow duration-200 rounded-xl">
      <div className="space-y-3">
        <h3 className="font-mono font-semibold text-lg text-[#2c2f30]">{data.name}</h3>
        {data.description && (
          <p className="font-mono text-sm text-[#65676b] line-clamp-2">{data.description}</p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-[#e0e2e4]">
          <span className="font-mono text-xs uppercase tracking-wide text-[#9ea1a5]">
            {data.companyCount} {data.companyCount === 1 ? 'company' : 'companies'}
          </span>
          <Link href={`/portfolio/${data.id}`}>
            <a className="font-mono text-xs uppercase tracking-wide text-[#6a37d4] hover:text-[#5a2fb4] transition-colors">
              Open →
            </a>
          </Link>
        </div>
      </div>
    </Card>
  );
}

const nodeTypes = {
  portfolio: PortfolioNodeComponent,
};

function CreatePortfolioDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create portfolio');
      return response.json();
    },
    onSuccess: (newPortfolio) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('portfolio_created', { portfolioId: newPortfolio.id });
      }
      setName('');
      setDescription('');
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), description: description.trim() || undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#2c2f30]/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border-none shadow-xl max-w-lg w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono font-bold text-2xl text-[#2c2f30]">Create portfolio</h2>
          <button
            onClick={onClose}
            className="text-[#65676b] hover:text-[#2c2f30] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wide text-[#9ea1a5]">
              Portfolio name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Ventures"
              className="bg-[#f5f6f7] border-[#e0e2e4] rounded-xl px-4 py-3 font-mono text-base text-[#2c2f30] placeholder:text-[#9ea1a5] focus:outline-none focus:ring-2 focus:ring-[#6a37d4] focus:border-[#6a37d4] transition-all duration-150"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wide text-[#9ea1a5]">
              Description (optional)
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Holding company for all my projects"
              className="bg-[#f5f6f7] border-[#e0e2e4] rounded-xl px-4 py-3 font-mono text-base text-[#2c2f30] placeholder:text-[#9ea1a5] focus:outline-none focus:ring-2 focus:ring-[#6a37d4] focus:border-[#6a37d4] transition-all duration-150 min-h-[120px]"
            />
          </div>
          {createMutation.isError && (
            <p className="font-mono text-xs text-[#d32f2f]">
              Failed to create portfolio. Try again.
            </p>
          )}
          <div className="flex space-x-4">
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="bg-[#6a37d4] hover:bg-[#5a2fb4] text-white font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6a37d4] focus:ring-offset-2"
            >
              {createMutation.isPending ? 'Creating...' : 'Create portfolio'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              className="bg-[#f5f6f7] hover:bg-[#e0e2e4] text-[#2c2f30] font-mono font-medium text-sm uppercase tracking-wide px-6 py-3 rounded-xl border border-[#e0e2e4] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#6a37d4] focus:ring-offset-2"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PortfolioListPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<PortfolioNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const { data: portfolios = [], isLoading, error, refetch } = useQuery<Portfolio[]>({
    queryKey: ['/api/portfolios'],
    queryFn: async () => {
      const response = await fetch('/api/portfolios', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load portfolios');
      return response.json();
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('page_viewed', { portfolioCount: portfolios.length });
    }
  }, [portfolios.length]);

  useEffect(() => {
    if (portfolios.length > 0) {
      const newNodes: PortfolioNode[] = portfolios.map((portfolio, index) => {
        const cols = Math.ceil(Math.sqrt(portfolios.length));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          id: portfolio.id,
          type: 'portfolio',
          position: { x: col * 350, y: row * 250 },
          data: portfolio,
        };
      });
      setNodes(newNodes);
    } else {
      setNodes([]);
    }
  }, [portfolios, setNodes]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('portfolio_opened', { portfolioId: node.id });
      }
    },
    []
  );

  const handleCreateClick = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('create_portfolio_clicked');
    }
    setIsCreateOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#fafbfc]">
        <ReactFlow
          nodes={[
            {
              id: 'skeleton-1',
              type: 'default',
              position: { x: 100, y: 100 },
              data: { label: '' },
            },
            {
              id: 'skeleton-2',
              type: 'default',
              position: { x: 450, y: 100 },
              data: { label: '' },
            },
            {
              id: 'skeleton-3',
              type: 'default',
              position: { x: 100, y: 350 },
              data: { label: '' },
            },
          ]}
          edges={[]}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Background className="bg-[#fafbfc]" gap={24} size={1} color="#e0e2e4" />
          <Panel position="top-right" className="flex items-center space-x-2 m-4">
            <div className="w-24 h-10 bg-[#f5f6f7] rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-[#f5f6f7] rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-[#f5f6f7] rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-[#f5f6f7] rounded-xl animate-pulse" />
          </Panel>
        </ReactFlow>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-[#fafbfc] flex items-center justify-center">
        <div className="bg-white rounded-xl border-none shadow-sm p-12 text-center max-w-md">
          <p className="font-mono text-sm text-[#d32f2f] mb-6">
            Failed to load portfolios. Retry or refresh the page.
          </p>
          <Button
            onClick={() => refetch()}
            className="bg-[#6a37d4] hover:bg-[#5a2fb4] text-white font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-xl transition-colors duration-150"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <>
        <div className="h-screen w-full bg-[#fafbfc]">
          <ReactFlow
            nodes={[]}
            edges={[]}
            connectionMode={ConnectionMode.Loose}
            fitView
          >
            <Background className="bg-[#fafbfc]" gap={24} size={1} color="#e0e2e4" />
            <Panel position="top-right" className="flex items-center space-x-2 m-4">
              <Button
                onClick={handleCreateClick}
                className="bg-[#6a37d4] hover:bg-[#5a2fb4] text-white font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-xl transition-colors duration-150 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create portfolio</span>
              </Button>
            </Panel>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl border-none shadow-sm p-12 text-center pointer-events-auto">
                <div className="font-mono text-4xl text-[#9ea1a5] mb-4">—</div>
                <h3 className="font-mono font-semibold text-lg text-[#2c2f30] mb-2">
                  No portfolios yet
                </h3>
                <p className="font-mono text-sm text-[#65676b] mb-6">
                  Create your first portfolio to organize your companies.
                </p>
                <Button
                  onClick={handleCreateClick}
                  className="bg-[#6a37d4] hover:bg-[#5a2fb4] text-white font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-xl transition-colors duration-150"
                >
                  Create portfolio
                </Button>
              </div>
            </div>
          </ReactFlow>
        </div>
        <CreatePortfolioDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="h-screen w-full bg-[#fafbfc]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background className="bg-[#fafbfc]" gap={24} size={1} color="#e0e2e4" />
          <Panel position="top-right" className="flex items-center space-x-2 m-4">
            <Button
              onClick={handleCreateClick}
              className="bg-[#6a37d4] hover:bg-[#5a2fb4] text-white font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-xl transition-colors duration-150 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create portfolio</span>
            </Button>
            <Button
              onClick={() => fitView({ padding: 0.2, duration: 200 })}
              className="bg-white/70 backdrop-blur-[16px] hover:bg-white/90 text-[#2c2f30] border-none shadow-[0_8px_32px_rgba(106,55,212,0.08)] font-mono font-medium text-sm uppercase tracking-wide p-3 rounded-xl transition-all duration-150"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => zoomIn({ duration: 200 })}
              className="bg-white/70 backdrop-blur-[16px] hover:bg-white/90 text-[#2c2f30] border-none shadow-[0_8px_32px_rgba(106,55,212,0.08)] font-mono font-medium text-sm uppercase tracking-wide p-3 rounded-xl transition-all duration-150"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => zoomOut({ duration: 200 })}
              className="bg-white/70 backdrop-blur-[16px] hover:bg-white/90 text-[#2c2f30] border-none shadow-[0_8px_32px_rgba(106,55,212,0.08)] font-mono font-medium text-sm uppercase tracking-wide p-3 rounded-xl transition-all duration-150"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
          </Panel>
        </ReactFlow>
      </div>
      <CreatePortfolioDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </>
  );
}