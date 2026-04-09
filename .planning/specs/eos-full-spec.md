# EntrepreneurOS Full Product Spec

## Overview

EntrepreneurOS is an AI-native business operating system for founders and entrepreneurs. It enables users to create AI agent teams, delegate tasks, manage CRM pipelines, generate documents, and integrate external tools — all from a single workspace scoped to the user's company.

**Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui (Radix primitives), Wouter routing, TanStack Query server state, React Hook Form + Zod validation, Framer Motion animations, Recharts visualizations, react-beautiful-dnd for drag-and-drop.

**Backend:** Express 4 + Drizzle ORM + Neon PostgreSQL (serverless), multi-provider AI layer (Anthropic, OpenAI, Gemini, Perplexity, XAI), Firebase Auth (Google OAuth, 2FA, email verification) with Passport.js fallback, Gmail integration via Google APIs.

**Auth model:** Firebase Auth primary (Google OAuth, email/password, 2FA, email verification), Passport.js + bcrypt fallback when Firebase is not configured. Sessions via express-session + connect-pg-simple.

**Multi-tenancy:** Company-scoped. Every authenticated user owns one company. All data queries filter by company ownership. CompanyGate component enforces company existence before rendering protected pages.

## Page Count: 20

## Routes: 20 unique routes

---

## Pages

---

### 1. Auth Page

| Field | Value |
|-------|-------|
| **Route** | `/auth` |
| **Auth Level** | Public |
| **Priority** | P0 — Critical |
| **File** | `client/src/pages/auth-page.tsx` |

**Purpose:** Primary authentication hub. Provides login, registration, Google OAuth, 2FA verification, and password reset in a single tabbed interface. This is the main entry point for unauthenticated users.

**Components:**
- Tabs (Login / Register) via shadcn Tabs
- Login form: email + password fields, submit button, "Forgot password?" link
- Register form: username, email, full name (optional), company (optional), password, confirm password
- Google OAuth button (conditionally rendered when Firebase is configured)
- MFA verification card: 6-digit code input with reCAPTCHA container
- Password reset card: email input + send reset email button
- Hero panel (right side, desktop only): gradient background with feature list
- Firebase status alert (shown when Firebase is not configured)
- Email verification alert (shown on register tab when Firebase is configured)
- Loader2 spinner for pending states

**Data Requirements:**
- `GET /api/user` — check current auth state
- `POST /api/login` — Passport.js email/password login (fallback)
- `POST /api/register` — Passport.js registration (fallback)
- `POST /api/auth/firebase` — Firebase token exchange
- `POST /api/auth/google` — Google OAuth token exchange
- `GET /api/company` — check if user has company (for redirect logic)

**Validation Rules:**
- Login: email (valid email format), password (min 6 chars)
- Register: username (min 3 chars), email (valid email), password (min 6 chars), confirmPassword (must match password), fullName (optional), company (optional)
- Password reset: email (valid email format)
- MFA code: string, exactly 6 digits

**Events:**
- `auth.login.success` — user logged in
- `auth.login.error` — login failed
- `auth.register.success` — account created
- `auth.register.error` — registration failed
- `auth.google.click` — Google OAuth initiated
- `auth.mfa.triggered` — MFA challenge presented
- `auth.mfa.verified` — MFA code accepted
- `auth.password_reset.sent` — reset email sent

**States:**
- **Default:** Login tab active, empty form
- **Loading:** Loader2 spinner on submit button, button disabled
- **Error:** Form field validation messages via FormMessage, mutation error displayed
- **MFA:** Full-screen MFA card with code input replaces main form
- **Reset Password:** Full-screen reset card replaces main form
- **Redirect:** If user is already authenticated, redirect to `/home` (with company) or `/company-setup` (without company)

**Mobile Considerations:**
- Hero panel hidden on mobile (lg:flex breakpoint)
- Single-column layout on mobile
- Full-width form elements
- Touch-friendly button sizing

**Dependencies:** None — this is the root public page.

---

### 2. Company Setup

| Field | Value |
|-------|-------|
| **Route** | `/company-setup` |
| **Auth Level** | Authenticated (no company required) |
| **Priority** | P0 — Critical |
| **File** | `client/src/pages/company-setup-page.tsx` |

**Purpose:** First-run onboarding flow. After authentication, users who do not yet have a company are redirected here to create their company profile. This gates access to all other protected pages.

**Components:**
- Centered Card with radial gradient background
- Form fields: name (required), type, stage (2-column grid), offer (textarea), targetCustomer (textarea), goals (textarea)
- Submit button with loading spinner
- Toast notification on error

**Data Requirements:**
- `POST /api/company` — create company record
- `GET /api/company` — cache invalidation after creation

**Validation Rules:**
- name: string, min 1 char, required
- type: string, optional (freeform: "SaaS, Agency, Marketplace...")
- stage: string, optional (freeform: "Idea, MVP, Growth...")
- offer: string, optional (textarea)
- targetCustomer: string, optional (textarea)
- goals: string, optional (textarea)

**Events:**
- `company.created` — company profile saved
- `company.setup.error` — creation failed

**States:**
- **Default:** Empty form with placeholder text
- **Loading:** Loader2 spinner on button, button disabled
- **Error:** Toast with destructive variant, form field messages
- **Success:** Redirect to `/home`

**Mobile Considerations:**
- Max-width 2xl container, responsive padding
- 2-column grid collapses to single column on mobile (md breakpoint)
- Textareas have min-height with resize-y

**Dependencies:** Auth page must exist (user must be authenticated).

---

### 3. Dashboard

| Field | Value |
|-------|-------|
| **Route** | `/home` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P0 — Critical |
| **File** | `client/src/pages/dashboard.tsx` |

**Purpose:** Primary workspace. Shows the company overview header, active workflows, pending action approvals, AI agent cards, and a task board summary. This is the main landing page after login.

**Components:**
- Layout wrapper (sidebar + header)
- Company header card: company name, type, stage, offer, target customer, goals in a 3-column grid
- Workflows section: list of workflows with name, description, status badge (active/paused), empty state message
- ActionApprovalPanel: pending agent actions requiring user approval
- Agent cards grid (1-4 columns responsive): AgentCard components showing name, role, icon, latest activity, task summary
- TaskBoard: embedded kanban board with todo/in-progress/done columns
- AiFab: floating AI assistant button

