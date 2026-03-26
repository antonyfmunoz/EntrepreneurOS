# Architecture

**Analysis Date:** 2026-03-25

## Pattern Overview

**Overall:** Full-stack monolithic with separated client/server tiers using Express and React, sharing type definitions through Drizzle ORM and Zod schemas.

**Key Characteristics:**
- Client and server share type definitions via `@shared/schema` (no code duplication, single source of truth)
- Multi-provider AI abstraction layer supporting Anthropic, OpenAI, Perplexity, XAI, Gemini
- Role-based entity hierarchy: Users → Companies → Agents → Tasks
- Protection layers: Authentication → Company validation → Route protection
- Pluggable integrations (Gmail, external services)

## Layers

**Presentation Layer (Client):**
- Purpose: React UI with component-based architecture, handles routing and state management
- Location: `client/src/`
- Contains: Pages (`pages/`), reusable components (`components/`), hooks, UI primitives, routing logic
- Depends on: TanStack Query (server state), Zustand (local state where needed), Wouter (routing)
- Used by: End users via browser

**Application Logic Layer (Client):**
- Purpose: Authentication context, company management, custom hooks
- Location: `client/src/hooks/` and `client/src/lib/`
- Contains: `use-auth.tsx` (Firebase + session auth), `use-company.ts` (company state), protection components
- Depends on: Firebase SDK, server API
- Used by: Pages and components

**API Layer (Server):**
- Purpose: Express routes handling all business logic, data validation, orchestration
- Location: `server/routes.ts` (primary, 89KB monolithic file)
- Contains: 40+ endpoints for users, agents, tasks, companies, workflows, integrations, CRM, documents
- Depends on: Database, Auth service, AI services, Storage layer
- Used by: Client via HTTP, external webhooks

**Data Access Layer:**
- Purpose: Drizzle ORM with type-safe database operations
- Location: `server/db.ts`, `shared/schema.ts`
- Contains: Postgres schema definitions, Zod validation schemas, type exports
- Depends on: PostgreSQL via Neon (serverless), Drizzle Kit for migrations
- Used by: Routes, Storage layer

**Services Layer:**
- Purpose: Domain-specific business logic abstraction
- Location: `server/services/`, `server/ai/`, `server/integrations/`
- Contains:
  - Action executor: `server/services/action-executor.ts` - handles task execution (email, document creation)
  - AI abstraction: `server/ai/index.ts` - multi-provider interface
  - Integrations: `server/integrations/gmail.ts` - OAuth and API clients
- Depends on: Database, external APIs, Passport.js
- Used by: Routes

**Storage Layer:**
- Purpose: In-memory cache + database persistence wrapper
- Location: `server/storage.ts` (51KB file with all CRUD operations)
- Contains: Functions for users, agents, tasks, messages, agents metrics, actions, CRM, documents
- Depends on: Drizzle ORM, database
- Used by: Routes, Services

**Shared Layer:**
- Purpose: Type and schema definitions shared between client and server
- Location: `shared/schema.ts` (21KB)
- Contains: Drizzle table definitions, Zod validation schemas, TypeScript type exports
- Depends on: Drizzle, Zod
- Used by: All layers (client + server)

## Data Flow

**User Authentication Flow:**

1. User submits email/password or Google OAuth on `/auth` page
2. Client calls `/api/auth/login` or Firebase Google auth endpoint
3. Server validates credentials using Passport.js + bcrypt or Firebase verification
4. Session created via `express-session` + `connect-pg-simple` (stored in DB)
5. Client receives session cookie, queries `/api/user` to verify login
6. `use-auth` hook stores user context, triggers redirect to `/company-setup` if no company

**Company Setup Flow:**

1. New user redirected to `/company-setup` page
2. User creates company via POST `/api/company`
3. Server creates company record, links to user via `companies.ownerUserId`
4. `use-company` hook checks `/api/company` endpoint
5. Once company exists, `CompanyGate` component unlocks app routes

**Task/Agent Execution Flow:**

1. User creates agent or task via UI form
2. Client POSTs to `/api/agents` or `/api/tasks` with validation
3. Server validates with Zod schema, stores in database
4. Task assigned to agent, triggers `/api/agents/{agentId}/message` (chat endpoint)
5. Server calls AI service (selected provider) with agent brain content
6. AI response generates action suggestions or task updates
7. User approves action in UI, client POSTs to `/api/actions/{actionId}/approve`
8. Action executor service processes (email, document creation, etc.)
9. Results stored via storage layer, metrics updated

