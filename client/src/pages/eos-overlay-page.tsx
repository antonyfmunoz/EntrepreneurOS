import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  Activity,
  BadgeCheck,
  Blocks,
  Bot,
  BriefcaseBusiness,
  ClipboardCheck,
  Check,
  Command,
  ExternalLink,
  FileCheck2,
  Gauge,
  Home,
  Landmark,
  BookOpen,
  Map,
  MessagesSquare,
  Network,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Unplug,
  Workflow,
  X,
} from "lucide-react";
import { AgentChatStub, type ChatMessage } from "@/components/agent-chat-stub";
import UniversalLayout from "@/components/layout/universal-layout";
import FloatingAIPanel from "@/components/layout/floating-ai-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type JsonRecord = Record<string, any>;

async function requestJson<T>(method: "GET" | "POST" | "PATCH" | "PUT", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

function StateBadge({ state }: { state: string }) {
  const good = ["active", "ready", "in_progress", "completed", "connected", "approved", "healthy"].includes(state);
  const warning = ["draft", "awaiting_approval", "pending", "available", "reference_only", "degraded"].includes(state);
  return <Badge variant={good ? "default" : warning ? "secondary" : "outline"}>{state.replaceAll("_", " ")}</Badge>;
}

function mutationFailure(action: string, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      if (typeof parsed?.message === "string") return `${action} failed: ${parsed.message}`;
    } catch {}
  }
  return `${action} failed. Retry the action or refresh the workspace.`;
}

