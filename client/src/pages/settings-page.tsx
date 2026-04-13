import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Shield,
  User,
  Building2,
  Bell,
  Sparkles,
} from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  colors,
  glassmorphism,
  borderRadius,
  applyGlassmorphism,
} from "@/lib/design-tokens";
import type { Company } from "@shared/schema";
import { usePostHog } from "posthog-js/react";

interface CompanyUpdateInput {
  name?: string;
  type?: string | null;
  stage?: string | null;
  offer?: string | null;
  targetCustomer?: string | null;
  goals?: string | null;
  assistantName?: string | null;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskAlerts: boolean;
  workflowAlerts: boolean;
}

interface AutonomySettings {
  autonomyLevel: "observe" | "recommend" | "assist" | "execute";
}

const surfaceContainerHigh = "#e2e4e5";
const surfaceContainerHighest = "#dcdee0";

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div
    className={`animate-pulse ${className}`}
    style={{
      backgroundColor: surfaceContainerHigh,
      borderRadius: borderRadius.default,
    }}
  />
);

const GlassCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`p-8 ${className}`}
    style={{
      ...applyGlassmorphism(),
      borderRadius: borderRadius.lg,
    }}
  >
    {children}
  </div>
);

const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div
      className="rounded-full p-4 mb-4"
      style={{ backgroundColor: surfaceContainerHigh }}
    >
      <AlertCircle size={32} style={{ color: colors.primary }} />
    </div>
    <p
      className="text-center mb-4"
      style={{ color: colors.onSurfaceVariant }}
    >
      {message}
    </p>
    <Button
      onClick={onRetry}
      style={{
        borderRadius: borderRadius.default,
        backgroundColor: colors.primary,
        color: "#ffffff",
      }}
    >
      Retry
    </Button>
  </div>
);

const inputStyle: React.CSSProperties = {
  borderRadius: borderRadius.default,
  backgroundColor: surfaceContainerHighest,
  border: "none",
};

