import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LifeBuoy, Loader2, MessageSquareReply, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type SupportStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
type OperationsTicket = { id: string; category: string; subject: string; message: string; status: SupportStatus; reporterEmail: string; reporterName: string | null; createdAt: string; updatedAt: string };
type SupportMessage = { id: string; ticketId: string; authorKind: "customer" | "support"; body: string; createdAt: string };

const statusLabels: Record<SupportStatus, string> = { open: "Open", in_progress: "In progress", waiting_on_customer: "Waiting on customer", resolved: "Resolved", closed: "Closed" };

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The support action failed.";
  const start = error.message.indexOf("{");
  if (start >= 0) try { return (JSON.parse(error.message.slice(start)) as { message?: string }).message || error.message; } catch {}
  return error.message;
}

export function SupportOperationsQueue() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SupportStatus | "all">("open");
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportStatus>("waiting_on_customer");
  const tickets = useQuery<OperationsTicket[]>({
    queryKey: ["/api/platform/support/tickets", filter],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/platform/support/tickets${filter === "all" ? "" : `?status=${filter}`}`)).json(),
  });
  const selected = tickets.data?.find((ticket) => ticket.id === selectedId) || null;
  const messages = useQuery<SupportMessage[]>({
    queryKey: ["/api/platform/support/tickets", selectedId, "messages"],
    queryFn: async () => (await apiRequest<Response>("GET", `/api/platform/support/tickets/${selectedId}/messages`)).json(),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (!selectedId || !tickets.data?.some((ticket) => ticket.id === selectedId)) setSelectedId(tickets.data?.[0]?.id || "");
  }, [selectedId, tickets.data]);
  useEffect(() => { if (selected) setNextStatus(selected.status === "closed" ? "closed" : "waiting_on_customer"); }, [selected?.id, selected?.status]);

  const refreshQueue = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/platform/support/tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/platform/support/tickets", selectedId, "messages"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedId, "messages"] }),
    ]);
  };
  const sendReply = useMutation({
    mutationFn: async () => (await apiRequest<Response>("POST", `/api/platform/support/tickets/${selectedId}/messages`, { body: reply, status: nextStatus })).json(),
    onSuccess: async () => { setReply(""); setFilter(nextStatus); await refreshQueue(); },
  });
  const changeStatus = useMutation({
    mutationFn: async () => (await apiRequest<Response>("PATCH", `/api/platform/support/tickets/${selectedId}`, { status: nextStatus })).json(),
    onSuccess: async () => { setFilter(nextStatus); await refreshQueue(); },
  });

  return (
    <Card className="mt-7 rounded-[1.5rem] border-white/70 bg-white shadow-sm">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-primary" />Support operations</CardTitle><CardDescription className="mt-2">Platform administrators can triage requests, reply in-product, and leave a truthful customer-visible status. Staffing and response-time commitments remain operational gates.</CardDescription></div>
        <Button variant="outline" onClick={() => refreshQueue()} disabled={tickets.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${tickets.isFetching ? "animate-spin" : ""}`} />Refresh queue</Button>
      </CardHeader>
      <CardContent>
        <div className="mb-5 max-w-xs"><label htmlFor="support-queue-filter" className="mb-2 block text-sm font-medium">Queue status</label><Select value={filter} onValueChange={(value) => setFilter(value as SupportStatus | "all")}><SelectTrigger id="support-queue-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All requests</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        {tickets.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-muted" /> : tickets.isError ? <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">The support queue could not be loaded.</p> : tickets.data?.length === 0 ? <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">There are no requests in this queue.</p> : <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1" aria-label="Support operations queue">{tickets.data?.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} aria-pressed={selectedId === ticket.id} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedId === ticket.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><div className="flex items-start justify-between gap-3"><p className="font-medium">{ticket.subject}</p><Badge variant="outline">{statusLabels[ticket.status]}</Badge></div><p className="mt-2 truncate text-sm text-muted-foreground">{ticket.reporterName || ticket.reporterEmail}</p><p className="mt-1 text-xs text-muted-foreground">{ticket.category} · {new Date(ticket.createdAt).toLocaleString()}</p></button>)}</div>
          {selected && <div className="min-w-0 rounded-2xl border p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">{selected.category} request</p><h3 className="mt-1 text-xl font-semibold">{selected.subject}</h3><p className="mt-1 text-sm text-muted-foreground">{selected.reporterName || selected.reporterEmail} · {selected.id}</p></div><Badge>{statusLabels[selected.status]}</Badge></div>
            <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto" aria-label="Selected support conversation">{messages.isLoading ? <div className="h-24 animate-pulse rounded-2xl bg-muted" /> : messages.data?.map((message) => <div key={message.id} className={`rounded-2xl p-4 text-sm ${message.authorKind === "support" ? "ml-5 bg-primary/10" : "mr-5 bg-muted"}`}><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{message.authorKind === "support" ? "EOS Support" : "Customer"}</p><p className="mt-2 whitespace-pre-wrap break-words">{message.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</p></div>)}</div>
            <div className="mt-5 space-y-3 border-t pt-5"><label htmlFor="support-operations-reply" className="text-sm font-medium">Reply to customer</label><Textarea id="support-operations-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={10_000} placeholder="Write a clear update without credentials or private internal notes." /><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><Select value={nextStatus} onValueChange={(value) => setNextStatus(value as SupportStatus)}><SelectTrigger aria-label="Next support status"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => changeStatus.mutate()} disabled={changeStatus.isPending || nextStatus === selected.status}>{changeStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update status</Button><Button onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>{sendReply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareReply className="mr-2 h-4 w-4" />}Send reply</Button></div>{sendReply.isSuccess && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Reply delivered in EOS and the customer was notified.</p>}{(sendReply.isError || changeStatus.isError) && <p role="alert" className="text-sm text-destructive">{errorMessage(sendReply.error || changeStatus.error)}</p>}</div>
          </div>}
        </div>}
      </CardContent>
    </Card>
  );
}
