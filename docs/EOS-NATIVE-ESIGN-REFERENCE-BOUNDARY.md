# EOS Native E-Sign Reference Boundary

## Product decision

EntrepreneurOS owns the electronic-signing domain, user experience, records,
artifacts, audit history, and verification surface. DocuSign and future vendors
remain optional provider adapters. DocuSeal is a pinned engineering reference,
not an EOS runtime dependency, product surface, or hosted service.

This removes software subscription and per-envelope license fees from the EOS
native path. It does not make storage, compute, email delivery, backups,
security operations, qualified certificates, identity proofing, or legal review
costless.

## Reference provenance and reuse rule

- Upstream: `https://github.com/docusealco/docuseal`
- Reference commit: `004a22c1c88109c7ba0b567df011a8cb13894001`
- Examined license: GNU AGPLv3 plus `LICENSE_ADDITIONAL_TERMS`
- Local reference checkout: outside the EntrepreneurOS repository under
  `dev/_reference_sources`; it must never be included in an EOS image or source
  distribution.

The DocuSeal server license requires corresponding source availability for a
modified network version, and its additional terms require retained DocuSeal
attribution in covered interactive interfaces. Therefore:

1. Do not copy DocuSeal server files, translations, UI, database migrations,
   or generated assets into EntrepreneurOS.
2. Do not link, bundle, import, or ship the DocuSeal server with EOS.
3. Reuse only general architecture concepts, public standards, and independently
   authored EOS implementations unless qualified counsel approves a different
   licensing strategy.
4. Any permissively licensed DocuSeal client library is still unnecessary for
   the EOS-native path; use it only inside an explicit DocuSeal adapter.

## Reference concepts adopted in EOS terms

| Reference concept | EOS-owned implementation |
| --- | --- |
| Reusable template | Immutable tenant-scoped document version |
| Submission snapshot | Envelope bound to one exact document hash/version |
| Submitter | Recipient with role, routing order, one-time token, and lifecycle |
| Submission event | Append-only, per-envelope, SHA-256-chained audit event |
| Completion artifact | Private final PDF plus immutable hash and storage key |
| Audit trail | Private JSON audit artifact plus hash and verification projection |
| Ordered submitters | Sequential or parallel routing policy |
| OTP/KBA | Optional assurance adapters; never implied by typed signature alone |
| Webhooks | Provider-neutral outbound completion events added after durable outbox |

The governed contract layer now precedes that signing lifecycle. EOS owns
tenant-scoped counterparties, reusable clause definitions, immutable clause
versions, reusable templates, immutable template versions, founder approval
and supersession, deterministic variable/clause rendering, generated PDF
geometry, and template/counterparty/Work Packet lineage. A completed envelope
crosses into canonical EOS Evidence only through an explicit promotion receipt.
Promotion fails closed without matching sealed hashes, a current passing
integrity observation, an active retention policy, verified custody for every
active artifact, and a tenant-scoped Work Packet.

## Native lifecycle

`document version -> revision-safe draft envelope -> issued -> in progress -> completed`

Terminal alternatives are `declined`, `voided`, and `expired`. Contradictions,
artifact failures, and state races terminate in `recovery_required` rather than
being silently coerced into completion.

The first release requires:

- private PDF upload and SHA-256 registration;
- visual, page-aware field authoring for signature, initials, date, text, and
  checkbox fields, with drag/resize controls and explicit recipient-role
  assignment before registration;
- one visible, required signature placement for every authored recipient role,
  enforced during registration, revision, and envelope binding rather than
  relying on the browser to infer complete role coverage;
- immutable source page-count registration and server-side rejection of
  out-of-page fields, duplicate field identities, and rectangles that cross a
  page boundary;
- explicit signer consent and intent to sign;
- selectable private-link or email-OTP assurance, with recipient-bound HMAC
  verification, bounded expiry, resend cooldown, send and guess limits, and
  lockout without storing the OTP itself;
- high-entropy, single-use, expiring signing links whose raw values are never
  stored in Postgres;
- tenant-scoped recipients and ordered/parallel routing;
- optimistic-concurrency draft revision that atomically replaces the complete
  unissued recipient snapshot and records the before/after version in the audit
  chain;
- optimistic-concurrency correction of an incomplete recipient after issuance,
  with identity replacement, old-link invalidation, consent reset, immutable
  delivery history, and no operator-editable signing evidence;
