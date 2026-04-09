# EntrepreneurOS MVP Spec

Source: `.planning/PRD.md` (authoritative)
Design System: `.planning/design-system.md` (The Ethereal Professional)
Generated: 2026-04-09
Pages: 13 (ForgotPassword and ResetPassword are separate routes)

---

## Page Summary

| # | Page | Route | Auth | Priority | Key Components |
|---|------|-------|------|----------|----------------|
| 1 | Login | /login | public | P1 | LoginForm, GoogleOAuthButton |
| 2 | Signup | /signup | public | P1 | SignupForm, GoogleOAuthButton |
| 3 | ForgotPassword | /forgot-password | public | P1 | ForgotPasswordForm |
| 4 | ResetPassword | /reset-password | public | P1 | ResetPasswordForm |
| 5 | CompanySetup | /company-setup | authenticated | P2 | SetupWizard, StepIndicator |
| 6 | PortfolioDashboard | /portfolio | authenticated | P2 | CompanyCard, PortfolioSummary |
| 7 | CommandCenter | /company/:companyId | authenticated | P3 | KPICardGrid, ActiveWorkflowsList, RecentTasksList |
| 8 | OrgChart | /company/:companyId/org | authenticated | P3 | OrgTreeView, DepartmentNode, RoleNode |
| 9 | AgentChat | /company/:companyId/chat | authenticated | P3 | ConversationThread, ChatInput, SuggestedActionsPanel |
| 10 | TaskBoard | /company/:companyId/tasks | authenticated | P3 | KanbanBoard, TaskCard, TaskFilters |
| 11 | Workflows | /company/:companyId/workflows | authenticated | P3 | WorkflowList, WorkflowRunner, WorkflowStepItem |
| 12 | Settings | /settings | authenticated | P4 | SettingsTabs, ProfileForm, AutonomyLevelSelector |
| 13 | NotFound | /* | public | P5 | NotFoundIllustration, BackToHomeButton |

---

## Shared Components

| Component | Purpose | Used By |
|-----------|---------|--------|
| UniversalLayout | Base layout wrapper: Header + LeftRail + Workspace + RightRail + FloatingAIPanel | All per-company pages + Settings |
| Header | Glassmorphism navbar with org context, search, notifications, account | All authenticated pages |
| LeftRail | Navigation sidebar: Home, Tasks, Workflows, Org, Settings | All per-company pages + Settings |
| RightRail | AI interaction panel with DEX chat stub + agent status | Per-company pages (not AgentChat) |
| FloatingAIPanel | Sticky KPI chips + alerts + next-best action. Expandable. Stub data in v1 | Per-company pages (not AgentChat) |
| AgentChatStub | Reusable DEX chat interface. Stub responses in v1. Designed for real AI swap | CommandCenter (right rail) + AgentChat (full page) |

---

## Pages

### 1. Login (`/login`) — Public, P1

**Purpose:** Email/password and Google OAuth login. Firebase auth. Redirects to Portfolio Dashboard on success.

**Layout:** Centered card on surface background. Standalone auth page — no universal dashboard layout. Asymmetric left margin for editorial feel.

**Components:** BrandLogo, LoginForm, GoogleOAuthButton, ForgotPasswordLink, SignupLink

**States:**
- Empty: Form always visible
- Loading: Submit button spinner. OAuth button shows connecting state
- Error: Inline error below fields. Toast for network errors

**API:** `POST /api/auth/login`

**Validation:** Email must be valid format. Password required.

**Events:** page_viewed, login_attempted, login_succeeded, login_failed, oauth_initiated

---

### 2. Signup (`/signup`) — Public, P1

**Purpose:** User registration with username, email, full name, optional company, password. Firebase auth. Redirects to Company Setup.

**Layout:** Centered card, same visual treatment as Login.

**Components:** BrandLogo, SignupForm, GoogleOAuthButton, LoginLink

**States:**
- Empty: Form always visible
- Loading: Submit button spinner
- Error: Inline field-level validation. Toast for server errors

**API:** `POST /api/auth/register`

**Validation:** Username min 3 chars. Email valid. Full name required. Password min 8 chars. Confirm password match.

**Events:** page_viewed, signup_attempted, signup_succeeded, signup_failed

---

### 3. ForgotPassword (`/forgot-password`) — Public, P1

**Purpose:** Password recovery initiation. User enters email to receive reset link via Firebase.

**Layout:** Centered card, same auth visual language.

**Components:** BrandLogo, ForgotPasswordForm, BackToLoginLink, SuccessMessage

**States:**
- Loading: Submit spinner
- Error: Inline error for invalid email

**Events:** page_viewed, reset_email_requested, reset_email_sent

---

### 4. ResetPassword (`/reset-password`) — Public, P1

**Purpose:** Password reset completion using token from email link.

**Layout:** Centered card, same auth visual language.

**Components:** BrandLogo, ResetPasswordForm, BackToLoginLink, SuccessMessage

**States:**
- Error: Expired/invalid token error. Inline validation for password mismatch

**Validation:** New password min 8 chars. Confirm match. Token required.

**Events:** page_viewed, password_reset_completed, password_reset_failed

---

### 5. CompanySetup (`/company-setup`) — Authenticated, P2

**Purpose:** First-run onboarding wizard. Creates first company record. Routes to Portfolio on completion.

**Layout:** Centered single-column wizard with step indicator. Standalone onboarding page — no universal dashboard.

**Components:** SetupWizard, CompanyNameInput, StageSelector, IndustryInput, BusinessModelInput, GoalsTextarea, SubmitButton, StepIndicator

**States:**
- Empty: All fields empty, step indicator shows progress
- Loading: Submit spinner during company creation
- Error: Inline field validation. Toast on server error

**API:** `POST /api/companies`

**Validation:** Name required. Stage selected. Industry required. Business model required. Goals provided.

**Events:** page_viewed, setup_step_completed, company_created

---

### 6. PortfolioDashboard (`/portfolio`) — Authenticated, P2

**Purpose:** All companies owned by user. Company cards with name, stage, industry, health indicator, quick actions. Add new company.

**Layout:** No universal dashboard — portfolio-level page. Header with summary, grid of company cards below.

**Components:** PortfolioHeader, PortfolioSummary, CompanyCard, AddCompanyButton, CompanyQuickActions

**States:**
- Empty: "Create your first company" CTA with illustration
- Loading: Skeleton cards in grid
- Error: Toast + retry button

**API:** `GET /api/companies`, `POST /api/companies`, `DELETE /api/companies/:id`

**Events:** page_viewed, company_opened, add_company_clicked

---

### 7. CommandCenter (`/company/:companyId`) — Authenticated, P3

**Purpose:** Founder dashboard for selected company. KPI cards, active workflows, recent tasks, alerts. Floating AI control panel. Right rail AI chat stub.

**Layout:** Universal dashboard layout — Header, FloatingAIPanel, LeftRail, Workspace (KPI grid + lists), RightRail (DEX chat).

**Components:** KPICardGrid, ActiveWorkflowsList, RecentTasksList, AlertsPanel, QuickActionButtons

**States:**
- Empty: KPIs show zero. Onboarding prompts: "Add your first task", "Create a workflow", "Set up your org chart"
- Loading: Skeleton cards for KPIs. Shimmer for lists
- Error: Per-section retry buttons. Toast for API errors

**API:** `GET /api/companies/:id`, `GET /api/companies/:id/tasks`, `GET /api/companies/:id/workflows`, `GET /api/companies/:id/departments`, `GET /api/companies/:id/roles`

**Events:** page_viewed, kpi_card_clicked, quick_action_clicked, ai_panel_toggled

---

### 8. OrgChart (`/company/:companyId/org`) — Authenticated, P3

**Purpose:** Visual org chart. Departments and roles as tree nodes. Each role shows title, department, assigned human, AI agent slot (placeholder). Editable. Generates default structure on first load.

**Layout:** Universal dashboard layout. Workspace contains org tree. Role detail panel slides from right.

**Components:** OrgTreeView, DepartmentNode, RoleNode, AddDepartmentButton, AddRoleButton, RoleDetailPanel, AgentSlotBadge

**States:**
- Empty: CTA to generate default structure or start from scratch
- Loading: Skeleton tree nodes
- Error: Toast for CRUD failures

**API:** Full CRUD for departments (`/api/companies/:id/departments`) and roles (`/api/companies/:id/roles`)

**Events:** page_viewed, department_created, role_created, default_structure_generated

---

### 9. AgentChat (`/company/:companyId/chat`) — Authenticated, P3

**Purpose:** Full-page DEX AI assistant. Persistent conversation per company. Stub responses in v1. Primary human-AI surface.

**Layout:** Universal dashboard layout but workspace IS the chat. Right rail hidden — chat is the workspace.

**Components:** ConversationThread, ChatMessageBubble, ChatInput, AgentStatusIndicator, SuggestedActionsPanel

**States:**
- Empty: DEX introduces itself with suggested starter prompts
- Loading: Typing indicator (animated dots). Skeleton bubbles on initial load
- Error: Failed message shows inline retry

**API:** `GET /api/companies/:id/conversations`, `POST /api/companies/:id/conversations`

**Validation:** Message required, max 4000 chars.

**Events:** page_viewed, message_sent, suggested_action_clicked

---

### 10. TaskBoard (`/company/:companyId/tasks`) — Authenticated, P3

**Purpose:** Kanban board: Backlog, In Progress, In Review, Done. Drag-and-drop. CRUD tasks. Filter by assignee/priority/status. DEX as assignee option.

**Layout:** Universal dashboard layout. Workspace contains horizontal scrollable kanban. Filter bar above board.

**Components:** KanbanBoard, KanbanColumn, TaskCard, CreateTaskDialog, EditTaskDialog, TaskFilters, AssigneeSelector

**States:**
- Empty: Column headers visible. CTA in first column: "Create your first task"
- Loading: Skeleton task cards per column
- Error: Toast for failed operations. Optimistic updates with rollback

**API:** Full CRUD for tasks (`/api/companies/:id/tasks`)

**Validation:** Title required. Priority from enum. Status from enum.

**Events:** page_viewed, task_created, task_moved, task_assigned_to_ai, filter_applied

---

### 11. Workflows (`/company/:companyId/workflows`) — Authenticated, P3

**Purpose:** SOP/workflow management. Each workflow has ordered steps (human/AI/tool type). Create, edit, run step by step.

**Layout:** Universal dashboard layout. Workspace shows workflow cards. Clicking opens runner view.

**Components:** WorkflowList, WorkflowCard, CreateWorkflowDialog, WorkflowRunner, WorkflowStepItem, StepTypeSelector, WorkflowStatusBadge

**States:**
- Empty: CTA + suggested templates based on company stage
- Loading: Skeleton workflow cards
- Error: Toast for failures. Step completion errors show inline retry

**API:** Full CRUD for workflows (`/api/companies/:id/workflows`) and steps (`/api/companies/:id/workflows/:wid/steps`)

**Validation:** Name required. Status from enum. Step title required. Step type from enum.

**Events:** page_viewed, workflow_created, workflow_started, workflow_step_completed, workflow_completed

---

### 12. Settings (`/settings`) — Authenticated, P4

**Purpose:** Profile settings, company settings, notification preferences, agent autonomy levels (UI only in v1). Tabbed interface.

**Layout:** Universal dashboard layout. Workspace contains tabbed settings panel.

**Components:** SettingsTabs, ProfileForm, CompanySettingsForm, NotificationPreferences, AutonomyLevelSelector, AvatarUpload

**States:**
- Empty: Pre-filled with current user/company data
- Loading: Shimmer placeholders
- Error: Inline validation. Toast for save failures

**API:** `GET /api/users/me`, `PUT /api/users/me`, `GET /api/companies/:id`, `PUT /api/companies/:id`

**Validation:** Username min 3 chars. Email valid. Autonomy level from enum.

**Events:** page_viewed, settings_tab_changed, profile_updated, company_settings_updated, autonomy_level_changed

---

### 13. NotFound (`/*`) — Public, P5

**Purpose:** 404 handler. Friendly error page with back to home action.

**Layout:** Centered single-column. Standalone — no universal dashboard.

**Components:** NotFoundIllustration, ErrorMessage, BackToHomeButton

**Events:** page_viewed (attemptedRoute), back_to_home_clicked

---

## Backend Spec

31 endpoints across 8 Drizzle tables: users, companies, departments, roles, tasks, workflows, workflow_steps, agent_conversations.

See `eos-mvp-spec.json` → `backendSpec` for full endpoint details with request/response fields.

### Route Groups

| Group | Endpoints | Auth |
|-------|-----------|------|
| Auth | 3 (register, login, logout) | Public (register/login), Auth (logout) |
| Users | 2 (get me, update me) | Auth |
| Companies | 4 (CRUD) | Auth |
| Departments | 4 (CRUD per company) | Auth |
| Roles | 4 (CRUD per company) | Auth |
| Tasks | 4 (CRUD per company) | Auth |
| Workflows | 4 (CRUD per company) | Auth |
| Workflow Steps | 3 (list, create, update) | Auth |
| Conversations | 2 (get, send message) | Auth |
| **Total** | **30** | |

---

## Suggested Build Order

1. Auth pages (Login, Signup, ForgotPassword, ResetPassword)
2. Onboarding (CompanySetup)
3. Portfolio (PortfolioDashboard)
4. Per-company core (CommandCenter, TaskBoard)
5. Per-company extended (OrgChart, AgentChat, Workflows)
6. Global (Settings)
7. Error (NotFound)

---

## Design System Reference

All pages follow "The Ethereal Professional" design system:
- Colors: Primary #6a37d4, Surface #f5f6f7, On-Surface #2c2f30
- Typography: Inter only, tight headlines, relaxed body
- Elevation: Ghost shadows (purple-tinted), glassmorphism on floating elements
- Borders: No 1px solid borders — use background shifts
- Radius: 12px standard
- Icons: lucide-react exclusively

---

## What Is NOT In This Spec

These are explicitly deferred per PRD section 10:
- Real AI execution (all AI surfaces are stubs)
- CRM, Documents, Tutorials, Integrations pages
- Analytics deep-dive page
- CreatorOS and LYFEOS integration
- Knowledge graph, memory system
- Advanced governance and permissions
