# Codebase Concerns

**Analysis Date:** 2026-03-25

## Security Issues

**API Key Exposure via Runtime Environment Variables:**
- Issue: `/api/keys/save` endpoint accepts API keys and stores them directly in `process.env` (line 109 in `server/routes.ts`)
- Files: `server/routes.ts` (lines 85-118)
- Impact: API keys live only in memory and are lost on restart; no secure storage mechanism; endpoint has minimal auth validation
- Fix approach: Implement proper secrets management via environment configuration on startup only, remove runtime API key setting endpoint, use encrypted vault system for production

**Type Safety in Error Handling:**
- Issue: Widespread use of `any` type casting in error handlers and type conversions
- Files: `server/routes.ts` (line 586: `(req.user as any).id`), `server/auth.ts`, `server/services/action-executor.ts` (line 60)
- Impact: Loss of type safety for critical auth/user data; potential null reference errors not caught at compile time
- Fix approach: Create proper TypeScript interfaces for Express request/response extensions; use proper type guards instead of `as any` casts

**Company Ownership Verification:**
- Issue: Company routes verify user ownership but workflow routes (`/api/workflows`) do not check user association (line 251 in `server/routes.ts`)
- Files: `server/routes.ts` (lines 249-276)
- Impact: User can potentially access/modify workflows belonging to other companies or users
- Fix approach: Add ownership verification to all workflow CRUD operations; ensure user is authenticated and owns the company before returning data

**Missing Authentication on AI Generation Endpoint:**
- Issue: `/api/ai/generate` endpoint has no authentication check (line 278 in `server/routes.ts`)
- Files: `server/routes.ts` (lines 278-300)
- Impact: Endpoint can be called by unauthenticated users; potential for API key abuse and cost overruns
- Fix approach: Add `req.isAuthenticated()` check; implement rate limiting per user; track AI usage per company

## Test Coverage Gaps

**No Test Suite Exists:**
- Issue: No test files (`.test.ts`, `.spec.ts`) found in the codebase
- Files: All files lack corresponding test coverage
- Risk: Untested business logic in routing, auth, AI integration, database operations; no regression protection
- Priority: High - Critical user flows (auth, company creation, agent chat, action execution) are untested

**Untested Critical Paths:**
- Auth flow with Firebase integration (`client/src/hooks/use-auth.tsx`)
- Company setup and validation (`client/src/pages/company-setup-page.tsx`)
- Action execution pipeline (`server/services/action-executor.ts`)
- AI response generation and fallback logic (`server/routes.ts` lines 532-560)

## Fragile Areas

**Company-Gate and Protected Route Complexity:**
- Files: `client/src/lib/protected-route.tsx`, `client/src/lib/company-guard.tsx`, `client/src/hooks/use-company.ts`
- Why fragile: Multiple layers of protection (ProtectedRoute + CompanyGate) applied to every protected page; if either hook fails, UX breaks; no error boundary
- Safe modification: Add error boundaries around route protection; consolidate logic into single hook; add explicit error states
- Test coverage: Gaps - no tests for redirect chains or loading state handling

**Large Monolithic Files:**
- Files with >1000 lines: `server/routes.ts` (2526 lines), `server/storage.ts` (1518 lines)
- Why fragile: Single changes affect many unrelated features; high risk of regression; difficult to review and test
- Safe modification: Break routes by domain (auth, company, agents, tasks, integrations, etc.); split storage into multiple repositories by entity type

**Unvalidated Error Handling in Routes:**
- Files: `server/routes.ts` throughout
- Why fragile: Generic error responses expose too much detail (`error instanceof Error ? error.message`); inconsistent error formats across routes
- Safe modification: Create unified error handler; sanitize error messages for production; return consistent error schema

**Action Extraction Using Regex:**
- Files: `server/routes.ts` (lines 562-599)
- Why fragile: Manual regex parsing of ACTION tags from AI responses is fragile; malformed responses cause silent failures
- Safe modification: Implement structured action proposal system; have AI return JSON instead of parsed text; validate action structure before storage

## Data Flow Issues

**Inconsistent Error Propagation:**
- Issue: Routes catch and log errors but don't consistently validate response bodies before sending
- Files: `server/routes.ts` (multiple catch blocks), `client/src/pages/documents-page.tsx`
- Impact: Silent failures in client; error states not properly handled; users don't know operations failed
- Fix approach: Create typed error response wrapper; validate all response shapes against schema before sending

**Missing Validation on Database Updates:**
- Issue: `Record<string, any>` used for dynamic updates (line 225-227 in `server/routes.ts`) bypasses schema validation
- Files: `server/routes.ts` (company PATCH route)
- Impact: Invalid data could be written to database; no audit trail of what changed
- Fix approach: Create explicit update schemas; validate each field individually; log all updates for audit

**Async Error Handling in Queries:**
- Issue: Some query failures silently return empty results instead of throwing errors
- Files: `client/src/hooks/use-company.ts` (line 13: catches 404 and returns null without logging context)
- Impact: Hard to debug; no visibility into whether company truly doesn't exist vs network failure
- Fix approach: Distinguish between 404 (not found) and other errors; provide context in error messages

## Performance Bottlenecks

