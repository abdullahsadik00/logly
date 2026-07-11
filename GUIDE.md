# Logly — Senior Dev Guide

You're building a real product. Not a tutorial, not a toy. People pay $9–19/month for
Plausible.io and Fathom. We're building the same thing — privacy-first analytics with a tiny
tracking script, a real-time dashboard, and a reliable backend — but with one obsession the others
don't name out loud.

**The mission is Decision Velocity: shrink the gap between a question and a confident decision.**
Analytics tells you about yesterday. Logly is built to tell you what to do right now. Every
architectural choice in this guide is downstream of that one sentence.

This guide is the bridge between two things in this repo:

- **The design brief** (`Logly product design brief/`, Phases 1–41) — the full product spec:
  every feature, contract, and invariant. It's aspirational and complete.
- **This app** (`logly/backend` + `logly/frontend`) — the real implementation we ship, built by a
  small team (realistically one to three people) on a pragmatic stack.

**How to read the two together.** The brief specifies a full production stack (ClickHouse, Fastify,
Redis Streams, a full exploration engine). We deliberately build the MVP on a simpler,
one-founder-buildable stack (PostgreSQL, Express, a Redis list) — *but we adopt every load-bearing
pattern and invariant from the brief from day one.* Patterns are portable; vendors are not. Wherever
the MVP simplifies the brief, you'll see a callout:

> **Brief target vs MVP now.** What the brief ultimately wants, what we ship first, and the exact
> migration path between them. We build toward the target; we don't pay for it before we have the
> traffic that needs it.

Read this whole guide before writing a line of code.

---

## The Load-Bearing Decisions (do not violate these)

These recur across every brief doc. They are the constitution. Features come and go; these don't.

1. **Privacy is structural, not policy.** No PII, no cookies, no cross-site tracking. Visitor
   identity is a *daily-salted hash* whose salt lives only in memory and is destroyed every 24h —
   so the same visitor on two different days is **unrelatable by design**. GDPR/CCPA/PECR compliance
   then follows automatically, with no consent banner. The schema must be *physically incapable* of
   storing a person.
2. **Event-first & immutable.** Raw events are an append-only log. Corrections are new events, never
   updates. Everything else (rollups, sessions, dashboards) is a **projection** that can be thrown
   away and rebuilt from the log. A bad rollup is recomputed, not lost.
3. **Write/read seam.** Ingestion (write) and analytics (read) scale independently and never share a
   database reach-in. A traffic spike must never slow a dashboard. Dashboards read **pre-computed
   rollups**, never raw events.
4. **Speed is the product.** Every interaction has a measurable p95 budget (see *Engineering
   Readiness*). A repeated question is a **cache hit**, not a re-query — caches are keyed off the
   ExplorationState hash.
5. **One front door, one-way boundaries.** The frontend talks only to the API. Services own their
   data and talk via the queue or typed contracts. Frontend import direction is strictly
   `app → features → components → lib`; features never import features.
6. **Contracts are shared and validated on both ends.** One Zod schema per shape, used by the SDK,
   the collector, the worker, the API, and the frontend. The contract is the source of truth; a
   breaking change fails CI.

If a PR ever forces a choice between shipping a feature and honoring one of these, the invariant
wins. That's the whole point of writing them down.

---

## What We're Building

A developer drops one cookie-free `<script>` tag into their app. Logly collects, privately and in
real time:

- Page views (automatically, including SPA navigation)
- Custom events (`window.logly.track('signup_completed', { plan: 'pro' })`)
- Unique visitors (daily-salted hash — no cookies, no cross-day identity)
- Bounce rate, session duration (sessions reset every 24h, by design)

They explore all of it in a real-time dashboard where **exploration is refinement of state, never
navigation** — one shared, URL-encoded question drives every chart, table, and stream. And Logly
doesn't just show numbers: a **deterministic decision engine** (no AI, no black box) surfaces what
changed and what to do about it.

### Scope tiers (from the brief's MVP Execution Blueprint)

We build in this order. Everything in the brief is here — sequenced, not crammed.

- **Core MVP (must ship — "if any is missing or slow, there's no product"):** one-line snippet;
  ingestion → raw events → rollups; realtime count + live feed; core dashboard (trend, breakdown,
  table); composable filters + time range; ExplorationState in the URL (shareable answers).
- **v1.0 "charge money":** onboarding/install flow, domains, segments, comparison, goals, realtime
  feed + map, saved views, command palette, teams + roles, site settings, billing scaffold.
- **v1.1 fast-follow:** alerts, notification center, exports, API keys, audit log, annotations.
- **v2 expansion:** funnels, heatmaps, AI-assisted exploration, threaded collaboration, advanced
  comparison.
- **Future:** experiments, session replay, warehouse connectors, native mobile, enterprise SSO.

The PR build order at the bottom covers MVP → v1.1 in detail and stubs v2+ so you know where it
plugs in.

---

## The Hard Part Nobody Tells You

The hardest problem in analytics is **not** the dashboard. The dashboard is just React + a few
queries against rollups. The hard problem is the **collector endpoint**.

A medium SaaS with 50,000 users at 10 pages/day is ~500k events/day — ~6 events/sec on average. But
traffic isn't average. A Product Hunt launch sends 1,000 events/sec for 20 minutes.

### Why you can't write directly to PostgreSQL on every request

PostgreSQL defaults to 100 connections. Each write holds one for ~5ms. At 1,000 req/s you'd need
thousands of simultaneous connections; Postgres falls over and the collector starts returning 500s.
Events are lost. Even PgBouncer only defers the problem — direct writes at scale cause latency
spikes that back-pressure the Node event loop, and the tracking script starts timing out.

### Why you can't do synchronous processing on every request

The collector must respond in **< 5ms** or `navigator.sendBeacon()` calls fail silently. GeoIP
lookups (disk I/O), UA parsing (CPU), and DB writes (network + I/O) each blow that budget. Do them
later, off the hot path.

### The right architecture: buffer + background worker

```
Browser
  └─► POST /api/collect/:trackingId   (< 2ms, returns 204/202)
           │  (resolve trackingId, Zod-validate, enqueue — nothing else)
           ▼
       Redis buffer  (RPUSH events:<projectId>)
           │
           ▼ (worker drains every 5s)
       Background Worker
           ├─► compute daily-salted visitor_hash (privacy model)
           ├─► GeoIP → country, then discard IP
           ├─► UA → browser/os/device
           ├─► batch INSERT into events (immutable)
           └─► upsert rollups (daily_stats today; multi-grain later)
```

**The collector does three things only:** resolve `trackingId → projectId` (Redis cache, 5-min TTL,
DB fallback), Zod-validate, enqueue. That's it — 1–2ms, tens of thousands of req/s on one process.
It never touches Postgres.

