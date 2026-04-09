/**
 * UI Generator Pipeline — Post-Approval (Steps 4a-4i)
 * Extracts tokens from approved retry 2 HTML, persists to Neon PostgreSQL.
 */

import { extractTokensFromHtml } from "../lib/ui-generator/extract-tokens.js";
import { detectPatternConflicts } from "../lib/ui-generator/conflict-detector.js";
import { sanitizeHtmlForModel } from "../lib/ui-generator/html-sanitizer.js";
import { MAX_HTML_FOR_EXTRACTION } from "../lib/ui-generator/types.js";
import type { DmTokenRow } from "../lib/ui-generator/types.js";
import { db } from "../server/db.js";
import { dmTokens, dmPages, dmPatterns, pipelineRuns, pipelinePages } from "../shared/design-schema.js";
import { eq, and } from "drizzle-orm";
import fs from "fs";

// ─── Configuration ──────────────────────────────────────────────────────────

const PROJECT_ID = "entrepreneur-os";
const PAGE_NAME = "Login";
const PAGE_SLUG = "/login";
const PAGE_PURPOSE = "Premium authentication entry point for EntrepreneurOS";
const SCREENSHOT_URL = "https://lh3.googleusercontent.com/aida/ADBb0ujyw81bq2sjLIaPSSSSh9n0W9nuI2D-UcSwBEtwjkBRlBITz5VoKt_jfYCFMf8Z4glxdsWsvQYCLdRgfPf8gO2ftpOHR3NCvHDADXdAxzyyHVd2g_5REg5BN30gQIWXrXNjTwYWc7bDRmBb3vpJ7dEScUWdnWMiSV99df4Vgtkxv5r5dIWJkWL-DSq13KGz6haL9xw118TwrnZF_DRWbQ2Qk5DlRPgbF2PM9qFmF05_9RmG4hrsVfZD7OAG";

// Seed tokens from the pipeline (prior to extraction)
const priorTokens: Partial<DmTokenRow> = {
  colorPrimary: "#8B5CF6",
  colorSecondary: "#A78BFA",
  colorBackground: "#FFFFFF",
  colorSurface: "#F8F9FA",
  colorText: "#1A1A2E",
  colorAccent: "#7C3AED",
  typeFontFamily: "Inter",
  spacingUnit: "4",
  borderRadius: "12",
};

