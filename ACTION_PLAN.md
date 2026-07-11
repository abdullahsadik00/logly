# Logly — Action Plan: From Strong Thesis to Strong Project

> **Purpose.** `GUIDE.md` is the *ideal greenfield* 35-PR build order. This plan starts from **where the
> code actually is today** and sequences work by **leverage** — biggest impact per unit of effort — to
> turn a well-designed scaffold into a product you can trust and ship. Read `LEARNING_GUIDE.md` for the
> full architecture context; this is the *what to do next, and in what order*.

**Effort key:** S = ≤1 day · M = 2–4 days · L = 1–2 weeks · XL = multi-week.
**Status today (verified):** ingestion + rollups work; app shell is polished; ExplorationState and the
Decision Engine are unbuilt; several "built" features silently don't work; zero tests/CI.

---

## The five guiding rules for this plan

```
1. "Built" must mean "works."      Fix silent bugs before adding screens.
2. Foundation before features.      ExplorationState unblocks half the roadmap.
3. Build the moat early.            The Decision Engine is the only real differentiator.
4. A safety net before speed.       Tests + CI so progress doesn't rot.
5. Don't pay for scale you lack.    ClickHouse/services/RBAC come only when traffic demands.
```

**Sequencing at a glance:**

```
 Phase 0  Stop the bleeding      (make built = works)      ~1 week   ◄ start here
 Phase 1  Safety net             (tests + lint + CI)       ~1 week
 Phase 2  The foundation         (ExplorationState + URL)  ~2 weeks  ◄ unblocks everything
 Phase 3  The moat               (Decision Engine slice)   ~2 weeks  ◄ the differentiator
 Phase 4  Feature depth          (Goals, Alerts, Realtime) ~3–4 weeks
 Phase 5  Scale when it hurts    (partition→CH, RBAC, obs) as needed
```

---

## Phase 0 — Stop the bleeding (make "built" mean "works")

**Why first:** several features *look* built but don't function. This erodes trust faster than missing
features and makes the app impossible to demo honestly. All are small, high-confidence fixes.

| # | Task | Files | Effort | Done when |
|---|---|---|---|---|
| 0.1 | **Start the alert worker.** `startAlertWorker()` is never called → no alert emails ever send. | `jobs/alertQueue.ts`, `jobs/worker.ts` (or a new process entry) | S | A threshold breach delivers an email; document which process owns the consumer. |
| 0.2 | **Fix SSE realtime auth.** `EventSource` can't send a Bearer header, so `/metrics/realtime` 401s. | `routes/metrics.ts`, `components/RealtimeCount.tsx` | S | Pass token via query param (or short-lived SSE ticket) and read it in the route; live count updates. |
| 0.3 | **Reconcile FE↔BE contracts.** Events table, KPI cards, pages/events/trend read shapes the backend doesn't return. | `routes/metrics.ts`, `routes/events.ts`, `lib/api.ts`, `types/index.ts` | M | Every dashboard panel populates with real data; agree one envelope (recommend `{ data, meta }`) and align both ends. |
| 0.4 | **Add `POST /api/auth/logout`** (the FE already calls it; 404 is swallowed). | `routes/auth.ts` | S | Logout returns 2xx; or, if intentionally stateless, remove the FE call. |
| 0.5 | **Commit migrations + write `prisma/seed.ts`.** `db:seed` points at a non-existent file; no migrations committed. | `prisma/migrations/`, `prisma/seed.ts` | S | A fresh clone runs `db:migrate && db:seed` and gets a working demo user + project + sample events. |
| 0.6 | **Compute bounce rate + per-page/per-event unique visitors** the FE expects. | `jobs/worker.ts` or `routes/metrics.ts` | M | `bounceRate` and unique-visitor fields are real, not placeholders. |

**Exit criteria:** you can seed a fresh clone, log in, see populated KPI cards + events table + live
count, and receive an alert email — end to end, no silent failures.

---

## Phase 1 — The safety net (tests + lint + CI)

**Why now:** with the app actually working, lock it in before you build on top. A product whose pitch is
*"trust the number and act on it"* cannot credibly ship with zero tests. Keep it minimal — a gate, not a
mountain.