> **Brief target vs MVP now.**
> - **Queue.** MVP: a Redis **list** (`RPUSH` / `LRANGE`+`LTRIM`). Brief target: **Redis Streams**
>   with consumer groups (durable, ordered, multi-worker). Migrate when you need more than one worker
>   or guaranteed ordering — swap the enqueue/drain calls; the collector contract doesn't change.
> - **Event store.** MVP: PostgreSQL, partitioned by month. Brief target: **ClickHouse** columnar
>   (10–20× compression, built for append-only OLAP). Migration path below in *Schema*.
> - **Framework.** MVP: Express. Brief target: Fastify. Same routes, same middleware seam — a
>   mechanical swap, not worth doing until throughput demands it.

**Why a shared buffer, not an in-memory array?** Production runs multiple processes with no shared
memory. Redis is a shared, persistent buffer that survives a single process crash. **Watch out:** a
Redis list is not a real message queue — if the worker crashes mid-flush after `LTRIM`, those events
are gone. For best-effort analytics that's acceptable at MVP; Redis Streams (the brief target) fixes
it with acknowledgements. Don't reach for BullMQ/SQS on the hot path — keep the collector dumb.

---

## The Privacy Model — the one brief pattern you adopt immediately

This is non-negotiable and it's the thing the current scaffold is missing. Adopt it now; everything
else in the brief's privacy story (GDPR, no consent banner, "measures visits, not people") falls out
of it for free.

**Visitor identity = a daily-rotating salted hash, computed in the worker, never in the browser:**

```
visitor_hash = SHA256( daily_salt || ip || user_agent || project_id )
```

- `daily_salt` is a random value generated per day, held **in memory only**, and **destroyed at
  midnight (UTC)**. It is never written to disk or DB.
- The raw IP is used only to (a) compute the hash and (b) resolve a 2-letter country, then it is
  **discarded**. It is never stored.
- Because the salt is gone tomorrow, yesterday's `visitor_hash` cannot be reproduced or joined to
  today's — **not even by us.** Cross-day identity is impossible by construction.

**What this means downstream:**

- Sessions never span two days (the hash rotates at midnight). A "session" is a 30-min inactivity
  window *within one day*. The dashboard copy says so out loud: "Sessions are anonymous and reset
  daily."
- `visitors` for a day = distinct `visitor_hash` count for that day. It is meaningless across days,
  by design — don't build a "returning visitor" metric on it.
- **What we store:** project_id, path, referrer, utm, browser/os/device, country (2 letters), the
  daily `visitor_hash`. **What we hash-then-discard:** ip+ua → hash, ip → country, API secret →
  SHA-256, password → bcrypt/argon2. **What we never store:** names/emails on events, cookies,
  device fingerprints kept across days, precise geolocation, raw IPs.

> **Brief vs scaffold today.** The current scaffold has `session_id` only and computes
> `visitors === distinct sessionIds`. **PR 8 upgrades this** to the daily-salted `visitor_hash`. Do
> not ship to real users without it — it's the compliance story.

**Watch out:** the salt must be shared across worker processes for a given day (so the same visitor
hashes identically) but must never be persisted. Store it in Redis with a TTL to midnight (`SET salt
<random> EXAT <midnight>`), regenerate on miss, and treat a salt rotation as a hard session
boundary. The salt in Redis is the *only* acceptable place it lives, and it self-destructs.

---

## The Schema

Two engines, one seam: an append-only store for events/rollups, a relational store for metadata.

> **Brief target vs MVP now.** The brief uses **ClickHouse** for `events`/`sessions`/`aggregations`
> and **PostgreSQL** for all config/metadata. We ship **everything on PostgreSQL** for the MVP
> (partitioned `events` + rollup tables), because one Postgres is far easier to run than
> Postgres+ClickHouse, and it's what the scaffold already uses. **Migration path to ClickHouse:**
> (1) keep the write/read seam clean so nothing reads raw events directly except the worker;
> (2) dual-write events to ClickHouse behind a flag; (3) backfill from the partitioned Postgres
> table; (4) cut rollup + breakdown reads over to ClickHouse; (5) drop the Postgres partitions. Do
> this only when a single project's events exceed roughly 100M/month or breakdown queries miss their
> latency budget — not before.

### Metadata (PostgreSQL, relational, transactional)

The brief's full metadata model. Prisma-managed. Soft-delete (`deleted_at`) where the brief says
data is restorable.

