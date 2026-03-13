# EntrepreneurOS — MVP Alignment Document

Generated: 2026-03-12
Source: `REPO_MAP.md` + `shared/schema.ts`

---

## The MVP Product Model

```
Founder
  └── Company
        ├── Roles          ← who does what
        ├── Workflows      ← how work gets done (SOPs, instructions)
        ├── Tasks          ← what is being done right now
        ├── Docs           ← knowledge base, playbooks, SOPs
        ├── AI Copilot     ← conversational AI across all domains
        └── Memory         ← persistent context for AI
```

The current repository was built as **AgentOS** — an autonomous agent management platform. The MVP reframes this as **EntrepreneurOS**: a company operating system where the Founder runs their business through AI-assisted Roles and Workflows. The underlying data and logic largely maps over; the mental model and navigation need to shift.

---

## 1. Feature Classification

### 1.1 KEEP — Usable Immediately for MVP

These features work today and map directly onto the MVP product model with no structural changes required.

| Current Feature | Current Location | MVP Entity | Why Keep |
|----------------|-----------------|------------|----------|
| User auth (local + Firebase) | `auth.ts`, `auth-page.tsx`, `users` table | **Founder** | Complete, production-ready. Local + Google sign-in. |
| User profile (name, email, company, role) | `users` table | **Founder** | `users.company` and `users.role` already exist. |
| Agent CRUD | `agents` table, `/api/agents`, `agent-programming.tsx` | **Roles** | Agents ARE roles. `name`, `role`, `department`, `instructions` map 1:1. Rename conceptually. |
| Agent instructions / brain | `agents.instructions`, `agents.brainContent`, `agents.knowledgeBase` | **Workflows + Memory** | Instructions = the workflow/SOP. Brain = role memory. No schema change needed. |
| Task board (kanban) | `tasks` table, `/api/tasks`, `task-board.tsx` | **Tasks** | Fully functional. Priority, status, due dates, subtasks — all present. |
| Subtask hierarchy | `tasks.parentTaskId` | **Tasks** | Already modeled. |
| Task-to-role assignment | `tasks.agentId` | **Tasks → Role** | Agent assignment becomes Role assignment. No schema change. |
| AI model abstraction layer | `server/ai/index.ts` + 5 provider services | **AI Copilot** | 5 LLM providers behind one interface. Core infrastructure. |
| Direct AI chat | `/api/llm/chat`, `aiMessages` table | **AI Copilot** | Logs conversation history per user. Clean, standalone. |
| Agent chat (role-scoped chat) | `/api/agents/:id/chat`, `messages` table | **AI Copilot** | Context-aware AI chat tied to a specific Role. |
| Notifications system | `notifications` table, `/api/notifications`, `useNotifications` hook | **System** | Fully wired: backend + frontend + React hook. |
| Documents | `documents` + `folders` tables, `/api/documents`, `/api/folders` | **Docs** | Hierarchical folder tree + full-text documents. Maps directly to Docs. |
| Session management | `session` table, `connect-pg-simple` | **System** | Infrastructure. Keep as-is. |
| Shadcn/Radix UI component library | `components/ui/` | **System** | 40+ accessible primitives. No work needed. |
| TanStack Query setup | `lib/queryClient.ts` | **System** | Data fetching layer. Keep as-is. |
| Layout + Sidebar | `components/layout.tsx`, `components/sidebar.tsx` | **Navigation** | Keep structure; update nav links to MVP entities. |

---

### 1.2 REFACTOR — Can Support MVP With Modification

These features are structurally sound but need reframing, renaming, or scoping changes to serve the MVP model.

