import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ChevronRight, Plus, AlertCircle, Building2, TrendingUp, Target, Briefcase, DollarSign } from 'lucide-react';
import { UniversalLayout } from '@/components/universal-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import designTokens from '@/lib/design-tokens';

const STEPS = [
  { name: 'Portfolio', description: 'Select or create portfolio' },
  { name: 'Company', description: 'Name your company' },
  { name: 'Stage', description: 'Current stage' },
  { name: 'Industry', description: 'Industry and model' },
  { name: 'Goals', description: 'Strategic goals' },
] as const;

const STAGES = [
  { value: 'idea', label: 'Idea', description: 'Validating concept' },
  { value: 'pre-revenue', label: 'Pre-revenue', description: 'Building, not selling yet' },
  { value: 'revenue', label: 'Revenue', description: 'Early customers' },
  { value: 'scaling', label: 'Scaling', description: 'Product-market fit, growing' },
  { value: 'mature', label: 'Mature', description: 'Established business' },
] as const;

const BUSINESS_MODELS = [
  { value: 'saas', label: 'SaaS', icon: Building2 },
  { value: 'services', label: 'Services', icon: Briefcase },
  { value: 'product', label: 'Product', icon: DollarSign },
  { value: 'hybrid', label: 'Hybrid', icon: TrendingUp },
  { value: 'other', label: 'Other', icon: Target },
] as const;

interface Portfolio {
  id: string;
  name: string;
  description?: string;
}

interface CompanyFormData {
  portfolioId: string;
  name: string;
  stage: string;
  industry: string;
  businessModel: string;
  goals: string;
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className="h-2 w-8 rounded-full transition-all"
          style={{
            backgroundColor: index <= currentStep ? designTokens.colors.primary : designTokens.colors.outlineVariant,
          }}
        />
      ))}
    </div>
  );
}

