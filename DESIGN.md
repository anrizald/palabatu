---
name: Palabatu
description: Community map, logbook, and profile app for Indonesian bouldering climbers.
colors:
  ember-orange: "#c87a30"
  scorched-umber: "#8b4a18"
  on-accent: "#fef3e6"
  deep-basalt: "#0f0d0b"
  charcoal-panel: "#141210"
  ash-surface: "#1a1612"
  cold-slate: "#2a2420"
  chalk-parchment: "#f0e0c8"
  sun-faded-parchment: "#d8c8b8"
  weathered-stone: "#967b6a"
  dusk-stone: "#6a5848"
  faint-stone: "#4a3c30"
  moss-green: "#5dbb6a"
  moss-green-dark: "#3a8a45"
  ember-red: "#e07060"
typography:
  display:
    fontFamily: "'Playfair Display', serif"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Playfair Display', serif"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'DM Sans', sans-serif"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "10px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "linear-gradient(145deg, {colors.ember-orange}, {colors.scorched-umber})"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "11px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.dusk-stone}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "11px 24px"
  card:
    backgroundColor: "{colors.charcoal-panel}"
    textColor: "{colors.chalk-parchment}"
    rounded: "{rounded.lg}"
    padding: "18px"
  input:
    backgroundColor: "{colors.ash-surface}"
    textColor: "{colors.sun-faded-parchment}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: Palabatu

## Overview

**Creative North Star: "Ember & Sandstone"**

Palabatu is a boulder at dusk: near-black stone (`#0f0d0b`–`#1a1612`) holding the last warmth of an ember-orange accent (`#c87a30`), with text the color of chalk on old sandstone (`#f0e0c8`). The system is single-theme dark — there is no light mode, and depth comes from tonal layering (ink → panel → surface, each a shade lighter) rather than shadows. Two serif/sans faces carry the whole voice: Playfair Display for anything that should feel like a signature or a headline, DM Sans for everything you actually read and interact with.

The mood is warm and grassroots — this is a community-run app for climbers, not a SaaS dashboard — and every screen should be checked against that: no glossy everywhere-gradients, no generic blue-accent dashboard look, nothing that reads as a stock tech-startup template. That warmth doesn't mean unfinished — the grassroots feel and a credible, premium level of polish coexist; sloppy execution is not part of the aesthetic.

Components should feel **tactile and warm**: soft radii, an accent-tinted glow on primary actions, a gentle lift on hover for anything clickable. Nothing here is clinical or flat-by-decree — the one deliberate restraint is that the ember accent stays rare, so its glow still reads as warmth rather than noise.

**Key Characteristics:**
- Single dark theme; depth via tonal layering (ink/panel/surface/border), not drop shadows on static content.
- One accent color, used sparingly, always warm (ember-orange gradient), never a second competing hue for primary actions.
- Playfair Display for display/headline moments only; DM Sans for everything else — never mixed within the same text block.
- Shadows reserved for things that float above the page (modals, dropdowns, toasts, the mobile drawer) and for the accent-tinted glow under primary CTAs.

## Colors

A near-black stone palette with one warm accent and a narrow, warm-toned neutral ramp for text — no cool grays anywhere in the system.

### Primary
- **Ember Orange** (`#c87a30`): the single accent. Primary CTAs, active nav state (underline glow), focus borders, links to attention, "sent" hover on map pins. Used on a deliberately small fraction of any screen — its rarity is the point.
- **Scorched Umber** (`#8b4a18`): the accent's gradient partner, always paired with Ember Orange at `linear-gradient(145deg, ember-orange, scorched-umber)` on primary buttons — never used alone.

