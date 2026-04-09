import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentDiscoveryResult, ComponentReference } from "./types.js";

// Max chars per individual code snippet -- prevents one component from dominating prompt
const MAX_SNIPPET_CHARS = 500;

// Default TTL when cache file omits it
const DEFAULT_TTL_HOURS = 24;

// Cache path — written by the saas-dev:warm-cache skill inside a Claude Code
// session (where MCPs are live), read here by headless orchestrator/scripts.
const CACHE_PATH = resolve(process.cwd(), "lib/ui-generator/component-cache.json");

interface CachedComponent {
  name: string;
  description: string;
  registry: string;
  code_snippet?: string;
}

interface ComponentCacheFile {
  generated_at: string;
  ttl_hours: number;
  project_id: string;
  spec_hash: string;
  source: string;
  components: CachedComponent[];
}

export interface CacheFreshnessResult {
  fresh: boolean;
  reason?: string;
}

// ─── Spec Hash ──────────────────────────────────────────────────────────────

/**
 * Compute a deterministic hash from component names so we can detect when the
 * spec has changed since the cache was built.
 */
export function computeSpecHash(componentNames: string[]): string {
  const normalized = Array.from(new Set(componentNames.map((n) => n.toLowerCase()))).sort();
  return createHash("sha256").update(normalized.join("\n")).digest("hex");
}

// ─── Cache Freshness ────────────────────────────────────────────────────────

let cachedFile: ComponentCacheFile | null | undefined;

function loadCacheFile(): ComponentCacheFile | null {
  if (cachedFile !== undefined) return cachedFile;
  try {
    if (!existsSync(CACHE_PATH)) {
      cachedFile = null;
      return null;
    }
    cachedFile = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as ComponentCacheFile;
    return cachedFile;
  } catch {
    cachedFile = null;
    return null;
  }
}

/**
 * Validate that the component cache is fresh enough for the current spec.
 * Three checks: file exists, TTL not expired, spec hash matches.
 */
export function validateCacheFreshness(
  specComponentNames: string[],
): CacheFreshnessResult {
  const cache = loadCacheFile();

  if (!cache) {
    return {
      fresh: false,
      reason: "No component cache found. Run /saas-dev:warm-cache to populate.",
    };
  }

  // TTL check
  const generatedAt = new Date(cache.generated_at).getTime();
  const ttlMs = (cache.ttl_hours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
  const ageMs = Date.now() - generatedAt;
  if (ageMs > ttlMs) {
    const ageHours = Math.round(ageMs / (60 * 60 * 1000));
    return {
      fresh: false,
      reason:
        `Cache expired (generated ${ageHours}h ago, TTL is ${cache.ttl_hours ?? DEFAULT_TTL_HOURS}h). ` +
        `Run /saas-dev:warm-cache to refresh.`,
    };
  }

  // Spec hash check
  const currentHash = computeSpecHash(specComponentNames);
  if (cache.spec_hash !== currentHash) {
    const cachedNames = new Set(cache.components.map((c) => c.name.toLowerCase()));
    const currentNames = specComponentNames.map((n) => n.toLowerCase());
    const newNames = currentNames.filter((n) => !cachedNames.has(n));
    const detail = newNames.length > 0
      ? ` (new components: ${newNames.join(", ")})`
      : "";
    return {
      fresh: false,
      reason:
        `Spec changed since cache was built${detail}. ` +
        `Run /saas-dev:warm-cache to refresh.`,
    };
  }

  return { fresh: true };
}

// ─── Component Discovery (cache-only) ───────────────────────────────────────

function matchCachedComponents(
  componentNames: string[],
): ComponentReference[] {
  const cache = loadCacheFile();
  if (!cache || cache.components.length === 0) return [];

  const refs: ComponentReference[] = [];
  const lowerNames = componentNames.map((n) => n.toLowerCase());

  for (const entry of cache.components) {
    const entryLower = entry.name.toLowerCase();
    const matchedSpecName = lowerNames.find(
      (n) => entryLower.includes(n) || n.includes(entryLower),
    );
    if (!matchedSpecName) continue;

    const sourceLower = entry.registry.toLowerCase();
    const source: ComponentReference["source"] = sourceLower.includes("magicui")
      ? "magicui"
      : sourceLower.includes("21st")
        ? "21st-dev"
        : "shadcn";

    refs.push({
      componentName: matchedSpecName,
      source,
      description: `${entry.name} (${entry.registry}) — ${entry.description}`,
      codeSnippet: entry.code_snippet?.slice(0, MAX_SNIPPET_CHARS),
    });
  }

  return refs;
}

/**
 * Discover component references from the local cache.
 *
 * The cache is populated by the saas-dev:warm-cache skill which runs inside
 * a Claude Code session where MCP tools are available. This function is a
 * pure cache reader — no network calls, no MCP invocations.
 *
 * Call validateCacheFreshness() before this to ensure the cache is current.
 */
export function discoverComponents(
  componentNames: string[],
): ComponentDiscoveryResult {
  const references = matchCachedComponents(componentNames);

  return {
    references,
    queriedComponents: [...componentNames],
    skippedComponents: [],
  };
}

/**
 * Formats discovery results into a prompt section for Stitch.
 * Returns empty string if no references found.
 * Truncates total output to maxChars to prevent prompt bloat.
 */
export function formatDiscoveryForPrompt(
  result: ComponentDiscoveryResult,
  maxChars: number = 8000,
): string {
  if (result.references.length === 0) {
    return "";
  }

  const lines: string[] = ["Component Implementation References:"];

  const byComponent = new Map<string, ComponentReference[]>();
  for (const ref of result.references) {
    const existing = byComponent.get(ref.componentName) ?? [];
    existing.push(ref);
    byComponent.set(ref.componentName, existing);
  }

  for (const [name, refs] of Array.from(byComponent.entries())) {
    lines.push(`\n${name}:`);
    for (const ref of refs) {
      lines.push(`  [${ref.source}]${ref.description ? ` ${ref.description}` : ""}`);
      if (ref.codeSnippet) {
        const snippet =
          ref.codeSnippet.length > MAX_SNIPPET_CHARS
            ? ref.codeSnippet.slice(0, MAX_SNIPPET_CHARS) + "..."
            : ref.codeSnippet;
        lines.push(`  Code example:\n${snippet}`);
      }
    }
  }

  let output = lines.join("\n");
  if (output.length > maxChars) {
    output = output.slice(0, maxChars) + "\n... (truncated to fit prompt budget)";
  }
  return output;
}
