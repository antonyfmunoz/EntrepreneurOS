# EOS Overlay MVP Runbook

## Release definition

This release is the first implementation state of EOS: a company-scoped overlay that remains useful without UMH or provider availability. It is not the final native 17-module platform.

Included:

- Clerk-backed local principal resolution and an authenticated API gate;
- portfolio/company ownership plus membership, seat, reporting-tree, and classification checks;
- verified-email invitations with explicit acceptance, configurable employee-domain and external-collaborator policy, and accepted-member reassign/suspend/reactivate/revoke controls;
- one human-identity allowance across an owner's companies, enforced atomically for pending invitations and reactivation; paid plan entries in `EOS_STRIPE_PLANS` include an integer `seatLimit`;
- founder-managed portfolio-wide executive assignments that materialize across every current or newly attached organization and can be suspended, reactivated, or revoked once at portfolio level;
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
- governed Google Calendar candidate booking/cancellation, Google Drive context, and Notion context when the connected account grants the required scopes;
- native tenant-scoped electronic signing with immutable reusable PDF versions, visual field authoring, arbitrary recipient roles, optimistic-concurrency draft revision, sequential or parallel routing, explicit consent, Authority-Grant-controlled operation, link rotation, Gmail delivery receipts, hash-chained audit, sealed completion artifacts, expiration, void, and founder-only Recovery controls;
- optional, fail-closed UMH federation for one proposal capability;
- permanently quarantined legacy global task, agent, workflow, conversation, action, CRM, folder, document, assistant, and analytics routes;
- overlay UI for Brief, Organization, internal Talent, the secure external candidate portal, governed invitation delivery, bilateral candidate scheduling, versioned human-review packets, governed paid trials, Workforce, Missions, Approvals, Evidence, Systems, and role-compiled assistant context.

Deferred:

- native CRM, accounting, banking, payroll, and payment truth;
- autonomous consequential effects;
- active capital, M&A, or board-governance workflows;
- enterprise identity governance such as SAML SSO, SCIM, just-in-time group mapping, verified domain ownership, and custom policy authoring beyond the implemented seat hierarchy and invitation-domain allowlist;
- native implementations of every mapped module;
- production UMH/provider activation without explicit installation and credential setup.

## Configuration

Required for normal hosted operation:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `EOS_CREDENTIAL_ENCRYPTION_KEY` as a base64-encoded 32-byte key
- `SESSION_SECRET` as a high-entropy secret used to sign transient OAuth state
- `EOS_ARTIFACT_STORAGE_ROOT` as a persistent private artifact root outside the application image
- `EOS_MALWARE_SCAN_ENDPOINT` as a secret-free HTTPS scanner endpoint and `EOS_MALWARE_SCAN_SECRET` as its high-entropy bearer secret
- `EOS_CANDIDATE_STT_ENABLED=true`, `EOS_CANDIDATE_STT_MODEL`, and `OPENAI_API_KEY` only when optional candidate voice transcription is promoted. Audio is never sent for transcription before explicit candidate consent and a clean malware verdict; leave the feature disabled to retain voice-file and typed-response fallbacks without provider calls.

`GET /api/ready` returns 200 only when the database is reachable and hosted required configuration is present. `GET /api/health` is a liveness check and does not establish release readiness.

Native e-sign uses the same private `EOS_ARTIFACT_STORAGE_ROOT` for immutable source PDFs, hash-addressed completed PDFs, and audit artifacts. The role-filtered Systems workspace contains the tenant-scoped document, envelope, and Operations console. A seat with an active temporal `sign` Authority Grant covering the `native_esign` resource receives consequential controls; other eligible Systems roles receive the same tenant-scoped records in explicit read-only mode, while roles without the compiled Systems surface neither render the console nor request its data. Company CEO baseline authority includes signing; narrower roles need an explicit scoped delegation. Expired, suspended, revoked, cross-tenant, and out-of-scope grants fail closed and every protected read or operation records an immutable policy decision. Founder authority remains required for Recovery agreement issuance and artifact recovery. Before registration, an operator previews every page and places, drags, resizes, labels, and role-assigns signature, initials, date, text, or checkbox fields. Every signing document must contain at least one required signature field. Operators can register reusable immutable versions, define the exact recipient roles required by that version, compose sequential or parallel multi-recipient envelopes, choose private-link or email-OTP assurance, revise a current draft by expected version, issue it, deliver or remind through Gmail, rotate manual links, correct an incomplete non-Recovery recipient, void or recover when authorized, inspect recipients and the hash-chained timeline, and download completion artifacts through authenticated requests. A revision atomically replaces the complete unissued recipient snapshot, increments the envelope version, and appends `envelope_revised`; a stale version or issued envelope is rejected. Recipient correction likewise requires the current recipient version and a reason. It replaces the signer identity, invalidates the old link, resets open/consent/device/network and OTP evidence, preserves immutable delivery-attempt receipts, recomputes routing state, and returns one fresh transient link; stale, terminal, signed, cross-tenant, and Recovery-recipient corrections fail closed. The server independently parses the uploaded PDF, records its immutable page count, and rejects duplicate IDs, off-page field references, rectangles outside page bounds, or an envelope whose recipient-role set does not exactly match the document. Issuance provides a one-time manual delivery fallback. Gmail delivery requires the issuing operator's connected Google authorization, rotates the signer token before every attempt or reminder, and distinguishes delivered, failed, and uncertain provider outcomes. A response without a provider message id is not delivery evidence. The hosted lifecycle worker proactively expires due envelopes and incomplete recipients while public link checks enforce the same deadline independently.

