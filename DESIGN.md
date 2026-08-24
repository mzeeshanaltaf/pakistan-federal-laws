<!-- SEED — re-run $impeccable document once there's code to capture the actual tokens and components. -->

---
name: Qanoon
description: A plain-language, citation-grounded guide to Pakistan's federal statutes.
---

# Design System: Qanoon

## 1. Overview

**Creative North Star: "The Reading Room"**

Qanoon reads like a well-run reading room, not a law firm's lobby or a SaaS dashboard: quiet, well-lit, built for someone to sit with a dense paragraph and a source document side by side and check it themselves. The palette stays restrained — tinted neutrals carrying the reading surface, a single deep-ink accent marking what actually matters (an active citation, the current scope, a link to the source page) rather than decorating the chrome around it. Typography is a single humanist sans doing all the work, because the text itself — statute excerpts, citations, plain-language explanation — is the content, not a backdrop for branding.

This system explicitly rejects the navy-and-gold law-firm palette and everything inherited from the sibling DocGenie project (no emerald). It also rejects both failure modes a civic tool tends toward: corporate SaaS gloss (gradient heroes, abstract blob illustrations, dashboard-as-marketing, the hero-metric template) and sterile government-portal starkness (cold, bureaucratic, unwelcoming). The room is calm, not cold; precise, not corporate.

**Key Characteristics:**
- Restrained color, one accent, used sparingly and always tied to something the user can verify.
- A single sans typeface carrying both UI chrome and dense reading text — no ornamental display face.
- Motion earns its keep: streaming text, a citation panel sliding into view, loading state — never orchestrated or scroll-driven.
- Flat by default; elevation appears only as a response to interaction, never as decoration.

## 2. Colors

Restrained strategy: tinted neutrals carry the reading surface, one accent hue marks what's active or verifiable.

### Primary
- **Deep Ink Indigo** (`[to be resolved during implementation]`): the single accent. Anchors citation markers, the active scope selector, links to source pages, and focus states. Deliberately not navy (too legal-cliché) and not a generic tech blue (too SaaS) — a muted blue-violet closer to ink on paper than to a brand color.

### Neutral
- **Warm paper neutrals** (`[to be resolved during implementation]`): the dominant surface — background, card/panel fills, borders, secondary text. Tinted warm rather than cold-gray, so long reading sessions don't feel clinical.

### Named Rules
**The One Accent Rule.** Deep ink indigo appears on ≤10% of any given screen, and only ever on something the user can act on or verify — never as pure decoration.

## 3. Typography

**Body/UI Font:** Single humanist sans (`[font pairing to be chosen at implementation]`)

**Character:** Calm and legible at both UI-chrome scale and dense-paragraph scale — no separate display face to keep in register. Hierarchy comes from weight and size, not from switching typefaces.

### Hierarchy
- **Headline** (medium/semibold weight, larger scale): page and section titles — sparing, since most surfaces are reading-first.
- **Title** (medium weight): law titles, category names, question chips.
- **Body** (regular weight, capped at 65-75ch): statute excerpts, chat answers, summaries — the bulk of the interface.
- **Label** (medium weight, smaller scale): citation markers, metadata (page numbers, category tags, timestamps).

### Named Rules
**The One Voice Rule.** One typeface family for the entire interface. If a heading needs more weight, it gets a heavier cut of the same face, not a different one.

## 4. Elevation

Flat by default. The reading surface has no ambient shadow — elevation appears only as a direct response to interaction: the citation reference panel sliding in over the page, a focused input, a chip in its pressed state. Responsive motion, not layered chrome, is what conveys "this is now active."

## 6. Do's and Don'ts

### Do:
- **Do** keep the accent (deep ink indigo) tied to verifiable, actionable elements only — citation markers, active scope, source links.
- **Do** let statute text and chat answers be the visual focus of every reading surface; chrome stays quiet.
- **Do** use full borders, background tints, or nothing for emphasis — never a colored stripe.
- **Do** use a side panel for the citation/reference preview, never a modal, per the product's own affordance choice.

### Don't:
- **Don't** use navy-and-gold or any other "legal industry" palette cliché.
- **Don't** reuse anything from DocGenie's visual identity, including its emerald accent.
- **Don't** reach for corporate SaaS gloss: gradient hero sections, abstract blob illustrations, dashboard-as-marketing, the hero-metric template (big number + small label + gradient accent).
- **Don't** default to sterile government-portal starkness — cold, bureaucratic, form-first layouts with no warmth.
- **Don't** use `border-left`/`border-right` as a colored accent stripe on cards, list items, or alerts.
- **Don't** use gradient text (`background-clip: text` with a gradient) for emphasis — weight or size only.
- **Don't** use glassmorphism decoratively.
- **Don't** reach for a modal as the first instinct — exhaust inline and side-panel alternatives first.
- **Don't** orchestrate scroll-driven or entrance choreography — motion stays responsive to direct interaction, not staged.
