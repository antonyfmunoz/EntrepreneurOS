<!-- GSD:project-start source:PROJECT.md -->
## Project

**SaaS Development System**

An end-to-end SaaS development system built as a set of Claude Code skills. It takes a product from spec to deployed, hosted app — orchestrating UI generation (via Google Stitch API), code integration, backend wiring, testing, analytics, and deployment. The system calls existing Claude Code skills at each phase (frontend-design, PostHog, GSD, TDD, debugging, code review, git workflows, etc.) and stores design consistency context in a Neon PostgreSQL database. Built for personal use first across multiple SaaS projects, with learnings informing a future productized version.

**Core Value:** One system that takes a SaaS product from spec document to deployed, tested, hosted application — page by page, with human oversight at critical points and autonomous execution everywhere else.

### Constraints

- **Build tool:** Must be built using `skill-creator` skill — this is a skill creation project
- **Stitch API:** Must use official Google Stitch API documentation — no guessing at API contracts
- **Database:** Neon PostgreSQL for design consistency memory (same provider as SaaS products)
- **Framework v1:** React + Vite + Tailwind + shadcn/ui (extend to others post-v1)
- **Existing code:** Must work with partially-built projects — brownfield-first, not greenfield-only
- **Best practices:** Every phase follows established patterns — TDD, code review, proper git workflow, verification before completion
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.6.3 - Full stack (client, server, shared code)
- JavaScript - Build configuration and scripting
- Shell/Bash - Deployment and automation scripts
## Runtime
- Node.js 20+ - Server runtime via Express
- npm - Lockfile: present (package-lock.json)
## Frameworks
- Express 4.21.2 - HTTP server framework
- React 18.3.1 - Frontend UI library
- Vite 5.4.15 - Build tool and dev server
- Drizzle ORM 0.39.1 - Type-safe database layer with migrations via Drizzle Kit 0.30.4
- Radix UI (multiple packages @radix-ui/*) - Unstyled, accessible component primitives
- shadcn/ui (via @replit/vite-plugin-shadcn-theme-json) - Styled component library built on Radix
- Tailwind CSS 3.4.14 - Utility-first CSS framework
- Framer Motion 11.13.1 - Animation library
- Wouter 3.3.5 - Client-side routing (lightweight alternative to React Router)
- TanStack Query (@tanstack/react-query) 5.60.5 - Server state management
- React Hook Form 7.53.1 - Form state management
- Zod 3.25.76 - Schema validation library
- drizzle-zod 0.7.1 - Zod schema generation from Drizzle ORM
- Not detected in current dependencies
- esbuild 0.25.0 - Fast JavaScript bundler (production builds)
- tsx 4.19.1 - TypeScript runner for scripts
- Tailwind CSS Animate 1.0.7 - Tailwind animation utilities
- Class Variance Authority 0.7.0 - Type-safe component variant patterns
- PostCSS 8.4.47 - CSS processing with Autoprefixer 10.4.20
- @vitejs/plugin-react 4.3.2 - React Fast Refresh for Vite
- @replit/vite-plugin-runtime-error-modal - Runtime error overlay (Replit-specific)
- @replit/vite-plugin-cartographer - Dev tools plugin (Replit-specific)
- @replit/vite-plugin-shadcn-theme-json - shadcn theme JSON integration
## Key Dependencies
- @anthropic-ai/sdk 0.37.0 - Primary AI provider (Claude models)
- firebase 11.6.0 - Client-side Firebase Auth SDK
- firebase-admin 13.2.0 - Server-side Firebase Admin SDK
- @neondatabase/serverless 0.10.4 - Neon PostgreSQL serverless client
- postgres 3.4.5 - Native PostgreSQL driver for Drizzle
- @google/generative-ai 0.24.0 - Google Gemini API
- openai 4.96.2 - OpenAI API (gpt-4o and DALL-E)
- googleapis 171.4.0 - Google APIs client (Gmail, Google Calendar, Google Tasks OAuth)
- axios 1.13.5 - HTTP client
- passport 0.7.0 - Authentication middleware
- passport-local 1.0.0 - Local username/password strategy
- express-session 1.18.1 - Session middleware
- connect-pg-simple 10.0.0 - PostgreSQL session store
- firebase (both client & admin) - OAuth via Firebase Auth
- date-fns 3.6.0 - Date manipulation
- react-beautiful-dnd 13.1.1 - Drag and drop (Kanban boards)
- recharts 2.13.0 - Data visualization
- lucide-react 0.453.0 - Icon library
- react-icons 5.4.0 - Alternative icon library
- form-data 2.5.4 - Multipart form data handling
- fast-xml-parser 5.3.6 - XML parsing
- jws 3.2.3 - JSON Web Signature signing
- node-forge 1.3.2 - JavaScript cryptography library
- input-otp 1.2.4 - OTP input component
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 2.5.4 - Tailwind class deduplication
- ws 8.18.0 - WebSocket library
- @types/ws 8.5.13 - TypeScript definitions for ws
- p-limit 7.3.0 - Concurrency control
- p-retry 7.1.1 - Retry logic for failed promises
- memorystore 1.6.7 - In-memory session store (development fallback)
- embla-carousel-react 8.3.0 - Headless carousel component
- react-resizable-panels 2.1.4 - Resizable panel layouts
- vaul 1.1.0 - Drawer component
- react-day-picker 8.10.1 - Date picker
- cmdk 1.0.0 - Command menu component
- glob 11.1.0 - File globbing
- qs 6.14.1 - Query string parser
- remixicon 4.6.0 - Icon set
## Configuration
- Configured via `.env` file (not committed)
- Vite uses `VITE_` prefix for environment variables exposed to client
- Firebase config accessed via: `VITE_FIREBASE_*` variables
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `VITE_FIREBASE_API_KEY` - Firebase client API key
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (base64 or raw)
- `FIREBASE_CLIENT_EMAIL` - Firebase client email (fallback)
- `FIREBASE_PRIVATE_KEY` - Firebase private key (fallback)
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` - Claude API key
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` - Claude API base URL
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `PERPLEXITY_API_KEY` - Perplexity API key (optional)
- `XAI_API_KEY` - X.AI API key (optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI
- `tsconfig.json` - TypeScript compiler options with path aliases
- `vite.config.ts` - Vite build and dev server config
- `drizzle.config.ts` - Drizzle ORM migrations config
- `tailwind.config.ts` - Tailwind CSS theme and plugin config
- `postcss.config.js` - PostCSS plugins (Tailwind, Autoprefixer)
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@` → `./client/src`
- `@shared` → `./shared`
- `@assets` → `./attached_assets`
## Platform Requirements
- Node.js 20+
- npm
- TypeScript 5.6.3 (dev dependency)
- Node.js 20+ runtime
- PostgreSQL database (Neon serverless recommended)
- Firebase project configured
- AI API keys configured (Anthropic minimum)
- Google OAuth credentials (for Gmail integration)
- ESM (ECMAScript modules) format
- Client builds to `dist/public/` (served as static assets)
- Server builds to `dist/index.js` (Node.js executable)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Kebab-case for component files: `use-auth.tsx`, `protected-route.tsx`, `company-guard.tsx`
- Kebab-case for utilities and hooks: `use-company.ts`, `use-ai-models.ts`
- PascalCase for React component exports (files themselves are kebab-case)
- Page files follow kebab-case: `auth-page.tsx`, `dashboard.tsx`, `task-board-page.tsx`
- camelCase for function names: `generateResponse()`, `comparePasswords()`, `shouldEscalateToSonnet()`
- Custom hooks use `use` prefix: `useAuth()`, `useCompany()`, `useToast()`
- Factory/utility functions: `createUserWithEmailAndPassword()`, `getMultiFactorResolver()`
- Database/API layer: `getUserByUsername()`, `createUser()`, `getUser()`
- camelCase: `firebaseUser`, `isLoading`, `mfaResolver`, `sessionSettings`
- Boolean flags: `isLoading`, `hasCompany`, `isFirebaseConfigured()`, `shouldEscalateToSonnet()`
- Constants use UPPER_SNAKE_CASE: `SESSION_SECRET`, `COMPLEXITY_KEYWORDS`
- Arrays/collections: `collaboratorIds`, `agentIcons`, `departments`, `allowedKeys`
- PascalCase: `AuthContextType`, `LoginData`, `FirebaseLoginData`, `UserWithoutPassword`
- Generic parameters: single letters or descriptive names
## Code Style
- No external formatter configured (prettier not found)
- Tailwind CSS utility classes for styling
- Explicit import grouping
- 2-space indentation (TypeScript default)
- No ESLint config found
- TypeScript strict mode: `strict: true` in `tsconfig.json`
## Import Organization
- `@/*` maps to `./client/src/*`
- `@shared/*` maps to `./shared/*`
## Error Handling
- Try-catch blocks for async operations
- Explicit error checks before using optional values
- Descriptive error messages
- HTTP status codes: 400, 401, 403, 404, 500
- Client mutations display errors via toast()
- Firebase errors checked with specific code checks
## Logging
- Log errors with context: `console.error("Error syncing Firebase user:", err)`
- Use toast for success messages, not console
- No centralized logging service
## Comments
- Explain complex logic or non-obvious decisions
- Mark implementation gaps
- Describe why, not what
- Flag incomplete API endpoints
- Single-line comments for clarification
- Multi-line for complex blocks
- NO JSDoc/TSDoc patterns in codebase
## Function Design
- Average 20-50 lines per function
- Larger functions split into helpers
- Async handlers use try-catch in mutation callbacks
- Destructured object parameters
- Type annotations always present: `(email: string): Promise<void>`
- Optional marked with `?`: `icon?: string`
- Explicit return types: `async (): Promise<void>`, `(): Promise<string>`
- Objects from custom hooks: `{ company, hasCompany, isLoading }`
## Module Design
- Named exports for utilities: `export function useAuth() { ... }`
- Default exports for pages: `export default Dashboard`
- Barrel files not heavily used
- Context with explicit type: `createContext<AuthContextType | null>(null)`
- Provider and hook exported together
- Hook validates usage: `if (!context) throw new Error(...)`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Client and server share type definitions via `@shared/schema` (no code duplication, single source of truth)
- Multi-provider AI abstraction layer supporting Anthropic, OpenAI, Perplexity, XAI, Gemini
- Role-based entity hierarchy: Users → Companies → Agents → Tasks
- Protection layers: Authentication → Company validation → Route protection
- Pluggable integrations (Gmail, external services)
## Layers
- Purpose: React UI with component-based architecture, handles routing and state management
- Location: `client/src/`
- Contains: Pages (`pages/`), reusable components (`components/`), hooks, UI primitives, routing logic
- Depends on: TanStack Query (server state), Zustand (local state where needed), Wouter (routing)
- Used by: End users via browser
- Purpose: Authentication context, company management, custom hooks
- Location: `client/src/hooks/` and `client/src/lib/`
- Contains: `use-auth.tsx` (Firebase + session auth), `use-company.ts` (company state), protection components
- Depends on: Firebase SDK, server API
- Used by: Pages and components
- Purpose: Express routes handling all business logic, data validation, orchestration
- Location: `server/routes.ts` (primary, 89KB monolithic file)
- Contains: 40+ endpoints for users, agents, tasks, companies, workflows, integrations, CRM, documents
- Depends on: Database, Auth service, AI services, Storage layer
- Used by: Client via HTTP, external webhooks
- Purpose: Drizzle ORM with type-safe database operations
- Location: `server/db.ts`, `shared/schema.ts`
- Contains: Postgres schema definitions, Zod validation schemas, type exports
- Depends on: PostgreSQL via Neon (serverless), Drizzle Kit for migrations
- Used by: Routes, Storage layer
- Purpose: Domain-specific business logic abstraction
- Location: `server/services/`, `server/ai/`, `server/integrations/`
- Contains:
- Depends on: Database, external APIs, Passport.js
- Used by: Routes
- Purpose: In-memory cache + database persistence wrapper
- Location: `server/storage.ts` (51KB file with all CRUD operations)
- Contains: Functions for users, agents, tasks, messages, agents metrics, actions, CRM, documents
- Depends on: Drizzle ORM, database
- Used by: Routes, Services
- Purpose: Type and schema definitions shared between client and server
- Location: `shared/schema.ts` (21KB)
- Contains: Drizzle table definitions, Zod validation schemas, TypeScript type exports
- Depends on: Drizzle, Zod
- Used by: All layers (client + server)
## Data Flow
- Single source of truth: PostgreSQL database via Drizzle ORM
- In-memory cache layer in `storage.ts` for performance (optional)
- TanStack Query manages server state with caching and synchronization
- Query keys follow pattern: `/api/endpoint`
- Automatic refetch on focus, mutation updates cache
- No global state management (minimal Zustand usage)
## Key Abstractions
- Purpose: Unified interface for multiple AI providers
- Examples: `server/ai/openai-service.ts`, `server/ai/anthropic-service.ts`, `server/ai/gemini-service.ts`
- Pattern: Each service implements `generateResponse()`, `analyzeImage()`, `generateImage()` methods
- Usage: Routes call `generateAIResponse()` which delegates to appropriate service based on model selection
- Purpose: Encapsulates agent personality, instructions, knowledge base
- Examples: Knowledge base text, behavioral style, KPIs, role level (Chief/Manager/Laborer)
- Pattern: Stored as text fields in `agents` table, concatenated into system prompt for AI
- Usage: Sent with every message to maintain consistent agent personality across conversations
- Purpose: Multi-tenant isolation and scoping
- Pattern: Every operation checks company ownership before returning data
- Usage: `CompanyGate` wrapper prevents access to company features without active company, routes validate company ID from request
- Purpose: Deferred execution of agent-generated tasks (email, document creation)
- Pattern: Generated by AI, reviewed by user, executed asynchronously
- Status flow: pending → executing → completed/failed
- Retry logic: Up to 3 retries before failure, tracks execution metadata
## Entry Points
- Location: `server/index.ts`
- Triggers: Application startup via `npm run dev` or `npm start`
- Responsibilities:
- Location: `client/src/main.tsx`
- Triggers: Browser load
- Responsibilities: Renders React app into DOM
- Location: `client/src/App.tsx` (Router component within App)
- Triggers: On route change
- Responsibilities:
## Error Handling
- Routes try/catch with typed error responses
- Validation errors use Zod error messages
- 401 for auth failures, 404 for not found, 500 for server errors
- Error logged with request path, duration, status code
- TanStack Query catches errors and stores in error state
- Toast notifications display errors to user
- 401 responses trigger auth context refetch
- Network errors show generic "Failed to..." message
## Cross-Cutting Concerns
- Server: All POST/PUT requests validated with Zod schemas
- Client: React Hook Form with Zod resolvers on forms
- Patterns: `insertAgentSchema`, `updateTaskSchema`, etc. shared via `@shared/schema`
- Firebase Auth for OAuth (Google, Apple)
- Passport.js + bcrypt for email/password
- express-session middleware checks `req.isAuthenticated()`
- Routes decorated with `setupAuth(app)` function in `server/auth.ts`
- Company-level: Routes check `companiesTable.ownerUserId === req.user.id`
- Agent-level: Routes verify agent belongs to user's company
- Task-level: Routes verify task assigned to user's company
- No role-based access control (RBAC) implemented - flat permission model
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Session Settings

- **Thinking mode:** Always use maximum thinking/extended reasoning effort
- **Model preference:** Use claude-opus-4-6 for all complex tasks
- **Bash auto-approve:** Execute bash commands without asking for confirmation each time
