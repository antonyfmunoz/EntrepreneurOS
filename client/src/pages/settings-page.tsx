import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle2, Mail, Shield } from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";
import { usePostHog } from "posthog-js/react";

// Company PATCH shape — matches the updateCompanySchema in
// server/routes/companies.ts without pulling the schema import
// because the shape is flat + minimal.
interface CompanyUpdateInput {
  name?: string;
  type?: string | null;
  stage?: string | null;
  offer?: string | null;
  targetCustomer?: string | null;
  goals?: string | null;
  assistantName?: string | null;
}

export default function SettingsPage() {
  const posthog = usePostHog();
  const { user, isClerkReady, resetPassword } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
  } = useQuery<Company, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company");
      return (await res.json()) as Company;
    },
  });

  // Local form state, seeded from the company query whenever it lands.
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

  return (
    <UniversalLayout title="Settings">
      <div className="max-w-[900px] mx-auto">
        <div className="mb-8">
          <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-[#2c2f30] mb-3">
            Settings
          </h1>
          <p className="text-base text-[#595c5d] max-w-xl">
            Manage your profile and company settings.
          </p>
        </div>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Company tab — editable, PATCH /api/company/:id */}
          <TabsContent value="company" className="space-y-4">
            {companyLoading && (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-3" />
                <span className="text-sm">Loading company…</span>
              </div>
            )}

            {companyError && !companyLoading && (
              <Card className="p-6 bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">
                      Couldn't load company
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {companyError.message}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {company && (
              <Card>
                <CardHeader>
                  <CardTitle>Company details</CardTitle>
                  <CardDescription>
                    These fields are used across the app to personalize your
                    workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleCompanySubmit}
                    className="space-y-5"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="company-name">Company name</Label>
                      <Input
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={updateCompanyMutation.isPending}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="grid gap-2">
                        <Label htmlFor="company-stage">Stage</Label>
                        <Input
                          id="company-stage"
                          value={companyStage}
                          onChange={(e) => setCompanyStage(e.target.value)}
                          placeholder="Pre-seed, Seed, Series A…"
                          disabled={updateCompanyMutation.isPending}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="company-type">Type</Label>
                        <Input
                          id="company-type"
                          value={companyType}
                          onChange={(e) => setCompanyType(e.target.value)}
                          placeholder="SaaS, Agency, D2C…"
                          disabled={updateCompanyMutation.isPending}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="assistant-name">Assistant name</Label>
                      <Input
                        id="assistant-name"
                        value={assistantName}
                        onChange={(e) => setAssistantName(e.target.value)}
                        placeholder="OS-1"
                        disabled={updateCompanyMutation.isPending}
                      />
                      <p className="text-xs text-slate-500">
                        What you want to call your AI assistant throughout the app.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="company-offer">Offer</Label>
                      <Textarea
                        id="company-offer"
                        value={offer}
                        onChange={(e) => setOffer(e.target.value)}
                        placeholder="What you sell and to whom."
                        rows={3}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="company-customer">
                        Target customer
                      </Label>
                      <Textarea
                        id="company-customer"
                        value={targetCustomer}
                        onChange={(e) => setTargetCustomer(e.target.value)}
                        placeholder="Who buys from you and why."
                        rows={3}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="company-goals">Goals</Label>
                      <Textarea
                        id="company-goals"
                        value={goals}
                        onChange={(e) => setGoals(e.target.value)}
                        placeholder="What you're building toward this quarter."
                        rows={3}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      {updateCompanyMutation.isSuccess && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved
                        </span>
                      )}
                      <Button
                        type="submit"
                        disabled={
                          updateCompanyMutation.isPending ||
                          !companyName.trim()
                        }
                        className="bg-[#6a37d4] text-white hover:bg-[#5a2dc0] disabled:opacity-50"
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
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Profile tab — read-only, Clerk owns identity */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your profile</CardTitle>
                <CardDescription>
                  Profile details are managed by Clerk. Update them from
                  Clerk's user settings to change them here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={user?.fullName ?? user?.username ?? ""}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    value={user?.email ?? ""}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    value={user?.username ?? ""}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security tab — delegated to Clerk */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email verification
                </CardTitle>
                <CardDescription>
                  Managed automatically by Clerk during signup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  {isClerkReady
                    ? "Your email is verified through your Clerk account."
                    : "Email verification is available when Clerk is configured."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Two-factor authentication
                </CardTitle>
                <CardDescription>
                  Configure 2FA from your Clerk account settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Clerk supports TOTP authenticator apps and SMS verification.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Send yourself a password reset email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handlePasswordReset}
                  disabled={!isClerkReady || !user?.email}
                >
                  Send password reset email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UniversalLayout>
  );
}