**Data Requirements:**
- `GET /api/company` — company details (via useCompany hook)
- `GET /api/agents` — list all agents with tasks
- `GET /api/workflows` — list company workflows
- `GET /api/actions/pending` — pending action approvals
- `GET /api/tasks` — tasks for kanban board

**Validation Rules:** None (read-only page with embedded components that have their own validation).

**Events:**
- `dashboard.viewed` — page loaded
- `dashboard.agent.clicked` — agent card clicked
- `dashboard.workflow.viewed` — workflow section visible

**States:**
- **Default:** Company header + populated agent grid + task board
- **Empty:** No agents message, no workflows message, empty task board
- **Loading:** Layout renders, data sections show loading spinners via TanStack Query
- **No Company:** Redirects to `/company-setup`

**Mobile Considerations:**
- Agent grid: 1 column on mobile, 2 on md, 3 on lg, 4 on xl
- Task board scrolls horizontally on mobile
- Company header grid collapses to single column

**Dependencies:** Auth, Company Setup.

---

### 4. Dashboard Alt (Spec Editor)

| Field | Value |
|-------|-------|
| **Route** | `/dashboard` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/dashboard-page.tsx` |

**Purpose:** Spec editor interface with a live preview panel. Provides a secondary workspace for editing product specifications with validation progress indicators, file management, and collaboration features.

**Components:**
- Layout wrapper
- Top navigation bar: logo, nav links (Dashboard, Projects, Templates, Archive), notification/settings icons, user avatar
- Side navigation: Editor, Collaborate, Files, Validation, History tabs
- Main spec textarea: large text editor area with AI assist button
- Preview panel: rendered specification output
- Validation progress bars: Logic Consistency, Asset Requirements, Accessibility Coverage
- Upload/import controls
- Language and view mode toggles

**Data Requirements:**
- `GET /api/company` — company context
- No dedicated API endpoints yet (placeholder page)

**Validation Rules:** None currently (static/placeholder UI).

**Events:**
- `spec_editor.viewed` — page loaded
- `spec_editor.spec.saved` — specification saved
- `spec_editor.preview.toggled` — preview panel toggled

**States:**
- **Default:** Editor with empty spec textarea, zero-progress validation bars
- **Editing:** Content in textarea, validation bars updating
- **Preview:** Side-by-side editor and rendered preview

**Mobile Considerations:**
- Side navigation collapses to bottom bar
- Preview panel stacks below editor on mobile
- Horizontal scroll for top navigation

**Dependencies:** Auth, Company Setup.

---

### 5. Task Board

| Field | Value |
|-------|-------|
| **Route** | `/tasks` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P0 — Critical |
| **File** | `client/src/pages/task-board-page.tsx` |

**Purpose:** Full-page kanban task management board. Provides drag-and-drop task organization across todo, in-progress, and done columns with task creation, editing, assignment, and subtask support.

**Components:**
- Layout wrapper
- TaskBoard component (shared with Dashboard): 3-column kanban (todo, in-progress, done)
- Task cards: title, description preview, priority badge, assigned agent, due date
- Drag-and-drop via react-beautiful-dnd
- Create task dialog: title, description, status, priority, due date, agent assignment
- Task detail drawer/dialog: full edit form, subtask list, message thread, collaborator management

**Data Requirements:**
- `GET /api/tasks` — all tasks
- `POST /api/tasks` — create task
- `PATCH /api/tasks/:id` — update task (including status change from drag)
- `DELETE /api/tasks/:id` — delete task
- `POST /api/tasks/:id/subtask` — create subtask
- `GET /api/tasks/:id/subtasks` — list subtasks
- `POST /api/tasks/:id/assign` — assign to agent
- `POST /api/tasks/:id/collaborators` — add collaborators
- `GET /api/tasks/:id/messages` — task discussion thread
- `POST /api/tasks/:id/messages` — add message to task thread
- `GET /api/agents` — agent list for assignment dropdown

**Validation Rules:**
- title: string, min 1 char, required
- description: string, min 1 char, required
- status: enum ["todo", "in-progress", "done"], default "todo"
- priority: enum ["low", "medium", "high", "urgent"], default "medium"
- startDate: string (date), optional
- dueDate: string (date), optional
- agentId: string, optional
- assignedById: string, optional
- collaboratorIds: string (comma-separated), optional
- taskType: enum ["standard", "collaboration", "delegated"], default "standard"
- parentTaskId: string, optional

**Events:**
- `task.created` — new task created
- `task.updated` — task edited
- `task.status_changed` — task moved between columns
- `task.deleted` — task removed
- `task.assigned` — agent assigned to task
- `task.subtask_created` — subtask added

**States:**
- **Default:** Three columns with task cards
- **Empty:** Empty columns with "No tasks" placeholder
- **Loading:** Skeleton/spinner while fetching tasks
- **Dragging:** Visual drag indicator on card, drop zone highlighting
- **Error:** Toast notification on failed operations

**Mobile Considerations:**
- Columns scroll horizontally with swipe
- Task cards are full-width within columns
- Create button fixed or in header
- Touch-friendly drag handles

**Dependencies:** Auth, Company Setup, Agents (for assignment).

---

### 6. Agent Chat

| Field | Value |
|-------|-------|
| **Route** | `/chat/:agentId` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P0 — Critical |
| **File** | `client/src/pages/agent-chat.tsx` |

**Purpose:** Chat interface for conversing with AI agents. Supports multi-model selection (Anthropic, OpenAI, Gemini, Perplexity, XAI), conversation management, task viewing, and action generation from chat context.

**Components:**
- Layout wrapper
- Agent sidebar (collapsible): agent list, create agent modal trigger, conversation history
- Chat header: agent name, role, icon, settings link to programming page, info popover
- Message list: alternating user/assistant messages with timestamps, copy-to-clipboard, markdown rendering
- Message input: textarea with send button
- AIModelSelector: provider + model dropdown (Anthropic Claude Haiku/Sonnet/Opus, OpenAI GPT-4o, Gemini Flash, etc.)
- ApiKeyDialog: modal for adding missing API keys
- CreateAgentModal: inline agent creation from chat page
- Task sidebar: list of agent's assigned tasks
- Agent info drawer (mobile) / popover (desktop): agent details
- Clear conversation button with confirmation

**Data Requirements:**
- `GET /api/agents/:id` — agent details
- `GET /api/agents/:id/messages` — chat history
- `POST /api/agents/:id/chat` — send message and get AI response
- `GET /api/agents/:id/tasks` — agent's assigned tasks
- `GET /api/agents` — agent list for sidebar
- `POST /api/agents/:id/clear-messages` — clear conversation
- `GET /api/ai/models` — available AI models and providers
- `GET /api/ai/provider-status` — which providers have API keys configured
- `POST /api/keys/save` — save API key
- `POST /api/llm/chat` — direct LLM chat (alternative endpoint)

**Validation Rules:**
- message: string, non-empty
- aiModelConfig: { provider: AIModelProvider, modelName: AIModelName }

**Events:**
- `chat.message.sent` — user sent message
- `chat.response.received` — AI response received
- `chat.model.changed` — AI model selection changed
- `chat.conversation.cleared` — conversation history cleared
- `chat.agent.switched` — switched to different agent
- `chat.action.generated` — AI suggested an action

**States:**
- **Default:** Empty chat with agent info header, message input ready
- **Loading:** Typing indicator while waiting for AI response
- **Error:** Toast on failed message send, API key dialog if provider not configured
- **No Agent:** Redirect or empty state when agentId is invalid
- **Sidebar Collapsed:** Chat area expands full width

**Mobile Considerations:**
- Sidebar hidden by default, accessible via drawer
- Full-width message input
- Message bubbles adjust padding for mobile
- Model selector in dropdown/sheet

**Dependencies:** Auth, Company Setup, at least one Agent created.

---

### 7. Agent Programming

| Field | Value |
|-------|-------|
| **Route** | `/agent/:agentId/program` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/agent-programming.tsx` |