- typed, drawn, and uploaded signature capture; image captures are bounded,
  content-decoded, dimension-checked, independently hashed, stored privately,
  embedded into the completed PDF, and represented in audit/receipt evidence
  without exposing their storage key or bytes;
- append-only hash-chained events;
- final PDF and audit artifact generation;
- a paginated final-PDF evidence certificate that covers every supported
  recipient instead of silently truncating a large signer set;
- signed-document download and executable independent integrity verification of
  the source PDF, completed PDF, audit artifact, complete database event chain,
  sealed signing-event prefix, recipient signature digests, and typed/drawn/
  uploaded capture evidence;
- an append-only, hash-chained verification ledger with automatic completion
  checks, scheduled rechecks, attributable operator checks, signer-visible
  verification, and explicit `passed`, `failed`, or `unavailable` outcomes;
- durable Gmail completion receipts with separately scoped encrypted access
  tokens, immutable attempts, bounded retry, dead-letter state, and controlled
  replay that rotates the token;
- signed lifecycle webhooks with write-only encrypted secrets, transactional
  event fan-out, HMAC verification material, DNS-pinned public HTTPS egress,
  immutable attempts, bounded retry, dead-letter state, and controlled replay;
- Authority-Grant-controlled register, revise, issue, resend, void, expiration,
  and recovery controls;
- no manual "mark signed" action.

Every native signing document requires at least one visible, required signature
field assigned to an envelope recipient. The Systems operator console exposes
the complete tenant-scoped document library, envelope queue, and Operations
console: an operator can
register reusable immutable versions, define arbitrary recipient roles, compose
parallel or ordered multi-recipient envelopes, issue and deliver links, remind,
rotate, correct an incomplete non-Recovery recipient, void, recover, inspect the
event chain, download authenticated completion artifacts, choose the assurance
mode, configure signed lifecycle webhooks, pause or revoke subscriptions, rotate
write-only secrets, and replay failed webhook or completion deliveries.
Correction is a
governed identity replacement, not an edit to an existing signature: it
requires the current recipient version and an operator reason, rotates the
bearer link, clears prior open/consent/device/network state, preserves every
immutable delivery attempt, and records privacy-preserving before/after identity
fingerprints in the hash-chained timeline. A corrected sequential envelope
retains signatures already completed by other recipients but recomputes its
aggregate state. Recovery recipients cannot be corrected after issuance; the
founder must void and re-authorize that agreement. Executive Systems roles
receive a read-only projection;
the client withholds consequential controls and the API still enforces the
operator boundary. Consequential controls require an active, temporally
effective `sign` Authority Grant whose resource scope covers `native_esign`;
Company CEO baseline authority includes that class, narrower roles require an
explicit scoped delegation, and expired, suspended, revoked, cross-tenant, or
out-of-scope grants fail closed. Every evaluation writes an immutable policy
decision. Founder-only Recovery agreement issuance and artifact recovery remain
separate restrictions even when another seat holds general signing authority.
Recovery uses that same native domain rather than a separate signing engine.
The client preview is an authoring aid, not the
authority: registration reopens the uploaded bytes, rejects unreadable or
encrypted PDFs, obtains the exact page count, validates every normalized
rectangle, and only then stores the immutable source.

The same server-authoritative rule applies to signature images. Drawn capture
accepts PNG; uploaded capture accepts PNG or JPEG. EOS rejects non-canonical
base64, MIME/content disagreement, captures over 512 KB, dimensions outside
32×16 through 2400×1200, PNG inflation beyond the declared pixel envelope, and
any SHA-256 mismatch before recording the signature. The bytes live only in the
private artifact plane. PostgreSQL retains their private key, hash, MIME, size,
and dimensions, while public and operator projections omit the key and bytes.
Once the recipient is signed, a database trigger prevents mutation of consent,
signature, capture, field, time, and device/network evidence. Recovery reopens
and revalidates the exact stored capture before resealing the envelope.

The authoring interface reports signature coverage per named recipient role and
will not enable immutable registration while any role lacks its own required
signature placement. The signer interface separately discloses every automatic
placement before the affirmative signing action: selected signature, initials
derived from the legal signature name, and the UTC signing date, each with its
target page. Completion adds as many evidence-certificate pages as necessary to
represent all recipients (up to the envelope limit of fifty), with explicit
certificate page numbers, total signer count, consent version, signing method,
timestamps, and signature/capture hashes. This makes multi-party completion
evidence complete without changing the stated identity-assurance tier.

## Integrity verification