interface PortfolioSelectorProps {
  portfolios: Portfolio[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function PortfolioSelector({ portfolios, selectedId, onSelect }: PortfolioSelectorProps) {
  return (
    <RadioGroup value={selectedId} onValueChange={onSelect} className="space-y-3">
      {portfolios.map((portfolio) => (
        <label
          key={portfolio.id}
          className="flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-all"
          style={{
            background: selectedId === portfolio.id ? 'rgba(255, 255, 255, 0.7)' : designTokens.colors.surface,
            backdropFilter: selectedId === portfolio.id ? 'blur(16px)' : 'none',
            boxShadow: selectedId === portfolio.id ? designTokens.shadows.ambient : 'none',
          }}
        >
          <RadioGroupItem value={portfolio.id} className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold" style={{ color: designTokens.colors.onSurface }}>
              {portfolio.name}
            </div>
            {portfolio.description && (
              <div className="text-sm mt-1" style={{ color: designTokens.colors.onSurfaceVariant }}>
                {portfolio.description}
              </div>
            )}
          </div>
        </label>
      ))}
    </RadioGroup>
  );
}

interface CreatePortfolioInlineProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  error?: string;
}

function CreatePortfolioInline({ name, description, onNameChange, onDescriptionChange, error }: CreatePortfolioInlineProps) {
  return (
    <div
      className="rounded-xl p-6 space-y-4"
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
        boxShadow: designTokens.shadows.ambient,
      }}
    >
      <div className="flex items-center gap-2" style={{ color: designTokens.colors.onSurface }}>
        <Plus size={20} />
        <h3 className="font-semibold text-lg">Create new portfolio</h3>
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="portfolio-name">Portfolio name</Label>
          <Input
            id="portfolio-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., My Ventures"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="portfolio-description">Description (optional)</Label>
          <Textarea
            id="portfolio-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="e.g., My active portfolio companies"
            className="mt-1.5 resize-none"
            rows={2}
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm p-3 rounded-lg" style={{ color: '#dc2626', background: `${'#dc2626'}1A` }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface CompanyNameInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function CompanyNameInput({ value, onChange, error }: CompanyNameInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="company-name">Company name</Label>
      <Input
        id="company-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Acme Labs"
        className="text-lg"
      />
      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#dc2626' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface StageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function StageSelector({ value, onChange, error }: StageSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>What stage?</Label>
      <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
        {STAGES.map((stage) => (
          <label
            key={stage.value}
            className="flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-all"
            style={{
              background: value === stage.value ? 'rgba(255, 255, 255, 0.7)' : designTokens.colors.surface,
              backdropFilter: value === stage.value ? 'blur(16px)' : 'none',
              boxShadow: value === stage.value ? designTokens.shadows.ambient : 'none',
            }}
          >
            <RadioGroupItem value={stage.value} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold" style={{ color: designTokens.colors.onSurface }}>
                {stage.label}
              </div>
              <div className="text-sm mt-1" style={{ color: designTokens.colors.onSurfaceVariant }}>
                {stage.description}
              </div>
            </div>
          </label>
        ))}
      </RadioGroup>
      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#dc2626' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface IndustryInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function IndustryInput({ value, onChange, error }: IndustryInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="industry">What industry?</Label>
      <Input
        id="industry"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., B2B SaaS, Consumer Hardware, Healthcare"
      />
      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#dc2626' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface BusinessModelInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function BusinessModelInput({ value, onChange, error }: BusinessModelInputProps) {
  return (
    <div className="space-y-3">
      <Label>How do you make money?</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {BUSINESS_MODELS.map((model) => {
          const Icon = model.icon;
          const isSelected = value === model.value;
          return (
            <button
              key={model.value}
              type="button"
              onClick={() => onChange(model.value)}
              className="flex flex-col items-center gap-2 rounded-xl p-4 transition-all"
              style={{
                background: isSelected ? 'rgba(255, 255, 255, 0.7)' : designTokens.colors.surface,
                backdropFilter: isSelected ? 'blur(16px)' : 'none',
                boxShadow: isSelected ? designTokens.shadows.ambient : 'none',
                color: isSelected ? designTokens.colors.primary : designTokens.colors.onSurface,
              }}
            >
              <Icon size={24} />
              <span className="text-sm font-medium">{model.label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#dc2626' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface GoalsTextareaProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function GoalsTextarea({ value, onChange, error }: GoalsTextareaProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="goals">What are your top 3 goals for the next quarter?</Label>
      <div className="text-sm mb-3" style={{ color: designTokens.colors.onSurfaceVariant }}>
        These shape your AI agent's recommendations.
      </div>
      <Textarea
        id="goals"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., 10x revenue, hire 5 engineers, launch product line"
        className="resize-none min-h-[120px]"
      />
      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#dc2626' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface SubmitButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

function SubmitButton({ onClick, isLoading, disabled }: SubmitButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="w-full sm:w-auto sm:min-w-[200px]"
      style={{
        backgroundColor: designTokens.colors.primary,
        color: '#ffffff',
      }}
    >
      {isLoading ? 'Creating...' : 'Create company'}
    </Button>
  );
}

export default function CompanySetupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('');
  const [formData, setFormData] = useState<CompanyFormData>({
    portfolioId: '',
    name: '',
    stage: '',
    industry: '',
    businessModel: '',
    goals: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyFormData | 'portfolio', string>>>({});

  const { data: portfolios, isLoading: portfoliosLoading, error: portfoliosError, refetch: refetchPortfolios } = useQuery<Portfolio[]>({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const res = await fetch('/api/portfolios');
      if (!res.ok) throw new Error('Failed to fetch portfolios');
      return res.json();
    },
  });

  const createPortfolioMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create portfolio');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setFormData({ ...formData, portfolioId: data.id });
      setIsCreatingPortfolio(false);
      setNewPortfolioName('');
      setNewPortfolioDescription('');
      setCurrentStep(1);
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const res = await fetch(`/api/portfolios/${data.portfolioId}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          stage: data.stage,
          industry: data.industry,
          businessModel: data.businessModel,
          goals: data.goals,
        }),
      });
      if (!res.ok) throw new Error('Failed to create company');
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/portfolios/${formData.portfolioId}`);
    },
  });

  const validateStep = (step: number): boolean => {
    const newErrors: typeof errors = {};
    
    if (step === 0) {
      if (!isCreatingPortfolio && !formData.portfolioId) {
        newErrors.portfolio = 'Select a portfolio or create a new one';
      }
      if (isCreatingPortfolio && !newPortfolioName.trim()) {
        newErrors.portfolio = 'Portfolio name is required';
      }
    } else if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Company name is required';
      }
    } else if (step === 2) {
      if (!formData.stage) {
        newErrors.stage = 'Select a stage';
      }
    } else if (step === 3) {
      if (!formData.industry.trim()) {
        newErrors.industry = 'Industry is required';
      }
      if (!formData.businessModel) {
        newErrors.businessModel = 'Select a business model';
      }
    } else if (step === 4) {
      if (!formData.goals.trim()) {
        newErrors.goals = 'Goals should be provided';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 0 && isCreatingPortfolio) {
      createPortfolioMutation.mutate({
        name: newPortfolioName,
        description: newPortfolioDescription || undefined,
      });
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setErrors({});
    }
  };

  const handleSubmit = () => {
    if (!validateStep(currentStep)) return;
    createCompanyMutation.mutate(formData);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  if (portfoliosLoading) {
    return (
      <UniversalLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: designTokens.colors.surface }}>
          <div className="w-full max-w-2xl px-6 space-y-6 animate-pulse">
            <div className="h-8 rounded" style={{ backgroundColor: designTokens.colors.surface }} />
            <div className="h-64 rounded-xl" style={{ backgroundColor: designTokens.colors.surface }} />
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (portfoliosError) {
    return (
      <UniversalLayout>
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: designTokens.colors.surface }}>
          <Card className="w-full max-w-md p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 rounded-full" style={{ backgroundColor: `${'#dc2626'}1A` }}>
                <AlertCircle size={32} style={{ color: '#dc2626' }} />
              </div>
            </div>
            <h2 className="text-xl font-semibold" style={{ color: designTokens.colors.onSurface }}>
              Failed to load portfolios
            </h2>
            <p className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
              We couldn't fetch your portfolios. Check your connection and try again.
            </p>
            <Button onClick={() => refetchPortfolios()} variant="outline" className="w-full">
              Retry
            </Button>
          </Card>
        </div>
      </UniversalLayout>
    );
  }

  const showEmptyState = !portfolios || portfolios.length === 0;

  return (
    <UniversalLayout>
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: designTokens.colors.surface }}>
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-semibold" style={{ color: designTokens.colors.onSurface }}>
              {currentStep === 0 ? 'Start operating' : 'Create your company'}
            </h1>
            <p className="text-base sm:text-lg" style={{ color: designTokens.colors.onSurfaceVariant }}>
              {STEPS[currentStep].description}
            </p>
            <StepIndicator currentStep={currentStep} totalSteps={STEPS.length} />
          </div>

