# EOS Overlay MVP to Native End-State Blueprint

**Status:** Canonical implementation blueprint
**Version:** 1.1
**Prepared:** 2026-08-11
**Scope:** EntrepreneurOS product, overlay MVP, hybrid migration, native EOS, and UMH boundary

## 1. Executive decision

EOS should be delivered as one product through three implementation states:

1. **Overlay MVP:** EOS provides the unified interface, organizational model, context, guidance, approvals, work coordination, evidence, and integration control plane. Existing providers remain authoritative for most external records and effects.
2. **Hybrid EOS:** EOS progressively owns high-value organizational state and workflows while providers remain specialist systems and execution rails.
3. **Native EOS:** EOS becomes the authoritative multi-tenant organizational operating system. Providers are replaceable adapters for specialist capabilities; UMH remains the governed intelligence and orchestration substrate.

The overlay is therefore not a temporary mockup. It is the first deployment mode of the final product architecture. The same identities, canonical object IDs, authority model, lifecycle semantics, Work Packets, events, evidence, navigation, and acceptance contracts must survive provider replacement.

## 2. Product definition

EOS is a universal organizational operating system and enterprise digital twin. It helps a principal compile, operate, improve, transfer, and reproduce one or more organizations through a single governed product.

EOS must:

- model portfolios, operating organizations, legal entities, brands, ventures, programs, funds, projects, locations, and shared-service relationships without conflating them;
- turn intent and current reality into a versioned Organization Manifest;
- expose role-specific command, work, review, learning, and evidence experiences;
- coordinate humans, agents, teams, providers, automations, and hybrid operators;
- preserve explicit authority, consent, approval, data classification, source ownership, and effective time;
- connect the full stakeholder-to-commitment-to-delivery-to-outcome loop;
- learn from observed evidence without allowing live instances to silently mutate shared templates;
- remain useful as a standalone product when UMH or any external integration is unavailable.

EOS is not a generic CRM, task manager, AI chat shell, automation builder, accounting ledger, or collection of department apps. Those are capabilities or views inside the larger organizational runtime.

## 3. Non-negotiable product laws

1. **One semantic definition per canonical object.** A module or provider may project an object but cannot redefine it.
2. **Universal beneath, specific at the surface.** Domain packs change language, defaults, workflows, controls, and UI—not the kernel invariants.
3. **One product, one principal identity, many isolated portfolios and organizations.** Membership in one context never grants access to another.
4. **Templates are not instances.** Reusable packages contain definitions; tenant instances contain live state.
5. **State, event, evidence, projection, and observed reality remain distinct.** A plan is not an outcome; a provider sync is not automatically verified truth.
6. **Capability is not department.** Capabilities persist through reorganizations; departments are optional accountability groupings.
7. **Role, seat, assignment, agent, tool possession, and authority are distinct.** None implies another.
8. **Every consequential effect is attributable.** The initiating principal, delegated actor, policy, approval, adapter, external result, evidence, and outcome remain traceable.
9. **Default deny under ambiguity.** Missing tenant, purpose, authority, consent, or classification blocks protected work.
10. **Overlay and native behavior share contracts.** Native replacement may improve implementation but cannot silently reinterpret the product.
11. **External tools are borrowed capability.** Each has an authoritative scope, failure mode, fallback, native target, parity test, and replacement trigger.
12. **Operating-game surfaces are experience projections.** They simplify navigation and learning but never become a competing source of truth or authority system.

## 4. System ownership boundary

| Layer | Owns | Does not own |
|---|---|---|
| EOS | Organizational semantics, portfolios, organization graph, capabilities, roles/seats, assignments, business lifecycle, policies, local approvals, product surfaces, domain state and read models | General-purpose model routing, universal agent runtime, provider-native truth outside an approved cutover |
| UMH | Governed intelligence, planning, Work Packet orchestration, tool selection, policy evaluation, execution context, memory, evidence transport, reconciliation, agent runtime | Business-specific CRM, company, role, offer, engagement, finance, or workforce semantics |
| Provider systems | Designated object/field truth and specialist effects such as identity, email, calendar, CRM, signing, payment, accounting, payroll, files, communications, publishing, and banking | EOS-wide semantics, cross-system governance, or implicit authority |
| Notion/manual runtime | Current product canon, templates, manual queues, prototype workflows, reference instances, and migration-grade behavior | Production tenancy, secrets, cryptographic enforcement, transaction guarantees, immutable events, or reliable scheduling |
| Native EOS | Hardened implementation of validated EOS contracts | Reinterpreting canonical behavior during implementation |

## 5. Delivery-state architecture

### 5.1 State A — Overlay MVP

EOS owns:

- authentication session and selected portfolio/organization context;
- the canonical organization manifest and provider-binding metadata;
- navigation, dashboards, command surfaces, Mission Board, review, approvals, and evidence index;
- local tasks/Work Packet projections, decisions, issues, commitments, risks, and exception state;
- integration catalog, entitlement metadata, health, sync cursors, source links, and reconciliation state;
- agent proposals and local authority decisions;
- a durable event/outbox/audit layer;
- derived cross-provider read models.

Providers own:

- their native records until field-level cutover is explicitly approved;
- authentication and native permission at their boundary;
- external effects and provider audit state;
- regulated or ledger truth such as settled payments, bank state, accounting, payroll, and executed signatures.

Overlay rules:

- store provider IDs and deep links, not uncontrolled copies;
- mirror only the fields needed for EOS context, workflow, analytics, or resilience;
- identify each field as `EOS`, `Provider`, `Derived`, `Manual`, or `Unresolved` authority;
- perform external mutations through adapters and governed actions, never direct database access;
- show stale, failed, pending, conflicting, and last-verified states in the UI;
- maintain a manual fallback for every critical connected workflow;
- never store provider secrets in ordinary product tables or expose them to agents.

### 5.2 State B — Hybrid EOS

EOS progressively gains native ownership of:

- organization graph, memberships, roles, seats, assignments, authority, objectives, policies, Work Packets, decisions, evidence, and lifecycle state;
- organization compilation, package installation, local overrides, versioning, and rollback;
- workflow state and approval orchestration;
- internal tasks, operating cadence, issue/decision registers, scorecards, and reporting;
- selective CRM, onboarding, fulfillment, customer-success, product, and system-control records where parity is proven.

Providers remain adapters for specialist or legally authoritative functions. Data may be linked, mirrored, synchronized, or natively owned at field level; ownership cannot be assigned only at “integration” level.

### 5.3 State C — Native EOS

Native EOS contains:

- hardened identity/tenant context resolution;
- canonical organizational graph and temporal state services;
- compiler and package installation runtime;
- authority/policy decision point and approval engine;
- Work Packet, workflow, event, evidence, decision, risk, obligation, metric, and outcome services;
- role-agent provisioning and role-specific product surfaces;
- adapter runtime, secret references, event ingestion, reconciliation, retries, dead letters, and provider parity controls;
- operational read models, search, reporting, simulation, learning, and change-proposal governance;
- mobile, responsive, notification, voice, and named Executive Assistant command experiences where qualified.

## 6. Overlay MVP experience architecture

The implementation-level visual and shell authority is `docs/EOS-UI-LAYOUT-AND-DESIGN.md`, reconciled from the current Notion UI architecture and `.planning/design-system.md`.

### 6.1 Persistent application shell

- **Global identity bar:** the current portfolio and organization names on the left when selected; notifications and a single account control on the right. Portfolio and organization switching live in the account panel rather than the operating navigation.
- **Left navigation:** EntrepreneurOS identity plus the role-compiled operating surfaces: Home, Command, Organization, My Role, Modules, Commercial, Operations, Work Room, Review Room, Academy, Portfolio Map, dormant Capital & Investor Relations, Intelligence, and Systems where authorized.
- **Floating decision HUD:** current assistant, open work, approvals, next action, and controlled decision shortcuts float above the workspace without obscuring its page heading.
- **Context header:** the page title, concise action-oriented description, and compact square page action; role, lifecycle, authority, sync health, and source freshness appear inside the relevant workspace rather than as decorative nesting under the global bar.
- **Workspace:** the selected operating surface.
- **Right communication rail:** a full-height, compact chat rail for the founder's named Executive Assistant or the active seat's Role Agent assistant, with conversation, explanations, suggested actions, source/evidence links, and pending approvals. On mobile it opens full-width from a movable LyfeOS-style communication FAB.
- **Global command palette:** navigate, inspect, draft, plan, simulate, create Work Packet, request approval, or invoke a connected capability.

### 6.2 Boxed operator experience

These are views over canonical objects, not separate databases:

1. **Start Here:** purpose, operating law, current context, terminology, setup status, first safe action, and escalation route.
2. **Organization/Campaign Compiler:** new/existing organization intake, current-state reconciliation, package selection, proposed manifest, review, approval, provisioning, verification, and activation.
3. **Home / Morning Brief:** cross-company commitments, objectives, issues, risks, approvals, stale integrations, current missions, and next actions.
4. **Character Sheet / My Role:** role, seat, mandate, authority ceiling, tool entitlements, scorecard, learning path, missions, reviewer, and advancement requirements.
5. **Module Control Center:** the fourteen non-dormant business functions filtered to the active seat, each with its honest overlay boundary, exact proof requirement, governed mission entry, operating-surface route, assistant escalation, and safe fallback.
6. **Mission Board:** governed Work Packets with objective, prerequisites, tool pack, authority, evidence, due logic, reviewer, stop conditions, and resulting state changes.
7. **Command Center:** objectives, metrics, constraints, issues, decisions, commitments, approvals, simulations, and operating cadence.
8. **Work Room:** the active Work Packet, required method, supporting records, provider actions, artifacts, evidence, collaboration, blockers, and handoff.
9. **Review Room:** output/evidence review, approval, rejection, remediation, exception, rollback, and outcome capture.
10. **Academy:** concepts, worked examples, simulations, bounded missions, evidence rubrics, certification, remediation, and next-level rules.
11. **World/Portfolio Map:** authorized portfolios, organization nodes, relationships, lifecycle, shared services, dependencies, risks, and consolidated outcomes.