function CompanyTab({
  company,
  companyLoading,
  companyError,
  companyRefetch,
  companyName,
  setCompanyName,
  companyType,
  setCompanyType,
  companyStage,
  setCompanyStage,
  assistantName,
  setAssistantName,
  offer,
  setOffer,
  targetCustomer,
  setTargetCustomer,
  goals,
  setGoals,
  handleCompanySubmit,
  updateCompanyMutation,
}: {
  company: Company | undefined;
  companyLoading: boolean;
  companyError: Error | null;
  companyRefetch: () => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  companyType: string;
  setCompanyType: (v: string) => void;
  companyStage: string;
  setCompanyStage: (v: string) => void;
  assistantName: string;
  setAssistantName: (v: string) => void;
  offer: string;
  setOffer: (v: string) => void;
  targetCustomer: string;
  setTargetCustomer: (v: string) => void;
  goals: string;
  setGoals: (v: string) => void;
  handleCompanySubmit: (e: React.FormEvent) => void;
  updateCompanyMutation: ReturnType<
    typeof useMutation<Company, Error, CompanyUpdateInput>
  >;
}) {
  if (companyLoading) {
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

  if (companyError && !companyLoading) {
    return (
      <GlassCard>
        <ErrorState
          message={companyError.message || "Failed to load company settings"}
          onRetry={companyRefetch}
        />
      </GlassCard>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <GlassCard>
      <form onSubmit={handleCompanySubmit} className="space-y-6">
        <div className="space-y-2">
          <Label
            htmlFor="company-name"
            style={{ color: colors.onSurface }}
          >
            Company name
          </Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={updateCompanyMutation.isPending}
            required
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="company-stage"
              style={{ color: colors.onSurface }}
            >
              Stage
            </Label>
            <Input
              id="company-stage"
              value={companyStage}
              onChange={(e) => setCompanyStage(e.target.value)}
              placeholder="Pre-seed, Seed, Series A..."
              disabled={updateCompanyMutation.isPending}
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="company-type"
              style={{ color: colors.onSurface }}
            >
              Type
            </Label>
            <Input
              id="company-type"
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              placeholder="SaaS, Agency, D2C..."
              disabled={updateCompanyMutation.isPending}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="assistant-name"
            style={{ color: colors.onSurface }}
          >
            Assistant name
          </Label>
          <Input
            id="assistant-name"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            placeholder="OS-1"
            disabled={updateCompanyMutation.isPending}
            style={inputStyle}
          />
          <p
            className="text-xs"
            style={{ color: colors.onSurfaceVariant }}
          >
            What you want to call your AI assistant throughout the app.
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="company-offer"
            style={{ color: colors.onSurface }}
          >
            Offer
          </Label>
          <Textarea
            id="company-offer"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="What you sell and to whom."
            rows={3}
            disabled={updateCompanyMutation.isPending}
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="company-customer"
            style={{ color: colors.onSurface }}
          >
            Target customer
          </Label>
          <Textarea
            id="company-customer"
            value={targetCustomer}
            onChange={(e) => setTargetCustomer(e.target.value)}
            placeholder="Who buys from you and why."
            rows={3}
            disabled={updateCompanyMutation.isPending}
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="company-goals"
            style={{ color: colors.onSurface }}
          >
            Goals
          </Label>
          <Textarea
            id="company-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="What you're building toward this quarter."
            rows={3}
            disabled={updateCompanyMutation.isPending}
            style={inputStyle}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {updateCompanyMutation.isSuccess && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: "#16a34a" }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            disabled={
              updateCompanyMutation.isPending || !companyName.trim()
            }
            style={{
              borderRadius: borderRadius.default,
              backgroundColor: colors.primary,
              color: "#ffffff",
            }}
            className="hover:opacity-90 disabled:opacity-50"
          >
            {updateCompanyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}

function ProfileTab({
  user,
}: {
  user: { fullName?: string | null; username?: string | null; email?: string | null } | null;
}) {
  return (
    <GlassCard>
      <div className="space-y-6">
        <div className="flex items-center gap-6 mb-2">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: surfaceContainerHigh }}
          >
            <User size={28} style={{ color: colors.onSurfaceVariant }} />
          </div>
          <div>
            <div
              className="text-lg font-semibold"
              style={{ color: colors.onSurface }}
            >
              {user?.fullName ?? user?.username ?? "User"}
            </div>
            <div className="text-sm" style={{ color: colors.onSurfaceVariant }}>
              {user?.email ?? ""}
            </div>
          </div>
        </div>

        <p className="text-sm" style={{ color: colors.onSurfaceVariant }}>
          Profile details are managed by Clerk. Update them from Clerk's user
          settings to change them here.
        </p>

        <div className="space-y-2">
          <Label htmlFor="profile-name" style={{ color: colors.onSurface }}>
            Name
          </Label>
          <Input
            id="profile-name"
            value={user?.fullName ?? user?.username ?? ""}
            readOnly
            style={{
              ...inputStyle,
              opacity: 0.7,
              cursor: "default",
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email" style={{ color: colors.onSurface }}>
            Email
          </Label>
          <Input
            id="profile-email"
            value={user?.email ?? ""}
            readOnly
            style={{
              ...inputStyle,
              opacity: 0.7,
              cursor: "default",
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-username" style={{ color: colors.onSurface }}>
            Username
          </Label>
          <Input
            id="profile-username"
            value={user?.username ?? ""}
            readOnly
            style={{
              ...inputStyle,
              opacity: 0.7,
              cursor: "default",
            }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function SecurityTab({
  isClerkReady,
  userEmail,
  handlePasswordReset,
}: {
  isClerkReady: boolean;
  userEmail: string | null | undefined;
  handlePasswordReset: () => void;
}) {
  const notificationOptions = [
    {
      icon: <Mail size={20} style={{ color: colors.primary }} />,
      label: "Email verification",
      description: isClerkReady
        ? "Your email is verified through your Clerk account."
        : "Email verification is available when Clerk is configured.",
    },
    {
      icon: <Shield size={20} style={{ color: colors.primary }} />,
      label: "Two-factor authentication",
      description:
        "Clerk supports TOTP authenticator apps and SMS verification. Configure 2FA from your Clerk account settings.",
    },
  ];

  return (
    <GlassCard>
      <div className="space-y-6">
        {notificationOptions.map((option) => (
          <div
            key={option.label}
            className="flex items-start gap-4 py-4"
            style={{
              borderBottom: `1px solid ${colors.surfaceContainerLow}`,
            }}
          >
            <div
              className="rounded-full p-2.5 flex-shrink-0"
              style={{ backgroundColor: surfaceContainerHigh }}
            >
              {option.icon}
            </div>
            <div className="flex-1">
              <div
                className="font-medium mb-1"
                style={{ color: colors.onSurface }}
              >
                {option.label}
              </div>
              <div
                className="text-sm"
                style={{ color: colors.onSurfaceVariant }}
              >
                {option.description}
              </div>
            </div>
          </div>
        ))}

        <div className="pt-2">
          <div
            className="font-medium mb-2"
            style={{ color: colors.onSurface }}
          >
            Password
          </div>
          <p
            className="text-sm mb-4"
            style={{ color: colors.onSurfaceVariant }}
          >
            Send yourself a password reset email.
          </p>
          <Button
            variant="outline"
            onClick={handlePasswordReset}
            disabled={!isClerkReady || !userEmail}
            style={{ borderRadius: borderRadius.default }}
          >
            Send password reset email
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

export default function SettingsPage() {
  const posthog = usePostHog();
  const { user, isClerkReady, resetPassword } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("company");

  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
    refetch: companyRefetch,
  } = useQuery<Company, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company");
      return (await res.json()) as Company;
    },
  });

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [companyStage, setCompanyStage] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [offer, setOffer] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [goals, setGoals] = useState("");

  useEffect(() => {
    if (company) {
      setCompanyName(company.name ?? "");
      setCompanyType(company.type ?? "");
      setCompanyStage(company.stage ?? "");
      setAssistantName(company.assistantName ?? "");
      setOffer(company.offer ?? "");
      setTargetCustomer(company.targetCustomer ?? "");
      setGoals(company.goals ?? "");
    }
  }, [company]);

  const updateCompanyMutation = useMutation<
    Company,
    Error,
    CompanyUpdateInput
  >({
    mutationFn: async (input) => {
      if (!company) throw new Error("No company loaded");
      const res = await apiRequest(
        "PATCH",
        `/api/company/${company.id}`,
        input,
      );
      return (await res.json()) as Company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({
        title: "Company settings saved",
        description: "Your changes are live.",
      });
    },
    onError: (err) => {
      toast({
        title: "Couldn't save company settings",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();
    updateCompanyMutation.mutate({
      name: companyName.trim() || undefined,
      type: companyType.trim() || null,
      stage: companyStage.trim() || null,
      assistantName: assistantName.trim() || null,
      offer: offer.trim() || null,
      targetCustomer: targetCustomer.trim() || null,
      goals: goals.trim() || null,
    });
  }

  async function handlePasswordReset() {
    if (!user?.email) {
      toast({
        title: "No email on file",
        description: "Can't send a password reset without an email.",
        variant: "destructive",
      });
      return;
    }
    await resetPassword(user.email);
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    window.dispatchEvent(
      new CustomEvent("analytics", {
        detail: {
          event: "settings_tab_changed",
          properties: { tabName: value },
        },
      }),
    );
  }

  return (
    <UniversalLayout title="Settings">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl font-semibold mb-2"
            style={{ color: colors.onSurface }}
          >
            Settings
          </h1>
          <p style={{ color: colors.onSurfaceVariant }}>
            Manage your profile, company settings, and preferences.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList
            className="w-full mb-8 overflow-x-auto flex-nowrap"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderRadius: borderRadius.default,
              padding: "4px",
            }}
          >
            <TabsTrigger
              value="company"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: borderRadius.default }}
            >
              <Building2 size={16} />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: borderRadius.default }}
            >
              <User size={16} />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ borderRadius: borderRadius.default }}
            >
              <Shield size={16} />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyTab
              company={company}
              companyLoading={companyLoading}
              companyError={companyError}
              companyRefetch={companyRefetch}
              companyName={companyName}
              setCompanyName={setCompanyName}
              companyType={companyType}
              setCompanyType={setCompanyType}
              companyStage={companyStage}
              setCompanyStage={setCompanyStage}
              assistantName={assistantName}
              setAssistantName={setAssistantName}
              offer={offer}
              setOffer={setOffer}
              targetCustomer={targetCustomer}
              setTargetCustomer={setTargetCustomer}
              goals={goals}
              setGoals={setGoals}
              handleCompanySubmit={handleCompanySubmit}
              updateCompanyMutation={updateCompanyMutation}
            />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileTab user={user} />
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab
              isClerkReady={isClerkReady}
              userEmail={user?.email}
              handlePasswordReset={handlePasswordReset}
            />
          </TabsContent>
        </Tabs>
      </div>
    </UniversalLayout>
  );
}
