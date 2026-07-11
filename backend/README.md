# Logly Backend — Developer Guide

The API + ingestion server for **Logly**, a privacy-first, realtime web-analytics product
(Plausible/Fathom style). This guide is everything a new backend developer needs to be productive in
this repo. Read it end to end before your first change.

> **Product context.** The `/Users/.../Logly product design brief/` docs are the product spec (source
> of truth), and `logly/GUIDE.md` is the senior-dev architecture rationale for the whole app. The
> full onboarding handbook is `logly/LEARNING_GUIDE.md` — read that for the *why* behind everything;
> this README is the **backend reference** (facts, files, contracts, gotchas). The mission is
> *"Decision Velocity" — shrink the gap between a question and a confident decision*.

---

## Table of contents

1. [The one big idea: the hot/cold path split](#the-one-big-idea-the-hotcold-path-split)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Scripts](#scripts)
5. [Environment variables](#environment-variables)
6. [Project structure](#project-structure)
7. [The middleware seam](#the-middleware-seam)
8. [The collector (hot path)](#the-collector-hot-path)
9. [The worker (cold path)](#the-worker-cold-path)
10. [Redis: buffer, cache, counter, lock](#redis-buffer-cache-counter-lock)
11. [Routes & API contract](#routes--api-contract)
12. [Authentication](#authentication)
13. [Database (Prisma)](#database-prisma)
14. [The privacy model](#the-privacy-model)
15. [Alerts](#alerts)
16. [Realtime (SSE)](#realtime-sse)
17. [Conventions](#conventions)
18. [How to add a new endpoint](#how-to-add-a-new-endpoint)
19. [Known gaps & gotchas](#known-gaps--gotchas)
20. [Divergence from the brief](#divergence-from-the-brief)

---

## The one big idea: the hot/cold path split

Everything here follows from one decision: **ingestion (writes) and querying (reads) are different
problems and never block each other.**

```
  WRITE (hot path)                         READ (cold/query path)
  SDK ─► /api/collect ─► Redis             browser ─► /api/... ─► Prisma ─► Postgres
              │  204 (never touches DB)        (auth-guarded, typed JSON)
              ▼
        Worker (every 5s) ─► Postgres (events + daily_stats rollups)
```

- The **collector** does the absolute minimum (resolve id → validate → push to Redis → `204`) and
  **never writes to Postgres inline.** Redis is the shock absorber for write spikes.
- The **worker** is a *separate process* that drains Redis into Postgres and maintains precomputed
  **rollups** (`daily_stats`), so dashboards read cheap summaries instead of scanning raw events.

> ⚠️ **You must run both processes.** `npm run dev` (API) **and** `npm run worker` (worker). If the
> worker isn't running, events pile up in Redis and never reach the DB — the dashboard stays empty.
> This is the #1 "it's broken" cause.

---

## Tech stack

| Concern | Choice | Version |
|---|---|---|
| Runtime | Node.js | ^20 |
| Framework | Express | ^4.18 |
| Language | TypeScript (strict) | ^5 |
| ORM | Prisma | ^5 (`@prisma/client`) |
| Database | PostgreSQL | via Docker (:5432) |
| Cache / buffer / realtime | Redis (ioredis) | ^5.3 (:6379) |
| Job queue | BullMQ | ^5 |
| Validation | Zod | ^3.22 |
| Auth | jsonwebtoken + bcryptjs | ^9 / ^2.4 |
| Email | nodemailer | ^6.9 |
| Hardening | helmet, cors, compression, express-rate-limit, cookie-parser | — |
| Dev runner | nodemon + ts-node | — |

> The design brief targets a bigger production stack (Fastify, ClickHouse, Redis Streams,
> OpenTelemetry). We deliberately ship on this simpler stack and **adopt the brief's patterns, not its
> exact vendors** — the seams (worker + rollups + typed API) let us swap engines later without a
> rewrite. See [Divergence from the brief](#divergence-from-the-brief).

There is **no test runner and no ESLint config** yet. The only automated gate is `npm run build`
(`tsc`). Strict mode is on.

---

## Quick start

```bash
cd logly/backend
docker compose up -d        # start PostgreSQL (:5432) + Redis (:6379)
cp .env.example .env        # then fill in the values (see Environment variables)
npm install
npm run db:migrate          # apply the Prisma schema
npm run dev                 # API on http://localhost:3001  (nodemon + ts-node)
# in a SECOND shell — REQUIRED for data to appear:
npm run worker              # the flush worker (drains Redis → Postgres every 5s)
```

Then the frontend (`logly/frontend`, `npm run dev`) proxies `/api/*` → `:3001`. Register/login, create
a project, drop its snippet on a page (or `curl` the collector), and within ~5s the worker rolls it up
into the dashboard.

> **Note:** `npm run db:seed` is wired in `package.json` but **`prisma/seed.ts` does not exist yet** —
> seeding is currently manual. See [Known gaps](#known-gaps--gotchas).

Send a test event by hand:

```bash
curl -X POST http://localhost:3001/api/collect/<trackingId> \
  -H 'Content-Type: application/json' \
  -d '{"type":"pageview","page":"https://example.com/","referrer":""}'
# → 204, then appears in daily_stats after the next worker flush (~5s)
```

---

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | API server on :3001 (nodemon + ts-node, auto-restart) |
| `npm run worker` | The flush worker — **separate process, run alongside `dev`** |
| `npm run build` | `tsc` → `dist/` (the type gate; run before every commit) |
| `npm start` | Run the compiled build (`node dist/index.js`) |
| `npm run db:migrate` | `prisma migrate dev` — create/apply migrations |
| `npm run db:seed` | `ts-node prisma/seed.ts` — ⚠️ file missing today |

---

## Environment variables

Put local values in `logly/backend/.env` (gitignored). Expected vars:

| Var | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | required by Prisma |
| `REDIS_URL` | Redis connection string | buffer/cache/counter/queue |
| `JWT_SECRET` | signs/verifies auth tokens | **must be strong in any real env** — a weak default = forgeable tokens |
| `CORS_ORIGIN` | allowed dashboard origin | applied to `/api/auth` + `/api/projects` only |
| `PORT` | API port | defaults to **3001**; if you change it, update the frontend Vite proxy |
| `SMTP_*` | nodemailer transport | used by the alert email worker (see [Alerts](#alerts)) |

---

## Project structure

```
backend/
  prisma/
    schema.prisma        The database schema (5 models). NO migrations/ committed, NO seed.ts yet.
  src/
    index.ts             Express bootstrap: middleware seam, mounts routers, listen(:3001)
    routes/
      auth.ts            POST /register, /login ; GET /me         (no /logout — see gaps)
      projects.ts        CRUD, router.use(requireAuth), scoped by userId
      metrics.ts         today / trend / pages / events / realtime(SSE) ; requireAuth + verifyOwnership
      events.ts          paginated raw event log (type/from/to filters)
      collect.ts         THE HOT PATH — ingestion beacon, public, no auth, CORS *
    jobs/
      worker.ts          The flush worker (npm run worker): drain Redis → Postgres → rollups → alerts
      alertQueue.ts      BullMQ queue + startAlertWorker() email consumer  (consumer never started!)
    lib/
      prisma.ts          Singleton Prisma client
      redis.ts           Two ioredis connections (redis + redisSub)
      jwt.ts             sign / verify JWT
      salt.ts            Daily-salted visitor-hash (computeVisitorId)
    middleware/
      auth.ts            requireAuth (Bearer) → req.userId ; verifyOwnership
      validate.ts        Zod body validation
      errorHandler.ts    thrown ApiError → { message, code }
```

---

## The middleware seam

Defined in `src/index.ts`. **Middleware scope is a deliberate design decision — don't change it
casually.**

```
Request
  │
  ├─ GLOBAL:  helmet · cookieParser · compression · express.json
  │
  ├─ /api/auth      ┐
  ├─ /api/projects  ┼─ SCOPED: credentialed CORS (CORS_ORIGIN) + rate limit (100 req/min)
  │  (+ metrics,    ┘         + requireAuth on protected routes
  │   events mount
  │   on /projects)
  │
  └─ /api/collect ── NO CORS restriction, NO rate limit (sets Access-Control-Allow-Origin: * itself)
  │
  errorHandler (last) → { message, code }
```

> 🚨 **Load-bearing:** `/api/collect` is intentionally open. The SDK embeds on third-party sites and
> must accept a firehose from any origin with no auth. **Never move auth or rate-limiting in front of
> the collector** — it would throttle real analytics. It has its own `OPTIONS` handler for preflight.

---

## The collector (hot path)

`POST /api/collect/:trackingId` in `routes/collect.ts`. What it does, in order:

1. **Resolve** `trackingId → projectId`: `getProjectIdForTrackingId()` reads Redis
   `GET project_id:<trackingId>`, falls back to `prisma.project.findUnique`, and caches the result
   with `SETEX ...:300` (5-min TTL). Unknown id → `404`.
2. **Validate** the body with a Zod `collectSchema`:
   `{ type: 'pageview'|'custom', page (url), referrer?, eventName?, eventProps?, sessionId?(uuid) }`.
3. **Enrich**: derive `deviceType` (UA regex), `country` (`cf-ipcountry` / `x-country` header), and
   `visitorId` via `computeVisitorId(projectId, ip, ua)` (daily-salted hash — see
   [privacy model](#the-privacy-model)).
4. **Buffer**: `RPUSH events:<projectId>` → `SADD active_projects` → `INCR realtime:<projectId>`
   (`+ EXPIRE 300`).
5. **Return `204`.** No Postgres. Sets `Access-Control-Allow-Origin: *`.

---

## The worker (cold path)

`src/jobs/worker.ts` — a separate long-running process (`setInterval` every 5s + an immediate run +
a graceful final flush on SIGTERM/SIGINT).

```
flush()  ──►  SMEMBERS active_projects  ──►  Promise.all(flushProject)

flushProject(projectId):
  1. SET flushing:<id> 1 EX 30 NX          ← lock so two flushes don't double-drain
  2. LRANGE events:<id> 0..999  (BATCH_SIZE 1000)  +  LTRIM
  3. prisma.event.createMany({ skipDuplicates })
  4. Recompute daily_stats for each affected UTC day (idempotent upsert):
        views    = COUNT(*)
        visitors = COUNT(DISTINCT visitor_id)
        sessions = COUNT(DISTINCT session_id)
  5. checkAlerts(projectId)
  6. DEL flushing:<id>   (in finally)
```

> **Why recompute, not increment?** The flush can retry, and `increment` would double-count across
> batches. Aggregations must be **idempotent** when the producer can retry — so we `SET` the day's
> totals via `upsert` on the composite key `(projectId, date)`.

`checkAlerts()` compares today's vs yesterday's `daily_stats` views, computes `changePct`, throttles to
once/hour via `alert.lastTriggered`, and on a spike/drop enqueues a job onto `alertQueue`
(see [Alerts](#alerts)).

---

## Redis: buffer, cache, counter, lock

`lib/redis.ts` exposes two connections (`redis`, `redisSub`). Keys/structures in use:

| Key / structure | Ops | Purpose |
|---|---|---|
| `project_id:<trackingId>` | GET / SETEX 300 | trackingId → projectId cache |
| `events:<projectId>` (list) | RPUSH / LRANGE / LTRIM | the event buffer |
| `active_projects` (set) | SADD / SMEMBERS | which projects the worker should drain |
| `flushing:<projectId>` | SET NX EX 30 / DEL | lock so two flushes don't double-drain |
| `realtime:<projectId>` | INCR / EXPIRE 300 / GET | the live visitor counter |
| `redisSub` (2nd conn) | — | reserved for pub/sub; **currently unused** (SSE polls instead) |

---

## Routes & API contract

All under `/api`. Auth = **Bearer token** in the `Authorization` header.

```
PUBLIC (no auth):
  POST    /api/collect/:trackingId     ingest an event → 204
  OPTIONS /api/collect/:trackingId     preflight

AUTH:
  POST    /api/auth/register           → { token, user }   (bcrypt cost 12)
  POST    /api/auth/login              → { token, user }
  GET     /api/auth/me                 → user              (requireAuth)

PROJECTS (requireAuth, scoped by userId):
  GET     /api/projects                list
  POST    /api/projects                create
  GET     /api/projects/:id            read
  DELETE  /api/projects/:id            delete

METRICS (requireAuth + verifyOwnership):
  GET  /api/projects/:id/metrics/today     → { today, yesterday, realtime, delta:{ viewsPct } }
  GET  /api/projects/:id/metrics/trend     → { trend, days }
  GET  /api/projects/:id/metrics/pages     → { pages:  [{ page, views }] }
  GET  /api/projects/:id/metrics/events    → { events: [{ eventName, count }] }
  GET  /api/projects/:id/metrics/realtime  → SSE (polls realtime:<id> every 5s)

EVENTS (requireAuth + verifyOwnership):
  GET  /api/projects/:id/events?type=&from=&to=&page=  → { events, total, page, totalPages }
```

> ⚠️ **Contract drift with the frontend.** Some of these response shapes differ from what the frontend
> currently reads (e.g. events: FE reads `data.data`; today: FE expects flat `{views, viewsDelta,
> bounceRate}`). See [Known gaps](#known-gaps--gotchas) — reconciling these is a top near-term task.

---

## Authentication

Bearer-token based, stateless (the JWT *is* the session — no server session store).

1. `POST /api/auth/register` or `/login` → `{ token, user }`. Passwords hashed with bcrypt (cost 12).
2. `requireAuth` (`middleware/auth.ts`) verifies the JWT via `lib/jwt.ts` and sets `req.userId`.
3. `verifyOwnership` (on project-scoped routes) confirms the project belongs to `req.userId`.

Authorization is **coarse today**: any authenticated user, with ownership enforced via `userId` in
queries. The brief's target is full RBAC (Owner/Admin/Editor/Analyst/Viewer) with per-resource
`can(actor, action, resource)` checks — not implemented yet.

> `JWT_SECRET` must be a strong secret in any real environment. A weak/default secret means forgeable
> tokens.

---

## Database (Prisma)

Schema in `prisma/schema.prisma` (provider = `postgresql`). Five models:

| Model | Key fields | Notes |
|---|---|---|
| **User** | id(uuid), email(unique), passwordHash, plan="free", createdAt | the only entity tied to a real person |
| **Project** | id, userId, name, domain, **trackingId(unique)**, createdAt; `@@index([userId])` | trackingId is what the SDK sends |
| **Event** | type, page, referrer?, country?, deviceType?, eventName?, eventProps(Json?), **visitorId?**, sessionId?, createdAt; `@@index([projectId,createdAt])`, `[projectId,type]` | immutable, append-only; **plain table (not partitioned)** |
| **DailyStat** | `@@id([projectId,date])`, date, views, visitors, sessions | one row per project-day; idempotently `upsert`ed |
| **Alert** | type, thresholdPct, emails[], lastTriggered? | consumed by the worker's `checkAlerts()` |

**Data shapes:** high-volume immutable `Event` rows (write-once) + small `DailyStat` rollups
(read-often). Dashboards read the rollup, never scan the event log. Indexes match the query patterns
(`projectId + time`, `projectId + type`; unique `trackingId`/`email`).

> ✅ `Event.visitorId` **exists** and the worker counts `COUNT(DISTINCT visitor_id)` separately from
> sessions — so *visitors ≠ sessions* is real. (An older note in `CLAUDE.md` claiming otherwise is
> stale.)

---

## The privacy model

Privacy is **structural, not a policy**. `lib/salt.ts` computes an anonymous visitor id:

```
visitor_hash = SHA256( daily_salt + project_id + ip_address + user_agent )
                          │                        │
                    in memory only,           used to compute the hash,
                    rotated every 24h,        then DISCARDED (never stored)
                    destroyed at day end

day N   → hash_A
day N+1 → hash_B      (different salt → the same visitor is UNRELATABLE across days, by anyone)
```

- **Stored:** path, referrer, country (2-letter), device type, the daily hash.
- **Hashed then discarded:** IP → country; IP+UA → visitor hash.
- **Never stored:** names, emails, cookies, fingerprints, raw IP, precise location.

Because there's no cross-day identity and no PII, GDPR/CCPA/PECR compliance follows automatically. When
adding a field, always classify it: *stored* vs *hashed-then-discarded* vs *never stored*.

---

## Alerts

- **Evaluation** happens in the worker (`checkAlerts()` in `worker.ts`): spike/drop vs yesterday,
  throttled once/hour, enqueues `alertQueue.add('send-alert', ...)`.
- **Delivery** lives in `jobs/alertQueue.ts`: `alertQueue` (BullMQ Queue 'alerts', 3 attempts, exp
  backoff) + `startAlertWorker()` which builds a nodemailer transport and sends spike/drop emails.

> 🐛 **`startAlertWorker()` is never called anywhere.** Alerts are enqueued but no consumer runs, so
> **no emails are sent.** To fix: call `startAlertWorker()` in a running process (either inside the
> flush worker, or as its own process). See [Known gaps](#known-gaps--gotchas).

---

## Realtime (SSE)

`GET /api/projects/:id/metrics/realtime` is a Server-Sent Events stream that polls
`redis.get(realtime:<id>)` every 5s and pushes the live count. There is **no Redis pub/sub** today
(the `redisSub` connection is reserved but unused).

> 🐛 **SSE auth mismatch.** The route is behind `requireAuth`, but the frontend's `EventSource`
> **cannot send an `Authorization` header**, so the stream 401s. Fix options: accept the token as a
> query param and read it in the route, or mint a short-lived SSE ticket. The brief's target is a
> pub/sub → SSE fan-out with `Last-Event-ID` resume and a WebSocket→SSE→polling ladder.

---

## Conventions

- **Naming:** camelCase functions/vars, PascalCase types, SCREAMING_CASE constants, kebab-case routes.
- **Validation at the boundary:** every mutating endpoint validates its body with Zod
  (`middleware/validate`). The schema *is* the contract.
- **Errors:** handlers `throw new ApiError(status, message)`; the central `errorHandler` converts
  anything thrown into `{ message, code }`. One place, one shape.
- **Idempotency:** any operation the producer can retry (rollups, event inserts) must be idempotent.
- **Keep the hot path lean:** the collector must never do slow/optional work inline — buffer and let
  the worker handle it.
- **Singletons:** import the shared `prisma` / `redis` clients from `lib/` — don't create new
  connections per request (you'll exhaust the pool).
- **No stray `console.*` in shipped code** (brief rule); a real logger is a planned addition.

---

## How to add a new endpoint

1. Add a handler in the relevant `routes/*.ts` (or a new router file, mounted in `index.ts`).
2. Define a Zod schema and wrap the route with `validate(schema)` for any body.
3. Gate it with `requireAuth` (and `verifyOwnership` for project-scoped resources).
4. Do DB work via the singleton `prisma` client; read/write Redis via the singleton `redis` client.
5. Throw `ApiError` for expected failures (let `errorHandler` shape the response).
6. Keep the response shape aligned with what the frontend reads — confirm against the FE `types/` and
   `lib/api.ts` call site to avoid contract drift.
7. `npm run build` must pass; exercise the endpoint with `curl` before you call it done.

---

## Known gaps & gotchas

- **Run the worker.** `npm run worker` must run alongside `npm run dev`, or events never leave Redis.
- **Alert emails don't send** — `startAlertWorker()` is never called. Wire it into a process.
- **SSE realtime 401s** — the route requires a Bearer header that `EventSource` can't send.
- **`POST /api/auth/logout` doesn't exist** — the frontend calls it; the 404 is silently swallowed.
  Add the route or drop the FE call.
- **No `prisma/seed.ts`** despite the `db:seed` script; **no committed migrations** — a fresh clone
  seeds/migrates manually (`prisma migrate dev`).
- **Contract drift with the frontend** (fix the response shapes or the FE readers):
  | Endpoint | FE reads | BE returns |
  |---|---|---|
  | events | `data.data` (`Paginated<T>`) | `{ events, total, page, totalPages }` |
  | metrics/today | flat `{ views, viewsDelta, bounceRate }` | nested `{ today, yesterday, realtime, delta }` |
  | metrics/pages | `PageStat[]` (visitors + bounceRate) | `{ pages:[{page,views}] }` |
  | metrics/events | `EventStat[]` `{name,count,uniqueUsers}` | `{ events:[{eventName,count}] }` |
  | metrics/trend | `TrendPoint[]` | `{ trend, days }` |
- **Bounce rate & per-page/per-event unique visitors** aren't computed on the backend yet.
- **Port 3001** — if you change `PORT`, update the frontend Vite proxy target too.
- **No tests / no ESLint** — `npm run build` (tsc) is the only gate. Be disciplined.

---

## Divergence from the brief

The design brief specifies a larger production architecture; this repo implements the **patterns** on a
simpler stack. Treat the brief as the *target*, this table as *today*:

| Brief / GUIDE (target) | This repo (today) |
|---|---|
| ClickHouse columnar event store | PostgreSQL, plain `events` table |
| Events `PARTITION BY (project_id, day)` | plain Prisma table, not partitioned |
| Fastify | Express 4 |
| Redis **Streams** (consumer groups, DLQ) | Redis **list** (RPUSH/LRANGE/LTRIM) |
| Realtime via Redis pub/sub + SSE (cursor resume) | SSE polling `realtime:<id>` every 5s |
| Versioned `/api/v1` + `{data, meta}` envelope | unversioned `/api/...`, ad-hoc shapes |
| `Idempotency-Key` header | event-id `skipDuplicates` |
| 11 bounded services | logic in Express route handlers |
| RBAC + `can(actor, action, resource)` | coarse auth (any user + ownership by userId) |
| OpenTelemetry / Pino → Prometheus/Loki | `console.*` |
| httpOnly session cookie | JWT Bearer in the header (localStorage on the client) |

The **shape** already matches the vision — hot/cold split, immutable events, precomputed rollups,
privacy-by-design — so these are migrations along stable seams, not rewrites. For the full reasoning and
the 35-PR roadmap, see `logly/LEARNING_GUIDE.md` and `logly/GUIDE.md`.
