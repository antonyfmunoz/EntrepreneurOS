import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UniversalLayout from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";
import { normalizeOptionalGoals } from "@/lib/company-setup";
import { ArrowLeft, ChevronRight } from "lucide-react";

// Types
interface Portfolio {
  id: string | number;
  name: string;
  description?: string;
}

interface PortfolioCreatePayload {
  name: string;
  description?: string;
}

interface PortfolioCreateResponse {
  id: string | number;
  name: string;
  description?: string;
}

interface CompanyCreatePayload {
  name: string;
  stage: string;
  industry: string;
  businessModel: string;
  goals?: string;
  assistantName: string;
  founderProfile: {
    vision: string;
    values: string;
    decisionStyle: string;
    workingStyle: string;
  };
}

interface CompanyResponse {
  id: string;
  name: string;
  portfolioId: string;
  stage: string;
  industry: string;
  businessModel: string;
  goals?: string;
}

const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "pre-revenue", label: "Pre-revenue" },
  { value: "revenue", label: "Revenue" },
  { value: "scaling", label: "Scaling" },
  { value: "mature", label: "Mature" }
];

const BUSINESS_MODELS = [
  { value: "saas", label: "SaaS" },
  { value: "services", label: "Services" },
  { value: "product", label: "Product" },
  { value: "hybrid", label: "Hybrid" },
  { value: "other", label: "Other" }
];