Completion immediately reopens the independently stored source, completed,
audit, and capture artifacts. EOS recomputes their SHA-256 digests, validates
PDF and image content, recomputes every recipient signature-evidence digest,
and rebuilds the full event chain from canonical event projections. The sealed
audit JSON is compared to the exact database event prefix ending at
`envelope_completed`; later completion-delivery and webhook operations remain
valid members of the full database chain without falsely changing the sealed
signing snapshot.

Each observation records only bounded hashes, counts, check results, and
failure codes. Observations are append-only at the PostgreSQL boundary and form
their own per-envelope SHA-256 chain. A hosted worker rechecks completed
envelopes every 24 hours; an authorized operator can request an attributable
recheck; and either the original still-valid signing token or a rotated
completion-receipt token can request a possession-bound, read-only verification
projection. Public verification never returns artifact storage keys, raw
captures, signer data, network fingerprints, or secrets.

`failed` means EOS detected a contradiction or hash/content mismatch.
`unavailable` means required evidence could not be read or a legacy capture
cannot be independently recomputed. Neither state is presented as success, and
the signer UI directs the recipient to contact the sender before relying on the
record. A passing integrity check proves internal evidence consistency; it does
not create government-ID proof, a qualified certificate, counsel approval, or
legal sufficiency.

## Evidence custody and lifecycle

Every source PDF, completed PDF, audit JSON, and visual signature capture is
registered in a tenant-scoped custody inventory with immutable identity,
expected SHA-256, byte size, MIME type, storage provider, retention authority,
backup state, and last verification result. Filesystem storage remains the
standalone/local adapter. Production supports an S3-compatible primary plane
and a separately configured S3-compatible backup plane; writes are create-only
and an attempted different-byte overwrite fails as an immutable conflict.

EOS never invents a retention period. Until a founder activates a reviewed
company policy, deletion is ineligible and artifacts show `policy required`.
Activating a replacement policy cannot shorten an existing artifact's retained
through date, requires verified backup by default, and never enables automatic
deletion. A legal hold preserves one envelope regardless of retention state and
requires a reasoned founder release. Custody verification re-reads every object;
backup copies are independently re-read and hash/size checked; restore accepts
only a verified backup and must be followed by normal envelope integrity
verification.

Deletion is a governed tombstone operation, not a hidden file button. The
requester, founder decision maker, and executor must be three distinct
authorized users. Missing policy, unexpired retention, or an active hold blocks
execution. Completion removes envelope-specific primary and backup objects but
preserves relational identities, hashes, requests, and the append-only custody
event chain. Shared source documents are not deleted with one envelope. A
requester can cancel a still-pending request. A scheduled worker performs
bounded 24-hour custody reconciliation and fills required backup copies when a
backup plane is configured.

An authorized founder can run a synthetic storage loss-and-recovery drill that
contains no signing or customer data. EOS probes both configured planes, stores
and re-reads a random canary, copies and independently verifies the backup,
removes the primary canary, confirms loss, restores it from backup, rechecks the
hash, and cleans both copies. Every step and bounded provider-capability
observation is sealed into a SHA-256 receipt. The database permits a `running`
record to close once as `passed` or `failed`; completed receipts and history
cannot be updated or deleted. Stale interrupted runs close as failed before a
new run can begin, and one company cannot run two drills concurrently.

The capability projection exposes only hashed storage-plane identities and
bounded statuses—never bucket names, filesystem roots, endpoints, keys, or
credentials. A local filesystem receipt is useful development evidence but is
rejected by production readiness. The production control accepts only a
current, internally hash-valid receipt from distinct reachable S3 planes where
both observations show KMS-requested writes, bucket-default encryption,
versioning, default object retention, and an enabled lifecycle policy, and all
eight loss/restore/cleanup steps passed. A platform administrator must still
record production-scoped HTTPS evidence against the exact environment subject;
the drill never marks readiness optimistically.

Repository support for S3 is not evidence that a production bucket, encryption
policy, IAM boundary, replication, object lock, lifecycle rule, restore drill,
or multi-instance access has been configured. Those remain deployment gates.

## Delivery and recovery semantics

Issuance creates a private, manually deliverable link but does not claim that an
email was delivered. Gmail delivery always rotates the link first, records a
`prepared` attempt, and moves that attempt exactly once to `delivered`, `failed`,
or `uncertain`. Only a non-empty Gmail message receipt produces `delivered`.
Network/provider ambiguity produces `uncertain`; retrying creates a new attempt
and invalidates the earlier link. Terminal attempt identity and outcomes cannot
be rewritten through application or database updates.