| # | Task | Scope | Effort | Done when |
|---|---|---|---|---|
| 1.1 | **Vitest + first unit tests.** | `computeVisitorId` (salt), `formatValue`, `cn`, rollup date bucketing | S | `npm test` runs; 8–10 high-value unit tests pass. |
| 1.2 | **RTL + MSW integration test.** | LoginPage happy/error path via MSW | S | The same MSW handlers can back dev *and* tests. |
| 1.3 | **Contract test for the ingestion→rollup path.** | fire event → worker flush → assert `daily_stats` | M | A test proves the core pipeline, the product's beating heart. |
| 1.4 | **ESLint flat config** (import-order + no-cross-feature-import) + Prettier. | both packages | S | `npm run lint` passes; the one-way import rule is enforced by tooling, not vibes. |
| 1.5 | **GitHub Actions CI.** | `check` + `build` + `lint` + `test` on every PR | S | Red PRs can't merge. |
| 1.6 | **One Playwright E2E smoke.** | login → dashboard renders → ⌘K navigates | M | A single realistic path is guarded. |

**Exit criteria:** every PR runs typecheck + lint + unit/integration + one E2E, and a regression is
caught automatically.

---

## Phase 2 — The foundation: ExplorationState + URL sync

**Why this is the highest-leverage build:** it's the crown-jewel design (`§8` of the handbook) and it's
**not built**. The dashboard keeps filters/range in local `useState`, which blocks filters, comparison,
saved views, shareable links, *and* the Decision Engine. Building it now means every later feature plugs
in for free; retrofitting it later is painful. This is `GUIDE.md` PR3 + PR15, done together.

| # | Task | Files | Effort | Done when |
|---|---|---|---|---|
| 2.1 | **Define the `ExplorationState` type** (start minimal: `time, metric, filters, grouping, comparison, projection`). | `lib/exploration/state.ts`, `types/` | M | A Zod schema + inferred type; every field has a default so any partial state is valid. |
| 2.2 | **URL codec** (compact stable keys ↔ state) + versioning. | `lib/exploration/codec.ts` | M | `t=7d&m=visitors&f=device:mobile&c=prev` round-trips; unknown keys drop, never throw. |
| 2.3 | **`useExploration` hook** — read/mutate state, sync to URL (`replaceState`), feed query keys. | `hooks/useExploration.ts` | M | Changing a filter updates the URL; copy-paste reproduces the exact view. |
| 2.4 | **Rebuild the dashboard filter bar + date range on ExplorationState.** | `pages/DashboardPage.tsx` | M | Range/compare/filter all live in the URL; Back = undo. |
| 2.5 | **Query keys derive from the state hash** (so a repeated question is a cache hit). | `lib/queryKeys.ts`, backend query params | M | Same state → same key → instant cached answer. |
| 2.6 | **Backend: accept ExplorationState params** on metrics endpoints (filters, grouping, compare). | `routes/metrics.ts` | L | The API answers filtered/grouped/compared queries from rollups. |

**Exit criteria:** you can filter/group/compare on the dashboard, share the URL, and pressing Back walks
your investigation — with the backend answering from rollups.

---

## Phase 3 — The moat: a Decision Engine vertical slice

**Why now (not later):** *"tell me what to do, not what happened"* is the **only** thing that
differentiates Logly from Plausible/Fathom/Umami. It's deterministic (no AI needed), so it's buildable
and testable — and it depends on ExplorationState's resolved results + comparison, which Phase 2 just
delivered. Ship a thin but real slice, not the whole spec.

| # | Task | Files | Effort | Done when |
|---|---|---|---|---|
| 3.1 | **Insight rule engine** (deterministic): delta-vs-baseline + dimensional concentration + deploy correlation → templated card. | `lib/decisions/` (or backend `services/decisions`) | L | Given a resolved result + baseline, it emits ranked `{category, priority, confidence, title, why, cta}` cards. |
| 3.2 | **"What needs you" panel** on the dashboard (top ~6, priority-ranked). | `features/dashboard/` | M | Real cards from real data, each linking to its evidence (a filtered ExplorationState). |
| 3.3 | **Decision Health score** (deterministic ~0–100, banded Healthy/Attention/At-risk). | `lib/decisions/health.ts` | S | A single explainable number + progress bar. |
| 3.4 | **Morning Briefing** ("since your last visit" narrative + signal chips + CTAs). | `features/dashboard/` | M | A one-paragraph brief generated from the same rules. |
| 3.5 | **Unit-test every rule** (this is where determinism pays off). | tests | M | Each insight has a test proving inputs→card. |

**Exit criteria:** the dashboard opens with a briefing + health score + ranked "what needs you" cards,
each traceable to the exact aggregates that justify it. *This is the demo that wins.*

---

## Phase 4 — Feature depth

**Why now:** with the foundation + moat in place, each feature is "a new field + projection," not a new
subsystem. Build them against the MSW demo-data layer where the backend lags.

