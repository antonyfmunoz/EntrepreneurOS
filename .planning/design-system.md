# Design System Specification: The Ethereal Professional

## 1. Overview & Creative North Star

**Creative North Star: The Lucid Architect**

This design system embraces a philosophy of "Lucid Architecture." It is designed to feel like a high-end physical workspace — airy, illuminated, and intentional. We achieve a premium editorial feel by prioritizing negative space and utilizing optical weight over structural lines.

The system breaks the template look through intentional asymmetry: heavy-weight headlines paired with wide-margin body text and overlapping glass containers that suggest depth and fluidity.

---

## 2. Colors & Surface Philosophy

**Core Palette:**
- Primary: #6a37d4 (Actionable energy)
- Secondary: #6448b2 (Supportive depth)
- Tertiary / Primary Container: #ae8dff (Light violet accent)
- Surface: #f5f6f7 (Base canvas)
- Background: #ffffff (Breathing room)
- On-Surface: #2c2f30 (High-contrast readability)
- On-Surface-Variant: #595c5d (Secondary text)
- Outline-Variant: #abadae (Ghost border at 10% opacity)

**Rules:**
- NO 1px solid borders for sectioning. Use background shifts instead.
- NO gradients anywhere. All colors are solid flat fills.
- Glassmorphism on floating elements: rgba(255,255,255,0.7) + backdrop-filter: blur(16px)
- Main CTAs: solid #6a37d4 fill (never a gradient).
- Never use pure black (#000000) for text. Use #2c2f30.
- Never use standard drop shadows. Always tint shadows with primary purple: 0 8px 32px rgba(106,55,212,0.08)
- Maximum three layers of glass stacking

---

## 3. Typography

Sole typeface: **Inter**

- Display: 3.5rem–2.25rem, tight letter-spacing (-0.02em), Semi-Bold
- Headline: 2rem–1.5rem, Medium weight
- Title: 1.375rem–1rem, Semi-Bold
- Body: 1rem–0.75rem, Regular, line-height 1.6
- Label: 0.75rem–0.6875rem, All-caps, 0.05em tracking

---

## 4. Elevation & Depth

**Layering:**
- Level 0: #ffffff (background)
- Level 1: #eff1f2 (surface-container-low) — large sectioning
- Level 2: #ffffff (surface-container-lowest) — cards, primary content

**Ambient Shadow (Ghost Shadow):** 0 8px 32px rgba(106,55,212,0.08)

**Ghost Border (accessibility):** outline-variant (#abadae) at 10% opacity

**Glassmorphism:** backdrop-filter: blur(16px) on any surface-container that overlaps other content

---

## 5. Components

**Buttons**
- Primary: solid #6a37d4 fill, white text, 12px radius. Hover darkens slightly to #5a2dc0. NO gradients.
- Secondary: surface-container-high background, primary text, no border
- Tertiary: ghost style, no background, primary text, shifts to surface-container-low on hover

**Input Fields**
- Default: surface-container-highest background, no dark border
- Focus: primary ghost border (20% opacity) + subtle 4px primary outer glow

**Cards**
- No dividers. 32px padding. On hover: transition to Level 3 layering + ambient shadow.

**Chips**
- Selection: secondary-container background, on-secondary-container text, full roundness
- Filter: semi-transparent surface-variant, 12px radius

**Lists**
- No divider lines. Use surface-container-low alternating rows or increased vertical whitespace.

**Border Radius:** 12px standard throughout

---

## 6. Layout — Universal Dashboard

Every authenticated page uses:

**Header** — glassmorphism navbar, org/portfolio context, global nav, search, notifications, account

**Floating AI Control Panel** — sticky top-center of workspace
- Collapsed: KPI chips + alert count + next action
- Expanded: deeper insights, workflow context, recommendations
- Style: glassmorphism card with a solid #6a37d4 1px accent border. NO gradients.

**Left Rail** — role-dependent nav, surface-container-low background, no dividers between items

**Workspace** — primary operational surface, background white, content floats within it

**Right Rail** — AI interaction surface, glassmorphism panel, chat thread, agent status

---

## 7. Icon System

Use **lucide-react** exclusively. No Material Symbols. No other icon libraries.

---

## 8. Do's and Don'ts

Do:
- Use asymmetrical margins for editorial interest
- Allow background colors to bleed through headers via glassmorphism
- Use On-Surface-Variant (#595c5d) for secondary text
- Use 12px and 16px corner radii consistently

Don't:
- Use pure black (#000000) for text
- Stack more than three layers of glass
- Use 1px solid borders to define screen edges
- Use standard drop shadows without primary color tint
- Use any icon library other than lucide-react
- Use gradients anywhere — buttons, backgrounds, borders, text, or accents are all solid fills only