| Current Feature | Current Issue | Required Change | MVP Entity |
|----------------|--------------|-----------------|------------|
| **`agent-programming.tsx`** | Framed as "programming an AI agent" with simulation mode, KPI tracking | Rename to **Role Editor**. Remove simulationMode toggle and KPI inputs from primary UI. Surface `instructions` as "Workflow / SOP" and `brainContent` as "Memory". | **Roles + Workflows** |
| **`agent-chat.tsx`** | Labeled as "Agent Chat", exposes AI model selector prominently | Rename to **Copilot**. De-emphasize model switching (move to settings). The role is a context provider, not the focus. | **AI Copilot** |
| **`agent-os-dashboard.tsx` / `dashboard.tsx`** | Uses `prompt()` dialogs. Routes to agent-centric dashboard. | Replace with a **Company Dashboard** showing: active roles, pending tasks, recent AI conversations, doc count. Pull from existing APIs. | **Company** |
| **`agents.department`** field | Free-text string today | Treat as the Company's department/function (Marketing, Sales, Ops, etc.). Can later seed a `departments` enum. | **Company → Roles** |
| **`messages` table** (`agentId` FK) | Tied to agent identity, not user+context | In MVP, rename the concept to "Copilot Thread." Schema is fine — `agentId` becomes `roleId`. No DB change needed, just rename in UI. | **Memory** |
| **`aiMessages` table** | Separate from `messages` — two different chat histories | Consolidate UX: treat `aiMessages` as the global Copilot history and `messages` (agent-scoped) as Role-specific threads. Expose both in one Copilot page. | **AI Copilot + Memory** |
| **`documents-page.tsx`** (1275 lines) | Feature-complete but complex. Previously marked as postpone. | **Promote to MVP.** Docs is an explicit MVP entity. Simplify the UI to folder tree + editor. Remove unused advanced features (bulk tag editor, etc.) in a later pass. | **Docs** |
| **`performance-analytics.tsx`** | Per-agent KPI dashboards. Requires `agentMetrics` to be populated. | Scope down for MVP: show task completion counts and AI usage only. Remove empty KPI charts until data exists. | **Company (insights)** |
| **`sidebar.tsx`** | Lists all agents as nav items. Agent-centric navigation. | Restructure nav to: Company, Roles, Tasks, Docs, Copilot, Settings. Agent list moves inside the Roles page. | **Navigation** |
| **`stats-overview.tsx`** | Shows "Active Agents" count | Rename label to "Active Roles." No logic change. | **Company Dashboard** |
| **`agentActions` + approval workflow** | Full approval pipeline exists but no UI surface in main nav | Keep the backend. Add a simple "Pending Actions" badge in the Copilot page. Defer the full approval panel UI to post-MVP. | **AI Copilot** |

---

### 1.3 POSTPONE — Remove From MVP Navigation

These features should not appear in the MVP sidebar or be accessible from primary navigation. Code stays in the repo; routes remain but are not linked.

| Current Feature | Reason to Postpone | Files |
|----------------|-------------------|-------|
| **CRM** (contacts, deals, activities) | Full CRM is a separate product. Adds scope, not value for the founding-a-business flow. | `crm-page.tsx`, `crmContacts`, `crmDeals`, `crmActivities`, `/api/crm/*` |
| **Gmail OAuth integration** | OAuth adds compliance scope. Agents sending email needs more trust-building before MVP. | `integrations-page.tsx`, `server/integrations/gmail.ts`, `oauthTokens`, `/api/integrations/gmail/*` |
| **Multi-agent collaboration** | Complex to explain and demo. Requires ≥2 agents with coordinated prompting. | `POST /api/ai/multi-agent`, `ai-model-selector.tsx` (multi-agent mode) |
| **Agent metrics / KPI tracking** | `agentMetrics` data is sparse; charts will be empty. Vanity metric risk. | `agentMetrics` table, `agent-metrics.tsx`, `GET /api/agents/:id/metrics` |
| **Tutorials page** | Static content. Build after product stabilizes. | `tutorials-page.tsx` |
| **Support page** | Static content. Replace with a link to external docs/Intercom. | `support-page.tsx` |
| **Replit integrations module** | Platform-specific. Not portable. Zero MVP value outside Replit. | `server/replit_integrations/` |
| **Perplexity, xAI (Grok), Gemini providers** | Anthropic + OpenAI cover MVP. Extra providers add API key management surface with no user benefit yet. | `server/ai/perplexity-service.ts`, `server/ai/xai-service.ts`, `server/ai/gemini-service.ts` |
| **`lib/llmApi.ts`** (deprecated) | Client-side axios call to OpenAI. Superseded by `/api/llm/chat`. Creates two code paths. | `client/src/lib/llmApi.ts` |
| **`lib/openai.ts`** | Client-side `sendMessageToAgent`. Should route through server. Consolidate later. | `client/src/lib/openai.ts` |
| **`pages/backup/`** | Development snapshots. Archive or delete. | `client/src/pages/backup/` |
| **`agent-os-dashboard.tsx`** (prototype) | Uses `window.prompt()`. Superseded. | `client/src/pages/agent-os-dashboard.tsx` |