### 6.3 Role-adaptive presentation

The same underlying system renders different priorities for:

- founder/owner;
- portfolio executive;
- company executive;
- functional leader;
- individual operator;
- reviewer/approver;
- advisor/board observer;
- provider or contractor;
- customer, candidate, vendor, investor, or other external actor;
- Role Agent and specialized Sub-Agent.

Role views may reduce complexity but cannot hide required risks, approvals, obligations, or evidence.

## 7. Complete module scope and migration design

| # | EOS module | Overlay MVP treatment | Native end state | Activation |
|---:|---|---|---|---|
| 1 | Recruiting & Candidate Portal | Internal capability-gap, candidate, assessment, versioned human-review packet, governed paid-trial, placement and onboarding controls plus the secure candidate-link portal, bilateral scheduling, approved invitation/Calendar effects, quarantined binary evidence, browser-local TTS, voice capture, consent-gated STT, and opt-in adaptive follow-up questions are native. Adaptive questions branch from minimized candidate answers and multiple plausible-role hypotheses, stop at five, validate against prohibited topics, and fall back deterministically when AI is unavailable; they collect evidence but never decide employment. The internal-only review packet snapshots the current Person → Evidence → Role Hypotheses → Person × Role × Stage × Team Fit → Proof Gaps → Next Assessment graph, requires verified evidence coverage before review, records attributable human recommendation/sign-off, and may materialize only a separately planned assessment. A trial then tests the largest remaining uncertainty through an approval-linked Work Packet and candidate-visible duration/compensation/support/outputs/scorecard/constraints/review/criteria. Candidate submissions cross into canonical Evidence only through an attributable human promotion that records the supported claim, verifier method, source lineage, and Trial Work Packet; Trial outcomes fail closed before that boundary or on cross-packet evidence. Promoted material remains candidate-withdrawable, which expires the canonical Evidence so it cannot support a later decision. Pass/redirect/extend/fail review and predicted-versus-actual learning remain separate attributable human acts. No promotion or trial action executes payment, creates placement, assigns a seat, changes a template silently, or grants access/authority. Shared production object storage, payment execution, and live scanning/transcription/AI-provider qualification remain open | Native canonical-person continuity, governed lifecycle, candidate projection privacy, consent/correction/deletion controls, assessment and trial security, human decisions, assignment-backed activation, durable object storage, and continuously governed evidence processing | Internal control spine, external portal, local file adapter, optional voice/adaptive paths, human-review, promotion-lineage and paid-trial contracts, and provider contracts implemented locally; database execution and live infrastructure/provider evidence pending |
| 2 | Lead Capture & Marketing Qualification | Ingest consented leads and attribution from connected CRM/forms; qualification, routing, source links | Native lead signal, consent, attribution, qualification, routing, campaign and opportunity creation | Active |
| 3 | Sales Opportunity & Commercial Decision | Unified opportunity view over CRM, communications, offers, proposals, approvals, forecast | Native opportunity lifecycle, communication timeline, offer configuration, approvals, forecast, audit | Active |
| 4 | Contracting & Payment Activation | Native tenant-owned counterparties, immutable clause/template versions, governed PDF generation, role-bound envelopes, signing, delivery, integrity, custody, search, explicit Work Packet Evidence promotion, operational obligation reviews, a company contract control center, approval-bound exact notice delivery through Gmail, immutable portfolio template proposals with company-local accept/reject and draft-only adoption, and governed jurisdiction packs with counsel-attributed publication plus company-local applicability gates are implemented locally. Provider payment paths remain separate and no ledger claim is made | Live qualified-counsel collaboration and independent credential verification, continuous human-supervised term extraction, production Gmail authorization/receipt evidence, and commercial activation while external payment rails remain authoritative | Active |
| 5 | Client Onboarding Portal | Secure intake, checklist, provider links, access requirements, approvals, onboarding Work Packets | Native external identity, scoped portal, intake, access orchestration, onboarding state and evidence | Active |
| 6 | Fulfillment & Work Delivery | Work Packet coordination around connected project/docs/files systems; deliverable review and change requests | Native workflow/capacity/deliverable/issue/evidence runtime with provider adapters | Active |
| 7 | Customer Success, Reporting & Renewal | Native, role-scoped customer-success control center over canonical Stakeholders and customer Relationships: deterministic Evidence-backed health reviews, immutable outcome definitions with bounded attribution and governed progress, issue ownership and resolution, exact report snapshots, separate proof consent, founder approval, external delivery-receipt reconciliation, renewal-readiness decisions, optimistic concurrency, chained events, audit and tenant/hierarchy/classification boundaries. EOS never treats report preparation as delivery or a renewal-readiness decision as contract execution | Native health, outcomes, attribution, reporting, renewal and consented-proof operations with qualified live CRM/mail/portal adapters, customer identity and consent verification, field outcome evidence, contract/payment reconciliation and real customer acceptance | Partial |
| 8 | Executive Command & Operating Cadence | Morning brief, objectives, metrics, issues, decisions, commitments, approvals, review packets | Native event-driven command, decision, meeting/cadence, cross-company read models | Active |
| 9 | Finance Control & Commercial Events | Provider-backed invoice/payment/accounting summaries, budget requests, approvals, reconciliation status | Native financial-event/control projection; accounting/bank/payroll remain authoritative rails unless separately qualified | Partial |
| 10 | Operations, Administration & Vendor Control | Requests, vendors, assets, access, obligations, recurring work, provider/system links | Native procurement, vendor, asset, access, service and administration workflows with immutable evidence | Active |
| 11 | Product, Offer & Template Evolution | Native, role-scoped evolution control center rooted in canonical Offers/Programs: immutable Evidence-backed feedback, frozen baseline hashes, allowlisted version proposals, compatibility and migration review across workflows/segments/contracts/templates, bounded experiments, authority-labeled observations, human conclusions, release decisions, receipt-backed internal/pilot/limited/general rollout, rollback, founder-only stale-safe canonical apply, chained events and tenant/hierarchy/classification boundaries. Drafts, asserted telemetry and provider references never become released or provider truth by themselves | Native product configuration with qualified live telemetry/deployment adapters, larger controlled cohorts, continuously governed reusable template learning, production migration, authenticated field use and measured real-world outcomes | Partial |
| 12 | Technology, Integrations & Automation Control | Native role-scoped adapter operations control center extending the canonical system/binding catalog: configuration-version-bound capability manifests, schema hashes, idempotent run plans, durable pre-effect dispatch claims, deployment-kill-switched execution through audited Gmail send and Notion verify/search/page-snapshot operations, redacted provider-execution projections, automatic authority-labeled receipts and observations, hash-chained attempts, lease-based stale-dispatch detection, automatic recovery escalation without blind retry, operator-visible Evidence-backed reconciliation, automatic incidents, governed retry, recovery-driven active-incident clearing, fallback/paused/provider traffic modes, parity qualification, founder-controlled native cutover and provider rollback, optimistic concurrency, relational projection integrity, audit, and tenant/hierarchy/classification boundaries. Each binding can also own one encrypted HMAC endpoint with copy-once secret provisioning, bounded grace rotation, revocation/reactivation, declared-event allowlisting, replay protection, durable deduplication, immutable event custody, exact dispatch reconciliation, an unmatched review inbox and secret-redacted projections. Notion HMAC and Gmail Pub/Sub native ingress add exact authority scope, rotation, watch renewal, bounded Gmail history reconciliation, exact-OAuth-workspace Notion page reconciliation, bounded content hashing, append-only per-resource snapshot chains, actionable health, registration-specific service objectives, severity-gated signed escalation, immutable bounded delivery attempts, dead-letter custody, current-alert-only Evidence-backed replay, and one immutable tenant/seat-attributed human acknowledgment per exact current alert without treating observations as execution receipts or suppressing unresolved health. EOS never turns a plan, fixture, manual attestation, timeout, unallowlisted operation, unmatched callback, snapshot, acknowledgment, or UI status into a provider-execution claim | Additional qualified providers and operations, resource-status reconciliation beyond Gmail and Notion pages, field parity evidence, production on-call delivery and field acknowledgment, live rotation drills, and independently exercised provider/native failover for each connected adapter | Partial |
| 13 | Legal Obligations, Rights & Compliance | Native, role-scoped compliance control center with exact versioned source custody, professional-attribution Evidence, company obligation/right/consent/policy/retention/control definitions, dated review ownership, immutable reviews and control tests, optimistic lifecycle state, source supersession, audit, and overdue/ineffective-control attention queues. EOS records claims and preserves lineage without verifying credentials or determining law | Native obligation/right/consent/policy lifecycle and retention with live qualified-specialist collaboration, verified professional identity, authoritative change monitoring, production records, and qualified external-provider integrations | Partial |
| 14 | Brand, Media & Proof Distribution | Creator/provider asset links, claims/evidence, approvals, distribution status and performance summaries | CreatorOS/UMH media graph with EOS business context, rights, authority, attribution and outcomes | Active |
| 15 | Capital & Investor Relations | Architecture and dormant navigation only; no active workflows without trigger | Secure data room, investor relations, instruments, diligence, commitments and reporting | Dormant |
| 16 | M&A Pipeline, Diligence & Integration | Architecture and dormant navigation only | Native acquisition thesis, pipeline, diligence, valuation, decision, agreement, integration and portfolio effects | Dormant |
| 17 | Board & Advisor Governance | Architecture and dormant navigation only | Secure board/advisor portal, conflicts, resolutions, signatures, commitments and entity governance | Dormant |

## 8. Integration and borrowed-capability plane

### 8.1 Required connector contract

Every connector must declare:

