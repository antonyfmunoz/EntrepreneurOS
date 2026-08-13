# EntrepreneurOS Production Operations Runbook

## Release authority

The application must not be described as a production-ready public SaaS unless `GET /api/platform/readiness` returns `ready: true` from the production deployment. Repository tests, a healthy URL, or a release owner's opinion cannot replace missing evidence.

Only principals listed in `EOS_PLATFORM_ADMIN_USER_IDS` may record evidence. Every control requires an HTTPS evidence location, SHA-256 hash, evidence scope, named subject, reviewer, review time, and expiry. The code-owned control registry restricts each key to repository, production, or independent-professional evidence and limits its maximum age. Unknown keys, future reviews, stale reviews, overlong validity windows, expired records, and blanket `not_applicable` records are rejected. Evidence that expires or is marked failed stops readiness automatically. Updating a control changes its current readiness state but also appends a separate immutable history record; platform administrators can retrieve the latest 100 entries from `GET /api/platform/controls/:controlKey/evidence`.

Release-bound controls must use the runtime's exact immutable `EOS_RELEASE_SUBJECT` (`git:<40-character commit>` or `image:sha256:<digest>`). Environment-bound controls must use the exact `EOS_PRODUCTION_ENVIRONMENT_SUBJECT`. Evidence for an older commit, image, staging environment, or another service cannot qualify the current production release.

## In-product 24-layer operations

Configured platform administrators receive a **Readiness** tab in Settings; ordinary authenticated users do not. The tab displays every layer, its exact missing registered controls, allowed evidence scope, subject binding, and maximum review age. Recording evidence requires a secret-free HTTPS URI, SHA-256 digest, reviewer date, expiry, and the exact release or environment subject where required. A successful save recalculates readiness and exposes the append-only receipt history; the browser does not mark the layer complete on optimistic local state.

The same workspace manages required vendor reviews and EOS service ownership. An approved vendor requires current review evidence, a future review no more than one year after the prior review, resolved DPA and subprocessor decisions, risk/data classification, and an exit plan. Service ownership requires a distinct configured backup administrator, real on-call and escalation routes, current runbook/access-review evidence, approved objectives, and a bounded next access review. The signed alert action reports delivery failure honestly. The UI is an operator surface for existing fail-closed APIs; it does not bypass API authorization, configuration blockers, live drills, professional approvals, or production-subject checks.

## Incident severity

- **SEV-1:** tenant data exposure, authentication bypass, irreversible data loss, compromised signing/payment/provider key, or total paid-service outage. Stop releases; disable affected effects; notify the service owner immediately.
- **SEV-2:** major workflow or integration unavailable without data exposure; material approval or billing errors; recovery objective at risk.
- **SEV-3:** degraded non-critical surface with a safe fallback.
- **SEV-4:** cosmetic or low-impact defect.

Incident records must include detection time, severity, commander, scope, customer impact, containment, evidence, recovery, communications, and follow-up owners. The post-incident review must not include credentials or personal message content.

## Recovery objectives

The service owner must publish approved RTO and RPO targets in the service ownership record. A production-data restore drill must prove them against the actual production database provider. CI's disposable restore protects migration mechanics but does not satisfy `production_restore_drill`.

## Release sequence

1. Merge to the configured release branch and qualify that exact commit through the push-triggered CI migration, unit/integration, browser, accessibility, dependency, container, and restore checks.
2. Verify production Clerk, Google/Notion, analytics, Stripe, UMH (if enabled), logging/alerting, support queue, account deletion, legal enforcement, and backups independently.
3. Perform capacity/load and cold-start checks against a safe production-like environment.
4. Record current vendor reviews and service ownership, including a distinct backup owner, HTTPS on-call and escalation routes, the incident runbook, and a current access review with its next review no more than 90 days later.
5. Deploy with release migrations and a reversible artifact.
6. Run signed-in role/tenant/browser and provider round trips.
7. Record `release_owner_approval` last. If any earlier evidence changes, expires, or fails, the approval is no longer sufficient.

The production helper refuses a commit that is not the remote release-branch head or lacks a successful push-triggered qualification run. It exports source from that commit, builds and pushes one commit-labelled image without deploying it, then promotes that exact image with a canary strategy. It captures the prior image digest and release subject first. After promotion, it verifies every running machine has one immutable image digest and the exact expected release subject before any smoke is allowed to pass. Public or signed-in isolation smoke failure restores the prior immutable image automatically and verifies every restored machine against the prior digest and subject. The resulting `.tmp/eos-last-deployment.json` records the immutable digest, human-readable image tag, commit, release subject, and smoke results; it is an operator receipt, not readiness evidence by itself.

