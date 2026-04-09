# Phase 3: UI Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 03-ui-generation
**Areas discussed:** Stitch prompt design, Design token extraction, Self-review & confidence, Approval gate flow

---

## Stitch Prompt Design

### Prompt Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Spec-faithful | Translate PageSpec fields into prompt — components, layout hints, auth, states. Room for visual interpretation. | ✓ |
| Minimal + creative | Just page purpose and component names. Let Stitch decide everything. | |
| Pixel-precise | Exact spacing, typography, color values in prompt. Maximum control. | |

**User's choice:** Deferred to recommendation — Spec-faithful selected
**Notes:** None

### Design Token Injection

| Option | Description | Selected |
|--------|-------------|----------|
| Inline constraints | Embed tokens directly in prompt text. Simple, no API features needed. | |
| Reference screenshot | Include page 1 screenshot URL as visual reference. | |
| Both combined | Inline tokens PLUS screenshot reference. Strongest signal. | ✓ |

**User's choice:** Both combined, with the caveat that screenshots are included when available (user-provided or from prior approvals)
**Notes:** None

### Device Type

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop only v1 | Generate desktop layout only. Mobile deferred to Phase 4 responsive CSS. | |
| Desktop + mobile per page | Two Stitch calls per page. Catches mobile issues early. | ✓ |
| User chooses per page | Per-page device type selection. Most flexible. | |

**User's choice:** Desktop + mobile per page
**Notes:** Later refined — device type should be user-configured at Phase 3 start, not hardcoded to always both. Depends on what the user is building (web app vs PWA vs responsive site).

### Retry Flow on Rejection

| Option | Description | Selected |
|--------|-------------|----------|
| Feedback-informed retry | User gives specific feedback, appended to prompt, up to 3 retries. | ✓ |
| Fresh regeneration | Restart from scratch each time. Relies on randomness. | |
| Variant selection | Generate 2-3 variants upfront, user picks best. | |

**User's choice:** Feedback-informed retry
**Notes:** None

---

## Design Token Extraction

### Extraction Method

| Option | Description | Selected |
|--------|-------------|----------|
| AI extraction from HTML | Send HTML to Claude, extract tokens into dmTokens schema. Automated. | ✓ |
| CSS parsing (deterministic) | Parse HTML/CSS programmatically. No AI but brittle. | |
| User-defined tokens | Ask user to provide tokens manually. Most accurate but effort. | |

**User's choice:** Deferred to recommendation — AI extraction selected
**Notes:** None

### Pattern Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, extract patterns too | Extract tokens AND component patterns. Store in dmPatterns. | ✓ |
| Tokens only, patterns later | Defer component patterns to Phase 4. | |
| Tokens + screenshot reference | Tokens extracted, screenshot used as pattern reference. | |

**User's choice:** Extract patterns too
**Notes:** None

### Token Evolution

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable after page 1 | Page 1 locks the design system. No changes after. | |
| Evolve with each page | Each page refines token set. Flexible but risks drift. | |
| User-triggered updates only | Locked after page 1, explicit user override creates new version. | |

**User's choice:** Progressive evolution (custom)
**Notes:** User pointed out that auth pages (often first) don't give enough design detail for the rest of the app. Tokens need to grow progressively — new values added with each page but existing tokens preserved. Uses dmTokens immutable revision model.

### Pattern Conflicts

| Option | Description | Selected |
|--------|-------------|----------|
| Flag and ask | AI detects conflict, shows both, user decides unify/variant/override. | ✓ |
| Always unify to existing | New pages always conform to established patterns. | |
| Keep all as variants | Every unique pattern becomes a named variant. | |

**User's choice:** Flag and ask
**Notes:** None

---

## Self-Review & Confidence

### Checklist Dimensions

| Option | Description | Selected |
|--------|-------------|----------|
| Spec compliance | Components present, auth gates, states | ✓ |
| Visual consistency | Colors, typography, spacing match tokens | ✓ |
| Structural completeness | Navigation, responsive, accessibility, semantic HTML | ✓ |
| Content quality | Reasonable placeholders, appropriate labels/icons | ✓ |

**User's choice:** All four dimensions selected
**Notes:** None

### Confidence Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| High bar — 90%+ | All dimensions must pass 90%+. Any below escalates. | ✓ |
| Medium bar — 80%+ | Average across dimensions 80%+. More autonomous. | |
| Progressive trust | Start at 95%, lower to 85% after 3 approvals. Resets on rejection. | |

**User's choice:** High bar — 90%+
**Notes:** None

### Review Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| AI-based structured review | Claude Sonnet evaluates HTML + screenshot + PageSpec + tokens. Structured JSON output. | ✓ |
| Rule-based checks | Programmatic grep/compare. Deterministic but limited. | |
| Hybrid | Rule-based for structural, AI for visual/content. | |

**User's choice:** AI-based structured review
**Notes:** None

### Desktop + Mobile Review Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Together in one review | Both versions in single Claude call. Evaluates responsive consistency. | ✓ |
| Separate reviews | Two independent review calls. Can't catch responsive inconsistencies. | |

**User's choice:** Together in one review
**Notes:** None

---

## Approval Gate Flow

### Gate Display

| Option | Description | Selected |
|--------|-------------|----------|
| Screenshot + scores + spec | Full context: visual, scores, component checklist, actions. | ✓ |
| Screenshot only | Just the visual preview. Scores on request. | |
| Full HTML preview | Render HTML in browser via Playwright/code-server. | |

**User's choice:** Screenshot + scores + spec
**Notes:** None

### Gate Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Approve / Reject+feedback / Skip | Three options including defer/skip for difficult pages. | ✓ |
| Approve / Reject only | Binary. No way to defer. | |
| Approve / Reject / Edit prompt | Adds direct prompt editing. Power-user feature. | |

**User's choice:** Approve / Reject+feedback / Skip
**Notes:** None

### Auto-Approve Notification

| Option | Description | Selected |
|--------|-------------|----------|
| Brief notification | One-line summary for auto-approved pages. Full gate for escalations only. | ✓ |
| Silent auto-approve | No notification. Only see escalated pages. | |
| Batch summary after all | Summary after all pages processed. | |

**User's choice:** Brief notification
**Notes:** None

---

## Claude's Discretion

- Stitch prompt template structure and exact wording
- AI extraction prompt engineering for design tokens and patterns
- Self-review prompt engineering and scoring calibration
- Pattern conflict detection similarity thresholds
- Internal page processing order
- Feedback formatting for Stitch retry prompts

## Deferred Ideas

None — discussion stayed within phase scope