          <div
            className="rounded-2xl p-6 sm:p-8 space-y-6"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(16px)',
              boxShadow: designTokens.shadows.ambient,
            }}
          >
            {currentStep === 0 && (
              <div className="space-y-6">
                {showEmptyState ? (
                  <div className="text-center space-y-4 py-8">
                    <div className="flex justify-center">
                      <div className="p-4 rounded-full" style={{ backgroundColor: designTokens.colors.surfaceContainerLow }}>
                        <Building2 size={32} style={{ color: designTokens.colors.primary }} />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold" style={{ color: designTokens.colors.onSurface }}>
                      Create your first portfolio
                    </h3>
                    <p className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
                      Portfolios organize your companies. Start by creating one.
                    </p>
                  </div>
                ) : (
                  !isCreatingPortfolio && (
                    <>
                      <PortfolioSelector
                        portfolios={portfolios}
                        selectedId={formData.portfolioId}
                        onSelect={(id) => setFormData({ ...formData, portfolioId: id })}
                      />
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t" style={{ borderColor: designTokens.colors.outlineVariant }} />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-4 text-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', color: designTokens.colors.onSurfaceVariant }}>
                            or
                          </span>
                        </div>
                      </div>
                    </>
                  )
                )}

                {(isCreatingPortfolio || showEmptyState) ? (
                  <CreatePortfolioInline
                    name={newPortfolioName}
                    description={newPortfolioDescription}
                    onNameChange={setNewPortfolioName}
                    onDescriptionChange={setNewPortfolioDescription}
                    error={errors.portfolio}
                  />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setIsCreatingPortfolio(true)}
                    className="w-full"
                  >
                    <Plus size={18} className="mr-2" />
                    Create new portfolio
                  </Button>
                )}
              </div>
            )}

            {currentStep === 1 && (
              <CompanyNameInput
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                error={errors.name}
              />
            )}

            {currentStep === 2 && (
              <StageSelector
                value={formData.stage}
                onChange={(value) => setFormData({ ...formData, stage: value })}
                error={errors.stage}
              />
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <IndustryInput
                  value={formData.industry}
                  onChange={(value) => setFormData({ ...formData, industry: value })}
                  error={errors.industry}
                />
                <BusinessModelInput
                  value={formData.businessModel}
                  onChange={(value) => setFormData({ ...formData, businessModel: value })}
                  error={errors.businessModel}
                />
              </div>
            )}

            {currentStep === 4 && (
              <GoalsTextarea
                value={formData.goals}
                onChange={(value) => setFormData({ ...formData, goals: value })}
                error={errors.goals}
              />
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {currentStep < STEPS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={createPortfolioMutation.isPending}
                  className="w-full sm:w-auto sm:min-w-[200px]"
                  style={{
                    backgroundColor: designTokens.colors.primary,
                    color: '#ffffff',
                  }}
                >
                  {createPortfolioMutation.isPending ? 'Creating portfolio...' : 'Continue'}
                  <ChevronRight size={18} className="ml-2" />
                </Button>
              ) : (
                <SubmitButton
                  onClick={handleSubmit}
                  isLoading={createCompanyMutation.isPending}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </UniversalLayout>
  );
}