Sequential routing is also an execution boundary, not a visual label. EOS
returns a private link only for the currently active routing order at issuance;
later recipients remain `pending` with delivery state `routing_wait` and are
projected as `waiting`. Their stored high-entropy token is
not exposed by the operator client, and public access, Gmail delivery, reminder
scheduling, reminder-worker delivery, and replacement-link rotation all fail
closed until every earlier routing order is signed. When the preceding stage
completes, the server projection changes the next order to `active`; an
authorized operator can then email that stage or rotate a manually deliverable
link, which is the point at which recipient state becomes `sent`. Parallel
envelopes expose every incomplete recipient as active. This
prevents a premature email or reminder from implying that a later signer may
act out of order.

An authorized operator may send a controlled reminder while the recipient is
sent, opened, or consented. A reminder creates another delivery attempt and
rotates the bearer link; previously recorded consent remains attributable and
does not become a new signature. EOS never sends reminders after a recipient or
envelope reaches a terminal state.

For an `email_otp` envelope, EOS verifies access to the recipient mailbox before
consent. A code expires after ten minutes, cannot be recovered from the stored
recipient-bound HMAC digest, is subject to a sixty-second resend cooldown, and
locks after five sends or five incorrect guesses. Correction clears the prior
OTP state. Successful verification is idempotent and enters the hash-chained
event history; it proves mailbox access only.

Completion seals the final PDF, completion event, complete audit artifact, and
their hashes inside one coordinated database transaction. Artifact failure
rolls database state back and locks the signed envelope in
`recovery_required`. Founder recovery reuses the already-recorded signatures;
it never asks an operator to mark the agreement signed or asks the signer to
repeat a successfully recorded signing action.

Completion transactionally prepares one durable receipt delivery per signer.
The operations worker sends separately scoped signed-document and receipt links
through Gmail, requires a non-empty provider message id before recording
delivery, preserves every attempt, retries bounded transient failures, and
dead-letters exhausted work. Controlled replay requires an operator reason and
rotates the encrypted completion token so an older link cannot be revived.

Every appended lifecycle event transactionally fans out to matching active
webhook subscriptions. The receiver gets a versioned, tenant-minimized payload,
delivery and event identifiers, timestamp, and `v1` HMAC signature. Delivery is
at least once, so the receiver must deduplicate by delivery id. Paused, revoked,
or non-matching subscriptions do not consume attempts. Production egress allows
only standard-port HTTPS, rejects local/private/reserved destinations, pins the
validated public DNS address for the TLS request, does not follow redirects, and
uses bounded timeout, retry, dead-letter, and reasoned replay semantics.

A hosted lifecycle worker reconciles due issued/in-progress envelopes to
`expired`, expires every incomplete recipient, propagates expiration to a linked
issued Recovery agreement, and appends one hash-chained `envelope_expired`
event. Link-time expiry checks remain in place as defense in depth; the worker
makes operator state authoritative without waiting for another public request.

## Assurance boundary

A generated or founder-approved template is not itself qualified legal advice.
When legal review is required, the exact clause or template version retains its
separate verified counsel Evidence reference. Signing completion is likewise
not automatic canonical Evidence; promotion is a distinct attributable act.

A typed, drawn, or uploaded electronic signature records an affirmative action and its
evidence; it is not, by itself, government-ID verification or a qualified
certificate signature. Email OTP verifies control of the addressed mailbox at
that moment; it is not government-ID proofing. Identity proofing and
certificate-backed PDF signatures remain separate, named assurance
capabilities. EOS must display the actual assurance method and must not upgrade
that claim by inference.

Changing the visual capture method does not change the assurance tier. A drawn
or uploaded image with link assurance remains link assurance; email OTP adds
mailbox-control evidence only.

Legal language and jurisdictional applicability remain counsel-owned. EOS can
enforce an approved document version and collect evidence, but it cannot declare
a document legally sufficient merely because the workflow completed.

### Portfolio proposal and company-adoption boundary

A portfolio owner who also holds founder authority in a source company may
publish an approved company template as a portfolio proposal. Publication
creates a new immutable portfolio snapshot: title and body, bounded variable
and recipient contracts, flattened clause text and hashes, source hash,
jurisdiction label, applicability statement, limitations, classification,
review Evidence, and the reviewer's declared authority. Clause references are
flattened so another company never depends on source-company record identifiers.

