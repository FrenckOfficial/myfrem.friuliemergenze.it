---
name: "myfrem.friuliemergenze.it Design System"
description: "Framework-agnostic design rules for web and mobile app implementation."

# ─── Colors ───────────────────────────────────────────────
colors:
  # Brand
  primary:       "existing primary color"
  primaryStrong: "existing strong primary color"
  primarySoft:   "existing soft primary color"
  accent:        "existing accent color"

  # Surfaces
  surface:       "existing surface color"
  surfaceMuted:  "existing muted surface color"

  # Text & Border
  text:          "existing text color"
  border:        "existing border color"

  # Feedback
  success:       "existing success color"
  warning:       "existing warning color"
  danger:        "existing danger color"

# ─── Typography ───────────────────────────────────────────
typography:
  family:        "existing primary font stack"
  displayFamily: "existing display font stack"
  monoFamily:    "existing monospace font stack"
  source:        "existing typography"
  weights:       "existing type scale weights"
  defaultWeight: 400
  tone:          "existing"

# Spacing
spacing:
  xs:      4px
  sm:      8px
  md:      12px
  lg:      16px
  xl:      24px
  xxl:     32px
  section: 48px

# Radius
radius:
  sm: 4px
  md: 8px
  lg: 12px

# Motion
motion:
  fast:   120ms
  normal: 180ms
  slow:   260ms
---

# Design System Rules

## Purpose
myfrem.friuliemergenze.it Design System defines portable, framework-agnostic design rules for web and mobile product interfaces. Use it as the source of truth before changing layouts, components, color, typography, motion, or interaction states.

This file is a portable design skill. Any AI or engineer should be able to read it and improve a web or mobile interface without needing React, Vue, Svelte, Tailwind, native mobile, or any other specific technology.

## Operating Modes

### New Project Mode
- Use these rules to create a coherent first implementation when no existing UI exists.
- Build the information architecture, component system, and responsive behavior from the tokens and rules below.

### Existing Project Refactor Mode
- Treat the existing product as the source of truth for content, routes, behavior, data, and information architecture.
- Improve the visual system by patching styles, tokens, spacing, typography, hierarchy, responsive behavior, and component states.
- Do not regenerate whole pages from scratch when a targeted patch can preserve the current experience.
- Do not replace real content with placeholder, demo, lorem ipsum, or simplified content.
- If a section looks inconsistent with this design system, restyle it first. Do not remove it.
- If removing content, routes, features, media, or data logic seems necessary, stop and ask for approval.

## Preservation Rules For Existing Products
- Preserve all existing headings, paragraphs, labels, buttons, links, images, icons, forms, navigation items, sections, routes, and data-fetching logic unless the user explicitly requests removal.
- Preserve semantic meaning and section order unless the user asks for an information-architecture change.
- Preserve working interactions: forms, menus, language toggles, theme toggles, dialogs, tabs, carousels, and scroll behavior.
- Preserve real brand/product names and domain-specific copy. Design changes must not make the page generic.
- Keep every original section represented after the refactor. A redesigned section is acceptable; a missing section is not.
- Never leave the first viewport empty unless the existing product intentionally has an empty state.

## Safe Refactor Workflow
1. Read the existing UI code before editing. Identify sections, routes, state, data dependencies, and user actions.
2. Inventory current colors, typography, spacing, radius, shadows, and component states.
3. Map old visual values to the tokens in this file one-to-one where possible.
4. Patch section by section. Avoid full-file rewrites when the current structure works.
5. After each section, verify the original content is still present, visible, and reachable.
6. After changing colors, check every affected text/background pair for contrast.
7. Verify desktop and mobile before finishing.

## Visual Direction
- Color direction: Existing Colors - Preserve the product's current color palette and semantic color roles..
- Typography direction: Existing Typography - Preserve the product's current font stack, type scale, and text rhythm..
- Style direction: Dashboard - Operational SaaS dashboards with KPI cards, chart panels, side rails, filters, and fast scanning
- References: Finance analytics dashboards, SaaS admin consoles, Dark sales dashboards, Property management dashboards, Audience reporting tools.
- Visual style: Existing Colors color direction, Existing Typography typography, Dashboard style.

