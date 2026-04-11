import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useState } from "react";
import { Loader2, Briefcase, Plus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Portfolio {
  id: number;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const companySetupSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  type: z.string().optional(),
  stage: z.string().optional(),
  offer: z.string().optional(),
  targetCustomer: z.string().optional(),
  goals: z.string().optional(),
  assistantName: z.string().optional(),
});

type CompanySetupValues = z.infer<typeof companySetupSchema>;

// Sentinel values for the portfolio select — mapped onto actual behavior
// before the mutation runs. Kept as string literals so the shadcn Select
// primitive (which only accepts string values) stays happy.
const PORTFOLIO_SKIP = "__skip__";
const PORTFOLIO_CREATE_NEW = "__new__";

export default function CompanySetupPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<CompanySetupValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      name: "",
      type: "",
      stage: "",
      offer: "",
      targetCustomer: "",
      goals: "",
      assistantName: "",
    },
  });

  // ── Portfolio step state ───────────────────────────────────────────────
  // Optional — users can skip and attach to a portfolio later.
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>(PORTFOLIO_SKIP);
  const [newPortfolioName, setNewPortfolioName] = useState("");

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/portfolios");
      return (await res.json()) as Portfolio[];
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (values: CompanySetupValues) => {
      // Step 1: optionally create the portfolio first so we have an id to
      // attach the company to on the very next call. Any failure here is
      // surfaced to the user — we do NOT silently drop the portfolio link.
      let portfolioId: number | null = null;
      if (selectedPortfolio === PORTFOLIO_CREATE_NEW) {
        const trimmed = newPortfolioName.trim();
        if (!trimmed) {
          throw new Error("Portfolio name is required when creating a new portfolio");
        }
        const created = await apiRequest("POST", "/api/portfolios", { name: trimmed });
        const json = (await created.json()) as Portfolio;
        portfolioId = json.id;
      } else if (selectedPortfolio !== PORTFOLIO_SKIP) {
        portfolioId = Number(selectedPortfolio);
      }

      // Step 2: create the company (preserves the original request shape).
      const res = await apiRequest("POST", "/api/company", values);
      const company = await res.json();

      // Step 3: if we have a portfolio, attach the new company to it. Best-
      // effort — if this fails, the company is still created and the toast
      // tells the user to attach it later from the Portfolio page.
      if (portfolioId !== null && company?.id) {
        try {
          await apiRequest("POST", `/api/portfolios/${portfolioId}/companies`, {
            companyId: company.id,
          });
        } catch (attachErr) {
          toast({
            title: "Company created, but not attached to portfolio",
            description:
              attachErr instanceof Error
                ? attachErr.message
                : "Try attaching it later from the Portfolio page.",
            variant: "destructive",
          });
        }
      }

      return company;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setLocation("/home");
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't create company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CompanySetupValues) => {
    createCompanyMutation.mutate(values);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(1200px_circle_at_50%_-20%,hsl(var(--primary))_0%,transparent_55%)] opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <Card className="w-full border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">Create Your Company</CardTitle>
            <CardDescription className="text-muted-foreground">
              Set up the basics so your workspace can personalize everything else.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc." autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Input placeholder="SaaS, Agency, Marketplace…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <FormControl>
                          <Input placeholder="Idea, MVP, Growth…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="offer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What do you sell, in one clear sentence?"
                          className="min-h-[90px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetCustomer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target customer</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Who is this for? (roles, segments, industries)"
                          className="min-h-[90px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goals</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What would success look like over the next 30–90 days?"
                          className="min-h-[90px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assistantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name your AI assistant</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DEX, ARIA, MAX" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Your assistant handles tasks, recommendations, and workflows. Defaults to "Assistant" if left blank.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ── Step: Add to portfolio (optional) ─────────────────── */}
                <div className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <FormLabel className="m-0">Add to portfolio</FormLabel>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A portfolio groups related companies. Pick one, create a new portfolio, or
                    skip and attach this company later from the Portfolio page.
                  </p>

                  <Select
                    value={selectedPortfolio}
                    onValueChange={setSelectedPortfolio}
                    disabled={portfoliosLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Skip — attach later" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PORTFOLIO_SKIP}>Skip — attach later</SelectItem>
                      {portfolios.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={PORTFOLIO_CREATE_NEW}>
                        <span className="inline-flex items-center gap-2">
                          <Plus className="h-3.5 w-3.5" />
                          Create new portfolio…
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedPortfolio === PORTFOLIO_CREATE_NEW && (
                    <Input
                      placeholder="e.g., Main Operating Group"
                      autoComplete="off"
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                    />
                  )}
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={createCompanyMutation.isPending}>
                    {createCompanyMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Company
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

