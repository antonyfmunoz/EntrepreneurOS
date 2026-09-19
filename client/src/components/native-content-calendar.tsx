import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, FileCheck2, Plus, RefreshCw, Save, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;

const editorialStates = ["idea", "in_production", "review", "approved", "scheduled", "published_observed", "paused"] as const;
const contentTypes = ["short_video", "carousel", "post", "email", "article", "landing_page", "other"] as const;
const channels = ["instagram", "linkedin", "tiktok", "youtube", "email", "blog", "website", "other"] as const;

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function localDateTime(hoursFromNow: number) {
  const date = new Date(Date.now() + hoursFromNow * 3_600_000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function inputDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatTime(value?: string) {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function editorialLabel(state: string) {
  return state.replace(/_/g, " ");
}

/**
 * Native editorial planning belongs to EOS even when a company has no social,
 * email, or publishing-provider connection. The one truthful boundary is the
 * word "observed": this surface never represents a native plan as a live
 * external post without an operator recording the external publication proof.
 */
export function NativeContentCalendar({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [selectedContentId, setSelectedContentId] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<(typeof contentTypes)[number]>("post");
  const [channel, setChannel] = useState<(typeof channels)[number]>("instagram");
  const [scheduledFor, setScheduledFor] = useState(localDateTime(24));
  const [brief, setBrief] = useState("");
  const [campaignReference, setCampaignReference] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContentType, setEditingContentType] = useState<(typeof contentTypes)[number]>("post");
  const [editingChannel, setEditingChannel] = useState<(typeof channels)[number]>("instagram");
  const [editingScheduledFor, setEditingScheduledFor] = useState("");
  const [editingBrief, setEditingBrief] = useState("");
  const [editingCampaignReference, setEditingCampaignReference] = useState("");
  const [editingState, setEditingState] = useState<(typeof editorialStates)[number]>("idea");
  const [publicationEvidence, setPublicationEvidence] = useState("");
  const [error, setError] = useState("");

  const query = useQuery<Json>({
    // Content plans are role-scoped because a later seat switch must never
    // reuse editorial cache entries fetched under a broader prior authority.
    queryKey: [root, roleScopeKey, "native-content-calendar"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/calendar`)).json(),
  });
  const contentItems = useMemo(() => (query.data?.objects || [])
    .filter((item: Json) => item.objectType === "content_item")
    .sort((left: Json, right: Json) => String(left.data?.scheduledFor || "").localeCompare(String(right.data?.scheduledFor || ""))), [query.data?.objects]);
  const selectedContent = contentItems.find((item: Json) => item.id === selectedContentId) || contentItems[0];

  useEffect(() => {
    setEditingTitle(String(selectedContent?.title || ""));
    setEditingContentType((contentTypes.includes(selectedContent?.data?.contentType) ? selectedContent.data.contentType : "post") as (typeof contentTypes)[number]);
    setEditingChannel((channels.includes(selectedContent?.data?.channel) ? selectedContent.data.channel : "instagram") as (typeof channels)[number]);
    setEditingScheduledFor(inputDateTime(selectedContent?.data?.scheduledFor));
    setEditingBrief(String(selectedContent?.summary || ""));
    setEditingCampaignReference(String(selectedContent?.data?.campaignReference || ""));
    setEditingState((editorialStates.includes(selectedContent?.data?.editorialState) ? selectedContent.data.editorialState : "idea") as (typeof editorialStates)[number]);
    setPublicationEvidence(String(selectedContent?.data?.publicationEvidence || ""));
  }, [selectedContent?.id, selectedContent?.version]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-content-calendar"] });

  const createContent = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "calendar",
      objectType: "content_item",
      objectKey: `content:${safeKey(title)}:${Date.now()}`,
      title: title.trim(),
      summary: brief.trim(),
      classification: "confidential",
      visibility: "team",
      data: {
        contentType,
        channel,
        scheduledFor: new Date(scheduledFor).toISOString(),
        editorialState: "idea",
        campaignReference: campaignReference.trim() || undefined,
        operatingMode: "native_eos",
        delivery: "not_dispatched",
      },
      sourceReference: { authority: "native_eos", capability: "content_calendar", publication: "not_dispatched" },
      evidenceIds: [],
      idempotencyKey: commandKey("content-calendar-create"),
    })).json(),
    onSuccess: async (result) => {
      setSelectedContentId(result.object.id);
      setTitle("");
      setBrief("");
      setCampaignReference("");
      setScheduledFor(localDateTime(24));
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const saveContent = useMutation({
    mutationFn: async () => {
      if (!selectedContent) throw new Error("Choose a content item to update.");
      if (editingState === "published_observed" && publicationEvidence.trim().length < 3)
        throw new Error("Record the external post URL, ID, or other publication evidence before marking it published.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedContent.id}`, {
        expectedVersion: selectedContent.version,
        title: editingTitle.trim(),
        summary: editingBrief.trim(),
        data: {
          ...selectedContent.data,
          contentType: editingContentType,
          channel: editingChannel,
          scheduledFor: new Date(editingScheduledFor).toISOString(),
          editorialState: editingState,
          campaignReference: editingCampaignReference.trim() || undefined,
          publicationEvidence: editingState === "published_observed" ? publicationEvidence.trim() : undefined,
          delivery: editingState === "published_observed" ? "observed_external" : "not_dispatched",
        },
        sourceReference: editingState === "published_observed"
          ? { authority: "manual_external_observation", capability: "content_calendar", publication: "observed_external", reference: publicationEvidence.trim() }
          : { authority: "native_eos", capability: "content_calendar", publication: "not_dispatched" },
        idempotencyKey: commandKey("content-calendar-save"),
      })).json();
    },
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });

  const stateCounts = useMemo(() => editorialStates.map((state) => ({ state, count: contentItems.filter((item: Json) => item.data?.editorialState === state).length })).filter((item) => item.count > 0), [contentItems]);

  return <Card data-testid="native-content-calendar" className="border-primary/20 bg-card/95 shadow-sm">
    <CardHeader className="pb-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Native Content Calendar</CardTitle><CardDescription className="mt-1">Plan, review, and schedule owned content in EOS before any external publishing rail is connected.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>
      <div className="mt-3 flex flex-wrap gap-2">{stateCounts.map((item) => <Badge key={item.state} variant={item.state === "published_observed" ? "default" : "outline"}>{item.count} {editorialLabel(item.state)}</Badge>)}{!stateCounts.length && <Badge variant="outline">No planned content</Badge>}</div>
    </CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Content calendar action needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Plan a native content item</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="native-content-title">Working title</Label><Input id="native-content-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Founder-led revenue recovery case study" /></div><div><Label htmlFor="native-content-type">Content type</Label><select id="native-content-type" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={contentType} onChange={(event) => setContentType(event.target.value as (typeof contentTypes)[number])}>{contentTypes.map((item) => <option key={item} value={item}>{editorialLabel(item)}</option>)}</select></div><div><Label htmlFor="native-content-channel">Channel</Label><select id="native-content-channel" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as (typeof channels)[number])}>{channels.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><Label htmlFor="native-content-schedule">Scheduled for</Label><Input id="native-content-schedule" className="mt-1" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></div><div><Label htmlFor="native-content-campaign">Campaign reference (optional)</Label><Input id="native-content-campaign" className="mt-1" value={campaignReference} onChange={(event) => setCampaignReference(event.target.value)} placeholder="Native campaign or operating initiative" /></div><div className="md:col-span-2"><Label htmlFor="native-content-brief">Brief</Label><Textarea id="native-content-brief" className="mt-1" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Audience, point of view, call to action, proof, and required assets." /></div><div className="md:col-span-2"><Button disabled={!canExecute || title.trim().length < 2 || !scheduledFor || createContent.isPending} onClick={() => createContent.mutate()}><Plus className="mr-2 h-4 w-4" />{createContent.isPending ? "Creating…" : "Add to content calendar"}</Button></div></div></section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><div className="rounded-xl border p-4"><p className="eos-label">Editorial plan</p><div className="mt-3 space-y-2">{contentItems.map((item: Json) => <button type="button" key={item.id} onClick={() => setSelectedContentId(item.id)} className={`w-full rounded-lg border p-3 text-left transition ${selectedContent?.id === item.id ? "border-primary bg-primary/[0.06]" : "hover:bg-muted/50"}`}><div className="flex items-start justify-between gap-3"><span className="font-medium">{item.title}</span><Badge variant={item.data?.editorialState === "published_observed" ? "default" : "outline"}>{editorialLabel(String(item.data?.editorialState || "idea"))}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.data?.channel || "channel"} · {item.data?.contentType || "content"} · {formatTime(item.data?.scheduledFor)}</p></button>)}{!contentItems.length && <p className="text-sm text-muted-foreground">No content is planned yet. Create the first owned editorial item above.</p>}</div></div>
        <div className="rounded-xl border p-4">{selectedContent ? <><p className="eos-label">Control selected content</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="native-content-edit-title">Working title</Label><Input id="native-content-edit-title" className="mt-1" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} /></div><div><Label htmlFor="native-content-edit-type">Content type</Label><select id="native-content-edit-type" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingContentType} onChange={(event) => setEditingContentType(event.target.value as (typeof contentTypes)[number])}>{contentTypes.map((item) => <option key={item} value={item}>{editorialLabel(item)}</option>)}</select></div><div><Label htmlFor="native-content-edit-channel">Channel</Label><select id="native-content-edit-channel" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingChannel} onChange={(event) => setEditingChannel(event.target.value as (typeof channels)[number])}>{channels.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><Label htmlFor="native-content-edit-schedule">Scheduled for</Label><Input id="native-content-edit-schedule" className="mt-1" type="datetime-local" value={editingScheduledFor} onChange={(event) => setEditingScheduledFor(event.target.value)} /></div><div><Label htmlFor="native-content-edit-state">Editorial state</Label><select id="native-content-edit-state" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingState} onChange={(event) => setEditingState(event.target.value as (typeof editorialStates)[number])}>{editorialStates.map((item) => <option key={item} value={item}>{editorialLabel(item)}</option>)}</select></div><div className="md:col-span-2"><Label htmlFor="native-content-edit-campaign">Campaign reference (optional)</Label><Input id="native-content-edit-campaign" className="mt-1" value={editingCampaignReference} onChange={(event) => setEditingCampaignReference(event.target.value)} placeholder="Native campaign or operating initiative" /></div><div className="md:col-span-2"><Label htmlFor="native-content-edit-brief">Brief</Label><Textarea id="native-content-edit-brief" className="mt-1" value={editingBrief} onChange={(event) => setEditingBrief(event.target.value)} /></div>{editingState === "published_observed" && <div className="md:col-span-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"><Label htmlFor="native-content-publication-evidence">External publication evidence</Label><Input id="native-content-publication-evidence" className="mt-1" value={publicationEvidence} onChange={(event) => setPublicationEvidence(event.target.value)} placeholder="Published post URL, platform post ID, or retained evidence reference" /><p className="mt-2 text-xs text-muted-foreground">EOS records an observed external result only after you provide evidence. Saving this does not send or publish content.</p></div>}<div className="md:col-span-2 flex flex-wrap gap-2"><Button size="sm" disabled={!canExecute || (editingState === "published_observed" && !canDecide) || editingTitle.trim().length < 2 || !editingScheduledFor || saveContent.isPending} onClick={() => saveContent.mutate()}><Save className="mr-2 h-4 w-4" />{saveContent.isPending ? "Saving…" : "Save content plan"}</Button>{editingState === "published_observed" && !canDecide && <p className="self-center text-xs text-muted-foreground">A role with decision authority records an observed publication.</p>}{editingState === "approved" && <Badge variant="outline" className="self-center"><FileCheck2 className="mr-1 h-3.5 w-3.5" />Ready for an approved publishing rail</Badge>}</div></div></> : <p className="text-sm text-muted-foreground">Select an item from the editorial plan to control it.</p>}</div></section>
      <Alert><Send className="h-4 w-4" /><AlertTitle>Native ownership, truthful publishing boundary</AlertTitle><AlertDescription>EOS owns the editorial plan, brief, review state, schedule, and publication evidence. It does not dispatch to a social, email, or web provider from this surface, and it never presents a planned item as a live post without an observed external reference.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
