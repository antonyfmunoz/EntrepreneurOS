# EOS Overlay MVP Qualification Report

**Assessment date:** 2026-08-11
**Scope:** EntrepreneurOS repository and projection-side UMH adapter only
**Decision:** Code-qualified release candidate; live Calendar authorization and production Clerk cutover remain external acceptance gates

## Release definition

The required overlay MVP is the governed EntrepreneurOS runtime, not the eventual fully native 17-module platform. It includes seven closure areas:

1. role-compiled visibility enforced at the API, data projection, navigation, and agent-context layers;
2. a persistent Founder Executive Assistant, fifteen founder-profiled portfolio advisors, Company CEO Agent delegation, and seat-specific Role Agent assistants respecting the reporting hierarchy;
3. the complete Organization Compiler lifecycle from draft through verified activation;
4. an approval-gated customer-value provider loop with effect request, provider receipt, evidence, audit, failure blocking, and reconciliation;
5. live Google Workspace and Notion context adapters with explicit provider health and scope evidence;
6. My Role, Work Room, Review Room, Academy, and Portfolio Map operator surfaces inside the canonical EOS shell;
7. reproducible migrations, qualification commands, source control, deployment, and honest release evidence.

## Current qualification evidence

| Gate | Result | Evidence |
|---|---|---|
| Static type safety | Pass | `npm run check` |
| Production build | Pass | Vite client plus bundled server and migration/import runners |
| Unit and isolated-database integration | Pass | 11 files, 52 tests, no skips against disposable PostgreSQL |
| Tenant and role isolation | Pass | Cross-tenant denial; seat membership; reporting-subtree filtering; founder-profile, manifest, audit, advisor-deliberation, and Notion-search denial for a manager |
| Compiler lifecycle | Pass | draft → diagnostic → proposed → review → approved → provisioning → verifying → active, with provisioning and verification gates |
| Hierarchical communication | Pass | Persistent per-seat channels; Role Agent assistant mode; three selected advisor calls; current/specified Company CEO Agent calls; one persisted Executive Assistant synthesis with provenance |
| Consequential provider loop | Pass in deterministic adapter test | Gmail request → assigned approval → provider execution → receipt evidence → audit → reconciled status; provider failure blocks the Work Packet |
| Browser acceptance | Pass | Seven operator surfaces at 1440×1000; hierarchy-builder interaction; 390×844 no overflow; movable communication FAB; full-width mobile communication drawer; no browser errors |
| Notion live provider | Pass | Identity and actual workspace search returned 200 |
| Gmail live provider | Pass read/identity probe | Token refresh and Gmail profile returned 200; no real message was sent during qualification |
| Drive live provider | Pass | Actual recent-file metadata query returned 200 |
| Calendar live provider | **Blocked externally** | Existing Google grant returned 403; the current authorization request includes Calendar read-only, so the user must reconnect once to grant the expanded scope |
| Clerk production identity | **Blocked externally** | Current Fly build configuration still uses a Clerk development publishable key; a production Clerk instance/key and allowed-origin cutover are required |
| Product analytics | Optional / disabled | The available PostHog value is a placeholder; EOS refuses to initialize either PostHog client until a real `phc_` project key is supplied |
| UMH | Correctly disabled | Projection-owned signed HTTPS ingress/outbox is implemented and tested; direct-Postgres polling/writeback is not activated; live UMH is outside this EntrepreneurOS-only release scope |

## What is not being claimed

- The native 17-module end state is not implemented by this overlay release.
- A mocked provider receipt test is not represented as a live customer email.
- A healthy refresh token is not represented as Calendar authorization while Calendar returns 403.
- A development Clerk tenant is not represented as production-hardened identity.
- UMH live round-trip delivery is not represented as complete while the deployment-managed adapter remains disabled.

## Final closure gates

The release can be called **MVP complete and live-qualified** only after all of the following are recorded:

1. the owner reconnects Google Workspace and the strict provider probe returns 200 for Gmail, Calendar, Drive, Notion identity, and Notion search;
2. a production Clerk publishable/secret key pair and allowed origins are installed, the client is rebuilt, and signed-in owner/mobile flows pass;
3. the qualified commit is pushed, reviewed through a draft pull request, deployed with migrations, and public `/api/health` plus database-backed `/api/ready` both return 200;
4. the owner explicitly authorizes a safe recipient if a real Gmail delivery receipt is required as a release gate.

Until then, describe the state as **repository-qualified for the seven MVP areas, with external identity/consent gates still open**.
