# ADR-0003: Privacy as a property of the schema (daily-salted visitor hash)

- **Status:** Accepted
- **Date:** 2026-07-10
- **Deciders:** Logly architecture
- **Related:** ADR-0001, `LEARNING_GUIDE.md` §1/§13, `backend/README.md` (privacy model)

## Context

Logly needs to count **unique visitors** and reason about sessions, but its core promise is *privacy-first,
cookie-free, no PII*. Most analytics tools achieve identity with cookies or device fingerprinting, which
require consent banners and create a profile that can be subpoenaed or leaked. The tension: how do you
measure unique humans **without ever being able to identify one** — and without relying on the operator
to *promise* good behavior (policy), which is fragile?

## Options considered

### Option A — Cookies / persistent visitor IDs
- **Pros:** accurate cross-session identity; industry standard.
- **Cons:** requires consent banners; stores PII-adjacent identifiers; a cross-day profile exists →
  legal + trust liability. Contradicts the product thesis.

### Option B — Device fingerprinting
- **Pros:** cookieless; fairly stable.
- **Cons:** *more* invasive than cookies; explicitly rejected by GDPR/PECR guidance; ethically off-brand.

### Option C — No visitor identity (visitors == sessions)
- **Pros:** trivially private.
- **Cons:** can't distinguish a returning visitor from a new one within a day; weak analytics.

### Option D — Daily-salted, memory-only hash (chosen)
- **Pros:** `SHA256(daily_salt + project_id + ip + user_agent)` yields a stable per-visitor id *within a
  day*; the salt lives only in memory, rotates every 24h, and is destroyed — so two days of the same
  person are **unrelatable by anyone, including us**. No cookies, no stored PII → compliance falls out
  structurally, not by policy.
- **Cons:** no cross-day identity (by design) → can't compute multi-day retention cohorts; correctness
  depends on the salt truly being ephemeral and never logged.

## Decision

**Compute a daily-salted, memory-only visitor hash (Option D).** We accept the permanent loss of cross-day
identity because it is precisely what makes the guarantee *structural*: privacy is enforced by the
**shape of the data**, not by a promise. There is no profile to leak, hand over, or misuse — the system
*cannot* know who a visitor is or what they did yesterday. This is a feature, not a limitation.

## Consequences

- **Good:** GDPR/CCPA/PECR compliance without cookie banners; a genuine competitive wedge; nothing
  personal to breach; `visitors ≠ sessions` still works within a day (already implemented via
  `COUNT(DISTINCT visitor_id)`).
- **Bad / accepted cost:** no multi-day per-visitor analytics; the privacy guarantee is only as good as
  the salt's ephemerality — the salt must **never** be persisted or logged, and IP/UA must be discarded
  after hashing. This invariant is load-bearing; guard it in code review.
- **Revisit when:** never for the core guarantee — this is invariant #1. Any feature needing cross-day
  identity must be redesigned to respect it (e.g. explicit, consented, first-party opt-in), never by
  weakening the hash.
