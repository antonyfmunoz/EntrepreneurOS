import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, Check, CreditCard, DollarSign, Download, Gauge, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { ProductionReadinessControls } from "@/components/production-readiness-controls";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { resolveSettingsCompanyId, settingsCompanyUrl } from "@/lib/settings-context";

type UserProfile = {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
};

type CompanySettings = {
  id: number;
  name: string;
  stage?: string;
  industry?: string;
  businessModel?: string;
  goals?: string;
};

type AiBudget = {
  configured: boolean;
  enabled: boolean;
  monthlyLimitMicros: number | null;
  perRequestLimitMicros: number | null;
  alertThresholdPercent: number;
  thresholdAlert: { createdAt: string; usageMicros: number; limitMicros: number } | null;
  spentMicros: number;
  completedMicros: number;
  reservedMicros: number;
  failedCount: number;
  entries: Array<{
    id: string;
    context: string;
    model: string;
    status: "reserved" | "completed" | "failed";
    reservedCostMicros: number;
    actualCostMicros: number | null;
    reconciliationEvidenceUri: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

type BillingStatus = {
  configured: boolean;
  availablePlans: Array<{ key: string }>;
  subscription: null | {
    planKey: string;
    status: string;
    entitlements: string[];
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  };
};

const settingsTabs = ["profile", "company", "privacy", "cost", "billing", "readiness"] as const;
type SettingsTab = typeof settingsTabs[number];
const canonicalCompanyStages = ["idea", "pre-revenue", "revenue", "scaling", "mature"];

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function SettingsCard({ children }: { children: ReactNode }) {
  return <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8">{children}</Card>;
}

function CompanyRequired({ hasCompanies }: { hasCompanies: boolean }) {
  return (
    <SettingsCard>
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Choose a company first</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasCompanies
              ? "Company settings are intentionally inactive until you choose the exact company above."
              : "Create or enter an organization before configuring company controls."}
          </p>
          {!hasCompanies && <a href="/portfolios" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">Go to your portfolios</a>}
        </div>
      </div>
    </SettingsCard>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialTab = initialParams.has("billing") ? "billing" : initialParams.has("readiness") ? "readiness" : initialParams.has("cost") ? "cost" : "profile";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [requestedCompanyId, setRequestedCompanyId] = useState<string | null>(initialParams.get("companyId"));
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});
  const [companyForm, setCompanyForm] = useState<Partial<CompanySettings>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [monthlyAiBudget, setMonthlyAiBudget] = useState("25");
  const [perRequestAiBudget, setPerRequestAiBudget] = useState("1");
  const [aiAlertThreshold, setAiAlertThreshold] = useState("80");
  const [reconciliationUsageId, setReconciliationUsageId] = useState("");
  const [reconciliationStatus, setReconciliationStatus] = useState<"completed" | "failed">("completed");
  const [reconciliationCost, setReconciliationCost] = useState("");
  const [reconciliationEvidence, setReconciliationEvidence] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");

  const userProfile = useQuery<UserProfile>({
    queryKey: ["/api/users/me"],
    queryFn: async () => (await apiRequest<Response>("GET", "/api/users/me")).json(),
  });
  const companiesQuery = useQuery<{ companies: CompanySettings[] }>({
    queryKey: ["/api/companies"],
    queryFn: async () => (await apiRequest<Response>("GET", "/api/companies")).json(),
  });
  const companies = companiesQuery.data?.companies ?? [];
  const selectedCompanyId = resolveSettingsCompanyId(requestedCompanyId, companies);
  const selectedCompanySummary = companies.find((company) => company.id === selectedCompanyId) ?? null;

  useEffect(() => {
    if (!requestedCompanyId && selectedCompanyId) {
      setRequestedCompanyId(String(selectedCompanyId));
      window.history.replaceState({}, "", settingsCompanyUrl(selectedCompanyId));
    }
  }, [requestedCompanyId, selectedCompanyId]);

  const companySettings = useQuery<CompanySettings>({
    queryKey: ["/api/companies", selectedCompanyId],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/companies/${selectedCompanyId}`)).json(),
    enabled: selectedCompanyId !== null,
  });
  const aiBudget = useQuery<AiBudget>({
    queryKey: ["/api/eos/companies", selectedCompanyId, "ai-budget"],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/eos/companies/${selectedCompanyId}/ai-budget`)).json(),
    enabled: selectedCompanyId !== null,
  });
  const billing = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => (await apiRequest<Response>("GET", "/api/billing/status")).json(),
  });
  const platformCapabilities = useQuery<{ operationalReadiness: boolean }>({
    queryKey: ["/api/platform/capabilities"],
    queryFn: async () => (await apiRequest<Response>("GET", "/api/platform/capabilities")).json(),
  });
  const deletionRequest = useQuery<{ status: string; scheduledFor: string } | null>({ queryKey: ["/api/users/me/deletion"] });
  const analyticsConsent = useQuery<{ consent: boolean | null; decidedAt: string | null }>({ queryKey: ["/api/users/me/analytics-consent"] });

  useEffect(() => {
    if (userProfile.data) setProfileForm({ username: userProfile.data.username ?? "", fullName: userProfile.data.fullName ?? "" });
  }, [userProfile.data]);
  useEffect(() => {
    if (companySettings.data) {
      setCompanyForm({
        name: companySettings.data.name ?? "",
        stage: companySettings.data.stage ?? "",
        goals: companySettings.data.goals ?? "",
      });
    }
  }, [companySettings.data]);
  useEffect(() => {
    if (aiBudget.data?.monthlyLimitMicros != null) setMonthlyAiBudget((aiBudget.data.monthlyLimitMicros / 1_000_000).toString());
    if (aiBudget.data?.perRequestLimitMicros != null) setPerRequestAiBudget((aiBudget.data.perRequestLimitMicros / 1_000_000).toString());
    if (aiBudget.data?.alertThresholdPercent != null) setAiAlertThreshold(String(aiBudget.data.alertThresholdPercent));
    if (!reconciliationUsageId || !aiBudget.data?.entries.some((entry) => entry.id === reconciliationUsageId && entry.status === "reserved")) setReconciliationUsageId(aiBudget.data?.entries.find((entry) => entry.status === "reserved")?.id || "");
  }, [aiBudget.data, reconciliationUsageId]);
  useEffect(() => {
    if (!selectedPlan && billing.data?.availablePlans.length === 1) setSelectedPlan(billing.data.availablePlans[0].key);
  }, [billing.data, selectedPlan]);
  useEffect(() => {
    if (!platformCapabilities.isLoading && !platformCapabilities.data?.operationalReadiness && activeTab === "readiness") setActiveTab("profile");
  }, [activeTab, platformCapabilities.data?.operationalReadiness, platformCapabilities.isLoading]);

  const selectCompany = (value: string) => {
    setRequestedCompanyId(value);
    setCompanyForm({});
    window.history.replaceState({}, "", settingsCompanyUrl(Number(value)));
  };

  const updateProfile = useMutation({
    mutationFn: async () => (await apiRequest<Response>("PUT", "/api/users/me", profileForm)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users/me"] }),
  });
  const updateCompany = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("Choose a company first.");
      return (await apiRequest<Response>("PUT", `/api/companies/${selectedCompanyId}`, companyForm)).json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/companies", selectedCompanyId] }),
      ]);
    },
  });
  const updateAiBudget = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("Choose a company first.");
      return (await apiRequest<Response>("PUT", `/api/eos/companies/${selectedCompanyId}/ai-budget`, {
        monthlyLimitDollars: Number(monthlyAiBudget),
        perRequestLimitDollars: Number(perRequestAiBudget),
        alertThresholdPercent: Number(aiAlertThreshold),
        enabled: true,
      })).json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/eos/companies", selectedCompanyId, "ai-budget"] }),
  });
  const reconcileAiUsage = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId || !reconciliationUsageId) throw new Error("Choose an unresolved reservation.");
      return (await apiRequest<Response>("POST", `/api/eos/companies/${selectedCompanyId}/ai-usage/${reconciliationUsageId}/reconcile`, { status: reconciliationStatus, actualCostDollars: reconciliationStatus === "failed" ? 0 : Number(reconciliationCost), evidenceUri: reconciliationEvidence.trim() })).json();
    },
    onSuccess: async () => {
      setReconciliationCost("");
      setReconciliationEvidence("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/eos/companies", selectedCompanyId, "ai-budget"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
      ]);
    },
  });
  const startCheckout = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", "/api/billing/checkout", { planKey: selectedPlan })).json() as Promise<{ url: string }>,
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const openBillingPortal = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", "/api/billing/portal")).json() as Promise<{ url: string }>,
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const exportAccount = useMutation({
    mutationFn: async () => (await apiRequest<Response>("GET", "/api/users/me/export")).blob(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `entrepreneuros-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const updateAnalyticsConsent = useMutation({
    mutationFn: async (consent: boolean) => (await apiRequest<Response>("PUT", "/api/users/me/analytics-consent", { consent })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users/me/analytics-consent"] }),
  });
  const scheduleDeletion = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", "/api/users/me/deletion", { confirmation: deletionConfirmation, deleteOwnedOrganizations: false })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users/me/deletion"] }),
  });
  const cancelDeletion = useMutation({
    mutationFn: async () => (await apiRequest<Response>("DELETE", "/api/users/me/deletion")).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users/me/deletion"] }),
  });

  const saveProfile = () => {
    const errors: Record<string, string> = {};
    if (profileForm.username && (profileForm.username.length < 3 || !/^[a-z0-9_]+$/.test(profileForm.username))) {
      errors.username = "Use at least three lowercase letters, numbers, or underscores.";
    }
    setProfileErrors(errors);
    if (!Object.keys(errors).length) updateProfile.mutate();
  };
  const tabClass = (tab: SettingsTab) => activeTab === tab
    ? "px-2 transition-none sm:px-4"
    : "px-2 !bg-transparent !text-muted-foreground !shadow-none transition-none sm:px-4";

  if (userProfile.isError || companiesQuery.isError) {
    return <UniversalLayout title="Settings" leftRailItems={[]} floatingPanel={false}><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><SettingsCard><h1 className="text-2xl font-semibold">Settings could not load</h1><p className="mt-2 text-sm text-muted-foreground">Refresh the account and company data, then try again.</p><Button className="mt-5" onClick={() => void Promise.all([userProfile.refetch(), companiesQuery.refetch()])}>Retry</Button></SettingsCard></main></UniversalLayout>;
  }

  return (
    <UniversalLayout title="Settings" leftRailItems={[]} floatingPanel={false}>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="mb-6 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eos-label">Account control</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Settings</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">Control your identity, exact company, privacy, spend, subscription, and authorized platform operations from one place.</p>
          </div>
          <div className="w-full sm:w-[280px]">
            <Label htmlFor="settings-company" className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted-foreground">Company context</Label>
            {companiesQuery.isLoading ? <div className="h-10 animate-pulse rounded-xl bg-muted" /> : companies.length ? (
              <Select value={selectedCompanyId ? String(selectedCompanyId) : undefined} onValueChange={selectCompany}>
                <SelectTrigger id="settings-company" aria-label="Company context"><SelectValue placeholder="Choose a company" /></SelectTrigger>
                <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : <Button asChild variant="outline" className="w-full"><a href="/portfolios">Create an organization</a></Button>}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 justify-start gap-1 rounded-2xl bg-muted p-1.5 sm:inline-flex sm:w-auto">
            <TabsTrigger className={tabClass("profile")} value="profile">Profile</TabsTrigger>
            <TabsTrigger className={tabClass("company")} value="company">Company</TabsTrigger>
            <TabsTrigger className={tabClass("privacy")} value="privacy">Privacy</TabsTrigger>
            <TabsTrigger className={tabClass("cost")} value="cost">AI spend</TabsTrigger>
            <TabsTrigger className={tabClass("billing")} value="billing">Billing</TabsTrigger>
            {platformCapabilities.data?.operationalReadiness && <TabsTrigger className={tabClass("readiness")} value="readiness"><Gauge className="mr-1.5 h-4 w-4" />Readiness</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile">
            <SettingsCard>
              <div className="mb-6 flex items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">Your profile</h2><p className="mt-1 text-sm text-muted-foreground">The name teammates see inside EOS.</p></div></div>
              {userProfile.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : <div className="space-y-5">
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" value={userProfile.data?.email ?? ""} disabled /><p className="text-xs text-muted-foreground">Email and profile photo are managed by your identity provider.</p></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" value={profileForm.fullName ?? ""} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" value={profileForm.username ?? ""} onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} />{profileErrors.username && <p className="text-xs text-destructive">{profileErrors.username}</p>}</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><a href="#" onClick={(event) => { event.preventDefault(); document.querySelector<HTMLButtonElement>('[aria-label="Notifications"]')?.click(); }} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><Bell className="h-4 w-4" />Open in-app notifications</a><Button onClick={saveProfile} disabled={updateProfile.isPending}>{updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Save profile</Button></div>
                {updateProfile.isSuccess && <p className="text-right text-sm text-emerald-700">Profile updated.</p>}{updateProfile.isError && <p className="text-right text-sm text-destructive">Profile changes could not be saved.</p>}
              </div>}
            </SettingsCard>
          </TabsContent>

          <TabsContent value="company">
            {!selectedCompanyId ? <CompanyRequired hasCompanies={companies.length > 0} /> : <SettingsCard>
              <div className="mb-6 flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">{selectedCompanySummary?.name}</h2><p className="mt-1 text-sm text-muted-foreground">Only this selected company will be changed.</p></div></div>
              {companySettings.isLoading ? <div className="h-48 animate-pulse rounded-xl bg-muted" /> : <div className="space-y-5">
                <div className="space-y-2"><Label htmlFor="companyName">Company name</Label><Input id="companyName" value={companyForm.name ?? ""} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="stage">Stage</Label><Select value={companyForm.stage || undefined} onValueChange={(stage) => setCompanyForm((current) => ({ ...current, stage }))}><SelectTrigger id="stage"><SelectValue placeholder="Select stage" /></SelectTrigger><SelectContent>{companyForm.stage && !canonicalCompanyStages.includes(companyForm.stage) && <SelectItem value={companyForm.stage}>{titleCase(companyForm.stage)} (current)</SelectItem>}<SelectItem value="idea">Idea</SelectItem><SelectItem value="pre-revenue">Pre-revenue</SelectItem><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="scaling">Scaling</SelectItem><SelectItem value="mature">Mature</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="goals">Goals</Label><Textarea id="goals" className="min-h-[120px]" value={companyForm.goals ?? ""} onChange={(event) => setCompanyForm((current) => ({ ...current, goals: event.target.value }))} /></div>
                <div className="flex justify-end"><Button onClick={() => updateCompany.mutate()} disabled={updateCompany.isPending}>{updateCompany.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Save company</Button></div>
                {updateCompany.isSuccess && <p className="text-right text-sm text-emerald-700">Company settings updated.</p>}{updateCompany.isError && <p className="text-right text-sm text-destructive">Company changes could not be saved.</p>}
              </div>}
            </SettingsCard>}
          </TabsContent>

          <TabsContent value="privacy">
            <SettingsCard>
              <div className="space-y-7">
                <div><h2 className="text-xl font-semibold">Your data</h2><p className="mt-2 text-sm text-muted-foreground">Export, analytics consent, and deletion are applied to your authenticated account.</p></div>
                <div className="rounded-2xl bg-muted p-5"><h3 className="font-semibold">Download an account export</h3><p className="mt-2 text-sm text-muted-foreground">Includes your profile, owned organizations, memberships, messages, audit activity, support requests, billing state, and provider metadata. Secrets are excluded.</p><Button className="mt-4" variant="outline" onClick={() => exportAccount.mutate()} disabled={exportAccount.isPending}>{exportAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download export</Button></div>
                <div className="flex items-start justify-between gap-5 border-t pt-6"><div><h3 className="font-semibold">Optional product analytics</h3><p className="mt-2 text-sm text-muted-foreground">Allow privacy-scoped usage events. Content, prompts, secrets, and company records are excluded.</p><p className="mt-2 text-xs text-muted-foreground">Current choice: {analyticsConsent.data?.consent === true ? "Allowed" : analyticsConsent.data?.consent === false ? "Declined" : "Not chosen"}</p></div><Switch aria-label="Allow optional product analytics" checked={analyticsConsent.data?.consent === true} onCheckedChange={(value) => updateAnalyticsConsent.mutate(value)} disabled={updateAnalyticsConsent.isPending} /></div>
                <div className="border-t pt-6"><h3 className="font-semibold text-destructive">Delete your account</h3>{deletionRequest.data?.status === "scheduled" ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>Deletion is scheduled for {new Date(deletionRequest.data.scheduledFor).toLocaleString()}.</p><Button className="mt-3" variant="outline" onClick={() => cancelDeletion.mutate()} disabled={cancelDeletion.isPending}>Cancel deletion</Button></div> : <div className="mt-3 space-y-4"><p className="text-sm text-muted-foreground">A cooling-off period applies. Transfer ownership of portfolios or companies before processing begins.</p><div className="space-y-2"><Label htmlFor="delete-confirmation">Type DELETE MY ENTREPRENEUROS ACCOUNT</Label><Input id="delete-confirmation" value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} /></div><Button variant="destructive" onClick={() => scheduleDeletion.mutate()} disabled={scheduleDeletion.isPending || deletionConfirmation !== "DELETE MY ENTREPRENEUROS ACCOUNT"}>Schedule deletion</Button></div>}</div>
              </div>
            </SettingsCard>
          </TabsContent>

          <TabsContent value="cost">
            {!selectedCompanyId ? <CompanyRequired hasCompanies={companies.length > 0} /> : <SettingsCard>
              <div className="mb-6 flex items-start gap-3"><DollarSign className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">AI spend for {selectedCompanySummary?.name}</h2><p className="mt-1 text-sm text-muted-foreground">Hard per-request and monthly limits are enforced before model calls.</p></div></div>
              {aiBudget.isLoading ? <div className="h-36 animate-pulse rounded-xl bg-muted" /> : <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="monthly-ai-budget">Monthly limit (USD)</Label><Input id="monthly-ai-budget" type="number" min="0.01" max="10000" step="0.01" value={monthlyAiBudget} onChange={(event) => setMonthlyAiBudget(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="request-ai-budget">Per-request limit (USD)</Label><Input id="request-ai-budget" type="number" min="0.01" max="1000" step="0.01" value={perRequestAiBudget} onChange={(event) => setPerRequestAiBudget(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="ai-alert-threshold">Alert at percent</Label><Input id="ai-alert-threshold" type="number" min="1" max="100" step="1" value={aiAlertThreshold} onChange={(event) => setAiAlertThreshold(event.target.value)} /></div></div>
                <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-muted p-4 text-sm"><p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Completed</p><p className="mt-2 text-lg font-semibold">${((aiBudget.data?.completedMicros ?? 0) / 1_000_000).toFixed(4)}</p></div><div className="rounded-2xl bg-muted p-4 text-sm"><p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Reserved</p><p className="mt-2 text-lg font-semibold">${((aiBudget.data?.reservedMicros ?? 0) / 1_000_000).toFixed(4)}</p></div><div className="rounded-2xl bg-muted p-4 text-sm"><p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Failed calls</p><p className="mt-2 text-lg font-semibold">{aiBudget.data?.failedCount ?? 0}</p></div></div>
                {aiBudget.data?.thresholdAlert && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Monthly threshold notification sent</p><p className="mt-1">EOS notified the budget owner at ${(aiBudget.data.thresholdAlert.usageMicros / 1_000_000).toFixed(4)} of ${(aiBudget.data.thresholdAlert.limitMicros / 1_000_000).toFixed(2)} on {new Date(aiBudget.data.thresholdAlert.createdAt).toLocaleString()}.</p></div>}
                <Button onClick={() => updateAiBudget.mutate()} disabled={updateAiBudget.isPending || !Number(monthlyAiBudget) || !Number(perRequestAiBudget) || Number(perRequestAiBudget) > Number(monthlyAiBudget) || Number(aiAlertThreshold) < 1 || Number(aiAlertThreshold) > 100}>{updateAiBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save AI budget</Button>
                {updateAiBudget.isSuccess && <p className="text-sm text-emerald-700">AI budget updated for {selectedCompanySummary?.name}.</p>}{updateAiBudget.isError && <p className="text-sm text-destructive">The budget could not be saved. Use positive limits with the per-request limit no greater than the monthly limit.</p>}
                <div className="border-t pt-5"><h3 className="font-semibold">Current-month AI ledger</h3><p className="mt-1 text-sm text-muted-foreground">Completed costs, unresolved reservations, failed calls, model, and operating context. Provider invoices remain authoritative for production reconciliation.</p>{aiBudget.data?.entries.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-[0.1em] text-muted-foreground"><th className="px-2 py-3">Context</th><th className="px-2 py-3">Model</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Cost</th><th className="px-2 py-3">Time</th></tr></thead><tbody>{aiBudget.data.entries.map((entry) => <tr key={entry.id} className="border-b last:border-0"><td className="px-2 py-3 font-medium">{titleCase(entry.context)}</td><td className="px-2 py-3 text-muted-foreground">{entry.model}</td><td className="px-2 py-3">{titleCase(entry.status)}</td><td className="px-2 py-3">${(((entry.status === "completed" ? entry.actualCostMicros : entry.status === "reserved" ? entry.reservedCostMicros : 0) || 0) / 1_000_000).toFixed(4)}</td><td className="px-2 py-3 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">No AI ledger entries for this month.</p>}</div>
                {aiBudget.data?.entries.some((entry) => entry.status === "reserved") && <div className="border-t pt-5"><h3 className="font-semibold">Reconcile unresolved reservation</h3><p className="mt-1 text-sm text-muted-foreground">Use a secret-free provider receipt or reviewed reconciliation artifact. This changes durable cost state and is audited.</p><div className="mt-4 space-y-4"><div className="space-y-2"><Label htmlFor="ai-reservation">Reservation</Label><Select value={reconciliationUsageId} onValueChange={setReconciliationUsageId}><SelectTrigger id="ai-reservation"><SelectValue /></SelectTrigger><SelectContent>{aiBudget.data.entries.filter((entry) => entry.status === "reserved").map((entry) => <SelectItem key={entry.id} value={entry.id}>{titleCase(entry.context)} · ${(entry.reservedCostMicros / 1_000_000).toFixed(4)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ai-reconciliation-status">Outcome</Label><Select value={reconciliationStatus} onValueChange={(value) => setReconciliationStatus(value as "completed" | "failed")}><SelectTrigger id="ai-reconciliation-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed with actual cost</SelectItem><SelectItem value="failed">Failed with no provider cost</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="ai-reconciliation-cost">Actual cost (USD)</Label><Input id="ai-reconciliation-cost" type="number" min="0" max="10000" step="0.000001" value={reconciliationStatus === "failed" ? "0" : reconciliationCost} onChange={(event) => setReconciliationCost(event.target.value)} disabled={reconciliationStatus === "failed"} /></div></div><div className="space-y-2"><Label htmlFor="ai-reconciliation-evidence">Secret-free evidence URL</Label><Input id="ai-reconciliation-evidence" type="url" value={reconciliationEvidence} onChange={(event) => setReconciliationEvidence(event.target.value)} placeholder="https://evidence.example.com/provider/receipt" /></div><Button variant="outline" onClick={() => reconcileAiUsage.mutate()} disabled={reconcileAiUsage.isPending || !reconciliationUsageId || !reconciliationEvidence.trim() || (reconciliationStatus === "completed" && !Number(reconciliationCost))}>{reconcileAiUsage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record reconciliation</Button>{reconcileAiUsage.isError && <p role="alert" className="text-sm text-destructive">The reservation could not be reconciled. Confirm it is unresolved and the evidence URL contains no query, fragment, or credentials.</p>}</div></div>}
                {reconcileAiUsage.isSuccess && <p className="text-sm text-emerald-700">Reservation reconciled and the ledger has been recalculated.</p>}
              </div>}
            </SettingsCard>}
          </TabsContent>

          <TabsContent value="billing">
            <SettingsCard>
              <div className="mb-6 flex items-start gap-3"><CreditCard className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">Billing</h2><p className="mt-1 text-sm text-muted-foreground">Subscription status and provider-hosted payment controls.</p></div></div>
              {billing.isLoading ? <div className="h-36 animate-pulse rounded-xl bg-muted" /> : billing.isError ? <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Billing status could not be loaded.</p> : !billing.data?.configured ? <div className="rounded-2xl bg-muted p-5"><h3 className="font-semibold">Billing is not available in this environment</h3><p className="mt-2 text-sm text-muted-foreground">No payment will be requested. A verified billing provider and published legal terms are required before checkout can be enabled.</p></div> : billing.data.subscription ? <div className="space-y-5"><div className="rounded-2xl bg-muted p-5"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current plan</p><p className="mt-2 text-xl font-semibold">{titleCase(billing.data.subscription.planKey)}</p><p className="mt-1 text-sm text-muted-foreground">Status: {titleCase(billing.data.subscription.status)}{billing.data.subscription.cancelAtPeriodEnd ? " · Cancels at period end" : ""}</p>{billing.data.subscription.currentPeriodEnd && <p className="mt-1 text-sm text-muted-foreground">Current period ends {new Date(billing.data.subscription.currentPeriodEnd).toLocaleDateString()}.</p>}</div><Button onClick={() => openBillingPortal.mutate()} disabled={openBillingPortal.isPending}>{openBillingPortal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Manage billing</Button>{openBillingPortal.isError && <p className="text-sm text-destructive">The billing portal could not be opened.</p>}</div> : <div className="space-y-5"><div><Label htmlFor="billing-plan">Plan</Label><Select value={selectedPlan || undefined} onValueChange={setSelectedPlan}><SelectTrigger id="billing-plan" className="mt-2"><SelectValue placeholder="Choose a plan" /></SelectTrigger><SelectContent>{billing.data.availablePlans.map((plan) => <SelectItem key={plan.key} value={plan.key}>{titleCase(plan.key)}</SelectItem>)}</SelectContent></Select></div><div className="flex items-start gap-3 rounded-2xl bg-muted p-5 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" /><p>Checkout opens on the configured payment provider. EOS never collects raw card details.</p></div><Button onClick={() => startCheckout.mutate()} disabled={!selectedPlan || startCheckout.isPending}>{startCheckout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue to secure checkout</Button>{startCheckout.isError && <p className="text-sm text-destructive">Checkout could not start. Confirm required legal terms are accepted.</p>}</div>}
            </SettingsCard>
          </TabsContent>

          {platformCapabilities.data?.operationalReadiness && <TabsContent value="readiness"><ProductionReadinessControls /></TabsContent>}
        </Tabs>
      </main>
    </UniversalLayout>
  );
}
