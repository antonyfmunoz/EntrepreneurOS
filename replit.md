# AgentOS - AI Operating System for Business

## Overview
AgentOS is an AI operating system where intelligent agents execute real actions (send emails, create documents, manage workflows) autonomously. Users approve actions, then agents do the work.

## Current State
- Authentication: Passport.js with LocalStrategy, PostgreSQL with Drizzle ORM
- Demo account: username "demo", password "password"
- Multi-provider LLM support (OpenAI, Anthropic, Perplexity, xAI)
- Task board with Kanban view
- Agent chat with model selection
- CRM module, Document vault, Notifications
- Agent Action System (Phase 1) - agents propose actions, users approve

## Recent Changes
- 2026-02-16: Implemented Phase 1 Agent Action System
  - Added agent_actions, oauth_tokens, agent_metrics database tables
  - Created Gmail OAuth integration service (server/integrations/gmail.ts)
  - Created Action Executor service (server/services/action-executor.ts)
  - Added API routes for actions (CRUD, approve/reject) and Gmail OAuth
  - Modified agent chat to extract action tags from AI responses
  - Created ActionApprovalPanel, GmailConnectButton, AgentMetrics components
  - Wired ActionApprovalPanel into dashboard, GmailConnectButton into integrations page

## Project Architecture
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, wouter routing
- Backend: Express.js, Drizzle ORM, PostgreSQL (Neon)
- AI: OpenAI SDK (direct), multi-provider via server/ai/index.ts
- State: TanStack Query for data fetching
- Auth: Passport.js local strategy + Google OAuth (Firebase optional)

### Key Files
- shared/schema.ts - All Drizzle table definitions and Zod schemas
- server/storage.ts - Database CRUD operations (IStorage interface)
- server/routes.ts - All API routes
- server/integrations/gmail.ts - Gmail OAuth and email sending
- server/services/action-executor.ts - Executes approved actions
- client/src/pages/agent-chat.tsx - Agent chat interface with model selection
- client/src/pages/dashboard.tsx - Dashboard with ActionApprovalPanel
- client/src/pages/integrations-page.tsx - Integrations with GmailConnectButton
- client/src/components/action-approval-panel.tsx - Pending action approval UI
- client/src/components/gmail-connect-button.tsx - Gmail OAuth connect/disconnect
- client/src/components/agent-metrics.tsx - Agent performance metrics display

### Action System
- Agents can propose actions via [ACTION:TYPE|param:value] tags in responses
- Supported action types: send_email, create_task, create_document
- Actions require user approval before execution
- Metrics tracked: messages, actions executed, tasks completed, time saved

### Environment Variables Needed
- OPENAI_API_KEY (configured)
- GOOGLE_CLIENT_ID (needed for Gmail integration)
- GOOGLE_CLIENT_SECRET (needed for Gmail integration)
- GOOGLE_REDIRECT_URI (defaults to http://localhost:5000/api/auth/google/callback)

## User Preferences
- Keep interface clean and simplified
- Model selector dropdown in chat input area (not sidebar)
- Virtual "direct-gpt4o" agent for direct OpenAI API access
