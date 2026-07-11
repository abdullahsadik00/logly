# ADR-0001: Separate the write path from the read path

- **Status:** Accepted
- **Date:** 2026-07-10
- **Deciders:** Logly architecture
- **Related:** ADR-0002, `LEARNING_GUIDE.md` §6/§7/§12, `ACTION_PLAN.md`

## Context

Analytics ingestion and analytics querying have **opposite characteristics**. Ingestion is a
high-volume firehose from untrusted third-party sites that must never drop data and must respond in
single-digit milliseconds. Querying is lower-volume, authenticated, and must return correct, typed
answers. If the same code path serves both, a slow dashboard query or a database hiccup can throttle or
drop incoming events — coupling two systems whose failure domains should be independent.

## Options considered

### Option A — Write each event straight to Postgres in the request
- **Pros:** simplest possible; data is durable immediately; no second process.
- **Cons:** ingestion latency = DB write latency; a DB slowdown drops real analytics; write spikes hammer
  Postgres; the collector inherits the DB's failure domain. Dies under load.

### Option B — Buffer to Redis, drain with a background worker (chosen)
- **Pros:** collector returns in ~ms (`RPUSH` + `204`); Redis absorbs spikes; DB throughput is
  decoupled from ingestion; the worker batches inserts and maintains rollups.
- **Cons:** eventual consistency (~5s before events appear); a second process (the worker) to run and
  monitor; Redis becomes a critical component.

### Option C — Kafka / Redis Streams + stream processors
- **Pros:** durable, replayable, ordered, scales horizontally; the "real" web-scale answer.
- **Cons:** heavy operational surface for a 1–3 person team; overkill for pre-web-scale traffic.

## Decision

**Buffer events in a Redis list and drain them with a separate background worker (Option B).** We
knowingly accept ~5 seconds of eventual consistency and the operational cost of a second process,
because the payoff is the thing the product depends on: ingestion that stays fast and never drops data
regardless of database health. Option A was rejected as an eventual outage; Option C as premature
operational weight we can adopt later without changing the *shape* (see ADR-0002).

## Consequences

- **Good:** tiny, resilient ingestion; write spikes never touch Postgres; the worker also computes
  rollups so reads are cheap.
- **Bad / accepted cost:** you must run `npm run worker` alongside the API (forgetting it = empty
  dashboard — the #1 support gotcha); a few seconds of lag; Redis is now load-bearing.
- **Revisit when:** we need durable replay/ordering or multi-consumer fan-out — then migrate the Redis
  list to **Redis Streams** (consumer groups + DLQ). The hot/cold seam stays; only the queue changes.
