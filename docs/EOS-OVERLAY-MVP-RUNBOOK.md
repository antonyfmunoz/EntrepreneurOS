# EOS Overlay MVP Runbook

## Release definition

This release is the first implementation state of EOS: a company-scoped overlay that remains useful without UMH or provider availability. It is not the final native 17-module platform.

Included:

- Clerk-backed local principal resolution and an authenticated API gate;
- portfolio/company ownership plus membership, seat, reporting-tree, and classification checks;
- versioned organization manifest compilation through diagnostic, proposal, review, approval, provisioning, verification, and explicit activation;
- Morning Brief read model;
- company-scoped Work Packets with deterministic transitions;
- explicit local approvals with atomic claims;
- evidence records and evidence-gated completion;
- immutable EOS audit records;
- integration state, authority, operations, and manual-fallback labeling;
- Gmail as an optional approved effect rail with AES-256-GCM token encryption, provider receipts, and reconciliation state;
- role-specific My Role, Work Room, Review Room, Academy, and Portfolio Map surfaces;
- persistent hierarchical communication through the founder's named Executive Assistant or each occupied seat's Role Agent assistant;
- a 15-seat portfolio advisor council with persisted consultations and Executive Assistant synthesis;
- Google Calendar, Google Drive, and Notion operating context when the connected account grants the required scopes;
- optional, fail-closed UMH federation for one proposal capability;
- quarantined legacy global task, agent, and workflow routes;
- overlay UI for Brief, Organization, Missions, Approvals, Evidence, Systems, and role-compiled assistant context.

Deferred:

- native CRM, accounting, banking, payroll, e-signature, and payment truth;
- autonomous consequential effects;
- active capital, M&A, or board-governance workflows;
- enterprise identity governance such as SCIM, just-in-time group mapping, and custom policy authoring beyond the implemented seat hierarchy;
- native implementations of every mapped module;
- production UMH/provider activation without explicit installation and credential setup.

## Configuration

Required for normal hosted operation:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `EOS_CREDENTIAL_ENCRYPTION_KEY` as a base64-encoded 32-byte key
- `SESSION_SECRET` as a high-entropy secret used to sign transient OAuth state

`GET /api/ready` returns 200 only when the database is reachable and hosted required configuration is present. `GET /api/health` is a liveness check and does not establish release readiness.

Optional Gmail:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

The Google authorization request includes Gmail send, Calendar read-only, and Drive metadata read-only. Existing grants must reconnect after a scope expansion; a configured refresh token is not proof that all three services are authorized.

Optional Notion:

- `NOTION_API_TOKEN`

Optional intelligence and product analytics:

- `ANTHROPIC_API_KEY`
- `POSTHOG_API_KEY` for server events
- `VITE_POSTHOG_API_KEY` at client build time

Optional UMH configuration is documented in `docs/umh-projection-adapter.md`. Federation is disabled by default.

For local development with the managed 1Password references, start the application through the checked-in environment template:

```powershell
op run --env-file=.env.op.tpl -- npm run dev
```

Promote a qualified commit to the existing Fly application without copying secret values into source or the shell history:

```powershell
op run --env-file=.env.op.tpl -- powershell -NoProfile -File scripts/deploy-fly.ps1
```

The helper imports server-side Anthropic/PostHog values and injects only the required client build variables. It fails closed when any required reference is absent.

Running the client without `VITE_CLERK_PUBLISHABLE_KEY` intentionally renders an **Authentication setup required** screen. It must never fall through to protected UI or fail as an unexplained white page.

## Database

For a new database, establish the Drizzle baseline first:

```powershell
npx drizzle-kit push --force
```

Then apply checksum-tracked incremental migrations:

```powershell
npm run db:migrate
```

The runner applies incremental files from `migrations/` plus hand-authored files from `scripts/migrations/`. Previously applied files are skipped by checksum; an edited applied migration fails closed.

## Qualification

```powershell
npm run check
npm test
npm run build
```

For isolated local field qualification, point `EOS_TEST_DATABASE_URL` at a disposable PostgreSQL database and run:

```powershell
npx vitest run tests/integration/eos-runtime.integration.test.ts
```

The integration test seeds isolated users/companies, exercises the HTTP lifecycle, and removes its fixtures. It covers tenant denial, role membership and reporting scope, the full compiler lifecycle, hierarchical communication, advisor consultations, approval, provider execution/receipt/reconciliation, evidence enforcement, audit, disabled-UMH operation, signed federation, replay rejection, idempotency, terminal outcomes, and retry behavior.

For browser acceptance, use a disposable database and two loopback-only processes:

```powershell
$env:NODE_ENV = "test"
$env:EOS_E2E_FIXTURE = "true"
$env:DATABASE_URL = "postgresql://..."
npm run test:e2e:fixture
```

```powershell
npm run test:e2e:client
```

The fixture server refuses to start outside test mode or without the explicit fixture flag. It binds to `127.0.0.1` and must never be deployed.

Before promotion, also run:

```powershell
npm audit --omit=dev
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=<production-publishable-key> --build-arg VITE_POSTHOG_API_KEY=<project-key> -t eos:<release> .
```

Boot the built image against a disposable migrated database and require the container health check plus `/api/ready` to pass. The detailed evidence and accepted residuals are in `EOS-MVP-QUALIFICATION-REPORT.md`.

## Production promotion gates

- migration backup and restore rehearsal completed;
- application secrets supplied through the deployment secret manager;
- no plaintext legacy OAuth credential remains; affected providers must reconnect;
- exact Clerk instance and allowed origins verified;
- one company fixture completes the full UI workflow;
- Gmail, if enabled, proves draft/send approval and provider receipt capture;
- UMH, if enabled, proves live signed round-trip delivery and deduplication;
- security review covers cross-company denial, logs, rate limits, key rotation, and retention;
- release owner records residual risk and approves promotion.