- adapter ID, provider, capability and version;
- tenant, portfolio, organization, user/agent, and exact external account/resource binding;
- OAuth/service identity, native permissions, EOS entitlement, and authority ceiling;
- source-of-truth objects and fields;
- supported reads, drafts, writes, approvals, webhooks/events, and reconciliation;
- data classes, retention, regional or contractual restrictions;
- health check, freshness SLA, rate limits, retry policy, idempotency, and dead-letter behavior;
- evidence emitted for each effect;
- manual fallback, revocation owner, incident behavior, and recovery steps;
- native target, parity tests, replacement trigger, migration, and rollback.

### 8.2 MVP connector categories

The overlay needs adapter contracts for these categories even when only a subset is initially connected:

- identity and organization membership;
- email, calendar, chat, meetings, notifications, and telephony;
- CRM, forms, marketing, attribution, and support;
- documents, files, knowledge, e-signature, and secure intake;
- payments, accounting, banking references, expenses, payroll, and financial reporting;
- project/work management and workflow automation;
- recruiting, HRIS, learning, and assessment;
- publishing, content, social, media, and analytics;
- code, deployment, incidents, product analytics, and data systems;
- UMH federation and other product projections.

The current repository has a real Gmail path and placeholder integration records. Every other connector must be labeled `Planned`, `Configured`, `Connected`, `Degraded`, `Revoked`, or `Replaced`; UI presence must never imply working capability.

### 8.3 Field-level source authority

For every synchronized field, store:

- canonical object and field;
- authoritative system;
- external object ID and version/etag where available;
- last observed and last verified times;
- transformation and confidence;
- sync direction;
- conflict policy and resolution owner;
- retention and deletion behavior;
- migration/cutover state.

### 8.4 Migration ladder for each provider capability

1. **Link:** EOS stores context and a provider deep link.
2. **Read:** EOS reads authorized provider state into a labeled projection.
3. **Coordinate:** EOS creates Work Packets, approvals, and evidence around provider work.
4. **Draft:** EOS prepares provider actions but requires human confirmation.
5. **Execute:** EOS invokes approved provider effects and reconciles outcomes.
6. **Shadow native:** native EOS runs in parallel without authoritative writes.
7. **Controlled cutover:** field/object ownership changes behind feature flags after parity.
8. **Native authoritative:** EOS owns the state; provider becomes a rail or optional adapter.
9. **Retire:** data retention, export, rollback window, and provider decommission are completed.

## 9. Organization Compiler MVP

The overlay MVP must support the complete compiler contract even when provisioning is partly manual.

### Inputs

- principal, sponsor, portfolio, purpose, authority, and desired outcome;
- organization/node type, jurisdiction, legal/operating structure, ownership, and governance;
- business/value/funding model, stakeholders, offers/programs, and value flows;
- lifecycle, scale, maturity, binding constraint, objectives, resources, economics, and risk;
- required capabilities and active/dormant/future designation;
- positions, seats, assignments, providers, agents, authority, and succession;
- systems, data classes, authoritative sources, integrations, credentials references, and fallbacks;
- workflows, events, obligations, policies, portals, metrics, evidence, migration, and acceptance.

### Output

A versioned Organization Manifest containing the selected package/component versions, organization graph, memberships, policies, capabilities, workforce, agents, authority, workflows, systems, UI surfaces, integrations, source allocation, migration plan, rollback plan, tests, assumptions, unknowns, and approvals.

### States

`Draft → Diagnostic → Proposed → Review → Approved → Provisioning → Verifying → Active`

Alternate states: `Blocked`, `Rejected`, `Failed`, `Quarantined`, `Rolled Back`, `Superseded`.

### MVP implementation

- guided intake with save/resume;
- import/discovery from authorized providers and Notion;
- explicit `source fact`, `source claim`, `EOS inference`, and `user assertion` labels;
- contradiction and missing-evidence queue;
- package recommendations with applicability/anti-fit explanations;
- generated manifest diff before approval;
- staged provisioning checklist and provider setup links;
- verification suite and activation decision;
- no claim of active state until critical checks pass.

## 10. Canonical domain model

### 10.1 Identity and tenancy

- Principal
- Portfolio
- Portfolio Membership
- Organization Node
- Organization Relationship
- Organization Membership / Access Grant
- Purpose / Session Context
- Data Classification

### 10.2 Organization and capability

- Organization Manifest
- Package / Component / Installation
- Capability Definition and Capability Instance
- Department / Team
- Role / Position Family / Position Agreement
- Seat
- Assignment
- Agent / Role Agent / Sub-Agent
- Tool Pack / Entitlement / Connection
- Authority Grant / Delegation

### 10.3 Strategy and operation

- Mandate / Objective / Constraint
- Policy / Control / Obligation / Risk
- Decision / Approval
- Work Packet / Workflow / Step / Commitment
- Issue / Incident / Exception / Change Request
- Event / Artifact / Evidence
- Metric Definition / Observation / Outcome / Projection
- Meeting / Review / Cadence

### 10.4 Stakeholder and value

- Party / Person / Organization identity
- Relationship and consent
- Offer / Program / Version
- Opportunity / Proposal / Agreement / Engagement
- Value Flow
- Invoice / Payment / Financial Event projection
- Deliverable / Service / Case
- Communication / Campaign / Distribution Event

### 10.5 Systems and evolution

- System / Provider Account / Adapter
- Integration Binding / Sync Cursor / Reconciliation Item
- Credential Reference—not secret value
- Failure / Retry / Dead Letter / Recovery
- Source / Claim / Provenance
- Template Change Proposal / Release / Migration / Rollback

Material objects require canonical ID, tenant context, lifecycle state, valid time, recorded time, version, source authority, visibility, owner, provenance, and supersession behavior.

## 11. Work, action, approval, and evidence runtime

### 11.1 Work Packet minimum contract

- objective and intended outcome;
- portfolio, organization, role/seat, principal, and accountable owner;
- source request, purpose, priority, dependencies, and constraints;
- permitted capability/tool pack and authoritative systems;
- method/SOP version;
- policy, authority ceiling, approvals, consent, and stop conditions;
- required output, artifact, evidence, metric, reviewer, due logic, and escalation;
- execution state, events, attempts, errors, compensation, and outcome.

### 11.2 Action policy

- **Observe:** read authorized state; never mutate.
- **Recommend:** propose options and rationale.
- **Assist:** create internal drafts and Work Packets.
- **Execute bounded internal work:** permitted only by explicit policy and scope.
- **External or consequential effect:** local approval by default.

Email sends, publication, signatures, payments/refunds, destructive changes, provider configuration, authority changes, access grants, sensitive disclosure, legal/compliance conclusions, and irreversible external actions require local authority validation and approval.

### 11.3 Required lifecycle

`Proposed → Policy Evaluated → Awaiting Approval / Authorized → Claimed → Executing → Succeeded / Failed / Compensating → Reconciled → Reviewed`

Rejections, expirations, cancellations, conflicts, retry exhaustion, and partial external success remain explicit terminal or exception states.

### 11.4 Evidence standard

Every consequential action records:

- command/request and immutable digest;
- actor, delegation, policy and authority decision;
- approval request and decision;
- adapter and external account/resource;
- provider request reference, effect reference, and response classification;
- event, artifact, evidence, measured outcome, and reconciliation status;
- trace/correlation IDs and effective timestamps;
- redacted failure information and recovery/compensation state.

## 12. UMH integration contract

EOS must remain independently operable. When UMH is connected:

1. UMH discovers the EOS capability manifest.
2. UMH resolves governed execution context and sends a signed, scoped, idempotent command.
3. EOS validates installation, identity/delegation, portfolio/organization, capability, policy, nonce, expiry, replay, and idempotency.
4. EOS performs the authoritative local state transition or creates a local approval.
5. EOS transactionally records outcome, audit evidence, and outbound event.
6. EOS delivers signed events/outcomes through its outbox.
7. UMH reconciles observed execution and advances the wider Work Packet.

UMH never receives database credentials and never directly mutates EOS tables. EOS never creates a competing general-purpose agent runtime or memory kernel.

## 13. Native technical architecture

### 13.1 Service boundaries

- Experience shell and BFF/API gateway
- Identity, tenancy, context, and authorization service
- Organization graph and temporal registry
- Compiler, packages, manifests, and provisioning
- Capability, role, seat, assignment, agent, and entitlement registry
- Policy, authority, consent, approval, and decision service
- Work Packet, workflow, schedule, and commitment runtime
- Stakeholder, offer, opportunity, engagement, and value-flow modules
- Event, evidence, artifact, metric, outcome, and reconciliation services
- Adapter/integration runtime with secret-manager references
- Read-model, search, reporting, notification, and analytics layer
- UMH federation port

These may begin as modules in one deployable application. Split deployment only when scale, security, ownership, or reliability requires it; preserve contract boundaries from the beginning.

### 13.2 Data architecture

- PostgreSQL as transactional system for native EOS state;
- append-only event/audit records with correction through superseding records;
- transactional inbox/outbox for integrations and federation;
- durable idempotency, replay protection, retries, leases, and dead letters;
- read models for dashboards and role surfaces;
- object storage for artifacts with metadata/evidence records in EOS;
- external secret manager for credentials and rotation;
- search/index layer introduced only when query needs justify it;
- warehouse/analytics plane separated from transactional truth.

### 13.3 API and event principles

- versioned contracts and generated client types;
- explicit tenant/context in protected requests;
- cursor pagination, stable IDs, optimistic concurrency, and idempotent writes;
- field-level authorization and response filtering;
- signed webhook/event ingestion with replay defense;
- problem-detail error contract and stable machine-readable codes;
- no raw provider or internal stack errors returned to clients;
- commands express requested intent; events express immutable facts; outcomes express observed results.

## 14. Security, privacy, and governance requirements

