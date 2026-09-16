import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bot,
  BriefcaseBusiness,
  Crown,
  Network,
  Plus,
  RefreshCw,
  UserRound,
  Wrench,
} from "lucide-react";
import UniversalLayout, {
  type UniversalLayoutLeftRailItem,
} from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { eosRoleToolChoices } from "@shared/instrument-runtime";
import { normalizedRosterRole, parseTeamRosterCsv, suggestedTeamRosterSeats } from "@shared/team-roster-csv";

type RecordValue = Record<string, any>;
type StudioView = "structure" | "tools" | "authority" | "team";
type TeamRosterEntry = {
  id: string;
  name: string;
  email: string;
  sourceTitle: string;
  reportsTo: string;
  seatId: string | null;
};

function toolKeys(value: string) {
  return new Set(
    value
      .split(",")
      .map((tool) => tool.trim().toLowerCase())
      .filter(Boolean),
  );
}

function toggleTool(value: string, key: string) {
  const current = toolKeys(value);
  if (current.has(key)) current.delete(key);
  else current.add(key);
  return Array.from(current).join(", ");
}

async function requestJson<T>(
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: unknown,
): Promise<T> {
  const scoped = new URL(url, window.location.origin);
  const seatId = new URLSearchParams(window.location.search).get("seat");
  if (seatId) scoped.searchParams.set("seatId", seatId);
  return (
    await apiRequest(method, `${scoped.pathname}${scoped.search}`, body)
  ).json();
}

function seatColor(kind: string) {
  if (kind === "founder") return "#6a37d4";
  if (kind === "company_ceo") return "#8b5cf6";
  if (kind === "functional_executive") return "#a855f7";
  if (kind === "manager") return "#7c3aed";
  return "#64748b";
}

function seatLabel(kind: string) {
  return kind.replaceAll("_", " ");
}

function RoleToolPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = toolKeys(value);
  const groups = Array.from(
    new Set(eosRoleToolChoices.map((tool) => tool.group)),
  );
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group} aria-label={`${group} native tools`}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {group}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {eosRoleToolChoices
              .filter((tool) => tool.group === group)
              .map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  aria-pressed={selected.has(tool.key)}
                  onClick={() => onChange(toggleTool(value, tool.key))}
                  className={`rounded-xl border p-3 text-left transition-colors ${selected.has(tool.key) ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background hover:border-primary/40"}`}
                >
                  <span className="block text-sm font-medium">{tool.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {tool.detail}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function reportingDepth(
  seat: RecordValue,
  byId: Map<string, RecordValue>,
  seen = new Set<string>(),
): number {
  if (!seat.supervisorSeatId || seen.has(seat.id)) return 0;
  seen.add(seat.id);
  const supervisor = byId.get(seat.supervisorSeatId);
  return supervisor ? 1 + reportingDepth(supervisor, byId, seen) : 0;
}

function buildGraph(
  seats: RecordValue[],
  memberships: RecordValue[],
  selectedSeatId?: string,
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(seats.map((seat) => [seat.id, seat]));
  const byDepth = new Map<number, RecordValue[]>();
  for (const seat of seats) {
    const depth = reportingDepth(seat, byId);
    byDepth.set(depth, [...(byDepth.get(depth) || []), seat]);
  }
  const nodes: Node[] = [];
  Array.from(byDepth.entries()).forEach(([depth, level]) => {
    level.forEach((seat: RecordValue, index: number) => {
      const occupant = memberships.find((member) => member.seatId === seat.id);
      const humanName = occupant?.fullName || occupant?.email;
      nodes.push({
        id: seat.id,
        position: { x: 70 + index * 270, y: 60 + depth * 180 },
        data: {
          label: (
            <div className="min-w-[180px]">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: seatColor(seat.kind) }}
                />
                <span className="font-semibold">{seat.title}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary/75">
                {seat.department || "General Management"}
              </p>
              <p className="mt-1 text-xs opacity-75">
                {humanName
                  ? `${humanName} · assisted by ${seat.agentName}`
                  : `Agent-operated · ${seat.agentName}`}
              </p>
            </div>
          ),
        },
        style: {
          width: 220,
          borderRadius: 14,
          border:
            selectedSeatId === seat.id
              ? "2px solid #6a37d4"
              : "1px solid #d9d7e0",
          padding: 12,
          background: selectedSeatId === seat.id ? "#f4efff" : "#fff",
          boxShadow: "0 4px 12px rgba(47,29,80,.08)",
        },
      });
    });
  });
  const edges: Edge[] = seats
    .filter((seat) => seat.supervisorSeatId && byId.has(seat.supervisorSeatId))
    .map((seat) => ({
      id: `${seat.supervisorSeatId}-${seat.id}`,
      source: seat.supervisorSeatId,
      target: seat.id,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#9d84de", strokeWidth: 1.5 },
    }));
  return { nodes, edges };
}