export default function CompanySetupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);

  // Form state
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("portfolioId") || "",
  );
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [stage, setStage] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessModel, setBusinessModel] = useState("");
  const [goals, setGoals] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [founderVision, setFounderVision] = useState("");
  const [founderValues, setFounderValues] = useState("");
  const [decisionStyle, setDecisionStyle] = useState("");
  const [workingStyle, setWorkingStyle] = useState("");
  const requestedPortfolioHandled = useRef(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data fetching
  const { data: portfoliosData, isLoading: portfoliosLoading, error: portfoliosError } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/portfolios");
      return await response.json();
    }
  });

  const portfolios = portfoliosData ?? [];

  useEffect(() => {
    if (requestedPortfolioHandled.current || portfoliosLoading || portfoliosError || !selectedPortfolioId) return;
    requestedPortfolioHandled.current = true;
    if (portfolios.some((portfolio) => String(portfolio.id) === selectedPortfolioId)) {
      setCurrentStep(1);
      return;
    }
    setSelectedPortfolioId("");
  }, [portfolios, portfoliosError, portfoliosLoading, selectedPortfolioId]);

  const createPortfolioMutation = useMutation<PortfolioCreateResponse, Error, PortfolioCreatePayload>({
    mutationFn: async (data: PortfolioCreatePayload) => {
      const response = await apiRequest("POST", "/api/portfolios", data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setSelectedPortfolioId(String(data.id));
      setPortfolioName("");
      setPortfolioDescription("");
      setShowCreatePortfolio(false);
      setCurrentStep(1);
      if (typeof window !== "undefined" && (window as any).posthog) {
        (window as any).posthog.capture("portfolio_created_inline", { portfolioId: data.id });
      }
    }
  });

  const createCompanyMutation = useMutation<CompanyResponse, Error, CompanyCreatePayload & { portfolioId: string }>({
    mutationFn: async ({ portfolioId, ...data }) => {
      const response = await apiRequest("POST", `/api/portfolios/${portfolioId}/companies`, data);
      return await response.json();
    },
    onSuccess: (data) => {
      if (typeof window !== "undefined" && (window as any).posthog) {
        (window as any).posthog.capture("company_created", {
          companyId: data.id,
          portfolioId: data.portfolioId,
          stage: data.stage,
          industry: data.industry
        });
      }
      setLocation(`/company/${data.id}`);
    }
  });

  // Track page view
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("page_viewed");
    }
  }, []);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!selectedPortfolioId) {
        newErrors.portfolio = "Select or create a portfolio";
        setErrors(newErrors);
        return false;
      }
    }

    if (step === 1) {
      if (!companyName.trim()) {
        newErrors.companyName = "Company name required.";
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
      }
    }

    if (step === 2) {
      if (!stage) {
        newErrors.stage = "Select a stage.";
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
      }
    }

    if (step === 3) {
      if (!industry.trim()) {
        newErrors.industry = "Industry required.";
      }
      if (!businessModel) {
        newErrors.businessModel = "Select a business model.";
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
      }
    }

    if (step === 4) {
      if (!assistantName.trim()) newErrors.assistantName = "Choose a name for your Executive Assistant.";
      if (!founderVision.trim()) newErrors.founderVision = "Describe the vision your Executive Office should protect.";
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
      }
    }

    setErrors({});
    return true;
  }, [selectedPortfolioId, companyName, stage, industry, businessModel, assistantName, founderVision]);

  const handleContinue = useCallback(() => {
    if (!validateStep(currentStep)) return;

    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("setup_step_completed", {
        stepIndex: currentStep,
        stepName: getStepName(currentStep)
      });
    }

    setCurrentStep((prev) => prev + 1);
  }, [currentStep, validateStep]);

  const handleCreatePortfolio = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!portfolioName.trim()) {
      newErrors.portfolioName = "Portfolio name required.";
      setErrors(newErrors);
      return;
    }

    createPortfolioMutation.mutate({
      name: portfolioName,
      description: portfolioDescription || undefined
    });
  }, [portfolioName, portfolioDescription, createPortfolioMutation]);

  const handleSubmit = useCallback((goalsOverride?: string) => {
    if (!validateStep(4)) return;

    createCompanyMutation.mutate({
      portfolioId: selectedPortfolioId,
      name: companyName,
      stage,
      industry,
      businessModel,
      goals: normalizeOptionalGoals(goalsOverride ?? goals),
      assistantName: assistantName.trim(),
      founderProfile: {
        vision: founderVision.trim(),
        values: founderValues.trim(),
        decisionStyle: decisionStyle.trim(),
        workingStyle: workingStyle.trim(),
      },
    });
  }, [selectedPortfolioId, companyName, stage, industry, businessModel, goals, assistantName, founderVision, founderValues, decisionStyle, workingStyle, createCompanyMutation, validateStep]);

  const handleSelectPortfolio = useCallback((portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    setCurrentStep(1);
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("portfolio_selected", { portfolioId });
    }
  }, []);

  const stepNames = ["Portfolio", "Company", "Stage", "Model", "Executive Office", "Goals"];
  const totalSteps = 6;
  const selectedPortfolio = portfolios.find((portfolio) => String(portfolio.id) === selectedPortfolioId);

  const getStepName = (step: number): string => stepNames[step] || "";

  return (
    <UniversalLayout
      title="Company setup"
      portfolioName={selectedPortfolio?.name}
      portfolioHref={selectedPortfolio ? `/portfolios/${selectedPortfolio.id}` : "/portfolios"}
      leftRailItems={[]}
      floatingPanel={false}
    >
      <section className="mx-auto w-full max-w-2xl pb-10">
        <Link href={selectedPortfolio ? `/portfolios/${selectedPortfolio.id}` : "/portfolios"} className="inline-flex items-center text-sm font-medium text-primary hover:text-[#5a2dc0]">
          <ArrowLeft className="mr-1.5 h-4 w-4" />Cancel setup
        </Link>

        <div className="mt-6">
          <p className="eos-label">Organization setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Build the operating foundation</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Define the minimum context EOS needs to create a useful, role-aware workspace.</p>
        </div>

        <div className="my-7 rounded-xl bg-[#eff1f2] p-4 sm:p-5" aria-label={`Step ${currentStep + 1} of ${totalSteps}: ${getStepName(currentStep)}`}>
          <div className="flex items-center justify-between gap-4">
            <div><p className="eos-label">Step {currentStep + 1} of {totalSteps}</p><p className="mt-1 font-semibold">{getStepName(currentStep)}</p></div>
            <span className="text-sm text-muted-foreground">{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white" aria-hidden="true"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }} /></div>
          <ol className="mt-4 hidden grid-cols-6 gap-2 sm:grid">
            {stepNames.map((name, idx) => <li key={name} className={`truncate text-center text-[10px] font-medium uppercase tracking-wide ${idx === currentStep ? "text-primary" : idx < currentStep ? "text-foreground" : "text-muted-foreground"}`}>{idx < currentStep ? "Done" : name}</li>)}
          </ol>
        </div>

        {/* Wizard Content */}
        <div className="min-h-[400px] rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(106,55,212,0.08)] sm:p-8">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-4 text-2xl font-semibold">Select or create a portfolio</h2>
                {portfoliosLoading && (
                  <div className="space-y-3">
                    <div className="bg-surface-subtle rounded-md h-16 animate-pulse" />
                    <div className="bg-surface-subtle rounded-md h-16 animate-pulse" />
                  </div>
                )}
                {portfoliosError && (
                  <div className="bg-destructive-muted border border-destructive rounded-md p-4">
                    <p className="font-mono text-sm text-destructive mb-3">Connection failed. Try again.</p>
                    <Button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["portfolios"] })}
                      variant="destructive"
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {!portfoliosLoading && !portfoliosError && (
                  <>
                    {portfolios.length > 0 ? (
                      <div className="space-y-3 mb-4">
                        {portfolios.map((portfolio: Portfolio) => (
                          <button
                            key={portfolio.id}
                            onClick={() => handleSelectPortfolio(String(portfolio.id))}
                            className={`w-full rounded-xl border bg-muted/40 p-4 text-left transition-all duration-150 ${
                              selectedPortfolioId === String(portfolio.id)
                                ? "border-primary ring-2 ring-primary"
                                : "border-border hover:border-primary/30 hover:bg-muted"
                            }`}
                          >
                            <p className="text-base font-semibold">{portfolio.name}</p>
                            {portfolio.description && (
                              <p className="mt-1 text-sm text-muted-foreground">{portfolio.description}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-surface border border-border-subtle rounded-md p-8 text-center mb-4">
                        <p className="font-mono text-sm text-text-secondary mb-4">No portfolios yet. Create your first one.</p>
                      </div>
                    )}
                    {!showCreatePortfolio && (
                      <Button
                        onClick={() => setShowCreatePortfolio(true)}
                        variant="secondary"
                        className="w-full"
                      >
                        Create portfolio
                      </Button>
                    )}
                    {showCreatePortfolio && (
                      <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5 sm:p-6">
                        <div>
                          <Label htmlFor="portfolioName" className="eos-label">
                            Portfolio Name
                          </Label>
                          <Input
                            id="portfolioName"
                            value={portfolioName}
                            onChange={(e) => setPortfolioName(e.target.value)}
                            placeholder="e.g., My Ventures"
                            className={`mt-2 ${errors.portfolioName ? "border-destructive" : ""}`}
                          />
                          {errors.portfolioName && (
                            <p className="mt-1 font-mono text-xs text-destructive">{errors.portfolioName}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="portfolioDescription" className="eos-label">
                            Description
                          </Label>
                          <p className="font-mono text-xs text-text-tertiary mt-1 mb-2">Optional. Describe what this portfolio contains.</p>
                          <Textarea
                            id="portfolioDescription"
                            value={portfolioDescription}
                            onChange={(e) => setPortfolioDescription(e.target.value)}
                            placeholder="e.g., Holding company for all my projects"
                            className="mt-2 min-h-[80px]"
                          />
                        </div>
                        <div className="flex space-x-3">
                          <Button
                            onClick={handleCreatePortfolio}
                            disabled={createPortfolioMutation.isPending}
                            className="flex-1"
                          >
                            {createPortfolioMutation.isPending ? "Saving..." : "Save portfolio"}
                          </Button>
                          <Button
                            onClick={() => setShowCreatePortfolio(false)}
                            variant="secondary"
                          >
                            Cancel
                          </Button>
                        </div>
                        {createPortfolioMutation.isError && (
                          <p className="font-mono text-xs text-destructive">Connection failed. Try again.</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {errors.portfolio && (
                <p className="font-mono text-sm text-destructive">{errors.portfolio}</p>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-4 text-2xl font-semibold">What's your company called?</h2>
                <div>
                  <Label htmlFor="companyName" className="eos-label">
                    Company Name
                  </Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Acme Labs"
                    className={`mt-2 ${errors.companyName ? "border-destructive" : ""}`}
                  />
                  {errors.companyName && (
                    <p className="mt-1 font-mono text-xs text-destructive">{errors.companyName}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-2xl font-semibold">What stage?</h2>
                <p className="mb-4 text-sm text-muted-foreground">We'll adapt your operating system to your scale.</p>
                <RadioGroup value={stage} onValueChange={setStage}>
                  <div className="space-y-3">
                    {STAGES.map((s) => (
                      <label
                        key={s.value}
                        className={`flex cursor-pointer items-center space-x-3 rounded-xl border bg-muted/40 p-4 transition-all duration-150 ${
                          stage === s.value
                            ? "border-primary ring-2 ring-primary"
                            : "border-border hover:border-primary/30 hover:bg-muted"
                        }`}
                      >
                        <RadioGroupItem value={s.value} id={s.value} className="border-border" />
                        <span className="text-base">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
                {errors.stage && (
                  <p className="mt-2 font-mono text-xs text-destructive">{errors.stage}</p>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-4 text-2xl font-semibold">Industry and business model</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="industry" className="eos-label">
                      Industry
                    </Label>
                    <Input
                      id="industry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g., SaaS, E-commerce, Consulting"
                      className={`mt-2 ${errors.industry ? "border-destructive" : ""}`}
                    />
                    {errors.industry && (
                      <p className="mt-1 font-mono text-xs text-destructive">{errors.industry}</p>
                    )}
                  </div>
                  <div>
                    <Label className="eos-label mb-3 block">
                      Business Model
                    </Label>
                    <RadioGroup value={businessModel} onValueChange={setBusinessModel}>
                      <div className="space-y-3">
                        {BUSINESS_MODELS.map((model) => (
                          <label
                            key={model.value}
                            className={`flex cursor-pointer items-center space-x-3 rounded-xl border bg-muted/40 p-4 transition-all duration-150 ${
                              businessModel === model.value
                                ? "border-primary ring-2 ring-primary"
                                : "border-border hover:border-primary/30 hover:bg-muted"
                            }`}
                          >
                            <RadioGroupItem value={model.value} id={model.value} className="border-border" />
                            <span className="text-base">{model.label}</span>
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                    {errors.businessModel && (
                      <p className="mt-2 font-mono text-xs text-destructive">{errors.businessModel}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-2xl font-semibold">Name your Executive Assistant</h2>
                <p className="mb-5 text-sm text-muted-foreground">This is the founder-facing agent. It will coordinate the portfolio advisor council and company CEO agents on your behalf.</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="assistantName" className="eos-label">Executive Assistant name</Label>
                    <Input id="assistantName" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} placeholder="Choose any name" className={`mt-2 ${errors.assistantName ? "border-destructive" : ""}`} />
                    {errors.assistantName && <p className="mt-1 font-mono text-xs text-destructive">{errors.assistantName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="founderVision" className="eos-label">Founder vision</Label>
                    <Textarea id="founderVision" value={founderVision} onChange={(event) => setFounderVision(event.target.value)} placeholder="What are you ultimately building, and what must remain true as it grows?" className={`mt-2 min-h-[96px] ${errors.founderVision ? "border-destructive" : ""}`} />
                    {errors.founderVision && <p className="mt-1 font-mono text-xs text-destructive">{errors.founderVision}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="founderValues" className="eos-label">Values and standards</Label><Textarea id="founderValues" value={founderValues} onChange={(event) => setFounderValues(event.target.value)} placeholder="The principles the council must protect" className="mt-2 min-h-[90px]" /></div>
                    <div><Label htmlFor="decisionStyle" className="eos-label">Decision style</Label><Textarea id="decisionStyle" value={decisionStyle} onChange={(event) => setDecisionStyle(event.target.value)} placeholder="How you want facts, options, risks, and recommendations presented" className="mt-2 min-h-[90px]" /></div>
                  </div>
                  <div><Label htmlFor="workingStyle" className="eos-label">Working style</Label><Textarea id="workingStyle" value={workingStyle} onChange={(event) => setWorkingStyle(event.target.value)} placeholder="Cadence, communication preferences, watchouts, and how the system should support you" className="mt-2 min-h-[90px]" /></div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-2xl font-semibold">What are your top 3 goals for the next quarter?</h2>
                <p className="mb-4 text-sm text-muted-foreground">Optional but recommended. Be specific.</p>
                <Textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="e.g., 10x revenue, hire 5 engineers, launch product line"
                  className="min-h-[120px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {currentStep > 0 && (
            <Button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Back
            </Button>
          )}
          {currentStep < 5 && (
            <Button
              onClick={handleContinue}
              disabled={currentStep === 0 && !selectedPortfolioId}
              className="w-full sm:ml-auto sm:w-auto"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {currentStep === 5 && (
            <div className="flex w-full flex-col-reverse gap-3 sm:ml-auto sm:w-auto sm:flex-row">
              <Button
                onClick={() => handleSubmit("")}
                disabled={createCompanyMutation.isPending}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Skip for now
              </Button>
              <Button
                onClick={() => handleSubmit()}
                disabled={createCompanyMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createCompanyMutation.isPending ? "Creating..." : "Open command center"}
              </Button>
            </div>
          )}
        </div>

        {createCompanyMutation.isError && (
          <div className="mt-4 bg-destructive-muted border border-destructive rounded-md p-4">
            <p className="font-mono text-sm text-destructive">Connection failed. Try again.</p>
          </div>
        )}
      </section>
    </UniversalLayout>
  );
}
