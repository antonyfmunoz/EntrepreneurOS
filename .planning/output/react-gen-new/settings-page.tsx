import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UniversalLayout } from '@/components/universal-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { User, Building2, Bell, Sparkles, Upload, AlertCircle } from 'lucide-react';
import { designTokens } from '@/lib/design-tokens';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Company {
  id: string;
  name: string;
  stage: string;
  industry: string;
  businessModel: string;
  goals: string[];
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskAlerts: boolean;
  workflowAlerts: boolean;
}

interface AutonomySettings {
  autonomyLevel: 'observe' | 'recommend' | 'assist' | 'execute';
}

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-lg ${className}`}
    style={{
      backgroundColor: designTokens.colors.surfaceContainerHigh,
    }}
  />
);

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-xl p-8 ${className}`}
    style={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
    }}
  >
    {children}
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div
      className="rounded-full p-4 mb-4"
      style={{ backgroundColor: designTokens.colors.surfaceContainerHigh }}
    >
      <AlertCircle size={32} style={{ color: designTokens.colors.primary }} />
    </div>
    <p className="text-center mb-4" style={{ color: designTokens.colors.onSurfaceVariant }}>
      {message}
    </p>
    <Button onClick={onRetry}>Retry</Button>
  </div>
);

const ProfileTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/users/me');
      if (!response.ok) throw new Error('Failed to load profile');
      return response.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({ title: 'Profile updated' });
      window.dispatchEvent(
        new CustomEvent('analytics', {
          detail: { event: 'profile_updated', properties: {} },
        })
      );
    },
    onError: () => {
      toast({
        title: 'Failed to update profile',
        description: 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const username = formData.get('username') as string;
    if (username.length < 3) {
      toast({
        title: 'Username must be at least 3 characters',
        variant: 'destructive',
      });
      return;
    }

    const email = formData.get('email') as string;
    if (!email.includes('@')) {
      toast({
        title: 'Email must be valid format',
        variant: 'destructive',
      });
      return;
    }

    const fullName = formData.get('fullName') as string;
    if (!fullName.trim()) {
      toast({
        title: 'Full name is required',
        variant: 'destructive',
      });
      return;
    }

    updateProfileMutation.mutate({
      username,
      email,
      fullName,
      avatarUrl: avatarPreview || profile?.avatarUrl || null,
    });
  };

  if (isLoading) {
    return (
      <GlassCard>
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <Skeleton className="w-24 h-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <ErrorState message="Failed to load profile" onRetry={() => refetch()} />
      </GlassCard>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="text-sm font-medium mb-4 block" style={{ color: designTokens.colors.onSurface }}>
            Profile Picture
          </Label>
          <div className="flex items-center gap-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: designTokens.colors.surfaceContainerHigh }}
            >
              {avatarPreview || profile.avatarUrl ? (
                <img
                  src={avatarPreview || profile.avatarUrl || ''}
                  alt={profile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={32} style={{ color: designTokens.colors.onSurfaceVariant }} />
              )}
            </div>
            <div>
              <input
                type="file"
                id="avatar"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => document.getElementById('avatar')?.click()}
              >
                <Upload size={16} className="mr-2" />
                Upload new
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName" style={{ color: designTokens.colors.onSurface }}>
            Full name
          </Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile.fullName}
            required
            style={{
              borderRadius: '12px',
              backgroundColor: designTokens.colors.surfaceContainerHighest,
              border: 'none',
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username" style={{ color: designTokens.colors.onSurface }}>
            Username
          </Label>
          <Input
            id="username"
            name="username"
            defaultValue={profile.username}
            required
            minLength={3}
            style={{
              borderRadius: '12px',
              backgroundColor: designTokens.colors.surfaceContainerHighest,
              border: 'none',
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" style={{ color: designTokens.colors.onSurface }}>
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={profile.email}
            required
            style={{
              borderRadius: '12px',
              backgroundColor: designTokens.colors.surfaceContainerHighest,
              border: 'none',
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={updateProfileMutation.isPending}
          style={{
            borderRadius: '12px',
          }}
        >
          {updateProfileMutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </form>
    </GlassCard>
  );
};

const CompanyTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<{ activeCompanyId: string }>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/users/me');
      if (!response.ok) throw new Error('Failed to load user');
      return response.json();
    },
  });

  const {
    data: company,
    isLoading,
    error,
    refetch,
  } = useQuery<Company>({
    queryKey: ['company', user?.activeCompanyId],
    queryFn: async () => {
      if (!user?.activeCompanyId) throw new Error('No active company');
      const response = await fetch(`/api/companies/${user.activeCompanyId}`);
      if (!response.ok) throw new Error('Failed to load company');
      return response.json();
    },
    enabled: !!user?.activeCompanyId,
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      if (!user?.activeCompanyId) throw new Error('No active company');
      const response = await fetch(`/api/companies/${user.activeCompanyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast({ title: 'Company settings updated' });
      window.dispatchEvent(
        new CustomEvent('analytics', {
          detail: {
            event: 'company_settings_updated',
            properties: { companyId: user?.activeCompanyId },
          },
        })
      );
    },
    onError: () => {
      toast({
        title: 'Failed to update company settings',
        description: 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const goalsText = formData.get('goals') as string;
    const goals = goalsText
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean);

    updateCompanyMutation.mutate({
      name: formData.get('name') as string,
      stage: formData.get('stage') as string,
      industry: formData.get('industry') as string,
      businessModel: formData.get('businessModel') as string,
      goals,
    });
  };

  if (isLoading) {
    return (
      <GlassCard>
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <ErrorState message="Failed to load company settings" onRetry={() => refetch()} />
      </GlassCard>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name" style={{ color: designTokens.colors.onSurface }}>
            Company name
          </Label>
          <Input
            id="name"
            name="name"
            defaultValue={company.name}
            required
            style={{
              borderRadius: '12px',
              backgroundColor: designTokens.colors.surfaceContainerHighest,
              border: 'none',
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stage" style={{ color: designTokens.colors.onSurface }}>
            Stage
          </Label>
          <Select name="stage" defaultValue={company.stage}>
            <SelectTrigger
              style={{
                borderRadius: '12px',
                backgroundColor: designTokens.colors.surfaceContainerHighest,
                border: 'none',
              }}
            >
              <SelectValue />
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
          <Label htmlFor="industry" style={{ color: designTokens.colors.onSurface }}>
            Industry
          </Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={company.industry}
            style={{
              borderRadius: '12px',
              backgroundColor: designTokens.colors.surfaceContainerHighest,
              border: 'none',
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessModel" style={{ color: designTokens.colors.onSurface }}>
            Business model
          </Label>
          <Select name="businessModel" defaultValue={company.businessModel}>
            <SelectTrigger
              style={{
                borderRadius: '12px',
                backgroundColor: designTokens.colors.surfaceContainerHighest,
                border: 'none',
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saas">SaaS</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goals" style={{ color: designTokens.colors.onSurface }}>
            Top 3 goals (one per line)
          </Label>
          <Textarea
            id="goals"
            name="goals"
            defaultValue={company.goals.join('\n')}
            rows={4}
            placeholder="e.g., 10x revenue&#10;Hire 5 engineers&#10;Launch product line"
            style={{
              borderRadius: '12px',
              backgroundColor: designTokens.colors.surfaceContainerHighest,
              border: 'none',
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={updateCompanyMutation.isPending}
          style={{
            borderRadius: '12px',
          }}
        >
          {updateCompanyMutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </form>
    </GlassCard>
  );
};

const NotificationsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<{ activeCompanyId: string }>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/users/me');
      if (!response.ok) throw new Error('Failed to load user');
      return response.json();
    },
  });

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery<NotificationSettings>({
    queryKey: ['notification-settings', user?.activeCompanyId],
    queryFn: async () => {
      if (!user?.activeCompanyId) throw new Error('No active company');
      const response = await fetch(`/api/companies/${user.activeCompanyId}/notification-settings`);
      if (!response.ok) {
        return {
          emailNotifications: true,
          pushNotifications: true,
          taskAlerts: true,
          workflowAlerts: true,
        };
      }
      return response.json();
    },
    enabled: !!user?.activeCompanyId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: NotificationSettings) => {
      if (!user?.activeCompanyId) throw new Error('No active company');
      const response = await fetch(`/api/companies/${user.activeCompanyId}/notification-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({ title: 'Notification preferences updated' });
    },
    onError: () => {
      toast({
        title: 'Failed to update preferences',
        description: 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    updateSettingsMutation.mutate({
      ...settings,
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <GlassCard>
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <ErrorState message="Failed to load notification settings" onRetry={() => refetch()} />
      </GlassCard>
    );
  }

  if (!settings) {
    return null;
  }

  const notificationOptions = [
    {
      key: 'emailNotifications' as const,
      label: 'Email notifications',
      description: 'Receive updates via email',
    },
    {
      key: 'pushNotifications' as const,
      label: 'Push notifications',
      description: 'Receive browser notifications',
    },
    {
      key: 'taskAlerts' as const,
      label: 'Task alerts',
      description: 'Get notified when tasks are assigned or updated',
    },
    {
      key: 'workflowAlerts' as const,
      label: 'Workflow alerts',
      description: 'Get notified when workflows need attention',
    },
  ];

  return (
    <GlassCard>
      <div className="space-y-6">
        {notificationOptions.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between py-4"
            style={{
              borderBottom: `1px solid ${designTokens.colors.surfaceContainerHigh}`,
            }}
          >
            <div className="flex-1">
              <div className="font-medium mb-1" style={{ color: designTokens.colors.onSurface }}>
                {option.label}
              </div>
              <div className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
                {option.description}
              </div>
            </div>
            <Switch
              checked={settings[option.key]}
              onCheckedChange={(checked) => handleToggle(option.key, checked)}
            />
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

const AutonomyTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<{ activeCompanyId: string }>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/users/me');
      if (!response.ok) throw new Error('Failed to load user');
      return response.json();
    },
  });

  const {
    data: autonomy,
    isLoading,
    error,
    refetch,
  } = useQuery<AutonomySettings>({
    queryKey: ['autonomy-settings', user?.activeCompanyId],
    queryFn: async () => {
      if (!user?.activeCompanyId) throw new Error('No active company');
      const response = await fetch(`/api/companies/${user.activeCompanyId}/autonomy-settings`);
      if (!response.ok) {
        return { autonomyLevel: 'recommend' as const };
      }
      return response.json();
    },
    enabled: !!user?.activeCompanyId,
  });

  const updateAutonomyMutation = useMutation({
    mutationFn: async (data: AutonomySettings) => {
      if (!user?.activeCompanyId) throw new Error('No active company');
      const response = await fetch(`/api/companies/${user.activeCompanyId}/autonomy-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['autonomy-settings'] });
      toast({ title: 'Autonomy level updated' });
      window.dispatchEvent(
        new CustomEvent('analytics', {
          detail: {
            event: 'autonomy_level_changed',
            properties: { level: variables.autonomyLevel },
          },
        })
      );
    },
    onError: () => {
      toast({
        title: 'Failed to update autonomy level',
        description: 'Please try again',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <GlassCard>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <ErrorState message="Failed to load autonomy settings" onRetry={() => refetch()} />
      </GlassCard>
    );
  }

  if (!autonomy) {
    return null;
  }

  const levels = [
    {
      value: 'observe' as const,
      label: 'Observe',
      description: 'Your assistant watches and learns. No actions taken.',
    },
    {
      value: 'recommend' as const,
      label: 'Recommend',
      description: 'Your assistant suggests next steps. You decide and execute.',
    },
    {
      value: 'assist' as const,
      label: 'Assist',
      description: 'Your assistant drafts work. You review and approve before execution.',
    },
    {
      value: 'execute' as const,
      label: 'Execute',
      description: 'Your assistant completes routine tasks autonomously. You audit after.',
    },
  ];

  return (
    <GlassCard>
      <div className="mb-6">
        <p className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
          Higher autonomy means your assistant executes more steps without asking. Start low, increase as
          trust builds.
        </p>
      </div>
      <div className="space-y-4">
        {levels.map((level) => {
          const isSelected = autonomy.autonomyLevel === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => updateAutonomyMutation.mutate({ autonomyLevel: level.value })}
              className="w-full text-left p-6 rounded-xl transition-all"
              style={{
                backgroundColor: isSelected
                  ? designTokens.colors.surfaceContainerHighest
                  : designTokens.colors.surfaceContainerLow,
                boxShadow: isSelected ? '0 0 0 2px rgba(106, 55, 212, 0.2)' : 'none',
                borderRadius: '12px',
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div
                    className="font-semibold mb-1"
                    style={{
                      color: isSelected ? designTokens.colors.primary : designTokens.colors.onSurface,
                    }}
                  >
                    {level.label}
                  </div>
                  <div className="text-sm" style={{ color: designTokens.colors.onSurfaceVariant }}>
                    {level.description}
                  </div>
                </div>
                {isSelected && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: designTokens.colors.primary }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.dispatchEvent(
      new CustomEvent('analytics', {
        detail: {
          event: 'settings_tab_changed',
          properties: { tabName: value },
        },
      })
    );
  };

  return (
    <UniversalLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl font-semibold mb-2"
            style={{ color: designTokens.colors.onSurface }}
          >
            Settings
          </h1>
          <p style={{ color: designTokens.colors.onSurfaceVariant }}>
            Manage your profile, company settings, and preferences.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList
            className="w-full mb-8 overflow-x-auto flex-nowrap"
            style={{
              backgroundColor: designTokens.colors.surfaceContainerLow,
              borderRadius: '12px',
              padding: '4px',
            }}
          >
            <TabsTrigger
              value="profile"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: '12px' }}
            >
              <User size={16} />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="company"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: '12px' }}
            >
              <Building2 size={16} />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: '12px' }}
            >
              <Bell size={16} />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger
              value="autonomy"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: '12px' }}
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">AI Autonomy</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="company">
            <CompanyTab />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="autonomy">
            <AutonomyTab />
          </TabsContent>
        </Tabs>
      </div>
    </UniversalLayout>
  );
}