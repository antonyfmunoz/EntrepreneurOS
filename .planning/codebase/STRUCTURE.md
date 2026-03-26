# Codebase Structure

**Analysis Date:** 2026-03-25

## Directory Layout

```
EntrepreneurOS/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page components (route targets)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities, helpers, protected route HOC
│   │   ├── App.tsx         # Root router component
│   │   └── main.tsx        # Entry point, DOM mount
│   └── public/             # Static assets
├── server/                 # Express backend application
│   ├── ai/                 # Multi-provider AI abstraction layer
│   ├── services/           # Business logic services
│   ├── integrations/       # External service clients (Gmail, etc.)
│   ├── routes.ts           # All API route definitions (89KB monolithic)
│   ├── auth.ts             # Authentication setup and middleware
│   ├── db.ts               # Drizzle ORM instance
│   ├── storage.ts          # CRUD wrapper around database (51KB)
│   ├── index.ts            # Express app setup, entry point
│   ├── firebase.ts         # Firebase admin SDK setup
│   ├── openai.ts           # Deprecated OpenAI-specific code
│   └── vite.ts             # Vite middleware configuration
├── shared/                 # Shared code between client and server
│   ├── schema.ts           # Drizzle table definitions, Zod schemas, types
│   └── models/             # (unused)
├── migrations/             # Drizzle Kit migration files
│   └── meta/               # Migration metadata
├── .planning/              # GSD planning documents
│   └── codebase/           # This location
├── scripts/                # Build/utility scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── drizzle.config.ts       # Drizzle Kit configuration
├── package.json            # Node.js dependencies
└── .env                    # Environment variables (not committed)
```

## Directory Purposes

**client/src/:**
- Purpose: React application source code
- Contains: Components, pages, hooks, utilities, styling
- Key files: `App.tsx` (router), `main.tsx` (entry), `index.css` (Tailwind imports)

**client/src/components/:**
- Purpose: Reusable React components (both UI and feature-specific)
- Contains: Agent cards, task board, chat interface, modals, dialogs, sidebar, header
- Naming: Descriptive kebab-case files like `agent-card.tsx`, `task-board.tsx`, `create-agent-modal.tsx`
- Subdirectory `ui/`: shadcn/ui primitive components (Button, Dialog, Card, etc.)

**client/src/pages/:**
- Purpose: Route target components (one per major page in app)
- Contains: `dashboard.tsx`, `agent-chat.tsx`, `agent-programming.tsx`, `crm-page.tsx`, `documents-page.tsx`, `settings-page.tsx`, `auth-page.tsx`, `company-setup-page.tsx`
- Pattern: Pages compose smaller components, handle routing params, manage page-level state
- Special: `backup/` contains old/deprecated pages not currently used

**client/src/hooks/:**
- Purpose: Custom React hooks for state and data management
- Contains: `use-auth.tsx` (login/register/logout), `use-company.ts` (company state), `use-notifications.tsx` (notification polling), `use-ai-models.ts`, `use-ai-api-keys.ts`
- Pattern: Hooks use TanStack Query for server state, Context API for auth

**client/src/lib/:**
- Purpose: Utilities, helpers, and HOCs
- Contains: `protected-route.tsx` (auth guard), `company-guard.tsx` (company validation), `firebase.ts` (SDK), `queryClient.ts` (TanStack Query config), `llmApi.ts`, `openai.ts`
- Exports: `apiRequest()` utility for fetch with credentials, `queryClient` singleton

**server/:**
- Purpose: Express backend application
- Entry: `index.ts` (starts HTTP server)
- Config: `drizzle.config.ts` defines database and migration paths

**server/ai/:**
- Purpose: Unified AI provider abstraction
- Contains: `index.ts` (main interface + service factory), individual service files
- Services: `openai-service.ts`, `anthropic-service.ts`, `gemini-service.ts`, `perplexity-service.ts`, `xai-service.ts`
- Exports: `generateAIResponse()`, `getAvailableProviders()`, `getModelInfo()`, `AIServiceInterface` type

**server/services/:**
- Purpose: Encapsulated business logic
- Currently contains: `action-executor.ts` (processes approved actions - email, document, task creation)
- Pattern: Async functions that orchestrate operations, handle retries, update metrics

**server/integrations/:**
- Purpose: External API clients
- Currently contains: `gmail.ts` (Gmail OAuth, send email)
- Pattern: OAuth token management, async API operations with error handling

**shared/schema.ts:**
- Purpose: Single source of truth for data models
- Contains: 15+ Drizzle table definitions + 30+ Zod validation schemas
- Tables: `users`, `companies`, `agents`, `tasks`, `messages`, `notifications`, `crmContacts`, `crmDeals`, `crmActivities`, `documents`, `folders`, `agentActions`, `workflows`, `oauthTokens`, `agentMetrics`
- Patterns: Each table has `insertXSchema` (Zod) + type export via `z.infer<typeof insertXSchema>`

**migrations/:**
- Purpose: Database schema migrations
- Contains: SQL files generated by Drizzle Kit
- Committed: Yes (version control for schema changes)
- Generated: By `npm run db:push` command