| # | Task | Effort | Notes |
|---|---|---|---|
| 4.1 | **Realtime page** — RealtimeProvider (WS→SSE→poll), live feed + spark + top breakdowns. | L | Depends on Phase 0.2. Brief: auto-tick ~2s, pausable. |
| 4.2 | **Goals & Conversions** — 2-step drawer, 6 goal types, detail view + funnel. | L | Needs a `goals` table + endpoints; conversion counting in the worker. |
| 4.3 | **Alerts UI** — 5-step wizard (Metric→Condition→Threshold→Channels→Review) + notification center. | L | Backend eval exists (Phase 0.1); build CRUD + UI. |
| 4.4 | **Explore lenses** — Events / Sessions / Journey tables with click-to-filter (ExplorationState). | L | Sessions needs sessionization in the worker. |
| 4.5 | **Site Settings** completeness + autosave. | M | Retheme leftover slate bodies to tokens along the way. |
| 4.6 | **Onboarding + Installation wizard** + live pixel verification. | M | Time-to-first-value is a churn lever. |
| 4.7 | **Saved views + shareable/deep links.** | S | Nearly free once ExplorationState exists. |

**Exit criteria:** the sidebar's placeholder sections (`nav.ts` `implemented:false`) become real, each
built on the shared engine.

---

## Phase 5 — Scale & harden (only when it hurts)

**Why last:** *don't pay for scale you don't have yet.* These are migrations along the seams you've kept
stable — do them when metrics (not fear) say so.

| Trigger | Task | Effort |
|---|---|---|
| Events table writes/retention slow | **Partition `events` by time** (native Postgres) | M |
| Postgres can't hold analytics load | **Move hot analytics to ClickHouse** (reads already go via rollups + typed API → safe swap) | XL |
| Multi-user teams needed | **Teams + RBAC** (`can(actor, action, resource)`, Owner/Admin/Editor/Viewer) | L |
| One worker is the bottleneck | **Shard/parallelize workers** (the `flushing:<id>` lock already allows it) | M |
| Thousands of live connections | **Redis pub/sub → SSE fan-out** + dedicated realtime tier | L |
| Debugging is archaeology | **Structured logging + correlation id + OpenTelemetry** | M |
| Customers ask for it | **Exports (async→S3), webhooks, importers, packaged SDK, API keys + audit** | XL |
| Ingestion needs replay/durability | **Redis list → Redis Streams** (consumer groups, DLQ) | L |

---

## The first two weeks (concrete quick wins)

If you do nothing else, do these — they convert "impressive scaffold" into "trustworthy app":

```
Week 1  ── Phase 0 entirely ──
  □ 0.1 start the alert worker
  □ 0.2 fix SSE realtime auth
  □ 0.3 reconcile FE↔BE contracts (events + today first)
  □ 0.4 add /logout
  □ 0.5 commit migrations + write seed.ts
  □ 0.6 compute bounce + unique visitors

Week 2  ── Safety net + start the foundation ──
  □ 1.1 Vitest + first unit tests
  □ 1.4 ESLint flat config
  □ 1.5 GitHub Actions CI (check+build+lint+test)
  □ 1.3 ingestion→rollup contract test
  □ 2.1 define the minimal ExplorationState type + codec (start)
```

---

## How to measure success

Tie progress to the mission (*Decision Velocity*), not to screens shipped:

| Signal | Today | Target |
|---|---|---|
| Can a fresh clone reach a populated dashboard? | no | yes (Phase 0) |
| Do "built" features actually work? | partially | fully (Phase 0) |
| Can a regression merge unnoticed? | yes | no (Phase 1) |
| Is a view shareable via URL? | no | yes (Phase 2) |
| Does the app tell you *what to do*? | no | yes (Phase 3) |
| Time from "something changed" to "I know what to do" | undefined | the product's KPI — instrument it |

---

## What NOT to do (the traps)

- **Don't implement the brief top-to-bottom.** It's a *target*, not a to-do list. Build to seams.
- **Don't add feature screens before Phase 0/2.** More half-wired screens = more silent failures.
- **Don't adopt ClickHouse/Fastify/microservices early.** They solve problems you don't have yet and
  cost weeks. The current stack is correct for this stage.
- **Don't skip ExplorationState "for now."** Every week you wait, the retrofit gets more expensive.
- **Don't let the Decision Engine slip to "later."** It's the moat; everything else is table stakes.

---

*Sequenced by leverage, grounded in the code as it stands. Revisit after each phase — reality will
reorder the tail. Companion docs: `LEARNING_GUIDE.md` (the why), `GUIDE.md` (the ideal PR order),
`frontend/README.md` + `backend/README.md` (the references).*
