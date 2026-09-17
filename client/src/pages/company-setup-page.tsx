import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Network, Plus, Sparkles, Trash2 } from "lucide-react";
import UniversalLayout from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { normalizeOptionalGoals } from "@/lib/company-setup";
import { companyMissionJourney, companyMissionStatus, parseAssumedBusinessNames, type CompanyMissionInput } from "@shared/company-mission";
import {
  companyBlueprintForBusinessModel,
  compileCompanyBlueprintStarters,
  compiledOperatingFormation,
  type CompanyBlueprint,
  type CompiledCompanyBlueprintStarter,
  type CompiledOperatingFormation,
} from "@shared/company-blueprints";

type Portfolio = { id: string | number; name: string; description?: string };
type Company = {
  id: string | number; portfolioId?: string | number | null; name: string; legalName?: string;
  assumedBusinessNames?: string[]; stage?: string; type?: string; offer?: string; targetCustomer?: string;
  goals?: string; assistantName?: string; founderProfile?: Record<string, unknown>;
};
type TeamRosterEntry = { id: string; name: string; email: string; sourceTitle: string; reportsTo: string; seatId: null };

const STAGES = [
  ["idea", "Idea"], ["pre-revenue", "Pre-revenue"], ["revenue", "Revenue"], ["scaling", "Scaling"], ["mature", "Mature"],
] as const;
const BUSINESS_MODELS = [
  ["services", "Services / studio"], ["saas", "Software"], ["product", "Product / commerce"], ["hybrid", "Hybrid"], ["other", "Other"],
] as const;
const FORMATIONS = [
  ["agent_first", "Agent-first", "Begin with role agents. Human hires can occupy the same seats later."],
  ["hybrid", "Hybrid team", "Map the people and agents already sharing the operating work."],
  ["existing_team", "Existing team", "Use EOS to model a company that already has people, systems, and data."],
] as const;

function profileString(profile: Record<string, unknown> | undefined, key: string) {
  return typeof profile?.[key] === "string" ? profile[key] as string : "";
}

function profileList(profile: Record<string, unknown> | undefined, key: string) {
  const value = profile?.[key];
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string")
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function createTeamRosterEntry(): TeamRosterEntry {
  return { id: crypto.randomUUID(), name: "", email: "", sourceTitle: "", reportsTo: "", seatId: null };
}

function stagedTeamRoster(profile: Record<string, unknown> | undefined): TeamRosterEntry[] {
  const raw = profile?.teamRosterPlan;
  const entries = raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).entries)
    ? (raw as Record<string, unknown>).entries as Array<Record<string, unknown>>
    : [];
  return entries.flatMap((entry) => {
    if (typeof entry.id !== "string") return [];
    return [{ id: entry.id, name: typeof entry.name === "string" ? entry.name : "", email: typeof entry.email === "string" ? entry.email : "", sourceTitle: typeof entry.sourceTitle === "string" ? entry.sourceTitle : "", reportsTo: typeof entry.reportsTo === "string" ? entry.reportsTo : "", seatId: null }];
  });
}

