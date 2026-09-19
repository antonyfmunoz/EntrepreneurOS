import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import { companies, eosAuditRecords, eosInstrumentCommands, eosInstrumentEvents, eosInstrumentLinks, eosInstrumentObjects } from "@shared/schema";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";

const publicBookingRateLimit = fixedWindowRateLimit({ limit: 30, windowMs: 60_000, namespace: "eos-public-booking" });
const publicIdSchema = z.string().uuid();
const publicBookingCalendarSchema = z.object({
  publicBooking: z.literal(true),
  publicBookingConsentVersion: z.string().trim().min(1).max(120),
  publicBookingConsentLabel: z.string().trim().min(2).max(1_000),
  publicBookingConfirmationMessage: z.string().trim().min(2).max(1_000),
  publicBookingDurationMinutes: z.number().int().min(15).max(240).default(30),
  publicBookingWindowDays: z.number().int().min(1).max(60).default(14),
  timeZone: z.string().trim().min(2).max(120),
}).passthrough();
const publicBookingSubmissionSchema = z.object({
  startsAt: z.string().datetime(),
  name: z.string().trim().min(2).max(240),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).default(""),
  companyName: z.string().trim().max(240).default(""),
  note: z.string().trim().max(4_000).default(""),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(""),
});

type CalendarDefinition = z.infer<typeof publicBookingCalendarSchema>;

class PublicBookingError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof PublicBookingError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "public_booking_input_invalid", message: error.issues[0]?.message || "The booking request is invalid." });
      next(error);
    }
  };
}

function headers(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function definitionFor(calendar: typeof eosInstrumentObjects.$inferSelect) {
  const definition = publicBookingCalendarSchema.safeParse(calendar.data);
  if (!definition.success || calendar.instrumentKey !== "calendar" || calendar.objectType !== "calendar" || calendar.state !== "active")
    throw new PublicBookingError(404, "public_booking_unavailable", "This EOS booking link is unavailable.");
  return definition.data;
}

function eventTimes(record: typeof eosInstrumentObjects.$inferSelect) {
  const data = record.data as Record<string, unknown>;
  const startsAt = typeof data.startsAt === "string" ? Date.parse(data.startsAt) : Number.NaN;
  const endsAt = typeof data.endsAt === "string" ? Date.parse(data.endsAt) : Number.NaN;
  return { startsAt, endsAt };
}

function localClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { weekday: pick("weekday"), minutes: Number(pick("hour")) * 60 + Number(pick("minute")) };
}

function minutes(value: unknown) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return Number.NaN;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function fitsAvailability(startsAt: Date, endsAt: Date, timeZone: string, availability: typeof eosInstrumentObjects.$inferSelect[]) {
  const start = localClock(startsAt, timeZone);
  const end = localClock(endsAt, timeZone);
  if (start.weekday !== end.weekday) return false;
  return availability.some((record) => {
    const candidateWindows = (record.data as Record<string, unknown>).windows;
    const windows: unknown[] = Array.isArray(candidateWindows) ? candidateWindows : [];
    return windows.some((window) => {
      if (!window || typeof window !== "object") return false;
      const value = window as Record<string, unknown>;
      const windowStart = minutes(value.startsAt);
      const windowEnd = minutes(value.endsAt);
      return value.day === start.weekday && Number.isFinite(windowStart) && Number.isFinite(windowEnd) && start.minutes >= windowStart && end.minutes <= windowEnd;
    });
  });
}

function overlaps(startsAt: number, endsAt: number, events: typeof eosInstrumentObjects.$inferSelect[]) {
  return events.some((event) => {
    const time = eventTimes(event);
    return Number.isFinite(time.startsAt) && Number.isFinite(time.endsAt) && startsAt < time.endsAt && endsAt > time.startsAt;
  });
}

function activationFor(companyId: number, calendarId: string) {
  return db.select().from(eosInstrumentCommands).where(and(
    eq(eosInstrumentCommands.companyId, companyId),
    eq(eosInstrumentCommands.objectId, calendarId),
    eq(eosInstrumentCommands.commandType, "object.transition"),
  )).orderBy(desc(eosInstrumentCommands.completedAt)).limit(1);
}