```sql
-- Accounts of Logly (the developers who buy it)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,               -- bcrypt(12) or argon2id
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A team/workspace owns projects and members (RBAC lives here)
CREATE TABLE teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','agency','enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
  invited_by  UUID REFERENCES users(id),
  invite_token   TEXT UNIQUE,               -- pending invites
  invite_expires TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ,
  PRIMARY KEY (team_id, user_id)
);

-- A project = one website being tracked
CREATE TABLE projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_id       UUID NOT NULL REFERENCES users(id),
  name           TEXT NOT NULL,
  domain         CITEXT NOT NULL UNIQUE,     -- e.g. "myapp.com"
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  retention_days INT  NOT NULL DEFAULT 90 CHECK (retention_days IN (30,90,365,-1)), -- -1 = ∞
  tracking_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- PUBLIC, goes in script tag
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ                 -- soft delete; purge after 30d
);

CREATE TABLE domains (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  host         CITEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL CHECK (type IN ('primary','wildcard','staging','preview','blocked')),
  verified     BOOLEAN NOT NULL DEFAULT false,
  verify_token TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Goals: "did visitors do what you wanted?" — versioned so edits keep history
CREATE TABLE goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('page','event','outbound','file','time','scroll')),
  target     JSONB NOT NULL,                 -- per-type config (path, event name, url, etc.)
  version    INT  NOT NULL DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draft','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE goal_versions (                 -- edit history (1:N)
  goal_id    UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  version    INT  NOT NULL,
  target     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, version)
);

-- Alerts: "what changed that you should know about?"
CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  metric      TEXT NOT NULL,                 -- traffic_spike, traffic_drop, conv_drop, errors404, ...
  condition   TEXT NOT NULL CHECK (condition IN ('gt','lt','eq','pct','above_avg','below_avg','vs_day','vs_week')),
  threshold   NUMERIC NOT NULL,
  window      TEXT,                          -- rolling window for the comparison
  channels    TEXT[] NOT NULL,               -- 'email','inapp' live; 'slack','discord','webhook' future
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','muted','draft','archived')),
  muted_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE alert_triggers (                -- breach history, retained ~1yr
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id   UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  value      NUMERIC NOT NULL,
  fired_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys: reveal-once, only the hash is stored
CREATE TABLE api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  key_hash   TEXT NOT NULL UNIQUE,           -- SHA-256 of the secret; the secret is never stored
  prefix     TEXT NOT NULL,                  -- e.g. 'lgly_sk_' + first chars, for display
  scopes     TEXT[] NOT NULL,                -- 'read','write'
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,                  -- checked on every request
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved explorations = a saved ExplorationState (see the Exploration Engine section)
CREATE TABLE saved_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  state      JSONB NOT NULL,                 -- serialized ExplorationState
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log: who/what/when — insert-only, ~1yr
CREATE TABLE audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  actor_id   UUID REFERENCES users(id),
  target     TEXT NOT NULL,
  action     TEXT NOT NULL,
  before     JSONB,
  after      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);           -- monthly, like events

-- Async export + notification jobs
CREATE TABLE export_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  format       TEXT NOT NULL CHECK (format IN ('csv','png','pdf','json')),
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  progress     INT NOT NULL DEFAULT 0,
  url          TEXT,                          -- signed, short-lived (24h)
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE notification_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alert_id     UUID REFERENCES alerts(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('email','inapp','slack','discord','webhook')),
  payload      JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','dead')),
  attempts     INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Events + rollups (PostgreSQL now; ClickHouse-shaped for later)

```sql
-- Raw events — append-only, partitioned by month.
-- NOTE: Prisma cannot generate PARTITION BY. Write this as raw SQL in the migration file.
CREATE TABLE events (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (name IN ('pageview','custom')),
  path         TEXT NOT NULL,               -- URL path, e.g. "/pricing"
  referrer     TEXT,
  utm          JSONB,                        -- {source, medium, campaign, term, content}
  country      TEXT,                         -- 2-letter ISO, derived from IP then IP discarded
  browser      TEXT,
  os           TEXT,
  device       TEXT CHECK (device IN ('desktop','mobile','tablet')),
  event_name   TEXT,                         -- only for name='custom'
  event_props  JSONB,                        -- arbitrary custom event data (cap ~1kb)
  visitor_hash TEXT,                         -- daily-salted hash (see Privacy Model)
  session_id   UUID,                         -- groups events into a same-day session
  ts           TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (ts);

CREATE TABLE events_2026_07 PARTITION OF events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- ... a cron/worker job creates next month's partition ahead of time
ALTER TABLE events ADD PRIMARY KEY (id, ts);        -- PK must include the partition key
CREATE INDEX ON events (project_id, ts DESC);       -- the hot query pattern
CREATE INDEX ON events USING GIN (event_props);     -- filter on arbitrary custom props

-- Sessions — derived from events (materialized by the worker), never span two days
CREATE TABLE sessions (
  session_id  UUID PRIMARY KEY,
  project_id  UUID NOT NULL,
  visitor_hash TEXT,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  duration_s  INT,
  entry_path  TEXT,
  exit_path   TEXT,
  event_count INT,
  country     TEXT,
  device      TEXT
);

-- Rollups — the read models the dashboard actually queries.
-- MVP ships the 'day' grain (daily_stats). Generalize to multi-grain in PR 11.
CREATE TABLE daily_stats (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  views      INT NOT NULL DEFAULT 0,
  visitors   INT NOT NULL DEFAULT 0,        -- distinct visitor_hash for that day
  sessions   INT NOT NULL DEFAULT 0,
  bounces    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date)
);

