# EntrepreneurOS — Repository Technical Map

Generated: 2026-03-12

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Database Schema](#2-database-schema)
3. [Backend Route Groups](#3-backend-route-groups)
4. [Frontend Pages](#4-frontend-pages)
5. [Feature → Database Table Mapping](#5-feature--database-table-mapping)
6. [Page → API Call Mapping](#6-page--api-call-mapping)
7. [Agent Dependency Map](#7-agent-dependency-map)
8. [MVP Readiness Assessment](#8-mvp-readiness-assessment)

---

## 1. Project Structure

```
EntrepreneurOS/
├── client/                         # React 18 SPA (Vite + TypeScript)
│   └── src/
│       ├── pages/                  # 14 route-level page components
│       ├── components/             # 60+ UI + custom components
│       │   └── ui/                 # Shadcn/Radix UI primitives
│       ├── hooks/                  # Auth, notifications, AI model hooks
│       └── lib/                    # Firebase, queryClient, LLM API clients
├── server/                         # Express.js API (TypeScript)
│   ├── ai/                         # 5 AI provider service classes
│   ├── services/                   # actionExecutor.ts
│   ├── integrations/               # Gmail OAuth
│   ├── replit_integrations/        # Replit chat + batch modules
│   ├── routes.ts                   # All API route definitions (~2,400 lines)
│   ├── auth.ts                     # Passport.js setup
│   ├── storage.ts                  # Data access layer / IStorage interface (~1,500 lines)
│   ├── db.ts                       # Drizzle ORM + Neon DB connection
│   └── index.ts                    # Server bootstrap
├── shared/
│   └── schema.ts                   # Single source of truth: Drizzle tables + Zod schemas
├── migrations/                     # Auto-generated Drizzle migrations
└── scripts/                        # Utility scripts
```

**Tech Stack**

| Concern | Technology |
|---------|-----------|
| Frontend framework | React 18.3 + TypeScript 5.6 |
| Build tool | Vite 5.4 |
| Routing | Wouter |
| Server state | TanStack React Query 5.60 |
| Forms | React Hook Form 7.53 + Zod |
| UI primitives | Radix UI (Shadcn) |
| Styling | TailwindCSS 3.4 + CSS variables |
| Animation | Framer Motion |
| Backend framework | Express.js 4.21 + Node.js 20 |
| ORM | Drizzle ORM 0.39 |
| Database | PostgreSQL 16 via Neon (serverless) |
| Authentication | Passport.js (local) + Firebase Admin SDK |
| Session storage | connect-pg-simple (DB-backed) |
| Deployment | Replit |

---

## 2. Database Schema

All tables are defined in `shared/schema.ts`. Migrations live in `migrations/`.

### 2.1 User & Auth

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| username | text UNIQUE | |
| password | text | scrypt hash + salt |
| email | text | |
| fullName | text | |
| avatar | text | URL |
| company | text | |
| role | text | |
| firebaseUid | text UNIQUE | Firebase/Google auth link |
| preferences | json | User UI preferences |
| metadata | jsonb | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `session`
Managed by `connect-pg-simple`. Stores Express session data keyed by session ID.

---

### 2.2 Agent System

#### `agents`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | text | Display name |
| role | text | Job title/role |
| roleLevel | text | `chief` / `manager` / `laborer` |
| department | text | |
| icon | text | Lucide icon name |
| instructions | text | System prompt / behavior rules |
| brainContent | text | Long-form memory / knowledge |
| knowledgeBase | text | Domain knowledge |
| kpis | json | Key performance indicators |
| behavioralStyle | text | |
| latestActivity | text | Last action description |
| isActive | boolean | default true |
| simulationMode | boolean | Sandbox mode flag |
| parentAgentId | integer FK→agents | Hierarchical agent tree |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `agentActions`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| agentId | integer FK→agents | |
| userId | integer FK→users | |
| actionType | text | e.g. `send_email`, `create_task` |
| actionName | text | Human-readable label |
| description | text | |
| parameters | jsonb | Action payload |
| status | text | `pending` / `approved` / `executing` / `completed` / `failed` / `rejected` |
| requiresApproval | boolean | Human-in-the-loop gate |
| approvedBy | integer FK→users | |
| approvedAt | timestamp | |
| executedAt | timestamp | |
| completedAt | timestamp | |
| failedAt | timestamp | |
| executionResult | jsonb | |
| errorMessage | text | |
| retryCount | integer | |
| maxRetries | integer | |
| taskId | integer FK→tasks | |
| conversationId | text | |
| estimatedTimeSaved | integer | Minutes |
| priority | text | `low` / `medium` / `high` / `urgent` |
| tags | text[] | |
| metadata | jsonb | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `agentMetrics`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| agentId | integer FK→agents | |
| userId | integer FK→users | |
| date | date | Metrics period |
| messagesSent | integer | |
| messagesReceived | integer | |
| tasksCompleted | integer | |
| actionsExecuted | integer | |
| tokensUsed | integer | |
| apiCost | decimal | |
| estimatedTimeSavedMinutes | integer | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### 2.3 Task Management

#### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| title | text | |
| description | text | |
| status | text | `todo` / `in-progress` / `done` |
| priority | text | `low` / `medium` / `high` / `urgent` |
| startDate | timestamp | |
| dueDate | timestamp | |
| instructions | text | Detailed work instructions |
| agentId | integer FK→agents | Primary assigned agent |
| assignedById | integer FK→agents | Who delegated the task |
| collaboratorIds | text | Comma-separated agent IDs |
| taskType | text | `standard` / `collaboration` / `delegated` |
| parentTaskId | integer FK→tasks | Subtask hierarchy |
| metadata | json | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### 2.4 Messaging

#### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| agentId | integer FK→agents | |
| taskId | integer FK→tasks | |
| conversationId | text | Groups messages into threads |
| role | text | `user` / `assistant` / `system` |
| content | text | |
| metadata | json | |
| referencedAgentIds | text | Comma-separated agent IDs mentioned |
| timestamp | timestamp | |

#### `aiMessages`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| role | text | `user` / `assistant` |
| content | text | |
| timestamp | timestamp | |

---

### 2.5 CRM

#### `crmContacts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | Owner |
| name | text | |
| email | text | |
| phone | text | |
| company | text | |
| title | text | Job title |
| status | text | `lead` / `prospect` / `customer` / `churned` |
| lastContact | timestamp | |
| notes | text | |
| avatar | text | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `crmDeals`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| title | text | |
| company | text | |
| value | decimal | Deal monetary value |
| stage | text | `discovery` / `proposal` / `negotiation` / `closed-won` / `closed-lost` |
| probability | integer | 0–100 |
| expectedCloseDate | timestamp | |
| contactId | integer FK→crmContacts | |
| assignedAgentId | integer FK→agents | AI agent working this deal |
| notes | text | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `crmActivities`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| type | text | `email` / `call` / `meeting` / `task` / `note` |
| subject | text | |
| date | timestamp | |
| completed | boolean | |
| relatedToType | text | `contact` / `deal` |
| relatedToId | integer | Polymorphic FK |
| createdByAgentId | integer FK→agents | |
| notes | text | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### 2.6 Documents

#### `folders`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| name | text | |
| parentId | integer FK→folders | Self-referencing hierarchy |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `documents`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| title | text | |
| content | text | Full document body |
| folderId | integer FK→folders | |
| tags | text[] | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### 2.7 Integrations & OAuth

#### `integrations`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | text | Service name |
| type | text | Category |
| status | text | `connected` / `disconnected` |
| details | json | Provider-specific config |
| icon | text | |

#### `oauthTokens`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| provider | text | e.g. `gmail` |
| accessToken | text | |
| refreshToken | text | |
| tokenType | text | |
| expiresAt | timestamp | |
| scope | text | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### 2.8 Notifications

#### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | integer FK→users | |
| title | text | |
| content | text | |
| type | text | Notification category |
| read | boolean | default false |
| href | text | Navigation path on click |
| relatedId | integer | Related entity ID |
| metadata | jsonb | |
| createdAt | timestamp | |

---

### Schema Relationship Diagram (text)

```
users ──────┬──── agents (parentAgentId → agents)
            │         │
            │         ├──── agentActions ──── tasks
            │         ├──── agentMetrics
            │         ├──── tasks (agentId)
            │         ├──── messages
            │         ├──── crmDeals (assignedAgentId)
            │         └──── crmActivities (createdByAgentId)
            │
            ├──── aiMessages
            ├──── crmContacts ──── crmDeals ──── crmActivities
            ├──── folders (parentId → folders)
            │         └──── documents
            ├──── oauthTokens
            └──── notifications
```

---

## 3. Backend Route Groups

All routes defined in `server/routes.ts` and `server/auth.ts`. Server runs on port 5000.

### 3.1 Auth — `server/auth.ts`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Create local account |
| POST | `/api/login` | Local password login |
| POST | `/api/logout` | Destroy session |
| GET | `/api/user` | Get current user |
| POST | `/api/auth/firebase` | Verify Firebase ID token → session |

### 3.2 AI Models

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/models` | List all models across all providers |
| GET | `/api/ai/provider-status` | Which providers are currently configured |
| POST | `/api/keys/save` | Save API keys (dev only) |
| POST | `/api/ai/generate` | Generic AI response (any provider/model) |
| POST | `/api/ai/multi-agent` | Multi-agent collaboration response |

### 3.3 Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all agents with their tasks |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/:id` | Get single agent |
| PATCH | `/api/agents/:id` | Update agent properties |
| GET | `/api/agents/:id/messages` | Conversation history |
| POST | `/api/agents/:id/clear-messages` | Clear conversation |
| POST | `/api/agents/:id/chat` | Send message → get AI response |
| GET | `/api/agents/:id/tasks` | Tasks assigned to agent |
| POST | `/api/agents/:id/generate-response` | Generate response with agent brain |
| GET | `/api/agents/:id/collaborative-tasks` | Tasks where agent is collaborator |
| GET | `/api/agents/:id/metrics` | Agent performance metrics |

### 3.4 Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get single task |
| PATCH | `/api/tasks/:id` | Update status/details |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/assign` | Assign task to agent |
| POST | `/api/tasks/:id/collaborators` | Add agent as collaborator |
| POST | `/api/tasks/:id/subtask` | Create subtask |
| GET | `/api/tasks/:id/subtasks` | Get subtasks |
| GET | `/api/tasks/:id/messages` | Task-related messages |

### 3.5 Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/conversations/:id` | Get conversation + messages |

### 3.6 Agent Actions (Approval Workflow)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/actions` | List actions (filterable by status/agentId) |
| GET | `/api/actions/pending` | Pending approval queue |
| GET | `/api/actions/:id` | Single action detail |
| POST | `/api/actions/:id/approve` | Approve and execute |
| POST | `/api/actions/:id/reject` | Reject action |

### 3.7 CRM

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/crm/contacts` | List contacts |
| POST | `/api/crm/contacts` | Create contact |
| PATCH | `/api/crm/contacts/:id` | Update contact |
| GET | `/api/crm/deals` | List deals |
| POST | `/api/crm/deals` | Create deal |
| PATCH | `/api/crm/deals/:id` | Update deal |
| GET | `/api/crm/activities` | List activities |
| POST | `/api/crm/activities` | Log activity |
| PATCH | `/api/crm/activities/:id` | Update activity |

### 3.8 Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/folders` | List folders |
| POST | `/api/folders` | Create folder |
| PATCH | `/api/folders/:id` | Update folder |
| DELETE | `/api/folders/:id` | Delete folder |
| GET | `/api/documents` | List documents |
| POST | `/api/documents` | Create document |
| PATCH | `/api/documents/:id` | Update document |
| DELETE | `/api/documents/:id` | Delete document |

### 3.9 Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List user notifications |
| GET | `/api/notifications/count` | Unread count |
| POST | `/api/notifications/:id/read` | Mark single as read |
| POST | `/api/notifications/read-all` | Bulk mark read |
| DELETE | `/api/notifications/:id` | Delete notification |

### 3.10 Analytics & Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Dashboard KPI counts |
| GET | `/api/analytics` | Detailed agent + task analytics |

### 3.11 Integrations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations` | Retired unscoped catalog read (returns 410) |
| POST | `/api/integrations/connect` | Retired unscoped catalog mutation (returns 410) |
| GET | `/api/integrations/gmail/auth` | Gmail OAuth start URL |
| GET | `/api/auth/google/callback` | OAuth callback handler |
| GET | `/api/integrations/gmail/status` | Gmail connection status |
| POST | `/api/integrations/gmail/disconnect` | Disconnect Gmail |

### 3.12 AI Assistant (Direct LLM Chat)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai-assistant/messages` | Load chat history |
| POST | `/api/ai-assistant/messages` | Save messages |
| DELETE | `/api/ai-assistant/messages` | Clear history |
| POST | `/api/llm/chat` | Send to Anthropic Claude, log to aiMessages |

---

## 4. Frontend Pages

All routes defined in `client/src/App.tsx`. All are protected (require auth) except `/auth`.

| Route | File | Lines | Description |
|-------|------|-------|-------------|
| `/` | `pages/dashboard.tsx` | 52 | Redirects to agent-os-dashboard |
| `/tasks` | `pages/task-board-page.tsx` | 12 | Kanban board (wraps TaskBoard component) |
| `/chat/:agentId` | `pages/agent-chat.tsx` | 873 | Agent conversation + task sidebar |
| `/agent-chat/:agentId` | `pages/agent-chat.tsx` | — | Alias for above |
| `/agent-programming/:agentId` | `pages/agent-programming.tsx` | 663 | Agent config editor |
| `/agent-programming` | `pages/agent-programming.tsx` | — | Create new agent |
| `/crm` | `pages/crm-page.tsx` | 1182 | Full CRM (contacts, deals, activities tabs) |
| `/documents` | `pages/documents-page.tsx` | 1275 | Document manager + folder tree |
| `/integrations` | `pages/integrations-page.tsx` | 87 | Integration management |
| `/analytics` | `pages/analytics-page.tsx` | 16 | Delegates to PerformanceAnalytics component |
| `/settings` | `pages/settings-page.tsx` | 380 | Profile, security (MFA), Firebase |
| `/notifications` | `pages/notifications-page.tsx` | 256 | Notification inbox (tabs: all/unread/read) |
| `/support` | `pages/support-page.tsx` | 247 | Help + documentation |
| `/tutorials` | `pages/tutorials-page.tsx` | 213 | Onboarding walkthroughs |
| `/auth` | `pages/auth-page.tsx` | 588 | Login / signup (local + Firebase) |

### Deprecated / Backup

- `pages/backup/` — backup copies of major pages; not routed
- `agent-os-dashboard.tsx` — currently rendered at `/` via dashboard redirect; a simpler prototype dashboard

---

## 5. Feature → Database Table Mapping

| Feature | Primary Tables | Supporting Tables |
|---------|---------------|------------------|
| User accounts & login | `users`, `session` | `oauthTokens` |
| Agent management | `agents` | — |
| Agent conversations | `messages`, `agents` | `tasks` |
| Agent AI response | `messages`, `agentMetrics` | `agents` |
| Action approval workflow | `agentActions` | `agents`, `tasks`, `users` |
| Agent performance metrics | `agentMetrics` | `agents` |
| Task board | `tasks` | `agents` |
| Subtasks / delegation | `tasks` (parentTaskId) | `agents` |
| CRM contacts | `crmContacts` | `users` |
| CRM pipeline / deals | `crmDeals` | `crmContacts`, `agents` |
| CRM activity log | `crmActivities` | `crmContacts`, `crmDeals`, `agents` |
| Documents | `documents` | `folders`, `users` |
| Folder hierarchy | `folders` (parentId) | `users` |
| Notifications | `notifications` | `users` |
| Gmail integration | `oauthTokens`, `integrations` | `agentActions` |
| Direct LLM chat | `aiMessages` | `users` |
| Analytics dashboard | `agents`, `tasks`, `messages`, `agentMetrics` | — |

---

## 6. Page → API Call Mapping

### `/` — Dashboard
- `GET /api/agents`
- `GET /api/tasks`
- `GET /api/stats`

### `/tasks` — Task Board (`TaskBoard` component)
- `GET /api/tasks`
- `GET /api/agents`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/subtask`
- `GET /api/tasks/:id/subtasks`

### `/chat/:agentId` — Agent Chat
- `GET /api/agents/:id`
- `GET /api/agents/:id/messages`
- `GET /api/agents/:id/tasks`
- `GET /api/agents` (to find executive agent)
- `POST /api/agents/:id/chat` (via `sendMessageToAgent` in `lib/openai.ts`)
- `POST /api/llm/chat` (direct Claude fallback via `callLLM` in `lib/llmApi.ts`)
- `GET /api/ai/models`
- `GET /api/ai/provider-status`

### `/agent-programming/:agentId` — Agent Editor
- `GET /api/agents/:id`
- `PATCH /api/agents/:id`
- `POST /api/agents` (create new)
- `GET /api/agents/:id/metrics`

### `/crm` — CRM
- `GET /api/crm/contacts`
- `POST /api/crm/contacts`
- `PATCH /api/crm/contacts/:id`
- `GET /api/crm/deals`
- `POST /api/crm/deals`
- `PATCH /api/crm/deals/:id`
- `GET /api/crm/activities`
- `POST /api/crm/activities`
- `PATCH /api/crm/activities/:id`
- `GET /api/agents` (for assignedAgentId dropdown)

### `/documents` — Documents
- `GET /api/folders`
- `POST /api/folders`
- `PATCH /api/folders/:id`
- `DELETE /api/folders/:id`
- `GET /api/documents`
- `POST /api/documents`
- `PATCH /api/documents/:id`
- `DELETE /api/documents/:id`

### `/analytics` — Analytics
- `GET /api/analytics`
- `GET /api/stats` (via `StatsOverview` component)
- `GET /api/agents` (agent performance data)

### `/notifications` — Notifications
- `GET /api/notifications` (via `useNotifications` hook)
- `GET /api/notifications/count`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `DELETE /api/notifications/:id`

### `/integrations` — Integrations
- `GET /api/integrations`
- `GET /api/integrations/gmail/status`
- `GET /api/integrations/gmail/auth` (redirects to Google)
- `POST /api/integrations/gmail/disconnect`

### `/settings` — Settings
- Reads from `useAuth()` hook (no extra API calls — uses session data)
- Firebase SDK calls (MFA enrollment, email verification, password reset)

### `/support`, `/tutorials`
- Static content only — no API calls

### `/auth`
- `POST /api/register`
- `POST /api/login`
- `POST /api/auth/firebase`

---

## 7. Agent Dependency Map

### Modules that REQUIRE agents to function

| Module | Why agents are required |
|--------|------------------------|
| `agent-chat.tsx` | Core loop: send message → agent brain → AI response → store in messages |
| `agent-programming.tsx` | Editing agent definitions (name, role, instructions, KPIs, brain) |
| `agentActions` / action approval | Actions are always created by and attributed to an agent |
| `agentMetrics` | Metrics are per-agent |
| `task-board.tsx` | Tasks can be assigned to agents; agent-assigned tasks show agent info |
| `crm-page.tsx` | Deals have `assignedAgentId`; activities have `createdByAgentId` |
| `messages` table | Every message row has `agentId` |
| `POST /api/ai/multi-agent` | Requires ≥2 agents to collaborate |
| `performance-analytics.tsx` | Renders per-agent performance charts |

### Modules that work WITHOUT agents

| Module | Notes |
|--------|-------|
| Auth (`/auth`) | Fully standalone |
| `aiMessages` / direct LLM chat | Tied to `userId`, not `agentId` |
| `documents` + `folders` | User-owned, no agent dependency |
| `notifications` | Generated by system; viewable without agents |
| `settings` | Firebase MFA + user profile only |
| `crmContacts` | Contact CRUD does not require agents |
| `support` + `tutorials` | Static content |

### Shared components with agent coupling

| Component | Agent Dependency |
|-----------|----------------|
| `agent-card.tsx` | Renders agent data |
| `create-agent-form.tsx` / `create-agent-modal.tsx` | Creates agents |
| `action-approval-panel.tsx` | Shows pending agentActions |
| `ai-model-selector.tsx` | Used inside agent-chat to pick model |
| `sop-template-button.tsx` | Injects templates into agent instructions |
| `agent-metrics.tsx` | Displays agentMetrics per agent |
| `stats-overview.tsx` | Counts active agents |
| `sidebar.tsx` | Links to `/chat/:agentId` for each agent |

---

## 8. MVP Readiness Assessment

### ✅ Include in EntrepreneurOS MVP (Core, working, high-value)

| Module | Rationale |
|--------|-----------|
| **Auth** (`users`, `session`, Firebase) | Required foundation. Local + Firebase auth is complete and production-ready. |
| **Agents** (CRUD + chat) | The core differentiator. `agents` table, `/api/agents`, `agent-chat.tsx`, `agent-programming.tsx` are all functional. |
| **Tasks + Task Board** | Clean kanban implementation. Works with or without agents. `tasks` table is fully modeled. |
| **Messages** | Powers agent conversation memory. Required for agent-chat. |
| **AI abstraction layer** (`server/ai/`) | 5 providers unified behind one interface. Essential for multi-model support. |
| **Action approval workflow** | `agentActions` + `/api/actions` + `action-approval-panel.tsx` — key trust/safety mechanism for autonomous agents. |
| **Notifications** | Fully functional. Backend + frontend + hook all wired. Low complexity, high utility. |
| **Direct LLM chat** (`/api/llm/chat`, `aiMessages`) | Simple, standalone. Good fallback when agent is overkill. |
| **Analytics** | `performance-analytics.tsx` + `/api/analytics` give visibility into agent + task health. Useful from day one. |

### ⚠️ Include in MVP but simplify

| Module | Current State | Recommendation |
|--------|--------------|----------------|
| **Settings** | MFA, Firebase, email verification | Keep user profile. Defer MFA unless compliance requires it. |
| **Agent metrics** (`agentMetrics`) | Implemented but data sparsely populated | Keep schema, defer rich visualization until agents run longer. |
| **Multi-agent collaboration** (`POST /api/ai/multi-agent`) | Functional but complex | Keep the endpoint; defer the UI for coordinating multiple agents. |

### 🔴 Postpone (complex, not core to MVP value prop)

| Module | Rationale |
|--------|-----------|
| **CRM** (`crmContacts`, `crmDeals`, `crmActivities`, `crm-page.tsx`) | Full CRM is a product in itself. Heavy UI (1182 lines). Defer unless CRM is the primary pitch. |
| **Documents + Folders** (`documents`, `folders`, `documents-page.tsx`) | 1275-line page. Useful eventually but not required to prove the agent-OS concept. |
| **Gmail OAuth integration** (`oauthTokens`, `server/integrations/gmail.ts`) | OAuth flow adds setup friction and compliance scope. Postpone until agents need to send real emails. |
| **Replit integrations** (`server/replit_integrations/`) | Replit-platform-specific. Not portable. Exclude from any non-Replit deployment. |
| **`agent-os-dashboard.tsx`** | Older prototype dashboard using `prompt()` dialogs. Superseded by current pages. Delete or archive. |
| **Tutorials + Support pages** | Static content. Good for launch but not core functionality. Build after MVP. |
| **`lib/llmApi.ts` (deprecated axios client)** | Calls OpenAI directly from client. Superseded by `/api/llm/chat`. Remove to consolidate. |
| **`lib/openai.ts`** | Also a client-side AI caller (`sendMessageToAgent`). Should be unified with server-side AI layer. |
| **Perplexity / xAI / Gemini providers** | Only Anthropic and OpenAI are needed for MVP. Other providers add key-management complexity. Can be toggled in via env vars when needed. |

---

## Quick Reference: Key File Locations

| What you need | Where to look |
|---------------|---------------|
| All DB tables | `shared/schema.ts` |
| All API routes | `server/routes.ts`, `server/auth.ts` |
| Data access (CRUD) | `server/storage.ts` (IStorage interface) |
| AI provider logic | `server/ai/index.ts` + `server/ai/*-service.ts` |
| Agent chat UI | `client/src/pages/agent-chat.tsx` |
| Agent brain/config UI | `client/src/pages/agent-programming.tsx` |
| Auth hook (client) | `client/src/hooks/use-auth.tsx` |
| Firebase config | `client/src/lib/firebase.ts`, `server/firebase.ts` |
| Action executor | `server/services/actionExecutor.ts` |
| Gmail OAuth | `server/integrations/gmail.ts` |
| Route declarations | `client/src/App.tsx` |
| Zod validation schemas | `shared/schema.ts` (insertXxxSchema exports) |