## Style System: Dashboard
Use Dashboard to create operational product interfaces where users monitor metrics, compare trends, manage records, and take quick contextual actions. The style is built around KPI cards, sparklines, chart panels, map/report widgets, side navigation, topbar search, filters, profile controls, and compact status chips. It works best for finance, sales, property, marketing, analytics, admin, CRM, and project dashboards. The result should feel like a real app surface, not a landing page: dense enough to work, calm enough to scan.

### Layout Rules
- use a real app shell: sidebar or icon rail, topbar with search and profile actions, then a structured dashboard grid.
- start with compact KPI cards for immediate overview; each card should include label, value, trend, and optional sparkline or icon.
- use a 12-column or 16-column grid to mix compact stat cards, wide charts, medium widgets, and narrow side panels.
- reserve the largest center area for the primary chart, map, timeline, or report; supporting widgets should wrap around it.
- keep light dashboards on soft gray or off-white backgrounds with white cards and subtle shadow; use dark mode only when the product needs a pro/monitoring feel.
- use rounded cards consistently, but avoid decorative card nesting; widgets are cards, page sections are layout regions.
- place filters, date pickers, view toggles, export actions, and overflow menus inside or above the data panel they control.
- mobile layout should stack by priority: header/search, KPI strip, primary chart, urgent tasks/events, then secondary widgets.

### Component Patterns
- metric cards must display one primary number, one label, one trend indicator, and optional sparkline; avoid mixing multiple unrelated metrics in one card.
- charts should have clear titles, axis context, legends, hover markers, selected points, and empty/loading states.
- large chart cards can include date selectors, segmented filters, export buttons, view menus, fullscreen buttons, and contextual legends.
- tables and activity lists should use clear row rhythm, stable columns, avatars or icons where useful, and visible sort/filter affordances.
- sidebars should group navigation into sections, show active state clearly, and support compact icon-rail mode.
- topbar search should be visible but visually quiet; notification, settings, and profile actions belong at the right edge.
- status indicators should use color consistently: green for positive, red for negative, amber for warning, blue/purple for neutral activity, gray for inactive.
- empty states should stay inside their card, preserve card height, and offer one clear next action.

### Existing Project Refactor Rules
- inventory the existing interface first: navigation, metrics, charts, tables, filters, actions, and settings.
- preserve all data points and map them to appropriate dashboard widgets: KPI, chart, table, list, profile, calendar, map, or status panel.
- do not remove data or metrics to simplify the layout; reorganize and prioritize instead.
- patch card sizes, grid spans, spacing, and visual hierarchy section by section.
- if a section has too much data for one card, split it into related widgets with one clear purpose each.
- when adding chart placeholders, include labels, axes, legends, selected value markers, and realistic loading/empty states.
- if the product has no metrics or data, use a different style — Dashboard requires content to work.
- preserve filter, sort, and action capabilities on all data views.
- when restyling an existing dashboard, keep user workflow speed: do not hide primary filters, search, create actions, or drill-down paths.

### Spacing Rules
- use tight, efficient spacing: 8px to 12px between related items, 16px to 24px between card groups.
- card padding should be 18px to 28px for standard widgets, 12px to 18px for compact KPI cards.
- page padding should be 24px to 32px on desktop, 16px to 20px on mobile.
- keep gutters consistent at 16px to 24px in the main grid.
- use a max width of 1440px to 1680px for large dashboards; full-width layouts are acceptable for dense monitoring views.
- sidebar width should be 220px to 280px, collapsible to a 64px to 84px icon rail on smaller or data-heavy screens.
- topbar height should stay compact: 56px to 72px, with controls aligned to a stable baseline.
- avoid excessive whitespace that pushes important data below the fold.

### Visual Hierarchy Rules
- make numbers and chart shapes the visual anchors; chrome, navigation, and controls should remain quieter.
- use soft elevation, pale borders, or tonal surfaces to separate cards from the app background.
- primary actions should be compact, contextual, and easy to find near the data they affect.
- use consistent typography: page title, section title, card title, metric number, label, and microcopy should each have a stable role.
- trend indicators must be immediately visible and paired with labels, arrows, or signs so color is not the only signal.
- chart titles, legends, axes, selected values, and date ranges should be scannable without zooming.
- light mode should feel airy and financial/productive; dark mode should feel focused, with restrained neon accents for live/positive values.

