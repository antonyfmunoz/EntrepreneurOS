# EntrepreneurOS — MVP Product Requirements Document
Version 1.0 — MVP Scope
Product Owner: Antony F. Munoz
Product: EntrepreneurOS
Category: AI-Native Business Operating System
Scope: MVP — functional UI shell with real backend, AI substrate deferred

---

## 1. Executive Summary

EntrepreneurOS is an AI-native business operating system that enables founders and operators to run one or more companies through a unified interface combining organizational structure, role-based dashboards, workflows, and agentic execution.

MVP goal: A fully designed, fully wired frontend + backend shell. Every page matches the intended design. Every button, form, and nav item works. Data persists to Neon PostgreSQL. Auth is real via Firebase. The AI execution layer is a placeholder — the interface exists, stub responses are returned, and the slot is designed to be swapped for the real AI substrate later with no structural changes.

EntrepreneurOS is one of three OS products (OS Trinity):
- EntrepreneurOS: business, operations, execution
- CreatorOS: content, distribution, audience
- LYFEOS: personal life, focus, habits, mastery

MVP operates independently. CreatorOS and LYFEOS integration is deferred. Shared AI substrate is deferred.

---

## 2. Product Vision

To build the world's first truly AI-native operating system for entrepreneurs: a platform that structures companies, guides founders, deploys agentic labor, manages workflows, learns continuously, and helps humans operate at a world-class level regardless of prior experience.

The platform should function like a strategic advisor, an executive operating team, a workflow engine, a business intelligence system, and a human optimization layer — all through one coordinated interface.

---

## 3. Core Product Principles

1. Remove human friction, optimize the human operator
2. World-class standard from day one — intelligent rigor adapted to present scale
3. Never assume when clarification is needed
4. Process is education — teach while executing
5. One intelligence, many role instances
6. Human override is non-negotiable — pause, override, edit, cancel at any time

---

## 4. Target Users (MVP)

Primary: Founders and owner-operators running one or more companies who need strategy, execution, and clarity with leverage and without bloated teams.

Secondary: Agency owners, operators, coaches, consultants, holding company operators who need repeatable systems and multi-entity management.

---

## 5. MVP Scope — 12 Pages

### Auth (public)
1. **Login** — email/password + Google OAuth. Firebase auth.
2. **Signup** — username, email, full name, company (optional), password. Firebase auth.
3. **Forgot Password / Reset Password** — email-based reset flow.

### Onboarding
4. **Company Setup** — wizard: company name, stage (idea/pre-revenue/revenue/scaling/mature), industry, business model, strategic goals. Creates first company record. Routes to Portfolio on completion.

### Portfolio
5. **Portfolio Dashboard** — all companies owned by the user. Each company card shows: name, stage, industry, health indicator, quick actions (open, settings). Header shows portfolio-wide summary. Founder can add new company.

### Per-Company (each company has its own workspace)
6. **Command Center** — founder dashboard for selected company. Universal layout: Header (org context, global nav, search, notifications, account), Floating AI Control Panel (sticky, collapsed: KPIs + alerts + next actions; expanded: deeper insights + recommendations), Left Rail (Home, Tasks, Workflows, Org, Settings), Workspace (KPI cards, active workflows, recent tasks, alerts), Right Rail (AI chat stub — accepts input, returns placeholder response, designed for real AI swap later).

7. **Org Chart** — visual org chart for the company. Departments and roles displayed as nodes. Each role has: title, department, parent role, responsibilities, assigned human (optional), AI agent slot (placeholder). Editable — add/remove departments and roles. Generates default structure based on company stage and business model on first load.

8. **Agent Chat** — full-page AI EA interface (DEX). Persistent conversation history per company. Accepts user messages. Returns stub responses in v1. Designed as the primary human-AI interaction surface. Shows: conversation thread, agent status indicator, suggested actions panel.

9. **Task Board** — Kanban board: Backlog, In Progress, In Review, Done. Tasks have: title, description, priority (low/medium/high/critical), assignee (human user or AI agent placeholder), due date, company reference, created by. Create, edit, move, delete tasks. Filter by assignee, priority, status.

10. **Workflows** — list of SOPs/workflows for the company. Each workflow has: name, description, status (draft/active/deprecated), steps (ordered list with step type: human/AI/tool, description, completion state). Create, edit, run workflows step by step. Running a workflow shows current step, marks steps complete, tracks progress.