- Clerk/shared identity may authenticate, but EOS must independently authorize portfolio, organization, role, purpose, field, action, and time.
- Every table and query carrying tenant state must be portfolio/organization scoped.
- Deny cross-tenant joins and aggregation unless explicitly authorized.
- Encrypt in transit and at rest; store provider secrets only in a managed secret store.
- Rotate signing/encryption keys and provider credentials; expose key IDs, not private material.
- Apply least privilege, OAuth scope minimization, consent tracking, and revocation.
- Classify fields and derived outputs; derivations inherit source restrictions.
- Provide immutable security/audit events, access review, session revocation, and incident evidence.
- Separate public/external portals from internal operator surfaces.
- Rate-limit authentication, AI, command, webhook, and provider-effect endpoints.
- Support retention, export, deletion, legal hold, and source-system deletion semantics.
- Require qualified human/professional review where legal, tax, accounting, employment, privacy, security, safety, clinical, fund, or regulated decisions are triggered.

## 15. Intelligence and agent design

### 15.1 Executive Assistant and Role Agent responsibilities

- explain current state, sources, uncertainty, authority, and available actions;
- identify constraints, stale state, exceptions, risks, dependencies, and next coherent work;
- draft plans, Work Packets, communications, documents, decisions, and reviews;
- simulate consequences before consequential action;
- route approval and professional-review requirements;
- coordinate connected capabilities through UMH when available;
- collect evidence and reconcile results;
- propose, never silently apply, reusable template changes.

### 15.2 Role Agent contract

Each active Role Agent requires organization, department, titled role/seat, supervisor, owner, operating mode, human counterpart, authority, tool entitlements, data/memory scope, schedule, queue, SOP versions, scorecard, evaluations, monitoring, escalation, fallback, and lifecycle.

One primary Role Agent persists with a seat. Human occupancy changes its mode rather than creating a new institutional identity. Sub-Agents inherit the lowest applicable authority and cannot own the seat, customer relationship, or external identity by implication.

## 16. Analytics, observability, and product learning

The MVP must measure:

- activation funnel from signup through first compiled/connected organization;
- time to first useful brief, first Work Packet, first approved effect, and first reconciled outcome;
- active portfolios/organizations, weekly operators, missions, decisions, approvals, and outcomes;
- connector setup success, freshness, errors, retries, dead letters, and manual fallback use;
- agent proposal acceptance, rejection, edit distance, approval time, execution success, and escalation;
- customer-value loop conversion, cycle time, quality, economics, exception rate, and founder dependence;
- role/seat coverage, authority exceptions, evidence completeness, and review SLA;
- template/package adoption, overrides, rollback, and field evidence.

Operational observability requires structured logs, traces, correlation IDs, metrics, alerting, provider health, queue depth, job latency, failure classification, and user-visible status. Product analytics must never become an undeclared source of organizational truth.

## 17. Non-functional requirements

Provisional MVP targets, to be ratified before release:

- **Availability:** core read/write surfaces remain available when noncritical providers or UMH are unavailable.
- **Performance:** ordinary navigation/read models should feel interactive; provider operations must show asynchronous progress rather than blocking the UI indefinitely.
- **Integrity:** no lost accepted command, approval, event, or provider outcome; all retries are idempotent.
- **Recovery:** documented backup, restore, migration, rollback, and adapter-revocation procedures; recovery tests before pre-live promotion.
- **Accessibility:** keyboard navigation, semantic structure, labels, contrast, focus handling, reduced motion, and screen-reader acceptance for critical workflows.
- **Responsive operation:** desktop-first command surfaces, usable tablet/mobile triage and approvals, with native mobile/voice introduced only under a qualified contract.
- **Internationalization:** stable IDs/enums separate from display vocabulary; time zone, locale, currency, and date handling are explicit.
- **Change safety:** feature flags, versioned schemas, compatibility tests, progressive rollout, and rollback for every native replacement.

## 18. MVP release plan

### Wave 0 — foundation and truth

- resolve Clerk/local identity and one principal/many portfolio tenancy;
- enforce organization scope on every legacy resource and route;
- remove the generic global-agent, direct-model, user-supplied-key, and generic assistant communication runtime; retain stable tombstones so stale clients fail closed and point to the company-scoped Executive Assistant/Role-Agent channel;
- establish canonical IDs, source authority, classifications, temporal/version fields, audit, inbox/outbox, and error contracts;
- remove placeholder integrations that imply functionality;
- establish migration registry and authoritative schema/migration process;
- restore clean type checking, reliable unit/integration tests, CI, observability, and deployment proof.

### Wave 1 — boxed entry and command

- Start Here, context switchers, organization compiler intake, manifest proposal/review;
- Home/Morning Brief, Character Sheet, Mission Board, Command Center, Work Room, Review Room;
- objectives, metrics, issues, decisions, commitments, risks, Work Packets, approvals, evidence;
- Gmail and UMH bridge hardened as reference adapters;
- integration directory, entitlement, health, and manual fallback.

### Wave 2 — customer value spine

- lead/qualification → opportunity → offer → agreement/payment request → onboarding → fulfillment → reporting/renewal;
- connect selected provider paths behind the common adapter/action/evidence contract;
- run controlled fixtures including denial, failure, duplicate delivery, revocation, stale data, partial success, rollback, and recovery.

### Wave 3 — workforce and management spine

- organization chart, capabilities, position/seat/assignment model, Role Agents, recruiting, onboarding, tool entitlement, operating cadence, scorecards, review, promotion/succession;
- compile every meaningful seat responsibility into an explicit Assist, Teach, Guard, or Transfer support plan with retained human ownership, proof, review, and a separate governed assignment/Authority Grant path for any real transfer;
- expose an employee-visible career and mobility path from the current seat to plausible specialist, management, leadership, lateral, or cross-functional roles, while keeping aspiration, capability evidence, business need, seat availability, compensation, assignment, and authority as separate governed dimensions;
- validate agent-vacant, human-occupied, provider-led, transition, suspension, and exit states.

### Wave 4 — full non-dormant reference instance

- the overlay module control center establishes enterable, role-permissioned mission and fallback paths for all 14 non-dormant modules without claiming provider activation;
- activate and dry-run qualify all 14 non-dormant modules;
- exact accounts, owners, permissions, recovery owners, external/internal actor surfaces, fixtures, fallbacks, and integrated whole-business rehearsal;
- no open critical/high activation defect and explicit owner release decision.

### Wave 5 — animation and evidence

- run one real customer/value-delivery loop with provider-backed events, evidence, economics, exceptions, and template-learning proposals;
- repeat with lower founder dependence;
- certify bounded operator ownership;
- reproduce in a second context before claiming field proof.

### Wave 6 — progressive native replacement

Replace in this order:

1. identity/tenant/context enforcement;
2. canonical objects and events;
3. authority, policy, approval, and audit;
4. Work Packet/lifecycle runtime;
5. adapter, secret, retry, reconciliation, and observability plane;
6. Role Agents and scheduled/event-driven work;
7. evidence, evaluations, and learning;
8. organization compiler and package installation;
9. Executive Assistant command, mobile, and voice;
10. migration, rollback, security, and parity qualification.

## 19. Acceptance and promotion gates

### Overlay MVP complete

- a new authorized principal can create/select a portfolio and compile an organization without founder walkthrough;
- the selected portfolio/organization is explicit on every protected surface;
- the principal sees the correct role, authority, tools, objectives, and next Work Packet;
- every non-dormant module available to the principal is enterable and can initiate governed work, open its operating surface, or use the role-correct assistant and documented fallback;
- one complete customer-value fixture crosses connected providers with attributable approvals, evidence, failures, and reconciliation;
- every enabled integration has exact account scope, health, fallback, revocation, source authority, and replacement trigger;
- critical operations survive provider/UMH outage through queued or manual fallback;
- no cross-tenant leakage, unauthenticated business route, plaintext secret exposure, or unscoped agent action remains;
- build, type check, migrations, unit/integration tests, security tests, backup/restore, and deployment smoke tests pass;
- the product never represents mapped, configured, connected, pre-live, animated, field-tested, or native as equivalent states.

### Reference instance pre-live qualified

- all 14 non-dormant modules are enterable, configured, connected or fallback-capable, permissioned, recoverable, and dry-run qualified;
- synthetic customer, workforce, vendor, and shared-service rehearsals pass, including denial and rollback;
- no hidden reconstruction or unresolved critical/high defect remains;
- release is accepted by the owner with residual risk recorded.

### Native module cutover

- canonical and field ownership are explicit;
- shadow-mode output matches or intentionally supersedes the provider/manual behavior;
- security, tenancy, policy, lifecycle, events, evidence, performance, observability, migration, rollback, and operational tests pass;
- data is reconciled, cutover is feature-flagged, rollback is tested, and provider retention/decommission is documented;
- a critical parity failure blocks promotion.

### Native EOS complete

- production software enforces the validated contracts for identity, tenancy, graph, authority, work, events, evidence, integrations, agents, compiler, UI, security, observability, migration, and rollback;
- at least one complete loop is repeatable with materially reduced founder dependence;
- a qualified operator sustains it;
- a materially different second instance reproduces bounded parity;
- field-proven claims are supported by repeated independent evidence, not architecture or successful builds alone.

## 20. Current repository implications

The gap list originally recorded here has been superseded by the 2026-08-26
native-runtime closure. The repository now enforces tenant/company scope,
authentication, ownership, hierarchy and classification across canonical work,
approval, Evidence, communication, integration, agent, advisor, compiler and
stakeholder operations. OAuth/provider credentials are encrypted or referenced
through managed-secret identifiers, and the canonical shell contains the
role-adaptive module surfaces rather than parallel page families.

The current repository-controlled boundary includes the twenty-part native
handoff registry, versioned company package lifecycle and credential-free
replication, durable workflow/skill execution, activation-policy-bound scheduled
and event Role Agents, the complete fifteen-advisor council, operating-game
controls, institutional reality/scenario/postmortem/learning memory, dormant-safe
external stakeholder portals, and the EOS-owned signed/idempotent UMH adapter
boundary. The exact local qualification is recorded in
`EOS-NATIVE-END-STATE-AUTONOMOUS-CLOSURE.md`.

