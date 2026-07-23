# Logly — Design System

The portable reference for Logly's visual system. It documents what is **actually implemented**
today (not the aspirational brief). Sources of truth, in order:

1. `src/styles/tokens.css` — token values (CSS variables). **The only place raw colors/motion live.**
2. `tailwind.config.ts` — maps tokens → semantic Tailwind utilities.
3. `src/index.css` — global base layer (focus ring, scrollbars, reduced-motion).

> **Golden rule:** components consume **semantic utilities** (`bg-panel`, `text-fg-muted`,
> `border-line`, `rounded-lg`, `duration-fast`). Never hardcode `slate-*`, raw hex, or px timings in
> a component. To change the look, change the token — a future light theme is a `:root` variable
> swap with **no class changes**.

Mission context: *"Decision Velocity" — shrink the gap between a question and a confident decision.*
The aesthetic is a calm, dense, dark analytics surface where numbers read as aligned columns.

---

## Foundations

- **Theme:** dark is the default and only shipped theme. `darkMode: 'class'`; tokens are declared on
  `:root`, structured so a light theme is purely a variable swap.
- **Color storage:** each color token is a **space-separated RGB triplet** (e.g. `22 201 138`), not
  hex. Tailwind resolves them via `rgb(var(--c-*) / <alpha-value>)`, so **alpha modifiers work**:
  `bg-accent/10`, `border-danger/30`, `hover:bg-white/[0.06]`.
- **Typography:** `Geist` (UI) + `Geist Mono` (numerals/code). `font-variant-numeric: tabular-nums`
  is global so metrics align in columns.
- **Accessibility:** every `:focus-visible` gets a 2px accent ring at 2px offset (WCAG AA). All
  motion is disabled under `prefers-reduced-motion: reduce`.

---

## Color tokens

### Surfaces (background elevation, darkest → lightest)
| Utility | Token | Hex | Use |
|---|---|---|---|
| `bg-base` | `--c-bg-base` | `#08090B` | Page background |
| `bg-panel` | `--c-bg-panel` | `#0B0C0E` | Panels / sidebars |
| `bg-raised` | `--c-bg-raised` | `#0F1113` | Raised sections |
| `bg-surface` | `--c-surface` | `#141619` | Cards |
| `bg-surface-hover` | `--c-surface-hover` | `#1F2329` | Card / row hover |

### Borders (subtle → strong)
| Utility | Token | Hex | Use |
|---|---|---|---|
| `border-line-subtle` | `--c-border-subtle` | `#1C2025` | Hairlines, dividers |
| `border-line` | `--c-border` | `#282D34` | **Default border** (applied to `*` in base layer) |
| `border-line-strong` | `--c-border-strong` | `#3A4048` | Emphasized edges, scrollbar thumb |

### Text (primary → faint)
| Utility | Token | Hex | Use |
|---|---|---|---|
| `text-fg` | `--c-fg` | `#F2F4F7` | Primary text, headings |
| `text-fg-secondary` | `--c-fg-secondary` | `#A2AAB4` | Secondary/body |
| `text-fg-muted` | `--c-fg-muted` | `#6B727C` | Labels, captions |
| `text-fg-faint` | `--c-fg-faint` | `#474D55` | Disabled, placeholder |

### Accent & semantic
| Utility | Token | Hex | Meaning |
|---|---|---|---|
| `accent` | `--c-accent` | `#16C98A` | Primary accent / success / focus ring |
| `accent-contrast` | `--c-accent-contrast` | `#08090B` | Text/icon on an accent fill |
| `danger` | `--c-danger` | `#F4515B` | Errors, destructive |
| `warning` | `--c-warning` | `#F5A524` | Warnings |
| `info` | `--c-info` | `#3B9EFF` | Informational |
| `violet` | `--c-violet` | `#A07BFF` | Categorical / chart series |
| `teal` | `--c-teal` | `#2DD4BF` | Categorical / chart series |

> Semantic colors are typically used at **low alpha for fills, full strength for text/border** —
> e.g. `danger` button = `bg-danger/10 text-danger border-danger/30`.

---

## Radii
| Utility | Token | Value |
|---|---|---|
| `rounded-sm` | `--radius-sm` | 5px |
| `rounded-md` | `--radius-md` | 8px |
| `rounded-lg` | `--radius-lg` | 11px |
| `rounded-xl` | `--radius-xl` | 14px |

## Elevation (shadows)
| Utility | Token | Value |
|---|---|---|
| `shadow-sm` | `--shadow-sm` | `0 1px 2px rgba(0,0,0,.3)` |
| `shadow-md` | `--shadow-md` | `0 8px 24px rgba(0,0,0,.4)` |
| `shadow-lg` | `--shadow-lg` | `0 16px 48px rgba(0,0,0,.5)` |
| `shadow-xl` | `--shadow-xl` | `0 32px 80px rgba(0,0,0,.6)` |

## Motion
One brand easing, four durations. Prefer the semantic Tailwind utilities over raw ms.

| Utility | Token | Value | Use |
|---|---|---|---|
| `ease-brand` | `--ease-brand` | `cubic-bezier(.2,.8,.2,1)` | The house curve |
| `duration-instant` | `--dur-instant` | 120ms | Hover/press feedback |
| `duration-fast` | `--dur-fast` | 160ms | Small state changes |
| `duration-base` | `--dur-base` | 220ms | Standard transitions, drawer slide |
| `duration-slow` | `--dur-slow` | 360ms | Larger content moves |

