# Logly Frontend — Developer Guide

The web client for **Logly**, a privacy-first, realtime web-analytics product (Plausible/Fathom
style). This guide is everything a new developer needs to be productive in this repo. Read it end
to end before your first change.

> **Product context.** The `/Users/.../Logly product design brief/` docs are the product spec
> (source of truth), and `logly/GUIDE.md` is the senior-dev architecture rationale for the whole
> app (backend + frontend). This README covers the **frontend** specifically. The mission is
> *"Decision Velocity" — shrink the gap between a question and a confident decision*; the UI is
> being evolved incrementally toward the brief (see [Project status & roadmap](#project-status--roadmap)).

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Quick start](#quick-start)
3. [Scripts](#scripts)
4. [Environment variables](#environment-variables)
5. [Project structure](#project-structure)
6. [Routing](#routing)
7. [The app shell](#the-app-shell)
8. [State management](#state-management)
9. [The API client](#the-api-client)
10. [Authentication](#authentication)
11. [Design system](#design-system)
12. [Realtime](#realtime)
13. [Conventions](#conventions)
14. [How to add a new page / nav section](#how-to-add-a-new-page--nav-section)
15. [How to show a toast / open the command palette](#how-to-show-a-toast--open-the-command-palette)
16. [Backend API contract](#backend-api-contract)
17. [Gotchas](#gotchas)
18. [Project status & roadmap](#project-status--roadmap)

---

## Tech stack

| Concern | Choice | Version |
|---|---|---|
| Build tool | Vite | ^5.2 |
| Framework | React | ^18.3 |
| Language | TypeScript (strict) | ^5 |
| Routing | React Router | ^6.22 |
| Server state | TanStack Query | ^5 |
| Client state | Zustand | ^4.5 |
| Styling | Tailwind CSS | ^3.4 |
| Icons | lucide-react | ^1.24 (1.75 stroke) |
| Charts | Recharts | ^2.12 |
| Class utils | `clsx`, `tailwind-merge` (available), local `cn()` | — |

> The design brief targets newer versions (React 19, RR7, Tailwind v4 `@theme`). We deliberately
> ship on the current stack and **adopt the brief's patterns, not its exact vendors**. Don't upgrade
> majors without a dedicated task.

There is **no test runner and no ESLint config** yet. The only automated gate is `npm run check`
(`tsc --noEmit`). `strict`, `noUnusedLocals`, and `noUnusedParameters` are on — unused locals/params
fail the typecheck.

---

## Quick start

```bash
cd logly/frontend
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

The dev server proxies `/api/*` to the backend at **http://localhost:3001** (see
`vite.config.ts`). Two ways to work:

- **UI-only (no backend):** a dev-only auto-login seeds a demo session (see
  [Authentication](#authentication)), so you land straight in the app. Data calls will fail
  gracefully (cards show 0, realtime says "Connecting…"). Jump into the shell at
  `http://localhost:5173/projects/demo`.
- **Full stack:** start the backend (`logly/backend`: `docker compose up -d`, copy `.env.example`
  → `.env`, `npm install`, `npm run db:migrate`, then `npm run dev` **and** `npm run worker` in a
  second shell). Then register/login normally.

Before committing, run `npm run check` and `npm run build` — both must pass.

---

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on :5173 (HMR, `/api` proxy → :3001) |
| `npm run check` | `tsc --noEmit` — the type gate. Run before every commit. |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Environment variables

Vite exposes only `VITE_`-prefixed vars (`import.meta.env.*`). Put local overrides in
`logly/frontend/.env.local` (gitignored).

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `''` (empty → use the Vite `/api` proxy) | API base URL. Leave empty in dev. |
| `VITE_DEV_AUTOLOGIN` | on in dev | Set to `false` to disable the dev login bypass and test real auth screens. |

---

## Project structure

```
src/
  main.tsx              App bootstrap: QueryClient, BrowserRouter, dev auto-login
  App.tsx               Route table + auth guards (ProtectedRoute / GuestRoute)
  index.css             Tailwind entry + @import tokens + global base + reduced-motion
  styles/
    tokens.css          Design tokens as CSS variables (the single source of colors/motion)
  layouts/              App shell chrome (only rendered for authenticated project routes)
    AppShell.tsx        Sidebar + TopBar + <Outlet> + overlay layers + ⌘K listener
    Sidebar.tsx         Primary nav (Overview / Explore groups), footer, profile
    TopBar.tsx          Page title, connection pill, Export / New report, collapse toggles
    ProjectSwitcher.tsx Current project + switch dropdown (uses /api/projects)
    nav.ts              Nav item config (labels, icons, groups, badges) — shared source of truth
  pages/                Route components (default-exported)
    LoginPage / RegisterPage / ProjectsPage
    DashboardPage / EventsPage / SettingsPage
    SectionPlaceholder  Stand-in for nav destinations not built yet
  components/
    ui/                 Primitives (token-driven): Button, Input, Card, Chip, Badge, Spinner,
                        Toaster  + index.ts barrel
    composite/          Cross-feature composites: CommandPalette, EmptyState
    Wordmark.tsx        Logo mark + wordmark
    MetricCard / TrendChart / RealtimeCount   Dashboard widgets
  stores/               Zustand client-state slices
    authStore.ts        user + token (persisted as "logly-auth")
    uiStore.ts          sidebar mode (persisted) + command-palette open state
    toastStore.ts       ephemeral toast queue
  hooks/
    useToast.ts         Imperative toast API
  lib/                  Framework-agnostic plumbing
    api.ts              The single fetch client (Bearer auth, HttpError, buildUrl)
    queryKeys.ts        TanStack Query key factories
    cn.ts               className joiner
    devAuth.ts          Dev-only login bypass (tree-shaken from prod)
  types/
    index.ts            Shared domain types + API shapes
```

> **Note on target architecture.** The brief prescribes a *feature-first* layout
> (`features/<name>/` each owning `components/hooks/api/types/pages`). We're migrating toward it
> **per feature** as they're built — new features should follow that shape; existing flat pages get
> folded in as they're reworked. Import direction is one-way: `app → features → components → lib`,
> and features must never import other features.

---

## Routing

Defined in `src/App.tsx` with React Router v6. Two guards wrap routes:

- `ProtectedRoute` — redirects to `/login` if there's no `user` in the auth store.
- `GuestRoute` — redirects authenticated users away from `/login` and `/register` to `/projects`.

Route table:

| Path | Component | Notes |
|---|---|---|
| `/` | → `/projects` | redirect |
| `/login`, `/register` | Login/Register | `GuestRoute`, no shell |
| `/projects` | ProjectsPage | project list, **no** shell |
| `/projects/:id` | `AppShell` (layout) | `ProtectedRoute`; children render in `<Outlet>` |
| ` └ index` | DashboardPage | |
| ` └ events` | EventsPage | |
| ` └ settings` | SettingsPage | |
| ` └ realtime, goals, alerts, pages, sources, locations, devices, setup` | SectionPlaceholder | wired but not built yet |
| `*` | 404 | |

**Everything project-scoped renders inside `AppShell`** (via the nested route + `<Outlet>`), so
individual pages must **not** render their own sidebar/header — return just their content.

---

## The app shell

`AppShell` (in `layouts/`) is the persistent chrome for authenticated project routes. It composes:

- **Sidebar** (`layouts/Sidebar.tsx`) — driven by `layouts/nav.ts`. Two groups (Overview, Explore),
  active state via `NavLink`, live/alerts badges, ⌘K trigger, Setup/Settings, user profile.
  Collapses to an icon rail (persisted) and becomes an off-canvas drawer on mobile.
- **TopBar** (`layouts/TopBar.tsx`) — derives the page title from the route, shows a connection
  pill, and Export / New report actions.
- **Overlay layers mounted once at the root**: `Toaster` (`components/ui/Toaster.tsx`) and
  `CommandPalette` (`components/composite/CommandPalette.tsx`).
- A global **⌘K / Ctrl+K** keydown listener that toggles the command palette.

Add nav items in one place: `layouts/nav.ts` (see [How to add a page](#how-to-add-a-new-page--nav-section)).

---

## State management

**The rule: server state → TanStack Query; client/UI state → Zustand. Never duplicate server data
into a store.** If the server owns the truth, it belongs in a `useQuery`.

### TanStack Query (server state)
- Configured in `main.tsx` (no refetch-on-focus, retry 1, 30s default staleTime).
- **Always key queries via the factories in `lib/queryKeys.ts`** (`projectKeys`, `metricsKeys`,
  `eventKeys`, `alertKeys`) so invalidation is precise. Don't hand-write key arrays.
- Query functions call the typed `api` client, never `fetch` directly.

```ts
const { data: pages = [], isLoading } = useQuery({
  queryKey: metricsKeys.pages(projectId),
  queryFn: () => api.get<PageStat[]>(`/api/projects/${projectId}/metrics/pages`),
});
```

### Zustand (client state) — three stores
| Store | Holds | Persisted? |
|---|---|---|
| `authStore` | `user`, `token`, `setAuth`, `logout` | yes → `localStorage["logly-auth"]` |
| `uiStore` | `useSidebarStore` (mode, mobileOpen) + `useCommandStore` (palette open) | sidebar mode only |
| `toastStore` | toast queue | no (ephemeral) |

Read a store with a selector (`useAuthStore(s => s.user)`); call actions from anywhere with
`useX.getState().action()` when outside React (e.g. the api client calls `logout()` on 401).

---

## The API client

`lib/api.ts` is the **only** place `fetch` is called. Import `api` and use typed methods:

```ts
import { api, HttpError } from '@/lib/api';

const project = await api.get<Project>(`/api/projects/${id}`);
await api.post('/api/projects', { name, domain });
await api.del(`/api/projects/${id}`);
```

- **Auth:** `api` reads `useAuthStore.getState().token` and attaches `Authorization: Bearer <token>`
  automatically. On any `401` it calls `logout()` so the app falls back to the login screen.
- **Errors:** non-2xx throws a typed `HttpError` (`.status`, `.body: { message, code? }`). Catch it
  to show messages; anything else is an unexpected error.
- **Query params:** pass an object as the 2nd arg to `get` — `undefined` values are dropped.
- **Base URL:** `import.meta.env.VITE_API_URL ?? ''`; empty in dev so the Vite proxy handles `/api`.

---

## Authentication

Backend is **Bearer-token** based. Flow:

1. `POST /api/auth/login` (or `/register`) returns `{ token, user }`.
2. The page calls `setAuth(user, token)` → persisted in `authStore`.
3. `api` sends `Authorization: Bearer <token>` on every request; guards read `user` for access.
4. `logout()` clears the store (also triggered automatically on a 401).

There is no bootstrap `/api/auth/me` refresh — the persisted `user` gates routes directly.

**Dev bypass** (`lib/devAuth.ts`, called from `main.tsx`): on the dev server it seeds a demo `pro`
session when none exists, so you skip the login wall. It's wrapped in `import.meta.env.DEV` (dead
code / tree-shaken in production builds) and disabled with `VITE_DEV_AUTOLOGIN=false`.

---

## Design system

The brief's tokens live in **`src/styles/tokens.css`** as CSS variables and are exposed as Tailwind
utilities in `tailwind.config.ts`. **Use the semantic utilities, not raw `slate-*`/hex.**

### Colors (semantic → utility)
| Utility | Meaning |
|---|---|
| `bg-base` / `bg-panel` / `bg-raised` | page / sidebar / raised surfaces (near-black) |
| `bg-surface` / `bg-surface-hover` | cards / hover |
| `border-line` / `-subtle` / `-strong` | borders (default border is `border-line`) |
| `text-fg` / `-secondary` / `-muted` / `-faint` | text hierarchy |
| `accent` (+ `accent-contrast`) | brand green `#16C98A` (on-accent text) |
| `danger` / `warning` / `info` / `violet` / `teal` | semantic accents |

Colors are stored as RGB channel triplets, so **opacity modifiers work**: `bg-accent/10`,
`border-danger/30`, etc. A future light theme is just a `:root` variable swap — no class changes.

### Type, radius, motion
- Fonts: **Geist** (UI) + **Geist Mono** (numbers/code), loaded in `index.html`; `tabular-nums`
  is global. Sizes follow Tailwind's scale.
- Radius: `rounded-sm/md/lg/xl` = 5/8/11/14px. Shadows: `shadow-sm/md/lg/xl`.
- Motion: `ease-brand` = `cubic-bezier(.2,.8,.2,1)`; `duration-instant/fast/base/slow`
  (120/160/220/360ms). Named animations: `animate-lglin`, `-lglup`, `-lglpulse`, `-lglslide`,
  `-lglspin`, `-lglshim`. A global `prefers-reduced-motion` rule neutralizes animation.
- Z-index tokens: `z-scrim/palette/dialog/toast`.

### Primitives & helpers
- `components/ui/` — `Button` (variants: primary/secondary/ghost/danger/success; sizes sm/md/lg;
  `loading`), `Input` (label/error/hint/icons, a11y-wired), `Card`, `Chip`, `Badge`, `Spinner`,
  `Toaster`. Import from the barrel: `import { Button, Card, Input } from '@/components/ui';`
- `components/composite/` — `CommandPalette`, `EmptyState`.
- `components/Wordmark.tsx` — the logo.
- **`lib/cn.ts`** — `cn(...classes)` joins truthy class strings. Use it for conditional classes.
  (`clsx` and `tailwind-merge` are installed and fine to use too; `cn` is the default.)
- **Icons:** `lucide-react`, rendered at `strokeWidth={1.75}`, sized 14–20px.

---

## Realtime

`components/RealtimeCount.tsx` opens an **SSE** connection to
`/api/projects/:id/metrics/realtime` (`EventSource`, `withCredentials`), shows a live visitor count
with a pulsing accent dot, and reconnects after 5s on error. The brief's eventual target is a single
`RealtimeProvider` with a WebSocket→SSE→polling ladder that fans messages into the Query cache —
that lands in the Realtime cycle.

---

## Conventions

- **Naming:** PascalCase components, `use*` camelCase hooks, SCREAMING_CASE constants, kebab-case
  route paths.
- **Exports:** named exports everywhere; **default export is reserved for route page components**.
- **Imports:** absolute `@/` alias (→ `src/`). Keep the one-way direction `app → features →
  components → lib`; never import one feature from another.
- **Types:** no `any`; derive shared shapes from `types/index.ts`. Because `noUnusedLocals` is on,
  remove unused imports/vars or the build fails.
- **Styling:** semantic token utilities only — no raw hex, avoid new `slate-*` usage.
- **Every screen ships the four states:** loading (skeleton), empty (`EmptyState`), error, success.
  This is a definition-of-done requirement from the brief.
- **Accessibility:** keep the accent focus ring, label inputs, `aria-*` on menus/dialogs, ≥44px
  touch targets, and honor reduced motion (handled globally).

---

## How to add a new page / nav section

1. Create the page in `pages/` (or, preferred for real features, `features/<name>/pages/`) as a
   **default export** returning just content (the shell provides chrome).
2. Register the route in `App.tsx` as a child of the `/projects/:id` `AppShell` route:
   `<Route path="mysection" element={<MySectionPage />} />`.
3. Add/flip the nav entry in `layouts/nav.ts` (set `implemented: true`, pick a Lucide icon, choose
   the group). Sidebar, command palette, and topbar title all read from this file automatically.
4. Fetch data via `useQuery` + a new key factory in `lib/queryKeys.ts`, calling the `api` client.
5. Cover loading / empty / error / success. Typecheck (`npm run check`) and verify in the browser.

---

## How to show a toast / open the command palette

```ts
import { useToast } from '@/hooks/useToast';
const toast = useToast();
toast.success('Saved');
toast.error('Something went wrong', 'Optional description');
toast.show({ title: 'Undo?', action: { label: 'Undo', onClick: restore } });
```

Command palette opens on **⌘K / Ctrl+K** globally, or programmatically:
`useCommandStore.getState().setOpen(true)`.

---

## Backend API contract

Endpoints the frontend consumes (all under `/api`, proxied to :3001 in dev):

| Method | Path | Used by |
|---|---|---|
| POST | `/auth/login`, `/auth/register` | Login/Register (returns `{ token, user }`) |
| GET | `/projects` | ProjectsPage, ProjectSwitcher |
| POST | `/projects` | Create project |
| GET / DELETE | `/projects/:id` | Dashboard/Settings |
| GET | `/projects/:id/metrics/today` | KPI cards |
| GET | `/projects/:id/metrics/trend?days=` | Trend chart |
| GET | `/projects/:id/metrics/pages` / `/metrics/events` | Breakdowns |
| GET | `/projects/:id/events?type=&from=&to=&page=` | Events explorer (paginated) |
| GET (SSE) | `/projects/:id/metrics/realtime` | RealtimeCount |

Features without a backend endpoint (goals, alerts, briefing, insights, sources, journey) will be
served by a **frontend demo-data layer** (MSW + fixtures, shown with a "Demo data" badge) — real
endpoints are only used where they exist today.

---

## Gotchas

- **Backend port is 3001**, and the Vite proxy targets 3001. If you change the backend `PORT`,
  update `vite.config.ts` or the frontend can't reach the API.
- **The worker must run** (`npm run worker` in the backend) or collected events never reach the DB,
  so the dashboard stays empty even with the backend up.
- **`noUnusedLocals` is strict** — a leftover import fails `tsc`/build, not just a warning.
- **Opacity modifiers need channel-triplet tokens** — that's why colors are defined as
  `rgb(var(--c-*) / <alpha-value>)`. Custom hex colors won't support `/opacity`.
- **Pages must not render their own header/sidebar** — the shell owns chrome; double chrome is a bug.
- **No tests / no ESLint** — `npm run check` + `npm run build` are the only gates. Be disciplined.
- **Fonts load from Google Fonts** (`index.html`) — offline, text falls back to system sans.

---

## Project status & roadmap

The app is being evolved to match the brief **one feature group per cycle**, compiling and reviewing
between each. Done so far: **(A)** design-system foundation (tokens, Geist, primitives), **(B)** app
shell (sidebar, topbar, ⌘K, toasts, routing). Next: **(C)** Dashboard hero (Morning Briefing,
Decision Health, chart, breakdowns, ExplorationState-in-URL), then Realtime, Onboarding/Installation,
Goals, Alerts, Settings, and the remaining explore lenses.

**Transitional state to expect:** `ProjectsPage` and the *bodies* of Events/Settings still use the
old slate palette — they get their full token retheme in their own cycles. The shell and dashboard
chrome are already on-brand. Sidebar sections marked `implemented: false` render a placeholder.
