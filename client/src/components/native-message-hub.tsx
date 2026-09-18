import { useEffect, useMemo, useState } from "react";
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
export type NativeMessageSeat = { id: string; title: string; agentName: string; status?: string; supervisorSeatId?: string | null };

/**
 * Keep the chooser honest with the same direct-reporting-line boundary that
 * the server enforces. Cross-chain work is deliberately routed through the
 * role assistant instead of presenting a choice which will fail on submit.
 */
export function eligibleNativeConversationSeats(activeSeatId: string, seats: NativeMessageSeat[]) {
  const activeSeat = seats.find((seat) => seat.id === activeSeatId);
  if (!activeSeat) return [];
  return seats.filter((seat) => seat.status !== "inactive" && (
    seat.id === activeSeatId ||
    seat.supervisorSeatId === activeSeatId ||
    activeSeat.supervisorSeatId === seat.id
  ));
}

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
  { key: "email", label: "Email", detail: "Plan a governed Gmail delivery" },
  { key: "slack", label: "Slack", detail: "Plan a governed Slack delivery" },
  { key: "sms", label: "SMS", detail: "Governed provider delivery intent" },
  { key: "social", label: "Social", detail: "Governed provider delivery intent" },
] as const;

type MessageChannel = (typeof channels)[number]["key"];
type IntegrationOperationsProjection = { bindings?: Json[]; manifests?: Json[] };

function providerOperationForChannel(channel: MessageChannel) {
  if (channel === "email") return "gmail.send";
  if (channel === "slack") return "slack.message.send";
  return null;
}

function providerKeysForChannel(channel: MessageChannel) {
  if (channel === "email") return ["gmail", "google", "google_workspace", "google-workspace"];
  if (channel === "slack") return ["slack"];
  return [];
}

function providerRequestForChannel(input: { channel: MessageChannel; destination: string; subject: string; body: string; threadReference: string }) {
  if (input.channel === "email") return { to: input.destination.trim(), subject: input.subject.trim(), body: input.body.trim() };
  if (input.channel === "slack") return { channelId: input.destination.trim(), text: input.body.trim(), ...(input.threadReference.trim() ? { threadTs: input.threadReference.trim() } : {}) };
  return null;
}

