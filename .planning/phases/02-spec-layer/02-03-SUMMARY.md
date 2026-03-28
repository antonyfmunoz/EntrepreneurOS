---
phase: 02-spec-layer
plan: "03"
subsystem: spec-parser
tags: [collaborative-flow, spec-editor, skill-definition, tdd, provenance]
dependency_graph:
  requires: [02-01]
  provides: [collaborative-flow, spec-editor, spec-parser-skill]
  affects: [downstream-phases-3-6, orchestrator-skill]
tech_stack:
  added: []
  patterns: [state-machine, surgical-edit, provenance-marking, skill-definition]
key_files:
  created:
    - lib/spec-parser/collaborative-flow.ts
    - lib/spec-parser/spec-editor.ts
    - tests/unit/spec-parser/collaborative-flow.test.ts
    - tests/unit/spec-parser/spec-editor.test.ts
    - .claude/skills/saas-dev/spec-parser/SKILL.md
  modified:
    - .claude/skills/saas-dev/orchestrator/SKILL.md
decisions:
  - "Collaborative flow v1 manages state in Claude Code conversation context — no cross-session persistence (CollaborativeState design notes future Neon serialization path)"
  - "applySpecEdit is immutable — returns new SpecOutput, never mutates input spec"
  - "markProvenance uses Set lookup for O(1) name matching against original input page names"
  - "extractSpecFromConversation reuses extractJsonFromResponse from restructure-spec for consistent JSON fence handling"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 03: Collaborative Flow, Spec Editor, and Skill Definition Summary

Implemented collaborative spec creation state machine with 5 domain-first questioning stages, surgical spec editor with version bumping and dependency flagging as real code, and the complete spec-parser Claude Code skill definition that orchestrates all Phase 2 modules.

## Tasks Completed

### Task 1: Collaborative spec creation flow and surgical spec editor modules

**TDD approach — RED then GREEN.**

Created `lib/spec-parser/collaborative-flow.ts` implementing:
- `QUESTION_SEQUENCE` constant tuple with 5 stages: `vision`, `user-flows`, `pages`, `page-detail`, `implied`
- `QuestionStage` type derived from the const tuple
- `CollaborativeState` interface with stage, stageIndex, messages, references, partialSpec, complete fields
- `createInitialState()` — returns clean initial state at vision/0
- `buildSystemPromptForStage(stage, priorContext)` — stage-specific system prompts that include priorContext and accept references (D-08)
- `isFlowComplete(state)` — true when stageIndex >= 5 and partialSpec is not null
- `extractSpecFromConversation(messages)` — sends full conversation to Claude, validates with `SpecOutputSchema.parse()`, marks provenance via system prompt instructions

Created `lib/spec-parser/spec-editor.ts` implementing edit state transitions in code (addresses MEDIUM-HIGH review concern):
- `applySpecEdit(spec, targetRoute, updatedPage)` — finds page by route, bumps `specVersion` by 1, returns new immutable SpecOutput, throws with clear error if route not found
- `flagDependentPages(spec, editedRoute)` — scans all pages' `dependsOn` arrays, returns routes of pages that depend on the edited route
- `markProvenance(spec, originalInputPageNames)` — marks pages and shared components as `"explicit"` or `"inferred"` by comparing against a Set of original user-provided names

All 24 new tests pass. Full suite: 91 tests across 7 files, all pass.

### Task 2: spec-parser Claude Code skill definition

Created `.claude/skills/saas-dev/spec-parser/SKILL.md` following the established YAML frontmatter + markdown body pattern.

Documents:
- **Paste path:** `chunkRawText` FIRST before AI calls, single-chunk falls through to `parseSpec`, multi-chunk uses `restructureSpec` per chunk then merge
- **Collaborate path:** Full QUESTION_SEQUENCE loop using collaborative-flow module, calls `extractSpecFromConversation` at the end
- **Post-processing pipeline:** Page count check -> `markProvenance` -> `deduplicateComponents` -> `deriveBackendSpec` -> backend-only concerns question
- **Confirmation gate:** Full provenance display with `[INFERRED]` markers for AI-added content, user options (approve/edit/redo), surgical edit via `applySpecEdit` + `flagDependentPages`
- **Spec editing:** Version bumping, dependency flagging, `"spec-changed"` status, unaffected pages untouched
- **Persistence:** pipeline_run + pipeline_pages rows on approval

Updated `.claude/skills/saas-dev/orchestrator/SKILL.md` Current Sub-Skills to include `saas-dev:spec-parser`.

## Commits

| Hash | Message |
|------|---------|
| e053a2f | feat(02-03): collaborative flow state machine and surgical spec editor |
| fe7526b | feat(02-03): spec-parser Claude Code skill definition with provenance and pre-chunking |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exported functions are fully implemented code, not placeholders.

## Self-Check: PASSED

Files exist:
- lib/spec-parser/collaborative-flow.ts: FOUND
- lib/spec-parser/spec-editor.ts: FOUND
- tests/unit/spec-parser/collaborative-flow.test.ts: FOUND
- tests/unit/spec-parser/spec-editor.test.ts: FOUND
- .claude/skills/saas-dev/spec-parser/SKILL.md: FOUND

Commits exist:
- e053a2f: FOUND
- fe7526b: FOUND

Tests: 91 passed / 0 failed across 7 test files.
