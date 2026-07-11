# ADR-0002: Postgres now, columnar-shaped for later

- **Status:** Accepted
- **Date:** 2026-07-10
- **Deciders:** Logly architecture
- **Related:** ADR-0001, `LEARNING_GUIDE.md` §13, `GUIDE.md`

## Context

The design brief specifies a **ClickHouse** columnar store for events — the correct long-term engine for
append-only, high-ingest, scan-heavy analytics. But the product is pre-traffic and built by a tiny team.
Adopting ClickHouse now means running and operating a second database, hand-tuning SQL, and slower
iteration — paying for scale we don't have. The tension: pick the *right-at-scale* engine now, or the
*right-for-today* engine and keep the door open.

## Options considered

### Option A — Adopt ClickHouse immediately
- **Pros:** the end-state engine; no migration later; columnar compression + fast scans from day one.
- **Cons:** operational weight (a second DB), two query dialects, slower MVP iteration, expertise cost —
  all to serve traffic that doesn't exist yet.

### Option B — PostgreSQL now, keep the architecture columnar-shaped (chosen)
- **Pros:** one boring, well-understood database; fast iteration; Prisma types; *and* — because reads go
  through precomputed rollups behind a typed API — the event store can be swapped later without
  rewriting the product.
- **Cons:** Postgres will hit a scaling cliff on the raw `events` table (writes + retention pruning) at
  volume; not the end-state engine.

### Option C — A cloud data warehouse (BigQuery/Snowflake)
- **Pros:** serverless scale, cheap storage.
- **Cons:** query latency and cost model are wrong for realtime dashboards; weak fit for the "instant"
  UX the product promises.

## Decision

**Use PostgreSQL now, but preserve the seams that make a Postgres→ClickHouse migration safe (Option B).**
We accept a future migration and a known scaling cliff, because the alternative is paying ClickHouse's
operational tax before we have the traffic to justify it. The migration is de-risked *by design*: reads
never scan raw events (they read `daily_stats` rollups) and go through a typed API, so the storage engine
is swappable behind a stable read contract.

## Consequences

- **Good:** minimal ops; fast iteration; the load-bearing patterns (immutable events, rollups, hot/cold
  split) are identical to the end-state, so nothing conceptual is thrown away.
- **Bad / accepted cost:** the `events` table is not partitioned today; retention pruning and high-volume
  writes will slow down; we owe a migration later.
- **Revisit when:** event volume makes writes/retention slow — then **(1)** partition `events` by time
  (native Postgres), and only if that's insufficient **(2)** move hot analytics to ClickHouse. Don't do
  either before the metrics demand it.