### Neutral
- **Deep Basalt** (`#0f0d0b`): page background (`ink`). The darkest surface in the system.
- **Charcoal Panel** (`#141210`): one step lighter than Deep Basalt. Cards, the header bar (at 90% opacity with a blur), the mobile drawer.
- **Ash Surface** (`#1a1612`): the lightest of the three dark surfaces. Inputs, form fields, anything meant to read as "inset" relative to a panel.
- **Cold Slate** (`#2a2420`): borders and dividers between all of the above.
- **Chalk Parchment** (`#f0e0c8`): primary text, on any dark surface.
- **Sun-Faded Parchment** (`#d8c8b8`): secondary text — input values, card body copy.
- **Weathered Stone** (`#967b6a`): muted text — inactive nav links, placeholders, secondary labels, helper copy. **The floor for anything made of words.** Raised 2026-08-09 from `#8a7060`, which measured 3.91:1 against panel and surface and therefore failed WCAG AA at the 11–13px sizes this system actually uses. The new value measures 4.58:1 on Ash Surface and 4.75:1 on Charcoal Panel. It is a ~6% lift — visually near-identical, and it crosses AA.
- **Dusk Stone** (`#6a5848`): **non-text only** — disabled controls, input placeholders where the placeholder is an example rather than information, decorative dividers. Was previously used for label text; it does not pass at label sizes.
- **Faint Stone** (`#4a3c30`): **never text.** Hairlines, decorative rules, dashed borders. It measures 1.76:1 on panel, which is not "subtle", it is invisible. Its earlier description in this file ("reserve for text that should barely register") is what produced unreadable helper copy in the add-flow prototypes and has been removed deliberately.

### Semantic
- **Moss Green** (`#5dbb6a`, deep variant `#3a8a45`): the "Associate" admin badge and success/sent states. The only cool-leaning hue permitted in the system — keep it rare and only for its semantic role.
- **Ember Red** (`#e07060`): danger, destructive actions, error states, logout-hover.

