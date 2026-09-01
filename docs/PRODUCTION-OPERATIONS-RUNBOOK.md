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

Native signing storage has a separate `native_esign_storage_recovery_drill`
control. Run the company-scoped synthetic drill from Systems after both
production S3 planes are configured. The receipt must be current, internally
hash-valid, environment-bound, and show distinct reachable identities, KMS,
default encryption, versioning, default object retention, lifecycle policy, and
all eight loss/restore/cleanup steps passing. Record the exported HTTPS evidence
URI and exact receipt SHA-256 in Readiness. EOS rejects local filesystem
receipts, stale or edited receipts, incomplete capability observations, and
arbitrary hashes. This control complements rather than replaces the production
database restore/RTO/RPO drill.

## Release sequence

1. Merge to the configured release branch and qualify that exact commit through the push-triggered CI migration, unit/integration, browser, accessibility, dependency, container, and restore checks.
2. Verify production Clerk, Google/Notion, analytics, Stripe, UMH (if enabled), logging/alerting, support queue, account deletion, legal enforcement, and backups independently.
3. Perform capacity/load and cold-start checks against a safe production-like environment.
4. Declare the production database, DNS, and secret-vault vendor names; record current reviews for those providers plus Fly.io, GitHub, and every configured runtime provider; and record service ownership, including a distinct backup owner, HTTPS on-call and escalation routes, the incident runbook, and a current access review with its next review no more than 90 days later.
5. Deploy with release migrations and a reversible artifact.
6. Run signed-in role/tenant/browser and provider round trips.
7. Record `release_owner_approval` last. If any earlier evidence changes, expires, or fails, the approval is no longer sufficient.

The production helper refuses a dirty worktree, a commit that is not the remote release-branch head, or a commit without a successful push-triggered qualification run. It also refuses any pre-existing Fly secret outside the `Deployed` state and requires the exact typed credential approval `CUTOVER <app> <40-character-release-commit>`. It exports source from that commit, builds and pushes one commit-labelled image without deploying it, and only then stages the supplied production secret set immediately before promoting that exact image with a canary strategy. It captures the prior image digest and release subject first. After promotion, it verifies every running machine has one immutable image digest and the exact expected release subject before any smoke is allowed to pass. Public or signed-in isolation smoke failure restores the prior immutable image, verifies every restored machine against the prior digest and subject, and reruns both public and authenticated isolation smoke against the restored subject. The resulting `.tmp/eos-last-deployment.json` records the immutable digest, human-readable image tag, commit, release subject, and smoke results; it is an operator receipt, not readiness evidence by itself.

Credential cutover is a distinct production change. Fly exposes secret names, deployment status, and opaque digests—not the previous plaintext values—so an image rollback cannot restore credentials changed by the release. Before approving `CUTOVER`, prove that the credential vault retains the complete prior secret set, identify the provider-side rollback/revocation steps, and assign the operator who can restore it. If secret staging fails partially, stop: the next release will reject the pending state until an operator deliberately completes or restores that cutover. Never treat successful image rollback smoke as proof that credential rollback is complete.

The production vault item must also contain separate least-privilege access-key
pairs for the primary and backup S3 planes, their distinct bucket/region/KMS
identities, and the malware-scanner endpoint and bearer secret. The release
helper stages this entire custody contract together; it rejects a missing or
partial plane credential pair. EOS never writes those credentials into storage
identity hashes, readiness evidence, or deployment receipts. Candidate
transcription remains disabled unless its kill switch is explicitly enabled;
only then is an OpenAI credential required and staged.

Promotion smoke deliberately does not declare the release complete. Record the release-bound deployment and release-owner evidence only after the new image is running, then execute `npm run test:e2e:production:readiness`. That final probe requires all 24 layers, vendor reviews, configuration controls, correct subjects, and unexpired evidence to pass.

For a safe local load rehearsal, `npm run test:e2e` starts the fixture runtime and issues 300 requests with concurrency 20. Direct `npm run test:load` use requires `EOS_LOAD_TEST_TARGET`. External targets additionally require HTTPS, `EOS_LOAD_TEST_APPROVED=true`, an exact `EOS_LOAD_TEST_ALLOWED_HOST`, and one of the allowlisted read-only probe paths. This protects a third-party or production service from an accidental load run.