---

## 2. Database Table → MVP Entity Mapping

| Current Table | MVP Entity | Status | Action Required |
|--------------|------------|--------|-----------------|
| `users` | **Founder** | ✅ KEEP | Add `companyName`, `companyIndustry`, `companySize` columns OR create a `companies` table (see §5). |
| `session` | System | ✅ KEEP | No change. |
| `agents` | **Roles** | ✅ KEEP (rename concept) | No schema change. Rename in UI: "Agent" → "Role". `agents.instructions` = Workflow definition. `agents.brainContent` = Memory. |
| `tasks` | **Tasks** | ✅ KEEP | No change. `tasks.agentId` = assigned Role. |
| `messages` | **Memory** (role-scoped) | ✅ KEEP | No schema change. In UI, surface as "Copilot Thread" per Role. |
| `aiMessages` | **AI Copilot** (global chat) | ✅ KEEP | No change. Surface as global Copilot history. |
| `documents` | **Docs** | ✅ KEEP | No change. Promote from postponed to MVP. |
| `folders` | **Docs** (organization) | ✅ KEEP | No change. |
| `notifications` | System | ✅ KEEP | No change. |
| `agentActions` | AI Copilot (action log) | ⚠️ KEEP schema, defer UI | Keep backend. Remove from MVP navigation. Show count badge only. |
| `agentMetrics` | Deferred | 🔴 POSTPONE | Keep schema (no migration needed). Don't surface in MVP UI. |
| `crmContacts` | Deferred | 🔴 POSTPONE | Keep schema. Remove from nav. |
| `crmDeals` | Deferred | 🔴 POSTPONE | Keep schema. Remove from nav. |
| `crmActivities` | Deferred | 🔴 POSTPONE | Keep schema. Remove from nav. |
| `integrations` | Deferred | 🔴 POSTPONE | Keep schema. Remove from nav. |
| `oauthTokens` | Deferred | 🔴 POSTPONE | Keep schema. Remove from nav. |

### Missing Tables for MVP (New Additions Required)

| New Table | MVP Entity | Purpose | Priority |
|-----------|------------|---------|----------|
| `companies` | **Company** | Store company name, industry, stage, size, mission. Owned by a founder (`userId`). | High — needed for Company Dashboard |
| `workflows` | **Workflows** | Named, reusable SOPs that can be attached to Roles or Tasks. Currently implicit in `agents.instructions`. | Medium — can ship v1 using `agents.instructions`; formalize in v2 |
| `memory` | **Memory** | Explicit long-term memory entries keyed to a Role or the global Copilot. Currently split across `messages`, `agents.brainContent`, `agents.knowledgeBase`. | Medium — can ship v1 using existing fields; unify in v2 |

---

## 3. Agent Dependency Map for MVP

The `agents` table is the central entity in the current codebase. In the MVP it becomes `roles`. Every module that currently depends on agents stays relevant — it just changes its label.

### Modules That Depend on Agents (Will Become Role-Dependent)

