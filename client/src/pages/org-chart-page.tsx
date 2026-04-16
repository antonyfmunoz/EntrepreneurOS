import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, Building2, Users } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

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

interface Company {
  id: string;
  name: string;
  stage?: string;
}

export default function OrgChartPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();

  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [showRoleDetail, setShowRoleDetail] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" });
  const [roleForm, setRoleForm] = useState({
    title: "",
    responsibilities: "",
    departmentId: "",
  });

  const { data: company } = useQuery<Company>({
    queryKey: [`/api/companies/${companyId}`],
    enabled: !!companyId,
  });

  const {
    data: departments = [],
    isLoading: loadingDepartments,
    error: departmentsError,
  } = useQuery<Department[]>({
    queryKey: [`/api/companies/${companyId}/departments`],
    enabled: !!companyId,
  });

  const {
    data: roles = [],
    isLoading: loadingRoles,
    error: rolesError,
  } = useQuery<Role[]>({
    queryKey: [`/api/companies/${companyId}/roles`],
    enabled: !!companyId,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return await apiRequest(
        `/api/companies/${companyId}/departments`,
        "POST",
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/departments`] });
      setShowAddDepartment(false);
      setDepartmentForm({ name: "", description: "" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      return await apiRequest(
        `/api/companies/${companyId}/departments/${departmentId}`,
        "DELETE"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/departments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/roles`] });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      departmentId: string;
      responsibilities?: string;
    }) => {
      return await apiRequest(
        `/api/companies/${companyId}/roles`,
        "POST",
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/roles`] });
      setShowAddRole(false);
      setRoleForm({ title: "", responsibilities: "", departmentId: "" });
      setSelectedDepartmentId(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: {
      roleId: string;
      title?: string;
      responsibilities?: string;
      assignedUserId?: string | null;
      agentSlot?: boolean;
    }) => {
      const { roleId, ...body } = data;
      return await apiRequest(
        `/api/companies/${companyId}/roles/${roleId}`,
        "PUT",
        body
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/roles`] });
      setShowRoleDetail(false);
      setSelectedRole(null);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return await apiRequest(
        `/api/companies/${companyId}/roles/${roleId}`,
        "DELETE"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/roles`] });
      setShowRoleDetail(false);
      setSelectedRole(null);
    },
  });

  const generateStructureMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        `/api/companies/${companyId}/org/generate`,
        "POST",
        { stage: company?.stage }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/departments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/roles`] });
    },
  });

  const isLoading = loadingDepartments || loadingRoles;
  const hasError = departmentsError || rolesError;
  const isEmpty = !isLoading && departments.length === 0;

  if (isLoading) {
    return (
      <UniversalLayout>
        <div className="p-6 space-y-4">
          <div className="h-8 w-48 bg-surface-subtle animate-pulse rounded" />
          <div className="h-4 w-96 bg-surface-subtle animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-surface-subtle animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (hasError) {
    return (
      <UniversalLayout>
        <div className="p-6">
          <div className="bg-surface rounded-lg border border-border-subtle p-12 text-center">
            <p className="font-mono text-sm text-destructive mb-4">
              Failed to load org chart. Retry or refresh the page.
            </p>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/departments`] });
                queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/roles`] });
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  if (isEmpty) {
    return (
      <UniversalLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="font-mono font-bold text-4xl text-text mb-2">Org chart</h1>
            <p className="font-mono text-base text-text-secondary">
              Your company structure. Assign roles to humans or AI agents.
            </p>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle p-12 text-center">
            <div className="font-mono text-4xl text-text-tertiary mb-4">—</div>
            <h3 className="font-mono font-semibold text-lg text-text mb-2">No departments yet</h3>
            <p className="font-mono text-sm text-text-secondary mb-6">
              Generate a recommended structure based on your company stage or start from scratch.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button
                onClick={() => generateStructureMutation.mutate()}
                disabled={generateStructureMutation.isPending}
              >
                {generateStructureMutation.isPending ? "Generating..." : "Generate recommended structure"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDepartmentForm({ name: "", description: "" });
                  setShowAddDepartment(true);
                }}
              >
                Start from scratch
              </Button>
            </div>
          </div>
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono font-bold text-4xl text-text mb-2">Org chart</h1>
            <p className="font-mono text-base text-text-secondary">
              Your company structure. Assign roles to humans or AI agents.
            </p>
          </div>
          <Button onClick={() => setShowAddDepartment(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add department
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const deptRoles = roles.filter((r) => r.departmentId === dept.id);
            return (
              <Card
                key={dept.id}
                className="bg-surface border-border-subtle hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <CardTitle className="font-mono font-semibold text-lg text-text">
                        {dept.name}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDepartmentMutation.mutate(dept.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {dept.description && (
                    <CardDescription className="font-mono text-sm text-text-secondary">
                      {dept.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deptRoles.map((role) => (
                      <div
                        key={role.id}
                        className="bg-surface-subtle rounded-md p-3 flex items-center justify-between hover:bg-border cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedRole(role);
                          setShowRoleDetail(true);
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-text-secondary" />
                          <span className="font-mono text-sm text-text">{role.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {role.agentSlot && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full font-mono text-xs uppercase tracking-wide bg-primary-muted text-primary">
                              AI
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRole(role);
                              setShowRoleDetail(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedDepartmentId(dept.id);
                        setRoleForm({ title: "", responsibilities: "", departmentId: dept.id });
                        setShowAddRole(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add role
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={showAddDepartment} onOpenChange={setShowAddDepartment}>
        <DialogContent className="bg-surface-elevated border-border shadow-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-2xl text-text">
              Add department
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Department name
              </label>
              <Input
                placeholder="e.g., Engineering, Sales, Operations"
                value={departmentForm.name}
                onChange={(e) =>
                  setDepartmentForm({ ...departmentForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Description (optional)
              </label>
              <Textarea
                placeholder="e.g., Builds and maintains product"
                value={departmentForm.description}
                onChange={(e) =>
                  setDepartmentForm({ ...departmentForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDepartment(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createDepartmentMutation.mutate(departmentForm)}
              disabled={!departmentForm.name || createDepartmentMutation.isPending}
            >
              {createDepartmentMutation.isPending ? "Creating..." : "Create department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
        <DialogContent className="bg-surface-elevated border-border shadow-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-2xl text-text">
              Add role
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Role title
              </label>
              <Input
                placeholder="e.g., VP Engineering, Account Executive"
                value={roleForm.title}
                onChange={(e) => setRoleForm({ ...roleForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                Responsibilities (optional)
              </label>
              <Textarea
                placeholder="e.g., Manage engineering team, ship product, maintain quality"
                value={roleForm.responsibilities}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, responsibilities: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRole(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createRoleMutation.mutate(roleForm)}
              disabled={!roleForm.title || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? "Creating..." : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoleDetail} onOpenChange={setShowRoleDetail}>
        <DialogContent className="bg-surface-elevated border-border shadow-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-2xl text-text">
              {selectedRole?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                  Responsibilities
                </label>
                <Textarea
                  value={selectedRole.responsibilities ?? ""}
                  onChange={(e) =>
                    setSelectedRole({ ...selectedRole, responsibilities: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                  AI agent slot
                </label>
                <p className="font-mono text-xs text-text-tertiary mb-2">
                  AI agents can handle routine tasks for this role. Assign an agent or leave empty.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setSelectedRole({ ...selectedRole, agentSlot: !selectedRole.agentSlot })
                  }
                >
                  {selectedRole.agentSlot ? "Remove AI agent" : "Assign AI agent"}
                </Button>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <Button
                  variant="destructive"
                  onClick={() => deleteRoleMutation.mutate(selectedRole.id)}
                  disabled={deleteRoleMutation.isPending}
                >
                  {deleteRoleMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setShowRoleDetail(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      updateRoleMutation.mutate({
                        roleId: selectedRole.id,
                        responsibilities: selectedRole.responsibilities,
                        agentSlot: selectedRole.agentSlot,
                      })
                    }
                    disabled={updateRoleMutation.isPending}
                  >
                    {updateRoleMutation.isPending ? "Saving..." : "Save role"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </UniversalLayout>
  );
}