-- Brief target: a general rollups table keyed like ClickHouse's AggregatingMergeTree
CREATE TABLE rollups (
  project_id UUID NOT NULL,
  grain      TEXT NOT NULL CHECK (grain IN ('minute','hour','day','week','month')),
  bucket     TIMESTAMPTZ NOT NULL,
  dimension  TEXT NOT NULL,                  -- 'path','country','device','referrer','__total__', ...
  key        TEXT NOT NULL,                  -- the dimension value
  views      INT NOT NULL DEFAULT 0,
  visitors   INT NOT NULL DEFAULT 0,
  bounces    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, grain, bucket, dimension, key)
);
```

**Why each decision was made:**

- `tracking_id` (UUID) is **public** — it goes in the script tag, visible in page source. The
  project `id` is **internal** and must never be exposed. Never confuse them.
- `visitor_hash` replaces the scaffold's cookie/fingerprint story — see *Privacy Model*. It is
  meaningful only within one day.
- `event_props JSONB` (not JSON): JSONB supports GIN indexes for fast filtering on arbitrary keys.
- `daily_stats` / `rollups` exist because `SELECT COUNT(*)` over millions of raw rows is slow even
  indexed. The worker maintains them; dashboards read them. **This is the write/read seam.**
- `goals.version` + `goal_versions`, `alerts` + `alert_triggers`, `saved_views`, `audit_log`,
  `export_jobs`, `notification_jobs` are the brief's full v1.0/v1.1 surfaces — modeled now so later
  PRs only add code, not migrations you have to reconcile.

**Retention (brief):** events + sessions honor `retention_days` (drop old partitions — never slow
`DELETE`s); rollups ~13 months then monthly; realtime presence ~30-min TTL in Redis; audit ~1yr;
export files 24h; soft-deleted projects purged after 30 days.

---

## The Read Path: Rollups, Not Raw Scans

Dashboards never scan raw events. The worker maintains rollups; the API reads them. This is how you
hit the < 400ms fresh-query budget.

- **MVP:** the worker upserts `daily_stats` on every flush (idempotent — see *Things That Bite*).
  The dashboard reads `daily_stats` for trend/today numbers; breakdowns (top pages/sources) query
  the raw `events` table for the *current* small partition and cache the result in Redis for ~60s.
- **Brief target:** the general `rollups` table across five grains (minute → month). The query
  planner selects the **coarsest grain** that covers the requested range (today → hourly; 90d →
  daily). A read never computes what a rollup already holds.

**Rebuildability is the safety net.** Because events are immutable, any rollup is a pure function of
the log. If a rollup drifts (see the risk register in the brief), you recompute it — you never lose
data. Add a reconciliation check to CI that recomputes a day's rollup from raw events and asserts it
matches; the brief calls rollup-vs-raw drift a top risk.

---

## The Exploration Engine & ExplorationState

This is the frontend's spine and it's free to adopt on any stack. **Analytics is a function of
state, not a set of pages.** Every chart, table, stream, filter, comparison, and shareable link is a
*projection* of one object: `ExplorationState`.

### The contract

One serialized object per project view. Most fields live in the **URL — the single source of
truth** — so reload, share, and bookmark all reproduce the exact answer with no "save" button.

Fields (brief Phase 19): `project`, `time` (relative token like `7d`/`mtd`, not resolved dates),
`metric`, `filters[]` (ANDed), `segments[]`, `grouping[]`, `sorting`, `comparison`, `projection`
(which lens), `realtime`, `selection`, `focus`, `pagination`, `savedView`, `version` (for migration)
— all URL-serialized; plus `annotations` (derived), `command`/`ui` (local, ephemeral, never shared),
`extensions` (reserved namespace). The state is **total**: every field has a default, so a partial
state is always valid and renderable.

Rules that make it work:

- **URL is the source of truth.** A Zod codec parses/serializes it; invalid params are dropped, never
  thrown. Mutations debounce a single `replaceState` write.
- **The serialized state hash is the query key.** Same question → cache hit → zero-query answer.
- **Mutations are pure and named** (`replace`, `merge`, `append`, `remove`, `toggle`, `reset`,
  `undo`/`redo`). They never read the clock, randomness, or network — that's why "last 7 days" is
  stored as a relative token, not resolved dates. Each mutation pushes an in-memory undo stack
  (undo/redo is free).
- **Projections read one resolved result.** Dashboard cards, trend, breakdown, realtime feed, table,
  journey, timeline, heatmap, Sankey, funnel, map, comparison — all read the same result object.
- **Realtime is the same projection fed by a diff stream**, never a separate code path, and it
  converges to the historical rollup at each bucket close ("a preview, never a fork").
- **Every state is untrusted** (typed, edited, aged, shared URLs). Never crash — migrate old
  versions forward, drop malformed fields, degrade to the nearest valid question, and explain.

> **Brief target vs MVP now.** MVP ships the core fields (`time`, `metric`, `filters`, `grouping`,
> `projection`, `comparison`, `pagination`) and client-side projection/query caching. Add
> `segments`, `selection`/`focus`, server-side state storage (a short state hash in the URL pointing
> at a stored blob for very large states), and the full projection set as you build the lenses. The
> codec and URL-as-truth rule land in **PR 3**, before any dashboard code — everything downstream
> depends on them.

### Caching (all keyed off the state hash)

1. **Projection cache** — per state hash, session-lived, dropped on any hash-changing mutation
   (switching lenses is free).
2. **Query cache** — per plan hash, 1–60 min TTL, shared across users (short for recent, long for
   historical).
3. **Realtime cache** — per project slice, ~2s, hot Redis counters refreshed by the diff stream.
4. **Sub-result cache** — bare totals/breakdowns cached separately for reuse.
5. **Shared-link cache** — first open of a shared URL warms the cache for the whole team.

---

## The Decision Engine (deterministic — no AI)

Logly's differentiator. It turns rollups into recommendations with **no model, no training, no black
box** — deterministic rules over already-resolved facts.

- Reads only the resolved result + comparison; it computes nothing new and hits no network.
- Classifies movers by **metric polarity**: a fall in 404s or bounce rate is good; a fall in
  conversions is not. Direction alone is not the signal — the metric's meaning is.
- Every recommendation is **reproducible** (same state → same recommendation), carries a computed
  confidence and priority (ranked by expected impact/urgency), **links back to the exact aggregates**
  (evidence), and resolves to a concrete, reversible action.
- Surfaced as the dashboard's **Decision Bar** — the "10-second briefing" the brief leads with.

Because it's pure, it's cheap to test: feed a fixed state, assert the exact recommendations.

---

## Realtime

`GET /api/projects/:id/metrics/realtime` is an SSE stream. The worker bumps a `realtime:<id>`
counter and publishes diffs via Redis pub/sub; the API fans them to connected clients.

- Live count = distinct `visitor_hash` in the last 5 min (Redis sorted set, `ZRANGEBYSCORE`).
- Live feed = the diff stream of recent events.
- Cadence ~2s, **delta-only payloads**, trailing debounce, backpressure coalescing (shed
  intermediate frames under load), 15–25s heartbeat, exponential-backoff reconnect that
  re-baselines with a fresh snapshot, offline buffering of the last good value.

> **Brief target vs MVP now.** MVP: SSE only (simpler, auto-reconnects via `EventSource`). Brief
> target: a WebSocket → SSE → polling transport ladder. SSE covers the one-directional live count
> and feed; only add WebSockets if you build something genuinely bidirectional.

**Watch out:** SSE connections are long-lived sockets. Handle `req.on('close')` to clean up or you
leak memory. Node's event loop handles many idle connections fine, but each still costs a socket.

---

## The SDK

Runs in customers' production browsers. Must be tiny (< 2kb gz), `async`, reliable, SPA-aware, and
**fail silently — never break the host page.**

- **SPA tracking:** monkey-patch `history.pushState`/`replaceState` and listen for `popstate` so
  client-side navigations are tracked. A naive script records only the first load.
- **Batching:** buffer in memory, flush at 10 events or 5s, and flush on unload with
  `navigator.sendBeacon` (fetch/XHR get cancelled on page close; beacon doesn't).
- **No identity in the browser.** The SDK sends *no* visitor id and sets *no* cookie. Identity is
  derived server-side in the worker (the daily-salted hash). This is a deliberate change from the
  old scaffold plan of a client-side fingerprint — it keeps the privacy story airtight and the
  script smaller.
- **Cap `event_props` (~1kb)** client-side so a customer can't dump their Redux store into your
  queue.
- **Wrap the entire SDK in try/catch.** Any uncaught throw breaks a customer's site.

Install is one line (matches the brief's Installation wizard):

```html
<script src="https://cdn.logly.app/l.js" data-key="lgl_pk_..." defer></script>
```

Plus package installs (`@logly/browser`, `@logly/react`, `@logly/node`) for framework users, and
`logly.track(name, props)` for custom events. Public key `lgl_pk_...` is client-safe; secret key
`lgl_sk_...` is server-only.

---

## Frontend Architecture

Feature-first, matching the brief's Phase 16. This is a hard structure, not a suggestion.

- **Folder layout:** `app/ features/ components/ layouts/ routes/ lib/ stores/ hooks/ providers/`.
  Feature modules under `features/<name>/` (dashboard, realtime, analytics, goals, alerts, projects,
  settings, team, account, onboarding), each with the fixed internal shape: `components/ hooks/
  api/ types/ pages/`. Only `pages/` and public hooks are exported via a barrel `index.ts`.
- **Import direction (enforced by lint):** `app → features → components → lib`. **Features never
  import features.** Shared code moves down to `lib/` or `components/`.
- **State discipline (load-bearing):** **TanStack Query owns all server state**; **Zustand holds
  client state only** (auth, UI, ephemeral). If the server owns the truth, it belongs in a
  `useQuery`, never duplicated into a store. This is exactly what the scaffold already does
  (`lib/queryKeys.ts`, `lib/api.ts`, `stores/authStore.ts`) — keep it.
- **Routing:** React Router, project-scoped (`/:projectId/...`), every route lazy + wrapped in a
  layout and a guard (`ProtectedRoute`/`GuestRoute`, already in `App.tsx`).
- **API layer:** one typed fetch client under `lib/api/`; every response Zod-parsed; errors
  normalized to `ApiError { code, message }`. Query keys via typed factories for precise
  invalidation.
- **Theming/Design System:** Tailwind tokens only — no hard-coded hex. Consume the brief's Design
  System (dark `#08090B`, accent `#16C98A`, Geist type, Lucide icons, WCAG AA, `prefers-reduced-
  motion`). Ship it as `components/ui/` primitives.
- **Performance budgets (CI gate):** initial JS < 180KB gz, route chunk < 60KB, LCP < 1.8s,
  INP < 200ms. Virtualize long tables (TanStack Virtual).

---

## API Design (contract-first, one front door)

REST, versioned, workspace-scoped, RBAC-checked. The full brief surface — build the endpoints as the
features land, but design them all up front so shapes don't drift.

```
Auth:      POST /register · POST /login · GET /me            (JWT in httpOnly cookie)
Teams:     invite / roster / role change                     (RBAC: owner|admin|editor|viewer)
Projects:  CRUD + settings + domain verify + key rotation
Collect:   POST /api/collect/:trackingId                     (public, open CORS, no auth, rate-limited)
Metrics:   /today · /trend · /pages · /sources · /devices · /realtime(SSE)   (read from rollups)
Explore:   resolve an ExplorationState hash → result         (events/sessions/journey lenses)
Goals:     CRUD + pause/resume/archive                       (6 types, versioned)
Alerts:    CRUD + test/mute + notification center (read/ack)
Exports:   request → poll → download (signed, 24h)
Keys:      create(reveal-once) / list / revoke
Audit:     read history (insert-only server-side)
Webhooks:  subscribe / deliver(signed) / replay
Imports:   CSV / GA4 / Segment / Mixpanel → normalized to the event contract
```

Conventions (brief Phase 17): uniform `{data, meta}` envelope; error `{error:{code,message,
retry_after}}`; cursor pagination; `Idempotency-Key` on writes; Bearer session for the app, scoped
`lgly_sk_...` keys for the API. Authorization is `can(actor, action, resource)` — checked on the
resource, deny by default, ownership before role. **Workspace id is derived server-side, never
trusted from input** → cross-tenant access is structurally impossible. Shared links carry a signed,
read-only scope that can't elevate.

**The collector is special:** its own router, **zero auth**, wide-open CORS (it runs on third-party
sites — it sets `Access-Control-Allow-Origin: *` itself), rate-limited per `trackingId` (~1000/min →
429). Never move auth/rate-limit middleware in front of it. Everything else (`/api/auth`,
`/api/projects`, …) gets credentialed CORS locked to the frontend origin + a rate limiter.

---

## Integrations (the brief's API & Integrations doc)

- **Webhooks:** emit onto a queue (non-blocking) → deliver **signed, at-least-once, in-order per
  subscription** → verify signature → retry with backoff+jitter (bounded) → dead-letter on failure →
  **replay on demand** ("no event ever lost").
- **Imports:** CSV (one-time), GA4 / Mixpanel (connectors), Segment (stream), warehouse (scheduled),
  historical backfill — **all normalize to the same event contract before storage.** One validation
  path, no special cases downstream.
- **Exports:** CSV / JSON / PNG / PDF / scheduled reports — async, resumable, access-scoped, **derived
  fields only, never raw identities** (there are none to leak).
- **SDKs:** thin skins over one contract — Web/JS + Node + React/Next now; RN + edge later.

---

## BUILD ORDER: PR by PR

Work in this order. Each PR is small and mergeable on its own. The grouping mirrors the brief's
8 MVP sprints, then extends through v1.0 and v1.1. Don't skip ahead — the critical path is
**Foundation → Ingestion → Rollups**, and *nothing downstream works until rollups exist.*

Every PR ships with: **What it does**, **Test before merge**, **Watch out**. And it isn't "done" when
it works — it's done when it passes the 7-gate Definition of Done (Engineering, Design, QA,
Accessibility, Performance, Documentation, Released with a rollback path).

---

### Sprint 1 — Foundation

#### PR 1: Monorepo + shared types + CI gates
**What it does:** npm-workspaces monorepo (Express+TS backend, Vite+React frontend, shared
`packages/types`). ESLint/Prettier, Husky pre-commit (lint + typecheck). CI runs typecheck, build,
**and the performance + accessibility budgets as blocking gates** (brief: perf/a11y have no
override).
**Test before merge:** typecheck + build pass both sides; a deliberate budget-buster (oversized
bundle) fails CI.
**Watch out:** don't reach for Turborepo/Nx yet — npm workspaces is enough; add caching only if
build time actually hurts. Add the lint rule that forbids cross-feature imports now, while there's
nothing to fix.

#### PR 2: Design System package
**What it does:** the brief's Phase 15 tokens + primitives as `components/ui/` (buttons, inputs,
chips, cards, tables, overlays), Tailwind `@theme` tokens (dark `#08090B`, accent `#16C98A`, Geist,
Lucide), WCAG-AA focus rings, `prefers-reduced-motion` gate.
**Test before merge:** a Storybook/gallery route renders every primitive in every state; axe reports
no violations; reduced-motion disables animation.
**Watch out:** tokens only — no hard-coded hex anywhere downstream. Get the 44×44 hit areas and
2px/2px focus ring right now; retrofitting a11y later is miserable.

