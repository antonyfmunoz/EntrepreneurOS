import { useMemo, useState } from "react";
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
  const [availabilityTitle, setAvailabilityTitle] = useState("Working availability");
  const [availabilityStart, setAvailabilityStart] = useState("09:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("17:00");
  const [availabilityDays, setAvailabilityDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventPurpose, setEventPurpose] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTime(1));
  const [endsAt, setEndsAt] = useState(localDateTime(2));
  const [participantReference, setParticipantReference] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [bookerReference, setBookerReference] = useState("");
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
  const calendarEvents = events.filter((item) => item.data?.calendarObjectId === selectedCalendar?.id);
  const selectedEvent = events.find((item) => item.id === selectedEventId) || calendarEvents[0];
  const eventBookings = bookings.filter((item) => item.data?.eventObjectId === selectedEvent?.id);
  const relevantAvailability = availability.filter((item) => item.data?.calendarObjectId === selectedCalendar?.id);
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

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) throw new Error("Select a scheduled native event before recording a booking.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "calendar", objectType: "booking", objectKey: `booking:${selectedEvent.id}:${Date.now()}`,
        title: `Booking · ${selectedEvent.title}`, summary: bookingNote.trim(), classification: "confidential", visibility: "seat",
        data: { eventObjectId: selectedEvent.id, bookedByReference: bookerReference.trim() }, sourceReference: { authority: "native_eos", capability: "calendar_booking" }, evidenceIds: [], idempotencyKey: commandKey("calendar-booking"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedEvent.id, targetObjectId: result.object.id, relationshipType: "booked_as", metadata: {}, idempotencyKey: commandKey("calendar-booking-link") });
      return result;
    },
    onSuccess: async () => { setBookerReference(""); setBookingNote(""); await refresh(); },
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

  return <Card data-testid="native-calendar-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Native Calendar & Booking</CardTitle><CardDescription className="mt-1">Operate accountable time, availability, commitments, and bookings inside EOS. A connected calendar can reconcile later; no external calendar is required to start.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Calendar command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">1. Establish a calendar</h3></div><p className="mt-1 text-sm text-muted-foreground">A calendar belongs to this operating seat. Its entries remain tenant-scoped and evidenceable.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="native-calendar-title">Calendar name</Label><Input id="native-calendar-title" className="mt-1" value={calendarTitle} onChange={(event) => setCalendarTitle(event.target.value)} placeholder="Founder operating calendar" /></div><div><Label htmlFor="native-calendar-timezone">Time zone</Label><Input id="native-calendar-timezone" className="mt-1" value={calendarTimeZone} onChange={(event) => setCalendarTimeZone(event.target.value)} placeholder="America/Los_Angeles" /></div><Button disabled={!canExecute || calendarTitle.trim().length < 2 || calendarTimeZone.trim().length < 2 || createCalendar.isPending} onClick={() => createCalendar.mutate()}><Plus className="mr-2 h-4 w-4" />{createCalendar.isPending ? "Creating calendar…" : "Create native calendar"}</Button></div><div className="mt-4 space-y-2">{calendars.map((calendar) => <button type="button" key={calendar.id} onClick={() => { setSelectedCalendarId(calendar.id); setSelectedEventId(""); }} className={`w-full rounded-lg border p-3 text-left ${selectedCalendar?.id === calendar.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><span className="font-medium">{calendar.title}</span><Badge variant={stateVariant(calendar.state)}>{calendar.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{calendar.data?.timeZone || "Time zone not recorded"}</p></button>)}{!calendars.length && <p className="py-3 text-sm text-muted-foreground">No native calendars yet.</p>}</div>{selectedCalendar?.state === "draft" && <Button className="mt-3" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedCalendar)}>Activate selected calendar</Button>}</section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><h3 className="font-semibold">2. Define availability</h3></div><p className="mt-1 text-sm text-muted-foreground">Availability establishes the operating windows that future booking rules and external-calendar reconciliation must respect.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="native-availability-title">Availability name</Label><Input id="native-availability-title" className="mt-1" value={availabilityTitle} onChange={(event) => setAvailabilityTitle(event.target.value)} /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="native-availability-start">Starts</Label><Input id="native-availability-start" className="mt-1" type="time" value={availabilityStart} onChange={(event) => setAvailabilityStart(event.target.value)} /></div><div><Label htmlFor="native-availability-end">Ends</Label><Input id="native-availability-end" className="mt-1" type="time" value={availabilityEnd} onChange={(event) => setAvailabilityEnd(event.target.value)} /></div></div><div><p className="text-sm font-medium">Days</p><div className="mt-2 flex flex-wrap gap-2">{weekDays.map((day) => <label key={day} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"><input type="checkbox" checked={availabilityDays.includes(day)} onChange={() => toggleDay(day)} />{day}</label>)}</div></div><Button disabled={!canExecute || !selectedCalendar || availabilityTitle.trim().length < 2 || !availabilityDays.length || !availabilityStart || !availabilityEnd || availabilityStart >= availabilityEnd || createAvailability.isPending} onClick={() => createAvailability.mutate()}><Clock3 className="mr-2 h-4 w-4" />{createAvailability.isPending ? "Recording…" : "Record availability"}</Button></div><div className="mt-4 space-y-2">{relevantAvailability.map((item) => <div key={item.id} className="rounded-lg bg-muted/40 p-3"><div className="flex justify-between gap-3"><span className="font-medium">{item.title}</span><Badge variant={stateVariant(item.state)}>{item.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.summary || "No availability windows recorded."}</p>{item.state === "draft" && <Button className="mt-2" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(item)}>Activate</Button>}</div>)}{selectedCalendar && !relevantAvailability.length && <p className="text-sm text-muted-foreground">No availability set for this calendar.</p>}</div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">3. Schedule a native event</h3></div><p className="mt-1 text-sm text-muted-foreground">EOS records the commitment first. It never silently sends an external invite or changes an external calendar.</p><div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-event-title">Event title</Label><Input id="native-event-title" className="mt-1" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Revenue recovery discovery call" /></div><div><Label htmlFor="native-event-participant">Participant reference (optional)</Label><Input id="native-event-participant" className="mt-1" value={participantReference} onChange={(event) => setParticipantReference(event.target.value)} placeholder="CRM person or seat reference" /></div></div><div><Label htmlFor="native-event-purpose">Purpose</Label><Textarea id="native-event-purpose" className="mt-1" value={eventPurpose} onChange={(event) => setEventPurpose(event.target.value)} placeholder="What outcome or decision does this commitment support?" /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="native-event-starts">Starts</Label><Input id="native-event-starts" className="mt-1" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div><div><Label htmlFor="native-event-ends">Ends</Label><Input id="native-event-ends" className="mt-1" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></div></div>{!timesValid && <p className="text-xs text-destructive">The event end time must be after its start time.</p>}<Button disabled={!canExecute || !selectedCalendar || eventTitle.trim().length < 2 || !timesValid || createEvent.isPending} onClick={() => createEvent.mutate()}><Plus className="mr-2 h-4 w-4" />{createEvent.isPending ? "Scheduling…" : "Schedule native event"}</Button></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{calendarEvents.map((event) => <button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className={`rounded-xl border p-4 text-left ${selectedEvent?.id === event.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-3"><p className="font-medium">{event.title}</p><Badge variant={stateVariant(event.state)}>{event.state}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{event.summary || "No purpose recorded."}</p><p className="mt-2 text-xs text-muted-foreground">{formatTime(event.data?.startsAt)} – {formatTime(event.data?.endsAt)}</p>{event.state === "draft" && <span className="mt-3 inline-flex"><Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={(click) => { click.stopPropagation(); activate.mutate(event); }}>Activate event</Button></span>}</button>)}{selectedCalendar && !calendarEvents.length && <p className="py-4 text-sm text-muted-foreground">No events have been scheduled on this calendar.</p>}</div></section>
      {selectedEvent && <section className="grid gap-5 rounded-xl border p-4 xl:grid-cols-2"><div><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /><h3 className="font-semibold">4. Record a booking</h3></div><p className="mt-1 text-sm text-muted-foreground">This preserves a governed booking against an EOS event. A public booking flow and external provider sync remain separate, explicit capabilities.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="native-booker-reference">Booked by</Label><Input id="native-booker-reference" value={bookerReference} onChange={(event) => setBookerReference(event.target.value)} placeholder="CRM person, customer, or approved reference" /></div><div><Label htmlFor="native-booking-note">Booking note</Label><Textarea id="native-booking-note" value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="Context, qualification, or handoff note" /></div><Button disabled={!canExecute || bookerReference.trim().length < 2 || createBooking.isPending} onClick={() => createBooking.mutate()}><UserCheck className="mr-2 h-4 w-4" />{createBooking.isPending ? "Recording…" : "Record booking"}</Button></div></div><div><p className="eos-label">Booking ledger</p><h3 className="mt-1 font-semibold">{selectedEvent.title}</h3><div className="mt-3 space-y-2">{eventBookings.map((booking) => <div key={booking.id} className="rounded-lg bg-muted/40 p-3"><div className="flex justify-between gap-3"><span className="font-medium">{booking.data?.bookedByReference}</span><Badge variant={stateVariant(booking.state)}>{booking.state}</Badge></div>{booking.summary && <p className="mt-1 text-xs text-muted-foreground">{booking.summary}</p>}{booking.state === "draft" && <Button className="mt-2" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(booking)}>Activate booking</Button>}</div>)}{!eventBookings.length && <p className="text-sm text-muted-foreground">No booking has been recorded for this event.</p>}</div></div></section>}
      <Alert><AlertTitle>Native ownership, controlled overlay</AlertTitle><AlertDescription>EOS owns these native time and commitment records. A connected provider may later reconcile selected fields or send an approved invite, but it cannot silently overwrite native intent, authority, or evidence.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
