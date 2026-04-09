/**
 * UI Generator Pipeline — Login Page RETRY 1/3
 * Re-generates with user feedback appended to prompt.
 */

import { seedToTokens } from "../lib/ui-generator/design-system-seeder.js";
import { buildStitchPrompt } from "../lib/ui-generator/build-stitch-prompt.js";
import { generateScreen } from "../lib/stitch/client.js";
import { sanitizeHtmlForModel } from "../lib/ui-generator/html-sanitizer.js";
import { dualReview } from "../lib/ui-generator/self-review.js";
import { evaluateApprovalGate, formatApprovalGateDisplay } from "../lib/ui-generator/approval-gate.js";
import { MAX_HTML_FOR_REVIEW } from "../lib/ui-generator/types.js";
import type { DmTokenRow, DeviceType, DesignSystemSeed } from "../lib/ui-generator/types.js";
import type { PageSpecFull } from "../shared/spec-schema.js";
import { resolve } from "node:path";

// ─── Login Page Spec ────────────────────────────────────────────────────────

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
  layoutHint: "Centered authentication card on dark background. Logo + tagline above form. Primary action (Sign In) prominent. Google OAuth secondary. Links below form. NO header navigation. Minimal footer with just EntrepreneurOS branding centered.",
  emptyState: undefined,
  loadingState: "Disable submit button and show spinner during auth request. DEFAULT state shows 'Sign In' text with no spinner.",
  errorState: "Inline error messages below email/password fields. Errors are HIDDEN by default and only appear after validation failure. Use aria-describedby to link errors to inputs. Use aria-live='polite' for dynamic error announcements.",
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

const deviceTypes: DeviceType[] = ["DESKTOP", "MOBILE", "TABLET"];

// ─── Seed tokens from first run ─────────────────────────────────────────────

const seed: DesignSystemSeed = {
  colorPalette: {
    primary: "#8B5CF6",
    secondary: "#A78BFA",
    background: "#FFFFFF",
    surface: "#F8F9FA",
    text: "#1A1A2E",
    accent: "#7C3AED",
  },
  fontPairing: { heading: "Inter", body: "Inter" },
  spacingSystem: { unit: 4, borderRadius: 12 },
  componentDirection: "Light-mode glassmorphic aesthetic. Card with backdrop-filter: blur(16px) and semi-transparent background rgba(255,255,255,0.7). Purple primary actions (#8B5CF6). Soft shadows (0 8px 32px rgba(0,0,0,0.08)). Clean, airy spacing. Rounded corners (12px). Subtle borders rgba(0,0,0,0.05). Modern SaaS aesthetic like Linear or Vercel. Premium but approachable.",
};

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

// ─── User Feedback (Retry 1) ────────────────────────────────────────────────

const userFeedback = `User feedback (retry 3 — FINAL, refining retry 2):
KEEP EVERYTHING FROM RETRY 2: Light mode, purple brand (#8B5CF6), white background, glassmorphic card, all 8 components present. That design direction was correct.

TWO SPECIFIC CHANGES:

1. ICON: Use a ROBOT or AI-themed icon for the brand logo, NOT a rocket. EntrepreneurOS is an AI operating system — the icon should communicate AI/automation/intelligence. Use a smart_toy, robot, or psychology Material Symbol, or an SVG robot head icon. NOT a rocket.

2. GOOGLE BUTTON: The "Continue with Google" button should use a MONOCHROME BLACK Google "G" logo on a clean white/transparent background. Do NOT use the colored Google logo (red/blue/yellow/green). Do NOT put a dark background square behind the Google icon. The Google button should be clean, minimal, matching the premium aesthetic — just a simple outlined button with a black "G" and text.

Everything else stays the same:
- Purple "Sign In" button (default state, not loading)
- Email + Password inputs with labels
- "Create account" and "Forgot password?" links
- Minimal footer: "© EntrepreneurOS"
- No header navigation
- Glassmorphic card styling
- Error messages hidden by default
- Accessibility attributes (aria-describedby, aria-live, aria-label)`;

// ─── Pipeline ───────────────────────────────────────────────────────────────

async function run() {
  console.log("=== UI Generator Pipeline: Login Page — RETRY 3/3 (FINAL) ===\n");

  // Build prompt with feedback appended
  const designSystemPath = resolve(process.cwd(), ".planning/design-system.md");
  const basePrompt = buildStitchPrompt(
    loginPageSpec,
    currentTokens,
    undefined,
    seed.componentDirection,
    undefined, // componentReferences
    undefined, // enrichment
    designSystemPath,
  );

  const prompt = basePrompt + "\n\n" + userFeedback;
  console.log(`Prompt built: ${prompt.length} chars (base ${basePrompt.length} + feedback ${userFeedback.length})\n`);

  // ─── Call Stitch API ──────────────────────────────────────────────────────
  console.log("Calling Stitch API...");

  const generationResults: Array<{
    htmlUrl: string;
    screenshotUrl: string;
    htmlContent: string;
    deviceType: DeviceType;
  }> = [];

  for (const deviceType of deviceTypes) {
    console.log(`  Generating ${deviceType}...`);
    try {
      const result = await generateScreen(process.env.STITCH_PROJECT_ID!, {
        prompt,
        deviceType,
      });

      const htmlContent = await fetch(result.htmlUrl).then((r) => r.text());
      generationResults.push({ htmlUrl: result.htmlUrl, screenshotUrl: result.screenshotUrl, htmlContent, deviceType });
      console.log(`  ${deviceType} complete: ${htmlContent.length} chars HTML`);
    } catch (err: any) {
      console.error(`  ${deviceType} FAILED: ${err.message}`);
    }
  }

  if (generationResults.length === 0) {
    console.error("\nAll generations failed.");
    process.exit(1);
  }

  const desktopResult = generationResults.find((r) => r.deviceType === "DESKTOP") ?? generationResults[0];
  const screenshotUrls = generationResults.map((r) => r.screenshotUrl);
  console.log(`\nGenerated ${generationResults.length}/${deviceTypes.length} device types\n`);

  // ─── Dual Review ──────────────────────────────────────────────────────────
  console.log("Running dual review...");

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

  // ─── Approval Gate ────────────────────────────────────────────────────────
  const reviewScore = dualScore.combined;
  const gateResult = evaluateApprovalGate(0, reviewScore);

  const specComponents = loginPageSpec.components;
  const foundComponents = specComponents.filter((c) =>
    desktopResult.htmlContent.toLowerCase().includes(c.toLowerCase())
  );
  const missingComponents = specComponents.filter((c) => !foundComponents.includes(c));

  console.log(formatApprovalGateDisplay({
    pageName: loginPageSpec.name,
    pageIndex: 0,
    screenshotUrls,
    scores: reviewScore,
    specComponents,
    foundComponents,
    missingComponents,
  }));

  // Save HTML files
  const fs = await import("fs");
  const outputDir = "scripts/ui-gen-output";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const result of generationResults) {
    const filename = `${outputDir}/login-${result.deviceType.toLowerCase()}-retry3.html`;
    fs.writeFileSync(filename, result.htmlContent);
    console.log(`\nSaved: ${filename}`);
  }

  console.log("\n--- SCREENSHOT URLS ---");
  for (const url of screenshotUrls) {
    console.log(url);
  }
}

run().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