#### PR 3: ExplorationState schema + URL serializer
**What it does:** the Zod codec for ExplorationState and the URL round-trip (parse → migrate →
validate → default; serialize → debounced `replaceState`). The state hash function. No UI yet.
**Test before merge:** property test — a random valid state serializes and parses back identically
(lossless round-trip); a garbage URL degrades to a valid default without throwing; the hash is
stable across key order.
**Watch out:** this blocks everything downstream (brief: "Ingestion + the ExplorationState contract
block everything"). Store `time` as a **relative token**, never resolved dates, or shared links go
stale. Version the schema from v1 so future URLs migrate forward.

---

### Sprint 2 — Ingestion

#### PR 4: DB schema + partitioned events + metadata tables
**What it does:** Prisma schema for all metadata tables (users, teams, team_members, projects,
domains, goals(+versions), alerts(+triggers), api_keys, saved_views, audit_log, export_jobs,
notification_jobs). Raw-SQL migration for the partitioned `events` table + `sessions` + rollup
tables. Seed script (test user, team, project). Docker Compose (Postgres + Redis).
**Test before merge:** `prisma migrate deploy`; confirm partitioning
(`SELECT * FROM pg_partitioned_table`); insert an event and check it lands in the right month
(`SELECT tableoid::regclass FROM events LIMIT 1`).
**Watch out:** Prisma silently ignores `PARTITION BY` — the `events` table **must** be raw SQL.
Partition bounds are exclusive on the right (`… TO ('2026-08-01')` → midnight belongs to August).

#### PR 5: Auth API + UI
**What it does:** register/login/me; JWT in an **httpOnly cookie** (not localStorage); Zod
validation; bcrypt(12). LoginPage + RegisterPage; auth state in Zustand.
**Test before merge:** register → login → `/me` returns the user; wrong password → 401 not 500; SQL
injection in email is parameterized away.
**Watch out:** httpOnly cookies are harder (need `credentials:'include'` + CORS
`allowCredentials:true` + explicit origin) but a single XSS in any dependency steals a localStorage
token. Do it right.

#### PR 6: Projects + teams + domains CRUD
**What it does:** project CRUD (returns the public `tracking_id`), team membership + roles + invites
(RBAC scaffolding), domain add/verify. Project cards + new-project modal on the frontend.
**Test before merge:** a user cannot access another team's project (`/api/projects/:otherId` → 403,
not the data); role changes respect the ladder (owner can't self-demote without transfer); deleting a
project cascades its events.
**Watch out:** resolve `team_id`/ownership **server-side** on every `/projects/:id` route — never
trust an id from the client. This is the cross-tenant guarantee.

#### PR 7: Collector endpoint + Redis buffer
**What it does:** `POST /api/collect/:trackingId`. Resolve `trackingId → projectId` (Redis cache,
5-min TTL, DB fallback), Zod-validate, `RPUSH events:<projectId>`, bump the realtime counter, return
204. Its own router: **no auth, open CORS, rate-limited per trackingId.**
**Test before merge:** 100 events via curl land in Redis; invalid trackingId → 404; malformed
payload → 400; response < 10ms; > 1000/min for one trackingId → 429.
**Watch out:** never put `requireAuth` on this router. Never log raw payloads in prod (only
`trackingId` + `type`). The collector never touches Postgres.

#### PR 8: Privacy model — daily-salted visitor_hash
**What it does:** the ingestion/worker identity layer. Generate a per-day salt held in Redis with a
TTL to midnight UTC; compute `visitor_hash = SHA256(salt||ip||ua||project_id)`; derive country from
IP then **discard the IP**. Wire `visitor_hash` + `session_id` into enqueued events.
**Test before merge:** the same simulated visitor hashes identically within a day and **differently**
after a forced salt rotation; no raw IP appears in Redis, Postgres, or logs; country still resolves.
**Watch out:** the salt must be shared across worker processes (Redis) but **never persisted to
disk/DB** and must self-destruct at midnight. A salt rotation is a hard session boundary — sessions
never cross midnight.

---

### Sprint 3 — Rollups + query

#### PR 9: Background worker — enrich + batch insert + daily_stats
**What it does:** a separate worker process. Every 5s, drain each active project's Redis list,
enrich (GeoIP via `geoip-lite`, UA via `ua-parser-js`), batch-insert into `events`, upsert
`daily_stats`. A `flushing:<id>` `SET NX EX 30` lock prevents double-drain.
**Test before merge:** 1000 events all land in `events`; `daily_stats` matches; re-running the same
batch does **not** double-count (idempotent upsert).
**Watch out:** `LRANGE`+`LTRIM` isn't atomic — safe with **one** worker only; document it, and move
to Redis Streams (brief target) before scaling to multiple workers. Every external call
(GeoIP/DB) gets a timeout (`Promise.race`) so one hang doesn't stall the flush.

#### PR 10: Sessionization
**What it does:** the worker materializes `sessions` from events — 30-min inactivity window, entry/
exit path, duration, bounce flag (single-pageview session). Never spans midnight (hash rotation).
**Test before merge:** a scripted visit produces one session with correct entry/exit/duration; a gap
> 30 min splits into two; a single pageview is flagged a bounce.
**Watch out:** "bounce" and "duration" are session-derived — get them here, not in the dashboard.
Sessions are anonymous and daily; don't build cross-day session joins.

#### PR 11: Multi-grain rollups + reconciliation
**What it does:** generalize `daily_stats` into the `rollups` table across minute/hour/day/week/month
and the standard dimensions (path, country, device, referrer, `__total__`). Worker upserts all
grains idempotently.
**Test before merge:** rollups recomputed from raw events match the incrementally-maintained ones
(the reconciliation test — wire it into CI); coarser grains equal the sum of finer grains.
**Watch out:** rollup-vs-raw drift is the brief's #1 data risk. The reconciliation check is not
optional — it runs every build.

#### PR 12: Query planner + state-hash query cache
**What it does:** resolve an ExplorationState → a query plan. Hash the state; on hit return the
cached result; on miss pick the **coarsest grain** covering the range, push filters down, run,
cache (1–60 min TTL). Sub-result caching for reusable totals/breakdowns.
**Test before merge:** the same state returns a cache hit (< 10ms); a fresh query hits its < 400ms
budget on seeded data; today→hourly and 90d→daily grain selection is correct.
**Watch out:** the cache key is the serialized state hash — get canonical serialization right
(sorted keys, normalized tokens) or you'll cache-miss on equivalent questions.

---

### Sprint 4 — Dashboard

#### PR 13: Dashboard shell (Design System, mock data)
**What it does:** the full dashboard layout in code — Decision Bar slot, hero metric cards with
sparklines, main chart with deploy markers, breakdown tables, right rail. Hardcoded data. Operational
states (loading/empty/error/offline) as first-class UI (brief: Dashboard V2 models these).
**Test before merge:** renders at all breakpoints; delta colors correct; every operational state
renders; axe clean.
**Watch out:** get spacing/typography/dark-mode right *before* wiring data — restructuring after is
expensive. This is what users see every day.

#### PR 14: Projections wired to rollups (trend / breakdown / table)
**What it does:** replace mock data — trend from rollups, breakdowns (top pages/sources, device/
browser/OS), table. Date-range selector. Backfill zero rows for gap days **in the API**, not the
frontend.
**Test before merge:** multi-day seeded data shows the right shapes; 7d↔30d switch doesn't full-
reload; an empty project shows zeros, not a crash.
**Watch out:** breakdowns over long ranges must read rollups, not raw events, or they blow the
latency budget.

#### PR 15: Filters + time range (ExplorationState-driven) + URL sync
**What it does:** wire the dashboard to ExplorationState — clicking any datapoint appends a filter
chip; time range and grouping mutate state; the URL is the source of truth; switching projection
never refetches (projection cache).
**Test before merge:** filter feedback < 50ms (optimistic + projection cache, no round-trip);
reloading the page reproduces the exact view; a shared URL reproduces the exact answer.
**Watch out:** mutations must be pure and debounce one URL write; never resolve `time` to dates in
the URL.

#### PR 16: Decision engine + Decision Bar
**What it does:** the deterministic engine — read the resolved result + comparison, classify movers
by metric polarity, rank by impact/urgency, attach evidence + a reversible action. Render as the
Decision Bar.
**Test before merge:** fixed input → exact recommendations (golden test); a drop in 404s reads as
good, a drop in conversions as bad; every recommendation links to real aggregates.
**Watch out:** no clock, randomness, or network in the engine — it must be a pure function of state,
or it's neither testable nor trustworthy.

---

### Sprint 5 — Realtime

#### PR 17: Realtime live count + feed via SSE
**What it does:** `GET /…/realtime` SSE; worker bumps `realtime:<id>` and publishes diffs via Redis
pub/sub; live count from a sorted set (last 5 min); live feed from the diff stream. `RealtimeCount`
+ live feed components.
**Test before merge:** count updates within ~2s of curl'd events; closing a tab cleans up the
connection; two tabs both work.
**Watch out:** handle `req.on('close')` or leak sockets. Realtime is the *same* projection fed by a
stream — don't fork the query path.

#### PR 18: Reconnect / heartbeat / backpressure
**What it does:** 15–25s heartbeat, exponential-backoff reconnect with fresh-snapshot re-baseline,
delta-only payloads, trailing debounce, backpressure coalescing, offline last-good buffering.
**Test before merge:** kill and restore the stream — the client re-baselines without a reload;
under a burst, intermediate frames are coalesced, not queued unbounded.
**Watch out:** realtime must converge to the historical rollup at each bucket close — a "preview,
never a fork." Assert convergence in a test.

---

### Sprint 6 — Depth + Share

#### PR 19: Exploration lenses (events / sessions / journey)
**What it does:** the analytics surface's four lenses over one shared filter set (brief Phase 9) —
events explorer (dense table, expandable rows, column toggles, infinite scroll), sessions
(expandable page-flow + timeline), journey (single-visit timeline + aggregate Sankey).
**Test before merge:** switching lenses keeps filters and never refetches (projection cache); event
paginating sums correctly; the Sankey renders from real aggregates.
**Watch out:** lenses are projections of the same state — no lens holds private state. Journey/Sankey
are aggregate-only, never an individual profile.

#### PR 20: Comparison mode
**What it does:** first-class comparison (A vs B segment, or vs previous period) via the
`comparison` field; overlay in trend + KPIs.
**Test before merge:** comparison resolves in < 500ms (two plans: primary + shifted baseline);
overlay math is correct.
**Watch out:** comparison is a state field, not a separate page — it must serialize into the URL and
survive share/reload.

#### PR 21: Saved views + shareable/deep-link URLs
**What it does:** save an ExplorationState (`saved_views`), list/apply/restore; shareable links
(signed read-only scope for external shares); for very large states, store server-side and put a
short hash in the URL.
**Test before merge:** a saved view restores the exact state; a shared read-only link can't mutate
server data; opening a shared link warms the cache for teammates.
**Watch out:** the signed share scope must be read-only and non-elevating — verify it can't reach
write endpoints.

#### PR 22: Command palette
**What it does:** `⌘K` palette (cmdk) — navigate, jump to projects, apply saved views, run actions;
`command`/`ui` state is local and never serialized to shared URLs.
**Test before merge:** palette opens < 50ms; keyboard-only navigation works; actions respect RBAC.
**Watch out:** palette state is ephemeral/local — keep it out of the shared URL.

---

### Sprint 7 — Accounts, Onboarding & the v1.0/v1.1 feature surfaces

#### PR 23: Teams + RBAC enforcement
**What it does:** finish teams — invite flow, roster, role changes, pending invites; enforce
`can(actor, action, resource)` across every endpoint, deny by default, ownership before role.
**Test before merge:** each role can do exactly its allowed actions and no more; an expired invite
can't be redeemed; the last owner can't be removed without transfer.
**Watch out:** authorize on the **resource + action**, not per-route strings — one missed route is a
data leak.

#### PR 24: Site Settings (all sections) + autosave
**What it does:** the brief's Phase 12 control center — General, Tracking (install snippets, debug,
SPA toggle, live event inspector), Privacy (IP anonymization **locked always-on**, DNT, bot filter,
etc.), Data Retention (plan-gated), API Keys, Team Access, Integrations, Imports/Exports, Audit Log,
Danger Zone. Autosave (idle→saving→saved).
**Test before merge:** autosave debounces and shows status; locked/plan-gated toggles are truly
non-editable; Danger Zone actions require typed confirmation.
**Watch out:** IP anonymization is **not disableable** — it's structural (we never store IPs). The
UI states it; the backend enforces it regardless of the toggle.