Public production smoke uses `EOS_PRODUCTION_ORIGIN` and the exact `EOS_EXPECTED_RELEASE_SUBJECT` with `npm run test:e2e:production`. Signed-in isolation smoke additionally requires `EOS_PRODUCTION_BEARER_TOKEN`, `EOS_PRODUCTION_COMPANY_ID`, and `EOS_PRODUCTION_FORBIDDEN_COMPANY_ID`, then runs through `npm run test:e2e:production:authenticated`. The deployment helper derives the expected subject from the qualified commit. A manual smoke operator must copy the exact validated subject reported by the target release; a branch name, mutable image tag, or assumed commit is not acceptable. The bearer token must be short-lived, must never be committed or copied into evidence, and should be revoked after qualification.

## Rollback

Application rollback uses the last qualified immutable image. Database changes must remain backward compatible for the rollback window; destructive schema changes require expand/migrate/contract releases. Provider or signing-key rollback must preserve idempotency and audit evidence. Restore credential values separately from the retained vault version when a release changed them; deploying the prior image does not do that. A rollback is incomplete until health, readiness, signed-in access, queue processing, tenant isolation, and any credential restoration are reverified.

The manual rollback helper requires an exact `registry.fly.io/<app>@sha256:<digest>`, the matching immutable release subject, the production environment subject, the declared infrastructure-vendor names, short-lived signed-in qualification inputs, and the exact typed approval phrase `ROLLBACK <app>`. It performs a rolling restoration and reruns both public and authenticated tenant-isolation smoke. The operator must still repeat full 24-layer qualification before closing the incident.

## Access review

Review Fly, database, Clerk, Stripe, Google, Notion, PostHog, GitHub, secret-vault, domain/DNS, and support access at least quarterly and after personnel changes. Remove dormant access, require phishing-resistant MFA where supported, rotate affected keys, and retain the review evidence hash.

### Recovery commercial provider cutover

Keep `EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false` until the current counsel disposition, exact Stripe and DocuSign account identities, provider administrators/scopes, binding-specific webhooks, managed credential map, failure owner, and cancellation/refund authority are evidenced. The execution credential JSON is secret-vault material keyed by the Integration Binding UUID or credential reference; do not store it in the database or release logs. Enable it only through the normal immutable release and secret-cutover approval.

Before live enablement, run controlled Checkout, payment failure/retry, active subscription, DocuSign send/complete/decline/expiry, immediate and period-end cancellation, full setup refund, callback outage, response-timeout/idempotent retry, wrong-account, wrong-price, duplicate, and out-of-order scenarios. Confirm that provider acceptance creates only a pending receipt, onboarding remains blocked until paid + subscribed + signed, and every compensation path has a named approval, append-only activation event, provider receipt, Evidence, and audit record. Disable the kill switch on unexplained provider-account mismatch, reconciliation backlog, duplicate-effect suspicion, unavailable callbacks, or unresolved counsel/authority change.

`EOS_DATABASE_VENDOR_NAME`, `EOS_DNS_VENDOR_NAME`, and `EOS_SECRET_VAULT_VENDOR_NAME` bind the environment to its actual infrastructure dependencies. The readiness service always also requires approved records for Fly.io and GitHub, then adds Clerk and each configured model, analytics, billing, Google, and Notion provider. A generic vendor-control receipt cannot substitute for a missing provider-specific review.

## Provider-ingress operations

Keep `EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED=false` until the exact Google
mailbox, OAuth principal, Pub/Sub topic and subscription, OIDC audience and
service account are evidenced. Enabling it starts the allowlisted adapter
effect boundary and the provider-ingress worker; configure
`EOS_PROVIDER_INGRESS_WORKER_INTERVAL_MS` only between 10,000 and 900,000 ms.