**Purpose:** Agent configuration and personality programming interface. Allows users to set agent name, role, icon, behavioral instructions, and knowledge base from multiple sources (text, file upload, URL).

**Components:**
- Layout wrapper
- Back navigation button
- Agent form with Tabs:
  - Instructions tab: name, role, role level (Select: chief/manager/laborer), department (Select), icon, instructions (large textarea)
  - Knowledge tab: source selector (text/file/URL), text textarea, file upload input, URL input, knowledge base display
  - Testing tab: test prompt input, test response display, send test button
- Save button with loading state
- Alert component for save success/error feedback
- Role level selector: chief, manager, laborer
- Department selector

**Data Requirements:**
- `GET /api/agents/:id` — load agent details for editing
- `PATCH /api/agents/:id` — update agent configuration
- `POST /api/agents` — create new agent (when no agentId)
- `POST /api/agents/:id/generate-response` — test agent with prompt

**Validation Rules:**
- name: string, min 2 chars, max 50 chars, required
- role: string, min 2 chars, max 50 chars, required
- icon: string, min 3 chars, required (Remix Icon class name)
- instructions: string, min 20 chars, max 10000 chars, required
- knowledgeBase: string, optional
- roleLevel: enum ["chief", "manager", "laborer"], default "laborer"
- department: string, min 1 char, required

**Events:**
- `agent.programming.viewed` — page loaded
- `agent.config.saved` — agent configuration updated
- `agent.knowledge.updated` — knowledge base changed
- `agent.test.run` — test prompt executed
- `agent.created` — new agent created

**States:**
- **Default:** Form populated with agent data (edit mode) or empty (create mode)
- **Loading:** Loader2 on save button
- **Testing:** Loading spinner on test response area
- **Success:** Alert with success message
- **Error:** Alert with error details, form field validation messages
- **File Uploaded:** File name displayed with checkmark

**Mobile Considerations:**
- Tabs stack or scroll horizontally
- Textareas fill available width
- File upload uses native file picker
- Back button prominent in header

**Dependencies:** Auth, Company Setup.

---

### 8. Analytics

| Field | Value |
|-------|-------|
| **Route** | `/analytics` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/analytics-page.tsx` |

**Purpose:** Performance metrics dashboard showing agent efficiency, task completion rates, collaboration patterns, and cost analytics across the company's AI operations.

**Components:**
- Layout wrapper
- Page header: title + description
- PerformanceAnalytics component (delegated):
  - Summary stat cards: total agents, tasks completed, messages sent, tokens used, estimated time saved, API cost
  - Task completion chart (Recharts): bar or line chart over time
  - Agent performance comparison: per-agent metrics table or chart
  - Collaboration metrics: cross-agent task completion rates
  - Cost breakdown: per-provider token usage and cost

**Data Requirements:**
- `GET /api/analytics` — aggregated analytics data (messages, tasks, tokens, costs by date range)
- `GET /api/stats` — summary statistics (agent count, task counts by status, message totals)
- `GET /api/agents/:id/metrics` — per-agent metrics (messages sent/received, tasks completed, tokens used, API cost, time saved)
- `GET /api/agents` — agent list for filtering

**Validation Rules:** None (read-only page). Date range filters validated client-side.

**Events:**
- `analytics.viewed` — page loaded
- `analytics.date_range.changed` — filter updated
- `analytics.agent.filtered` — specific agent selected

**States:**
- **Default:** Charts and stats populated with data
- **Empty:** No data message when no agents or tasks exist
- **Loading:** Skeleton cards/charts while fetching
- **Error:** Error state in chart containers

**Mobile Considerations:**
- Stat cards wrap to 2-column or single column
- Charts scroll horizontally if needed
- Simplified chart labels on small screens

**Dependencies:** Auth, Company Setup, Agents, Tasks (needs data to display).

---

### 9. CRM

| Field | Value |
|-------|-------|
| **Route** | `/crm` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/crm-page.tsx` |

**Purpose:** Customer relationship management hub with three tabs: Contacts, Deals, and Activities. Supports full CRUD operations for managing the sales pipeline and customer interactions.

**Components:**
- Layout wrapper
- Tabs: Contacts, Deals, Activities
- **Contacts tab:**
  - Search input
  - Contact cards/list: name, email, phone, company, title, status badge (lead/prospect/customer/churned), last contact date
  - Create contact dialog: form with all contact fields
  - Contact detail view
