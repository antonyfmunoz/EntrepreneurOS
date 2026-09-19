import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarCheck2, CalendarClock, Clock3, Plus, RefreshCw, UserCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

function stateVariant(state: string) {
  return ["active", "completed"].includes(state) ? "default" as const : "outline" as const;
}

function formatTime(value?: string) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function NativeCalendarStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarTimeZone, setCalendarTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles");
  const [editingCalendarTitle, setEditingCalendarTitle] = useState("");
  const [editingCalendarTimeZone, setEditingCalendarTimeZone] = useState("");
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(false);
  const [publicBookingConsentVersion, setPublicBookingConsentVersion] = useState("eos-public-booking-consent.v1");
  const [publicBookingConsentLabel, setPublicBookingConsentLabel] = useState("I agree that this organization may use my details to coordinate this requested meeting.");
  const [publicBookingConfirmationMessage, setPublicBookingConfirmationMessage] = useState("Your meeting request is recorded. We will follow up through the contact details you provided.");
  const [publicBookingDurationMinutes, setPublicBookingDurationMinutes] = useState("30");
  const [publicBookingWindowDays, setPublicBookingWindowDays] = useState("14");
  const [commercialPipelineObjectId, setCommercialPipelineObjectId] = useState("");
  const [commercialInitialStage, setCommercialInitialStage] = useState("");
  const [availabilityTitle, setAvailabilityTitle] = useState("Working availability");
  const [availabilityStart, setAvailabilityStart] = useState("09:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("17:00");
  const [availabilityDays, setAvailabilityDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState("");
  const [editingAvailabilityTitle, setEditingAvailabilityTitle] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventPurpose, setEventPurpose] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTime(1));
  const [endsAt, setEndsAt] = useState(localDateTime(2));
  const [participantReference, setParticipantReference] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [editingEventTitle, setEditingEventTitle] = useState("");
  const [editingEventPurpose, setEditingEventPurpose] = useState("");
  const [editingEventStartsAt, setEditingEventStartsAt] = useState("");
  const [editingEventEndsAt, setEditingEventEndsAt] = useState("");
  const [editingEventParticipant, setEditingEventParticipant] = useState("");
  const [bookerReference, setBookerReference] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [error, setError] = useState("");

  const query = useQuery<Json>({
    // Calendar data is role-scoped. Never reuse a prior seat's query cache
    // after a role switch, even when both seats belong to the same company.
    queryKey: [root, roleScopeKey, "native-calendar"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/calendar`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const calendars = useMemo(() => objects.filter((item) => item.objectType === "calendar"), [objects]);
  const availability = useMemo(() => objects.filter((item) => item.objectType === "availability"), [objects]);
  const events = useMemo(() => objects.filter((item) => item.objectType === "event"), [objects]);
  const bookings = useMemo(() => objects.filter((item) => item.objectType === "booking"), [objects]);
  const selectedCalendar = calendars.find((item) => item.id === selectedCalendarId) || calendars[0];
  useEffect(() => {
    setEditingCalendarTitle(String(selectedCalendar?.title || ""));
    setEditingCalendarTimeZone(String(selectedCalendar?.data?.timeZone || ""));
    setPublicBookingEnabled(selectedCalendar?.data?.publicBooking === true);
    setPublicBookingConsentVersion(String(selectedCalendar?.data?.publicBookingConsentVersion || "eos-public-booking-consent.v1"));
    setPublicBookingConsentLabel(String(selectedCalendar?.data?.publicBookingConsentLabel || "I agree that this organization may use my details to coordinate this requested meeting."));
    setPublicBookingConfirmationMessage(String(selectedCalendar?.data?.publicBookingConfirmationMessage || "Your meeting request is recorded. We will follow up through the contact details you provided."));
    setPublicBookingDurationMinutes(String(selectedCalendar?.data?.publicBookingDurationMinutes || 30));
    setPublicBookingWindowDays(String(selectedCalendar?.data?.publicBookingWindowDays || 14));
    setCommercialPipelineObjectId(String(selectedCalendar?.data?.commercialPipelineObjectId || ""));
    setCommercialInitialStage(String(selectedCalendar?.data?.commercialInitialStage || ""));
  }, [selectedCalendar?.id, selectedCalendar?.version]);
  const calendarEvents = events.filter((item) => item.data?.calendarObjectId === selectedCalendar?.id);
  const selectedEvent = events.find((item) => item.id === selectedEventId) || calendarEvents[0];
  useEffect(() => {
    setEditingEventTitle(String(selectedEvent?.title || ""));
    setEditingEventPurpose(String(selectedEvent?.summary || ""));
    setEditingEventStartsAt(inputDateTime(selectedEvent?.data?.startsAt));
    setEditingEventEndsAt(inputDateTime(selectedEvent?.data?.endsAt));
    setEditingEventParticipant((Array.isArray(selectedEvent?.data?.participantReferences) ? selectedEvent.data.participantReferences : []).filter((reference: unknown) => reference !== "self").join(", "));
  }, [selectedEvent?.id, selectedEvent?.version]);
  const eventBookings = bookings.filter((item) => item.data?.eventObjectId === selectedEvent?.id);
  const relevantAvailability = availability.filter((item) => item.data?.calendarObjectId === selectedCalendar?.id);
  const selectedAvailability = relevantAvailability.find((item) => item.id === selectedAvailabilityId) || relevantAvailability[0];
  useEffect(() => setEditingAvailabilityTitle(String(selectedAvailability?.title || "")), [selectedAvailability?.id, selectedAvailability?.version]);
  const contextQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-calendar-context"], queryFn: async () => (await apiRequest("GET", `${root}/context`)).json() });
  const canViewCrm = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys) && contextQuery.data.principalContext.visibleInstrumentKeys.includes("crm");
  const crmQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-calendar-crm-context"], enabled: Boolean(canViewCrm), retry: false, queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json() });
  const crmObjects: Json[] = crmQuery.data?.objects || [];
  const commercialPipelines = useMemo(() => crmObjects.filter((item) => item.objectType === "pipeline" && item.state === "active"), [crmObjects]);
  const selectedCommercialPipeline = commercialPipelines.find((pipeline) => pipeline.id === commercialPipelineObjectId) || null;
  const commercialPipelineStages = useMemo(() => Array.isArray(selectedCommercialPipeline?.data?.stages) ? selectedCommercialPipeline.data.stages.filter((stage: unknown): stage is string => typeof stage === "string" && stage.trim().length > 0) : [], [selectedCommercialPipeline]);
  const relationshipChoices = useMemo(() => {
    const people = crmObjects.filter((item) => item.objectType === "person");
    return crmObjects.filter((item) => item.objectType === "relationship").map((relationship) => {
      const person = people.find((item) => item.id === relationship.data?.personObjectId);
      return { relationship, label: `${String(relationship.data?.relationshipType || "Relationship").replaceAll("_", " ")} · ${person?.data?.displayName || person?.title || "Visible relationship"}` };
    });
  }, [crmObjects]);
  const selectedRelationship = relationshipChoices.find((item) => item.relationship.id === selectedRelationshipId) || null;
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-calendar"] });

  const createCalendar = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "calendar", objectType: "calendar", objectKey: `calendar:${safeKey(calendarTitle)}:${Date.now()}`,
      title: calendarTitle.trim(), summary: `Native EOS calendar in ${calendarTimeZone}.`, classification: "confidential", visibility: "seat",
      data: { timeZone: calendarTimeZone }, sourceReference: { authority: "native_eos", capability: "calendar" }, evidenceIds: [], idempotencyKey: commandKey("calendar-create"),
    })).json(),
    onSuccess: async (result) => { setSelectedCalendarId(result.object.id); setCalendarTitle(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const createAvailability = useMutation({
    mutationFn: async () => {
      if (!selectedCalendar) throw new Error("Create or select a native calendar first.");
      const windows = availabilityDays.map((day) => ({ day, startsAt: availabilityStart, endsAt: availabilityEnd }));
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "calendar", objectType: "availability", objectKey: `availability:${selectedCalendar.id}:${Date.now()}`,
        title: availabilityTitle.trim(), summary: `${availabilityDays.join(", ")} · ${availabilityStart}–${availabilityEnd}.`, classification: "confidential", visibility: "seat",
        data: { calendarObjectId: selectedCalendar.id, timeZone: selectedCalendar.data?.timeZone || calendarTimeZone, windows }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("calendar-availability"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedCalendar.id, targetObjectId: result.object.id, relationshipType: "defines_availability", metadata: {}, idempotencyKey: commandKey("calendar-availability-link") });
      return result;
    },
    onSuccess: async () => { setAvailabilityTitle("Working availability"); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const saveCalendar = useMutation({
    mutationFn: async () => {
      if (!selectedCalendar) throw new Error("Select a calendar to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedCalendar.id}`, {
        expectedVersion: selectedCalendar.version,
        title: editingCalendarTitle.trim(),
        summary: `Native EOS calendar in ${editingCalendarTimeZone.trim()}.`,
        data: {
          ...selectedCalendar.data,
          timeZone: editingCalendarTimeZone.trim(), operatingMode: "native_eos",
          publicBooking: publicBookingEnabled,
          // Routing belongs to the public booking surface. Turning that
          // surface off must not leave a hidden commercial destination that
          // reappears if the calendar is enabled again later.
          commercialPipelineObjectId: undefined,
          commercialInitialStage: undefined,
          ...(publicBookingEnabled ? {
            publicBookingConsentVersion: publicBookingConsentVersion.trim(),
            publicBookingConsentLabel: publicBookingConsentLabel.trim(),
            publicBookingConfirmationMessage: publicBookingConfirmationMessage.trim(),
            publicBookingDurationMinutes: Number(publicBookingDurationMinutes),
            publicBookingWindowDays: Number(publicBookingWindowDays),
            commercialPipelineObjectId: commercialPipelineObjectId || undefined,
            commercialInitialStage: commercialPipelineObjectId ? commercialInitialStage : undefined,
          } : {}),
        },
        idempotencyKey: commandKey("calendar-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedCalendarId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const saveAvailability = useMutation({
    mutationFn: async () => {
      if (!selectedAvailability) throw new Error("Select availability to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedAvailability.id}`, {
        expectedVersion: selectedAvailability.version,
        title: editingAvailabilityTitle.trim(),
        data: { ...selectedAvailability.data, operatingMode: "native_eos" },
        idempotencyKey: commandKey("calendar-availability-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedAvailabilityId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!selectedCalendar) throw new Error("Create or select a native calendar first.");
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error("The event must end after it starts.");
      const participants = ["self", participantReference.trim()].filter(Boolean);
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "calendar", objectType: "event", objectKey: `event:${safeKey(eventTitle)}:${Date.now()}`,
        title: eventTitle.trim(), summary: eventPurpose.trim(), classification: "confidential", visibility: "seat",
        data: { calendarObjectId: selectedCalendar.id, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), participantReferences: participants }, sourceReference: { authority: "native_eos", capability: "calendar_event" }, evidenceIds: [], idempotencyKey: commandKey("calendar-event"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedCalendar.id, targetObjectId: result.object.id, relationshipType: "schedules", metadata: {}, idempotencyKey: commandKey("calendar-event-link") });
      return result;
    },
    onSuccess: async (result) => { setSelectedEventId(result.object.id); setEventTitle(""); setEventPurpose(""); setParticipantReference(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const saveEvent = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) throw new Error("Select an event to configure.");
      if (!editingEventStartsAt || !editingEventEndsAt || new Date(editingEventEndsAt).getTime() <= new Date(editingEventStartsAt).getTime()) throw new Error("The event must end after it starts.");
      const participants = ["self", ...editingEventParticipant.split(",").map((reference) => reference.trim()).filter(Boolean)];
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedEvent.id}`, {
        expectedVersion: selectedEvent.version,
        title: editingEventTitle.trim(),
        summary: editingEventPurpose.trim(),
        data: { ...selectedEvent.data, startsAt: new Date(editingEventStartsAt).toISOString(), endsAt: new Date(editingEventEndsAt).toISOString(), participantReferences: participants, operatingMode: "native_eos" },
        idempotencyKey: commandKey("calendar-event-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedEventId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) throw new Error("Select a scheduled native event before recording a booking.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "calendar", objectType: "booking", objectKey: `booking:${selectedEvent.id}:${Date.now()}`,
        title: `Booking · ${selectedEvent.title}`, summary: bookingNote.trim(), classification: "confidential", visibility: "seat",
        data: { eventObjectId: selectedEvent.id, bookedByReference: bookerReference.trim() }, sourceReference: { authority: "native_eos", capability: "calendar_booking" }, evidenceIds: [], idempotencyKey: commandKey("calendar-booking"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedEvent.id, targetObjectId: result.object.id, relationshipType: "booked_as", metadata: {}, idempotencyKey: commandKey("calendar-booking-link") });
      let relationshipLinked = true;
      if (selectedRelationship) try { await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: result.object.id, targetObjectId: selectedRelationship.relationship.id, relationshipType: "concerns_relationship", metadata: { relationshipLabel: selectedRelationship.label }, idempotencyKey: commandKey("calendar-booking-relationship-link") }); } catch { relationshipLinked = false; }
      return { ...result, relationshipLinked };
    },
    onSuccess: async (result) => { setBookerReference(""); setBookingNote(""); if (!result.relationshipLinked) setError("The booking was recorded, but EOS could not create its CRM relationship link. Review the booking before relying on that context."); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state: "active", rationale: "Activate this governed native calendar object for its recorded operating purpose.", evidenceIds: [], idempotencyKey: commandKey("calendar-activate"),
    })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });

  const toggleDay = (day: string) => setAvailabilityDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  const timesValid = Boolean(startsAt && endsAt && new Date(endsAt).getTime() > new Date(startsAt).getTime());
  const commercialRoutingValid = !commercialPipelineObjectId || (Boolean(selectedCommercialPipeline) && commercialPipelineStages.includes(commercialInitialStage));
  const publicBookingFieldsValid = !publicBookingEnabled || (
    publicBookingConsentVersion.trim().length >= 1 && publicBookingConsentLabel.trim().length >= 2 && publicBookingConfirmationMessage.trim().length >= 2 &&
    Number.isInteger(Number(publicBookingDurationMinutes)) && Number(publicBookingDurationMinutes) >= 15 && Number(publicBookingDurationMinutes) <= 240 &&
    Number.isInteger(Number(publicBookingWindowDays)) && Number(publicBookingWindowDays) >= 1 && Number(publicBookingWindowDays) <= 60 && commercialRoutingValid
  );

  return <Card data-testid="native-calendar-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Native Calendar & Booking</CardTitle><CardDescription className="mt-1">Operate accountable time, availability, commitments, and bookings inside EOS. A connected calendar can reconcile later; no external calendar is required to start.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Calendar command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">1. Establish a calendar</h3></div><p className="mt-1 text-sm text-muted-foreground">A calendar belongs to this operating seat. Its entries remain tenant-scoped and evidenceable.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="native-calendar-title">Calendar name</Label><Input id="native-calendar-title" className="mt-1" value={calendarTitle} onChange={(event) => setCalendarTitle(event.target.value)} placeholder="Founder operating calendar" /></div><div><Label htmlFor="native-calendar-timezone">Time zone</Label><Input id="native-calendar-timezone" className="mt-1" value={calendarTimeZone} onChange={(event) => setCalendarTimeZone(event.target.value)} placeholder="America/Los_Angeles" /></div><Button disabled={!canExecute || calendarTitle.trim().length < 2 || calendarTimeZone.trim().length < 2 || createCalendar.isPending} onClick={() => createCalendar.mutate()}><Plus className="mr-2 h-4 w-4" />{createCalendar.isPending ? "Creating calendar…" : "Create native calendar"}</Button></div><div className="mt-4 space-y-2">{calendars.map((calendar) => <button type="button" key={calendar.id} onClick={() => { setSelectedCalendarId(calendar.id); setSelectedEventId(""); }} className={`w-full rounded-lg border p-3 text-left ${selectedCalendar?.id === calendar.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><span className="font-medium">{calendar.title}</span><Badge variant={stateVariant(calendar.state)}>{calendar.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{calendar.data?.timeZone || "Time zone not recorded"}</p></button>)}{!calendars.length && <p className="py-3 text-sm text-muted-foreground">No native calendars yet.</p>}</div>{selectedCalendar && <div className="mt-4 rounded-lg border border-primary/25 bg-primary/[0.03] p-3"><p className="eos-label">Configure selected calendar</p><div className="mt-2 grid gap-3"><div><Label htmlFor="native-edit-calendar-title">Calendar name</Label><Input id="native-edit-calendar-title" className="mt-1" value={editingCalendarTitle} onChange={(event) => setEditingCalendarTitle(event.target.value)} /></div><div><Label htmlFor="native-edit-calendar-timezone">Time zone</Label><Input id="native-edit-calendar-timezone" className="mt-1" value={editingCalendarTimeZone} onChange={(event) => setEditingCalendarTimeZone(event.target.value)} placeholder="America/Los_Angeles" /></div><Button size="sm" disabled={!canExecute || editingCalendarTitle.trim().length < 2 || editingCalendarTimeZone.trim().length < 2 || saveCalendar.isPending} onClick={() => saveCalendar.mutate()}>{saveCalendar.isPending ? "Saving…" : "Save native calendar"}</Button></div></div>}{selectedCalendar?.state === "draft" && <Button className="mt-3" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedCalendar)}>Activate selected calendar</Button>}</section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><h3 className="font-semibold">2. Define availability</h3></div><p className="mt-1 text-sm text-muted-foreground">Availability establishes the operating windows that future booking rules and external-calendar reconciliation must respect.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="native-availability-title">Availability name</Label><Input id="native-availability-title" className="mt-1" value={availabilityTitle} onChange={(event) => setAvailabilityTitle(event.target.value)} /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="native-availability-start">Starts</Label><Input id="native-availability-start" className="mt-1" type="time" value={availabilityStart} onChange={(event) => setAvailabilityStart(event.target.value)} /></div><div><Label htmlFor="native-availability-end">Ends</Label><Input id="native-availability-end" className="mt-1" type="time" value={availabilityEnd} onChange={(event) => setAvailabilityEnd(event.target.value)} /></div></div><div><p className="text-sm font-medium">Days</p><div className="mt-2 flex flex-wrap gap-2">{weekDays.map((day) => <label key={day} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"><input type="checkbox" checked={availabilityDays.includes(day)} onChange={() => toggleDay(day)} />{day}</label>)}</div></div><Button disabled={!canExecute || !selectedCalendar || availabilityTitle.trim().length < 2 || !availabilityDays.length || !availabilityStart || !availabilityEnd || availabilityStart >= availabilityEnd || createAvailability.isPending} onClick={() => createAvailability.mutate()}><Clock3 className="mr-2 h-4 w-4" />{createAvailability.isPending ? "Recording…" : "Record availability"}</Button></div><div className="mt-4 space-y-2">{relevantAvailability.map((item) => <div key={item.id} className="rounded-lg bg-muted/40 p-3"><div className="flex justify-between gap-3"><span className="font-medium">{item.title}</span><Badge variant={stateVariant(item.state)}>{item.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.summary || "No availability windows recorded."}</p>{item.state === "draft" && <Button className="mt-2" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(item)}>Activate</Button>}</div>)}{selectedCalendar && !relevantAvailability.length && <p className="text-sm text-muted-foreground">No availability set for this calendar.</p>}</div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">3. Schedule a native event</h3></div><p className="mt-1 text-sm text-muted-foreground">EOS records the commitment first. It never silently sends an external invite or changes an external calendar.</p><div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-event-title">Event title</Label><Input id="native-event-title" className="mt-1" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Revenue recovery discovery call" /></div><div><Label htmlFor="native-event-participant">Participant reference (optional)</Label><Input id="native-event-participant" className="mt-1" value={participantReference} onChange={(event) => setParticipantReference(event.target.value)} placeholder="CRM person or seat reference" /></div></div><div><Label htmlFor="native-event-purpose">Purpose</Label><Textarea id="native-event-purpose" className="mt-1" value={eventPurpose} onChange={(event) => setEventPurpose(event.target.value)} placeholder="What outcome or decision does this commitment support?" /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="native-event-starts">Starts</Label><Input id="native-event-starts" className="mt-1" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div><div><Label htmlFor="native-event-ends">Ends</Label><Input id="native-event-ends" className="mt-1" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></div></div>{!timesValid && <p className="text-xs text-destructive">The event end time must be after its start time.</p>}<Button disabled={!canExecute || !selectedCalendar || eventTitle.trim().length < 2 || !timesValid || createEvent.isPending} onClick={() => createEvent.mutate()}><Plus className="mr-2 h-4 w-4" />{createEvent.isPending ? "Scheduling…" : "Schedule native event"}</Button></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{calendarEvents.map((event) => <button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className={`rounded-xl border p-4 text-left ${selectedEvent?.id === event.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><p className="font-medium">{event.title}</p><Badge variant={stateVariant(event.state)}>{event.state}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{event.summary || "No purpose recorded."}</p><p className="mt-2 text-xs text-muted-foreground">{formatTime(event.data?.startsAt)} – {formatTime(event.data?.endsAt)}</p>{event.state === "draft" && <span className="mt-3 inline-flex"><Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={(click) => { click.stopPropagation(); activate.mutate(event); }}>Activate event</Button></span>}</button>)}{selectedCalendar && !calendarEvents.length && <p className="py-4 text-sm text-muted-foreground">No events have been scheduled on this calendar.</p>}</div>{selectedEvent && <div className="mt-4 rounded-lg border border-primary/25 bg-primary/[0.03] p-3"><p className="eos-label">Configure selected event</p><div className="mt-2 grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-edit-event-title">Event title</Label><Input id="native-edit-event-title" className="mt-1" value={editingEventTitle} onChange={(event) => setEditingEventTitle(event.target.value)} /></div><div><Label htmlFor="native-edit-event-participant">Participant references</Label><Input id="native-edit-event-participant" className="mt-1" value={editingEventParticipant} onChange={(event) => setEditingEventParticipant(event.target.value)} placeholder="CRM person or seat reference" /></div><div className="md:col-span-2"><Label htmlFor="native-edit-event-purpose">Purpose</Label><Textarea id="native-edit-event-purpose" className="mt-1" value={editingEventPurpose} onChange={(event) => setEditingEventPurpose(event.target.value)} /></div><div><Label htmlFor="native-edit-event-starts">Starts</Label><Input id="native-edit-event-starts" className="mt-1" type="datetime-local" value={editingEventStartsAt} onChange={(event) => setEditingEventStartsAt(event.target.value)} /></div><div><Label htmlFor="native-edit-event-ends">Ends</Label><Input id="native-edit-event-ends" className="mt-1" type="datetime-local" value={editingEventEndsAt} onChange={(event) => setEditingEventEndsAt(event.target.value)} /></div><div className="md:col-span-2"><Button size="sm" disabled={!canExecute || editingEventTitle.trim().length < 2 || !editingEventStartsAt || !editingEventEndsAt || new Date(editingEventEndsAt).getTime() <= new Date(editingEventStartsAt).getTime() || saveEvent.isPending} onClick={() => saveEvent.mutate()}>{saveEvent.isPending ? "Saving…" : "Save native event"}</Button></div></div></div>}</section>
      {selectedEvent && <section className="grid gap-5 rounded-xl border p-4 xl:grid-cols-2"><div><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /><h3 className="font-semibold">4. Record a booking</h3></div><p className="mt-1 text-sm text-muted-foreground">This preserves a governed booking against an EOS event. A public booking flow and external provider sync remain separate, explicit capabilities.</p><div className="mt-4 grid gap-3">{canViewCrm && <div><Label htmlFor="native-booking-relationship">Relationship context (optional)</Label><select id="native-booking-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRelationshipId} onChange={(event) => { setSelectedRelationshipId(event.target.value); const choice = relationshipChoices.find((item) => item.relationship.id === event.target.value); if (choice) setBookerReference(choice.label); }} disabled={crmQuery.isFetching}><option value="">No CRM relationship</option>{relationshipChoices.map((choice) => <option key={choice.relationship.id} value={choice.relationship.id}>{choice.label}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only CRM relationships already visible to this role appear here. EOS creates an auditable native relationship edge; no external calendar is changed.</p></div>}<div><Label htmlFor="native-booker-reference">Booked by</Label><Input id="native-booker-reference" value={bookerReference} onChange={(event) => setBookerReference(event.target.value)} placeholder="CRM person, customer, or approved reference" /></div><div><Label htmlFor="native-booking-note">Booking note</Label><Textarea id="native-booking-note" value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="Context, qualification, or handoff note" /></div><Button disabled={!canExecute || bookerReference.trim().length < 2 || createBooking.isPending} onClick={() => createBooking.mutate()}><UserCheck className="mr-2 h-4 w-4" />{createBooking.isPending ? "Recording…" : "Record booking"}</Button></div></div><div><p className="eos-label">Booking ledger</p><h3 className="mt-1 font-semibold">{selectedEvent.title}</h3><div className="mt-3 space-y-2">{eventBookings.map((booking) => <div key={booking.id} className="rounded-lg bg-muted/40 p-3"><div className="flex justify-between gap-3"><span className="font-medium">{booking.data?.bookedByReference}</span><Badge variant={stateVariant(booking.state)}>{booking.state}</Badge></div>{booking.summary && <p className="mt-1 text-xs text-muted-foreground">{booking.summary}</p>}{booking.state === "draft" && <Button className="mt-2" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(booking)}>Activate booking</Button>}</div>)}{!eventBookings.length && <p className="text-sm text-muted-foreground">No booking has been recorded for this event.</p>}</div></div></section>}
      {selectedAvailability && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Configure selected availability</p><Label htmlFor="native-edit-availability-title" className="mt-2 block">Availability name</Label><Input id="native-edit-availability-title" className="mt-1" value={editingAvailabilityTitle} onChange={(event) => setEditingAvailabilityTitle(event.target.value)} /><Button size="sm" className="mt-3" disabled={!canExecute || editingAvailabilityTitle.trim().length < 2 || saveAvailability.isPending} onClick={() => saveAvailability.mutate()}>{saveAvailability.isPending ? "Saving…" : "Save native availability"}</Button></section>}
      {relevantAvailability.length > 1 && <section className="rounded-xl border p-4"><Label htmlFor="native-select-availability">Availability to configure</Label><select id="native-select-availability" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedAvailability?.id || ""} onChange={(event) => setSelectedAvailabilityId(event.target.value)}>{relevantAvailability.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Choose the availability record whose native name you want to update.</p></section>}
      {selectedCalendar && <section className="rounded-xl border p-4"><div className="flex items-start gap-3"><input id="native-public-booking-enabled" className="mt-1" type="checkbox" checked={publicBookingEnabled} onChange={(event) => setPublicBookingEnabled(event.target.checked)} /><div><Label htmlFor="native-public-booking-enabled">Publish EOS-native booking</Label><p className="mt-1 text-sm text-muted-foreground">Expose only active availability through an EOS booking page. A public booking creates a native calendar event, booking, and consented CRM lead; it does not require or update an external calendar.</p></div></div>{publicBookingEnabled && <div className="mt-4 grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-public-booking-duration">Meeting duration (minutes)</Label><Input id="native-public-booking-duration" className="mt-1" type="number" min={15} max={240} value={publicBookingDurationMinutes} onChange={(event) => setPublicBookingDurationMinutes(event.target.value)} /></div><div><Label htmlFor="native-public-booking-window">Booking window (days)</Label><Input id="native-public-booking-window" className="mt-1" type="number" min={1} max={60} value={publicBookingWindowDays} onChange={(event) => setPublicBookingWindowDays(event.target.value)} /></div><div className="md:col-span-2 rounded-lg border bg-muted/20 p-3"><Label htmlFor="native-public-booking-pipeline">Commercial destination (optional)</Label><p className="mt-1 text-xs text-muted-foreground">Route consented bookings to the relationship’s live native opportunity in this pipeline, creating one at the chosen first stage when necessary. Leave off to keep the booking and agent handoff separate.</p><div className="mt-3 grid gap-2 md:grid-cols-2"><select id="native-public-booking-pipeline" className="h-10 rounded-md border bg-background px-3 text-sm" value={commercialPipelineObjectId} onChange={(event) => { const pipeline = commercialPipelines.find((item) => item.id === event.target.value); const stages = Array.isArray(pipeline?.data?.stages) ? pipeline.data.stages.filter((stage: unknown): stage is string => typeof stage === "string") : []; setCommercialPipelineObjectId(event.target.value); setCommercialInitialStage(stages[0] || ""); }} disabled={crmQuery.isFetching || !canViewCrm}><option value="">No automatic opportunity</option>{commercialPipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.title}</option>)}</select><select id="native-public-booking-pipeline-stage" className="h-10 rounded-md border bg-background px-3 text-sm" value={commercialInitialStage} onChange={(event) => setCommercialInitialStage(event.target.value)} disabled={!commercialPipelineObjectId || !commercialPipelineStages.length}><option value="">Choose first stage</option>{commercialPipelineStages.map((stage: string) => <option key={stage} value={stage}>{stage}</option>)}</select></div>{commercialPipelineObjectId && !commercialRoutingValid && <p className="mt-2 text-xs text-destructive">Choose an active native pipeline and one of its current stages.</p>}{!canViewCrm && <p className="mt-2 text-xs text-muted-foreground">Your current role cannot view CRM pipelines, so no commercial destination can be configured here.</p>}</div><div className="md:col-span-2"><Label htmlFor="native-public-booking-consent-version">Consent version</Label><Input id="native-public-booking-consent-version" className="mt-1" value={publicBookingConsentVersion} onChange={(event) => setPublicBookingConsentVersion(event.target.value)} /></div><div className="md:col-span-2"><Label htmlFor="native-public-booking-consent-label">Consent label</Label><Textarea id="native-public-booking-consent-label" className="mt-1" value={publicBookingConsentLabel} onChange={(event) => setPublicBookingConsentLabel(event.target.value)} /></div><div className="md:col-span-2"><Label htmlFor="native-public-booking-confirmation">Confirmation message</Label><Textarea id="native-public-booking-confirmation" className="mt-1" value={publicBookingConfirmationMessage} onChange={(event) => setPublicBookingConfirmationMessage(event.target.value)} /></div></div>}<div className="mt-4 flex flex-wrap items-center gap-3"><Button size="sm" disabled={!canExecute || !publicBookingFieldsValid || saveCalendar.isPending} onClick={() => saveCalendar.mutate()}>{saveCalendar.isPending ? "Saving…" : "Save booking settings"}</Button>{publicBookingEnabled && selectedCalendar.state === "active" && <a className="text-sm font-medium text-primary underline" href={`/book/${selectedCalendar.id}`} target="_blank" rel="noreferrer">Open booking page</a>}</div>{publicBookingEnabled && !publicBookingFieldsValid && <p className="mt-2 text-xs text-destructive">Use a consent version and label, confirmation message, 15–240 minute duration, and a 1–60 day booking window. If you select a commercial destination, choose one of that pipeline’s current stages.</p>}{publicBookingEnabled && selectedCalendar.state !== "active" && <p className="mt-2 text-xs text-muted-foreground">Activate this calendar after saving and activating at least one availability record before the public link can accept a booking.</p>}</section>}
      <Alert><AlertTitle>Native ownership, controlled overlay</AlertTitle><AlertDescription>EOS owns these native time and commitment records. A connected provider may later reconcile selected fields or send an approved invite, but it cannot silently overwrite native intent, authority, or evidence.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