#### PR 25: Goals & Conversions
**What it does:** brief Phase 10 — 6 goal types (page, event, outbound, file, time, scroll),
versioned edits, statuses (active/paused/draft/archived), list + detail (rate trend, breakdowns,
lightweight funnel), create/edit drawer with live-preview sentence. Conversion attribution in the
worker/rollups.
**Test before merge:** each goal type attributes correctly against seeded events; editing bumps the
version and keeps history; soft-archive is restorable; delete requires typing the goal name and is
recoverable for 30 days.
**Watch out:** goals are "as simple as a bookmark" — funnels/composite goals stay gated as
"Advanced". Attribute goals from the immutable log so a definition change can be recomputed.

#### PR 26: Alerts & Notifications
**What it does:** brief Phase 11 — 12 alert types, 8 conditions, channels (email + in-app live;
slack/discord/webhook modeled but disabled), notification center (unread/ack), 5-step create wizard,
smart suggestions. Hourly evaluation job (BullMQ) against rollups; `alert_triggers` history;
`notification_jobs` with backoff + dead-letter.
**Test before merge:** an alert fires when its condition is met and **not again** within its window
(dedupe); email arrives (Resend); muted alerts stay silent until `muted_until`.
**Watch out:** alert evaluation reads rollups, not raw events. Every notification job is idempotent
and retried with backoff; a bad channel config must not crash the worker.

