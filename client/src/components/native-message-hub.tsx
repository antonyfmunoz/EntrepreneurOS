import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircleMore, MessagesSquare, Plus, RefreshCw, Send, ShieldCheck, UsersRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type Seat = { id: string; title: string; agentName: string; status?: string; supervisorSeatId?: string | null };

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function stateVariant(state: string) {
  return ["active", "completed"].includes(state) ? "default" as const : "outline" as const;
}

const channels = [
  { key: "native_eos", label: "Native EOS", detail: "Internal EOS conversation" },
  { key: "email", label: "Email", detail: "Governed provider delivery intent" },
  { key: "slack", label: "Slack", detail: "Governed provider delivery intent" },
  { key: "sms", label: "SMS", detail: "Governed provider delivery intent" },
  { key: "social", label: "Social", detail: "Governed provider delivery intent" },
] as const;

export function NativeMessageHub({ root, roleScopeKey, activeSeatId, seats, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  activeSeatId: string;
  seats: Seat[];
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [conversationPurpose, setConversationPurpose] = useState("");
  const [participantSeatIds, setParticipantSeatIds] = useState<string[]>([]);
  const [channel, setChannel] = useState<(typeof channels)[number]["key"]>("native_eos");
  const [messageBody, setMessageBody] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [error, setError] = useState("");

  const query = useQuery<Json>({
    // A role may communicate without having visibility into every EOS tool.
    // Keep reads on the messages resource rather than the global manifest.
    queryKey: [root, roleScopeKey, "native-messages"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/messages`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const conversations = useMemo(() => objects.filter((item) => item.objectType === "conversation"), [objects]);
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) || conversations[0];
  const messages = useMemo(() => objects.filter((item) => item.objectType === "message" && item.data?.conversationObjectId === selectedConversation?.id), [objects, selectedConversation?.id]);
  const threads = useMemo(() => objects.filter((item) => item.objectType === "thread" && item.data?.conversationObjectId === selectedConversation?.id), [objects, selectedConversation?.id]);
  const selectedChannel = channels.find((item) => item.key === channel)!;

  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-messages"] });
  const createConversation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "messages", objectType: "conversation", objectKey: `conversation:${safeKey(conversationTitle)}:${Date.now()}`,
      title: conversationTitle.trim(), summary: conversationPurpose.trim(), classification: "confidential", visibility: "team",
        data: { participantSeatIds }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("message-conversation"),
    })).json(),
    onSuccess: async (result) => { setSelectedConversationId(result.object.id); setConversationTitle(""); setConversationPurpose(""); setParticipantSeatIds([]); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation) throw new Error("Create or select a conversation first.");
      const delivery = channel === "native_eos" ? "native_recorded" : "provider_intent";
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "messages", objectType: "message", objectKey: `message:${safeKey(selectedConversation.title)}:${Date.now()}`,
        title: `${selectedChannel.label} · ${selectedConversation.title}`, summary: messageBody.trim().slice(0, 300), classification: "confidential", visibility: "team",
        parentObjectId: selectedConversation.id,
        data: { conversationObjectId: selectedConversation.id, body: messageBody.trim(), channelType: channel, deliveryState: delivery },
        sourceReference: { authority: "native_eos", providerEffect: false }, evidenceIds: [], idempotencyKey: commandKey("message-record"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedConversation.id, targetObjectId: result.object.id, relationshipType: "contains", metadata: { channelType: channel }, idempotencyKey: commandKey("message-link") });
      return result;
    },
    onSuccess: async () => { setMessageBody(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createThread = useMutation({
    mutationFn: async () => {
      if (!selectedConversation) throw new Error("Create or select a conversation first.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "messages", objectType: "thread", objectKey: `thread:${safeKey(threadTitle)}:${Date.now()}`,
        title: threadTitle.trim(), summary: `Thread inside ${selectedConversation.title}.`, classification: "confidential", visibility: "team",
        parentObjectId: selectedConversation.id,
        data: { conversationObjectId: selectedConversation.id }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("message-thread"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedConversation.id, targetObjectId: result.object.id, relationshipType: "contains", metadata: {}, idempotencyKey: commandKey("thread-link") });
      return result;
    },
    onSuccess: async () => { setThreadTitle(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state: "active", rationale: "Activate this bounded native communication record for its stated operating purpose.", evidenceIds: [], idempotencyKey: commandKey("activate-message-object"),
    })).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });

  const toggleSeat = (seatId: string) => setParticipantSeatIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  return <Card data-testid="native-message-hub">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2"><MessagesSquare className="h-5 w-5 text-primary" />Message Hub</CardTitle><CardDescription className="mt-1">One role-scoped place for internal conversations, threads, and channel-specific delivery intent. Native EOS conversation records work without any external provider.</CardDescription></div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Message command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /><h3 className="font-semibold">1. Start a governed conversation</h3></div><p className="mt-1 text-sm text-muted-foreground">Include yourself and only adjacent seats in the reporting line: your direct manager and/or your direct reports. The server enforces this boundary; it does not create a provider account or external group chat.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="message-conversation-title">Conversation name</Label><Input id="message-conversation-title" className="mt-1" value={conversationTitle} onChange={(event) => setConversationTitle(event.target.value)} placeholder="Revenue recovery operating thread" /></div><div><Label htmlFor="message-conversation-purpose">Purpose</Label><Textarea id="message-conversation-purpose" className="mt-1" value={conversationPurpose} onChange={(event) => setConversationPurpose(event.target.value)} placeholder="What work, decision, or coordination belongs here?" /></div><div><p className="text-sm font-medium">Visible participants</p><div className="mt-2 flex flex-wrap gap-2">{seats.filter((seat) => seat.status !== "inactive").map((seat) => <label key={seat.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"><input type="checkbox" checked={participantSeatIds.includes(seat.id)} onChange={() => toggleSeat(seat.id)} />{seat.title}{seat.id === activeSeatId ? " (you)" : ""}</label>)}</div></div><Button disabled={!canExecute || conversationTitle.trim().length < 2 || participantSeatIds.length < 2 || !participantSeatIds.includes(activeSeatId) || createConversation.isPending} onClick={() => createConversation.mutate()}><Plus className="mr-2 h-4 w-4" />{createConversation.isPending ? "Creating conversation…" : "Create native conversation"}</Button></div><div className="mt-4 space-y-2">{conversations.map((conversation) => <button type="button" key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={`w-full rounded-lg border p-3 text-left ${selectedConversation?.id === conversation.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><span className="font-medium">{conversation.title}</span><Badge variant={stateVariant(conversation.state)}>{conversation.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{conversation.summary || "No purpose recorded"} · {Array.isArray(conversation.data?.participantSeatIds) ? conversation.data.participantSeatIds.length : 0} seats</p></button>)}{!conversations.length && <p className="py-3 text-sm text-muted-foreground">No native conversations yet.</p>}</div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /><h3 className="font-semibold">2. Record a message or delivery intent</h3></div><p className="mt-1 text-sm text-muted-foreground">Native EOS messages are stored in this conversation. Choosing an external channel records a governed intent only; it never claims an email, Slack, SMS, or social post was sent.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="message-channel">Channel</Label><select id="message-channel" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>{channels.map((item) => <option key={item.key} value={item.key}>{item.label} — {item.detail}</option>)}</select></div><div><Label htmlFor="message-body">Message</Label><Textarea id="message-body" className="mt-1" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write the accountable update, request, decision context, or handoff." /></div><Button disabled={!canExecute || !selectedConversation || messageBody.trim().length < 1 || createMessage.isPending} onClick={() => createMessage.mutate()}><Send className="mr-2 h-4 w-4" />{createMessage.isPending ? "Recording…" : channel === "native_eos" ? "Record native message" : "Create governed delivery intent"}</Button><div className="border-t pt-3"><Label htmlFor="message-thread-title">Open a focused thread</Label><div className="mt-1 flex gap-2"><Input id="message-thread-title" value={threadTitle} onChange={(event) => setThreadTitle(event.target.value)} placeholder="Pricing exception review" /><Button variant="outline" disabled={!canExecute || !selectedConversation || threadTitle.trim().length < 2 || createThread.isPending} onClick={() => createThread.mutate()}><MessageCircleMore className="mr-2 h-4 w-4" />Thread</Button></div></div></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Conversation ledger</p><h3 className="mt-1 font-semibold">{selectedConversation ? selectedConversation.title : "Choose a conversation"}</h3></div>{selectedConversation?.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedConversation)}>Activate conversation</Button>}</div>{selectedConversation && <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-3">{messages.map((message) => <article key={message.id} className="rounded-xl bg-muted/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline">{String(message.data?.channelType || "native_eos").replaceAll("_", " ")}</Badge><Badge variant={message.data?.deliveryState === "provider_intent" ? "secondary" : "default"}>{message.data?.deliveryState === "provider_intent" ? "provider intent" : "native record"}</Badge></div><span className="text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{message.data?.body || message.summary}</p>{message.state === "draft" && <Button size="sm" variant="outline" className="mt-3" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(message)}>Activate record</Button>}</article>)}{!messages.length && <p className="py-4 text-sm text-muted-foreground">No messages recorded in this conversation.</p>}</div><aside className="rounded-xl border bg-muted/30 p-3"><p className="text-sm font-medium">Threads</p><div className="mt-3 space-y-2">{threads.map((thread) => <div key={thread.id} className="rounded-lg bg-background p-3"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{thread.title}</span><Badge variant={stateVariant(thread.state)}>{thread.state}</Badge></div>{thread.state === "draft" && <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(thread)}>Activate</Button>}</div>)}{!threads.length && <p className="text-xs text-muted-foreground">No focused threads yet.</p>}</div></aside></div>}</section>
      <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Communication stays truthful and hierarchical</AlertTitle><AlertDescription>This hub preserves native EOS records and governed external-delivery intent. Provider delivery, receipts, reconciliation, and retry remain separate authorized operations; it does not bypass the EA, reporting chain, approval controls, or role visibility.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
