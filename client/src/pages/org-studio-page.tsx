import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, BriefcaseBusiness, Crown, Network, Plus, RefreshCw, UserRound, Wrench } from "lucide-react";
import UniversalLayout, { type UniversalLayoutLeftRailItem } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type RecordValue = Record<string, any>;
type StudioView = "structure" | "tools" | "authority";

async function requestJson<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  const scoped = new URL(url, window.location.origin);
  const seatId = new URLSearchParams(window.location.search).get("seat");
  if (seatId) scoped.searchParams.set("seatId", seatId);
  return (await apiRequest(method, `${scoped.pathname}${scoped.search}`, body)).json();
}

function seatColor(kind: string) {
  if (kind === "founder") return "#6a37d4";
  if (kind === "company_ceo") return "#8b5cf6";
  if (kind === "functional_executive") return "#a855f7";
  if (kind === "manager") return "#7c3aed";
  return "#64748b";
}

function seatLabel(kind: string) { return kind.replaceAll("_", " "); }

function reportingDepth(seat: RecordValue, byId: Map<string, RecordValue>, seen = new Set<string>()): number {
  if (!seat.supervisorSeatId || seen.has(seat.id)) return 0;
  seen.add(seat.id);
  const supervisor = byId.get(seat.supervisorSeatId);
  return supervisor ? 1 + reportingDepth(supervisor, byId, seen) : 0;
}

function buildGraph(seats: RecordValue[], selectedSeatId?: string): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(seats.map((seat) => [seat.id, seat]));
  const byDepth = new Map<number, RecordValue[]>();
  for (const seat of seats) {
    const depth = reportingDepth(seat, byId);
    byDepth.set(depth, [...(byDepth.get(depth) || []), seat]);
  }
  const nodes: Node[] = [];
  Array.from(byDepth.entries()).forEach(([depth, level]) => {
    level.forEach((seat: RecordValue, index: number) => nodes.push({
      id: seat.id,
      position: { x: 70 + index * 270, y: 60 + depth * 180 },
      data: { label: <div className="min-w-[180px]"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seatColor(seat.kind) }} /><span className="font-semibold">{seat.title}</span></div><p className="mt-1 text-xs opacity-75">{seat.agentMode === "assistant" ? "Human-directed · " : "Agent-operated · "}{seat.agentName}</p></div> },
      style: { width: 220, borderRadius: 14, border: selectedSeatId === seat.id ? "2px solid #6a37d4" : "1px solid #d9d7e0", padding: 12, background: selectedSeatId === seat.id ? "#f4efff" : "#fff", boxShadow: "0 4px 12px rgba(47,29,80,.08)" },
    }));
  });
  const edges: Edge[] = seats.filter((seat) => seat.supervisorSeatId && byId.has(seat.supervisorSeatId)).map((seat) => ({ id: `${seat.supervisorSeatId}-${seat.id}`, source: seat.supervisorSeatId, target: seat.id, type: "smoothstep", animated: false, style: { stroke: "#9d84de", strokeWidth: 1.5 } }));
  return { nodes, edges };
}

