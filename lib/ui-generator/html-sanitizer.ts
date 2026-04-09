import { MAX_HTML_FOR_EXTRACTION } from "./types.js";

/**
 * Sanitizes Stitch-generated HTML before sending to Claude or Gemini for
 * extraction or review. Removes script tags, event handlers, and potential
 * prompt-injection content embedded in HTML comments or data attributes.
 *
 * This is a security boundary — all HTML must pass through this function
 * before being included in any LLM prompt.
 *
 * Addresses review concern: "raw HTML from generated pages can contain
 * prompt-injection content" (Codex HIGH, Gemini MEDIUM).
 */
export function sanitizeHtmlForModel(
  html: string,
  maxChars: number = MAX_HTML_FOR_EXTRACTION
): string {
  let sanitized = html;

  // 1. Remove all <script> tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 2. Remove event handler attributes (onclick, onerror, onload, onmouseover, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 3. Remove HTML comments containing prompt-injection markers
  // Patterns: "SYSTEM:", "IGNORE PREVIOUS", "You are", "ASSISTANT:", "Human:"
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, (match) => {
    const upper = match.toUpperCase();
    if (
      upper.includes("SYSTEM:") ||
      upper.includes("IGNORE PREVIOUS") ||
      upper.includes("YOU ARE") ||
      upper.includes("ASSISTANT:") ||
      upper.includes("HUMAN:")
    ) {
      return "";
    }
    return match; // preserve normal HTML comments
  });

  // 4. Remove data-* attributes that contain suspicious prompt-like content (over 200 chars)
  sanitized = sanitized.replace(/\s+data-[\w-]+\s*=\s*"[^"]{200,}"/gi, "");

  // 5. Truncate to maxChars
  if (sanitized.length > maxChars) {
    sanitized = sanitized.slice(0, maxChars);
  }

  return sanitized;
}