Email OTP verifies mailbox access before consent using a ten-minute recipient-bound code, a sixty-second resend cooldown, five-send and five-guess limits, HMAC-only storage, and lockout; it must never be described as government-ID proofing. Completion creates durable Gmail receipt work with separately scoped encrypted document/receipt links, immutable attempts, bounded retry, dead-letter state, and reasoned replay that rotates the token. The Operations console creates event-filtered signed webhook subscriptions, returns each signing secret only once, shows only its fingerprint thereafter, and supports pause, resume, revoke, rotation, and failed-delivery replay. Webhook fan-out is transactional with the audit event; delivery is at least once and uses delivery/event identifiers, timestamp, and `v1` HMAC. Production egress accepts only standard-port HTTPS, rejects local/private/reserved targets, pins validated public DNS for the TLS request, does not follow redirects, and uses bounded timeout, retry, dead-letter, and replay behavior. Promotion requires a persistent shared/private storage design, backup/restore and retention evidence, a live Gmail invitation/OTP/completion send-and-receive journey, a real receiver signature/idempotency/retry/replay drill, and an exercised founder recovery and expiry run after simulated artifact unavailability.

Candidate file uploads accept PDF, PNG, JPEG, and UTF-8 text up to 10 MB. EOS stores files with private permissions outside PostgreSQL, records SHA-256 and metadata, and exposes no download until the configured scanner returns `clean`. Missing or failed scanning keeps the object quarantined. The local filesystem adapter is suitable for standalone development or a deliberately managed persistent volume; public multi-instance promotion still requires a shared encrypted object-store adapter or an explicitly accepted single-writer volume design, plus scanner, backup/restore, retention, and deletion evidence.

Adaptive candidate follow-ups are optional and use the existing governed Anthropic AI gateway only after separate candidate consent. The server sends a minimized job-relevant context, validates one strict question payload, persists generation provenance internally, allows only one open adaptive question and five total, and falls back to a deterministic job-relevant question when the provider is absent, fails, or returns unsafe content. Candidates can stop future adaptive questioning independently of the base application consent. This path collects and organizes evidence only; every consequential recruiting decision remains attributable to an authorized human. A successful local fallback is not live-provider qualification—promotion requires candidate-authorized provider, privacy/vendor, cost, audit, failure, and deletion evidence.

Human review packets are an internal, tenant-scoped decision-preparation surface. Each version snapshots the current application stage, plausible-role hypotheses, required outcomes, completed assessments, candidate evidence, and verified canonical evidence. Moving a packet into review fails closed until every current role hypothesis has an evidence-backed fit assessment, every required outcome has verified coverage, outstanding proof gaps have a bounded next-assessment recommendation, and interview/team-fit questions are explicit. Sign-off requires an authorized human recommendation and rationale. A packet may materialize that recommendation only as a separate `planned` assessment; it does not expose internal scoring to the candidate, change application state, reject or hire a person, open a trial, create a seat, or grant access/authority. Rejection, application withdrawal, or full processing-consent withdrawal cancels any open packet.

Paid trials are separate, versioned, tenant-scoped operating contracts created only for a `trial_recommended` application with a signed human review packet that recommends a trial. Creation writes a linked Work Packet and approval request; approval through the decision HUD changes the trial contract from draft to approved but does not contact the candidate. An authorized operator may then offer it. The candidate portal exposes only the question, duration, compensation and legal reference, support, outputs, scorecard, constraints/decision rights, observation points, review date, outcome criteria, instructions, candidate actions, and candidate-facing terminal feedback. It never exposes predicted fit, internal observations, evidence synthesis, canonical Evidence lineage, verifier identity or method, reviewer rationale, learning, approval/work-packet identifiers, or audit state. Candidate acceptance is required before an authorized operator can start the trial and atomically move the application to `trial_active`. Candidate submission requires candidate-owned, available evidence. Human review requires that evidence to remain available. Before a consequential outcome, an authorized human must promote every submitted Trial artifact into canonical verified Evidence by recording the supported claim and verification method; EOS binds that Evidence to the Trial Work Packet and records persistent source/reviewer lineage. Pass/redirect/extend/fail then requires every promoted Evidence record in the outcome, no cross-packet Evidence, an observation for every published scorecard dimension, an actual-outcome summary, reviewer rationale, candidate feedback, and a predicted-versus-actual learning proposal. Candidate evidence remains withdrawable after promotion; withdrawal expires the linked canonical Evidence, and full processing-consent withdrawal does the same for every promoted record. The outcome moves the application to `decision`; accepting or rejecting the learning proposal is a separate human action and never edits a template automatically. No promotion or trial path executes compensation, creates a placement or assignment, or grants access or authority. Rejection, application withdrawal, or full processing-consent withdrawal cancels open trials.