| Module | Dependency | MVP Status |
|--------|------------|------------|
| `agent-chat.tsx` | `agents.id`, `messages.agentId` | ✅ KEEP → rename to Copilot page |
| `agent-programming.tsx` | Full `agents` record | ✅ KEEP → rename to Role Editor |
| `tasks.agentId` | FK to agents | ✅ KEEP → "Assigned Role" |
| `messages` table | `agentId` FK | ✅ KEEP → role-scoped thread |
| `agentActions` | `agentId` FK | ⚠️ Keep backend, defer UI |
| `agentMetrics` | `agentId` FK | 🔴 Defer entirely |
| `crmDeals.assignedAgentId` | FK to agents | 🔴 CRM deferred |
| `crmActivities.createdByAgentId` | FK to agents | 🔴 CRM deferred |
| `performance-analytics.tsx` | Queries agents + metrics | ⚠️ Simplify to task counts only |
| `stats-overview.tsx` | Counts agents | ✅ KEEP → relabel "Active Roles" |
| `sidebar.tsx` | Lists agent links | ✅ KEEP → restructure nav |

### Modules That Are Agent-Independent (MVP-Safe Today)

| Module | MVP Status |
|--------|------------|
| Auth (`users`, `session`, Firebase) | ✅ KEEP as-is |
| `documents` + `folders` | ✅ KEEP → Docs entity |
| `notifications` | ✅ KEEP as-is |
| `aiMessages` / global LLM chat | ✅ KEEP → AI Copilot |
| `tasks` (unassigned) | ✅ KEEP as-is |
| Shadcn UI component library | ✅ KEEP as-is |
| `server/ai/` abstraction layer | ✅ KEEP as-is |

---

## 4. Reusable Modules Per MVP Entity

### Company
**What exists:**
- `users.company` (text) — basic company name, available now
- `users.role` — the founder's role in the company
- `agents.department` — departments within the company

**Reusable from current code:**
- `GET /api/user` → surfaces `company`, `role`, `fullName`
- `stats-overview.tsx` → reuse for Company Dashboard stats (task counts, role counts, doc counts)
- `header.tsx` → displays user/company context

**What needs to be built:**
- A `companies` table with `name`, `industry`, `stage`, `mission`, `size`, `logoUrl`, `foundedAt`
- A Company Setup page (onboarding step 1 for new founders)
- Company Dashboard page replacing current dashboard

---

### Roles
**What exists — fully reusable:**
- `agents` table (`name`, `role`, `roleLevel`, `department`, `icon`, `instructions`, `isActive`)
- `GET /api/agents` — list all roles
- `POST /api/agents` — create role
- `PATCH /api/agents/:id` — update role
- `agent-programming.tsx` — Role editor (rename + simplify)
- `create-agent-modal.tsx` / `create-agent-form.tsx` — Role creation flow
- `agent-card.tsx` — Role card component
- `insertAgentSchema` Zod schema — validation

**Reuse plan:** Rename "Agent" to "Role" in UI labels. Remove `simulationMode`, KPI dashboard, and behavioral style from primary editor. Expose `instructions` as "Role Workflow / SOP" prominently.

---

### Workflows
**What exists — partially reusable:**
- `agents.instructions` (text) — this IS the workflow/SOP definition today
- `agents.brainContent` — supplementary workflow context
- `sop-template-button.tsx` — injects SOP templates into the instructions field
- `documents` table — can store named, standalone workflow documents

**Reuse plan (v1):** Expose `agents.instructions` as the Role's "Workflow" in the Role Editor. Add a "Workflow" tab in the editor that shows the SOP in a clean format. No schema change needed.

**Reuse plan (v2):** Add a `workflows` table. A Workflow has a `name`, `steps` (JSON array), `roleId`, and can be attached to multiple Tasks. Reference from `tasks.metadata`.

---

### Tasks
**What exists — fully reusable:**
- `tasks` table (all columns)
- `GET/POST/PATCH/DELETE /api/tasks`
- `POST /api/tasks/:id/subtask`
- `task-board.tsx` — kanban with drag-and-drop
- `task-card.tsx` — task card
- `insertTaskSchema` / `updateTaskSchema` Zod schemas

**Reuse plan:** Keep entirely. Rename `agentId` label to "Assigned Role" in UI. The task board becomes the primary work surface for the Founder.

---

