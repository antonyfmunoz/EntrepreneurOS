import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";
import { ChevronRight, Check } from "lucide-react";

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

  const createPortfolioMutation = useMutation<PortfolioCreateResponse, Error, PortfolioCreatePayload>({
    mutationFn: async (data: PortfolioCreatePayload) => {
      const response = await apiRequest("POST", "/api/portfolios", data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setSelectedPortfolioId(String(data.id));
      setShowCreatePortfolio(false);
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

  const handleSubmit = useCallback(() => {
    if (!validateStep(4)) return;

    createCompanyMutation.mutate({
      portfolioId: selectedPortfolioId,
      name: companyName,
      stage,
      industry,
      businessModel,
      goals: goals.trim() || undefined,
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
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("portfolio_selected", { portfolioId });
    }
  }, []);

  const stepNames = ["Portfolio", "Company", "Stage", "Model", "Executive Office", "Goals"];
  const totalSteps = 6;

  const getStepName = (step: number): string => stepNames[step] || "";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono font-bold text-4xl text-text mb-2">Build your operating system</h1>
          <p className="font-mono text-sm text-text-secondary">Set up your portfolio and create your first company.</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {stepNames.map((name, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  idx < currentStep
                    ? "bg-primary border-primary text-text-on-primary"
                    : idx === currentStep
                    ? "border-primary text-primary bg-surface"
                    : "border-border text-text-tertiary bg-surface"
                } font-mono text-xs font-semibold transition-all duration-200`}>
                  {idx < currentStep ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                {idx < totalSteps - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    idx < currentStep ? "bg-primary" : "bg-border"
                  } transition-all duration-200`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            {stepNames.map((name, idx) => (
              <div key={idx} className="flex-1 text-center">
                <p className={`font-mono text-xs uppercase tracking-wide ${
                  idx === currentStep ? "text-text" : "text-text-tertiary"
                }`}>
                  {name}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Content */}
        <div className="bg-surface-elevated rounded-lg border border-border shadow-lg p-8 min-h-[400px]">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-mono font-semibold text-2xl text-text mb-4">Select or create a portfolio</h2>
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
                      className="bg-destructive hover:bg-destructive-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-4 py-2 rounded-md"
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
                            className={`w-full text-left bg-surface border rounded-md p-4 transition-all duration-150 ${
                              selectedPortfolioId === String(portfolio.id)
                                ? "border-primary ring-2 ring-primary"
                                : "border-border hover:border-border-hover hover:bg-surface-subtle"
                            }`}
                          >
                            <p className="font-mono font-semibold text-base text-text">{portfolio.name}</p>
                            {portfolio.description && (
                              <p className="font-mono text-sm text-text-secondary mt-1">{portfolio.description}</p>
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
                        className="w-full bg-surface-subtle hover:bg-border text-text font-mono font-medium text-sm uppercase tracking-wide px-6 py-3 rounded-md border border-border transition-all duration-150"
                      >
                        Create portfolio
                      </Button>
                    )}
                    {showCreatePortfolio && (
                      <div className="bg-surface border border-border rounded-md p-6 space-y-4">
                        <div>
                          <Label htmlFor="portfolioName" className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                            Portfolio Name
                          </Label>
                          <Input
                            id="portfolioName"
                            value={portfolioName}
                            onChange={(e) => setPortfolioName(e.target.value)}
                            placeholder="e.g., My Ventures"
                            className={`mt-2 bg-surface-subtle border rounded-md px-4 py-3 font-mono text-base text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 ${
                              errors.portfolioName ? "border-destructive" : "border-border"
                            }`}
                          />
                          {errors.portfolioName && (
                            <p className="mt-1 font-mono text-xs text-destructive">{errors.portfolioName}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="portfolioDescription" className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                            Description
                          </Label>
                          <p className="font-mono text-xs text-text-tertiary mt-1 mb-2">Optional. Describe what this portfolio contains.</p>
                          <Textarea
                            id="portfolioDescription"
                            value={portfolioDescription}
                            onChange={(e) => setPortfolioDescription(e.target.value)}
                            placeholder="e.g., Holding company for all my projects"
                            className="mt-2 bg-surface-subtle border border-border rounded-md px-4 py-3 font-mono text-base text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 min-h-[80px]"
                          />
                        </div>
                        <div className="flex space-x-3">
                          <Button
                            onClick={handleCreatePortfolio}
                            disabled={createPortfolioMutation.isPending}
                            className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-md transition-colors duration-150"
                          >
                            {createPortfolioMutation.isPending ? "Saving..." : "Save portfolio"}
                          </Button>
                          <Button
                            onClick={() => setShowCreatePortfolio(false)}
                            className="bg-surface-subtle hover:bg-border text-text font-mono font-medium text-sm uppercase tracking-wide px-6 py-3 rounded-md border border-border transition-all duration-150"
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
                <h2 className="font-mono font-semibold text-2xl text-text mb-4">What's your company called?</h2>
                <div>
                  <Label htmlFor="companyName" className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                    Company Name
                  </Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Acme Labs"
                    className={`mt-2 bg-surface-subtle border rounded-md px-4 py-3 font-mono text-base text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 ${
                      errors.companyName ? "border-destructive" : "border-border"
                    }`}
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
                <h2 className="font-mono font-semibold text-2xl text-text mb-2">What stage?</h2>
                <p className="font-mono text-sm text-text-secondary mb-4">We'll adapt your operating system to your scale.</p>
                <RadioGroup value={stage} onValueChange={setStage}>
                  <div className="space-y-3">
                    {STAGES.map((s) => (
                      <label
                        key={s.value}
                        className={`flex items-center space-x-3 bg-surface border rounded-md p-4 cursor-pointer transition-all duration-150 ${
                          stage === s.value
                            ? "border-primary ring-2 ring-primary"
                            : "border-border hover:border-border-hover hover:bg-surface-subtle"
                        }`}
                      >
                        <RadioGroupItem value={s.value} id={s.value} className="border-border" />
                        <span className="font-mono text-base text-text">{s.label}</span>
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
                <h2 className="font-mono font-semibold text-2xl text-text mb-4">Industry and business model</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="industry" className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                      Industry
                    </Label>
                    <Input
                      id="industry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g., SaaS, E-commerce, Consulting"
                      className={`mt-2 bg-surface-subtle border rounded-md px-4 py-3 font-mono text-base text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 ${
                        errors.industry ? "border-destructive" : "border-border"
                      }`}
                    />
                    {errors.industry && (
                      <p className="mt-1 font-mono text-xs text-destructive">{errors.industry}</p>
                    )}
                  </div>
                  <div>
                    <Label className="font-mono text-xs uppercase tracking-wide text-text-secondary mb-3 block">
                      Business Model
                    </Label>
                    <RadioGroup value={businessModel} onValueChange={setBusinessModel}>
                      <div className="space-y-3">
                        {BUSINESS_MODELS.map((model) => (
                          <label
                            key={model.value}
                            className={`flex items-center space-x-3 bg-surface border rounded-md p-4 cursor-pointer transition-all duration-150 ${
                              businessModel === model.value
                                ? "border-primary ring-2 ring-primary"
                                : "border-border hover:border-border-hover hover:bg-surface-subtle"
                            }`}
                          >
                            <RadioGroupItem value={model.value} id={model.value} className="border-border" />
                            <span className="font-mono text-base text-text">{model.label}</span>
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
                <h2 className="font-mono font-semibold text-2xl text-text mb-2">Name your Executive Assistant</h2>
                <p className="font-mono text-sm text-text-secondary mb-5">This is the founder-facing agent. It will coordinate the portfolio advisor council and company CEO agents on your behalf.</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="assistantName" className="font-mono text-xs uppercase tracking-wide text-text-secondary">Executive Assistant name</Label>
                    <Input id="assistantName" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} placeholder="Choose any name" className={`mt-2 ${errors.assistantName ? "border-destructive" : ""}`} />
                    {errors.assistantName && <p className="mt-1 font-mono text-xs text-destructive">{errors.assistantName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="founderVision" className="font-mono text-xs uppercase tracking-wide text-text-secondary">Founder vision</Label>
                    <Textarea id="founderVision" value={founderVision} onChange={(event) => setFounderVision(event.target.value)} placeholder="What are you ultimately building, and what must remain true as it grows?" className={`mt-2 min-h-[96px] ${errors.founderVision ? "border-destructive" : ""}`} />
                    {errors.founderVision && <p className="mt-1 font-mono text-xs text-destructive">{errors.founderVision}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="founderValues" className="font-mono text-xs uppercase tracking-wide text-text-secondary">Values and standards</Label><Textarea id="founderValues" value={founderValues} onChange={(event) => setFounderValues(event.target.value)} placeholder="The principles the council must protect" className="mt-2 min-h-[90px]" /></div>
                    <div><Label htmlFor="decisionStyle" className="font-mono text-xs uppercase tracking-wide text-text-secondary">Decision style</Label><Textarea id="decisionStyle" value={decisionStyle} onChange={(event) => setDecisionStyle(event.target.value)} placeholder="How you want facts, options, risks, and recommendations presented" className="mt-2 min-h-[90px]" /></div>
                  </div>
                  <div><Label htmlFor="workingStyle" className="font-mono text-xs uppercase tracking-wide text-text-secondary">Working style</Label><Textarea id="workingStyle" value={workingStyle} onChange={(event) => setWorkingStyle(event.target.value)} placeholder="Cadence, communication preferences, watchouts, and how the system should support you" className="mt-2 min-h-[90px]" /></div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-mono font-semibold text-2xl text-text mb-2">What are your top 3 goals for the next quarter?</h2>
                <p className="font-mono text-xs text-text-tertiary mb-4">Optional but recommended. Be specific.</p>
                <Textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="e.g., 10x revenue, hire 5 engineers, launch product line"
                  className="bg-surface-subtle border border-border rounded-md px-4 py-3 font-mono text-base text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 min-h-[120px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          {currentStep > 0 && (
            <Button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="bg-surface-subtle hover:bg-border text-text font-mono font-medium text-sm uppercase tracking-wide px-6 py-3 rounded-md border border-border transition-all duration-150"
            >
              Back
            </Button>
          )}
          {currentStep < 5 && (
            <Button
              onClick={handleContinue}
              disabled={currentStep === 0 && !selectedPortfolioId}
              className="ml-auto bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-md transition-colors duration-150 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {currentStep === 5 && (
            <div className="ml-auto flex space-x-3">
              <Button
                onClick={() => {
                  setGoals("");
                  handleSubmit();
                }}
                className="bg-surface-subtle hover:bg-border text-text font-mono font-medium text-sm uppercase tracking-wide px-6 py-3 rounded-md border border-border transition-all duration-150"
              >
                Skip for now
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createCompanyMutation.isPending}
                className="bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-md transition-colors duration-150"
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
      </div>
    </div>
  );
}
