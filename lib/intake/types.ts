// lib/intake/types.ts
// Shared types for the unified intake phase.

import { z } from "zod";
import { SpecOutputSchema } from "@shared/spec-schema.js";

export type IntakeMode = "greenfield" | "docs-only" | "existing-codebase";

export const TechStackSchema = z.object({
  frontend: z.string().default("react"),
  buildTool: z.string().default("vite"),
  styling: z.string().default("tailwind"),
  componentLib: z.string().default("shadcn/ui"),
  language: z.string().default("typescript"),
});
export type TechStack = z.infer<typeof TechStackSchema>;

export const ProjectBriefSchema = z.object({
  // Product
  productName: z.string().min(1),
  productDescription: z.string().min(1),
  productVision: z.string().default(""),
  targetUsers: z.array(z.string()).default([]),
  jobsToBeDone: z.array(z.string()).default([]),

  // Brand
  brandVoice: z.string().default(""),
  designSystem: z.string().default(""),

  // Tech
  techStack: TechStackSchema,
  authProvider: z.enum(["firebase", "supabase", "custom", "none"]).default("firebase"),
  dbProvider: z.enum(["neon", "supabase", "planetscale", "other"]).default("neon"),
  deployTarget: z.enum(["vercel", "railway", "vps", "other"]).default("vps"),

  // Scope
  spec: SpecOutputSchema,

  // Meta
  isGreenfield: z.boolean(),
  existingCodeScanned: z.boolean().default(false),
  sourceDocs: z.array(z.string()).default([]),
});
export type ProjectBrief = z.infer<typeof ProjectBriefSchema>;
