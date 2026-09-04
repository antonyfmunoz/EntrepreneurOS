import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, FileCheck2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { safeInternalReturnPath } from "@/lib/safe-return";

type LegalDocument = { id: string; documentType: string; title: string; version: string; url: string; effectiveAt: string };
type LegalStatus = { enforcement: boolean; enforcementRequested?: boolean; configurationReady: boolean; missingConfiguration: string[]; documents: LegalDocument[]; missing: LegalDocument[] };

export default function LegalAcceptancePage() {
  const [, navigate] = useLocation();
  const returnTo = safeInternalReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
  const status = useQuery<LegalStatus>({ queryKey: ["/api/legal/status"] });
  const accept = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest<Response>("POST", "/api/legal/acceptances", { documentId, accepted: true });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/legal/status"] });
    },
  });
  const missing = status.data?.missing || [];
  return (
    <main className="min-h-screen bg-[#f5f6f7] px-4 py-10">
      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" />Review current agreements</CardTitle><CardDescription>Each required document is versioned. EOS records the exact document checksum and acceptance time.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {status.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading agreements…</div>}
          {status.data && !status.data.configurationReady && status.data.enforcement && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Public legal documents are not yet published. Account access remains gated while legal review is completed.</div>}
          {status.data && !status.data.configurationReady && !status.data.enforcement && <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">EOS is in internal testing mode. Public legal documents have not been published, so acceptance is not required for this workspace.</div>}
          {missing.map((document) => (
            <div key={document.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-medium">{document.title}</p><p className="text-xs text-muted-foreground">Version {document.version} · Effective {new Date(document.effectiveAt).toLocaleDateString()}</p></div>
                <Button variant="outline" asChild><a href={document.url} target="_blank" rel="noreferrer">Read document <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
              </div>
              <Button className="mt-4 w-full" onClick={() => accept.mutate(document.id)} disabled={accept.isPending}>I have read and accept this version</Button>
            </div>
          ))}
          {status.data && (!status.data.enforcement || (status.data.configurationReady && missing.length === 0)) && <div className="space-y-4 text-center"><p className="text-sm">{status.data.enforcement ? "All current required documents have been accepted." : "No legal acceptance is required in the current internal testing mode."}</p><Button onClick={() => navigate(returnTo)}>Continue to EntrepreneurOS</Button></div>}
          {accept.isError && <p className="text-sm text-destructive">Acceptance could not be recorded. Try again.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
