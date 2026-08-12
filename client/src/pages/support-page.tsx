import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, LifeBuoy, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SupportTicket = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};

export default function SupportPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState("technical");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const tickets = useQuery<SupportTicket[]>({ queryKey: ["/api/support/tickets"] });
  const createTicket = useMutation({
    mutationFn: async (payload: { category: string; subject: string; message: string }) => {
      const response = await apiRequest<Response>("POST", "/api/support/tickets", payload);
      return await response.json() as SupportTicket;
    },
    onSuccess: async (ticket) => {
      setSubmittedId(ticket.id);
      await queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Support request received", description: `Reference ${ticket.id}` });
    },
    onError: (error) => toast({ title: "Support request not submitted", description: error.message, variant: "destructive" }),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createTicket.mutate({
      category,
      subject: String(data.get("subject") || ""),
      message: String(data.get("message") || ""),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Support">
        <Button variant="ghost" size="sm" asChild className="mr-4" aria-label="Return to workspace">
          <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
      </Header>
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5" />Request help</CardTitle>
              <CardDescription>Your request is saved to the authenticated EOS operations queue. No response time is promised until a staffed support policy is published.</CardDescription>
            </CardHeader>
            <CardContent>
              {submittedId ? (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-600" />
                  <h2 className="text-xl font-semibold">Request recorded</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Keep this reference for follow-up: <span className="font-mono text-foreground">{submittedId}</span></p>
                  <Button className="mt-6" onClick={() => setSubmittedId(null)}>Submit another request</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="support-category" className="text-sm font-medium">Category</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="support-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="account">Account access</SelectItem>
                        <SelectItem value="technical">Technical problem</SelectItem>
                        <SelectItem value="integration">External integration</SelectItem>
                        <SelectItem value="security">Security concern</SelectItem>
                        <SelectItem value="feedback">Feedback or feature request</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="support-subject" className="text-sm font-medium">Subject</label>
                    <Input id="support-subject" name="subject" minLength={3} maxLength={160} required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="support-message" className="text-sm font-medium">What happened?</label>
                    <Textarea id="support-message" name="message" minLength={10} maxLength={10000} rows={8} required placeholder="Include the workspace, action, expected result, and what you observed. Do not include passwords, access tokens, or recovery codes." />
                  </div>
                  <Button type="submit" className="w-full" disabled={createTicket.isPending}>
                    {createTicket.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit support request
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Your requests</CardTitle><CardDescription>Only requests created by your authenticated account are shown.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {tickets.isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
                {tickets.isError && <p className="text-sm text-destructive">Requests could not be loaded.</p>}
                {tickets.data?.length === 0 && <p className="text-sm text-muted-foreground">No support requests yet.</p>}
                {tickets.data?.slice(0, 8).map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{ticket.subject}</p><Badge variant="outline">{statusLabels[ticket.status] || ticket.status}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString()} · {ticket.id}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex gap-3 pt-6">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><p className="text-sm font-medium">Security and privacy</p><p className="mt-1 text-sm text-muted-foreground">Do not submit secrets. Security requests are categorized for restricted operational review, but this form is not an emergency channel.</p></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