- **Deals tab:**
  - Deal cards: title, company, value (currency), stage badge (discovery/proposal/negotiation/closed-won/closed-lost), probability %, expected close date
  - Create deal dialog: form with deal fields, contact selector, agent assignment
- **Activities tab:**
  - Activity list: type icon (email/call/meeting/task/note), subject, date, related entity, completed checkbox
  - Create activity dialog: type selector, subject, date, related entity selector, notes

**Data Requirements:**
- `GET /api/crm/contacts` — list contacts
- `GET /api/crm/contacts/:id` — contact detail
- `POST /api/crm/contacts` — create contact
- `PATCH /api/crm/contacts/:id` — update contact
- `GET /api/crm/deals` — list deals
- `GET /api/crm/deals/:id` — deal detail
- `POST /api/crm/deals` — create deal
- `PATCH /api/crm/deals/:id` — update deal
- `GET /api/crm/activities` — list activities
- `GET /api/crm/activities/:id` — activity detail
- `POST /api/crm/activities` — create activity
- `PATCH /api/crm/activities/:id` — update activity
- `GET /api/agents` — agent list for deal assignment

**Validation Rules:**
- **Contact:** name (min 1, required), email (valid email, required), phone (optional), company (optional), title (optional), status (enum: lead/prospect/customer/churned, default lead), notes (optional)
- **Deal:** title (min 1, required), company (min 1, required), value (number, positive, required), stage (enum: discovery/proposal/negotiation/closed-won/closed-lost, default discovery), probability (0-100, default 50), expectedCloseDate (date, optional), contactId (required), assignedAgentId (optional), notes (optional)
- **Activity:** type (enum: email/call/meeting/task/note, required), subject (min 1, required), date (date, required), relatedToType (enum: contact/deal, required), relatedToId (required), completed (boolean, default false), notes (optional), createdByAgentId (optional)

**Events:**
- `crm.contact.created` / `crm.contact.updated`
- `crm.deal.created` / `crm.deal.updated` / `crm.deal.stage_changed`
- `crm.activity.created` / `crm.activity.completed`

**States:**
- **Default:** Tab content with entity lists
- **Empty:** "No contacts/deals/activities" message with create CTA
- **Loading:** Loader2 spinners in card areas
- **Dialog Open:** Create/edit form in dialog overlay
- **Search Active:** Filtered results based on search input

**Mobile Considerations:**
- Tabs scroll horizontally on narrow screens
- Cards stack vertically
- Dialogs become full-screen sheets on mobile
- Currency values and dates formatted compactly

**Dependencies:** Auth, Company Setup.

---

### 10. Documents

| Field | Value |
|-------|-------|
| **Route** | `/documents` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/documents-page.tsx` |

**Purpose:** Document and folder management system with hierarchical folder navigation, document creation with rich text content, tagging, and search. Supports nested folders with breadcrumb navigation.

**Components:**
- Layout wrapper
- Breadcrumb navigation: Home > Folder > Subfolder
- Folder grid: folder cards with name, edit/delete dropdown
- Document grid: document cards with title, content preview, tags (Badge), created date, edit/delete dropdown
- Create folder dialog: name input
- Create document dialog: title, content (textarea), folder selector, tag input
- Edit folder dialog: rename input
- Edit document dialog: full document edit form
- Search input
- Back button for folder navigation
- Empty state: no documents/folders message with create CTA
- Agent list (for context): sidebar or reference for AI-generated documents

**Data Requirements:**
- `GET /api/folders` — list folders (query param: parentId for nested)
- `GET /api/folders/:id` — folder detail
- `POST /api/folders` — create folder
- `PATCH /api/folders/:id` — rename folder
- `DELETE /api/folders/:id` — delete folder
- `GET /api/documents` — list documents (query param: folderId for filtering)
- `GET /api/documents/:id` — document detail
- `POST /api/documents` — create document
- `PATCH /api/documents/:id` — update document
- `DELETE /api/documents/:id` — delete document
- `GET /api/agents` — agent list for document context

**Validation Rules:**
- **Folder:** name (min 1, required), parentId (optional)
- **Document:** title (min 1, required), content (string), folderId (optional), tags (array of strings, optional)

**Events:**
- `document.created` / `document.updated` / `document.deleted`
- `folder.created` / `folder.renamed` / `folder.deleted`
- `documents.searched` — search query executed

**States:**
- **Default:** Folder/document grid populated
- **Empty:** "No documents yet" message
- **Loading:** Loader2 while fetching
- **Navigating:** Breadcrumb updates, folder contents load
- **Dialog Open:** Create/edit overlay
- **Search Active:** Filtered results

**Mobile Considerations:**
- Grid collapses to single column
- Dropdown menus for actions (edit/delete)
- Dialogs become full-screen on mobile
- Breadcrumb truncates with overflow

**Dependencies:** Auth, Company Setup.

---

### 11. Integrations

| Field | Value |
|-------|-------|
| **Route** | `/integrations` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/integrations-page.tsx` |

**Purpose:** External tool connection management page. Lists available integrations, shows connected status, and provides connect/disconnect controls. Currently supports Gmail with OAuth flow.

**Components:**
- Header with back button (to /settings)
- Hero card: "Connect Your Tools" description
- Active integrations card: GmailConnectButton (OAuth connect/disconnect)
- Integrations grid: available integration cards with name, description, status, connect button
- Integration benefits card: bulleted feature list
- Setup guides card: integration documentation links

**Data Requirements:**
- `GET /api/integrations` — list all integrations with status
- `POST /api/integrations/connect` — connect an integration
- `GET /api/integrations/gmail/auth` — get Gmail OAuth URL
- `GET /api/auth/google/callback` — Gmail OAuth callback handler
- `GET /api/integrations/gmail/status` — Gmail connection status
- `POST /api/integrations/gmail/disconnect` — disconnect Gmail

**Validation Rules:**
- Integration connect: name (required), type (required)

**Events:**
- `integration.connected` — integration successfully connected
- `integration.disconnected` — integration removed
- `integration.gmail.oauth_started` — Gmail OAuth flow initiated

**States:**
- **Default:** Integration grid with status badges
- **Connected:** Green status indicator, disconnect button visible
- **Disconnected:** Grey status, connect button visible
- **OAuth Flow:** Redirect to Google, callback processing
- **Error:** Toast on failed connection

