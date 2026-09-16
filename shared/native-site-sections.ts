import { z } from "zod";

// EOS pages are intentionally assembled from a small, reviewable vocabulary.
// This is a no-code composition model, not an arbitrary HTML/script escape
// hatch, so public publishing can remain tenant-safe and auditable.
export const nativeSiteSectionKinds = [
  "outcomes",
  "steps",
  "proof",
  "faq",
  "callout",
] as const;
export type NativeSiteSectionKind = (typeof nativeSiteSectionKinds)[number];

export type NativeSiteSection = {
  id: string;
  kind: NativeSiteSectionKind;
  title: string;
  body: string;
  items: string[];
};

export const nativeSiteSectionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{2,80}$/i),
    kind: z.enum(nativeSiteSectionKinds),
    title: z.string().trim().min(2).max(180),
    body: z.string().trim().max(2_000).default(""),
    items: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  })
  .superRefine((section, context) => {
    if (
      ["outcomes", "steps", "proof", "faq"].includes(section.kind) &&
      !section.body &&
      !section.items.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This section needs supporting copy or at least one item.",
      });
    }
  });

export const nativeSiteSectionsSchema = z
  .array(nativeSiteSectionSchema)
  .max(12)
  .default([]);

export const nativeSiteSectionLabels: Record<NativeSiteSectionKind, string> = {
  outcomes: "Outcomes",
  steps: "Steps",
  proof: "Proof",
  faq: "FAQ",
  callout: "Callout",
};
