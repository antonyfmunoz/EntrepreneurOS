import type { PageSpecFull } from "@shared/spec-schema.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Pages at or below this count are never chunked (D-24).
 */
const CHUNK_THRESHOLD = 25;

/**
 * Hard cap: no single chunk may exceed this many pages (AI context budget).
 */
const MAX_CHUNK_SIZE = 20;

/**
 * Domain classification patterns.
 * Pages are matched against each domain in order — first match wins.
 * "core-features" is the catch-all domain.
 */
const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  "auth-onboarding": [/\/(auth|login|signup|register|verify|forgot|reset)/i],
  "admin-settings": [/\/(admin|settings|preferences|config|profile)/i],
  "core-features": [/./], // catch-all for everything else
};

// ─── Domain Classification ────────────────────────────────────────────────────

/**
 * Classifies a page route into a named domain.
 * Returns the first domain whose patterns match the route.
 */
function classifyPageDomain(route: string): string {
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(route))) {
      return domain;
    }
  }
  return "core-features";
}

// ─── chunkSpecByDomain ────────────────────────────────────────────────────────

/**
 * Splits a large page spec array into domain-based chunks for sequential AI processing.
 *
 * D-24: If pages.length <= 25, returns [pages] (no chunking).
 * D-25: For 26+ pages, groups pages by domain and splits each group to stay
 *       under the MAX_CHUNK_SIZE hard cap (20 pages per chunk).
 *
 * Domain grouping ensures related pages (auth, admin, core features) stay together
 * for better AI context when processing each chunk.
 *
 * @param pages - Full array of parsed page specs
 * @param chunkSize - Target max pages per chunk (default 15, hard cap 20)
 * @returns Array of page chunks — each is a PageSpecFull[]
 */
export function chunkSpecByDomain(
  pages: PageSpecFull[],
  chunkSize: number = 15
): PageSpecFull[][] {
  // D-24: No chunking for specs at or below threshold
  if (pages.length <= CHUNK_THRESHOLD) {
    return [pages];
  }

  // Enforce hard cap
  const effectiveChunkSize = Math.min(chunkSize, MAX_CHUNK_SIZE);

  // Group pages by domain
  const domainGroups = new Map<string, PageSpecFull[]>();
  for (const domain of Object.keys(DOMAIN_PATTERNS)) {
    domainGroups.set(domain, []);
  }

  for (const page of pages) {
    const domain = classifyPageDomain(page.route);
    const group = domainGroups.get(domain) ?? [];
    group.push(page);
    domainGroups.set(domain, group);
  }

  // Split each domain group into chunks respecting effectiveChunkSize
  const chunks: PageSpecFull[][] = [];
  for (const group of domainGroups.values()) {
    if (group.length === 0) continue;

    if (group.length <= effectiveChunkSize) {
      chunks.push(group);
    } else {
      // Split large domain group into sub-chunks by priority order
      const sorted = [...group].sort((a, b) => a.priority - b.priority);
      for (let i = 0; i < sorted.length; i += effectiveChunkSize) {
        chunks.push(sorted.slice(i, i + effectiveChunkSize));
      }
    }
  }

  // Edge case: if all pages ended up in a single chunk larger than MAX_CHUNK_SIZE,
  // force-split it (shouldn't happen with proper domain classification, but safety net)
  const safeguardedChunks: PageSpecFull[][] = [];
  for (const chunk of chunks) {
    if (chunk.length > MAX_CHUNK_SIZE) {
      for (let i = 0; i < chunk.length; i += MAX_CHUNK_SIZE) {
        safeguardedChunks.push(chunk.slice(i, i + MAX_CHUNK_SIZE));
      }
    } else {
      safeguardedChunks.push(chunk);
    }
  }

  return safeguardedChunks;
}

// ─── chunkRawText ─────────────────────────────────────────────────────────────

/**
 * Pre-chunks raw text input at markdown heading boundaries before any AI call.
 *
 * Addresses the HIGH review concern: oversized raw input fails before chunking
 * helps. By splitting at heading boundaries first, we ensure the AI never
 * receives an input too large to process in a single pass.
 *
 * Split strategy:
 * 1. If text <= maxChunkSize, return [text] (no chunking needed)
 * 2. Split at heading boundaries (lines starting with # or ##)
 * 3. Group consecutive sections until adding another would exceed maxChunkSize
 * 4. If a single section exceeds maxChunkSize, split at paragraph boundaries
 *
 * @param rawText - Raw spec text in any markdown format
 * @param maxChunkSize - Maximum characters per chunk (default 15000)
 * @returns Array of text chunks, each under maxChunkSize
 */
export function chunkRawText(
  rawText: string,
  maxChunkSize: number = 15000
): string[] {
  // No chunking needed
  if (rawText.length <= maxChunkSize) {
    return [rawText];
  }

  // Split into sections at heading boundaries
  // We detect lines that start with # or ## (with optional leading whitespace)
  const lines = rawText.split("\n");
  const sections: string[] = [];
  let currentSection = "";

  for (const line of lines) {
    const isHeading = /^#{1,2}\s/.test(line);

    if (isHeading && currentSection.length > 0) {
      // Save current section and start a new one at this heading
      sections.push(currentSection);
      currentSection = line + "\n";
    } else {
      currentSection += line + "\n";
    }
  }

  // Push the last section
  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  // Group sections into chunks
  const chunks: string[] = [];
  let currentChunk = "";

  for (const section of sections) {
    if (section.length > maxChunkSize) {
      // Single section too large — split at paragraph boundaries
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      const paragraphChunks = splitAtParagraphs(section, maxChunkSize);
      chunks.push(...paragraphChunks);
    } else if (currentChunk.length + section.length > maxChunkSize) {
      // Adding this section would exceed the limit — flush current chunk
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = section;
    } else {
      currentChunk += section;
    }
  }

  // Flush the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Fallback: splits a single large section at paragraph boundaries (double newlines).
 * Used when a markdown section itself exceeds maxChunkSize.
 */
function splitAtParagraphs(text: string, maxChunkSize: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const separator = currentChunk.length > 0 ? "\n\n" : "";
    if (currentChunk.length + separator.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk += separator + paragraph;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
