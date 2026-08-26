import { z } from "zod";

export const stakeholderPortalCreateSchema = z.object({
  portalKey: z.string().trim().min(3).max(160), name: z.string().trim().min(3).max(240),
  portalType: z.enum(["client", "board", "advisor", "investor", "capital", "partner"]),
  stakeholderId: z.string().trim().min(1).max(200).optional(),
  visibleSections: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
  activationRequirements: z.array(z.string().trim().min(5).max(1000)).min(1).max(30),
});

export const stakeholderPortalTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(), state: z.enum(["configuring", "active", "paused", "retired"]),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]), rationale: z.string().trim().min(20).max(6000),
});

export const stakeholderPublicationCreateSchema = z.object({
  section: z.string().trim().min(2).max(120), title: z.string().trim().min(3).max(300), body: z.string().trim().min(10).max(30_000),
  dataProjection: z.record(z.unknown()).default({}), evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
});

export const stakeholderPublicationTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(), state: z.enum(["published", "withdrawn"]), rationale: z.string().trim().min(20).max(6000),
});

export const stakeholderAccessGrantSchema = z.object({
  recipientLabel: z.string().trim().min(2).max(240), recipientIdentity: z.string().trim().min(3).max(500),
  expiresAt: z.string().datetime(), rationale: z.string().trim().min(20).max(4000),
}).refine((value) => new Date(value.expiresAt) > new Date(), { path: ["expiresAt"], message: "Access must expire in the future." });