**State Management Flow:**

**Server-Side:**
- Single source of truth: PostgreSQL database via Drizzle ORM
- In-memory cache layer in `storage.ts` for performance (optional)

**Client-Side:**
- TanStack Query manages server state with caching and synchronization
- Query keys follow pattern: `/api/endpoint`
- Automatic refetch on focus, mutation updates cache
- No global state management (minimal Zustand usage)

## Key Abstractions

**AIServiceInterface:**
- Purpose: Unified interface for multiple AI providers
- Examples: `server/ai/openai-service.ts`, `server/ai/anthropic-service.ts`, `server/ai/gemini-service.ts`
- Pattern: Each service implements `generateResponse()`, `analyzeImage()`, `generateImage()` methods
- Usage: Routes call `generateAIResponse()` which delegates to appropriate service based on model selection

**Agent Brain:**
- Purpose: Encapsulates agent personality, instructions, knowledge base
- Examples: Knowledge base text, behavioral style, KPIs, role level (Chief/Manager/Laborer)
- Pattern: Stored as text fields in `agents` table, concatenated into system prompt for AI
- Usage: Sent with every message to maintain consistent agent personality across conversations

**Company Context:**
- Purpose: Multi-tenant isolation and scoping
- Pattern: Every operation checks company ownership before returning data
- Usage: `CompanyGate` wrapper prevents access to company features without active company, routes validate company ID from request

**Action:**
- Purpose: Deferred execution of agent-generated tasks (email, document creation)
- Pattern: Generated by AI, reviewed by user, executed asynchronously
- Status flow: pending → executing → completed/failed
- Retry logic: Up to 3 retries before failure, tracks execution metadata

## Entry Points

**Server Entry Point:**
- Location: `server/index.ts`
- Triggers: Application startup via `npm run dev` or `npm start`
- Responsibilities:
  - Loads environment variables
  - Initializes Express app with middleware
  - Registers authentication and all API routes
  - Sets up error handling
  - Conditionally enables Vite in dev mode
  - Listens on port 5000

**Client Entry Point:**
- Location: `client/src/main.tsx`
- Triggers: Browser load
- Responsibilities: Renders React app into DOM

**Router:**
- Location: `client/src/App.tsx` (Router component within App)
- Triggers: On route change
- Responsibilities:
  - Evaluates auth state via `useAuth()`
  - Evaluates company state via `useCompany()`
  - Routes unauthenticated users to `/auth`
  - Routes authenticated users without company to `/company-setup`
  - Routes authenticated users with company to `/home` (dashboard)
  - Wraps protected routes with `ProtectedRoute` HOC
  - Wraps company-required routes with `CompanyGate` HOC

## Error Handling

**Strategy:** Express error middleware at bottom of route stack catches unhandled errors, returns 500 with message. Logging via simple console.log.

**Patterns:**

**Server-side:**
- Routes try/catch with typed error responses
- Validation errors use Zod error messages
- 401 for auth failures, 404 for not found, 500 for server errors
- Error logged with request path, duration, status code

**Client-side:**
- TanStack Query catches errors and stores in error state
- Toast notifications display errors to user
- 401 responses trigger auth context refetch
- Network errors show generic "Failed to..." message

## Cross-Cutting Concerns

**Logging:** Simple console.log in development, structured via request middleware in `server/index.ts` showing method, path, status, duration, response body (truncated to 80 chars)

**Validation:**
- Server: All POST/PUT requests validated with Zod schemas
- Client: React Hook Form with Zod resolvers on forms
- Patterns: `insertAgentSchema`, `updateTaskSchema`, etc. shared via `@shared/schema`

**Authentication:**
- Firebase Auth for OAuth (Google, Apple)
- Passport.js + bcrypt for email/password
- express-session middleware checks `req.isAuthenticated()`
- Routes decorated with `setupAuth(app)` function in `server/auth.ts`

**Authorization:**
- Company-level: Routes check `companiesTable.ownerUserId === req.user.id`
- Agent-level: Routes verify agent belongs to user's company
- Task-level: Routes verify task assigned to user's company
- No role-based access control (RBAC) implemented - flat permission model

---

*Architecture analysis: 2026-03-25*
