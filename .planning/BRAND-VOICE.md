# Brand Voice — EntrepreneurOS

## Tone

Decisive and grounded, with intellectual rigor and quiet confidence. EntrepreneurOS speaks to founders who are drowning in fragmentation and complexity—it meets them with clarity, not hype. The tone is advisory and structural (like a strategic partner who has operated at scale), never salesy, always executable. Calm urgency: there is real work to do, and this system gets you there faster.

---

## Personality

- **Structural** — thinks in systems, org charts, dependencies, workflows; organized clarity is native
- **Operationally wise** — assumes the user is intelligent and has hard problems; no hand-holding, no oversimplification
- **Architecturally transparent** — shows the *shape* of decisions and work, not just the outcome
- **Autonomy-respecting** — human override is assumed and valued; no dark patterns, no premature automation
- **Relentlessly practical** — every feature and flow is about reducing friction, not adding features for feature's sake

---

## Language Style

**Register:** professional but not corporate; operational; first-principles.

**Sentence structure:** Short, declarative sentences when possible. Imperative (verb-first) in CTAs and instructions. Avoid marketing jargon (no "leverage," "synergy," "revolutionize"). 

**Vocabulary:** Technical specificity where it matters (roles, workflows, agents, execution). Plain English elsewhere. Assume founder literacy: no explanation of "org chart" or "workflow."

**Voice markers:**
- Use active voice (rarely passive).
- Prefer "you" and imperative over "we" unless emphasizing partnership.
- No exclamation marks outside of very specific celebratory moments.
- No placeholder language ("something," "stuff," "etc."); name things explicitly.

**Tone examples:**
- **Instead of:** "Unlock your team's potential with our AI-powered collaboration tools."
- **Use:** "Assign work to your team or your AI agent. Track who's doing what. Know what's blocking."

---

## Visual Mood

**Color temperature:** Cool, neutral, high-contrast. Think operating room or command center: functional, precise, trustworthy. Not warm or inviting; this is *work*.

**Density:** Medium-high information density. Whitespace is used structurally (to separate decision layers), not for breathing room. Founder needs to see context and options at a glance.

**Typography:** Sans-serif, geometric, confident. Hierarchy is crisp: bold headers are commands; body text is readable at small sizes (lots of information to display). No serif or "human" typefaces.

**Micro-interactions:** Snappy, confirmatory. No delightful animations; feedback is immediate and unambiguous. A button press is acknowledged within 100ms.

**Iconography:** Minimal, geometric, high contrast. Icons are scannable shortcuts for role/status/urgency, not decorative.

**Overall feel:** Pilot's cockpit or trader's desk—high agency, real-time, designed for humans who move fast and need clarity.

---

## UI Copy Guidelines