### Global
11. **Settings** — profile settings (name, email, avatar), company settings (name, stage, industry, goals), notification preferences, agent autonomy levels (observe/recommend/assist/execute — UI only in v1).

12. **Not Found** — 404 page with back to home action.

---

## 6. Universal Dashboard Layout

Every authenticated page uses this base layout:

**Header**
- Organization/portfolio context switcher
- Global navigation
- Search (UI only in v1)
- Notifications bell
- Account menu

**Floating AI Control Panel**
- Sticky at top-center of workspace
- Collapsed state: KPI chips + alert count + next-best action
- Expanded state: deeper insights, workflow context, AI recommendations
- In v1: populated with stub/placeholder data

**Left Rail**
- Home (Command Center)
- Tasks
- Workflows
- Org Chart
- Settings

**Workspace**
- Primary operational surface — varies per page

**Right Rail**
- AI chat interface (DEX)
- Agent activity log (stub in v1)
- Execution status

---

## 7. Data Model (MVP)

**Users** — id, email, username, fullName, avatarUrl, createdAt

**Companies** — id, ownerId, name, stage, industry, businessModel, goals, createdAt

**Departments** — id, companyId, name, description

**Roles** — id, companyId, departmentId, title, parentRoleId, responsibilities, assignedUserId (nullable), agentSlot (placeholder string)

**Tasks** — id, companyId, title, description, status, priority, assigneeId, dueDate, createdBy, createdAt

**Workflows** — id, companyId, name, description, status, createdAt

**WorkflowSteps** — id, workflowId, order, title, description, stepType (human/ai/tool), completedAt (nullable)

**AgentConversations** — id, companyId, userId, messages (jsonb array), createdAt, updatedAt

---

## 8. AI Placeholder Design

Every AI surface in v1 returns stub responses but is architecturally wired for swap:

- Right rail chat: accepts message, returns "DEX is analyzing your request... [stub]"
- Floating AI control panel: shows hardcoded next-best actions from company stage
- Agent status: shows "Online" indicator
- Org chart AI slot: shows "AI Agent (Coming Soon)" per role
- Task assignee: includes "DEX (AI)" as assignable option — tasks assigned to DEX are flagged, no execution in v1

When real AI substrate is ready: replace stub response functions with real agent calls. No page redesign required.

---

## 9. Backend Requirements

All routes RESTful, all data persisted to Neon PostgreSQL via Drizzle ORM.

Auth: Firebase for identity, session tokens for API auth.

Required API routes:
- POST /api/auth/register, /api/auth/login, /api/auth/logout
- GET/POST/PUT/DELETE /api/companies
- GET/POST/PUT/DELETE /api/companies/:id/departments
- GET/POST/PUT/DELETE /api/companies/:id/roles
- GET/POST/PUT/DELETE /api/companies/:id/tasks
- GET/POST/PUT/DELETE /api/companies/:id/workflows
- GET/POST/PUT /api/companies/:id/workflows/:wid/steps
- GET/POST /api/companies/:id/conversations
- GET/PUT /api/users/me

---

## Infrastructure: Clerk Organizations (OS Trinity Foundation)

Clerk organizations are enabled as the identity foundation for the OS Trinity (EntrepreneurOS, CreatorOS, LYFEOS):

- Each company in EntrepreneurOS can optionally belong to a Clerk organization
- When CreatorOS and LYFEOS launch, they join the same Clerk organization
- Users authenticate once via Clerk and access all three products under one identity
- No user needs to re-register across products
- Organization-level billing, roles, and permissions are managed through Clerk's dashboard
- The `org_id` column on the companies table links to the Clerk organization

This is foundation infrastructure — no user-facing organization UI is built in MVP. The wiring exists so that multi-product identity works from day one when the other OS products launch.

---

## 10. What Is Explicitly Deferred

- Real AI execution (all AI surfaces are stubs)
- CreatorOS and LYFEOS integration
- Shared intelligence substrate
- Reality intelligence engine
- Knowledge graph
- Memory system
- Multi-region infrastructure
- Advanced governance and permissions
- Analytics deep-dive page
- CRM, Documents, Tutorials, Integrations pages
