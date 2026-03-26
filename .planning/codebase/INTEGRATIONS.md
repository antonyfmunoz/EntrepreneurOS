# External Integrations

**Analysis Date:** 2026-03-25

## APIs & External Services

**AI/LLM Services:**
- Anthropic Claude - Primary AI provider
  - SDK/Client: `@anthropic-ai/sdk` 0.37.0
  - Auth: `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
  - Custom Base URL: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
  - Models: claude-haiku-4-5 (default), claude-sonnet-4-5 (escalation for complex tasks)
  - Usage: `server/ai/anthropic-service.ts`, `server/openai.ts`, `server/routes.ts`

- OpenAI - Secondary AI provider
  - SDK/Client: `openai` 4.96.2
  - Auth: `OPENAI_API_KEY`
  - Models: gpt-4o (primary), dall-e-3 (image generation)
  - Usage: `server/ai/openai-service.ts`

- Google Gemini - Vision and generative AI
  - SDK/Client: `@google/generative-ai` 0.24.0
  - Auth: `GEMINI_API_KEY`
  - Models: gemini-2.5-pro
  - Usage: `server/ai/gemini-service.ts`

- Perplexity - Search-based AI (optional)
  - SDK/Client: OpenAI-compatible client
  - Auth: `PERPLEXITY_API_KEY`
  - Usage: `server/ai/perplexity-service.ts`

- X.AI - Alternative AI provider (optional)
  - SDK/Client: OpenAI-compatible client
  - Auth: `XAI_API_KEY`
  - Usage: `server/ai/xai-service.ts`

**Email & Communication:**
- Gmail API - Email sending and OAuth
  - SDK/Client: `googleapis` 171.4.0
  - Auth: Google OAuth 2.0 (client credentials)
  - Environment: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  - Scopes: gmail.send, gmail.readonly, gmail.compose
  - Usage: `server/integrations/gmail.ts`, OAuth token storage via `storage.ts`

- Google Calendar & Tasks - Calendar integration (optional)
  - SDK/Client: `googleapis` 171.4.0
  - Auth: Google OAuth 2.0
  - Usage: Referenced in global context as integration point

## Data Storage

**Databases:**
- PostgreSQL (Neon serverless)
  - Connection: `DATABASE_URL` environment variable
  - Client: `postgres` 3.4.5 native driver
  - ORM: Drizzle ORM 0.39.1
  - Fallback: `@neondatabase/serverless` 0.10.4 for edge runtime
  - Schema: `shared/schema.ts`
  - Migrations: `drizzle.config.ts`, migrations in `migrations/` directory

**File Storage:**
- Local filesystem only - No cloud storage configured

**Caching:**
- In-memory sessions via `memorystore` 1.6.7 (development)
- Production: PostgreSQL session store via `connect-pg-simple` 10.0.0

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Client SDK: `firebase` 11.6.0
  - Server SDK: `firebase-admin` 13.2.0
  - Configuration: `server/firebase.ts`, `client/src/lib/firebase.ts`
  - Auth Methods:
    - Email/password via custom user table (`shared/schema.ts` users table)
    - Google OAuth via Firebase Auth
    - ReCAPTCHA verification (configured in client)

**Local Authentication:**
- Passport.js 0.7.0 with passport-local 1.0.0
  - Session storage: PostgreSQL via `connect-pg-simple` 10.0.0
  - Configuration: `server/auth.ts`

**Token Management:**
- Firebase ID tokens verified server-side via `verifyFirebaseToken()`
- Google OAuth tokens stored in database via `storage.upsertOauthToken()`
- Token refresh handled automatically for Gmail OAuth

## Monitoring & Observability

**Error Tracking:**
- Not detected - No external error tracking service configured

**Logs:**
- Console logging throughout application
- Server logs request/response metadata in `server/index.ts`
- AI service errors logged to console

## CI/CD & Deployment

**Hosting:**
- Replit (primary development/deployment platform)
- Tailscale integration via environment variables (from global context)

**CI Pipeline:**
- Not detected in current codebase

## Environment Configuration

**Required env vars (critical):**
- `DATABASE_URL` - PostgreSQL connection
- `VITE_FIREBASE_API_KEY` - Firebase client
- `VITE_FIREBASE_PROJECT_ID` - Firebase client
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase client
- `VITE_FIREBASE_APP_ID` - Firebase client
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase server auth
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` - Claude API
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` - Claude API
- `GOOGLE_CLIENT_ID` - Gmail OAuth
- `GOOGLE_CLIENT_SECRET` - Gmail OAuth
- `GOOGLE_REDIRECT_URI` - Gmail OAuth callback

**Optional env vars:**
- `OPENAI_API_KEY` - OpenAI fallback
- `GEMINI_API_KEY` - Google Gemini
- `PERPLEXITY_API_KEY` - Perplexity search
- `XAI_API_KEY` - X.AI
- `FIREBASE_CLIENT_EMAIL` - Firebase fallback
- `FIREBASE_PRIVATE_KEY` - Firebase fallback

**Secrets location:**
- `.env` file (not committed to git)
- Firebase service account: environment variable (base64 encoded or JSON string)

## Webhooks & Callbacks

**Incoming:**
- `/api/auth/google/callback` - Google OAuth callback for Gmail
- `/api/llm/*` - AI service endpoints
- Various API endpoints in `server/routes.ts`

**Outgoing:**
- Gmail OAuth redirect during authentication flow
- No external webhook subscriptions detected

## Multi-LLM Architecture

**Strategy:** Service factory pattern in `server/ai/index.ts`
- Available services checked at runtime based on configured API keys
- Automatic fallback between providers
- AnthropicService escalates complex tasks from Haiku to Sonnet model
- All services implement `AIServiceInterface`

**Configuration Detection:**
```
- Anthropic: !!(AI_INTEGRATIONS_ANTHROPIC_API_KEY && AI_INTEGRATIONS_ANTHROPIC_BASE_URL)
- OpenAI: !!OPENAI_API_KEY
- Gemini: !!GEMINI_API_KEY
- Perplexity: !!PERPLEXITY_API_KEY
- X.AI: !!XAI_API_KEY
```

**Service Files:**
- `server/ai/anthropic-service.ts` - Claude integration with auto-escalation
- `server/ai/openai-service.ts` - OpenAI gpt-4o and DALL-E
- `server/ai/gemini-service.ts` - Google Gemini vision and generation
- `server/ai/perplexity-service.ts` - Perplexity search
- `server/ai/xai-service.ts` - X.AI Grok
- `server/ai/index.ts` - Service factory and orchestration

---

*Integration audit: 2026-03-25*
