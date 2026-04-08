/**
 * UI Generator Pipeline Runner — Login Page
 * Executes Steps 0.5 through 2c of the saas-dev:ui-generator skill.
 *
 * Usage: npx tsx scripts/run-ui-gen-login.ts
 */

import { seedToTokens } from "../lib/ui-generator/design-system-seeder.js";
import { buildStitchPrompt } from "../lib/ui-generator/build-stitch-prompt.js";
import { generateScreen } from "../lib/stitch/client.js";
import { sanitizeHtmlForModel } from "../lib/ui-generator/html-sanitizer.js";
import { dualReview } from "../lib/ui-generator/self-review.js";
import { evaluateApprovalGate, formatApprovalGateDisplay } from "../lib/ui-generator/approval-gate.js";
import { discoverComponents, formatDiscoveryForPrompt } from "../lib/ui-generator/component-discovery.js";
import { enrichOnce, extractIndustry } from "../lib/ui-generator/skill-enrichment.js";
import { validateDesignSystem } from "../lib/ui-generator/validate-design-system.js";
import { generateReferenceMockup } from "../lib/ui-generator/gemini-mockup.js";
import { MAX_HTML_FOR_REVIEW, MAX_HTML_FOR_EXTRACTION } from "../lib/ui-generator/types.js";
import type { DmTokenRow, DeviceType } from "../lib/ui-generator/types.js";
import type { PageSpecFull } from "../shared/spec-schema.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";

// ─── Login Page Spec (from .planning/specs/login-page-spec.md) ──────────────

const loginPageSpec: PageSpecFull = {
  name: "Login",
  route: "/login",
  purpose: "Premium authentication entry point for EntrepreneurOS — the AI-native business operating system for founders.",
  components: [
    "Logo / Product name",
    "Tagline text",
    "Email input",
    "Password input",
    "Sign In button",
    "Continue with Google button",
    "Create account link",
    "Forgot password link",
  ],
  authLevel: "public",
  priority: 1,
  dependsOn: [],
  specVersion: 1,
  source: "explicit",
  layoutHint: "Centered authentication card on dark background. Logo + tagline above form. Primary action (Sign In) prominent. Google OAuth secondary. Links below form.",
  emptyState: undefined,
  loadingState: "Disable submit button and show spinner during auth request",
  errorState: "Inline error messages below email/password fields. Toast for server errors.",
  mobileConsiderations: "Full-width card on mobile, reduce padding. Stack form elements vertically.",
  dataRequirements: [
    { component: "Email input", fields: ["email"], source: "user input" },
    { component: "Password input", fields: ["password"], source: "user input" },
  ],
  apiEndpoints: [
    { endpoint: "POST /api/auth/login", source: "explicit" },
    { endpoint: "GET /api/auth/google", source: "explicit" },
  ],
  validationRules: [
    "Email must be valid format",
    "Password minimum 8 characters",
  ],
  events: [
    { name: "login_attempted", trigger: "Form submit", properties: ["method"], source: "inferred" },
    { name: "login_succeeded", trigger: "Auth success", properties: ["method"], source: "inferred" },
    { name: "login_failed", trigger: "Auth error", properties: ["method", "error_type"], source: "inferred" },
  ],
  featureFlagCandidates: [],
};

// ─── Device types ───────────────────────────────────────────────────────────

const deviceTypes: DeviceType[] = ["DESKTOP", "MOBILE", "TABLET"];

// ─── Pipeline ───────────────────────────────────────────────────────────────