**Mobile Considerations:**
- Two-column grid collapses to single column
- OAuth redirect works on mobile browsers
- Touch-friendly connect/disconnect buttons

**Dependencies:** Auth, Company Setup.

---

### 12. Notifications

| Field | Value |
|-------|-------|
| **Route** | `/notifications` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/notifications-page.tsx` |

**Purpose:** Full notification center with filtering by read status. Shows all system notifications including task assignments, agent events, integration connections, and system alerts.

**Components:**
- Header with title
- Tabs: All, Unread, Read
- Mark all as read button
- Notification list: card per notification with title, content, type, timestamp, read indicator
- Per-notification actions: mark as read (Check icon), delete (Trash2 icon)
- Empty state: BellOff icon with "No notifications" message
- Loading state: Loader2 spinner

**Data Requirements:**
- `GET /api/notifications` — list all notifications for user
- `GET /api/notifications/count` — unread count (for badge)
- `POST /api/notifications/:id/read` — mark single as read
- `POST /api/notifications/read-all` — mark all as read
- `DELETE /api/notifications/:id` — delete notification

**Validation Rules:** None (read-only with actions).

**Events:**
- `notification.viewed` — notification center opened
- `notification.read` — single notification marked read
- `notification.all_read` — all marked as read
- `notification.deleted` — notification removed

**States:**
- **Default:** List of notifications with read/unread styling
- **Empty:** "No notifications" with BellOff icon
- **Loading:** Loader2 centered
- **Tab Filtered:** Only showing all/unread/read subset
- **Deleting:** Optimistic removal with 300ms refresh delay

**Mobile Considerations:**
- Full-width notification cards
- Swipe-to-delete pattern (potential enhancement)
- Tab bar scrollable on narrow screens
- Timestamp formatted compactly

**Dependencies:** Auth, Company Setup.

---

### 13. Settings

| Field | Value |
|-------|-------|
| **Route** | `/settings` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P1 — High |
| **File** | `client/src/pages/settings-page.tsx` |

**Purpose:** Account and application settings organized in tabs: General (UI preferences, integrations link), Account (profile info), Security (2FA enrollment, email verification, password reset), and Notifications (preference toggles).

**Components:**
- Layout wrapper
- Tabs: General, Account, Security, Notifications
- **General tab:**
  - Interface settings card: Dark Mode toggle (Switch), Compact View toggle (Switch)
  - Integrations card: link to /integrations page
- **Account tab:**
  - Account info card: name input, email display
  - Profile management controls
- **Security tab:**
  - MFA enrollment card: phone number input, verification code input, reCAPTCHA container
  - MFA status indicator (enrolled/not enrolled)
  - Email verification card: status indicator, resend verification button
  - Password reset button
  - Firebase status alert (when not configured)
- **Notifications tab:**
  - Notification preference toggles (email notifications, push notifications, etc.)

**Data Requirements:**
- `GET /api/user` — current user profile (via useAuth hook)
- Firebase Auth user object — for MFA status, email verification
- No dedicated settings API (preferences stored in user metadata)

**Validation Rules:**
- Phone number: valid phone format for MFA
- Verification code: 6-digit string for MFA

**Events:**
- `settings.viewed` — page loaded
- `settings.mfa.enrolled` — 2FA enabled
- `settings.email.verified` — email verification confirmed
- `settings.password.reset` — password reset email sent
- `settings.preference.changed` — toggle changed

**States:**
- **Default:** Tabs with current settings displayed
- **MFA Flow:** Step 1: phone input, Step 2: code verification
- **MFA Loading:** Loader2 on MFA buttons
- **Email Verified:** Green checkmark, verified badge
- **Email Unverified:** Warning icon, resend button
- **Firebase Not Ready:** Alert explaining limited security features

**Mobile Considerations:**
- Tabs scroll horizontally
- Full-width form inputs
- reCAPTCHA container responsive

**Dependencies:** Auth, Company Setup.

---

### 14. Support

| Field | Value |
|-------|-------|
| **Route** | `/support` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/support-page.tsx` |

**Purpose:** Support request form with category selection and FAQ section. Provides users a way to submit help requests and find quick answers.

**Components:**
- Header with back button (to /)
- Support form (2-column layout on desktop):
  - Name input
  - Email input
  - Category select (Bug Report, Feature Request, Billing, Account, Other)
  - Subject input
  - Message textarea
  - Submit button with loading spinner
- Success confirmation card: CheckCircle2 icon, confirmation message
- Contact info sidebar: email, chat, phone contact methods
- FAQ section: common questions and answers

**Data Requirements:**
- No dedicated API endpoint yet (form submission is simulated with setTimeout)
- `GET /api/user` — pre-fill name/email

**Validation Rules:**
- Form uses native HTML validation (required attributes)
- Category: select, required
- Subject: string, required
- Message: string, required

**Events:**
- `support.form.submitted` — request sent
- `support.faq.viewed` — FAQ section expanded

**States:**
- **Default:** Empty form
- **Submitting:** Loader2 on button, button disabled
- **Submitted:** Success card replaces form with CheckCircle2 and confirmation
- **Error:** Toast notification

**Mobile Considerations:**
- 2-column layout collapses to single column
- Contact sidebar stacks below form
- Full-width inputs and textarea

**Dependencies:** Auth, Company Setup.

---

### 15. Tutorials

| Field | Value |
|-------|-------|
| **Route** | `/tutorials` |
| **Auth Level** | Authenticated + Company |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/tutorials-page.tsx` |

**Purpose:** Educational resource library organized by topic. Static content with tutorial cards covering getting started, agent creation, integration guides, and advanced topics.

**Components:**
- Header with back button (to /)
- Page title and description
- Tabs: Getting Started, Agent Creation, Integration Guides, Advanced Topics
- TutorialCard components (2-column grid per tab):
  - Icon (PlayCircle for video, FileText for article, Bookmark for reference, Code for code examples)
  - Title
  - Description
  - Duration badge
  - Level badge (Beginner, Intermediate, Advanced)
  - "Start" button

**Data Requirements:**
- None (static content, no API calls)

**Validation Rules:** None (static page).

**Events:**
- `tutorial.viewed` — specific tutorial clicked
- `tutorial.category.switched` — tab changed

**States:**
- **Default:** Grid of tutorial cards organized by tab
- **Tab Changed:** Different set of cards per tab

**Mobile Considerations:**
- 2-column grid collapses to single column
- Tab list scrolls horizontally
- Card actions touch-friendly

**Dependencies:** Auth, Company Setup.

---

### 16. Admin Dashboard

| Field | Value |
|-------|-------|
| **Route** | `/admin` |
| **Auth Level** | Admin (Authenticated + Company) |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/admin-dashboard-page.tsx` |