export default function OrgStudioPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const root = `/api/eos/companies/${encodeURIComponent(companyId)}`;
  const queryClient = useQueryClient();
  const [view, setView] = useState<StudioView>("structure");
  const [selectedSeatId, setSelectedSeatId] = useState<string>();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Operations");
  const [agentName, setAgentName] = useState("");
  const [kind, setKind] = useState("functional_executive");
  const [supervisorSeatId, setSupervisorSeatId] = useState("");
  const [mandate, setMandate] = useState("");
  const [tools, setTools] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSeatId, setInviteSeatId] = useState("");
  const [teamRoster, setTeamRoster] = useState<TeamRosterEntry[]>([]);
  const [bulkRosterText, setBulkRosterText] = useState("");
  const [bulkRosterError, setBulkRosterError] = useState("");

  const context = useQuery<RecordValue>({
    queryKey: [root, "context"],
    queryFn: () => requestJson("GET", `${root}/context`),
  });
  const organization = useQuery<RecordValue>({
    queryKey: [root, "organization-runtime"],
    queryFn: () => requestJson("GET", `${root}/organization-runtime`),
  });
  const blueprint = useQuery<RecordValue>({
    queryKey: [root, "company-blueprint"],
    queryFn: () => requestJson("GET", `${root}/company-blueprint`),
  });
  const seats = organization.data?.seats || [];
  const activeSeat = seats.find(
    (seat: RecordValue) => seat.id === organization.data?.activeSeatId,
  );
  const role = context.data?.principalContext?.role;
  // Match the server's organization-management authority exactly. Portfolio
  // executives can inspect the graph when visibility allows, but cannot be
  // shown controls that the API will correctly reject for this company.
  const canDesign = ["founder", "company_ceo"].includes(role);
  const canPlanTeam = canDesign;
  const selectedSeat =
    seats.find((seat: RecordValue) => seat.id === selectedSeatId) ||
    activeSeat ||
    seats[0];
  const graph = useMemo(
    () => buildGraph(seats, organization.data?.memberships || [], selectedSeat?.id),
    [seats, organization.data?.memberships, selectedSeat?.id],
  );
  const departments = useMemo<[string, RecordValue[]][]>(() => {
    const groups = seats.reduce((accumulator: Map<string, RecordValue[]>, seat: RecordValue) => {
      const name = String(seat.department || "General Management");
      accumulator.set(name, [...(accumulator.get(name) || []), seat]);
      return accumulator;
    }, new Map<string, RecordValue[]>());
    const entries: [string, RecordValue[]][] = [];
    groups.forEach((departmentSeats: RecordValue[], departmentName: string) => {
      entries.push([departmentName, departmentSeats]);
    });
    return entries.sort(
      ([left]: [string, RecordValue[]], [right]: [string, RecordValue[]]) =>
        left.localeCompare(right),
    );
  }, [seats]);
  const rosterEntries = organization.data?.teamRosterPlan?.entries || [];
  const rosterVersion = JSON.stringify(rosterEntries);
  useEffect(() => {
    setTeamRoster(
      rosterEntries.map((entry: RecordValue) => ({
        id: entry.id,
        name: entry.name || "",
        email: entry.email || "",
        sourceTitle: entry.sourceTitle || "",
        reportsTo: entry.reportsTo || "",
        seatId: entry.seatId || null,
      })),
    );
  }, [rosterVersion]);
  const formationComplete =
    (blueprint.data?.blueprint?.roles || []).every(
      (role: RecordValue) => role.state === "instantiated",
    ) &&
    (blueprint.data?.blueprint?.nativeAssets || []).every(
      (asset: RecordValue) => asset.state === "drafted",
    ) && blueprint.data?.blueprint?.formationPlan?.state === "compiled";

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [root, "context"] }),
      queryClient.invalidateQueries({
        queryKey: [root, "organization-runtime"],
      }),
      queryClient.invalidateQueries({ queryKey: [root, "company-blueprint"] }),
    ]);
  const createSeat = useMutation({
    mutationFn: () =>
      requestJson<RecordValue>("POST", `${root}/seats`, {
        title: title.trim(),
        department: department.trim() || "General Management",
        kind,
        agentName: agentName.trim() || `${title.trim()} Agent`,
        supervisorSeatId: supervisorSeatId || activeSeat?.id,
        mandate: mandate.trim(),
        authority: {
          approval: "supervisor",
          visibility: kind === "manager" ? "reporting_tree" : "seat",
        },
        toolEntitlements: tools
          .split(",")
          .map((tool) => tool.trim())
          .filter(Boolean),
      }),
    onSuccess: async (seat) => {
      setTitle("");
      setDepartment("Operations");
      setAgentName("");
      setMandate("");
      setTools("");
      setSelectedSeatId(seat.id);
      await refresh();
    },
  });
  const instantiateBlueprint = useMutation({
    mutationFn: () =>
      requestJson<RecordValue>(
        "POST",
        `${root}/company-blueprint/instantiate`,
        { blueprintKey: blueprint.data?.blueprint?.key },
      ),
    onSuccess: async () => {
      await refresh();
    },
  });
  const applyRecommendedRoleTools = useMutation({
    mutationFn: (roleKeys: string[]) =>
      requestJson<RecordValue>(
        "POST",
        `${root}/company-blueprint/role-tools/apply`,
        {
          blueprintKey: blueprint.data?.blueprint?.key,
          roleKeys,
        },
      ),
    onSuccess: async () => {
      await refresh();
    },
  });
  const inviteHuman = useMutation({
    mutationFn: () =>
      requestJson<RecordValue>("POST", `${root}/invitations`, {
        email: inviteEmail.trim().toLowerCase(),
        seatId: inviteSeatId,
        purpose: "operate",
        classificationCeiling: "internal",
        portfolioScope: false,
      }),
    onSuccess: async () => {
      setInviteEmail("");
      setInviteSeatId("");
      await refresh();
    },
  });
  const saveTeamRoster = useMutation({
    mutationFn: () =>
      requestJson<RecordValue>("POST", `${root}/team-roster-plan`, {
        entries: teamRoster,
      }),
    onSuccess: async () => {
      await refresh();
    },
  });
  const invitePlannedMember = useMutation({
    mutationFn: (entry: TeamRosterEntry) =>
      requestJson<RecordValue>("POST", `${root}/invitations`, {
        email: entry.email.trim().toLowerCase(),
        seatId: entry.seatId,
        purpose: "operate",
        classificationCeiling: "internal",
        portfolioScope: false,
      }),
    onSuccess: async () => {
      await refresh();
    },
  });
  const importTeamRoster = () => {
    try {
      const imported = parseTeamRosterCsv(bulkRosterText);
      if (teamRoster.length + imported.length > 2000)
        throw new Error("EOS supports up to 2,000 staged people in one company plan.");
      const occupiedSeatIds = new Set((organization.data?.memberships || []).map((member: RecordValue) => member.seatId));
      const pendingSeatIds = new Set(
        (organization.data?.invitations || [])
          .filter((invitation: RecordValue) => ["pending", "pending_delivery"].includes(invitation.status))
          .map((invitation: RecordValue) => invitation.seatId),
      );
      const takenSeatIds = new Set<string>(
        teamRoster
          .map((entry) => entry.seatId)
          .filter((seatId): seatId is string => Boolean(seatId)),
      );
      occupiedSeatIds.forEach((seatId) => {
        if (typeof seatId === "string") takenSeatIds.add(seatId);
      });
      pendingSeatIds.forEach((seatId) => {
        if (typeof seatId === "string") takenSeatIds.add(seatId);
      });
      const rows = imported.map((row) => {
        const normalizedTitle = normalizedRosterRole(row.sourceTitle);
        const suggestedSeat = normalizedTitle
          ? seats.find((seat: RecordValue) =>
              !takenSeatIds.has(seat.id) &&
              seat.kind !== "founder" &&
              normalizedRosterRole(seat.title) === normalizedTitle,
            )
          : undefined;
        if (suggestedSeat) takenSeatIds.add(suggestedSeat.id);
        return {
          id: crypto.randomUUID(),
          ...row,
          seatId: suggestedSeat?.id || null,
        };
      });
      setTeamRoster((current) => [...current, ...rows]);
      setBulkRosterText("");
      setBulkRosterError("");
    } catch (error) {
      setBulkRosterError(error instanceof Error ? error.message : "EOS could not read that roster export.");
    }
  };
  const updateSeat = useMutation({
    mutationFn: (input: RecordValue) =>
      requestJson<RecordValue>("PATCH", `${root}/seats/${input.id}`, input),
    onSuccess: async () => {
      await refresh();
    },
  });
  const reconcileRoleTools = useMutation({
    mutationFn: (apply: boolean) =>
      requestJson<RecordValue>(
        "POST",
        `${root}/organization-runtime/tool-entitlements/reconcile`,
        { apply },
      ),
    onSuccess: async (result) => {
      if (result.applied) await refresh();
    },
  });
  const roleToolChanges = reconcileRoleTools.data?.changes || [];
  const rolesMissingBlueprintTools = (blueprint.data?.blueprint?.roles || [])
    .filter(
      (role: RecordValue) =>
        role.seatId && (role.missingRecommendedToolEntitlements || []).length,
    );
  const missingBlueprintToolCount = rolesMissingBlueprintTools.reduce(
    (total: number, role: RecordValue) =>
      total + role.missingRecommendedToolEntitlements.length,
    0,
  );

  const navigation: UniversalLayoutLeftRailItem[] = [
    {
      icon: BriefcaseBusiness,
      label: "Workspace",
      href: `/company/${companyId}`,
    },
    {
      icon: Network,
      label: "Org Studio",
      href: `/company/${companyId}/org-studio`,
      active: true,
    },
    {
      icon: Crown,
      label: "Company Mission",
      href: `/company-setup?companyId=${companyId}`,
    },
  ];

  if (context.isLoading || organization.isLoading)
    return (
      <UniversalLayout
        title="Org Studio"
        leftRailItems={navigation}
        floatingPanel={false}
      >
        <p className="p-6 text-sm text-muted-foreground">
          Compiling the visible company graph…
        </p>
      </UniversalLayout>
    );
  if (context.isError || organization.isError)
    return (
      <UniversalLayout
        title="Org Studio"
        leftRailItems={navigation}
        floatingPanel={false}
      >
        <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="font-medium">The company graph could not be loaded.</p>
          <Button className="mt-3" variant="outline" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      </UniversalLayout>
    );
  if (
    !(context.data?.principalContext?.allowedSurfaces || []).includes(
      "organization",
    )
  )
    return (
      <UniversalLayout
        title="Org Studio"
        leftRailItems={navigation}
        floatingPanel={false}
      >
        <div className="m-6 rounded-xl border p-5">
          <p className="font-medium">
            This role does not have access to Org Studio.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            EOS keeps roles, their people, and their authority visible only
            where the reporting and disclosure policy permits it.
          </p>
          <Button className="mt-4" asChild>
            <Link href={`/company/${companyId}`}>Return to my workspace</Link>
          </Button>
        </div>
      </UniversalLayout>
    );

  return (
    <UniversalLayout
      title="Org Studio"
      companyName={context.data?.company?.name}
      companyHref={`/company/${companyId}`}
      portfolioName={context.data?.portfolio?.name}
      portfolioHref={
        context.data?.portfolio?.id
          ? `/portfolios/${context.data.portfolio.id}`
          : "/portfolios"
      }
      roleName={context.data?.principalContext?.seat}
      leftRailItems={navigation}
      floatingPanel={false}
    >
      <section className="space-y-6">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eos-label">Company Operating Graph</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Org Studio
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The organization is a live operating graph: departments, roles,
              humans, agents, responsibilities, tools, authority, and reporting
              relationships all refer to the same company reality.
            </p>
          </div>
          <Button variant="outline" onClick={() => refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh graph
          </Button>
        </header>
        <div className="flex flex-wrap gap-2 rounded-xl bg-muted/50 p-2">
          <StudioTab
            active={view === "structure"}
            onClick={() => setView("structure")}
            label="Structure"
          />
          <StudioTab
            active={view === "tools"}
            onClick={() => setView("tools")}
            label="Role tools"
          />
          <StudioTab
            active={view === "authority"}
            onClick={() => setView("authority")}
            label="Authority & coverage"
          />
          {canDesign && (
            <StudioTab
              active={view === "team"}
              onClick={() => setView("team")}
              label="Team transition"
            />
          )}
        </div>
        {canDesign && view === "tools" && (
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eos-label">Role-tool alignment</p>
                <h2 className="mt-1 text-xl font-semibold">
                  Keep tools and authority in sync
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Review any older display-style tool names before EOS maps them
                  to the native policy keys that actually control access. Custom
                  tool labels are left unchanged.
                </p>
                {reconcileRoleTools.data && roleToolChanges.length === 0 && (
                  <p className="mt-3 text-sm font-medium text-primary">
                    Every active role already uses the current native tool keys.
                  </p>
                )}
                {roleToolChanges.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {roleToolChanges.map((change: RecordValue) => (
                      <div
                        key={change.seatId}
                        className="rounded-lg bg-white/80 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{change.title}</span>
                        <span className="ml-2 text-muted-foreground">
                          {(change.from || []).join(", ")} →{" "}
                          {(change.to || []).join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {reconcileRoleTools.isError && (
                  <p className="mt-3 text-sm text-destructive">
                    EOS could not prepare that reconciliation. Refresh the graph
                    and try again.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={reconcileRoleTools.isPending}
                  onClick={() => reconcileRoleTools.mutate(false)}
                >
                  {reconcileRoleTools.isPending
                    ? "Checking…"
                    : "Review role tools"}
                </Button>
                {roleToolChanges.length > 0 && (
                  <Button
                    disabled={reconcileRoleTools.isPending}
                    onClick={() => reconcileRoleTools.mutate(true)}
                  >
                    {reconcileRoleTools.isPending
                      ? "Applying…"
                      : `Apply ${roleToolChanges.length} repair${roleToolChanges.length === 1 ? "" : "s"}`}
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}
        {blueprint.data?.blueprint && (
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eos-label">
                  Business in a box · configured for this company
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {blueprint.data.blueprint.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {blueprint.data.blueprint.description} Each role becomes an
                  editable seat, role agent, operating pack, authority baseline,
                  reporting edge, and native tool surface—not an example card.
                </p>
                {blueprint.data.blueprint.formationPlan && (
                  <div className="mt-4 max-w-3xl rounded-xl border border-primary/20 bg-background/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="eos-label">Operating formation</p>
                        <p className="mt-1 text-sm font-medium">
                          {blueprint.data.blueprint.formationPlan.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {blueprint.data.blueprint.formationPlan.summary}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {blueprint.data.blueprint.formationPlan.humanAssignmentRule}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${blueprint.data.blueprint.formationPlan.state === "compiled" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {blueprint.data.blueprint.formationPlan.state === "compiled" ? "Compiled" : "Ready to compile"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {blueprint.data.blueprint.formationPlan.nextAction}
                      </p>
                      {canDesign && blueprint.data.blueprint.formationPlan.teamReconciliation === "required" && (
                        <Button size="sm" variant="outline" onClick={() => setView("team")}>
                          Review team transition
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {blueprint.data.blueprint.teamSnapshot && (
                  <div className="mt-4 max-w-3xl rounded-xl border bg-background/70 p-4">
                    <p className="eos-label">Declared starting team</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {blueprint.data.blueprint.teamSnapshot}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use the graph below to map people to seats. A human-occupied
                      seat keeps its role agent as that person&apos;s assistant.
                    </p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(blueprint.data.blueprint.roles || []).map(
                    (role: RecordValue) => (
                      <span
                        key={role.key}
                        className={`rounded-full px-2.5 py-1 text-xs ${role.state === "instantiated" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {role.state === "instantiated" ? "✓ " : ""}
                        {role.title}
                        {(role.missingRecommendedToolEntitlements || []).length
                          ? ` · ${role.missingRecommendedToolEntitlements.length} tool${role.missingRecommendedToolEntitlements.length === 1 ? "" : "s"} available`
                          : ""}
                      </span>
                    ),
                  )}
                </div>
                {(blueprint.data.blueprint.launchArtifacts || []).filter(
                  (artifact: RecordValue) => artifact.visible,
                ).length > 0 && (
                  <div className="mt-5 rounded-xl border border-primary/15 bg-white/80 p-4">
                    <p className="text-sm font-medium">
                      Compiled launch workflows
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Each company input has become a role-owned native workflow
                      draft plus its linked launch packet. Review or edit it in
                      Operations; it cannot run or create an external effect
                      until the existing authority, evidence, and release
                      controls are satisfied.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(blueprint.data.blueprint.launchArtifacts || [])
                        .filter((artifact: RecordValue) => artifact.visible)
                        .map((artifact: RecordValue) => (
                          <Link
                            key={artifact.key}
                            href={`/company/${companyId}#operations`}
                            className="rounded-lg bg-muted/70 px-3 py-2 text-sm transition-colors hover:bg-muted"
                          >
                            <span className="block font-medium">
                              {artifact.process?.name || artifact.title}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {artifact.process
                                ? `Draft workflow · v${artifact.process.version} · ${artifact.process.qualificationState.replaceAll("_", " ")}`
                                : "Workflow starter ready to compile"}
                            </span>
                            <span className="mt-2 block text-xs font-medium text-primary">
                              Open in Operations →
                            </span>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
                {(blueprint.data.blueprint.nativeAssets || []).filter(
                  (asset: RecordValue) => asset.visible,
                ).length > 0 && (
                  <div className="mt-5 rounded-xl border border-primary/15 bg-white/80 p-4">
                    <p className="text-sm font-medium">
                      Compiled native operating tools
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      These editable CRM, intake, and website drafts belong to
                      this company. They are native EOS records—not provider
                      placeholders—and remain private until an authorized
                      operator completes their normal activation controls.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(blueprint.data.blueprint.nativeAssets || [])
                        .filter((asset: RecordValue) => asset.visible)
                        .map((asset: RecordValue) => {
                          const focus = asset.instrumentKey === "crm"
                            ? "native-crm-studio"
                            : asset.instrumentKey === "forms"
                              ? "native-lead-capture"
                              : "native-funnel-studio";
                          const destination = asset.instrumentKey === "crm"
                            ? "Native CRM"
                            : asset.instrumentKey === "forms"
                              ? "Lead Capture Studio"
                              : "Website & Funnel Studio";
                          return <Link
                            key={asset.key}
                            href={`/company/${companyId}?focus=${focus}#work-room`}
                            className="rounded-lg bg-muted/70 px-3 py-2 text-sm transition-colors hover:bg-muted"
                          >
                            <span className="block font-medium">
                              {asset.title}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {asset.object
                                ? `Draft ${asset.instrumentKey} tool · v${asset.object.version}`
                                : "Tool starter ready to compile"}
                            </span>
                            <span className="mt-2 block text-xs font-medium text-primary">
                              Open {destination} →
                            </span>
                          </Link>
                        })}
                    </div>
                  </div>
                )}
              </div>
              {canDesign && (
                <div className="flex shrink-0 flex-col items-stretch gap-2">
                  <Button
                    disabled={
                      instantiateBlueprint.isPending || formationComplete
                    }
                    onClick={() => instantiateBlueprint.mutate()}
                  >
                    <SparklesIcon />
                    {instantiateBlueprint.isPending
                      ? "Applying company formation…"
                      : "Apply missing formation assets"}
                  </Button>
                  {instantiateBlueprint.isError && (
                    <p className="mt-2 max-w-xs text-xs text-destructive">
                      The company formation could not be applied. Refresh the
                      graph and try again.
                    </p>
                  )}
                  {rolesMissingBlueprintTools.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        disabled={applyRecommendedRoleTools.isPending}
                        onClick={() =>
                          applyRecommendedRoleTools.mutate(
                            rolesMissingBlueprintTools.map(
                              (role: RecordValue) => role.key,
                            ),
                          )
                        }
                      >
                        {applyRecommendedRoleTools.isPending
                          ? "Applying native tools…"
                          : `Apply ${missingBlueprintToolCount} recommended native tool${missingBlueprintToolCount === 1 ? "" : "s"}`}
                      </Button>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        Adds the current blueprint baseline to existing roles;
                        it never removes custom or manually assigned tools.
                      </p>
                    </>
                  )}
                  {applyRecommendedRoleTools.isError && (
                    <p className="max-w-xs text-xs text-destructive">
                      EOS could not apply the recommended native tools. Refresh
                      the graph and try again.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
        {view === "structure" && (
          <div className="space-y-5">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="eos-label">Department coverage</p>
                  <h2 className="mt-1 text-lg font-semibold">The operating functions behind this company</h2>
                </div>
                <p className="text-xs text-muted-foreground">Departments organize live role seats; they never broaden a role&apos;s authority.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {departments.map(([departmentName, departmentSeats]) => (
                  <div key={departmentName} className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-sm font-semibold">{departmentName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{departmentSeats.length} role{departmentSeats.length === 1 ? "" : "s"} · {departmentSeats.filter((seat) => seat.occupantUserId).length} human-led</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {departmentSeats.map((seat) => <button type="button" key={seat.id} onClick={() => setSelectedSeatId(seat.id)} className="rounded-full bg-background px-2 py-1 text-xs hover:bg-primary/10 hover:text-primary">{seat.title}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="h-[620px] overflow-hidden rounded-2xl border bg-[#f9f8fc]">
                <ReactFlow
                  nodes={graph.nodes}
                  edges={graph.edges}
                  fitView
                  fitViewOptions={{ padding: 0.25 }}
                  onNodeClick={(_, node) => setSelectedSeatId(node.id)}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                >
                  <Background color="#e7e2f4" gap={18} />
                  <MiniMap
                    nodeColor={(node) =>
                      seatColor(
                        seats.find((seat: RecordValue) => seat.id === node.id)
                          ?.kind || "individual_contributor",
                      )
                    }
                  />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
              <SeatInspector
                seat={selectedSeat}
                memberships={organization.data?.memberships || []}
                rolePacks={organization.data?.roleOperatingPacks || []}
                view={view}
              />
            </div>
          </div>
        )}
        {view === "team" && canDesign && (
          <TeamTransitionPlanner
            canSave={canPlanTeam}
            seats={seats}
            memberships={organization.data?.memberships || []}
            invitations={organization.data?.invitations || []}
            teamSnapshot={blueprint.data?.blueprint?.teamSnapshot || ""}
            entries={teamRoster}
            saving={saveTeamRoster.isPending}
            saveError={saveTeamRoster.isError}
            invitePending={invitePlannedMember.isPending}
            inviteError={invitePlannedMember.isError}
            bulkRosterText={bulkRosterText}
            bulkRosterError={bulkRosterError}
            onChange={setTeamRoster}
            onSave={() => saveTeamRoster.mutate()}
            onInvite={(entry) => invitePlannedMember.mutate(entry)}
            onBulkRosterTextChange={setBulkRosterText}
            onImport={importTeamRoster}
          />
        )}
        {(view === "tools" || view === "authority") && (
          <div className="grid gap-4 lg:grid-cols-2">
            {seats.map((seat: RecordValue) => (
              <SeatCard
                key={seat.id}
                seat={seat}
                selected={seat.id === selectedSeat?.id}
                view={view}
                onClick={() => setSelectedSeatId(seat.id)}
              />
            ))}
          </div>
        )}
        {canDesign && (
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 sm:p-6">
              <div>
                <p className="eos-label">Modify the company in place</p>
                <h2 className="mt-1 text-xl font-semibold">
                  Add an accountable role
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This creates a real seat, reporting edge, Role Agent, role
                  operating pack, and baseline authority—rather than a
                  decorative chart node.
                </p>
              </div>
              <div className="mt-6 grid gap-4">
                <Field label="Role title">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Head of Growth"
                  />
                </Field>
                <Field label="Department" hint="The operating function this role belongs to. It organizes the live graph; authority remains role-specific.">
                  <Input
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="Growth & Revenue"
                  />
                </Field>
                <Field label="Role Agent name">
                  <Input
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    placeholder="Defaults to Head of Growth Agent"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Role level">
                    <select
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="company_ceo">Company CEO</option>
                      <option value="functional_executive">
                        Functional executive
                      </option>
                      <option value="manager">Manager</option>
                      <option value="individual_contributor">
                        Individual contributor
                      </option>
                      <option value="external">External collaborator</option>
                    </select>
                  </Field>
                  <Field label="Reports to">
                    <select
                      value={supervisorSeatId}
                      onChange={(event) =>
                        setSupervisorSeatId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">My active seat</option>
                      {seats.map((seat: RecordValue) => (
                        <option key={seat.id} value={seat.id}>
                          {seat.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Accountable result">
                  <Textarea
                    value={mandate}
                    onChange={(event) => setMandate(event.target.value)}
                    placeholder="The result this role owns, not a list of activity."
                  />
                </Field>
                <Field
                  label="Native tool kit"
                  hint="Pick the capabilities this role actually operates. The selected tools—not a page shortcut—govern its workspace."
                >
                  <RoleToolPicker value={tools} onChange={setTools} />
                  <Textarea
                    className="mt-3"
                    value={tools}
                    onChange={(event) => setTools(event.target.value)}
                    placeholder="Optional custom operating-pack labels, comma-separated"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Custom labels document the role’s operating pack; only
                    selected native tools grant access to their EOS records.
                  </p>
                </Field>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Button
                  disabled={!title.trim() || createSeat.isPending}
                  onClick={() => createSeat.mutate()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createSeat.isPending
                    ? "Creating role…"
                    : "Create role in graph"}
                </Button>
                {createSeat.isError && (
                  <p className="text-sm text-destructive">
                    The role could not be created. Check the reporting role and
                    try again.
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 sm:p-6">
              <div>
                <p className="eos-label">Human + agent hybrid</p>
                <h2 className="mt-1 text-xl font-semibold">
                  Place a person in an existing role
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invite a person into a live seat. They must accept the exact
                  role; after acceptance the role agent stays with the seat as
                  their assistant.
                </p>
              </div>
              <div className="mt-6 grid gap-4">
                <Field label="Work email">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="person@company.com"
                  />
                </Field>
                <Field label="Role seat">
                  <select
                    value={inviteSeatId}
                    onChange={(event) => setInviteSeatId(event.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Choose an unoccupied role</option>
                    {seats
                      .filter(
                        (seat: RecordValue) =>
                          !seat.occupantUserId &&
                          seat.kind !== "founder" &&
                          !(organization.data?.invitations || []).some(
                            (invitation: RecordValue) =>
                              invitation.seatId === seat.id &&
                              ["pending", "pending_delivery"].includes(
                                invitation.status,
                              ),
                          ),
                      )
                      .map((seat: RecordValue) => (
                        <option key={seat.id} value={seat.id}>
                          {seat.title} · {seat.agentName}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <div className="mt-5">
                <Button
                  variant="secondary"
                  disabled={
                    !inviteEmail.includes("@") ||
                    !inviteSeatId ||
                    inviteHuman.isPending
                  }
                  onClick={() => inviteHuman.mutate()}
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  {inviteHuman.isPending
                    ? "Sending invitation…"
                    : "Send role invitation"}
                </Button>
                {inviteHuman.isError && (
                  <p className="mt-2 text-sm text-destructive">
                    The invitation could not be sent. Review the email and
                    selected role.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
        {canDesign && selectedSeat && (
          <SelectedSeatEditor
            key={selectedSeat.id}
            seat={selectedSeat}
            seats={seats}
            saving={updateSeat.isPending}
            error={updateSeat.isError}
            onSave={(input) => updateSeat.mutate(input)}
          />
        )}
      </section>
    </UniversalLayout>
  );
}

function StudioTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function TeamTransitionPlanner({
  canSave,
  seats,
  memberships,
  invitations,
  teamSnapshot,
  entries,
  saving,
  saveError,
  invitePending,
  inviteError,
  bulkRosterText,
  bulkRosterError,
  onChange,
  onSave,
  onInvite,
  onBulkRosterTextChange,
  onImport,
}: {
  canSave: boolean;
  seats: RecordValue[];
  memberships: RecordValue[];
  invitations: RecordValue[];
  teamSnapshot: string;
  entries: TeamRosterEntry[];
  saving: boolean;
  saveError: boolean;
  invitePending: boolean;
  inviteError: boolean;
  bulkRosterText: string;
  bulkRosterError: string;
  onChange: (entries: TeamRosterEntry[]) => void;
  onSave: () => void;
  onInvite: (entry: TeamRosterEntry) => void;
  onBulkRosterTextChange: (value: string) => void;
  onImport: () => void;
}) {
  const update = (id: string, patch: Partial<TeamRosterEntry>) =>
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  const occupiedSeatIds = new Set(memberships.map((member) => member.seatId));
  const pendingSeatIds = new Set(
    invitations
      .filter((invitation) => ["pending", "pending_delivery"].includes(invitation.status))
      .map((invitation) => invitation.seatId),
  );
  const suggestedSeatIds = suggestedTeamRosterSeats(entries, seats.map((seat) => ({
    id: String(seat.id),
    title: typeof seat.title === "string" ? seat.title : "",
    kind: typeof seat.kind === "string" ? seat.kind : "",
  })), [
    ...Array.from(occupiedSeatIds),
    ...Array.from(pendingSeatIds),
  ]);
  const mappedCount = entries.filter((entry) => entry.seatId).length;
  const addEntry = () =>
    onChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        name: "",
        email: "",
        sourceTitle: "",
        reportsTo: "",
        seatId: null,
      },
    ]);

  return (
    <section className="space-y-5 rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eos-label">Established-team transition</p>
          <h2 className="mt-1 text-xl font-semibold">Map people before access is granted</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            This is the same Company Mission and operating graph used by a new
            agent-first business. Stage your existing people against EOS roles
            first; saving this plan never sends an email, creates a membership,
            or displaces an agent. A deliberate role invitation is the only
            step that gives a person access and turns that role agent into their assistant.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs">
          <MetricChip value={entries.length} label="planned" />
          <MetricChip value={mappedCount} label="mapped" />
          <MetricChip value={memberships.length} label="active people" />
        </div>
      </div>
      {teamSnapshot && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mission input</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{teamSnapshot}</p>
        </div>
      )}
      {canSave && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">Import an existing team roster</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste CSV with a Name or Work email column. Current title and Reports to are optional. EOS only suggests exact title-to-seat matches; review every map before saving.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">Planning only</span>
          </div>
          <Textarea
            className="mt-4 min-h-28 font-mono text-xs"
            value={bulkRosterText}
            onChange={(event) => onBulkRosterTextChange(event.target.value)}
            placeholder={"Name,Work email,Current title,Reports to\nAlex Rivera,alex@example.com,Operations Director,Founder"}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={!bulkRosterText.trim()} onClick={onImport}>
              Add pasted roster to plan
            </Button>
            {bulkRosterError && <p className="text-sm text-destructive">{bulkRosterError}</p>}
          </div>
        </div>
      )}
      {!canSave && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950">
          You can inspect the company transition plan, but only the founder can
          change it. EOS keeps a company’s initial identity and access plan under founder authority.
        </div>
      )}
      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No people are staged yet. Add the real team one person at a time,
            or start agent-first and add people only when the company is ready.
          </div>
        )}
        {entries.map((entry) => {
          const targetSeat = seats.find((seat) => seat.id === entry.seatId);
          const suggestedSeat = seats.find((seat) => seat.id === suggestedSeatIds.get(entry.id));
          const seatUnavailable = Boolean(
            entry.seatId && (occupiedSeatIds.has(entry.seatId) || pendingSeatIds.has(entry.seatId)),
          );
          const canInvite = Boolean(entry.email && entry.seatId && !seatUnavailable);
          return (
            <div key={entry.id} className="rounded-xl border bg-background p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
                <Field label="Person">
                  <Input value={entry.name} onChange={(event) => update(entry.id, { name: event.target.value })} placeholder="Full name" />
                </Field>
                <Field label="Work email">
                  <Input type="email" value={entry.email} onChange={(event) => update(entry.id, { email: event.target.value })} placeholder="person@company.com" />
                </Field>
                <Field label="Current title">
                  <Input value={entry.sourceTitle} onChange={(event) => update(entry.id, { sourceTitle: event.target.value })} placeholder="Current responsibility" />
                </Field>
                <Field label="Reports to">
                  <Input value={entry.reportsTo} onChange={(event) => update(entry.id, { reportsTo: event.target.value })} placeholder="Current manager" />
                </Field>
                <Field label="EOS role seat">
                  <select
                    value={entry.seatId || ""}
                    onChange={(event) => update(entry.id, { seatId: event.target.value || null })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Map later</option>
                    {seats.filter((seat) => seat.kind !== "founder").map((seat) => (
                      <option key={seat.id} value={seat.id} disabled={occupiedSeatIds.has(seat.id) || pendingSeatIds.has(seat.id)}>
                        {seat.title}{occupiedSeatIds.has(seat.id) ? " · occupied" : pendingSeatIds.has(seat.id) ? " · invitation pending" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {canSave && (
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onChange(entries.filter((candidate) => candidate.id !== entry.id))}>
                    Remove
                  </Button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {targetSeat
                    ? seatUnavailable
                      ? "This role already has a person or pending invitation. Resolve it before inviting anyone else."
                      : `${targetSeat.agentName} will remain with this seat as the human’s assistant after acceptance.`
                    : "Choose a role seat when you are ready to map this person into the operating graph."}
                </span>
                {suggestedSeat && !targetSeat && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-2.5 py-1 text-primary">
                    Exact role match: {suggestedSeat.title}
                    {canSave && <button type="button" className="font-medium underline underline-offset-2" onClick={() => update(entry.id, { seatId: suggestedSeat.id })}>Use match</button>}
                  </span>
                )}
                {canSave && (
                  <Button size="sm" variant="outline" disabled={!canInvite || invitePending} onClick={() => onInvite(entry)}>
                    {invitePending ? "Sending…" : "Invite to mapped role"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canSave && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-5">
          <Button variant="outline" onClick={addEntry}>
            <Plus className="mr-2 h-4 w-4" /> Add person to plan
          </Button>
          <Button disabled={saving || entries.some((entry) => !entry.name && !entry.email)} onClick={onSave}>
            {saving ? "Saving team plan…" : "Save team plan"}
          </Button>
          {saveError && <p className="text-sm text-destructive">EOS could not save the team plan. Check each row and try again.</p>}
          {inviteError && <p className="text-sm text-destructive">The invitation could not be sent. Check the mapped seat and work email.</p>}
        </div>
      )}
    </section>
  );
}

function MetricChip({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-base font-semibold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
function SparklesIcon() {
  return (
    <span className="mr-2 text-base leading-none" aria-hidden="true">
      ✦
    </span>
  );
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eos-label">{label}</span>
      {hint && (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function SelectedSeatEditor({
  seat,
  seats,
  saving,
  error,
  onSave,
}: {
  seat: RecordValue;
  seats: RecordValue[];
  saving: boolean;
  error: boolean;
  onSave: (input: RecordValue) => void;
}) {
  const [tools, setTools] = useState((seat.toolEntitlements || []).join(", "));
  return (
    <details className="rounded-2xl border bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        Edit selected role · {seat.title}
      </summary>
      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          onSave({
            id: seat.id,
            title: values.get("title"),
            agentName: values.get("agentName"),
            mandate: values.get("mandate"),
            toolEntitlements: tools
              .split(",")
              .map((item: string) => item.trim())
              .filter(Boolean),
            supervisorSeatId:
              String(values.get("supervisorSeatId") || "") || null,
          });
        }}
      >
        <Field label="Role title">
          <Input name="title" defaultValue={seat.title} />
        </Field>
        <Field label="Role Agent name">
          <Input name="agentName" defaultValue={seat.agentName} />
        </Field>
        <Field label="Accountable result">
          <Textarea name="mandate" defaultValue={seat.mandate || ""} />
        </Field>
        <Field
          label="Native tool kit"
          hint="Select the native capabilities this role operates. Custom labels remain available when required."
        >
          <RoleToolPicker value={tools} onChange={setTools} />
          <Input
            className="mt-3"
            value={tools}
            onChange={(event) => setTools(event.target.value)}
            placeholder="Optional custom operating-pack labels"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Custom labels are descriptive. Native tool selections control
            access to EOS records.
          </p>
        </Field>
        <Field label="Reports to">
          <select
            name="supervisorSeatId"
            defaultValue={seat.supervisorSeatId || ""}
            disabled={seat.kind === "founder"}
          >
            <option value="">No supervisor</option>
            {seats
              .filter((candidate: RecordValue) => candidate.id !== seat.id)
              .map((candidate: RecordValue) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={saving}>
            Save role changes
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive">
            EOS could not update this role. Review its reporting line and
            authority.
          </p>
        )}
      </form>
    </details>
  );
}
function SeatInspector({
  seat,
  memberships,
  rolePacks,
}: {
  seat?: RecordValue;
  memberships: RecordValue[];
  rolePacks: RecordValue[];
  view: StudioView;
}) {
  if (!seat)
    return (
      <aside className="rounded-2xl border bg-white p-5">
        <p className="text-sm text-muted-foreground">
          Select a role in the graph to inspect it.
        </p>
      </aside>
    );
  const occupant = memberships.find((member) => member.seatId === seat.id);
  const pack = rolePacks.find(
    (item) => item.seatId === seat.id && item.status === "active",
  );
  return (
    <aside className="rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eos-label">{seatLabel(seat.kind)}</p>
          <h2 className="mt-1 text-xl font-semibold">{seat.title}</h2>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {seat.agentMode === "assistant" ? "hybrid" : "agent-operated"}
        </span>
      </div>
      <div className="mt-5 space-y-4 text-sm">
        <InspectorRow
          icon={BriefcaseBusiness}
          label="Department"
          value={seat.department || "General Management"}
        />
        <InspectorRow icon={Bot} label="Role Agent" value={seat.agentName} />
        <InspectorRow
          icon={UserRound}
          label="Human director"
          value={
            occupant ? occupant.fullName || occupant.email : "No human occupant"
          }
        />
        <InspectorRow
          icon={BriefcaseBusiness}
          label="Accountable result"
          value={seat.mandate || "Awaiting mandate"}
        />
        <InspectorRow
          icon={Wrench}
          label="Tools"
          value={
            (seat.toolEntitlements || []).length
              ? seat.toolEntitlements.join(", ")
              : "No tool entitlements assigned"
          }
        />
        <InspectorRow
          icon={Network}
          label="Role operating pack"
          value={
            pack
              ? `v${pack.version} · ${pack.status}`
              : "Will be compiled when this role is created"
          }
        />
      </div>
    </aside>
  );
}
function InspectorRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 leading-relaxed">{value}</p>
    </div>
  );
}
function SeatCard({
  seat,
  selected,
  view,
  onClick,
}: {
  seat: RecordValue;
  selected: boolean;
  view: StudioView;
  onClick: () => void;
}) {
  const content =
    view === "tools"
      ? (seat.toolEntitlements || []).length
        ? seat.toolEntitlements.join(", ")
        : "No native tools assigned"
      : `${seat.agentMode === "assistant" ? "Human-directed role agent" : "Autonomous role agent"} · ${seat.mandate || "Mandate awaiting definition"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-5 text-left transition-colors ${selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <span><span className="block font-semibold">{seat.title}</span><span className="mt-1 block text-xs text-primary/75">{seat.department || "General Management"}</span></span>
        <span className="text-xs text-muted-foreground">
          {seatLabel(seat.kind)}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{content}</p>
    </button>
  );
}