A portfolio proposal is advisory. It grants no cross-company authority, changes
no company template, and does not become legal advice or qualified-counsel work
merely because its source was founder-approved. `business_review`,
`internal_legal`, and `qualified_counsel` are recorded distinctly and are never
upgraded by inference.

Each adopting company must make one attributable accept or reject decision with
its own founder authority and verified company-local Evidence. Rejection creates
no local legal object. Acceptance copies the immutable snapshot into a new
tenant-owned template version in `draft`; it does not copy source-company clause
IDs, does not approve the version, and cannot generate an agreement until the
adopting company's existing founder-approval boundary is completed. Only a
decision explicitly labeled `qualified_counsel` may populate the local counsel
Evidence reference.

Proposal withdrawal preserves prior company decisions and local drafts. Proposal
content and every company adoption decision are immutable at the database layer;
optimistic hash checks prevent decisions against stale snapshots. A future
proposal is a new numbered snapshot, never a silent mutation of an adopted one.
This supplies reusable portfolio learning without claiming legal sufficiency,
counsel approval, or shared legal authority.

### Jurisdiction-pack and company-applicability boundary

The portfolio owner may prepare a new immutable pack version containing cited
sources, dates, jurisdiction labels, scope, applicability criteria, exclusions,
and required review steps. Publication is a separate founder decision and
requires verified tenant-local `counsel_review`, `legal_review`, or
`legal_opinion` Evidence plus the reviewer's name, organization, external
credential or engagement reference, and review-limits note. EOS retains these
as attributable claims and never represents that it independently verified a
license or authored the law.

Each company records its own append-only applicability outcome for the exact
published pack hash. Portfolio proposals may cite that hash, but a cited
proposal cannot be accepted until the company has an `applicable` outcome for
the same snapshot. `not_applicable` and `needs_revision` fail closed. Pack
withdrawal preserves prior company decisions and proposal lineage. This is
evidence custody and authority enforcement—not legal advice, automatic law
monitoring, a legal-sufficiency conclusion, or a live counsel service.

## Contract operations

EOS supports controlled operations around an immutable agreement without
rewriting the issued document. An operator may clone any standard envelope into
a new draft; a renewal is the same reset operation but may originate only from a
completed agreement. Both retain the exact source-envelope and document-version
lineage while resetting every recipient state, token, consent, signature,
delivery claim, and expiry.

A recipient may open one governed change request before signing or declining.
Negotiation entries form an append-only SHA-256 chain that is visible to the
affected signer without exposing internal user identifiers. The signer and
operator can both append replies. An open request blocks consent and signature.
Operator response and resolution are attributable, and negotiation never
mutates an issued document.

When accepted changes affect text, an operator uploads a separately fielded PDF
revision. EOS preserves its parent document id, source and target hashes,
negotiation id, human-reviewed summary, declared change list, and immutable
comparison receipt. For an arbitrary PDF this is explicitly an
`operator_declared` comparison, not a semantic legal redline or an assertion
that every textual difference was detected.

For an agreement generated by EOS, an operator may instead choose an approved
version of the same governed template lineage and provide its bounded variable
values. EOS reconstructs the source text from its immutable template, exact
clause-version hashes, values, and rendered-content hash; fails closed if that
receipt no longer verifies; renders the target PDF; and stores an exact line-
level insert/delete/equal comparison with separate source and target text
hashes. Large documents use an exact bounded prefix/suffix representation
rather than unbounded comparison memory. The receipt is `generated_text`, not
an operator declaration. It describes machine-computed text changes only: it
does not determine materiality, legal equivalence, legal sufficiency, counsel
approval, or whether a requested business outcome was achieved.

Every replacement has an explicit review boundary tied to that exact immutable
receipt. Before issuance, the founder must review the comparison viewer and
acknowledge its `comparisonSha256`; the API rejects a missing or different hash
and permanently records the reviewer, time, and hash. Before electronic consent,
each signer sees the same comparison projection and must acknowledge the same
hash. The API again rejects omission or mismatch, and the recipient
acknowledgement is sealed into the audit artifact, completion receipt, event
chain, and later integrity verification. Ordinary envelopes do not acquire a
false comparison acknowledgement. A recipient identity correction invalidates
the prior acknowledgement alongside consent and the private link.

Generated revisions inherit the source counterparty and Work Packet, must keep
the signer-role contract compatible, and may participate in the same atomic
founder-controlled replacement transaction. Uploaded or unverifiable legacy
documents cannot enter this path and remain on the reviewed-PDF workflow.