**Purpose:** Administrative panel for system-level management. Currently a placeholder page pending full implementation.

**Components:**
- Layout wrapper
- Page header: "Admin Dashboard" title
- Placeholder text: "Generated admin dashboard page -- pending completion."
- (Planned) User management table
- (Planned) System health metrics
- (Planned) Global settings controls

**Data Requirements:**
- `GET /api/company` — company context
- (Planned) Admin-specific endpoints for user management, system stats

**Validation Rules:** None currently.

**Events:**
- `admin.dashboard.viewed` — page loaded

**States:**
- **Default:** Placeholder content
- **Future:** Populated admin panels

**Mobile Considerations:**
- Standard Layout wrapper handles responsive behavior
- Admin features may require desktop for usability

**Dependencies:** Auth, Company Setup, Admin role (not yet enforced in route guards).

---

### 17. Login (Standalone)

| Field | Value |
|-------|-------|
| **Route** | `/login` |
| **Auth Level** | Public (ProtectedRoute wrapper, but serves as standalone login) |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/login-page.tsx` |

**Purpose:** Standalone login page with a design-forward aesthetic ("Lucid" branding). Secondary to the main /auth page. Features email/password form with Google and GitHub OAuth buttons.

**Components:**
- Layout wrapper
- Centered login card with glass morphism styling
- Logo: Bot icon + "Lucid" branding
- Email input (styled, full-width)
- Password input with "Forgot?" link
- Error message (AlertCircle) — static/placeholder
- "Sign Into Console" gradient submit button
- Social login buttons: Google (with logo), GitHub (Terminal icon)
- Footer: "New to the architecture? Create Account" link
- Background decorative elements: radial gradients, blur effects
- Version string: "Architected by Lucid Systems -- V 2.4.0"

**Data Requirements:**
- Same as Auth page: `POST /api/login`, `POST /api/auth/firebase`, `POST /api/auth/google`
- Currently a static UI (form not wired to API)

**Validation Rules:**
- email: valid email format
- password: string, required

**Events:**
- `login.standalone.viewed` — page loaded
- `login.standalone.submitted` — form submitted

**States:**
- **Default:** Form with placeholder values
- **Error:** Static error message displayed (currently always visible as placeholder)

**Mobile Considerations:**
- Max-width 480px container, responsive padding
- Full-width buttons
- Background effects reduce on mobile for performance

**Dependencies:** None (public page).

---

### 18. Signup (Standalone)

| Field | Value |
|-------|-------|
| **Route** | `/signup` |
| **Auth Level** | Public (ProtectedRoute wrapper) |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/signup-page.tsx` |

**Purpose:** Standalone registration page with "Lucid" branding. Secondary to the main /auth page. Features full name, email, password fields with password strength indicator.

**Components:**
- Layout wrapper
- Centered signup card with glass morphism styling
- Logo: Bot icon with gradient + "Lucid" branding
- Full Name input
- Email input
- Password input with strength meter (4-bar visual indicator: "Security: Medium")
- "Create Account" gradient submit button
- "Already have an account? Sign In" link (to /signin)
- Error alert (hidden by default): duplicate email message
- Footer: copyright, Terms/Privacy/Support links
- Background decorative elements: radial gradients

**Data Requirements:**
- Same as Auth page: `POST /api/register`, `POST /api/auth/firebase`
- Currently a static UI (form not wired to API)

**Validation Rules:**
- name: string, required
- email: valid email format
- password: string, min 6 chars (with visual strength indicator)

**Events:**
- `signup.standalone.viewed` — page loaded
- `signup.standalone.submitted` — form submitted

**States:**
- **Default:** Empty form with placeholders
- **Password Strength:** Visual bars update as password is typed
- **Error:** Alert shown for duplicate email

**Mobile Considerations:**
- Max-width 480px, centered
- Full-width form elements
- Footer stacks vertically on mobile

**Dependencies:** None (public page).

---

### 19. Forgot Password