What remains is not another unimplemented repository wave. Native completion in
the sense defined at lines 594-600 still requires production identity and
providers, independent reviews, named operators, an exact deployed release,
real Empyrean Client Zero execution, a live UMH round trip if enabled, a
materially different real second instance, and repeated field Evidence. Those
outcomes must not be inferred from local architecture or tests.

### Empyrean Studios reference-instance compiler — 2026-08-22

The first explicit company package is now available as an idempotent, founder-authorized compiler for `ORG-EMPYREAN-STUDIOS`. The current operating name is **Empyrean Studios**; historical “Empyrean Creative” naming is normalized during compilation. The package installs the founding accountability chart, persistent Role Agents and human-assistant pairings, 15-advisor council, Recovery System validation spine, AFM cross-company shared-service relationship, command objectives/metrics/risks, capabilities and mapped process, four initial Work Packets, provider-system inventory, selected but unconfigured adapter bindings, a pending founder commercial-canon approval, and an attributable audit receipt.

The compiler deliberately does not choose a disputed Recovery price, invent customers or provider accounts, store credential material, place AFM inside the Empyrean reporting hierarchy, execute external effects, or mark the organization active. Activation remains blocked until the owner stamps one commercial canon; exact GoHighLevel, Stripe, DocuSign, Google Workspace, and Notion accounts and authority are bound; legal/commercial review is recorded; controlled provider fixtures and failure/recovery paths pass; and the first end-to-end Recovery cycle produces verified evidence.

#### Generic company-compilation engine — 2026-08-22

Empyrean now enters the runtime through the first catalog-driven company-compilation engine rather than through a UI-only company-name branch. Shared contracts define all thirteen canonical compiler input classes, required artifact metadata, `DomainPack`, `CompanyPackage`, and `CompiledCompanyInstance`. Validation fails before commit on schema defects, cross-organization artifact scope, package identity/version mismatch, unresolved source authority, ambiguous source precedence, missing external-client authority, invalid reporting parents, or an activation request that exceeds open gates. Provider declarations accept secret-manager references only and the Empyrean package contains no account or credential value.

The founder-only package catalog exposes only packages whose explicit company aliases match the selected organization. The generic compile route requires the package key plus an exact organization-key confirmation, executes inside one transaction, validates the compiled output and provenance graph before commit, remains idempotent, and preserves the previous Empyrean endpoint as a compatibility alias. The Organization Compiler renders packages from the catalog, so later isolated packages do not require another hardcoded company card. Empyrean produces 14 required and three dormant capability declarations, five selected/unbound provider declarations, a source-package graph, output-to-source provenance, and `externalEffectsExecuted: false`.

#### Governed Notion sources and AFM company package — 2026-08-22

The next compiler phase is now repository-implemented. A per-user Notion OAuth adapter can read only an exact package-declared page identity, traverse a bounded block tree, retain the canonical last-edited revision, and return a 50,000-character-maximum reference snapshot with page class, organization scope, classification, capture time, truncation state, and a canonical SHA-256 envelope hash. Bindings are founder-visible, explicitly ordered, freshness-bounded, and `reference_only`. Validation fails closed on organization or page drift, stale revisions, hash mismatch, credential-shaped content, undeclared sources, or provider failure. The adapter performs no Notion writes and cannot activate an organization or overwrite native EOS truth.

`ORG-AFM` is the second isolated company package and the first package using the reusable declarative materializer. It preserves Antony the person, AFM the operating company, `BRAND-AFM`, Empyrean Studios, and Lyfe Institute as distinct objects. The current named Phase-1 accountability chart supersedes its historical minimal lineage: Founder / Chief Executive Officer & Principal Creator, Executive Assistant I, Creator Operations Coordinator I, Content Strategist I, Associate Content Producer, Assistant Video Editor, and Social Media Coordinator I, with the AFM CEO Agent and each persistent Role Agent respecting the internal hierarchy. Empyrean shared services cross through governed company-to-company Work Packets and never create cross-company agent parents.

The package installs eleven evidence-gated capabilities, two artifact-complete/review-state process definitions, five content-lifecycle Work Packets plus one governed Empyrean service-request packet, the active but provider-independent `BRAND-AFM` asset, proof/rights/Brand/data contracts, three defined scorecards with no actual measurements, two assigned failure controls, and the explicit AFM beneficiary/Empyrean provider relationship. Five provider declarations for Notion, Google Drive, CreatorOS, publication channels, and Empyrean shared services remain selected and unconfigured. The content and shared-service Work Packets link to their exact capability and process records; Command, Operations, and Commercial expose the compiled records through their normal role-filtered projections. This materialization does not invent a legal entity, channel account, credential, publication, provider acceptance, audience result, revenue, or field proof. Activation remains blocked until the exact entity and provider authority are bound, one real asset traverses the lifecycle, publication and measurement receipts are captured, and the AFM-to-Empyrean service boundary is controlled-test qualified.

The source boundary now declares seven exact Notion pages. The Brand/channel instrument governs `BRAND-AFM` without treating a Brand asset as proof of a configured channel. The AFM→Empyrean production SOP defines request, independent provider acceptance, execution within Empyrean, evidence return, and explicit AFM acceptance/rejection/bounded rework; it prohibits a cross-company reporting line or direct agent command. Those two contracts are materialized as local EOS operating records, while Notion remains reference-only and no provider effect is executed during compilation.

#### Controlled AFM→Empyrean shared-service runtime — 2026-08-22

The SOP now has a native, append-only engagement lifecycle rather than a descriptive placeholder: awaiting AFM approval → Empyrean review → clarification or independent provider acceptance/rejection → Empyrean-local work → evidence-bearing delivery → AFM acceptance/rejection/bounded rework. Rework returns only the Empyrean-local Work Packet to execution; it does not rewrite scope, hierarchy, provider facts, or AFM authority. Final acceptance or rejection requires AFM review Evidence plus explicit cost/capacity and outcome attribution.

Provider eligibility is exact and fail-closed. Both companies must share a portfolio, each must have a compiled canonical organization key, AFM must hold an active visible stakeholder relationship whose identity is exactly `eos-org:<provider-organization-key>`, and that key must resolve to one—and only one—compiled company in the portfolio. Duplicate organization instances are not presented as candidates and cannot receive a request.

The Commercial workspace renders the complete operator control. AFM can create and approve requests, answer bounded clarification, verify its review Evidence, and decide disposition; Empyrean can clarify, accept/reject, start its own work, verify delivery Evidence, and deliver. Each company sees the other side's Evidence count but never its Evidence identifiers. The event sequence and audit trail remain durable while Seats, Assignments, Authority Grants, provider executions, and `externalEffectsExecuted` remain unchanged. This qualifies the repository-controlled rehearsal path only; real staffing, capacity, transfer pricing, production assets, provider authorization, publication, and outcome evidence remain field gates.

#### Pre-live customer-value cycle — 2026-08-22

Wave 1 now has a native pre-live orchestration record instead of only a descriptive Recovery rehearsal Work Packet. The Customer Value Cycle references the canonical party, relationship, offer, commercial case, Work Packet, approval, and Evidence registries, so it proves continuity without duplicating a customer, offer, commitment, or provider fact. Its first release is deliberately limited to `prelive_fixture` mode and the `TEST-PRELIVE-` namespace; the database enforces the `Synthetic / Non-Production` label, exclusion from real metrics, and zero external effects.

The governed path is commercial approval or rejection → agreement/payment-readiness fixture → onboarding → delivery → reporting → renewal review → renewal or closeout. Agreement/payment readiness is a rehearsal assertion only and never creates an invoice, payment, signature, revenue, or external provider event. Every transition requires verified Evidence from the cycle's own Work Packet. Operators can deliberately inject a failure; the cycle then blocks in `recovery_required` until a separate verified restored-safe-state receipt returns it to the interrupted phase. The append-only event ledger, optimistic version check, role/classification visibility, tenant filters, policy decisions, and audit records make the path inspectable and concurrency-safe.

The Commercial workspace exposes creation, approval guidance, phase-receipt verification, state controls, failure/recovery, renewal/closeout, and the complete event trail. This completes the repository-controlled dry-run spine; live Recovery activation still requires owner-stamped commercial terms, exact provider accounts and scopes, approved legal/agreement authority, controlled provider fixtures, payment and signature reconciliation, real customer consent, field evidence, and an authorized cutover from synthetic to live operation.

#### Provider-specific pre-live contract checkpoints — 2026-08-22

The dry-run spine now compiles five explicit provider checkpoints into each Customer Value Cycle: GoHighLevel for CRM/recovery lifecycle behavior; Stripe for payment success, exception, and reconciliation behavior; DocuSign for send, complete, and expiry behavior; Google Workspace for onboarding, calendar, mail, Drive, and reporting behavior; and Notion for the client-OS reference/scaffolding boundary. Checkpoints resolve to existing tenant-scoped Integration Bindings and cannot be created from missing or cross-organization bindings.

The first checkpoint release is a deterministic contract harness, not a provider emulator and not a live connection test. It exercises eight critical protocol scenarios—normal path, denied action, malformed input, outage/fallback, duplicate/retry, approval/separation of duties, recovery/rollback, and audit reconstruction—without dispatching an external request. Passing generates content-hashed canonical Evidence and an append-only run receipt. The agreement-readiness phase is blocked until every checkpoint is contract-qualified; a retry returns the existing qualified result rather than producing a duplicate receipt.

Contract qualification never changes the Integration Binding's connection, health, parity, authority, credential, or provider-account claims. Every checkpoint permanently records `liveProviderVerified: false` and `externalEffectsExecuted: false` under database constraints, and the UI displays the exact remaining live blocker. The next provider wave must bind exact accounts and administrators, secret references, least-privilege scopes, recovery owners, real operation/event schemas, rate/cost/latency limits, live health, provider sandbox receipts, revocation, and controlled failure/recovery evidence before any checkpoint can support field activation.

