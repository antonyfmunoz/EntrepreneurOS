# AgentOS - AI Operating System for Businesses

## Overview
AgentOS is an AI operating system where intelligent agents execute real actions (send emails, create documents, manage workflows) autonomously. Users approve actions, then agents do the work.

## Current State
- Full-stack JS app with Express backend, React/Vite frontend
- PostgreSQL database with Drizzle ORM
- Multi-provider LLM support (OpenAI, Anthropic, Perplexity, xAI)
- Task management, CRM, document system, notifications
- Agent Action System (Phase 1) with Gmail integration and approval workflow

## Recent Changes
- **Feb 2026**: Implemented Phase 1 Agent Action System
  - Added agent_actions, oauth_tokens, agent_metrics database tables
  - Built Gmail OAuth integration with CSRF protection
  - Created action executor service for email sending and document creation
  - Agent chat extracts [ACTION:...] tags from AI responses to create pending actions
  - ActionApprovalPanel on dashboard shows pending actions for user approval
  - GmailConnectButton on integrations page for OAuth flow
  - AgentMetrics component for tracking agent performance
  - All action routes enforce user ownership checks

## Project Architecture

### Database (PostgreSQL + Drizzle ORM)
- Schema defined in `shared/schema.ts`
- Push changes with `npm run db:push` (use `--force` if needed)
- Tables: users, agents, tasks, messages, integrations, notifications, ai_messages, crm_contacts, crm_deals, crm_activities, folders, documents, agent_actions, oauth_tokens, agent_metrics

### Backend (Express)
- Routes in `server/routes.ts`
- Storage layer in `server/storage.ts` (DatabaseStorage class)
- Auth via Passport.js with LocalStrategy
- Gmail integration: `server/integrations/gmail.ts`
- Action executor: `server/services/action-executor.ts`
- AI services: `server/ai/index.ts`, `server/openai.ts`

### Frontend (React + Vite + shadcn/ui)
- Pages in `client/src/pages/`
- Components in `client/src/components/`
- Uses TanStack Query v5 for data fetching
- Uses wouter for routing
- Styling: Tailwind CSS + shadcn/ui

### Key Patterns
- Agent chat uses virtual "direct-gpt4o" agent for direct OpenAI access
- Action tags format: `[ACTION:SEND_EMAIL|to:email|subject:Subject|body:Body]`
- All API routes check `req.isAuthenticated()` + user ownership
- Gmail OAuth uses state parameter for CSRF protection

## User Preferences
- Demo account: username "demo", password "password"
- Model selector dropdown in chat input area (not sidebar)
- Clean, minimal UI preferred

## Environment Variables Required
- DATABASE_URL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (auto-configured)
- OPENAI_API_KEY (for AI features)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (for Gmail integration)
- GOOGLE_REDIRECT_URI (optional, auto-detected)