### Named animations (Tailwind `animate-*`)
| Class | What | Notes |
|---|---|---|
| `animate-lglpulse` | Realtime pulse ring | 1.6s ease-out infinite |
| `animate-lglin` | Fade + rise (−6px) | Toasts, dialogs, palette — 180ms |
| `animate-lglup` | Rise from below (+10px) | Content entrances — 500ms |
| `animate-lglshim` | Loading shimmer sweep | Skeletons — 1.4s |
| `animate-lglslide` | Drawer slide-in from right | 220ms |
| `animate-lglspin` | Spinner | 0.7s linear |

## Z-index (overlay stacking)
| Utility | Value | Layer |
|---|---|---|
| `z-scrim` | 80 | Backdrop scrim |
| `z-palette` | 81 | Command palette (⌘K) |
| `z-dialog` | 83 | Dialogs / drawers |
| `z-toast` | 90 | Toasts (always on top) |

## Opacity
| Utility | Value | Use |
|---|---|---|
| `opacity-disabled` | 0.45 | Disabled controls |
| `opacity-muted` | 0.60 | De-emphasized |
| `opacity-subtle` | 0.72 | Slightly de-emphasized |

---

## Typography scale

Type is driven by Tailwind's default `text-*` sizes; the system in practice is compact — `text-sm`
and `text-xs` dominate UI chrome, with larger sizes reserved for headings and hero metrics.

| Size | Typical use |
|---|---|
| `text-4xl` / `text-3xl` / `text-2xl` | Hero metrics, page-level headings (sparingly) |
| `text-xl` / `text-lg` | Section headings |
| `text-base` | Occasional emphasized body |
| `text-sm` | **Default body / UI text** (most common) |
| `text-xs` | Labels, captions, chips, table meta |

Numerals inherit `tabular-nums` globally — no per-element opt-in needed.

---

## Components

Primitives are token-driven and exported from the barrel `src/components/ui/index.ts`. **Reuse these
before writing new markup.** Compose class strings with `cn()` (`src/lib/cn.ts`, wraps
`clsx` + `tailwind-merge`).

### Primitives — `src/components/ui/`
| Component | Notes |
|---|---|
| `Button` | 5 variants × 3 sizes; `loading`/`disabled`; `leadingIcon`/`trailingIcon` (see variants below) |
| `Input` | Label, error, hint, leading/trailing icons; a11y-wired |
| `Card` | Surface container |
| `Chip` | Compact filter/selection token |
| `Badge` | Status/label pill |
| `Spinner` | Indeterminate loader (`animate-lglspin`) |
| `Toaster` | Renders the toast queue |

### Composites — `src/components/composite/`
`CommandPalette` (⌘K), `EmptyState`. Dashboard widgets live at `components/` root
(`Wordmark`, `MetricCard`, `TrendChart`, `RealtimeCount`).

### Layout chrome — `src/layouts/`
`AppShell` (sidebar + topbar + `<Outlet>` + overlay layers + ⌘K listener), `Sidebar`, `TopBar`,
`ProjectSwitcher`. Nav is configured once in `layouts/nav.ts`.

### Button variants (canonical usage of the palette)
| Variant | Classes | When |
|---|---|---|
| `primary` | `bg-fg text-base hover:bg-white` | Highest-emphasis action (light-on-dark) |
| `secondary` | `bg-surface text-fg border border-line hover:bg-surface-hover` | **Default** |
| `ghost` | `bg-transparent text-fg-secondary hover:bg-white/[0.06] hover:text-fg` | Low emphasis |
| `danger` | `bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20` | Destructive |
| `success` | `bg-accent text-accent-contrast hover:brightness-105` | Confirming/positive primary |

Sizes: `sm` (`text-xs`, ~28px), `md` (`text-[13px]`, default), `lg` (`text-sm`, ~40px).

---

## Conventions & guardrails

- **No raw colors in components.** Use semantic utilities. If you reach for `slate-*` or a hex, the
  token system is missing something — add a token, don't hardcode.
- **No raw timing/px motion.** Use `duration-*` + `ease-brand` and the `animate-lgl*` set.
- **Borders default to `border-line`** via the base layer's `* { @apply border-line }` — you rarely
  set a border color explicitly; only override for emphasis (`border-line-strong`) or state
  (`border-danger/30`).
- **Focus is automatic.** Don't remove the `:focus-visible` accent ring.
- **Respect reduced motion** — it's handled globally; don't fight it with `!important` durations.
- **Only automated gate:** `npm run check` (`tsc --noEmit`, with `noUnusedLocals`/`noUnusedParameters`).
  There is no linter or test runner.

### Charts (Recharts) and the token system
Recharts sets colors via SVG `stroke`/`fill` props, which take neither Tailwind classes nor
`var(--token)` attribute values. To keep charts on-palette without hardcoding hex, resolve the
tokens at runtime: `src/lib/chartColors.ts` reads the `--c-*` CSS variables off `:root` and returns
`rgb()` strings (`getChartPalette()`). `TrendChart` consumes it (`series` = `info` + `accent`, grid
= `border-strong`, axis = `fg-muted`, legend = `fg-secondary`, active-dot ring = `surface`). Add new
chart roles there rather than inlining hex in a component.

### Known drift (not yet reconciled)
- `ProjectsPage`, `EventsPage`, `SettingsPage`, and `TrendChart` have been **reconciled** to the
  token system (indigo→`accent`, emerald→`accent`, red→`danger`, slate→`bg-*`/`text-fg-*`/`border-line-*`).
- The `Dashboard V2` brief still uses a few shades not yet tokenized (e.g. `#101216`, `#8A929C`,
  `#FF5C5C` vs token `#F4515B`). Reconcile by **adding tokens**, not by hardcoding hex.

---

*Generated from the live token files. When tokens change, update this doc — or regenerate the tables
from `src/styles/tokens.css` + `tailwind.config.ts`, which remain the source of truth.*