| Field | Value |
|-------|-------|
| **Route** | `/forgot-password` |
| **Auth Level** | Public (ProtectedRoute wrapper) |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/forgot-password-page.tsx` |

**Purpose:** Password recovery initiation page with "Lucid" branding. Users enter their email to receive a password reset link. Secondary to the in-page reset in /auth.

**Components:**
- Layout wrapper
- Centered card with glass morphism: SmartToy (Bot) icon, "Recover Your Access" heading
- Email input with label
- "Send Reset Link" gradient button with ArrowForward icon
- Success message (hidden): tonal layered card with CheckCircle icon
- "Back to Login" link with KeyboardBackspace icon
- Decorative version badge: "Lucid Architecture v4.0"
- Background elements: radial gradients, architectural line decorations, decorative image (desktop only)

**Data Requirements:**
- Firebase `sendPasswordResetEmail` (client-side)
- Currently a static UI (form not wired)

**Validation Rules:**
- email: valid email format, required

**Events:**
- `forgot_password.viewed` — page loaded
- `forgot_password.submitted` — reset link requested

**States:**
- **Default:** Email input form
- **Success:** Hidden success message becomes visible
- **Error:** Form validation message

**Mobile Considerations:**
- Max-width md container
- Decorative image hidden on mobile (lg:block)
- Full-width button and input

**Dependencies:** None (public page).

---

### 20. Reset Password

| Field | Value |
|-------|-------|
| **Route** | `/reset-password` |
| **Auth Level** | Public (ProtectedRoute wrapper) |
| **Priority** | P2 — Low |
| **File** | `client/src/pages/reset-password-page.tsx` |

**Purpose:** Password reset form page. Users arrive here from the reset link in their email. Provides email input and "Send Reset Link" button with the violet gradient design language.

**Components:**
- Layout wrapper
- KeyRound icon in violet badge
- "Reset Password" heading with description
- Card (shadow styled):
  - CardHeader: "Password Recovery" title, "We'll email you a secure reset link" description
  - Email input with Mail icon prefix
  - Info alert: "Check your spam folder" notice
  - "Send Reset Link" gradient button
  - "Back to Login" ghost button with ArrowLeft icon
- Footer: Help Center link, Contact Support link, copyright

**Data Requirements:**
- Firebase `confirmPasswordReset` (client-side, via token in URL)
- Currently a static UI (form not wired)

**Validation Rules:**
- email: valid email format, required
- (If wired) token: string from URL query param
- (If wired) new_password: string, min 6 chars

**Events:**
- `reset_password.viewed` — page loaded
- `reset_password.submitted` — new password set

**States:**
- **Default:** Email form with info alert
- **Success:** Confirmation message
- **Error:** Validation error messages

**Mobile Considerations:**
- Max-width md container, responsive padding
- Full-width card and buttons
- Footer links centered

**Dependencies:** None (public page, but functionally requires email from Forgot Password flow).

---

## Shared Components

These components are used across multiple pages and must be built before page-specific UI.

### Layout (`client/src/components/layout.tsx`)
- Sidebar navigation (collapsible)
- Header bar with title prop
- Main content area with scrolling
- Used by: Dashboard, TaskBoard, AgentChat, AgentProgramming, Analytics, CRM, Documents, Settings, Support, Tutorials, Admin, Login, Signup, ForgotPassword, ResetPassword, DashboardAlt

### Sidebar (`client/src/components/sidebar.tsx`)
- Navigation links: Home, Tasks, Chat, Analytics, CRM, Documents, Settings, Notifications, Support, Tutorials
- Active route highlighting
- Collapsible on mobile
- Company name display
- User avatar and logout

### Header (`client/src/components/header.tsx`)
- Page title (prop-driven)
- Children slot for page-specific actions (back buttons, etc.)
- Notification bell with unread count badge

### TaskBoard (`client/src/components/task-board.tsx`)
- Three-column kanban: Todo, In Progress, Done
- Drag-and-drop via react-beautiful-dnd
- Task creation inline
- Used by: Dashboard (/home), TaskBoardPage (/tasks)

### TaskCard (`client/src/components/task-card.tsx`)
- Title, description preview, priority badge, assigned agent, due date
- Click to open detail view
- Draggable wrapper

### AgentCard (`client/src/components/agent-card.tsx`)
- Agent name, role, icon (Remix Icon), latest activity
- Task count badges (todo, in-progress, done)
- Click navigates to /chat/:agentId
- Used by: Dashboard

### CreateAgentModal (`client/src/components/create-agent-modal.tsx`)
- Dialog with agent creation form
- Fields: name, role, department, role level, icon, instructions
- Used by: AgentChat, Documents

### AiFab (`client/src/components/ai-fab.tsx`)
- Floating action button (bottom-right)
- Opens AI assistant chat overlay
- Persists across page navigation
- Used by: Dashboard

### ActionApprovalPanel (`client/src/components/action-approval-panel.tsx`)
- List of pending agent actions requiring approval
- Approve/reject buttons per action
- Used by: Dashboard

### AIModelSelector (`client/src/components/ai-model-selector.tsx`)
- Provider dropdown (Anthropic, OpenAI, Gemini, Perplexity, XAI)
- Model dropdown (filtered by provider)
- Availability indicators
- Used by: AgentChat

### PerformanceAnalytics (`client/src/components/performance-analytics.tsx`)
- Charts and stat cards for agent/task metrics
- Uses Recharts
- Used by: Analytics page

### Integrations (`client/src/components/integrations.tsx`)
- Integration cards grid with connect/disconnect
- Used by: Integrations page

### GmailConnectButton (`client/src/components/gmail-connect-button.tsx`)
- Gmail OAuth connect/disconnect button with status
- Used by: Integrations page

### NotificationDropdown (`client/src/components/notification-dropdown.tsx`)
- Header dropdown for quick notification viewing
- Unread count badge
- Mark as read inline
- Used by: Header/Layout

### ApiKeyDialog (`client/src/components/api-key-dialog.tsx`)
- Modal for entering AI provider API keys
- Used by: AgentChat

### StatsOverview (`client/src/components/stats-overview.tsx`)
- Summary stat cards
- Used by: Analytics, Dashboard

### AgentMetrics (`client/src/components/agent-metrics.tsx`)
- Per-agent performance metrics display
- Used by: Analytics, AgentProgramming

---

## Suggested Generation Order

Build pages in this order to satisfy dependencies and maximize early testability:

### Wave 1 — Auth Foundation (P0)
1. **Auth** (`/auth`) — no dependencies, gates everything
2. **Login** (`/login`) — standalone alternative
3. **Signup** (`/signup`) — standalone alternative
4. **ForgotPassword** (`/forgot-password`) — standalone alternative
5. **ResetPassword** (`/reset-password`) — standalone alternative

### Wave 2 — Core Workspace (P0)
6. **CompanySetup** (`/company-setup`) — requires auth
7. **Dashboard** (`/home`) — requires company, main landing page

### Wave 3 — Primary Features (P0)
8. **TaskBoard** (`/tasks`) — requires agents/tasks infrastructure
9. **AgentChat** (`/chat/:agentId`) — requires agents
10. **AgentProgramming** (`/agent/:agentId/program`) — requires agents

### Wave 4 — Business Tools (P1)
11. **CRM** (`/crm`) — self-contained after auth/company
12. **Documents** (`/documents`) — self-contained after auth/company
13. **Analytics** (`/analytics`) — requires agents/tasks data
14. **Notifications** (`/notifications`) — requires notification generation
15. **Integrations** (`/integrations`) — requires integration infrastructure
16. **Settings** (`/settings`) — requires auth context

### Wave 5 — Secondary Pages (P2)
17. **Support** (`/support`) — low priority, static
18. **Tutorials** (`/tutorials`) — low priority, static
19. **AdminDashboard** (`/admin`) — placeholder, low priority
20. **DashboardAlt** (`/dashboard`) — spec editor, experimental

---

## API Surface Summary

**Total endpoints: 82 across 14 feature areas**

### Auth (4 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/register` | Create account (Passport.js) |
| POST | `/api/login` | Email/password login (Passport.js) |
| POST | `/api/logout` | End session |
| GET | `/api/user` | Current user profile |