Native e-sign visual capture supports typed, drawn, and uploaded signatures. Drawn capture is PNG; upload accepts PNG or JPEG. The public API rejects non-canonical encoding, MIME/content mismatch, content over 512 KB, dimensions outside 32×16 through 2400×1200, excessive PNG inflation, and SHA-256 mismatch before it records a signature. Image bytes are written with private permissions under a unique recipient/capture key; relational state holds only the key and bounded verification metadata. The completed PDF embeds the exact revalidated capture. Audit artifacts and completion receipts expose the capture hash and method but not bytes or storage keys. Signed consent, signature, capture, field, timestamp, and minimized device/network evidence are database-immutable. A visual capture never upgrades link or email-OTP assurance into government identity or certificate assurance. Production promotion still requires shared/private artifact, backup, restore, retention, deletion, and multi-instance evidence.

Completed native envelopes are executable integrity records, not static hash
labels. Completion verifies source/final/audit/capture artifacts, recipient
signature digests, the complete event chain, and the audit's exact signing-event
prefix, then appends a hash-chained observation. The integrity worker rechecks
records older than 24 hours in bounded batches. In Systems, open a completed
envelope, enter an operator reason, and select **Verify evidence now**. A
`failed` or `unavailable` result requires investigation before the record is
relied on; never overwrite or delete the observation. Signers can select
**Verify signed record** from their completion view. Public responses contain
hashes, counts, results, and bounded failure codes only.

For an integrity alert, first preserve the database and artifact plane, stop
retention/deletion work for the envelope, and compare the latest observation to
the prior observation chain. Do not reseal, replace, or manually mark the
record valid. Confirm storage availability separately from a detected hash or
content mismatch. Restoration from backup must be followed by an operator
recheck with an attributable reason; the failed observation remains immutable.

Native signing custody configuration:

The **Library** tab owns reusable clauses, versioned templates, and
counterparties. Create a draft version, review its exact content, then approve
it. Approval supersedes the prior approved version without rewriting either
version. Generate only from an approved version. EOS records the exact template
hash, clause version IDs and hashes, bounded variable values, counterparty,
optional Work Packet, generated artifact hash, and visible signature geometry.

Use envelope search and state filters for operational triage. A completed
envelope remains signing evidence until an authorized operator explicitly
promotes it. Promotion requires a passing integrity check against current sealed
hashes, a reviewed retention policy, verified custody for every active artifact,
and a tenant-scoped Work Packet. The canonical Evidence record and immutable
promotion receipt link back to the envelope; retrying cannot duplicate Evidence.

- standalone primary: `EOS_ARTIFACT_STORAGE_PROVIDER=filesystem` and
  `EOS_ARTIFACT_STORAGE_ROOT`;
- shared primary: `EOS_ARTIFACT_STORAGE_PROVIDER=s3`,
  `EOS_ARTIFACT_S3_BUCKET`, `EOS_ARTIFACT_S3_REGION`,
  `EOS_ARTIFACT_S3_KMS_KEY_ID`, and optional
  `EOS_ARTIFACT_S3_ENDPOINT`, `EOS_ARTIFACT_S3_PREFIX`,
  or `EOS_ARTIFACT_S3_FORCE_PATH_STYLE`;
- independent backup: the corresponding `EOS_ARTIFACT_BACKUP_*` variables,
  using a different bucket for production readiness.

AWS role or workload credentials are preferred; no access key is stored in EOS
metadata. In Systems, activate a reviewed retention period, select **Verify
custody**, then **Back up and verify**. Restore is visible only for an artifact
in recovery state with a verified backup. Legal holds and deletion requests are
reasoned, versioned controls. Never lower retention to force a test deletion;
use disposable records and distinct test operators to exercise request,
decision, execution, and tombstone behavior.

Use **Storage loss-and-recovery drill** only with the intended organization and
a reason that identifies the qualification window. It writes synthetic canary
data, verifies primary and backup reads, simulates primary loss, restores from
backup, verifies the restored hash, and cleans both planes. Review every step,
the secret-free capability snapshot, and the immutable receipt hash. A failed
step remains a failed receipt; correct the provider configuration and run a new
drill rather than editing history. A stale interrupted run becomes failed after
30 minutes. The `native_esign_storage_recovery_drill` production-readiness
control accepts a pass only when its evidence hash matches a current receipt
from two distinct S3 planes with KMS, default encryption, versioning, default
object retention, lifecycle controls, and all eight steps passing. Filesystem
receipts never satisfy that control.

Public Google Workspace OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

