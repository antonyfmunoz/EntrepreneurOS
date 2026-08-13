import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

type InvitationPreview = {
  invitationId: string;
  company: { id: number; name: string };
  seat: { id: string; title: string; kind: string };
  expiresAt: string;
};

const storageKey = "eos.pendingMembershipInvitation";

function captureInvitationToken(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("token");
  if (fromUrl) {
    sessionStorage.setItem(storageKey, fromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
    return fromUrl;
  }
  return sessionStorage.getItem(storageKey) || "";
}

export default function InvitationAcceptancePage() {
  const [, navigate] = useLocation();
  const [token] = useState(captureInvitationToken);
  const preview = useQuery<InvitationPreview>({
    queryKey: ["membership-invitation-preview", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest<Response>("POST", "/api/eos/invitations/preview", { token });
      return response.json();
    },
  });
  const accept = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<Response>("POST", "/api/eos/invitations/accept", { token });
      return response.json() as Promise<{ companyId: number }>;
    },
    onSuccess: ({ companyId }) => {
      sessionStorage.removeItem(storageKey);
      navigate(`/company/${companyId}#my-role`);
    },
  });

  return (
    <main className="min-h-screen bg-[#f5f6f7] px-4 py-10">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <CardTitle>Join this organization</CardTitle>
          <CardDescription>Review the exact company and role before accepting. Access is granted only after you confirm.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!token && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">This invitation link is missing its acceptance token. Ask the sender for a new invitation.</div>}
          {preview.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking invitation…</div>}
          {preview.isError && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">This invitation is expired, revoked, already used, or belongs to a different verified email address.</div>}
          {preview.data && (
            <>
              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-semibold">{preview.data.company.name}</p><p className="mt-1 text-sm text-muted-foreground">{preview.data.seat.title}</p></div></div>
                <p className="mt-4 text-xs text-muted-foreground">Invitation expires {new Date(preview.data.expiresAt).toLocaleString()}.</p>
              </div>
              <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
                {accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Accept role and enter workspace
              </Button>
            </>
          )}
          {accept.isError && <p className="text-sm text-destructive">The invitation could not be accepted. Refresh its status or ask the sender for a new invitation.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
