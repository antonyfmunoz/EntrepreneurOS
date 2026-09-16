import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { companies, eosInstrumentObjects } from "@shared/schema";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";

const publicSiteRateLimit = fixedWindowRateLimit({ limit: 60, windowMs: 60_000, namespace: "eos-public-sites" });
const pathSchema = z.string().trim().min(1).max(180).regex(/^\/[a-z0-9][a-z0-9/-]*$/i);
const publicPageSchema = z.object({
  publicPage: z.literal(true),
  siteObjectId: z.string().uuid(),
  headline: z.string().trim().min(2).max(240),
  supportingCopy: z.string().trim().max(4_000).default(""),
  primaryCtaLabel: z.string().trim().max(80).default(""),
  // Existing pages remain compatible with a manually entered destination, but
  // new pages can bind the CTA to an EOS-owned intake form or funnel by ID.
  primaryCtaTarget: z.enum(["manual", "capture_form", "funnel"]).default("manual"),
  primaryCtaTargetId: z.string().uuid().nullable().optional(),
  primaryCtaHref: z.string().trim().max(1_000).default(""),
  path: pathSchema,
}).passthrough();
const publicSiteSchema = z.object({ brandName: z.string().trim().min(2).max(160) }).passthrough();
const publicCaptureFormSchema = z.object({ publicCapture: z.literal(true) }).passthrough();
const publicFunnelSchema = z.object({ publicFunnel: z.literal(true) }).passthrough();

function headers(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}
async function resolvedCtaHref(page: typeof eosInstrumentObjects.$inferSelect, definition: z.infer<typeof publicPageSchema>) {
  if (!definition.primaryCtaLabel) return "";
  if (definition.primaryCtaTarget === "manual") return definition.primaryCtaHref;
  if (!definition.primaryCtaTargetId) return "";

  if (definition.primaryCtaTarget === "capture_form") {
    const [form] = await db.select().from(eosInstrumentObjects).where(and(
      eq(eosInstrumentObjects.id, definition.primaryCtaTargetId),
      eq(eosInstrumentObjects.companyId, page.companyId),
      eq(eosInstrumentObjects.instrumentKey, "forms"),
      eq(eosInstrumentObjects.objectType, "form"),
      eq(eosInstrumentObjects.state, "active"),
    )).limit(1);
    // An unavailable target is rendered as no CTA. This never exposes another
    // company's object or turns an unpublished intake point into a public URL.
    return form && publicCaptureFormSchema.safeParse(form.data).success ? `/capture/${form.id}` : "";
  }

  const [funnel] = await db.select().from(eosInstrumentObjects).where(and(
    eq(eosInstrumentObjects.id, definition.primaryCtaTargetId),
    eq(eosInstrumentObjects.companyId, page.companyId),
    eq(eosInstrumentObjects.instrumentKey, "websites"),
    eq(eosInstrumentObjects.objectType, "funnel"),
    eq(eosInstrumentObjects.state, "active"),
  )).limit(1);
  return funnel && publicFunnelSchema.safeParse(funnel.data).success ? `/f/${funnel.id}` : "";
}
function pagePayload(page: typeof eosInstrumentObjects.$inferSelect, siteName: string, companyName: string, definition: z.infer<typeof publicPageSchema>, primaryCtaHref: string) {
  return { schemaVersion: "eos.public-page.v1", page: { id: page.id, siteName, companyName, headline: definition.headline, supportingCopy: definition.supportingCopy, primaryCtaLabel: definition.primaryCtaLabel, primaryCtaHref, path: definition.path } };
}
function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof ZodError) return res.status(404).json({ code: "public_page_unavailable", message: "This EOS page is unavailable." });
      next(error);
    }
  };
}

export function registerPublicSiteRoutes(app: Express): void {
  app.use("/api/public/pages", publicSiteRateLimit);
  app.get("/api/public/pages/:pageId", route(async (req, res) => {
    const pageId = z.string().uuid().parse(req.params.pageId);
    const [page] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, pageId), eq(eosInstrumentObjects.instrumentKey, "websites"), eq(eosInstrumentObjects.objectType, "page"), eq(eosInstrumentObjects.state, "active"))).limit(1);
    const definition = publicPageSchema.safeParse(page?.data);
    if (!page || !definition.success) { res.status(404).json({ code: "public_page_unavailable", message: "This EOS page is unavailable." }); return; }
    const [site] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, definition.data.siteObjectId), eq(eosInstrumentObjects.companyId, page.companyId), eq(eosInstrumentObjects.instrumentKey, "websites"), eq(eosInstrumentObjects.objectType, "site"), eq(eosInstrumentObjects.state, "active"))).limit(1);
    const siteData = publicSiteSchema.safeParse(site?.data);
    if (!site || !siteData.success) { res.status(404).json({ code: "public_site_unavailable", message: "This EOS site is unavailable." }); return; }
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, page.companyId)).limit(1);
    headers(res);
    res.json(pagePayload(page, siteData.data.brandName, company?.name || "Organization", definition.data, await resolvedCtaHref(page, definition.data)));
  }));

  // Public routes resolve only a published site and a published page that
  // belongs to that same company/site pair.  The configured path is therefore
  // a usable native URL, not just descriptive page metadata.
  app.get("/api/public/sites/:siteId/page", route(async (req, res) => {
    const siteId = z.string().uuid().parse(req.params.siteId);
    const path = pathSchema.parse(req.query.path);
    const [site] = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.id, siteId), eq(eosInstrumentObjects.instrumentKey, "websites"), eq(eosInstrumentObjects.objectType, "site"), eq(eosInstrumentObjects.state, "active"))).limit(1);
    const siteData = publicSiteSchema.safeParse(site?.data);
    if (!site || !siteData.success) { res.status(404).json({ code: "public_site_unavailable", message: "This EOS site is unavailable." }); return; }
    const candidates = await db.select().from(eosInstrumentObjects).where(and(eq(eosInstrumentObjects.companyId, site.companyId), eq(eosInstrumentObjects.instrumentKey, "websites"), eq(eosInstrumentObjects.objectType, "page"), eq(eosInstrumentObjects.state, "active")));
    const page = candidates.find((candidate) => {
      const definition = publicPageSchema.safeParse(candidate.data);
      return definition.success && definition.data.siteObjectId === site.id && definition.data.path === path;
    });
    const definition = publicPageSchema.safeParse(page?.data);
    if (!page || !definition.success) { res.status(404).json({ code: "public_page_unavailable", message: "This EOS page is unavailable." }); return; }
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, site.companyId)).limit(1);
    headers(res);
    res.json(pagePayload(page, siteData.data.brandName, company?.name || "Organization", definition.data, await resolvedCtaHref(page, definition.data)));
  }));
}