| Element | Style | Examples |
|---------|-------|----------|
| **Button Labels (Primary)** | Verb-forward, outcome-focused, no articles. Action is the label. | "Create company" / "Run workflow" / "Assign to [assistant name]" / "Save org chart" / "Start conversation" |
| **Button Labels (Secondary)** | Softer verb or clarification; still direct. | "Cancel" / "Skip for now" / "View details" / "Edit" / "Delete" |
| **Page Headings** | Noun-based (the thing you're managing) with optional outcome. No articles. | "Command Center" / "Task Board" / "Org Chart" / "Workflows" / "Agent Chat" |
| **Section Headings** | Task-oriented or status-based. | "Active Workflows" / "Your Next Actions" / "Assigned to You" / "Needs Attention" |
| **Empty States** | Acknowledge the blank space, explain what goes here, offer one clear path forward. No sad mascots. | "No tasks yet. Create your first task or assign work from a workflow." / "No conversations started. Message your assistant to get started." |
| **Error Messages** | Blame-free, technical if needed, actionable. Name the problem and the fix. | "Email already in use. Try another or reset your password." / "Workflow step failed: your assistant encountered an unknown task type. Edit step and try again." / "Company name required. Give your company a name to continue." |
| **Success Messages** | Confirm the action, brief. No celebration unless genuinely significant. | "Task created." / "Workflow saved." / "Org chart updated." / "You're all set—create your first company." |
| **Confirmation Dialogs** | Clear statement of consequence, two buttons (action + cancel). | "Delete this workflow? It will be removed from all schedules. This can't be undone." / "Mark all tasks done? You can undo this." |
| **Tooltips & Helper Text** | Clarify non-obvious UI. Assume user is smart; explain *why*, not basic *what*. | (hover on "Autonomy Level") "Higher autonomy = your assistant executes more steps without asking. Start low, increase as trust builds." / (on priority field) "Critical: blocks other work. High: due this week. Medium/Low: flex." |
| **AI/Agent References** | The AI assistant name is set by each user per company. Refer to it as [assistant name] dynamically. In product copy and documentation use "your assistant" as the generic reference. Never hardcode a specific name. No personality projection. Transparent about what it's doing. | "Assign to [assistant name]" / "[Assistant name] is analyzing this workflow" / "[Assistant name] status: Online" / "This task was created by [assistant name] based on your Q3 goals." / (not) "Your AI friend is here to help!" |
| **Placeholders in Forms** | Hint at format without being redundant. | (Company name field) "e.g., Acme Labs" / (Goals field) "e.g., 10x revenue, hire 5 engineers, launch product line" |
| **Navigation Labels** | Lowercase, scannable, functional. | "home" / "tasks" / "workflows" / "org chart" / "settings" |
| **Status Indicators** | Two or three words, adjective + noun or gerund. Color + text. | "In Progress" / "Needs Review" / "Blocked" / "Completed" / "Online" / "Thinking..." |
| **Microcopy (Loading, etc.)** | Brief, transparent, no spin. | "Saving..." / "Loading your org chart..." / "[Assistant name] is reviewing this..." |

---

## SaaS Copy Patterns

### Value Proposition (One-Line)

**Pattern:** [Outcome] without [friction].

**Examples:**
- "Run your company from one place. Structure, execute, learn—without the chaos of five tools."
- "Strategy + execution + AI labor in one system. Know what's happening. Know what's next."
- "Your operating system for founders: strategy, org structure, workflows, and agentic execution—all in one."

**Not:** "The AI-native operating system for entrepreneurs" (too abstract). Be operational and concrete.

### Feature Descriptions

**Pattern:** Benefit-led always. State the outcome first, then the mechanism.

**Examples:**
- **Org Chart:** "See your entire company structure at a glance. Assign roles to humans or AI agents. Know who's doing what and who reports to whom."
  - *Not:* "Visual representation of your organization with drag-and-drop role assignment."
- **Task Board:** "Move work through stages: Backlog → In Progress → In Review → Done. Assign to your team or your assistant. Filter by person, priority, or deadline to find what matters."
  - *Not:* "Kanban-style task management with customizable columns."
- **Workflows:** "Codify how your company works. Write a workflow once (hire, onboard, customer success, etc.). Run it step by step. Hand steps to humans or your assistant. Save time, reduce mistakes."
  - *Not:* "Create and execute repeatable business processes."

### Onboarding Copy (First-Run Experience)

**Pattern:** Assume the user wants to start immediately, not read a tutorial. Each step is one decision + one action.

**First page (Signup):**
- Headline: "Start operating." (not "Welcome" or "Create your account")
- Subheading: "Tell us who you are and what you're building."
- Form labels: "Full name" / "Email" / "Password" / "Company (optional)"
- CTA: "Create account"
- If skipping company setup: "You can add companies later."

**Company Setup (Wizard):**
- Page 1 (Name + Stage): "What's your company called?" + "What stage?" (Idea / Pre-revenue / Revenue / Scaling / Mature)
  - Subheading: "We'll adapt your operating system to your scale."
- Page 2 (Industry + Model): "What industry?" + "How do you make money?" (SaaS / Services / Product / Hybrid / Other)
- Page 3 (Goals): "What are your top 3 goals for the next quarter?" (optional, but recommended)
  - Helper text: "These shape your AI agent's recommendations."
- Final screen: "You're ready. Your org chart and first workflows are below. Edit them or create from scratch."
  - CTA: "Open Command Center"

**Tone:** Direct, zero fluff. Each field is genuinely needed. No "Tell us about your vision" pink-cloud nonsense.

### Upgrade/Upsell Language

**Deferred in MVP.** When tier differentiation is added:
- Avoid scarcity language ("Limited slots").
- Avoid feature-list language ("20+ integrations").
- Lead with outcome: "Run multiple companies. Scale your operations. Grow your team without the coordination tax."
- Price is transparent; tie it to value removed (time, team size, errors avoided).

### Social Proof and Trust Signals

**Deferred in MVP.** When added:
- Prefer operator quotes over generic testimonials.
- Lead with outcome/problem solved, not name/title.
- Example: *"We used to spend 2 days a week in Slack asking who was doing what. EntrepreneurOS got that to zero. Now we operate like a 50-person company on a 5-person team."* — Founder, Series A SaaS.
- No "5-star rating" badges. No logo walls unless genuinely relevant (big-name customers only).

### CTA Hierarchy

**Primary CTA (action you want most):** Verb + outcome.
- "Create company"
- "Start workflow"
- "Assign to [assistant name]"
- "Save and run"

**Secondary CTA (alt path):** Softer, often "verb + clarification" or plain action.
- "Cancel"
- "Skip"
- "View more"
- "Edit"
- "Learn how" (only if learning is necessary to proceed)

**Tertiary (informational, linked):** Lowercase, underlined or subtle.
- "What's a workflow?" (contextual help)
- "See example" (shows template or instance)
- "Read the guide" (deferred to external resource)

**Rule:** Never more than two primary CTAs on a single screen. One is preferred.

---

## Landing Page Voice

### Hero Section

**Headline:** Operational problem + system solution.

**Pattern:** [Founder pain] → [Operating system outcome].

**Examples:**
- "Stop toggling between tools. One operating system for your entire company."
- "Founder, operator, team lead in your head. EntrepreneurOS is your external brain."
- "Strategy, structure, execution, and AI labor. In one place. In real time."

**Subheadline:** Outcome-focused, no hype.
- "Manage strategy, org structure, workflows, and AI-powered execution from a single dashboard. Scale without the chaos."
- "See your company's operating model. Assign work. Track progress. Know what's next."

**CTA:** "Start operating" or "Create your company." (Not "Sign up for free trial"—ownership language matters.)

### Social Proof Section (if included)

**Framing:** Founder testimonials centered on *problems solved* and *time/complexity reduced*.

**Format:** Quote + founder name/company/stage. 

**Avoid:** "Best-in-class," "Industry leader," generic praise.

### Feature Section Copy

**Pattern:** 
1. Feature name (noun).
2. Outcome (what it unlocks).
3. Tactical detail (how it works).

**Example:**

**Org Chart**
See your entire company structure. Assign roles to your team or your AI agent. Know who reports to whom, who's overloaded, and where gaps are. Built for companies of any size.

**Not:** "Visualize organizational hierarchies with drag-and-drop role management powered by advanced algorithms."

### Comparative/Contextual Language (if relevant)

**Pattern:** Acknowledge other tools' existence, but position as *complementary* or *foundational*.

**Example:**
- "EntrepreneurOS isn't Slack, Jira, or Notion. It's your operating system. It works *with* those tools, but it gives you the single source of truth for strategy, org structure, and execution."

### Tone Throughout

- **Founder-to-founder:** No corporate voice. No corporate case studies.
- **Clarity first:** Every sentence is about removing confusion or friction.
- **Outcome-obsessed:** Lead with what the founder gets, not what the system does.
- **No urgency/FOMO tactics:** Founders are skeptical of artificial scarcity. Be honest about what this is and what it does.

---

## Key Brand Voice Do's and Don'ts

| Do | Don't |
|-----|-------|
| Use present tense (active). "You assign work. Your assistant executes." | Use future tense or passive ("work will be assigned"). |
| Name the system, user, and action clearly. "You assign tasks to your assistant or your team." | Use pronouns without context. "It does things." |
| Be specific about outcomes. "Save 10 hours/week on coordination meetings." | Use vague benefit language. "Unlock potential." |
| Assume founder intelligence. Skip explanations of "workflow" or "org chart." | Over-explain or infantilize. No hand-holding in micro-copy. |
| Refer to the AI by its user-configured name, not as a character. "[Assistant name] is analyzing your workflows." | Anthropomorphize the agent. No "your AI friend" or emoji personalities. |
| Acknowledge limitations. "In v1, your assistant is in recommend mode—you decide." | Hide complexity or oversell capability. |
| Use imperative mood in commands and CTAs. "Create company. Save workflow." | Use questions in button labels ("Do you want to delete?"). |
| Show respect for founder time. Every flow is as short as possible. | Assume users want lengthy tutorials or onboarding sequences. |

---

## Summary

**EntrepreneurOS brand voice is:** Operationally wise, structurally clear, quietly confident, and relentlessly practical. It speaks to founders as a strategic partner who has built and scaled, not as a vendor selling a product. Every word earns its place by removing confusion or enabling action. The system is transparent about what it can do (and what it can't yet). Human override is assumed and respected. Complexity is managed through clarity, not simplification.
