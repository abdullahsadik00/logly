# ADR-0004: The URL is the single source of exploration state

- **Status:** Accepted
- **Date:** 2026-07-10
- **Deciders:** Logly architecture
- **Related:** ADR-0005 (format), `LEARNING_GUIDE.md` §8/§10, `ACTION_PLAN.md` Phase 2

## Context

Every question a user asks Logly — time range, filters, grouping, comparison, chart type — is *state*.
Where that state lives determines whether views are shareable, whether Back/undo works, whether the
backend can be stateless, and whether a repeated question can be a cache hit. This is a foundational
decision that every downstream feature (dashboard, exploration lenses, decision engine, saved views)
depends on. Getting it wrong is expensive to retrofit.

## Options considered

### Option A — Component/local state (`useState`)
- **Pros:** trivial to write.
- **Cons:** not shareable; lost on reload; no undo; every feature reinvents it; can't key a cache off it.
  (This is, regrettably, what the current dashboard does — the debt ADR-0005 pays down.)

### Option B — A client store (Zustand/Redux)
- **Pros:** app-wide, ergonomic.
- **Cons:** still not shareable or linkable; the server can't reconstruct a view from a request; you'd
  hand-build serialization anyway.

### Option C — Server-side saved view / session
- **Pros:** durable; server owns it.
- **Cons:** a round-trip to change a filter; the backend becomes stateful; sharing needs an id lookup;
  kills the "instant, exploratory" feel.

### Option D — A single serialized `ExplorationState` in the URL (chosen)
- **Pros:** *the URL is the save button* — copy-paste reproduces the exact view; Back = undo for free;
  the backend is **stateless** (state travels with the request, any node answers identically); the
  state hash is a natural cache key; one canonical state re-projects into 12 views.
- **Cons:** needs a compact, versioned serialization codec (see ADR-0005); long states need a server-side
  spill + short hash; care required so unknown/legacy params never crash hydration.

## Decision

**Serialize the entire exploration into the URL as the single source of truth (Option D).** We accept the
cost of building and versioning a URL codec because it buys sharing, undo/redo, a stateless backend, and
content-addressed caching *simultaneously* — four hard problems solved by one decision. Guiding law: *no
view shall exist that cannot be represented by a serialized ExplorationState.*

## Consequences

- **Good:** shareable/linkable views; free history; stateless, horizontally-scalable read tier; repeated
  questions become zero-query cache hits; new features *extend* the state rather than forking it.
- **Bad / accepted cost:** a serialization format to design and version (ADR-0005); hydration must be
  defensive (parse → migrate → validate → default, never throw); large states need a hash+spill scheme.
- **Revisit when:** the format itself needs to change — that's a *format* decision (ADR-0005), not a
  reversal of URL-as-truth. This principle is intended to be permanent.
