import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { Camera, Check, Download, Loader2 } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

type UserProfile = {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
};

type CompanySettings = {
  id: string;
  name: string;
  stage?: string;
  industry?: string;
  businessModel?: string;
  goals?: string;
};

type NotificationPreferences = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskAlerts: boolean;
  workflowAlerts: boolean;
};

type AutonomySettings = {
  autonomyLevel: "observe" | "recommend" | "assist" | "execute";
};

type CompaniesResponse = {
  companies: CompanySettings[];
};

export default function SettingsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deleteOwnedOrganizations, setDeleteOwnedOrganizations] = useState(false);

  const { data: userProfile, isLoading: loadingUser, error: userError } = useQuery<UserProfile>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const response = await apiRequest<Response>("GET", "/api/users/me");
      return response.json();
    },
  });

  const { data: companiesData, isLoading: loadingCompanies } = useQuery<CompaniesResponse>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest<Response>("GET", "/api/companies");
      return response.json();
    },
  });

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/companies", companiesData?.companies?.[0]?.id],
    queryFn: async () => {
      const companyId = companiesData?.companies?.[0]?.id;
      if (!companyId) throw new Error("No company found");
      const response = await apiRequest<Response>("GET", `/api/companies/${companyId}`);
      return response.json();
    },
    enabled: !!companiesData?.companies?.[0]?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await apiRequest<Response>("PUT", "/api/users/me", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: Partial<CompanySettings>) => {
      const companyId = companySettings?.id;
      if (!companyId) throw new Error("No company found");
      const response = await apiRequest<Response>("PUT", `/api/companies/${companyId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: NotificationPreferences) => {
      const response = await apiRequest<Response>("PUT", "/api/users/me/notifications", data);
      return response.json();
    },
  });

  const updateAutonomyMutation = useMutation({
    mutationFn: async (data: AutonomySettings) => {
      const companyId = companySettings?.id;
      if (!companyId) throw new Error("No company found");
      const response = await apiRequest<Response>("PUT", `/api/companies/${companyId}/autonomy`, data);
      return response.json();
    },
  });

  const exportAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<Response>("GET", "/api/users/me/export");
      return await response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `entrepreneuros-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const deletionRequest = useQuery<{ status: string; scheduledFor: string; deleteOwnedOrganizations: boolean; lastError?: string } | null>({ queryKey: ["/api/users/me/deletion"] });
  const scheduleDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<Response>("POST", "/api/users/me/deletion", { confirmation: deletionConfirmation, deleteOwnedOrganizations });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users/me/deletion"] }),
  });
  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<Response>("DELETE", "/api/users/me/deletion");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users/me/deletion"] }),
  });

  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});
  const [companyForm, setCompanyForm] = useState<Partial<CompanySettings>>({});
  const [notificationForm, setNotificationForm] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    taskAlerts: true,
    workflowAlerts: true,
  });
  const [autonomyForm, setAutonomyForm] = useState<AutonomySettings>({
    autonomyLevel: "recommend",
  });

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [companyErrors, setCompanyErrors] = useState<Record<string, string>>({});

  const validateProfile = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      errors.email = "Invalid email format.";
    }
    
    if (profileForm.username && (profileForm.username.length < 3 || !/^[a-z0-9_]+$/.test(profileForm.username))) {
      errors.username = "Username can only contain lowercase letters, numbers, and underscores.";
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = () => {
    if (!validateProfile()) return;
    updateProfileMutation.mutate(profileForm);
  };

  const handleSaveCompany = () => {
    updateCompanyMutation.mutate(companyForm);
  };

  const handleSaveNotifications = () => {
    updateNotificationsMutation.mutate(notificationForm);
  };

  const handleSaveAutonomy = () => {
    updateAutonomyMutation.mutate(autonomyForm);
  };

  if (userError) {
    return (
      <UniversalLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-8 max-w-md w-full text-center">
            <p className="font-mono text-sm text-destructive mb-4">Failed to load settings. Refresh the page.</p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/users/me"] })}>
              Retry
            </Button>
          </Card>
        </div>
      </UniversalLayout>
    );
  }

  return (
    <UniversalLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-mono font-bold text-4xl text-text mb-2">Settings</h1>
          <p className="font-mono text-base text-text-secondary">
            Manage your profile, company settings, notifications, and AI autonomy.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="autonomy">AI Autonomy</TabsTrigger>
            <TabsTrigger value="privacy">Data & Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="p-8">
              {loadingUser ? (
                <div className="space-y-6">
                  <div className="h-24 w-24 rounded-full bg-surface-subtle animate-pulse" />
                  <div className="space-y-4">
                    <div className="h-10 bg-surface-subtle animate-pulse rounded-md" />
                    <div className="h-10 bg-surface-subtle animate-pulse rounded-md" />
                    <div className="h-10 bg-surface-subtle animate-pulse rounded-md" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-surface-subtle overflow-hidden">
                        {userProfile?.avatarUrl ? (
                          <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="w-8 h-8 text-text-tertiary" />
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary">Your identity photo is managed from the account menu in the top-right corner.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      defaultValue={userProfile?.email}
                      disabled
                    />
                    <p className="font-mono text-xs text-text-secondary">Email changes are managed by the identity provider.</p>
                    {profileErrors.email && (
                      <p className="font-mono text-xs text-destructive">{profileErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="jsmith"
                      defaultValue={userProfile?.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    />
                    {profileErrors.username && (
                      <p className="font-mono text-xs text-destructive">{profileErrors.username}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="Jane Smith"
                      defaultValue={userProfile?.fullName}
                      onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Save profile
                        </>
                      )}
                    </Button>
                  </div>

                  {updateProfileMutation.isError && (
                    <p className="font-mono text-xs text-destructive text-right">Failed to save changes. Try again.</p>
                  )}
                  {updateProfileMutation.isSuccess && (
                    <p className="font-mono text-xs text-success text-right">Profile updated.</p>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card className="p-8">
              {loadingCompanies ? (
                <div className="space-y-4">
                  <div className="h-10 bg-surface-subtle animate-pulse rounded-md" />
                  <div className="h-10 bg-surface-subtle animate-pulse rounded-md" />
                  <div className="h-10 bg-surface-subtle animate-pulse rounded-md" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      placeholder="Acme Labs"
                      defaultValue={companySettings?.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stage">Stage</Label>
                    <Select
                      defaultValue={companySettings?.stage}
                      onValueChange={(value) => setCompanyForm({ ...companyForm, stage: value })}
                    >
                      <SelectTrigger id="stage">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="idea">Idea</SelectItem>
                        <SelectItem value="pre-revenue">Pre-revenue</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="scaling">Scaling</SelectItem>
                        <SelectItem value="mature">Mature</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>


                  <div className="space-y-2">
                    <Label htmlFor="goals">Goals</Label>
                    <Textarea
                      id="goals"
                      placeholder="10x revenue, hire 5 engineers, launch product line"
                      defaultValue={companySettings?.goals}
                      onChange={(e) => setCompanyForm({ ...companyForm, goals: e.target.value })}
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveCompany}
                      disabled={updateCompanyMutation.isPending}
                    >
                      {updateCompanyMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Save company
                        </>
                      )}
                    </Button>
                  </div>

                  {updateCompanyMutation.isError && (
                    <p className="font-mono text-xs text-destructive text-right">Failed to save changes. Try again.</p>
                  )}
                  {updateCompanyMutation.isSuccess && (
                    <p className="font-mono text-xs text-success text-right">Company settings updated.</p>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="font-mono text-xs text-text-secondary">
                      Receive alerts and updates via email.
                    </p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={notificationForm.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationForm({ ...notificationForm, emailNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="pushNotifications">Push Notifications</Label>
                    <p className="font-mono text-xs text-text-secondary">
                      Receive browser notifications for tasks and workflows.
                    </p>
                  </div>
                  <Switch
                    id="pushNotifications"
                    checked={notificationForm.pushNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationForm({ ...notificationForm, pushNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="taskAlerts">Task Alerts</Label>
                    <p className="font-mono text-xs text-text-secondary">
                      Get notified when tasks are assigned to you or approaching deadlines.
                    </p>
                  </div>
                  <Switch
                    id="taskAlerts"
                    checked={notificationForm.taskAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationForm({ ...notificationForm, taskAlerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="workflowAlerts">Workflow Alerts</Label>
                    <p className="font-mono text-xs text-text-secondary">
                      Get notified when workflows require your attention.
                    </p>
                  </div>
                  <Switch
                    id="workflowAlerts"
                    checked={notificationForm.workflowAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationForm({ ...notificationForm, workflowAlerts: checked })
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveNotifications}
                    disabled={updateNotificationsMutation.isPending}
                  >
                    {updateNotificationsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save notifications
                      </>
                    )}
                  </Button>
                </div>

                {updateNotificationsMutation.isError && (
                  <p className="font-mono text-xs text-destructive text-right">Failed to save changes. Try again.</p>
                )}
                {updateNotificationsMutation.isSuccess && (
                  <p className="font-mono text-xs text-success text-right">Notification preferences updated.</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="autonomy">
            <Card className="p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="autonomyLevel">Autonomy Level</Label>
                  <p className="font-mono text-xs text-text-secondary mb-4">
                    Higher autonomy lets the scoped Role Agent execute more steps without asking. Start low and increase only with evidence.
                  </p>
                  <Select
                    defaultValue={autonomyForm.autonomyLevel}
                    onValueChange={(value: "observe" | "recommend" | "assist" | "execute") =>
                      setAutonomyForm({ autonomyLevel: value })
                    }
                  >
                    <SelectTrigger id="autonomyLevel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="observe">Observe (lowest autonomy)</SelectItem>
                      <SelectItem value="recommend">Recommend</SelectItem>
                      <SelectItem value="assist">Assist</SelectItem>
                      <SelectItem value="execute">Execute (highest autonomy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-surface-subtle rounded-lg p-4 space-y-2">
                  <p className="font-mono text-xs uppercase tracking-wide text-text-tertiary">Current Level Details</p>
                  {autonomyForm.autonomyLevel === "observe" && (
                    <p className="font-mono text-sm text-text">
                      The Role Agent watches but never acts. You review all recommendations manually.
                    </p>
                  )}
                  {autonomyForm.autonomyLevel === "recommend" && (
                    <p className="font-mono text-sm text-text">
                      The Role Agent suggests actions. You approve before execution.
                    </p>
                  )}
                  {autonomyForm.autonomyLevel === "assist" && (
                    <p className="font-mono text-sm text-text">
                      The Role Agent executes bounded simple tasks. You review complex decisions.
                    </p>
                  )}
                  {autonomyForm.autonomyLevel === "execute" && (
                    <p className="font-mono text-sm text-text">
                      The Role Agent executes authorized workflows independently. You receive outcomes and evidence.
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveAutonomy}
                    disabled={updateAutonomyMutation.isPending}
                  >
                    {updateAutonomyMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save autonomy
                      </>
                    )}
                  </Button>
                </div>

                {updateAutonomyMutation.isError && (
                  <p className="font-mono text-xs text-destructive text-right">Failed to save changes. Try again.</p>
                )}
                {updateAutonomyMutation.isSuccess && (
                  <p className="font-mono text-xs text-success text-right">Autonomy level updated.</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Export your account data</h2>
                  <p className="mt-2 text-sm text-text-secondary">Download the personal profile, owned portfolio and company records, memberships, messages you sent, audit activity, support requests, billing state, and provider metadata associated with your account. Provider secrets are never included.</p>
                </div>
                <Button onClick={() => exportAccountMutation.mutate()} disabled={exportAccountMutation.isPending}>
                  {exportAccountMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download account export
                </Button>
                {exportAccountMutation.isError && <p className="text-sm text-destructive">The export could not be prepared. Try again.</p>}
                <div className="border-t pt-6">
                  <h2 className="text-lg font-semibold text-destructive">Delete your account</h2>
                  {deletionRequest.data?.status === "scheduled" ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <p>Deletion is scheduled for {new Date(deletionRequest.data.scheduledFor).toLocaleString()}. You can cancel until processing begins.</p>
                      <Button variant="outline" onClick={() => cancelDeletionMutation.mutate()} disabled={cancelDeletionMutation.isPending}>Cancel deletion</Button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-4">
                      <p className="text-sm text-text-secondary">A cooling-off period applies. Identity access, personal data, and—only when explicitly selected—owned portfolios and companies are removed after the scheduled date. Download an export first.</p>
                      <div className="flex items-start gap-3"><Checkbox id="delete-owned" checked={deleteOwnedOrganizations} onCheckedChange={(value) => setDeleteOwnedOrganizations(value === true)} /><Label htmlFor="delete-owned" className="leading-5">Also permanently delete every portfolio and company I own. If unchecked, deletion is blocked until ownership is transferred.</Label></div>
                      <div className="space-y-2"><Label htmlFor="delete-confirmation">Type DELETE MY ENTREPRENEUROS ACCOUNT</Label><Input id="delete-confirmation" value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} /></div>
                      <Button variant="destructive" onClick={() => scheduleDeletionMutation.mutate()} disabled={scheduleDeletionMutation.isPending || deletionConfirmation !== "DELETE MY ENTREPRENEUROS ACCOUNT"}>Schedule account deletion</Button>
                      {scheduleDeletionMutation.isError && <p className="text-sm text-destructive">Deletion could not be scheduled.</p>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UniversalLayout>
  );
}
