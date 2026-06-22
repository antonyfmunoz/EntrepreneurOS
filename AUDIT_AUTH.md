# Auth Audit: Firebase & Passport Migration Status

**Date:** 2026-06-22
**Branch:** feature/company-system
**Purpose:** Map every auth import, usage, and env var for Clerk migration readiness.

---

## Executive Summary

Firebase and Passport have already been fully removed from the codebase. **Clerk is the sole authentication provider.** The migration is complete at the code level. What remains are legacy artifacts: migration scripts, a vestigial `password` column, a dead `auth-page.tsx`, a `session` table, and stale CLAUDE.md references.

---

## 1. Current Auth Stack (Clerk)

### Server-side

| File | Role | Key Details |
|------|------|-------------|
| `server/auth.ts` | Auth wiring entrypoint | Mounts `clerkMiddleware()`, `extractClerkOrg`, `attachClerkUser`. Exposes `GET /api/user` and `POST /api/logout`. |
| `server/middleware/auth.ts` | Core auth middleware | `attachClerkUser` — lazy-creates local user from Clerk session. Installs `req.isAuthenticated()` polyfill and `req.user` for route compatibility. `requireAuth` — explicit 401 guard. |
| `server/middleware/clerk-org.ts` | Org extraction | Reads `orgId` from Clerk JWT, sets `req.clerkOrg`. |
| `server/storage.ts` | User lookup | `getUserByClerkId(clerkUserId)` — queries `users.clerk_user_id` column. `createUser()` — accepts `clerkUserId` field. |
| `shared/schema.ts` | Schema | `users.clerkUserId` column (`clerk_user_id`). `companies.orgId` column for Clerk org. |

### Client-side

| File | Role | Key Details |
|------|------|-------------|
| `client/src/App.tsx` | Provider tree | `ClerkProvider` wraps app. `ClerkTokenProvider` injects `getToken` for API calls. |
| `client/src/lib/clerk.ts` | Clerk config helper | `isClerkConfigured()`, `getClerkPublishableKey()`. Reads `VITE_CLERK_PUBLISHABLE_KEY`. |
| `client/src/hooks/use-auth.tsx` | Auth context | Wraps Clerk hooks (`useUser`, `useAuth`, `useSignIn`). Syncs local DB user via `/api/user`. Logout calls `clerkSignOut()`. Password reset via `signIn.create({ strategy: "reset_password_email_code" })`. |
| `client/src/hooks/use-organization.ts` | Org context | `useActiveOrg()` — wraps `useOrganization()` and `useOrganizationList()`. |
| `client/src/lib/protected-route.tsx` | Route guard | Uses `useUser()` from `@clerk/clerk-react`. Redirects to `/login` if not signed in. |
| `client/src/pages/login-page.tsx` | Login | Renders `<SignIn>` from `@clerk/clerk-react`. |
| `client/src/pages/signup-page.tsx` | Signup | Renders `<SignUp>` from `@clerk/clerk-react`. |
| `client/src/components/header.tsx` | Header | Uses `useUser()` from `@clerk/clerk-react` for user display. |
| `client/src/components/sidebar.tsx` | Sidebar | Uses `useAuth()` from `hooks/use-auth` for logout. |
| `client/src/pages/settings-page.tsx` | Settings | Uses `useUser()` from `@clerk/clerk-react`. |
| `client/src/pages/documents-page.tsx` | Documents | Uses `useAuth()` from `hooks/use-auth` for `user.id`. |

### Route files using auth polyfill

All 14 route files in `server/routes/` use the Passport-compatible polyfill:
- `req.isAuthenticated()` — backed by `attachClerkUser` middleware
- `req.user.id` — local DB user attached by `attachClerkUser`

Files: `actions.ts`, `agents.ts`, `ai.ts`, `analytics.ts`, `companies.ts`, `conversations.ts`, `crm.ts`, `documents.ts`, `integrations.ts`, `notifications.ts`, `portfolios.ts`, `tasks.ts`, `users.ts`, `workflows.ts`

---

## 2. Environment Variables

### Active (Clerk)

| Variable | Location | Purpose |
|----------|----------|---------|
| `CLERK_SECRET_KEY` | `server/auth.ts`, `server/middleware/auth.ts` | Server-side Clerk SDK auth |
| `VITE_CLERK_PUBLISHABLE_KEY` | `client/src/App.tsx`, `client/src/lib/clerk.ts` | Client-side Clerk SDK auth |

### Removed (Firebase) — verify `.env` cleanup

| Variable | Status | Was used for |
|----------|--------|-------------|
| `VITE_FIREBASE_API_KEY` | **Should be removed from `.env`** | Firebase client config |
| `VITE_FIREBASE_PROJECT_ID` | **Should be removed from `.env`** | Firebase client config |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Should be removed from `.env`** | Firebase client config |
| `VITE_FIREBASE_APP_ID` | **Should be removed from `.env`** | Firebase client config |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **Should be removed from `.env`** | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | **Should be removed from `.env`** | Firebase Admin SDK fallback |
| `FIREBASE_PRIVATE_KEY` | **Should be removed from `.env`** | Firebase Admin SDK fallback |
| `SESSION_SECRET` | **Should be removed from `.env`** | express-session signing |

### Removed (Passport) — no env vars were specific to Passport

Passport used `SESSION_SECRET` (listed above) and the database for session storage.

---

## 3. NPM Dependencies

### Active (Clerk)

| Package | Version | Location |
|---------|---------|----------|
| `@clerk/clerk-react` | ^5.61.4 | Client-side |
| `@clerk/express` | ^2.1.0 | Server-side |

