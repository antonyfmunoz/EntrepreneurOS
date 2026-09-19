import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { companies, eosInstrumentObjects } from "@shared/schema";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";

const publicFunnelRateLimit = fixedWindowRateLimit({ limit: 60, windowMs: 60_000, namespace: "eos-public-funnels" });
const publicIdSchema = z.string().uuid();
const publicFunnelDataSchema = z.object({
  publicFunnel: z.literal(true),
  headline: z.string().trim().min(2).max(240),
  supportingCopy: z.string().trim().max(4_000).default(""),
  primaryCtaLabel: z.string().trim().min(2).max(80),
  // Legacy compiled funnels retain captureFormObjectId. New funnels state the
  // next EOS-owned step explicitly, which permits native booking without any
  // external scheduling system.
  primaryCtaTarget: z.enum(["capture_form", "booking_calendar"]).optional(),
  captureFormObjectId: z.string().uuid().optional(),
  bookingCalendarObjectId: z.string().uuid().optional(),
}).passthrough().superRefine((value, context) => {
  const target = value.primaryCtaTarget || "capture_form";
  if (target === "capture_form" && !value.captureFormObjectId)
    context.addIssue({ code: "custom", path: ["captureFormObjectId"], message: "A published native intake form is required." });
  if (target === "booking_calendar" && !value.bookingCalendarObjectId)
    context.addIssue({ code: "custom", path: ["bookingCalendarObjectId"], message: "A published native booking calendar is required." });
});

class PublicFunnelError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof PublicFunnelError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "public_funnel_input_invalid", message: error.issues[0]?.message || "The public funnel request is invalid." });
      next(error);
    }
  };
}

function publicHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

// A visitor never receives internal object metadata, ownership, authority,
// evidence, or linked CRM records. They only receive an active publisher's
// intentionally public copy and the next consented EOS intake point.
export function registerPublicFunnelRoutes(app: Express): void {
  app.use("/api/public/funnels", publicFunnelRateLimit);

  app.get("/api/public/funnels/:funnelId", route(async (req, res) => {
    const funnelId = publicIdSchema.parse(req.params.funnelId);
    const [funnel] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, funnelId),
      eq(eosInstrumentObjects.instrumentKey, "websites"),
      eq(eosInstrumentObjects.objectType, "funnel"),
      eq(eosInstrumentObjects.state, "active"),
    )).limit(1);
    if (!funnel) throw new PublicFunnelError(404, "public_funnel_unavailable", "This EOS funnel is unavailable.");
    const definition = publicFunnelDataSchema.safeParse(funnel.data);
    if (!definition.success) throw new PublicFunnelError(404, "public_funnel_unavailable", "This EOS funnel is unavailable.");

    const target = definition.data.primaryCtaTarget || "capture_form";
    const targetId = target === "capture_form"
      ? definition.data.captureFormObjectId
      : definition.data.bookingCalendarObjectId;
    const [nextStep] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, targetId!),
      eq(eosInstrumentObjects.companyId, funnel.companyId),
      eq(eosInstrumentObjects.instrumentKey, target === "capture_form" ? "forms" : "calendar"),
      eq(eosInstrumentObjects.objectType, target === "capture_form" ? "form" : "calendar"),
      eq(eosInstrumentObjects.state, "active"),
    )).limit(1);
    const nextStepData = nextStep?.data as Record<string, unknown> | undefined;
    const nextStepPublished = target === "capture_form"
      ? nextStepData?.publicCapture === true
      : nextStepData?.publicBooking === true;
    if (!nextStep || !nextStepPublished) {
      throw new PublicFunnelError(404, "public_funnel_next_step_unavailable", "This EOS funnel's published next step is unavailable.");
    }
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, funnel.companyId)).limit(1);
    publicHeaders(res);
    res.json({
      schemaVersion: "eos.public-funnel.v2",
      funnel: {
        id: funnel.id,
        title: funnel.title,
        companyName: company?.name || "Organization",
        headline: definition.data.headline,
        supportingCopy: definition.data.supportingCopy,
        primaryCtaLabel: definition.data.primaryCtaLabel,
        primaryCtaTarget: target,
        primaryCtaUrl: target === "capture_form" ? `/capture/${nextStep.id}` : `/book/${nextStep.id}`,
      },
    });
  }));
}
