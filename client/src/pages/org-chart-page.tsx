import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  Trash2,
  Sparkles,
  Building2,
  Home,
  CheckSquare,
  Workflow,
  Settings as SettingsIcon,
  X,
  UserCircle2,
} from "lucide-react";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Role {
  id: string;
  title: string;
  departmentId: string;
  parentRoleId?: string;
  responsibilities?: string;
  assignedUserId?: string;
  agentSlot?: boolean;
}

interface AgentSlotBadgeProps {
  active?: boolean;
}

function AgentSlotBadge({ active }: AgentSlotBadgeProps) {
  return (
    <div
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
      style={{
        background: active
          ? "rgba(106, 55, 212, 0.12)"
          : "rgba(171, 173, 174, 0.1)",
        color: active ? "#6a37d4" : "#595c5d",
      }}
    >
      <Bot className="w-3 h-3" />
      <span>{active ? "AI slot" : "Open"}</span>
    </div>
  );
}

interface RoleCardProps {
  role: Role;
  onSelect: (role: Role) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
}

function RoleCard({ role, onSelect, onDelete, isSelected }: RoleCardProps) {
  return (
    <div
      onClick={() => onSelect(role)}
      className="relative cursor-pointer transition-all duration-200 group"
      style={{
        padding: "20px 24px",
        background: isSelected
          ? "rgba(106, 55, 212, 0.08)"
          : "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(16px)",
        borderRadius: "12px",
        boxShadow: isSelected
          ? "0 8px 32px rgba(106, 55, 212, 0.12)"
          : "0 8px 32px rgba(106, 55, 212, 0.06)",
        border: isSelected
          ? "1px solid rgba(106, 55, 212, 0.2)"
          : "1px solid transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4
            className="font-semibold text-sm mb-1"
            style={{ color: "#2c2f30" }}
          >
            {role.title}
          </h4>
          {role.responsibilities && (
            <p
              className="text-xs line-clamp-2 mb-2"
              style={{ color: "#595c5d" }}
            >
              {role.responsibilities}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {role.assignedUserId ? (
              <div
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(171, 173, 174, 0.1)",
                  color: "#595c5d",
                }}
              >
                <User className="w-3 h-3" />
                <span>Assigned</span>
              </div>
            ) : (
              <AgentSlotBadge active={role.agentSlot} />
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(role.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/60 rounded-lg"
        >
          <Trash2 className="w-4 h-4" style={{ color: "#595c5d" }} />
        </button>
      </div>
    </div>
  );
}

interface AddRoleButtonProps {
  departmentId: string;
  onAdd: (departmentId: string) => void;
}

function AddRoleButton({ departmentId, onAdd }: AddRoleButtonProps) {
  return (
    <button
      onClick={() => onAdd(departmentId)}
      className="w-full transition-all duration-200 hover:border-[#6a37d4]/30"
      style={{
        padding: "12px",
        background: "rgba(255, 255, 255, 0.5)",
        backdropFilter: "blur(16px)",
        borderRadius: "12px",
        border: "1px dashed rgba(171, 173, 174, 0.3)",
      }}
    >
      <div className="flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" style={{ color: "#6a37d4" }} />
        <span className="text-sm font-medium" style={{ color: "#6a37d4" }}>
          Add role
        </span>
      </div>
    </button>
  );
}

interface DepartmentCardProps {
  department: Department;
  roles: Role[];
  onSelectRole: (role: Role) => void;
  onDeleteRole: (id: string) => void;
  onDeleteDepartment: (id: string) => void;
  onAddRole: (departmentId: string) => void;
  selectedRoleId?: string;
}

function DepartmentCard({
  department,
  roles,
  onSelectRole,
  onDeleteRole,
  onDeleteDepartment,
  onAddRole,
  selectedRoleId,
}: DepartmentCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="group transition-all duration-200"
      style={{
        padding: "24px",
        background: "#eff1f2",
        borderRadius: "12px",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-5 h-5" style={{ color: "#2c2f30" }} />
            ) : (
              <ChevronRight
                className="w-5 h-5"
                style={{ color: "#2c2f30" }}
              />
            )}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#6a37d4" }}
              >
                Department
              </span>
            </div>
            <h3
              className="font-semibold text-base"
              style={{ color: "#2c2f30" }}
            >
              {department.name}
            </h3>
            {department.description && (
              <p className="text-sm mt-1" style={{ color: "#595c5d" }}>
                {department.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255, 255, 255, 0.6)" }}
            >
              <UserCircle2
                className="w-3.5 h-3.5"
                style={{ color: "#595c5d" }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: "#595c5d" }}
              >
                {roles.length} {roles.length === 1 ? "role" : "roles"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDeleteDepartment(department.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/50 rounded-lg ml-2"
        >
          <Trash2 className="w-4 h-4" style={{ color: "#595c5d" }} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pl-8">
          {roles.length === 0 ? (
            <div
              className="text-center py-8"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                borderRadius: "12px",
              }}
            >
              <Bot
                className="w-8 h-8 mx-auto mb-2"
                style={{ color: "#abadae" }}
              />
              <p className="text-sm mb-3" style={{ color: "#595c5d" }}>
                No roles yet. Add your first role to define responsibilities.
              </p>
              <AddRoleButton departmentId={department.id} onAdd={onAddRole} />
            </div>
          ) : (
            <>
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onSelect={onSelectRole}
                  onDelete={onDeleteRole}
                  isSelected={selectedRoleId === role.id}
                />
              ))}
              <AddRoleButton departmentId={department.id} onAdd={onAddRole} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface RoleDetailPanelProps {
  role: Role | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (role: Role) => void;
}

function RoleDetailPanel({
  role,
  open,
  onClose,
  onUpdate,
}: RoleDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [agentSlot, setAgentSlot] = useState(false);

  useEffect(() => {
    if (role) {
      setTitle(role.title);
      setResponsibilities(role.responsibilities || "");
      setAgentSlot(role.agentSlot || false);
    }
  }, [role]);

  const handleSave = () => {
    if (!role) return;
    onUpdate({
      ...role,
      title,
      responsibilities,
      agentSlot,
    });
    onClose();
  };

  if (!role) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md" style={{ background: "#f5f6f7" }}>
        <SheetHeader>
          <SheetTitle style={{ color: "#2c2f30" }}>
            <span
              className="text-[10px] font-bold uppercase tracking-widest block mb-1"
              style={{ color: "#6a37d4" }}
            >
              Role detail
            </span>
            Edit role
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div>
            <Label
              htmlFor="role-title-edit"
              className="text-sm font-medium"
              style={{ color: "#2c2f30" }}
            >
              Role title
            </Label>
            <Input
              id="role-title-edit"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Head of Engineering"
              className="mt-2"
              style={{ borderRadius: "12px" }}
            />
          </div>
          <div>
            <Label
              htmlFor="role-responsibilities-edit"
              className="text-sm font-medium"
              style={{ color: "#2c2f30" }}
            >
              Responsibilities
            </Label>
            <Textarea
              id="role-responsibilities-edit"
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="Key areas of ownership and expected outcomes"
              className="mt-2 min-h-[120px]"
              style={{ borderRadius: "12px" }}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="agentSlot-edit"
              checked={agentSlot}
              onChange={(e) => setAgentSlot(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: "#6a37d4" }}
            />
            <Label
              htmlFor="agentSlot-edit"
              className="text-sm cursor-pointer"
              style={{ color: "#2c2f30" }}
            >
              Enable AI agent slot for this role
            </Label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 text-white"
              style={{ background: "#6a37d4", borderRadius: "12px" }}
            >
              Save changes
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              style={{
                borderColor: "#abadae",
                color: "#2c2f30",
                borderRadius: "12px",
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function OrgChartPage() {
  const params = useParams<{ companyId?: string }>();
  const companyId = params.companyId ?? "default";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentDesc, setNewDepartmentDesc] = useState("");
  const [newRoleTitle, setNewRoleTitle] = useState("");

  const {
    data: departments = [],
    isLoading: loadingDepartments,
    error: departmentsError,
  } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/departments`);
      if (!res.ok) throw new Error("Failed to load departments");
      return res.json();
    },
  });

  const {
    data: roles = [],
    isLoading: loadingRoles,
    error: rolesError,
  } = useQuery({
    queryKey: ["roles", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/roles`);
      if (!res.ok) throw new Error("Failed to load roles");
      return res.json();
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch(`/api/companies/${companyId}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create department");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", companyId] });
      setShowAddDepartment(false);
      setNewDepartmentName("");
      setNewDepartmentDesc("");
      toast({ title: "Department created" });
    },
    onError: () => {
      toast({ title: "Failed to create department", variant: "destructive" });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { title: string; departmentId: string }) => {
      const res = await fetch(`/api/companies/${companyId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", companyId] });
      setShowAddRole(false);
      setNewRoleTitle("");
      toast({ title: "Role created" });
    },
    onError: () => {
      toast({ title: "Failed to create role", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: Role) => {
      const res = await fetch(`/api/companies/${companyId}/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", companyId] });
      toast({ title: "Role updated" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/companies/${companyId}/departments/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete department");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", companyId] });
      queryClient.invalidateQueries({ queryKey: ["roles", companyId] });
      toast({ title: "Department deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete department", variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${companyId}/roles/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete role");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", companyId] });
      toast({ title: "Role deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete role", variant: "destructive" });
    },
  });

  const generateDefaultStructureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/org/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate structure");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", companyId] });
      queryClient.invalidateQueries({ queryKey: ["roles", companyId] });
      toast({ title: "Org structure generated" });
    },
    onError: () => {
      toast({ title: "Failed to generate structure", variant: "destructive" });
    },
  });

  const isLoading = loadingDepartments || loadingRoles;
  const error = departmentsError || rolesError;

  const handleAddRole = (departmentId: string) => {
    setTargetDepartmentId(departmentId);
    setShowAddRole(true);
  };

  const handleCreateDepartment = () => {
    if (!newDepartmentName.trim()) return;
    createDepartmentMutation.mutate({
      name: newDepartmentName,
      description: newDepartmentDesc || undefined,
    });
  };

  const handleCreateRole = () => {
    if (!newRoleTitle.trim()) return;
    createRoleMutation.mutate({
      title: newRoleTitle,
      departmentId: targetDepartmentId,
    });
  };

  const leftRailItems = [
    {
      icon: Home,
      label: "Home",
      href: `/company/${companyId}`,
      active: false,
    },
    {
      icon: CheckSquare,
      label: "Tasks",
      href: `/company/${companyId}/tasks`,
      active: false,
    },
    {
      icon: Workflow,
      label: "Workflows",
      href: `/company/${companyId}/workflows`,
      active: false,
    },
    {
      icon: Building2,
      label: "Org Chart",
      href: `/company/${companyId}/org`,
      active: true,
    },
    {
      icon: SettingsIcon,
      label: "Settings",
      href: `/settings`,
      active: false,
    },
  ];

  const isEmpty = !isLoading && !error && departments.length === 0;

  return (
    <UniversalLayout title="Org Chart" leftRailItems={leftRailItems}>
      <div className="flex flex-col h-[calc(100vh-8rem)] -mx-8 -my-8">
        <header
          className="flex items-center justify-between px-10 py-6 border-b bg-white"
          style={{ borderColor: "rgba(171, 173, 174, 0.1)" }}
        >
          <div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] block mb-2"
              style={{ color: "#6a37d4" }}
            >
              Structure Over Discipline
            </span>
            <h1
              className="text-3xl font-bold leading-tight"
              style={{ color: "#2c2f30" }}
            >
              Org Chart
            </h1>
            <p className="text-sm mt-1" style={{ color: "#595c5d" }}>
              Your company's operating structure — departments, roles, and agent
              slots.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="text-sm font-semibold"
              style={{
                borderColor: "#abadae",
                color: "#2c2f30",
                borderRadius: "12px",
              }}
              onClick={() => setShowAddDepartment(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Add department
            </Button>
            <Button
              className="text-sm font-semibold text-white"
              style={{ background: "#6a37d4", borderRadius: "12px" }}
              onClick={() => {
                if (departments.length > 0) {
                  setTargetDepartmentId(departments[0].id);
                  setShowAddRole(true);
                } else {
                  toast({
                    title: "Create a department first",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add role
            </Button>
          </div>
        </header>

        <div
          className="flex-1 overflow-auto"
          style={{ background: "#f5f6f7", padding: "32px" }}
        >
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    height: "200px",
                    background: "#eff1f2",
                    borderRadius: "12px",
                  }}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="max-w-md text-center px-10 py-12"
                style={{
                  background: "rgba(255, 255, 255, 0.75)",
                  backdropFilter: "blur(16px)",
                  borderRadius: "24px",
                  boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
                }}
              >
                <p className="text-sm mb-4" style={{ color: "#595c5d" }}>
                  Failed to load org chart. Check your connection and try again.
                </p>
                <Button
                  className="text-white"
                  style={{ background: "#6a37d4", borderRadius: "12px" }}
                  onClick={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["departments", companyId],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["roles", companyId],
                    });
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {isEmpty && (
            <div className="flex items-center justify-center h-full">
              <div
                className="max-w-md text-center px-10 py-12"
                style={{
                  background: "rgba(255, 255, 255, 0.75)",
                  backdropFilter: "blur(16px)",
                  borderRadius: "24px",
                  boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "#eceeef" }}
                >
                  <Building2 className="w-7 h-7" style={{ color: "#6a37d4" }} />
                </div>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ color: "#2c2f30" }}
                >
                  No structure yet
                </h2>
                <p
                  className="text-sm mb-6 leading-relaxed"
                  style={{ color: "#595c5d" }}
                >
                  Generate a recommended org structure based on your company
                  stage and business model, or start from scratch.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    className="text-sm font-semibold text-white"
                    style={{ background: "#6a37d4", borderRadius: "12px" }}
                    onClick={() =>
                      generateDefaultStructureMutation.mutate()
                    }
                    disabled={generateDefaultStructureMutation.isPending}
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Generate recommended
                  </Button>
                  <Button
                    variant="outline"
                    className="text-sm font-semibold"
                    style={{
                      borderColor: "#abadae",
                      color: "#2c2f30",
                      borderRadius: "12px",
                    }}
                    onClick={() => setShowAddDepartment(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Start from scratch
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && departments.length > 0 && (
            <div className="space-y-4">
              {departments.map((dept: Department) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  roles={roles.filter(
                    (r: Role) => r.departmentId === dept.id
                  )}
                  onSelectRole={setSelectedRole}
                  onDeleteRole={(id) => deleteRoleMutation.mutate(id)}
                  onDeleteDepartment={(id) =>
                    deleteDepartmentMutation.mutate(id)
                  }
                  onAddRole={handleAddRole}
                  selectedRoleId={selectedRole?.id}
                />
              ))}
              <button
                onClick={() => setShowAddDepartment(true)}
                className="w-full transition-all duration-200 hover:border-[#6a37d4]/30"
                style={{
                  padding: "24px",
                  background: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(16px)",
                  borderRadius: "12px",
                  border: "1px dashed rgba(171, 173, 174, 0.3)",
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" style={{ color: "#6a37d4" }} />
                  <span
                    className="font-medium"
                    style={{ color: "#6a37d4" }}
                  >
                    Add department
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <RoleDetailPanel
          role={selectedRole}
          open={!!selectedRole}
          onClose={() => setSelectedRole(null)}
          onUpdate={(role) => updateRoleMutation.mutate(role)}
        />

        <Dialog open={showAddDepartment} onOpenChange={setShowAddDepartment}>
          <DialogContent style={{ background: "#f5f6f7", borderRadius: "16px" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#2c2f30" }}>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest block mb-1"
                  style={{ color: "#6a37d4" }}
                >
                  New
                </span>
                Add department
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="dept-name"
                  className="text-sm font-medium"
                  style={{ color: "#2c2f30" }}
                >
                  Department name
                </Label>
                <Input
                  id="dept-name"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="e.g., Engineering"
                  className="mt-2"
                  style={{ borderRadius: "12px" }}
                />
              </div>
              <div>
                <Label
                  htmlFor="dept-desc"
                  className="text-sm font-medium"
                  style={{ color: "#2c2f30" }}
                >
                  Description (optional)
                </Label>
                <Textarea
                  id="dept-desc"
                  value={newDepartmentDesc}
                  onChange={(e) => setNewDepartmentDesc(e.target.value)}
                  placeholder="Brief description of this department's purpose"
                  className="mt-2"
                  style={{ borderRadius: "12px" }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateDepartment}
                disabled={
                  !newDepartmentName.trim() ||
                  createDepartmentMutation.isPending
                }
                className="text-white"
                style={{ background: "#6a37d4", borderRadius: "12px" }}
              >
                Create department
              </Button>
              <Button
                onClick={() => setShowAddDepartment(false)}
                variant="outline"
                style={{
                  borderColor: "#abadae",
                  color: "#2c2f30",
                  borderRadius: "12px",
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
          <DialogContent style={{ background: "#f5f6f7", borderRadius: "16px" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#2c2f30" }}>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest block mb-1"
                  style={{ color: "#6a37d4" }}
                >
                  New
                </span>
                Add role
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="role-title"
                  className="text-sm font-medium"
                  style={{ color: "#2c2f30" }}
                >
                  Role title
                </Label>
                <Input
                  id="role-title"
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  placeholder="e.g., Senior Backend Engineer"
                  className="mt-2"
                  style={{ borderRadius: "12px" }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateRole}
                disabled={
                  !newRoleTitle.trim() || createRoleMutation.isPending
                }
                className="text-white"
                style={{ background: "#6a37d4", borderRadius: "12px" }}
              >
                Create role
              </Button>
              <Button
                onClick={() => setShowAddRole(false)}
                variant="outline"
                style={{
                  borderColor: "#abadae",
                  color: "#2c2f30",
                  borderRadius: "12px",
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UniversalLayout>
  );
}
