# Phase 2: Spec Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 02-spec-layer
**Areas discussed:** Spec input format, PageSpec output shape, Collaborative spec flow, Backend spec relationship, Multi-page ordering, Spec versioning, Shared components, Spec size limits

---

## Spec Input Format

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown-first | Accept markdown as primary format, AI interprets structure | |
| Format-agnostic | Accept anything, AI does heavy lifting regardless of format | |
| Structured template | User fills out template, strict parsing | |

**User's choice:** Format-agnostic with AI restructuring. AI should restructure based on intent, filling technical gaps even when the spec is incomplete.
**Notes:** User emphasized the system should bridge technical gaps — if user's spec is non-technical, AI still produces a complete technical PageSpec.

---

## Spec Confirmation Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Full restructured spec | Show complete PageSpec[] with inferred items highlighted | ✓ |
| Gaps only | Show only what AI added/inferred | |
| Page-by-page confirmation | Show one page at a time for approval | |

**User's choice:** Deferred to Claude's recommendation — full restructured spec.
**Notes:** One confirmation gate, full visibility. Inferred items visually distinct from explicit content.

---

## PageSpec Output Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Lean spec | Minimal fields, downstream phases infer the rest | |
| Rich spec | Everything upfront, every phase reads the same flat object | |
| Layered spec | Core + phase-specific layers, composable Zod contracts | ✓ |

**User's choice:** Deferred to Claude's recommendation — layered spec.
**Notes:** Four layers: core (all phases), UI (Phase 3-4), data (Phase 5), analytics (Phase 6). Composable via Zod `.merge()`.

---

## Collaborative Spec Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Domain-first questioning | Broad to narrow: vision → flows → pages → detail | ✓ |
| Page-by-page building | Skip big picture, build one page at a time | |
| Reference-driven | Start from reference apps/screenshots, user edits | |

**User's choice:** Domain-first as primary flow, but must also accept references at any point.
**Notes:** References (URLs, screenshots, "make it like X") inform the spec but don't replace structured questioning.

---

## Backend Spec Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Separate and sequential | Two distinct skills, two distinct outputs | |
| Unified spec | One spec covers both UI and backend | |
| UI-derived with overrides | Auto-generate from UI spec, user adds overrides | |

**User's choice:** Mix of all three. System supports all input paths but always auto-generates when UI spec exists.
**Notes:** All three paths converge to same validated backend spec structure. Auto-generation always runs. User can paste, collaborate, or just review the auto-derived version.

---

## Multi-Page Ordering & Dependencies

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detected with user override | Parser infers dependencies, suggests order, user can change | ✓ |
| Manual ordering | User sets priority/order explicitly | |
| No ordering | Phase 3 decides generation sequence | |

**User's choice:** Auto-detected ordering with user override.
**Notes:** Foundational pages first (auth, layout shell, dashboard), then feature pages, then settings/admin.

---

## Spec Versioning & Iteration

| Option | Description | Selected |
|--------|-------------|----------|
| Surgical per-page edits | Change one page without invalidating the rest | ✓ |
| Full re-parse on any change | Any edit triggers complete re-processing | |
| Immutable specs | Once locked, start a new spec version | |

**User's choice:** Surgical edits with downstream flagging.
**Notes:** Modified pages get version bump, dependent pages flagged for review, unrelated pages untouched.

---

## Shared Components

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-deduplication with confirmation | AI unifies similar components, user confirms | ✓ |
| Manual tagging | User marks which components are shared | |
| No deduplication | Each page defines its own components | |

**User's choice:** Auto-deduplication with user confirmation.
**Notes:** Top-level `sharedComponents[]` in spec output. Pages reference by ID.

---

## Spec Size Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Hard cap at 20 pages | Reject specs above 20 pages | |
| No cap, chunked above 25 | Single pass up to 25, domain-chunked above | ✓ |
| No cap, always single pass | Rely on large context windows | |

**User's choice:** No cap with chunked processing above 25 pages.
**Notes:** Initial recommendation of 20-page cap rejected as too low. Chunking is internal — user sees one spec in, one PageSpec[] out.

---

## Claude's Discretion

- Exact Zod field names and types for each PageSpec layer
- AI prompt engineering for restructuring and gap-filling
- Deduplication similarity threshold for shared component detection
- Domain grouping logic for chunked parsing
- Questioning depth/sequence in collaborative flow

## Deferred Ideas

None — discussion stayed within phase scope