Set those thresholds in each registration's **Service objectives and
escalation** control. The defaults are a 24-hour watch-renewal window, a
15-minute reconciliation-overdue threshold, and a 60-minute pending-
verification warning. External escalation is disabled until an operator
attaches verified Evidence and explicitly enables it. Select the minimum
severity and bounded attempt ceiling that match the organization's approved
on-call policy. A mailbox-history signal is not a send receipt and must never be
used by an operator to mark an Integration Run complete. Inspect the immutable
attempt summary and failure code, repair authorization/topic/account scope,
attach verified Evidence, then use the in-product replay control. Never edit or
delete an attempt row, advance a history cursor manually, or replay by calling
the public webhook endpoint.

EOS also exposes a role-filtered provider health projection in Integration
Operations. Pending verification, missing/expiring/expired watches, terminal
renewal, overdue reconciliation and reconciliation dead letters point to the
exact in-product action. Terminal retry exhaustion creates a deduplicated
in-app notification for the registration's authorization principal; a
successful governed replay marks the matching action notification read. These
controls do not themselves prove that the production on-call receiver saw the
alert. When escalation is enabled, EOS signs the exact redacted alert body with
`EOS_ALERT_WEBHOOK_SECRET`, sends it to `EOS_ALERT_WEBHOOK_URL`, and retains
each bounded attempt in an append-only ledger. A delivered row is local
evidence of an acknowledged HTTP response, not evidence that a human responded.
An authorized operator must use **Acknowledge responsibility** on the exact
current alert to create the separate immutable human receipt. The note should
name the containment action, accountable operator and next check. This changes
notification-read state only; it does not suppress the alert or represent
provider recovery. Duplicate acknowledgement is rejected, and a stale alert
cannot be acknowledged after its condition has disappeared.
Receiver failure or missing configuration reaches `dead_letter` at the policy
ceiling. Replay requires current alert state, verified Evidence, a substantive
rationale, and an enabled receiver policy. Production qualification must still
exercise the real receiver, a real on-call operator using this receipt, and the
complete incident-response path.

Subscription rotation is a governed configuration transition, not a database
edit. Attach verified Evidence and a secret-free rationale. Notion rotation
clears the old encrypted verification token and requires a new handshake.
Active Gmail rotation requires explicit external-effect confirmation and
serializes against watch start/renewal; EOS stops the current mailbox watch
before committing the new Pub/Sub subscription, topic, audience and push
identity. The registration returns to `pending_verification`, clears its
cursor/expiry, and rejects old callback scope. Start the replacement watch and
capture its receipt before restoring healthy status. If stop-watch fails or
the registration version changed, rotation fails closed.

During incident containment, turn the provider-effects kill switch off to stop
renewal and reconciliation effects, then inspect Gmail directly through the
documented manual fallback. Incoming verified callbacks may still be retained
as observations. Restore effects only after account identity, cursor
continuity, deduplication, and a controlled watch/reconciliation exercise pass.

For Notion page events, the worker accepts a provider read only when the current
OAuth workspace exactly matches the registration account reference and the
returned page identity matches the signed event. It stores a bounded content
hash, provider revision, verified HTTPS link and append-only snapshot-chain
hash; it does not store the page body in the operations projection or emit an
Integration Run receipt. Treat `provider_authorization_failed`,
`provider_account_mismatch`, `provider_resource_not_found`,
`provider_resource_mismatch`, and `provider_snapshot_unavailable` as distinct
repair cues. Use the verified page link as the manual fallback, preserve the
declared revision in Evidence, and replay only the exact dead-lettered event
after the OAuth/account boundary is repaired. Never interpret a successful
snapshot as proof that an EOS action ran or a provider mutation occurred.

Production qualification requires live evidence for renewal across at least
one expiry cycle, missed-notification recovery, stale cursor handling,
dead-letter alert delivery, operator replay, multi-instance serialization, and
rollback to manual provider operation.

## Support operations

Customers create and continue support conversations at `/support`. Only the authenticated ticket owner can read or reply to that thread. Configured platform administrators receive the support operations queue on the same page and can triage, change status, and reply. An administrator reply atomically persists the message, advances the selected status, and creates an in-app notification for the customer. A customer reply reopens a request that was resolved or waiting on the customer; a closed request rejects new replies and requires a new ticket. Account export includes the support conversation, while account deletion removes tickets and their cascading messages.