### Style Anti-patterns
- use decorative elements that compete with data for attention.
- hide important metrics below the fold without a clear scroll path.
- use inconsistent card sizes or spacing that makes the grid feel random.
- add animations or effects that slow down data scanning.
- use low-contrast text for labels or data values.
- overload a single card with too many data points or charts.
- use landing-page hero patterns, oversized marketing copy, or decorative illustrations in place of useful dashboard content.
- remove filters, legends, table controls, or drill-down affordances to make the interface look cleaner.

### Style Checklist
- summary metrics are visible in the first viewport.
- charts and tables have clear labels, legends, and context.
- card layout is consistent and scannable.
- filters and actions are placed near the data they control.
- color is used semantically for status and trends.
- the page feels data-dense but not cluttered.
- mobile layout prioritizes the most important data.
- the app shell includes sensible navigation, search, profile/notification actions, and responsive behavior.
- every widget has a clear purpose: KPI, chart, list, map, profile, schedule, status, or action panel.

## Design Tokens
Use semantic tokens first. Raw values from frontmatter are source values, not permission to scatter hex codes or one-off sizes through implementation.

### Color
- Primary action color: existing primary color.
- Strong primary: existing strong primary color. Use for high-emphasis text, selected state, or strong borders.
- Soft primary: existing soft primary color. Use for subtle surfaces, selected backgrounds, or calm highlights.
- Surface: existing surface color.
- Muted surface: existing muted surface color.
- Text: existing text color.
- Border: existing border color.
- Success, warning, and danger are semantic states. Pair them with labels, icons, or position; never rely on color alone.
- When moving from a dark theme to a light or warm theme, update inherited light text classes such as white, muted-white, or low-opacity foregrounds.
- Do not apply one warm/cream/brown palette across the entire page without contrast, hierarchy, and content anchors.

### Text Selection
- Use this style-specific `::selection` treatment for Dashboard. It should follow the selected color tokens and stay readable.
```css
/* Dashboard selection: calm data highlight. */
::selection {
  background-color: existing soft primary color;
  color: existing text color;
  text-shadow: none;
}
```
- If the selected color changes, keep the same style behavior but re-check text/background contrast.

### Contrast And Visibility Gate
- Every visible text node must remain readable after color changes.
- Check hero text, navigation, buttons, card titles, form labels, helper text, icons, borders, and disabled states against their actual backgrounds.
- If legacy classes or CSS keep text white on a light surface, replace them with semantic foreground tokens.
- If content appears missing after a restyle, inspect contrast and visibility before deleting or rebuilding the section.
- Do not finish with invisible text, hidden CTAs, empty hero areas, or decorative backgrounds replacing product content.

### Typography
- Primary family: existing primary font stack.
- Display family: existing display font stack.
- Monospace family: existing monospace font stack.
- Allowed weights: existing type scale weights.
- Default UI weight: 400.
- Keep heading levels semantic. Visual size must follow layout importance, not HTML heading number.
- Keep letter spacing at 0 by default. Use uppercase labels sparingly and only for short metadata.

### Spacing And Radius
- Spacing scale: 4/8/12/16/24/32/48.
- Prefer spacing and grouping over extra borders.
- Use 4px radius for compact controls, 8px for standard cards/inputs, and 12px only for larger feature surfaces.
- Do not invent new spacing values unless the layout cannot be solved with the scale.

## Layout Rules
- Start mobile-first. The smallest useful viewport defines the base layout.
- Use content-driven breakpoints. Do not scale type directly with viewport width.
- Keep navigation, primary actions, and form completion paths easy to reach on touch devices.
- Prefer a clear grid, predictable alignment, and stable dimensions for controls, cards, tabs, and repeated items.
- Empty, loading, and error states must preserve layout stability and explain the next action.

