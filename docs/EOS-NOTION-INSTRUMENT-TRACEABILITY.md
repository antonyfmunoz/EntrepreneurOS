# EOS Notion Instrument Traceability

Date: 2026-08-26

Canonical source: [EOS — Required Instrument Manifest v1](https://app.notion.com/p/3c1da8b96e4f81d1be97f895443c12b1)

Implementation plan: [EOS Required Instrument Completion — Implementation Plan](https://app.notion.com/p/3c8da8b96e4f81038b39d1ca7ad0cc39)

## Completion contract

An instrument is repository-complete only when it has canonical object types,
durable company-scoped state, commands and append-only events, lifecycle and
optimistic concurrency, role/classification visibility, authority decisions,
Evidence and audit behavior, credential-safe external references, an interactive
surface, failure/recovery coverage, and automated qualification. A provider
connection or a page carrying a similar name is not sufficient.

Production authorization, professional decisions, authoritative external
receipts, staffed operation, and field outcomes are tracked separately because
repository code cannot truthfully manufacture them.

## Current matrix

| Required instrument | Prior native state | Repository-controlled implementation | Qualification state |
|---|---|---|---|
| Docs | Legacy user-scoped CRUD | Company-scoped document/template objects, guided authoring, versions, lifecycle, Evidence and legacy-safe boundary | Repository-qualified |
| Drive / Files | Legacy folder metadata | Folder/file/collection objects with managed storage references, relationships, versions and Evidence | Repository-qualified |
| Sheets | Provider mention only | Native workbook/worksheet/table/chart objects with guided activation grammar | Repository-qualified |
| Slides | Missing | Native deck/slide/theme objects with guided activation grammar | Repository-qualified |
| Databases / Tables | Partial registries | Canonical database/table/view/record objects and guided editor | Repository-qualified |
| Forms | Partial diagnostic forms | Canonical form/question/submission objects, consent references and workflow linkage | Repository-qualified |
| Calendar | Google adapter plus scheduling slices | Calendar/event/availability/booking objects plus provider reconciliation boundary | Repository-qualified |
| Search | Page-local search | Authorized tenant, hierarchy and classification-filtered cross-instrument search | Repository-qualified |
| Canvas | Organization graph UI | Canonical canvas/node/edge/board objects without replacing source authority | Repository-qualified |
| Tasks | Legacy tasks and Work Packets | Canonical task/checklist/queue objects alongside authoritative Work Packets | Repository-qualified |
| Projects | Partial project/work structures | Project/milestone/dependency objects with cross-instrument relationships | Repository-qualified |
| Workflows / Automations | Durable workflow runtime | Workflow/step/run objects linked to the durable workflow and skill runtime | Repository-qualified |
| CRM | Native stakeholder/commercial state | Person/relationship/facet/pipeline/opportunity objects linked to canonical commercial state | Repository-qualified |
| Messages | Native hierarchical conversations | Conversation/message/channel/thread objects preserving hierarchy and EA/CEO orchestration | Repository-qualified |
| Conference Rooms | Missing | Room/meeting/agenda/participant/decision objects with governed references and action linkage | Repository-qualified |
| AI | EA, Role Agents and advisor council | User-named assistant/agent/prompt/evaluation objects linked to authority-bound agents | Repository-qualified |
| Knowledge | Provider references and artifacts | Source/article/topic/graph objects separated from Files, Memory and provider truth | Repository-qualified |
| Memory | Native institutional memory | Record/supersession/retrieval objects linked to append-only institutional memory | Repository-qualified |
| Analytics | Metrics and product analytics slices | Metric/dashboard/report/observation objects with source lineage | Repository-qualified |
| Learning | Partial academy/talent learning | Course/module/lesson/enrollment objects connected to Academy and Evidence | Repository-qualified |
| Development / Progression | Native workforce slices | Role-path/competency/assessment/progression-event objects linked to workforce state | Repository-qualified |
| Commerce | Offers, billing and contract lifecycle | Offer/order/subscription/entitlement objects linked to governed billing and contract state | Repository-qualified |
| Finance | Native sources, plans and reconciliation | Account/plan/transaction/reconciliation/obligation objects linked to finance controls | Repository-qualified |
| Ads | Missing | Native account/campaign/ad-group/creative/audience/budget/placement objects | Repository-qualified |
| Reputation | Missing | Native review/request/response/testimonial/rating-summary objects | Repository-qualified |

## Shared implementation evidence

- `shared/instrument-runtime.ts`: required-instrument registry, canonical object
  types, input contracts and lifecycle rules.
- `shared/schema.ts`: company-scoped object, command, event and relationship
  ledgers.
- `migrations/0109_add_canonical_instrument_kernel.sql`: constraints, indexes,
  optimistic projection guard and append-only command/event/link protection.
- `server/routes/instrument-runtime.ts`: tenant, role, classification,
  authority, Evidence, idempotency, audit, lifecycle, relationship and search
  enforcement.

All rows are repository-qualified by the 2026-08-26 migration, API, rendered
browser and full-suite evidence. This does not qualify live provider grants,
professional decisions, staffed operation, authoritative external receipts or
field outcomes.
