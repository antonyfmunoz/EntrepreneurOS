# EntrepreneurOS Production Operations Runbook

## Release authority

The application must not be described as a production-ready public SaaS unless `GET /api/platform/readiness` returns `ready: true` from the production deployment. Repository tests, a healthy URL, or a release owner's opinion cannot replace missing evidence.

Only principals listed in `EOS_PLATFORM_ADMIN_USER_IDS` may record evidence. Every control requires an HTTPS evidence location, SHA-256 hash, reviewer, review time, and optional expiry. Evidence that expires or is marked failed stops readiness automatically.

## Incident severity

- **SEV-1:** tenant data exposure, authentication bypass, irreversible data loss, compromised signing/payment/provider key, or total paid-service outage. Stop releases; disable affected effects; notify the service owner immediately.
- **SEV-2:** major workflow or integration unavailable without data exposure; material approval or billing errors; recovery objective at risk.
- **SEV-3:** degraded non-critical surface with a safe fallback.
- **SEV-4:** cosmetic or low-impact defect.

Incident records must include detection time, severity, commander, scope, customer impact, containment, evidence, recovery, communications, and follow-up owners. The post-incident review must not include credentials or personal message content.

## Recovery objectives

The service owner must publish approved RTO and RPO targets in the service ownership record. A production-data restore drill must prove them against the actual production database provider. CI's disposable restore protects migration mechanics but does not satisfy `production_restore_drill`.

## Release sequence

1. Qualify the exact commit through CI, migration, unit/integration, browser, accessibility, dependency, container, and restore checks.
2. Verify production Clerk, Google/Notion, analytics, Stripe, UMH (if enabled), logging/alerting, support queue, account deletion, legal enforcement, and backups independently.
3. Perform capacity/load and cold-start checks against a safe production-like environment.
4. Record current vendor reviews and service ownership.
5. Deploy with release migrations and a reversible artifact.
6. Run signed-in role/tenant/browser and provider round trips.
7. Record `release_owner_approval` last. If any earlier evidence changes, expires, or fails, the approval is no longer sufficient.

## Rollback

Application rollback uses the last qualified immutable image. Database changes must remain backward compatible for the rollback window; destructive schema changes require expand/migrate/contract releases. Provider or signing-key rollback must preserve idempotency and audit evidence. A rollback is incomplete until health, readiness, signed-in access, queue processing, and tenant isolation are reverified.

## Access review

Review Fly, database, Clerk, Stripe, Google, Notion, PostHog, GitHub, secret-vault, domain/DNS, and support access at least quarterly and after personnel changes. Remove dormant access, require phishing-resistant MFA where supported, rotate affected keys, and retain the review evidence hash.

## Control keys

The readiness endpoint defines the current 24-layer control set. `not_applicable` requires evidence and a reviewer; it is not a shortcut. Key examples include `production_restore_drill`, `database_isolation_review`, `observability_alert_test`, `billing_live_mode_acceptance`, `legal_approval`, `vendor_review`, `integration_round_trip`, `ai_governance_evaluation`, `data_lifecycle_drill`, and `accessibility_performance_release`.
