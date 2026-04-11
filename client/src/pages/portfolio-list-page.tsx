import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, AlertCircle, Briefcase, ChevronRight, X } from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio, InsertPortfolio } from "@shared/schema";

export default function PortfolioList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const {
    data: portfolios,
    isLoading,
    error,
  } = useQuery<Portfolio[], Error>({
    queryKey: ["/api/portfolios"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/portfolios");
      return (await res.json()) as Portfolio[];
    },
  });

  const createMutation = useMutation<Portfolio, Error, InsertPortfolio>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/portfolios", input);
      return (await res.json()) as Portfolio;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setShowCreate(false);
      setName("");
      setDescription("");
      toast({
        title: "Portfolio created",
        description: `${created.name} is ready.`,
      });
      navigate(`/portfolios/${created.id}`);
    },
    onError: (err) => {
      toast({
        title: "Couldn't create portfolio",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate({
      name: trimmed,
      description: description.trim() || undefined,
    });
  }

  return (
    <UniversalLayout title="Portfolios">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-[#2c2f30] mb-3">
              Portfolios
            </h1>
            <p className="text-base text-[#595c5d] max-w-xl">
              Group related companies into portfolios. Each portfolio holds a set of
              companies you're building or operating.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-[#6a37d4] text-white px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm hover:bg-[#5a2dc0]"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? "Cancel" : "New Portfolio"}
          </Button>
        </div>

        {/* Inline create form */}
        {showCreate && (
          <Card className="p-6 mb-8 bg-white shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-[#2c2f30]">
                  Create a portfolio
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setShowCreate(false);
                    setName("");
                    setDescription("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolio-name" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Name
                </Label>
                <Input
                  id="portfolio-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Stellar Ventures"
                  disabled={createMutation.isPending}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolio-description" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Description <span className="text-slate-400 normal-case font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="portfolio-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deep tech and infrastructure investment thesis."
                  disabled={createMutation.isPending}
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !name.trim()}
                  className="bg-[#6a37d4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5a2dc0] disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create portfolio"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* List state */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span className="text-sm">Loading portfolios…</span>
          </div>
        )}

        {error && !isLoading && (
          <Card className="p-6 bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  Couldn't load portfolios
                </p>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
              </div>
            </div>
          </Card>
        )}

        {!isLoading && !error && portfolios && portfolios.length === 0 && (
          <Card className="p-12 text-center bg-[#f8f9fa] border border-dashed border-slate-200">
            <Briefcase className="h-10 w-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
              No portfolios yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              A portfolio groups related companies. Start one to organize everything
              you're building.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-[#6a37d4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5a2dc0]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first portfolio
            </Button>
          </Card>
        )}

        {!isLoading && !error && portfolios && portfolios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((portfolio) => (
              <Link key={portfolio.id} href={`/portfolios/${portfolio.id}`}>
                <Card className="p-6 bg-white cursor-pointer hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] transition-shadow group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-[#e9ddff] rounded-lg flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-[#6a37d4]" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#6a37d4] group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#2c2f30] mb-2">
                    {portfolio.name}
                  </h3>
                  {portfolio.description ? (
                    <p className="text-sm text-slate-500 line-clamp-2">
                      {portfolio.description}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No description</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </UniversalLayout>
  );
}
