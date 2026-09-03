# Empyrean Recovery: historical Stripe merchant setup

Setup receipt dated 2026-09-01. This is configuration evidence, not payment activation or proof of a completed payment.

## Post-setup account cleanup (2026-09-02)

- The duplicate Stripe account `acct_1U0pKdLtYrBK6FoL` (labeled “EntreprenuerOS”) was closed by the account owner.
- The connected Stripe account inventory now contains only the historical Empyrean Studios account `acct_1LekouBjRpasql4r` in test and live mode.
- EOS production configuration and the ChatGPT Stripe connection continue to reference only the historical account.
- The four live Recovery prices were activated: founding setup, founding monthly, standard setup, and standard monthly.
- The binding-specific live Stripe webhook was enabled at the documented EOS endpoint; EOS payment effects remain approval-gated.
- The no-money provider qualification suite was re-run locally: 37 Stripe/Recovery tests passed; no charge, subscription, refund, or live customer effect was created.

## Identity and authority

- Product: EntrepreneurOS; operating company: Empyrean Creative LLC, doing business as Empyrean Studios.
- Historical merchant retained: `acct_1LekouBjRpasql4r` (Empyrean Studios).
- EOS company: `1`; integration binding: `fd3ecfba-55f6-5f8b-a5d4-a31e09c3ea67`.
- At the time of this setup receipt, neither the historical merchant nor the newer duplicate had been deleted. Existing LeadConnector products were not changed.
- EOS SaaS subscription sales are out of scope. These are the operating company's Recovery service offers.

## Canonical terms