## Key File Locations

**Entry Points:**
- `server/index.ts`: HTTP server bootstrap (Express app, route registration, Vite setup)
- `client/src/main.tsx`: React DOM mount point
- `client/src/App.tsx`: Root router and auth state management

**Configuration:**
- `tsconfig.json`: TypeScript compiler options, path aliases (`@/*` → `client/src/*`, `@shared/*` → `shared/*`)
- `vite.config.ts`: Vite build config, path aliases, Tailwind plugin
- `drizzle.config.ts`: Database URL, migration folder, schema file
- `tailwind.config.ts`: Tailwind CSS configuration

**Core Logic:**
- `shared/schema.ts`: Data model definitions (41KB)
- `server/routes.ts`: All API endpoints (89KB monolithic file)
- `server/storage.ts`: Database CRUD operations wrapper (51KB)
- `server/auth.ts`: Passport.js setup, auth middleware
- `server/ai/index.ts`: AI provider abstraction factory

**Authentication & Guards:**
- `client/src/hooks/use-auth.tsx`: Auth context, login/register/logout
- `client/src/hooks/use-company.ts`: Company ownership validation
- `client/src/lib/protected-route.tsx`: Auth guard HOC for routes
- `client/src/lib/company-guard.tsx`: Company validation HOC for page content

## Naming Conventions

**Files:**
- React components: kebab-case (e.g., `agent-card.tsx`, `create-agent-modal.tsx`)
- Utilities/hooks: kebab-case (e.g., `use-auth.tsx`, `query-client.ts`)
- Services: kebab-case (e.g., `action-executor.ts`)
- Pages: kebab-case with -page suffix (e.g., `dashboard.tsx`, `agent-programming.tsx`)

**Directories:**
- camelCase for feature domains (e.g., `replit_integrations`, `server/ai`, `server/services`)
- `ui/` subdirectory for UI primitives
- `pages/` for route targets
- `components/` for reusable feature components

**Functions & Variables:**
- camelCase for all functions and variables
- Prefix hooks with `use` (React convention)
- Export types with `Insert` prefix for Zod schemas (e.g., `InsertAgent`, `InsertTask`)

**Database:**
- snake_case for column names in Drizzle tables
- PascalCase for TypeScript types derived from tables (e.g., `Agent`, `Task`, `User`)
- `XSchema` naming for Zod schemas (e.g., `insertAgentSchema`, `updateTaskSchema`)

## Where to Add New Code

**New Feature (e.g., Reports):**
- Primary code: `server/routes.ts` (add POST/GET endpoints)
- Schema: Add table definition + Zod schemas to `shared/schema.ts`
- Storage: Add CRUD functions to `server/storage.ts`
- Client page: Create `client/src/pages/reports-page.tsx`
- Components: Create feature components in `client/src/components/` (e.g., `reports-chart.tsx`, `reports-filters.tsx`)
- Hooks: Add data fetching hook in `client/src/hooks/` if needed
- Route: Add route definition in `client/src/App.tsx` Router component, wrap with `ProtectedRoute` + `CompanyGate` if company-required

**New UI Component:**
- General use: `client/src/components/my-component.tsx` (kebab-case filename)
- If purely UI primitive: Add to `client/src/components/ui/`
- Export from component file

**New Integration (e.g., Slack):**
- Service client: Create `server/integrations/slack.ts`
- OAuth handling: Implement token storage using `oauthTokens` table
- Routes: Add connection/disconnect endpoints in `server/routes.ts`
- Status endpoint: Add to `/api/integrations` status checking

**New AI Provider:**
- Service: Create `server/ai/newprovider-service.ts` implementing `AIServiceInterface`
- Registration: Update `getService()` factory in `server/ai/index.ts`
- Models: Add to `AIModelName` type and `defaultConfigs` object
- Config: Add environment variable for API key

**New Service/Business Logic:**
- Location: Create `server/services/my-service.ts`
- Pattern: Export async functions that receive database context and parameters
- Usage: Import and call from `server/routes.ts` route handlers

**Tests:**
- Currently not present in codebase
- Pattern to follow: Collocate test files (e.g., `agent-card.test.tsx`, `action-executor.test.ts`)
- Consider adding Jest/Vitest config when testing becomes priority

## Special Directories

**attached_assets/:**
- Purpose: Static image/asset files
- Contains: `generated-icon.png`
- Generated: Yes
- Committed: Yes (small assets)

**migrations/meta/:**
- Purpose: Drizzle Kit migration metadata
- Generated: Yes (by Drizzle Kit on `npm run db:push`)
- Committed: Yes

**.planning/codebase/:**
- Purpose: GSD analysis documents
- Generated: Yes (by Claude via GSD commands)
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**.cursor/, .memory/, .features/:**
- Purpose: Claude Code context and memory files
- Generated: Yes
- Not committed: .cursor/.memory/.features in .gitignore

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes
- Not committed: In .gitignore

**dist/:**
- Purpose: Production build output
- Generated: Yes (by `npm run build`)
- Not committed: In .gitignore

---

*Structure analysis: 2026-03-25*