#### Governed provider activation packets — 2026-08-22

That repository-controlled provider wave now has its native configuration plane. Integration Binding v2 is the activation packet for each GoHighLevel, Stripe, DocuSign, Google Workspace, and Notion adapter: provider identity; exact account and administrator references; adapter implementation and version; transport; account, permission, credential-reference, authority, operation, and event boundaries; input/output/event schemas; cost, latency, rate-limit, idempotency, retry, timeout, cancellation, and redaction behavior; test and evidence requirements; revocation, recovery, fallback, parity, and replacement state. The packet accepts managed-secret references but rejects credential-shaped material in configuration metadata.

The Systems workspace is now the actual operator control for these records. It shows activation gaps, permits authorized edits, attaches verified Evidence, and exposes immutable history. Every accepted edit and lifecycle transition uses optimistic configuration-version concurrency, appends a complete snapshot and attributable audit receipt in the same database transaction, and cannot mutate or delete an earlier revision. Provider-observed health remains separately derived and cannot be set through the editor. This closes the configurable-record gap; it does not close live activation. The exact accounts, administrators, managed-secret objects, provider grants, behavioral tests, recovery drills, and live health remain external owner/provider gates, and unsupported GoHighLevel, Stripe, and DocuSign health checks still fail closed.

#### Booked Job Recovery diagnostic and Sales Brief — 2026-08-23

Empyrean Gate A now begins with an interactive public diagnostic at `/recovery`. The calculator uses one deterministic, versioned model over business profile, inbound demand and response, estimate economics, past-customer depth, data quality, ownership, capacity and intent. It exposes a useful partial result before contact capture, preserves a conservative low/base/high modeled range for three explicit pools, and never labels the result lost revenue, forecast, guarantee or field proof.

Affirmative contact consent unlocks the full report and atomically writes one native confidential prospect identity and Relationship into the exactly resolved Empyrean tenant. A generated internal Sales Brief is visible in Commercial and includes only the operating inputs needed for discovery, modeled economics, confidence gaps, validation questions, likely objections, fit concerns, route and current-commercial-authority guardrail. Public funnel events are append-only and privacy-minimized. High fit, not-ready, capacity-constrained and insufficient-data paths route differently instead of forcing every visitor into a sales call.

This closes the repository-controlled calculator, report, native writeback and sales-preparation slice. GoHighLevel contact synchronization, the live Recovery diagnostic calendar, provider delivery receipts and actual booking state remain explicit Integration Binding/provider gates.

#### Recovery Call-2 close packet and operative handoff — 2026-08-23

Every consented high-fit diagnostic can now materialize one tenant-bound Call-2 packet over the existing prospect Relationship, Recovery Offer, Commercial Case, Work Packet, approval and audit graph. The packet snapshots the Sales Brief; makes facts, modeled signals, unknowns, buyer authority, changes, thesis, scope, attribution, responsibilities and objections editable; and locks one server-owned standard or founding-proof terms snapshot at readiness. Operators cannot enter a custom price or guarantee. A named exception creates a normal upward approval, remains visible in the decision HUD, and prevents a won disposition until approved.

The close control requires one of four explicit outcomes and maps it to the canonical Commercial Case: won pending agreement/payment, conditional named dependency, nurture/not now, or lost with reason. Won creates only a handoff-ready record with the decision maker, dated action, agreement version to send, authorized payment path and onboarding trigger. It does not create a signature, invoice, settled payment, onboarding fact or provider execution. Optimistic concurrency, database-enforced zero effects, append-only events and immutable disposition history preserve that boundary.

This closes the repository-controlled Call-2 and operative-handoff artifact. The next Gate-A work is exact agreement-template/legal authority plus signature-state reconciliation, authorized payment-link creation and settlement reconciliation, live CRM/calendar writeback, onboarding receipts, provider E2E and field acceptance. None of those external outcomes is inferred from the close packet.

#### Recovery agreement authority and billing control — 2026-08-23

The first part of that next Gate-A work is now native and usable without crossing the provider boundary. A won Call-2 creates a company-level agreement authority, a client-specific agreement instance and a fixed-price billing manifest, each linked to its own Work Packet. The authority starts blocked and requires the founder to record qualified counsel's attributable disposition, verified Evidence and exact output for all 15 canonical agreement issues. Approved and approved-with-changes paths cannot retain unresolved issues. This is a custody and control record, not EOS-authored legal advice.

The agreement instance binds client and provider legal identity, signer, effective agreement version, DocuSign template and exact tenant Integration Binding. The billing manifest snapshots the server-owned commercial package and accepts only Stripe product/price references plus tax, descriptor, payment-method, subscription-start, receipt, cancellation and refund policies. Browser input cannot rewrite amounts. Credential-shaped material is rejected. One evaluation control exposes every counsel, version, configuration, provider identity, connection, health, parity, account and managed-secret blocker without executing an external action.

Signature and payment remain provider-authoritative states. The API has no manual path to mark an agreement signed or a payment settled. Binding-specific public receipt endpoints verify DocuSign Connect HMAC-SHA256 and Stripe's signed raw payload through the official SDK before parsing, reject wrong account/tenant/object/package/price/amount/currency mappings, deduplicate immutable event IDs and reconcile out-of-order agreement, setup-payment, subscription, invoice, refund and dispute state. Under the current payment-first canon, Checkout is issued before the agreement; verified setup payment plus active/trialing subscription make the agreement eligible to issue; only the later verified signature produces active billing and opens onboarding. Terminal conflicts and mismatches enter recovery. The receipt ledger is append-only, retains a minimized projection plus payload hash instead of provider payload/PII, and creates verified canonical Evidence.

Phase 15 adds the separately governed execution adapters without collapsing provider authority into EOS. Checkout issuance, DocuSign send, subscription cancellation, setup refund, and unsigned-envelope void each create a tenant-bound Provider Execution and named approval. The request is minimized and version-bound; after approval EOS revalidates the original principal/seat authority, exact tenant and Work Packet, target version/state, Integration Binding health/parity/account, and the deployment kill switch before calling the provider. Stripe uses stable POST idempotency keys; DocuSign uses the stable execution ID as `transactionId`. Provider acceptance advances only issued/requested state and records observed Evidence; lifecycle webhook receipts remain required for paid, subscribed, signed, cancelled, refunded, and disputed truth. Safe retry reuses the same execution and provider key. Exact production accounts, managed credentials, callbacks, legal authority, recovery drills, integrated rehearsal, and first-field evidence remain external activation gates.

Canonical source precedence for this package is the current company registry and reference-instance/runtime material in Notion:

