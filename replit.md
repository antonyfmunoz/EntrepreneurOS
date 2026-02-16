# AgentOS - AI Operating System for Business

## Overview
AgentOS is an AI operating system where intelligent agents execute real actions (send emails, create documents, manage workflows) autonomously. Users approve actions, then agents do the work.

## Current State
- Authentication: Firebase Auth (primary) with Passport.js fallback
- Firebase features: Google OAuth, email/password, email verification, password reset, 2FA (phone MFA)
- Multi-provider LLM support (OpenAI, Anthropic, Perplexity, xAI)
- Task board with Kanban view
- Agent chat with model selection
- CRM module, Document vault, Notifications
- Agent Action System (Phase 1) - agents propose actions, users approve

## Recent Changes
- 2026-02-16: Implemented Firebase Authentication System
  - Updated server/firebase.ts to properly initialize with service account key
  - Updated server/auth.ts with /api/auth/firebase endpoint for token verification
  - Updated client/src/lib/firebase.ts with proper config and auth domain
  - Updated client/src/hooks/use-auth.tsx with Firebase login/register, password reset, 2FA
  - Updated client/src/pages/auth-page.tsx with email login, Google OAuth, forgot password, 2FA flow
  - Updated client/src/pages/settings-page.tsx with Security tab (email verification, 2FA enrollment, password reset)
  - Graceful fallback to Passport.js local auth when Firebase is not configured
- 2026-02-16: Implemented Phase 1 Agent Action System
  - Added agent_actions, oauth_tokens, agent_metrics database tables
  - Created Gmail OAuth integration service (server/integrations/gmail.ts)
  - Created Action Executor service (server/services/action-executor.ts)
  - Added API routes for actions (CRUD, approve/reject) and Gmail OAuth
  - Modified agent chat to extract action tags from AI responses
  - Created ActionApprovalPanel, GmailConnectButton, AgentMetrics components

## Project Architecture
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, wouter routing
- Backend: Express.js, Drizzle ORM, PostgreSQL (Neon)
- AI: OpenAI SDK (direct), multi-provider via server/ai/index.ts
- State: TanStack Query for data fetching
- Auth: Firebase Auth (primary) with Passport.js local strategy fallback

### Key Files
- shared/schema.ts - All Drizzle table definitions and Zod schemas
- server/storage.ts - Database CRUD operations (IStorage interface)
- server/routes.ts - All API routes
- server/auth.ts - Auth setup (Passport + Firebase token verification)
- server/firebase.ts - Firebase Admin SDK initialization
- client/src/lib/firebase.ts - Firebase client SDK initialization
- client/src/hooks/use-auth.tsx - Auth context with Firebase & Passport support
- client/src/pages/auth-page.tsx - Login/Register with Google OAuth, password reset, 2FA
- client/src/pages/settings-page.tsx - Settings with Security tab (2FA, email verification)
- client/src/pages/agent-chat.tsx - Agent chat interface with model selection
- client/src/pages/dashboard.tsx - Dashboard with ActionApprovalPanel
- server/integrations/gmail.ts - Gmail OAuth and email sending
- server/services/action-executor.ts - Executes approved actions

### Authentication Flow
1. Firebase configured: Uses Firebase Auth SDK for all auth (email/password, Google OAuth)
2. Firebase not configured: Falls back to Passport.js local strategy
3. Backend syncs Firebase users to PostgreSQL via /api/auth/firebase endpoint
4. Firebase ID tokens verified server-side with Firebase Admin SDK
5. Session cookies maintained for backward compatibility

### Firebase Features
- Email/Password sign-up and sign-in
- Google OAuth sign-in
- Email verification (sent on registration)
- Password reset via email
- 2FA with phone-based MFA (SMS verification)
- 2FA enrollment via Settings > Security tab

### Environment Variables Needed
- OPENAI_API_KEY (configured)
- VITE_FIREBASE_API_KEY (frontend - Firebase web API key)
- VITE_FIREBASE_PROJECT_ID (frontend + backend - Firebase project ID)
- VITE_FIREBASE_APP_ID (frontend - Firebase app ID)
- VITE_FIREBASE_AUTH_DOMAIN (frontend - optional, defaults to {projectId}.firebaseapp.com)
- FIREBASE_SERVICE_ACCOUNT_KEY (backend - JSON service account key)
- GOOGLE_CLIENT_ID (needed for Gmail integration)
- GOOGLE_CLIENT_SECRET (needed for Gmail integration)

## User Preferences
- Keep interface clean and simplified
- Model selector dropdown in chat input area (not sidebar)
- Virtual "direct-gpt4o" agent for direct OpenAI API access
- Firebase for authentication (Google OAuth, 2FA, email verification, password reset)
