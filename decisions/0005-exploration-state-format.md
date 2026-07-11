# ADR-0005: ExplorationState serialization format

- **Status:** 🟡 Proposed — **your call to make and defend**
- **Date:** _fill in when you decide_
- **Deciders:** _you_
- **Related:** ADR-0004 (URL-as-truth), `LEARNING_GUIDE.md` §8, `ACTION_PLAN.md` Phase 2.1–2.2

> This is an OPEN decision. ADR-0004 committed to putting exploration state in the URL; **how** to encode
> it is unresolved. Read the options, then **write the Decision and Consequences yourself** — that
> reasoning is the senior signal. Don't just tick a box; justify the trade-off out loud.

## Context

`ExplorationState` (time, metric, filters, segments, grouping, sorting, comparison, projection,
selection, focus, pagination, savedView, version…) must round-trip through the URL. The format decides
readability, URL length limits, forward-compatibility (old links must not break after a schema change),
and how the state hash (the cache key) is derived. Today the dashboard keeps range/filters in `useState`
— there is **no format yet**, so this is greenfield.

## Options considered

### Option A — Compact custom keys + tokens (`?t=7d&m=visitors&f=device:mobile&g=path&c=prev`)
- **Pros:** short, human-readable/hackable URLs; stable keys; easy to eyeball in support.
- **Cons:** you own a parser/serializer and a key registry; nested/complex filters get awkward; must
  version the key mapping carefully.

### Option B — JSON → base64 in one param (`?s=eyJ0IjoiN2QiLCJtIjoi…`)
- **Pros:** trivial to (de)serialize; arbitrary nesting; one param.
- **Cons:** opaque, long, ugly URLs; brittle across schema changes unless you version inside; larger →
  hits URL length limits sooner.

### Option C — Server-stored state + short hash in URL (`?v=a1b2c3`)
- **Pros:** URLs stay tiny regardless of complexity; the hash is the cache key directly; enables
  server-side saved views naturally.
- **Cons:** needs a store + a write on every shareable state; a bare hash isn't self-describing; a
  cold/evicted hash must degrade gracefully.

### Option D — Hybrid: compact keys for common fields, hash-spill for large states (recommended starting point)
- **Pros:** short readable URLs for the 95% case; automatic spill to server + hash when a state exceeds a
  length threshold; best of A and C.
- **Cons:** two code paths to build and test; the spill boundary is one more thing to reason about.

## Decision

> **_Your call._** State the option (or blend) you chose and — in your own words — *why its trade-offs
> are the right ones given ADR-0004 and the p95 budgets (URL update < 5ms, filter feedback < 50ms)._**
> Name the cost you're accepting. Example skeleton to replace:
>
> _"Chose D. Compact keys keep the common dashboard link readable and short; the hash-spill path handles
> power-user states without blowing the URL limit. I accept two serialization paths and a versioned key
> registry because forward-compatibility of shared links is non-negotiable — a link from last month must
> still open."_

## Consequences

> **_Your call._** Fill in Good / Bad-accepted-cost / Revisit-when. Consider: how do you **version** the
> format so old URLs migrate forward? What's the hydration pipeline (parse → migrate → validate → default
> → never throw)? What exactly goes into the **state hash** (and what's excluded, e.g. `ui`/`command`
> local fields)?

## Questions to reason through (interview-grade)
- Why should the state hash exclude device-local fields like theme and palette-open?
- How do you evolve the schema without breaking a URL someone bookmarked six months ago?
- Where's the URL length ceiling in practice, and what triggers the spill-to-server path?
- Why is "unknown param → drop, never crash" a hard requirement?
