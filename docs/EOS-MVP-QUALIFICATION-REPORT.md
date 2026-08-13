# EOS Overlay MVP Qualification Report

**Assessment date:** 2026-08-13
**Scope:** EntrepreneurOS repository and projection-side UMH adapter only
**Decision:** Repository-qualified production foundation; the deployed Fly v27 pilot is not the qualified public SaaS release. Production identity, billing, analytics, provider authorization, staffing, approvals, and live drills remain external acceptance gates.

## Release definition

The required overlay MVP is the governed EntrepreneurOS runtime, not the eventual fully native 17-module platform. It includes eight closure areas:

1. role-compiled visibility enforced at the API, data projection, navigation, and agent-context layers;
2. a persistent Founder Executive Assistant, fifteen founder-profiled portfolio advisors, Company CEO Agent delegation, and seat-specific Role Agent assistants respecting the reporting hierarchy;
3. the complete Organization Compiler lifecycle from draft through verified activation;
4. an approval-gated customer-value provider loop with effect request, provider receipt, evidence, audit, failure blocking, and reconciliation;
5. live Google Workspace and Notion context adapters with explicit provider health and scope evidence;
6. My Role, Modules, Work Room, Review Room, Academy, and Portfolio Map operator surfaces inside the canonical EOS shell, including a role-filtered control center for all fourteen non-dormant business modules;
7. an interaction-first operator loop in which descriptive state leads to a controlled next action that is guaranteed to exist inside the active seat's compiled authority; every visible module can prepare governed work or route through the seat's assistant, approvals change durable state, and audit receipts expose the result;
8. usable account controls that require explicit company context, preserve it in shareable URLs, connect billing to actual server/provider state, and remove settings claims that are not runtime-enforced; plus reproducible migrations, qualification commands, source control, deployment, and honest release evidence.

## Current qualification evidence

| Gate | Result | Evidence |
|---|---|---|
| Static type safety | Pass | `npm run check` |
| Production build | Pass | Vite client plus bundled server and migration/import runners |
| Unit and isolated-database integration | Pass | 20 files, 91 tests, no skips against disposable PostgreSQL in local qualification; protected-branch qualification must repeat this result for the exact commit |
| Tenant and role isolation | Pass | Cross-tenant denial; seat membership; reporting-subtree filtering; founder-profile, manifest, audit, advisor-deliberation, and Notion-search denial for a manager |
| Compiler lifecycle | Pass | draft → diagnostic → proposed → review → approved → provisioning → verifying → active, with provisioning and verification gates |
| Hierarchical communication | Pass | Persistent per-seat channels; Role Agent assistant mode; three selected advisor calls; current/specified Company CEO Agent calls; one persisted Executive Assistant synthesis with provenance |
| Consequential provider loop | Pass in deterministic adapter test | Gmail request → assigned approval → provider execution → receipt evidence → audit → reconciled status; provider failure blocks the Work Packet |
| Browser acceptance | Pass | Eight operator surfaces at 1440×1000; all 14 founder-visible modules are enterable and Module 12 prepares its governed objective and exact proof requirement; My Role exposes assigned-work, role-practice, and assistant actions; mission creation → assigned approval → durable decision → audit receipt; hierarchy builder; Settings preserves exact company context and exposes real profile, company, privacy, AI-spend, billing, and support paths; non-enforced delivery/autonomy controls are absent; obsolete Organization, Chat, Workflow, and Task URLs converge on governed EOS surfaces; 390×844 no overflow; movable communication FAB; full-width contextual communication launch; no browser errors; zero serious/critical accessibility findings |
| Operational evidence and ownership | Pass in repository and managed development PostgreSQL | Accepted control updates append immutable history; migration 0018 adds a database trigger that rejects update/delete tampering outside an explicit maintenance transaction; the backup owner must be a distinct configured platform administrator backed by a real user record; incomplete escalation, runbook, or access-review evidence fails closed |
| Source control | Pass | `feature/company-system` is protected, strict/up-to-date, conversation-resolved, admin-enforced, and requires both `qualify` and fail-closed `Analyze (javascript-typescript)` checks |
| Supply-chain evidence | Pass | Protected-branch qualification generates a production-only CycloneDX SBOM, hashes and retains it, and issues SLSA provenance on push; commit `22fadc620fcb147b54930a14dbf5bd626f8f82b5` was independently verified against the signed subject |
| Static application security | Pass with one reviewed false positive | CodeQL reports zero open alerts on the protected product branch. The only accepted raw SARIF result is the exact Gmail OAuth-state HMAC verification rule/path, capped at one; it is message authentication with timing-safe comparison, not password storage |
| Repository security services | Pass / account-limited | Dependabot security updates, secret scanning, and push protection are enabled. Non-provider patterns and validity checks remain unavailable for this repository/account tier |
| Production image/runtime | **Not promoted** | Fly still runs the older v27 pilot image `deployment-01KZT61SSFYHTYZ362TZJDZRFP`; it predates the 24-layer release tooling and must not be represented as the qualified public SaaS release |
| Production migrations | Pass | Fly release command completed; checksum runner reports migrations 0001–0007 and the enhancement migration already applied |
| Production HTTP and browser | Pass | `https://entrepreneuros.net/api/health` and `/api/ready` returned 200; a 390×844 rendered public smoke reached the Clerk sign-in surface with no failed resources or browser errors |
| Notion live provider | Pass | Identity and actual workspace search returned 200 |
| Gmail live provider | **Blocked externally for execution** | Token refresh and Gmail profile returned 200, but the existing grant contains `gmail.readonly` rather than required `gmail.send`; EOS now reports this grant disconnected instead of implying execution authority |
| Drive live provider | Pass | Actual recent-file metadata query returned 200 |
| Calendar live provider | **Blocked externally** | Existing Google grant returned `403 insufficientPermissions` and contains no Calendar scope; the current authorization request includes Calendar read-only, so the user must reconnect once |
| Clerk production identity | **Blocked externally** | Current Fly build configuration still uses a Clerk development publishable key; a production Clerk instance/key and allowed-origin cutover are required |
| Product analytics | **Blocked externally** | The connected PostHog organization has projects for other products but no EntrepreneurOS production project. EOS must receive its own project and consent/retention acceptance; another product's destination must not be reused |
| Stripe live billing | **Blocked externally** | No Stripe secrets are deployed and the connected Stripe account requires reauthentication. Products, prices, a restricted live key, webhook signing secret, tax decision, and refund/dunning acceptance remain unverified |
| Production credential custody | **Blocked externally** | The EntrepreneurOS vault contains only a `Development` record. Clerk values are development keys and there is no complete `Production` credential record |
| UMH | Correctly disabled | Projection-owned signed HTTPS ingress/outbox is implemented and tested; direct-Postgres polling/writeback is not activated; live UMH is outside this EntrepreneurOS-only release scope |