### Docs
**What exists — fully reusable:**
- `documents` table (`title`, `content`, `folderId`, `tags`, `userId`)
- `folders` table (self-referencing hierarchy)
- `GET/POST/PATCH/DELETE /api/documents`
- `GET/POST/PATCH/DELETE /api/folders`
- `documents-page.tsx` — full document manager (1275 lines)

**Reuse plan:** Promote Docs from "POSTPONE" to MVP. Keep `documents-page.tsx` but simplify the entry path. Add AI Copilot context injection — when chatting in Copilot, allow attaching a Doc as context. This bridges Docs ↔ AI Copilot.

---

### AI Copilot
**What exists — fully reusable:**
- `server/ai/index.ts` — `generateAIResponse()`, `generateAgentResponse()`, unified provider abstraction
- `AnthropicService` — primary provider (claude-haiku-4-5, claude-sonnet-4-5)
- `OpenAIService` — secondary provider (gpt-4o)
- `/api/llm/chat` — direct Claude endpoint with `aiMessages` logging
- `/api/agents/:id/chat` — role-scoped chat with agent brain injected
- `aiMessages` table — global chat history
- `messages` table — role-scoped thread history
- `ai-model-selector.tsx` — model switcher (move to settings)
- `api-key-dialog.tsx` — API key input

**Reuse plan:** Build a single `/copilot` page that:
1. Has a global chat tab → uses `aiMessages` + `/api/llm/chat`
2. Has per-role chat tabs → uses `messages` + `/api/agents/:id/chat`
3. Shows "Actions taken" section (from `agentActions`)
4. Has context injection: attach Tasks or Docs to the conversation

---

### Memory
**What exists — partially reusable:**
- `agents.brainContent` — role-specific long-term memory (free text, injected into system prompt)
- `agents.knowledgeBase` — role-specific domain knowledge
- `messages` table — conversation history per role (short-term memory)
- `aiMessages` table — global copilot history (short-term memory)

**Reuse plan (v1):** Expose `brainContent` as a "Memory" section in the Role Editor. Let the Founder write persistent context that gets injected on every Copilot conversation with that Role. No schema change.

**Reuse plan (v2):** Add a `memory` table: `id`, `userId`, `roleId` (nullable = global), `content`, `source` (`manual` | `extracted` | `conversation`), `createdAt`. Allow the Copilot to auto-extract memory entries from conversations and surface them in a "Memory" tab.

---

## 5. Migration Plan: AgentOS → EntrepreneurOS MVP

### Phase 0 — No Code Changes (Immediate)

These are framing/navigation changes that require no backend work.

| Action | How |
|--------|-----|
| Remove CRM from sidebar | Edit `sidebar.tsx` — remove `/crm` link |
| Remove Integrations from sidebar | Edit `sidebar.tsx` — remove `/integrations` link |
| Remove Tutorials from sidebar | Edit `sidebar.tsx` — remove `/tutorials` link |
| Remove Support from sidebar | Edit `sidebar.tsx` — remove `/support` link |
| Remove Analytics from sidebar | Edit `sidebar.tsx` — remove `/analytics` link (for now) |
| Rename "Agents" → "Roles" | Update sidebar nav label, page titles, button labels |
| Rename "Agent Chat" → "Copilot" | Update page title in `agent-chat.tsx` |
| Update dashboard route | Point `/` to a new Company Dashboard (or simplify existing) |

**Estimated effort:** 1–2 hours. Zero risk — no logic changes.

---

### Phase 1 — Add Company Entity

**Goal:** Give the Founder a named Company with basic metadata.

**Steps:**

1. Add `companies` table to `shared/schema.ts`:
   ```ts
   export const companies = pgTable("companies", {
     id: text("id").primaryKey(),
     userId: text("user_id").references(() => users.id),
     name: text("name").notNull(),
     industry: text("industry"),
     stage: text("stage"),       // idea, pre-revenue, revenue, scaling
     mission: text("mission"),
     size: text("size"),
     logoUrl: text("logo_url"),
     createdAt: timestamp("created_at").defaultNow(),
     updatedAt: timestamp("updated_at").defaultNow(),
   });
   ```

