# Phase 4: Code Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 04-code-integration
**Areas discussed:** Stitch-to-shadcn translation, Page file creation & wiring, Brownfield conflict resolution, Git workflow automation

---

## Stitch-to-shadcn Translation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Claude AI rewrite | Send Stitch HTML + shadcn inventory to Claude for rewrite | Yes |
| AST transform + AI fallback | Parse HTML into AST, pattern-match to shadcn, Claude for complex cases | |
| You decide | Claude picks based on analysis | |

**User's choice:** Claude AI rewrite
**Notes:** User selected recommended approach.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Layout + structure from Stitch, styling from existing system | Keep Stitch layout, swap styling to Tailwind/shadcn | |
| Full Stitch fidelity, minimal overrides | Preserve Stitch output closely | |
| You decide | Claude determines balance | Yes |

**User's choice:** You decide
**Notes:** User deferred to Claude's judgment.

---

| Option | Description | Selected |
|--------|-------------|----------|
| One page component per file | Single file per page in pages/ | |
| Auto-split into sub-components | AI extracts logical sections into separate files | |
| You decide | Claude picks based on complexity | Yes |

**User's choice:** You decide (with guidance)
**Notes:** User asked "what do you think would be best?" -- Claude recommended one file per page as default, extract sub-components only when genuinely reused across 3+ pages. User accepted.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Static structure only | Pure presentational components, no data fetching | Yes |
| Stub useQuery hooks | Include placeholder API hooks | |
| You decide | Claude decides per page | |

**User's choice:** Static structure only
**Notes:** Clean separation -- data fetching is Phase 5.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-install missing shadcn components | Run npx shadcn@latest add automatically | Yes |
| Flag and ask before installing | Pause for user approval | |
| You decide | Claude picks | |

**User's choice:** Auto-install
**Notes:** Keeps pipeline flowing.

---

## Page File Creation & Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-add with icon + label from PageSpec | System adds nav entry with Lucide icon | Yes |
| Batch after all pages | Add all nav entries at once | |
| Manual -- just create files | Leave navigation to user | |

**User's choice:** Auto-add with icon + label
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes -- ProtectedRoute + CompanyGuard for all | Every page auth-protected | Yes |
| Respect PageSpec auth field | Only protect if spec says so | |
| You decide | Claude determines per page | |

**User's choice:** ProtectedRoute + CompanyGuard for all
**Notes:** Matches existing pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap in existing Layout | Pages render inside sidebar+header shell | |
| Standalone pages | Each page self-contained | |
| Default Layout with opt-out | Layout default, PageSpec can flag full-screen | Yes |

**User's choice:** Default Layout with opt-out
**Notes:** User said "it needs to be adaptable based on what the user provides." Claude recommended this option. PageSpec flags like fullScreen or page type onboarding/auth trigger standalone rendering.

---

## Brownfield Conflict Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Flag and ask user | Detect conflict, show both versions, ask user | Partial |
| Always skip existing | Never touch existing files | |
| Smart merge | AI merges new with existing | Partial |

**User's choice:** Mix of flag+ask and smart merge
**Notes:** "mix of 1 and 3" -- Flag the conflict, show both versions, offer three options: replace, AI smart-merge, or skip. Merge only runs when user explicitly picks it.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full scan -- routes, components, hooks, utils | Comprehensive inventory | Yes |
| Routes + pages only | Just route collisions | |
| You decide | Claude determines scope | |

**User's choice:** Full scan
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Once at start, incremental updates | Full scan once, update incrementally | Yes |
| Fresh scan per page | Re-scan before each page | |
| You decide | Claude picks | |

**User's choice:** Once at start, incremental updates
**Notes:** None.

---

## Git Workflow Automation

| Option | Description | Selected |
|--------|-------------|----------|
| One feature branch per phase | Single branch for all Phase 4 work | Yes |
| One branch per page | Separate branch per page | |
| Use current branch | No new branches | |

**User's choice:** One feature branch per phase
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| One commit per page | Atomic commit per page integration | Yes |
| One commit per step | Separate commits for translate/create/wire | |
| Batch all pages | One commit at the end | |

**User's choice:** One commit per page
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-push after all pages, create PR | Push and PR at the end | Yes |
| Push after each page | Incremental push | |
| Manual -- don't push | User handles push/PR | |

**User's choice:** Auto-push, auto-create PR
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Branch from feature/company-system | Includes company guard infrastructure | |
| Branch from main | Clean base, no company deps | |
| You decide | Claude picks based on dependency analysis | Yes |

**User's choice:** You decide
**Notes:** Claude will analyze at execution time whether new pages need CompanyGuard. If yes, branch from feature/company-system.

---

## Claude's Discretion

- D-02: Preservation balance during Stitch-to-shadcn translation
- D-05: Page file granularity (one file default, extract reused sub-components)
- D-16: Base branch selection based on dependency analysis at execution time

## Deferred Ideas

None -- discussion stayed within phase scope.
