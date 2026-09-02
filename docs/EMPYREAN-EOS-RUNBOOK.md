# Empyrean Studios on EntrepreneurOS — operator runbook

**Purpose:** run Empyrean Creative LLC, publicly operating as Empyrean Studios, through the EOS overlay without confusing product identity, legal entity, provider truth, or approval authority.

**Snapshot:** 2026-09-02. The production observation is read-only and partial; it is not a substitute for provider receipts or professional review.

## What is ready in EOS

- The Empyrean reference instance, Recovery System offer, company CEO seat, shared-service boundaries, work packets, evidence model, approval controls, and role-scoped surfaces are compiled in EOS.
- The Systems workspace declares the seven required provider bindings: GoHighLevel, historical Stripe, DocuSign, Google Workspace, Notion, QuickBooks Online, and Slack.
- QuickBooks is represented as the authoritative accounting ledger projection; EOS must not become the ledger by implication.
- Slack is represented as the internal communications and decision-capture projection; decisions still belong in Notion and files in Drive.
- Google Workspace and Notion have healthy production-level connection evidence in the external inventory.
- The historical Empyrean merchant is `acct_1LekouBjRpasql4r`; the duplicate EntrepreneurOS Stripe account was closed. EOS recovery/payment effects remain disabled until the governed rehearsal passes.

## Current production gate

Production is healthy at `https://entrepreneuros.net`, but it is running an older release and has one concrete schema gap: the source has 116 known migrations while production has applied 115. Release candidate commit `cdd96cd96261ec8c2e0fa9028d9d844912e6afd5` contains migration `0114_add_quickbooks_provider_checkpoint.sql` and must pass the configured protected release process before the new provider checkpoint can be used in production.

## Required activation sequence

1. **Release the committed source.** Merge or promote the release candidate through the configured `feature/company-system` protected workflow. The release script must apply the pending migration, verify the runtime role, and preserve the existing immutable rollback image. Do not bypass the fresh Clerk smoke credential, release-specific secret cutover phrase, or production promotion evidence.
2. **Compile and inspect Empyrean.** Open company `1`, confirm the legal name is Empyrean Creative LLC and the operating name is Empyrean Studios, and verify the founder/company-CEO role visibility before adding team seats.
3. **Configure exact provider bindings in Systems.** For each binding record the non-secret account/resource reference, administrator and recovery owner, exact scope, native permissions, secret-manager reference, allowed operations, fallback, recovery path, and verified Evidence. A binding is not active merely because its card exists.
4. **Resolve provider-specific identity.**
   - GoHighLevel: exact location and behavioral test path.
   - Stripe: historical `acct_1LekouBjRpasql4r`, legal holder, live mode, payout/event behavior, and the approved Recovery price pair.
   - DocuSign: exact workspace, template, sender authority, and event behavior.
   - Google Workspace: operational mailbox and kickoff calendar.
   - Notion: canonical EOS workspace/page sharing for current operating intent.
   - QuickBooks Online: exact company file/entity, administrator/recovery owner, chart of accounts, bank and Stripe feeds, tax configuration, close state, and reconciliation behavior. The latest Notion lookup marked this unresolved.
   - Slack: `empyreanstudiosgroup.slack.com`, app identity, channel scope (`#general`, `#marketing`, `#sales`, `#operations`, and approved client channels), permission grant, and recovery owner.
5. **Qualify the operating agreement.** Reconcile the Recovery System price, guarantee measurement window, refund/cancellation authority, contracting entity, signatory, and sequence into one operative agreement; complete qualified legal/privacy/tax/accounting review where applicable.
6. **Run Client Zero without customer effects.** Execute the synthetic payment-to-closeout rehearsal, including success, decline, duplicate, delayed, revoked, failed, rollback, and recovery paths. Capture provider receipts, reconciliation evidence, and the approval decision in EOS.
7. **Enable only the qualified effects.** Keep `EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false` and `EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED=false` until the exact merchant, credentials, prices, receipts, rollback, and approval gates are satisfied. Then enable only the approved path and verify signed delivery plus EOS reconciliation.
8. **Operate the first real client.** Create the authorized stakeholder, commercial case, exact billing manifest, onboarding Work Packet, and role assignments. Route founder communication to the named Executive Assistant; preserve company hierarchy for all other seats; review every consequential external effect in the approval HUD.

## Definition of runnable

Empyrean is runnable through EOS when the release migration is applied, every required provider binding is exact and healthy, the Recovery agreement and professional gates are satisfied, the synthetic rehearsal has durable evidence, provider effects are explicitly approved, and the first client lifecycle can be traced from qualified demand through signed agreement, payment, delivery, reconciliation, and closeout without an unresolved activation blocker.

Until then, EOS is intentionally useful in overlay mode: it can coordinate work, approvals, evidence, provider links, and manual fallbacks without claiming that an unverified provider action happened.