2. Add routes in `server/routes.ts`:
   - `GET /api/company` — get founder's company
   - `POST /api/company` — create company
   - `PATCH /api/company` — update company

3. Add `getCompany`, `createCompany`, `updateCompany` to `server/storage.ts`

4. Build **Company Dashboard** page (`/` route):
   - Company name, industry, stage
   - Stats: active roles, open tasks, total docs, copilot conversations
   - Recent tasks list (reuse `task-card.tsx`)
   - "Add Role" shortcut button

5. Build **Company Setup** onboarding (shown if `company` is null on first login):
   - Single form: company name, industry, stage, mission
   - Saves to `companies` table
   - Redirects to dashboard

**Files changed:** `shared/schema.ts`, `server/routes.ts`, `server/storage.ts`, new `pages/company-page.tsx`, `App.tsx`

---

### Phase 2 — Refactor Agent Editor → Role Editor

**Goal:** Reframe the agent creation/editing UX to match the Roles mental model.

**Steps:**

1. In `agent-programming.tsx`:
   - Change page title: "Agent Programming" → "Role Editor"
   - Rename "Instructions" section → "Workflow / SOP"
   - Rename "Brain Content" section → "Role Memory"
   - Remove or collapse: `simulationMode` toggle, KPI input section, `behavioralStyle` field
   - Add prominent save confirmation

2. In `create-agent-modal.tsx` / `create-agent-form.tsx`:
   - Change modal title: "Create Agent" → "New Role"
   - Simplify form: Name, Role/Title, Department, brief Instructions
   - Remove advanced fields (roleLevel enum, KPIs) from creation flow; move to editor

3. Update all UI labels:
   - "Agent" → "Role" (sidebar, buttons, toasts, headings)
   - "Agent Chat" → "Copilot"
   - "Agent ID" → "Role ID" in URL display

**No schema changes.** All data columns remain the same.

---

### Phase 3 — Build the Copilot Page

**Goal:** Unified AI Copilot experience that replaces the fragmented `agent-chat.tsx`.

**Steps:**

1. Create `pages/copilot-page.tsx` at route `/copilot`:
   - Left sidebar: list of Roles (from `/api/agents`), plus a "General" tab
   - Chat window: when "General" selected → POST to `/api/llm/chat` (uses `aiMessages`)
   - Chat window: when a Role selected → POST to `/api/agents/:id/chat` (uses `messages` with brain injected)
   - Context bar: attach a Doc or Task to the conversation
   - Actions indicator: badge if `agentActions` has pending items

2. Redirect `/chat/:agentId` → `/copilot?role=:agentId` (or keep both routes)

3. Move `ai-model-selector.tsx` out of the chat input bar → into Settings page

4. Keep `ApiKeyDialog` accessible from Settings

**Reuses:** All existing `/api/agents/:id/chat`, `/api/llm/chat`, `messages`, `aiMessages` logic untouched.

---

### Phase 4 — Promote Docs to MVP

**Goal:** Make Docs a first-class navigable entity.

**Steps:**

1. Add `/docs` to the sidebar navigation (currently exists as `/documents`)
2. Rename route alias: add `<ProtectedRoute path="/docs" component={DocumentsPage} />` in `App.tsx`
3. Simplify `documents-page.tsx` initial view: show folder tree + "New Doc" button prominently
4. Add **"Ask Copilot about this doc"** button on document view → opens Copilot with doc content as context (`POST /api/llm/chat` with system message containing doc content)
5. Add a `workflowType` tag convention for docs (e.g., tag: `sop`, `playbook`, `reference`) so Workflow docs are filterable

**No schema changes.**

---

### Phase 5 — Simplify Tasks Page

**Goal:** Make Tasks the primary work surface.

**Steps:**

1. Keep `task-board.tsx` kanban — it works well
2. Add "Role" column display on task cards (currently shows agent name — just relabel)
3. Add quick-task creation from the Company Dashboard
4. Add "Ask Copilot about this task" button on task detail → opens Copilot with task context

