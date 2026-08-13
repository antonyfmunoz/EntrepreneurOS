# EOS UI Layout and Design Contract

**Status:** Canonical implementation contract
**Version:** 1.5
**Reconciled:** 2026-08-13

## Source authority

This contract reconciles three non-competing sources in authority order:

1. **Current product and operating intent:** [EOS Product UI & Interaction Architecture](https://app.notion.com/p/3b0da8b96e4f81278383da2af02d1d12). Notion remains the most current authority where it explicitly supersedes older product assumptions.
2. **Universal layout and Integration Core:** [EOS — Product — Master Document](https://docs.google.com/document/d/1kKBGCS9kewNMwOBAThXVkd1tYNcgddSUCjkpBjJtLSo/edit), especially section 9.3. The Drive master governs the five-region layout, role-driven navigation, provider connection model, and first Gmail execution loop where it does not conflict with newer Notion decisions.
3. **Visual design system:** `.planning/design-system.md` — **The Ethereal Professional / The Lucid Architect**. This checked-in Markdown governs palette, typography, spacing, elevation, glass, radii, component treatment, and icon usage.

The page inventory in `.planning/specs/eos-mvp-spec.md` remains a useful implementation baseline, but obsolete Firebase, AgentOS, DEX, route, and deferred-feature assumptions do not override current Notion doctrine or implemented Clerk/EOS runtime behavior.

## Persistent shell

Authenticated organization surfaces use five coordinated regions:

1. **Header:** one compact glass row with the selected portfolio and, when applicable, company name at the top left, plus search, notifications, and one account avatar at the far right. The portfolio home shows no left-side name until a portfolio is selected. Mobile does not render a second nesting row beneath it. The product name belongs in the mobile left drawer header, not as a second header identity.
2. **Left rail:** compact, full-height role-aware primary navigation without divider-based sectioning. It matches the right communication drawer at 240px when expanded on desktop, uses 55vw on mobile, and retains a 48px collapsed desktop state. The mobile communication drawer expands to the full viewport width.
3. **Workspace:** white primary operating surface with editorial spacing and progressive disclosure.
4. **Executive control HUD:** floating top-center workspace overlay, visually derived from the UMH control panel, showing active seat, open work, decisions/approvals, exceptions, and next safe action. It does not consume page-flow height and remains above the scrolling workspace. HUD-enabled workspaces reserve a compact clear top zone beneath it—96px on mobile and 80px from tablet upward—so initial headings and actions do not render underneath the HUD. It is named for the user's Executive Assistant, never hardcoded to Jarvis. Expansion explains context without granting authority.
5. **Right communication drawer:** the active seat's organizational communication channel. For the founder this is the user-named Executive Assistant, who orchestrates the 15 portfolio advisors and Company CEO Agents. For lower seats it is the persistent Role Agent for that seat, operating as the human's assistant when the seat is human-occupied. It is not an unscoped global chat.

Desktop presents the full architecture. Mobile prioritizes context, action, capture, approvals, and exceptions through explicit navigation and intelligence drawers.

## Integration Core

Systems is an operational provider surface, not a status-card catalog. Each integration exposes:

- Connection mechanism: OAuth, server-managed API credential, or installation-bound signed federation.
- Actual provider health and connected state.
- Required and granted scopes.
- Tool or operation schema.
- Risk profile and execution authority.
- A real execution adapter and manual fallback.
- Functional connect, reconnect, verify, disconnect, or capability-manifest actions as applicable.

Google Workspace is the first consequential integration: Gmail execution remains behind local EOS approval, while Calendar and Drive scopes support the adjacent MVP surfaces. Notion is a verified external reference provider. Universal Meta Harness is an optional deployment-managed control plane; it is never represented as a browser-configured toggle and never becomes the authority for local EOS work or approvals.

## Canonical navigation

The primary order is:

1. Home
2. Command
3. Organization
4. My Role
5. Modules
6. Stakeholder / Commercial
7. Operations
8. Work Room
9. Review Room
10. Academy
11. Portfolio Map
12. Capital & Investor Relations (dormant)
13. Intelligence
14. Systems

Role compilation removes any surface the active seat is not authorized to use. Portfolio and organization selection are account-context controls in the profile panel, not operating-navigation entries. Modules is a role-filtered control center: the founder can enter all fourteen non-dormant overlay modules, while lower seats see only the business functions whose operating surfaces are available inside their compiled authority.

Unavailable or dormant surfaces remain visible only when their state is clearly labeled. UI presence must never imply authority, provider connectivity, native ownership, or release maturity.

## Context law

Every consequential surface exposes or can reveal:

```text
Principal
→ Portfolio
→ Organization / Entity / Unit / Program / Project / Fund / Case
→ Seat or role
→ Current record / work / action
```

The user must never infer which organization, authority context, provider record, or evidence requirement an action affects.

Account settings follow the same law. Settings and Support use a clean account shell: the account header remains, but no company navigation or Executive HUD is rendered without an active company authority context. With one owned company EOS may select it automatically. With multiple owned companies, company and AI-spend controls remain inactive until the user selects an exact company. That selection is visible, URL-addressable, and carried from an active company workspace. A settings control must change an enforced runtime state or explicitly state that the capability is unavailable; storing an unused preference is not a functional control.

## Visual system

| Token | Canonical value |
|---|---|
| Primary | `#6a37d4` |
| Primary hover | `#5a2dc0` |
| Secondary | `#6448b2` |
| Tertiary container | `#ae8dff` |
| Base canvas | `#f5f6f7` |
| Background / primary cards | `#ffffff` |
| Section surface | `#eff1f2` |
| Primary text | `#2c2f30` |
| Secondary text | `#595c5d` |
| Outline reference | `#abadae` at low opacity |
| Typeface | Inter only |
| Standard radius | 12px |
| Ambient shadow | `0 8px 32px rgba(106,55,212,0.08)` |
| Glass | `rgba(255,255,255,0.7)` plus 16px blur |
| Icons | `lucide-react` exclusively |

## Non-negotiable visual rules

- No gradients.
- No pure-black body text.
- No ordinary gray/black drop shadows.
- Do not use 1px solid borders as the primary means of screen or section separation.
- Prefer background shifts, negative space, and purple-tinted ambient elevation.
- Cards use generous spacing; canonical card padding is 32px on desktop.
- Inputs use soft filled surfaces and a subtle primary focus glow.
- Limit glass stacking to three layers.
- Use 12px and 16px radii consistently.
- Use asymmetry and negative space intentionally; do not regress to a dense admin template.

## Product interaction laws

- UI is a projection of canonical state, not an independent source of truth.
- Context appears before consequence.
- Disabled actions explain missing authority, evidence, or prerequisite.
- Home and HUD next actions must resolve to a surface inside the active seat's compiled navigation; no role may be sent to a founder-only destination and silently bounced back.
- My Role must expose the next assigned-work, decision, practice, or role-assistant action available to the seat rather than stopping at a descriptive authority summary.
- Status must be backed by state, event, and evidence.
- Domain language may adapt; canonical semantics do not.
- High-risk commands preview their effect and require fresh local authorization.
- Empty, loading, error, stale, disconnected, dormant, and exception states are first-class behavior.
- The active communication agent may explain, coordinate, and propose; it does not authorize consequential effects.

## Role-compiled visibility

EOS does not render one universal dashboard. It compiles navigation, records, search, metrics, messages, approvals, commands, and AI context from the active principal, portfolio, organization, seat, assignment, purpose, classification, and authority grants.

- The founder receives the broadest authorized portfolio and company view.
- A Company CEO receives company-wide visibility but no implied access to peer companies.
- A functional executive receives the owned function and required cross-functional rollups.
- A manager receives their own work plus the direct and indirect reporting subtree needed for supervision.
- An individual contributor receives their seat, assigned work, required collaboration context, policies, metrics, and evidence.
- External users receive relationship-scoped portals only.

Organizational level establishes the default visibility ceiling; it never overrides legal privilege, conflict walls, highly restricted classifications, purpose limits, or a narrower deny.

## Communication and advisor law

```text
Founder
↔ user-named Executive Assistant
↔ 15 personalized Portfolio Advisor Agents
↔ one Company CEO Agent per company
↔ functional executives and managers
↔ Role Agents and human employees
```

The founder communicates only through the Executive Assistant. The EA convenes the relevant advisors, preserves dissent and provenance, communicates with Company CEO Agents, and returns one coherent synthesis. Employees below the CEO communicate through the real reporting hierarchy. One persistent Role Agent belongs to every instantiated role; when a human occupies the role, the same agent changes into assistant mode.

The portfolio council contains exactly 15 advisory seats. Its stable mandates are compiled through the founder's profile, vision, values, decision style, portfolio, companies, lifecycle stage, constraints, and evidence. The council is advisory only and cannot approve or execute work.

## Communication drawer

EOS adopts the UMH RightRail information architecture while retaining the EOS visual system. The drawer is full height in EOS.

- Desktop: 240px wide, aligned to the right edge of the workspace, full workspace height.
- Mobile and tablet: 100vw wide, aligned to the right edge, full viewport height.
- Desktop: the rail is attached to the workspace and reserves its own width; it is not a floating card.
- Mobile and tablet: it opens over the workspace as a full-height edge drawer.
- Header: editable, persisted Executive Assistant name, communication role, active status, advisor count, and current seat.
- Body: one vertically scrolling conversation stream with horizontally contained messages.
- Composer: pinned to the bottom of the conversation; sending never moves it off-screen.
- Footer: compact local-authority and non-execution notice.
- Mobile open/close is controlled by the movable communication FAB and the drawer close control.
- UMH geometry does not override EOS colors, typography, glass surfaces, radii, or authority language.

## Implementation map

- Global semantic tokens: `client/src/styles/design-system.css`
- Tailwind mapping: `tailwind.config.ts`
- Global base behavior: `client/src/index.css`
- Canonical shell: `client/src/components/layout/universal-layout.tsx`
- Header/context stack: `client/src/components/layout/header.tsx`
- Navigation: `client/src/components/layout/left-rail.tsx`
- Executive control HUD: `client/src/components/layout/floating-ai-panel.tsx`
- Shared primitives: `client/src/components/ui/`
- EOS overlay composition: `client/src/pages/eos-overlay-page.tsx`

Any future UI implementation or generated page must read this file, `.planning/design-system.md`, and the current Notion UI architecture before changing layout or visual tokens.