Do not use ticket bodies for secrets or private internal notes. The queue does not establish a response-time promise, emergency channel, staffing model, or escalation commitment. Before Layer 16 can pass in production, name the support owner and backup, publish approved hours/SLA/escalation, configure the signed alert receiver, and run an evidenced customer-to-operator-to-customer exercise.

## AI cost operations

Company owners configure hard monthly and per-request limits plus the percentage at which EOS emits one in-app warning per company, calendar month, and threshold. Reservations are serialized with the company advisory lock before model execution. The Settings AI-spend tab separates completed cost, active reservations, and failed calls and lists the current-month ledger by model and governed operating context.

An active reservation represents capacity EOS has protected but has not received a terminal provider result for. Do not clear it casually. Reconciliation accepts only `completed` with a positive actual cost or `failed` with zero cost, requires a secret-free HTTPS provider receipt or reviewed reconciliation artifact, locks the ledger row, rejects a second reconciliation, records the reviewer and time, and writes an EOS audit receipt. EOS ledger reconciliation does not prove provider billing accuracy: before Layer 18 passes, approve the budget/alert policy and reconcile the production ledger totals to authoritative provider invoices.

## Account deletion and retained evidence

The hourly lifecycle worker handles due requests only when `EOS_ACCOUNT_DELETION_ENABLED=true`. A request has a bounded cooling-off period and can be cancelled before execution. A portfolio or company owner must transfer ownership first; personal deletion does not destroy organization records. Before any personal erasure, the worker must confirm revocation of every connected Google and Notion grant. An unavailable provider fails the request closed and retains the encrypted credential for an operations retry; operators must not manually delete that credential while its external grant is unconfirmed. After provider and Clerk revocation succeed, execution removes CRM, documents, notifications, AI messages, provider tokens, support tickets, agent actions, memberships and UMH identity bindings; releases occupied seats; and detaches communication sender identity. Immutable legal, audit, approval, provider-effect and cost evidence stays linked to a non-identifying tombstone so operational proof remains coherent without retaining the person's profile or provider credential.

The exact legal retention periods, litigation-hold behavior, backup expiry, tax-record requirements, and support-record policy require professional approval before public launch. Code must not invent those periods. See `docs/DATA-LIFECYCLE-AND-RETENTION.md`.

## Control keys

The readiness endpoint defines the current 24-layer control set. There is no generic `not_applicable` path. Key examples include `production_restore_drill`, `native_esign_storage_recovery_drill`, `database_isolation_review`, `observability_alert_test`, `billing_live_mode_acceptance`, `legal_approval`, `vendor_review`, `integration_round_trip`, `ai_governance_evaluation`, `data_lifecycle_drill`, and `accessibility_performance_release`.

## Operating-company Stripe custody

EntrepreneurOS currently runs with `EOS_PUBLIC_PAID_SAAS=false`. It must not create EOS subscription plans, request checkout from EOS users, or treat EntrepreneurOS as the merchant. Each operating company owns its customer relationship, Stripe account, payouts, disputes, tax posture, and provider receipts. EOS connects those accounts through company-scoped Integration Bindings and may show a portfolio-wide view without combining funds.

For Empyrean, create or verify the Stripe Integration Binding in the Empyrean Studios workspace with the exact Empyrean Creative LLC Stripe account reference. Create a least-privilege live restricted key and a webhook destination dedicated to that binding. Then run `scripts/configure-company-stripe.ps1`; it collects the binding UUID, restricted key, and webhook signing secret through concealed prompts and updates the two binding-keyed 1Password JSON maps over stdin. It does not write secrets to disk or place them in command arguments.

Do not deploy merely because the vault fields exist. Before enabling live client collection, verify the binding account reference against Stripe, create the authoritative Recovery product and price records, receive a signed live-mode webhook, complete one governed payment and one approved compensation/refund drill, reconcile the payout, and attach secret-free evidence to `billing_live_mode_acceptance`. A separately incorporated company requires its own Stripe merchant account and Integration Binding.