async function run() {
  console.log("=== Post-Approval Pipeline: Login Page ===\n");

  // ─── Step 4a: Extract Tokens ────────────────────────────────────────────
  console.log("Step 4a — Extracting design tokens from approved HTML...");

  const htmlPath = "scripts/ui-gen-output/login-desktop-retry2.html";
  if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  const rawHtml = fs.readFileSync(htmlPath, "utf-8");
  const sanitizedHtml = sanitizeHtmlForModel(rawHtml, MAX_HTML_FOR_EXTRACTION);

  const extractionResult = await extractTokensFromHtml({
    htmlContent: sanitizedHtml,
    projectId: PROJECT_ID,
    priorTokens,
  });

  // ─── Display extracted tokens (Step 4d gate) ──────────────────────────
  console.log("\nExtracted Design Tokens for: Login (/login)\n");
  console.log("Token             | Extracted Value      | Prior Value");
  console.log("------------------+----------------------+----------------------");

  const tokenFields = [
    "colorPrimary", "colorSecondary", "colorBackground", "colorSurface",
    "colorText", "colorAccent", "typeFontFamily", "typeSizeBase",
    "typeScaleRatio", "spacingUnit", "borderRadius", "shadowStyle",
  ];

  for (const field of tokenFields) {
    const extracted = extractionResult.tokens[field] ?? "(null)";
    const prior = (priorTokens as any)[field] ?? "(null)";
    const status = extracted === prior ? "(same)" : extracted === "(null)" ? "(null)" : "(new)";
    console.log(`  ${field.padEnd(18)}| ${String(extracted).padEnd(21)}| ${status === "(same)" ? "(same)" : prior}`);
  }

  console.log("\nExtracted Component Patterns:");
  for (const pattern of extractionResult.patterns) {
    const shadcn = pattern.shadcnComponent ? ` [shadcn: ${pattern.shadcnComponent}]` : "";
    console.log(`  - ${pattern.name}${pattern.variant ? ` (variant: ${pattern.variant})` : ""} — ${pattern.usageContext ?? "general"}${shadcn}`);
  }

  // ─── Step 4b: Detect Pattern Conflicts ──────────────────────────────────
  console.log("\nStep 4b — Checking pattern conflicts...");
  const conflictResult = detectPatternConflicts([], extractionResult.patterns);
  if (conflictResult.hasConflicts) {
    console.log("  Conflicts detected:");
    for (const c of conflictResult.conflicts) {
      console.log(`    ${c.patternName}: ${c.recommendation}`);
    }
  } else {
    console.log("  No conflicts (first page — no prior patterns).");
  }

  // ─── Step 4e-4i: Persist to Database ──────────────────────────────────
  console.log("\nStep 4e — Persisting tokens to database...");

  try {
    // Insert token row (version 1 — first page)
    const tokenRow = {
      projectId: PROJECT_ID,
      version: 1,
      colorPrimary: String(extractionResult.tokens.colorPrimary ?? null),
      colorSecondary: String(extractionResult.tokens.colorSecondary ?? null),
      colorBackground: String(extractionResult.tokens.colorBackground ?? null),
      colorSurface: String(extractionResult.tokens.colorSurface ?? null),
      colorText: String(extractionResult.tokens.colorText ?? null),
      colorAccent: String(extractionResult.tokens.colorAccent ?? null),
      typeFontFamily: String(extractionResult.tokens.typeFontFamily ?? null),
      typeSizeBase: extractionResult.tokens.typeSizeBase != null ? String(extractionResult.tokens.typeSizeBase) : null,
      typeScaleRatio: extractionResult.tokens.typeScaleRatio != null ? String(extractionResult.tokens.typeScaleRatio) : null,
      spacingUnit: extractionResult.tokens.spacingUnit != null ? String(extractionResult.tokens.spacingUnit) : null,
      borderRadius: extractionResult.tokens.borderRadius != null ? String(extractionResult.tokens.borderRadius) : null,
      shadowStyle: extractionResult.tokens.shadowStyle != null ? String(extractionResult.tokens.shadowStyle) : null,
    };

    await db.insert(dmTokens).values(tokenRow);
    console.log("  Tokens persisted (version 1)");

    // Step 4f: Persist patterns
    console.log("\nStep 4f — Persisting patterns...");
    for (const pattern of extractionResult.patterns) {
      await db.insert(dmPatterns).values({
        projectId: PROJECT_ID,
        name: pattern.name,
        variant: pattern.variant ?? null,
        propsShape: pattern.propsShape ?? null,
        usageContext: pattern.usageContext ?? null,
        shadcnComponent: pattern.shadcnComponent ?? null,
        pageSlugRef: PAGE_SLUG,
      });
    }
    console.log(`  ${extractionResult.patterns.length} patterns persisted`);

    // Step 4g: Persist page record
    console.log("\nStep 4g — Persisting page record...");
    await db.insert(dmPages).values({
      projectId: PROJECT_ID,
      pageName: PAGE_NAME,
      pageSlug: PAGE_SLUG,
      purpose: PAGE_PURPOSE,
      approvedAt: new Date(),
      tokenVersionRef: 1,
      screenshotUrl: SCREENSHOT_URL,
    });
    console.log("  Page record persisted");

    console.log("\n=== UI Generation Complete ===");
    console.log(`  Pages approved:  1`);
    console.log(`  Pages skipped:   0`);
    console.log(`  Pages failed:    0`);
    console.log(`  Final token version: 1`);
    console.log(`  Patterns extracted: ${extractionResult.patterns.length}`);
    console.log(`\n  Design tokens and patterns stored in Neon PostgreSQL.`);

  } catch (err: any) {
    console.error("\nDatabase error:", err.message);
    console.error("Design memory may be incomplete for this page.");
    // Output the extracted data as JSON for manual recovery
    console.log("\n--- EXTRACTED DATA (for manual recovery) ---");
    console.log(JSON.stringify({ tokens: extractionResult.tokens, patterns: extractionResult.patterns }, null, 2));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Post-approval pipeline failed:", err);
  process.exit(1);
});