### Named Rules
**The Sentence Rule.** *(Added 2026-08-09.)* If it is made of words, it is at least Weathered Stone. Dusk Stone and Faint Stone are structural colors — borders, hairlines, disabled states, decoration — and never carry copy. This app is used outdoors in direct sunlight on low-end Android panels (see PRODUCT.md's operating context); a contrast ramp tuned in a dark room on a good screen is tuned for the wrong conditions. When a piece of text feels too loud at Weathered Stone, cut the text or shrink its role — do not dim it below the floor.

*Swept across the codebase 2026-09-01.* The rule was written 2026-08-09 but never applied backwards, so ~130 uses of `text-text-dim` (Dusk Stone) carried copy, `text-text-faint` (Faint Stone) carried copy on the profile page, three inputs used Faint Stone placeholders that this file's own 2026-08-09 correction had already reassigned to Dusk Stone, and roughly 30 hardcoded `#8a7060` literals were still on the *pre-correction* Weathered Stone that measured 3.91:1. The worst single case was `Footer.tsx`, which set its credit line in `#2a2420` — Cold Slate, the *border* token — at 1.27:1, on every page in the app; it now sits at Weathered Stone and one step smaller, which is the remedy this paragraph prescribes. Measured after: zero text nodes below 4.5:1 on Landing, Login, the profile page, and All Problems.

Three things deliberately keep Dusk/Faint Stone, and they are the rule's own carve-outs rather than misses: bare icons and icon-only buttons (not words), decorative separator dots, and input placeholders. One more is a genuine exception worth knowing about — the Leaflet map popups (`PinpointMarker`, `BoulderPinMarker`, `ApproachStartMarker`) paint **dark-on-light parchment**, not light-on-dark, so the same hex there is a different contrast sum entirely and is correct as-is. Check which way a surface runs before "fixing" a color on it.

**The One Ember Rule.** Ember Orange is the only warm accent used for action and attention. A second hue competing for the same role (a second "brand color") is a bug, not a design choice — new UI reaches for Moss Green or Ember Red only for their specific semantic roles (success/associate, danger), never as a second general-purpose accent.

## Typography

**Display Font:** Playfair Display (with `serif` fallback)
**Body Font:** DM Sans (with `sans-serif` fallback)

**Character:** A confident, editorial serif for anything that should feel like a signature moment, paired with a plain, warm humanist sans for everything functional. The pairing is what keeps "grassroots" from reading as "amateur" — the serif supplies credibility, the sans stays out of the way.

### Hierarchy
- **Display** (weight 900, `clamp(32px, 6vw, 64px)`, line-height 1, letter-spacing -0.01em): hero headlines only (Landing page hero line).
- **Headline** (weight 700, line-height ~1.15): section headings, modal titles, card titles, the nav wordmark.
- **Body** (weight 400, line-height 1.5): all reading content — card copy, comments, descriptions. A lighter weight 300 cut of DM Sans exists in the loaded font set for taglines/subheads that want to feel quieter than body copy; use it sparingly, never for primary reading text.
- **Label** (weight 500, line-height 1.3): buttons, nav links, form labels, anything short and interactive.

### Named Rules
**The Two-Font Rule.** Every piece of text is either Playfair Display (display/headline) or DM Sans (body/label) — never a third face, never Playfair Display below headline size, never DM Sans for a hero line.

## Layout

Primarily flexbox; CSS Grid appears in exactly one place (the profile page's sidebar+content split) and isn't a general pattern yet. Page sections use a `1100px` max-width, centered container; modals and cards instead size themselves per-component (`440px`–`760px`) rather than sharing one container class.

Responsive behavior is currently split between two systems: Tailwind's `sm:` prefix (the only Tailwind breakpoint in use — no `md:`/`lg:`/`xl:`) on newer components, and hand-written `@media` queries at `640px` and `768px` on older ones. Both target roughly the same phone/tablet boundary; treat `640px`–`768px` as the one real breakpoint band in this system rather than a full multi-tier grid.

### Named Rules
**The One Breakpoint Rule.** Design for two states — phone and "wider than phone" — around the 640–768px band. Don't design a three- or four-tier responsive system; nothing in the app currently needs it, and CLAUDE.md's mobile-first PWA framing means the phone layout is the primary one to get right, not the desktop one.

## Elevation & Depth

Depth is tonal, not shadow-based, for anything sitting flat on the page: Deep Basalt → Charcoal Panel → Ash Surface is the resting-depth ladder, and a card's "raised" feeling on hover comes from a `translateY(-4px)` lift plus a border-color shift to Ember Orange, not from a shadow appearing. Shadows are reserved for things that visually float above the page: modals, dropdowns/popovers, the mobile drawer, toasts, and floating tooltips. On top of that, primary buttons get a second, distinct shadow role — an accent-tinted glow (the shadow's own RGB is the accent color's, not a neutral gray) that signals "this is the action to take," separate from the "this is floating above other content" role.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 40px 80px rgba(0,0,0,0.6)`): modals — the largest, softest shadow in the system.
- **Popover** (`box-shadow: 0 12px 32px rgba(0,0,0,0.5)`): dropdowns, notification panels.
- **Floating** (`box-shadow: 0 4px 12px–24px rgba(0,0,0,0.4–0.5)`): toasts, map search box, small tooltips, the mobile drawer (`-4px 0 24px`).
- **Accent Glow** (`box-shadow: 0 2px 8–16px rgba(200,122,48,0.25–0.4)`): primary CTA buttons only. Uses the accent's own color, not black.

### Named Rules
**The Floating-Only Rule.** A shadow means "this is above the page" or "this is the primary action." Static page content — cards, panels, list rows — never gets a shadow at rest; use the tonal ladder and border-color instead.

## Shapes

Corners are consistently soft, never sharp, but the exact scale isn't fully unified yet — treat the values below as the canonical scale going forward, and read the Do's/Don'ts for the one known inconsistency to fix rather than propagate.

- **`sm` (8px):** small pill buttons, the nav sign-up CTA.
- **`md` (10px):** the most common radius — inputs, small buttons, image thumbnails.
- **`lg` (16px):** cards.
- **`xl` (20px):** modals — the canonical modal radius going forward (see Don't below).
- **`full` (9999px / 50%):** avatars, badges, circular icon buttons (map zoom/locate/FAB).

Borders are always 1px, always Cold Slate at rest, and switch to Ember Orange on hover/focus rather than changing width or style.

## Components

### Buttons
- **Shape:** `md` (10px) for standard buttons; `full` for circular icon buttons (map controls, FAB).
- **Primary:** `linear-gradient(145deg, ember-orange, scorched-umber)` background, `on-accent` (#fef3e6) text, label typography, Accent Glow shadow. Disabled state is `opacity: 0.5` plus `cursor: not-allowed` — never a desaturated color swap.
- **Secondary/Ghost:** transparent background, 1px Cold Slate border, dusk-stone text, same radius and padding as primary. No shadow.
- **Hover/Focus:** primary buttons don't shift color on hover (opacity/shadow only); the map FAB is the one exception, adding `transform: scale(1.1)`. Secondary buttons and inputs shift border-color to Ember Orange on focus.

### Cards
- **Corner Style:** `lg` (16px).
- **Background:** Charcoal Panel.
- **Shadow Strategy:** none at rest (see Elevation & Depth) — `translateY(-4px)` lift plus border-color → Ember Orange on hover instead.
- **Border:** 1px Cold Slate at rest.
- **Internal Padding:** 18px.

### Inputs / Fields
- **Style:** Ash Surface background, 1px Cold Slate border, `md` (10px) radius, Sun-Faded Parchment text, Dusk Stone placeholder text. *(Corrected 2026-08-09 alongside the Sentence Rule — this previously said Faint Stone, which the Colors section now forbids as a text color. Dusk Stone is the placeholder tier because a placeholder like "Add a comment" is an example, not information, matching its designated role.)*
- **Focus:** border-color → Ember Orange. Implement via CSS `:focus`/`focus:` pseudo-classes, not manual `onFocus`/`onBlur` JS handlers — some older forms (`Login.tsx`) still do it manually; new inputs should use the CSS pseudo-class approach the newer Tailwind-idiom components already use.
- **Error/Disabled:** no established pattern yet — when one is needed, borrow Ember Red for the error border/text rather than inventing a new hue.

### Navigation
Fixed top bar, 60px tall, translucent Deep Basalt (`rgba(15,13,11,0.9)`) with `backdrop-filter: blur(12px)`, 1px bottom border. Inactive links are Weathered Stone, hover brightens to Sun-Faded Parchment, active state is Chalk Parchment text plus an inset Ember Orange underline (`box-shadow: inset 0 -2px 0 0 ember-orange`) rather than a border property. Below the ~768px band, the desktop link row is replaced by a hamburger button that opens the mobile drawer (Charcoal Panel background, spring-animated slide-in, `-4px 0 24px` shadow).

### Signature: the accent glow
The single most identity-defining visual move in this system is the accent-colored (not neutral-colored) shadow under primary actions and the accent-colored inset underline for active nav — depth and state, in this system, are frequently expressed in the accent hue rather than in gray. Any new "this is active / this is the primary action" treatment should reach for this pattern before inventing a new one.

## Do's and Don'ts

### Do:
- **Do** use the `@theme` tokens in `src/index.css` (`bg-panel`, `text-accent`, `font-serif`, etc.) for new or rewritten components, rather than hand-rolled hex literals — the codebase's own comments mark this as the intended direction, and it's what keeps this DESIGN.md's tokens as the actual source of truth instead of documentation of a moving target.
- **Do** keep shadows reserved for floating UI and primary-button glow; use the tonal ladder (ink → panel → surface) plus border-color shifts for everything else.
- **Do** implement input/link focus and hover states as CSS pseudo-classes (`:focus`, `:hover`, `focus-visible:`), not manual JS `onFocus`/`onBlur` style mutation.
- **Do** keep Ember Orange rare — one accent, used deliberately, not spread across multiple simultaneous elements on the same screen.

### Don't:
- **Don't** introduce a second accent hue for a general "primary" role — Moss Green and Ember Red are semantic-only (success/associate, danger).
- **Don't** mix modal radii — `AddProblemModal`/`Login`/`ReportModal`/the profile avatar card use 20px while `ProblemDetails`' main modal uses 24px (`rounded-3xl`) for the same "large modal panel" role; converge new and touched modals on `xl` (20px).
- **Don't** add a neutral-gray `shadow-md`/`shadow-lg` Tailwind utility to static page content (cards, list rows, panels) — this system has never used plain Tailwind shadow utilities, only arbitrary values reserved for floating UI.
- **Don't** use Playfair Display below headline size, or DM Sans for a hero-scale headline — the two-font split is role-based, not just a stylistic default.
- **Don't** add a third Tailwind breakpoint tier (`md:`/`lg:`/`xl:`) without a real reason — the system has deliberately stayed at one phone/wider-than-phone boundary.