The Google authorization request includes Gmail send, Calendar event access (`calendar.events`), and Drive metadata read-only. Existing grants must reconnect after this scope expansion; a configured refresh token is not proof that all three services are authorized.

Candidate Calendar events are never created merely because a candidate accepts a time. An authorized operator selects a Work Packet and requests booking; a local approver must approve it; EOS revalidates current authority and a future accepted slot; Google Calendar creates the event with candidate updates and a Meet link; only then does EOS mark it provider-confirmed and record receipt evidence. Cancelling a confirmed event follows the same approval path and reconciles the provider deletion before marking the EOS schedule cancelled. If Calendar is unavailable, native bilateral scheduling remains usable without claiming a provider booking.

Disconnecting Google Workspace first asks Google to revoke the user's refresh token (or access token when no refresh token exists), then removes the encrypted EOS credential. The response includes `providerRevoked`. If it is `false`, the connection is still removed from EOS and the UI directs the user to remove EntrepreneurOS from their Google account security controls. Never describe local token deletion alone as provider revocation.

Public Notion OAuth:

- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_REDIRECT_URI`

Notion credentials are stored per EOS user after authorization. A shared
deployment API token must not be used for tenant workspace access.

Disconnecting Notion uses the public integration revocation endpoint before removing the encrypted EOS credential and returns the same truthful `providerRevoked` outcome. An already-invalid grant is treated as revoked so reconnect/disconnect remains idempotent.

Optional intelligence and product analytics:

- `ANTHROPIC_API_KEY`
- `POSTHOG_API_KEY` for server events
- `VITE_POSTHOG_API_KEY` at client build time

Those values are optional only for local standalone development. The public SaaS release gate requires the Anthropic and dedicated EntrepreneurOS PostHog server/client configuration plus declared infrastructure vendors:

- `EOS_DATABASE_VENDOR_NAME`
- `EOS_DNS_VENDOR_NAME`
- `EOS_SECRET_VAULT_VENDOR_NAME`

Production readiness requires approved, current vendor records for those declared providers, Fly.io, GitHub, Clerk, and every configured external runtime provider.

Team allowances:

- `EOS_STRIPE_PLANS` is a JSON object whose plan entries contain `priceId`, `entitlements`, and `seatLimit`.
- `EOS_DEFAULT_TEAM_SEAT_LIMIT` optionally changes the standalone/unsubscribed workspace allowance; it defaults to 10 locally and fails down to one owner identity when public paid-SaaS enforcement is enabled without an active subscription.
- a human with access to several companies owned by the same account consumes one allowance, while each distinct pending invitation email reserves one allowance until accepted, revoked, or expired.

Optional UMH configuration is documented in `docs/umh-projection-adapter.md`. Federation is disabled by default.

For local development with the managed 1Password references, start the application through the checked-in environment template:

```powershell
op run --env-file=.env.op.tpl -- npm run dev
```

Promote a qualified commit to the existing Fly application without copying secret values into source or the shell history:

```powershell
$releaseCommit = (git rev-parse HEAD).Trim().ToLowerInvariant()
$env:EOS_SECRET_CUTOVER_APPROVAL = "CUTOVER eos-app $releaseCommit"
op run --env-file=.env.op.tpl -- powershell -NoProfile -File scripts/deploy-fly.ps1
```

Run that command from a clean worktree after confirming `eos-app` is the intended target and the credential vault retains the prior production secret set. The approval phrase is release-specific and is not a secret. The helper imports server-side Anthropic/PostHog values and injects only the required client build variables. It fails closed when any required reference is absent, any Fly secret is already pending, the commit is not the exact qualified remote head, or the typed cutover approval does not match. It finishes the immutable image build before staging credentials. An image rollback does not restore credential values, so credential restoration remains a separately owned rollback step whenever values change.

Running the client without `VITE_CLERK_PUBLISHABLE_KEY` intentionally renders an **Authentication setup required** screen. It must never fall through to protected UI or fail as an unexplained white page.

## Public Recovery diagnostic

`/recovery` and `/recovery-calculator` are intentionally public. They require one—and only one—compiled `ORG-EMPYREAN-STUDIOS` instance. If none or more than one exists, session creation returns `recovery_context_unavailable` instead of binding a visitor to an arbitrary tenant.

The visitor sees a partial modeled result before contact capture. Full report delivery requires explicit consent; EOS then creates or reuses one confidential prospect Stakeholder and Relationship and exposes the generated Sales Brief in the Empyrean Commercial workspace. The browser receives a high-entropy session secret; only its digest is stored. Calculator events retain no raw bearer token, email, phone or IP.

Set `EOS_RECOVERY_DIAGNOSTIC_URL` only to the verified HTTPS booking page authorized for the current Recovery diagnostic. When it is absent or invalid, the report remains available but booking fails closed. GoHighLevel writeback remains visibly `not_configured` until the governed Integration Binding and external adapter are live; native EOS capture is not evidence of an external CRM record.

## Recovery Call-2 close control

In the Empyrean Commercial workspace, a consented high-fit diagnostic exposes **Prepare Call 2**. Complete the buyer, evidence, uncertainty, scope, attribution, responsibility and objection fields; select either current standard terms or founding-proof terms with named proof consideration; save; then lock the packet as ready. The locked terms come from the server and cannot be replaced with a browser-entered price or guarantee.

If the buyer asks for any different discount, guarantee or scope, record the named exception. EOS creates an approval in the normal decision HUD. Do not record the case as won while that exception is pending or rejected. Record exactly one disposition. A won disposition means **pending agreement/payment** only and requires the agreement version to send, authorized payment path and onboarding trigger; it is not evidence of signature, settlement, onboarding or a provider effect.

## Recovery agreement and billing controls

After a Call-2 is closed won, select **Prepare controls** in Commercial. This creates the Recovery agreement-authority Work Packet, client agreement package and fixed-price billing manifest. Preparation itself does not send an agreement or create a Stripe checkout.

The founder records qualified counsel's actual output only after creating verified `contract_legal` Evidence on the agreement-authority Work Packet. Complete all 15 issue dispositions, reviewer attribution, credential reference, jurisdiction, exact revised-language reference, dependencies and effective version/date. Do not use this screen to manufacture legal approval or paste credentials.

Configure the client/provider legal identities, signer, exact effective agreement version, DocuSign template reference and the tenant's DocuSign Integration Binding. Configure the Stripe Integration Binding, product and setup/recurring price references, tax treatment, statement descriptor, payment-method policy, subscription-start rule, receipt behavior and cancellation/refund authority. The displayed amounts are server-owned; the browser cannot change them.

Select **Evaluate all gates** to refresh blockers. Eligibility requires the expected provider identity plus active lifecycle, connected state, healthy observation, passing parity, account reference and managed-secret reference. No button in this slice sends, signs, charges, subscribes, refunds, cancels or starts onboarding. Never infer signed or paid state from CRM, operator notes or a prepared manifest.

The **Approval-gated provider actions** panel implements the current payment-first sequence: request hosted Stripe Checkout; obtain the assigned EOS approval; wait for verified setup-payment and active/trialing-subscription receipts; request DocuSign issuance; obtain its approval; then wait for the verified completion receipt. Only the final signed + paid + subscribed combination opens billing activation/onboarding. Cancellation, full setup refund, and unsigned-envelope void are separate named approvals with required rationale. A failed approved operation can be retried only through the same Provider Execution and idempotency key.

Provider effects require both `EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=true` and a managed `EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS` JSON map keyed by the exact Integration Binding UUID or its `credentialReference`. Stripe entries contain the live execution key; DocuSign entries contain the JWT integration/user/private-key authority plus exact OAuth and REST bases. Never paste this JSON into EOS records, logs, support, or the UI. Keep the kill switch false until counsel authority, exact account identity, callbacks, failure ownership, and controlled compensation drills pass.

The **Authoritative provider receipts** panel exposes the exact tenant-and-binding-specific HTTPS destinations to configure in DocuSign Connect and Stripe Workbench. Copy the URL from EOS; do not construct a shared or unscoped webhook. DocuSign Connect must use JSON SIM, individual envelope events, HMAC-SHA256 and the required `envelope-sent`, `envelope-completed`, `envelope-declined`, `envelope-voided` and `envelope-expired` events. The issued envelope carries `eos_agreement_instance_id`, `eos_agreement_version`, `eos_template_reference`, and the execution contract version as custom fields; its stable Provider Execution ID is the DocuSign `transactionId`. Include recipient metadata so a completed envelope can be matched to the exact configured signer. Do not include documents or completion certificates in the webhook body.

Stripe must send only the required Checkout, PaymentIntent, Subscription, Invoice, refund and dispute events to its binding-specific destination. EOS creates one subscription-mode Checkout Session containing the one-time setup Price and recurring Price, with client/billing/agreement/package/product/price metadata and a stable Stripe idempotency key. EOS verifies the untouched webhook body with Stripe's SDK, requires a live-mode event, enforces the provider account when Stripe supplies it, checks package, product, price, subtotal/amount and currency, persists only a minimized projection and SHA-256 hash, and tolerates duplicate and out-of-order delivery. Checkout/provider acceptance is not payment: setup success and active/trialing subscription receipts first make the agreement eligible; only a later verified signature makes billing active. Test-mode events, refunds, disputes, unexpected prices, wrong tenants/accounts and terminal-state conflicts enter explicit recovery.

Store the actual webhook secrets only in the runtime secret manager. `EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS` is a JSON object keyed by the exact Integration Binding UUID; each value is either the current secret or an array containing the current and rotating secret. For example, the shape is `{ "<binding-uuid>": ["<provider-webhook-secret>"] }`; never place a real value in source, Notion, logs, screenshots or the Integration Binding record. The record's `credentialReference` remains the safe secret-manager location, while this injected environment value is the runtime material. Rotate by adding the new value, changing the provider, proving delivery, then removing the old value.

Every accepted event is signature verified before JSON is trusted, serialized through an idempotency lock, reconciled inside one database transaction, recorded in append-only `eos_recovery_provider_receipts`, linked to verified canonical Evidence and exposed in the activation timeline. Invalid signatures receive a generic `400` and create no receipt. A signature-valid but unmatched or contradictory event receives `200` after an immutable rejected/recovery receipt is recorded so provider retry storms cannot mutate another tenant or silently rewrite commercial state.

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

The integration test seeds isolated users/companies, exercises the HTTP lifecycle, and removes its fixtures. It covers tenant denial, role membership and reporting scope, member reassign/suspend/reactivate/revoke, employee-domain and external-collaborator policy, atomic team allowance enforcement, portfolio-wide access materialization and lifecycle, the full compiler lifecycle, hierarchical communication, advisor consultations, approval, provider execution/receipt/reconciliation, evidence enforcement, Systems qualification, native-signing exact-role composition, server-authoritative sequential routing stages, premature delivery/reminder/link denial, revision concurrency, issued-draft locking, CEO signing authority, narrow functional delegation and temporal expiry, workforce review/development/succession controls, the public candidate portal's allowlisted projection and bounded statuses, governed token-free-at-rest invitation request, intake, candidate scheduling, assessment, evidence, correction, link rotation/revocation, the versioned human-review packet lifecycle and candidate-boundary privacy, governed paid-trial approval/offer/acceptance/submission/review/outcome/learning and privacy, and the synthetic institutional-need→candidate→assessment→trial→offer→verified onboarding invitation→membership/assignment continuity→separate placement activation Talent lifecycle, audit, disabled-UMH operation, signed federation, replay rejection, idempotency, terminal outcomes, and retry behavior.

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
- Google Calendar, if enabled, proves approved future-time booking, candidate update delivery, Meet/event reconciliation, approved cancellation, and cancellation receipt capture;
- UMH, if enabled, proves live signed round-trip delivery and deduplication;
- security review covers cross-company denial, logs, rate limits, key rotation, and retention;
- release owner records residual risk and approves promotion.

## Native contract operations

The Systems > EOS Native Signing > Envelopes workspace provides usable
multi-select bulk remind/void controls, clone and completed-agreement renewal,
recipient change-request review, operator response/resolution, per-recipient
reminder schedules, and human-reviewed obligation promotion. Bulk void requires
founder authority. Renewal and clone always create a draft with reset recipient
state; they do not copy signatures or delivery claims.

The hosted process starts `startNativeEsignReminderWorker` with the other native
signing workers. Scheduled delivery therefore requires a persistent database,
`EOS_PUBLIC_ORIGIN`, and the requesting operator's live Gmail authorization.
The worker stops schedules for terminal recipients/envelopes and records failure
instead of implying delivery. A production deployment must prove scheduler
single-item concurrency, live Gmail receipt reconciliation, restart recovery,
and observability for failed schedules.

## Provider-native ingress

Systems > Integration Operations now separates two inbound contracts:

- **Signed adapter ingress** accepts only the EOS-owned
  `eos.adapter-event.v1` envelope and can reconcile an exact dispatch claim.
- **Provider-native ingress** accepts Notion webhook events and Gmail Pub/Sub
  mailbox-change signals in their native formats. These are observations; they
  never complete an Integration Run by implication.

### Notion

1. Select the exact Notion Integration Binding and configure native ingress
   with the binding's canonical workspace ID. Include the subscription ID when
   it is known.
2. Copy the generated HTTPS callback URL into the connection's **Webhooks**
   tab and create the subscription.
3. Notion posts a one-time verification token. Refresh EOS, attach verified
   provisioning Evidence, and use **Reveal verification token**. Paste that
   value into Notion's verification dialog.
4. EOS retains the token encrypted because it is also the HMAC-SHA256 key for
   `X-Notion-Signature`. Read projections expose only its fingerprint and
   availability. Recreate the subscription to rotate the token.

Notion event identity is deduplicated per registration. Workspace and optional
subscription IDs must exactly match the configured authority scope. Stored
events omit raw content from the UI and remain append-only.

An accepted page event enters `reconciliation_required`. The hosted worker then
requires the authorizing user's current Notion OAuth connection to identify the
same workspace, retrieves the exact page through the bounded read adapter, and
records the provider revision, canonical page link, title, truncation flag and
SHA-256 of the bounded content. EOS does not expose or copy the page body into
the provider-ingress projection. Each resource snapshot is append-only and
hash-chained to the prior snapshot for that registration and page. The matching
attempt explicitly remains an observation and does not create or complete an
Integration Run receipt.

Authorization, workspace, resource, or provider-read failure follows the same
bounded retry/dead-letter contract as Gmail history reconciliation. Repair the
OAuth/account boundary, attach verified Evidence, and replay the exact original
signal. A successful replay appends a new attempt and snapshot, marks only its
matching operator notification read, and cannot be replayed again as a current
dead letter. The manual fallback is to open the verified provider link, inspect
the declared revision in Notion, and record the decision through normal EOS
Evidence and Work Packet controls; do not mark the webhook itself completed.

Use **Rotate provider subscription or push identity** when replacing the
Notion subscription. The governed rotation requires verified Evidence and a
substantive rationale, clears the prior encrypted verification token, returns
the registration to `pending_verification`, and immediately rejects the old
subscription/token combination. Complete a new Notion verification handshake
before treating the registration as healthy. EOS never displays the retired
token during rotation.

### Gmail

Google OAuth now requests `gmail.readonly` in addition to `gmail.send`; an
existing authorization must reconnect before EOS can start a mailbox watch.
Before configuring EOS:

1. create a Pub/Sub topic in the same Google Cloud project used for the Gmail
   API and grant `gmail-api-push@system.gserviceaccount.com` publish access;
2. create an HTTPS push subscription with authentication enabled;
3. configure its exact push endpoint, OIDC audience, and push-auth service
   account in the EOS registration; and
4. attach verified Evidence and explicitly start the Gmail watch while
   `EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED=true`.

EOS verifies the Google-signed OIDC token, audience, verified service-account
email, Pub/Sub subscription, and mailbox email before accepting a signal. The
decoded payload contains only an email address and mailbox history ID; it is
stored as `reconciliation_required`, not as proof that a Gmail send succeeded.
Gmail watches expire within seven days and must be renewed at least every seven
days (Google recommends daily). The current control starts or renews a watch
manually and records an immutable returned-history/expiry receipt. When
`EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED=true`, the hosted provider-ingress
worker also renews watches approaching expiry and reconciles accepted signals
through a bounded `users.history.list` read. The interval defaults to 60 seconds
and can be set from 10 seconds to 15 minutes with
`EOS_PROVIDER_INGRESS_WORKER_INTERVAL_MS`.

### Service objectives and external escalation

Each provider-native registration owns a governed service-objective policy in
Integration Operations. An authorized operator can set the watch-renewal lead
time, reconciliation-overdue threshold, pending-verification warning delay,
minimum externally escalated severity, and maximum delivery attempts. Saving
requires the current policy version, verified Evidence, and a substantive
secret-free rationale. The update appends a hash-chained
`provider_ingress_policy_updated` event and audit receipt; it does not mutate
the provider registration or imply the external receiver is healthy.

External escalation is off by default. When enabled, the hosted
provider-ingress worker sends qualifying current alerts through the approved
`EOS_ALERT_WEBHOOK_URL` using the existing `eos.operational-alert.v1`
HMAC-SHA256 contract. Every attempt is append-only and records a redacted
payload hash, outcome, retry time, and bounded failure code. Receiver failure
or missing deployment configuration retries at bounded intervals and ends in
dead letter at the registration's configured attempt ceiling. An operator may
replay a dead-lettered delivery only with verified Evidence and a rationale,
only while the underlying health alert is still active, and only while
external escalation remains enabled. The receiver must deduplicate on the
supplied deterministic key because delivery is at least once across a crash
between remote acceptance and local commit.

Every current health alert also exposes **Acknowledge responsibility**. This
records the exact alert key, severity, observed time, acting user and seat,
operator note, optional verified Evidence references, and a content-hashed
receipt in an append-only ledger. It marks only the matching in-app action
notification read. Acknowledgement never removes the health alert, advances a
retry, repairs provider state, or proves that the external on-call receiver was
seen; the alert remains visible until its underlying condition is actually
repaired. A second acknowledgement for the same exact alert is rejected.

Renewal effects are serialized per registration with a database advisory lock,
so multiple app instances cannot knowingly start the same watch concurrently.
Renewal preserves a newer reconciled history cursor when Gmail returns an older
watch-start cursor. Renewal, Gmail history reconciliation, and Notion page-
snapshot reconciliation use bounded retry backoff and terminal dead letters.
The Systems control shows renewal receipts, reconciliation attempts, Notion
snapshot history, and an Evidence-backed operator replay action for a dead-
lettered signal. Replays preserve the original signal and every failed attempt;
they append a new attempt attributed to the operator.

The provider-ingress health projection derives actionable warnings from the
durable registration, watch, signal and attempt ledgers. It reports pending
verification, missing/expiring/expired watches, terminal watch renewal,
overdue reconciliation and reconciliation dead letters. Terminal worker
failures create one deduplicated in-app notification for the registration's
authorization principal. A successful operator replay marks its action
notification read; the immutable failed attempt remains in custody.

Use **Rotate provider subscription or push identity** to replace Gmail Pub/Sub
configuration. If the registration is active, rotation requires explicit
external-effect confirmation, the provider-effects kill switch, and a
serialized successful stop of the current mailbox watch before EOS commits
the replacement configuration. Rotation clears the prior watch cursor and
expiry and returns the registration to `pending_verification`; the operator
must then start the replacement watch and retain its exact receipt. A version
conflict fails closed rather than stopping a newer configuration.

History reconciliation stores message IDs, change kinds, bounded cursor
metadata, hashes, and summaries. It does not fetch or expose message bodies and
does not create or complete an Integration Run receipt. A stale/out-of-order
notification cannot move the cursor backward. A Gmail 404, authorization
failure, account mismatch, retry exhaustion, or expired failed watch requires
operator investigation. Production still requires live Google OAuth, Pub/Sub,
OIDC, renewal, rotation, missed-notification and replay evidence plus delivery
and attributable human acknowledgement through the approved production
on-call process.

### Google Drive and Google Calendar observation channels

Drive and Calendar observation are distinct from the approved Calendar event
create/cancel effect used by Recruiting. Register Drive against the exact
`changes` collection and register Calendar against one exact calendar resource.
EOS generates a channel token, retains only its encrypted value and fingerprint,
and accepts callbacks only when channel ID, resource ID and token all match the
current active registration. Never paste a channel token into Evidence, notes,
logs or screenshots.

An accepted callback is only a reconciliation signal. The worker must read the
provider through the exact authorizing user's OAuth connection before it records
a bounded metadata snapshot. Drive snapshots exclude file content; Calendar
snapshots exclude event descriptions. A deletion is recorded explicitly. The
cursor can only move forward, and reconciliation is serialized per registration
so two workers cannot knowingly overwrite a newer cursor. Operator replay is
available only for the current terminal failure and requires verified Evidence.
None of these observations create or complete an Integration Run receipt.

Before live qualification, reconnect Google with the requested Drive metadata
and Calendar scopes, create and renew both channel types with safe resources,
exercise changed and deleted resources, simulate a missed callback and replay,
confirm channel expiration handling, and preserve redacted provider and EOS
receipts. Local deterministic-adapter success is not live-provider proof.

### Artifact closure and pre-live qualification

Use **Artifact Closure** inside each active module to initialize the canonical
22-class matrix for the exact capability. Initialization is intentionally
conservative: every row begins missing and blocked. Assign the responsible seat,
choose inherited or instantiated only after confirming the template path, attach
verified Evidence, and record the next action. Marking a class not applicable or
deferred requires an explicit trigger condition.

Do not jump from mapped documentation to a qualification claim. Artifact
Complete, Implemented, Pre-Live Qualified, Field Qualified and Native Qualified
are separate gates. A group gate remains closed if any canonical class is absent,
any applicable row is missing or blocked, every row is excluded, or any applicable
row is below the target maturity. Pre-live and later maturity require verified
Evidence. The control records an immutable transition history; correct a stale
view by reloading rather than overwriting a newer operator's version.

Map every capability to at least one active EOS module in **Operations**. A
capability may belong to more than one module, but duplicate or out-of-range
assignments are rejected. In a module workspace, **Initialize this module**
creates any missing 22-class matrices for every visible,
non-dormant capability assigned to that module. The action is idempotent and
never advances maturity. If no mapped capability is visible, assign the exact
capability first instead of using a vague module-level placeholder. Module cards
then show visible matrix count, canonical row coverage, blockers, and the weakest
gate actually earned across those matrices.

Use **Initialize entire company** when first establishing an instance or after a
material capability remap. It creates only missing rows for every visible active
capability-module pair and never advances maturity. The operation refuses more
than 300 matrices; large enterprises should retire obsolete mappings or
initialize modules separately. Review the returned module and matrix counts
before assigning owners or Evidence.

### Governed Client Zero qualification campaign

Create a campaign from **Pre-live qualification campaign** only after mapping the
exact active modules. Select the accountable seat and a bounded objective. The
draft freezes the selected modules, visible capability keys and current closure
snapshot without claiming readiness.

Start is allowed only when every scoped 22-class matrix is initialized,
Implemented and blocker-free. EOS then creates the seven mandatory scenarios:
normal flow, authority denial, provider unavailable, failure/recovery, rollback,
tenant isolation and audit replay. For every scenario:

1. run the declared fixture without using production customers or uncontrolled
   provider effects;
2. attach verified Evidence visible to the accountable role;
3. record what was executed and observed;
4. record a named blocker for failed or blocked results;
5. repair and reopen instead of overwriting the failure receipt.

Qualify only after all seven scenarios pass and the implementation snapshot
still holds. That state proves a bounded synthetic run only. Promote each scoped
artifact independently to Pre-Live Qualified with its exact Evidence. The
founder/owner may then authorize or reject pre-live release with separate
verified decision Evidence and rationale. Do not use campaign qualification or
release as Field Qualified, Native Qualified, live-provider, legal, revenue,
customer-outcome or production-deployment proof.

Run and scenario identities are immutable. Every projection change must commit
with the exact same-version immutable event; a direct database edit without that
event is rejected at transaction commit. If a version conflict occurs, reload
the campaign rather than repeating the stale decision.