**No schema changes.**

---

### Phase 6 — Consolidate & Clean Up

**Goal:** Remove dead code and legacy paths before any user-facing launch.

| Action | Files |
|--------|-------|
| Delete `agent-os-dashboard.tsx` prototype | `pages/agent-os-dashboard.tsx` |
| Delete deprecated `lib/llmApi.ts` | `client/src/lib/llmApi.ts` |
| Delete deprecated `lib/openai.ts` (client-side) | `client/src/lib/openai.ts` |
| Remove Perplexity, xAI, Gemini service files from active import | `server/ai/index.ts` (comment out providers) |
| Delete `pages/backup/` directory | `pages/backup/` |
| Remove Replit integration module from routes | `server/replit_integrations/`, `server/routes.ts` |
| Add 404 redirect for removed nav routes | `App.tsx` |

---

## 6. MVP Navigation Structure

### Current Sidebar (AgentOS)
```
Dashboard
Tasks
[Agent 1 Chat]
[Agent 2 Chat]
...
Integrations
Analytics
CRM
Documents
Settings
Notifications
Support
Tutorials
```

### Target Sidebar (EntrepreneurOS MVP)
```
Company          /company         ← New (Phase 1)
Roles            /roles           ← Renamed from Agents
Tasks            /tasks           ← Keep
Docs             /docs            ← Promoted from Documents
Copilot          /copilot         ← Renamed + rebuilt from Agent Chat
─────────────────────────────
Settings         /settings        ← Keep (simplify MFA section)
Notifications    /notifications   ← Keep
```

**Removed from nav (routes kept, not linked):**
- `/crm`
- `/integrations`
- `/analytics`
- `/support`
- `/tutorials`

---

## 7. Summary Decision Table

| Module | Decision | Effort | Risk |
|--------|----------|--------|------|
| Auth | KEEP | None | None |
| Company entity | BUILD (new table + page) | Medium | Low |
| Roles (from Agents) | KEEP + relabel | Low | None |
| Role Editor (from Agent Programming) | REFACTOR labels | Low | None |
| Workflows (from agent instructions) | KEEP in Role Editor, label change | Low | None |
| Tasks + Task Board | KEEP | None | None |
| Docs + Folders | KEEP + promote to nav | Low | None |
| AI Copilot page | REFACTOR agent-chat.tsx | Medium | Low |
| Memory (brainContent) | KEEP in Role Editor, label change | Low | None |
| Notifications | KEEP | None | None |
| Settings (profile) | KEEP | None | None |
| Sidebar nav | REFACTOR links + labels | Low | None |
| Company Dashboard | BUILD (replaces current `/`) | Medium | Low |
| CRM | POSTPONE | None | None |
| Gmail / OAuth | POSTPONE | None | None |
| Multi-agent collaboration | POSTPONE | None | None |
| Agent metrics / KPI | POSTPONE | None | None |
| Tutorials / Support pages | POSTPONE | None | None |
| Replit integrations | REMOVE | Low | None |
| Deprecated AI clients (llmApi, openai.ts) | REMOVE | Low | Low |
| Perplexity / xAI / Gemini providers | DISABLE | Low | None |
| `agent-os-dashboard.tsx` prototype | DELETE | None | None |
| `pages/backup/` | DELETE | None | None |

---

## 8. What the MVP Looks Like When Done

A Founder signs up → completes Company Setup (name, industry, stage) → lands on the **Company Dashboard**.

From there they can:
1. **Create Roles** — define who does what (Marketing, Sales, Operations). Each Role gets a Workflow (SOP) and Memory (context).
2. **Create Tasks** — assign tasks to Roles. Drag them through the kanban.
3. **Write Docs** — store SOPs, playbooks, research in a folder tree.
4. **Open the Copilot** — chat with the AI in the context of a specific Role (which injects that role's instructions and memory), or globally.

Every entity in this flow already exists in the codebase. The MVP requires no new API infrastructure — only new tables for `Company`, label changes, navigation restructuring, and the consolidated Copilot page.