async function calendarById(calendarId: string) {
  const [calendar] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, calendarId), eq(eosInstrumentObjects.instrumentKey, "calendar"),
    eq(eosInstrumentObjects.objectType, "calendar"), eq(eosInstrumentObjects.state, "active"),
  )).limit(1);
  if (!calendar) throw new PublicBookingError(404, "public_booking_unavailable", "This EOS booking link is unavailable.");
  return calendar;
}

async function bookingContext(calendar: typeof eosInstrumentObjects.$inferSelect) {
  const definition = definitionFor(calendar);
  const [activation] = await activationFor(calendar.companyId, calendar.id);
  if (!activation?.policyDecisionId)
    throw new PublicBookingError(409, "public_booking_authorization_missing", "This booking link has no publish authorization record. Pause it and republish through EOS.");
  const records = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.companyId, calendar.companyId), eq(eosInstrumentObjects.instrumentKey, "calendar"), eq(eosInstrumentObjects.state, "active"),
  ));
  const availability = records.filter((record) => record.objectType === "availability" && (record.data as Record<string, unknown>).calendarObjectId === calendar.id);
  if (!availability.length) throw new PublicBookingError(409, "public_booking_availability_missing", "This booking link does not have active availability yet.");
  return { definition, activation, availability, events: records.filter((record) => record.objectType === "event" && (record.data as Record<string, unknown>).calendarObjectId === calendar.id) };
}

function eventHash(input: Record<string, unknown>) {
  return nativeContractContentSha256({ schemaVersion: "eos.public-booking-event.v1", ...input });
}