export function NativeMessageHub({ root, roleScopeKey, activeSeatId, seats, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  activeSeatId: string;
  seats: NativeMessageSeat[];
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [conversationPurpose, setConversationPurpose] = useState("");
  const [participantSeatIds, setParticipantSeatIds] = useState<string[]>([]);
  const [channel, setChannel] = useState<MessageChannel>("native_eos");
  const [messageBody, setMessageBody] = useState("");
  const [deliveryDestination, setDeliveryDestination] = useState("");
  const [deliverySubject, setDeliverySubject] = useState("");
  const [deliveryThreadReference, setDeliveryThreadReference] = useState("");
  const [deliveryBindingId, setDeliveryBindingId] = useState("");
  const [plannedRunId, setPlannedRunId] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
  const selectedThread = threads.find((item) => item.id === selectedThreadId) || null;
  const visibleMessages = useMemo(
    () => selectedThread ? messages.filter((message) => message.data?.threadObjectId === selectedThread.id) : messages,
    [messages, selectedThread],
  );
  // Relationship context is deliberately optional. A role that can use the
  // Message Hub but has no CRM visibility must not receive a CRM request or a
  // selector that leaks another team's relationship records.
  const contextQuery = useQuery<Json>({
    queryKey: [root, roleScopeKey, "native-message-context"],
    queryFn: async () => (await apiRequest("GET", `${root}/context`)).json(),
  });
  const canViewCrm = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys)
    && contextQuery.data.principalContext.visibleInstrumentKeys.includes("crm");
  const crmQuery = useQuery<Json>({
    queryKey: [root, roleScopeKey, "native-message-crm-context"],
    enabled: Boolean(canViewCrm),
    retry: false,
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json(),
  });
  const crmObjects: Json[] = crmQuery.data?.objects || [];
  const crmPeople = useMemo(() => crmObjects.filter((item) => item.objectType === "person"), [crmObjects]);
  const crmRelationships = useMemo(() => crmObjects.filter((item) => item.objectType === "relationship"), [crmObjects]);
  const relationshipChoices = useMemo(() => crmRelationships.map((relationship) => {
    const person = crmPeople.find((candidate) => candidate.id === relationship.data?.personObjectId);
    const displayName = person?.data?.displayName || person?.title || "Visible relationship";
    return {
      relationship,
      person,
      label: `${String(relationship.data?.relationshipType || "Relationship").replaceAll("_", " ")} · ${displayName}`,
    };
  }), [crmPeople, crmRelationships]);
  const selectedRelationshipChoice = relationshipChoices.find((item) => item.relationship.id === selectedRelationshipId) || null;
  const selectedChannel = channels.find((item) => item.key === channel)!;
  const providerOperation = providerOperationForChannel(channel);
  const mayPlanProviderDelivery = Boolean(providerOperation);
  const integrationOperationsQuery = useQuery<IntegrationOperationsProjection>({
    queryKey: [root, roleScopeKey, "message-provider-delivery-plans"],
    enabled: mayPlanProviderDelivery,
    queryFn: async () => (await apiRequest("GET", `${root}/integration-operations`)).json(),
  });
  const compatibleBindings = useMemo(() => {
    if (!providerOperation) return [];
    const providerKeys = new Set(providerKeysForChannel(channel));
    const manifests = integrationOperationsQuery.data?.manifests || [];
    return (integrationOperationsQuery.data?.bindings || []).filter((binding) => {
      const currentManifest = manifests.some((manifest) => manifest.integrationBindingId === binding.id && manifest.bindingConfigurationVersion === binding.configurationVersion && Array.isArray(manifest.operations) && manifest.operations.includes(providerOperation));
      return providerKeys.has(String(binding.providerKey || "").toLowerCase()) && binding.lifecycleState === "active" && binding.connectionState === "connected" && currentManifest;
    });
  }, [channel, integrationOperationsQuery.data, providerOperation]);
  const selectedDeliveryBinding = compatibleBindings.find((binding) => binding.id === deliveryBindingId) || null;
  const providerRequest = providerRequestForChannel({ channel, destination: deliveryDestination, subject: deliverySubject, body: messageBody, threadReference: deliveryThreadReference });
  const providerDestinationIsValid = channel === "email" ? Boolean(deliveryDestination.trim() && deliverySubject.trim()) : channel === "slack" ? Boolean(deliveryDestination.trim()) : false;
  const eligibleSeats = useMemo(
    () => eligibleNativeConversationSeats(activeSeatId, seats),
    [activeSeatId, seats],
  );
  const adjacentSeats = useMemo(
    () => eligibleSeats.filter((seat) => seat.id !== activeSeatId),
    [activeSeatId, eligibleSeats],
  );
  const conversationParticipantSeatIds = useMemo(
    () => Array.from(new Set([activeSeatId, ...participantSeatIds].filter(Boolean))),
    [activeSeatId, participantSeatIds],
  );

  useEffect(() => {
    const allowed = new Set(adjacentSeats.map((seat) => seat.id));
    setParticipantSeatIds((current) => current.filter((seatId) => allowed.has(seatId)));
  }, [adjacentSeats]);

  useEffect(() => {
    if (!mayPlanProviderDelivery) {
      setDeliveryBindingId("");
      return;
    }
    if (!compatibleBindings.some((binding) => binding.id === deliveryBindingId)) setDeliveryBindingId(compatibleBindings[0]?.id || "");
  }, [compatibleBindings, deliveryBindingId, mayPlanProviderDelivery]);

  useEffect(() => {
    if (selectedRelationshipId && !relationshipChoices.some((item) => item.relationship.id === selectedRelationshipId))
      setSelectedRelationshipId("");
  }, [relationshipChoices, selectedRelationshipId]);

  useEffect(() => {
    if (selectedThreadId && !threads.some((thread) => thread.id === selectedThreadId))
      setSelectedThreadId("");
  }, [selectedThreadId, threads]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-messages"] });
  const createConversation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "messages", objectType: "conversation", objectKey: `conversation:${safeKey(conversationTitle)}:${Date.now()}`,
      title: conversationTitle.trim(), summary: conversationPurpose.trim(), classification: "confidential", visibility: "team",
        data: { participantSeatIds: conversationParticipantSeatIds }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("message-conversation"),
    })).json(),
    onSuccess: async (result) => { setSelectedConversationId(result.object.id); setSelectedThreadId(""); setConversationTitle(""); setConversationPurpose(""); setParticipantSeatIds([]); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const chooseRelationship = (relationshipId: string) => {
    setSelectedRelationshipId(relationshipId);
    const choice = relationshipChoices.find((item) => item.relationship.id === relationshipId);
    // This is a convenience draft only. The operator can always replace it,
    // and no email is sent until the provider's governed run is approved.
    if (channel === "email" && !deliveryDestination.trim() && choice?.person?.data?.email)
      setDeliveryDestination(String(choice.person.data.email));
  };

  const createMessageRecord = async (input: { deliveryState: "native_recorded" | "provider_intent" }) => {
    if (!selectedConversation) throw new Error("Create or select a conversation first.");
    const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "messages", objectType: "message", objectKey: `message:${safeKey(selectedConversation.title)}:${Date.now()}`,
      title: `${selectedChannel.label} · ${selectedConversation.title}`, summary: messageBody.trim().slice(0, 300), classification: "confidential", visibility: "team",
      parentObjectId: selectedThread?.id || selectedConversation.id,
      data: {
        conversationObjectId: selectedConversation.id,
        ...(selectedThread ? { threadObjectId: selectedThread.id } : {}),
        body: messageBody.trim(),
        channelType: channel,
        deliveryState: input.deliveryState,
        ...(deliveryDestination.trim() ? { destination: deliveryDestination.trim() } : {}),
        ...(deliverySubject.trim() ? { subject: deliverySubject.trim() } : {}),
        ...(deliveryThreadReference.trim() ? { threadReference: deliveryThreadReference.trim() } : {}),
        ...(selectedRelationshipChoice ? {
          relationshipContext: {
            relationshipObjectId: selectedRelationshipChoice.relationship.id,
            label: selectedRelationshipChoice.label,
          },
        } : {}),
      },
      sourceReference: { authority: "native_eos", providerEffect: false }, evidenceIds: [], idempotencyKey: commandKey("message-record"),
    })).json();
    await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedThread?.id || selectedConversation.id, targetObjectId: result.object.id, relationshipType: "contains", metadata: { channelType: channel, ...(selectedThread ? { threadObjectId: selectedThread.id } : {}) }, idempotencyKey: commandKey("message-link") });
    let relationshipLinked = true;
    if (selectedRelationshipChoice) {
      try {
        await apiRequest("POST", `${root}/instrument-links`, {
          sourceObjectId: result.object.id,
          targetObjectId: selectedRelationshipChoice.relationship.id,
          relationshipType: "concerns_relationship",
          metadata: { channelType: channel, relationshipLabel: selectedRelationshipChoice.label },
          idempotencyKey: commandKey("message-relationship-link"),
        });
      } catch {
        // The native message itself is already durable. Keep that truth
        // visible instead of reporting the whole command as failed because a
        // separate relationship-link write was rejected or raced.
        relationshipLinked = false;
      }
    }
    return { ...result, relationshipLinked };
  };
  const createMessage = useMutation({
    mutationFn: async () => createMessageRecord({ deliveryState: channel === "native_eos" ? "native_recorded" : "provider_intent" }),
    onSuccess: async (result) => {
      setMessageBody("");
      if (!result.relationshipLinked) setNotice("The message was recorded, but EOS could not create its relationship link. Refresh CRM access and review the message before relying on that relationship context.");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const planProviderDelivery = useMutation({
    mutationFn: async () => {
      if (!providerOperation || !providerRequest || !selectedDeliveryBinding) throw new Error("Choose a connected company provider and complete its delivery details before planning delivery.");
      const message = await createMessageRecord({ deliveryState: "provider_intent" });
      const planned = await (await apiRequest("POST", `${root}/integration-operations/runs`, {
        integrationBindingId: selectedDeliveryBinding.id,
        operation: providerOperation,
        idempotencyKey: commandKey("message-provider-plan"),
        requestReference: `native-message:${message.object.id}`,
        requestShape: providerRequest,
        maxAttempts: 3,
        ownerSeatId: activeSeatId,
        classification: "confidential",
      })).json();
      try {
        await apiRequest("PATCH", `${root}/instrument-objects/${message.object.id}`, {
          expectedVersion: message.object.version,
          data: { ...message.object.data, deliveryState: "provider_delivery_planned", integrationBindingId: selectedDeliveryBinding.id, integrationRunId: planned.run.id, operation: providerOperation },
          sourceReference: { ...message.object.sourceReference, authority: "native_eos", providerEffect: false, integrationBindingId: selectedDeliveryBinding.id, integrationRunId: planned.run.id },
          idempotencyKey: commandKey("message-provider-plan-link"),
        });
        return { ...planned.run, ledgerLinked: true, relationshipLinked: message.relationshipLinked };
      } catch {
        // The provider plan is already durable. Never tell an operator it
        // failed just because the optional native-ledger annotation raced.
        return { ...planned.run, ledgerLinked: false, relationshipLinked: message.relationshipLinked };
      }
    },
    onSuccess: async (run) => {
      setPlannedRunId(run.id);
      setMessageBody("");
      setDeliveryDestination("");
      setDeliverySubject("");
      setDeliveryThreadReference("");
      if (!run.ledgerLinked) setError(`Provider delivery plan ${run.id} was created, but its native ledger annotation could not be updated. Review that exact run in Operations before taking another delivery action.`);
      if (!run.relationshipLinked) setNotice(`Provider delivery plan ${run.id} was created, but EOS could not create its CRM relationship link. Review that exact message and relationship before treating the context as linked.`);
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "message-provider-delivery-plans"] })]);
    },
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
    onSuccess: async (result) => { setSelectedThreadId(result.object.id); setThreadTitle(""); await refresh(); },
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
      {notice && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Message record needs review</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /><h3 className="font-semibold">1. Start a governed conversation</h3></div><p className="mt-1 text-sm text-muted-foreground">You are included automatically. Select only a direct manager or direct report; non-adjacent work belongs with your role assistant, which coordinates through the reporting chain.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="message-conversation-title">Conversation name</Label><Input id="message-conversation-title" className="mt-1" value={conversationTitle} onChange={(event) => setConversationTitle(event.target.value)} placeholder="Revenue recovery operating thread" /></div><div><Label htmlFor="message-conversation-purpose">Purpose</Label><Textarea id="message-conversation-purpose" className="mt-1" value={conversationPurpose} onChange={(event) => setConversationPurpose(event.target.value)} placeholder="What work, decision, or coordination belongs here?" /></div><div><p className="text-sm font-medium">Reporting-line participants</p><div className="mt-2 flex flex-wrap gap-2">{eligibleSeats.map((seat) => <label key={seat.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${seat.id === activeSeatId ? "bg-muted/50" : "cursor-pointer"}`}><input type="checkbox" checked={seat.id === activeSeatId || participantSeatIds.includes(seat.id)} disabled={seat.id === activeSeatId} onChange={() => toggleSeat(seat.id)} />{seat.title}{seat.id === activeSeatId ? " (you)" : ""}</label>)}</div>{!adjacentSeats.length && <p className="mt-2 text-xs text-muted-foreground">No active direct manager or report is available in this role scope. Use your role assistant to route the request.</p>}</div><Button disabled={!canExecute || conversationTitle.trim().length < 2 || conversationParticipantSeatIds.length < 2 || createConversation.isPending} onClick={() => createConversation.mutate()}><Plus className="mr-2 h-4 w-4" />{createConversation.isPending ? "Creating conversation…" : "Create native conversation"}</Button></div><div className="mt-4 space-y-2">{conversations.map((conversation) => <button type="button" key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={`w-full rounded-lg border p-3 text-left ${selectedConversation?.id === conversation.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><span className="font-medium">{conversation.title}</span><Badge variant={stateVariant(conversation.state)}>{conversation.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{conversation.summary || "No purpose recorded"} · {Array.isArray(conversation.data?.participantSeatIds) ? conversation.data.participantSeatIds.length : 0} seats</p></button>)}{!conversations.length && <p className="py-3 text-sm text-muted-foreground">No native conversations yet.</p>}</div></section>
        <section className="rounded-xl border p-4">
          <div className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /><h3 className="font-semibold">2. Record a message or prepare governed delivery</h3></div>
          <p className="mt-1 text-sm text-muted-foreground">Native EOS messages are stored in this conversation{selectedThread ? ` under the ${selectedThread.title} thread` : ""}. Email and Slack can also create a provider delivery plan; EOS still requires the exact company binding, role entitlement, approval, and provider receipt before it sends anything externally.</p>
          <div className="mt-4 grid gap-3">
            {threads.length > 0 && <div><Label htmlFor="message-thread-focus">Focused thread</Label><select id="message-thread-focus" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedThreadId} onChange={(event) => setSelectedThreadId(event.target.value)}><option value="">All conversation messages</option>{threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">New messages are nested in the selected thread. Clear the selection to keep a message at the conversation level.</p></div>}
            <div><Label htmlFor="message-channel">Channel</Label><select id="message-channel" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as MessageChannel)}>{channels.map((item) => <option key={item.key} value={item.key}>{item.label} — {item.detail}</option>)}</select></div>
            {canViewCrm && <div><Label htmlFor="message-relationship">Relationship context (optional)</Label><select id="message-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRelationshipId} onChange={(event) => chooseRelationship(event.target.value)} disabled={crmQuery.isFetching}><option value="">No CRM relationship</option>{relationshipChoices.map((choice) => <option key={choice.relationship.id} value={choice.relationship.id}>{choice.label}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only relationships already visible to this role appear here. EOS records an auditable link from the message to the selected relationship; choosing an email contact only prepares an editable draft.</p>{!crmQuery.isFetching && !crmQuery.isSuccess && <p className="mt-1 text-xs text-muted-foreground">CRM context is unavailable for this session. You can still record a governed message without it.</p>}</div>}
            <div><Label htmlFor="message-body">Message</Label><Textarea id="message-body" className="mt-1" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write the accountable update, request, decision context, or handoff." /></div>
            {mayPlanProviderDelivery && <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
              <div><Label htmlFor="message-delivery-binding">Connected company provider</Label><select id="message-delivery-binding" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={deliveryBindingId} onChange={(event) => setDeliveryBindingId(event.target.value)} disabled={integrationOperationsQuery.isFetching}><option value="">{integrationOperationsQuery.isFetching ? "Checking provider delivery capability…" : "Choose a qualified company binding"}</option>{compatibleBindings.map((binding) => <option key={binding.id} value={binding.id}>{binding.name} · {binding.providerAccountReference || binding.providerKey}</option>)}</select>{!integrationOperationsQuery.isFetching && !compatibleBindings.length && <p className="mt-2 text-xs text-muted-foreground">No connected binding has a current frozen contract for this delivery operation. You can still record a truthful external delivery intent below.</p>}</div>
              {channel === "email" ? <><div><Label htmlFor="message-email-to">Recipient email</Label><Input id="message-email-to" className="mt-1" value={deliveryDestination} onChange={(event) => setDeliveryDestination(event.target.value)} placeholder="client@example.com" type="email" /></div><div><Label htmlFor="message-email-subject">Subject</Label><Input id="message-email-subject" className="mt-1" value={deliverySubject} onChange={(event) => setDeliverySubject(event.target.value)} placeholder="Revenue recovery follow-up" /></div></> : <><div><Label htmlFor="message-slack-channel">Slack channel ID</Label><Input id="message-slack-channel" className="mt-1" value={deliveryDestination} onChange={(event) => setDeliveryDestination(event.target.value)} placeholder="C0123456789" /></div><div><Label htmlFor="message-slack-thread">Slack thread timestamp (optional)</Label><Input id="message-slack-thread" className="mt-1" value={deliveryThreadReference} onChange={(event) => setDeliveryThreadReference(event.target.value)} placeholder="1712345678.123456" /></div></>}
              <p className="text-xs text-muted-foreground">Planning creates no provider effect. After approval, the governed run queue performs the allowed provider action and records the receipt.</p>
            </div>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canExecute || !selectedConversation || messageBody.trim().length < 1 || createMessage.isPending} onClick={() => createMessage.mutate()}><Send className="mr-2 h-4 w-4" />{createMessage.isPending ? "Recording…" : channel === "native_eos" ? "Record native message" : "Record delivery intent"}</Button>
              {mayPlanProviderDelivery && <Button variant="secondary" disabled={!canExecute || !selectedConversation || !selectedDeliveryBinding || !providerDestinationIsValid || messageBody.trim().length < 1 || planProviderDelivery.isPending} onClick={() => planProviderDelivery.mutate()}><ShieldCheck className="mr-2 h-4 w-4" />{planProviderDelivery.isPending ? "Planning…" : "Plan governed delivery"}</Button>}
            </div>
            {plannedRunId && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Provider delivery plan created</AlertTitle><AlertDescription>Run {plannedRunId} is planned only. Open <a className="font-medium underline" href="#operations">Operations</a> to review the binding, satisfy the exact approval and entitlement checks, and dispatch the provider action.</AlertDescription></Alert>}
            <div className="border-t pt-3"><Label htmlFor="message-thread-title">Open a focused thread</Label><div className="mt-1 flex gap-2"><Input id="message-thread-title" value={threadTitle} onChange={(event) => setThreadTitle(event.target.value)} placeholder="Pricing exception review" /><Button variant="outline" disabled={!canExecute || !selectedConversation || threadTitle.trim().length < 2 || createThread.isPending} onClick={() => createThread.mutate()}><MessageCircleMore className="mr-2 h-4 w-4" />Thread</Button></div></div>
          </div>
        </section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Conversation ledger</p><h3 className="mt-1 font-semibold">{selectedConversation ? selectedConversation.title : "Choose a conversation"}</h3></div>{selectedConversation?.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedConversation)}>Activate conversation</Button>}</div>{selectedConversation && <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-3">{messages.map((message) => { const deliveryState = String(message.data?.deliveryState || "native_recorded"); const providerPlan = deliveryState === "provider_delivery_planned"; const relationshipContext = message.data?.relationshipContext; return <article key={message.id} className="rounded-xl bg-muted/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline">{String(message.data?.channelType || "native_eos").replaceAll("_", " ")}</Badge><Badge variant={deliveryState === "provider_intent" ? "secondary" : "default"}>{providerPlan ? "provider plan" : deliveryState === "provider_intent" ? "provider intent" : "native record"}</Badge>{relationshipContext?.label && <Badge variant="secondary">{String(relationshipContext.label)}</Badge>}</div><span className="text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{message.data?.body || message.summary}</p>{providerPlan && <p className="mt-2 text-xs text-muted-foreground">Planned {message.data?.operation || "provider operation"} · run {message.data?.integrationRunId}. No external delivery is claimed until the governed run succeeds with a provider receipt.</p>}{message.state === "draft" && <Button size="sm" variant="outline" className="mt-3" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(message)}>Activate record</Button>}</article>; })}{!messages.length && <p className="py-4 text-sm text-muted-foreground">No messages recorded in this conversation.</p>}</div><aside className="rounded-xl border bg-muted/30 p-3"><p className="text-sm font-medium">Threads</p><div className="mt-3 space-y-2">{threads.map((thread) => <div key={thread.id} className="rounded-lg bg-background p-3"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{thread.title}</span><Badge variant={stateVariant(thread.state)}>{thread.state}</Badge></div>{thread.state === "draft" && <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(thread)}>Activate</Button>}</div>)}{!threads.length && <p className="text-xs text-muted-foreground">No focused threads yet.</p>}</div></aside></div>}</section>
      <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Communication stays truthful and hierarchical</AlertTitle><AlertDescription>This hub preserves native EOS records and governed external-delivery intent. Provider delivery, receipts, reconciliation, and retry remain separate authorized operations; it does not bypass the EA, reporting chain, approval controls, or role visibility.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