export default function CompanySetupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const existingCompanyId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("companyId") || "";
  }, []);
  const requestedPortfolioId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("portfolioId") || "";
  }, []);
  // A portfolio-selected entry point is the same journey, simply resumed at
  // the already-completed placement mission.
  const [currentStep, setCurrentStep] = useState(() => requestedPortfolioId ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(requestedPortfolioId);
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [assumedBusinessNames, setAssumedBusinessNames] = useState("");
  const [stage, setStage] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessModel, setBusinessModel] = useState("");
  const [offer, setOffer] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [founderVision, setFounderVision] = useState("");
  const [founderValues, setFounderValues] = useState("");
  const [decisionStyle, setDecisionStyle] = useState("");
  const [workingStyle, setWorkingStyle] = useState("");
  const [goals, setGoals] = useState("");
  const [formation, setFormation] = useState<CompanyMissionInput["formation"]>();
  const [teamSnapshot, setTeamSnapshot] = useState("");
  const [teamRoster, setTeamRoster] = useState<TeamRosterEntry[]>([]);
  const [existingSystems, setExistingSystems] = useState("");
  const [compiledCompanyId, setCompiledCompanyId] = useState("");
  const hydratedCompany = useRef(false);

  const portfoliosQuery = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: async () => (await apiRequest("GET", "/api/portfolios")).json(),
  });
  const existingCompanyQuery = useQuery<Company>({
    queryKey: ["company-mission", existingCompanyId],
    enabled: Boolean(existingCompanyId),
    queryFn: async () => (await apiRequest("GET", `/api/company/${existingCompanyId}`)).json(),
  });

  useEffect(() => {
    const company = existingCompanyQuery.data;
    if (!company || hydratedCompany.current) return;
    hydratedCompany.current = true;
    const profile = company.founderProfile;
    setSelectedPortfolioId(String(company.portfolioId || requestedPortfolioId || ""));
    setCompanyName(company.name || ""); setLegalName(company.legalName || company.name || "");
    setAssumedBusinessNames((company.assumedBusinessNames || []).join(", "));
    setStage(company.stage || ""); setIndustry(profileString(profile, "industry"));
    setBusinessModel(company.type || profileString(profile, "businessModel"));
    setOffer(company.offer || ""); setTargetCustomer(company.targetCustomer || "");
    setAssistantName(company.assistantName || ""); setFounderVision(profileString(profile, "vision"));
    setFounderValues(profileString(profile, "values")); setDecisionStyle(profileString(profile, "decisionStyle"));
    setWorkingStyle(profileString(profile, "workingStyle")); setGoals(company.goals || "");
    const currentFormation = profileString(profile, "operatingFormation");
    if (["agent_first", "hybrid", "existing_team"].includes(currentFormation)) setFormation(currentFormation as CompanyMissionInput["formation"]);
    setTeamSnapshot(profileString(profile, "teamSnapshot"));
    setTeamRoster(stagedTeamRoster(profile));
    setExistingSystems(profileList(profile, "existingSystems").join("\n"));
  }, [existingCompanyQuery.data, requestedPortfolioId]);

  const createPortfolio = useMutation<Portfolio, Error, { name: string; description?: string }>({
    mutationFn: async (body) => (await apiRequest("POST", "/api/portfolios", body)).json(),
    onSuccess: (portfolio) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setSelectedPortfolioId(String(portfolio.id)); setShowCreatePortfolio(false); setPortfolioName(""); setPortfolioDescription("");
    },
  });

  const missionInput: CompanyMissionInput = {
    portfolioId: selectedPortfolioId, companyName, legalName, assumedBusinessNames: parseAssumedBusinessNames(assumedBusinessNames),
    stage, industry, businessModel, offer, targetCustomer, assistantName, founderVision, founderValues, decisionStyle, workingStyle, goals, formation, teamSnapshot,
    existingSystems: existingSystems.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
  };
  const missionStatus = companyMissionStatus(missionInput);
  const activeMission = companyMissionJourney[currentStep];
  const selectedPortfolio = (portfoliosQuery.data || []).find((portfolio) => String(portfolio.id) === selectedPortfolioId);
  // The preview uses the exact deterministic blueprint compiler that runs
  // after the shared Company Mission Journey is saved. It exposes what the
  // founder's inputs will change without creating a second onboarding path.
  const selectedBlueprint = useMemo(
    () => businessModel ? companyBlueprintForBusinessModel(businessModel) : null,
    [businessModel],
  );
  const previewStarters = useMemo(
    () => selectedBlueprint
      ? compileCompanyBlueprintStarters(selectedBlueprint, { offer, targetCustomer, goals })
      : [],
    [selectedBlueprint, offer, targetCustomer, goals],
  );
  const previewFormation = useMemo(
    () => compiledOperatingFormation({ formation, teamSnapshot }),
    [formation, teamSnapshot],
  );

  const validateCurrentMission = useCallback(() => {
    const next: Record<string, string> = {};
    if (currentStep === 0 && !selectedPortfolioId) next.portfolio = "Choose the portfolio that will hold this company.";
    if (currentStep === 1 && !companyName.trim()) next.companyName = "The operating company needs a name.";
    if (currentStep === 2) {
      if (!stage) next.stage = "Select the current operating stage.";
      if (!businessModel) next.businessModel = "Select the business model.";
      if (!offer.trim()) next.offer = "Describe the initial offer or value stream.";
      if (!targetCustomer.trim()) next.targetCustomer = "Name the first customer or buyer.";
    }
    if (currentStep === 3) {
      if (!assistantName.trim()) next.assistantName = "Name the Executive Assistant.";
      if (!founderVision.trim()) next.founderVision = "Give the EA a vision it must protect.";
    }
    if (currentStep === 4 && !goals.trim()) next.goals = "State at least one near-term outcome.";
    if (currentStep === 5) {
      if (!formation) next.formation = "Choose how this company operates today.";
      const people = teamRoster.filter((entry) => entry.name.trim() || entry.email.trim());
      if (formation && formation !== "agent_first" && teamSnapshot.trim().length < 10 && people.length === 0)
        next.teamSnapshot = "Describe the current team or add at least one person below so EOS can start with the real operating shape.";
      if (teamRoster.length > 2_000) next.teamRoster = "EOS supports up to 2,000 staged people in one company plan.";
      teamRoster.forEach((entry, index) => {
        if ((entry.name.trim() || entry.email.trim()) && entry.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email.trim())) next[`teamRoster-${index}`] = "Use a valid work email or leave this field blank.";
      });
    }
    setErrors(next); return Object.keys(next).length === 0;
  }, [currentStep, selectedPortfolioId, companyName, stage, businessModel, offer, targetCustomer, assistantName, founderVision, goals, formation, teamSnapshot, teamRoster]);

  const compileBlueprint = useMutation<{ manifest: { id: string } }, Error, string>({
    mutationFn: async (companyId) => {
      const root = `/api/eos/companies/${encodeURIComponent(companyId)}`;
      await (await apiRequest("POST", `${root}/company-blueprint/instantiate`, {})).json();
      const manifest = await (await apiRequest("POST", `${root}/compiler/from-company-mission`, {})).json() as { id: string };
      await (await apiRequest("POST", `${root}/manifests/${encodeURIComponent(manifest.id)}/blueprint-missions/materialize`, {})).json();
      return { manifest };
    },
    onSuccess: async ({ manifest }, companyId) => {
      await queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setLocation(`/company/${companyId}/org-studio?from=mission&compiled=1&manifest=${encodeURIComponent(manifest.id)}`);
    },
  });

  const saveCompany = useMutation<Company, Error, Record<string, unknown>>({
    mutationFn: async (body) => {
      if (!existingCompanyId)
        return (await apiRequest("POST", `/api/portfolios/${selectedPortfolioId}/companies`, body)).json();
      const updated = await (await apiRequest("PATCH", `/api/company/${existingCompanyId}`, body)).json() as Company;
      if (String(existingCompanyQuery.data?.portfolioId || "") !== selectedPortfolioId)
        return (await apiRequest("POST", `/api/portfolios/${selectedPortfolioId}/companies`, { companyId: Number(existingCompanyId) })).json();
      return updated;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["company-mission", existingCompanyId] });
      // Completing the shared company intake is an actual compilation event.
      // The business-model and formation variables select the native role
      // template, then materialize only the missing downstream seats, agents,
      // reporting edges, operating packs, authority baselines, and tool
      // entitlements.  It is deliberately idempotent for an established
      // company resuming this same journey.
      const companyId = String(company.id);
      setCompiledCompanyId(companyId);
      compileBlueprint.mutate(companyId);
    },
  });

  const advance = () => { if (validateCurrentMission()) setCurrentStep((step) => Math.min(step + 1, companyMissionJourney.length - 1)); };
  const completeJourney = () => {
    if (!validateCurrentMission()) return;
    const rosterEntries = teamRoster.map((entry) => ({ ...entry, name: entry.name.trim(), email: entry.email.trim().toLowerCase(), sourceTitle: entry.sourceTitle.trim(), reportsTo: entry.reportsTo.trim(), seatId: null })).filter((entry) => entry.name || entry.email);
    const founderProfile = { vision: founderVision.trim(), values: founderValues.trim(), decisionStyle: decisionStyle.trim(), workingStyle: workingStyle.trim(), industry: industry.trim(), businessModel, operatingFormation: formation, teamSnapshot: teamSnapshot.trim(), existingSystems: existingSystems.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), ...(formation !== "agent_first" ? { teamRosterPlan: { version: "team-roster-plan-v1", entries: rosterEntries } } : {}), setupJourneyVersion: "company-mission-journey-v1" };
    saveCompany.mutate({
      name: companyName.trim(), legalName: legalName.trim() || companyName.trim(), assumedBusinessNames: parseAssumedBusinessNames(assumedBusinessNames),
      stage, type: businessModel, businessModel, offer: offer.trim(), targetCustomer: targetCustomer.trim(), goals: normalizeOptionalGoals(goals),
      assistantName: assistantName.trim(), founderProfile,
    });
  };

  return (
    <UniversalLayout title={existingCompanyId ? "Company Mission Journey" : "Create company"} portfolioName={selectedPortfolio?.name} portfolioHref={selectedPortfolio ? `/portfolios/${selectedPortfolio.id}` : "/portfolios"} leftRailItems={[]} floatingPanel={false}>
      <section className="mx-auto grid w-full max-w-6xl gap-8 pb-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:pt-2">
          <Link href={selectedPortfolio ? `/portfolios/${selectedPortfolio.id}` : "/portfolios"} className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"><ArrowLeft className="mr-1.5 h-4 w-4" />Leave journey</Link>
          <p className="mt-8 eos-label">Company Mission Journey</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">One company model. One path.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">New and established companies first define their operating reality. Existing systems are reconciled afterward—not used as the company definition.</p>
          <ol className="mt-7 space-y-2" aria-label="Company Mission Journey progress">
            {missionStatus.map((mission, index) => (
              <li key={mission.key}><button type="button" aria-label={`Step ${index + 1} of ${companyMissionJourney.length}: ${mission.title}`} onClick={() => index <= currentStep || mission.complete ? setCurrentStep(index) : undefined} disabled={index > currentStep && !mission.complete} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${currentStep === index ? "bg-primary/10 text-foreground" : mission.complete ? "text-foreground hover:bg-muted" : "cursor-not-allowed text-muted-foreground"}`}>
                {mission.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0" />}<span><span className="block text-sm font-medium">{mission.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{mission.unlocks}</span></span>
              </button></li>
            ))}
          </ol>
        </aside>

        <div className="min-w-0 rounded-2xl border bg-white p-5 shadow-[0_12px_40px_rgba(74,42,143,0.08)] sm:p-8">
          {existingCompanyQuery.isLoading && <p className="text-sm text-muted-foreground">Loading the current company reality…</p>}
          {existingCompanyQuery.isError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">This company could not be loaded. Confirm you are the company owner, then retry.</p>}
          <div className="border-b pb-6"><p className="eos-label">Mission {currentStep + 1} of {companyMissionJourney.length}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{activeMission.title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{activeMission.purpose}</p></div>

          <div className="min-h-[360px] py-7">
            {currentStep === 2 && selectedBlueprint && <CompanyBlueprintPreview blueprint={selectedBlueprint} starters={previewStarters} formation={formation ? previewFormation : undefined} compact />}
            {currentStep === 5 && selectedBlueprint && <CompanyBlueprintPreview blueprint={selectedBlueprint} starters={previewStarters} formation={previewFormation} compact />}
            {currentStep === 0 && <div className="space-y-5"><div><h3 className="text-lg font-semibold">Choose the portfolio</h3><p className="mt-1 text-sm text-muted-foreground">A portfolio is the parent view for one or more operating companies.</p></div>{(portfoliosQuery.data || []).map((portfolio) => <button type="button" key={portfolio.id} onClick={() => setSelectedPortfolioId(String(portfolio.id))} className={`w-full rounded-xl border p-4 text-left ${selectedPortfolioId === String(portfolio.id) ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40"}`}><p className="font-medium">{portfolio.name}</p>{portfolio.description && <p className="mt-1 text-sm text-muted-foreground">{portfolio.description}</p>}</button>)}{!showCreatePortfolio ? <Button variant="outline" onClick={() => setShowCreatePortfolio(true)}>Create portfolio</Button> : <div className="space-y-3 rounded-xl bg-muted/40 p-4"><Input value={portfolioName} onChange={(event) => setPortfolioName(event.target.value)} placeholder="Portfolio name"/><Textarea value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} placeholder="Optional portfolio description"/><div className="flex gap-2"><Button disabled={!portfolioName.trim() || createPortfolio.isPending} onClick={() => createPortfolio.mutate({ name: portfolioName.trim(), description: portfolioDescription.trim() || undefined })}>{createPortfolio.isPending ? "Creating…" : "Create portfolio"}</Button><Button variant="ghost" onClick={() => setShowCreatePortfolio(false)}>Cancel</Button></div></div>}{errors.portfolio && <p className="text-sm text-destructive">{errors.portfolio}</p>}</div>}
            {currentStep === 1 && <div className="grid max-w-2xl gap-5"><Field label="Operating company name" error={errors.companyName}><Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Empyrean Creative" autoFocus /></Field><Field label="Legal entity name" hint="If different from the operating name"><Input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="e.g. Empyrean Creative LLC" /></Field><Field label="Assumed business names" hint="Optional. Separate DBA or public-facing names with commas."><Input value={assumedBusinessNames} onChange={(event) => setAssumedBusinessNames(event.target.value)} placeholder="e.g. Empyrean Studios" /></Field></div>}
            {currentStep === 2 && <div className="grid max-w-3xl gap-6"><Field label="Operating stage" error={errors.stage}><RadioGroup value={stage} onValueChange={setStage} className="grid gap-2 sm:grid-cols-2">{STAGES.map(([value, label]) => <Choice key={value} value={value} label={label} selected={stage === value} />)}</RadioGroup></Field><Field label="Business model" error={errors.businessModel}><RadioGroup value={businessModel} onValueChange={setBusinessModel} className="grid gap-2 sm:grid-cols-2">{BUSINESS_MODELS.map(([value, label]) => <Choice key={value} value={value} label={label} selected={businessModel === value} />)}</RadioGroup></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Industry" hint="Optional but useful for relevant templates"><Input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Creative services" /></Field><Field label="Initial offer or value stream" error={errors.offer}><Input value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Revenue recovery service" /></Field></div><Field label="Primary customer or buyer" error={errors.targetCustomer}><Textarea value={targetCustomer} onChange={(event) => setTargetCustomer(event.target.value)} placeholder="Who does this company serve first?" /></Field></div>}
            {currentStep === 3 && <div className="grid max-w-3xl gap-5"><div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><Sparkles className="mb-2 h-5 w-5 text-primary"/><p className="font-medium">The EA is a founder-facing coordination role, not a hardcoded product character.</p><p className="mt-1 text-muted-foreground">It coordinates advisors and company agents within the authority you establish.</p></div><Field label="Executive Assistant name" error={errors.assistantName}><Input value={assistantName} onChange={(event) => setAssistantName(event.target.value)} placeholder="Choose the name you want to use" /></Field><Field label="Founder vision" error={errors.founderVision}><Textarea value={founderVision} onChange={(event) => setFounderVision(event.target.value)} placeholder="What are you building and what must remain true as it grows?" className="min-h-28" /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Values and standards"><Textarea value={founderValues} onChange={(event) => setFounderValues(event.target.value)} placeholder="Principles the company must protect" /></Field><Field label="Decision style"><Textarea value={decisionStyle} onChange={(event) => setDecisionStyle(event.target.value)} placeholder="How recommendations should be prepared" /></Field></div><Field label="Working style"><Textarea value={workingStyle} onChange={(event) => setWorkingStyle(event.target.value)} placeholder="Cadence, communication preferences, and watchouts" /></Field></div>}
            {currentStep === 4 && <div className="max-w-3xl"><Field label="Near-term outcomes" hint="State what must become true next. EOS will turn these into objectives, measures, and governed work." error={errors.goals}><Textarea value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="e.g. Validate the Revenue Recovery offer, close three retained clients, and establish a reliable delivery loop." className="min-h-44" /></Field></div>}
            {currentStep === 5 && <div className="max-w-3xl space-y-4"><p className="text-sm text-muted-foreground">This is not permanent. It sets the initial shape of the company graph. People can be added later into existing seats, where the role agent becomes their assistant.</p><RadioGroup value={formation} onValueChange={(value) => setFormation(value as CompanyMissionInput["formation"])} className="space-y-3">{FORMATIONS.map(([value, title, description]) => <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border p-5 ${formation === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40"}`}><RadioGroupItem value={value} /><span><span className="font-medium">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></span></label>)}</RadioGroup>{formation === "agent_first" && <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">EOS will start with role agents. As people join, assign them to the existing seats in Org Studio; their role agent then shifts into assistant mode.</div>}{formation && formation !== "agent_first" && <><Field label="Current team snapshot" hint="Describe the functions, key roles, reporting lines, and important vacancies. This is your starting operating reality; map individual people to seats in Org Studio after the blueprint is compiled." error={errors.teamSnapshot}><Textarea value={teamSnapshot} onChange={(event) => setTeamSnapshot(event.target.value)} placeholder="Example: Founder/CEO; one account director reporting to the founder; two delivery specialists; freelance designer; finance handled externally; no dedicated growth lead yet." className="min-h-36" /></Field><section className="rounded-xl border bg-muted/30 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">Stage your existing team</p><p className="mt-1 text-sm text-muted-foreground">Add people now so the same setup journey carries your real organization into Org Studio. This is planning data only: EOS does not create accounts, send invitations, assign seats, or grant access here.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setTeamRoster((current) => [...current, createTeamRosterEntry()])}><Plus className="mr-2 h-4 w-4" />Add person</Button></div>{teamRoster.length > 0 && <div className="mt-4 space-y-3">{teamRoster.map((entry, index) => <div key={entry.id} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-2"><Input aria-label={`Team member ${index + 1} name`} value={entry.name} onChange={(event) => setTeamRoster((current) => current.map((item) => item.id === entry.id ? { ...item, name: event.target.value } : item))} placeholder="Full name"/><Input aria-label={`Team member ${index + 1} work email`} value={entry.email} onChange={(event) => setTeamRoster((current) => current.map((item) => item.id === entry.id ? { ...item, email: event.target.value } : item))} placeholder="Work email (optional)"/><Input aria-label={`Team member ${index + 1} current role`} value={entry.sourceTitle} onChange={(event) => setTeamRoster((current) => current.map((item) => item.id === entry.id ? { ...item, sourceTitle: event.target.value } : item))} placeholder="Current role"/><div className="flex gap-2"><Input aria-label={`Team member ${index + 1} reports to`} value={entry.reportsTo} onChange={(event) => setTeamRoster((current) => current.map((item) => item.id === entry.id ? { ...item, reportsTo: event.target.value } : item))} placeholder="Reports to"/><Button type="button" variant="ghost" size="icon" aria-label={`Remove team member ${index + 1}`} onClick={() => setTeamRoster((current) => current.filter((item) => item.id !== entry.id))}><Trash2 className="h-4 w-4" /></Button></div>{errors[`teamRoster-${index}`] && <p className="sm:col-span-2 text-sm text-destructive">{errors[`teamRoster-${index}`]}</p>}</div>)}</div>}{errors.teamRoster && <p className="mt-3 text-sm text-destructive">{errors.teamRoster}</p>}<p className="mt-3 text-xs text-muted-foreground">After EOS compiles the role graph, Org Studio suggests each person&apos;s stable seat. You review every mapping, then separately decide whether to invite them.</p></section></>}{errors.formation && <p className="text-sm text-destructive">{errors.formation}</p>}</div>}
            {currentStep === 6 && <div className="max-w-3xl space-y-5"><div className="rounded-xl border border-primary/20 bg-primary/5 p-5"><Network className="mb-3 h-6 w-6 text-primary"/><h3 className="font-semibold">Native first. Integrations when useful.</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">EOS will create the company’s native operating foundation now. Connect a CRM, accounting system, document service, or inbox later only to reconcile existing data or use a specialist external rail. No integration is required to use the company graph, roles, work, documents, or native instruments.</p></div><Field label="Existing systems or record sources" hint="Optional. Name tools or data sources that already hold company records, one per line. This creates an inventory for a later governed reconciliation plan; it does not connect, import, or grant any provider access."><Textarea value={existingSystems} onChange={(event) => setExistingSystems(event.target.value)} placeholder="QuickBooks\nGoogle Workspace\nLegacy CRM" className="min-h-28" /></Field><div className="rounded-xl bg-muted/50 p-5"><p className="font-medium">What happens next</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li>• Compile the native organization, manifest, and governed setup work from this one company model.</li><li>• Open Org Studio and shape the real reporting graph, role agents, responsibilities, and tools.</li><li>• Use Systems only when an external provider adds value or holds historical data.</li></ul></div></div>}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><Button variant="ghost" disabled={currentStep === 0 || compileBlueprint.isPending} onClick={() => { setErrors({}); setCurrentStep((step) => Math.max(0, step - 1)); }}>Back</Button>{currentStep < companyMissionJourney.length - 1 ? <Button onClick={advance}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button disabled={saveCompany.isPending || compileBlueprint.isPending} onClick={completeJourney}>{saveCompany.isPending ? "Saving company…" : compileBlueprint.isPending ? "Compiling business blueprint…" : existingCompanyId ? "Save and compile blueprint" : "Create company and compile blueprint"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
          {saveCompany.isError && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">The mission could not be saved. Review the company details and try again.</p>}
          {compileBlueprint.isError && compiledCompanyId && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><p>The company was saved, but EOS could not yet compile its native operating blueprint. No provider connection or external data was changed.</p><Button className="mt-3" variant="outline" disabled={compileBlueprint.isPending} onClick={() => compileBlueprint.mutate(compiledCompanyId)}>Retry blueprint compilation</Button></div>}
        </div>
      </section>
    </UniversalLayout>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  // Labels must be available to assistive technology as well as visible in the
  // mission UI. Radix controls do not automatically inherit surrounding text.
  const labeledChild = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        "aria-label": (children.props as any)["aria-label"] || label,
      })
    : children;
  return <div><Label className="eos-label">{label}</Label>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}<div className="mt-2">{labeledChild}</div>{error && <p className="mt-2 text-sm text-destructive">{error}</p>}</div>;
}

function Choice({ value, label, selected }: { value: string; label: string; selected: boolean }) {
  return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40"}`}><RadioGroupItem value={value} /><span>{label}</span></label>;
}

function CompanyBlueprintPreview({
  blueprint,
  starters,
  formation,
  compact = false,
}: {
  blueprint: CompanyBlueprint;
  starters: readonly CompiledCompanyBlueprintStarter[];
  formation?: CompiledOperatingFormation;
  compact?: boolean;
}) {
  const tools = Array.from(new Set([
    ...blueprint.roles.flatMap((role) => role.tools),
    ...starters.flatMap((starter) => starter.tools),
  ]));

  return (
    <section aria-label="Live business blueprint preview" className={`rounded-xl border border-primary/25 bg-primary/[0.035] p-5 ${compact ? "mb-6" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eos-label text-primary">Live business blueprint</p>
          <h3 className="mt-1 text-lg font-semibold">{blueprint.title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blueprint.description}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-medium text-primary shadow-sm">Native-first</span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Your business model selects the institutional seats and native tool baseline. Your offer, customer, and outcome fill those templates with this company&apos;s context; they do not create a provider connection or grant authority.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white/80 p-4">
          <p className="text-sm font-medium">Initial accountable seats</p>
          <ul className="mt-3 space-y-2 text-sm">
            {blueprint.roles.map((role) => (
              <li key={role.key} className="flex items-start justify-between gap-3">
                <span><span className="font-medium">{role.title}</span><span className="block text-xs text-muted-foreground">{role.department} · {role.agentName}</span></span>
                <span className="text-right text-xs text-muted-foreground">{role.tools.length} tools</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-white/80 p-4">
          <p className="text-sm font-medium">Native tool baseline</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tools.map((tool) => <span key={tool} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{tool}</span>)}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">These are the native capabilities EOS prepares for the relevant seats. An external system may later reconcile into the same operating surface, but is not required.</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-white/80 p-4">
        <p className="text-sm font-medium">First compiled missions</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {starters.map((starter) => (
            <article key={starter.key} className="rounded-lg bg-muted/55 p-3">
              <p className="text-sm font-medium">{starter.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{starter.statement}</p>
              <p className="mt-2 text-xs font-medium text-primary">Owner seat: {blueprint.roles.find((role) => role.key === starter.ownerRoleKey)?.title || starter.ownerRoleKey}</p>
            </article>
          ))}
        </div>
      </div>

      {formation ? <div className="mt-4 rounded-lg border border-dashed bg-white/60 p-4">
        <p className="text-sm font-medium">{formation.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{formation.summary} {formation.humanAssignmentRule}</p>
      </div> : <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Choose the operating formation in the next mission to preview how these same seats begin as agents, map an existing team, or become assistants to assigned people.</p>}
    </section>
  );
}