export default function EosOverlayPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const root = `/api/eos/companies/${companyId}`;
  const [activeTab, setActiveTab] = useState("home");
  const [packetTitle, setPacketTitle] = useState("");
  const [packetObjective, setPacketObjective] = useState("");
  const [packetApproval, setPacketApproval] = useState(true);
  const [evidenceTitle, setEvidenceTitle] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [eaMessages, setEaMessages] = useState<ChatMessage[]>([]);
  const [isEditingAssistantName, setIsEditingAssistantName] = useState(false);
  const [assistantNameDraft, setAssistantNameDraft] = useState("");
  const [providerPacketId, setProviderPacketId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [seatTitle, setSeatTitle] = useState("");
  const [seatKind, setSeatKind] = useState("individual_contributor");
  const [seatAgentName, setSeatAgentName] = useState("");
  const [seatSupervisorId, setSeatSupervisorId] = useState("");
  const [membershipEmail, setMembershipEmail] = useState("");
  const [membershipSeatId, setMembershipSeatId] = useState("");
  const [monthlyAiBudget, setMonthlyAiBudget] = useState("25");
  const [perRequestAiBudget, setPerRequestAiBudget] = useState("1");
  const [aiBudgetEnabled, setAiBudgetEnabled] = useState(true);
  useEffect(() => {
    const syncHash = () => {
      const requested = window.location.hash.slice(1);
      const aliases: Record<string, string> = { brief: "home", missions: "operations", approvals: "operations", evidence: "operations" };
      const tab = aliases[requested] ?? requested;
      if (["home", "command", "organization", "my-role", "commercial", "operations", "work-room", "review", "academy", "portfolio-map", "capital", "intelligence", "systems"].includes(tab)) setActiveTab(tab);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const contextQuery = useQuery<JsonRecord>({
    queryKey: [root, "context"],
    queryFn: () => requestJson("GET", `${root}/context`),
    enabled: Boolean(companyId),
  });
  const briefQuery = useQuery<JsonRecord>({ queryKey: [root, "brief"], queryFn: () => requestJson("GET", `${root}/brief`), enabled: Boolean(companyId) });
  const packetsQuery = useQuery<JsonRecord[]>({ queryKey: [root, "work-packets"], queryFn: () => requestJson("GET", `${root}/work-packets`), enabled: Boolean(companyId) });
  const approvalsQuery = useQuery<JsonRecord[]>({ queryKey: [root, "approvals"], queryFn: () => requestJson("GET", `${root}/approvals`), enabled: Boolean(companyId) });
  const evidenceQuery = useQuery<JsonRecord[]>({ queryKey: [root, "evidence"], queryFn: () => requestJson("GET", `${root}/evidence`), enabled: Boolean(companyId) });
  const integrationsQuery = useQuery<JsonRecord[]>({ queryKey: [root, "integrations"], queryFn: () => requestJson("GET", `${root}/integrations`), enabled: Boolean(companyId) });
  const advisorVisible = ["founder", "portfolio_executive", "company_ceo"].includes(contextQuery.data?.principalContext?.role);
  const councilQuery = useQuery<JsonRecord>({ queryKey: [root, "advisor-council"], queryFn: () => requestJson("GET", `${root}/advisor-council`), enabled: Boolean(companyId && advisorVisible) });
  const consultationsQuery = useQuery<JsonRecord[]>({ queryKey: [root, "advisor-consultations"], queryFn: () => requestJson("GET", `${root}/advisor-council/consultations`), enabled: Boolean(companyId && contextQuery.data?.principalContext?.role === "founder") });
  const organizationQuery = useQuery<JsonRecord>({ queryKey: [root, "organization-runtime"], queryFn: () => requestJson("GET", `${root}/organization-runtime`), enabled: Boolean(companyId) });
  const communicationQuery = useQuery<JsonRecord>({ queryKey: [root, "executive-assistant", "messages"], queryFn: () => requestJson("GET", `${root}/executive-assistant/messages`), enabled: Boolean(companyId) });
  const providerExecutionsQuery = useQuery<JsonRecord[]>({ queryKey: [root, "provider-executions"], queryFn: () => requestJson("GET", `${root}/provider-executions`), enabled: Boolean(companyId) });
  const auditVisible = ["founder", "portfolio_executive", "company_ceo"].includes(contextQuery.data?.principalContext?.role);
  const auditQuery = useQuery<JsonRecord[]>({ queryKey: [root, "audit"], queryFn: () => requestJson("GET", `${root}/audit`), enabled: Boolean(companyId && auditVisible) });
  const aiBudgetQuery = useQuery<JsonRecord>({ queryKey: [root, "ai-budget"], queryFn: () => requestJson("GET", `${root}/ai-budget`), enabled: Boolean(companyId && contextQuery.data?.principalContext?.role === "founder") });
  const googleConnected = Boolean(integrationsQuery.data?.find((item) => item.id === "google_workspace")?.connected);
  const notionConnected = Boolean(integrationsQuery.data?.find((item) => item.id === "notion")?.connected);
  const googleContextQuery = useQuery<JsonRecord>({ queryKey: [root, "google-context"], queryFn: () => requestJson("GET", `${root}/integrations/google/context`), enabled: Boolean(companyId && googleConnected && ["home", "work-room", "systems"].includes(activeTab)) });
  const notionContextQuery = useQuery<JsonRecord>({ queryKey: [root, "notion-context"], queryFn: () => requestJson("GET", `${root}/integrations/notion/context`), enabled: Boolean(companyId && notionConnected && (contextQuery.data?.principalContext?.allowedSurfaces || []).includes("systems") && ["home", "organization", "academy", "systems"].includes(activeTab)) });

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [root] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const showMutationError = (action: string, error: unknown) => toast({
    title: `${action} failed`,
    description: mutationFailure(action, error),
    variant: "destructive",
  });

  const company = contextQuery.data?.company;
  const manifest = contextQuery.data?.manifest;
  const packets = packetsQuery.data || [];
  const approvals = approvalsQuery.data || [];
  const evidence = evidenceQuery.data || [];
  const activePackets = packets.filter((packet) => !["completed", "cancelled"].includes(packet.status));
  const principalContext = contextQuery.data?.principalContext;
  const assistantName = principalContext?.communicationAgent || company?.assistantName || "Assistant";
  const isFounder = principalContext?.role === "founder";
  const allowedSurfaces = new Set<string>(principalContext?.allowedSurfaces || []);

  useEffect(() => {
    if (!principalContext || allowedSurfaces.has(activeTab)) return;
    setActiveTab("home");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  }, [activeTab, principalContext?.role]);

  useEffect(() => {
    const persisted = communicationQuery.data?.messages || [];
    setEaMessages(persisted.map((message: JsonRecord) => ({ id: message.id, role: message.senderType === "human" ? "user" : "assistant", content: message.content, timestamp: new Date(message.createdAt) })));
  }, [communicationQuery.data]);

  useEffect(() => {
    if (!isEditingAssistantName) setAssistantNameDraft(assistantName);
  }, [assistantName, isEditingAssistantName]);

  useEffect(() => {
    if (!aiBudgetQuery.data?.configured) return;
    setMonthlyAiBudget(String((aiBudgetQuery.data.monthlyLimitMicros || 0) / 1_000_000));
    setPerRequestAiBudget(String((aiBudgetQuery.data.perRequestLimitMicros || 0) / 1_000_000));
    setAiBudgetEnabled(Boolean(aiBudgetQuery.data.enabled));
  }, [aiBudgetQuery.data]);

  const compilerMutation = useMutation({
    mutationFn: async () => requestJson<JsonRecord>("POST", `${root}/compiler/drafts`, {
      purpose: company?.goals || `Build a durable, operator-ready organization for ${company?.name || "this company"}.`,
      stage: company?.stage || "MVP",
      offer: company?.offer || "Define and validate the primary offer",
      targetCustomer: company?.targetCustomer || "Define the initial ideal customer",
      goals: String(company?.goals || "Activate the first repeatable customer-value loop").split("\n").map((item) => item.trim()).filter(Boolean),
      enabledModules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      ownerSeat: { title: "Founder / Owner", authority: "owner" },
      operatingCadence: "weekly",
      founderProfile: {
        vision: company?.founderProfile?.vision || "",
        values: company?.founderProfile?.values || "",
        decisionStyle: company?.founderProfile?.decisionStyle || "",
        workingStyle: company?.founderProfile?.workingStyle || "",
      },
      sourceAssertions: [{ label: "Company setup", value: company?.goals || "Initial owner-defined company intent", sourceType: "user_assertion" }],
      assumptions: [],
      unknowns: [],
      packageSelections: [{ id: "eos-overlay-core", version: "1.0", rationale: "Required operating foundation" }],
      provisioningChecklist: [{ id: "owner-context", label: "Owner identity and organization verified", required: true, complete: true }],
      verificationChecks: [{ id: "runtime-ready", label: "EOS runtime readiness", status: "passed", evidence: "/api/ready" }],
    }),
    onSuccess: async (draft) => {
      await refresh();
      toast({ title: `Manifest v${draft.version} compiled`, description: "Advance it through diagnostic, proposal, review, provisioning, and verification before activation." });
    },
    onError: (error) => showMutationError("Manifest compilation", error),
  });

  const manifestTransitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => requestJson("POST", `${root}/manifests/${id}/transition`, { status }),
    onSuccess: async (_, variables) => { await refresh(); toast({ title: `Manifest moved to ${variables.status.replaceAll("_", " ")}` }); },
    onError: (error) => showMutationError("Manifest transition", error),
  });

  const activateMutation = useMutation({
    mutationFn: (manifestId: string) => requestJson("POST", `${root}/manifests/${manifestId}/activate`, {}),
    onSuccess: async () => { await refresh(); toast({ title: "Organization manifest activated" }); },
    onError: (error) => showMutationError("Manifest activation", error),
  });

  const packetMutation = useMutation({
    mutationFn: () => requestJson("POST", `${root}/work-packets`, {
      title: packetTitle,
      objective: packetObjective,
      priority: "medium",
      requiresApproval: packetApproval,
      toolPack: [],
      evidenceRequirements: ["A reviewable artifact or observed outcome"],
      source: "manual",
    }),
    onSuccess: async () => {
      setPacketTitle(""); setPacketObjective(""); await refresh();
      toast({ title: "Work Packet created", description: packetApproval ? "It is waiting for local approval." : "It is ready to start." });
    },
    onError: (error) => showMutationError("Work Packet creation", error),
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => requestJson("POST", `${root}/approvals/${id}/decide`, { decision }),
    onSuccess: async (_, variables) => { await refresh(); toast({ title: variables.decision === "approved" ? "Work approved" : "Work rejected" }); },
    onError: (error) => showMutationError("Approval decision", error),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => requestJson("POST", `${root}/work-packets/${id}/transition`, { status }),
    onSuccess: async (_, variables) => { await refresh(); toast({ title: `Work moved to ${variables.status.replaceAll("_", " ")}` }); },
    onError: (error) => showMutationError("Work transition", error),
  });

  const evidenceMutation = useMutation({
    mutationFn: ({ packetId, title }: { packetId: string; title: string }) => requestJson("POST", `${root}/evidence`, {
      workPacketId: packetId,
      evidenceType: "artifact",
      title,
      details: { capturedFrom: "eos_overlay" },
    }),
    onSuccess: async (_, variables) => { setEvidenceTitle((current) => ({ ...current, [variables.packetId]: "" })); await refresh(); },
    onError: (error) => showMutationError("Evidence recording", error),
  });

  const googleConnectMutation = useMutation({
    mutationFn: () => requestJson<{ authUrl: string }>("GET", `/api/integrations/gmail/auth?returnTo=${encodeURIComponent(`/company/${companyId}#systems`)}`),
    onSuccess: ({ authUrl }) => window.location.assign(authUrl),
    onError: (error) => showMutationError("Google Workspace connection", error),
  });

  const googleDisconnectMutation = useMutation({
    mutationFn: () => requestJson("POST", "/api/integrations/gmail/disconnect", {}),
    onSuccess: async () => {
      await integrationsQuery.refetch();
      toast({ title: "Google Workspace disconnected", description: "The encrypted OAuth credential was removed from EntrepreneurOS." });
    },
    onError: (error) => showMutationError("Google Workspace disconnection", error),
  });

  const verifyIntegrationMutation = useMutation({
    mutationFn: async (name: string) => {
      const result = await integrationsQuery.refetch();
      const integration = result.data?.find((item) => item.name === name);
      if (!integration?.connected) throw new Error(`${name} did not pass its provider health check.`);
      return integration;
    },
    onSuccess: (integration) => toast({
      title: `${integration.name} verified`,
      description: "EntrepreneurOS reached the external provider using its configured adapter.",
    }),
    onError: (error, name) => showMutationError(`${name} verification`, error),
  });

  const eaMessageMutation = useMutation({
    mutationFn: async (content: string) => requestJson<{ response: string }>("POST", `${root}/executive-assistant/messages`, { content }),
    onSuccess: async ({ response }) => { setEaMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: response, timestamp: new Date() }]); await communicationQuery.refetch(); },
    onError: (error) => showMutationError(`${assistantName} message`, error),
  });

  const providerExecutionMutation = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/work-packets/${providerPacketId}/provider-executions`, { provider: "gmail", operation: "gmail.send_with_local_approval", to: emailTo, subject: emailSubject, body: emailBody }),
    onSuccess: async () => { setEmailTo(""); setEmailSubject(""); setEmailBody(""); await refresh(); toast({ title: "Gmail effect submitted", description: "It is waiting in the local authority queue before provider delivery." }); },
    onError: (error) => showMutationError("Gmail execution request", error),
  });

  const seatMutation = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/seats`, {
      title: seatTitle.trim(),
      kind: seatKind,
      agentName: seatAgentName.trim(),
      ...(seatSupervisorId ? { supervisorSeatId: seatSupervisorId } : {}),
      mandate: `Operate the ${seatTitle.trim()} seat within its delegated authority.`,
      authority: { approval: "supervisor", visibility: seatKind === "manager" ? "reporting_tree" : "seat" },
      toolEntitlements: [],
    }),
    onSuccess: async (seat) => {
      setSeatTitle(""); setSeatAgentName(""); setMembershipSeatId(seat.id);
      await refresh();
      toast({ title: "Organizational seat created", description: `${seat.title} now has its own Role Agent and reporting position.` });
    },
    onError: (error) => showMutationError("Seat creation", error),
  });

  const membershipMutation = useMutation({
    mutationFn: () => requestJson<JsonRecord>("POST", `${root}/memberships`, {
      email: membershipEmail.trim().toLowerCase(),
      seatId: membershipSeatId,
      purpose: "operate",
      classificationCeiling: "internal",
    }),
    onSuccess: async () => {
      setMembershipEmail("");
      await refresh();
      toast({ title: "Human assigned to seat", description: "The existing Role Agent is now that person's assistant." });
    },
    onError: (error) => showMutationError("Seat assignment", error),
  });

  const assistantNameMutation = useMutation({
    mutationFn: async (name: string) => requestJson<JsonRecord>("PATCH", `/api/company/${companyId}`, { assistantName: name.trim() }),
    onSuccess: async (updatedCompany) => {
      queryClient.setQueryData<JsonRecord>([root, "context"], (current) => current ? { ...current, company: updatedCompany } : current);
      setAssistantNameDraft(updatedCompany.assistantName || "Assistant");
      setIsEditingAssistantName(false);
      toast({ title: "Executive Assistant renamed", description: `Your communication agent is now ${updatedCompany.assistantName}.` });
    },
    onError: (error) => showMutationError("Executive Assistant rename", error),
  });

  const aiBudgetMutation = useMutation({
    mutationFn: () => requestJson<JsonRecord>("PUT", `${root}/ai-budget`, {
      monthlyLimitDollars: Number(monthlyAiBudget),
      perRequestLimitDollars: Number(perRequestAiBudget),
      enabled: aiBudgetEnabled,
    }),
    onSuccess: async () => {
      await Promise.all([aiBudgetQuery.refetch(), auditQuery.refetch()]);
      toast({ title: "AI spend controls saved", description: "The monthly and per-request limits are now enforced by the EOS AI gateway." });
    },
    onError: (error) => showMutationError("AI spend control update", error),
  });

  const saveAssistantName = () => {
    const nextName = assistantNameDraft.trim();
    if (!nextName || nextName === assistantName || assistantNameMutation.isPending) {
      if (nextName === assistantName) setIsEditingAssistantName(false);
      return;
    }
    assistantNameMutation.mutate(nextName);
  };

  const sendEaMessage = (content: string) => {
    setEaMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() }]);
    eaMessageMutation.mutate(content);
    window.dispatchEvent(new Event("eos:open-communication"));
  };

  const goToSurface = (surface: string) => {
    setActiveTab(surface);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${surface}`);
  };

  const openCommunication = () => window.dispatchEvent(new Event("eos:open-communication"));

  const prepareWorkPacket = (title: string, objective: string) => {
    setPacketTitle(title.slice(0, 200));
    setPacketObjective(objective.slice(0, 2000));
    goToSurface("operations");
    toast({ title: "Work Packet prepared", description: "Review the objective and authority gate, then create it when ready." });
  };

  const nextTransition = (status: string): string | undefined => ({ ready: "in_progress", in_progress: "in_review", blocked: "in_progress", in_review: "completed" })[status];
  const nextManifestStatus = (status?: string): string | undefined => ({ draft: "diagnostic", diagnostic: "proposed", proposed: "review", review: "approved", approved: "provisioning", provisioning: "verifying" } as Record<string, string>)[status || ""];
  const nav = useMemo(() => [
    { icon: Home, label: "Home", href: `#home`, active: activeTab === "home" },
    { icon: Command, label: "Command", href: `#command`, active: activeTab === "command" },
    { icon: Network, label: "Organization", href: `#organization`, active: activeTab === "organization" },
    { icon: UserRound, label: "My Role", href: `#my-role`, active: activeTab === "my-role" },
    { icon: BriefcaseBusiness, label: "Stakeholder / Commercial", href: `#commercial`, active: activeTab === "commercial", status: "overlay" },
    { icon: Workflow, label: "Operations", href: `#operations`, active: activeTab === "operations" },
    { icon: BriefcaseBusiness, label: "Work Room", href: `#work-room`, active: activeTab === "work-room" },
    { icon: ClipboardCheck, label: "Review Room", href: `#review`, active: activeTab === "review" },
    { icon: BookOpen, label: "Academy", href: `#academy`, active: activeTab === "academy" },
    { icon: Map, label: "Portfolio Map", href: `#portfolio-map`, active: activeTab === "portfolio-map" },
    { icon: Landmark, label: "Capital & Finance", href: `#capital`, active: activeTab === "capital", status: "dormant" },
    { icon: Bot, label: "Intelligence", href: `#intelligence`, active: activeTab === "intelligence" },
    { icon: Blocks, label: "Systems", href: `#systems`, active: activeTab === "systems" },
  ].filter((item) => allowedSurfaces.has(item.href.slice(1))), [activeTab, principalContext?.role]);

  if (contextQuery.isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading EOS context…</div>;
  if (contextQuery.error || !company) return <main className="min-h-screen bg-[#f5f6f7] px-4 py-10 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center"><Card className="w-full border-0 p-7 shadow-[0_8px_32px_rgba(106,55,212,0.08)] sm:p-10"><p className="eos-label">Organization</p><h1 className="mt-3 text-2xl font-semibold">This workspace is unavailable</h1><p className="mt-3 text-sm text-muted-foreground">The organization may have moved from a legacy account, may no longer exist, or may be outside your verified authority scope.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button onClick={() => contextQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button><Button asChild variant="secondary"><Link href="/portfolios">Choose an organization</Link></Button></div></Card></div></main>;

  const intelligenceRail = (
    <div className="flex h-full min-h-0 flex-col bg-white/45">
      <div className="flex-shrink-0 border-b border-border/70 px-3 py-2.5 pr-11 xl:pr-3">
        {isFounder && isEditingAssistantName ? (
          <div>
            <form onSubmit={(event) => { event.preventDefault(); saveAssistantName(); }} className="flex min-w-0 items-center gap-1">
              <Input value={assistantNameDraft} onChange={(event) => setAssistantNameDraft(event.target.value)} maxLength={40} autoFocus disabled={assistantNameMutation.isPending} aria-label="Executive Assistant name" className="h-8 min-w-0 flex-1 px-2 text-xs" />
              <button type="submit" disabled={!assistantNameDraft.trim() || assistantNameMutation.isPending} className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40" aria-label="Save Executive Assistant name"><Check className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={assistantNameMutation.isPending} onClick={() => { setAssistantNameDraft(assistantName); setIsEditingAssistantName(false); }} className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Cancel renaming"><X className="h-3.5 w-3.5" /></button>
            </form>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">Rename Executive Assistant</p>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><MessagesSquare className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1"><h2 className="truncate text-sm font-semibold">{assistantName}</h2>{isFounder && <button type="button" onClick={() => setIsEditingAssistantName(true)} className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={`Rename ${assistantName}`}><Pencil className="h-3 w-3" /></button>}</div><p className="truncate text-[10px] text-muted-foreground">{isFounder ? "Executive Assistant · founder channel" : "Role Agent · personal assistant mode"}</p></div>
            <span className="hidden h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500 xl:block" title="Communication available" />
          </div>
        )}
        <div className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden">{isFounder && <Badge variant="secondary" className="h-5 flex-shrink-0 px-1.5 text-[9px]">15 advisors</Badge>}<Badge variant="outline" className="h-5 min-w-0 truncate px-1.5 text-[9px]">{principalContext?.seat || "Active seat"}</Badge></div>
      </div>
      <div className="min-h-0 flex-1"><AgentChatStub messages={eaMessages} onSendMessage={sendEaMessage} onPromoteMessage={(message) => prepareWorkPacket("EA recommendation", message.content)} suggestions={["Brief me", "Prioritize work", "Prepare a decision"]} isLoading={eaMessageMutation.isPending} placeholder={`Message ${assistantName}…`} assistantName={assistantName} compact className="h-full shadow-none" /></div>
      <div className="flex flex-shrink-0 items-center gap-1.5 border-t border-border/70 px-3 py-1.5 text-[9px] text-muted-foreground"><ShieldCheck className="h-3 w-3 flex-shrink-0 text-primary" /><span className="truncate">EOS authority · advice is not execution</span></div>
    </div>
  );

  const sectionTitle: Record<string, string> = {
    home: "Home",
    command: "Command",
    organization: "Organization",
    "my-role": "My Role",
    commercial: "Stakeholder / Commercial",
    operations: "Operations",
    "work-room": "Work Room",
    review: "Review Room",
    academy: "Academy",
    "portfolio-map": "Portfolio Map",
    capital: "Capital & Finance",
    intelligence: "Intelligence",
    systems: "Systems",
  };
  const sectionDescription: Record<string, string> = {
    home: "See priorities, decisions, and the next move at a glance.",
    command: "Direct work, resolve constraints, and keep execution moving.",
    organization: "Shape the structure, authority, and operating rules.",
    "my-role": "Know your scope, responsibilities, and next actions.",
    commercial: "Turn market signals into accountable commercial action.",
    operations: "Create, assign, and advance evidence-backed work.",
    "work-room": "Move active work from intent to verified outcome.",
    review: "Approve, reject, and audit consequential decisions.",
    academy: "Build role mastery through real, evidence-backed practice.",
    "portfolio-map": "See the portfolio structure within your authority scope.",
    capital: "Activate capital controls only when financial authority is configured.",
    intelligence: `Work with ${assistantName} to turn context into clear decisions.`,
    systems: "Connect providers and control how EOS operates.",
  };
  const pendingApprovalCount = approvals.filter((approval) => approval.status === "pending").length;
  const operatingStateReady = manifest?.status !== "active" || (packetsQuery.isSuccess && approvalsQuery.isSuccess);
  const operatingStateFailed = manifest?.status === "active" && (packetsQuery.isError || approvalsQuery.isError);
  const nextActionTarget = !operatingStateReady
    ? undefined
    : manifest?.status !== "active"
      ? "organization"
      : pendingApprovalCount
        ? "review"
        : activePackets.length
          ? "work-room"
          : "operations";
  const nextAction = !operatingStateReady
    ? operatingStateFailed ? "Retry workspace data" : "Loading current priorities"
    : manifest?.status !== "active"
      ? `Advance the organization manifest${manifest?.status ? ` from ${manifest.status.replaceAll("_", " ")}` : ""}`
      : pendingApprovalCount
        ? "Review pending approvals"
        : activePackets.length
          ? "Advance the highest-priority Work Packet"
          : "Create the next evidence-bearing mission";
  const nextActionLabel = !operatingStateReady
    ? operatingStateFailed ? "Retry next action" : "Loading next action…"
    : manifest?.status !== "active"
      ? "Continue organization setup"
      : pendingApprovalCount
        ? `Review ${pendingApprovalCount} pending decision${pendingApprovalCount === 1 ? "" : "s"}`
        : activePackets.length
          ? "Open active work"
          : "Create a mission";
  const NextActionIcon = !operatingStateReady ? RefreshCw : nextActionTarget === "organization" ? Network : nextActionTarget === "review" ? ClipboardCheck : nextActionTarget === "work-room" ? BriefcaseBusiness : Plus;
  const runNextAction = () => {
    if (nextActionTarget) goToSurface(nextActionTarget);
    else if (operatingStateFailed) void refresh();
  };

  return (
    <UniversalLayout
      portfolioName={contextQuery.data?.portfolio?.name || "Independent portfolio"}
      portfolioHref={contextQuery.data?.portfolio?.id ? `/portfolios/${contextQuery.data.portfolio.id}` : "/portfolios"}
      companyName={company.name}
      companyHref={`/company/${companyId}`}
      roleName={principalContext?.seat || "Founder / Portfolio Principal"}
      leftRailItems={nav}
      rightRailContent={intelligenceRail}
      floatingPanel={<FloatingAIPanel assistantName={assistantName} seatName={principalContext?.seat} openWork={activePackets.length} approvals={pendingApprovalCount} nextAction={nextAction}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Choose a controlled next step. Consequential actions still enter the approval and evidence lifecycle.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!operatingStateReady && !operatingStateFailed} onClick={runNextAction}><NextActionIcon className={`mr-1.5 h-3.5 w-3.5 ${!operatingStateReady && !operatingStateFailed ? "animate-spin" : ""}`} />{nextActionLabel}</Button>
            <Button size="sm" variant="outline" onClick={() => sendEaMessage("Brief me on the current state, the most important risk, and the next authorized action.")}><MessagesSquare className="mr-1.5 h-3.5 w-3.5" />Ask {assistantName}</Button>
          </div>
        </div>
      </FloatingAIPanel>}
    >
      <div className="space-y-8">
        <div>
          <div className="eos-label flex items-center gap-2"><Command className="h-4 w-4 text-primary" /> EOS overlay · {company.stage || "MVP"}</div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0 max-w-3xl"><h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{sectionTitle[activeTab]}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{sectionDescription[activeTab]}</p></div>
            <Button size="icon" variant="secondary" className="h-11 w-11 flex-shrink-0 rounded-xl" onClick={refresh} disabled={isRefreshing} aria-label={isRefreshing ? "Refreshing workspace" : "Refresh workspace"} title={isRefreshing ? "Refreshing workspace" : "Refresh workspace"}><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>

        {[briefQuery, packetsQuery, approvalsQuery, evidenceQuery, integrationsQuery].some((query) => query.isError) && <Alert variant="destructive"><AlertTitle>Some workspace data could not be loaded</AlertTitle><AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>The organization is available, but one or more operating surfaces need to be retried.</span><Button size="sm" variant="outline" onClick={refresh}>Retry workspace data</Button></AlertDescription></Alert>}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="sr-only">
            <TabsTrigger value="home">Home</TabsTrigger><TabsTrigger value="command">Command</TabsTrigger><TabsTrigger value="organization">Organization</TabsTrigger><TabsTrigger value="my-role">My Role</TabsTrigger><TabsTrigger value="commercial">Commercial</TabsTrigger><TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="work-room">Work Room</TabsTrigger><TabsTrigger value="review">Review</TabsTrigger><TabsTrigger value="academy">Academy</TabsTrigger><TabsTrigger value="portfolio-map">Portfolio Map</TabsTrigger><TabsTrigger value="capital">Capital</TabsTrigger><TabsTrigger value="intelligence">Intelligence</TabsTrigger><TabsTrigger value="systems">Systems</TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-6">
            <Card><CardHeader><CardTitle>Morning Brief</CardTitle><CardDescription>{briefQuery.data?.generatedAt ? `Generated ${new Date(briefQuery.data.generatedAt).toLocaleString()}` : "Loading current state…"}</CardDescription></CardHeader><CardContent className="space-y-5"><p className="text-lg">{briefQuery.data?.headline}</p><div className="flex flex-wrap gap-2"><Button disabled={!operatingStateReady && !operatingStateFailed} onClick={runNextAction}><NextActionIcon className={`mr-2 h-4 w-4 ${!operatingStateReady && !operatingStateFailed ? "animate-spin" : ""}`} />{nextActionLabel}</Button><Button variant="outline" onClick={() => sendEaMessage("Brief me on today's priorities, exceptions, decisions, and the next authorized action.")}><MessagesSquare className="mr-2 h-4 w-4" />Discuss with {assistantName}</Button>{operatingStateReady && nextActionTarget !== "operations" && <Button variant="outline" onClick={() => goToSurface("operations")}><Plus className="mr-2 h-4 w-4" />Create mission</Button>}</div></CardContent></Card>
            <div className="grid gap-4 lg:grid-cols-2"><ListCard title="Priority missions" empty="No open missions yet." items={briefQuery.data?.priorities || []} actionLabel="Open mission" onSelect={() => goToSurface("operations")} /><ListCard title="Exceptions" empty="No active exceptions." items={briefQuery.data?.exceptions || []} actionLabel="Resolve" onSelect={() => goToSurface("review")} /></div>
          </TabsContent>

          <TabsContent value="command" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Open Work Packets" value={contextQuery.data?.counts?.openWorkPackets || 0} icon={Workflow} actionLabel="Open active work" onClick={() => goToSurface("work-room")} />
              <Metric label="Pending approvals" value={contextQuery.data?.counts?.pendingApprovals || 0} icon={ClipboardCheck} actionLabel="Review decisions" onClick={() => goToSurface("review")} />
              <Metric label="Evidence records" value={contextQuery.data?.counts?.evidence || 0} icon={FileCheck2} actionLabel="Open evidence" onClick={() => goToSurface("operations")} />
              <Metric label="Blocked" value={contextQuery.data?.counts?.blocked || 0} icon={Activity} actionLabel="Resolve blocked work" onClick={() => goToSurface("work-room")} />
            </div>
            <Card><CardHeader><CardTitle>Organization command state</CardTitle><CardDescription>The current phase, constraint, authority gate, and next safe move.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Fact label="Lifecycle stage" value={company.stage || "MVP"} /><Fact label="Manifest" value={manifest ? `v${manifest.version} · ${manifest.status}` : "Not compiled"} /><Fact label="Current constraint" value={manifest?.status === "active" ? activePackets.length ? `${activePackets.length} active Work Packet${activePackets.length === 1 ? "" : "s"}` : "No active mission" : "Organization manifest not active"} /><Fact label="Next safe action" value={nextAction} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="organization" className="space-y-4">
            <Card><CardHeader><CardTitle>Organization Compiler</CardTitle><CardDescription>Compile current company intent into a versioned manifest. Activation is an explicit local owner decision.</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 text-sm"><Fact label="Stage" value={company.stage || "MVP"} /><Fact label="Offer" value={company.offer || "Needs definition"} /><Fact label="Target customer" value={company.targetCustomer || "Needs definition"} /><Fact label="Goal source" value={company.goals || "First repeatable customer-value loop"} /></div>
              {manifest ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-5"><div><div className="font-medium">Manifest v{manifest.version}</div><div className="text-sm text-muted-foreground">{manifest.status === "active" ? "Authoritative local organization contract" : "Compiler lifecycle requires explicit review, provisioning, and verification"}</div></div><div className="flex items-center gap-2"><StateBadge state={manifest.status} />{nextManifestStatus(manifest.status) && <Button onClick={() => manifestTransitionMutation.mutate({ id: manifest.id, status: nextManifestStatus(manifest.status)! })} disabled={manifestTransitionMutation.isPending}>Advance to {nextManifestStatus(manifest.status)!.replaceAll("_", " ")}</Button>}{manifest.status === "verifying" && <Button onClick={() => activateMutation.mutate(manifest.id)} disabled={activateMutation.isPending}>{activateMutation.isPending ? "Activating…" : "Activate verified manifest"}</Button>}</div></div> : <Alert><Sparkles className="h-4 w-4" /><AlertTitle>No manifest compiled</AlertTitle><AlertDescription>The app is usable, but organizational defaults have not yet been made explicit.</AlertDescription></Alert>}
              <Button onClick={() => compilerMutation.mutate()} disabled={compilerMutation.isPending}>{compilerMutation.isPending ? "Compiling…" : manifest ? "Compile next draft" : "Compile organization draft"}</Button>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Enabled MVP modules</CardTitle><CardDescription>The overlay activates the fourteen non-dormant modules; capital, M&A, and board governance remain architecturally mapped but dormant.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{Array.from({ length: 14 }, (_, index) => <Badge key={index} variant="outline">Module {index + 1}</Badge>)}</CardContent></Card>
            <Card><CardHeader><CardTitle>Role-compiled visibility</CardTitle><CardDescription>Every screen, search result, metric, message, approval, and agent context is compiled for the active seat. Higher organizational accountability receives broader authorized downline visibility.</CardDescription></CardHeader><CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3"><Fact label="Active seat" value={principalContext?.seat || "Founder / Portfolio Principal"} /><Fact label="Visibility scope" value={principalContext?.visibility?.scope || "portfolio"} /><Fact label="Communication path" value={principalContext?.visibility?.communicationPath || `Founder ↔ ${assistantName}`} /></div>
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl bg-muted p-4"><p className="eos-label mb-2">Visible in this seat</p><ul className="space-y-2 text-sm text-muted-foreground">{(principalContext?.visibility?.sees || []).map((item: string) => <li key={item}>• {item}</li>)}</ul></div><div className="rounded-xl bg-muted p-4"><p className="eos-label mb-2">Still requires a separate grant</p><ul className="space-y-2 text-sm text-muted-foreground">{(principalContext?.visibility?.cannotSee || []).map((item: string) => <li key={item}>• {item}</li>)}</ul></div></div>
              <Alert><Network className="h-4 w-4" /><AlertTitle>Organizational communication law</AlertTitle><AlertDescription>Founder ↔ Executive Assistant ↔ Portfolio Advisors and Company CEO Agents. Inside a company, each employee or Role Agent communicates through the real reporting chain. When a human occupies an existing agent-run role, that Role Agent becomes the human's assistant instead of competing for the seat.</AlertDescription></Alert>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Instantiated seats</CardTitle><CardDescription>This is the visibility-filtered reporting graph, not a decorative org chart.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{(organizationQuery.data?.seats || []).map((seat: JsonRecord) => <div key={seat.id} className="rounded-xl bg-muted p-4"><div className="flex items-center justify-between gap-3"><span className="font-medium">{seat.title}</span><StateBadge state={seat.agentMode} /></div><p className="mt-1 text-sm text-muted-foreground">{seat.kind.replaceAll("_", " ")} · {seat.agentName}</p><p className="mt-2 text-xs text-muted-foreground">{seat.mandate || "Mandate awaiting definition"}</p></div>)}</CardContent></Card>
            {(["founder", "company_ceo"].includes(principalContext?.role)) && <Card><CardHeader><CardTitle>Build the operating hierarchy</CardTitle><CardDescription>Create an accountable seat, position it under a supervisor, then optionally assign an existing verified EOS user. A human assignment converts the Role Agent into that person's assistant.</CardDescription></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3"><p className="eos-label">Create seat</p><Input value={seatTitle} onChange={(event) => setSeatTitle(event.target.value)} placeholder="Seat title, e.g. Head of Growth" /><Input value={seatAgentName} onChange={(event) => setSeatAgentName(event.target.value)} placeholder="Role Agent name" /><select value={seatKind} onChange={(event) => setSeatKind(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="company_ceo">Company CEO</option><option value="functional_executive">Functional executive</option><option value="manager">Manager</option><option value="individual_contributor">Individual contributor</option><option value="external">External collaborator</option></select><select value={seatSupervisorId} onChange={(event) => setSeatSupervisorId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Report to my active seat</option>{(organizationQuery.data?.seats || []).map((seat: JsonRecord) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select><Button disabled={seatTitle.trim().length < 2 || seatAgentName.trim().length < 2 || seatMutation.isPending} onClick={() => seatMutation.mutate()}><Plus className="mr-2 h-4 w-4" />{seatMutation.isPending ? "Creating…" : "Create accountable seat"}</Button></div>
              <div className="space-y-3"><p className="eos-label">Assign verified person</p><Input type="email" value={membershipEmail} onChange={(event) => setMembershipEmail(event.target.value)} placeholder="Existing EOS account email" /><select value={membershipSeatId} onChange={(event) => setMembershipSeatId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose an unoccupied or existing seat</option>{(organizationQuery.data?.seats || []).map((seat: JsonRecord) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select><Button variant="secondary" disabled={!membershipEmail.includes("@") || !membershipSeatId || membershipMutation.isPending} onClick={() => membershipMutation.mutate()}>{membershipMutation.isPending ? "Assigning…" : "Assign person to seat"}</Button><p className="text-xs text-muted-foreground">The person must sign in once so EOS has a verified local principal to bind. Active assignments: {organizationQuery.data?.memberships?.length || 0}.</p></div>
            </CardContent></Card>}
          </TabsContent>

          <TabsContent value="my-role" className="space-y-6">
            <Card><CardHeader><CardTitle>{principalContext?.seat}</CardTitle><CardDescription>Your compiled seat, visibility ceiling, communication path, and tool authority.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><Fact label="Role" value={(principalContext?.role || "unresolved").replaceAll("_", " ")} /><Fact label="Visibility" value={principalContext?.visibility?.scope || "unresolved"} /><Fact label="Assistant" value={assistantName} /></div><div><p className="eos-label mb-2">Tool entitlements</p><div className="flex flex-wrap gap-2">{(principalContext?.toolEntitlements || []).length ? principalContext.toolEntitlements.map((tool: string) => <Badge key={tool} variant="outline">{tool}</Badge>) : <span className="text-sm text-muted-foreground">No delegated provider tools; local work remains available.</span>}</div></div><Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Authority is explicit</AlertTitle><AlertDescription>{assistantName} can assist this seat but cannot expand its visibility, approve its own request, or communicate around the reporting hierarchy.</AlertDescription></Alert></CardContent></Card>
          </TabsContent>

          <TabsContent value="commercial" className="space-y-6">
            <Card><CardHeader><CardTitle>Commercial action room</CardTitle><CardDescription>Turn a customer, offer, pipeline, or relationship question into an accountable decision or mission.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Fact label="Offer" value={company.offer || "Needs definition"} /><Fact label="Target customer" value={company.targetCustomer || "Needs definition"} /></div><div className="flex flex-wrap gap-2"><Button onClick={() => sendEaMessage(`Assess the commercial position for ${company.name}: offer, target customer, pipeline assumptions, risks, and the next decision required.`)}><MessagesSquare className="mr-2 h-4 w-4" />Ask {assistantName} for assessment</Button><Button variant="outline" onClick={() => prepareWorkPacket("Validate commercial assumptions", `Test the offer and target-customer assumptions for ${company.name}, document evidence, and return the next commercial decision.`)}><BriefcaseBusiness className="mr-2 h-4 w-4" />Create commercial mission</Button></div><Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Overlay authority</AlertTitle><AlertDescription>EOS coordinates the work and evidence; it does not silently replace the authoritative CRM or provider record.</AlertDescription></Alert></CardContent></Card>
            <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Overlay contract</AlertTitle><AlertDescription>Provider records remain authoritative until a field-level native cutover is explicitly qualified.</AlertDescription></Alert>
          </TabsContent>

          <TabsContent value="operations" className="space-y-8">
            <Card><CardHeader><CardTitle>Create Work Packet</CardTitle><CardDescription>A mission is a governed unit of work with objective, authority, lifecycle, and evidence.</CardDescription></CardHeader><CardContent className="grid gap-3"><Input value={packetTitle} onChange={(event) => setPacketTitle(event.target.value)} placeholder="Mission title" /><Textarea value={packetObjective} onChange={(event) => setPacketObjective(event.target.value)} placeholder="Objective and intended outcome" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={packetApproval} onChange={(event) => setPacketApproval(event.target.checked)} /> Require local approval before work begins</label><Button className="w-fit" disabled={packetTitle.trim().length < 3 || packetObjective.trim().length < 3 || packetMutation.isPending} onClick={() => packetMutation.mutate()}><Plus className="mr-2 h-4 w-4" />{packetMutation.isPending ? "Creating…" : "Create Work Packet"}</Button></CardContent></Card>
            <div className="space-y-3">{packets.map((packet) => { const next = nextTransition(packet.status); const packetEvidence = evidence.filter((item) => item.workPacketId === packet.id); return <Card key={packet.id}><CardContent className="pt-8"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{packet.title}</h3><StateBadge state={packet.status} /><Badge variant="outline">{packet.priority}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{packet.objective}</p><p className="mt-2 text-xs text-muted-foreground">Evidence {packetEvidence.length}/{Math.max(1, packet.evidenceRequirements?.length || 1)} · Trace {packet.traceId?.slice(0, 8)}</p></div><div className="flex flex-wrap gap-2">{next && <Button size="sm" variant="outline" disabled={transitionMutation.isPending || (next === "completed" && packetEvidence.length === 0)} onClick={() => transitionMutation.mutate({ id: packet.id, status: next })}>{next === "in_progress" ? "Start / resume" : next === "in_review" ? "Submit for review" : "Complete"}</Button>}</div></div>{!["completed", "cancelled"].includes(packet.status) && <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Input value={evidenceTitle[packet.id] || ""} onChange={(event) => setEvidenceTitle((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Evidence title" /><Button variant="secondary" disabled={!evidenceTitle[packet.id]?.trim()} onClick={() => evidenceMutation.mutate({ packetId: packet.id, title: evidenceTitle[packet.id] })}>Record evidence</Button></div>}</CardContent></Card>; })}{!packets.length && <EmptyState icon={Workflow} title="No Work Packets" description="Create the first evidence-bearing mission above." />}</div>

            <section className="space-y-3"><div><p className="eos-label">Authority queue</p><h2 className="mt-1 text-xl font-semibold">Approvals</h2></div>{approvals.map((approval) => <Card key={approval.id}><CardContent className="flex flex-col gap-4 pt-8 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{approval.summary}</h3><StateBadge state={approval.status} /></div><p className="mt-1 text-xs text-muted-foreground">Requested {new Date(approval.createdAt).toLocaleString()}</p></div>{approval.status === "pending" && <div className="flex gap-2"><Button variant="outline" disabled={approvalMutation.isPending} onClick={() => approvalMutation.mutate({ id: approval.id, decision: "rejected" })}>Reject</Button><Button disabled={approvalMutation.isPending} onClick={() => approvalMutation.mutate({ id: approval.id, decision: "approved" })}>{approvalMutation.isPending ? "Saving…" : "Approve"}</Button></div>}</CardContent></Card>)}{!approvals.length && <EmptyState icon={ClipboardCheck} title="No approval requests" description="Approval-gated missions will appear here." />}</section>

            <section className="space-y-3"><div><p className="eos-label">Proof and provenance</p><h2 className="mt-1 text-xl font-semibold">Evidence</h2></div>{evidence.map((item) => <Card key={item.id}><CardContent className="flex items-start gap-3 pt-8"><FileCheck2 className="h-5 w-5 text-primary" /><div><div className="font-medium">{item.title}</div><div className="text-sm text-muted-foreground">{item.evidenceType.replaceAll("_", " ")} · {new Date(item.createdAt).toLocaleString()}</div></div></CardContent></Card>)}{!evidence.length && <EmptyState icon={FileCheck2} title="No evidence recorded" description="Work cannot be marked complete until evidence exists." />}</section>
          </TabsContent>

          <TabsContent value="work-room" className="space-y-6">
            <Card><CardHeader><CardTitle>Active Work Room</CardTitle><CardDescription>Work, provider actions, artifacts, evidence, and blockers stay attached to the governed Work Packet.</CardDescription></CardHeader><CardContent className="space-y-3">{activePackets.map((packet) => <button key={packet.id} type="button" onClick={() => setProviderPacketId(packet.id)} className={`w-full rounded-xl p-4 text-left ${providerPacketId === packet.id ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted"}`}><div className="flex items-center justify-between gap-3"><span className="font-medium">{packet.title}</span><StateBadge state={packet.status} /></div><p className="mt-1 text-sm text-muted-foreground">{packet.objective}</p></button>)}{!activePackets.length && <p className="text-sm text-muted-foreground">No active Work Packet is available to this seat.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Approved Gmail delivery</CardTitle><CardDescription>Create a provider effect attached to the selected Work Packet. Delivery occurs only after the assigned supervisor or owner approves it.</CardDescription></CardHeader><CardContent className="grid gap-3"><Input value={emailTo} onChange={(event) => setEmailTo(event.target.value)} type="email" placeholder="Recipient email" /><Input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="Subject" /><Textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} placeholder="Approved message body" /><Button className="w-fit" disabled={!providerPacketId || !emailTo || !emailSubject || !emailBody || providerExecutionMutation.isPending || !googleConnected} onClick={() => providerExecutionMutation.mutate()}><ExternalLink className="mr-2 h-4 w-4" />Request Gmail execution</Button>{!googleConnected && <p className="text-sm text-muted-foreground">Connect Google Workspace in Systems before requesting delivery.</p>}</CardContent></Card>
            {googleContextQuery.data && <div className="grid gap-4 lg:grid-cols-2"><ListCard title="Upcoming Calendar context" empty="No upcoming events returned." items={(googleContextQuery.data.calendar || []).map((item: JsonRecord) => ({ ...item, title: item.summary, objective: item.start || "Date unavailable", status: "provider" }))} /><ListCard title="Recent Drive context" empty="No recent files returned." items={(googleContextQuery.data.drive || []).map((item: JsonRecord) => ({ ...item, title: item.name, objective: item.modifiedTime || "Timestamp unavailable", status: "provider" }))} /></div>}
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <section className="space-y-3"><div><p className="eos-label">Assigned authority queue</p><h2 className="mt-1 text-xl font-semibold">Decisions requiring this seat</h2></div>{approvals.map((approval) => <Card key={approval.id}><CardContent className="flex flex-col gap-4 pt-8 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold">{approval.summary}</h3><StateBadge state={approval.status} /></div>{approval.status === "pending" && <div className="flex gap-2"><Button variant="outline" onClick={() => approvalMutation.mutate({ id: approval.id, decision: "rejected" })}>Reject</Button><Button onClick={() => approvalMutation.mutate({ id: approval.id, decision: "approved" })}>Approve</Button></div>}</CardContent></Card>)}{!approvals.length && <EmptyState icon={ClipboardCheck} title="No assigned decisions" description="Only approvals assigned to this principal appear here." />}</section>
            <Card><CardHeader><CardTitle>Provider reconciliation</CardTitle><CardDescription>External effects remain explicit through request, approval, receipt, and reconciliation.</CardDescription></CardHeader><CardContent className="space-y-3">{(providerExecutionsQuery.data || []).map((execution) => <div key={execution.id} className="rounded-xl bg-muted p-4"><div className="flex items-center justify-between gap-3"><span className="font-medium">{execution.operation}</span><StateBadge state={execution.status} /></div><p className="mt-1 text-sm text-muted-foreground">{execution.reconciliationStatus.replaceAll("_", " ")} · trace {execution.traceId.slice(0, 8)}</p></div>)}{!providerExecutionsQuery.data?.length && <p className="text-sm text-muted-foreground">No provider executions in this visibility scope.</p>}</CardContent></Card>
            {auditVisible && <Card><CardHeader><CardTitle>Recent control receipts</CardTitle><CardDescription>Persisted audit evidence for actions within this seat's visibility.</CardDescription></CardHeader><CardContent className="space-y-3">{(auditQuery.data || []).slice(0, 12).map((record) => <div key={record.id} className="flex flex-col gap-2 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{String(record.action).replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{record.targetType} · {new Date(record.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><StateBadge state={record.result || "recorded"} /><code className="text-[10px] text-muted-foreground">{String(record.traceId || "").slice(0, 8)}</code></div></div>)}{auditQuery.isLoading && <p className="text-sm text-muted-foreground">Loading signed control history…</p>}{!auditQuery.isLoading && !auditQuery.data?.length && <p className="text-sm text-muted-foreground">No audit receipts are visible yet.</p>}</CardContent></Card>}
          </TabsContent>

          <TabsContent value="academy" className="space-y-6">
            <Card><CardHeader><CardTitle>Seat Academy</CardTitle><CardDescription>Practice inside real work, then prove advancement with reviewed evidence.</CardDescription></CardHeader><CardContent className="space-y-5"><Fact label="Current learning objective" value={`Operate the ${principalContext?.seat || "active seat"} within its authority ceiling`} /><Fact label="Practical exercise" value={activePackets[0]?.title || "Create the first evidence-bearing Work Packet"} /><Fact label="Advancement proof" value="Reviewed output, named evidence, and supervisor acceptance" /><div className="flex flex-wrap gap-2"><Button onClick={() => prepareWorkPacket(`Seat practice: ${principalContext?.seat || "active role"}`, `Complete a practical exercise for the ${principalContext?.seat || "active role"}, record evidence, and request supervisor review.`)}><BookOpen className="mr-2 h-4 w-4" />Start practical exercise</Button><Button variant="outline" onClick={() => sendEaMessage(`Coach me on the next practical skill for the ${principalContext?.seat || "active role"}. Ground it in current work and define the evidence required.`)}><MessagesSquare className="mr-2 h-4 w-4" />Ask role coach</Button></div></CardContent></Card>
            {notionContextQuery.data && <ListCard title="Canonical Notion references" empty="No shared Notion pages were returned." items={(notionContextQuery.data.results || []).map((item: JsonRecord) => ({ ...item, title: item.title, objective: item.lastEditedTime ? `Updated ${new Date(item.lastEditedTime).toLocaleString()}` : "Reference", status: "reference" }))} />}
          </TabsContent>

          <TabsContent value="portfolio-map" className="space-y-6">
            <Card><CardHeader><CardTitle>{contextQuery.data?.portfolio?.name || "Independent portfolio"}</CardTitle><CardDescription>Authorized organizational nodes and the reporting structure visible from the active seat.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-xl bg-primary/10 p-4"><div className="font-medium">{company.name}</div><p className="text-sm text-muted-foreground">{company.stage || "Stage not set"} · {organizationQuery.data?.seats?.length || 0} visible seats</p></div>{(organizationQuery.data?.seats || []).map((seat: JsonRecord) => <div key={seat.id} className="ml-5 rounded-xl bg-muted p-3 text-sm"><span className="font-medium">{seat.title}</span><span className="text-muted-foreground"> · reports through {seat.supervisorSeatId ? "organizational parent" : "portfolio principal"}</span></div>)}</CardContent></Card>
          </TabsContent>

          <TabsContent value="capital" className="space-y-6">
            <EmptyState icon={Landmark} title="Capital & Finance is dormant" description="The surface is architecturally mapped but intentionally inactive until a real legal-entity, account, currency, ledger, and approval boundary is configured." />
            <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>No implied ledger authority</AlertTitle><AlertDescription>Models, forecasts, and Notion references are not represented as settled financial truth.</AlertDescription></Alert>
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <Card><CardHeader><CardTitle>{assistantName} · {isFounder ? "Executive Office" : `${principalContext?.seat} assistant`}</CardTitle><CardDescription>{isFounder ? "One founder-facing conversation, orchestrating portfolio advisors and company CEO Agents without flattening the organization." : "A persistent Role Agent operating as the human seat occupant's assistant inside the reporting hierarchy."}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-muted-foreground">{assistantName} may explain state, preserve provenance, and draft bounded work. It may not expand this seat's visibility, grant authority, or execute consequential effects.</p><div className="grid gap-4 md:grid-cols-3"><Fact label="Channel" value={principalContext?.visibility?.communicationPath || assistantName} /><Fact label="Operating mode" value={principalContext?.communicationMode?.replaceAll("_", " ") || "assistant"} /><Fact label="Authority" value="Advice only; EOS approvals govern effects" /></div><Button onClick={openCommunication}><MessagesSquare className="mr-2 h-4 w-4" />Open {assistantName} conversation</Button></CardContent></Card>
            {advisorVisible && <div><p className="eos-label">Portfolio intelligence</p><h2 className="mt-1 text-xl font-semibold">15-advisor council</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">The mandates are stable; each consultation is personalized, persisted, and synthesized by the EA with source identity and dissent retained.</p></div>}
            {councilQuery.isLoading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Compiling the advisor council…</CardContent></Card>}
            {councilQuery.isError && <Alert variant="destructive"><AlertTitle>Advisor council unavailable</AlertTitle><AlertDescription>Retry the workspace. No substitute council is implied.</AlertDescription></Alert>}
            {advisorVisible && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(councilQuery.data?.advisors || []).map((advisor: JsonRecord, index: number) => <Card key={advisor.id}><CardContent className="flex h-full flex-col pt-8"><div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-sm font-semibold text-primary">{index + 1}</span><Badge variant="outline">{advisor.timeHorizon}</Badge></div><h3 className="mt-5 font-semibold">{advisor.name}</h3><p className="mt-2 flex-1 text-sm text-muted-foreground">{advisor.mandate}</p>{advisor.professionalBoundary && <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{advisor.professionalBoundary}</p>}<Button className="mt-4 w-full" variant="outline" onClick={() => sendEaMessage(`Consult the ${advisor.name} perspective on our current company priorities. Return its assumptions, risks, recommendation, and material dissent through your EA synthesis.`)}><MessagesSquare className="mr-2 h-4 w-4" />Consult through {assistantName}</Button></CardContent></Card>)}</div>}
            {advisorVisible && <Card><CardHeader><CardTitle>Recent advisor artifacts</CardTitle><CardDescription>Each artifact identifies which advisor was actually consulted and which model produced the result.</CardDescription></CardHeader><CardContent className="space-y-3">{(consultationsQuery.data || []).slice(0, 12).map((item) => <div key={item.id} className="rounded-xl bg-muted p-4"><div className="flex items-center justify-between gap-3"><span className="font-medium">{item.advisorName}</span><StateBadge state={item.status} /></div><p className="mt-2 text-sm text-muted-foreground">{item.response}</p><p className="mt-2 text-xs text-muted-foreground">{item.model || "No provider model"} · {new Date(item.createdAt).toLocaleString()}</p></div>)}{!consultationsQuery.data?.length && <p className="text-sm text-muted-foreground">Advisor artifacts appear after the EA convenes relevant seats for a founder request.</p>}</CardContent></Card>}
            {advisorVisible && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Council outputs are advisory artifacts</AlertTitle><AlertDescription>The founder does not manage fifteen parallel chats. {assistantName} convenes the relevant perspectives, returns a synthesis with dissent and provenance, and moves requested action into the Work Packet and approval lifecycle.</AlertDescription></Alert>}
          </TabsContent>

          <TabsContent value="systems" className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Integration Core</CardTitle><CardDescription>Provider truth, granted authority, health, tool schema, and fallback are visible before any external effect.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3"><Fact label="Control model" value="Local approval before consequence" /><Fact label="Credential boundary" value="Encrypted or deployment-managed" /><Fact label="Provider health" value="Live adapter verification" /></CardContent>
            </Card>
            {(integrationsQuery.data || []).map((integration) => (
              <IntegrationControlCard
                key={integration.id}
                integration={integration}
                pending={googleConnectMutation.isPending || googleDisconnectMutation.isPending || verifyIntegrationMutation.isPending}
                onConnect={() => googleConnectMutation.mutate()}
                onDisconnect={() => googleDisconnectMutation.mutate()}
                onVerify={() => verifyIntegrationMutation.mutate(integration.name)}
              />
            ))}
            {!integrationsQuery.isLoading && !integrationsQuery.data?.length && <EmptyState icon={Blocks} title="Integration state unavailable" description="Refresh the workspace to reload provider configuration and health." />}
            {isFounder && <Card><CardHeader><CardTitle>AI spend controls</CardTitle><CardDescription>Set enforceable limits for advisor, EA, and role-agent model usage.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="monthly-ai-budget" className="eos-label">Monthly limit (USD)</label><Input id="monthly-ai-budget" type="number" min="1" max="10000" step="1" value={monthlyAiBudget} onChange={(event) => setMonthlyAiBudget(event.target.value)} className="mt-2" /></div><div><label htmlFor="request-ai-budget" className="eos-label">Per-request limit (USD)</label><Input id="request-ai-budget" type="number" min="0.01" max="1000" step="0.01" value={perRequestAiBudget} onChange={(event) => setPerRequestAiBudget(event.target.value)} className="mt-2" /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={aiBudgetEnabled} onChange={(event) => setAiBudgetEnabled(event.target.checked)} />Enforce AI spend controls</label><div className="flex flex-wrap items-center gap-3"><Button disabled={aiBudgetMutation.isPending || !Number(monthlyAiBudget) || !Number(perRequestAiBudget) || Number(perRequestAiBudget) > Number(monthlyAiBudget)} onClick={() => aiBudgetMutation.mutate()}>{aiBudgetMutation.isPending ? "Saving…" : "Save spend controls"}</Button>{aiBudgetQuery.data && <span className="text-sm text-muted-foreground">Spent this month: ${((aiBudgetQuery.data.spentMicros || 0) / 1_000_000).toFixed(2)}</span>}</div></CardContent></Card>}
            <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Standalone-safe operation</AlertTitle><AlertDescription>EOS keeps manifests, work, approvals, audit, and evidence available when Universal Meta Harness or providers are offline.</AlertDescription></Alert>
          </TabsContent>
        </Tabs>
      </div>
    </UniversalLayout>
  );
}

function Metric({ label, value, icon: Icon, actionLabel, onClick }: { label: string; value: number; icon: typeof Activity; actionLabel: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={`${label}: ${value}. ${actionLabel}`} className="group rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><Card className="h-full transition-[transform,box-shadow] group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_32px_rgba(106,55,212,0.12)]"><CardContent className="pt-8"><div className="flex items-center justify-between"><div><div className="text-2xl font-semibold">{value}</div><div className="eos-label mt-1">{label}</div><div className="mt-3 text-xs font-medium text-primary">{actionLabel} →</div></div><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card></button>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1">{value}</div></div>; }

function ListCard({ title, items, empty, actionLabel, onSelect }: { title: string; items: JsonRecord[]; empty: string; actionLabel?: string; onSelect?: (item: JsonRecord) => void }) { return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{items.map((item, index) => <div key={item.id} className={index % 2 === 0 ? "rounded-xl bg-muted p-4" : "rounded-xl bg-[#f5f6f7] p-4"}><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.title}</span><StateBadge state={item.status} /></div><p className="mt-1 text-sm text-muted-foreground">{item.objective}</p>{onSelect && <Button size="sm" variant="ghost" className="mt-2 -ml-3 text-primary" onClick={() => onSelect(item)}>{actionLabel || "Open"}<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Button>}</div>)}{!items.length && <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>; }

function EmptyState({ icon: Icon, title, description }: { icon: typeof Workflow; title: string; description: string }) { return <Card><CardContent className="py-12 text-center"><Icon className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></CardContent></Card>; }

function IntegrationControlCard({
  integration,
  pending,
  onConnect,
  onDisconnect,
  onVerify,
}: {
  integration: JsonRecord;
  pending: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onVerify: () => void;
}) {
  const actions = new Set<string>(integration.actions || []);
  const scopeLabels: Record<string, string> = {
    "https://www.googleapis.com/auth/gmail.send": "Send approved email",
    "https://www.googleapis.com/auth/calendar.readonly": "Read calendars",
    "https://www.googleapis.com/auth/drive.metadata.readonly": "Read Drive file metadata",
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><CardTitle className="text-lg">{integration.name}</CardTitle><CardDescription className="mt-1">{integration.description}</CardDescription></div>
        <div className="flex flex-wrap gap-2"><StateBadge state={integration.state} />{integration.health && integration.health !== integration.state && <StateBadge state={integration.health} />}</div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Connection" value={(integration.providerType || "provider").replaceAll("_", " ")} />
          <Fact label="Authority" value={(integration.authority || "none").replaceAll("_", " ")} />
          <Fact label="Risk" value={(integration.risk || "unclassified").replaceAll("_", " ")} />
          <Fact label="Adapter" value={integration.executionAdapter || "Not configured"} />
        </div>

        {integration.serviceHealth && <div><p className="eos-label mb-2">Live service health</p><div className="flex flex-wrap gap-2">{Object.entries(integration.serviceHealth).map(([service, healthy]) => <Badge key={service} variant={healthy ? "default" : "outline"}>{service}: {healthy ? "reachable" : "unavailable"}</Badge>)}</div></div>}

        <details className="rounded-xl border border-border/70 bg-muted/25 p-4">
          <summary className="cursor-pointer font-medium">Capabilities and required access</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div><p className="eos-label mb-2">Tool schema</p><div className="flex flex-wrap gap-2">{(integration.operations || []).map((operation: string) => <Badge key={operation} variant="outline">{operation}</Badge>)}</div></div>
            <div><p className="eos-label mb-2">Required scopes</p><ul className="space-y-1 text-sm text-muted-foreground">{(integration.requiredScopes || []).map((scope: string) => <li key={scope}>• {scopeLabels[scope] || scope}</li>)}</ul></div>
          </div>
        </details>

        <div className="rounded-xl bg-muted p-4 text-sm"><span className="font-medium">Manual fallback:</span> <span className="text-muted-foreground">{integration.manualFallback}</span></div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(actions.has("connect") || actions.has("reconnect")) && <Button onClick={onConnect} disabled={pending}><Plug className="mr-2 h-4 w-4" />{actions.has("reconnect") ? "Reconnect Google" : "Connect Google"}</Button>}
          {actions.has("verify") && <Button variant="outline" onClick={onVerify} disabled={pending}><RefreshCw className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`} />Verify connection</Button>}
          {actions.has("disconnect") && <Button variant="outline" onClick={onDisconnect} disabled={pending}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button>}
          {actions.has("view_manifest") && <Button asChild variant="outline"><a href={integration.capabilityManifest} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />View capability manifest</a></Button>}
        </div>

        {!integration.configured && integration.id !== "umh" && <Alert><AlertTitle>Secure provider configuration required</AlertTitle><AlertDescription>This adapter must be configured in the EntrepreneurOS deployment before a user can authorize it.</AlertDescription></Alert>}
        {!integration.configured && integration.id === "umh" && <Alert><AlertTitle>Federation is deployment-managed</AlertTitle><AlertDescription>Universal Meta Harness activation requires an installation-bound issuer and signing keys. It is intentionally not enabled from the browser.</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}