**N+1 Query Problem in Agent Listing:**
- Problem: `/api/agents` route fetches all agents then makes a query per agent for tasks (lines 308-320)
- Files: `server/routes.ts`
- Cause: Using Promise.all() with sequential DB queries instead of single JOIN
- Improvement path: Use Drizzle relational queries or aggregation; cache agent task counts

**Unindexed Frequently-Queried Fields:**
- Problem: Company routes query by `ownerUserId` but no index specified; workflows query has no filtering
- Files: Schema in `shared/schema.ts` and migrations
- Cause: Rapid development without performance consideration
- Improvement path: Add database indexes on `users.id`, `companies.ownerUserId`, `workflows.company_id`

**Missing Database Connection Pooling Configuration:**
- Problem: Direct Postgres connection without explicit pool configuration
- Files: `server/db.ts`
- Cause: Using default connection settings
- Improvement path: Configure explicit min/max pool size for serverless environment; implement connection warmup

## Tech Debt

**Outdated/Unmaintained Dependencies:**
- Firebase SDK: Version 11.6.0 (appears to have newer versions available)
- OpenAI SDK: Version 4.96.2 (rapid release cycle; may lack latest models/features)
- Files: `package.json`
- Impact: Missing security patches, bug fixes, and new functionality
- Fix approach: Run `npm audit`, update minor/patch versions, test against newer versions

**Hardcoded Model Names:**
- Issue: AI model selection defaults to hardcoded names like "claude-haiku-4-5" (line 466 in `server/routes.ts`)
- Files: `server/routes.ts`
- Impact: Can't change default model without code change; inconsistent with model selector UI
- Fix approach: Move model selection to database config per company; pass selected model through request body

**Mixed Concerns in Single File:**
- Issue: `server/routes.ts` handles routing, validation, AI generation, action extraction, and business logic
- Files: `server/routes.ts` (2526 lines)
- Impact: High cognitive load; difficult to maintain; testing individual concerns impossible
- Fix approach: Create separate service files for each domain (agents, tasks, companies, workflows, etc.)

**Duplication Between Client and Server Schemas:**
- Issue: Type definitions defined in multiple places (`documents-page.tsx` line 54-82 duplicates schema definitions)
- Files: `client/src/pages/documents-page.tsx`, `shared/schema.ts`
- Impact: Type divergence; manual schema keeping; risk of client/server mismatch
- Fix approach: Export all types from `shared/schema.ts`; generate client types from server schema

## Known Bugs

**Company Setup Flow Not Idempotent:**
- Symptoms: User navigated to `/company-setup` after company created shows redirect loop
- Files: `client/src/lib/protected-route.tsx` (lines 49-54), `App.tsx` (lines 40-41)
- Trigger: Create company → still shows setup page briefly → redirects to home
- Workaround: Wait for query invalidation to complete before redirect
- Root cause: Race condition between mutation success and query invalidation

**Action Execution Retry Without Validation:**
- Symptoms: Failed actions automatically retry up to 3 times without checking if the failure is retryable
- Files: `server/services/action-executor.ts` (lines 45-52)
- Trigger: Any error during action execution
- Workaround: None - will eventually mark as failed after maxRetries
- Root cause: No distinction between transient errors (network) and permanent errors (validation)

**AI Response Falls Back Silently:**
- Symptoms: When unified AI service fails, falls back to `generateAgentResponse` without user notification
- Files: `server/routes.ts` (lines 546-552)
- Trigger: Network error or API limit reached
- Workaround: Check logs to know fallback occurred
- Root cause: No error communication to frontend; user doesn't know response quality degraded

## Scaling Limits

**Single Database Connection String:**
- Current capacity: Single Neon serverless database
- Limit: Serverless cold start latency + connection pool exhaustion under high concurrent load
- Scaling path: Read replicas for analytics queries; separate databases for agents/tasks; implement connection pooling service

**No Request Rate Limiting:**
- Current capacity: Unrestricted API calls per user
- Limit: Burst traffic can exhaust API key quotas; AI endpoint vulnerable to abuse
- Scaling path: Implement per-user rate limiting (express-rate-limit); per-company usage tracking; queue for AI requests

**In-Memory Session Storage:**
- Current capacity: Sessions stored in memory by default (or minimal PG backing)
- Limit: Multiple server instances won't share sessions; server restart loses all sessions
- Scaling path: Already using `connect-pg-simple` so this is configured; verify it's actually enabled in production

## Missing Critical Features

**No Audit Trail:**
- Problem: No logging of who changed what and when for critical operations
- Blocks: Compliance requirements; debugging user issues; security investigation
- Impact: Cannot trace agent action execution; cannot verify data integrity after failures

**No User Permissions System:**
- Problem: All authenticated users have same access to all agents/tasks/documents
- Blocks: Multi-tenant features; team collaboration; role-based access control
- Impact: Cannot safely share workspace with other users; no protection against accidental/malicious changes

**No Workflow Execution Engine:**
- Problem: Workflows table exists but no logic to trigger them or execute steps
- Blocks: Automation features; scheduled tasks; multi-step processes
- Impact: Workflows are data-only; cannot be used for anything practical

**Missing Workspace Isolation:**
- Problem: Company concept exists but agents/tasks/documents not scoped to companies
- Blocks: True multi-tenant support; switching between companies; data separation
- Impact: If implemented, risk of data leakage across companies
