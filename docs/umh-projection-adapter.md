# EntrepreneurOS UMH projection adapter

EntrepreneurOS owns its domain data, identity bindings, approvals, provider credentials, audit, and business rules. UMH uses signed HTTPS only and never receives database access.

## Bootstrap

1. Apply all checksum-tracked migrations through `migrations/0019_canonicalize_umh_proposals.sql` with `npm run db:migrate`.
2. Create one disabled `umh_installations` row bound to the exact EOS company.
3. Create a disabled `umh_identity_bindings` row mapping the external UMH actor and delegation to an authorized local EOS user and company.
4. Grant only `eos.action.propose.v1` for the first slice.
5. Configure the projection-owned keys and endpoint.
6. Enable the installation and identity binding, then enable federation last.

Required configuration:

- `UMH_FEDERATION_ENABLED=true`
- `UMH_INSTALLATION_ID`
- `UMH_ISSUER`
- `UMH_COMMAND_PUBLIC_KEY_PEM` — UMH Ed25519 public key
- `UMH_EVENT_ENDPOINT` — UMH HTTPS event receiver
- `EOS_EVENT_PRIVATE_KEY_PEM` — EntrepreneurOS Ed25519 private key

No key value belongs in the database, manifest, event, log, or client bundle.

## Interface

- `GET /.well-known/umh/capability-manifest` exposes the supported contract and local enabled state.
- `POST /api/umh/v1/commands` accepts canonical `umh.federation.v1` JSON signed with `X-UMH-Signature`.
- `GET /api/umh/v1/outcomes/:commandId` requires a signed lookup plus `X-UMH-Installation-Id`.

The only command is `eos.action.propose.v1` for `create_task` or `create_document`. It creates a company-scoped canonical EOS Work Packet and a pending approval assigned to the founder authority seat. The accepted response returns `workPacketId` and `approvalId`; `actionId` is retained only as a compatibility alias for `workPacketId`.

Approval moves the Work Packet to `ready`; rejection moves it to `cancelled`. Approval authorizes canonical EOS work but does not directly write a legacy task or document and does not execute a provider effect. Consequential effects use the separate EOS provider-execution workflow, which requires its own local approval and stores a provider receipt as evidence.

Commands fail closed unless protocol, schema, signature, issuer, installation, external-actor binding, local user, delegation, company, target agent, capability, timestamp, expiry, nonce, and idempotency hash pass. Concurrent duplicate delivery returns the original immutable outcome when the request hash matches. Nonce reuse or idempotency conflict returns `409`.

Proposal acceptance, approval decisions, terminal command outcomes, and audit evidence are persisted through projection-owned transactions. The outbox signs events, claims rows conditionally, retries with capped exponential backoff, and recovers stale leases. Delivery is at least once; the receiver must deduplicate by `eventId`.

## Verified locally

The disposable PostgreSQL qualification test verifies:

- valid signed command accepted once;
- duplicate delivery returns the same Work Packet and approval;
- invalid signature rejected;
- replayed nonce rejected;
- wrong company scope rejected;
- explicit actor/delegation binding required;
- local approval governs the canonical Work Packet transition;
- repeat approval rejected;
- zero legacy action, task, or document writeback;
- terminal outcome is signed-query readable;
- unavailable UMH receiver leaves outbox rows pending with incremented attempts;
- EOS remains usable while federation is disabled.

Production installation, live endpoint delivery, and production key rotation remain deployment operations, not repository-level proof.
