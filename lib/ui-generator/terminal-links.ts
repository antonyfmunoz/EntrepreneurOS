// lib/ui-generator/terminal-links.ts
// Prints a review block with OSC 8 clickable hyperlinks for terminals that
// support them (iTerm2, Windows Terminal, GNOME Terminal, etc.).
// Degrades to plain URLs in terminals that don't support OSC 8.

/**
 * Format a URL as an OSC 8 clickable terminal hyperlink.
 * Falls back to plain URL in terminals that don't support OSC 8
 * (the escape sequences are simply invisible in unsupported terminals).
 */
export function osc8Link(url: string, label?: string): string {
  const display = label ?? url;
  // OSC 8 format: \e]8;;URL\e\\LABEL\e]8;;\e\\
  return `\x1b]8;;${url}\x1b\\${display}\x1b]8;;\x1b\\`;
}

export interface ReviewBlockOptions {
  pageName: string;
  pageIndex: number;
  scoreSummary?: string;
  approved?: boolean;
  localUrl?: string;
  screenshotUrl?: string;
  htmlUrl?: string;
  figmaUrl?: string | null;
  localHtmlPath?: string;
}

/**
 * Print a formatted review block to stdout with clickable links.
 * Each URL is rendered as both an OSC 8 link (for supported terminals)
 * and a plain-text fallback on a separate line.
 */
export function printPageReview(options: ReviewBlockOptions): void {
  const lines: string[] = [];

  lines.push("");
  lines.push(`─── Page Review: ${options.pageName} (${options.pageIndex + 1}) ───`);

  if (options.scoreSummary) {
    lines.push(`Scores: ${options.scoreSummary}`);
  }

  lines.push(`Auto-approved: ${options.approved ?? false}`);
  lines.push("");

  if (options.localUrl) {
    lines.push(`  Local Preview: ${osc8Link(options.localUrl, "Open in Browser")}`);
    lines.push(`                 ${options.localUrl}`);
  }

  if (options.screenshotUrl) {
    lines.push(`  Screenshot:    ${osc8Link(options.screenshotUrl, "View Screenshot")}`);
    lines.push(`                 ${options.screenshotUrl}`);
  }

  if (options.htmlUrl) {
    lines.push(`  HTML Source:   ${osc8Link(options.htmlUrl, "View HTML")}`);
    lines.push(`                 ${options.htmlUrl}`);
  }

  if (options.localHtmlPath) {
    lines.push(`  Cached HTML:   ${options.localHtmlPath}`);
  }

  if (options.figmaUrl) {
    lines.push(`  Figma Export:  ${osc8Link(options.figmaUrl, "Open in Figma")}`);
    lines.push(`                 ${options.figmaUrl}`);
  }

  lines.push("");
  lines.push("  [y] Approve and continue");
  lines.push("  [f] Approve with feedback (carries forward to all remaining pages)");
  lines.push("  [n] Reject with feedback (retry once)");
  lines.push("  [s] Skip this page");
  lines.push("");

  console.log(lines.join("\n"));
}