export default function OrgStudioPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const root = `/api/eos/companies/${encodeURIComponent(companyId)}`;
  const queryClient = useQueryClient();
  const [view, setView] = useState<StudioView>("structure");
  const [selectedSeatId, setSelectedSeatId] = useState<string>();
  const [title, setTitle] = useState("");
  const [agentName, setAgentName] = useState("");
  const [kind, setKind] = useState("functional_executive");
  const [supervisorSeatId, setSupervisorSeatId] = useState("");
  const [mandate, setMandate] = useState("");
  const [tools, setTools] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSeatId, setInviteSeatId] = useState("");

  const context = useQuery<RecordValue>({ queryKey: [root, "context"], queryFn: () => requestJson("GET", `${root}/context`) });
  const organization = useQuery<RecordValue>({ queryKey: [root, "organization-runtime"], queryFn: () => requestJson("GET", `${root}/organization-runtime`) });
  const blueprint = useQuery<RecordValue>({ queryKey: [root, "company-blueprint"], queryFn: () => requestJson("GET", `${root}/company-blueprint`) });
  const seats = organization.data?.seats || [];
  const activeSeat = seats.find((seat: RecordValue) => seat.id === organization.data?.activeSeatId);
  const role = context.data?.principalContext?.role;
  // Match the server's organization-management authority exactly. Portfolio
  // executives can inspect the graph when visibility allows, but cannot be
  // shown controls that the API will correctly reject for this company.
  const canDesign = ["founder", "company_ceo"].includes(role);
  const selectedSeat = seats.find((seat: RecordValue) => seat.id === selectedSeatId) || activeSeat || seats[0];
  const graph = useMemo(() => buildGraph(seats, selectedSeat?.id), [seats, selectedSeat?.id]);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [root, "context"] }),
    queryClient.invalidateQueries({ queryKey: [root, "organization-runtime"] }),
    queryClient.invalidateQueries({ queryKey: [root, "company-blueprint"] }),
  ]);
  const createSeat = useMutation({
    mutationFn: () => requestJson<RecordValue>("POST", `${root}/seats`, {
      title: title.trim(), kind, agentName: agentName.trim() || `${title.trim()} Agent`,
      supervisorSeatId: supervisorSeatId || activeSeat?.id, mandate: mandate.trim(),
      authority: { approval: "supervisor", visibility: kind === "manager" ? "reporting_tree" : "seat" },
      toolEntitlements: tools.split(",").map((tool) => tool.trim()).filter(Boolean),
    }),
    onSuccess: async (seat) => { setTitle(""); setAgentName(""); setMandate(""); setTools(""); setSelectedSeatId(seat.id); await refresh(); },
  });
  const instantiateBlueprint = useMutation({
    mutationFn: () => requestJson<RecordValue>("POST", `${root}/company-blueprint/instantiate`, { blueprintKey: blueprint.data?.blueprint?.key }),
    onSuccess: async () => { await refresh(); },
  });
  const inviteHuman = useMutation({
    mutationFn: () => requestJson<RecordValue>("POST", `${root}/invitations`, {
      email: inviteEmail.trim().toLowerCase(), seatId: inviteSeatId, purpose: "operate",
      classificationCeiling: "internal", portfolioScope: false,
    }),
    onSuccess: async () => { setInviteEmail(""); setInviteSeatId(""); await refresh(); },
  });

  const navigation: UniversalLayoutLeftRailItem[] = [
    { icon: BriefcaseBusiness, label: "Workspace", href: `/company/${companyId}` },
    { icon: Network, label: "Org Studio", href: `/company/${companyId}/org-studio`, active: true },
    { icon: Crown, label: "Company Mission", href: `/company-setup?companyId=${companyId}` },
  ];

  if (context.isLoading || organization.isLoading) return <UniversalLayout title="Org Studio" leftRailItems={navigation} floatingPanel={false}><p className="p-6 text-sm text-muted-foreground">Compiling the visible company graph…</p></UniversalLayout>;
  if (context.isError || organization.isError) return <UniversalLayout title="Org Studio" leftRailItems={navigation} floatingPanel={false}><div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5"><p className="font-medium">The company graph could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => refresh()}>Retry</Button></div></UniversalLayout>;
  if (!(context.data?.principalContext?.allowedSurfaces || []).includes("organization")) return <UniversalLayout title="Org Studio" leftRailItems={navigation} floatingPanel={false}><div className="m-6 rounded-xl border p-5"><p className="font-medium">This role does not have access to Org Studio.</p><p className="mt-2 text-sm text-muted-foreground">EOS keeps roles, their people, and their authority visible only where the reporting and disclosure policy permits it.</p><Button className="mt-4" asChild><Link href={`/company/${companyId}`}>Return to my workspace</Link></Button></div></UniversalLayout>;

  return <UniversalLayout title="Org Studio" companyName={context.data?.company?.name} companyHref={`/company/${companyId}`} portfolioName={context.data?.portfolio?.name} portfolioHref={context.data?.portfolio?.id ? `/portfolios/${context.data.portfolio.id}` : "/portfolios"} roleName={context.data?.principalContext?.seat} leftRailItems={navigation} floatingPanel={false}>
    <section className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eos-label">Company Operating Graph</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Org Studio</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">The organization is a live operating graph: departments, roles, humans, agents, responsibilities, tools, authority, and reporting relationships all refer to the same company reality.</p></div><Button variant="outline" onClick={() => refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh graph</Button></header>
      <div className="flex flex-wrap gap-2 rounded-xl bg-muted/50 p-2"><StudioTab active={view === "structure"} onClick={() => setView("structure")} label="Structure" /><StudioTab active={view === "tools"} onClick={() => setView("tools")} label="Role tools" /><StudioTab active={view === "authority"} onClick={() => setView("authority")} label="Authority & coverage" /></div>
      {blueprint.data?.blueprint && <section className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="eos-label">Business in a box · configured for this company</p><h2 className="mt-1 text-xl font-semibold">{blueprint.data.blueprint.title}</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{blueprint.data.blueprint.description} Each role becomes an editable seat, role agent, operating pack, authority baseline, reporting edge, and native tool surface—not an example card.</p><div className="mt-4 flex flex-wrap gap-2">{(blueprint.data.blueprint.roles || []).map((role: RecordValue) => <span key={role.key} className={`rounded-full px-2.5 py-1 text-xs ${role.state === "instantiated" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{role.state === "instantiated" ? "✓ " : ""}{role.title}</span>)}</div></div>{canDesign && <div className="shrink-0"><Button disabled={instantiateBlueprint.isPending || (blueprint.data.blueprint.roles || []).every((role: RecordValue) => role.state === "instantiated")} onClick={() => instantiateBlueprint.mutate()}><SparklesIcon />{instantiateBlueprint.isPending ? "Applying company formation…" : "Instantiate missing roles"}</Button>{instantiateBlueprint.isError && <p className="mt-2 max-w-xs text-xs text-destructive">The company formation could not be applied. Refresh the graph and try again.</p>}</div>}</div></section>}
      {view === "structure" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="h-[620px] overflow-hidden rounded-2xl border bg-[#f9f8fc]"><ReactFlow nodes={graph.nodes} edges={graph.edges} fitView fitViewOptions={{ padding: 0.25 }} onNodeClick={(_, node) => setSelectedSeatId(node.id)} nodesDraggable={false} nodesConnectable={false} elementsSelectable><Background color="#e7e2f4" gap={18} /><MiniMap nodeColor={(node) => seatColor((seats.find((seat: RecordValue) => seat.id === node.id)?.kind) || "individual_contributor")} /><Controls showInteractive={false} /></ReactFlow></div><SeatInspector seat={selectedSeat} memberships={organization.data?.memberships || []} rolePacks={organization.data?.roleOperatingPacks || []} view={view} /></div>}
      {view !== "structure" && <div className="grid gap-4 lg:grid-cols-2">{seats.map((seat: RecordValue) => <SeatCard key={seat.id} seat={seat} selected={seat.id === selectedSeat?.id} view={view} onClick={() => setSelectedSeatId(seat.id)} />)}</div>}
      {canDesign && <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border bg-white p-5 sm:p-6"><div><p className="eos-label">Modify the company in place</p><h2 className="mt-1 text-xl font-semibold">Add an accountable role</h2><p className="mt-1 text-sm text-muted-foreground">This creates a real seat, reporting edge, Role Agent, role operating pack, and baseline authority—rather than a decorative chart node.</p></div><div className="mt-6 grid gap-4"><Field label="Role title"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Head of Growth" /></Field><Field label="Role Agent name"><Input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Defaults to Head of Growth Agent" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Role level"><select value={kind} onChange={(event) => setKind(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="company_ceo">Company CEO</option><option value="functional_executive">Functional executive</option><option value="manager">Manager</option><option value="individual_contributor">Individual contributor</option><option value="external">External collaborator</option></select></Field><Field label="Reports to"><select value={supervisorSeatId} onChange={(event) => setSupervisorSeatId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">My active seat</option>{seats.map((seat: RecordValue) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></Field></div><Field label="Accountable result"><Textarea value={mandate} onChange={(event) => setMandate(event.target.value)} placeholder="The result this role owns, not a list of activity." /></Field><Field label="Native tools this role needs" hint="Comma-separated. These become visible in the role’s workspace."><Textarea value={tools} onChange={(event) => setTools(event.target.value)} placeholder="CRM, Calendar, Documents" /></Field></div><div className="mt-5 flex items-center gap-3"><Button disabled={!title.trim() || createSeat.isPending} onClick={() => createSeat.mutate()}><Plus className="mr-2 h-4 w-4" />{createSeat.isPending ? "Creating role…" : "Create role in graph"}</Button>{createSeat.isError && <p className="text-sm text-destructive">The role could not be created. Check the reporting role and try again.</p>}</div></div><div className="rounded-2xl border bg-white p-5 sm:p-6"><div><p className="eos-label">Human + agent hybrid</p><h2 className="mt-1 text-xl font-semibold">Place a person in an existing role</h2><p className="mt-1 text-sm text-muted-foreground">Invite a person into a live seat. They must accept the exact role; after acceptance the role agent stays with the seat as their assistant.</p></div><div className="mt-6 grid gap-4"><Field label="Work email"><Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@company.com" /></Field><Field label="Role seat"><select value={inviteSeatId} onChange={(event) => setInviteSeatId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Choose an unoccupied role</option>{seats.filter((seat: RecordValue) => !seat.occupantUserId && seat.kind !== "founder" && !(organization.data?.invitations || []).some((invitation: RecordValue) => invitation.seatId === seat.id && ["pending", "pending_delivery"].includes(invitation.status))).map((seat: RecordValue) => <option key={seat.id} value={seat.id}>{seat.title} · {seat.agentName}</option>)}</select></Field></div><div className="mt-5"><Button variant="secondary" disabled={!inviteEmail.includes("@") || !inviteSeatId || inviteHuman.isPending} onClick={() => inviteHuman.mutate()}><UserRound className="mr-2 h-4 w-4" />{inviteHuman.isPending ? "Sending invitation…" : "Send role invitation"}</Button>{inviteHuman.isError && <p className="mt-2 text-sm text-destructive">The invitation could not be sent. Review the email and selected role.</p>}</div></div></section>}
    </section>
  </UniversalLayout>;
}

function StudioTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <Button type="button" size="sm" variant={active ? "default" : "ghost"} onClick={onClick}>{label}</Button>; }
function SparklesIcon() { return <span className="mr-2 text-base leading-none" aria-hidden="true">✦</span>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block"><span className="eos-label">{label}</span>{hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}<span className="mt-2 block">{children}</span></label>; }
function SeatInspector({ seat, memberships, rolePacks }: { seat?: RecordValue; memberships: RecordValue[]; rolePacks: RecordValue[]; view: StudioView }) {
  if (!seat) return <aside className="rounded-2xl border bg-white p-5"><p className="text-sm text-muted-foreground">Select a role in the graph to inspect it.</p></aside>;
  const occupant = memberships.find((member) => member.seatId === seat.id);
  const pack = rolePacks.find((item) => item.seatId === seat.id && item.status === "active");
  return <aside className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="eos-label">{seatLabel(seat.kind)}</p><h2 className="mt-1 text-xl font-semibold">{seat.title}</h2></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{seat.agentMode === "assistant" ? "hybrid" : "agent-operated"}</span></div><div className="mt-5 space-y-4 text-sm"><InspectorRow icon={Bot} label="Role Agent" value={seat.agentName} /><InspectorRow icon={UserRound} label="Human director" value={occupant ? (occupant.fullName || occupant.email) : "No human occupant"} /><InspectorRow icon={BriefcaseBusiness} label="Accountable result" value={seat.mandate || "Awaiting mandate"} /><InspectorRow icon={Wrench} label="Tools" value={(seat.toolEntitlements || []).length ? seat.toolEntitlements.join(", ") : "No tool entitlements assigned"} /><InspectorRow icon={Network} label="Role operating pack" value={pack ? `v${pack.version} · ${pack.status}` : "Will be compiled when this role is created"} /></div></aside>;
}
function InspectorRow({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) { return <div><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-1 leading-relaxed">{value}</p></div>; }
function SeatCard({ seat, selected, view, onClick }: { seat: RecordValue; selected: boolean; view: StudioView; onClick: () => void }) { const content = view === "tools" ? ((seat.toolEntitlements || []).length ? seat.toolEntitlements.join(", ") : "No native tools assigned") : `${seat.agentMode === "assistant" ? "Human-directed role agent" : "Autonomous role agent"} · ${seat.mandate || "Mandate awaiting definition"}`; return <button type="button" onClick={onClick} className={`rounded-2xl border bg-white p-5 text-left transition-colors ${selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}><div className="flex items-center justify-between gap-4"><span className="font-semibold">{seat.title}</span><span className="text-xs text-muted-foreground">{seatLabel(seat.kind)}</span></div><p className="mt-2 text-sm text-muted-foreground">{content}</p></button>; }
