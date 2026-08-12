# EntrepreneurOS 24-Layer Production Readiness

## Decision boundary

EntrepreneurOS has three distinct states:

1. **Current overlay implementation:** EOS provides its own tenant-scoped work, approvals, hierarchy, communication, audit, support, lifecycle, billing, analytics-consent, and integration adapter surfaces while remaining standalone-safe. UMH is an optional signed projection/control-plane integration, not EOS's database or browser authority.
2. **Required public SaaS MVP:** the overlay is publicly operable only after every layer below has current production evidence and `GET /api/platform/readiness` returns `ready: true`. A passing build, a healthy URL, or working development providers is insufficient.
3. **Native EOS end state:** the same role-aware organization model, EA-mediated founder communication, advisor portfolio, hierarchical company communication, approvals, evidence, and universal layout become native EOS capabilities rather than an overlay assembled around external reference and execution providers.

Status meanings:

- **Repository-qualified:** implementation and automated evidence exist in source control.
- **Partial:** implementation exists, but production configuration, drills, approval, or live evidence is missing.
- **External gate:** completion requires a production account, provider authorization, professional approval, named human owner, or production exercise and cannot be manufactured by code.

## Layer matrix

| # | Layer | Current verified state | Required public MVP evidence | Native EOS end state |
|---:|---|---|---|---|
| 1 | Front-end foundations | Repository-qualified: seven core surfaces, desktop/mobile acceptance, movable communication FAB, full-width mobile drawer, route-level code splitting | Production signed-in acceptance on supported devices and browsers | Native adaptive workspace for every portfolio/company role and module |
| 2 | APIs and back-end logic | Repository-qualified: scoped APIs, validation, deterministic effects, idempotent approvals, contract tests | Production API contract and consequential-effect receipts | Versioned native EOS commands, events, policies, and orchestration |
| 3 | Database and storage | Repository-qualified on managed development Postgres; checksum migrations and CI restore pass | Dedicated production datastore, migration receipt, retention and storage evidence | Native multi-tenant operational data plane with governed evolution |
| 4 | Authentication and permissions | Role hierarchy and tenant denial are tested; development Clerk is currently deployed | Production Clerk instance, domains, redirect URLs, role/tenant acceptance | Native EOS identity bindings and continuously evaluated authority graph |
| 5 | Hosting and deployment | Container and release migrations qualify; current Fly release predates this branch | Immutable promoted image, migration, smoke, rollback, and domain/TLS evidence | Multi-environment native EOS release platform |
| 6 | Cloud and compute | Fly configuration keeps one machine available and defines request concurrency | Capacity baseline, resource alarms, scale procedure, and cost envelope | Workload-aware compute scheduling for native EOS services and agents |
| 7 | CI/CD and version control | Repository-qualified: audit, migrations, 63 tests, browser acceptance, restore, build, container | Protected branch, required green check, promotion/rollback ownership | Policy-governed native module and contract delivery |
| 8 | Security and database isolation | Security headers, encrypted provider credentials, tenant/role denials, fail-closed auth | Independent security and database-isolation review; RLS or an accepted equivalent control with adversarial evidence | Defense-in-depth isolation across native data, events, tools, memory, and evidence |
| 9 | Rate limiting | Distributed Postgres limiter and fail-closed store behavior are tested | Production multi-instance burst and store-failure exercise | Adaptive limits by tenant, role, tool, provider, and risk class |
| 10 | Caching and CDN | Hashed static assets, cache policy, CSP, and cacheable split chunks exist | Domain/CDN/cache review, purge test, and stale-content recovery | Native edge delivery with policy-aware invalidation |
| 11 | Load balancing and scaling | Fly proxy, two-machine inventory, minimum-one availability, and concurrency thresholds exist | Load test, saturation behavior, scale-up/down, and dependency limits | Demand-aware regional scaling and workload isolation |
| 12 | Error tracking and logs | Structured redacted logs, request correlation, and server error sanitation exist | Production error tracker, dashboards, alert routing, and alert test | Unified traces across humans, agents, integrations, approvals, and evidence |
| 13 | Availability and recovery | CI logical backup/restore passes | Production restore drill, RTO/RPO, incident exercise, rollback evidence | Automated regional recovery and continuity for native EOS state |
| 14 | Payments and billing | Stripe Checkout, Customer Portal, signed webhooks, entitlements, and restricted-key enforcement exist | Live Stripe account, products/prices, webhook receipt, refund/dunning/tax decision | Native commercial entitlements, usage, invoicing, and portfolio economics |
| 15 | Legal and compliance | Versioned documents, immutable acceptance receipts, gated publishing, export and deletion controls exist | Approved terms/privacy content, privacy assessment, tax advice, records policy | Policy-as-code mapped to every native data and agent lifecycle |
| 16 | Customer support | Authenticated tickets and a platform-admin queue exist; fake contact claims were removed | Named staffing, hours/SLA, escalation, notification, and support exercise | Contextual in-product support with governed diagnostic access |
| 17 | Product analytics | Explicit versioned consent gates PostHog initialization and server events | Production project/key, consent validation, dashboard and retention review | Native outcome analytics respecting role visibility and consent |
| 18 | Cost controls | Company AI monthly/per-request budgets, atomic advisory locks, and usage ledger exist | Approved budget policy, alert thresholds, provider billing reconciliation | Native unit economics and autonomous budget allocation under authority |
| 19 | Vendor management | Vendor registry and evidence/renewal model exist | Approved current reviews for every active provider and data processor | Native vendor and model portfolio governance |
| 20 | Operational ownership | Service ownership and on-call data model exists | Named owner, backup owner, on-call route, escalation and access review | Native ownership graph aligned with EOS role hierarchy |
| 21 | Integration operations | Notion identity/search pass; Google token works for Drive/Gmail read but lacks Gmail send and Calendar read; UMH remains disabled | Google reconnect and round trip, Notion production probe, integration receipts; UMH signed round trip only if enabled | Native connectors with governed capability grants, reconciliation and portability |
| 22 | AI governance and reliability | Role-scoped advisor/CEO/EA communication, 15-advisor model, budgets, audit and approval boundaries exist | Model evaluation, prompt/tool/version registry, incident/fallback tests, human override | Native governed agent organization with continuous evaluation and evidence |
| 23 | Customer and data lifecycle | Secret-free export, delayed/cancellable deletion and provider identity deletion exist | Enabled worker, ownership-transfer policy, deletion/export/retention drill | Native lifecycle enforcement across all EOS stores, memories and providers |
| 24 | Release and experience quality | Browser/mobile/accessibility acceptance passes; serious/critical Axe findings are zero; production chunks are below threshold | Production performance/accessibility evidence and explicit release-owner approval | Continuous experience budgets for every native role, surface and device |

## Current promotion blockers

The repository-controlled implementation is materially ahead of the currently deployed public pilot, but public SaaS promotion is intentionally blocked by current evidence:

- the only EntrepreneurOS 1Password item is `Development`; no production credential set exists;
- Clerk publishable and secret keys are development keys;
- PostHog production configuration is absent;
- Google grants Drive read and Gmail read, but not Gmail send or Calendar read;
- production legal, privacy and tax approvals are absent;
- live Stripe configuration and billing acceptance are absent;
- production observability/alerting, support staffing, vendor reviews and named on-call ownership are absent;
- production database isolation, load/scaling, restore, incident, integration, AI governance and data-lifecycle exercises are not recorded;
- UMH live signed round-trip evidence is absent and federation remains correctly disabled.

The release tooling now rejects development identity, a local database, weak runtime secrets, an invalid encryption key, and a non-HTTPS public origin. These blockers must be closed with real production inputs and evidence; they must not be bypassed or marked complete through placeholder records.
