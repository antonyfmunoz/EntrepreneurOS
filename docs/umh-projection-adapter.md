# EntrepreneurOS UMH projection adapter

EntrepreneurOS owns its domain data, identity bindings, approvals, provider credentials, audit, and business rules. UMH uses signed HTTPS only and never receives database access.

## Bootstrap

1. Apply `migrations/0002_add_umh_federation.sql` and `migrations/0004_add_umh_identity_bindings.sql` with `npm run db:migrate`.
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

The only command is `eos.action.propose.v1` for `create_task` or `create_document`. It creates a company-scoped local pending action. No effect executes before a local user approves it.

Commands fail closed unless protocol, schema, signature, issuer, installation, external-actor binding, local user, delegation, company, target agent, capability, timestamp, expiry, nonce, and idempotency hash pass. Concurrent duplicate delivery returns the original immutable outcome when the request hash matches. Nonce reuse or idempotency conflict returns `409`.

Acceptance, approval decisions, execution results, terminal command outcomes, and audit evidence are persisted through projection-owned transactions. The outbox signs events, claims rows conditionally, retries with capped exponential backoff, and recovers stale leases. Delivery is at least once; the receiver must deduplicate by `eventId`.

## Verified locally

The disposable PostgreSQL qualification test verifies:

- valid signed command accepted once;
- duplicate delivery returns the same action;
- invalid signature rejected;
- replayed nonce rejected;
- wrong company scope rejected;
- explicit actor/delegation binding required;
- local approval precedes execution;
- repeat approval rejected;
- terminal outcome is signed-query readable;
- unavailable UMH receiver leaves outbox rows pending with incremented attempts;
- EOS remains usable while federation is disabled.

Production installation, live endpoint delivery, and production key rotation remain deployment operations, not repository-level proof.