## Component Rules
- Every interactive component must define default, hover, active, focus-visible, disabled, loading, success, and error behavior when those states apply.
- Buttons must communicate hierarchy through role: primary, secondary, tertiary, destructive, or icon-only.
- Forms must keep labels visible, helper text close to the field, and errors specific enough to fix.
- Cards must represent repeated items or contained tools. Do not nest cards inside other cards.
- Modals and popovers must include focus management, escape behavior, and clear dismissal affordances.

## Interaction And Motion
- Motion must clarify state change, not decorate the screen.
- Transitions should usually stay between 120ms and 260ms.
- Provide reduced-motion behavior for animations, parallax, shimmer, and auto-moving content.
- Pointer hover cannot be the only way to reveal important controls because touch devices do not have hover.

## Accessibility Requirements
WCAG 2.2 AA, keyboard-first interactions, visible focus states, semantic HTML before ARIA, reduced-motion support, accessible target sizes.

- Text and meaningful non-text UI must meet WCAG 2.2 AA contrast.
- Keyboard users must be able to reach, understand, and operate every interactive control.
- Focus indicators must be visible, high-contrast, and not hidden by overflow or animation.
- Semantic HTML or native platform semantics come before ARIA patches.
- Touch targets should be at least 24px by WCAG 2.2 AA and should reach 44px when layout allows.

## Content Tone
Clear, concise, implementation-focused, low-jargon, and helpful without being decorative.

- Use direct labels for actions.
- Avoid vague UI copy like "Submit" when the action can be named.
- Keep empty states useful: state what happened, why it matters, and what the user can do next.

## Rules: Do
- use semantic tokens before raw values in components.
- preserve existing content, copy, media, routes, and behavior when applying this system to an existing project.
- preserve hierarchy with spacing, contrast, typography, and component state.
- define default, hover, active, focus-visible, disabled, loading, success, and error states.
- design mobile-first, then enhance for tablet and desktop density.
- keep implementation guidance portable across React, Vue, Svelte, plain HTML/CSS, and mobile UI stacks.
- prioritize data visibility and scannability above all else.
- use consistent card structure and spacing for all dashboard widgets.
- make key metrics immediately visible in the first viewport.
- provide clear labels, units, and context for all data points.
- use color semantically for status, trends, and categories.
- keep filters and actions contextually near the data they affect.
- design both hover and keyboard focus states for cards, filters, tabs, menus, and chart controls.
- keep responsive behavior practical: cards stack, tables scroll horizontally when needed, and key actions remain reachable.

## Rules: Don't
- use low-contrast text, hidden focus indicators, or color-only state communication.
- delete or replace existing product content unless the user explicitly asks for content removal.
- introduce one-off spacing, typography, or radius values outside the token system.
- mix unrelated visual metaphors in the same screen.
- depend on framework-specific component names in design rules.
- add decorative motion without reduced-motion fallbacks.
- use decorative elements that compete with data for attention.
- hide important metrics below the fold without a clear scroll path.
- use inconsistent card sizes or spacing that makes the grid feel random.
- add animations or effects that slow down data scanning.
- use low-contrast text for labels or data values.
- overload a single card with too many data points or charts.
- use landing-page hero patterns, oversized marketing copy, or decorative illustrations in place of useful dashboard content.
- remove filters, legends, table controls, or drill-down affordances to make the interface look cleaner.

## AI Implementation Checklist
- Read this file before changing UI, layout, component styling, or interaction behavior.
- Identify the target surface: mobile app, mobile web, desktop web, dashboard, landing page, form flow, or content-heavy view.
- Map the design tokens to the project technology without changing the design intent.
- Reuse existing project components when they can satisfy these rules.
- If the current UI conflicts with this file, explain the conflict and choose the more accessible, consistent option.
- Confirm all original navigation items, hero content, CTAs, media, sections, and forms still exist unless removal was requested.
- Confirm no text became invisible from background, opacity, blend-mode, or inherited color changes.
- Confirm the first viewport contains meaningful product content, not just a background treatment.
- Verify keyboard navigation, focus-visible styling, responsive behavior, text overflow, loading state, and error state before finishing.