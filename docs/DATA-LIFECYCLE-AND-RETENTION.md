# EntrepreneurOS Data Lifecycle and Retention Boundary

## Purpose

This document distinguishes implemented lifecycle behavior from policy decisions that require legal, privacy, tax, security, and operational approval. It intentionally does not invent retention periods.

## Implemented account lifecycle

1. An authenticated person requests personal-account deletion using an exact confirmation phrase.
2. EntrepreneurOS schedules the request after a configurable one-to-thirty-day cooling-off period; the current default is seven days.
3. The person may cancel while the request is scheduled.
4. If owned portfolios or companies remain, execution stops until ownership is transferred. Personal-account deletion never silently destroys organization evidence.
5. Before erasure, EntrepreneurOS asks each connected provider to revoke the person's external authorization. An unavailable or unconfirmed provider revocation fails closed and preserves the local credential so operations can retry safely; deleting only the local token would orphan a potentially live external grant.
6. In production, identity-provider deletion must be available; otherwise execution fails closed for operations review.
7. After provider and identity revocation succeed, execution removes personal working data and provider credentials, releases hybrid-role seats, detaches communication authorship, and anonymizes the remaining principal.
8. Immutable operational evidence retains only its reference to that anonymized principal.

## Erased or detached at execution

- CRM contacts, deals, and activities owned by the person
- personal folders and documents
- notifications and AI conversation messages
- encrypted OAuth/provider tokens
- support tickets and personal agent actions
- EOS organization memberships and UMH identity bindings
- seat occupancy and direct communication sender identity
- Clerk identity binding and the person's name, email, avatar, company, role, preferences, profile metadata, and usable credential

## Retained as non-identifying evidence

Legal acceptances, audit events, approvals, consequential provider receipts, and AI cost records are not silently deleted because doing so would destroy compliance and operational evidence. They remain linked to a randomized, unusable principal whose profile and provider identity have been removed. The deletion request retains status and execution evidence without retaining the Clerk identifier.

## Required policy decisions before public launch

- legal basis and exact retention period for each retained evidence class
- tax and payment-record obligations, including Stripe's independent retention behavior
- litigation, regulatory, fraud, and security hold procedures
- backup retention and verified deletion propagation
- organization-transfer and organization-deletion policy
- inactive-account, failed-payment, support-record, analytics, and log retention
- data residency, subprocessors, cross-border transfer, and customer contract commitments
- who may approve exceptions and how expiry is audited

Those decisions must be published as versioned policy, reviewed by the appropriate professionals, mapped to database/provider controls, and proven through a production `data_lifecycle_drill`. The managed-development drill proves code mechanics only; it is not professional or production approval.