Promotion smoke deliberately does not declare the release complete. Record the release-bound deployment and release-owner evidence only after the new image is running, then execute `npm run test:e2e:production:readiness`. That final probe requires all 24 layers, vendor reviews, configuration controls, correct subjects, and unexpired evidence to pass.

For a safe local load rehearsal, `npm run test:e2e` starts the fixture runtime and issues 300 requests with concurrency 20. Direct `npm run test:load` use requires `EOS_LOAD_TEST_TARGET`. External targets additionally require HTTPS, `EOS_LOAD_TEST_APPROVED=true`, an exact `EOS_LOAD_TEST_ALLOWED_HOST`, and one of the allowlisted read-only probe paths. This protects a third-party or production service from an accidental load run.

Public production smoke uses `EOS_PRODUCTION_ORIGIN` and the exact `EOS_EXPECTED_RELEASE_SUBJECT` with `npm run test:e2e:production`. Signed-in isolation smoke additionally requires `EOS_PRODUCTION_BEARER_TOKEN`, `EOS_PRODUCTION_COMPANY_ID`, and `EOS_PRODUCTION_FORBIDDEN_COMPANY_ID`, then runs through `npm run test:e2e:production:authenticated`. The deployment helper derives the expected subject from the qualified commit. A manual smoke operator must copy the exact validated subject reported by the target release; a branch name, mutable image tag, or assumed commit is not acceptable. The bearer token must be short-lived, must never be committed or copied into evidence, and should be revoked after qualification.

## Rollback

Application rollback uses the last qualified immutable image. Database changes must remain backward compatible for the rollback window; destructive schema changes require expand/migrate/contract releases. Provider or signing-key rollback must preserve idempotency and audit evidence. A rollback is incomplete until health, readiness, signed-in access, queue processing, and tenant isolation are reverified.

The manual rollback helper requires an exact `registry.fly.io/<app>@sha256:<digest>`, the matching immutable release subject, the production environment subject, and the exact typed approval phrase `ROLLBACK <app>`. It performs a rolling restoration and verifies public health. The operator must then repeat signed-in isolation and full 24-layer qualification before closing the incident.

## Access review

Review Fly, database, Clerk, Stripe, Google, Notion, PostHog, GitHub, secret-vault, domain/DNS, and support access at least quarterly and after personnel changes. Remove dormant access, require phishing-resistant MFA where supported, rotate affected keys, and retain the review evidence hash.

## Support operations

Customers create and continue support conversations at `/support`. Only the authenticated ticket owner can read or reply to that thread. Configured platform administrators receive the support operations queue on the same page and can triage, change status, and reply. An administrator reply atomically persists the message, advances the selected status, and creates an in-app notification for the customer. A customer reply reopens a request that was resolved or waiting on the customer; a closed request rejects new replies and requires a new ticket. Account export includes the support conversation, while account deletion removes tickets and their cascading messages.

Do not use ticket bodies for secrets or private internal notes. The queue does not establish a response-time promise, emergency channel, staffing model, or escalation commitment. Before Layer 16 can pass in production, name the support owner and backup, publish approved hours/SLA/escalation, configure the signed alert receiver, and run an evidenced customer-to-operator-to-customer exercise.

## Account deletion and retained evidence

The hourly lifecycle worker handles due requests only when `EOS_ACCOUNT_DELETION_ENABLED=true`. A request has a bounded cooling-off period and can be cancelled before execution. A portfolio or company owner must transfer ownership first; personal deletion does not destroy organization records. Before any personal erasure, the worker must confirm revocation of every connected Google and Notion grant. An unavailable provider fails the request closed and retains the encrypted credential for an operations retry; operators must not manually delete that credential while its external grant is unconfirmed. After provider and Clerk revocation succeed, execution removes CRM, documents, notifications, AI messages, provider tokens, support tickets, agent actions, memberships and UMH identity bindings; releases occupied seats; and detaches communication sender identity. Immutable legal, audit, approval, provider-effect and cost evidence stays linked to a non-identifying tombstone so operational proof remains coherent without retaining the person's profile or provider credential.

The exact legal retention periods, litigation-hold behavior, backup expiry, tax-record requirements, and support-record policy require professional approval before public launch. Code must not invent those periods. See `docs/DATA-LIFECYCLE-AND-RETENTION.md`.

## Control keys

The readiness endpoint defines the current 24-layer control set. There is no generic `not_applicable` path. Key examples include `production_restore_drill`, `database_isolation_review`, `observability_alert_test`, `billing_live_mode_acceptance`, `legal_approval`, `vendor_review`, `integration_round_trip`, `ai_governance_evaluation`, `data_lifecycle_drill`, and `accessibility_performance_release`.