- [Empyrean Studios canonical company registry](https://app.notion.com/p/3c3da8b96e4f81679d74fac5fc7ed788)
- [Empyrean Studios company runtime](https://app.notion.com/p/32eda8b96e4f81c78872e5a768ea9faf)
- [Empyrean plus AFM reference implementation](https://app.notion.com/p/3b0da8b96e4f8194a768d374651f5cc9)
- [Empyrean pre-live authority packet](https://app.notion.com/p/3b4da8b96e4f814d983ed939336eaa1b)
- [Current Recovery System commercial authority](https://app.notion.com/p/3a9da8b96e4f8129ba8fefea055ee11b)
- [Booked Job Recovery Calculator specification](https://app.notion.com/p/3bbda8b96e4f81d3b3e3f006c2a2f014)

#### Google Workspace resource observation — 2026-08-25

The native provider-ingress plane now treats Gmail, Google Drive, and Google
Calendar as three separately registered signal surfaces under one exact Google
Workspace Integration Binding. Drive uses the provider changes collection and
Calendar binds an exact calendar resource. EOS creates and renews token-
authenticated Google channels, stores encrypted channel tokens and only their
fingerprints in projections, validates channel/resource/message identity before
acceptance, and stops replaced or revoked channels on a best-effort basis.

Signals remain observations until the serialized reconciliation worker reads
the authoritative current cursor under a per-registration database lock. Drive
records bounded file metadata and Calendar records bounded event metadata; file
bodies, event descriptions, attendee identities, provider tokens, and raw
payloads are not copied into the operating projection. Each changed resource
produces an append-only, hash-chained snapshot, while retries, dead letters,
operator replay, health, alerts, and acknowledgements reuse the governed Module
12 control plane. This closes repository-controlled registration, observation,
reconciliation, cursor-concurrency, and operator-control behavior. It does not
prove a live Google account, OAuth scope, channel delivery, provider backlog,
rate-limit behavior, or production failover.

#### Artifact closure and pre-live activation instrument — 2026-08-25

EOS now implements the current Notion Phase-1 closure contract as a native
control surface rather than a descriptive readiness card. For each tenant,
active module, and canonical capability key, an authorized operator can
initialize exactly 22 required artifact classes: capability definition;
template ancestry; role/seat; position agreement; Role Agent; authority;
SOP; workflow; Work Packet; KPI; cadence; instrument; intake; operating
documents; tools/provider bindings; telemetry; Evidence; failure/recovery;
training; acceptance fixtures; live instance values; and governed template
learning.

Applicability (`Inherited`, `Instantiated`, `Missing`, `Not Applicable`, or
`Deferred by Trigger`) remains separate from maturity (`Doctrine`, `Mapped`,
`Artifact Complete`, `Implemented`, `Pre-Live Qualified`, `Field Qualified`,
or `Native Qualified`). Missing rows require a named blocker and next action;
deferred or non-applicable rows require an explicit trigger; qualification
requires visible verified Evidence and no active blocker. A group cannot earn a
gate until all 22 classes exist and every applicable row meets it. Updates are
tenant-, hierarchy-, classification-, seat-, and policy-scoped, use optimistic
versions plus advisory serialization, and append a content-hashed immutable
history and audit receipt. The instrument records attributable state; it cannot
self-certify a live provider, qualified professional review, field outcome, or
native parity.

Capability instances now carry validated assignments to the 14 active EOS
modules. Operators choose a primary module when mapping a capability and may add
or remove additional assignments from the Operations instrument. Compiled
Empyrean capabilities map the 14 universal functions one-to-one, with the
specialized Recovery, Provider Operations, and AFM shared-service capabilities
retaining their multi-module scope. AFM's eleven declared capabilities map to
their actual command, delivery, customer, product, operations, integration,
legal, and brand surfaces. From a module workspace, an authorized operator can
initialize all visible non-dormant mapped capabilities in one idempotent action;
each still begins with 22 missing, blocked rows and no readiness claim. Module
cards derive their displayed state from the weakest earned gate across visible
matrices rather than the old static partial/ready label.

Heavy module controls now load only when opened. The main overlay chunk is
442.38 kB and every application JavaScript chunk remains below the configured
500 kB warning threshold; native signing, adapter operations, compliance,
customer success, product evolution, and artifact closure are separate demand-
loaded boundaries.

The UMH outbox worker also resolves the configured external installation ID and
issuer to one enabled local installation before leasing rows. Selection, stale-
lease recovery, claiming, success, and retry writes all remain bound to that
installation. A regression fixture proves that 25 older pending events owned by
another installation cannot crowd out or be signed under the configured
installation identity.

## 21. Explicitly deferred from the first overlay release

- autonomous high-consequence actions;
- native accounting, banking, payroll, e-signature, or payment-rail truth;
- capital, M&A, and board execution;
- unsupported regulatory or jurisdiction-specific conclusions;
- unsupervised template mutation or agent self-expansion;
- independent cross-portfolio inference or disclosure;
- claims of field proof, operatorization, replication, or native completion;
- broad provider catalog activation before the common adapter and evidence contract passes with reference integrations.

### Native contract-operations increment — 2026-08-24

The native signing surface now extends beyond document execution into governed
contract operations: immutable clone/renewal lineage, signer-initiated change
requests, append-only negotiation, scheduled and bulk reminders, founder-only
bulk void with partial-result receipts, and promotion of reviewed executed terms
into the shared EOS obligation registry. This advances the native end state by
making contract work controllable inside EOS while preserving the existing Work
Packet, Evidence, seat, authority, and Risk/Obligation/Control models.

This increment is not contract lifecycle management completion. It does not
provide external counterparty accounts, certificate signatures, jurisdictional
legal conclusions, autonomous obligation extraction, provider-independent
email delivery, or live production recovery evidence. Those remain separately
gated capabilities.

### Governed contract-revision increment — 2026-08-24

Negotiation is now a bilateral counterparty surface rather than an internal-only
operator log. The signing page projects a minimized append-only thread, allows
the signer to reply, refreshes while open, and prevents consent or signature
until the discussion closes. Internal actor identifiers never enter the public
projection.

Accepted text changes can now progress through an immutable replacement path.
EOS registers a new fielded PDF with direct parent and negotiation lineage,
records source and target hashes plus the operator's reviewed summary and
declared changes in an immutable comparison receipt, and requires founder
authority to retire an active issued envelope. Replacement atomically voids the
source, invalidates its signing path by terminal state, cancels reminders,
resolves the negotiation, and creates a clean draft carrying recipient identity
and routing but no consent, signature, token, or delivery state. The operator
must review and issue the replacement normally.

Uploaded-PDF comparison is evidence of declared change and byte identity, not
automated semantic redlining, legal review, or proof that no undeclared change
exists. Native textual diffing for EOS-generated source, optional external
counsel workflows, counterparty accounts, and production legal acceptance remain
future gated capabilities.

### Complete multi-signer evidence increment — 2026-08-25

The native authoring boundary now treats recipient-role coverage as executable
contract structure. Every authored role requires its own visible, required
signature field at registration and revision, the envelope binder revalidates
legacy documents, and the field editor identifies uncovered roles before an
immutable version can be registered. The signer sees the page and source of
every automatic signature, initials, and UTC-date placement before acting.

The sealed completion PDF now paginates its evidence certificate across the
entire supported fifty-recipient envelope rather than stopping after one page.
This closes a repository-controlled multi-party evidence omission; it does not
add government identity proofing, certificate-backed PDF signatures,
jurisdictional legal approval, external counterparty accounts, or production
delivery evidence.

### Evidence-backed contract obligation operations increment — 2026-08-25

An executed contract can now progress beyond one-time obligation promotion into
a controlled operating lifecycle. Promotion selects an active seat from the
principal's actual visible hierarchy rather than accepting an opaque UI UUID,
and the envelope projects the canonical obligation, accountable seat, due
review, source excerpt, and immutable review history back into native signing.
Operators can use only the next states allowed by the shared command registry,
reassign within their visible hierarchy, schedule follow-up, cite verified
operational Evidence, and open the broader Command workspace without creating a
parallel contract tracker.

Each review is an append-only hash-chain receipt bound to policy authority and
optimistically updates the mutable command projection. Active obligations need
a future review. Breach and satisfaction need separate verified operational
Evidence; the executed agreement can establish the source term but cannot by
itself establish performance or failure. Accepted, satisfied, and superseded
states require decision authority. This advances native contract operations but
does not provide autonomous term extraction, legal interpretation, counsel
approval, jurisdictional applicability, or production provider evidence.

### Company contract control-center increment — 2026-08-25

Executed agreements now roll into one role-visible company control center
instead of remaining isolated envelope records. The surface reports executed
and unplanned agreements, overdue reviews, approaching notice windows, overdue
obligations, and integrity/custody exceptions. Operators can record or update a
versioned lifecycle plan, assign an accountable visible seat, enter explicit
effective/end/notice/review dates, filter the portfolio to attention items,
inspect obligation and immutable lifecycle receipts, record an
Evidence-supported renewal decision, and create the lineage-linked renewal
draft from an approved renew/renegotiate intent.

The contract plan deliberately has no inferred legal dates: signing-link expiry
remains transport security metadata and never becomes an agreement term.
Unplanned agreements are owner- or accountable-Work-Packet-visible; plans are
filtered by reporting hierarchy and classification. Schedule changes require
execute authority and optimistic version checks. Renewal, renegotiation,
termination, and allowed-expiry decisions require decide authority plus
separate verified operational Evidence; the executed agreement alone is
rejected as proof of renewal fitness. Plan/decision receipts are append-only and
hash chained. EOS still does not auto-renew, send legal notice, terminate an
agreement, interpret terms, or replace qualified counsel.

### Approval-bound contract notice execution increment — 2026-08-25

The control center now advances an approved renewal or other contract action
into a controlled notice workflow. Operators prepare exact recipient, subject,
body, type, due time, owner, and classification content without sending it.
Decision authority then reviews the exact hash with separate verified
operational Evidence; the executed agreement alone is rejected as notice
fitness. Approval seals content, Evidence, actor, time, and policy decision.

Delivery is a distinct material execute action. EOS writes a prepared attempt
before Gmail is called, accepts only a non-empty provider message id as a
delivered receipt, preserves ambiguous provider outcomes as `uncertain`, and
retries only the unchanged approved hashes as a new numbered attempt. The
Contracts interface exposes notice actions, exact content, approval state,
provider receipts, minimized failures, and a fail-closed reconciliation action
for attempts still in `sending`. Reconciliation requires decision authority, a
human evidence note, and a verified provider reference before `delivered` can be
recorded. This supplies native controlled execution; it
does not determine legal sufficiency, prove counterparty receipt, calculate
jurisdictional deadlines, or replace counsel.

### Portfolio contract proposal and local-adoption increment — 2026-08-25

Portfolio contract reuse is now a governed proposal flow rather than a shared
mutable template library. A portfolio owner with source-company founder
authority can publish one approved tenant template as a versioned immutable
snapshot with a jurisdiction label, applicability statement, limitations,
classification, source and proposal hashes, flattened clause content, verified
review Evidence, and an explicit `business_review`, `internal_legal`, or
`qualified_counsel` authority label. The source company does not grant another
company authority and no proposal silently changes an existing local template.

Every company records its own immutable founder decision with company-local
verified Evidence. Rejection creates no template. Acceptance creates a new
tenant-owned draft with no source-company clause identifiers; the existing
local approval boundary must still approve that exact version before generation.
Business review never populates a counsel-Evidence claim. A portfolio owner may
withdraw a proposal without erasing prior decisions or adopted drafts, and a
later version is a new snapshot rather than mutation.

At this increment boundary, the repository-controlled portfolio-proposal and
company-adoption gap was closed. It did not yet implement a governed jurisdiction-pack catalog, verify a
reviewer's professional credentials, supply legal advice, establish legal
applicability or sufficiency, perform live counsel collaboration, migrate
production data, or qualify any deployed provider journey.

### Governed jurisdiction-pack and local-applicability increment — 2026-08-25

Portfolio owners can now prepare versioned, immutable jurisdiction packs with
country/subdivision, governing-law label, scope, applicability criteria,
exclusions, required reviews, dated review windows, source citations,
classification, and a content hash. Draft publication requires founder decide
authority and verified tenant-local Evidence typed as counsel review, legal
review, or legal opinion. Publication records the named reviewer,
organization, external credential or engagement reference, limits note, policy
decision, and audit custody. EOS explicitly records these as attributable
claims; it does not independently verify a professional license or author law.
Publication fails when the next-review date has arrived; proposal linkage,
company applicability, and proposal acceptance also require the exact pack to
be published, currently effective, and still inside its review window.

Each portfolio company must separately record one immutable, qualified-counsel
applicability outcome for the exact pack version: `applicable`,
`not_applicable`, or `needs_revision`. A portfolio contract proposal may cite a
published pack and snapshots its ID and hash. Acceptance is then fail-closed
until that company has an `applicable` decision for the exact snapshot. The
accepted company-local draft carries the local applicability Evidence but
still requires the existing local template approval before generation.
Withdrawal never erases prior decisions or proposal lineage, and database
triggers reject pack, decision, and proposal-lineage mutation.

This closes the repository-controlled jurisdiction-pack custody and local
applicability gate. It does not prove that a named reviewer is licensed,
provide legal advice, monitor law changes, establish legal sufficiency, create
a live counsel workspace, migrate production data, or qualify a deployed legal
or provider journey.

### Native compliance control-center increment — 2026-08-25

Module 13 now opens a usable company control center instead of routing only to
a generic Operations description. An authorized operator can preserve an exact
source version with publisher/system reference, jurisdiction, summary,
effective window, review freshness, classification, version and SHA-256 hash.
Verification requires visible tenant-local Evidence whose type matches the
claimed qualified-counsel, privacy-professional, internal-compliance, or
business-owner authority. Professional identity and credential references are
attributable claims; credential material is rejected and EOS does not verify a
license or engagement.

A current verified source can support separate company-native obligation,
right, consent, policy, retention-rule, or control definitions. Consent needs a
bounded purpose. Retention needs a trigger, period and disposition method.
Every definition binds an accountable visible seat, exact source ID/hash,
company scope, jurisdiction, review date and immutable definition hash. A new
version cannot silently replace a still-open requirement.

Applicability, periodic review, control test and closure each create an
append-only Evidence-backed receipt and atomically advance the optimistic
command projection. Effective controls monitor; ineffective controls
remediate; breaches become overdue; closure and non-applicability require
decision authority. Database triggers reject definition mutation, deletion,
review mutation, and projection changes that are not backed by the exact newly
inserted review receipt. Role hierarchy and classification filter every source,
requirement, Evidence option and review.

This closes the repository-controlled Module-13 custody and control-loop gap.
It does not monitor government or provider sources, independently determine
applicability, verify reviewer credentials, execute deletion, establish a legal
hold, deliver a regulatory filing, migrate production data, or qualify live
professional collaboration.

### Native customer-success control-center increment — 2026-08-25

Module 7 now opens a native company control center rather than only a health
summary or generic Operations handoff. An authorized operator creates one
customer-success account against an existing active canonical Stakeholder and
customer Relationship. EOS does not duplicate the party, contact, contract,
Work Packet, or Evidence identity. Account ownership, classification, reporting
hierarchy, review cadence, renewal date, and an observable success definition
remain explicit.

Health reviews require visible verified Evidence and use a deterministic score
over delivery, outcome, adoption, relationship, and inverse risk dimensions.
Outcomes retain immutable definitions, baseline, target, unit, due date, owner,
attribution model and attribution limitations; a separate Evidence-backed
progress receipt advances the actual value and lifecycle. Customer issues keep
severity, ownership, due date, resolution, and Evidence distinct from the health
opinion.

Reports freeze the exact current account, latest health receipt, outcomes,
issues, and Evidence metadata into a SHA-256 snapshot. Customer-approved or
public proof fails closed without separate consent/proof-release Evidence. A
decision-authorized operator approves that exact snapshot. Delivery is not a UI
claim: EOS records it only by reconciling verified provider, delivery, or
communication receipt Evidence and an external reference. Renewal readiness
requires a current health review and, for renewal or renegotiation, an
Evidence-backed tracked or achieved outcome. The decision explicitly does not
amend, renew, terminate, invoice, or notify under a contract.

Every projection transition uses optimistic versions and a hash-chained event.
Database triggers keep events and health reviews append-only, make definitions
and report snapshots immutable, and require the event kind and payload to match
the exact account, outcome, issue, or report projection change. The remaining
gates are live customer identity/consent, production field Evidence, qualified
CRM/mail/portal adapters, external delivery and acceptance, contract/payment
reconciliation, production migration, and authenticated production use.

### Native product-evolution control-center increment — 2026-08-25

Module 11 now operates on the existing canonical `eos_offer_programs` records
instead of creating a second product catalog. An authorized operator records an
immutable feedback signal with its source reference, observation time, verified
Evidence, classification and content hash. A proposal freezes the exact current
offer snapshot and hash, accepts only an allowlisted patch to governed offer
fields, links optional feedback signals, and declares its hypothesis, success
metric, guardrail and rollback plan.

A separate decision-authorized compatibility review names affected workflows,
audience segments and contract/template references. Breaking changes fail
closed without a migration plan. Only compatible or migration-backed breaking
proposals can open one timeboxed, scoped experiment. Starting/stopping,
authority-labeled telemetry observations and human conclusion remain separate
acts; provider-backed observations require an external reference and verified
Evidence. A `ship` decision additionally requires a concluded experiment whose
declared success condition was met.

Rollout starts internally and advances exactly one stage through pilot,
limited, then 100-percent general availability. Every advance requires a
verified receipt Evidence item and external deployment/provider reference;
allocation cannot decrease. Rollback remains available until canonical apply.
Only the company founder/owner can apply a completed rollout, and EOS re-hashes
the current offer inside the transaction so any intervening canonical edit
fails closed. This operation changes only the explicit offer patch; it never
silently edits native contracts or template versions.

Feedback, observations and events are append-only. Proposal and experiment
definitions are immutable, optimistic projection changes require an exact
linked event, and all state reads filter by tenant, reporting hierarchy and
classification. Remaining gates are production migration, authenticated field
use, qualified live analytics/deployment receipts, sufficiently powered real
experiments, real customer outcomes and a separately governed portfolio
template-learning promotion process.

## 22. Provider-native event boundary

The end-state Integration Plane supports three deliberately different evidence
classes:

1. an EOS-owned signed adapter event may reconcile an exact claimed run;
2. a provider-native event is a verified source observation that must retain
   its provider-specific authentication, authority scope and delivery limits;
3. a later reconciliation receipt may promote an observation into exact
   operation evidence only when a provider object can be bound to the run
   without inference.

Notion and Gmail now implement class 2. Notion uses its verification-token HMAC
and exact workspace/subscription identity; page events then require the current
OAuth connection to match that workspace before a bounded page read can append
provider revision, content hash, verified link and per-resource snapshot-chain
custody. Gmail uses authenticated Pub/Sub and an exact mailbox/history cursor.
Neither translator fabricates the class-3 receipt. Both paths have immutable
retry/dead-letter custody, Evidence-backed operator replay, governed
subscription rotation, derived freshness/failure actions and deduplicated
terminal-failure notifications; Gmail additionally has serialized automatic
watch renewal and monotonic history cursors. An authorized operator can append
one content-hashed human acknowledgment for an exact current alert; the receipt
captures the acting tenant seat and note while leaving unresolved health open.
The remaining end-state work is provider breadth, resource reconciliation
beyond Gmail and Notion pages, and live production qualification of on-call
delivery, human acknowledgment, rotation, alerting and failover.

## 23. Company-wide closure and pre-live campaign runtime

The canonical artifact contract is no longer a per-row demonstration. An
authorized operator can initialize every missing 22-class matrix across the
visible active company capability map in one bounded, idempotent action. The
runtime carries accountable seats and source/schema ancestry, creates no
maturity claim, emits one immutable row receipt and one summary audit, and caps
the operation at 300 capability-module groups.

The pre-live campaign then turns Client Zero activation into a first-class EOS
object. Its declared module/capability scope and identity cannot be edited after
creation. Start requires complete Implemented closure with zero blockers.
Exactly seven scenarios cover normal flow, denial, provider outage,
failure/recovery, rollback, tenant isolation and audit replay. Scenario pass,
failure, blocking, repair and rerun are attributable, Evidence-backed actions;
the campaign retains failures instead of rewriting history.

Campaign qualification and founder release remain separate from the artifact
ledger. All seven scenarios must pass before qualification. Every artifact must
then independently reach Pre-Live Qualified before founder release. Neither
state advances Field or Native qualification. Optimistic versions, hierarchy,
classification, policy decisions, verified Evidence, immutable hashed events,
audits and deferred database projection/event guards apply throughout.

This implements the repository-controlled orchestration mechanism required by
the current Notion completion and pre-live activation standards. The reference
instances still require exact human owners, commercial/legal authority,
production provider accounts, a real controlled Empyrean Client Zero run,
recovery and rollback evidence, field outcomes, production migration and a
qualified deployed release before their instance can honestly be represented as
live.

## 24. Governing references

- [EOS MVP — Business-in-a-Box Product Runtime](https://app.notion.com/p/3b0da8b96e4f81a39dd1f7344fb2e1bb)
- [EOS Universal Organization Template — Non-Instantiated MVP](https://app.notion.com/p/3b0da8b96e4f81e5bb28eee117838b5e)
- [EOS Universal Organization Metamodel](https://app.notion.com/p/3b0da8b96e4f817fb2b9d2775aa524ea)
- [Organization Compiler & Instantiation Protocol](https://app.notion.com/p/3b0da8b96e4f8108a00dd4789e394a00)
- [UMH × EOS Convergence Specification](https://app.notion.com/p/3b0da8b96e4f8186899ccb3a30a1aefe)
- [Notion MVP Acceptance Standard & Known Limitations](https://app.notion.com/p/3b0da8b96e4f81108f59f843eeaf3acf)
- [True Business-in-a-Box / EOS — Map, Animation & Qualification Standard v3.0](https://app.notion.com/p/3b3da8b96e4f81f79cecf8cdcbeff638)
- [EOS / Business-in-a-Box Completion Roadmap](https://app.notion.com/p/3b3da8b96e4f81e583b0ea3351b60016)
- [Empire Operating Game — Product Specification & Build Plan](https://app.notion.com/p/3b6da8b96e4f8158bfb6f5b18fe1007c)
- [EOS Module Runtime Map](https://app.notion.com/p/1e352af9e8b84cf9ac2f7f1ebba6fdf9)