### Firebase Auth (2 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/firebase` | Firebase token exchange |
| POST | `/api/auth/google` | Google OAuth token exchange |

### Company (3 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/company` | Get user's company |
| POST | `/api/company` | Create company |
| PATCH | `/api/company/:id` | Update company |

### Workflows (2 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |

### AI (5 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ai/models` | Available AI models |
| GET | `/api/ai/provider-status` | Provider API key status |
| POST | `/api/ai/generate` | Generate AI content |
| POST | `/api/ai/multi-agent` | Multi-agent conversation |
| POST | `/api/keys/save` | Save API key (dev) |

### Agents (8 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Agent detail |
| POST | `/api/agents` | Create agent |
| PATCH | `/api/agents/:id` | Update agent |
| GET | `/api/agents/:id/messages` | Agent chat history |
| POST | `/api/agents/:id/chat` | Send chat message |
| POST | `/api/agents/:id/clear-messages` | Clear chat history |
| POST | `/api/agents/:id/generate-response` | Test agent response |

### Agent Metrics (1 endpoint)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agents/:id/metrics` | Agent performance metrics |

### Agent Tasks (2 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agents/:id/tasks` | Agent's assigned tasks |
| GET | `/api/agents/:id/collaborative-tasks` | Agent's collaborative tasks |

### Tasks (12 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tasks` | List all tasks |
| GET | `/api/tasks/:id` | Task detail |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/assign` | Assign agent |
| POST | `/api/tasks/:id/collaborators` | Add collaborators |
| POST | `/api/tasks/:id/subtask` | Create subtask |
| GET | `/api/tasks/:id/subtasks` | List subtasks |
| GET | `/api/tasks/:id/messages` | Task thread |
| POST | `/api/tasks/:id/messages` | Add task message |
| GET | `/api/conversations/:id` | Conversation detail |

### Analytics (2 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stats` | Summary statistics |
| GET | `/api/analytics` | Detailed analytics data |

### Notifications (5 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/count` | Unread count |
| POST | `/api/notifications/:id/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Delete notification |

### Integrations (5 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/integrations` | List integrations |
| POST | `/api/integrations/connect` | Connect integration |
| GET | `/api/integrations/gmail/auth` | Gmail OAuth URL |
| GET | `/api/integrations/gmail/status` | Gmail status |
| POST | `/api/integrations/gmail/disconnect` | Disconnect Gmail |

### CRM (12 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/crm/contacts` | List contacts |
| GET | `/api/crm/contacts/:id` | Contact detail |
| POST | `/api/crm/contacts` | Create contact |
| PATCH | `/api/crm/contacts/:id` | Update contact |
| GET | `/api/crm/deals` | List deals |
| GET | `/api/crm/deals/:id` | Deal detail |
| POST | `/api/crm/deals` | Create deal |
| PATCH | `/api/crm/deals/:id` | Update deal |
| GET | `/api/crm/activities` | List activities |
| GET | `/api/crm/activities/:id` | Activity detail |
| POST | `/api/crm/activities` | Create activity |
| PATCH | `/api/crm/activities/:id` | Update activity |

### Documents & Folders (10 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/folders` | List folders |
| GET | `/api/folders/:id` | Folder detail |
| POST | `/api/folders` | Create folder |
| PATCH | `/api/folders/:id` | Rename folder |
| DELETE | `/api/folders/:id` | Delete folder |
| GET | `/api/documents` | List documents |
| GET | `/api/documents/:id` | Document detail |
| POST | `/api/documents` | Create document |
| PATCH | `/api/documents/:id` | Update document |
| DELETE | `/api/documents/:id` | Delete document |

### AI Assistant (3 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ai-assistant/messages` | Assistant chat history |
| POST | `/api/ai-assistant/messages` | Send assistant message |
| DELETE | `/api/ai-assistant/messages` | Clear assistant history |

### LLM Direct (1 endpoint)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/llm/chat` | Direct LLM chat |

### Actions (5 endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/actions` | List all actions |
| GET | `/api/actions/pending` | Pending approval actions |
| GET | `/api/actions/:id` | Action detail |
| POST | `/api/actions/:id/approve` | Approve action |
| POST | `/api/actions/:id/reject` | Reject action |

### Google OAuth Callback (1 endpoint)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/google/callback` | Gmail OAuth callback |

---

## Database Schema Summary

| Table | Primary Fields | Relationships |
|-------|---------------|---------------|
| `users` | id, username, email, password, fullName, avatar, firebaseUid, preferences, metadata | Owner of companies, agents, tasks |
| `companies` | id (serial), ownerUserId, name, type, stage, offer, targetCustomer, goals | Owns workflows |
| `agents` | id, name, role, roleLevel, department, icon, instructions, knowledgeBase, kpis, behavioralStyle, parentAgentId | Assigned to tasks, has messages/metrics |
| `tasks` | id, title, description, status, priority, agentId, assignedById, collaboratorIds, taskType, parentTaskId | Belongs to agent, has subtasks/messages |
| `messages` | id, agentId, taskId, conversationId, role, content, metadata | Belongs to agent conversation |
| `notifications` | id, userId, title, content, type, read, href, relatedId, metadata | Belongs to user |
| `crmContacts` | id, name, email, phone, company, title, status, userId | Has deals, activities |
| `crmDeals` | id, title, company, value, stage, probability, contactId, assignedAgentId, userId | Belongs to contact |
| `crmActivities` | id, type, subject, date, relatedToType, relatedToId, completed, userId | Related to contact or deal |
| `folders` | id, name, parentId, userId | Contains documents, self-referencing |
| `documents` | id, title, content, folderId, tags, userId | Belongs to folder |
| `integrations` | id, name, type, status, details, icon | Standalone |
| `workflows` | id, name, description, companyId, status | Belongs to company |
| `agentActions` | id, agentId, userId, actionType, actionName, parameters, status, requiresApproval | Belongs to agent |
| `agentMetrics` | id, agentId, userId, date, messagesSent, tasksCompleted, tokensUsed, apiCost | Belongs to agent |
| `oauthTokens` | id, userId, provider, accessToken, refreshToken, expiresAt | Belongs to user |
| `aiMessages` | id, role, content, userId | AI assistant thread |
| `session` | sid, sess, expire | Express session store |
