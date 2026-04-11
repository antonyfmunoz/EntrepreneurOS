import { useState, useMemo, useCallback } from "react";
import { useParams } from "wouter";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  UserCircle2,
  Plus,
  Sparkles,
  Bot,
  Home,
  CheckSquare,
  Workflow,
  Settings as SettingsIcon,
  X,
} from "lucide-react";

// ── Domain types ─────────────────────────────────────────────────────────────

interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
}

interface Role {
  id: string;
  companyId: string;
  departmentId: string;
  title: string;
  parentRoleId: string | null;
  responsibilities: string | null;
  assignedUserId: string | null;
  agentSlot: string | null;
}

type OrgNodeData =
  | { kind: "department"; department: Department; roleCount: number }
  | { kind: "role"; role: Role };

// ── Custom node components ───────────────────────────────────────────────────
// Glassmorphism cards on a neutral canvas, matching the Ethereal Professional
// design system. No gradients — solid #6a37d4 accents only.

function DepartmentNode({ data }: NodeProps<Node<Extract<OrgNodeData, { kind: "department" }>>>) {
  const { department, roleCount } = data;
  return (
    <div
      className="rounded-[20px] px-6 py-5 min-w-[240px]"
      style={{
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
        border: "1px solid #6a37d4",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#6a37d4" }} />
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6a37d4]">
          Department
        </span>
        <Building2 className="w-4 h-4 text-[#6a37d4]" />
      </div>
      <h3 className="text-lg font-bold text-[#2c2f30] leading-tight mb-1">{department.name}</h3>
      {department.description && (
        <p className="text-xs text-[#595c5d] line-clamp-2 mb-3">{department.description}</p>
      )}
      <div className="flex items-center gap-2 pt-3 border-t border-[#abadae]/20">
        <UserCircle2 className="w-3.5 h-3.5 text-[#595c5d]" />
        <span className="text-xs font-medium text-[#595c5d]">
          {roleCount} {roleCount === 1 ? "role" : "roles"}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#6a37d4" }} />
    </div>
  );
}

function RoleNode({ data }: NodeProps<Node<Extract<OrgNodeData, { kind: "role" }>>>) {
  const { role } = data;
  const assigned = role.assignedUserId ?? "Unassigned";
  return (
    <div
      className="rounded-[16px] px-5 py-4 min-w-[220px]"
      style={{
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(106, 55, 212, 0.06)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#abadae" }} />
      <div className="flex items-start justify-between gap-3 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#595c5d]">
          Role
        </span>
        <UserCircle2 className="w-4 h-4 text-[#6448b2]" />
      </div>
      <h4 className="text-sm font-bold text-[#2c2f30] leading-tight mb-2">{role.title}</h4>
      {role.responsibilities && (
        <p className="text-[11px] text-[#595c5d] line-clamp-2 mb-3">{role.responsibilities}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          className="text-[10px] font-medium"
          style={{
            background: "#eceeef",
            color: "#2c2f30",
            border: "none",
          }}
        >
          <UserCircle2 className="w-3 h-3 mr-1" />
          {assigned}
        </Badge>
        {role.agentSlot && (
          <Badge
            className="text-[10px] font-medium"
            style={{
              background: "#6a37d4",
              color: "#ffffff",
              border: "none",
            }}
          >
            <Bot className="w-3 h-3 mr-1" />
            {role.agentSlot}
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#abadae" }} />
    </div>
  );
}

const NODE_TYPES = {
  department: DepartmentNode,
  role: RoleNode,
};

// ── Static placeholder data ──────────────────────────────────────────────────
// The page is stub-first — real fetches will be wired in a later pass.

const PLACEHOLDER_DEPARTMENTS: Department[] = [];
const PLACEHOLDER_ROLES: Role[] = [];

function computeGraph(
  departments: Department[],
  roles: Role[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Departments across the top row, roles stacked under each.
  const xStep = 320;
  const yDept = 40;
  const yRoleStart = 220;
  const yRoleStep = 160;

  departments.forEach((dept, i) => {
    const rolesInDept = roles.filter((r) => r.departmentId === dept.id);
    nodes.push({
      id: `dept-${dept.id}`,
      type: "department",
      position: { x: i * xStep, y: yDept },
      data: { kind: "department", department: dept, roleCount: rolesInDept.length },
    });

    rolesInDept.forEach((role, j) => {
      const roleNodeId = `role-${role.id}`;
      nodes.push({
        id: roleNodeId,
        type: "role",
        position: { x: i * xStep, y: yRoleStart + j * yRoleStep },
        data: { kind: "role", role },
      });
      edges.push({
        id: `edge-${dept.id}-${role.id}`,
        source: `dept-${dept.id}`,
        target: roleNodeId,
        style: { stroke: "#abadae", strokeWidth: 1.5 },
        animated: false,
      });
    });
  });

  return { nodes, edges };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const params = useParams<{ companyId?: string }>();
  const companyId = params.companyId ?? "default";

  // Stub state — will be fed by GET /api/companies/:id/departments and
  // /api/companies/:id/roles in a follow-up pass.
  const [departments] = useState<Department[]>(PLACEHOLDER_DEPARTMENTS);
  const [roles] = useState<Role[]>(PLACEHOLDER_ROLES);

  const initialGraph = useMemo(() => computeGraph(departments, roles), [departments, roles]);
  const [nodes, , onNodesChange] = useNodesState<Node>(initialGraph.nodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialGraph.edges);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    if (node.type === "role") {
      const data = node.data as Extract<OrgNodeData, { kind: "role" }>;
      setSelectedRoleId(data.role.id);
    }
  }, []);

  const leftRailItems = [
    { icon: Home, label: "Home", href: `/company/${companyId}`, active: false },
    { icon: CheckSquare, label: "Tasks", href: `/company/${companyId}/tasks`, active: false },
    { icon: Workflow, label: "Workflows", href: `/company/${companyId}/workflows`, active: false },
    { icon: Building2, label: "Org Chart", href: `/company/${companyId}/org`, active: true },
    { icon: SettingsIcon, label: "Settings", href: `/settings`, active: false },
  ];

  const isEmpty = departments.length === 0;

  return (
    <UniversalLayout title="Org Chart" leftRailItems={leftRailItems}>
      <div className="flex flex-col h-[calc(100vh-8rem)] -mx-8 -my-8">
        {/* Header band */}
        <header className="flex items-center justify-between px-10 py-6 border-b border-[#abadae]/10 bg-white">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6a37d4] block mb-2">
              Structure Over Discipline
            </span>
            <h1 className="text-3xl font-bold text-[#2c2f30]">Org Chart</h1>
            <p className="text-sm text-[#595c5d] mt-1">
              Your company's operating structure — departments, roles, and agent slots.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-xl text-sm font-semibold"
              style={{ borderColor: "#abadae", color: "#2c2f30" }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add department
            </Button>
            <Button
              className="rounded-xl text-sm font-semibold text-white"
              style={{ background: "#6a37d4" }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add role
            </Button>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 relative" style={{ background: "#f5f6f7" }}>
          {isEmpty ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="max-w-md text-center rounded-[24px] px-10 py-12"
                style={{
                  background: "rgba(255, 255, 255, 0.75)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "#eceeef" }}
                >
                  <Building2 className="w-7 h-7 text-[#6a37d4]" />
                </div>
                <h2 className="text-xl font-bold text-[#2c2f30] mb-2">No structure yet</h2>
                <p className="text-sm text-[#595c5d] mb-6 leading-relaxed">
                  No structure yet. Generate a recommended org based on your company stage, or
                  build from scratch.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    className="rounded-xl text-sm font-semibold text-white"
                    style={{ background: "#6a37d4" }}
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Generate recommended
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl text-sm font-semibold"
                    style={{ borderColor: "#abadae", color: "#2c2f30" }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Start from scratch
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={NODE_TYPES}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#abadae" gap={24} size={1} />
              <Controls
                showInteractive={false}
                style={{
                  background: "rgba(255,255,255,0.8)",
                  backdropFilter: "blur(16px)",
                  borderRadius: "12px",
                  border: "none",
                }}
              />
              <MiniMap
                nodeColor="#6a37d4"
                maskColor="rgba(245, 246, 247, 0.7)"
                style={{
                  background: "rgba(255,255,255,0.8)",
                  borderRadius: "12px",
                }}
              />
            </ReactFlow>
          )}

          {/* Detail drawer for selected role */}
          {selectedRole && (
            <aside
              className="absolute top-0 right-0 bottom-0 w-[360px] border-l border-[#abadae]/10 p-8 overflow-y-auto"
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6a37d4] block mb-1">
                    Role detail
                  </span>
                  <h3 className="text-xl font-bold text-[#2c2f30]">{selectedRole.title}</h3>
                </div>
                <button
                  className="p-2 rounded-lg hover:bg-[#eceeef] transition-colors"
                  onClick={() => setSelectedRoleId(null)}
                  aria-label="Close role detail"
                >
                  <X className="w-4 h-4 text-[#595c5d]" />
                </button>
              </div>

              {selectedRole.responsibilities && (
                <section className="mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#595c5d] mb-2">
                    Responsibilities
                  </h4>
                  <p className="text-sm text-[#2c2f30] leading-relaxed">
                    {selectedRole.responsibilities}
                  </p>
                </section>
              )}

              <section className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#595c5d] mb-2">
                  Assignment
                </h4>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#f5f6f7]">
                  <UserCircle2 className="w-5 h-5 text-[#6a37d4]" />
                  <span className="text-sm font-medium text-[#2c2f30]">
                    {selectedRole.assignedUserId ?? "Unassigned"}
                  </span>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#595c5d] mb-2">
                  AI agent slot
                </h4>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#f5f6f7]">
                  <Bot className="w-5 h-5 text-[#6a37d4]" />
                  <span className="text-sm font-medium text-[#2c2f30]">
                    {selectedRole.agentSlot ?? "No agent assigned"}
                  </span>
                </div>
              </section>
            </aside>
          )}
        </div>
      </div>
    </UniversalLayout>
  );
}
