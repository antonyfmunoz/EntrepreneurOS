import type { ReviewScore, ApprovalGateResult } from "./types.js";
import { CONFIDENCE_THRESHOLD, allDimensionsPass } from "./types.js";

// ─── evaluateApprovalGate ────────────────────────────────────────────────────

/**
 * Decides whether a page needs user review or can be auto-approved.
 *
 * Rules (D-13, UIGEN-06, UIGEN-07):
 * 1. pageIndex 0 (first page) always escalates — sets design direction
 * 2. All four dimensions >= CONFIDENCE_THRESHOLD → auto-approve
 * 3. Any dimension below threshold → escalate with specific failed dimensions
 */
export function evaluateApprovalGate(
  pageIndex: number,
  score: ReviewScore
): ApprovalGateResult {
  // Rule 1: First page always goes to user
  if (pageIndex === 0) {
    return {
      needsUserApproval: true,
      reason: "first_page",
      scores: score,
    };
  }

  // Rule 2: All dimensions pass → auto-approve
  if (allDimensionsPass(score)) {
    return {
      needsUserApproval: false,
      reason: "auto_approved",
      scores: score,
    };
  }

  // Rule 3: Collect all failing dimensions
  const dimensionKeys = [
    "specCompliance",
    "visualConsistency",
    "structuralCompleteness",
    "contentQuality",
  ] as const satisfies (keyof ReviewScore)[];

  const failedDimensions = dimensionKeys.filter(
    (key) => score[key].score < CONFIDENCE_THRESHOLD
  );

  return {
    needsUserApproval: true,
    reason: "score_below_threshold",
    failedDimensions,
    scores: score,
  };
}

// ─── formatApprovalGateDisplay ───────────────────────────────────────────────

/**
 * Produces the full approval gate display shown to the user when escalation occurs.
 * Per D-14, D-15: shows screenshots, per-dimension scores, component checklist, action options.
 */
export function formatApprovalGateDisplay(input: {
  pageName: string;
  pageIndex: number;
  screenshotUrls: string[];
  scores: ReviewScore;
  specComponents: string[];
  foundComponents: string[];
  missingComponents: string[];
}): string {
  const {
    pageName,
    pageIndex,
    screenshotUrls,
    scores,
    specComponents,
    foundComponents,
    missingComponents,
  } = input;

  const lines: string[] = [];

  // Header
  lines.push(`=== Approval Gate: Page ${pageIndex + 1} (${pageName}) ===`);
  lines.push("");

  // Screenshots
  lines.push("Screenshots:");
  for (const url of screenshotUrls) {
    lines.push(`  ${url}`);
  }
  lines.push("");

  // Scores table
  lines.push("Self-Review Scores:");
  const dims: [keyof ReviewScore, string][] = [
    ["specCompliance", "Spec Compliance"],
    ["visualConsistency", "Visual Consistency"],
    ["structuralCompleteness", "Structural Completeness"],
    ["contentQuality", "Content Quality"],
  ];

  for (const [key, label] of dims) {
    const dim = scores[key];
    const pct = Math.round(dim.score * 100);
    const findings = dim.findings.length > 0 ? dim.findings.join("; ") : "none";
    lines.push(`  ${label}: ${pct}% | ${findings}`);
  }
  lines.push("");

  // Component checklist
  lines.push("Component Checklist:");
  for (const comp of specComponents) {
    if (foundComponents.includes(comp)) {
      lines.push(`  [x] ${comp}`);
    } else if (missingComponents.includes(comp)) {
      lines.push(`  [ ] ${comp} (MISSING)`);
    } else {
      lines.push(`  [?] ${comp}`);
    }
  }
  lines.push("");

  // Action options (D-15)
  lines.push("Actions:");
  lines.push("  1. Approve - extract tokens and continue");
  lines.push("  2. Reject + feedback - provide specific feedback for retry");
  lines.push("  3. Skip - defer this page and continue pipeline");

  return lines.join("\n");
}

// ─── formatAutoApproveNotice ─────────────────────────────────────────────────

/**
 * Returns a one-line summary for pages that passed all dimensions automatically (D-16).
 */
export function formatAutoApproveNotice(pageName: string, pageIndex: number): string {
  return `Page ${pageIndex + 1} (${pageName}) auto-approved -- all dimensions ${Math.round(CONFIDENCE_THRESHOLD * 100)}%+`;
}