async function run() {
  console.log("=== UI Generator Pipeline: Login Page ===\n");

  // ─── Step 0.5: Design System Seeding (LOCKED to Ethereal Professional) ────
  console.log("Step 0.5 — Loading locked Ethereal Professional design system...");

  const seed = {
    colorPalette: {
      primary: "#6a37d4",
      secondary: "#6448b2",
      background: "#ffffff",
      surface: "#f5f6f7",
      text: "#2c2f30",
      accent: "#ae8dff",
    },
    fontPairing: { heading: "Inter", body: "Inter" },
    spacingSystem: { unit: 4, borderRadius: 12 },
    componentDirection:
      "The Lucid Architect: Airy, illuminated, intentional. Editorial feel with optical weight over structural lines. Glassmorphic overlays (rgba(255,255,255,0.7) + 16px blur) suggest depth and fluidity. NO 1px solid borders — use background shifts. Primary buttons: gradient #6a37d4 → #ae8dff at 135deg. Primary-tinted shadows rgba(106,55,212,0.08). Icon: smart_toy (robot), never rocket.",
  };

  console.log(`  Colors: ${seed.colorPalette.primary} (primary), ${seed.colorPalette.secondary} (secondary), ${seed.colorPalette.accent} (accent)`);
  console.log(`  Background: ${seed.colorPalette.background}, Surface: ${seed.colorPalette.surface}, Text: ${seed.colorPalette.text}`);
  console.log(`  Fonts: ${seed.fontPairing.heading} / ${seed.fontPairing.body}`);
  console.log(`  Spacing: ${seed.spacingSystem.unit}px unit, ${seed.spacingSystem.borderRadius}px radius`);
  console.log(`  Direction: ${seed.componentDirection}`);
  console.log();

  const seedTokens = seedToTokens(seed);
  const currentTokens = {
    ...seedTokens,
    projectId: "entrepreneur-os",
    version: 0,
    id: 0,
    createdAt: new Date(),
    typeScaleRatio: null,
    shadowStyle: null,
    typeSizeBase: null,
  } as DmTokenRow;

  // ─── Step 1: Page Order ───────────────────────────────────────────────────
  console.log("Processing pages in order:");
  console.log(`  1. Login (/login) — priority 1\n`);

  // ─── Step 1.5: Skill Enrichment (frontend-design + ui-ux-pro-max) ─────────
  console.log("Step 1.5 — Querying design skills for production-grade guidance...");
  const enrichment = await enrichOnce({
    productType: "saas-application",
    components: loginPageSpec.components,
    complexity: loginPageSpec.components.length > 5 ? "high" : "medium",
    targetAudience: "Founders and entrepreneurs — technical, sophisticated users",
    vibe: seed.componentDirection,
    industry: extractIndustry("AI-native business operating system for founders SaaS"),
  });
  if (enrichment.designGuidance) {
    console.log(`  ✓ Frontend design guidance received (${enrichment.designGuidance.length} chars)`);
  } else {
    console.log("  ⚠ Frontend design guidance unavailable (fail-open)");
  }
  if (enrichment.uxGuidance.palette) {
    console.log(`  ✓ Palette: ${enrichment.uxGuidance.palette}`);
  }
  if (enrichment.uxGuidance.fonts) {
    console.log(`  ✓ Fonts: ${enrichment.uxGuidance.fonts}`);
  }
  console.log();

  // ─── Step 2a: Component Discovery ─────────────────────────────────────────
  console.log("Step 2a — Component discovery + prompt building...");

  const discoveryResult = await discoverComponents(loginPageSpec.components);
  const componentReferences = formatDiscoveryForPrompt(discoveryResult);

  if (discoveryResult.queriedComponents.length > 0) {
    console.log(`  Component discovery: queried ${discoveryResult.queriedComponents.join(", ")}`);
    console.log(`  Found ${discoveryResult.references.length} references from registries`);
  } else {
    console.log(`  No complex components — all standard (skipped: ${discoveryResult.skippedComponents.join(", ")})`);
  }

  // ─── Step 2a: Build Stitch Prompt ─────────────────────────────────────────
  const prompt = buildStitchPrompt(
    loginPageSpec,
    currentTokens,
    undefined,  // no prior screenshot (first page)
    seed.componentDirection,
    componentReferences,
    enrichment,
  );

  console.log(`  Prompt built: ${prompt.length} chars`);
  console.log();

  // ─── Step 2a.5: Generate Reference Mockup ─────────────────────────────────
  console.log("Step 2a.5 — Generating reference mockup via Gemini...");
  const mockupResult = await generateReferenceMockup({
    spec: loginPageSpec,
    tokens: currentTokens,
    deviceType: deviceTypes[0],
  });
  if (mockupResult) {
    console.log(`  Reference mockup generated (${mockupResult.mimeType}, ${Math.round(mockupResult.imageBase64.length / 1024)}KB base64)`);
  } else {
    console.log(`  Reference mockup skipped (Gemini unavailable or failed)`);
  }
  console.log();

  // ─── Step 2b: Call Stitch API ─────────────────────────────────────────────
  console.log("Step 2b — Calling Stitch API...");

  // Check for stitchProjectId — need a project in Stitch
  const stitchProjectId = process.env.STITCH_PROJECT_ID;
  if (!stitchProjectId) {
    console.error("ERROR: STITCH_PROJECT_ID not set in .env");
    console.error("Create a project at stitch.withgoogle.com and add STITCH_PROJECT_ID=<id> to .env");
    process.exit(1);
  }

  const generationResults: Array<{
    htmlUrl: string;
    screenshotUrl: string;
    htmlContent: string;
    deviceType: DeviceType;
  }> = [];

  for (const deviceType of deviceTypes) {
    console.log(`  Generating ${deviceType}...`);
    try {
      const result = await generateScreen(stitchProjectId, {
        prompt,
        deviceType,
      });

      // CRITICAL — Pitfall 1: Stitch returns presigned URL, NOT raw HTML
      const htmlContent = await fetch(result.htmlUrl).then((r) => r.text());

      generationResults.push({
        htmlUrl: result.htmlUrl,
        screenshotUrl: result.screenshotUrl,
        htmlContent,
        deviceType,
      });

      console.log(`  ${deviceType} complete: ${htmlContent.length} chars HTML`);
    } catch (err: any) {
      console.error(`  ${deviceType} FAILED: ${err.message}`);
      if (err.code === "ENV_MISSING") {
        process.exit(1);
      }
      // Continue with remaining device types
    }
  }

  if (generationResults.length === 0) {
    console.error("\nAll device type generations failed. Aborting.");
    process.exit(1);
  }

  const desktopResult = generationResults.find((r) => r.deviceType === "DESKTOP")
    ?? generationResults[0];
  const screenshotUrls = generationResults.map((r) => r.screenshotUrl);

  console.log(`\n  Generated ${generationResults.length}/${deviceTypes.length} device types`);
  console.log();

  // ─── Step 2b.5: Design System Validation ──────────────────────────────────
  console.log("Step 2b.5 — Validating design system compliance (desktop)...");
  const validation = validateDesignSystem(desktopResult.htmlContent);
  console.log(`  Colors found (${validation.colorsFound.length}): ${validation.colorsFound.slice(0, 12).join(", ")}${validation.colorsFound.length > 12 ? ", ..." : ""}`);
  if (validation.errors.length > 0) {
    console.error("  ❌ DESIGN SYSTEM VALIDATION FAILED:");
    for (const err of validation.errors) console.error(`    - ${err}`);
  }
  if (validation.warnings.length > 0) {
    console.warn("  ⚠ Warnings:");
    for (const warn of validation.warnings) console.warn(`    - ${warn}`);
  }
  if (validation.valid && validation.warnings.length === 0) {
    console.log("  ✓ Design system validation passed");
  }
  console.log();

  // ─── Step 2c: Dual Review ─────────────────────────────────────────────────
  console.log("Step 2c — Running dual review (Claude + Gemini)...");

  const sanitizedHtml = sanitizeHtmlForModel(desktopResult.htmlContent, MAX_HTML_FOR_REVIEW);

  const dualScore = await dualReview({
    htmlContent: sanitizedHtml,
    screenshotUrls,
    spec: loginPageSpec,
    tokens: currentTokens,
    priorPatterns: [],
  });

  console.log(`  Review: ${dualScore.reviewerCount} reviewer(s)`);
  console.log(`  Claude: spec=${dualScore.claude.specCompliance.score.toFixed(2)}, visual=${dualScore.claude.visualConsistency.score.toFixed(2)}, structural=${dualScore.claude.structuralCompleteness.score.toFixed(2)}, content=${dualScore.claude.contentQuality.score.toFixed(2)}`);
  if (dualScore.gemini) {
    console.log(`  Gemini: spec=${dualScore.gemini.specCompliance.score.toFixed(2)}, visual=${dualScore.gemini.visualConsistency.score.toFixed(2)}, structural=${dualScore.gemini.structuralCompleteness.score.toFixed(2)}, content=${dualScore.gemini.contentQuality.score.toFixed(2)}`);
  }
  console.log(`  Combined: spec=${dualScore.combined.specCompliance.score.toFixed(2)}, visual=${dualScore.combined.visualConsistency.score.toFixed(2)}, structural=${dualScore.combined.structuralCompleteness.score.toFixed(2)}, content=${dualScore.combined.contentQuality.score.toFixed(2)}`);
  console.log();

  // ─── Step 2d: Approval Gate ───────────────────────────────────────────────
  const reviewScore = dualScore.combined;
  const gateResult = evaluateApprovalGate(0, reviewScore); // pageIndex 0 = first page

  // Derive component checklist
  const specComponents = loginPageSpec.components;
  const foundComponents = specComponents.filter((c) =>
    desktopResult.htmlContent.toLowerCase().includes(c.toLowerCase())
  );
  const missingComponents = specComponents.filter(
    (c) => !foundComponents.includes(c)
  );

  console.log(formatApprovalGateDisplay({
    pageName: loginPageSpec.name,
    pageIndex: 0,
    screenshotUrls,
    scores: reviewScore,
    specComponents,
    foundComponents,
    missingComponents,
  }));

  // ─── Output for next steps ────────────────────────────────────────────────
  console.log("\n--- PIPELINE OUTPUT ---");
  console.log(JSON.stringify({
    gateResult,
    screenshotUrls,
    htmlUrl: desktopResult.htmlUrl,
    htmlLength: desktopResult.htmlContent.length,
    deviceTypesGenerated: generationResults.map((r) => r.deviceType),
    seedTokens: {
      colorPrimary: currentTokens.colorPrimary,
      colorSecondary: currentTokens.colorSecondary,
      colorBackground: currentTokens.colorBackground,
      colorSurface: currentTokens.colorSurface,
      colorText: currentTokens.colorText,
      colorAccent: currentTokens.colorAccent,
      typeFontFamily: currentTokens.typeFontFamily,
      borderRadius: currentTokens.borderRadius,
      spacingUnit: currentTokens.spacingUnit,
    },
    prompt: prompt.slice(0, 500) + "...",
  }, null, 2));

  // Save HTML to file for local review
  const fs = await import("fs");
  const outputDir = "scripts/ui-gen-output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const result of generationResults) {
    const filename = `${outputDir}/login-${result.deviceType.toLowerCase()}.html`;
    fs.writeFileSync(filename, result.htmlContent);
    console.log(`\nSaved: ${filename}`);
  }

  // ─── Preview: clickable links + local server + auto-open ──────────────────
  const line = "═".repeat(78);
  console.log("\n" + line);
  console.log("📸 PREVIEW LINKS — click to open:");
  console.log(line);
  for (const r of generationResults) {
    console.log(`  ${r.deviceType.padEnd(8)} screenshot: ${r.screenshotUrl}`);
  }
  console.log("  ── HTML source ──");
  for (const r of generationResults) {
    console.log(`  ${r.deviceType.padEnd(8)} html:       ${r.htmlUrl}`);
  }
  console.log(line);

  const PORT = Number(process.env.PREVIEW_PORT ?? 8765);
  const server = createServer(async (req, res) => {
    try {
      const reqUrl = (req.url ?? "/").split("?")[0];
      const fileName = reqUrl === "/" ? "/login-desktop.html" : reqUrl;
      const filePath = join(process.cwd(), "scripts/ui-gen-output", fileName);
      const content = await readFile(filePath);
      const contentType = fileName.endsWith(".html")
        ? "text/html; charset=utf-8"
        : "text/plain; charset=utf-8";
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found: ${req.url}`);
    }
  });

  await new Promise<void>((resolveServer) => {
    server.listen(PORT, () => {
      console.log(`\n🌐 Local preview server: http://localhost:${PORT}`);
      for (const r of generationResults) {
        console.log(`   http://localhost:${PORT}/login-${r.deviceType.toLowerCase()}.html`);
      }
      console.log("\n   Press Ctrl+C when done previewing to continue to the approval gate.\n");

      if (process.env.AUTO_OPEN !== "false") {
        const url = `http://localhost:${PORT}/login-desktop.html`;
        const cmd =
          process.platform === "win32"
            ? `start "" "${url}"`
            : process.platform === "darwin"
              ? `open "${url}"`
              : `xdg-open "${url}"`;
        exec(cmd, (err) => {
          if (err) console.warn("   (auto-open skipped)");
        });
      }
    });

    const stop = () => {
      console.log("\n✓ Preview server stopped");
      server.close();
      resolveServer();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  console.log("\nContinuing to approval gate...\n");
}

run().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
