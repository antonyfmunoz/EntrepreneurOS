# Open Questions

## Skill bugs discovered during Goal 2

### 1. server/generated/storage/* references non-existent identifiers
The orchestrator's backend phase generated files under `server/generated/storage/` that reference types (`InsertUser`, `User`, `Config`, `Metric`, etc.) and table symbols (`usersTable`, `configTable`, `metricsTable`, etc.) with a `*Table` suffix that do not exist in `@shared/schema`. The real schema exports `users`, `agents`, `tasks`, etc. (no Table suffix) and the inferred types use the plain-table name (`typeof users.$inferSelect`).

Additionally, `drizzle-orm`'s `eq` operator is used without being imported.

**Decision:** Exclude `server/generated/**` from `tsconfig.json` so the rest of the app compiles. The generated code is not yet wired into the running app (server/routes.ts only has the marker comment, no imports). Skill generator needs a fix to:
- Import `eq` (and any other operators) from `drizzle-orm`
- Reference the actual exported table name from shared/schema (no `Table` suffix)
- Reference actual type exports
- Use the actual `DatabaseStorage` method signatures (some generated routes call methods like `getConfig`, `createLogin`, `updateProfile` that don't exist)

### 2. server/generated/routes/* calls non-existent storage methods
Routes such as `post_api_auth_login.ts` call `storage.createLogin(...)`, `storage.getConfig()`, `storage.updateProfile(...)` — none of these exist on `DatabaseStorage`. Routes need to either (a) be generated alongside new storage methods with matching names, or (b) the spec parser needs to map spec endpoints to existing storage methods rather than invent new ones.

### 3. Generated pages (client/src/pages/*) reference unavailable modules
- `next/link` — this is a Vite+Wouter project, not Next.js. Generator must emit `wouter` `Link`.
- `posthog-js/react` — not installed. Only `posthog-js` core is in package.json. Analytics-delivery phase must either install the React adapter or use `posthog-js` core.
- `lucide-react` icons with Material Symbols names (`SmartToy`, `ArrowForward`, `KeyboardBackspace`). Generator must map to lucide names (`Bot`, `ArrowRight`, `ArrowLeft`).
- PostHog snippet injected *inside* a multi-line `import { ... } from "lucide-react"` block in `admin-dashboard-page.tsx` and `dashboard-page.tsx`, corrupting them. Injection logic must find the end of the full import block, not just match `import {`.
- Two pages (`dashboard-page.tsx`, `admin-dashboard-page.tsx`) were truncated mid-JSX by the generator. Stubbed out in this session to unblock compile.