Founder authority is required to replace active issued text. Replacement is one
transaction: EOS creates a new draft with reset recipients and no inherited
consent or signatures, marks the source envelope voided and superseded, cancels
its reminder schedules, resolves the negotiation with the replacement ids, and
records events on both envelopes. The earlier signing link then fails because
its envelope is terminal. The new envelope must be reviewed and issued through
the founder-only exact-comparison acknowledgement path.

Per-recipient reminder schedules stop when the recipient or envelope becomes
terminal, respect bounded cadence and attempt limits, rotate the signing token,
and use the same Gmail receipt semantics as an operator-triggered delivery.
Bulk remind and founder-only bulk void return item-level immutable receipts and
may complete partially; EOS never describes a partial batch as atomic success.

After a completed contract has passed integrity and custody verification and has
been explicitly promoted to canonical Evidence, an authorized human may record
an obligation from an exact reviewed excerpt. The resulting object is the shared
EOS Risk/Obligation/Control record, not an e-sign-specific duplicate. EOS stores
the excerpt hash and promotion receipt and does not claim autonomous legal
interpretation, applicability, or counsel approval.

Promoted obligations are operated through that shared state machine, but every
review also creates a separate append-only, SHA-256-chained receipt. The receipt
binds the prior and next state, accountable visible tenant seat, human finding,
next review, cited operational Evidence, policy decision, source-excerpt hash,
actor, and time. Optimistic concurrency rejects stale reviews. Active states
must schedule another review, and breach or satisfaction requires verified
operational Evidence visible inside the operator's hierarchy and disclosure
scope. The executed agreement remains source Evidence only; EOS explicitly
rejects using it by itself as proof that performance occurred or failed.

Accepted, satisfied, and superseded transitions require `decide` authority in
addition to native-signing operator authority. Other reviews require `execute`
authority. The review interface only offers transitions permitted by the shared
Risk/Obligation/Control lifecycle and only lists active seats and verified
Evidence already visible to the principal. These controls establish governed
operational records, not autonomous obligation extraction, legal advice,
jurisdictional applicability, or proof that the cited Evidence is legally
sufficient.

Completed agreements also enter a company-level contract control center. EOS
keeps the envelope's signing-link `expiresAt` strictly separate from the
human-reviewed agreement effective date, agreement end, notice deadline, and
next governed review. A versioned plan binds those dates to one visible active
seat and classification; optimistic concurrency prevents stale schedule edits.
Unplanned agreements are visible only to the company owner or through a visible
accountable Work Packet, and planned agreements follow seat-hierarchy and
classification disclosure rules.

A renewal decision is a distinct material act. It requires `decide` authority,
a human rationale, and separate verified operational Evidence visible in the
principal's tenant, hierarchy, Work Packet, and classification ceiling. EOS
rejects the executed agreement as sole evidence of renewal fitness. Each plan
change and renewal decision creates an immutable SHA-256-chained receipt bound
to the policy decision, actor, schedule snapshot, owner, and Evidence. An
approved renew/renegotiate intent can create a lineage-linked renewal draft,
but EOS does not auto-renew, terminate, interpret terms, or claim that an
entered date is legally correct.

Contract notices use a separate, fail-closed execution path. An operator first
prepares exact recipient, subject, body, type, deadline, owner, and
classification content; EOS hashes that draft and sends nothing. Approval then
requires `decide` authority, a human rationale, and separate verified
operational Evidence. The executed agreement cannot be the only approval
Evidence. Approval seals a second hash over the exact content, Evidence,
approver, time, and policy decision. Only an approved hash can enter delivery.

Delivery requires `execute` authority and persists an immutable prepared
attempt before Gmail is called. A non-empty Gmail message id is the only
successful delivery receipt. Provider ambiguity remains `uncertain`, visible
to the operator, and retryable only as a new attempt against the unchanged
approved hashes; a `sending` attempt cannot be retried blindly. An authorized
decision-maker can reconcile a stranded prepared attempt as delivered, failed,
or uncertain only after recording a review note; reconciled delivery also
requires a verified provider message reference. Attempts bind
recipient, content hash, approval hash, actor, authority decision, provider
receipt or minimized failure, and time. This is controlled delivery evidence,
not proof of legal sufficiency, receipt by the counterparty, legally effective
notice, counsel approval, or autonomous deadline calculation.
