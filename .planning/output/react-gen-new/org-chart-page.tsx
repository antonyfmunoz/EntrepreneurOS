import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight, User, Bot, Trash2, Edit2, Sparkles } from 'lucide-react';
import { UniversalLayout } from '@/components/universal-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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

interface RoleNodeProps {
  role: Role;
  onSelect: (role: Role) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
}

function RoleNode({ role, onSelect, onDelete, isSelected }: RoleNodeProps) {
  return (
    <div
      onClick={() => onSelect(role)}
      className="relative cursor-pointer transition-all duration-200"
      style={{
        padding: window.innerWidth < 640 ? '16px' : '32px',
        background: isSelected 
          ? 'rgba(106, 55, 212, 0.1)' 
          : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1" style={{ color: '#2c2f30' }}>
            {role.title}
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            {role.assignedUserId ? (
              <div className="flex items-center gap-1 text-xs" style={{ color: '#595c5d' }}>
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
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/50 rounded"
        >
          <Trash2 className="w-4 h-4" style={{ color: '#595c5d' }} />
        </button>
      </div>
    </div>
  );
}

interface AgentSlotBadgeProps {
  active?: boolean;
}

function AgentSlotBadge({ active }: AgentSlotBadgeProps) {
  return (
    <div
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
      style={{
        background: active ? 'rgba(174, 141, 255, 0.2)' : 'rgba(171, 173, 174, 0.1)',
        color: active ? '#6a37d4' : '#595c5d',
      }}
    >
      <Bot className="w-3 h-3" />
      <span>{active ? 'AI slot' : 'Open'}</span>
    </div>
  );
}

interface DepartmentNodeProps {
  department: Department;
  roles: Role[];
  onSelectRole: (role: Role) => void;
  onDeleteRole: (id: string) => void;
  onDeleteDepartment: (id: string) => void;
  onAddRole: (departmentId: string) => void;
  selectedRoleId?: string;
}

function DepartmentNode({
  department,
  roles,
  onSelectRole,
  onDeleteRole,
  onDeleteDepartment,
  onAddRole,
  selectedRoleId,
}: DepartmentNodeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="group transition-all duration-200 hover:shadow-lg"
      style={{
        padding: window.innerWidth < 640 ? '16px' : '32px',
        background: '#eff1f2',
        borderRadius: '12px',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-5 h-5" style={{ color: '#2c2f30' }} />
            ) : (
              <ChevronRight className="w-5 h-5" style={{ color: '#2c2f30' }} />
            )}
          </button>
          <div className="flex-1">
            <h3 className="font-semibold text-base" style={{ color: '#2c2f30' }}>
              {department.name}
            </h3>
            {department.description && (
              <p className="text-sm mt-1" style={{ color: '#595c5d' }}>
                {department.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDeleteDepartment(department.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/50 rounded"
        >
          <Trash2 className="w-4 h-4" style={{ color: '#595c5d' }} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {roles.length === 0 ? (
            <div
              className="text-center py-8"
              style={{
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '12px',
              }}
            >
              <Bot className="w-8 h-8 mx-auto mb-2" style={{ color: '#abadae' }} />
              <p className="text-sm mb-3" style={{ color: '#595c5d' }}>
                No roles yet. Add your first role to define responsibilities.
              </p>
              <AddRoleButton departmentId={department.id} onAdd={onAddRole} />
            </div>
          ) : (
            <>
              {roles.map((role) => (
                <RoleNode
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

interface AddDepartmentButtonProps {
  onAdd: () => void;
}

function AddDepartmentButton({ onAdd }: AddDepartmentButtonProps) {
  return (
    <button
      onClick={onAdd}
      className="w-full transition-all duration-200"
      style={{
        padding: window.innerWidth < 640 ? '16px' : '32px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: '1px dashed rgba(171, 173, 174, 0.3)',
      }}
    >
      <div className="flex items-center justify-center gap-2">
        <Plus className="w-5 h-5" style={{ color: '#6a37d4' }} />
        <span className="font-medium" style={{ color: '#6a37d4' }}>
          Add department
        </span>
      </div>
    </button>
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
      className="w-full transition-all duration-200"
      style={{
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: '1px dashed rgba(171, 173, 174, 0.3)',
      }}
    >
      <div className="flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" style={{ color: '#6a37d4' }} />
        <span className="text-sm font-medium" style={{ color: '#6a37d4' }}>
          Add role
        </span>
      </div>
    </button>
  );
}

interface RoleDetailPanelProps {
  role: Role | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (role: Role) => void;
}

function RoleDetailPanel({ role, open, onClose, onUpdate }: RoleDetailPanelProps) {
  const [title, setTitle] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [agentSlot, setAgentSlot] = useState(false);

  useState(() => {
    if (role) {
      setTitle(role.title);
      setResponsibilities(role.responsibilities || '');
      setAgentSlot(role.agentSlot || false);
    }
  });

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
      <SheetContent className="w-full sm:max-w-md" style={{ background: '#f5f6f7' }}>
        <SheetHeader>
          <SheetTitle style={{ color: '#2c2f30' }}>Edit role</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div>
            <Label htmlFor="title" className="text-sm font-medium" style={{ color: '#2c2f30' }}>
              Role title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Head of Engineering"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="responsibilities" className="text-sm font-medium" style={{ color: '#2c2f30' }}>
              Responsibilities
            </Label>
            <Textarea
              id="responsibilities"
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="Key areas of ownership and expected outcomes"
              className="mt-2 min-h-[120px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="agentSlot"
              checked={agentSlot}
              onChange={(e) => setAgentSlot(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#6a37d4' }}
            />
            <Label htmlFor="agentSlot" className="text-sm cursor-pointer" style={{ color: '#2c2f30' }}>
              Enable AI agent slot for this role
            </Label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1"
              style={{ background: '#6a37d4' }}
            >
              Save changes
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
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
  const { companyId } = useParams<{ companyId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentDesc, setNewDepartmentDesc] = useState('');
  const [newRoleTitle, setNewRoleTitle] = useState('');

  const { data: departments = [], isLoading: loadingDepartments, error: departmentsError } = useQuery({
    queryKey: ['departments', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/departments`);
      if (!res.ok) throw new Error('Failed to load departments');
      return res.json();
    },
  });

  const { data: roles = [], isLoading: loadingRoles, error: rolesError } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/roles`);
      if (!res.ok) throw new Error('Failed to load roles');
      return res.json();
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch(`/api/companies/${companyId}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create department');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
      setShowAddDepartment(false);
      setNewDepartmentName('');
      setNewDepartmentDesc('');
      toast({ title: 'Department created' });
    },
    onError: () => {
      toast({ title: 'Failed to create department', variant: 'destructive' });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { title: string; departmentId: string }) => {
      const res = await fetch(`/api/companies/${companyId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
      setShowAddRole(false);
      setNewRoleTitle('');
      toast({ title: 'Role created' });
    },
    onError: () => {
      toast({ title: 'Failed to create role', variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: Role) => {
      const res = await fetch(`/api/companies/${companyId}/roles/${role.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
      toast({ title: 'Role updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update role', variant: 'destructive' });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${companyId}/departments/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete department');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
      toast({ title: 'Department deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete department', variant: 'destructive' });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${companyId}/roles/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
      toast({ title: 'Role deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete role', variant: 'destructive' });
    },
  });

  const generateDefaultStructureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/org/generate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate structure');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
      toast({ title: 'Org structure generated' });
    },
    onError: () => {
      toast({ title: 'Failed to generate structure', variant: 'destructive' });
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

  return (
    <UniversalLayout>
      <div className="h-full flex flex-col" style={{ background: '#ffffff' }}>
        <div
          className="border-b flex items-center justify-between"
          style={{
            padding: window.innerWidth < 640 ? '16px' : '24px 32px',
            background: '#f5f6f7',
            borderColor: 'rgba(171, 173, 174, 0.1)',
          }}
        >
          <h1 className="text-2xl font-semibold" style={{ color: '#2c2f30' }}>
            Org Chart
          </h1>
        </div>

        <div className="flex-1 overflow-auto" style={{ padding: window.innerWidth < 640 ? '16px' : '32px' }}>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    height: '200px',
                    background: '#eff1f2',
                    borderRadius: '12px',
                  }}
                />
              ))}
            </div>
          )}

          {error && (
            <div
              className="text-center py-12"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
              }}
            >
              <p className="text-sm mb-4" style={{ color: '#595c5d' }}>
                Failed to load org chart. Check your connection and try again.
              </p>
              <Button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
                  queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
                }}
                style={{ background: '#6a37d4' }}
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && departments.length === 0 && (
            <div
              className="text-center py-16"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
              }}
            >
              <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: '#6a37d4' }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#2c2f30' }}>
                No departments yet
              </h3>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#595c5d' }}>
                Generate a recommended org structure based on your company stage and business model, or start from scratch.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => generateDefaultStructureMutation.mutate()}
                  disabled={generateDefaultStructureMutation.isPending}
                  style={{ background: '#6a37d4' }}
                >
                  Generate recommended structure
                </Button>
                <Button
                  onClick={() => setShowAddDepartment(true)}
                  variant="outline"
                >
                  Start from scratch
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && departments.length > 0 && (
            <div className="space-y-4">
              {departments.map((dept) => (
                <DepartmentNode
                  key={dept.id}
                  department={dept}
                  roles={roles.filter((r: Role) => r.departmentId === dept.id)}
                  onSelectRole={setSelectedRole}
                  onDeleteRole={(id) => deleteRoleMutation.mutate(id)}
                  onDeleteDepartment={(id) => deleteDepartmentMutation.mutate(id)}
                  onAddRole={handleAddRole}
                  selectedRoleId={selectedRole?.id}
                />
              ))}
              <AddDepartmentButton onAdd={() => setShowAddDepartment(true)} />
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
          <DialogContent style={{ background: '#f5f6f7' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#2c2f30' }}>Add department</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="dept-name" className="text-sm font-medium" style={{ color: '#2c2f30' }}>
                  Department name
                </Label>
                <Input
                  id="dept-name"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="e.g., Engineering"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="dept-desc" className="text-sm font-medium" style={{ color: '#2c2f30' }}>
                  Description (optional)
                </Label>
                <Textarea
                  id="dept-desc"
                  value={newDepartmentDesc}
                  onChange={(e) => setNewDepartmentDesc(e.target.value)}
                  placeholder="Brief description of this department's purpose"
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateDepartment}
                disabled={!newDepartmentName.trim() || createDepartmentMutation.isPending}
                style={{ background: '#6a37d4' }}
              >
                Create department
              </Button>
              <Button onClick={() => setShowAddDepartment(false)} variant="outline">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
          <DialogContent style={{ background: '#f5f6f7' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#2c2f30' }}>Add role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="role-title" className="text-sm font-medium" style={{ color: '#2c2f30' }}>
                  Role title
                </Label>
                <Input
                  id="role-title"
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  placeholder="e.g., Senior Backend Engineer"
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateRole}
                disabled={!newRoleTitle.trim() || createRoleMutation.isPending}
                style={{ background: '#6a37d4' }}
              >
                Create role
              </Button>
              <Button onClick={() => setShowAddRole(false)} variant="outline">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UniversalLayout>
  );
}