import type { ConflictDetectionResult } from "./types.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ExistingPattern {
  name: string;
  variant?: string | null;
  propsShape?: string | null;
  usageContext?: string | null;
  shadcnComponent?: string | null;
}

interface NewPattern {
  name: string;
  variant?: string;
  propsShape?: string;
  usageContext?: string;
  shadcnComponent?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalize pattern name for comparison — lowercase and trim
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Check if two usage contexts are significantly different.
// Uses substring inclusion as a leniency check — if one context contains the
// other, we treat them as same intent (Pitfall 5: semantic, not string equality).
function usageContextsDiffer(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  return !na.includes(nb) && !nb.includes(na);
}

// ─── detectPatternConflicts ───────────────────────────────────────────────────

// Identifies when a new pattern semantically differs from an established pattern
// with the same name. Comparison is deliberately lenient per D-08 and Pitfall 5:
// only flags when the same-named pattern has genuinely different structural
// properties (different shadcn base component, different usage context).
//
// If the variant field differs but the name matches, treat it as an intentionally
// different variant — NOT a conflict.
export function detectPatternConflicts(
  existingPatterns: ExistingPattern[],
  newPatterns: NewPattern[]
): ConflictDetectionResult {
  const conflicts: ConflictDetectionResult["conflicts"] = [];

  for (const newPattern of newPatterns) {
    const normalizedNewName = normalizeName(newPattern.name);

    // Find matching existing patterns by normalized name
    const matches = existingPatterns.filter(
      (ep) => normalizeName(ep.name) === normalizedNewName
    );

    if (matches.length === 0) {
      // New pattern — no conflict
      continue;
    }

    for (const existing of matches) {
      // If variants differ and both have a variant defined, treat as intentional
      // variant — not a conflict. A new variant of an existing pattern is expected.
      if (
        newPattern.variant &&
        existing.variant &&
        newPattern.variant !== existing.variant
      ) {
        continue;
      }

      // Check shadcnComponent mismatch (structural conflict — different base component)
      if (
        newPattern.shadcnComponent &&
        existing.shadcnComponent &&
        newPattern.shadcnComponent !== existing.shadcnComponent
      ) {
        const recommendation =
          `Pattern '${newPattern.name}' uses ${newPattern.shadcnComponent} but established pattern uses ${existing.shadcnComponent}. ` +
          `Consider: unify to existing, keep both as named variants, or override.`;

        conflicts.push({
          patternName: newPattern.name,
          existingValue: existing.shadcnComponent,
          newValue: newPattern.shadcnComponent,
          recommendation,
        });
        continue; // One conflict per pair is enough
      }

      // Check usageContext mismatch (semantic conflict — different intent)
      if (
        newPattern.usageContext &&
        existing.usageContext &&
        usageContextsDiffer(newPattern.usageContext, existing.usageContext)
      ) {
        const recommendation =
          `Pattern '${newPattern.name}' has different usage context. ` +
          `New: '${newPattern.usageContext}', Established: '${existing.usageContext}'. ` +
          `Consider if these are the same component or distinct variants.`;

        conflicts.push({
          patternName: newPattern.name,
          existingValue: existing.usageContext,
          newValue: newPattern.usageContext,
          recommendation,
        });
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}
