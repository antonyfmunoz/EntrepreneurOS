import { z } from "zod";

// ─── SECTION 1: BrownfieldInventory ──────────────────────────────────────────

// Typed snapshot of existing codebase state — produced before any files are written (INTG-01)
export const BrownfieldInventorySchema = z.object({
  existingRoutes: z.array(z.object({
    path: z.string(),
    componentName: z.string(),
    filePath: z.string(),
    isProtected: z.boolean(),
    hasCompanyGate: z.boolean(),
  })),
  existingPages: z.array(z.object({
    fileName: z.string(),
    filePath: z.string(),
    exportName: z.string(),
  })),
  installedShadcnComponents: z.array(z.string()),
  existingNavItems: z.array(z.object({
    label: z.string(),
    href: z.string(),
    iconClass: z.string(),
  })),
  existingSharedComponents: z.array(z.string()),
  existingHooks: z.array(z.string()),
});

export type BrownfieldInventory = z.infer<typeof BrownfieldInventorySchema>;

// ─── SECTION 2: Translation Types ────────────────────────────────────────────

// Input and output for the HTML-to-TSX translation step (D-01, D-04)
export interface TranslationInput {
  htmlContent: string;
  pageName: string;
  pageRoute: string;
  installedComponents: string[];
  authLevel: "public" | "authenticated" | "admin";
}

export interface TranslationResult {
  tsxContent: string;
  extractedImports: string[];
  layoutWrapped: boolean;
}

// ─── SECTION 3: Route Injection Types ────────────────────────────────────────

// Input for injecting a new ProtectedRoute into App.tsx (D-07)
export interface RouteInjectionInput {
  appTsxPath: string;
  componentName: string;
  importPath: string;
  routePath: string;
  wrapCompanyGate: boolean;
  isStandalone: boolean;
}

// ─── SECTION 4: Nav Injection Types ──────────────────────────────────────────

// Input for injecting a new nav item into sidebar.tsx (D-09)
// Uses remixicon classes (ri-*) per Research Pitfall 7 — not lucide icons
export interface NavInjectionInput {
  sidebarPath: string;
  label: string;
  href: string;
  iconClass: string; // remixicon class e.g. "ri-bar-chart-line"
}

// ─── SECTION 5: Page Integration Result ──────────────────────────────────────

// Summary of a completed page integration run
export interface PageIntegrationResult {
  pageName: string;
  pageFile: string;
  routePath: string;
  navAdded: boolean;
  shadcnInstalled: string[];
  committed: boolean;
  commitHash: string | null;
}

// ─── SECTION 6: Integration Phase Output (DB record) ─────────────────────────

// Schema for the output stored in pipeline_pages.output field (JSON string) after integration
export const IntegrationPhaseOutputSchema = z.object({
  pageName: z.string(),
  pageFile: z.string(),
  routePath: z.string(),
  committed: z.boolean(),
  commitHash: z.string().nullable(),
});

export type IntegrationPhaseOutput = z.infer<typeof IntegrationPhaseOutputSchema>;

// ─── SECTION 7: Conflict Detection ───────────────────────────────────────────

// Represents a route conflict detected between existing code and new page being integrated (D-10)
export interface RouteConflict {
  routePath: string;
  existingComponent: string;
  existingFile: string;
  newComponent: string;
}

export type ConflictResolution = "replace" | "merge" | "skip";
