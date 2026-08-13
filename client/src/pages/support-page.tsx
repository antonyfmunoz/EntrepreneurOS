import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, LifeBuoy, Loader2, MessageSquareReply, ShieldCheck } from "lucide-react";
import { SupportOperationsQueue } from "@/components/support-operations-queue";
import { UniversalLayout } from "@/components/layout/universal-layout";
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
type SupportMessage = { id: string; ticketId: string; authorKind: "customer" | "support"; body: string; createdAt: string };

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
  const [selectedTicketId, setSelectedTicketId] = useState(() => new URLSearchParams(window.location.search).get("ticket") || "");
  const [reply, setReply] = useState("");
  const tickets = useQuery<SupportTicket[]>({ queryKey: ["/api/support/tickets"] });
  const capabilities = useQuery<{ operationalReadiness: boolean }>({ queryKey: ["/api/platform/capabilities"] });
  const selectedTicket = tickets.data?.find((ticket) => ticket.id === selectedTicketId) || null;
  const messages = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/tickets", selectedTicketId, "messages"],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/support/tickets/${selectedTicketId}/messages`)).json(),
    enabled: Boolean(selectedTicketId),
  });
  const selectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    const url = new URL(window.location.href);
    url.searchParams.set("ticket", ticketId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };
  useEffect(() => {
    if ((!selectedTicketId || !tickets.data?.some((ticket) => ticket.id === selectedTicketId)) && tickets.data?.[0]) selectTicket(tickets.data[0].id);
  }, [selectedTicketId, tickets.data]);
  const createTicket = useMutation({
    mutationFn: async (payload: { category: string; subject: string; message: string }) => {
      const response = await apiRequest<Response>("POST", "/api/support/tickets", payload);
      return await response.json() as SupportTicket;
    },
    onSuccess: async (ticket) => {
      setSubmittedId(ticket.id);
      selectTicket(ticket.id);
      await queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Support request received", description: `Reference ${ticket.id}` });
    },
    onError: (error) => toast({ title: "Support request not submitted", description: error.message, variant: "destructive" }),
  });
  const replyToTicket = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", `/api/support/tickets/${selectedTicketId}/messages`, { body: reply })).json(),
    onSuccess: async () => {
      setReply("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicketId, "messages"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/platform/support/tickets"] }),
      ]);
      toast({ title: "Reply sent", description: "Your update is now part of the support record." });
    },
    onError: (error) => toast({ title: "Reply not sent", description: error.message, variant: "destructive" }),
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
    <UniversalLayout title="Support" leftRailItems={[]} floatingPanel={false}>
      <main className="p-1 sm:p-3">
        <div className="mx-auto mb-7 max-w-5xl">
          <p className="eos-label">Account support</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Support</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">Record a problem, retain its reference, and track the requests visible to your account.</p>
        </div>
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
                  <button type="button" key={ticket.id} onClick={() => selectTicket(ticket.id)} aria-pressed={selectedTicketId === ticket.id} aria-label={`Open support request ${ticket.subject}`} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedTicketId === ticket.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{ticket.subject}</p><Badge variant="outline">{statusLabels[ticket.status] || ticket.status}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString()} · {ticket.id}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
            {selectedTicket && <Card><CardHeader><CardTitle className="text-base">Support conversation</CardTitle><CardDescription>{selectedTicket.subject} · {statusLabels[selectedTicket.status] || selectedTicket.status}</CardDescription></CardHeader><CardContent><div className="max-h-[360px] space-y-3 overflow-y-auto" aria-label="Support conversation">{messages.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : messages.isError ? <p className="text-sm text-destructive">This conversation could not be loaded.</p> : messages.data?.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.authorKind === "support" ? "ml-4 bg-primary/10" : "mr-4 bg-muted"}`}><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{message.authorKind === "support" ? "EOS Support" : "You"}</p><p className="mt-2 whitespace-pre-wrap break-words">{message.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</p></div>)}</div>{selectedTicket.status === "closed" ? <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">This request is closed. Create a new request if you need more help.</p> : <div className="mt-4 space-y-3 border-t pt-4"><label htmlFor="customer-support-reply" className="text-sm font-medium">Add an update</label><Textarea id="customer-support-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={10_000} placeholder="Add new context without passwords, tokens, or recovery codes." /><Button className="w-full" onClick={() => replyToTicket.mutate()} disabled={!reply.trim() || replyToTicket.isPending}>{replyToTicket.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareReply className="mr-2 h-4 w-4" />}Send update</Button></div>}</CardContent></Card>}
            <Card>
              <CardContent className="flex gap-3 pt-6">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><p className="text-sm font-medium">Security and privacy</p><p className="mt-1 text-sm text-muted-foreground">Do not submit secrets. Security requests are categorized for restricted operational review, but this form is not an emergency channel.</p></div>
              </CardContent>
            </Card>
          </div>
        </div>
        {capabilities.data?.operationalReadiness && <div className="mx-auto max-w-5xl"><SupportOperationsQueue /></div>}
      </main>
    </UniversalLayout>
  );
}
