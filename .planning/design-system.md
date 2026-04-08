# Design System Specification: The Ethereal Professional

## 1. Overview & Creative North Star

**Creative North Star: The Lucid Architect**

This design system moves away from the rigid, boxed-in layouts of traditional SaaS to embrace a philosophy of "Lucid Architecture." It is designed to feel like a high-end physical workspace—airy, illuminated, and intentional. We achieve a premium editorial feel by prioritizing negative space and utilizing "optical weight" over structural lines.

The system breaks the "template" look through intentional asymmetry: heavy-weight headlines paired with wide-margin body text and overlapping glass containers that suggest depth and fluidity. We are not just building an interface; we are curating a digital environment where data breathes.

---

## 2. Colors & Surface Philosophy

The palette is rooted in a sophisticated violet spectrum, balanced by a hyper-clean neutral foundation.

* **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Structural definition must be achieved through background shifts—for example, a `surface-container-low` side panel sitting against a `background` workspace.

* **The Glass & Gradient Rule:** To maintain the "Ethereal" aesthetic, floating elements (modals, dropdowns, navigation bars) must utilize Glassmorphism. Use `rgba(255, 255, 255, 0.7)` with a `16px backdrop-blur`.

* **Signature Textures:** Main CTAs should not be flat. Apply a subtle linear gradient from `primary` (#6a37d4) to `primary-container` (#ae8dff) at a 135-degree angle to provide a "lit from within" professional polish.

**Core Palette:**

- **Primary:** `#6a37d4` (Actionable energy)
- **Secondary:** `#6448b2` (Supportive depth)
- **Primary Container:** `#ae8dff` (Gradient terminus)
- **Surface:** `#f5f6f7` (The base canvas)
- **Background:** `#ffffff` (The breathing room)
- **On-Surface:** `#2c2f30` (High-contrast readability)
- **Outline Variant:** `#abadae` at 10% opacity (Ghost borders)

---

## 3. Typography

We use **Inter** as our sole typeface, relying on a dramatic scale to convey hierarchy and brand authority.

* **Display (lg, md, sm):** 3.5rem to 2.25rem. Tight letter-spacing (-0.02em) and Semi-Bold weight.
* **Headline (lg, md, sm):** 2rem to 1.5rem. Medium weight.
* **Title (lg, md, sm):** 1.375rem to 1rem. Semi-Bold.
* **Body (lg, md, sm):** 1rem to 0.75rem. Regular weight with 1.6 line-height.
* **Label (md, sm):** 0.75rem to 0.6875rem. All-caps with 0.05em tracking.

---

## 4. Elevation & Depth

Depth is the cornerstone of this system. We replace structural rigidity with **Tonal Layering**.

* **The Layering Principle:**
    - Level 0: `background` (#ffffff)
    - Level 1: `surface-container-low` (#eff1f2) for large sectioning.
    - Level 2: `surface-container-lowest` (#ffffff) for cards and primary content blocks.

* **Ambient Shadows:** For elements that require "lift" (Hover states, Modals), use the "Ghost Shadow": `0 8px 32px rgba(106, 55, 212, 0.08)`. Note the use of the `primary` color in the shadow to mimic natural light refraction.

* **The Ghost Border:** If accessibility requires a stroke, use `outline-variant` (#abadae) at 10% opacity. It should be felt, not seen.

* **Glassmorphism:** Apply `backdrop-filter: blur(16px)` to any element with a `surface-container` role that overlaps other content.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`#6a37d4` → `#ae8dff` at 135deg), white text, 12px radius.
- **Secondary:** `surface-container-high` background with `primary` text. No border.
- **Tertiary:** Ghost style. No background, `primary` text, shifts to `surface-container-low` on hover.

### Input Fields
- **Default:** `surface-container-highest` background. No dark border.
- **Focus:** `primary` Ghost Border (20% opacity) + 4px `primary` outer glow.

### Cards
- **Construction:** No dividers. 32px padding.
- **Interaction:** Hover lifts from Level 2 to Level 3 with Ambient Shadow.

### Chips
- **Selection:** `secondary-container` with `on-secondary-container` text. Full roundness.
- **Filter:** Semi-transparent `surface-variant`, 12px radius.

### Lists
- **Layout:** Prohibit divider lines. Use alternating `surface-container-low` or increased whitespace.

---

## 6. Do's and Don'ts

### Do
* Use asymmetrical margins for editorial interest.
* Allow background colors to bleed through headers via glassmorphism.
* Use `on-surface-variant` (#595c5d) for secondary text.
* Use 12px (`md`) and 16px (`lg`) corner radii consistently.

### Don't
* Use pure black (#000000) for text. Use `on-surface` (#2c2f30).
* Stack more than three layers of glass.
* Use 1px solid borders to define screen edges.
* Use standard drop shadows. Always tint with `primary` purple.

---

## 7. Branding

**Logo/Icon:** Use a **robot icon** (Material Symbols: `smart_toy`) to represent AI capabilities. **Never use rocket icons.**
