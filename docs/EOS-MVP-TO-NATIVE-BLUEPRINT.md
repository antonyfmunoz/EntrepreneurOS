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

- **Global identity bar:** principal, portfolio switcher, organization/entity switcher, purpose/context indicator, notifications, search, and account.
- **Left navigation:** Home, Portfolios, Organizations, Command, Organization, Commercial, Operations, Capital & Finance, Intelligence, Systems.
- **Context header:** active portfolio, organization, seat/role, lifecycle stage, current constraint, authority summary, sync health, and source freshness.
- **Workspace:** the selected operating surface.
- **Right communication rail:** the founder's named Executive Assistant or the active seat's Role Agent assistant, with conversation, explanations, suggested actions, source/evidence links, and pending approvals.
- **Global command palette:** navigate, inspect, draft, plan, simulate, create Work Packet, request approval, or invoke a connected capability.

### 6.2 Boxed operator experience

These are views over canonical objects, not separate databases:

1. **Start Here:** purpose, operating law, current context, terminology, setup status, first safe action, and escalation route.
2. **Organization/Campaign Compiler:** new/existing organization intake, current-state reconciliation, package selection, proposed manifest, review, approval, provisioning, verification, and activation.
3. **Home / Morning Brief:** cross-company commitments, objectives, issues, risks, approvals, stale integrations, current missions, and next actions.
4. **Character Sheet / My Role:** role, seat, mandate, authority ceiling, tool entitlements, scorecard, learning path, missions, reviewer, and advancement requirements.
5. **Mission Board:** governed Work Packets with objective, prerequisites, tool pack, authority, evidence, due logic, reviewer, stop conditions, and resulting state changes.
6. **Command Center:** objectives, metrics, constraints, issues, decisions, commitments, approvals, simulations, and operating cadence.
7. **Work Room:** the active Work Packet, required method, supporting records, provider actions, artifacts, evidence, collaboration, blockers, and handoff.
8. **Review Room:** output/evidence review, approval, rejection, remediation, exception, rollback, and outcome capture.
9. **Academy:** concepts, worked examples, simulations, bounded missions, evidence rubrics, certification, remediation, and next-level rules.
10. **World/Portfolio Map:** authorized portfolios, organization nodes, relationships, lifecycle, shared services, dependencies, risks, and consolidated outcomes.

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
| 1 | Recruiting & Candidate Portal | Provider/form intake, candidate portal, review queue, assessments, evidence, decisions; separate external/internal boundaries | Native candidate identity, lifecycle, assessment security, interviews, trials, decisions, onboarding handoff | Active; in build |
| 2 | Lead Capture & Marketing Qualification | Ingest consented leads and attribution from connected CRM/forms; qualification, routing, source links | Native lead signal, consent, attribution, qualification, routing, campaign and opportunity creation | Active |
| 3 | Sales Opportunity & Commercial Decision | Unified opportunity view over CRM, communications, offers, proposals, approvals, forecast | Native opportunity lifecycle, communication timeline, offer configuration, approvals, forecast, audit | Active |
| 4 | Contracting & Payment Activation | Generate/review agreement and payment requests; provider links/events; no ledger claims | Native obligation graph and commercial activation while e-sign/payment providers remain authoritative rails | Active |
| 5 | Client Onboarding Portal | Secure intake, checklist, provider links, access requirements, approvals, onboarding Work Packets | Native external identity, scoped portal, intake, access orchestration, onboarding state and evidence | Active |
| 6 | Fulfillment & Work Delivery | Work Packet coordination around connected project/docs/files systems; deliverable review and change requests | Native workflow/capacity/deliverable/issue/evidence runtime with provider adapters | Active |
| 7 | Customer Success, Reporting & Renewal | Health summary, evidence-backed reports, issues, renewal reminders, provider communications | Native health model, outcomes, attribution, reporting, renewal workflow and consented proof | Partial |
| 8 | Executive Command & Operating Cadence | Morning brief, objectives, metrics, issues, decisions, commitments, approvals, review packets | Native event-driven command, decision, meeting/cadence, cross-company read models | Active |
| 9 | Finance Control & Commercial Events | Provider-backed invoice/payment/accounting summaries, budget requests, approvals, reconciliation status | Native financial-event/control projection; accounting/bank/payroll remain authoritative rails unless separately qualified | Partial |
| 10 | Operations, Administration & Vendor Control | Requests, vendors, assets, access, obligations, recurring work, provider/system links | Native procurement, vendor, asset, access, service and administration workflows with immutable evidence | Active |
| 11 | Product, Offer & Template Evolution | Offer/template catalog, feedback, experiments, version proposals, release decisions | Native product configuration, compatibility, experiments, rollout, telemetry and governed template learning | Partial |
| 12 | Technology, Integrations & Automation Control | Integration directory, entitlement, health, sync, incidents, retries, fallbacks and replacement status | Native adapter plane, secret references, capability registry, eventing, observability, rollback and parity qualification | Partial |
| 13 | Legal Obligations, Rights & Compliance | Obligations/consent/risk/control index and professional review queue; source links to authoritative documents | Native obligation/right/consent/policy lifecycle and retention with qualified specialist integrations | Partial |
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
- validate agent-vacant, human-occupied, provider-led, transition, suspension, and exit states.

### Wave 4 — full non-dormant reference instance

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

The current React/Vite/Express/Drizzle application is a useful native shell, but it is not yet the desired MVP. Immediate gaps include:

- legacy tasks, agents, workflows, messages, and integration records are not consistently tenant/company scoped;
- several routes lack complete authentication or ownership enforcement;
- the earlier 12-page PRD understates the current canonical EOS architecture and still contains superseded identity/AI assumptions;
- most integrations are placeholders; Gmail is the principal real provider path;
- the UMH projection adapter is an opt-in first slice, not a proven production round trip;
- current build success coexists with repository-wide type/test failures;
- workflow execution, audit, policy/authority, evidence, eventing, reconciliation, compiler, role-agent runtime, and native multi-tenant enforcement remain incomplete;
- plaintext OAuth-token storage must be replaced by managed encrypted secret handling/reference;
- the existing UI pages should be mapped into the canonical shell and module surfaces rather than expanded as parallel page families.

The safest next implementation packet is **Wave 0 plus a thin Wave 1 vertical slice**: tenant/context enforcement, canonical command/work/evidence primitives, boxed navigation, organization compiler draft, and one Gmail-backed customer-value action flowing through approval, outbox, provider evidence, and reconciliation.

## 21. Explicitly deferred from the first overlay release

- autonomous high-consequence actions;
- native accounting, banking, payroll, e-signature, or payment-rail truth;
- capital, M&A, and board execution;
- unsupported regulatory or jurisdiction-specific conclusions;
- unsupervised template mutation or agent self-expansion;
- independent cross-portfolio inference or disclosure;
- claims of field proof, operatorization, replication, or native completion;
- broad provider catalog activation before the common adapter and evidence contract passes with reference integrations.

## 22. Governing references

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
