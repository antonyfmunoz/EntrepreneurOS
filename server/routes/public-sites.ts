import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { companies, eosInstrumentObjects } from "@shared/schema";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";

const publicSiteRateLimit = fixedWindowRateLimit({ limit: 60, windowMs: 60_000, namespace: "eos-public-sites" });
const pathSchema = z.string().trim().min(1).max(180).regex(/^\/[a-z0-9][a-z0-9/-]*$/i);
const publicPageSchema = z.object({ publicPage: z.literal(true), siteObjectId: z.string().uuid(), headline: z.string().trim().min(2).max(240), supportingCopy: z.string().trim().max(4_000).default(""), primaryCtaLabel: z.string().trim().max(80).default(""), primaryCtaHref: z.string().trim().max(1_000).default(""), path: pathSchema }).passthrough();
const publicSiteSchema = z.object({ brandName: z.string().trim().min(2).max(160) }).passthrough();

function headers(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
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
    res.json({ schemaVersion: "eos.public-page.v1", page: { id: page.id, siteName: siteData.data.brandName, companyName: company?.name || "Organization", headline: definition.data.headline, supportingCopy: definition.data.supportingCopy, primaryCtaLabel: definition.data.primaryCtaLabel, primaryCtaHref: definition.data.primaryCtaHref, path: definition.data.path } });
  }));
}
