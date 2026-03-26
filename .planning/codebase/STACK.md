# Technology Stack

**Analysis Date:** 2026-03-25

## Languages

**Primary:**
- TypeScript 5.6.3 - Full stack (client, server, shared code)
- JavaScript - Build configuration and scripting

**Secondary:**
- Shell/Bash - Deployment and automation scripts

## Runtime

**Environment:**
- Node.js 20+ - Server runtime via Express

**Package Manager:**
- npm - Lockfile: present (package-lock.json)

## Frameworks

**Core:**
- Express 4.21.2 - HTTP server framework
- React 18.3.1 - Frontend UI library
- Vite 5.4.15 - Build tool and dev server
- Drizzle ORM 0.39.1 - Type-safe database layer with migrations via Drizzle Kit 0.30.4

**Frontend UI & Components:**
- Radix UI (multiple packages @radix-ui/*) - Unstyled, accessible component primitives
- shadcn/ui (via @replit/vite-plugin-shadcn-theme-json) - Styled component library built on Radix
- Tailwind CSS 3.4.14 - Utility-first CSS framework
- Framer Motion 11.13.1 - Animation library
- Wouter 3.3.5 - Client-side routing (lightweight alternative to React Router)

**Data & State Management:**
- TanStack Query (@tanstack/react-query) 5.60.5 - Server state management
- React Hook Form 7.53.1 - Form state management
- Zod 3.25.76 - Schema validation library
- drizzle-zod 0.7.1 - Zod schema generation from Drizzle ORM

**Testing:**
- Not detected in current dependencies

**Build/Dev:**
- esbuild 0.25.0 - Fast JavaScript bundler (production builds)
- tsx 4.19.1 - TypeScript runner for scripts
- Tailwind CSS Animate 1.0.7 - Tailwind animation utilities
- Class Variance Authority 0.7.0 - Type-safe component variant patterns
- PostCSS 8.4.47 - CSS processing with Autoprefixer 10.4.20

**Development Plugins:**
- @vitejs/plugin-react 4.3.2 - React Fast Refresh for Vite
- @replit/vite-plugin-runtime-error-modal - Runtime error overlay (Replit-specific)
- @replit/vite-plugin-cartographer - Dev tools plugin (Replit-specific)
- @replit/vite-plugin-shadcn-theme-json - shadcn theme JSON integration

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk 0.37.0 - Primary AI provider (Claude models)
- firebase 11.6.0 - Client-side Firebase Auth SDK
- firebase-admin 13.2.0 - Server-side Firebase Admin SDK
- @neondatabase/serverless 0.10.4 - Neon PostgreSQL serverless client
- postgres 3.4.5 - Native PostgreSQL driver for Drizzle

**API Clients & Integration:**
- @google/generative-ai 0.24.0 - Google Gemini API
- openai 4.96.2 - OpenAI API (gpt-4o and DALL-E)
- googleapis 171.4.0 - Google APIs client (Gmail, Google Calendar, Google Tasks OAuth)
- axios 1.13.5 - HTTP client

**Authentication & Security:**
- passport 0.7.0 - Authentication middleware
- passport-local 1.0.0 - Local username/password strategy
- express-session 1.18.1 - Session middleware
- connect-pg-simple 10.0.0 - PostgreSQL session store
- firebase (both client & admin) - OAuth via Firebase Auth

**Utilities & Data Processing:**
- date-fns 3.6.0 - Date manipulation
- react-beautiful-dnd 13.1.1 - Drag and drop (Kanban boards)
- recharts 2.13.0 - Data visualization
- lucide-react 0.453.0 - Icon library
- react-icons 5.4.0 - Alternative icon library
- form-data 2.5.4 - Multipart form data handling
- fast-xml-parser 5.3.6 - XML parsing
- jws 3.2.3 - JSON Web Signature signing
- node-forge 1.3.2 - JavaScript cryptography library
- input-otp 1.2.4 - OTP input component
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 2.5.4 - Tailwind class deduplication

**WebSocket & Real-time:**
- ws 8.18.0 - WebSocket library
- @types/ws 8.5.13 - TypeScript definitions for ws

**Performance & Concurrency:**
- p-limit 7.3.0 - Concurrency control
- p-retry 7.1.1 - Retry logic for failed promises
- memorystore 1.6.7 - In-memory session store (development fallback)

**Carousel & UI Components:**
- embla-carousel-react 8.3.0 - Headless carousel component
- react-resizable-panels 2.1.4 - Resizable panel layouts
- vaul 1.1.0 - Drawer component
- react-day-picker 8.10.1 - Date picker

**Command & CLI:**
- cmdk 1.0.0 - Command menu component
- glob 11.1.0 - File globbing
- qs 6.14.1 - Query string parser

**Icons:**
- remixicon 4.6.0 - Icon set

## Configuration

**Environment:**
- Configured via `.env` file (not committed)
- Vite uses `VITE_` prefix for environment variables exposed to client
- Firebase config accessed via: `VITE_FIREBASE_*` variables

**Key Configs Required:**
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `VITE_FIREBASE_API_KEY` - Firebase client API key
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (base64 or raw)
- `FIREBASE_CLIENT_EMAIL` - Firebase client email (fallback)
- `FIREBASE_PRIVATE_KEY` - Firebase private key (fallback)
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` - Claude API key
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` - Claude API base URL
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `PERPLEXITY_API_KEY` - Perplexity API key (optional)
- `XAI_API_KEY` - X.AI API key (optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI

**Build Configuration Files:**
- `tsconfig.json` - TypeScript compiler options with path aliases
- `vite.config.ts` - Vite build and dev server config
- `drizzle.config.ts` - Drizzle ORM migrations config
- `tailwind.config.ts` - Tailwind CSS theme and plugin config
- `postcss.config.js` - PostCSS plugins (Tailwind, Autoprefixer)

**Path Aliases (tsconfig.json):**
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

**Vite Aliases (vite.config.ts):**
- `@` → `./client/src`
- `@shared` → `./shared`
- `@assets` → `./attached_assets`

## Platform Requirements

**Development:**
- Node.js 20+
- npm
- TypeScript 5.6.3 (dev dependency)

**Production:**
- Node.js 20+ runtime
- PostgreSQL database (Neon serverless recommended)
- Firebase project configured
- AI API keys configured (Anthropic minimum)
- Google OAuth credentials (for Gmail integration)

**Build Output:**
- ESM (ECMAScript modules) format
- Client builds to `dist/public/` (served as static assets)
- Server builds to `dist/index.js` (Node.js executable)

---

*Stack analysis: 2026-03-25*