### Removed (Firebase & Passport) — verify `package.json` cleanup

| Package | Status | Notes |
|---------|--------|-------|
| `firebase` | **Not in `package.json`** | Already removed |
| `firebase-admin` | **Not in `package.json`** | Already removed |
| `passport` | **Not in `package.json`** | Already removed |
| `passport-local` | **Not in `package.json`** | Already removed |
| `express-session` | **Not in `package.json`** | Already removed |
| `connect-pg-simple` | **Not in `package.json`** | Already removed |
| `memorystore` | **Not in `package.json`** | Already removed |
| `bcrypt` | **Not in `package.json`** | Never used (scrypt was used) |

---

## 4. Firebase References — ZERO in source code

No `import`, `require`, or SDK usage of `firebase` or `firebase-admin` exists in any `.ts` or `.tsx` file.

The only Firebase references remaining are:
- `scripts/rename-firebase-column.ts` — one-time migration script (renames `firebase_uid` to `clerk_user_id`)
- `scripts/rename-users-clerk-constraint.ts` — one-time migration script (renames constraint)
- `CLAUDE.md` — stale documentation mentioning Firebase as part of the tech stack
- `.planning/` docs — historical planning references

---

## 5. Passport References — ZERO in source code

No `import` or `require` of `passport` or `passport-local` exists in any source file.

The Passport-era **patterns** survive as a compatibility layer:
- `req.isAuthenticated()` — function polyfill installed by `attachClerkUser`
- `req.user` — populated by `attachClerkUser` instead of `deserializeUser`
- `Express.Request.user` / `Express.Request.isAuthenticated` — global type augmentation in `server/middleware/auth.ts`

These patterns are intentional Clerk-backed polyfills, not Passport remnants.

---

## 6. Legacy Artifacts to Clean Up

### High priority

| Item | File | Action |
|------|------|--------|
| Dead `auth-page.tsx` | `client/src/pages/auth-page.tsx` | **Delete.** Contains old login/register tabs with `useAuth()` and a dead `signInWithGoogle = async () => {}` stub. Not routed — `login-page.tsx` and `signup-page.tsx` replaced it. |
| `password` column on `users` table | `shared/schema.ts:9` | **Make nullable or remove.** Currently `notNull`. `attachClerkUser` fills it with random bytes. Blocks clean schema. |
| `session` table | `shared/schema.ts:526-530` | **Drop table.** Legacy `connect-pg-simple` session table. No code references it. |
| `forgot-password-page.tsx` | `client/src/pages/forgot-password-page.tsx` | **Review.** Calls `/api/auth/forgot-password` which may not exist as a route. Clerk handles password reset natively. |
| `reset-password-page.tsx` | `client/src/pages/reset-password-page.tsx` | **Review.** Calls `/api/auth/reset-password`. May be dead if Clerk handles reset flow. |
| `create-demo-user.ts` | `scripts/create-demo-user.ts` | **Update or delete.** Uses `scrypt` to hash passwords — Passport-era pattern. Demo users should be created via Clerk. |
| `auth-debug.log` writes | `server/middleware/auth.ts:63-69` | **Remove.** Debug `appendFileSync` to a hardcoded local path. Should not ship. |

### Low priority

| Item | File | Action |
|------|------|--------|
| Migration scripts | `scripts/rename-firebase-column.ts`, `scripts/rename-users-clerk-constraint.ts` | **Archive or delete.** Already executed. |
| CLAUDE.md stale references | `CLAUDE.md` | **Update.** Still lists Firebase, Passport, bcrypt, express-session, memorystore as tech stack. |
| `.planning/` docs | Various | Informational only. No code impact. |
| `login`/`signup`/`forgotPassword`/`resetPassword` schema tables | `shared/schema.ts:554-627` | **Review.** These look auto-generated (orchestrator). May be dead schema for Stitch-generated pages that duplicate Clerk's built-in flows. |

---

## 7. Files Needing Modification (Summary)

### Already migrated (no changes needed)

- `server/auth.ts` — Clerk only
- `server/middleware/auth.ts` — Clerk only
- `server/middleware/clerk-org.ts` — Clerk only
- `server/storage.ts` — Uses `clerkUserId`
- `client/src/hooks/use-auth.tsx` — Clerk only
- `client/src/hooks/use-organization.ts` — Clerk only
- `client/src/lib/clerk.ts` — Clerk only
- `client/src/lib/protected-route.tsx` — Clerk only
- `client/src/App.tsx` — Clerk only
- `client/src/pages/login-page.tsx` — Clerk `<SignIn>`
- `client/src/pages/signup-page.tsx` — Clerk `<SignUp>`
- All `server/routes/*.ts` — Use polyfill, no changes needed

### Needs cleanup (legacy artifacts)

| File | Change |
|------|--------|
| `client/src/pages/auth-page.tsx` | Delete |
| `shared/schema.ts` | Make `password` nullable; drop `session` table; review generated auth tables |
| `server/middleware/auth.ts` | Remove debug `appendFileSync` logging |
| `scripts/create-demo-user.ts` | Delete or rewrite for Clerk |
| `scripts/rename-firebase-column.ts` | Delete (already executed) |
| `scripts/rename-users-clerk-constraint.ts` | Delete (already executed) |
| `CLAUDE.md` | Remove Firebase/Passport/session references from tech stack |
| `.env` | Remove stale `VITE_FIREBASE_*`, `FIREBASE_*`, `SESSION_SECRET` vars |
| `client/src/pages/forgot-password-page.tsx` | Verify API endpoint exists or delete |
| `client/src/pages/reset-password-page.tsx` | Verify API endpoint exists or delete |