The latest 2026-08-18 decision in [Recovery System - Commercial Authority & Guarantee](https://www.notion.so/3a9da8b96e4f8129ba8fefea055ee11b) and the [Payment Path & Billing Manifest](https://www.notion.so/3bcda8b96e4f81ff9dfafac91a98cefa) governs these prices. Older pilot-only pricing on the same pages is superseded.

- Founding proof cohort: $3,000 setup plus $1,500/month; first 3-5 qualified external clients, maximum five without a new decision. Requires the documented proof, testimonial/case-study and cooperation consideration.
- Standard: $5,000 setup plus $2,500/month.
- Setup and first month are due at kickoff unless a named founder exception is recorded.
- The first 30 days are the guarantee measurement window, not the duration of service or automatic subscription termination.

## Provider objects created and reread

At the time of this setup receipt, all four prices were **live-mode but inactive** (`active: false`). They were subsequently activated on 2026-09-02. No checkout session, payment link, subscription, charge, refund or cancellation was created as part of this setup or activation.

| Package | Product | Component | Price | Amount USD | Lookup key |
| --- | --- | --- | --- | --- | --- |
| Founding | `prod_VBQSk3TiNoh4NJ` | Setup, one-time | `price_1UB3cRBjRpasql4rmCBID8T4` | 3,000 | `eos_recovery_founding_setup_v1` |
| Founding | `prod_VBQSk3TiNoh4NJ` | Monthly | `price_1UB3byBjRpasql4rdPMV37HM` | 1,500 | `eos_recovery_founding_monthly_v1` |
| Standard | `prod_VBQTC5LT8Rhq83` | Setup, one-time | `price_1UB3dEBjRpasql4rdBEbCFX7` | 5,000 | `eos_recovery_standard_setup_v1` |
| Standard | `prod_VBQTC5LT8Rhq83` | Monthly | `price_1UB3dFBjRpasql4r2g7pAdJr` | 2,500 | `eos_recovery_standard_monthly_v1` |

The products have no default price. Monthly prices use interval `month`, count `1`, licensed usage. Tax behavior is `unspecified`: this is not a declaration that the service is tax-exempt, and automatic tax has not been enabled. Resolve actual tax treatment before collection.

## Credential and webhook configuration

- Approved restricted key and signing secret are held in 1Password `EntrepreneurOS / Production`, then installed in the exact-binding maps `EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS` and `EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS` in Fly app `eos-app`.
- Runtime checks verified the exact merchant and vault/runtime matches without exposing the values.
- `EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false` remains explicit.
- Webhook: `we_1UB3LmBjRpasql4rv1NO8hkO`, initially disabled and subsequently enabled on 2026-09-02.
- URL: `https://entrepreneuros.net/api/eos/recovery-provider-webhooks/stripe/fd3ecfba-55f6-5f8b-a5d4-a31e09c3ea67`.
- Snapshot payload, own account, API version `2026-08-26.dahlia`.
- Events: checkout.session.async_payment_failed, checkout.session.async_payment_succeeded, checkout.session.completed, payment_intent.payment_failed, payment_intent.succeeded, customer.subscription.created, customer.subscription.deleted, customer.subscription.updated, invoice.paid, invoice.payment_failed, charge.dispute.created, charge.refunded, refund.created.

## EOS state and implementation boundary

Production binding configuration advanced from version 4 to 5. It now contains the merchant/admin reference, operation schemas, event subscriptions, permission contract, timing budget and recovery/cost descriptions. Those descriptions are configuration contracts, not measured latency or verified delivery evidence.

Production still reports `implementing`, connection `unconfigured`, parity `not_tested`. Three activation requirements remain: connected provider state, fresh healthy observation, and verified supporting evidence. Commercial activation also requires applicable parity and commercial agreement/billing gates. Do not substitute this document for a genuine provider delivery receipt.

The production Commercial view has no Recovery diagnostics or commitments yet. No fictional client was created merely to store price IDs; attach the appropriate exact pair above to a real authorized client's billing manifest when that workflow exists.

Local implementation adds `server/integrations/stripe-health.ts` and connects it to the existing integration-health-observation route. It:

- Selects only the exact binding's restricted live key; never borrows another company's credential or a global key.
- Reads the authenticated merchant, requires exact account identity, and checks charges/payouts availability plus binding-specific webhook-secret configuration.
- Uses a bounded request with no automatic retries and redacts provider error details.
- Does not execute payments, enable effects, prove webhook delivery, or bypass tenant, evidence, parity or activation gates.

This new health verifier has **not been deployed**. The existing production image remains `git:6681e2ee10ab3c4d5521e7381f429589a8aa8a38`, digest `sha256:2ab7a322efb005fab334245d080ee41c4782b1b29d02a1f3f9843a9ffe411a46`. The worktree contains other pending changes; a secrets-only update is not a code release.

The new verifier was also run locally against the real historical merchant using the approved 1Password CLI credential, held only in process memory. It returned `connected: true`, `healthy: true`, `reason: ready`, `deliveryVerified: false`, `paymentEffectsEnabled: false` and the exact expected merchant reference. This is a read-only live identity/configuration check, not a deployed EOS health observation or payment test.

### Validation completed

- `npm run check`: passed.
- Focused unit tests: 25 Stripe connection-health tests and 3 commercial-activation tests passed.
- HTTP integration tests: the new Stripe health lifecycle and existing Systems inventory-to-qualified-automation lifecycle passed against a fresh disposable local PostgreSQL database with the baseline and all 114 checksum migrations applied. The other 61 lifecycle tests were intentionally not selected for this focused run.
- The new route test verifies server-owned health, exact binding, rejection of empty/unverified evidence, preserved activation/parity requirements, and cross-tenant denial.
- Read-only real-merchant verification passed as described above. Prices were reread and remained inactive.
- The production code release, protected CI for these changes, signed provider delivery and customer payment path are **not** qualified by these local checks.

## Remaining activation work

1. Qualify and deploy the health verifier through the protected release process, preserving other pending work.
2. Record a truthful, narrowly scoped identity/configuration health observation backed by verified evidence.
3. Complete controlled adapter/parity and commercial-flow qualification, including rejected/duplicate/failed events, without real customer effects.
4. Resolve tax treatment, receipt/statement details, payment-method policy, cancellation authority and the exact authorized client billing manifest.
5. Activate only after the applicable gates and explicit live-execution approval; enable the endpoint at the appropriate qualified stage and verify genuine signed delivery and exact reconciliation. A live health read alone is not end-to-end proof.
