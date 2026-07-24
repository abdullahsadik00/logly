# Revenue-attribution integration tests

These cover the five DB/Stripe-dependent gaps from the eng review that the
unit suite (`src/lib/__tests__/`) can't reach. They are **skipped by default**
so `npm test` stays green without infrastructure. Fill in the `TODO`s and drop
the `skip` guard once the prerequisites below are in place.

The webhook **signature** path is already fully unit-tested in
`src/lib/__tests__/stripeSignature.test.ts` — these stubs cover the route
*wiring* around it (raw-body-before-json, project resolution, idempotency),
not the HMAC math again.

## The five stubs

| File | Gap it closes |
|------|---------------|
| `attribution.endpoint.test.ts`   | `POST /api/attribution/:trackingId` upsert + idempotency |
| `attribution.ratelimit.test.ts`  | attribution limiter posture (600/min) vs collect (none) |
| `stripeWebhook.route.test.ts`    | webhook route wiring: raw body, sig verify e2e, event.id idempotency, ignored types |
| `revenueBySource.read.test.ts`   | read-model aggregation: grouping, currency, total, date window |
| `e2e.attribution.test.ts`        | full join: collect → attribution → payment → revenue-by-source bucket |

## Prerequisites

1. **Install a client + runner deps** (not yet in package.json):
   ```bash
   npm i -D supertest @types/supertest
   ```
2. **A disposable test database.** Point `DATABASE_URL` at a throwaway PG and
   run migrations against it. Each test truncates the tables it touches
   (`helpers.ts#resetDb`) — never run these against a DB with real data.
   ```bash
   export DATABASE_URL=postgresql://logly:logly@localhost:5432/logly_test
   npx prisma migrate deploy
   ```
3. **Redis** on `:6379` (project resolution + realtime counter cache).
   `resetDb` also flushes the `project_id:*` cache keys.
4. **`STRIPE_WEBHOOK_SECRET`** and **`JWT_SECRET`** set for the run. The helper
   reads them; the webhook stub signs payloads with the same secret.
5. **`app.listen` is already guarded** for `NODE_ENV=test` in `src/index.ts`, so
   importing `{ app }` into supertest won't bind port 3001.

## Running

The `test:integration` script is already wired in `package.json` (kept separate
from the infra-free `npm test`):
```bash
RUN_INTEGRATION=1 npm run test:integration   # the script sets NODE_ENV=test + RUN_INTEGRATION=1
```
Without `RUN_INTEGRATION=1` every test skips and no DB/Redis connection is
opened — that's why `npm test` and CI stay green without infrastructure.
