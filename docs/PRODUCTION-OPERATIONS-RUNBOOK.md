# EntrepreneurOS Production Operations Runbook

## Release authority

The application must not be described as a production-ready public SaaS unless `GET /api/platform/readiness` returns `ready: true` from the production deployment. Repository tests, a healthy URL, or a release owner's opinion cannot replace missing evidence.

Only principals listed in `EOS_PLATFORM_ADMIN_USER_IDS` may record evidence. Every control requires an HTTPS evidence location, SHA-256 hash, evidence scope, named subject, reviewer, review time, and expiry. The code-owned control registry restricts each key to repository, production, or independent-professional evidence and limits its maximum age. Unknown keys, future reviews, stale reviews, overlong validity windows, expired records, and blanket `not_applicable` records are rejected. Evidence that expires or is marked failed stops readiness automatically. Updating a control changes its current readiness state but also appends a separate immutable history record; platform administrators can retrieve the latest 100 entries from `GET /api/platform/controls/:controlKey/evidence`.

Release-bound controls must use the runtime's exact immutable `EOS_RELEASE_SUBJECT` (`git:<40-character commit>` or `image:sha256:<digest>`). Environment-bound controls must use the exact `EOS_PRODUCTION_ENVIRONMENT_SUBJECT`. Evidence for an older commit, image, staging environment, or another service cannot qualify the current production release.

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

The production helper refuses a commit that is not the remote release-branch head or lacks a successful push-triggered qualification run. It exports source from that commit, builds and pushes one commit-labelled image without deploying it, then promotes that exact image with a canary strategy. It captures the prior image digest and release subject first. Public or signed-in isolation smoke failure restores the prior immutable image automatically. The resulting `.tmp/eos-last-deployment.json` is an operator receipt, not readiness evidence by itself.

Promotion smoke deliberately does not declare the release complete. Record the release-bound deployment and release-owner evidence only after the new image is running, then execute `npm run test:e2e:production:readiness`. That final probe requires all 24 layers, vendor reviews, configuration controls, correct subjects, and unexpired evidence to pass.

For a safe local load rehearsal, `npm run test:e2e` starts the fixture runtime and issues 300 requests with concurrency 20. Direct `npm run test:load` use requires `EOS_LOAD_TEST_TARGET`. External targets additionally require HTTPS, `EOS_LOAD_TEST_APPROVED=true`, an exact `EOS_LOAD_TEST_ALLOWED_HOST`, and one of the allowlisted read-only probe paths. This protects a third-party or production service from an accidental load run.

Public production smoke uses `EOS_PRODUCTION_ORIGIN` with `npm run test:e2e:production`. Signed-in isolation smoke additionally requires `EOS_PRODUCTION_BEARER_TOKEN`, `EOS_PRODUCTION_COMPANY_ID`, and `EOS_PRODUCTION_FORBIDDEN_COMPANY_ID`, then runs through `npm run test:e2e:production:authenticated`. The bearer token must be short-lived, must never be committed or copied into evidence, and should be revoked after qualification.

## Rollback

Application rollback uses the last qualified immutable image. Database changes must remain backward compatible for the rollback window; destructive schema changes require expand/migrate/contract releases. Provider or signing-key rollback must preserve idempotency and audit evidence. A rollback is incomplete until health, readiness, signed-in access, queue processing, and tenant isolation are reverified.

The manual rollback helper requires an exact `registry.fly.io/<app>@sha256:<digest>`, the matching immutable release subject, the production environment subject, and the exact typed approval phrase `ROLLBACK <app>`. It performs a rolling restoration and verifies public health. The operator must then repeat signed-in isolation and full 24-layer qualification before closing the incident.

## Access review

Review Fly, database, Clerk, Stripe, Google, Notion, PostHog, GitHub, secret-vault, domain/DNS, and support access at least quarterly and after personnel changes. Remove dormant access, require phishing-resistant MFA where supported, rotate affected keys, and retain the review evidence hash.

## Account deletion and retained evidence

The hourly lifecycle worker handles due requests only when `EOS_ACCOUNT_DELETION_ENABLED=true`. A request has a bounded cooling-off period and can be cancelled before execution. A portfolio or company owner must transfer ownership first; personal deletion does not destroy organization records. Execution removes CRM, documents, notifications, AI messages, provider tokens, support tickets, agent actions, memberships and UMH identity bindings; releases occupied seats; detaches communication sender identity; and removes the Clerk identity. Immutable legal, audit, approval, provider-effect and cost evidence stays linked to a non-identifying tombstone so operational proof remains coherent without retaining the person's profile or provider credential.

The exact legal retention periods, litigation-hold behavior, backup expiry, tax-record requirements, and support-record policy require professional approval before public launch. Code must not invent those periods. See `docs/DATA-LIFECYCLE-AND-RETENTION.md`.

## Control keys

The readiness endpoint defines the current 24-layer control set. There is no generic `not_applicable` path. Key examples include `production_restore_drill`, `database_isolation_review`, `observability_alert_test`, `billing_live_mode_acceptance`, `legal_approval`, `vendor_review`, `integration_round_trip`, `ai_governance_evaluation`, `data_lifecycle_drill`, and `accessibility_performance_release`.