#### PR 27: Onboarding & Activation + install wizard
**What it does:** brief Phase 14 + Installation — the full-screen first-run flow (welcome → add site
→ install snippet → verify tracking → live), 14-framework snippets, live verify state machine with
the full error taxonomy (domain mismatch, CSP blocked, network, timeout), activation checklist,
optional GA import entry point. Target: time-to-first-event < 5 min.
**Test before merge:** the happy path reaches "you're live" on a real snippet; each error state shows
correct copy + fix; the checklist reflects real progress.
**Watch out:** verify must handle the CSP case (tell users to allowlist `cdn.logly.app` /
`in.logly.app`) — it's the most common real failure.

#### PR 28: API keys + audit log
**What it does:** create (reveal-once), list, revoke keys (`key_hash` only stored, `revoked_at`
checked per request, scopes); the audit log surface (insert-only server-side, who/what/when/before/
after).
**Test before merge:** a revoked key is rejected immediately; the raw secret never appears after
creation; every privileged action writes an audit row.
**Watch out:** store only the SHA-256 of the secret. The audit log is append-only — no update/delete
path exists in code.

#### PR 29: Exports (async jobs)
**What it does:** CSV/PNG/PDF/JSON exports as `export_jobs` — request → worker runs → signed S3-ish
URL (24h TTL) → download. Scheduled reports (weekly digest).
**Test before merge:** a large export runs async with progress and yields a working signed URL that
expires; exports contain **derived fields only**, never raw identities.
**Watch out:** exports run off the hot path with their own budget/window (brief capacity planning).
The signed URL must actually expire.