## What is not being claimed

- The native 17-module end state is not implemented by this overlay release.
- An enterable module with a governed local mission and fallback is not represented as a configured or live-qualified provider workflow.
- A mocked provider receipt test is not represented as a live customer email.
- A healthy refresh token is not represented as Calendar authorization while Calendar returns 403.
- A development Clerk tenant is not represented as production-hardened identity.
- Persisted preferences are not represented as working notification delivery or agent execution authority; those controls are quarantined until a real enforcement path exists.
- UMH live round-trip delivery is not represented as complete while the deployment-managed adapter remains disabled.

## Remaining external closure gates

The repository-controlled foundation is complete, but the product can be called **public SaaS MVP complete and live-qualified** only after every 24-layer production control has current evidence for the exact deployed image and environment. The remaining account- and operations-level gates include:

1. create a production Clerk instance, install `pk_live_` and `sk_live_` credentials, configure domains/redirects, and pass signed-in tenant/role/mobile acceptance;
2. provision a dedicated production datastore, migrate it, and record isolation, load/scaling, backup/restore, RTO/RPO, and lifecycle evidence;
3. reauthenticate Stripe, configure live products/prices, restricted credentials, webhook, portal, refund/dunning behavior, and an explicit tax decision;
4. create a dedicated EntrepreneurOS PostHog project and approve consent, event, dashboard, retention, and privacy behavior;
5. reconnect Google Workspace for Gmail send and Calendar read, rerun Notion/Drive/Gmail/Calendar probes, and record authorized safe round trips;
6. configure signed operational alerts, dashboards, on-call routing, named primary/backup owners, support hours/SLA/escalation, and execute alert/incident/support drills;
7. obtain approved terms, privacy, records, tax, vendor, model/tool governance, and data-lifecycle decisions and evidence;
8. execute the immutable-image deployment, authenticated isolation smoke, production accessibility/performance acceptance, rollback rehearsal, and final 24-layer readiness probe.

Until those controls pass, describe the state as **the EOS overlay and production foundation are repository-qualified; the public pilot is not yet the production-ready SaaS MVP**.
