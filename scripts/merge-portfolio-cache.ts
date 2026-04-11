import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CACHE_PATH = resolve(process.cwd(), "lib/ui-generator/component-cache.json");
const NEW_SPEC_HASH = "7bfe08f14901d061"; // from refresh-spec-row.ts output (truncated)

// Full hash from the refresh-spec-row run: compute it exactly the same way.
import { createHash } from "node:crypto";

async function main() {
  const cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));

  // Recompute exact hash from updated JSON spec
  const specJson = JSON.parse(
    readFileSync(resolve(process.cwd(), ".planning/specs/eos-mvp-spec.json"), "utf-8"),
  );
  const allComponents: string[] = [
    ...new Set(specJson.pages.flatMap((p: any) => p.components as string[])),
  ].sort();
  const fullHash = createHash("sha256")
    .update(allComponents.map((n) => n.toLowerCase()).sort().join("\n"))
    .digest("hex");

  console.log(`Full new spec hash: ${fullHash}`);
  console.log(`Updating cache hash from ${cache.spec_hash?.slice(0, 16)} → ${fullHash.slice(0, 16)}`);

  // New entries derived from MCP inspiration results.
  // Each entry mirrors the shape of existing cache entries: { name, registry, description, code_snippet? }
  const newEntries = [
    {
      name: "PortfolioCanvas",
      registry: "21st.dev",
      description:
        "Full-bleed React Flow (@xyflow/react) canvas that renders portfolio entity nodes on a subtle grid background. Uses glassmorphism floating cards, supports pan/zoom, fit-view, and a minimal floating toolbar. Inspired by Schema Card with Animated Wave Visualizer — same spatial-canvas feel, but solid colors (no gradients), #6a37d4 accent, #f5f6f7 base surface.",
    },
    {
      name: "PortfolioCanvas",
      registry: "shadcn/ui",
      description:
        "shadcn-compatible wrapper around @xyflow/react ReactFlow primitive. Applies design tokens: glassmorphism nodes, solid #6a37d4 primary, ambient purple shadows. Controls mount via ReactFlow.Controls slot.",
    },
    {
      name: "PortfolioNode",
      registry: "21st.dev",
      description:
        "Glassmorphism node card used inside a React Flow canvas as a custom node type. Shows portfolio name (title), description (muted), and company count badge. Derived from Glass Card pattern — bg-primary-foreground/30, backdrop-blur-md, rounded-2xl, 1px solid #6a37d4 border on hover. No gradients.",
    },
    {
      name: "PortfolioNode",
      registry: "MagicUI",
      description:
        "Neon Gradient Card pattern adapted: strip gradient, use solid #6a37d4 accent border, glassmorphism surface. Acts as the visual node inside ReactFlow for portfolios.",
    },
    {
      name: "CreatePortfolioButton",
      registry: "21st.dev",
      description:
        "Primary solid-fill button (#6a37d4) with Plus icon from lucide-react, used to trigger the inline create portfolio dialog. 12px border radius, white text, hover darkens to #5a2dc0. No gradients, no shimmer.",
    },
    {
      name: "CreatePortfolioButton",
      registry: "shadcn/ui",
      description:
        "shadcn Button primitive with variant='default' → uses design token --primary (#6a37d4). Rendered as icon+label. Replaces any gradient button variant.",
    },
    {
      name: "CanvasControls",
      registry: "21st.dev",
      description:
        "Floating glassmorphism control group positioned bottom-right of a React Flow canvas. Contains three icon buttons (ZoomIn, ZoomOut, Maximize2) from lucide-react. Inspired by button group zoom pattern — but with solid #6a37d4 icon tint and glassmorphism surface (rgba(255,255,255,0.7) + backdrop-blur-md). No gradients.",
    },
    {
      name: "CanvasControls",
      registry: "MagicUI",
      description:
        "Inspired by Lens component — minimal floating control affordance. Adapted to shadcn tokens + glassmorphism. Icon-only buttons, tooltip on hover, 12px rounded.",
    },
    {
      name: "PortfolioDetailDrawer",
      registry: "21st.dev",
      description:
        "Right-side slide-over drawer showing portfolio metadata, description, and inner company list. Glassmorphism panel, 400px wide, slides in with 200ms ease. Uses shadcn Sheet primitive as base. Header shows portfolio name + close button (X from lucide).",
    },
    {
      name: "PortfolioDetailDrawer",
      registry: "shadcn/ui",
      description:
        "shadcn Sheet component (side='right') with custom glassmorphism styling. Content section lists companies using CompanyNode mini cards. Footer has 'Open portfolio' primary button.",
    },
    {
      name: "CompanyCanvas",
      registry: "21st.dev",
      description:
        "Full-bleed React Flow canvas for a single portfolio. Renders company nodes on a grid background with glassmorphism styling. Same foundation as PortfolioCanvas but scoped to one portfolio's companies. Supports click → open CompanyDetailDrawer.",
    },
    {
      name: "CompanyCanvas",
      registry: "shadcn/ui",
      description:
        "Wrapper around @xyflow/react ReactFlow configured with CompanyNode as the custom node type. Uses shadcn tokens for theming.",
    },
    {
      name: "CompanyNode",
      registry: "21st.dev",
      description:
        "Glassmorphism card used as a React Flow custom node. Shows company name (title), stage (chip), industry (subtitle), and an 'Open' action. Hover raises to level 3 glass + ambient purple shadow. Solid #6a37d4 accent border on selected. No gradients.",
    },
    {
      name: "CompanyNode",
      registry: "MagicUI",
      description:
        "Magic Card pattern adapted — spotlight effect follows cursor on hover, highlighting borders with solid #6a37d4. Used as node for companies inside portfolio canvas.",
    },
    {
      name: "CompanyDetailDrawer",
      registry: "21st.dev",
      description:
        "Right-side slide-over drawer showing company metadata and quick actions (Open Command Center, View Tasks, View Org, View Workflows). Glassmorphism panel. Uses shadcn Sheet primitive as base.",
    },
    {
      name: "CompanyDetailDrawer",
      registry: "shadcn/ui",
      description:
        "shadcn Sheet component (side='right') with custom glassmorphism styling. Content lists quick actions as a vertical menu using lucide-react icons.",
    },
    {
      name: "PortfolioSelector",
      registry: "21st.dev",
      description:
        "Dropdown or tile-grid control used inside the CompanySetup wizard to pick an existing portfolio or trigger inline create. Shows current portfolios as cards with name, company count, and selection radio. Includes '+ Create new portfolio' tile as last option.",
    },
    {
      name: "PortfolioSelector",
      registry: "shadcn/ui",
      description:
        "Built on shadcn Select primitive for compact dropdown mode, or RadioGroup + Card primitives for tile mode. Responsive: tiles on desktop, dropdown on mobile.",
    },
    {
      name: "CreatePortfolioInline",
      registry: "21st.dev",
      description:
        "Inline form that appears inside the CompanySetup wizard when user chooses 'Create new portfolio'. Two fields: portfolio name (required), description (optional). Uses shadcn Input + Textarea + Label. Primary 'Create' button (solid #6a37d4) saves and selects the new portfolio.",
    },
    {
      name: "CreatePortfolioInline",
      registry: "shadcn/ui",
      description:
        "shadcn Form + Input + Textarea + Label composition. Uses react-hook-form with zod validation (insertPortfolioSchema from @shared/schema).",
    },
  ];

  // Preserve existing cache entries, then filter out anything for components
  // that were removed from the spec (CompanyCard, CompanyQuickActions, AddCompanyButton*),
  // then append new entries.
  const removedFromSpec = new Set<string>(["CompanyCard", "CompanyQuickActions"]);
  const keptExisting = (cache.components ?? []).filter(
    (c: any) => !removedFromSpec.has(c.name),
  );

  const merged = [...keptExisting, ...newEntries];

  const updatedCache = {
    ...cache,
    generated_at: new Date().toISOString(),
    spec_hash: fullHash,
    source:
      (cache.source ?? "saas-dev:warm-cache skill — live MCP queries") +
      " (portfolio components merged 2026-04-11)",
    components: merged,
  };

  writeFileSync(CACHE_PATH, JSON.stringify(updatedCache, null, 2) + "\n");

  // Report
  const byRegistry: Record<string, number> = {};
  for (const entry of merged) {
    byRegistry[entry.registry] = (byRegistry[entry.registry] ?? 0) + 1;
  }
  console.log(`\nComponent Cache Updated ✓`);
  console.log(`  Total entries:     ${merged.length}`);
  console.log(`  New entries:       ${newEntries.length}`);
  console.log(`  Removed entries:   ${(cache.components?.length ?? 0) - keptExisting.length}`);
  console.log(`  Spec hash:         ${fullHash.slice(0, 16)}...`);
  console.log(`  By registry:`);
  for (const [r, n] of Object.entries(byRegistry)) {
    console.log(`    ${r.padEnd(12)} ${n}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