#### PR 30: Integrations — webhooks + importers
**What it does:** signed at-least-once webhooks (deliver → verify → retry+jitter → dead-letter →
replay); importers (CSV/GA4/Segment/Mixpanel) that normalize to the event contract before storage.
**Test before merge:** a webhook delivers in order per subscription, retries on 5xx, dead-letters
after the bound, and replays on demand; an import lands as normal events indistinguishable from live
ones.
**Watch out:** everything normalizes to the one event contract — no downstream special-casing.
Webhook payloads are signed; no shared secret in the clear.

#### PR 31: SDK v1 + v2
**What it does:** `@logly/browser` (+ `@logly/react`, `@logly/node`) — pageviews + SPA tracking
(v1), `logly.track(name, props)` custom events (v2, backward compatible). esbuild < 2kb. No client
identity; `event_props` capped ~1kb; whole thing try/caught.
**Test before merge:** drop the script in a test page — pageviews + SPA navs land; `track()` writes a
custom event with props; a thrown error inside the SDK never breaks the host page.
**Watch out:** identity is server-side (PR 8), not in the SDK. Beacon on unload or you lose the last
event.

---

### Sprint 8 — Hardening + Launch

#### PR 32: Observability
**What it does:** RED/USE metrics per interaction, structured **PII-free** correlation-tagged logs,
distributed tracing (browser → edge → origin → store), liveness/readiness probes, per-interaction
budget dashboards, SLO alerting on burn rate.
**Test before merge:** a traced request shows every hop; logs contain no PII/raw payloads; a
synthetic latency regression trips the right SLO alert.
**Watch out:** "if it moves, it's measured" — but never log a raw event payload or anything that
could be PII.

#### PR 33: Performance & resilience gates
**What it does:** wire the brief's 18 latency budgets into CI as assertions; add load (nightly),
stress (past 10× target), and chaos (weekly) tests; add circuit breakers, timeouts on every boundary
call, and graceful-degradation fallbacks (stale-marked answers, offline mode).
**Test before merge:** CI fails on a budget regression; killing a dependency degrades (stale cache +
queued writes) instead of cascading.
**Watch out:** perf and a11y gates have **no override** (brief quality gates). Tune p95, not p50 —
optimize the worst common case.

#### PR 34: Deploy + environments + rollout/rollback
**What it does:** environments (dev → preview → staging → prod), immutable artifacts built once and
promoted, progressive rollout + canary, one-action rollback, feature flags decoupling deploy from
release. Backend on Fly.io, frontend on Vercel, Postgres on Neon/Fly (via PgBouncer), Redis on
Upstash.
**Test before merge:** full E2E from a real hosted snippet → production dashboard; collector < 50ms
from multiple regions; a rollback restores the previous version in one action.
**Watch out:** set `NODE_ENV=production` and point `DATABASE_URL` at a pooler, or you'll hit
connection limits. Data migrations must be backward-compatible (expand-contract) so rollback is safe.

#### PR 35: Launch — marketing site, docs, public beta
**What it does:** the marketing site + docs (brief's Logly Website), the launch checklist cleared,
SLO dashboards live, public beta opened via widening release rings.
**Test before merge:** the launch checklist (7-gate DoD across the product) is green; SLOs are
dashboarded and alerting; the marketing site's install flow matches the real one.
**Watch out:** the scope table is a promise — resist pulling v2 features into launch. Decision
Velocity wins over feature count.

---

## The Non-Obvious Things That Will Bite You

**1. CORS on the collector vs. the API.** Collector = wide open (runs on third-party sites). API =
locked to your frontend origin, credentialed. Two configs. Don't make the API wide-open by accident.

**2. `tracking_id` is public; project `id` is not.** Every `/api/projects/:id` route verifies the id
belongs to the caller's team → 403, not the data.

**3. Time zones are a trap.** Store everything `TIMESTAMPTZ` (UTC). "Today" is defined in UTC —
document it. Convert to local only on the frontend via `Intl.DateTimeFormat`. And note: the daily
salt rotation is a **UTC-midnight** boundary — that's your session/day boundary too.

**4. The rollup upsert must be idempotent.** Worker crashes re-process events:
```sql
INSERT INTO daily_stats (project_id, date, views, visitors, sessions, bounces)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (project_id, date) DO UPDATE SET
  views = daily_stats.views + EXCLUDED.views, ...;
```
Non-idempotent upserts double-count. Accept occasional slight over-count on crashes at MVP; the
reconciliation job (PR 11) is your correctness backstop.

**5. Rollup drift is the top data risk.** Rollups are pure functions of the immutable log — if they
drift, recompute. The reconciliation test (recompute a day from raw, assert equality) runs in CI.

**6. Redis list isn't a queue.** A worker crash mid-flush loses the trimmed batch. Fine for MVP;
move to Redis Streams before multi-worker.

**7. Never store the salt or the IP.** The salt lives only in Redis with a to-midnight TTL; the IP is
used for hash+country then discarded. If either is ever written to disk/DB/logs, the privacy
guarantee is broken.

---

## The Code Quality Rules I Actually Enforce

- Every DB route has try/catch — a bare Prisma error leaks a stack trace (info disclosure).
- No `any`. Use `unknown` + narrow, or derive the type from a Zod schema (`z.infer`). Prefer
  `satisfies`.
- All DB timestamps `TIMESTAMPTZ`, never `TIMESTAMP` — DST will burn you.
- Every background job has a timeout (`Promise.race`). A hung GeoIP lookup must not stall the flush.
- The collector never logs raw event payloads in prod — only `trackingId` + `type`.
- One Zod schema per shape, shared across SDK/collector/worker/API/frontend. The contract is the
  source of truth; a breaking change fails CI.
- Named exports only (default reserved for route pages). TS strict + `noUncheckedIndexedAccess`.
- Server state → TanStack Query. Client state → Zustand. Never duplicate server state into a store.

---

## You're Building a Real Product

When you finish, you'll have the whole brief realized on a stack a small team can actually run: a
privacy-first architecture where a person is *unstorable* by design; an event-first log with
rebuildable rollups; an exploration engine where every answer is a URL; a deterministic decision
engine that tells you what to do, not just what happened; and a defended latency budget on every
interaction.

Build toward the brief's targets; don't pay for them before the traffic needs them. Each PR is a
complete unit of work with a rollback path. The goal isn't to finish fast — it's to finish knowing
exactly why every line exists, and never having broken one of the six load-bearing decisions to get
there.