export function registerPublicBookingRoutes(app: Express): void {
  app.use("/api/public/bookings", publicBookingRateLimit);

  app.get("/api/public/bookings/:calendarId", route(async (req, res) => {
    const calendar = await calendarById(publicIdSchema.parse(req.params.calendarId));
    const { definition, availability, events } = await bookingContext(calendar);
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, calendar.companyId)).limit(1);
    const now = Date.now() + 5 * 60_000;
    const slots: string[] = [];
    const durationMs = definition.publicBookingDurationMinutes * 60_000;
    let cursor = Math.ceil(now / (30 * 60_000)) * 30 * 60_000;
    const cutoff = Date.now() + definition.publicBookingWindowDays * 86_400_000;
    while (cursor + durationMs <= cutoff && slots.length < 500) {
      const startsAt = new Date(cursor); const endsAt = new Date(cursor + durationMs);
      if (fitsAvailability(startsAt, endsAt, definition.timeZone, availability) && !overlaps(cursor, cursor + durationMs, events)) slots.push(startsAt.toISOString());
      cursor += 30 * 60_000;
    }
    headers(res);
    res.json({ schemaVersion: "eos.public-booking.v1", calendar: {
      id: calendar.id, title: calendar.title, summary: calendar.summary, companyName: company?.name || "Organization", timeZone: definition.timeZone,
      durationMinutes: definition.publicBookingDurationMinutes, slots, consentLabel: definition.publicBookingConsentLabel,
    } });
  }));

  app.post("/api/public/bookings/:calendarId/reservations", route(async (req, res) => {
    const calendar = await calendarById(publicIdSchema.parse(req.params.calendarId));
    const input = publicBookingSubmissionSchema.parse(req.body);
    if (input.website.trim()) {
      headers(res);
      res.status(202).json({ schemaVersion: "eos.public-booking-reservation.v1", accepted: true });
      return;
    }
    const { definition, activation, availability } = await bookingContext(calendar);
    const startsAt = new Date(input.startsAt); const startsMs = startsAt.getTime(); const endsAt = new Date(startsMs + definition.publicBookingDurationMinutes * 60_000);
    if (!Number.isFinite(startsMs) || startsMs < Date.now() + 5 * 60_000) throw new PublicBookingError(400, "public_booking_time_invalid", "Choose a future available time.");
    if (startsMs > Date.now() + definition.publicBookingWindowDays * 86_400_000) throw new PublicBookingError(400, "public_booking_time_outside_window", "Choose a time inside the current booking window.");
    if (!fitsAvailability(startsAt, endsAt, definition.timeZone, availability)) throw new PublicBookingError(409, "public_booking_time_unavailable", "That time is not in the current availability. Refresh and choose another time.");
    const now = new Date(); const bookingEventId = randomUUID(); const bookingId = randomUUID(); const commandId = randomUUID(); const normalizedEmail = input.email.toLowerCase();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`public-booking:${calendar.id}:${startsAt.toISOString()}`}))`);
      const [currentCalendar] = await tx.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.id, calendar.id), eq(eosInstrumentObjects.companyId, calendar.companyId),
        eq(eosInstrumentObjects.instrumentKey, "calendar"), eq(eosInstrumentObjects.objectType, "calendar"), eq(eosInstrumentObjects.state, "active"),
      )).limit(1);
      if (!currentCalendar || currentCalendar.version !== calendar.version) throw new PublicBookingError(409, "public_booking_calendar_changed", "The booking configuration changed. Refresh and choose an available time again.");
      const activeCalendarRecords = await tx.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, calendar.companyId), eq(eosInstrumentObjects.instrumentKey, "calendar"), eq(eosInstrumentObjects.state, "active")));
      const currentAvailability = activeCalendarRecords.filter((record) => record.objectType === "availability" && (record.data as Record<string, unknown>).calendarObjectId === calendar.id);
      if (!fitsAvailability(startsAt, endsAt, definition.timeZone, currentAvailability)) throw new PublicBookingError(409, "public_booking_availability_changed", "Availability changed. Refresh and choose another time.");
      const conflicting = activeCalendarRecords.filter((record) => record.objectType === "event" && (record.data as Record<string, unknown>).calendarObjectId === calendar.id);
      if (overlaps(startsMs, endsAt.getTime(), conflicting)) throw new PublicBookingError(409, "public_booking_time_taken", "That time was just reserved. Refresh and choose another available time.");
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`public-booking-contact:${calendar.companyId}:${normalizedEmail}`}))`);
      const [existingPerson] = await tx.select().from(eosInstrumentObjects).where(and(
        eq(eosInstrumentObjects.companyId, calendar.companyId), eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "person"), eq(eosInstrumentObjects.state, "active"),
        sql`lower(${eosInstrumentObjects.data}->>'email') = ${normalizedEmail}`,
      )).limit(1);
      // A public booking crosses native Calendar and CRM.  Keep the CRM
      // identity and relationship as company-level records, rather than
      // pretending that a calendar is their parent.  Calendar records still
      // carry that hierarchy explicitly below and through governed links.
      const common = { companyId: calendar.companyId, classification: "confidential", visibility: "organization", ownerSeatId: calendar.ownerSeatId, parentObjectId: null, evidenceIds: [], version: 1, recordedByUserId: calendar.recordedByUserId, createdAt: now, updatedAt: now, archivedAt: null, state: "active" } as const;
      const sourceReference = { authority: "public_eos_booking", calendarObjectId: calendar.id, consentVersion: definition.publicBookingConsentVersion, bookedAt: now.toISOString(), externalActor: "unverified_public_submitter" };
      const person = existingPerson || { ...common, id: randomUUID(), instrumentKey: "crm", objectType: "person", objectKey: `booking-person:${calendar.id}:${randomUUID()}`, title: input.name, summary: input.email, data: { displayName: input.name, email: input.email, phone: input.phone, companyName: input.companyName, sourceCalendarObjectId: calendar.id }, sourceReference };
      const [existingRelationship] = existingPerson ? await tx.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, calendar.companyId), eq(eosInstrumentObjects.instrumentKey, "crm"), eq(eosInstrumentObjects.objectType, "relationship"), eq(eosInstrumentObjects.state, "active"), sql`${eosInstrumentObjects.data}->>'personObjectId' = ${person.id}`, sql`${eosInstrumentObjects.data}->>'relationshipType' = 'lead'`)).limit(1) : [];
      const relationship = existingRelationship || { ...common, id: randomUUID(), instrumentKey: "crm", objectType: "relationship", objectKey: `booking-lead:${calendar.id}:${randomUUID()}`, title: `Lead · ${input.name}`, summary: `Booking lead for ${calendar.title}.`, data: { personObjectId: person.id, relationshipType: "lead", sourceCalendarObjectId: calendar.id }, sourceReference };
      const event = { ...common, id: bookingEventId, instrumentKey: "calendar", objectType: "event", objectKey: `public-booking-event:${calendar.id}:${bookingEventId}`, parentObjectId: calendar.id, title: `Booking · ${input.name}`, summary: input.note || `Public booking for ${calendar.title}.`, data: { calendarObjectId: calendar.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), participantReferences: [input.email], bookingSource: "public_eos", relationshipObjectId: relationship.id }, sourceReference };
      const booking = { ...common, id: bookingId, instrumentKey: "calendar", objectType: "booking", objectKey: `public-booking:${calendar.id}:${bookingId}`, parentObjectId: calendar.id, title: `Booking · ${input.name}`, summary: input.note || `Public booking for ${calendar.title}.`, data: { calendarObjectId: calendar.id, eventObjectId: event.id, bookedByReference: input.email, relationshipObjectId: relationship.id, consentVersion: definition.publicBookingConsentVersion, bookedAt: now.toISOString() }, sourceReference };
      const projections = [event, booking, ...(existingPerson ? [] : [person]), ...(existingRelationship ? [] : [relationship])].map((item) => ({ ...item, contentSha256: nativeContractContentSha256(item) }));
      await tx.insert(eosInstrumentObjects).values(projections);
      const command = { id: commandId, companyId: calendar.companyId, instrumentKey: "calendar", objectId: booking.id, commandType: "public_booking.recorded", idempotencyKey: `public-booking:${booking.id}`, expectedVersion: null, payload: { calendarObjectId: calendar.id, eventObjectId: event.id, source: "unverified_public_submitter" }, result: { objectId: booking.id, eventObjectId: event.id, state: "active" }, state: "completed", policyDecisionId: activation.policyDecisionId, requestedByUserId: calendar.recordedByUserId, createdAt: now, completedAt: now };
      await tx.insert(eosInstrumentCommands).values(command);
      await tx.insert(eosInstrumentEvents).values({ id: randomUUID(), companyId: calendar.companyId, instrumentKey: "calendar", objectId: booking.id, commandId: command.id, eventType: "public_booking.recorded", fromState: null, toState: "active", objectVersion: 1, payload: { calendarObjectId: calendar.id, eventObjectId: event.id, relationshipObjectId: relationship.id }, evidenceIds: [], contentSha256: eventHash({ companyId: calendar.companyId, bookingId: booking.id, eventId: event.id, commandId: command.id }), recordedByUserId: calendar.recordedByUserId, createdAt: now });
      await tx.insert(eosInstrumentLinks).values([
        { id: randomUUID(), companyId: calendar.companyId, sourceObjectId: calendar.id, targetObjectId: event.id, relationshipType: "schedules", metadata: { source: "public_eos_booking" }, createdByUserId: calendar.recordedByUserId, createdAt: now },
        { id: randomUUID(), companyId: calendar.companyId, sourceObjectId: event.id, targetObjectId: booking.id, relationshipType: "booked_as", metadata: { source: "public_eos_booking" }, createdByUserId: calendar.recordedByUserId, createdAt: now },
        { id: randomUUID(), companyId: calendar.companyId, sourceObjectId: booking.id, targetObjectId: relationship.id, relationshipType: "concerns_relationship", metadata: { source: "public_eos_booking" }, createdByUserId: calendar.recordedByUserId, createdAt: now },
        ...(!existingRelationship ? [{ id: randomUUID(), companyId: calendar.companyId, sourceObjectId: person.id, targetObjectId: relationship.id, relationshipType: "has_relationship", metadata: { source: "public_eos_booking" }, createdByUserId: calendar.recordedByUserId, createdAt: now }] : []),
      ]);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: calendar.companyId, actorUserId: calendar.recordedByUserId, action: "booking.public_reservation_recorded", targetType: "calendar_booking", targetId: booking.id, traceId: `public:${booking.id}`, correlationId: booking.id, result: "captured_unverified", details: { actorType: "unverified_public_submitter", calendarObjectId: calendar.id, eventObjectId: event.id, relationshipObjectId: relationship.id, consentVersion: definition.publicBookingConsentVersion, activationPolicyDecisionId: activation.policyDecisionId }, createdAt: now });
    });
    headers(res);
    res.status(201).json({ schemaVersion: "eos.public-booking-reservation.v1", accepted: true, startsAt: startsAt.toISOString(), confirmationMessage: definition.publicBookingConfirmationMessage });
  }));
}
