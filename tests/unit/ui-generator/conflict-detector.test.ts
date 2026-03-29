import { describe, it, expect } from "vitest";
import { detectPatternConflicts } from "../../../lib/ui-generator/conflict-detector.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeExisting(overrides: Partial<ExistingPattern> & { name: string }): ExistingPattern {
  return {
    variant: null,
    propsShape: null,
    usageContext: null,
    shadcnComponent: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("detectPatternConflicts", () => {
  it("Test 1: empty existingPatterns returns no conflicts", () => {
    const result = detectPatternConflicts([], [
      { name: "card", usageContext: "dashboard display", shadcnComponent: "Card" },
    ]);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("Test 2: new pattern name not in existing returns no conflict", () => {
    const existing = [
      makeExisting({ name: "card", usageContext: "metric display", shadcnComponent: "Card" }),
    ];
    const newPatterns: NewPattern[] = [
      { name: "nav-sidebar", usageContext: "page navigation", shadcnComponent: "NavigationMenu" },
    ];
    const result = detectPatternConflicts(existing, newPatterns);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("Test 3: same pattern name with same usageContext returns no conflict", () => {
    const existing = [
      makeExisting({
        name: "card",
        usageContext: "metric display",
        shadcnComponent: "Card",
      }),
    ];
    const newPatterns: NewPattern[] = [
      {
        name: "card",
        usageContext: "metric display",
        shadcnComponent: "Card",
      },
    ];
    const result = detectPatternConflicts(existing, newPatterns);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("Test 4: same pattern name with different shadcnComponent returns conflict with recommendation", () => {
    const existing = [
      makeExisting({
        name: "card",
        usageContext: "metric display",
        shadcnComponent: "Card",
      }),
    ];
    const newPatterns: NewPattern[] = [
      {
        name: "card",
        usageContext: "different metric display",
        shadcnComponent: "Dialog",
      },
    ];
    const result = detectPatternConflicts(existing, newPatterns);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].patternName).toBe("card");
    expect(result.conflicts[0].recommendation).toBeTruthy();
    expect(result.conflicts[0].recommendation).toContain("card");
  });

  it("Test 5: multiple new patterns — one conflicting, one new — returns exactly one conflict", () => {
    const existing = [
      makeExisting({
        name: "card",
        usageContext: "metric display",
        shadcnComponent: "Card",
      }),
    ];
    const newPatterns: NewPattern[] = [
      // conflicts with existing "card" — different shadcnComponent
      { name: "card", usageContext: "metric display", shadcnComponent: "Sheet" },
      // totally new — no conflict
      { name: "data-table", usageContext: "tabular data display", shadcnComponent: "Table" },
    ];
    const result = detectPatternConflicts(existing, newPatterns);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].patternName).toBe("card");
  });

  it("different variant of same name is NOT a conflict", () => {
    const existing = [
      makeExisting({
        name: "button",
        variant: "primary",
        shadcnComponent: "Button",
        usageContext: "primary action",
      }),
    ];
    const newPatterns: NewPattern[] = [
      {
        name: "button",
        variant: "destructive",
        shadcnComponent: "Button",
        usageContext: "delete actions",
      },
    ];
    // Same base name but different variant — intentionally different, should not conflict
    const result = detectPatternConflicts(existing, newPatterns);
    expect(result.hasConflicts).toBe(false);
  });

  it("same pattern name with different usageContext returns conflict", () => {
    const existing = [
      makeExisting({
        name: "modal",
        usageContext: "confirmation dialogs",
        shadcnComponent: "Dialog",
      }),
    ];
    const newPatterns: NewPattern[] = [
      {
        name: "modal",
        usageContext: "image lightbox viewer",
        shadcnComponent: "Dialog",
      },
    ];
    const result = detectPatternConflicts(existing, newPatterns);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].recommendation).toContain("modal");
  });

  it("normalizes pattern names for comparison — case and whitespace insensitive", () => {
    const existing = [
      makeExisting({
        name: "Card",
        usageContext: "metric display",
        shadcnComponent: "Card",
      }),
    ];
    const newPatterns: NewPattern[] = [
      // lowercase "card" should match existing "Card"
      { name: "card", usageContext: "metric display", shadcnComponent: "HoverCard" },
    ];
    const result = detectPatternConflicts(existing, newPatterns);
    // HoverCard != Card — conflict detected
    expect(result.hasConflicts).toBe(true);
  });
});
