import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, DoorOpen, Gavel, Plus, RefreshCw, UsersRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type Seat = { id: string; title: string; agentName: string; status?: string };

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function localDateTime(hoursFromNow = 1) {
  const date = new Date(Date.now() + hoursFromNow * 3_600_000);
  date.setSeconds(0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function localDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function stateVariant(state: string) {
  return ["active", "completed"].includes(state) ? "default" as const : "outline" as const;
}

export function ConferenceRoomControlCenter({ root, roleScopeKey, seats, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  seats: Seat[];
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [roomPurpose, setRoomPurpose] = useState("");
  const [editingRoomTitle, setEditingRoomTitle] = useState("");
  const [editingRoomPurpose, setEditingRoomPurpose] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTime(1));
  const [endsAt, setEndsAt] = useState(localDateTime(2));
  const [participantSeatIds, setParticipantSeatIds] = useState<string[]>([]);
  const [editingMeetingTitle, setEditingMeetingTitle] = useState("");
  const [editingMeetingAgenda, setEditingMeetingAgenda] = useState("");
  const [editingMeetingStartsAt, setEditingMeetingStartsAt] = useState("");
  const [editingMeetingEndsAt, setEditingMeetingEndsAt] = useState("");
  const [editingMeetingParticipantSeatIds, setEditingMeetingParticipantSeatIds] = useState<string[]>([]);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [decision, setDecision] = useState("");
  const [decidedBySeatId, setDecidedBySeatId] = useState("");
  const [followOnDecisionId, setFollowOnDecisionId] = useState("");
  const [followOnTitle, setFollowOnTitle] = useState("");
  const [followOnObjective, setFollowOnObjective] = useState("");
  const [followOnOwnerSeatId, setFollowOnOwnerSeatId] = useState("");
  const [followOnRequiresApproval, setFollowOnRequiresApproval] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const query = useQuery<Json>({
    // Ask for this instrument only. A Work Room role may be entitled to
    // conference rooms without being entitled to enumerate every company
    // instrument, and the scoped endpoint preserves that visibility boundary.
    queryKey: [root, "conference-rooms"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/conference_rooms`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const rooms = useMemo(() => objects.filter((item) => item.instrumentKey === "conference_rooms" && item.objectType === "room"), [objects]);
  const meetings = useMemo(() => objects.filter((item) => item.instrumentKey === "conference_rooms" && item.objectType === "meeting"), [objects]);
  const decisions = useMemo(() => objects.filter((item) => item.instrumentKey === "conference_rooms" && item.objectType === "decision"), [objects]);
  // A meeting can be commercially contextual without turning Conference Rooms
  // into a CRM backdoor. Read the role-scoped context first and request CRM
  // records only when this exact role is already authorized to see them.
  const contextQuery = useQuery<Json>({
    queryKey: [root, roleScopeKey, "conference-rooms-context"],
    queryFn: async () => (await apiRequest("GET", `${root}/context`)).json(),
  });
  const canViewCrm = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys)
    && contextQuery.data.principalContext.visibleInstrumentKeys.includes("crm");
  const crmQuery = useQuery<Json>({
    queryKey: [root, roleScopeKey, "conference-rooms-crm-context"],
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
      label: `${String(relationship.data?.relationshipType || "Relationship").replaceAll("_", " ")} · ${displayName}`,
    };
  }), [crmPeople, crmRelationships]);
  const selectedRelationshipChoice = relationshipChoices.find((item) => item.relationship.id === selectedRelationshipId) || null;
  const selectedRoom = rooms.find((item) => item.id === selectedRoomId) || rooms[0];
  const selectedMeeting = meetings.find((item) => item.id === selectedMeetingId) || meetings.find((item) => item.data?.roomObjectId === selectedRoom?.id);
  const roomMeetings = meetings.filter((item) => item.data?.roomObjectId === selectedRoom?.id);
  const meetingDecisions = decisions.filter((item) => item.data?.meetingObjectId === selectedMeeting?.id);
  const meetingParticipants = useMemo(() => {
    const ids = Array.isArray(selectedMeeting?.data?.participantSeatIds) ? selectedMeeting.data.participantSeatIds.filter((item: unknown): item is string => typeof item === "string") : [];
    return seats.filter((seat) => ids.includes(seat.id) && seat.status !== "inactive");
  }, [selectedMeeting?.data?.participantSeatIds, seats]);
  const followOnDecision = meetingDecisions.find((item) => item.id === followOnDecisionId);

  useEffect(() => {
    setEditingRoomTitle(String(selectedRoom?.title || ""));
    setEditingRoomPurpose(String(selectedRoom?.summary || ""));
  }, [selectedRoom?.id, selectedRoom?.version]);

  useEffect(() => {
    setEditingMeetingTitle(String(selectedMeeting?.title || ""));
    setEditingMeetingAgenda(String(selectedMeeting?.data?.agenda || ""));
    setEditingMeetingStartsAt(selectedMeeting?.data?.startsAt ? localDateTimeInput(selectedMeeting.data.startsAt) : "");
    setEditingMeetingEndsAt(selectedMeeting?.data?.endsAt ? localDateTimeInput(selectedMeeting.data.endsAt) : "");
    setEditingMeetingParticipantSeatIds(Array.isArray(selectedMeeting?.data?.participantSeatIds) ? selectedMeeting.data.participantSeatIds.filter((item: unknown): item is string => typeof item === "string") : []);
  }, [selectedMeeting?.id, selectedMeeting?.version]);

  useEffect(() => {
    setDecidedBySeatId((current) => meetingParticipants.some((seat) => seat.id === current) ? current : meetingParticipants[0]?.id || "");
    setFollowOnOwnerSeatId((current) => meetingParticipants.some((seat) => seat.id === current) ? current : meetingParticipants[0]?.id || "");
  }, [meetingParticipants]);

  useEffect(() => {
    if (selectedRelationshipId && !relationshipChoices.some((item) => item.relationship.id === selectedRelationshipId)) {
      setSelectedRelationshipId("");
    }
  }, [relationshipChoices, selectedRelationshipId]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, "conference-rooms"] });
  const createRoom = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "conference_rooms", objectType: "room", objectKey: `room:${roomTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${Date.now()}`,
      title: roomTitle.trim(), summary: roomPurpose.trim(), classification: "confidential", visibility: "organization",
      data: { roomType: "virtual", accessRule: "invited_participants" }, sourceReference: {}, evidenceIds: [], idempotencyKey: commandKey("conference-room"),
    })).json(),
    onSuccess: async (result) => { setSelectedRoomId(result.object.id); setRoomTitle(""); setRoomPurpose(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const saveRoom = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) throw new Error("Select a Conference Room to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedRoom.id}`, {
        expectedVersion: selectedRoom.version,
        title: editingRoomTitle.trim(),
        summary: editingRoomPurpose.trim(),
        data: { ...selectedRoom.data, operatingMode: "native_eos" },
        idempotencyKey: commandKey("conference-room-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedRoomId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createMeeting = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) throw new Error("Create or select a Conference Room first.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "conference_rooms", objectType: "meeting", objectKey: `meeting:${meetingTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${Date.now()}`,
        title: meetingTitle.trim(), summary: `Scheduled in ${selectedRoom.title}.`, classification: "confidential", visibility: "organization",
        parentObjectId: selectedRoom.id,
        data: {
          roomObjectId: selectedRoom.id,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          participantSeatIds,
          agenda: agenda.trim(),
        },
        sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("conference-meeting"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedRoom.id, targetObjectId: result.object.id, relationshipType: "hosts", metadata: {}, idempotencyKey: commandKey("conference-link") });
      let relationshipLinked = true;
      if (selectedRelationshipChoice) {
        try {
          await apiRequest("POST", `${root}/instrument-links`, {
            sourceObjectId: result.object.id,
            targetObjectId: selectedRelationshipChoice.relationship.id,
            relationshipType: "concerns_relationship",
            metadata: { relationshipLabel: selectedRelationshipChoice.label },
            idempotencyKey: commandKey("conference-relationship-link"),
          });
        } catch {
          // The meeting is already durable. Preserve that fact and make the
          // missing optional relationship edge reviewable instead of
          // misreporting the whole scheduling command as failed.
          relationshipLinked = false;
        }
      }
      return { ...result, relationshipLinked };
    },
    onSuccess: async (result) => {
      setSelectedMeetingId(result.object.id); setMeetingTitle(""); setAgenda(""); setParticipantSeatIds([]);
      if (!result.relationshipLinked) setNotice("The meeting was scheduled, but EOS could not create its CRM relationship link. Refresh CRM access and review the meeting before relying on that relationship context.");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const saveMeeting = useMutation({
    mutationFn: async () => {
      if (!selectedMeeting) throw new Error("Select a governed meeting to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedMeeting.id}`, {
        expectedVersion: selectedMeeting.version,
        title: editingMeetingTitle.trim(),
        summary: `Scheduled in ${selectedRoom?.title || "Conference Room"}.`,
        data: {
          ...selectedMeeting.data,
          roomObjectId: selectedMeeting.data?.roomObjectId,
          startsAt: new Date(editingMeetingStartsAt).toISOString(),
          endsAt: new Date(editingMeetingEndsAt).toISOString(),
          participantSeatIds: editingMeetingParticipantSeatIds,
          agenda: editingMeetingAgenda.trim(),
          operatingMode: "native_eos",
        },
        idempotencyKey: commandKey("conference-meeting-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedMeetingId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const recordDecision = useMutation({
    mutationFn: async () => {
      if (!selectedMeeting) throw new Error("Select a scheduled meeting first.");
      if (!decidedBySeatId) throw new Error("A decision requires a recorded meeting participant.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "conference_rooms", objectType: "decision", objectKey: `decision:${Date.now()}`, title: `Decision · ${selectedMeeting.title}`,
        summary: decision.trim(), classification: "confidential", visibility: "organization",
        parentObjectId: selectedMeeting.id,
        data: { meetingObjectId: selectedMeeting.id, decision: decision.trim(), decidedBySeatId },
        sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("conference-decision"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedMeeting.id, targetObjectId: result.object.id, relationshipType: "records", metadata: { relationship: "meeting_decision" }, idempotencyKey: commandKey("conference-decision-link") });
      return result;
    },
    onSuccess: async () => {
      setDecision("");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const createFollowOnWork = useMutation({
    mutationFn: async () => {
      if (!followOnDecision) throw new Error("Choose a recorded decision before creating follow-on work.");
      return (await apiRequest("POST", `${root}/conference-rooms/decisions/${followOnDecision.id}/work-packet`, {
        expectedDecisionVersion: followOnDecision.version,
        title: followOnTitle.trim(),
        objective: followOnObjective.trim(),
        priority: "medium",
        requiresApproval: followOnRequiresApproval,
        accountableSeatId: followOnOwnerSeatId,
        evidenceRequirements: ["A reviewable artifact or observed outcome tied to this Conference Room decision."],
        expectedOutput: "A reviewable outcome that resolves the recorded Conference Room decision.",
        acceptanceCriteria: "The accountable owner records a reviewable outcome and any required approval before closure.",
      })).json();
    },
    onSuccess: async () => {
      setFollowOnDecisionId(""); setFollowOnTitle(""); setFollowOnObjective(""); setFollowOnRequiresApproval(false);
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state: "active", rationale: "Activate the governed Conference Room object for its stated operating purpose.", evidenceIds: [], idempotencyKey: commandKey("activate-conference-object"),
    })).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });

  const meetingTimesValid = Boolean(startsAt && endsAt && new Date(endsAt).getTime() > new Date(startsAt).getTime());
  const toggleSeat = (seatId: string) => setParticipantSeatIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  const toggleEditingMeetingSeat = (seatId: string) => setEditingMeetingParticipantSeatIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  return <Card data-testid="conference-room-control-center">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2"><DoorOpen className="h-5 w-5 text-primary" />Conference Rooms</CardTitle><CardDescription className="mt-1">A native room turns a bounded meeting into an accountable agenda, decision record, and follow-on work—without pretending a video, email, or calendar provider is required.</CardDescription></div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Conference command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert><AlertTitle>Conference record needs review</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-primary" /><h3 className="font-semibold">1. Establish a room</h3></div><p className="mt-1 text-sm text-muted-foreground">A room is a governed operating context, not an untracked chat link.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="conference-room-title">Room name</Label><Input id="conference-room-title" className="mt-1" value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} placeholder="Revenue recovery leadership room" /></div><div><Label htmlFor="conference-room-purpose">Purpose</Label><Textarea id="conference-room-purpose" className="mt-1" value={roomPurpose} onChange={(event) => setRoomPurpose(event.target.value)} placeholder="What decisions and work belong in this room?" /></div><Button disabled={!canExecute || roomTitle.trim().length < 2 || createRoom.isPending} onClick={() => createRoom.mutate()}><Plus className="mr-2 h-4 w-4" />{createRoom.isPending ? "Creating room…" : "Create room"}</Button></div><div className="mt-4 space-y-2">{rooms.map((room) => <button type="button" key={room.id} onClick={() => { setSelectedRoomId(room.id); setSelectedMeetingId(""); }} className={`w-full rounded-lg border p-3 text-left ${selectedRoom?.id === room.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><span className="font-medium">{room.title}</span><Badge variant={stateVariant(room.state)}>{room.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{room.summary || "No purpose recorded"}</p></button>)}{!rooms.length && <p className="py-3 text-sm text-muted-foreground">No native rooms yet.</p>}</div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h3 className="font-semibold">2. Schedule a governed meeting</h3></div><p className="mt-1 text-sm text-muted-foreground">EOS records the agenda and participants locally. A connected calendar can be reconciled later, but is never assumed.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="conference-meeting-title">Meeting title</Label><Input id="conference-meeting-title" className="mt-1" value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="Weekly commercial review" /></div>{canViewCrm && <div><Label htmlFor="conference-relationship">Relationship context (optional)</Label><select id="conference-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRelationshipId} onChange={(event) => setSelectedRelationshipId(event.target.value)} disabled={crmQuery.isFetching}><option value="">No CRM relationship</option>{relationshipChoices.map((choice) => <option key={choice.relationship.id} value={choice.relationship.id}>{choice.label}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only relationships already visible to this role appear here. EOS records an auditable native relationship edge; the meeting, its decisions, and follow-on work remain connected through the governed object graph.</p>{!crmQuery.isFetching && !crmQuery.isSuccess && <p className="mt-1 text-xs text-muted-foreground">CRM context is unavailable for this session. You can still schedule a governed meeting without it.</p>}</div>}<div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="conference-starts-at">Starts</Label><Input id="conference-starts-at" className="mt-1" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div><div><Label htmlFor="conference-ends-at">Ends</Label><Input id="conference-ends-at" className="mt-1" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></div></div>{!meetingTimesValid && <p className="text-xs text-destructive">The meeting end time must be after its start time.</p>}<div><Label htmlFor="conference-agenda">Agenda</Label><Textarea id="conference-agenda" className="mt-1" value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder="Decisions required, evidence to inspect, and intended next actions" /></div><div><p className="text-sm font-medium">Participants</p><div className="mt-2 flex flex-wrap gap-2">{seats.filter((seat) => seat.status !== "inactive").map((seat) => <label key={seat.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"><input type="checkbox" checked={participantSeatIds.includes(seat.id)} onChange={() => toggleSeat(seat.id)} />{seat.title}</label>)}</div></div><Button disabled={!canExecute || !selectedRoom || meetingTitle.trim().length < 2 || !agenda.trim() || !participantSeatIds.length || !meetingTimesValid || createMeeting.isPending} onClick={() => createMeeting.mutate()}><CalendarDays className="mr-2 h-4 w-4" />{createMeeting.isPending ? "Scheduling…" : "Schedule native meeting"}</Button></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Meeting ledger</p><h3 className="mt-1 font-semibold">{selectedRoom ? selectedRoom.title : "Choose a room"}</h3></div>{selectedRoom?.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedRoom)}>Activate room</Button>}</div><div className="mt-4 grid gap-3 lg:grid-cols-2">{roomMeetings.map((meeting) => <button key={meeting.id} type="button" onClick={() => setSelectedMeetingId(meeting.id)} className={`rounded-xl border p-4 text-left ${selectedMeeting?.id === meeting.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><p className="font-medium">{meeting.title}</p><Badge variant={stateVariant(meeting.state)}>{meeting.state}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{meeting.data?.agenda}</p><p className="mt-2 text-xs text-muted-foreground">{meeting.data?.startsAt ? new Date(meeting.data.startsAt).toLocaleString() : "Time not recorded"} · {Array.isArray(meeting.data?.participantSeatIds) ? meeting.data.participantSeatIds.length : 0} participants</p></button>)}{selectedRoom && !roomMeetings.length && <p className="py-5 text-sm text-muted-foreground">No meetings scheduled in this room.</p>}</div>{selectedMeeting?.state === "draft" && <Button className="mt-4" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedMeeting)}>Activate selected meeting</Button>}</section>
      {selectedMeeting && <section className="grid gap-5 rounded-xl border p-4 xl:grid-cols-2"><div><div className="flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /><h3 className="font-semibold">3. Record a decision</h3></div><p className="mt-1 text-sm text-muted-foreground">Decisions retain the named decision-maker and can become accountable native work. This records no external action.</p><Textarea className="mt-4" value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="State the decision, accountable owner, and any condition or follow-up." /><div className="mt-3"><Label htmlFor="conference-decision-maker">Decision-maker</Label><select id="conference-decision-maker" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={decidedBySeatId} onChange={(event) => setDecidedBySeatId(event.target.value)}><option value="">Choose a named meeting participant</option>{meetingParticipants.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><Button className="mt-3" disabled={!canExecute || decision.trim().length < 3 || !decidedBySeatId || recordDecision.isPending} onClick={() => recordDecision.mutate()}><Gavel className="mr-2 h-4 w-4" />{recordDecision.isPending ? "Recording…" : "Record draft decision"}</Button></div><div><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /><h3 className="font-semibold">Decision record</h3></div><div className="mt-3 space-y-2">{meetingDecisions.map((item) => <div key={item.id} className="rounded-lg bg-muted p-3"><div className="flex justify-between gap-3"><p className="font-medium">{item.summary}</p><Badge variant={stateVariant(item.state)}>{item.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Decision-maker: {seats.find((seat) => seat.id === item.data?.decidedBySeatId)?.title || "recorded participant"}{Array.isArray(item.data?.followOnWorkPacketIds) && item.data.followOnWorkPacketIds.length ? ` · ${item.data.followOnWorkPacketIds.length} linked work item${item.data.followOnWorkPacketIds.length === 1 ? "" : "s"}` : ""}</p>{item.state === "draft" && <Button size="sm" variant="outline" className="mt-3" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(item)}>Activate decision</Button>}{!Array.isArray(item.data?.followOnWorkPacketIds) || !item.data.followOnWorkPacketIds.length ? <Button size="sm" variant="ghost" className="mt-2" disabled={!canExecute} onClick={() => { setFollowOnDecisionId(item.id); setFollowOnTitle(`Follow through · ${item.summary}`); setFollowOnObjective(item.summary || "Complete the recorded Conference Room decision."); }}>Create follow-on work</Button> : null}</div>)}{!meetingDecisions.length && <p className="text-sm text-muted-foreground">No decision has been recorded for this meeting.</p>}</div></div></section>}
      {followOnDecision && <section className="rounded-xl border border-primary/30 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Decision → accountable work</p><h3 className="mt-1 font-semibold">Create the follow-on Work Packet</h3><p className="mt-1 text-sm text-muted-foreground">This keeps the decision and Work Packet linked atomically. Only a recorded meeting participant can be accountable.</p></div><Button size="sm" variant="ghost" onClick={() => setFollowOnDecisionId("")}>Close</Button></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div><Label htmlFor="conference-follow-on-title">Work title</Label><Input id="conference-follow-on-title" className="mt-1" value={followOnTitle} onChange={(event) => setFollowOnTitle(event.target.value)} /></div><div><Label htmlFor="conference-follow-on-owner">Accountable participant</Label><select id="conference-follow-on-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={followOnOwnerSeatId} onChange={(event) => setFollowOnOwnerSeatId(event.target.value)}>{meetingParticipants.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><div className="lg:col-span-2"><Label htmlFor="conference-follow-on-objective">Objective</Label><Textarea id="conference-follow-on-objective" className="mt-1" value={followOnObjective} onChange={(event) => setFollowOnObjective(event.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={followOnRequiresApproval} onChange={(event) => setFollowOnRequiresApproval(event.target.checked)} />Require reporting-chain approval before work starts</label></div><Button className="mt-4" disabled={!canExecute || followOnTitle.trim().length < 3 || followOnObjective.trim().length < 3 || !followOnOwnerSeatId || createFollowOnWork.isPending} onClick={() => createFollowOnWork.mutate()}><Gavel className="mr-2 h-4 w-4" />{createFollowOnWork.isPending ? "Creating accountable work…" : "Create linked Work Packet"}</Button></section>}
      {selectedRoom && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Configure selected room</p><div className="mt-3 grid gap-3"><div><Label htmlFor="conference-edit-room-title">Room name</Label><Input id="conference-edit-room-title" className="mt-1" value={editingRoomTitle} onChange={(event) => setEditingRoomTitle(event.target.value)} /></div><div><Label htmlFor="conference-edit-room-purpose">Purpose</Label><Textarea id="conference-edit-room-purpose" className="mt-1" value={editingRoomPurpose} onChange={(event) => setEditingRoomPurpose(event.target.value)} /></div><div><Button size="sm" disabled={!canExecute || editingRoomTitle.trim().length < 2 || saveRoom.isPending} onClick={() => saveRoom.mutate()}>{saveRoom.isPending ? "Saving…" : "Save native room"}</Button></div></div></section>}
      {selectedMeeting && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Configure selected meeting</p><div className="mt-3 grid gap-3 lg:grid-cols-2"><div><Label htmlFor="conference-edit-meeting-title">Meeting title</Label><Input id="conference-edit-meeting-title" className="mt-1" value={editingMeetingTitle} onChange={(event) => setEditingMeetingTitle(event.target.value)} /></div><div><Label htmlFor="conference-edit-meeting-agenda">Agenda</Label><Textarea id="conference-edit-meeting-agenda" className="mt-1" value={editingMeetingAgenda} onChange={(event) => setEditingMeetingAgenda(event.target.value)} /></div><div><Label htmlFor="conference-edit-meeting-starts">Starts</Label><Input id="conference-edit-meeting-starts" className="mt-1" type="datetime-local" value={editingMeetingStartsAt} onChange={(event) => setEditingMeetingStartsAt(event.target.value)} /></div><div><Label htmlFor="conference-edit-meeting-ends">Ends</Label><Input id="conference-edit-meeting-ends" className="mt-1" type="datetime-local" value={editingMeetingEndsAt} onChange={(event) => setEditingMeetingEndsAt(event.target.value)} /></div><div className="lg:col-span-2"><p className="text-sm font-medium">Participants</p><div className="mt-2 flex flex-wrap gap-2">{seats.filter((seat) => seat.status !== "inactive").map((seat) => <label key={seat.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"><input type="checkbox" checked={editingMeetingParticipantSeatIds.includes(seat.id)} onChange={() => toggleEditingMeetingSeat(seat.id)} />{seat.title}</label>)}</div></div><div className="lg:col-span-2"><Button size="sm" disabled={!canExecute || editingMeetingTitle.trim().length < 2 || editingMeetingAgenda.trim().length < 3 || !editingMeetingParticipantSeatIds.length || !editingMeetingStartsAt || !editingMeetingEndsAt || new Date(editingMeetingEndsAt).getTime() <= new Date(editingMeetingStartsAt).getTime() || saveMeeting.isPending} onClick={() => saveMeeting.mutate()}>{saveMeeting.isPending ? "Saving…" : "Save native meeting"}</Button></div></div></section>}
      <Alert><AlertTitle>Hierarchy and authority remain intact</AlertTitle><AlertDescription>Rooms coordinate people and role agents; they do not bypass role visibility, reporting paths, approvals, or external-provider controls.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
