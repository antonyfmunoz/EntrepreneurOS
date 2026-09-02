# Trusted-source operating mode

Decision: the current internal EOS deployment must not add a scanner subscription
or increase its Fly memory allocation. Preserve the scanner implementation for
later, but close new untrusted binary ingress now.

## Current deployment contract

- `EOS_UNTRUSTED_UPLOADS_ENABLED=false` explicitly selects trusted-source mode.
- Fly remains configured for `shared-cpu-1x` and `512mb`.
- ClamAV and its updater do not launch while uploads are disabled, even if an old
  scanner-mode variable remains present.
- Missing, misspelled, or incomplete ingress configuration blocks uploads and
  fails production configuration readiness. It is not treated as a valid
  trusted-source declaration.
- `GET /api/runtime-capabilities` supplies the client-facing policy; clients fall
  back to no uploads and typed signatures when the policy cannot be obtained.

## Available operations

Structured forms, candidate statements, HTTPS references, native document text,
approved EOS template generation, generated-text revisions, typed electronic
signatures, consent, identity checks, audit evidence, and existing company
integrations remain available. Existing signing records retain their access and
custody controls.

Store external documents in the approved external service and record their link.
A link is a reference, not a clean-file verdict. EOS must not automatically fetch
or parse arbitrary referenced binary content in this mode. Native templates still
require the existing review and authority gates; this mode does not replace legal
review or invent approved contract terms.

## Blocked ingress

The server rejects candidate file/audio uploads, arbitrary signing-PDF registration,
uploaded PDF revisions, and drawn/uploaded signature captures. The three raw upload
routes reject before raw-body parsing. Image signing requests reject before image
decoding or artifact storage. Rejection returns `409` and
`untrusted_artifact_uploads_disabled`; no uploaded artifact is created.

The client removes these controls and offers the usable alternatives. JSON
instrument import remains a bounded, schema-validated structured-data operation;
it is not an arbitrary file-storage route.

## Re-enabling uploads later

An explicit `EOS_UNTRUSTED_UPLOADS_ENABLED=true` is necessary but insufficient.
Configure and qualify a scanner first. The preserved ClamAV implementation uses
loopback-only access and current signature updates; its memory/cost allocation
must be reviewed before activation. Test-only deterministic scan verdicts are
never accepted in production.

Re-qualification must cover clean, infected, timeout, unavailable, and malformed
content; private storage and access boundaries; candidate quarantine; PDF and
signature-image handling; browser controls; and live immutable release identity.
The ordinary release, backup, legal, privacy, provider, and operational approval
gates remain unchanged.

## Evidence boundary

Configuration safety is not a claim that a scanner exists or that historical
files were scanned. External inventory separately reports trusted-source mode
and scanner presence and requires both the live capability response and matching
machine configuration. Local tests, protected CI, and deployed production checks
are separate evidence classes.
